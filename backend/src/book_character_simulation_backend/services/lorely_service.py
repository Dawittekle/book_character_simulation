from __future__ import annotations

import base64
import json
import logging
import re
from typing import Any

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from ..auth import AuthenticatedUser
from ..db.base import utc_now
from ..db.models import (
    Book,
    BookChunk,
    BookProcessingStatus,
    BookSource,
    CharacterMemory,
    CharacterProfileRecord,
    ChatMessage,
    ChatRole,
    ChatSession,
    ProcessingJob,
    UserAccount,
    UserCharacterState,
    UserRole,
    UserSettings,
)
from ..db.session import DatabaseManager
from ..errors import BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError
from ..llm.factory import get_llm_provider
from ..prompts import character_extraction_prompt, chat_prompt, fact_extraction_prompt
from ..rag.chunker import build_semantic_chunks
from ..rag.embedding_provider import EmbeddingService
from ..rag.retriever import SpoilerAwareRetriever
from ..schemas.character import CharacterProfile
from ..utils.document_extractor import extract_document_from_bytes
from ..utils.json import parse_json_response
from .classification_service import ClassificationService
from .voice_service import VoiceService

logger = logging.getLogger(__name__)


class LorelyService:
    def __init__(self, database_manager: DatabaseManager, settings: Any):
        self.db = database_manager
        self.settings = settings
        self.classifier = ClassificationService(settings)
        self.embedding_service = EmbeddingService(settings)
        self.retriever = SpoilerAwareRetriever(self.embedding_service)
        self.voice_service = VoiceService(settings)

    # --- User & Account helpers ---

    def resolve_user(self, session: Session, auth_user: AuthenticatedUser | None) -> UserAccount:
        if auth_user is None:
            raise UnauthorizedError("Authentication required.")

        user = session.scalar(
            select(UserAccount).where(UserAccount.supabase_user_id == auth_user.subject)
        )
        if user is None and auth_user.email:
            user = session.scalar(
                select(UserAccount).where(UserAccount.email == auth_user.email)
            )

        email = auth_user.email or f"supabase-{auth_user.subject}@lorely.app"
        display_name = auth_user.display_name or (email.split("@")[0] if "@" in email else "Reader")

        if user is None:
            user = UserAccount(
                supabase_user_id=auth_user.subject,
                email=email,
                display_name=display_name,
                avatar_url=auth_user.avatar_url,
            )
            session.add(user)
            session.flush()

            # Create default settings and role
            role = UserRole(user_id=user.id, role="user")
            settings = UserSettings(user_id=user.id)
            session.add_all([role, settings])
            session.flush()
            return user

        user.supabase_user_id = auth_user.subject
        user.email = email
        if auth_user.display_name:
            user.display_name = auth_user.display_name
        if auth_user.avatar_url:
            user.avatar_url = auth_user.avatar_url
        user.last_login_at = utc_now()
        session.flush()
        return user

    def _get_me_in_session(self, session: Session, user: UserAccount) -> dict[str, Any]:
        role_record = session.scalar(
            select(UserRole).where(UserRole.user_id == user.id)
        )
        role = role_record.role if role_record else "user"

        book_count = session.scalar(
            select(func.count(Book.id)).where(Book.owner_user_id == user.id)
        ) or 0
        conv_count = session.scalar(
            select(func.count(ChatSession.id)).where(ChatSession.owner_user_id == user.id)
        ) or 0

        return {
            "id": user.id,
            "supabase_user_id": user.supabase_user_id,
            "email": user.email,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
            "role": role,
            "book_count": book_count,
            "conversation_count": conv_count,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }

    def get_me(self, auth_user: AuthenticatedUser | None) -> dict[str, Any]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            return self._get_me_in_session(session, user)

    def update_me(
        self, auth_user: AuthenticatedUser | None, display_name: str | None, avatar_url: str | None
    ) -> dict[str, Any]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            if display_name is not None:
                user.display_name = display_name.strip()
            if avatar_url is not None:
                user.avatar_url = avatar_url.strip()
            session.flush()
            return self._get_me_in_session(session, user)

    def get_settings(self, auth_user: AuthenticatedUser | None) -> dict[str, Any]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            settings = session.scalar(
                select(UserSettings).where(UserSettings.user_id == user.id)
            )
            if settings is None:
                settings = UserSettings(user_id=user.id)
                session.add(settings)
                session.flush()

            return {
                "reading_theme": settings.reading_theme,
                "spoiler_policy": settings.spoiler_policy,
                "enter_to_send": settings.enter_to_send,
                "preferences": settings.preferences or {},
            }

    def update_settings(
        self, auth_user: AuthenticatedUser | None, updates: dict[str, Any]
    ) -> dict[str, Any]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            settings = session.scalar(
                select(UserSettings).where(UserSettings.user_id == user.id)
            )
            if settings is None:
                settings = UserSettings(user_id=user.id)
                session.add(settings)

            if "reading_theme" in updates:
                settings.reading_theme = str(updates["reading_theme"])
            if "spoiler_policy" in updates:
                settings.spoiler_policy = str(updates["spoiler_policy"])
            if "enter_to_send" in updates:
                settings.enter_to_send = bool(updates["enter_to_send"])
            if "preferences" in updates and isinstance(updates["preferences"], dict):
                settings.preferences = updates["preferences"]

            session.flush()
            return {
                "reading_theme": settings.reading_theme,
                "spoiler_policy": settings.spoiler_policy,
                "enter_to_send": settings.enter_to_send,
                "preferences": settings.preferences or {},
            }

    # --- Books ---

    def list_books(self, auth_user: AuthenticatedUser | None) -> list[dict[str, Any]]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            books = session.scalars(
                select(Book)
                .where(or_(Book.owner_user_id == user.id, Book.visibility == "featured"))
                .order_by(Book.updated_at.desc())
            ).all()

            results = []
            for b in books:
                char_count = session.scalar(
                    select(func.count(CharacterProfileRecord.id)).where(
                        CharacterProfileRecord.book_id == b.id
                    )
                ) or 0
                conv_count = session.scalar(
                    select(func.count(ChatSession.id)).where(
                        ChatSession.book_id == b.id,
                        ChatSession.owner_user_id == user.id,
                    )
                ) or 0
                results.append({
                    "id": b.id,
                    "title": b.title,
                    "author": b.author,
                    "summary": b.summary,
                    "cover_url": b.cover_url,
                    "visibility": b.visibility,
                    "source_type": b.source_type,
                    "processing_status": b.processing_status.value,
                    "is_owner": b.owner_user_id == user.id,
                    "character_count": char_count,
                    "conversation_count": conv_count,
                    "created_at": b.created_at.isoformat() if b.created_at else None,
                    "updated_at": b.updated_at.isoformat() if b.updated_at else None,
                })
            return results

    def create_book(
        self,
        auth_user: AuthenticatedUser | None,
        *,
        title: str,
        author: str | None = None,
        summary: str | None = None,
        cover_url: str | None = None,
        visibility: str = "private",
        source_type: str = "book",
        extracted_text: str | None = None,
    ) -> dict[str, Any]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            cleaned_title = title.strip()
            if not cleaned_title:
                raise BadRequestError("Book title is required.")

            book = Book(
                owner_user_id=user.id,
                title=cleaned_title,
                author=author.strip() if author else None,
                summary=summary.strip() if summary else None,
                cover_url=cover_url.strip() if cover_url else None,
                visibility=visibility,
                source_type=source_type,
                processing_status=BookProcessingStatus.ready,
            )
            session.add(book)
            session.flush()

            if extracted_text:
                source = BookSource(
                    book_id=book.id,
                    original_filename=f"{cleaned_title}.txt",
                    mime_type="text/plain",
                    extracted_text=extracted_text,
                    file_size_bytes=len(extracted_text.encode("utf-8")),
                )
                session.add(source)
                chunks = build_semantic_chunks(extracted_text)
                for c in chunks:
                    vec = self.embedding_service.embed_text(c.content)
                    session.add(
                        BookChunk(
                            book_id=book.id,
                            chapter_order=c.chapter_order,
                            chapter_title=c.chapter_title,
                            chunk_index=c.chunk_index,
                            content=c.content,
                            embedding=vec,
                        )
                    )
                session.flush()

            return {
                "id": book.id,
                "title": book.title,
                "author": book.author,
                "summary": book.summary,
                "cover_url": book.cover_url,
                "visibility": book.visibility,
                "source_type": book.source_type,
                "processing_status": book.processing_status.value,
                "is_owner": True,
                "character_count": 0,
                "conversation_count": 0,
                "created_at": book.created_at.isoformat(),
                "updated_at": book.updated_at.isoformat(),
            }

    def inspect_source(
        self,
        auth_user: AuthenticatedUser | None,
        *,
        file_bytes: bytes | None = None,
        filename: str | None = None,
        raw_text: str | None = None,
        llm_provider: str | None = None,
    ) -> dict[str, Any]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)

            if file_bytes:
                doc = extract_document_from_bytes(file_bytes, filename)
            elif raw_text:
                clean_text = raw_text.strip()
                if not clean_text:
                    raise BadRequestError("Text content cannot be empty.")
                doc = extract_document_from_bytes(clean_text.encode("utf-8"), filename or "pasted_text.txt")
            else:
                raise BadRequestError("Either file or text must be provided.")

            classification = self.classifier.classify_text(
                doc.text,
                filename=filename,
                embedded_title=doc.embedded_title,
                embedded_author=doc.embedded_author,
                llm_provider=llm_provider,
            )

            job = ProcessingJob(
                owner_user_id=user.id,
                status="pending",
                stage="inspected",
                progress=20,
                document_type=classification.document_type,
                confidence=classification.confidence,
                inferred_title=classification.title,
                inferred_author=classification.author,
                job_metadata={
                    "text": doc.text,
                    "filename": filename,
                    "format": doc.format,
                    "page_count": doc.page_count,
                    "word_count": doc.word_count,
                    "is_narrative": classification.is_narrative,
                    "warning": classification.warning,
                    "reasoning": classification.reasoning,
                },
            )
            session.add(job)
            session.flush()

            return {
                "temp_source_id": job.id,
                "document_type": classification.document_type,
                "confidence": classification.confidence,
                "title": classification.title or (filename.rsplit(".", 1)[0].replace("_", " ").title() if filename else "Untitled Book"),
                "author": classification.author,
                "is_narrative": classification.is_narrative,
                "page_count": doc.page_count,
                "word_count": doc.word_count,
                "format": doc.format,
                "warning": classification.warning,
                "reasoning": classification.reasoning,
            }

    def ingest_source(
        self,
        auth_user: AuthenticatedUser | None,
        *,
        temp_source_id: str,
        title: str | None = None,
        author: str | None = None,
        visibility: str = "private",
        force_extraction: bool = False,
        llm_provider: str | None = None,
    ) -> dict[str, Any]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            job = session.get(ProcessingJob, temp_source_id)
            if job is None:
                raise NotFoundError("Inspection job not found.")

            if job.owner_user_id != user.id:
                raise ForbiddenError("You do not have access to this job.")

            if job.document_type == "document" and not force_extraction:
                raise BadRequestError(
                    job.job_metadata.get("warning")
                    or "This file is classified as a non-narrative document. To extract characters anyway, confirm by enabling force_extraction."
                )

            job.status = "processing"
            job.stage = "creating_book"
            job.progress = 40
            session.flush()

            extracted_text = job.job_metadata.get("text", "")
            final_title = (title or job.inferred_title or "Untitled Book").strip()
            final_author = (author or job.inferred_author or "").strip() or None

            book = Book(
                owner_user_id=user.id,
                title=final_title,
                author=final_author,
                summary=job.job_metadata.get("reasoning"),
                visibility=visibility,
                source_type=job.document_type or "book",
                processing_status=BookProcessingStatus.extracting,
            )
            session.add(book)
            session.flush()

            source = BookSource(
                book_id=book.id,
                original_filename=job.job_metadata.get("filename"),
                mime_type=f"application/{job.job_metadata.get('format', 'text')}",
                extracted_text=extracted_text,
                file_size_bytes=len(extracted_text.encode("utf-8")),
            )
            session.add(source)
            job.book_id = book.id
            job.stage = "extracting_characters"
            job.progress = 60
            session.flush()

            # Extract characters with LLM
            characters = []
            try:
                provider = get_llm_provider(
                    self.settings,
                    provider_name=llm_provider or self.settings.llm_provider,
                )
                system_prompt, user_prompt = character_extraction_prompt(extracted_text[: self.settings.max_source_characters])
                raw_response = provider.generate_json(system_prompt=system_prompt, user_prompt=user_prompt)
                parsed_characters = parse_json_response(raw_response)
                if isinstance(parsed_characters, list):
                    for idx, char_dict in enumerate(parsed_characters):
                        if not isinstance(char_dict, dict):
                            continue
                        if not char_dict.get("id"):
                            char_dict["id"] = re.sub(r"[^a-z0-9]+", "-", char_dict.get("name", f"char-{idx+1}").lower()).strip("-")
                        c = CharacterProfile.model_validate(char_dict)
                        char_rec = CharacterProfileRecord(
                            book_id=book.id,
                            stable_character_key=c.id or f"char-{idx+1}",
                            name=c.name,
                            role="Protagonist" if idx == 0 else "Supporting",
                            personality=c.personality,
                            key_events=c.key_events or [],
                            relationships=c.relationships or [],
                            psi_parameters=c.psi_parameters.model_dump(mode="json"),
                            emotion_state=c.emotion_state.model_dump(mode="json"),
                        )
                        session.add(char_rec)
                        characters.append(char_rec)

                # Build semantic chunks and store embeddings for RAG
                job.stage = "indexing_passages"
                job.progress = 85
                chunks = build_semantic_chunks(extracted_text)
                for c in chunks:
                    vec = self.embedding_service.embed_text(c.content)
                    session.add(
                        BookChunk(
                            book_id=book.id,
                            chapter_order=c.chapter_order,
                            chapter_title=c.chapter_title,
                            chunk_index=c.chunk_index,
                            content=c.content,
                            embedding=vec,
                        )
                    )
                session.flush()

                book.processing_status = BookProcessingStatus.ready
                job.status = "completed"
                job.stage = "ready"
                job.progress = 100
            except Exception as exc:
                logger.exception("Character extraction failed during ingestion: %s", exc)
                book.processing_status = BookProcessingStatus.failed
                job.status = "failed"
                job.error_message = str(exc)

            session.flush()
            return {
                "job_id": job.id,
                "status": job.status,
                "book_id": book.id,
                "character_count": len(characters),
                "book": self._get_book_details_in_session(session, user, book.id),
            }

    def get_job_status(self, auth_user: AuthenticatedUser | None, job_id: str) -> dict[str, Any]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            job = session.get(ProcessingJob, job_id)
            if job is None:
                raise NotFoundError("Processing job not found.")

            if job.owner_user_id != user.id:
                raise ForbiddenError("You do not have permission to view this job.")

            return {
                "id": job.id,
                "status": job.status,
                "stage": job.stage,
                "progress": job.progress,
                "book_id": job.book_id,
                "document_type": job.document_type,
                "confidence": job.confidence,
                "inferred_title": job.inferred_title,
                "inferred_author": job.inferred_author,
                "error_message": job.error_message,
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "updated_at": job.updated_at.isoformat() if job.updated_at else None,
            }

    def _get_book_details_in_session(
        self, session: Session, user: UserAccount, book_id: str
    ) -> dict[str, Any]:
        book = session.get(Book, book_id)
        if book is None:
            raise NotFoundError("Book not found.")

        if book.owner_user_id != user.id and book.visibility != "featured":
            raise ForbiddenError("You do not have permission to view this book.")

        characters = session.scalars(
            select(CharacterProfileRecord)
            .where(CharacterProfileRecord.book_id == book.id)
            .order_by(CharacterProfileRecord.name.asc())
        ).all()

        char_list = [
            {
                "id": c.id,
                "stable_character_key": c.stable_character_key or c.id,
                "name": c.name,
                "role": c.role,
                "personality": c.personality,
                "appearance_description": c.appearance_description,
                "avatar_asset_id": c.avatar_asset_id,
                "key_events": c.key_events or [],
                "relationships": c.relationships or [],
                "emotion_state": c.emotion_state or {},
            }
            for c in characters
        ]

        conv_count = session.scalar(
            select(func.count(ChatSession.id)).where(
                ChatSession.book_id == book.id,
                ChatSession.owner_user_id == user.id,
            )
        ) or 0

        return {
            "id": book.id,
            "title": book.title,
            "author": book.author,
            "summary": book.summary,
            "cover_url": book.cover_url,
            "visibility": book.visibility,
            "source_type": book.source_type,
            "processing_status": book.processing_status.value,
            "is_owner": book.owner_user_id == user.id,
            "characters": char_list,
            "character_count": len(char_list),
            "conversation_count": conv_count,
            "created_at": book.created_at.isoformat() if book.created_at else None,
            "updated_at": book.updated_at.isoformat() if book.updated_at else None,
        }

    def get_book_details(
        self, auth_user: AuthenticatedUser | None, book_id: str
    ) -> dict[str, Any]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            return self._get_book_details_in_session(session, user, book_id)

    def update_book(
        self, auth_user: AuthenticatedUser | None, book_id: str, updates: dict[str, Any]
    ) -> dict[str, Any]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            book = session.get(Book, book_id)
            if book is None:
                raise NotFoundError("Book not found.")

            if book.owner_user_id != user.id:
                raise ForbiddenError("You can only modify books you own.")

            if "title" in updates and str(updates["title"]).strip():
                book.title = str(updates["title"]).strip()
            if "author" in updates:
                book.author = str(updates["author"]).strip() if updates["author"] else None
            if "summary" in updates:
                book.summary = str(updates["summary"]).strip() if updates["summary"] else None
            if "cover_url" in updates:
                book.cover_url = str(updates["cover_url"]).strip() if updates["cover_url"] else None
            if "visibility" in updates and updates["visibility"] in ("private", "featured"):
                book.visibility = updates["visibility"]

            session.flush()
            return self._get_book_details_in_session(session, user, book_id)

    def delete_book(self, auth_user: AuthenticatedUser | None, book_id: str) -> None:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            book = session.get(Book, book_id)
            if book is None:
                raise NotFoundError("Book not found.")

            if book.owner_user_id != user.id:
                raise ForbiddenError("You can only delete books you own.")

            session.delete(book)
            session.flush()

    # --- Characters ---

    def list_characters(
        self, auth_user: AuthenticatedUser | None, book_id: str
    ) -> list[dict[str, Any]]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            book = session.get(Book, book_id)
            if book is None:
                raise NotFoundError("Book not found.")

            if book.owner_user_id != user.id and book.visibility != "featured":
                raise ForbiddenError("You do not have permission to view characters in this book.")

            records = session.scalars(
                select(CharacterProfileRecord)
                .where(CharacterProfileRecord.book_id == book_id)
                .order_by(CharacterProfileRecord.name.asc())
            ).all()

            return [
                {
                    "id": r.id,
                    "stable_character_key": r.stable_character_key or r.id,
                    "book_id": r.book_id,
                    "name": r.name,
                    "role": r.role,
                    "personality": r.personality,
                    "appearance_description": r.appearance_description,
                    "avatar_asset_id": r.avatar_asset_id,
                    "key_events": r.key_events or [],
                    "relationships": r.relationships or [],
                    "emotion_state": r.emotion_state or {},
                    "psi_parameters": r.psi_parameters or {},
                }
                for r in records
            ]

    def get_character_dossier(
        self, auth_user: AuthenticatedUser | None, character_id: str
    ) -> dict[str, Any]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            char = session.get(CharacterProfileRecord, character_id)
            if char is None:
                # Fallback by stable_character_key
                char = session.scalar(
                    select(CharacterProfileRecord).where(
                        CharacterProfileRecord.stable_character_key == character_id
                    )
                )
            if char is None:
                raise NotFoundError("Character not found.")

            book = session.get(Book, char.book_id)
            if book and book.owner_user_id != user.id and book.visibility != "featured":
                raise ForbiddenError("You do not have access to this character.")

            # Load or initialize per-user state
            user_state = session.scalar(
                select(UserCharacterState).where(
                    UserCharacterState.user_id == user.id,
                    UserCharacterState.character_id == char.id,
                )
            )

            current_emotions = user_state.emotion_state if user_state else char.emotion_state
            current_psi = user_state.psi_parameters if user_state else char.psi_parameters

            return {
                "id": char.id,
                "stable_character_key": char.stable_character_key or char.id,
                "book_id": char.book_id,
                "book_title": book.title if book else "Unknown Book",
                "name": char.name,
                "role": char.role or "Character",
                "personality": char.personality,
                "appearance_description": char.appearance_description,
                "avatar_asset_id": char.avatar_asset_id,
                "key_events": char.key_events or [],
                "relationships": char.relationships or [],
                "canonical_emotion_state": char.emotion_state or {},
                "canonical_psi_parameters": char.psi_parameters or {},
                "current_user_emotion_state": current_emotions or {},
                "current_user_psi_parameters": current_psi or {},
            }

    def get_character_state(
        self, auth_user: AuthenticatedUser | None, character_id: str
    ) -> dict[str, Any]:
        dossier = self.get_character_dossier(auth_user, character_id)
        return {
            "character_id": dossier["id"],
            "name": dossier["name"],
            "emotion_state": dossier["current_user_emotion_state"],
            "psi_parameters": dossier["current_user_psi_parameters"],
        }

    def reset_character_state(
        self, auth_user: AuthenticatedUser | None, character_id: str
    ) -> dict[str, Any]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            char = session.get(CharacterProfileRecord, character_id)
            if char is None:
                char = session.scalar(
                    select(CharacterProfileRecord).where(
                        CharacterProfileRecord.stable_character_key == character_id
                    )
                )
            if char is None:
                raise NotFoundError("Character not found.")

            # Delete per-user character state
            session.execute(
                delete(UserCharacterState).where(
                    UserCharacterState.user_id == user.id,
                    UserCharacterState.character_id == char.id,
                )
            )
            # Delete memories between this user and this character
            session.execute(
                delete(CharacterMemory).where(
                    CharacterMemory.owner_user_id == user.id,
                    CharacterMemory.character_id == char.id,
                )
            )
            session.flush()

            return {
                "message": f"Reset simulation state and memories for {char.name}.",
                "character_id": char.id,
                "emotion_state": char.emotion_state,
                "psi_parameters": char.psi_parameters,
            }

    def get_character_memories(
        self, auth_user: AuthenticatedUser | None, character_id: str
    ) -> list[dict[str, Any]]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            char = session.get(CharacterProfileRecord, character_id)
            if char is None:
                char = session.scalar(
                    select(CharacterProfileRecord).where(
                        CharacterProfileRecord.stable_character_key == character_id
                    )
                )
            if char is None:
                raise NotFoundError("Character not found.")

            memories = session.scalars(
                select(CharacterMemory)
                .where(
                    CharacterMemory.owner_user_id == user.id,
                    CharacterMemory.character_id == char.id,
                )
                .order_by(CharacterMemory.created_at.asc())
            ).all()

            return [
                {
                    "id": m.id,
                    "fact": m.fact,
                    "session_id": m.session_id,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                }
                for m in memories
            ]

    # --- Conversations ---

    def list_conversations(
        self,
        auth_user: AuthenticatedUser | None,
        *,
        book_id: str | None = None,
        character_id: str | None = None,
    ) -> list[dict[str, Any]]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            query = select(ChatSession).where(ChatSession.owner_user_id == user.id)

            if book_id:
                query = query.where(ChatSession.book_id == book_id)
            if character_id:
                query = query.where(ChatSession.character_id == character_id)

            query = query.order_by(ChatSession.last_message_at.desc().nullslast(), ChatSession.updated_at.desc())
            sessions = session.scalars(query).all()

            results = []
            for s in sessions:
                char = session.get(CharacterProfileRecord, s.character_id)
                book = session.get(Book, s.book_id)
                msg_count = session.scalar(
                    select(func.count(ChatMessage.id)).where(ChatMessage.session_id == s.id)
                ) or 0
                results.append({
                    "id": s.id,
                    "title": s.title or f"Conversation with {char.name if char else 'Character'}",
                    "book_id": s.book_id,
                    "book_title": book.title if book else "Unknown",
                    "character_id": s.character_id,
                    "character_name": char.name if char else "Character",
                    "character_avatar_asset_id": char.avatar_asset_id if char else None,
                    "spoiler_policy": s.spoiler_policy,
                    "message_count": msg_count,
                    "latest_emotion_state": s.latest_emotion_state or {},
                    "last_message_at": s.last_message_at.isoformat() if s.last_message_at else None,
                    "created_at": s.created_at.isoformat() if s.created_at else None,
                })
            return results

    def create_conversation(
        self,
        auth_user: AuthenticatedUser | None,
        character_id: str,
        *,
        title: str | None = None,
        spoiler_policy: str = "cautious",
    ) -> dict[str, Any]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            char = session.get(CharacterProfileRecord, character_id)
            if char is None:
                char = session.scalar(
                    select(CharacterProfileRecord).where(
                        CharacterProfileRecord.stable_character_key == character_id
                    )
                )
            if char is None:
                raise NotFoundError("Character not found.")

            book = session.get(Book, char.book_id)
            if book and book.owner_user_id != user.id and book.visibility != "featured":
                raise ForbiddenError("You cannot start a conversation with this character.")

            # Per-user state
            user_state = session.scalar(
                select(UserCharacterState).where(
                    UserCharacterState.user_id == user.id,
                    UserCharacterState.character_id == char.id,
                )
            )
            init_psi = user_state.psi_parameters if user_state else char.psi_parameters
            init_emotions = user_state.emotion_state if user_state else char.emotion_state

            chat_session = ChatSession(
                owner_user_id=user.id,
                book_id=char.book_id,
                character_id=char.id,
                title=title or f"Chat with {char.name}",
                spoiler_policy=spoiler_policy,
                latest_psi_parameters=init_psi or {},
                latest_emotion_state=init_emotions or {},
                last_message_at=utc_now(),
            )
            session.add(chat_session)
            session.flush()

            return {
                "id": chat_session.id,
                "title": chat_session.title,
                "book_id": chat_session.book_id,
                "character_id": chat_session.character_id,
                "character_name": char.name,
                "spoiler_policy": chat_session.spoiler_policy,
                "latest_emotion_state": chat_session.latest_emotion_state,
                "created_at": chat_session.created_at.isoformat(),
            }

    def get_conversation_messages(
        self, auth_user: AuthenticatedUser | None, session_id: str
    ) -> list[dict[str, Any]]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            s = session.get(ChatSession, session_id)
            if s is None:
                raise NotFoundError("Conversation session not found.")

            if s.owner_user_id != user.id:
                raise ForbiddenError("You do not have access to this conversation.")

            messages = session.scalars(
                select(ChatMessage)
                .where(ChatMessage.session_id == s.id)
                .order_by(ChatMessage.sequence_number.asc())
            ).all()

            return [
                {
                    "id": m.id,
                    "session_id": m.session_id,
                    "role": m.role.value,
                    "content": m.content,
                    "input_modality": m.input_modality,
                    "citations": m.citations or [],
                    "sequence_number": m.sequence_number,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                }
                for m in messages
            ]

    def send_message(
        self,
        auth_user: AuthenticatedUser | None,
        session_id: str,
        *,
        content: str,
        input_modality: str = "text",
        llm_provider: str | None = None,
    ) -> dict[str, Any]:
        cleaned_content = content.strip()
        if not cleaned_content:
            raise BadRequestError("Message content cannot be empty.")

        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            chat_session = session.get(ChatSession, session_id)
            if chat_session is None:
                raise NotFoundError("Conversation not found.")

            if chat_session.owner_user_id != user.id:
                raise ForbiddenError("You cannot send messages to this conversation.")

            char = session.get(CharacterProfileRecord, chat_session.character_id)
            if char is None:
                raise NotFoundError("Character for this conversation no longer exists.")

            # Load or initialize per-user state
            user_state = session.scalar(
                select(UserCharacterState).where(
                    UserCharacterState.user_id == user.id,
                    UserCharacterState.character_id == char.id,
                )
            )
            if user_state is None:
                user_state = UserCharacterState(
                    user_id=user.id,
                    character_id=char.id,
                    psi_parameters=char.psi_parameters or {},
                    emotion_state=char.emotion_state or {},
                )
                session.add(user_state)
                session.flush()

            # Load existing messages
            existing_messages = session.scalars(
                select(ChatMessage)
                .where(ChatMessage.session_id == chat_session.id)
                .order_by(ChatMessage.sequence_number.asc())
            ).all()

            next_seq = len(existing_messages) + 1

            # Insert user message
            user_msg = ChatMessage(
                session_id=chat_session.id,
                role=ChatRole.user,
                content=cleaned_content,
                sequence_number=next_seq,
                input_modality=input_modality,
            )
            session.add(user_msg)
            session.flush()

            # Load memories for this user & character
            memories = session.scalars(
                select(CharacterMemory)
                .where(
                    CharacterMemory.owner_user_id == user.id,
                    CharacterMemory.character_id == char.id,
                )
                .order_by(CharacterMemory.created_at.asc())
            ).all()
            memory_facts = [m.fact for m in memories]

            # Format history for prompt
            formatted_history = "\n".join(
                f"{'User' if m.role == ChatRole.user else char.name}: {m.content}"
                for m in existing_messages[-10:]  # last 10 turns
            )
            if formatted_history:
                formatted_history += f"\nUser: {cleaned_content}"
            else:
                formatted_history = f"User: {cleaned_content}"

            # RAG passage retrieval with spoiler boundary protection
            policy = chat_session.spoiler_policy or "cautious"
            max_chapter = None
            if policy == "no_spoilers":
                max_chapter = 1
            elif policy == "cautious":
                max_chapter = 3

            retrieved = self.retriever.retrieve(
                session,
                book_id=chat_session.book_id,
                query=cleaned_content,
                spoiler_policy=policy,
                max_allowed_chapter=max_chapter,
                top_k=3,
            )

            citations = [
                {
                    "chapter_order": p.chapter_order,
                    "chapter_title": p.chapter_title,
                    "snippet": p.content[:200] + "..." if len(p.content) > 200 else p.content,
                    "similarity": round(float(p.similarity), 3),
                }
                for p in retrieved
            ]
            passages_context = "\n\n".join(
                f"[{p.chapter_title} (Chapter {p.chapter_order})]: {p.content}"
                for p in retrieved
            )

            char_json_dict = {
                "id": char.stable_character_key or char.id,
                "name": char.name,
                "personality": char.personality,
                "key_events": char.key_events or [],
                "relationships": char.relationships or [],
            }
            system_prompt, user_prompt = chat_prompt(
                character_json=json.dumps(char_json_dict),
                chat_history=formatted_history,
                factual_memories="\n".join(f"- {f}" for f in memory_facts) if memory_facts else "None yet.",
                psi_parameters=json.dumps(user_state.psi_parameters),
                emotion_state=json.dumps(user_state.emotion_state),
                latest_message=cleaned_content,
                book_passages=passages_context,
            )

            provider = get_llm_provider(
                self.settings,
                provider_name=llm_provider or self.settings.llm_provider,
            )

            raw_response = provider.generate_json(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            )
            data = parse_json_response(raw_response)

            reply_text = data.get("reply") or data.get("response", "...")
            new_psi = data.get("updated_psi") or user_state.psi_parameters
            new_emotions = data.get("updated_emotion_state") or user_state.emotion_state

            # Update user state
            user_state.psi_parameters = new_psi
            user_state.emotion_state = new_emotions
            user_state.updated_at = utc_now()

            # Update session
            chat_session.latest_psi_parameters = new_psi
            chat_session.latest_emotion_state = new_emotions
            chat_session.last_message_at = utc_now()

            # Save assistant message
            assistant_msg = ChatMessage(
                session_id=chat_session.id,
                role=ChatRole.assistant,
                content=reply_text,
                sequence_number=next_seq + 1,
                input_modality="text",
                citations=citations,
            )
            session.add(assistant_msg)
            session.flush()

            # Optional fact extraction
            try:
                fact_sys, fact_user = fact_extraction_prompt(
                    chat_history=formatted_history,
                    user_message=cleaned_content,
                    character_response=reply_text,
                )
                fact_raw = provider.generate_json(
                    system_prompt=fact_sys,
                    user_prompt=fact_user,
                )
                fact_data = parse_json_response(fact_raw)
                extracted_facts = fact_data.get("facts", [])
                for f in extracted_facts:
                    clean_f = str(f).strip()
                    if clean_f and clean_f not in memory_facts:
                        session.add(
                            CharacterMemory(
                                owner_user_id=user.id,
                                book_id=chat_session.book_id,
                                character_id=char.id,
                                session_id=chat_session.id,
                                fact=clean_f,
                            )
                        )
                        memory_facts.append(clean_f)
            except Exception as exc:
                logger.warning("Fact extraction skipped due to error: %s", exc)

            session.flush()

            return {
                "session_id": chat_session.id,
                "user_message_id": user_msg.id,
                "assistant_message_id": assistant_msg.id,
                "response": reply_text,
                "citations": citations,
                "character": {
                    "id": char.id,
                    "name": char.name,
                    "role": char.role,
                },
                "updated_state": {
                    "emotion_state": new_emotions,
                    "psi_parameters": new_psi,
                },
                "memories": memory_facts,
            }

    def synthesize_message_audio(
        self,
        auth_user: AuthenticatedUser | None,
        session_id: str,
        message_id: str,
    ) -> tuple[bytes, str, float]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            chat_session = session.get(ChatSession, session_id)
            if chat_session is None:
                raise NotFoundError("Conversation not found.")

            role_record = session.scalar(
                select(UserRole).where(UserRole.user_id == user.id)
            )
            is_admin = bool(role_record and role_record.role == "admin")
            if chat_session.owner_user_id != user.id and not is_admin:
                raise ForbiddenError("You cannot access this conversation's audio.")

            msg = session.get(ChatMessage, message_id)
            if msg is None or msg.session_id != chat_session.id:
                raise NotFoundError("Message not found in this conversation.")

            char = session.get(CharacterProfileRecord, chat_session.character_id)
            voice = "nova"
            if char and isinstance(char.psi_parameters, dict):
                voice = char.psi_parameters.get("voice", "nova")

            return self.voice_service.synthesize_speech(msg.content, voice=voice)

    def execute_voice_turn(
        self,
        auth_user: AuthenticatedUser | None,
        session_id: str,
        *,
        speech_text: str | None = None,
        audio_bytes: bytes | None = None,
        filename: str = "speech.wav",
        llm_provider: str | None = None,
    ) -> dict[str, Any]:
        transcript = (speech_text or "").strip()
        if not transcript and audio_bytes:
            transcript = self.voice_service.transcribe_audio(audio_bytes, filename=filename)

        if not transcript:
            raise BadRequestError("Speech text or audio payload is required.")

        result = self.send_message(
            auth_user,
            session_id,
            content=transcript,
            input_modality="voice",
            llm_provider=llm_provider,
        )

        audio_bytes_out, mime_type, duration = self.voice_service.synthesize_speech(result["response"])
        result["audio"] = {
            "mime_type": mime_type,
            "duration": duration,
            "base64_data": base64.b64encode(audio_bytes_out).decode("ascii"),
            "speech_text": transcript,
        }
        return result

    def delete_conversation(self, auth_user: AuthenticatedUser | None, session_id: str) -> None:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            s = session.get(ChatSession, session_id)
            if s is None:
                raise NotFoundError("Conversation not found.")

            if s.owner_user_id != user.id:
                raise ForbiddenError("You cannot delete this conversation.")

            session.delete(s)
            session.flush()

    # --- Administrator Operations ---

    def require_admin(self, session: Session, user: UserAccount) -> None:
        role_record = session.scalar(
            select(UserRole).where(UserRole.user_id == user.id)
        )
        if not role_record or role_record.role != "admin":
            raise ForbiddenError("Administrator privileges required.")

    def get_admin_overview(self, auth_user: AuthenticatedUser | None) -> dict[str, Any]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            self.require_admin(session, user)

            total_users = session.scalar(select(func.count(UserAccount.id))) or 0
            total_books = session.scalar(select(func.count(Book.id))) or 0
            total_characters = session.scalar(select(func.count(CharacterProfileRecord.id))) or 0
            total_conversations = session.scalar(select(func.count(ChatSession.id))) or 0
            total_messages = session.scalar(select(func.count(ChatMessage.id))) or 0
            active_jobs = session.scalar(
                select(func.count(ProcessingJob.id)).where(ProcessingJob.status.in_(["queued", "processing"]))
            ) or 0
            failed_jobs = session.scalar(
                select(func.count(ProcessingJob.id)).where(ProcessingJob.status == "failed")
            ) or 0

            recent_jobs = session.scalars(
                select(ProcessingJob).order_by(ProcessingJob.created_at.desc()).limit(5)
            ).all()

            return {
                "health": "healthy",
                "counts": {
                    "users": total_users,
                    "books": total_books,
                    "characters": total_characters,
                    "conversations": total_conversations,
                    "messages": total_messages,
                    "active_jobs": active_jobs,
                    "failed_jobs": failed_jobs,
                },
                "recent_jobs": [
                    {
                        "id": j.id,
                        "status": j.status,
                        "stage": j.stage,
                        "progress": j.progress,
                        "document_type": j.document_type,
                        "inferred_title": j.inferred_title,
                        "error_message": j.error_message,
                        "created_at": j.created_at.isoformat() if j.created_at else None,
                    }
                    for j in recent_jobs
                ],
            }

    def admin_list_jobs(
        self, auth_user: AuthenticatedUser | None, status: str | None = None
    ) -> list[dict[str, Any]]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            self.require_admin(session, user)

            stmt = select(ProcessingJob).order_by(ProcessingJob.created_at.desc())
            if status:
                stmt = stmt.where(ProcessingJob.status == status)
            jobs = session.scalars(stmt.limit(50)).all()

            return [
                {
                    "id": j.id,
                    "status": j.status,
                    "stage": j.stage,
                    "progress": j.progress,
                    "document_type": j.document_type,
                    "confidence": j.confidence,
                    "inferred_title": j.inferred_title,
                    "inferred_author": j.inferred_author,
                    "book_id": j.book_id,
                    "error_message": j.error_message,
                    "created_at": j.created_at.isoformat() if j.created_at else None,
                    "updated_at": j.updated_at.isoformat() if j.updated_at else None,
                }
                for j in jobs
            ]

    def admin_retry_job(self, auth_user: AuthenticatedUser | None, job_id: str) -> dict[str, Any]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            self.require_admin(session, user)

            job = session.get(ProcessingJob, job_id)
            if job is None:
                raise NotFoundError("Processing job not found.")

            job.status = "queued"
            job.stage = "retrying"
            job.progress = 10
            job.error_message = None
            session.flush()

            return {
                "id": job.id,
                "status": job.status,
                "message": "Job queued for retry.",
            }

    def admin_list_books(self, auth_user: AuthenticatedUser | None) -> list[dict[str, Any]]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            self.require_admin(session, user)

            books = session.scalars(select(Book).order_by(Book.created_at.desc())).all()
            results = []
            for b in books:
                owner = session.get(UserAccount, b.owner_user_id)
                char_count = session.scalar(
                    select(func.count(CharacterProfileRecord.id)).where(CharacterProfileRecord.book_id == b.id)
                ) or 0
                results.append({
                    "id": b.id,
                    "title": b.title,
                    "author": b.author,
                    "visibility": b.visibility,
                    "source_type": b.source_type,
                    "processing_status": b.processing_status.value,
                    "owner_email": owner.email if owner else "Unknown",
                    "character_count": char_count,
                    "created_at": b.created_at.isoformat() if b.created_at else None,
                })
            return results

    def admin_update_book(
        self, auth_user: AuthenticatedUser | None, book_id: str, updates: dict[str, Any]
    ) -> dict[str, Any]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            self.require_admin(session, user)

            book = session.get(Book, book_id)
            if book is None:
                raise NotFoundError("Book not found.")

            if "visibility" in updates:
                new_vis = str(updates["visibility"]).lower()
                if new_vis in ("public", "private", "featured"):
                    book.visibility = new_vis
            if "title" in updates and updates["title"]:
                book.title = str(updates["title"]).strip()
            if "author" in updates:
                book.author = str(updates["author"]).strip() or None

            session.flush()
            return {
                "id": book.id,
                "title": book.title,
                "author": book.author,
                "visibility": book.visibility,
                "processing_status": book.processing_status.value,
            }

    def admin_list_users(self, auth_user: AuthenticatedUser | None) -> list[dict[str, Any]]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            self.require_admin(session, user)

            users = session.scalars(select(UserAccount).order_by(UserAccount.created_at.desc())).all()
            results = []
            for u in users:
                role_rec = session.scalar(select(UserRole).where(UserRole.user_id == u.id))
                role = role_rec.role if role_rec else "user"
                book_count = session.scalar(
                    select(func.count(Book.id)).where(Book.owner_user_id == u.id)
                ) or 0
                results.append({
                    "id": u.id,
                    "email": u.email,
                    "display_name": u.display_name,
                    "role": role,
                    "book_count": book_count,
                    "created_at": u.created_at.isoformat() if u.created_at else None,
                })
            return results

    def admin_update_user_role(
        self, auth_user: AuthenticatedUser | None, target_user_id: str, new_role: str
    ) -> dict[str, Any]:
        with self.db.session_scope() as session:
            user = self.resolve_user(session, auth_user)
            self.require_admin(session, user)

            if new_role not in ("admin", "user"):
                raise BadRequestError("Role must be 'admin' or 'user'.")

            target_user = session.get(UserAccount, target_user_id)
            if target_user is None:
                raise NotFoundError("Target user not found.")

            role_rec = session.scalar(select(UserRole).where(UserRole.user_id == target_user.id))
            if role_rec is None:
                role_rec = UserRole(user_id=target_user.id, role=new_role)
                session.add(role_rec)
            else:
                role_rec.role = new_role

            session.flush()
            return {
                "user_id": target_user.id,
                "email": target_user.email,
                "role": role_rec.role,
            }
