from __future__ import annotations

import hashlib
import json
from unittest.mock import MagicMock, patch
import pytest
from flask.testing import FlaskClient
from sqlalchemy import select

from book_character_simulation_backend.config import Settings
from book_character_simulation_backend.db.models import (
    Book,
    BookChapter,
    BookChunk,
    BookProcessingStatus,
    ProcessingJob,
)
from book_character_simulation_backend.db.session import DatabaseManager
from book_character_simulation_backend.errors import ConfigurationError, StorageError
from book_character_simulation_backend.llm.gemini_provider import GeminiProvider
from book_character_simulation_backend.services.classification_service import ClassificationService
from book_character_simulation_backend.services.storage_service import StorageService
from book_character_simulation_backend.workers.ingestion_worker import IngestionWorker


MULTI_CHAPTER_BOOK_TEXT = """
CHAPTER 1: The Departure from the Station

The autumn mist lay thick over the tracks as Alexei stepped into the dimly lit wooden carriage.
The whistle screamed twice, and the metal wheels began their rhythmic clattering against the iron rails.
Across from him sat an elderly passenger clutching an ancient leather briefcase, staring into the dark.

CHAPTER 2: A Strange Conversation at Midnight

Hours later, the carriage rocked gently in the dead of night.
Alexei noticed the old man was awake, whispering to himself.
"Do you believe," the old traveler said softly, "that a man can rewrite his conscience?"
Alexei leaned forward, his heart quickening at the strange question.

CHAPTER 3: Arrival at the Border

Morning arrived with pale winter sunlight piercing the frost on the windows.
The train slowed to a halt at the border station of Verkhneye.
Alexei picked up his coat, knowing that whatever waited beyond this station would change his life forever.
""".strip()

INVOICE_TEXT = """
ACME LOGISTICS INC.
INVOICE #INV-2026-8941
Bill To: Global Trade Partners LLC
Invoice Date: November 09, 2026
Due Date: December 09, 2026
Payment Terms: Net 30

Item Description        Qty    Unit Price    Total
Freight Shipping         2      $1,200.00   $2,400.00
Customs Clearance        1        $350.00     $350.00

Subtotal: $2,750.00
VAT Reg (15%): $412.50
Total Due: $3,162.50
""".strip()

ACADEMIC_PAPER_TEXT = """
Towards Robust Latent Space Alignment in Deep Semantic Neural Networks
Author: Dr. Elena Rostova
DOI: 10.1016/j.artint.2026.04.012

ABSTRACT:
In this paper, we propose a novel latent space alignment methodology for high-dimensional representations.
We demonstrate that topological manifolds can be regularized without loss of expressive variance.

1. INTRODUCTION
Recent advancements in semantic embeddings have highlighted the need for geometric consistency.

2. METHODOLOGY
We formalize the Riemannian metric over the feature manifold and prove asymptotic convergence.

3. CONCLUSIONS AND REFERENCES
Our empirical results validate the theoretical bounds established in Section 2.
""".strip()


def test_presigned_upload_endpoint_and_validation(db_client: FlaskClient):
    auth_headers = {"X-Test-User-Id": "usr-author-phase2"}

    # 1. Missing filename -> 400
    res = db_client.post("/api/v1/storage/presigned-upload", headers=auth_headers, json={})
    assert res.status_code == 400
    assert "Filename is required" in res.get_json()["error"]

    # 2. Unsupported extension -> 400
    res = db_client.post(
        "/api/v1/storage/presigned-upload",
        headers=auth_headers,
        json={"filename": "malware.exe"},
    )
    assert res.status_code == 400
    assert "Unsupported file extension" in res.get_json()["error"]

    # 3. Valid EPUB upload request -> 200 with presigned URL details
    res = db_client.post(
        "/api/v1/storage/presigned-upload",
        headers=auth_headers,
        json={
            "filename": "the_brothers_karamazov.epub",
            "content_type": "application/epub+zip",
        },
    )
    assert res.status_code == 200
    payload = res.get_json()
    assert "upload_url" in payload
    assert payload["method"] in ("PUT", "POST")
    assert "the_brothers_karamazov.epub" in payload["key"]
    assert payload["storage_provider"] in ("r2", "local")


