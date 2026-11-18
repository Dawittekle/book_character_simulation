from __future__ import annotations

from unittest.mock import MagicMock
from qdrant_client import QdrantClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from book_character_simulation_backend.db.base import Base
from book_character_simulation_backend.db.models import Book, BookChunk, UserAccount
from book_character_simulation_backend.rag.embedding_provider import (
    EmbeddingService,
    cosine_similarity,
)
from book_character_simulation_backend.rag.retriever import SpoilerAwareRetriever
from book_character_simulation_backend.repositories.qdrant import (
    QdrantChunkRecord,
    QdrantRepository,
)


def test_embedding_service_and_cosine_similarity():
    settings = MagicMock()
    settings.gemini_api_key = ""
    settings.openai_api_key = ""
    settings.embedding_model = "hash"

    svc = EmbeddingService(settings)
    v1 = svc.embed_text("Elena receives a midnight letter.")
    v2 = svc.embed_text("Elena receives a midnight letter.")
    v3 = svc.embed_text("Spaceships travel at the speed of light.")

    assert len(v1) == 1536
    assert cosine_similarity(v1, v2) > 0.99
    # Cosine similarity between different sentences should be lower
    assert cosine_similarity(v1, v3) < 0.99


def test_spoiler_aware_retriever_blocks_late_chapters():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)

    settings = MagicMock()
    settings.gemini_api_key = ""
    settings.openai_api_key = ""
    settings.embedding_model = "hash"
    svc = EmbeddingService(settings)
    retriever = SpoilerAwareRetriever(svc)

    with session_factory() as session:
        user = UserAccount(supabase_user_id="u1", email="u1@test.com", display_name="Reader")
        session.add(user)
        session.flush()

        book = Book(owner_user_id=user.id, title="Test Novel")
        session.add(book)
        session.flush()

        # Add early chapter chunk and late spoiler chapter chunk
        chunk_ch1 = BookChunk(
            book_id=book.id,
            chapter_order=1,
            chapter_title="Chapter 1: The Beginning",
            chunk_index=0,
            content="Elena discovered an old journal in the attic with strange symbols.",
            embedding=svc.embed_text("Elena discovered an old journal in the attic with strange symbols."),
        )
        chunk_ch5 = BookChunk(
            book_id=book.id,
            chapter_order=5,
            chapter_title="Chapter 5: The Grand Climax",
            chunk_index=0,
            content="Elena discovered that the killer was her own brother Victor.",
            embedding=svc.embed_text("Elena discovered that the killer was her own brother Victor."),
        )
        session.add_all([chunk_ch1, chunk_ch5])
        session.commit()

        # Query that could match both
        query = "Elena discovered"

        # 1. Under cautious/no_spoilers with max_allowed_chapter=1, Chapter 5 MUST be filtered out
        cautious_results = retriever.retrieve(
            session,
            book_id=book.id,
            query=query,
            spoiler_policy="cautious",
            max_allowed_chapter=1,
            top_k=5,
        )
        assert len(cautious_results) == 1
        assert cautious_results[0].chapter_order == 1
        assert "killer" not in cautious_results[0].content

        # 2. Under unrestricted policy, Chapter 5 CAN be returned
        unrestricted_results = retriever.retrieve(
            session,
            book_id=book.id,
            query=query,
            spoiler_policy="unrestricted",
            max_allowed_chapter=None,
            top_k=5,
        )
        assert any(r.chapter_order == 5 for r in unrestricted_results)


