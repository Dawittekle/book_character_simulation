from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db.models import BookChunk
from ..repositories.qdrant import QdrantRepository
from .embedding_provider import EmbeddingService, cosine_similarity

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class RetrievedPassage:
    chunk_id: str
    chapter_order: int
    chapter_title: str
    content: str
    similarity: float
    lexical_score: float = 0.0
    rrf_score: float = 0.0


AMHARIC_LITERARY_DICTIONARY: dict[str, list[str]] = {
    "ናስቴንካ": ["nastenka", "nástyenka"],
    "ህልመኛው": ["dreamer", "the dreamer"],
    "ነጭ ሌሊቶች": ["white nights"],
    "ሴንት ፒተርስበርግ": ["st. petersburg", "petersburg"],
    "ራስኮልኒኮቭ": ["raskolnikov", "rodion"],
    "ወንጀልና ቅጣት": ["crime and punishment"],
    "ኤሜልያን": ["emelyan", "ilyitch"],
    "አስታፊ": ["astafy", "ivanovich"],
    "ታማኝ ሌባ": ["honest thief"],
    "ሱሪ": ["riding breeches", "breeches"],
    "ቀሚስ": ["dress", "skirt"],
    "ድልድይ": ["bridge"],
    "ቦይ": ["canal"],
    "ደብዳቤ": ["letter"],
    "ጉዞ": ["journey", "train"],
    "ቁልፍ": ["key"],
    "ምስጢር": ["secret", "vault"],
}


def expand_query_cross_lingual(query: str) -> list[str]:
    expanded: list[str] = []
    for amh_key, eng_terms in AMHARIC_LITERARY_DICTIONARY.items():
        if amh_key in query:
            expanded.extend(eng_terms)
    return expanded


def compute_lexical_score(text: str, query: str) -> float:
    """
    Computes a fast, robust lexical relevance score using token coverage,
    frequency weighting, and exact phrase matching with bilingual Amharic-English support.
    """
    text_lower = text.lower()
    query_lower = query.lower().strip()

    if not text_lower or not query_lower:
        return 0.0

    score = 0.0
    # Exact full-phrase match bonus
    if query_lower in text_lower:
        score += 3.0

    tokens = [t for t in re.findall(r"\w+", query_lower) if len(t) >= 2]

    # Cross-lingual expansion for Amharic literary terms against English source chunks
    cross_expansions = expand_query_cross_lingual(query)
    for phrase in cross_expansions:
        if phrase in text_lower:
            score += 2.5
        for t in phrase.split():
            clean_t = t.lower()
            if clean_t not in tokens and len(clean_t) >= 2:
                tokens.append(clean_t)

    if not tokens:
        return score

    matched_tokens = 0
    for token in tokens:
        count = text_lower.count(token)
        if count > 0:
            matched_tokens += 1
            score += min(count * 0.25, 1.25)

    coverage = matched_tokens / len(tokens)
    score += coverage * 2.0
    return round(score, 4)


