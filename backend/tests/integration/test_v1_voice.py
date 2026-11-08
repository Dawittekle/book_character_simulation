from __future__ import annotations

import io
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
from book_character_simulation_backend.services.voice_service import VoiceService


@pytest.fixture
def seeded_voice_book(db_app: Flask):
    db: DatabaseManager = db_app.extensions["database_manager"]
    settings = db_app.config["SETTINGS"]
    embedder = EmbeddingService(settings)

    with db.session_scope() as session:
        user = UserAccount(
            supabase_user_id="voice-author",
            email="voice_author@lorely.app",
            display_name="Voice Author",
        )
        session.add(user)
        session.flush()

        book = Book(
            owner_user_id=user.id,
            title="The Clockwork Symphony",
            author="Elena Marlowe",
            visibility="featured",
            source_type="book",
        )
        session.add(book)
        session.flush()

        character = CharacterProfileRecord(
            book_id=book.id,
            stable_character_key="elena-marlowe-voice",
            name="Elena Marlowe",
            role="Protagonist",
            personality="A reflective writer with deep passion for literature.",
            psi_parameters={"competence": 0.8, "voice": "nova"},
            emotion_state={"hope": 0.8, "anxiety": 0.1},
        )
        session.add(character)
        session.flush()

        chunk = BookChunk(
            book_id=book.id,
            chapter_order=1,
            chapter_title="Chapter 1: The Overture",
            chunk_index=0,
            content="Elena whispered to the night sky, listening to the chime of distant bells.",
            embedding=embedder.embed_text("Elena whispered to the night sky, listening to the chime of distant bells."),
        )
        session.add(chunk)
        session.commit()

        return {
            "book_id": book.id,
            "character_id": character.id,
        }


def test_voice_turn_with_speech_text(
    db_client: FlaskClient,
    seeded_voice_book: dict[str, str],
):
    char_id = seeded_voice_book["character_id"]
    headers = {
        "X-Test-User-Id": "voice-reader-1",
        "Content-Type": "application/json",
    }

    # 1. Create conversation
    res = db_client.post(
        f"/api/v1/characters/{char_id}/conversations",
        headers=headers,
        data=json.dumps({"title": "Voice dialogue test"}),
    )
    assert res.status_code == 201
    session_id = res.get_json()["id"]

    # 2. Mock LLM provider
    mock_provider = MagicMock()
    mock_provider.generate_json.side_effect = [
        json.dumps({
            "reply": "I can hear the gentle echoes of your words through the quiet dusk.",
            "updated_psi": {"competence": 0.85},
            "updated_emotion_state": {"hope": 0.9, "anxiety": 0.05},
        }),
        json.dumps({"facts": []}),
    ]

    with patch(
        "book_character_simulation_backend.services.lorely_service.get_llm_provider",
        return_value=mock_provider,
    ):
        voice_res = db_client.post(
            f"/api/v1/conversations/{session_id}/voice-turn",
            headers=headers,
            data=json.dumps({"speech_text": "Do you hear the bells at night?"}),
        )

    assert voice_res.status_code == 200
    data = voice_res.get_json()
    assert "response" in data
    assert "audio" in data
    assert data["audio"]["speech_text"] == "Do you hear the bells at night?"
    assert data["audio"]["base64_data"] is not None
    assert data["audio"]["duration"] > 0
    assert data["audio"]["mime_type"] in ("audio/wav", "audio/mpeg")


def test_voice_turn_with_audio_file(
    db_client: FlaskClient,
    seeded_voice_book: dict[str, str],
    db_app: Flask,
):
    char_id = seeded_voice_book["character_id"]
    settings = db_app.config["SETTINGS"]
    voice_service = VoiceService(settings)
    sample_wav = voice_service._generate_harmonic_wav("Hello Elena", duration=1.0)

    # 1. Create conversation
    res = db_client.post(
        f"/api/v1/characters/{char_id}/conversations",
        headers={"X-Test-User-Id": "voice-reader-2", "Content-Type": "application/json"},
        data=json.dumps({"title": "Audio file voice turn"}),
    )
    assert res.status_code == 201
    session_id = res.get_json()["id"]

    # 2. Mock LLM provider
    mock_provider = MagicMock()
    mock_provider.generate_json.side_effect = [
        json.dumps({
            "reply": "It is lovely to hear your voice.",
            "updated_psi": {"competence": 0.82},
            "updated_emotion_state": {"hope": 0.85},
        }),
        json.dumps({"facts": []}),
    ]

    with patch(
        "book_character_simulation_backend.services.lorely_service.get_llm_provider",
        return_value=mock_provider,
    ):
        voice_res = db_client.post(
            f"/api/v1/conversations/{session_id}/voice-turn",
            headers={"X-Test-User-Id": "voice-reader-2"},
            data={
                "audio": (io.BytesIO(sample_wav), "user_speech.wav", "audio/wav"),
            },
            content_type="multipart/form-data",
        )

    assert voice_res.status_code == 200
    data = voice_res.get_json()
    assert data["audio"]["base64_data"] is not None
    assert data["response"] == "It is lovely to hear your voice."


def test_message_audio_stream_endpoint(
    db_client: FlaskClient,
    seeded_voice_book: dict[str, str],
):
    char_id = seeded_voice_book["character_id"]
    headers = {"X-Test-User-Id": "voice-reader-3", "Content-Type": "application/json"}

    res = db_client.post(
        f"/api/v1/characters/{char_id}/conversations",
        headers=headers,
        data=json.dumps({"title": "Stream audio test"}),
    )
    session_id = res.get_json()["id"]

    mock_provider = MagicMock()
    mock_provider.generate_json.side_effect = [
        json.dumps({
            "reply": "Words spoken aloud carry a unique resonance.",
            "updated_psi": {},
            "updated_emotion_state": {},
        }),
        json.dumps({"facts": []}),
    ]

    with patch(
        "book_character_simulation_backend.services.lorely_service.get_llm_provider",
        return_value=mock_provider,
    ):
        msg_res = db_client.post(
            f"/api/v1/conversations/{session_id}/messages",
            headers=headers,
            data=json.dumps({"content": "Speak to me"}),
        )

    assistant_msg_id = msg_res.get_json()["assistant_message_id"]

    audio_res = db_client.get(
        f"/api/v1/conversations/{session_id}/messages/{assistant_msg_id}/audio",
        headers={"X-Test-User-Id": "voice-reader-3"},
    )
    assert audio_res.status_code == 200
    assert audio_res.mimetype in ("audio/wav", "audio/mpeg")
    assert len(audio_res.data) > 44  # WAV header is at least 44 bytes


def test_voice_turn_validation_and_unauthorized(
    db_client: FlaskClient,
    seeded_voice_book: dict[str, str],
):
    char_id = seeded_voice_book["character_id"]
    headers = {"X-Test-User-Id": "voice-reader-4", "Content-Type": "application/json"}

    res = db_client.post(
        f"/api/v1/characters/{char_id}/conversations",
        headers=headers,
        data=json.dumps({"title": "Validation test"}),
    )
    session_id = res.get_json()["id"]

    # Missing speech payload
    empty_res = db_client.post(
        f"/api/v1/conversations/{session_id}/voice-turn",
        headers=headers,
        data=json.dumps({}),
    )
    assert empty_res.status_code == 400

    # Other user cannot access session voice turn
    forbidden_res = db_client.post(
        f"/api/v1/conversations/{session_id}/voice-turn",
        headers={"X-Test-User-Id": "other-user", "Content-Type": "application/json"},
        data=json.dumps({"speech_text": "Intruder message"}),
    )
    assert forbidden_res.status_code == 403