def test_spoiler_aware_retriever_with_qdrant_engine():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)

    settings = MagicMock()
    settings.app_env = "testing"
    settings.qdrant_url = "http://localhost:6333"
    settings.qdrant_api_key = "key"
    settings.qdrant_collection = "test_qdrant_retriever"
    settings.embedding_dimensions = 1536

    svc = EmbeddingService(settings)
    q_client = QdrantClient(":memory:")
    qdrant_repo = QdrantRepository(settings, client=q_client)
    qdrant_repo.ensure_collection_and_indexes()

    retriever = SpoilerAwareRetriever(svc, qdrant_repo=qdrant_repo)

    book_id = "book-qdrant-test"
    v_ch1 = svc.embed_text("Elena discovered an ancient parchment in the library.")
    v_ch4 = svc.embed_text("Elena discovered the grand conspirator was the prime minister.")

    qdrant_repo.upsert_chunks([
        QdrantChunkRecord(
            chunk_id="chunk-1",
            book_id=book_id,
            chapter_order=1,
            chapter_title="Chapter 1: The Archive",
            chunk_index=0,
            content="Elena discovered an ancient parchment in the library.",
            embedding=v_ch1,
            visibility="public",
        ),
        QdrantChunkRecord(
            chunk_id="chunk-4",
            book_id=book_id,
            chapter_order=4,
            chapter_title="Chapter 4: The Revelation",
            chunk_index=0,
            content="Elena discovered the grand conspirator was the prime minister.",
            embedding=v_ch4,
            visibility="public",
        ),
    ])

    with session_factory() as session:
        # Cautious policy: Chapter 4 MUST be excluded by Qdrant
        results_cautious = retriever.retrieve(
            session,
            book_id=book_id,
            query="Elena discovered",
            spoiler_policy="cautious",
            max_allowed_chapter=1,
            top_k=5,
        )
        assert len(results_cautious) == 1
        assert results_cautious[0].chapter_order == 1
        assert results_cautious[0].chunk_id == "chunk-1"
        assert "parchment" in results_cautious[0].content
        assert results_cautious[0].rrf_score > 0.0

        # Unrestricted policy: Both returned, ordered by hybrid RRF
        results_all = retriever.retrieve(
            session,
            book_id=book_id,
            query="conspirator",
            spoiler_policy="unrestricted",
            max_allowed_chapter=None,
            top_k=5,
        )
        assert len(results_all) >= 1
        assert any(r.chapter_order == 4 for r in results_all)


def test_spoiler_aware_retriever_tenant_isolation_with_qdrant():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)

    settings = MagicMock()
    settings.app_env = "testing"
    settings.qdrant_url = "http://localhost:6333"
    settings.qdrant_api_key = "key"
    settings.qdrant_collection = "test_tenant_retriever"
    settings.embedding_dimensions = 1536

    svc = EmbeddingService(settings)
    q_client = QdrantClient(":memory:")
    qdrant_repo = QdrantRepository(settings, client=q_client)
    qdrant_repo.ensure_collection_and_indexes()

    retriever = SpoilerAwareRetriever(svc, qdrant_repo=qdrant_repo)

    book_id = "book-private-test"
    v = svc.embed_text("Confidential manuscript paragraph.")

    # User Alice's chunk (private)
    qdrant_repo.upsert_chunks([
        QdrantChunkRecord(
            chunk_id="chunk-alice",
            book_id=book_id,
            chapter_order=1,
            chapter_title="Alice Notes",
            chunk_index=0,
            content="Alice's confidential manuscript details.",
            embedding=v,
            visibility="private",
            owner_user_id="user-alice",
        ),
    ])

    with session_factory() as session:
        # User Bob queries Alice's private book -> 0 results
        bob_results = retriever.retrieve(
            session,
            book_id=book_id,
            query="confidential manuscript",
            owner_user_id="user-bob",
            is_public=False,
            top_k=5,
        )
        assert len(bob_results) == 0

        # User Alice queries her own private book -> 1 result
        alice_results = retriever.retrieve(
            session,
            book_id=book_id,
            query="confidential manuscript",
            owner_user_id="user-alice",
            is_public=False,
            top_k=5,
        )
        assert len(alice_results) == 1
        assert alice_results[0].chunk_id == "chunk-alice"


def test_spoiler_aware_retriever_fallback_when_book_not_in_qdrant():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)

    settings = MagicMock()
    settings.app_env = "testing"
    settings.qdrant_url = "http://localhost:6333"
    settings.qdrant_api_key = "key"
    settings.qdrant_collection = "test_empty_qdrant_fallback"
    settings.embedding_dimensions = 1536

    svc = EmbeddingService(settings)
    q_client = QdrantClient(":memory:")
    qdrant_repo = QdrantRepository(settings, client=q_client)
    qdrant_repo.ensure_collection_and_indexes()

    retriever = SpoilerAwareRetriever(svc, qdrant_repo=qdrant_repo)

    with session_factory() as session:
        user = UserAccount(supabase_user_id="u-fallback", email="u-fb@test.com", display_name="Reader")
        session.add(user)
        session.flush()

        book = Book(owner_user_id=user.id, title="Unmigrated Book")
        session.add(book)
        session.flush()

        # Add chunk only in relational database (0 points in Qdrant)
        chunk = BookChunk(
            book_id=book.id,
            chapter_order=1,
            chapter_title="Chapter 1",
            chunk_index=0,
            content="Relational chunk waiting for Qdrant backfill migration.",
            embedding=svc.embed_text("Relational chunk waiting for Qdrant backfill migration."),
        )
        session.add(chunk)
        session.commit()

        # Should warn and gracefully fall back to relational chunks
        results = retriever.retrieve(
            session,
            book_id=book.id,
            query="backfill migration",
            top_k=3,
        )
        assert len(results) == 1
        assert results[0].chapter_order == 1
        assert "backfill" in results[0].content