def test_direct_upload_receiver_local_mode(db_client: FlaskClient):
    auth_headers = {"X-Test-User-Id": "usr-author-phase2"}
    test_key = "uploads/test-user/sample_test_doc.txt"
    test_content = b"Direct upload content payload for testing R2 local fallback."

    res = db_client.post(
        f"/api/v1/storage/upload/{test_key}",
        headers=auth_headers,
        data=test_content,
        content_type="text/plain",
    )
    assert res.status_code == 201
    assert res.get_json()["status"] == "uploaded"
    assert res.get_json()["bytes_written"] == len(test_content)

    # Verify download retrieves exact same bytes
    download_res = db_client.get(f"/api/v1/storage/{test_key}")
    assert download_res.status_code == 200
    assert download_res.data == test_content


def test_production_storage_safety(test_settings: Settings):
    import dataclasses

    # In production without R2, StorageService must fail loudly rather than silently write to disk
    prod_settings = dataclasses.replace(
        test_settings,
        app_env="production",
        r2_account_id=None,
        r2_access_key_id=None,
        r2_secret_access_key=None,
    )

    with pytest.raises(ConfigurationError) as exc_info:
        StorageService(prod_settings)
    assert "Cloudflare R2 is required in production environment" in str(exc_info.value)


def test_enhanced_classification_gate(test_settings: Settings):
    classifier = ClassificationService(test_settings)

    # 1. Invoice test
    invoice_result = classifier.classify_text(INVOICE_TEXT, filename="invoice_nov_2026.pdf")
    assert invoice_result.document_type == "document"
    assert invoice_result.genre == "invoice"
    assert invoice_result.supported_for_character_simulation is False
    assert invoice_result.warning is not None

    # 2. Academic paper test
    academic_result = classifier.classify_text(ACADEMIC_PAPER_TEXT, filename="paper_latent_space.pdf")
    assert academic_result.document_type == "document"
    assert academic_result.genre == "academic_paper"
    assert academic_result.supported_for_character_simulation is False


def test_classification_gate_blocks_invoice_ingestion(db_client: FlaskClient):
    auth_headers = {"X-Test-User-Id": "usr-curator-gate"}

    # Inspect invoice
    inspect_res = db_client.post(
        "/api/v1/books/inspect",
        headers=auth_headers,
        json={"raw_text": INVOICE_TEXT, "filename": "billing_statement.txt"},
    )
    assert inspect_res.status_code == 200
    temp_id = inspect_res.get_json()["temp_source_id"]
    assert inspect_res.get_json()["supported_for_character_simulation"] is False

    # Ingestion attempt without force_extraction MUST fail with 400
    ingest_res = db_client.post(
        "/api/v1/books/ingest",
        headers=auth_headers,
        json={"temp_source_id": temp_id},
    )
    assert ingest_res.status_code == 400
    assert "non-narrative" in ingest_res.get_json()["error"].lower() or "financial" in ingest_res.get_json()["error"].lower()

    # Ingestion with force_extraction=True MUST succeed
    force_res = db_client.post(
        "/api/v1/books/ingest",
        headers=auth_headers,
        json={"temp_source_id": temp_id, "force_extraction": True},
    )
    assert force_res.status_code == 201


def test_multi_chapter_segmentation_and_pgvector_indexing(db_client: FlaskClient, monkeypatch: pytest.MonkeyPatch):
    mock_chars = json.dumps([
        {
            "id": "alexei",
            "name": "Alexei Voronov",
            "personality": "Observant, introspective traveler.",
            "key_events": ["Boarded night train", "Met mysterious old passenger"],
            "relationships": ["Stranger: old passenger"],
            "psi_parameters": {
                "valence_level": 0.5,
                "arousal_level": 0.3,
                "selection_threshold": 0.6,
                "resolution_level": 0.7,
                "goal_directedness": 0.8,
                "securing_rate": 0.4,
            },
            "emotion_state": {
                "anger": 0.0,
                "sadness": 0.2,
                "pride": 0.5,
                "joy": 0.3,
                "bliss": 0.1,
            },
        }
    ])
    monkeypatch.setattr(GeminiProvider, "generate_json", lambda self, system_prompt, user_prompt: mock_chars)

    auth_headers = {"X-Test-User-Id": "usr-scholar-pgvector"}

    # Inspect multi-chapter narrative
    inspect_res = db_client.post(
        "/api/v1/books/inspect",
        headers=auth_headers,
        json={"raw_text": MULTI_CHAPTER_BOOK_TEXT, "filename": "railway_confession.txt"},
    )
    assert inspect_res.status_code == 200
    temp_id = inspect_res.get_json()["temp_source_id"]

    # Ingest book synchronously
    ingest_res = db_client.post(
        "/api/v1/books/ingest",
        headers=auth_headers,
        json={"temp_source_id": temp_id, "title": "Railway Confession", "author": "Alexei Voronov"},
    )
    assert ingest_res.status_code == 201
    book_id = ingest_res.get_json()["book_id"]

    db_manager: DatabaseManager = db_client.application.extensions["database_manager"]
    with db_manager.session_scope() as session:
        # 1. Verify BookChapter records
        chapters = session.execute(
            select(BookChapter).where(BookChapter.book_id == book_id).order_by(BookChapter.chapter_order.asc())
        ).scalars().all()
        assert len(chapters) == 3
        assert chapters[0].chapter_order == 1
        assert "Departure" in chapters[0].title
        assert chapters[1].chapter_order == 2
        assert "Midnight" in chapters[1].title
        assert chapters[2].chapter_order == 3
        assert "Border" in chapters[2].title

        for ch in chapters:
            assert ch.word_count > 0
            assert ch.start_char is not None
            assert ch.end_char is not None

        # 2. Verify BookChunk records with native vector embeddings and content_hash
        chunks = session.execute(
            select(BookChunk).where(BookChunk.book_id == book_id).order_by(BookChunk.chunk_index.asc())
        ).scalars().all()
        assert len(chunks) >= 3

        for chunk in chunks:
            assert chunk.embedding is not None
            assert len(chunk.embedding) > 0
            assert chunk.embedding_provider in ("gemini", "openai", "deterministic")
            assert chunk.embedding_dimensions > 0
            assert chunk.content_hash == hashlib.sha256(chunk.content.encode("utf-8")).hexdigest()


