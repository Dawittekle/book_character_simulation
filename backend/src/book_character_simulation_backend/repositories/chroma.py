from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

try:
    import chromadb
    from chromadb.config import Settings as ChromaSettings
    from chromadb.telemetry.product import ProductTelemetryClient, ProductTelemetryEvent
    _CHROMA_AVAILABLE = True
except ImportError:  # pragma: no cover
    _CHROMA_AVAILABLE = False
    ProductTelemetryClient = object  # type: ignore
    ProductTelemetryEvent = object  # type: ignore

from overrides import override

from ..schemas.character import CharacterProfile
from ..schemas.chat import ChatSessionState, FactualMemoryRecord

logger = logging.getLogger(__name__)


def _placeholder_embeddings(count: int, dimension: int = 384) -> list[list[float]]:
    return [[0.0] * dimension for _ in range(count)]


if _CHROMA_AVAILABLE:
    class NoOpProductTelemetryClient(ProductTelemetryClient):  # type: ignore
        @override
        def capture(self, event: Any) -> None:
            return None
else:
    class NoOpProductTelemetryClient:  # type: ignore
        def capture(self, event: Any) -> None:
            return None


class _BaseChromaRepository:
    def __init__(self, db_path: Path):
        self._mem_store: dict[str, Any] = {}
        if _CHROMA_AVAILABLE:
            db_path.mkdir(parents=True, exist_ok=True)
            self.client = chromadb.PersistentClient(
                path=str(db_path),
                settings=ChromaSettings(
                    anonymized_telemetry=False,
                    chroma_product_telemetry_impl=(
                        "book_character_simulation_backend.repositories.chroma."
                        "NoOpProductTelemetryClient"
                    ),
                ),
            )
        else:
            self.client = None


class ChromaCharacterRepository(_BaseChromaRepository):
    def __init__(self, db_path: Path):
        super().__init__(db_path)
        self.collection = self.client.get_or_create_collection(name="characters") if self.client else None

    def store_characters(self, text_id: str, characters: list[CharacterProfile]) -> None:
        if self.collection is None:
            self._mem_store[text_id] = characters
            return

        documents: list[str] = []
        ids: list[str] = []
        metadatas: list[dict] = []

        for character in characters:
            payload = character.model_dump(mode="json")
            documents.append(json.dumps(payload))
            ids.append(character.id)
            metadatas.append(
                {
                    "text_id": text_id,
                    "character_id": character.id,
                    "character_name": character.name,
                    "raw_data": json.dumps(payload),
                }
            )

        self.collection.upsert(
            documents=documents,
            embeddings=_placeholder_embeddings(len(ids)),
            ids=ids,
            metadatas=metadatas,
        )
        logger.info("Stored %s characters for text_id=%s", len(characters), text_id)

    def get_characters(self, text_id: str) -> list[CharacterProfile]:
        if self.collection is None:
            return self._mem_store.get(text_id, [])

        results = self.collection.get(where={"text_id": text_id}, include=["metadatas"])
        if not results["ids"]:
            return []
        return [
            CharacterProfile.model_validate(json.loads(metadata["raw_data"]))
            for metadata in results["metadatas"]
        ]

    def get_character_by_id(self, text_id: str, character_id: str) -> CharacterProfile | None:
        if self.collection is None:
            chars = self._mem_store.get(text_id, [])
            for c in chars:
                if c.id == character_id:
                    return c
            return None

        results = self.collection.get(
            where={
                "$and": [
                    {"text_id": {"$eq": text_id}},
                    {"character_id": {"$eq": character_id}},
                ]
            },
            include=["metadatas"],
        )
        if not results["ids"]:
            return None
        return CharacterProfile.model_validate(
            json.loads(results["metadatas"][0]["raw_data"])
        )


class ChromaSessionRepository(_BaseChromaRepository):
    def __init__(self, db_path: Path):
        super().__init__(db_path)
        self.collection = self.client.get_or_create_collection(name="chat_sessions") if self.client else None

    def save(self, session: ChatSessionState) -> None:
        if self.collection is None:
            self._mem_store[session.id] = session
            return

        payload = session.model_dump(mode="json")
        self.collection.upsert(
            ids=[session.id],
            documents=[json.dumps(payload)],
            embeddings=_placeholder_embeddings(1),
            metadatas=[
                {
                    "character_id": session.character_id,
                    "text_id": session.text_id,
                    "created_at": session.created_at.isoformat(),
                    "last_updated": session.last_updated.isoformat(),
                }
            ],
        )

    def get(self, session_id: str) -> ChatSessionState | None:
        if self.collection is None:
            return self._mem_store.get(session_id)

        result = self.collection.get(ids=[session_id], include=["documents"])
        if not result["ids"]:
            return None
        return ChatSessionState.model_validate_json(result["documents"][0])


class ChromaFactualMemoryRepository(_BaseChromaRepository):
    def __init__(self, db_path: Path):
        super().__init__(db_path)
        self.collection = self.client.get_or_create_collection(name="factual_memories") if self.client else None

    def list_for_character(self, character_id: str, text_id: str) -> list[FactualMemoryRecord]:
        if self.collection is None:
            return [m for m in self._mem_store.values() if m.character_id == character_id and m.text_id == text_id]

        result = self.collection.get(
            where={
                "$and": [
                    {"character_id": {"$eq": character_id}},
                    {"text_id": {"$eq": text_id}},
                ]
            },
            include=["metadatas"],
        )
        if not result["ids"]:
            return []
        return [
            FactualMemoryRecord.model_validate(metadata)
            for metadata in result["metadatas"]
        ]

    def save(self, memory: FactualMemoryRecord) -> None:
        if self.collection is None:
            self._mem_store[memory.id] = memory
            return

        self.collection.upsert(
            ids=[memory.id],
            documents=[memory.fact],
            embeddings=_placeholder_embeddings(1),
            metadatas=[memory.model_dump(mode="json")],
        )
