from __future__ import annotations

import hashlib
import logging
import math
from typing import Any

from google import genai
from google.genai import types
from openai import OpenAI

logger = logging.getLogger(__name__)

DEFAULT_EMBEDDING_DIM = 1536


def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0

    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))

    if norm1 == 0.0 or norm2 == 0.0:
        return 0.0

    return dot / (norm1 * norm2)


def generate_deterministic_embedding(
    text: str, dim: int = DEFAULT_EMBEDDING_DIM
) -> list[float]:
    cleaned = text.strip()
    if not cleaned:
        return [0.0] * dim

    words = cleaned.lower().split()
    vector = [0.0] * dim

    for word in words:
        h = int(hashlib.sha256(word.encode("utf-8")).hexdigest(), 16)
        idx = h % dim
        vector[idx] += 1.0

    norm = math.sqrt(sum(x * x for x in vector))
    if norm > 0.0:
        vector = [x / norm for x in vector]

    return vector


class EmbeddingService:
    def __init__(self, settings: Any):
        self.settings = settings

    @property
    def dimensions(self) -> int:
        if self.settings:
            dim = getattr(self.settings, "embedding_dimensions", None)
            if isinstance(dim, int) and dim > 0:
                return dim
        return DEFAULT_EMBEDDING_DIM

    @property
    def provider_name(self) -> str:
        if not self.settings:
            return "deterministic"

        app_env = getattr(self.settings, "app_env", "")
        if isinstance(app_env, str) and app_env == "testing":
            return "deterministic"

        llm_pref = getattr(self.settings, "llm_provider", "")
        if not isinstance(llm_pref, str):
            llm_pref = ""
        llm_pref = llm_pref.strip().lower()

        gemini_key = getattr(self.settings, "gemini_api_key", None)
        if not isinstance(gemini_key, str) or not gemini_key.strip():
            gemini_key = None

        openai_key = getattr(self.settings, "openai_api_key", None)
        if not isinstance(openai_key, str) or not openai_key.strip():
            openai_key = None

        if llm_pref == "gemini" and gemini_key:
            return "gemini"
        if llm_pref == "openai" and openai_key:
            return "openai"

        # Fallback to whichever key is configured
        if gemini_key:
            return "gemini"
        if openai_key:
            return "openai"

        return "deterministic"

    @property
    def model_name(self) -> str:
        provider = self.provider_name
        if provider == "gemini":
            model = getattr(self.settings, "gemini_embedding_model", None)
            if isinstance(model, str) and model.strip():
                return model.strip()
            return "models/gemini-embedding-001"
        if provider == "openai":
            model = getattr(self.settings, "openai_embedding_model", None)
            if isinstance(model, str) and model.strip():
                return model.strip()
            return "text-embedding-3-small"
        return f"deterministic-{self.dimensions}"

    def embed_text(self, text: str) -> list[float]:
        cleaned = text.strip()
        if not cleaned:
            return [0.0] * self.dimensions

        provider = self.provider_name

        # 1. Gemini Embedding
        if provider == "gemini":
            try:
                client = genai.Client(api_key=self.settings.gemini_api_key)
                response = client.models.embed_content(
                    model=self.model_name,
                    contents=cleaned,
                    config=types.EmbedContentConfig(
                        output_dimensionality=self.dimensions
                    ),
                )
                if hasattr(response, "embeddings") and response.embeddings:
                    return list(response.embeddings[0].values)
                if hasattr(response, "embedding") and hasattr(response.embedding, "values"):
                    return list(response.embedding.values)
            except Exception as err:
                logger.warning(
                    "Gemini embedding failed (%s: %s). Falling back to deterministic embedding.",
                    type(err).__name__,
                    err,
                )

        # 2. OpenAI Embedding
        elif provider == "openai":
            try:
                client = OpenAI(api_key=self.settings.openai_api_key)
                response = client.embeddings.create(
                    model=self.model_name,
                    input=cleaned,
                    dimensions=self.dimensions,
                )
                if response.data:
                    return list(response.data[0].embedding)
            except Exception as err:
                logger.warning(
                    "OpenAI embedding failed (%s: %s). Falling back to deterministic embedding.",
                    type(err).__name__,
                    err,
                )

        # 3. Deterministic semantic fallback
        return generate_deterministic_embedding(cleaned, dim=self.dimensions)

    def embed_texts(self, texts: list[str], batch_size: int = 64) -> list[list[float]]:
        if not texts:
            return []

        results: list[list[float]] = [[0.0] * self.dimensions for _ in texts]
        non_empty_indices: list[int] = []
        non_empty_texts: list[str] = []

        for idx, text in enumerate(texts):
            c = text.strip()
            if c:
                non_empty_indices.append(idx)
                non_empty_texts.append(c)

        if not non_empty_indices:
            return results

        provider = self.provider_name

        if provider == "gemini":
            try:
                client = genai.Client(api_key=self.settings.gemini_api_key)
                all_vectors: list[list[float]] = []
                for i in range(0, len(non_empty_texts), batch_size):
                    batch = non_empty_texts[i : i + batch_size]
                    response = client.models.embed_content(
                        model=self.model_name,
                        contents=batch,
                        config=types.EmbedContentConfig(
                            output_dimensionality=self.dimensions
                        ),
                    )
                    if hasattr(response, "embeddings") and response.embeddings:
                        all_vectors.extend([list(e.values) for e in response.embeddings])
                    else:
                        raise ValueError("Empty embeddings in Gemini batch response")

                if len(all_vectors) == len(non_empty_texts):
                    for orig_idx, vec in zip(non_empty_indices, all_vectors):
                        results[orig_idx] = vec
                    return results
            except Exception as err:
                logger.warning(
                    "Gemini batch embedding failed (%s: %s). Falling back to deterministic.",
                    type(err).__name__,
                    err,
                )

        elif provider == "openai":
            try:
                client = OpenAI(api_key=self.settings.openai_api_key)
                all_vectors = []
                for i in range(0, len(non_empty_texts), batch_size):
                    batch = non_empty_texts[i : i + batch_size]
                    response = client.embeddings.create(
                        model=self.model_name,
                        input=batch,
                        dimensions=self.dimensions,
                    )
                    if response.data:
                        all_vectors.extend([list(item.embedding) for item in response.data])
                    else:
                        raise ValueError("Empty embeddings in OpenAI batch response")

                if len(all_vectors) == len(non_empty_texts):
                    for orig_idx, vec in zip(non_empty_indices, all_vectors):
                        results[orig_idx] = vec
                    return results
            except Exception as err:
                logger.warning(
                    "OpenAI batch embedding failed (%s: %s). Falling back to deterministic.",
                    type(err).__name__,
                    err,
                )

        # Fallback: process non-empty individually
        for orig_idx, text in zip(non_empty_indices, non_empty_texts):
            results[orig_idx] = self.embed_text(text)

        return results
