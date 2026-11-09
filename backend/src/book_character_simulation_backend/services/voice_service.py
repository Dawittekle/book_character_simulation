from __future__ import annotations

import logging
from ..config import Settings
from ..voice.base import STTProvider, TTSProvider
from ..voice.providers import (
    LocalHarmonicTTSProvider,
    LocalMockSTTProvider,
    OpenAISTTProvider,
    OpenAITTSProvider,
)

logger = logging.getLogger(__name__)


class VoiceService:
    """
    Provider-independent Voice Service orchestrating STT transcription,
    TTS synthesis, and cost estimation.
    """

    def __init__(
        self,
        settings: Settings,
        stt_provider: STTProvider | None = None,
        tts_provider: TTSProvider | None = None,
    ):
        self.settings = settings
        local_tts = LocalHarmonicTTSProvider()
        local_stt = LocalMockSTTProvider()

        self.stt_provider = stt_provider or OpenAISTTProvider(settings, fallback=local_stt)
        self.tts_provider = tts_provider or OpenAITTSProvider(settings, fallback=local_tts)

    def synthesize_speech(
        self,
        text: str,
        *,
        voice: str = "nova",
        speed: float = 1.0,
        language: str = "en",
    ) -> tuple[bytes, str, float]:
        """
        Synthesizes speech audio for the given text.
        Returns: (audio_bytes, mime_type, estimated_duration_seconds)
        """
        return self.tts_provider.synthesize(text, voice_id=voice, speed=speed, language=language)

    def transcribe_audio(
        self,
        audio_bytes: bytes,
        *,
        filename: str = "audio.wav",
        language: str | None = None,
    ) -> str:
        """Transcribes speech audio (STT)."""
        return self.stt_provider.transcribe(audio_bytes, filename=filename, language=language)

    def estimate_cost(self, *, stt_seconds: float = 0.0, tts_chars: int = 0) -> float:
        """
        Estimates total turn cost in USD based on standard API rates.
        Whisper: $0.006 / minute ($0.0001 / second)
        TTS: $0.015 / 1,000 characters
        """
        stt_cost = (stt_seconds / 60.0) * 0.006
        tts_cost = (tts_chars / 1000.0) * 0.015
        return round(stt_cost + tts_cost, 6)

    def _generate_harmonic_wav(
        self,
        text: str,
        base_freq: float = 220.0,
        duration: float = 2.0,
        sample_rate: int = 16000,
    ) -> bytes:
        """Compatibility wrapper for direct harmonic wav generation in integration tests."""
        if isinstance(self.tts_provider, LocalHarmonicTTSProvider):
            return self.tts_provider._generate_harmonic_wav(text, base_freq=base_freq, duration=duration, sample_rate=sample_rate)
        if hasattr(self.tts_provider, "fallback") and isinstance(self.tts_provider.fallback, LocalHarmonicTTSProvider):
            return self.tts_provider.fallback._generate_harmonic_wav(text, base_freq=base_freq, duration=duration, sample_rate=sample_rate)
        return LocalHarmonicTTSProvider()._generate_harmonic_wav(text, base_freq=base_freq, duration=duration, sample_rate=sample_rate)
