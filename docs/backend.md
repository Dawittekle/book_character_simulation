# Book Character Simulation - Backend Documentation

This backend now uses a clean split between application data and retrieval data:

- PostgreSQL is the source of truth for users, books, characters, chat sessions, chat messages, and factual memories.
- Qdrant is the vector database for semantically searchable book chunks.

ChromaDB is no longer part of the runtime.

## Architecture & Tech Stack

- **Framework**: Flask
- **Relational Database**: PostgreSQL via SQLAlchemy and Alembic
- **Authentication**: Supabase Auth with bearer-token verification
- **Vector Database**: Qdrant
- **LLM Providers**: OpenAI and Gemini
- **Embedding Providers**: OpenAI and Gemini
- **PDF Extraction**: PyMuPDF

## Runtime Flow

### 1. Character extraction

1. The frontend sends text or a PDF to `POST /api/extract-characters`.
2. The backend extracts raw text when a PDF is uploaded.
3. The backend hashes the text into `text_id`.
4. The backend checks PostgreSQL for already extracted characters for that user and source text.
5. If they already exist, they are returned.
6. If not, the selected LLM extracts the character profiles.
7. Character profiles are stored in PostgreSQL.
8. The extracted text is chunked and indexed into Qdrant with embeddings.

### 2. Chat

1. The frontend sends a message to `POST /api/chat/<character_id>`.
2. The backend loads the character, session, and memories from PostgreSQL.
3. The backend embeds the incoming user message.
4. Qdrant returns the most relevant chunks from the book for that user and `text_id`.
5. The prompt combines:
   - character profile
   - chat history
   - factual memories
   - retrieved source excerpts
6. The LLM replies in character and updates psi/emotion state.
7. Factual memories are extracted and persisted into PostgreSQL.

## Current Important Modules

- `app.py`
  Composes the Flask app, database manager, auth layer, relational persistence, and semantic retrieval services.
- `services/character_service.py`
  Owns character extraction and triggers semantic indexing into Qdrant.
- `services/chat_service.py`
  Owns chat continuity, factual memory updates, and semantic retrieval during conversation.
- `services/semantic_context_service.py`
  Chunks source text, creates embeddings, indexes Qdrant points, and retrieves relevant excerpts.
- `repositories/relational.py`
  Encapsulates PostgreSQL access.
- `repositories/qdrant.py`
  Encapsulates Qdrant collection management, point upserts, and filtered retrieval.

## Health Output

`GET /api/health` now reports:

- LLM provider readiness
- relational database configuration and connectivity
- embedding provider readiness
- Qdrant configuration and connectivity
- whether semantic retrieval is effectively enabled
