from __future__ import annotations

from google import genai
from google.genai import errors as genai_errors

from ..errors import UpstreamRateLimitError, UpstreamServiceError
from .base import LLMProvider


class GeminiProvider(LLMProvider):
    def __init__(self, *, api_key: str, model: str, temperature: float):
        self.client = genai.Client(api_key=api_key)
        self.model = model
        self.temperature = temperature

    def generate_json(self, *, system_prompt: str, user_prompt: str) -> str:
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=f"{system_prompt}\n\n{user_prompt}",
                config={
                    "temperature": self.temperature,
                    "response_mime_type": "application/json",
                },
            )
            return getattr(response, "text", "") or "{}"
        except genai_errors.ClientError as exc:
            status_code = getattr(exc, "status_code", None)
            message = getattr(exc, "message", "") or str(exc)
            error_text = f"{message} {exc}".lower()
            if (
                status_code == 429
                or "429" in error_text
                or "resource_exhausted" in error_text
                or "quota" in error_text
            ):
                raise UpstreamRateLimitError(
                    "Gemini quota or rate limit reached. Check your plan, billing, or free-tier quota."
                ) from exc
            raise UpstreamServiceError(
                f"Gemini request failed with status {status_code or 'unknown'}."
            ) from exc
