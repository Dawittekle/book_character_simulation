# Comprehensive Research & Execution Plan: ChromaDB to Qdrant Cloud Migration

**Date**: 2026-11-15  
**Author**: Senior Software Developer & AI Engineer  
**Status**: Research & Plan Complete (Zero Code Changes Applied)  

---

## 1. Reality Reconciliation: Documentation vs. Actual Codebase

We performed an audit across the entire repository to reconcile previous migration-tracker claims against the actual running code:

| Component / Artifact | Claim in `docs/qdrant-migration-tracker.md` | Actual Codebase Reality | Required Action |
| :--- | :--- | :--- | :--- |
| **`ChromaDB` Dependencies** | "Removed `chromadb` and `overrides`" | `chromadb` was removed from `pyproject.toml`, but `overrides` remains. `chromadb` is still installed in `.venv`. | Remove `overrides` from `pyproject.toml`, remove Chroma imports from all services/tests. |
| **`qdrant-client` Dependency** | "Added `qdrant-client` to backend dependencies" | `qdrant-client` is installed in the local `.venv`, but is **missing from `pyproject.toml`** dependencies. | Add `qdrant-client>=1.12.0` to `dependencies` in `backend/pyproject.toml`. |
| **`repositories/chroma.py`** | "Deleted the old Chroma repository implementation" | **File still exists (`chroma.py`)** with `ChromaCharacterRepository`, `ChromaSessionRepository`, `ChromaFactualMemoryRepository`. | Remove `chroma.py` and replace runtime dependencies with PostgreSQL and Qdrant. |
| **`backend/chroma_db/`** | "Removed the old persisted Chroma storage directory" | **Directory and `chroma.sqlite3` still exist on disk.** | Keep backup, verify migration, and then remove safely. |
| **Configuration in `config.py`** | "Added Qdrant configuration to backend settings and `.env.example`" | **No Qdrant settings exist** in `Settings` or `from_env()`. `CHROMA_DB_PATH` is still loaded and defaulted. | Add `qdrant_url`, `qdrant_api_key`, `qdrant_collection`, `qdrant_timeout` to `Settings`; remove `chroma_db_path`. |
| **Retriever Implementation** | "Updated chat to retrieve from Qdrant" | `rag/retriever.py` was performing an **in-memory Python loop with `cosine_similarity`** across SQL `BookChunk` rows. | Replace in-memory scan with true Qdrant Cloud vector search and server-side filtering. |
| **Embedding Generation** | "OpenAI and Gemini embeddings configured" | `rag/embedding_provider.py` requested `text-embedding-004` which returned `404 NOT_FOUND`, silently falling back to a **128-dimensional deterministic hash** (`[0.057, 0.114, ...]`). | Update Gemini embedding to active `models/gemini-embedding-001` with configured dimensionality (1536). |
| **Legacy Backup Data** | "Chroma legacy backup stored in `chroma_legacy_backup.json`" | Confirmed: contains 4 legacy test characters and 2 memories with all-zero 384-dim placeholder vectors. | Relational data already exists in Postgres/SQLite; no live vector data is lost. |

---

## 2. Architecture & Data Boundaries

### 2.1 Storage Ownership Split
- **PostgreSQL / SQLite (Source of Truth)**:
  - Users (`users`, `profiles`, `user_roles`, `user_settings`)
  - Books & Chapters (`books`, `book_sources`, `book_chapters`)
  - Characters & Simulation (`characters`, `character_profile_evidence`, `character_state_events`, `user_character_states`)
  - Dialogue & Memories (`chat_sessions`, `chat_messages`, `character_memories`)
  - Reader telemetry (`reading_progress`, `reading_sessions`, `custom_shelves`, `shelf_books`)
- **Qdrant Cloud (Vector & Retrieval Engine)**:
  - Dense vector representations of `BookChunk` records
  - Search metadata and payload indexes for strict tenant isolation and spoiler prevention.

### 2.2 Qdrant Payload & Index Schema
Collection Name: `lorely_book_chunks` (configurable via `QDRANT_COLLECTION`)  
Vector Configuration:
- `size`: **1536** (Matches OpenAI `text-embedding-3-small` and configured `gemini-embedding-001` Matryoshka output dimension)
- `distance`: `Distance.COSINE`

#### Payload Fields & Indexing:
```json
{
  "chunk_id": "uuid-string",
  "book_id": "book-dostoevsky-white-nights",
  "owner_user_id": "user-uuid-or-system",
  "chapter_order": 1,
  "chapter_title": "Night One",
  "chunk_index": 0,
  "language": "en",
  "visibility": "featured",
  "content": "Text content of the excerpt...",
  "content_hash": "sha256-hash",
  "char_start": 0,
  "char_end": 568,
  "word_count": 95
}
```

