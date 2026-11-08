from __future__ import annotations

import io
from flask.testing import FlaskClient


def test_health_check_endpoint(client: FlaskClient):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert "environment" in data
    assert "default_provider" in data


def test_extract_characters_requires_text(client: FlaskClient):
    res = client.post("/api/extract-characters", data={})
    assert res.status_code == 400
    assert "No text provided" in res.get_json()["error"]


def test_extract_characters_invalid_file_extension(client: FlaskClient):
    res = client.post(
        "/api/extract-characters",
        data={"file": (io.BytesIO(b"mock binary content"), "test.exe")},
        content_type="multipart/form-data",
    )
    assert res.status_code == 400
    assert "Only PDFs are allowed" in res.get_json()["error"]


def test_chat_requires_message_and_text_id(client: FlaskClient):
    res = client.post("/api/chat/char123", data={"message": ""})
    assert res.status_code == 400

    res2 = client.post("/api/chat/char123", data={"message": "hello", "text_id": ""})
    assert res2.status_code == 400


def test_chat_character_not_found(client: FlaskClient):
    res = client.post(
        "/api/chat/non-existent-character-id",
        data={"message": "hello", "text_id": "text_123"},
    )
    assert res.status_code == 404
    assert "Character not found" in res.get_json()["error"]
