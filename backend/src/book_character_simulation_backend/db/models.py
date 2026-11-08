from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy import Boolean, DateTime, Enum as SqlEnum, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

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


class UserSettings(IdentifierMixin, TimestampMixin, Base):
    __tablename__ = "user_settings"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    reading_theme: Mapped[str] = mapped_column(String(50), default="parchment", nullable=False)
    spoiler_policy: Mapped[str] = mapped_column(String(50), default="cautious", nullable=False)
    enter_to_send: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
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
    processing_jobs: Mapped[list["ProcessingJob"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
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
    cover_url: Mapped[str | None] = mapped_column(Text)

    owner: Mapped["UserAccount"] = relationship(back_populates="books")
    sources: Mapped[list["BookSource"]] = relationship(back_populates="book", cascade="all, delete-orphan")
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
    embedding: Mapped[list[float] | None] = mapped_column(JSON)
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


class ChatSession(IdentifierMixin, TimestampMixin, Base):
    __tablename__ = "chat_sessions"

    owner_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    book_id: Mapped[str] = mapped_column(ForeignKey("books.id"), nullable=False)
    character_id: Mapped[str] = mapped_column(ForeignKey("characters.id"), nullable=False)
    title: Mapped[str | None] = mapped_column(String(255))
    spoiler_policy: Mapped[str] = mapped_column(String(50), default="cautious", nullable=False)
    latest_psi_parameters: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    latest_emotion_state: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
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
    citations: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)
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




