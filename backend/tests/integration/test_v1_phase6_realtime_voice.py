from __future__ import annotations

import time
from flask.testing import FlaskClient
import pytest
from sqlalchemy import select

from book_character_simulation_backend.db.models import (
    Book,
    CharacterProfileRecord,
    ChatMessage,
    ChatSession,
    UserAccount,
    UserSettings,
)
from book_character_simulation_backend.db.session import DatabaseManager


def _setup_realtime_test_environment(db_manager: DatabaseManager):
    """Sets up a test user, book, character, and conversation session."""
    with db_manager.session_scope() as session:
        user = UserAccount(
            supabase_user_id="usr-phase6-realtime-tester",
            email="realtime-tester@lorely.example",
            display_name="Realtime Voice Tester",
        )
        session.add(user)
        session.flush()

        settings = UserSettings(
            user_id=user.id,
            voice_vad_silence_ms=1400,
            voice_auto_play=True,
            voice_save_audio_recordings=False,
        )
        session.add(settings)

        book = Book(
            owner_user_id=user.id,
            title="White Nights",
            author="Fyodor Dostoevsky",
            visibility="private",
        )
        session.add(book)
        session.flush()

        char = CharacterProfileRecord(
            book_id=book.id,
            name="Nástyenka",
            role="Heroine",
            personality="Gentle, romantic, youthful, emotional",
            appearance_description="A young woman with delicate countenance and warm eyes",
            relationships=["The Dreamer"],
            emotion_state={"joy": 0.8},
            psi_parameters={"warmth": 0.85},
            assigned_voice_id="nova",
            voice_matching_confidence="explicit",
        )
        session.add(char)
        session.flush()

        chat_session = ChatSession(
            owner_user_id=user.id,
            book_id=book.id,
            character_id=char.id,
            title="Realtime Session with Nastenka",
            reading_progress_chapter=2,
            conversation_language="en",
        )
        session.add(chat_session)
        session.flush()

        return user.id, book.id, char.id, chat_session.id


def test_realtime_session_credentials_and_vad(db_client: FlaskClient):
    """
    Verifies that POST /api/v1/conversations/<session_id>/realtime-session:
    - Issues short-lived, signed ephemeral session credentials server-side.
    - Resolves character voice mapped to realtime provider voice.
    - Incorporates user's VAD silence settings.
    - Provides controlled tool definitions.
    """
    db_manager: DatabaseManager = db_client.application.extensions["database_manager"]
    _, _, char_id, session_id = _setup_realtime_test_environment(db_manager)
    headers = {"X-Test-User-Id": "usr-phase6-realtime-tester"}

    res = db_client.post(f"/api/v1/conversations/{session_id}/realtime-session", headers=headers)
    assert res.status_code == 200
    data = res.get_json()

    # Session & Character identity
    assert data["session_id"] == session_id
    assert data["character_id"] == char_id
    assert data["character_name"] == "Nástyenka"

    # Realtime voice mapping: 'nova' maps to 'shimmer' in OpenAI realtime
    assert data["realtime_voice"] == "shimmer"

    # VAD turn detection matches user settings (1400ms)
    assert data["turn_detection"]["silence_duration_ms"] == 1400
    assert data["turn_detection"]["type"] == "server_vad"

    # Ephemeral credentials
    grant = data["ephemeral_grant"]
    assert "grant_id" in grant
    assert grant["voice"] == "shimmer"
    assert grant["expires_at"] > int(time.time())
    assert grant["token"].startswith("rt_")
    assert "client_secret" in grant

    # Grounding instructions and tools
    assert "CRITICAL GROUNDING DIRECTIVE" in data["instructions"]
    assert "Chapter 2" in data["instructions"]
    tools = data["tools"]
    assert len(tools) == 1
    assert tools[0]["name"] == "lorely_grounded_response"
    assert "controlled_tool_callback_url" in data


def test_controlled_tool_delegation_turn(db_client: FlaskClient):
    """
    Verifies controlled backend tool delegation (Section 11.5):
    - Realtime audio model delegates application turn to Lorely backend.
    - Grounded response is generated within reader's chapter progress boundary.
    - Message history is persisted in PostgreSQL.
    """
    db_manager: DatabaseManager = db_client.application.extensions["database_manager"]
    _, _, _, session_id = _setup_realtime_test_environment(db_manager)
    headers = {"X-Test-User-Id": "usr-phase6-realtime-tester"}

    tool_res = db_client.post(
        f"/api/v1/conversations/{session_id}/realtime-tool-call",
        headers=headers,
        json={"reader_message": "Tell me of your dreams by the Fontanka canal."},
    )
    assert tool_res.status_code == 200
    tool_data = tool_res.get_json()
    assert tool_data["session_id"] == session_id
    assert len(tool_data["response_text"]) > 10

    # Verify message persistence
    msgs_res = db_client.get(f"/api/v1/conversations/{session_id}/messages", headers=headers)
    assert msgs_res.status_code == 200
    messages = msgs_res.get_json()["messages"]
    assert len(messages) >= 2
    user_msg = next((m for m in messages if m["role"] == "user"), None)
    assert user_msg is not None
    assert user_msg["content"] == "Tell me of your dreams by the Fontanka canal."
    assert user_msg["input_modality"] == "voice"


def test_voice_pipeline_benchmark(db_client: FlaskClient):
    """
    Verifies the Phase 6 test harness / evaluation endpoint
    measuring latency, cost, turn detection, and privacy between Stage A and Stage B.
    """
    res = db_client.get("/api/v1/voice/benchmark")
    assert res.status_code == 200
    data = res.get_json()
    assert "stage_a" in data
    assert "stage_b" in data

    stage_a = data["stage_a"]
    assert stage_a["pipeline"].startswith("Stage A")
    assert stage_a["p50_first_audio_latency_ms"] > 0
    assert stage_a["character_grounding_score"] >= 0.95
    assert stage_a["privacy_compliance"]["raw_audio_persisted_by_default"] is False

    stage_b = data["stage_b"]
    assert stage_b["pipeline"].startswith("Stage B")
    assert stage_b["character_grounding_score"] >= 0.95
    assert stage_b["status"] == "evaluated_safe"