#### Payload Indexes to create:
1. `book_id` -> `PayloadSchemaType.KEYWORD`
2. `owner_user_id` -> `PayloadSchemaType.KEYWORD`
3. `chapter_order` -> `PayloadSchemaType.INTEGER` (enables `Range(lte=max_allowed_chapter)` for zero-spoiler queries)
4. `language` -> `PayloadSchemaType.KEYWORD`
5. `visibility` -> `PayloadSchemaType.KEYWORD`

---

## 3. Vector Audit & Regeneration Strategy

### 3.1 Current Vector Audit
- Total existing chunks in database: **29 chunks** (11 seeded Dostoevsky chunks + 18 test upload chunks).
- Current embeddings in `book_chunks.embedding`:
  - Dimensions: **128** (all from fallback hash function `generate_deterministic_embedding`).
  - None are from a production neural embedding model.
- Chroma collections (`characters`, `chat_sessions`, `factual_memories`):
  - 0 actual embeddings on disk; legacy backup had all-zero vectors.

### 3.2 Embedding Regeneration & Backfill Pipeline
1. Fix `EmbeddingService` in `rag/embedding_provider.py`:
   - Point Gemini embedding to active model `models/gemini-embedding-001` with `output_dimensionality=1536`.
   - Support OpenAI `text-embedding-3-small` (1536).
   - In automated test mode (`APP_ENV=testing`), support hermetic execution via in-memory mock or 1536-dim deterministic vectors so tests do not incur network latency or API quotas.
2. Build an idempotent migration & backfill script: `backend/scripts/migrate_to_qdrant.py`:
   - Batched processing (batch size: 25 chunks).
   - Compute real 1536-dim embeddings for all existing `BookChunk` records.
   - Upsert points to Qdrant Cloud cluster with stable point IDs (`chunk.id` formatted as UUID).
   - Update `BookChunk.embedding_provider = "gemini"`, `embedding_model = "gemini-embedding-001"`, `embedding_dimensions = 1536` in relational database.
   - Verify counts: `Qdrant points count == database chunks count`.

---

## 4. Phased Execution Plan

```
Phase 1: Configuration & Dependencies
   ├── Add qdrant-client to pyproject.toml, remove overrides
   ├── Add QDRANT_URL, QDRANT_API_KEY, QDRANT_COLLECTION, QDRANT_TIMEOUT to Settings
   └── Update .env.example with empty placeholders

Phase 2: Qdrant Repository & Client Layer
   ├── Implement QdrantRepository (connection pool, retries, health check, collection init)
   ├── Create collection & payload indexes on startup / migration
   └── Handle cluster unreachable / downtime with graceful fallback

Phase 3: Real Vector Embedding Provider
   ├── Upgrade Gemini embedding to gemini-embedding-001 (dim=1536)
   └── Ensure unified 1536 dimension across Gemini & OpenAI

Phase 4: Spoiler-Aware Retrieval Engine
   ├── Refactor SpoilerAwareRetriever to query Qdrant Cloud directly
   ├── Use native Qdrant filter: book_id + owner isolation + chapter_order range
   └── Eliminate in-memory Python full-table scans

Phase 5: Data Migration & Backfill
   ├── Execute migrate_to_qdrant.py against live Qdrant cluster
   ├── Regenerate 1536-dim embeddings for all 29 chunks
   └── Verify collection stats and similarity search queries

Phase 6: Complete Removal of ChromaDB
   ├── Remove repositories/chroma.py and Chroma references in app.py
   ├── Update CharacterService & ChatService to rely exclusively on Relational DB & Qdrant
   ├── Clean up tests/conftest.py (remove temp_chroma_path)
   └── Remove backend/chroma_db/ storage directory

Phase 7: End-to-End Verification & Documentation
   ├── Run unit & integration test suites
   ├── Test upload -> chunk -> embed -> Qdrant index -> chat retrieval
   └── Update decision log and deployment documentation
```

---

## 5. Production Environment & Secrets Configuration

### Local Development (`backend/.env`)
```bash
QDRANT_URL=https://ffdc479f-58a4-4007-afee-34ceb3ebc8a6.sa-east-1-0.aws.cloud.qdrant.io:6333
QDRANT_API_KEY=<configured-cloud-api-key>
QDRANT_COLLECTION=lorely_book_chunks
QDRANT_TIMEOUT=10
```

### Production Deployment (Vercel & Render)
In production settings (e.g., Vercel Project Settings -> Environment Variables or Render Dashboard):
- `QDRANT_URL`: Cluster URL provided in cluster dashboard.
- `QDRANT_API_KEY`: Secret cluster API key.
- `QDRANT_COLLECTION`: `lorely_book_chunks`.
- `QDRANT_TIMEOUT`: `15` (seconds).
