from __future__ import annotations

import hashlib
import math
from typing import Any

from google import genai
from openai import OpenAI


def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0

    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))

    if norm1 == 0.0 or norm2 == 0.0:
        return 0.0

    return dot / (norm1 * norm2)


def generate_deterministic_embedding(text: str, dim: int = 128) -> list[float]:
    words = text.lower().split()
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
    def provider_name(self) -> str:
        if self.settings and getattr(self.settings, "gemini_api_key", None) and getattr(self.settings, "app_env", "") != "testing":
            return "gemini"
        if self.settings and getattr(self.settings, "openai_api_key", None) and getattr(self.settings, "app_env", "") != "testing":
            return "openai"
        return "deterministic"

    @property
    def model_name(self) -> str:
        if self.settings and getattr(self.settings, "gemini_api_key", None) and getattr(self.settings, "app_env", "") != "testing":
            return "text-embedding-004"
        if self.settings and getattr(self.settings, "openai_api_key", None) and getattr(self.settings, "app_env", "") != "testing":
            return "text-embedding-3-small"
        return "deterministic-128"

    def embed_text(self, text: str) -> list[float]:
        cleaned = text.strip()
        if not cleaned:
            return [0.0] * 128

        # 1. Try Gemini Embedding if key configured and not in offline testing
        if self.settings and getattr(self.settings, "gemini_api_key", None) and getattr(self.settings, "app_env", "") != "testing":
            try:
                client = genai.Client(api_key=self.settings.gemini_api_key)
                response = client.models.embed_content(
                    model="text-embedding-004",
                    contents=cleaned,
                )
                if hasattr(response, "embedding") and hasattr(response.embedding, "values"):
                    return list(response.embedding.values)
                if hasattr(response, "embeddings") and response.embeddings:
                    return list(response.embeddings[0].values)
            except Exception:
                pass

        # 2. Try OpenAI Embedding if key configured
        if self.settings and getattr(self.settings, "openai_api_key", None) and getattr(self.settings, "app_env", "") != "testing":
            try:
                client = OpenAI(api_key=self.settings.openai_api_key)
                response = client.embeddings.create(
                    model="text-embedding-3-small",
                    input=cleaned,
                )
                if response.data:
                    return list(response.data[0].embedding)
            except Exception:
                pass

        # 3. Deterministic semantic fallback for testing/offline
        return generate_deterministic_embedding(cleaned, dim=128)
