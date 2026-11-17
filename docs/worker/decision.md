# Architecture & Project Decision Log

This log tracks all architectural, technical, and product decisions made for the Lorely platform.

---

## Log Format

Each decision entry follows this structure:
- **ID**: Sequential number (e.g., `DEC-001`)
- **Date**: Date of decision
- **Status**: `Proposed` | `Accepted` | `Superseded` | `Deprecated`
- **Context**: The background and problem statement
- **Decision**: The choice made
- **Rationale**: Why this option was selected
- **Consequences**: Implications, trade-offs, and follow-up work

---

## Decisions

### DEC-001: Project Evolution & Transition to Lorely Platform
- **Date**: 2026-11-07
- **Status**: Accepted
- **Context**: The initial project specification (`docs/Copy of Langchain Training Task.pdf`) outlined a simple prototype for extracting characters from uploaded text and chatting using Dörner's Psi Theory and ChromaDB. To make the platform production-ready, it required real multi-user support, authentication, an interactive reader, and persistent relational data.
- **Decision**: Transition from a basic script prototype to a full production architecture named **Lorely**, featuring a modular Flask REST backend, React 19 frontend, Alembic schema migrations, and a comprehensive reading/simulation ecosystem.
- **Rationale**: Standalone scripts and pure vector stores cannot reliably support user sessions, role-based access, book uploads, chapters, reading progress, and billing.
- **Consequences**: Replaced monolithic handlers with domain services (`CharacterService`, `ChatService`, `LorelyService`, `BookNarrationService`).

---

### DEC-002: Dual Database Strategy (SQLite Dev / Supabase PostgreSQL Prod)
- **Date**: 2026-11-08
- **Status**: Accepted
- **Context**: Developers need fast local offline testing without cloud network latency, while production requires cloud-native PostgreSQL with connection pooling, Row-Level Security (RLS), and pgvector.
- **Decision**: Use `DatabaseManager` with connection pooling supporting SQLite locally (`backend/lorely_local.db`) and PostgreSQL in production via Supabase pooler, unified under SQLAlchemy 2.0 and tracked with Alembic migrations.
- **Rationale**: Enables zero-friction local development, instant test execution, and full production fidelity when deployed to Supabase/Render.
- **Consequences**: Schema migrations must remain compatible with both PostgreSQL and SQLite syntax.

---

### DEC-003: Dörner's Psi Theory Emotional Engine & Memory Extraction
- **Date**: 2026-11-08
- **Status**: Accepted
- **Context**: Characters in standard LLM apps feel static and forget past context across sessions.
- **Decision**: Implement Dörner's Psi Theory with 6 psychological parameters (Valence, Arousal, Selection Threshold, Resolution Level, Goal-Directedness, Securing Rate) and 5 emotional states (Anger, Sadness, Pride, Joy, Bliss), dynamically updated per turn. Concurrently extract objective facts into `factual_memories`/`character_memories` for cross-session recall.
- **Rationale**: Gives characters psychologically realistic reactivity, mood shifts, and persistent recall of previous user interactions.
- **Consequences**: Adds secondary prompt passes for factual memory extraction and parameter computation; requires caching and efficient prompt engineering to maintain low latency.

---

### DEC-004: Multi-Adapter Reader Shell with Character Immersion
- **Date**: 2026-11-09
- **Status**: Accepted
- **Context**: Users read books in different formats (raw text, EPUB, PDF) and want reading tools alongside conversational simulation.
- **Decision**: Build `ReaderShell` in React with interchangeable format adapters (`TextReaderAdapter`, `PdfReaderAdapter`, `EpubReaderAdapter`), integrated TOC, reading progress sync, and an "Ask Character" drawer that passes active page text to the character.
- **Rationale**: Unifies the reading experience and allows characters to comment directly on what the user is currently reading without leaving the book.
- **Consequences**: Requires client-side format handling and syncing reading progress with backend tables (`reading_progress`, `reading_sessions`).

---

### DEC-005: Engineering Workflow & Documentation in `docs/worker`
- **Date**: 2026-11-15
- **Status**: Accepted
- **Context**: As development scales to production level, clear tracking of guidelines, architectural decisions, and research is essential.
- **Decision**: Standardize development tracking in `docs/worker/`:
  - `agent.md`: Operating principles (commit locally, never push, explain simply and concisely, research thoroughly).
  - `decision.md`: Living record of all architecture decisions.
  - `research/`: Dedicated technical research and benchmark studies (including BookFusion reverse engineering and database audits).
