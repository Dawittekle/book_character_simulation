from unittest.mock import MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from book_character_simulation_backend.db.base import Base
from book_character_simulation_backend.db.models import Book, BookChunk, UserAccount
from book_character_simulation_backend.rag.embedding_provider import (
    EmbeddingService,
    cosine_similarity,
)
from book_character_simulation_backend.rag.retriever import SpoilerAwareRetriever


def test_embedding_service_and_cosine_similarity():
    settings = MagicMock()
    settings.gemini_api_key = ""
    settings.openai_api_key = ""
    settings.embedding_model = "hash"

    svc = EmbeddingService(settings)
    v1 = svc.embed_text("Elena receives a midnight letter.")
    v2 = svc.embed_text("Elena receives a midnight letter.")
    v3 = svc.embed_text("Spaceships travel at the speed of light.")

    assert len(v1) == 128
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
