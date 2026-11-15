from __future__ import annotations

import pytest
from qdrant_client import QdrantClient

from book_character_simulation_backend.config import Settings
from book_character_simulation_backend.repositories.qdrant import (
    QdrantChunkRecord,
    QdrantRepository,
    _normalize_point_id,
)


def test_normalize_point_id():
    # Valid UUID remains unchanged
    valid_uuid = "8ef714d5-83a1-487d-b97c-98c4455f77a9"
    assert _normalize_point_id(valid_uuid) == valid_uuid

    # Arbitrary slug is deterministically converted to valid UUID format
    slug = "book-white-nights-chunk-0"
    norm1 = _normalize_point_id(slug)
    norm2 = _normalize_point_id(slug)
    assert norm1 == norm2
    assert len(norm1) == 36
    assert "-" in norm1


def test_qdrant_not_configured():
    repo = QdrantRepository(settings=None, client=None)
    assert not repo.is_configured
    assert not repo.check_health()
    assert repo.count() == 0
    assert repo.search([0.1] * 1536, book_id="b1") == []
    assert repo.upsert_chunks([]) == 0
    repo.delete_by_book_id("b1")  # Should not raise


def test_qdrant_in_memory_collection_and_indexes():
    client = QdrantClient(":memory:")
    repo = QdrantRepository(client=client, vector_size=1536)

    assert repo.is_configured
    assert repo.check_health()

    # Idempotent collection creation
    repo.ensure_collection_and_indexes()
    repo.ensure_collection_and_indexes()

    assert client.collection_exists("lorely_book_chunks")
    coll_info = client.get_collection("lorely_book_chunks")
    assert coll_info.config.params.vectors.size == 1536


def test_qdrant_upsert_count_and_delete():
    client = QdrantClient(":memory:")
    repo = QdrantRepository(client=client, vector_size=4)
    repo.ensure_collection_and_indexes()

    chunks = [
        QdrantChunkRecord(
            chunk_id="chunk-1",
            book_id="book-alpha",
            chapter_order=1,
            chapter_title="Chapter 1",
            chunk_index=0,
            content="Alpha content chapter 1",
            embedding=[1.0, 0.0, 0.0, 0.0],
            owner_user_id="user-1",
        ),
        QdrantChunkRecord(
            chunk_id="chunk-2",
            book_id="book-alpha",
            chapter_order=2,
            chapter_title="Chapter 2",
            chunk_index=1,
            content="Alpha content chapter 2",
            embedding=[0.8, 0.2, 0.0, 0.0],
            owner_user_id="user-1",
        ),
        QdrantChunkRecord(
            chunk_id="chunk-3",
            book_id="book-beta",
            chapter_order=1,
            chapter_title="Chapter 1",
            chunk_index=0,
            content="Beta content chapter 1",
            embedding=[0.0, 1.0, 0.0, 0.0],
            owner_user_id="user-2",
        ),
    ]

    upserted = repo.upsert_chunks(chunks)
    assert upserted == 3

    assert repo.count() == 3
    assert repo.count(book_id="book-alpha") == 2
    assert repo.count(book_id="book-beta") == 1

    # Delete book-alpha
    repo.delete_by_book_id("book-alpha")
    assert repo.count(book_id="book-alpha") == 0
    assert repo.count(book_id="book-beta") == 1
    assert repo.count() == 1


def test_qdrant_spoiler_prevention_filter():
    client = QdrantClient(":memory:")
    repo = QdrantRepository(client=client, vector_size=4)
    repo.ensure_collection_and_indexes()

    chunks = [
        QdrantChunkRecord(
            chunk_id=f"c-{order}",
            book_id="book-spoiler-test",
            chapter_order=order,
            chapter_title=f"Night {order}",
            chunk_index=0,
            content=f"Story events in night {order}",
            embedding=[0.5, 0.5, 0.5, 0.5],
        )
        for order in [1, 2, 3, 4, 5]
    ]
    repo.upsert_chunks(chunks)

    # Search with spoiler policy limiting to chapter <= 2
    results = repo.search(
        query_vector=[0.5, 0.5, 0.5, 0.5],
        book_id="book-spoiler-test",
        max_allowed_chapter=2,
        limit=10,
    )

    returned_chapters = [r.chapter_order for r in results]
    assert all(ch <= 2 for ch in returned_chapters)
    assert set(returned_chapters) == {1, 2}
    assert 3 not in returned_chapters
    assert 4 not in returned_chapters
    assert 5 not in returned_chapters


def test_qdrant_user_isolation_filter():
    client = QdrantClient(":memory:")
    repo = QdrantRepository(client=client, vector_size=4)
    repo.ensure_collection_and_indexes()

    chunks = [
        QdrantChunkRecord(
            chunk_id="chunk-u1",
            book_id="book-private",
            chapter_order=1,
            chapter_title="Chapter 1",
            chunk_index=0,
            content="Private diary user 1",
            embedding=[1.0, 0.0, 0.0, 0.0],
            owner_user_id="user-1",
            visibility="private",
        ),
        QdrantChunkRecord(
            chunk_id="chunk-u2",
            book_id="book-private",
            chapter_order=1,
            chapter_title="Chapter 1",
            chunk_index=0,
            content="Private diary user 2",
            embedding=[1.0, 0.0, 0.0, 0.0],
            owner_user_id="user-2",
            visibility="private",
        ),
    ]
    repo.upsert_chunks(chunks)

    # Search isolated to user-1
    results_user1 = repo.search(
        query_vector=[1.0, 0.0, 0.0, 0.0],
        book_id="book-private",
        owner_user_id="user-1",
        is_public=False,
        limit=5,
    )
    assert len(results_user1) == 1
    assert results_user1[0].payload["owner_user_id"] == "user-1"