- **Rationale**: Keeps context persistent, clean, and directly accessible across development sessions.
- **Consequences**: All future tasks must log decisions here and update research files as new features are investigated.

---

### DEC-006: Harmonize Ingest Source Job IDs & Inspection Contract
- **Date**: 2026-11-15
- **Status**: Accepted
- **Context**: The `/books/inspect` endpoint returned `temp_source_id`, but `AddBookModal.jsx` looked up `inspectionResult.job_id`, causing `temp_source_id` to be undefined during ingestion confirmation and throwing a 400 error (`temp_source_id is required.`).
- **Decision**: Support both keys bi-directionally: return both `temp_source_id` and `job_id` from the backend service, and defensively extract `inspectionResult.temp_source_id || inspectionResult.job_id` in the frontend modal.
- **Rationale**: Ensures backward and forward compatibility between frontend components and API endpoints without brittle key assumptions.
- **Consequences**: Upload and ingestion pipeline is robust against either property name.

---

### DEC-007: Qdrant Cloud Configuration & Dependency Foundation (Phase 1)
- **Date**: 2026-11-15
- **Status**: Accepted
- **Context**: As part of migrating Lorely from local ChromaDB to Qdrant Cloud, the backend required formal dependency declaration and robust configuration management for Qdrant connection parameters.
- **Decision**: 
  1. Add `qdrant-client>=1.12.0,<2.0` to `backend/pyproject.toml` dependencies.
  2. Add `qdrant_url`, `qdrant_api_key`, `qdrant_collection` (default: `lorely_book_chunks`), and `qdrant_timeout` (default: 10s) to `Settings` in `config.py`.
  3. Update `backend/.env.example` with empty placeholders.
  4. Ensure `backend/.env` holds the cloud credentials safely while remaining completely gitignored.
- **Rationale**: Establishes a clean, typed configuration foundation with sensible defaults, strict environment variable cleaning, and zero secret leakage.
- **Consequences**: Downstream phases (QdrantRepository, Retriever, IngestionWorker) can safely consume strongly-typed Qdrant settings from `Settings`.

---

### DEC-008: Qdrant Vector Repository with Tenant Isolation & Spoiler Protection (Phase 2)
- **Date**: 2026-11-15
- **Status**: Accepted
- **Context**: Lorely requires a high-performance vector store repository for book chunk storage and retrieval that enforces multi-tenant isolation, chapter-based spoiler protection, deterministic point IDs, and payload indexing.
- **Decision**:
  1. Implement `QdrantRepository` in `backend/src/book_character_simulation_backend/repositories/qdrant.py`.
  2. Use 1536-dimensional Cosine similarity for the collection (`lorely_book_chunks`).
  3. Create payload indexes for `book_id` (keyword), `owner_user_id` (keyword), `chapter_order` (integer), `language` (keyword), and `visibility` (keyword).
  4. Generate deterministic, reproducible Qdrant point IDs using `uuid.uuid5(uuid.NAMESPACE_DNS, f"chunk:{chunk_id}")` so re-indexing the same chunk is idempotent.
  5. Enforce strict filter conditions on search:
     - `book_id` filter (must match target book).
     - Spoiler guard: `chapter_order <= max_allowed_chapter`.
     - Multi-tenant guard: match `owner_user_id` OR `visibility == "public"`.
  6. Provide `upsert_chunks`, `search` (via modern `client.query_points`), `delete_by_book_id`, `count_by_book`, and `health_check`.
- **Rationale**: Isolates vector storage cleanly behind a repository interface, ensuring relational data remains in Postgres/SQLite while vector indexing and retrieval leverage Qdrant Cloud's native filtering and indexing capabilities.
- **Consequences**: Unit-tested hermetically via `:memory:` client in `test_qdrant_repository.py`; ready for integration with embedding services (Phase 3) and retrieval engines (Phase 4).

---

### DEC-009: Real 1536-Dim Vector Embedding Provider (Phase 3)
- **Date**: 2026-11-17
- **Status**: Accepted
- **Context**: The embedding layer had two key issues:
  1. Gemini provider was hardcoded to call `text-embedding-004`, which returned `404 NOT_FOUND` on current Google GenAI SDK endpoints, silently failing to a 128-dimensional mock vector.
  2. The vector dimensionalities across providers were mismatched (128-dim mock, 768-dim legacy defaults, vs 1536-dim Qdrant Cloud collection).
