from __future__ import annotations

import re
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

        # Enforce spoiler boundary strictly BEFORE retrieval & ranking
        if spoiler_policy in ("cautious", "no_spoilers") and max_allowed_chapter is not None:
            stmt = stmt.where(BookChunk.chapter_order <= max_allowed_chapter)

        chunks = session.scalars(stmt).all()
        if not chunks:
            return []

        query_embedding = self.embedding_service.embed_text(query)

        # 1. Vector scoring
        vector_scored: list[tuple[BookChunk, float]] = []
        for chunk in chunks:
            if not chunk.embedding:
                sim = 0.0
            else:
                sim = float(cosine_similarity(query_embedding, chunk.embedding))
            vector_scored.append((chunk, sim))

        # Sort vector rankings (rank starts at 1)
        vector_scored.sort(key=lambda x: x[1], reverse=True)
        vector_rank_map = {chunk.id: idx + 1 for idx, (chunk, _) in enumerate(vector_scored)}

        # 2. Lexical scoring
        lexical_scored: list[tuple[BookChunk, float]] = []
        for chunk in chunks:
            lex_score = compute_lexical_score(chunk.content, query)
            lexical_scored.append((chunk, lex_score))

        # Sort lexical rankings
        lexical_scored.sort(key=lambda x: x[1], reverse=True)
        lexical_rank_map = {chunk.id: idx + 1 for idx, (chunk, _) in enumerate(lexical_scored)}
        lexical_score_map = {chunk.id: score for chunk, score in lexical_scored}
        vector_score_map = {chunk.id: sim for chunk, sim in vector_scored}

        # 3. Reciprocal Rank Fusion (RRF)
        # RRF(d) = 1 / (k + rank_vector) + 1 / (k + rank_lexical), where k=60
        k_rrf = 60.0
        candidates: list[RetrievedPassage] = []
        for chunk in chunks:
            v_rank = vector_rank_map.get(chunk.id, 9999)
            l_rank = lexical_rank_map.get(chunk.id, 9999)
            rrf = (1.0 / (k_rrf + v_rank)) + (1.0 / (k_rrf + l_rank))

            candidates.append(
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

        # Sort by RRF rank with lexical and vector tie-breakers
        candidates.sort(key=lambda x: (x.rrf_score, x.lexical_score, x.similarity), reverse=True)
        return candidates[:top_k]
