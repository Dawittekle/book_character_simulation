from __future__ import annotations

from flask import Flask
from flask.testing import FlaskClient
from sqlalchemy import select

from book_character_simulation_backend.db.models import (
    Book,
    BookChunk,
    CharacterProfileRecord,
)
from book_character_simulation_backend.db.seeds.dostoevsky_seed import (
    seed_dostoevsky_books,
)
from book_character_simulation_backend.db.session import DatabaseManager
from book_character_simulation_backend.rag.embedding_provider import EmbeddingService
from book_character_simulation_backend.rag.retriever import SpoilerAwareRetriever


def test_dostoevsky_catalog_seed_and_retrieval(db_app: Flask, db_client: FlaskClient):
    db: DatabaseManager = db_app.extensions["database_manager"]
    settings = db_app.config["SETTINGS"]

    # 1. Seed catalog
    books = seed_dostoevsky_books(db, settings)
    assert len(books) >= 3

    # 2. Verify book records in database
    with db.session_scope() as session:
        titles = session.scalars(select(Book.title).where(Book.visibility == "featured")).all()
        assert "White Nights" in titles
        assert "The Dream of a Ridiculous Man" in titles
        assert "An Honest Thief" in titles

        # Verify characters
        characters = session.scalars(
            select(CharacterProfileRecord.name).order_by(CharacterProfileRecord.name)
        ).all()
        assert "The Dreamer" in characters
        assert "Nástyenka" in characters
        assert "The Ridiculous Man" in characters
        assert "Astafy Ivanovich" in characters
        assert "Emelyan Ilyitch" in characters

        # Verify chunks have embeddings
        white_nights = session.scalar(select(Book).where(Book.title == "White Nights"))
        chunks = session.scalars(
            select(BookChunk).where(BookChunk.book_id == white_nights.id)
        ).all()
        assert len(chunks) == 4
        for c in chunks:
            assert c.embedding is not None
            assert len(c.embedding) > 0

    # 3. Test SpoilerAwareRetriever finds White Nights canal embankment passage
    embedder = EmbeddingService(settings)
    retriever = SpoilerAwareRetriever(embedder)

    with db.session_scope() as session:
        passages = retriever.retrieve(
            session,
            book_id=white_nights.id,
            query="canal railing weeping night spring",
            top_k=2,
            spoiler_policy="cautious",
        )
        assert len(passages) > 0
        assert any("night" in p.content.lower() or "nástyenka" in p.content.lower() for p in passages)

    # 4. Verify public API endpoints return Dostoevsky books and characters
    res = db_client.get("/api/v1/books")
    assert res.status_code == 200
    book_list = res.get_json()["books"]
    assert any(b["title"] == "White Nights" for b in book_list)

    char_res = db_client.get(f"/api/v1/books/{white_nights.id}/characters")
    assert char_res.status_code == 200
    names = [c["name"] for c in char_res.get_json()["characters"]]
    assert "The Dreamer" in names
    assert "Nástyenka" in names
