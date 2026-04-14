from __future__ import annotations

from openai import APIStatusError, OpenAI, RateLimitError

from ..errors import UpstreamRateLimitError, UpstreamServiceError
from .base import LLMProvider


class OpenAIProvider(LLMProvider):
    def __init__(self, *, api_key: str, model: str, temperature: float):
        self.client = OpenAI(api_key=api_key)
        self.model = model
        self.temperature = temperature

    def generate_json(self, *, system_prompt: str, user_prompt: str) -> str:
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                temperature=self.temperature,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
            content = response.choices[0].message.content
            return content or "{}"
        except RateLimitError as exc:
            raise UpstreamRateLimitError(
                "OpenAI rate limit reached. Check usage limits or billing."
            ) from exc
        except APIStatusError as exc:
            raise UpstreamServiceError(
                f"OpenAI request failed with status {exc.status_code}."
            ) from exc
