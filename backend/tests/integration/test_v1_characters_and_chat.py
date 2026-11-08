from __future__ import annotations

import json
import pytest
from flask import Flask
from flask.testing import FlaskClient

from book_character_simulation_backend.db.models import Book, CharacterProfileRecord, UserAccount
from book_character_simulation_backend.db.session import DatabaseManager


@pytest.fixture
def seeded_book_and_character(db_app: Flask):
    db: DatabaseManager = db_app.extensions["database_manager"]
    with db.session_scope() as session:
        # Create an owner
        user = UserAccount(
            supabase_user_id="author-user-id",
            email="author@lorely.app",
            display_name="Author",
        )
        session.add(user)
        session.flush()

        book = Book(
            owner_user_id=user.id,
            title="The Midnight Letters",
            author="Elena Marlowe",
            visibility="featured",  # public/featured so any user can talk to character
            source_type="book",
        )
        session.add(book)
        session.flush()

        character = CharacterProfileRecord(
            book_id=book.id,
            stable_character_key="elena-marlowe",
            name="Elena Marlowe",
            role="Protagonist",
            personality="A thoughtful writer with a curious mind and a hopeful heart.",
            appearance_description="Brown wavy hair, green eyes, vintage typewriter.",
            avatar_asset_id="portrait-elena-01",
            key_events=["Moved to the coast", "Found old journal"],
            relationships=["Daniel Hayes (Companion)"],
            psi_parameters={"competence": 0.8, "certainty": 0.7, "affiliation": 0.9},
            emotion_state={"joy": 0.75, "hope": 0.85, "anxiety": 0.15, "sadness": 0.10},
        )
        session.add(character)
        session.flush()

        return {
            "book_id": book.id,
            "character_id": character.id,
            "character_key": character.stable_character_key,
        }


def test_character_dossier_and_state(
    db_client: FlaskClient, seeded_book_and_character: dict[str, str]
):
    char_id = seeded_book_and_character["character_id"]
    headers = {"X-Test-User-Id": "reader-charlie"}

    # 1. Fetch dossier
    res = db_client.get(f"/api/v1/characters/{char_id}", headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data["name"] == "Elena Marlowe"
    assert data["role"] == "Protagonist"
    assert data["avatar_asset_id"] == "portrait-elena-01"
    assert data["canonical_emotion_state"]["joy"] == 0.75

    # 2. Fetch state
    res_state = db_client.get(f"/api/v1/characters/{char_id}/state", headers=headers)
    assert res_state.status_code == 200
    state_data = res_state.get_json()
    assert state_data["emotion_state"]["joy"] == 0.75


def test_conversation_flow_and_turn_response(
    db_client: FlaskClient,
    seeded_book_and_character: dict[str, str],
    monkeypatch,
):
    char_id = seeded_book_and_character["character_id"]
    headers = {"X-Test-User-Id": "reader-dave"}

    # Mock LLM provider generate_json
    mock_llm_response = json.dumps({
        "reply": "Hello there! It's wonderful to meet you. I believe every book is a world waiting to be explored.",
        "updated_psi": {
            "valence_level": 0.8,
            "arousal_level": 0.5,
            "selection_threshold": 0.6,
            "resolution_level": 0.7,
            "goal_directedness": 0.8,
            "securing_rate": 0.4,
        },
        "updated_emotion_state": {
            "anger": 0.05,
            "sadness": 0.1,
            "pride": 0.6,
            "joy": 0.85,
            "bliss": 0.7,
        },
    })
    mock_fact_response = json.dumps({
        "facts": ["Believes every book is a world waiting to be explored."],
    })

    def mock_generate_json(self, system_prompt: str, user_prompt: str) -> str:
        if "facts" in system_prompt.lower() or "facts" in user_prompt.lower():
            return mock_fact_response
        return mock_llm_response

    from book_character_simulation_backend.llm.gemini_provider import GeminiProvider
    monkeypatch.setattr(GeminiProvider, "generate_json", mock_generate_json)

    # 1. Start a conversation
    conv_res = db_client.post(
        f"/api/v1/characters/{char_id}/conversations",
        json={"title": "First Encounter", "spoiler_policy": "cautious"},
        headers=headers,
    )
    assert conv_res.status_code == 201
    session_data = conv_res.get_json()
    session_id = session_data["id"]

    # 2. Send message
    msg_res = db_client.post(
        f"/api/v1/conversations/{session_id}/messages",
        json={"content": "What inspired you to become a writer?"},
        headers=headers,
    )
    assert msg_res.status_code == 201
    turn_data = msg_res.get_json()
    assert "wonderful to meet you" in turn_data["response"]
    assert "updated_state" in turn_data
    assert "emotion_state" in turn_data["updated_state"]

    # 3. Retrieve messages
    list_res = db_client.get(f"/api/v1/conversations/{session_id}/messages", headers=headers)
    assert list_res.status_code == 200
    messages = list_res.get_json()["messages"]
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[0]["content"] == "What inspired you to become a writer?"
    assert messages[1]["role"] == "assistant"
    assert "wonderful to meet you" in messages[1]["content"]

    # 4. Check global conversations list
    all_convs = db_client.get("/api/v1/conversations", headers=headers).get_json()["conversations"]
    assert len(all_convs) >= 1
    assert any(c["id"] == session_id for c in all_convs)


def test_per_user_character_state_isolation(
    db_client: FlaskClient,
    seeded_book_and_character: dict[str, str],
    monkeypatch,
):
    char_id = seeded_book_and_character["character_id"]
    headers_u1 = {"X-Test-User-Id": "reader-user-one"}
    headers_u2 = {"X-Test-User-Id": "reader-user-two"}

    mock_llm_response = json.dumps({
        "reply": "Dialogue response.",
        "updated_psi": {
            "valence_level": 0.5,
            "arousal_level": 0.5,
            "selection_threshold": 0.5,
            "resolution_level": 0.5,
            "goal_directedness": 0.5,
            "securing_rate": 0.5,
        },
        "updated_emotion_state": {
            "anger": 0.0,
            "sadness": 0.0,
            "pride": 0.0,
            "joy": 0.5,
            "bliss": 0.5,
        },
    })
    from book_character_simulation_backend.llm.gemini_provider import GeminiProvider
    monkeypatch.setattr(GeminiProvider, "generate_json", lambda self, system_prompt, user_prompt: mock_llm_response)

    # User 1 starts session and chats
    s1 = db_client.post(
        f"/api/v1/characters/{char_id}/conversations", json={}, headers=headers_u1
    ).get_json()["id"]

    db_client.post(
        f"/api/v1/conversations/{s1}/messages",
        json={"content": "Hello Elena from user 1"},
        headers=headers_u1,
    )

    # User 2 lists conversations -> sees 0 conversations
    u2_convs = db_client.get("/api/v1/conversations", headers=headers_u2).get_json()["conversations"]
    assert len(u2_convs) == 0

    # User 2 attempts to send message to User 1's conversation -> 403 Forbidden
    err_res = db_client.post(
        f"/api/v1/conversations/{s1}/messages",
        json={"content": "Hacking into user 1 chat"},
        headers=headers_u2,
    )
    assert err_res.status_code == 403

    # Reset state for user 1
    reset_res = db_client.post(
        f"/api/v1/characters/{char_id}/reset-state", headers=headers_u1
    )
    assert reset_res.status_code == 200