class SpoilerAwareRetriever:
    def __init__(
        self,
        embedding_service: EmbeddingService,
        qdrant_repo: QdrantRepository | None = None,
    ):
        self.embedding_service = embedding_service
        self.qdrant_repo = qdrant_repo

    def retrieve(
        self,
        session: Session,
        *,
        book_id: str,
        query: str,
        spoiler_policy: str = "cautious",
        max_allowed_chapter: int | None = None,
        top_k: int = 3,
        owner_user_id: str | None = None,
        is_public: bool = True,
    ) -> list[RetrievedPassage]:
        start_time = time.perf_counter()
        # Enforce spoiler boundary strictly BEFORE retrieval & ranking
        effective_chapter_limit = (
            max_allowed_chapter
            if spoiler_policy in ("cautious", "no_spoilers") and max_allowed_chapter is not None
            else None
        )

        query_embedding = self.embedding_service.embed_text(query)

        # 1. Primary Vector Search via Qdrant Cloud (if configured)
        if self.qdrant_repo is not None and self.qdrant_repo.is_configured:
            scored_chunks = self.qdrant_repo.search(
                query_vector=query_embedding,
                book_id=book_id,
                max_allowed_chapter=effective_chapter_limit,
                owner_user_id=owner_user_id,
                is_public=is_public,
                limit=max(top_k * 4, 15),
            )

            if scored_chunks:
                # Vector rankings from Qdrant
                vector_rank_map = {
                    chunk.payload.get("chunk_id", chunk.id): idx + 1
                    for idx, chunk in enumerate(scored_chunks)
                }

                # Lexical scoring on retrieved candidate pool
                lexical_scored = [
                    (chunk, compute_lexical_score(chunk.content, query))
                    for chunk in scored_chunks
                ]
                lexical_scored.sort(key=lambda x: x[1], reverse=True)
                lexical_rank_map = {
                    chunk.payload.get("chunk_id", chunk.id): idx + 1
                    for idx, (chunk, _) in enumerate(lexical_scored)
                }
                lexical_score_map = {
                    chunk.payload.get("chunk_id", chunk.id): score
                    for chunk, score in lexical_scored
                }

                # Reciprocal Rank Fusion (RRF) with k=60
                k_rrf = 60.0
                candidates: list[RetrievedPassage] = []
                for chunk in scored_chunks:
                    cid = chunk.payload.get("chunk_id", chunk.id)
                    v_rank = vector_rank_map.get(cid, 9999)
                    l_rank = lexical_rank_map.get(cid, 9999)
                    rrf = (1.0 / (k_rrf + v_rank)) + (1.0 / (k_rrf + l_rank))

                    candidates.append(
                        RetrievedPassage(
                            chunk_id=cid,
                            chapter_order=chunk.chapter_order,
                            chapter_title=chunk.chapter_title or f"Chapter {chunk.chapter_order}",
                            content=chunk.content,
                            similarity=chunk.score,
                            lexical_score=lexical_score_map.get(cid, 0.0),
                            rrf_score=round(rrf, 6),
                        )
                    )

                candidates.sort(key=lambda x: (x.rrf_score, x.lexical_score, x.similarity), reverse=True)
                top_results = candidates[:top_k]
                elapsed_ms = (time.perf_counter() - start_time) * 1000
                logger.info(
                    "SpoilerAwareRetriever [Qdrant]: book_id=%s, top_k=%d, elapsed=%.2fms",
                    book_id,
                    len(top_results),
                    elapsed_ms,
                )
                return top_results

            # If Qdrant is configured and this book has points in Qdrant, but scored_chunks is empty:
            # this means the query / spoiler filter legitimately excluded all chunks.
            if self.qdrant_repo.count(book_id=book_id) > 0:
                return []

            # Otherwise, book has 0 points in Qdrant (pending backfill or testing fixture)
            logger.warning(
                "Book '%s' has 0 points in Qdrant; falling back to relational database chunks for retrieval.",
                book_id,
            )

        # 2. Relational Database Scan Fallback (for unconfigured Qdrant or testing fixtures)
        stmt = select(BookChunk).where(BookChunk.book_id == book_id)
        if effective_chapter_limit is not None:
            stmt = stmt.where(BookChunk.chapter_order <= effective_chapter_limit)

        chunks = session.scalars(stmt).all()
        if not chunks:
            return []

        # Vector scoring via in-memory cosine similarity
        vector_scored_sql: list[tuple[BookChunk, float]] = []
        for chunk in chunks:
            sim = float(cosine_similarity(query_embedding, chunk.embedding)) if chunk.embedding else 0.0
            vector_scored_sql.append((chunk, sim))

        vector_scored_sql.sort(key=lambda x: x[1], reverse=True)
        vector_rank_map = {chunk.id: idx + 1 for idx, (chunk, _) in enumerate(vector_scored_sql)}

        # Lexical scoring
        lexical_scored_sql: list[tuple[BookChunk, float]] = []
        for chunk in chunks:
            lex_score = compute_lexical_score(chunk.content, query)
            lexical_scored_sql.append((chunk, lex_score))

        lexical_scored_sql.sort(key=lambda x: x[1], reverse=True)
        lexical_rank_map = {chunk.id: idx + 1 for idx, (chunk, _) in enumerate(lexical_scored_sql)}
        lexical_score_map = {chunk.id: score for chunk, score in lexical_scored_sql}
        vector_score_map = {chunk.id: sim for chunk, sim in vector_scored_sql}

        k_rrf = 60.0
        fallback_candidates: list[RetrievedPassage] = []
        for chunk in chunks:
            v_rank = vector_rank_map.get(chunk.id, 9999)
            l_rank = lexical_rank_map.get(chunk.id, 9999)
            rrf = (1.0 / (k_rrf + v_rank)) + (1.0 / (k_rrf + l_rank))

            fallback_candidates.append(
                RetrievedPassage(
                    chunk_id=chunk.id,
                    chapter_order=chunk.chapter_order,
                    chapter_title=chunk.chapter_title or f"Chapter {chunk.chapter_order}",
                    content=chunk.content,
                    similarity=vector_score_map.get(chunk.id, 0.0),
                    lexical_score=lexical_score_map.get(chunk.id, 0.0),
                    rrf_score=round(rrf, 6),
                )
            )

        fallback_candidates.sort(key=lambda x: (x.rrf_score, x.lexical_score, x.similarity), reverse=True)
        top_fallback = fallback_candidates[:top_k]
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        logger.info(
            "SpoilerAwareRetriever [Relational Fallback]: book_id=%s, top_k=%d, elapsed=%.2fms",
            book_id,
            len(top_fallback),
            elapsed_ms,
        )
        return top_fallback
