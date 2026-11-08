from __future__ import annotations

import io
import logging
import math
import struct
import wave

from ..config import Settings

logger = logging.getLogger(__name__)


class VoiceService:
    def __init__(self, settings: Settings):
        self.settings = settings

    def synthesize_speech(
        self,
        text: str,
        *,
        voice: str = "nova",
        speed: float = 1.0,
    ) -> tuple[bytes, str, float]:
        """
        Synthesizes speech audio for the given text.
        Returns: (audio_bytes, mime_type, estimated_duration_seconds)
        """
        clean_text = text.strip()
        if not clean_text:
            clean_text = "..."

        # Calculate estimated duration based on average speech rate (150 words per minute)
        word_count = len(clean_text.split())
        estimated_duration = max(1.2, round((word_count / 150.0) * 60.0 / max(0.5, speed), 1))

        # Try OpenAI TTS if configured
        if self.settings.openai_api_key:
            try:
                from openai import OpenAI

                client = OpenAI(api_key=self.settings.openai_api_key)
                response = client.audio.speech.create(
                    model="tts-1",
                    voice=voice if voice in ("alloy", "echo", "fable", "onyx", "nova", "shimmer") else "nova",
                    input=clean_text[:500],
                    speed=speed,
                )
                audio_bytes = response.content
                return audio_bytes, "audio/mpeg", estimated_duration
            except Exception as exc:
                logger.warning("OpenAI TTS failed or was rate limited, falling back to harmonic audio synthesis: %s", exc)

        # Fallback / Local / Test Mode: Generate standard PCM WAV audio container
        wav_bytes = self._generate_harmonic_wav(clean_text, duration=min(estimated_duration, 4.0))
        return wav_bytes, "audio/wav", estimated_duration

    def _generate_harmonic_wav(self, text: str, duration: float = 2.0, sample_rate: int = 16000) -> bytes:
        """
        Generates a valid 16-bit mono WAV container with pleasant warm harmonic tones.
        """
        buffer = io.BytesIO()
        total_frames = int(duration * sample_rate)

        # Seed base frequency based on text characters
        base_freq = 220.0 + (hash(text) % 40)

        with wave.open(buffer, "wb") as wav_file:
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(sample_rate)

            frames = bytearray()
            for i in range(total_frames):
                t = float(i) / sample_rate
                # Smooth envelope
                fade_in = min(1.0, t * 10.0)
                fade_out = min(1.0, (duration - t) * 5.0)
                envelope = fade_in * fade_out * 0.25

                # Dual harmonics (base + octave)
                sample = math.sin(2.0 * math.pi * base_freq * t) + 0.5 * math.sin(2.0 * math.pi * base_freq * 2.0 * t)
                int_val = int(sample * envelope * 32767.0)
                clamped = max(-32768, min(32767, int_val))
                frames.extend(struct.pack("<h", clamped))

            wav_file.writeframes(frames)

        return buffer.getvalue()

    def transcribe_audio(self, audio_bytes: bytes, filename: str = "audio.wav") -> str:
        """
        Transcribes speech audio (STT).
        If OpenAI API key is present, calls Whisper. Otherwise provides mock transcription for testing.
        """
        if self.settings.openai_api_key:
            try:
                from openai import OpenAI

                client = OpenAI(api_key=self.settings.openai_api_key)
                file_obj = io.BytesIO(audio_bytes)
                file_obj.name = filename
                transcription = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=file_obj,
                )
                return transcription.text.strip()
            except Exception as exc:
                logger.warning("Whisper STT failed, falling back: %s", exc)

        return "Tell me about your adventures."
