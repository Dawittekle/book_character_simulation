from __future__ import annotations

from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, Integer, JSON, String, Text
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


class UserAccount(IdentifierMixin, TimestampMixin, Base):
    __tablename__ = "users"

    supabase_user_id: Mapped[str | None] = mapped_column(String(36), unique=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    books: Mapped[list["Book"]] = relationship(back_populates="owner")
    chat_sessions: Mapped[list["ChatSession"]] = relationship(back_populates="owner")
    character_memories: Mapped[list["CharacterMemory"]] = relationship(
        back_populates="owner"
    )


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

    owner: Mapped["UserAccount"] = relationship(back_populates="books")
    sources: Mapped[list["BookSource"]] = relationship(back_populates="book")
    characters: Mapped[list["CharacterProfileRecord"]] = relationship(back_populates="book")
    chat_sessions: Mapped[list["ChatSession"]] = relationship(back_populates="book")
    character_memories: Mapped[list["CharacterMemory"]] = relationship(
        back_populates="book"
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


class CharacterProfileRecord(IdentifierMixin, TimestampMixin, Base):
    __tablename__ = "characters"

    book_id: Mapped[str] = mapped_column(ForeignKey("books.id"), nullable=False)
    source_text_id: Mapped[str | None] = mapped_column(String(64), index=True)
    stable_character_key: Mapped[str | None] = mapped_column(String(64), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    personality: Mapped[str] = mapped_column(Text, nullable=False)
    key_events: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    relationships: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    psi_parameters: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    emotion_state: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    book: Mapped["Book"] = relationship(back_populates="characters")
    chat_sessions: Mapped[list["ChatSession"]] = relationship(back_populates="character")
    character_memories: Mapped[list["CharacterMemory"]] = relationship(
        back_populates="character"
    )


class ChatSession(IdentifierMixin, TimestampMixin, Base):
    __tablename__ = "chat_sessions"

    owner_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    book_id: Mapped[str] = mapped_column(ForeignKey("books.id"), nullable=False)
    character_id: Mapped[str] = mapped_column(ForeignKey("characters.id"), nullable=False)
    title: Mapped[str | None] = mapped_column(String(255))
    latest_psi_parameters: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    latest_emotion_state: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
    )

    owner: Mapped["UserAccount"] = relationship(back_populates="chat_sessions")
    book: Mapped["Book"] = relationship(back_populates="chat_sessions")
    character: Mapped["CharacterProfileRecord"] = relationship(back_populates="chat_sessions")
    messages: Mapped[list["ChatMessage"]] = relationship(back_populates="session")
    character_memories: Mapped[list["CharacterMemory"]] = relationship(
        back_populates="session"
    )


class ChatMessage(IdentifierMixin, Base):
    __tablename__ = "chat_messages"

    session_id: Mapped[str] = mapped_column(ForeignKey("chat_sessions.id"), nullable=False)
    role: Mapped[ChatRole] = mapped_column(SqlEnum(ChatRole), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)
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
