from __future__ import annotations

import json
from flask.testing import FlaskClient

from book_character_simulation_backend.llm.gemini_provider import GeminiProvider


def test_cover_letter_gate_blocks_accidental_extraction(db_client: FlaskClient):
    headers = {"X-Test-User-Id": "applicant-user"}

    cover_letter_text = """
    Dawit Teklebrhan
    Addis Ababa, Ethiopia
    teklebrahandawit309@gmail.com

    Dear Hiring Manager,

    I am writing to express my strong interest in the Senior Full-Stack Engineer position.
    With over 5 years of work experience, I have developed deep technical expertise.
    Education: B.S. in Computer Science. References available upon request.

    Sincerely,
    Dawit Teklebrhan
    """

    # 1. Inspect source
    inspect_res = db_client.post(
        "/api/v1/books/inspect",
        json={"text": cover_letter_text, "filename": "cover_letter.pdf"},
        headers=headers,
    )
    assert inspect_res.status_code == 200
    inspect_data = inspect_res.get_json()
    assert inspect_data["document_type"] == "document"
    assert inspect_data["is_narrative"] is False
    assert inspect_data["warning"] is not None
    assert "resume or cover letter" in inspect_data["warning"]
    temp_source_id = inspect_data["temp_source_id"]

    # 2. Attempt ingest without force_extraction -> 400 Bad Request
    err_res = db_client.post(
        "/api/v1/books/ingest",
        json={
            "temp_source_id": temp_source_id,
            "force_extraction": False,
        },
        headers=headers,
    )
    assert err_res.status_code == 400
    assert "resume or cover letter" in err_res.get_json()["error"]


def test_narrative_book_inspection_and_ingestion(db_client: FlaskClient, monkeypatch):
    headers = {"X-Test-User-Id": "reader-bookworm"}

    novel_text = """
    Chapter One: The Secret of the Harbor

    Elena stood on the windy pier, clutching the worn leather journal tightly against her chest.
    Captain Victor Kane watched her from the deck of the Wanderer, his eyes narrowing as the storm clouds gathered.
    "You shouldn't be here, Elena," Victor warned.
    "I have as much right to know the truth as you do," she replied firmly.
    """

    mock_classification = json.dumps({
        "document_type": "book",
        "confidence": 0.95,
        "title": "The Harbor Secret",
        "author": "Elena Marlowe",
        "is_narrative": True,
        "reasoning": "Narrative fiction with chapter header and character dialogue.",
        "warning": None,
    })

    mock_characters = json.dumps([
        {
            "name": "Elena",
            "personality": "Determined and brave investigator",
            "key_events": ["Stood on the pier", "Confronted Captain Victor"],
            "relationships": ["Victor Kane (Rival)"],
            "psi_parameters": {
                "valence_level": 0.7,
                "arousal_level": 0.6,
                "selection_threshold": 0.5,
                "resolution_level": 0.8,
                "goal_directedness": 0.9,
                "securing_rate": 0.3,
            },
            "emotion_state": {
                "anger": 0.1,
                "sadness": 0.05,
                "pride": 0.7,
                "joy": 0.6,
                "bliss": 0.4,
            },
        },
        {
            "name": "Victor Kane",
            "personality": "Stern and guarded sea captain",
            "key_events": ["Warned Elena away from the harbor"],
            "relationships": ["Elena (Adversary)"],
            "psi_parameters": {
                "valence_level": 0.4,
                "arousal_level": 0.7,
                "selection_threshold": 0.8,
                "resolution_level": 0.9,
                "goal_directedness": 0.7,
                "securing_rate": 0.6,
            },
            "emotion_state": {
                "anger": 0.4,
                "sadness": 0.1,
                "pride": 0.8,
                "joy": 0.2,
                "bliss": 0.1,
            },
        },
    ])

    def mock_generate_json(self, system_prompt: str, user_prompt: str) -> str:
        if "classifier" in system_prompt.lower() or "classify" in user_prompt.lower():
            return mock_classification
        return mock_characters

    monkeypatch.setattr(GeminiProvider, "generate_json", mock_generate_json)

    # 1. Inspect
    inspect_res = db_client.post(
        "/api/v1/books/inspect",
        json={"text": novel_text, "filename": "harbor_secret.epub"},
        headers=headers,
    )
    assert inspect_res.status_code == 200
    inspect_data = inspect_res.get_json()
    assert inspect_data["document_type"] == "book"
    assert inspect_data["is_narrative"] is True
    temp_source_id = inspect_data["temp_source_id"]

    # 2. Ingest
    ingest_res = db_client.post(
        "/api/v1/books/ingest",
        json={
            "temp_source_id": temp_source_id,
            "title": "The Harbor Secret",
            "author": "Elena Marlowe",
        },
        headers=headers,
    )
    assert ingest_res.status_code == 201
    ingest_data = ingest_res.get_json()
    job_id = ingest_data["job_id"]
    book_id = ingest_data["book_id"]
    assert ingest_data["status"] == "completed"
    assert ingest_data["character_count"] == 2

    # 3. Poll Job status
    job_res = db_client.get(f"/api/v1/jobs/{job_id}", headers=headers)
    assert job_res.status_code == 200
    job_data = job_res.get_json()
    assert job_data["status"] == "completed"
    assert job_data["stage"] == "ready"
    assert job_data["progress"] == 100
    assert job_data["book_id"] == book_id

    # 4. Verify book has characters
    chars_res = db_client.get(f"/api/v1/books/{book_id}/characters", headers=headers)
    assert chars_res.status_code == 200
    chars = chars_res.get_json()["characters"]
    assert len(chars) == 2
    char_names = [c["name"] for c in chars]
    assert "Elena" in char_names
    assert "Victor Kane" in char_names
