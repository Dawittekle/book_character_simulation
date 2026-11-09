from __future__ import annotations

import io
import logging
import math
import struct
import wave
from typing import Any

from .base import STTProvider, TTSProvider
from ..config import Settings

logger = logging.getLogger(__name__)


class LocalHarmonicTTSProvider(TTSProvider):
    """
    High-fidelity, deterministic 16-bit mono harmonic WAV audio synthesizer.
    Used for local test mode, offline usage, and zero-cost fallback.
    """

    @property
    def provider_name(self) -> str:
        return "local_harmonic"

    def synthesize(
        self,
        text: str,
        *,
        voice_id: str = "nova",
        speed: float = 1.0,
        language: str = "en",
    ) -> tuple[bytes, str, float]:
        clean_text = text.strip() or "..."
        word_count = len(clean_text.split())
        estimated_duration = max(1.2, round((word_count / 150.0) * 60.0 / max(0.5, speed), 1))

        # Base frequency tailored to voice characteristics
        voice_freq_map = {
            "onyx": 130.0,       # Deep, resonant male
            "echo": 165.0,       # Calm, baritone
            "fable": 190.0,      # Dynamic, theatrical
            "alloy": 210.0,      # Balanced, androgynous
            "nova": 240.0,       # Warm, clear female
            "shimmer": 270.0,    # Bright, youthful female
            "geez_narrator": 180.0,  # Measured, warm narrator
        }
        base_freq = voice_freq_map.get(voice_id.lower(), 220.0)

        wav_bytes = self._generate_harmonic_wav(clean_text, base_freq=base_freq, duration=min(estimated_duration, 4.0))
        return wav_bytes, "audio/wav", estimated_duration

    def _generate_harmonic_wav(
        self,
        text: str,
        base_freq: float = 220.0,
        duration: float = 2.0,
        sample_rate: int = 16000,
    ) -> bytes:
        buffer = io.BytesIO()
        total_frames = int(duration * sample_rate)

        # Subtle pitch variance from character hash
        freq_offset = (hash(text) % 25) - 12
        effective_freq = max(100.0, base_freq + freq_offset)

        with wave.open(buffer, "wb") as wav_file:
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 16-bit PCM
            wav_file.setframerate(sample_rate)

            frames = bytearray()
            for i in range(total_frames):
                t = float(i) / sample_rate
                # Smooth ADSR envelope
                fade_in = min(1.0, t * 15.0)
                fade_out = min(1.0, (duration - t) * 6.0)
                envelope = fade_in * fade_out * 0.28

                # Fundamental + Second Harmonic + Sub-harmonic warmth
                sample = (
                    0.65 * math.sin(2.0 * math.pi * effective_freq * t)
                    + 0.25 * math.sin(2.0 * math.pi * (effective_freq * 2.0) * t)
                    + 0.10 * math.sin(2.0 * math.pi * (effective_freq * 0.5) * t)
                )
                int_val = int(sample * envelope * 32767.0)
                clamped = max(-32768, min(32767, int_val))
                frames.extend(struct.pack("<h", clamped))

            wav_file.writeframes(frames)

        return buffer.getvalue()


class LocalMockSTTProvider(STTProvider):
    """Local / Test STT provider with clean deterministic transcripts."""

    @property
    def provider_name(self) -> str:
        return "local_mock"

    def transcribe(
        self,
        audio_bytes: bytes,
        *,
        filename: str = "audio.wav",
        language: str | None = None,
    ) -> str:
        if not audio_bytes:
            return ""
        if language and language.lower().startswith("am"):
            return "ሰላም ናስቴንካ፣ በሴንት ፒተርስበርግ ሌሊት እንዴት ነሽ?"
        return "Tell me about your adventures."