- **Decision**:
  1. Standardize all vector embeddings in Lorely on **1536 dimensions** to match Qdrant Cloud collection configuration (`lorely_book_chunks`).
  2. Update the Gemini embedding provider to use `models/gemini-embedding-001` with `output_dimensionality=1536` via `google.genai.types.EmbedContentConfig`.
  3. Update OpenAI embedding provider to `text-embedding-3-small` (1536 dimensions).
  4. Standardize the deterministic offline fallback (`generate_deterministic_embedding`) to generate 1536-dimensional L2-normalized vectors for hermetic unit testing when `APP_ENV=testing` or when offline.
  5. Implement `embed_texts` with batching (slice size 64) and empty/whitespace text sanitization, preventing API validation errors.
  6. Add structured logging on API failures instead of silent exceptions.
  7. Expose `gemini_embedding_model`, `openai_embedding_model`, and `embedding_dimensions` in `Settings` and `.env.example`.
- **Rationale**: Eliminates the 404 embedding crash, guarantees mathematical compatibility with Qdrant Cloud collection's 1536-dim vector space, and significantly improves indexing throughput via batch embedding.
- **Consequences**: Downstream retrieval (Phase 4) and backfill migration (Phase 5) will produce and query consistent 1536-dimensional embeddings.

---

### DEC-010: True Qdrant Retrieval Engine with Hybrid RRF (Phase 4)
- **Date**: 2026-11-17
- **Status**: Accepted
- **Context**: `SpoilerAwareRetriever` previously performed in-memory Python table scans on SQL `BookChunk.embedding`, lacking native vector indexing and scaling poorly.
- **Decision**:
  1. Refactor `SpoilerAwareRetriever` to accept `QdrantRepository`.
  2. Implement primary vector retrieval directly via `qdrant_repo.search()`, enforcing multi-tenant isolation (`owner_user_id`, `is_public`) and chapter-based spoiler prevention (`chapter_order <= max_allowed_chapter`) natively in Qdrant's payload index filter.
  3. Combine Qdrant's vector similarity ranks with lexical scores (including bilingual Amharic-English literary term expansion) using Reciprocal Rank Fusion (RRF, $k=60$).
  4. Wire `QdrantRepository` into `LorelyService` and `IngestionWorker` so newly uploaded/ingested books automatically index chunks in Qdrant Cloud, and deleted books have their vector points pruned.
  5. Provide non-silent fallback to relational database chunks only when a book has 0 points in Qdrant (with explicit log warning for pending backfill/testing fixtures), ensuring no silent fallback occurs during normal operation.
- **Rationale**: Replaces $O(N)$ Python full-table scans with indexed, filtered vector searches executed natively in Qdrant Cloud in single-digit milliseconds, while preserving full backward compatibility for existing test fixtures.
- **Consequences**: Sets up Phase 5 (data migration & backfill script) to populate all existing books and chunks into Qdrant Cloud.

---

### DEC-011: Data Migration & Qdrant Cloud Vector Backfill (Phase 5)
- **Date**: 2026-11-17
- **Status**: Accepted
- **Context**: Existing books in `backend/lorely_local.db` (4 books, 29 chunks) contained outdated 128-dimensional mock vectors from the deprecated `text-embedding-004` fallback. Qdrant Cloud collection had 0 points and required complete backfill of real 1536-dimensional embeddings.
- **Decision**:
  1. Author `backend/scripts/migrate_to_qdrant.py` implementing batched, resumable, and idempotent backfill.
  2. Safely create a timestamped database backup (`lorely_local.db.backup.<timestamp>`) before modifying relational records.
  3. Batch-generate real 1536-dimensional embeddings using `models/gemini-embedding-001` via `EmbeddingService.embed_texts`.
  4. Update relational `BookChunk` records with `embedding_provider="gemini"`, `embedding_model="models/gemini-embedding-001"`, and `embedding_dimensions=1536`.
  5. Upsert all 29 chunks into Qdrant Cloud collection `lorely_book_chunks` with deterministic point IDs and payload metadata.
  6. Verify live that point counts in Qdrant Cloud equal database chunk count (29 / 29), and verify live retrieval and spoiler protection on all books.
- **Rationale**: Completely populates Qdrant Cloud with production-grade vectors and guarantees parity between the relational database and the vector search engine.
- **Consequences**: Qdrant Cloud is now the live, active vector store for all existing books. We can proceed to Phase 6 (complete ChromaDB removal).

