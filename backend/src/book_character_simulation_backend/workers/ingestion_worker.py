from __future__ import annotations

import hashlib
import logging
import re
import signal
import sys
import time
from typing import Any

from sqlalchemy import select

from ..config import Settings
from ..db.models import (
    Book,
    BookChapter,
    BookChunk,
    BookProcessingStatus,
    BookSource,
    CharacterProfileRecord,
    NotificationRecord,
    ProcessingJob,
)
from ..db.session import DatabaseManager
from ..errors import BadRequestError, NotFoundError
from ..llm.factory import get_llm_provider
from ..prompts import character_extraction_prompt
from ..rag.chunker import build_semantic_chunks, split_into_chapters
from ..rag.embedding_provider import EmbeddingService
from ..schemas.character import CharacterProfile
from ..services.storage_service import StorageService
from ..utils.json import parse_json_response

logger = logging.getLogger(__name__)


class IngestionWorker:
    """Asynchronous background ingestion worker for Lorely books.

    Claims jobs from the processing queue, executes chapter segmentation,
    runs full-book character extraction, indexes chunks into native pgvector
    embeddings, and updates canonical PostgreSQL records idempotently.
    """

    def __init__(self, database_manager: DatabaseManager, settings: Settings):
        self.db = database_manager
        self.settings = settings
        self.storage_service = StorageService(settings)
        self.embedding_service = EmbeddingService(settings)
        self._running = False

    def claim_next_job(self) -> str | None:
        """Atomically claim the next queued processing job."""
        with self.db.session_scope() as session:
            stmt = select(ProcessingJob).where(ProcessingJob.status == "queued").order_by(ProcessingJob.created_at.asc())
            # For PostgreSQL, use SKIP LOCKED for non-blocking multi-worker concurrency
            if "postgresql" in (self.settings.database_url or ""):
                stmt = stmt.with_for_update(skip_locked=True)
            else:
                stmt = stmt.with_for_update()

            job = session.execute(stmt).scalars().first()
            if job is None:
                return None

            job.status = "processing"
            job.stage = "claimed"
            job.progress = 10
            session.flush()
            return job.id

    def process_job(self, job_id: str) -> dict[str, Any]:
        """Execute the ingestion pipeline for a given job ID idempotently."""
        logger.info("IngestionWorker starting processing for job=%s", job_id)
        with self.db.session_scope() as session:
            job = session.get(ProcessingJob, job_id)
            if job is None:
                raise NotFoundError(f"Job {job_id} not found.")

            book = session.get(Book, job.book_id) if job.book_id else None
            if book is None:
                job.status = "failed"
                job.error_message = "Associated book record not found for job."
                return {"status": "failed", "error": job.error_message}

            try:
                # 1. Validation & Classification Gate
                job.status = "processing"
                job.stage = "validating_source"
                job.progress = 20
                session.flush()

                extracted_text = job.job_metadata.get("text", "")
                if not extracted_text and job.job_metadata.get("text_storage_path"):
                    downloaded = self.storage_service.download_file(job.job_metadata["text_storage_path"])
                    if downloaded:
                        extracted_text = downloaded.decode("utf-8", errors="replace")

                if not extracted_text:
                    raise BadRequestError("Extracted text is empty or could not be loaded from storage.")

                force_extraction = bool(job.job_metadata.get("force_extraction", False))
                is_doc = job.document_type == "document"
                supported = job.job_metadata.get("supported_for_character_simulation", True)
                if (is_doc or not supported) and not force_extraction:
                    warning = job.job_metadata.get("warning") or (
                        "This file is classified as a non-narrative document. "
                        "Character extraction is blocked unless force_extraction is enabled."
                    )
                    raise BadRequestError(warning)

                # 2. Permanent Assets in Object Storage
                orig_filename = job.job_metadata.get("filename") or f"{book.title}.txt"
                perm_text_key = f"books/{book.id}/text/extracted.txt"
                perm_orig_key = f"books/{book.id}/original/{orig_filename}"

                try:
                    self.storage_service.upload_file(
                        perm_text_key, extracted_text, content_type="text/plain; charset=utf-8"
                    )
                    temp_storage_key = job.job_metadata.get("storage_path")
                    if temp_storage_key and self.storage_service.file_exists(temp_storage_key):
                        raw_data = self.storage_service.download_file(temp_storage_key)
                        if raw_data:
                            self.storage_service.upload_file(perm_orig_key, raw_data)
                    else:
                        self.storage_service.upload_file(
                            perm_orig_key, extracted_text.encode("utf-8"), content_type="text/plain"
                        )
                except Exception as exc:
                    logger.warning("Storage upload notice during ingestion (%s): %s", book.id, exc)

                text_bytes = extracted_text.encode("utf-8")
                # Idempotent source record check
                existing_source = session.execute(
                    select(BookSource).where(BookSource.book_id == book.id)
                ).scalars().first()
                if not existing_source:
                    source = BookSource(
                        book_id=book.id,
                        original_filename=orig_filename,
                        mime_type=f"application/{job.job_metadata.get('format', 'text')}",
                        storage_bucket=self.storage_service.bucket_name,
                        storage_path=perm_orig_key,
                        extracted_text=extracted_text,
                        extracted_text_hash=hashlib.sha256(text_bytes).hexdigest(),
                        file_size_bytes=len(text_bytes),
                    )
                    session.add(source)

                # Clean up temporary uploads
                try:
                    self.storage_service.delete_prefix(f"temp_uploads/{job.id}/")
                except Exception as exc:
                    logger.debug("Failed cleaning temp storage for job %s: %s", job.id, exc)

                # 3. Chapter Segmentation
                job.stage = "segmenting_chapters"
                job.progress = 40
                session.flush()

                chapters = split_into_chapters(extracted_text)
                for ch in chapters:
                    existing_ch = session.execute(
                        select(BookChapter).where(
                            BookChapter.book_id == book.id,
                            BookChapter.chapter_order == ch.order,
                        )
                    ).scalars().first()
                    if not existing_ch:
                        session.add(
                            BookChapter(
                                book_id=book.id,
                                chapter_order=ch.order,
                                title=ch.title,
                                start_char=ch.start_char,
                                end_char=ch.end_char,
                                word_count=ch.word_count,
                            )
                        )
                session.flush()

                # 4. Character Extraction
                job.stage = "extracting_characters"
                job.progress = 60
                session.flush()

                provider_name = job.job_metadata.get("llm_provider") or self.settings.llm_provider
                provider = get_llm_provider(self.settings, provider_name=provider_name)
                system_prompt, user_prompt = character_extraction_prompt(
                    extracted_text[: self.settings.max_source_characters]
                )
                raw_response = provider.generate_json(system_prompt=system_prompt, user_prompt=user_prompt)
                parsed_characters = parse_json_response(raw_response)
                extracted_count = 0

                if isinstance(parsed_characters, list):
                    for idx, char_dict in enumerate(parsed_characters):
                        if not isinstance(char_dict, dict):
                            continue
                        if not char_dict.get("id"):
                            char_dict["id"] = re.sub(
                                r"[^a-z0-9]+", "-", char_dict.get("name", f"char-{idx+1}").lower()
                            ).strip("-")
                        c = CharacterProfile.model_validate(char_dict)
                        # Check idempotency for character
                        existing_char = session.execute(
                            select(CharacterProfileRecord).where(
                                CharacterProfileRecord.book_id == book.id,
                                CharacterProfileRecord.stable_character_key == c.id,
                            )
                        ).scalars().first()
                        if not existing_char:
                            session.add(
                                CharacterProfileRecord(
                                    book_id=book.id,
                                    stable_character_key=c.id or f"char-{idx+1}",
                                    name=c.name,
                                    role="Protagonist" if idx == 0 else "Supporting",
                                    personality=c.personality,
                                    key_events=c.key_events or [],
                                    relationships=c.relationships or [],
                                    psi_parameters=c.psi_parameters.model_dump(mode="json"),
                                    emotion_state=c.emotion_state.model_dump(mode="json"),
                                )
                            )
                            extracted_count += 1
                session.flush()

                # 5. Passage Chunking & Vector Embeddings
                job.stage = "indexing_passages"
                job.progress = 85
                session.flush()

                chunks = build_semantic_chunks(extracted_text)
                for c in chunks:
                    c_hash = hashlib.sha256(c.content.encode("utf-8")).hexdigest()
                    existing_chunk = session.execute(
                        select(BookChunk).where(
                            BookChunk.book_id == book.id,
                            BookChunk.chunk_index == c.chunk_index,
                        )
                    ).scalars().first()

                    if not existing_chunk:
                        vec = self.embedding_service.embed_text(c.content)
                        session.add(
                            BookChunk(
                                book_id=book.id,
                                chapter_order=c.chapter_order,
                                chapter_title=c.chapter_title,
                                chunk_index=c.chunk_index,
                                content=c.content,
                                embedding=vec,
                                embedding_provider=self.embedding_service.provider_name,
                                embedding_model=self.embedding_service.model_name,
                                embedding_dimensions=len(vec),
                                content_hash=c_hash,
                            )
                        )
                session.flush()

                # 6. Publish Readiness
                book.processing_status = BookProcessingStatus.ready
                job.status = "completed"
                job.stage = "ready"
                job.progress = 100

                session.add(
                    NotificationRecord(
                        user_id=job.owner_user_id,
                        title=f"'{book.title}' is ready!",
                        message=f"Indexed into semantic vector database with {extracted_count} character dossiers across {len(chapters)} chapters.",
                        category="ingestion",
                        link_url=f"/books/{book.id}",
                    )
                )
                session.flush()
                logger.info("Job %s completed successfully for book %s", job.id, book.id)
                return {"status": "completed", "job_id": job.id, "book_id": book.id}

            except Exception as exc:
                logger.exception("Ingestion failed for job %s: %s", job_id, exc)
                book.processing_status = BookProcessingStatus.failed
                job.status = "failed"
                job.error_message = str(exc)
                session.flush()
                return {"status": "failed", "job_id": job.id, "error": str(exc)}

    def run_once(self) -> bool:
        """Claim and run a single job if available. Returns True if a job was processed."""
        job_id = self.claim_next_job()
        if not job_id:
            return False
        self.process_job(job_id)
        return True

    def run_forever(self, poll_interval: float = 2.0) -> None:
        """Continually poll and process ingestion jobs until signaled to stop."""
        self._running = True

        def _handle_stop(sig: int, frame: Any) -> None:
            logger.info("Signal %s received. Stopping ingestion worker gracefully...", sig)
            self._running = False

        signal.signal(signal.SIGINT, _handle_stop)
        signal.signal(signal.SIGTERM, _handle_stop)

        logger.info("IngestionWorker running (polling every %.1fs)...", poll_interval)
        while self._running:
            try:
                processed = self.run_once()
                if not processed:
                    time.sleep(poll_interval)
            except Exception as exc:
                logger.exception("Unhandled error in IngestionWorker loop: %s", exc)
                time.sleep(poll_interval)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    settings = Settings.from_env()
    db = DatabaseManager(settings)
    worker = IngestionWorker(db, settings)
    worker.run_forever()


if __name__ == "__main__":
    main()
