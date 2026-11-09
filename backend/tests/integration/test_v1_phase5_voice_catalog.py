from __future__ import annotations

import base64
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
    VoiceCatalogItem,
    VoiceUsageLog,
)
from book_character_simulation_backend.db.session import DatabaseManager


def _setup_voice_test_environment(db_manager: DatabaseManager):
    """Sets up a test user, book, and two characters (feminine and masculine)."""
    with db_manager.session_scope() as session:
        user = UserAccount(
            supabase_user_id="usr-phase5-voice-tester",
            email="voice-tester@lorely.example",
            display_name="Voice System Tester",
        )
        session.add(user)
        session.flush()

        settings = UserSettings(
            user_id=user.id,
            voice_vad_silence_ms=1200,
            voice_auto_play=True,
        )
        session.add(settings)

        book = Book(
            owner_user_id=user.id,
            title="White Nights and Crime and Punishment",
            author="Fyodor Dostoevsky",
            visibility="private",
        )
        session.add(book)
        session.flush()

        # Feminine character (Nastenka)
        nastenka = CharacterProfileRecord(
            book_id=book.id,
            name="Nástyenka",
            role="Heroine and dreamer's confidante",
            personality="Gentle, romantic, youthful, emotional, sensitive",
            appearance_description="A young lady with dark eyes and charming, delicate countenance",
            relationships=["The Dreamer", "The Lodger"],
            emotion_state={"joy": 0.8, "sorrow": 0.2},
            psi_parameters={"openness": 0.9, "warmth": 0.85},
        )
        session.add(nastenka)

        # Masculine character (Rodion Raskolnikov)
        raskolnikov = CharacterProfileRecord(
            book_id=book.id,
            name="Rodion Raskolnikov",
            role="Former student and tormented protagonist",
            personality="Brooding, proud, introspective, dramatic, intense",
            appearance_description="A handsome young man with dark brown hair and gloomy, commanding eyes",
            relationships=["Dunya", "Razumikhin", "Sonya"],
            emotion_state={"anxiety": 0.9, "guilt": 0.8},
            psi_parameters={"openness": 0.3, "warmth": 0.2},
        )
        session.add(raskolnikov)
        session.flush()

        return user.id, book.id, nastenka.id, raskolnikov.id


