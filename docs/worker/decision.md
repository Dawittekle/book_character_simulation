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
