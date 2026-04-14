from __future__ import annotations

import json
import logging
from pathlib import Path

import chromadb
from chromadb.config import Settings as ChromaSettings
from chromadb.telemetry.product import ProductTelemetryClient, ProductTelemetryEvent
from overrides import override

from ..schemas.character import CharacterProfile
from ..schemas.chat import ChatSessionState, FactualMemoryRecord

logger = logging.getLogger(__name__)


def _placeholder_embeddings(count: int) -> list[list[float]]:
    return [[0.0] for _ in range(count)]


class NoOpProductTelemetryClient(ProductTelemetryClient):
    @override
    def capture(self, event: ProductTelemetryEvent) -> None:
        return None


class _BaseChromaRepository:
    def __init__(self, db_path: Path):
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


class ChromaCharacterRepository(_BaseChromaRepository):
    def __init__(self, db_path: Path):
        super().__init__(db_path)
        self.collection = self.client.get_or_create_collection(name="characters")

    def store_characters(self, text_id: str, characters: list[CharacterProfile]) -> None:
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
        results = self.collection.get(where={"text_id": text_id}, include=["metadatas"])
        if not results["ids"]:
            return []
        return [
            CharacterProfile.model_validate(json.loads(metadata["raw_data"]))
            for metadata in results["metadatas"]
        ]

    def get_character_by_id(self, text_id: str, character_id: str) -> CharacterProfile | None:
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
        self.collection = self.client.get_or_create_collection(name="chat_sessions")

    def save(self, session: ChatSessionState) -> None:
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
        result = self.collection.get(ids=[session_id], include=["documents"])
        if not result["ids"]:
            return None
        return ChatSessionState.model_validate_json(result["documents"][0])


class ChromaFactualMemoryRepository(_BaseChromaRepository):
    def __init__(self, db_path: Path):
        super().__init__(db_path)
        self.collection = self.client.get_or_create_collection(name="factual_memories")

    def list_for_character(self, character_id: str, text_id: str) -> list[FactualMemoryRecord]:
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
        self.collection.upsert(
            ids=[memory.id],
            documents=[memory.fact],
            embeddings=_placeholder_embeddings(1),
            metadatas=[memory.model_dump(mode="json")],
        )
