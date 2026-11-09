from __future__ import annotations

from abc import ABC, abstractmethod


class STTProvider(ABC):
    """Provider-independent Speech-to-Text interface."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def transcribe(
        self,
        audio_bytes: bytes,
        *,
        filename: str = "audio.wav",
        language: str | None = None,
    ) -> str:
        """Transcribes raw audio bytes to text."""
        raise NotImplementedError


class TTSProvider(ABC):
    """Provider-independent Text-to-Speech interface."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def synthesize(
        self,
        text: str,
        *,
        voice_id: str = "nova",
        speed: float = 1.0,
        language: str = "en",
    ) -> tuple[bytes, str, float]:
        """
        Synthesizes text to audio bytes.
        Returns: (audio_bytes, mime_type, estimated_duration_seconds)
        """
        raise NotImplementedError
