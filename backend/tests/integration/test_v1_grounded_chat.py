from __future__ import annotations

import json
from unittest.mock import MagicMock, patch
import pytest
from flask import Flask
from flask.testing import FlaskClient

from book_character_simulation_backend.db.models import (
    Book,
    BookChunk,
    CharacterProfileRecord,
    UserAccount,
)
from book_character_simulation_backend.db.session import DatabaseManager
from book_character_simulation_backend.rag.embedding_provider import EmbeddingService


@pytest.fixture
def seeded_grounded_book(db_app: Flask):
    db: DatabaseManager = db_app.extensions["database_manager"]
    settings = db_app.config["SETTINGS"]
    embedder = EmbeddingService(settings)

    with db.session_scope() as session:
        user = UserAccount(
            supabase_user_id="grounded-author",
            email="author@lorely.app",
            display_name="Author",
        )
        session.add(user)
        session.flush()

        book = Book(
            owner_user_id=user.id,
            title="Chronicles of the Clocktower",
            author="Elena Marlowe",
            visibility="featured",
            source_type="book",
        )
        session.add(book)
        session.flush()

        character = CharacterProfileRecord(
            book_id=book.id,
            stable_character_key="elena-marlowe",
            name="Elena Marlowe",
            role="Protagonist",
            personality="A curious writer uncovering the secrets of the clocktower.",
            key_events=["Found the brass key in Chapter 1", "Discovered the clockmaker's secret in Chapter 4"],
            relationships=["Daniel Hayes (Companion)"],
            psi_parameters={"competence": 0.7, "certainty": 0.6},
            emotion_state={"hope": 0.8, "anxiety": 0.2},
        )
        session.add(character)
        session.flush()

        # Seed BookChunks
        chunk1 = BookChunk(
            book_id=book.id,
            chapter_order=1,
            chapter_title="Chapter 1: The Brass Key",
            chunk_index=0,
            content="Elena held the tarnished brass key up to the moonlight. It had been tucked inside the grandfather clock.",
            embedding=embedder.embed_text("Elena held the tarnished brass key up to the moonlight. It had been tucked inside the grandfather clock."),
        )
        chunk4 = BookChunk(
            book_id=book.id,
            chapter_order=4,
            chapter_title="Chapter 4: The Clockmaker's Betrayal",
            chunk_index=0,
            content="To her horror, the master clockmaker confessed that he had constructed the automaton army.",
            embedding=embedder.embed_text("To her horror, the master clockmaker confessed that he had constructed the automaton army."),
        )
        session.add_all([chunk1, chunk4])
        session.commit()

        return {
            "book_id": book.id,
            "character_id": character.id,
            "author_user_id": user.id,
        }


def test_grounded_chat_returns_citations(
    db_client: FlaskClient,
    seeded_grounded_book: dict[str, str],
):
    char_id = seeded_grounded_book["character_id"]
    headers = {
        "X-Test-User-Id": "reader-user-1",
        "Content-Type": "application/json",
    }

    # 1. Create a conversation with "no_spoilers" policy
    res = db_client.post(
        f"/api/v1/characters/{char_id}/conversations",
        headers=headers,
        data=json.dumps({
            "title": "Discussion about the brass key",
            "spoiler_policy": "no_spoilers",
        }),
    )
    assert res.status_code == 201
    session_id = res.get_json()["id"]

    # 2. Mock LLM provider to return realistic grounded dialogue
    mock_provider = MagicMock()
    mock_provider.generate_json.side_effect = [
        json.dumps({
            "reply": "Yes! I remember holding the brass key under the cold moonlight.",
            "updated_psi": {"valence_level": 0.85},
            "updated_emotion_state": {"joy": 0.7, "hope": 0.9},
        }),
        json.dumps({"facts": ["Elena still remembers the brass key."]}),
    ]

    with patch(
        "book_character_simulation_backend.services.lorely_service.get_llm_provider",
        return_value=mock_provider,
    ):
        msg_res = db_client.post(
            f"/api/v1/conversations/{session_id}/messages",
            headers=headers,
            data=json.dumps({"content": "Can you tell me about the brass key you found?"}),
        )
        assert msg_res.status_code == 201
        data = msg_res.get_json()

        assert "citations" in data
        assert len(data["citations"]) > 0
        citation = data["citations"][0]
        assert citation["chapter_order"] == 1
        assert "The Brass Key" in citation["chapter_title"]
        assert "brass key" in citation["snippet"].lower()
        assert citation["similarity"] > 0

        # Verify Chapter 4 was NOT cited because of "no_spoilers" policy
        assert all(c["chapter_order"] == 1 for c in data["citations"])

    # 3. Retrieve conversation messages and check citations are preserved
    hist_res = db_client.get(
        f"/api/v1/conversations/{session_id}/messages",
        headers=headers,
    )
    assert hist_res.status_code == 200
    messages = hist_res.get_json()["messages"]
    assert len(messages) == 2  # user + assistant

    assistant_msg = next(m for m in messages if m["role"] == "assistant")
    assert "citations" in assistant_msg
    assert len(assistant_msg["citations"]) > 0
    assert assistant_msg["citations"][0]["chapter_order"] == 1
