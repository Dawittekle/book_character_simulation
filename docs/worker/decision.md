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
