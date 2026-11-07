# Qdrant Migration Tracker

## Goal

Replace all ChromaDB runtime usage and establish the first clean Qdrant-based retrieval layer.

## Completed In This Pass

- Removed ChromaDB from the backend runtime wiring.
- Deleted the old Chroma repository implementation.
- Removed the old persisted Chroma storage directory.
- Removed `chromadb` and `overrides` from backend dependencies.
- Added `qdrant-client` to backend dependencies.
- Added Qdrant configuration to backend settings and `.env.example`.
- Added embedding provider abstraction for:
  - OpenAI
  - Gemini
- Added semantic chunking utility.
- Added Qdrant repository for book chunk storage and retrieval.
- Added semantic context service to:
  - chunk text
  - create embeddings
  - store vectors
  - retrieve relevant excerpts
- Updated character extraction to index source text into Qdrant.
- Updated chat to retrieve semantically relevant excerpts from Qdrant.
- Updated prompts so retrieval results can ground the character response.
- Updated health output and startup banner for the new vector stack.
- Updated backend docs to reflect the new architecture.

## Deliberate Decisions

- PostgreSQL stays the only source of truth for application data.
- Qdrant is only used for vector retrieval, not for chat/session storage.
- The backend now assumes PostgreSQL is required because the Chroma fallback path is gone.
- Semantic indexing failures do not block character extraction; they degrade retrieval instead of breaking the whole app.

## Still Worth Doing Next

- Add a reindex command for books that already exist in PostgreSQL.
- Add background jobs for extraction and indexing.
- Add backend endpoints for listing books, sessions, and messages.
- Add tests for:
  - chunk indexing
  - filtered retrieval
  - prompt grounding behavior
  - failure cases when Qdrant is unavailable
- Add observability around Qdrant and embedding latency.