def test_voice_catalog_listing_and_filtering(db_client: FlaskClient):
    """Verifies that GET /api/v1/voices lists seeded approved voices and supports filtering."""
    headers = {"X-Test-User-Id": "usr-phase5-voice-tester"}

    # 1. List all voices
    res = db_client.get("/api/v1/voices", headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert "voices" in data
    voices = data["voices"]
    assert len(voices) >= 7

    # Check required catalog metadata schema
    nova = next((v for v in voices if v["voice_id"] == "nova"), None)
    assert nova is not None
    assert nova["provider"] == "openai"
    assert nova["gender"] == "feminine"
    assert nova["age_bracket"] == "young_adult"
    assert nova["preview_audio_url"] == "/api/v1/voices/nova/preview"
    assert "language_codes" in nova and "en" in nova["language_codes"]
    assert len(nova["sample_text"]) > 10

    # 2. Filter by gender = feminine
    fem_res = db_client.get("/api/v1/voices?gender=feminine", headers=headers)
    assert fem_res.status_code == 200
    fem_voices = fem_res.get_json()["voices"]
    assert all(v["gender"] == "feminine" for v in fem_voices)
    assert any(v["voice_id"] == "nova" for v in fem_voices)
    assert not any(v["voice_id"] == "echo" for v in fem_voices)

    # 3. Filter by language = am
    am_res = db_client.get("/api/v1/voices?language=am", headers=headers)
    assert am_res.status_code == 200
    am_voices = am_res.get_json()["voices"]
    assert any(v["voice_id"] == "geez_narrator" for v in am_voices)


def test_voice_preview_synthesis_stream(db_client: FlaskClient):
    """Verifies that GET /api/v1/voices/<voice_id>/preview returns playable synthetic audio."""
    res = db_client.get("/api/v1/voices/nova/preview")
    assert res.status_code == 200
    assert res.content_type.startswith("audio/wav")
    assert len(res.data) > 100  # Synthesized audio payload

    # Non-existent voice should 404
    missing_res = db_client.get("/api/v1/voices/nonexistent_phantom_voice/preview")
    assert missing_res.status_code == 404


def test_deterministic_character_voice_matching(db_client: FlaskClient):
    """Verifies Section 11.8 deterministic character-to-voice matching for literary personas."""
    db_manager: DatabaseManager = db_client.application.extensions["database_manager"]
    _, _, nastenka_id, raskolnikov_id = _setup_voice_test_environment(db_manager)
    headers = {"X-Test-User-Id": "usr-phase5-voice-tester"}

    # 1. Match Nastenka (feminine, gentle, young adult)
    fem_match_res = db_client.get(f"/api/v1/characters/{nastenka_id}/matched-voice", headers=headers)
    assert fem_match_res.status_code == 200
    fem_match = fem_match_res.get_json()
    assert fem_match["character_id"] == nastenka_id
    assert fem_match["gender"] == "feminine"
    assert fem_match["matched_voice_id"] in ["nova", "shimmer"]
    assert fem_match["confidence"] in ["explicit", "inferred"]
    assert len(fem_match["reasons"]) > 0

    # 2. Match Raskolnikov (masculine, dramatic/somber)
    masc_match_res = db_client.get(f"/api/v1/characters/{raskolnikov_id}/matched-voice", headers=headers)
    assert masc_match_res.status_code == 200
    masc_match = masc_match_res.get_json()
    assert masc_match["character_id"] == raskolnikov_id
    assert masc_match["gender"] == "masculine"
    assert masc_match["matched_voice_id"] in ["echo", "onyx", "fable"]
    assert masc_match["confidence"] in ["explicit", "inferred"]

    # 3. Match in Amharic conversation context
    am_match_res = db_client.get(f"/api/v1/characters/{nastenka_id}/matched-voice?language=am", headers=headers)
    assert am_match_res.status_code == 200
    am_match = am_match_res.get_json()
    assert am_match["matched_voice_id"] == "geez_narrator"


def test_conversation_voice_override(db_client: FlaskClient):
    """Verifies that a user can override the assigned voice at the conversation session level."""
    db_manager: DatabaseManager = db_client.application.extensions["database_manager"]
    _, _, nastenka_id, _ = _setup_voice_test_environment(db_manager)
    headers = {"X-Test-User-Id": "usr-phase5-voice-tester"}

    # 1. Create conversation with voice override
    conv_res = db_client.post(
        f"/api/v1/characters/{nastenka_id}/conversations",
        headers=headers,
        json={
            "title": "Night Talks with Nastenka",
            "voice_override": "fable",
        },
    )
    assert conv_res.status_code == 201
    conv_data = conv_res.get_json()
    session_id = conv_data["id"]
    assert conv_data["session_voice_override"] == "fable"

    # 2. Update session voice override
    patch_res = db_client.patch(
        f"/api/v1/conversations/{session_id}",
        headers=headers,
        json={"voice_override": "onyx"},
    )
    assert patch_res.status_code == 200
    assert patch_res.get_json()["session_voice_override"] == "onyx"

    # 3. Verify in database
    with db_manager.session_scope() as session:
        s = session.get(ChatSession, session_id)
        assert s.session_voice_override == "onyx"


def test_voice_turn_execution_playback_and_usage_logging(db_client: FlaskClient):
    """
    Verifies full chained voice interaction turn:
    - Transcribing / accepting speech text
    - Invoking Lorely orchestrator
    - Synthesizing character speech in effective voice
    - Tracking playback generation ID and speaking state
    - Logging usage in VoiceUsageLog
    """
    db_manager: DatabaseManager = db_client.application.extensions["database_manager"]
    user_id, _, nastenka_id, _ = _setup_voice_test_environment(db_manager)
    headers = {"X-Test-User-Id": "usr-phase5-voice-tester"}

    conv_res = db_client.post(
        f"/api/v1/characters/{nastenka_id}/conversations",
        headers=headers,
        json={"title": "Voice Session Test", "voice_override": "nova"},
    )
    session_id = conv_res.get_json()["id"]

    # 1. Execute voice turn with speech text
    turn_res = db_client.post(
        f"/api/v1/conversations/{session_id}/voice-turn",
        headers=headers,
        json={
            "speech_text": "Good evening, Nastenka. The canal is peaceful tonight.",
            "reading_progress_chapter": 1,
            "conversation_language": "en",
        },
    )
    assert turn_res.status_code == 200
    data = turn_res.get_json()
    assert "audio" in data
    audio = data["audio"]
    assert audio["status"] == "ready"
    assert audio["voice_id"] == "nova"
    assert audio["playback_generation_id"] is not None
    assert audio["mime_type"] == "audio/wav"
    assert len(audio["base64_data"]) > 100
    assert audio["speech_text"] == "Good evening, Nastenka. The canal is peaceful tonight."

    # 2. Check session state in database
    with db_manager.session_scope() as session:
        s = session.get(ChatSession, session_id)
        assert s.is_speaking is True
        assert s.active_playback_generation_id == audio["playback_generation_id"]

        # Check message audio storage path
        asst_msg = session.get(ChatMessage, data["assistant_message_id"])
        assert asst_msg is not None
        assert asst_msg.audio_storage_path is not None
        assert asst_msg.is_interrupted is False

    # 3. Check voice usage logging
    usage_res = db_client.get("/api/v1/me/voice-usage", headers=headers)
    assert usage_res.status_code == 200
    usage_data = usage_res.get_json()
    assert usage_data["turn_count"] >= 1
    assert usage_data["total_tts_characters"] > 0
    assert usage_data["total_cost_usd"] > 0.0
    assert len(usage_data["recent_logs"]) >= 1
    latest_log = usage_data["recent_logs"][0]
    assert latest_log["voice_id"] == "nova"
    assert latest_log["modality"] == "voice_turn"


def test_conversation_interruption(db_client: FlaskClient):
    """
    Verifies Section 11.4 interruption / barge-in workflow:
    - User interrupts active character speech
    - Active generation ID increments/changes
    - is_speaking becomes False
    - Latest assistant message marked is_interrupted = True
    """
    db_manager: DatabaseManager = db_client.application.extensions["database_manager"]
    _, _, nastenka_id, _ = _setup_voice_test_environment(db_manager)
    headers = {"X-Test-User-Id": "usr-phase5-voice-tester"}

    conv_res = db_client.post(
        f"/api/v1/characters/{nastenka_id}/conversations",
        headers=headers,
        json={"title": "Interruption Test"},
    )
    session_id = conv_res.get_json()["id"]

    # Start voice turn
    turn_res = db_client.post(
        f"/api/v1/conversations/{session_id}/voice-turn",
        headers=headers,
        json={"speech_text": "Tell me a long story."},
    )
    initial_gen_id = turn_res.get_json()["audio"]["playback_generation_id"]
    assistant_msg_id = turn_res.get_json()["assistant_message_id"]

    # Interruption triggered
    interrupt_res = db_client.post(f"/api/v1/conversations/{session_id}/interrupt", headers=headers)
    assert interrupt_res.status_code == 200
    int_data = interrupt_res.get_json()
    assert int_data["status"] == "interrupted"
    assert int_data["is_speaking"] is False
    assert int_data["active_playback_generation_id"] != initial_gen_id
    assert int_data["interrupted_message_id"] == assistant_msg_id

    # Verify messages reflect interrupted status
    msgs_res = db_client.get(f"/api/v1/conversations/{session_id}/messages", headers=headers)
    assert msgs_res.status_code == 200
    msgs = msgs_res.get_json()["messages"]
    asst_msg = next((m for m in msgs if m["id"] == assistant_msg_id), None)
    assert asst_msg is not None
    assert asst_msg["is_interrupted"] is True


def test_user_voice_settings_vad_and_autoplay(db_client: FlaskClient):
    """Verifies VAD silence duration and autoplay preference in UserSettings."""
    headers = {"X-Test-User-Id": "usr-phase5-voice-tester"}

    # 1. Check default settings
    res = db_client.get("/api/v1/me/settings", headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data["voice_vad_silence_ms"] == 1200
    assert data["voice_auto_play"] is True

    # 2. Update with custom valid values
    patch_res = db_client.patch(
        "/api/v1/me/settings",
        headers=headers,
        json={
            "voice_vad_silence_ms": 1800,
            "voice_auto_play": False,
        },
    )
    assert patch_res.status_code == 200
    updated = patch_res.get_json()
    assert updated["voice_vad_silence_ms"] == 1800
    assert updated["voice_auto_play"] is False

    # 3. Test clamping: too low (< 500) clamped to 500, too high (> 5000) clamped to 5000
    low_res = db_client.patch("/api/v1/me/settings", headers=headers, json={"voice_vad_silence_ms": 100})
    assert low_res.get_json()["voice_vad_silence_ms"] == 500

    high_res = db_client.patch("/api/v1/me/settings", headers=headers, json={"voice_vad_silence_ms": 9999})
    assert high_res.get_json()["voice_vad_silence_ms"] == 5000


def test_amharic_voice_turn_guardrail(db_client: FlaskClient):
    """
    Verifies Section 8.4 guardrail:
    Amharic voice input/turns must return text response with experimental notice
    rather than synthesized garbled English TTS.
    """
    db_manager: DatabaseManager = db_client.application.extensions["database_manager"]
    _, _, nastenka_id, _ = _setup_voice_test_environment(db_manager)
    headers = {"X-Test-User-Id": "usr-phase5-voice-tester"}

    conv_res = db_client.post(
        f"/api/v1/characters/{nastenka_id}/conversations",
        headers=headers,
        json={"title": "Amharic Voice Turn", "conversation_language": "am"},
    )
    session_id = conv_res.get_json()["id"]

    turn_res = db_client.post(
        f"/api/v1/conversations/{session_id}/voice-turn",
        headers=headers,
        json={
            "speech_text": "ሰላም ናስቴንካ፣ እንዴት ነሽ?",
            "conversation_language": "am",
        },
    )
    assert turn_res.status_code == 200
    data = turn_res.get_json()
    assert data["audio"]["status"] == "experimental_text_only"
    assert "experimental evaluation" in data["audio"]["message"]
    assert len(data["response"]) > 0
