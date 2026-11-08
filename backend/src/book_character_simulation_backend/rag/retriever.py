from __future__ import annotations

from dataclasses import dataclass
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db.models import BookChunk
from .embedding_provider import EmbeddingService, cosine_similarity


@dataclass(slots=True)
class RetrievedPassage:
    chunk_id: str
    chapter_order: int
    chapter_title: str
    content: str
    similarity: float


class SpoilerAwareRetriever:
    def __init__(self, embedding_service: EmbeddingService):
        self.embedding_service = embedding_service

    def retrieve(
        self,
        session: Session,
        *,
        book_id: str,
        query: str,
        spoiler_policy: str = "cautious",
        max_allowed_chapter: int | None = None,
        top_k: int = 3,
    ) -> list[RetrievedPassage]:
        stmt = select(BookChunk).where(BookChunk.book_id == book_id)

        # Enforce spoiler boundary strictly
        if spoiler_policy in ("cautious", "no_spoilers") and max_allowed_chapter is not None:
            stmt = stmt.where(BookChunk.chapter_order <= max_allowed_chapter)

        chunks = session.scalars(stmt).all()
        if not chunks:
            return []

        query_embedding = self.embedding_service.embed_text(query)

        scored: list[RetrievedPassage] = []
        for chunk in chunks:
            if not chunk.embedding:
                continue
            sim = cosine_similarity(query_embedding, chunk.embedding)
            scored.append(
                RetrievedPassage(
                    chunk_id=chunk.id,
                    chapter_order=chunk.chapter_order,
                    chapter_title=chunk.chapter_title or f"Chapter {chunk.chapter_order}",
                    content=chunk.content,
                    similarity=sim,
                )
            )

        scored.sort(key=lambda x: x.similarity, reverse=True)
        return scored[:top_k]
