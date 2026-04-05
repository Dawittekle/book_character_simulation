from __future__ import annotations

from google import genai

from .base import LLMProvider


class GeminiProvider(LLMProvider):
    def __init__(self, *, api_key: str, model: str, temperature: float):
        self.client = genai.Client(api_key=api_key)
        self.model = model
        self.temperature = temperature

    def generate_json(self, *, system_prompt: str, user_prompt: str) -> str:
        response = self.client.models.generate_content(
            model=self.model,
            contents=f"{system_prompt}\n\n{user_prompt}",
            config={
                "temperature": self.temperature,
                "response_mime_type": "application/json",
            },
        )
        return getattr(response, "text", "") or "{}"
