from __future__ import annotations

import logging
import time

from google import genai
from google.genai import errors as genai_errors

from ..errors import UpstreamRateLimitError, UpstreamServiceError
from .base import LLMProvider

logger = logging.getLogger(__name__)

DEFAULT_DOWNGRADE_LADDER = [
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-1.5-flash",
]


class GeminiProvider(LLMProvider):
    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        temperature: float,
        downgrade_models: list[str] | None = None,
    ):
        self.client = genai.Client(api_key=api_key)
        self.model = model
        self.temperature = temperature
        
        candidates = [model]
        fallbacks = downgrade_models if downgrade_models is not None else DEFAULT_DOWNGRADE_LADDER
        for fb in fallbacks:
            if fb not in candidates:
                candidates.append(fb)
        self.candidate_models = candidates

    def generate_json(self, *, system_prompt: str, user_prompt: str) -> str:
        last_rate_limit_exc = None
        last_service_exc = None

        for idx, current_model in enumerate(self.candidate_models):
            max_attempts = 2 if idx > 0 else 3
            for attempt in range(max_attempts):
                try:
                    response = self.client.models.generate_content(
                        model=current_model,
                        contents=f"{system_prompt}\n\n{user_prompt}",
                        config={
                            "temperature": self.temperature,
                            "response_mime_type": "application/json",
                        },
                    )
                    if idx > 0:
                        logger.info(
                            "Successfully fulfilled LLM request using downgraded model %s",
                            current_model,
                        )
                    return getattr(response, "text", "") or "{}"
                except genai_errors.APIError as exc:
                    status_code = getattr(exc, "code", getattr(exc, "status_code", None))
                    message = getattr(exc, "message", "") or str(exc)
                    error_text = f"{message} {exc}".lower()

                    if (
                        status_code == 503
                        or "unavailable" in error_text
                        or "high demand" in error_text
                    ) and attempt < max_attempts - 1:
                        time.sleep(1.0 * (attempt + 1))
                        continue

                    if (
                        status_code == 429
                        or "429" in error_text
                        or "resource_exhausted" in error_text
                        or "quota" in error_text
                    ):
                        last_rate_limit_exc = exc
                        if idx < len(self.candidate_models) - 1:
                            next_model = self.candidate_models[idx + 1]
                            logger.warning(
                                "Gemini model %s rate limited (429/quota). Automatically downgrading to %s...",
                                current_model,
                                next_model,
                            )
                            break
                        else:
                            raise UpstreamRateLimitError(
                                "Gemini quota or rate limit reached across all model tiers. Check your plan, billing, or free-tier quota."
                            ) from exc

                    last_service_exc = exc
                    if idx < len(self.candidate_models) - 1:
                        next_model = self.candidate_models[idx + 1]
                        logger.warning(
                            "Gemini model %s failed with status %s. Trying fallback model %s...",
                            current_model,
                            status_code or "unknown",
                            next_model,
                        )
                        break
                    raise UpstreamServiceError(
                        f"Gemini request failed with status {status_code or 'unknown'}: {message}"
                    ) from exc

        if last_rate_limit_exc:
            raise UpstreamRateLimitError(
                "Gemini quota or rate limit reached across all model tiers."
            ) from last_rate_limit_exc
        if last_service_exc:
            raise UpstreamServiceError(f"Gemini request failed across all models: {last_service_exc}")
        return "{}"

