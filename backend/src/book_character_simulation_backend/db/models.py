from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy import Boolean, DateTime, Enum as SqlEnum, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

from .base import Base, IdentifierMixin, TimestampMixin, utc_now


class BookProcessingStatus(str, Enum):
    uploaded = "uploaded"
    extracting = "extracting"
    ready = "ready"
    failed = "failed"


class ChatRole(str, Enum):
    user = "user"
    assistant = "assistant"
    system = "system"


class PlatformRole(str, Enum):
    user = "user"
    admin = "admin"


class UserRole(IdentifierMixin, Base):
    __tablename__ = "user_roles"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    role: Mapped[str] = mapped_column(String(20), default="user", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    user: Mapped["UserAccount"] = relationship(back_populates="role_assignment")


class UserProfile(TimestampMixin, Base):
    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    full_name: Mapped[str | None] = mapped_column(String(255))
    display_name: Mapped[str | None] = mapped_column(String(255), index=True)
    avatar_path: Mapped[str | None] = mapped_column(String(512))
    preferred_language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)

    user: Mapped["UserAccount"] = relationship(back_populates="profile", uselist=False)


class UserSettings(IdentifierMixin, TimestampMixin, Base):
    __tablename__ = "user_settings"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    reading_theme: Mapped[str] = mapped_column(String(50), default="parchment", nullable=False)
    app_theme: Mapped[str] = mapped_column(String(20), default="system", nullable=False)
    accent_color: Mapped[str] = mapped_column(String(20), default="coral", nullable=False)
    reduced_motion: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    high_contrast: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    spoiler_policy: Mapped[str] = mapped_column(String(50), default="cautious", nullable=False)
    enter_to_send: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    preferred_ui_language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    preferred_conversation_language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    voice_vad_silence_ms: Mapped[int] = mapped_column(Integer, default=1200, nullable=False)
    voice_auto_play: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    voice_save_audio_recordings: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notification_preferences: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    preferences: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    user: Mapped["UserAccount"] = relationship(back_populates="settings")


class UserCharacterState(IdentifierMixin, TimestampMixin, Base):
    __tablename__ = "user_character_states"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    character_id: Mapped[str] = mapped_column(
        ForeignKey("characters.id", ondelete="CASCADE"),
        nullable=False,
    )
    psi_parameters: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    emotion_state: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    user: Mapped["UserAccount"] = relationship(back_populates="character_states")
    character: Mapped["CharacterProfileRecord"] = relationship(back_populates="user_states")

    __table_args__ = (
        UniqueConstraint("user_id", "character_id", name="uq_user_character_states_user_character"),
    )