## DEC-012: Complete ChromaDB Removal and Repository Streamlining (Phase 6)
- **Context**: In Phase 5, all 29 book chunks across the 4 books were backfilled into Qdrant Cloud with 100% data parity and verified via live cosine search. Relational SQLite/PostgreSQL is the single source of truth for users, books, chapters, characters, chat sessions, and factual memories. ChromaDB prototype stores (which held zero-vector placeholder embeddings) are now completely obsolete.
- **Decision**:
  1. Deleted `backend/src/book_character_simulation_backend/repositories/chroma.py`.
  2. Cleaned `repositories/__init__.py` to export only `QdrantRepository`, `QdrantChunkRecord`, `ScoredChunk`, and `RelationalRepository`.
  3. Streamlined `CharacterService` and `ChatService` to persist and retrieve solely from `RelationalPersistenceService` without redundant unauthenticated Chroma fallbacks.
  4. Streamlined `create_app` in `backend/src/book_character_simulation_backend/app.py` to instantiate and inject only `relational_persistence_service` and `lorely_service`.
  5. Removed `chroma_db_path` and `ANONYMIZED_TELEMETRY` from `Settings` and `from_env()` in `backend/src/book_character_simulation_backend/config.py`.
  6. Removed `CHROMA_DB_PATH` and `ANONYMIZED_TELEMETRY` from `backend/.env` and `backend/.env.example`.
  7. Removed unused dependency `overrides>=7.7,<8.0` from `backend/pyproject.toml` and uninstalled `chromadb` and `overrides` from the virtual environment.
  8. Removed obsolete local directory `backend/chroma_db/` and updated `docker-compose.yml` to mount `./backend/storage` instead of `./backend/chroma_db`.
  9. Updated `backend/tests/conftest.py` and `backend/tests/unit/test_storage_service.py` to remove `chroma_db_path`.
  10. Updated `backend/README.md` and frontend telemetry/marketing labels to reflect Qdrant Cloud vector memory namespaces.
- **Consequences**: Zero ChromaDB dependencies or files remain in the application. All 46 backend unit tests pass in 1.54s with zero regressions. The backend codebase is significantly cleaner and production-ready.

## DEC-013: Production Hardening, Observability, Health Checks, and E2E Live Verification (Phase 7)
- **Context**: With ChromaDB completely removed and Qdrant Cloud backfilled with 29 book chunks, Phase 7 establishes production resilience, latency observability, cluster health reporting, and live integration testing.
- **Decision**:
  1. Enhanced `QdrantRepository`:
     - Added 3x automatic retries with exponential backoff on transient network errors in `upsert_chunks`.
     - Added 2x automatic retries on network hiccups in `search`.
     - Measured and logged millisecond latency for upserts and searches.
  2. Updated `api/routes.py`:
     - Added `vector_store_configured`, `vector_store_connected`, and `vector_collection` to `GET /api/health`.
  3. Enhanced `SpoilerAwareRetriever`:
     - Added timing measurements and structured logs for hybrid RRF retrieval passes.
  4. Added `backend/tests/integration/test_qdrant_cloud_e2e.py`:
     - Verified live health check reporting.
     - Verified live Qdrant Cloud point count (>= 29 points).
     - Verified live chapter spoiler gating (`max_allowed_chapter=1` strictly excludes late chapters).
     - Verified live multi-tenant user isolation.
     - Verified graceful downtime fallback when Qdrant is unconfigured or unreachable.
- **Consequences**: The Qdrant Cloud vector architecture is resilient to transient cloud network disconnects, fully observable in logs and health checks, and verified end-to-end against the live cluster.

## DEC-014: SQLite Relative Path Auto-Anchoring and Startup Hardening
- **Context**: When running `./run.sh`, the script changes directory into `backend/` before launching `run.py`. Because `DATABASE_URL` was specified as `sqlite:///backend/lorely_local.db` or relative to root, SQLite searched for `backend/backend/lorely_local.db` and threw `sqlite3.OperationalError: unable to open database file`. Additionally, `google-genai` emitted an `ArbitraryTypeWarning`, and `app.py` previously ran destructive demo purge on every startup in development.
- **Decision**:
  1. Updated `_normalize_database_url` in `config.py` to auto-resolve SQLite relative paths against `backend_dir` (`base_dir`), seamlessly handling both root and sub-directory execution.
  2. Filtered external `ArbitraryTypeWarning` from `google.genai.types.HttpOptions` in `backend/run.py` and package `__init__.py`.
  3. Guarded `purge_demo_and_test_data` in `app.py` behind an explicit `PURGE_DEMO_DATA=true` environment flag to prevent accidental deletion of user-uploaded books on development restarts.
  4. Added process health check in `run.sh` to ensure backend startup failures exit cleanly with actionable error messages.
- **Consequences**: `./run.sh` launches both backend and frontend cleanly with zero warnings or database connection errors.



