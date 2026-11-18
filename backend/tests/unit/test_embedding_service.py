from __future__ import annotations

import math
from unittest.mock import MagicMock, patch

from book_character_simulation_backend.rag.embedding_provider import (
    DEFAULT_EMBEDDING_DIM,
    EmbeddingService,
    cosine_similarity,
    generate_deterministic_embedding,
)


def test_deterministic_embedding_properties():
    # 1. Default dimension is 1536
    v = generate_deterministic_embedding("Lorely book character simulation")
    assert len(v) == DEFAULT_EMBEDDING_DIM

    # 2. Normalized to unit length
    norm = math.sqrt(sum(x * x for x in v))
    assert math.isclose(norm, 1.0, rel_tol=1e-5)

    # 3. Empty or whitespace text returns zero vector
    v_empty = generate_deterministic_embedding("")
    assert len(v_empty) == DEFAULT_EMBEDDING_DIM
    assert all(x == 0.0 for x in v_empty)

    v_ws = generate_deterministic_embedding("   \n\t  ")
    assert all(x == 0.0 for x in v_ws)

    # 4. Custom dimension
    v_custom = generate_deterministic_embedding("Test custom", dim=256)
    assert len(v_custom) == 256


def test_cosine_similarity():
    v1 = [1.0, 0.0, 0.0]
    v2 = [1.0, 0.0, 0.0]
    v3 = [0.0, 1.0, 0.0]
    v_zero = [0.0, 0.0, 0.0]

    # Identical
    assert math.isclose(cosine_similarity(v1, v2), 1.0)
    # Orthogonal
    assert math.isclose(cosine_similarity(v1, v3), 0.0)
    # Zero vector
    assert cosine_similarity(v1, v_zero) == 0.0
    # Length mismatch
    assert cosine_similarity(v1, [1.0, 0.0]) == 0.0


def test_provider_selection_logic():
    # Testing env forces deterministic
    settings = MagicMock()
    settings.app_env = "testing"
    settings.gemini_api_key = "gemini-key"
    settings.openai_api_key = "openai-key"
    svc = EmbeddingService(settings)
    assert svc.provider_name == "deterministic"
    assert svc.model_name == f"deterministic-{DEFAULT_EMBEDDING_DIM}"
    assert svc.dimensions == 1536

    # Production with Gemini
    settings.app_env = "production"
    settings.llm_provider = "gemini"
    settings.gemini_api_key = "test-gemini-key"
    settings.openai_api_key = None
    settings.gemini_embedding_model = "models/gemini-embedding-001"
    svc = EmbeddingService(settings)
    assert svc.provider_name == "gemini"
    assert svc.model_name == "models/gemini-embedding-001"

    # Production with OpenAI
    settings.llm_provider = "openai"
    settings.gemini_api_key = None
    settings.openai_api_key = "test-openai-key"
    settings.openai_embedding_model = "text-embedding-3-small"
    svc = EmbeddingService(settings)
    assert svc.provider_name == "openai"
    assert svc.model_name == "text-embedding-3-small"

    # No keys configured
    settings.gemini_api_key = None
    settings.openai_api_key = None
    svc = EmbeddingService(settings)
    assert svc.provider_name == "deterministic"


def test_embed_texts_batching_and_empty_handling():
    settings = MagicMock()
    settings.app_env = "testing"
    svc = EmbeddingService(settings)

    # Empty list
    assert svc.embed_texts([]) == []

    # Mixed inputs (valid, empty, whitespace, valid)
    texts = [
        "First chapter paragraph.",
        "",
        "   ",
        "Second chapter paragraph.",
    ]
    results = svc.embed_texts(texts)
    assert len(results) == 4
    assert len(results[0]) == 1536
    assert sum(results[0]) != 0.0
    # Empty inputs must be zero vectors
    assert all(x == 0.0 for x in results[1])
    assert all(x == 0.0 for x in results[2])
    assert len(results[3]) == 1536
    assert sum(results[3]) != 0.0


@patch("book_character_simulation_backend.rag.embedding_provider.genai.Client")
def test_gemini_embed_text_mocked(mock_client_cls):
    mock_client = MagicMock()
    mock_client_cls.return_value = mock_client

    mock_embedding = MagicMock()
    mock_embedding.values = [0.1] * 1536
    mock_resp = MagicMock()
    mock_resp.embeddings = [mock_embedding]
    mock_client.models.embed_content.return_value = mock_resp

    settings = MagicMock()
    settings.app_env = "production"
    settings.llm_provider = "gemini"
    settings.gemini_api_key = "real-looking-key"
    settings.gemini_embedding_model = "models/gemini-embedding-001"
    settings.embedding_dimensions = 1536

    svc = EmbeddingService(settings)
    vec = svc.embed_text("Elena discovered the truth.")

    assert len(vec) == 1536
    assert vec[0] == 0.1
    mock_client.models.embed_content.assert_called_once()
    call_kwargs = mock_client.models.embed_content.call_args.kwargs
    assert call_kwargs["model"] == "models/gemini-embedding-001"
    assert call_kwargs["contents"] == "Elena discovered the truth."


@patch("book_character_simulation_backend.rag.embedding_provider.genai.Client")
def test_gemini_graceful_fallback_on_api_error(mock_client_cls):
    mock_client = MagicMock()
    mock_client_cls.return_value = mock_client
    mock_client.models.embed_content.side_effect = RuntimeError("503 Service Unavailable")

    settings = MagicMock()
    settings.app_env = "production"
    settings.llm_provider = "gemini"
    settings.gemini_api_key = "some-key"
    settings.gemini_embedding_model = "models/gemini-embedding-001"
    settings.embedding_dimensions = 1536

    svc = EmbeddingService(settings)
    # Should not raise exception; falls back to deterministic embedding
    vec = svc.embed_text("Important book chunk")
    assert len(vec) == 1536
    norm = math.sqrt(sum(x * x for x in vec))
    assert math.isclose(norm, 1.0, rel_tol=1e-5)