class UserAccount(IdentifierMixin, TimestampMixin, Base):
    __tablename__ = "users"

    supabase_user_id: Mapped[str | None] = mapped_column(String(36), unique=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    role_assignment: Mapped[UserRole | None] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    profile: Mapped[UserProfile | None] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    settings: Mapped[UserSettings | None] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    character_states: Mapped[list[UserCharacterState]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    books: Mapped[list["Book"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    chat_sessions: Mapped[list["ChatSession"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    character_memories: Mapped[list["CharacterMemory"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    character_state_events: Mapped[list["CharacterStateEvent"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    processing_jobs: Mapped[list["ProcessingJob"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    reading_progress_records: Mapped[list["ReadingProgress"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    bookmarks: Mapped[list["BookBookmark"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    annotations: Mapped[list["BookAnnotation"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class ProcessingJob(IdentifierMixin, TimestampMixin, Base):
    __tablename__ = "processing_jobs"

    owner_user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    book_id: Mapped[str | None] = mapped_column(
        ForeignKey("books.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    stage: Mapped[str] = mapped_column(String(50), default="queued", nullable=False)
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    document_type: Mapped[str | None] = mapped_column(String(50))
    confidence: Mapped[float | None] = mapped_column(Float)
    inferred_title: Mapped[str | None] = mapped_column(String(255))
    inferred_author: Mapped[str | None] = mapped_column(String(255))
    error_message: Mapped[str | None] = mapped_column(Text)
    job_metadata: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    owner: Mapped["UserAccount"] = relationship(back_populates="processing_jobs")
    book: Mapped["Book | None"] = relationship()


class Book(IdentifierMixin, TimestampMixin, Base):
    __tablename__ = "books"

    owner_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    author: Mapped[str | None] = mapped_column(String(255))
    summary: Mapped[str | None] = mapped_column(Text)
    processing_status: Mapped[BookProcessingStatus] = mapped_column(
        SqlEnum(BookProcessingStatus),
        default=BookProcessingStatus.uploaded,
        nullable=False,
    )
    visibility: Mapped[str] = mapped_column(String(50), default="private", nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), default="book", nullable=False)
    original_language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    detected_language: Mapped[str | None] = mapped_column(String(10), nullable=True)
    cover_url: Mapped[str | None] = mapped_column(Text)
    edition_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    rights_basis: Mapped[str | None] = mapped_column(String(100), default="Public Domain (US / Life+70)", nullable=True)
    file_provenance: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cover_art_licence: Mapped[str | None] = mapped_column(String(100), default="Public Domain / CC0", nullable=True)

    owner: Mapped["UserAccount"] = relationship(back_populates="books")
    sources: Mapped[list["BookSource"]] = relationship(back_populates="book", cascade="all, delete-orphan")
    chapters: Mapped[list["BookChapter"]] = relationship(
        back_populates="book", cascade="all, delete-orphan"
    )
    characters: Mapped[list["CharacterProfileRecord"]] = relationship(
        back_populates="book", cascade="all, delete-orphan"
    )
    chat_sessions: Mapped[list["ChatSession"]] = relationship(
        back_populates="book", cascade="all, delete-orphan"
    )
    character_memories: Mapped[list["CharacterMemory"]] = relationship(
        back_populates="book", cascade="all, delete-orphan"
    )
    chunks: Mapped[list["BookChunk"]] = relationship(
        back_populates="book", cascade="all, delete-orphan"
    )
    reading_progress_records: Mapped[list["ReadingProgress"]] = relationship(
        back_populates="book", cascade="all, delete-orphan"
    )
    bookmarks: Mapped[list["BookBookmark"]] = relationship(
        back_populates="book", cascade="all, delete-orphan"
    )
    annotations: Mapped[list["BookAnnotation"]] = relationship(
        back_populates="book", cascade="all, delete-orphan"
    )
    narration_segments: Mapped[list["BookNarrationSegment"]] = relationship(
        back_populates="book", cascade="all, delete-orphan"
    )


class BookChapter(IdentifierMixin, Base):
    __tablename__ = "book_chapters"

    book_id: Mapped[str] = mapped_column(
        ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True
    )
    chapter_order: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    language_code: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    start_char: Mapped[int | None] = mapped_column(Integer, nullable=True)
    end_char: Mapped[int | None] = mapped_column(Integer, nullable=True)
    word_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    book: Mapped["Book"] = relationship(back_populates="chapters")


class BookSource(IdentifierMixin, TimestampMixin, Base):
    __tablename__ = "book_sources"

    book_id: Mapped[str] = mapped_column(ForeignKey("books.id"), nullable=False)
    original_filename: Mapped[str | None] = mapped_column(String(255))
    mime_type: Mapped[str | None] = mapped_column(String(255))
    storage_bucket: Mapped[str | None] = mapped_column(String(255))
    storage_path: Mapped[str | None] = mapped_column(Text)
    extracted_text: Mapped[str | None] = mapped_column(Text)
    extracted_text_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer)

    book: Mapped["Book"] = relationship(back_populates="sources")


class BookChunk(IdentifierMixin, Base):
    __tablename__ = "book_chunks"

    book_id: Mapped[str] = mapped_column(
        ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True
    )
    chapter_order: Mapped[int] = mapped_column(Integer, default=1, nullable=False, index=True)
    chapter_title: Mapped[str | None] = mapped_column(String(255))
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    language_code: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector())
    embedding_provider: Mapped[str] = mapped_column(String(50), default="gemini", nullable=False)
    embedding_model: Mapped[str] = mapped_column(String(100), default="text-embedding-004", nullable=False)
    embedding_dimensions: Mapped[int] = mapped_column(Integer, default=768, nullable=False)
    content_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    book: Mapped["Book"] = relationship(back_populates="chunks")


class CharacterProfileRecord(IdentifierMixin, TimestampMixin, Base):
    __tablename__ = "characters"

    book_id: Mapped[str] = mapped_column(ForeignKey("books.id"), nullable=False)
    source_text_id: Mapped[str | None] = mapped_column(String(64), index=True)
    stable_character_key: Mapped[str | None] = mapped_column(String(64), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    personality: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str | None] = mapped_column(String(100))
    appearance_description: Mapped[str | None] = mapped_column(Text)
    avatar_asset_id: Mapped[str | None] = mapped_column(String(100))
    key_events: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    relationships: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    psi_parameters: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    emotion_state: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    assigned_voice_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    voice_matching_confidence: Mapped[str | None] = mapped_column(String(50), nullable=True)

    book: Mapped["Book"] = relationship(back_populates="characters")
    chat_sessions: Mapped[list["ChatSession"]] = relationship(
        back_populates="character", cascade="all, delete-orphan"
    )
    character_memories: Mapped[list["CharacterMemory"]] = relationship(
        back_populates="character", cascade="all, delete-orphan"
    )
    user_states: Mapped[list[UserCharacterState]] = relationship(
        back_populates="character", cascade="all, delete-orphan"
    )
    evidence: Mapped[list["CharacterProfileEvidence"]] = relationship(
        back_populates="character", cascade="all, delete-orphan"
    )
    state_events: Mapped[list["CharacterStateEvent"]] = relationship(
        back_populates="character", cascade="all, delete-orphan"
    )


class CharacterProfileEvidence(IdentifierMixin, Base):
    __tablename__ = "character_profile_evidence"

    character_id: Mapped[str] = mapped_column(
        ForeignKey("characters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    book_id: Mapped[str] = mapped_column(
        ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True
    )
    fact_text: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="trait", nullable=False)
    chapter_order: Mapped[int] = mapped_column(Integer, default=1, nullable=False, index=True)
    chunk_id: Mapped[str | None] = mapped_column(
        ForeignKey("book_chunks.id", ondelete="SET NULL"), nullable=True
    )
    confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    provenance: Mapped[str] = mapped_column(String(100), default="canonical", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    character: Mapped["CharacterProfileRecord"] = relationship(back_populates="evidence")
    book: Mapped["Book"] = relationship()
    chunk: Mapped["BookChunk | None"] = relationship()


class CharacterStateEvent(IdentifierMixin, Base):
    __tablename__ = "character_state_events"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    character_id: Mapped[str] = mapped_column(
        ForeignKey("characters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    session_id: Mapped[str | None] = mapped_column(
        ForeignKey("chat_sessions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    state_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    trigger_modality: Mapped[str] = mapped_column(String(20), default="text", nullable=False)
    trigger_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    perceived_observation: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    previous_psi: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    resulting_psi: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    previous_emotion: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    resulting_emotion: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    transition_rules_version: Mapped[str] = mapped_column(String(20), default="v1.0", nullable=False)
    model_provenance: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    user: Mapped["UserAccount"] = relationship(back_populates="character_state_events")
    character: Mapped["CharacterProfileRecord"] = relationship(back_populates="state_events")
    session: Mapped["ChatSession | None"] = relationship()


class ChatSession(IdentifierMixin, TimestampMixin, Base):
    __tablename__ = "chat_sessions"

    owner_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    book_id: Mapped[str] = mapped_column(ForeignKey("books.id"), nullable=False)
    character_id: Mapped[str] = mapped_column(ForeignKey("characters.id"), nullable=False)
    title: Mapped[str | None] = mapped_column(String(255))
    spoiler_policy: Mapped[str] = mapped_column(String(50), default="cautious", nullable=False)
    reading_progress_chapter: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    conversation_language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    latest_psi_parameters: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    latest_emotion_state: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    session_voice_override: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_speaking: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    active_playback_generation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
    )

    owner: Mapped["UserAccount"] = relationship(back_populates="chat_sessions")
    book: Mapped["Book"] = relationship(back_populates="chat_sessions")
    character: Mapped["CharacterProfileRecord"] = relationship(back_populates="chat_sessions")
    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    character_memories: Mapped[list["CharacterMemory"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class ChatMessage(IdentifierMixin, Base):
    __tablename__ = "chat_messages"

    session_id: Mapped[str] = mapped_column(ForeignKey("chat_sessions.id"), nullable=False)
    role: Mapped[ChatRole] = mapped_column(SqlEnum(ChatRole), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)
    input_modality: Mapped[str] = mapped_column(String(20), default="text", nullable=False)
    language_code: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    citations: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)
    is_interrupted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    audio_storage_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    session: Mapped["ChatSession"] = relationship(back_populates="messages")


class CharacterMemory(IdentifierMixin, Base):
    __tablename__ = "character_memories"

    owner_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    book_id: Mapped[str] = mapped_column(ForeignKey("books.id"), nullable=False)
    character_id: Mapped[str] = mapped_column(ForeignKey("characters.id"), nullable=False)
    session_id: Mapped[str] = mapped_column(ForeignKey("chat_sessions.id"), nullable=False)
    fact: Mapped[str] = mapped_column(Text, nullable=False)
    spoiler_chapter: Mapped[int | None] = mapped_column(Integer, nullable=True)
    provenance: Mapped[str] = mapped_column(String(50), default="chat", nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    owner: Mapped["UserAccount"] = relationship(back_populates="character_memories")
    book: Mapped["Book"] = relationship(back_populates="character_memories")
    character: Mapped["CharacterProfileRecord"] = relationship(
        back_populates="character_memories"
    )
    session: Mapped["ChatSession"] = relationship(back_populates="character_memories")


class NotificationRecord(IdentifierMixin, TimestampMixin, Base):
    __tablename__ = "notifications"

    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="system", nullable=False)
    link_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class MembershipPlan(IdentifierMixin, TimestampMixin, Base):
    __tablename__ = "membership_plans"

    slug: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="personal", nullable=False)  # "personal" | "business"
    price_monthly: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    book_quota: Mapped[str] = mapped_column(String(50), default="3", nullable=False)
    daily_messages: Mapped[str] = mapped_column(String(50), default="20", nullable=False)
    voice_access: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    features: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    badge: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class PaymentTransaction(IdentifierMixin, TimestampMixin, Base):
    __tablename__ = "payment_transactions"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plan_slug: Mapped[str] = mapped_column(String(50), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)
    payment_method: Mapped[str] = mapped_column(String(50), default="credit_card", nullable=False)
    payment_details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    chosen_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="pending", nullable=False)  # pending | verified | rejected
    verified_by_admin_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["UserAccount"] = relationship(foreign_keys=[user_id])


class SystemSetting(IdentifierMixin, TimestampMixin, Base):
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    value: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class VoiceCatalogItem(IdentifierMixin, TimestampMixin, Base):
    __tablename__ = "voice_catalog"

    voice_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    provider: Mapped[str] = mapped_column(String(50), default="openai", nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    gender: Mapped[str] = mapped_column(String(30), default="neutral", nullable=False)
    age_bracket: Mapped[str] = mapped_column(String(30), default="adult", nullable=False)
    pitch: Mapped[str] = mapped_column(String(30), default="mid", nullable=False)
    speaking_style: Mapped[str] = mapped_column(String(50), default="warm", nullable=False)
    accent: Mapped[str] = mapped_column(String(50), default="neutral", nullable=False)
    language_codes: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    sample_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    preview_audio_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class VoiceUsageLog(IdentifierMixin, Base):
    __tablename__ = "voice_usage_logs"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id: Mapped[str | None] = mapped_column(ForeignKey("chat_sessions.id", ondelete="SET NULL"), nullable=True)
    character_id: Mapped[str | None] = mapped_column(ForeignKey("characters.id", ondelete="SET NULL"), nullable=True)
    modality: Mapped[str] = mapped_column(String(20), default="voice_turn", nullable=False)
    stt_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    stt_audio_seconds: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tts_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tts_character_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    voice_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    user: Mapped["UserAccount"] = relationship(foreign_keys=[user_id])


class AvatarAsset(IdentifierMixin, TimestampMixin, Base):
    __tablename__ = "avatar_assets"

    asset_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    art_style: Mapped[str] = mapped_column(String(50), default="illustrated", nullable=False)
    gender: Mapped[str] = mapped_column(String(20), default="neutral", nullable=False)
    apparent_age: Mapped[str] = mapped_column(String(50), default="adult", nullable=False)
    period_era: Mapped[str] = mapped_column(String(50), default="19th_century", nullable=False)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), default="synthetic_approved", nullable=False)
    licence: Mapped[str] = mapped_column(String(100), default="Public Domain / CC0", nullable=False)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_fallback: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class UserLibraryBook(IdentifierMixin, Base):
    __tablename__ = "user_library_books"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    book_id: Mapped[str] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    reading_progress_chapter: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    user: Mapped["UserAccount"] = relationship()
    book: Mapped["Book"] = relationship()


class ReadingProgress(IdentifierMixin, Base):
    __tablename__ = "reading_progress"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    book_id: Mapped[str] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    current_chapter_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    progress_percent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    locator_type: Mapped[str] = mapped_column(String(50), default="epub_cfi", nullable=False)
    locator_payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    last_read_mode: Mapped[str] = mapped_column(String(30), default="read", nullable=False)
    reading_time_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "book_id", name="uq_reading_progress_user_book"),)

    user: Mapped["UserAccount"] = relationship(back_populates="reading_progress_records")
    book: Mapped["Book"] = relationship(back_populates="reading_progress_records")


class BookBookmark(IdentifierMixin, Base):
    __tablename__ = "book_bookmarks"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    book_id: Mapped[str] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    chapter_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    chapter_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    progress_percent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    locator_type: Mapped[str] = mapped_column(String(50), default="epub_cfi", nullable=False)
    locator_payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    user: Mapped["UserAccount"] = relationship(back_populates="bookmarks")
    book: Mapped["Book"] = relationship(back_populates="bookmarks")


class BookAnnotation(IdentifierMixin, TimestampMixin, Base):
    __tablename__ = "book_annotations"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    book_id: Mapped[str] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    chapter_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    selected_text: Mapped[str] = mapped_column(Text, nullable=False)
    color: Mapped[str] = mapped_column(String(30), default="amber", nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    locator_type: Mapped[str] = mapped_column(String(50), default="epub_cfi", nullable=False)
    locator_payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    user: Mapped["UserAccount"] = relationship(back_populates="annotations")
    book: Mapped["Book"] = relationship(back_populates="annotations")


class BookNarrationSegment(IdentifierMixin, Base):
    __tablename__ = "book_narration_segments"

    book_id: Mapped[str] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    chapter_index: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    voice_id: Mapped[str] = mapped_column(String(100), nullable=False)
    audio_storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    alignment_data: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (UniqueConstraint("book_id", "chapter_index", "voice_id", name="uq_narration_book_chapter_voice"),)

    book: Mapped["Book"] = relationship(back_populates="narration_segments")








