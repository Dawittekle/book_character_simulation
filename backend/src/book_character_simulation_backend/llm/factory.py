from __future__ import annotations

from ..config import Settings
from ..errors import ConfigurationError
from .base import LLMProvider
from .gemini_provider import GeminiProvider
from .openai_provider import OpenAIProvider


class LLMProviderFactory:
    def __init__(self, settings: Settings):
        self.settings = settings

    def get_provider(self, provider_name: str | None = None) -> LLMProvider:
        selected_provider = (provider_name or self.settings.llm_provider).strip().lower()

        if selected_provider == "openai":
            if not self.settings.openai_api_key:
                raise ConfigurationError(
                    "OPENAI_API_KEY is required when using the OpenAI provider."
                )
            return OpenAIProvider(
                api_key=self.settings.openai_api_key,
                model=self.settings.openai_model,
                temperature=self.settings.llm_temperature,
            )

        if selected_provider == "gemini":
            if not self.settings.gemini_api_key:
                raise ConfigurationError(
                    "GEMINI_API_KEY is required when using the Gemini provider."
                )
            return GeminiProvider(
                api_key=self.settings.gemini_api_key,
                model=self.settings.gemini_model,
                temperature=self.settings.llm_temperature,
            )

        raise ConfigurationError("Unsupported LLM provider. Use 'openai' or 'gemini'.")