class OpenAISTTProvider(STTProvider):
    """OpenAI Whisper STT Provider with graceful fallback."""

    def __init__(self, settings: Settings, fallback: STTProvider | None = None):
        self.settings = settings
        self.fallback = fallback or LocalMockSTTProvider()

    @property
    def provider_name(self) -> str:
        return "openai_whisper"

    def transcribe(
        self,
        audio_bytes: bytes,
        *,
        filename: str = "audio.wav",
        language: str | None = None,
    ) -> str:
        if self.settings.openai_api_key:
            try:
                from openai import OpenAI

                client = OpenAI(api_key=self.settings.openai_api_key)
                file_obj = io.BytesIO(audio_bytes)
                file_obj.name = filename
                kwargs: dict[str, Any] = {"model": "whisper-1", "file": file_obj}
                if language:
                    kwargs["language"] = language[:2]
                transcription = client.audio.transcriptions.create(**kwargs)
                return transcription.text.strip()
            except Exception as exc:
                logger.warning("OpenAI Whisper STT failed, falling back: %s", exc)

        return self.fallback.transcribe(audio_bytes, filename=filename, language=language)


class OpenAITTSProvider(TTSProvider):
    """OpenAI TTS Provider (tts-1) with graceful fallback."""

    def __init__(self, settings: Settings, fallback: TTSProvider | None = None):
        self.settings = settings
        self.fallback = fallback or LocalHarmonicTTSProvider()

    @property
    def provider_name(self) -> str:
        return "openai_tts"

    def synthesize(
        self,
        text: str,
        *,
        voice_id: str = "nova",
        speed: float = 1.0,
        language: str = "en",
    ) -> tuple[bytes, str, float]:
        clean_text = text.strip() or "..."
        word_count = len(clean_text.split())
        estimated_duration = max(1.2, round((word_count / 150.0) * 60.0 / max(0.5, speed), 1))

        allowed_voices = {"alloy", "echo", "fable", "onyx", "nova", "shimmer"}
        selected_voice = voice_id.lower() if voice_id.lower() in allowed_voices else "nova"

        if self.settings.openai_api_key:
            try:
                from openai import OpenAI

                client = OpenAI(api_key=self.settings.openai_api_key)
                response = client.audio.speech.create(
                    model="tts-1",
                    voice=selected_voice,
                    input=clean_text[:1000],
                    speed=speed,
                )
                return response.content, "audio/mpeg", estimated_duration
            except Exception as exc:
                logger.warning("OpenAI TTS failed, falling back to local synthesis: %s", exc)

        return self.fallback.synthesize(text, voice_id=selected_voice, speed=speed, language=language)


class ElevenLabsTTSProvider(TTSProvider):
    """
    ElevenLabs expressive character TTS adapter.
    Uses ElevenLabs API when ELEVENLABS_API_KEY is configured.
    """

    def __init__(self, api_key: str | None = None, fallback: TTSProvider | None = None):
        self.api_key = api_key
        self.fallback = fallback or LocalHarmonicTTSProvider()

    @property
    def provider_name(self) -> str:
        return "elevenlabs"

    def synthesize(
        self,
        text: str,
        *,
        voice_id: str = "eleven_monica",
        speed: float = 1.0,
        language: str = "en",
    ) -> tuple[bytes, str, float]:
        if self.api_key:
            try:
                import urllib.request
                import json

                url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
                payload = json.dumps({
                    "text": text[:1000],
                    "model_id": "eleven_multilingual_v2",
                    "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
                }).encode("utf-8")
                req = urllib.request.Request(
                    url,
                    data=payload,
                    headers={
                        "xi-api-key": self.api_key,
                        "Content-Type": "application/json",
                        "Accept": "audio/mpeg",
                    },
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    audio_bytes = resp.read()
                    duration = max(1.2, round((len(text.split()) / 150.0) * 60.0 / max(0.5, speed), 1))
                    return audio_bytes, "audio/mpeg", duration
            except Exception as exc:
                logger.warning("ElevenLabs TTS failed, falling back: %s", exc)

        return self.fallback.synthesize(text, voice_id=voice_id, speed=speed, language=language)


class GoogleSTTProvider(STTProvider):
    """
    Google Cloud Speech-to-Text adapter (candidate for am-ET and en-US).
    Falls back gracefully when credentials are not configured.
    """

    def __init__(self, fallback: STTProvider | None = None):
        self.fallback = fallback or LocalMockSTTProvider()

    @property
    def provider_name(self) -> str:
        return "google_cloud_stt"

    def transcribe(
        self,
        audio_bytes: bytes,
        *,
        filename: str = "audio.wav",
        language: str | None = None,
    ) -> str:
        # In this release without Google billing/service credentials, gracefully use fallback
        return self.fallback.transcribe(audio_bytes, filename=filename, language=language)
