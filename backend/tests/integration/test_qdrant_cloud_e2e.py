from __future__ import annotations

import pytest
from flask.testing import FlaskClient

from book_character_simulation_backend.config import Settings
from book_character_simulation_backend.repositories.qdrant import (
    QdrantChunkRecord,
    QdrantRepository,
    _normalize_point_id,
)
from book_character_simulation_backend.rag.retriever import SpoilerAwareRetriever
from book_character_simulation_backend.rag.embedding_provider import EmbeddingService


def test_health_check_reports_vector_store(client: FlaskClient):
    """Verifies that the /api/health endpoint reports vector store configuration and status."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert "vector_store_configured" in data
    assert "vector_store_connected" in data
    assert "vector_collection" in data


def test_qdrant_cloud_live_connection_and_points():
    """Verifies live cluster connectivity and points backfilled in Qdrant Cloud."""
    settings = Settings.from_env()
    if not settings.qdrant_url or not settings.qdrant_api_key:
        pytest.skip("Qdrant Cloud credentials not present in environment.")

    repo = QdrantRepository(settings)
    assert repo.is_configured is True
    assert repo.check_health() is True

    # Check total point count
    total_points = repo.count()
    assert total_points >= 29, f"Expected at least 29 points in Qdrant Cloud, found {total_points}"


def test_qdrant_cloud_spoiler_and_isolation_live():
    """
    Tests live filtered vector retrieval on Qdrant Cloud verifying both:
    1. Chapter-based spoiler prevention
    2. Tenant isolation filters
    """
    settings = Settings.from_env()
    if not settings.qdrant_url or not settings.qdrant_api_key:
        pytest.skip("Qdrant Cloud credentials not present in environment.")

    repo = QdrantRepository(settings)
    embedding_service = EmbeddingService(settings)
    query_vec = embedding_service.embed_text("Petersburg bridge night dream")

    # Search with book_id='book-dostoevsky-white-nights' (White Nights has 4 chapters/nights)
    all_passages = repo.search(
        query_vector=query_vec,
        book_id="book-dostoevsky-white-nights",
        max_allowed_chapter=None,
        limit=10,
    )
    assert len(all_passages) > 0

    # Apply strict spoiler filter: only up to chapter 1 (First Night)
    early_passages = repo.search(
        query_vector=query_vec,
        book_id="book-dostoevsky-white-nights",
        max_allowed_chapter=1,
        limit=10,
    )
    for p in early_passages:
        assert p.chapter_order <= 1, f"Spoiler breach: chunk {p.id} from chapter {p.chapter_order} returned"

    # Multi-tenant isolation: private search for unauthorized user should return 0
    private_results = repo.search(
        query_vector=query_vec,
        book_id="book-dostoevsky-white-nights",
        owner_user_id="user-non-existent-stranger",
        is_public=False,
        limit=10,
    )
    assert len(private_results) == 0


def test_qdrant_graceful_downtime_fallback():
    """
    Verifies that if Qdrant Cloud is unreachable or disabled,
    retrieval does not crash the system.
    """
    # Create an unconfigured Qdrant repo
    unconfigured_repo = QdrantRepository(None)
    assert unconfigured_repo.is_configured is False
    assert unconfigured_repo.check_health() is False

    results = unconfigured_repo.search([0.1] * 1536, book_id="any-book")
    assert results == []

    count = unconfigured_repo.count()
    assert count == 0
