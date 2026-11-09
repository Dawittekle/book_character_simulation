from __future__ import annotations

import hashlib
import logging
import os
import re
import sys
from pathlib import Path

# Add backend src to sys.path
backend_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend_dir / "src"))

from book_character_simulation_backend.config import Settings
from book_character_simulation_backend.db.models import (
    Book,
    BookChunk,
    BookSource,
    ChatMessage,
    ChatSession,
    ProcessingJob,
)
from book_character_simulation_backend.db.session import DatabaseManager
from book_character_simulation_backend.services.storage_service import StorageService
from sqlalchemy import select

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("migrate_to_storage")


def migrate_database_to_storage():
    """Migrate heavy text and file payloads from PostgreSQL to object storage."""
    settings = Settings.from_env()
    db = DatabaseManager(settings)
    storage = StorageService(settings)

    logger.info("Initializing storage migration...")
    logger.info("Storage backend: %s (bucket: %s)", "Cloudflare R2" if storage.is_cloud else "Local filesystem", storage.bucket_name)

    stats = {
        "books_migrated": 0,
        "sources_created": 0,
        "jobs_migrated": 0,
        "total_bytes_migrated": 0,
    }

    with db.session_scope() as session:
        # 1. Migrate Books
        books = session.scalars(select(Book)).all()
        logger.info("Found %d books in database to verify/migrate.", len(books))

        for book in books:
            existing_source = session.scalar(
                select(BookSource).where(BookSource.book_id == book.id).order_by(BookSource.created_at.asc())
            )

            # Reconstruct text from chunks if source doesn't exist or is empty
            if existing_source and existing_source.extracted_text and existing_source.storage_path:
                logger.info("Book '%s' (%s) already has stored source file at %s", book.title, book.id, existing_source.storage_path)
                continue

            chunks = session.scalars(
                select(BookChunk)
                .where(BookChunk.book_id == book.id)
                .order_by(BookChunk.chapter_order.asc(), BookChunk.chunk_index.asc())
            ).all()

            if not chunks and (not existing_source or not existing_source.extracted_text):
                logger.warning("Book '%s' (%s) has no chunks or text. Skipping.", book.title, book.id)
                continue

            if existing_source and existing_source.extracted_text:
                full_text = existing_source.extracted_text
            else:
                full_text = "\n\n".join(c.content for c in chunks)

            text_bytes = full_text.encode("utf-8")
            clean_filename = re.sub(r"[^a-zA-Z0-9_\-]+", "_", book.title).strip("_") + ".txt"

            perm_text_key = f"books/{book.id}/text/extracted.txt"
            perm_orig_key = f"books/{book.id}/original/{clean_filename}"

            logger.info("Uploading book '%s' assets to %s and %s (%d bytes)", book.title, perm_text_key, perm_orig_key, len(text_bytes))
            storage.upload_file(perm_text_key, full_text, content_type="text/plain; charset=utf-8")
            storage.upload_file(perm_orig_key, text_bytes, content_type="text/plain; charset=utf-8")

            text_hash = hashlib.sha256(text_bytes).hexdigest()

            if existing_source is None:
                new_source = BookSource(
                    book_id=book.id,
                    original_filename=clean_filename,
                    mime_type="text/plain",
                    storage_bucket=storage.bucket_name,
                    storage_path=perm_orig_key,
                    extracted_text=full_text,
                    extracted_text_hash=text_hash,
                    file_size_bytes=len(text_bytes),
                )
                session.add(new_source)
                stats["sources_created"] += 1
            else:
                existing_source.storage_bucket = storage.bucket_name
                existing_source.storage_path = perm_orig_key
                existing_source.extracted_text_hash = text_hash
                existing_source.file_size_bytes = len(text_bytes)
                if not existing_source.original_filename:
                    existing_source.original_filename = clean_filename

            stats["books_migrated"] += 1
            stats["total_bytes_migrated"] += len(text_bytes)

        # 2. Migrate Processing Jobs
        jobs = session.scalars(select(ProcessingJob)).all()
        logger.info("Found %d processing jobs in database to verify/migrate.", len(jobs))

        for job in jobs:
            if not isinstance(job.job_metadata, dict):
                continue

            text_content = job.job_metadata.get("text", "")
            if text_content and not job.job_metadata.get("text_storage_path"):
                text_key = f"temp_uploads/{job.id}/extracted.txt"
                logger.info("Offloading job %s text (%d chars) to storage: %s", job.id, len(text_content), text_key)
                storage.upload_file(text_key, text_content, content_type="text/plain; charset=utf-8")

                meta_copy = dict(job.job_metadata)
                meta_copy["text_storage_path"] = text_key
                meta_copy["storage_bucket"] = storage.bucket_name
                job.job_metadata = meta_copy
                stats["jobs_migrated"] += 1
                stats["total_bytes_migrated"] += len(text_content.encode("utf-8"))

        session.flush()

    logger.info("Migration completed successfully!")
    logger.info("Summary: %s", stats)

    # 3. If Cloud storage is active, sync local storage objects to Cloudflare R2
    if storage.is_cloud:
        logger.info("Syncing local storage cache to Cloudflare R2 bucket '%s'...", storage.bucket_name)
        synced_count = 0
        for local_file in storage.local_dir.rglob("*"):
            if local_file.is_file():
                rel_key = str(local_file.relative_to(storage.local_dir))
                try:
                    payload = local_file.read_bytes()
                    storage._s3_client.put_object(
                        Bucket=storage.bucket_name,
                        Key=rel_key,
                        Body=payload,
                    )
                    synced_count += 1
                except Exception as exc:
                    logger.debug("Cloud sync for %s skipped/failed: %s", rel_key, exc)
        logger.info("Synced %d objects to cloud storage.", synced_count)

    return stats


if __name__ == "__main__":
    migrate_database_to_storage()
