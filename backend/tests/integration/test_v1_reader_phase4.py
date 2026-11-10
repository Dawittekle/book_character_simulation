from __future__ import annotations

import io
from unittest.mock import patch
from flask.testing import FlaskClient
from sqlalchemy import select

from book_character_simulation_backend.db.models import (
    Book,
    BookNarrationSegment,
    UserAccount,
)
from book_character_simulation_backend.voice.providers import LocalHarmonicTTSProvider


def test_reader_chapter_narration_synthesis_and_caching(db_client: FlaskClient):
    headers_author = {"X-Test-User-Id": "narration-author-1"}
    headers_stranger = {"X-Test-User-Id": "narration-stranger-2"}

    local_tts = LocalHarmonicTTSProvider()

    # 1. Author creates a book with multiple sentences
    create_res = db_client.post(
        "/api/v1/books",
        json={
            "title": "Pride and Prejudice Sample",
            "author": "Jane Austen",
            "visibility": "featured",
            "text": (
                "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. "
                "However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters."
            ),
        },
        headers=headers_author,
    )
    assert create_res.status_code == 201
    book_id = create_res.get_json()["id"]

    # 2. Request chapter 0 narration (use local harmonic TTS to avoid network delay)
    with patch(
        "book_character_simulation_backend.services.voice_service.VoiceService.synthesize_speech",
        side_effect=lambda text, voice="nova", speed=1.0, language="en": local_tts.synthesize(text, voice_id=voice, speed=speed, language=language)
    ):
        narration_res = db_client.get(
            f"/api/v1/reader/books/{book_id}/narration/0?voice_id=nova&speed=1.0",
            headers=headers_author,
        )
    assert narration_res.status_code == 200
    data = narration_res.get_json()

    assert data["book_id"] == book_id
    assert data["chapter_index"] == 0
    assert data["voice_id"] == "nova"
    assert data["cached"] is False
    assert data["duration_ms"] > 0
    assert len(data["segments"]) >= 1
    assert "audio_url" in data

    # Check alignment data structure
    first_seg = data["segments"][0]
    assert "segment_index" in first_seg
    assert "text" in first_seg
    assert "start_time_ms" in first_seg
    assert "end_time_ms" in first_seg
    assert first_seg["end_time_ms"] > first_seg["start_time_ms"]

    # 3. Verify audio can be retrieved from audio_url
    audio_url = data["audio_url"]
    audio_res = db_client.get(audio_url)
    assert audio_res.status_code == 200
    assert len(audio_res.data) > 0
    assert audio_res.headers.get("Content-Type") in ("audio/wav", "audio/mpeg", "application/octet-stream")

    # 4. Requesting narration again uses cached segment (without synthesize_speech being called)
    cached_res = db_client.get(
        f"/api/v1/reader/books/{book_id}/narration/0?voice_id=nova",
        headers=headers_author,
    )
    assert cached_res.status_code == 200
    cached_data = cached_res.get_json()
    assert cached_data["cached"] is True
    assert cached_data["duration_ms"] == data["duration_ms"]
    assert len(cached_data["segments"]) == len(data["segments"])

    # 5. Verify database record exists
    app = db_client.application
    db = app.extensions["database_manager"]
    with db.session_scope() as session:
        db_segment = session.scalar(
            select(BookNarrationSegment).where(
                BookNarrationSegment.book_id == book_id,
                BookNarrationSegment.chapter_index == 0,
                BookNarrationSegment.voice_id == "nova",
            )
        )
        assert db_segment is not None
        assert db_segment.duration_ms == data["duration_ms"]
        assert len(db_segment.alignment_data) == len(data["segments"])


def test_reader_private_book_narration_permission(db_client: FlaskClient):
    headers_author = {"X-Test-User-Id": "narration-priv-owner"}
    headers_stranger = {"X-Test-User-Id": "narration-priv-stranger"}

    create_res = db_client.post(
        "/api/v1/books",
        json={
            "title": "Private Diary",
            "author": "Private User",
            "visibility": "private",
            "text": "Secret thoughts inside the diary.",
        },
        headers=headers_author,
    )
    assert create_res.status_code == 201
    book_id = create_res.get_json()["id"]

    # Stranger cannot access private narration -> 403 Forbidden
    stranger_res = db_client.get(
        f"/api/v1/reader/books/{book_id}/narration/0",
        headers=headers_stranger,
    )
    assert stranger_res.status_code == 403
    assert "permission" in stranger_res.get_json()["error"].lower()

    # Owner can access -> 200 OK
    owner_res = db_client.get(
        f"/api/v1/reader/books/{book_id}/narration/0",
        headers=headers_author,
    )
    assert owner_res.status_code == 200
