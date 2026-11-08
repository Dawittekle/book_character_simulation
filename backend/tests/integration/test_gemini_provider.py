from __future__ import annotations

import pytest
from unittest.mock import MagicMock
from google.genai import errors as genai_errors
from book_character_simulation_backend.llm.gemini_provider import GeminiProvider
from book_character_simulation_backend.errors import UpstreamRateLimitError


def test_gemini_provider_success(mocker):
    provider = GeminiProvider(api_key="mock-key", model="gemini-3.5-flash", temperature=0.7)
    
    mock_response = MagicMock()
    mock_response.text = '{"name": "Elena Marlowe"}'
    
    mocker.patch.object(provider.client.models, "generate_content", return_value=mock_response)
    
    res = provider.generate_json(system_prompt="sys", user_prompt="user")
    assert res == '{"name": "Elena Marlowe"}'


def test_gemini_provider_rate_limit(mocker):
    provider = GeminiProvider(api_key="mock-key", model="gemini-3.5-flash", temperature=0.7)
    
    mock_response = MagicMock()
    mock_response.status_code = 429
    exc = genai_errors.ClientError(429, mock_response)
    
    mocker.patch.object(provider.client.models, "generate_content", side_effect=exc)
    
    with pytest.raises(UpstreamRateLimitError):
        provider.generate_json(system_prompt="sys", user_prompt="user")


def test_gemini_provider_retry_on_503(mocker):
    provider = GeminiProvider(api_key="mock-key", model="gemini-3.5-flash", temperature=0.7)
    
    mock_err_resp = MagicMock()
    mock_err_resp.status_code = 503
    exc = genai_errors.ServerError(503, mock_err_resp)
    
    mock_success_resp = MagicMock()
    mock_success_resp.text = '{"status": "ok"}'
    
    # First attempt raises 503, second attempt succeeds
    mock_gen = mocker.patch.object(
        provider.client.models,
        "generate_content",
        side_effect=[exc, mock_success_resp],
    )
    mocker.patch("time.sleep", return_value=None)
    
    res = provider.generate_json(system_prompt="sys", user_prompt="user")
    assert res == '{"status": "ok"}'
    assert mock_gen.call_count == 2