def test_async_ingestion_worker_queue_and_idempotency(db_client: FlaskClient, monkeypatch: pytest.MonkeyPatch):
    mock_chars = json.dumps([
        {
            "id": "alexei",
            "name": "Alexei Voronov",
            "personality": "Observant, introspective traveler.",
            "key_events": ["Boarded night train", "Met mysterious old passenger"],
            "relationships": ["Stranger: old passenger"],
            "psi_parameters": {
                "valence_level": 0.5,
                "arousal_level": 0.3,
                "selection_threshold": 0.6,
                "resolution_level": 0.7,
                "goal_directedness": 0.8,
                "securing_rate": 0.4,
            },
            "emotion_state": {
                "anger": 0.0,
                "sadness": 0.2,
                "pride": 0.5,
                "joy": 0.3,
                "bliss": 0.1,
            },
        }
    ])
    monkeypatch.setattr(GeminiProvider, "generate_json", lambda self, system_prompt, user_prompt: mock_chars)

    auth_headers = {"X-Test-User-Id": "usr-async-worker"}

    # Inspect book
    inspect_res = db_client.post(
        "/api/v1/books/inspect",
        headers=auth_headers,
        json={"raw_text": MULTI_CHAPTER_BOOK_TEXT, "filename": "async_railway.txt"},
    )
    temp_id = inspect_res.get_json()["temp_source_id"]

    # Ingest book with async_mode=True
    async_res = db_client.post(
        "/api/v1/books/ingest?async=true",
        headers=auth_headers,
        json={"temp_source_id": temp_id, "title": "Async Railway Journey", "author": "Alexei V."},
    )
    assert async_res.status_code == 202
    job_id = async_res.get_json()["job_id"]
    book_id = async_res.get_json()["book_id"]
    assert async_res.get_json()["status"] == "queued"

    db_manager: DatabaseManager = db_client.application.extensions["database_manager"]
    settings: Settings = db_client.application.config["SETTINGS"]

    # Verify initial queued state
    with db_manager.session_scope() as session:
        job = session.get(ProcessingJob, job_id)
        assert job.status == "queued"
        book = session.get(Book, book_id)
        assert book.processing_status == BookProcessingStatus.extracting

    # Execute worker cycle
    worker = IngestionWorker(db_manager, settings)
    processed = worker.run_once()
    assert processed is True

    # Verify completed state
    with db_manager.session_scope() as session:
        job = session.get(ProcessingJob, job_id)
        assert job.status == "completed"
        assert job.progress == 100
        book = session.get(Book, book_id)
        assert book.processing_status == BookProcessingStatus.ready
        assert len(book.chapters) == 3
        chunk_count_first = len(book.chunks)
        assert chunk_count_first >= 3

    # Idempotency test: Re-running process_job on the same job must not duplicate records
    worker.process_job(job_id)
    with db_manager.session_scope() as session:
        book = session.get(Book, book_id)
        assert len(book.chapters) == 3
        assert len(book.chunks) == chunk_count_first
