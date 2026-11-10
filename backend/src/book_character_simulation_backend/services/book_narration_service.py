from __future__ import annotations

import io
import logging
import re
import wave
from typing import Any

from sqlalchemy import select

from ..db import DatabaseManager
from ..db.models import Book, BookChapter, BookNarrationSegment, BookSource, UserAccount, UserRole
from ..errors import ForbiddenError, NotFoundError
from .storage_service import StorageService
from .voice_service import VoiceService

logger = logging.getLogger(__name__)


def split_text_into_sentences(text: str) -> list[str]:
    """Splits plain text into readable, well-bounded sentences for narration."""
    # Split on sentence ending punctuation followed by whitespace and capital letter/quote
    pattern = r'(?<=[.!?])\s+(?=[A-Z0-9"“\'(\[])'
    raw_sentences = [s.strip() for s in re.split(pattern, text) if s.strip()]
    if not raw_sentences and text.strip():
        return [text.strip()]
    return raw_sentences


def combine_wav_segments(wav_bytes_list: list[bytes]) -> bytes:
    """Concatenates multiple mono/stereo WAV byte sequences into a single continuous WAV."""
    if not wav_bytes_list:
        return b""
    if len(wav_bytes_list) == 1:
        return wav_bytes_list[0]

    first_io = io.BytesIO(wav_bytes_list[0])
    with wave.open(first_io, "rb") as first_wav:
        params = first_wav.getparams()
        frames = bytearray(first_wav.readframes(first_wav.getnframes()))

    for w_bytes in wav_bytes_list[1:]:
        try:
            with wave.open(io.BytesIO(w_bytes), "rb") as next_wav:
                frames.extend(next_wav.readframes(next_wav.getnframes()))
        except Exception as e:
            logger.warning("Error reading wave frames for segment concatenation: %s", e)

    out_io = io.BytesIO()
    with wave.open(out_io, "wb") as out_wav:
        out_wav.setparams(params)
        out_wav.writeframes(frames)
    return out_io.getvalue()


class BookNarrationService:
    """
    Synthesizes and caches chapter audio narration and sentence alignment manifests.
    """

    def __init__(
        self,
        db: DatabaseManager,
        storage_service: StorageService,
        voice_service: VoiceService,
    ):
        self.db = db
        self.storage_service = storage_service
        self.voice_service = voice_service

    def _verify_read_permission(self, session: Any, user: UserAccount | None, book: Book) -> None:
        """Ensures the user has permission to read/listen to this book."""
        if book.visibility in ("featured", "public"):
            return

        if user is None:
            raise ForbiddenError("Authentication required to access private book narration.")

        if book.owner_user_id == user.id:
            return

        role_rec = session.scalar(select(UserRole).where(UserRole.user_id == user.id))
        if role_rec and role_rec.role == "admin":
            return

        raise ForbiddenError("You do not have permission to listen to this book.")

    def get_or_synthesize_chapter_narration(
        self,
        session: Any,
        user: UserAccount | None,
        book_id: str,
        chapter_index: int,
        voice_id: str = "nova",
        speed: float = 1.0,
    ) -> dict[str, Any]:
        book = session.get(Book, book_id)
        if book is None:
            raise NotFoundError("Book not found.")

        self._verify_read_permission(session, user, book)

        # Check if narration segment already exists
        segment = session.scalar(
            select(BookNarrationSegment).where(
                BookNarrationSegment.book_id == book.id,
                BookNarrationSegment.chapter_index == chapter_index,
                BookNarrationSegment.voice_id == voice_id,
            )
        )

        chapter = session.scalar(
            select(BookChapter).where(
                BookChapter.book_id == book.id,
                BookChapter.chapter_order == chapter_index,
            )
        )
        chapter_title = chapter.title if chapter else f"Chapter {chapter_index + 1}"

        if segment:
            mime = "audio/wav" if segment.audio_storage_path.endswith(".wav") else "audio/mpeg"
            presigned = self.storage_service.generate_presigned_download_url(
                segment.audio_storage_path,
                expires_in=3600,
                response_content_type=mime,
            )
            return {
                "book_id": book.id,
                "chapter_index": chapter_index,
                "chapter_title": chapter_title,
                "voice_id": voice_id,
                "audio_url": presigned["download_url"],
                "duration_ms": segment.duration_ms,
                "segments": segment.alignment_data,
                "cached": True,
            }

        # Synthesize narration for this chapter
        # 1. Retrieve chapter text
        source = session.scalar(
            select(BookSource).where(BookSource.book_id == book.id).order_by(BookSource.created_at.asc())
        )
        full_text = source.extracted_text if source else ""
        chapter_text = ""

        if chapter and chapter.start_char is not None and chapter.end_char is not None and chapter.end_char > chapter.start_char:
            chapter_text = full_text[chapter.start_char:chapter.end_char].strip()

        if not chapter_text:
            if full_text:
                chapter_text = full_text.strip()
            else:
                chapter_text = f"{chapter_title}. No text available for narration."

        # 2. Split into sentences
        sentences = split_text_into_sentences(chapter_text)
        if not sentences:
            sentences = [chapter_title]

        # Limit sentence count per chapter synthesis pass for latency
        sentences = sentences[:100]

        # 3. Synthesize sentence by sentence to build exact alignment timestamps
        wav_chunks: list[bytes] = []
        mp3_chunks: list[bytes] = []
        alignment_data: list[dict[str, Any]] = []
        current_ms = 0
        primary_mime = "audio/wav"

        for idx, sentence in enumerate(sentences):
            audio_bytes, mime, dur_sec = self.voice_service.synthesize_speech(
                sentence,
                voice=voice_id,
                speed=speed,
            )
            dur_ms = max(700, int(dur_sec * 1000))
            alignment_data.append({
                "segment_index": idx,
                "text": sentence,
                "start_time_ms": current_ms,
                "end_time_ms": current_ms + dur_ms,
            })
            current_ms += dur_ms
            primary_mime = mime
            if "wav" in mime:
                wav_chunks.append(audio_bytes)
            else:
                mp3_chunks.append(audio_bytes)

        # Combine audio
        if "wav" in primary_mime and wav_chunks:
            final_audio = combine_wav_segments(wav_chunks)
            ext = "wav"
        elif mp3_chunks:
            final_audio = b"".join(mp3_chunks)
            ext = "mp3"
        else:
            final_audio = b""
            ext = "wav"

        storage_key = f"books/{book.id}/narration/ch_{chapter_index}_{voice_id}.{ext}"
        self.storage_service.upload_file(storage_key, final_audio, content_type=primary_mime)

        segment = BookNarrationSegment(
            book_id=book.id,
            chapter_index=chapter_index,
            voice_id=voice_id,
            audio_storage_path=storage_key,
            duration_ms=current_ms,
            alignment_data=alignment_data,
        )
        session.add(segment)
        session.flush()

        presigned = self.storage_service.generate_presigned_download_url(
            storage_key,
            expires_in=3600,
            response_content_type=primary_mime,
        )
        return {
            "book_id": book.id,
            "chapter_index": chapter_index,
            "chapter_title": chapter_title,
            "voice_id": voice_id,
            "audio_url": presigned["download_url"],
            "duration_ms": segment.duration_ms,
            "segments": segment.alignment_data,
            "cached": False,
        }
