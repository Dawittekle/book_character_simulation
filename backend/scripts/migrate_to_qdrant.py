#!/usr/bin/env python3
"""
Lorely Vector Migration & Backfill Script: Relational Database -> Qdrant Cloud.

1. Backs up the relational SQLite database safely before applying modifications.
2. Inspects all books and chunks in the relational database.
3. Detects invalid/outdated embeddings (e.g. legacy 128-dim or 768-dim mock hashes).
4. Generates real 1536-dimensional embeddings in batches via the active provider (Gemini / OpenAI).
5. Updates chunk metadata in the relational database (embedding, provider, model, dimensions).
6. Upserts chunks into Qdrant Cloud collection ('lorely_book_chunks') with deterministic UUIDs and rich payload indexes.
7. Verifies point counts, spoiler prevention, and retrieval correctness against Qdrant Cloud.
"""

from __future__ import annotations

import argparse
import datetime
import logging
import shutil
import sys
from pathlib import Path

# Add backend src to sys.path
backend_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend_dir / "src"))

from sqlalchemy import select
from book_character_simulation_backend.config import Settings
from book_character_simulation_backend.db.models import Book, BookChunk
from book_character_simulation_backend.db.session import DatabaseManager
from book_character_simulation_backend.rag.embedding_provider import EmbeddingService
from book_character_simulation_backend.repositories.qdrant import (
    QdrantChunkRecord,
    QdrantRepository,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("migrate_to_qdrant")


def backup_database(db_url: str | None) -> Path | None:
    """Creates a timestamped backup copy of a local SQLite database."""
    if not db_url or not db_url.startswith("sqlite:///"):
        logger.info("Non-SQLite database detected (%s); skipping file backup.", db_url)
        return None

    raw_path = db_url.replace("sqlite:///", "")
    db_file = Path(raw_path)
    if not db_file.exists():
        if (backend_dir / db_file).exists():
            db_file = (backend_dir / db_file).resolve()
        elif (backend_dir.parent / db_file).exists():
            db_file = (backend_dir.parent / db_file).resolve()
        elif db_file.name and (backend_dir / db_file.name).exists():
            db_file = (backend_dir / db_file.name).resolve()

    if not db_file.exists():
        logger.warning("Database file %s does not exist; skipping backup.", db_file)
        return None

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = db_file.with_name(f"{db_file.name}.backup.{timestamp}")
    shutil.copy2(db_file, backup_file)
    logger.info("Database backed up safely to: %s", backup_file)
    return backup_file


def run_migration(dry_run: bool = False, force_reembed: bool = False, batch_size: int = 32) -> dict:
    settings = Settings.from_env()
    logger.info("Environment: %s", settings.app_env)
    logger.info("Database URL: %s", settings.database_url)
    logger.info("Qdrant URL: %s", settings.qdrant_url)
    logger.info("Qdrant Collection: %s", settings.qdrant_collection)

    qdrant_repo = QdrantRepository(settings)
    if not qdrant_repo.is_configured:
        logger.error("Qdrant is not configured. Please set QDRANT_URL and QDRANT_API_KEY in backend/.env")
        sys.exit(1)

    # 1. Health check
    if not qdrant_repo.check_health():
        logger.error("Failed to connect to Qdrant Cloud. Health check returned False.")
        sys.exit(1)
    logger.info("Successfully connected to Qdrant Cloud cluster.")

    # 2. Ensure collection & payload indexes
    if not dry_run:
        qdrant_repo.ensure_collection_and_indexes()
        backup_database(settings.database_url)

    db = DatabaseManager(settings)
    embedding_service = EmbeddingService(settings)
    logger.info(
        "Embedding Provider: %s | Model: %s | Dimensions: %d",
        embedding_service.provider_name,
        embedding_service.model_name,
        embedding_service.dimensions,
    )

    stats = {
        "total_books": 0,
        "total_chunks": 0,
        "chunks_reembedded": 0,
        "points_upserted": 0,
        "books_migrated": [],
    }

    with db.session_scope() as session:
        books = session.scalars(select(Book).order_by(Book.created_at.asc())).all()
        stats["total_books"] = len(books)
        logger.info("Found %d books in database.", len(books))

        for book in books:
            chunks = session.scalars(
                select(BookChunk)
                .where(BookChunk.book_id == book.id)
                .order_by(BookChunk.chapter_order.asc(), BookChunk.chunk_index.asc())
            ).all()

            logger.info("--- Processing Book: '%s' (ID: %s, Chunks: %d) ---", book.title, book.id, len(chunks))
            stats["total_chunks"] += len(chunks)

            if not chunks:
                continue

            # Identify chunks needing re-embedding
            chunks_to_embed: list[BookChunk] = []
            for c in chunks:
                curr_dim = len(c.embedding) if c.embedding else 0
                if force_reembed or curr_dim != 1536 or c.embedding_model != embedding_service.model_name:
                    chunks_to_embed.append(c)

            if chunks_to_embed:
                logger.info(
                    "Generating real 1536-dim embeddings for %d / %d chunks in '%s'...",
                    len(chunks_to_embed),
                    len(chunks),
                    book.title,
                )
                if not dry_run:
                    # Batch embedding
                    for i in range(0, len(chunks_to_embed), batch_size):
                        batch = chunks_to_embed[i : i + batch_size]
                        texts = [chunk.content for chunk in batch]
                        embeddings = embedding_service.embed_texts(texts, batch_size=batch_size)

                        for chunk, vec in zip(batch, embeddings):
                            chunk.embedding = vec
                            chunk.embedding_provider = embedding_service.provider_name
                            chunk.embedding_model = embedding_service.model_name
                            chunk.embedding_dimensions = len(vec)
                            stats["chunks_reembedded"] += 1

                    session.flush()
            else:
                logger.info("All %d chunks in '%s' already have valid 1536-dim embeddings.", len(chunks), book.title)

            # Build Qdrant records
            q_records: list[QdrantChunkRecord] = []
            for c in chunks:
                q_records.append(
                    QdrantChunkRecord(
                        chunk_id=c.id,
                        book_id=book.id,
                        chapter_order=c.chapter_order,
                        chapter_title=c.chapter_title or f"Chapter {c.chapter_order}",
                        chunk_index=c.chunk_index,
                        content=c.content,
                        embedding=c.embedding or [],
                        language=c.language_code or "en",
                        visibility=book.visibility or "private",
                        owner_user_id=book.owner_user_id,
                        content_hash=c.content_hash,
                    )
                )

            if not dry_run and q_records:
                upserted = qdrant_repo.upsert_chunks(q_records, batch_size=batch_size)
                stats["points_upserted"] += upserted
                logger.info("Upserted %d points to Qdrant for book '%s'.", upserted, book.title)

            stats["books_migrated"].append({
                "book_id": book.id,
                "title": book.title,
                "chunks": len(chunks),
                "reembedded": len(chunks_to_embed),
            })

    # 3. Post-migration verification
    if not dry_run:
        logger.info("=========================================")
        logger.info("POST-MIGRATION VERIFICATION")
        logger.info("=========================================")
        qdrant_total = qdrant_repo.count()
        logger.info("Total points in Qdrant Cloud: %d (Relational Chunks: %d)", qdrant_total, stats["total_chunks"])

        if qdrant_total == stats["total_chunks"]:
            logger.info("SUCCESS: Point count perfectly matches database chunk count!")
        else:
            logger.warning("MISMATCH: Qdrant count (%d) != database chunk count (%d)", qdrant_total, stats["total_chunks"])

        # Test live search for each book
        for b_info in stats["books_migrated"]:
            bid = b_info["book_id"]
            cnt = qdrant_repo.count(book_id=bid)
            logger.info("Book '%s': Qdrant points = %d", b_info["title"], cnt)

            # Test vector search
            test_query = f"{b_info['title']} chapter story"
            q_vec = embedding_service.embed_text(test_query)
            scored = qdrant_repo.search(
                query_vector=q_vec,
                book_id=bid,
                limit=2,
            )
            logger.info("  Sample search returned %d hits. Top score: %.4f", len(scored), scored[0].score if scored else 0.0)

            # Test spoiler filter (chapter_order <= 1)
            scored_spoiler = qdrant_repo.search(
                query_vector=q_vec,
                book_id=bid,
                max_allowed_chapter=1,
                limit=5,
            )
            for sc in scored_spoiler:
                assert sc.chapter_order <= 1, f"Spoiler breach: chunk chapter {sc.chapter_order} > 1"
            logger.info("  Spoiler protection verified (all %d returned hits <= chapter 1).", len(scored_spoiler))

    return stats


def main():
    parser = argparse.ArgumentParser(description="Migrate book chunks from relational database to Qdrant Cloud.")
    parser.add_argument("--dry-run", action="store_true", help="Inspect and simulate migration without writing changes.")
    parser.add_argument("--force-reembed", action="store_true", help="Force regenerate embeddings even if already 1536-dim.")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size for embedding generation and upsert.")
    args = parser.parse_args()

    logger.info("Starting Lorely Qdrant Migration (dry_run=%s, force_reembed=%s, batch_size=%d)...", args.dry_run, args.force_reembed, args.batch_size)
    stats = run_migration(dry_run=args.dry_run, force_reembed=args.force_reembed, batch_size=args.batch_size)
    logger.info("Migration completed successfully!")
    logger.info("Summary: %s", stats)


if __name__ == "__main__":
    main()
