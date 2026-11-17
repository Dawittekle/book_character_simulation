from __future__ import annotations

import logging
import time
import uuid
import warnings
from dataclasses import dataclass
from typing import Any

from qdrant_client import QdrantClient, models
from qdrant_client.http.exceptions import UnexpectedResponse

from ..config import Settings

logger = logging.getLogger(__name__)


def _normalize_point_id(raw_id: str) -> str:
    """Ensures the point ID is a valid RFC 4122 UUID string required by Qdrant."""
    try:
        return str(uuid.UUID(str(raw_id)))
    except (ValueError, AttributeError):
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, str(raw_id)))


@dataclass(slots=True)
class QdrantChunkRecord:
    chunk_id: str
    book_id: str
    chapter_order: int
    chapter_title: str
    chunk_index: int
    content: str
    embedding: list[float]
    language: str = "en"
    visibility: str = "private"
    owner_user_id: str | None = None
    content_hash: str | None = None
    char_start: int | None = None
    char_end: int | None = None
    word_count: int | None = None


@dataclass(slots=True)
class ScoredChunk:
    id: str
    score: float
    book_id: str
    chapter_order: int
    chapter_title: str
    chunk_index: int
    content: str
    language: str
    payload: dict[str, Any]


class QdrantRepository:
    """
    Authoritative repository managing book chunk vectors, payload indexing,
    and filtered semantic searches in Qdrant Cloud.
    """

    def __init__(
        self,
        settings: Settings | None = None,
        *,
        client: QdrantClient | None = None,
        vector_size: int = 1536,
    ) -> None:
        self.settings = settings
        self.vector_size = vector_size
        self.collection_name = (
            getattr(settings, "qdrant_collection", "lorely_book_chunks")
            if settings
            else "lorely_book_chunks"
        )
        self.timeout = getattr(settings, "qdrant_timeout", 10) if settings else 10

        if client is not None:
            self.client: QdrantClient | None = client
        elif settings and settings.qdrant_url:
            self.client = QdrantClient(
                url=settings.qdrant_url,
                api_key=settings.qdrant_api_key,
                timeout=self.timeout,
                check_compatibility=False,
            )
        else:
            self.client = None

    @property
    def is_configured(self) -> bool:
        return self.client is not None

    def check_health(self) -> bool:
        """Verifies cluster connectivity and responsiveness."""
        if not self.is_configured:
            return False
        try:
            assert self.client is not None
            self.client.get_collections()
            return True
        except Exception as exc:
            logger.warning("Qdrant health check failed: %s", exc)
            return False

    def ensure_collection_and_indexes(self) -> None:
        """
        Idempotently initializes the Qdrant collection with 1536-dim Cosine vectors
        and sets up payload schema indexes for fast filtered lookups.
        """
        if not self.is_configured:
            logger.info("Qdrant is not configured; skipping collection initialization.")
            return

        assert self.client is not None
        try:
            if not self.client.collection_exists(self.collection_name):
                logger.info(
                    "Creating Qdrant collection '%s' (vector_size=%s, distance=COSINE)...",
                    self.collection_name,
                    self.vector_size,
                )
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=models.VectorParams(
                        size=self.vector_size,
                        distance=models.Distance.COSINE,
                    ),
                )

            # Create payload indexes idempotently
            indexes_to_create = [
                ("book_id", models.PayloadSchemaType.KEYWORD),
                ("owner_user_id", models.PayloadSchemaType.KEYWORD),
                ("chapter_order", models.PayloadSchemaType.INTEGER),
                ("language", models.PayloadSchemaType.KEYWORD),
                ("visibility", models.PayloadSchemaType.KEYWORD),
            ]

            with warnings.catch_warnings():
                warnings.filterwarnings("ignore", message=".*Payload indexes have no effect in the local Qdrant.*")
                for field_name, schema_type in indexes_to_create:
                    try:
                        self.client.create_payload_index(
                            collection_name=self.collection_name,
                            field_name=field_name,
                            field_schema=schema_type,
                        )
                    except (UnexpectedResponse, Exception) as exc:
                        # Index already exists or local in-memory mock notice
                        logger.debug("Notice creating payload index for %s: %s", field_name, exc)

            logger.info("Qdrant collection '%s' and indexes verified.", self.collection_name)
        except Exception as exc:
            logger.error("Failed to ensure Qdrant collection '%s': %s", self.collection_name, exc)
            raise

    def upsert_chunks(
        self,
        chunks: list[QdrantChunkRecord],
        *,
        batch_size: int = 50,
    ) -> int:
        """
        Upserts chunk vectors and metadata into Qdrant Cloud in idempotent batches.
        """
        if not self.is_configured:
            logger.warning("Cannot upsert chunks: Qdrant is not configured.")
            return 0
        if not chunks:
            return 0

        assert self.client is not None
        points: list[models.PointStruct] = []
        for c in chunks:
            pid = _normalize_point_id(c.chunk_id)
            payload = {
                "chunk_id": c.chunk_id,
                "book_id": c.book_id,
                "chapter_order": c.chapter_order,
                "chapter_title": c.chapter_title,
                "chunk_index": c.chunk_index,
                "content": c.content,
                "language": c.language,
                "visibility": c.visibility,
                "owner_user_id": c.owner_user_id,
                "content_hash": c.content_hash,
                "char_start": c.char_start,
                "char_end": c.char_end,
                "word_count": c.word_count,
            }
            points.append(
                models.PointStruct(
                    id=pid,
                    vector=c.embedding,
                    payload=payload,
                )
            )

        total_upserted = 0
        start_time = time.perf_counter()
        for i in range(0, len(points), batch_size):
            batch = points[i : i + batch_size]
            last_err = None
            for attempt in range(1, 4):
                try:
                    self.client.upsert(
                        collection_name=self.collection_name,
                        points=batch,
                        wait=True,
                    )
                    last_err = None
                    break
                except Exception as exc:
                    last_err = exc
                    logger.warning(
                        "Attempt %d/3 failed upserting batch of %d points to Qdrant: %s",
                        attempt,
                        len(batch),
                        exc,
                    )
                    if attempt < 3:
                        time.sleep(0.5 * attempt)

            if last_err is not None:
                logger.error("Failed to upsert batch to Qdrant after 3 attempts: %s", last_err)
                raise last_err
            total_upserted += len(batch)

        elapsed_ms = (time.perf_counter() - start_time) * 1000
        logger.info(
            "Successfully upserted %d points into Qdrant '%s' in %.2fms.",
            total_upserted,
            self.collection_name,
            elapsed_ms,
        )
        return total_upserted

    def search(
        self,
        query_vector: list[float],
        *,
        book_id: str,
        max_allowed_chapter: int | None = None,
        owner_user_id: str | None = None,
        is_public: bool = True,
        limit: int = 5,
    ) -> list[ScoredChunk]:
        """
        Executes an exact vector similarity search constrained by tenant isolation
        and spoiler protection (chapter_order <= max_allowed_chapter).
        """
        if not self.is_configured:
            logger.warning("Cannot perform vector search: Qdrant is not configured.")
            return []

        assert self.client is not None
        must_conditions: list[models.FieldCondition] = [
            models.FieldCondition(
                key="book_id",
                match=models.MatchValue(value=book_id),
            )
        ]

        # Enforce spoiler boundary strictly inside Qdrant
        if max_allowed_chapter is not None:
            must_conditions.append(
                models.FieldCondition(
                    key="chapter_order",
                    range=models.Range(lte=max_allowed_chapter),
                )
            )

        # Enforce multi-tenant user isolation for private catalog items
        if not is_public and owner_user_id is not None:
            must_conditions.append(
                models.FieldCondition(
                    key="owner_user_id",
                    match=models.MatchValue(value=owner_user_id),
                )
            )

        query_filter = models.Filter(must=must_conditions)

        start_time = time.perf_counter()
        last_err = None
        for attempt in range(1, 3):
            try:
                response = self.client.query_points(
                    collection_name=self.collection_name,
                    query=query_vector,
                    query_filter=query_filter,
                    limit=limit,
                    with_payload=True,
                )

                scored_chunks: list[ScoredChunk] = []
                for point in response.points:
                    payload = point.payload or {}
                    scored_chunks.append(
                        ScoredChunk(
                            id=str(point.id),
                            score=float(point.score or 0.0),
                            book_id=str(payload.get("book_id", book_id)),
                            chapter_order=int(payload.get("chapter_order", 0)),
                            chapter_title=str(payload.get("chapter_title", "")),
                            chunk_index=int(payload.get("chunk_index", 0)),
                            content=str(payload.get("content", "")),
                            language=str(payload.get("language", "en")),
                            payload=payload,
                        )
                    )
                elapsed_ms = (time.perf_counter() - start_time) * 1000
                logger.info(
                    "Qdrant query_points for book_id=%s matched %d points in %.2fms.",
                    book_id,
                    len(scored_chunks),
                    elapsed_ms,
                )
                return scored_chunks
            except Exception as exc:
                last_err = exc
                logger.warning("Attempt %d/2 failed querying Qdrant: %s", attempt, exc)
                if attempt < 2:
                    time.sleep(0.3)

        logger.error("Error executing Qdrant query_points after retries: %s", last_err)
        return []

    def count(self, book_id: str | None = None) -> int:
        """Returns point count in the collection, optionally filtered by book_id."""
        if not self.is_configured:
            return 0
        assert self.client is not None
        count_filter = None
        if book_id is not None:
            count_filter = models.Filter(
                must=[
                    models.FieldCondition(
                        key="book_id",
                        match=models.MatchValue(value=book_id),
                    )
                ]
            )
        res = self.client.count(collection_name=self.collection_name, count_filter=count_filter)
        return int(res.count)

    def delete_by_book_id(self, book_id: str) -> None:
        """Removes all indexed chunks associated with a specific book."""
        if not self.is_configured:
            return
        assert self.client is not None
        filter_selector = models.FilterSelector(
            filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="book_id",
                        match=models.MatchValue(value=book_id),
                    )
                ]
            )
        )
        self.client.delete(
            collection_name=self.collection_name,
            points_selector=filter_selector,
            wait=True,
        )
        logger.info("Deleted points for book_id=%s from Qdrant.", book_id)
