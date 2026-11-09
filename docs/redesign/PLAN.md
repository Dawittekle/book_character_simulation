# Lorely — Production Refactor, Architecture Cleanup & Voice Implementation Plan

> **Purpose:** This document is the implementation reference for coding agents refactoring Lorely. It defines the target architecture, what to keep, what to remove only after verification, data-model changes, book intelligence, bilingual support, voice conversations, deployment, security, testing and acceptance criteria.
>
> **Status:** Proposed engineering plan — not a claim that all listed services/features already exist.
>
> **Primary source:** The user's `system_architecture_and_guide.md` (November 2026), supplemented by a review of the repository structure and code that was visible during the planning conversation, and current official provider documentation checked on 9 November 2026.
>
> **Important repository caveat:** The architecture document describes a newer `redesign` branch and services such as `LorelyService`, `ClassificationService`, `VoiceService`, R2 storage, PostgreSQL chunk retrieval and background processing. The publicly visible GitHub branch list inspected during planning showed only `main`, whose code was older and did not contain all of those described modules. At the start of implementation, inspect the actual checked-out branch and latest remote commits. Treat this document as the target specification, not proof that every component has already been implemented.

---

## 0. Instructions to the coding agent

### 0.1 Work from evidence, not assumptions

1. Read this plan and the current architecture document first.
2. Inspect the **actual current branch**, working tree, dependency files, tests, migrations, environment examples and every import/use of each candidate for removal.
3. Produce a concise current-state inventory before changing code:
   - Implemented and used.
   - Implemented but unused/legacy.
   - Planned but not implemented.
   - Duplicated or conflicting.
   - Security or data-integrity risks.
4. Do not assume a component exists because it appears in the architecture diagram. Verify its source code, configuration, tests and deployed resources.
5. Do not replace the whole application or rewrite working modules merely to make the architecture look cleaner. Prefer staged migrations and small, reviewable commits.
6. Preserve user data. Back up and migrate before deleting any database, local vector directory, object-storage prefix or old schema.
7. Do not invent features in UI. A button must call a working backend capability, otherwise it must be labelled as unavailable/coming later or omitted.
8. Do not put provider secrets, R2 credentials, database passwords, service-role keys or long-lived voice API keys in frontend code, Git, documentation or logs.
9. Keep the existing application stack unless a measurable technical reason justifies a change.
10. After each phase, run the relevant tests and update this document's implementation checklist with commit references and evidence.

### 0.2 Non-negotiable product principles

- PostgreSQL is the source of truth for application records.
- R2 is the source of truth for large file objects and generated assets.
- The browser may cache data, but browser storage must never be the only copy of a user's library, conversations, reading progress or character state.
- One canonical character profile can be shared by a public catalogue book; each reader has a separate, private character state and conversation history.
- Every private query is scoped to the authenticated owner. Never rely on a frontend role or client-supplied `user_id` for authorization.
- Book-grounded answers must use retrieved source passages, with spoiler restrictions applied before context reaches the model.
- All text and voice messages use the same Lorely conversation orchestration and persistence model.
- Voice providers may speak the character's reply, but must not silently become a second, independent source of character truth.
- English and Amharic are language configurations on the same application, not separate codebases.
- LLM-generated psychological values are simulated estimates, not clinical or scientifically validated measurements.

---

## 1. Target product definition

Lorely is a book-to-character simulation and reading companion. It allows a reader to:

1. Discover already-processed featured books or import their own supported book/text.
2. Understand what type of document was uploaded and confirm extracted metadata.
3. Explore characters extracted from the source, including their personality, physical description when available, relationships, goals and story events.
4. Ask characters questions grounded in the original book and constrained by the reader's spoiler progress.
5. Continue conversations in separate sessions, with character-state continuity and user-specific memories.
6. Interact through typed text, speech input, spoken character responses, and eventually natural real-time voice conversations.
7. Use the product in supported interface/conversation languages, initially English and Amharic, without duplicating all book and character records.

The product differentiator is not merely “chat with a fictional character.” It is **a persistent, source-grounded, spoiler-aware and reader-personalized simulation of a literary character**.

---

## 2. Target architecture decisions

### 2.1 Keep the modular-monolith architecture

Keep one Python application organized into bounded modules. Do not split into microservices prematurely.

| Concern | Target choice | Decision |
|---|---|---|
| Web frontend | React 19 + Vite (TypeScript migration may be incremental) | Keep |
| API | Flask + Python 3.13, unless an evidence-based incompatibility is found | Keep |
| Validation | Pydantic v2 | Keep |
| ORM/migrations | SQLAlchemy 2.x + Alembic | Keep |
| Relational database | Supabase PostgreSQL | Keep as source of truth |
| Vector search | PostgreSQL `pgvector` extension | Standardize here |
| Object storage | Cloudflare R2 via S3-compatible API/Boto3 | Keep |
| Authentication | Supabase Auth | Keep; enforce authorization in backend |
| LLMs | Native Google and OpenAI SDKs behind internal interfaces | Keep; do not add LangChain by default |
| Document extraction | PyMuPDF for PDFs plus a dedicated EPUB parser | Keep/extend |
| Background jobs | Supabase Queues/PGMQ initially, consumed by a separate Python worker | Adopt if verified available on the Supabase project |
| Voice | Provider-independent service; evaluate ElevenLabs and OpenAI Realtime; Google STT as Amharic input candidate | Add behind adapters |
| Monitoring | Structured logs, error tracking, metrics, job failure reporting | Add |

### 2.2 Do not add LangChain just because the original project name mentions it

The architecture guide explicitly says Lorely uses native provider SDKs, Pydantic, its own prompt/orchestration layer and custom retrieval. It does not use the third-party LangChain package.

**Decision:** Do not introduce LangChain or LlamaIndex unless a narrowly scoped, measured need appears and a proof-of-concept demonstrates a material benefit. RAG, orchestration, tools, schemas, prompt versions and state transitions can remain explicit application services.

### 2.3 Keep provider independence

The business logic must not depend on provider-specific response formats. Define interfaces for:

- `ChatModelProvider`
- `EmbeddingProvider`
- `SpeechToTextProvider`
- `TextToSpeechProvider`
- `RealtimeVoiceProvider` (optional later phase)
- `ObjectStorageProvider`

Provider implementations translate provider-specific requests and results into internal Pydantic schemas. Provider IDs, model names, dimensions, supported languages, streaming support and costs belong in configuration/registry data—not scattered across UI components and prompts.

### 2.4 Deployment topology

- **Vercel:** React/Vite web app and short-lived HTTP API endpoints where Flask Function constraints are acceptable.
- **Supabase:** PostgreSQL, Auth, RLS and queue infrastructure.
- **Cloudflare R2:** original books, extracted text artifacts, generated character portraits, optional audio assets and temporary files.
- **Python worker hosting:** a persistent worker or managed job runner outside Vercel for ingestion, embeddings, long-running extraction and retryable tasks. Do not depend on a Vercel request lifecycle to finish a long book-processing pipeline.
- **Realtime audio:** browser connects to the voice provider through a short-lived, server-minted session credential or ephemeral token where supported. Never expose the long-lived provider API key to the browser.

Vercel Functions currently document a 4.5 MB request/response payload limit. Large book files must upload directly to R2 through a short-lived presigned URL rather than passing through a Flask Function. See official Vercel and R2 links in Section 15.

---

## 3. Clean up the current codebase safely

This section is deliberately conservative. A coding agent must prove that something is unused before deleting it.

### 3.1 Mandatory repository audit

Run searches such as:

```bash
# Python imports and dependency references
rg -n "langchain|llama_index|chromadb|Chroma|qdrant|Qdrant|PersistentClient|sqlite|storage_service|LocalStorage" backend

# Frontend persistence and API references
rg -n "localStorage|sessionStorage|workspaceStore|VITE_API_URL|apiService" frontend/src

# Storage and LLM config references
rg -n "R2_|DATABASE_URL|GEMINI_|OPENAI_|embedding|BookChunk|VoiceService|SpeechToText|TextToSpeech" backend

# All dependency declarations / lock files
rg -n "langchain|llama-index|chromadb|qdrant|boto3|google-genai|openai|psycopg|pgvector" backend frontend
```

Also inspect Git history and tracked files. Search results alone are not sufficient; check imports, test fixtures, scripts, deployment config and runtime initialization.

### 3.2 Items to keep

Keep these if they remain actively imported and tested:

- Flask API and application factory.
- SQLAlchemy models, `DatabaseManager` and Alembic migrations.
- Supabase Auth/JWT validation.
- Native Gemini and OpenAI provider adapters (only keep each adapter if its provider is intentionally supported and tested).
- Pydantic character, chat, state and extraction schemas.
- R2 storage adapter and signed upload/download URL support.
- PDF/EPUB extraction modules.
- PostgreSQL relational repositories and book chunk retrieval.
- Existing working tests and migration scripts.

### 3.3 Remove or retire after migration verification

| Candidate | Required action | Removal gate |
|---|---|---|
| LangChain package(s) | Do not add. Remove from dependencies if present and unused. | `rg`/dependency audit shows no runtime or test imports. |
| ChromaDB prototype repository | Retire in favor of PostgreSQL/pgvector. | All required character/session/memory/vector records have been migrated or proven disposable; all tests use target repositories. |
| `backend/chroma_db/` | Remove from Git and deployment bundle. | Data backup/export completed; no running code requires it. |
| Qdrant local storage directory (if present) | Remove if it is only abandoned runtime data. | Verify no active Qdrant client or deployment points to it. |
| Legacy local filesystem fallback | Remove as a production fallback. A local-only development/test adapter may remain if useful. | R2 adapter, failure handling and tests are working. Production must never silently write to ephemeral disk. |
| Old JSON/list-of-float vector columns | Migrate to native `vector(N)` or remove if unused. | Backfill and retrieval equivalence tests pass; rollback/backup exists. |
| Duplicate storage implementations | Consolidate behind one `ObjectStorageProvider`. | All callers migrated and storage tests pass. |
| Fake/demo admin and manager data | Delete, do not merely hide. | Real admin API and authorization are implemented; manager role is out of scope. |
| Manager pages, route guards and role switcher | Remove for now. | Ensure no production feature depends on manager role. |
| Development role-switch UI | Remove from all production builds. | Admin access is verified server-side. |
| Browser-only workspace state | Replace as source of truth with server APIs. | Cross-browser/cross-device persistence tests pass before deleting old storage migration logic. |
| Unused provider models and obsolete endpoints | Remove/update only after provider smoke tests. | A supported replacement is selected and configured. |

**Do not delete user data just because a directory is called `legacy`.** Export any records that might contain current data, compare counts and hashes, test the migration, and only then remove old storage.

### 3.4 Secrets and repository hygiene

The uploaded architecture document contained live-looking R2 credentials. If those values are real, rotate/revoke them immediately, update deployment secrets, and remove them from all committed documentation/history. Do not copy the values into this plan or any new `.env.example`.

- `.env.example` contains variable names and safe placeholders only.
- `.env`, private keys, service-role keys, database passwords, R2 secrets and provider keys must be ignored by Git.
- Add secret scanning to CI if practical.
- Remove binary database stores, local object-store data and `.venv`/`node_modules` from Git tracking where they were mistakenly committed.
- Keep public frontend Supabase publishable/anon key only; never put Supabase service-role credentials in the frontend.

---

## 4. Database and data model target

### 4.1 Core principle: canonical book data versus reader-specific data

A public catalogue book is processed once and shared. Every reader receives their own library relationship, reading progress, chat sessions, memories and character state.

Do not create a separate copy of the canonical character profile for every reader. Do not keep a single global mutable emotion state for a popular character.

### 4.2 Suggested logical entities

Use existing model names where sensible; this is a logical target, not an instruction to create duplicate tables with new names.

#### Identity and user preferences

- `users` / `user_profiles`: application profile linked to Supabase Auth subject.
- `user_settings`: preferred UI language, default conversation language, accessibility/audio preferences, data retention preferences.
- `user_roles`: authoritative role assignments, with a minimal `user` and `admin` role for current scope. Do not add Manager now.
- `usage_ledger` or `usage_events`: AI/voice/book-processing usage and cost attribution.

#### Book catalog and ingestion

- `books`: canonical book metadata, source type, rights status, visibility/catalogue state and processing state.
- `book_sources`: source file metadata and R2 object key; original language; content hash; file size and source licence.
- `book_chapters`: ordered chapter/section records with title, start/end offsets, language and metadata.
- `book_chunks`: chapter-aware text chunks and native pgvector embeddings.
- `book_ingestion_jobs`: status, stage, attempt count, progress, failure details, idempotency key and timestamps.
- `user_library_books`: user-to-book relation for saved/added books.
- `user_reading_progress`: current chapter/order, optional page/section position, spoiler preference and update timestamp.

#### Canonical character knowledge

- `character_profiles`: stable, book-level character identity; name, aliases, personality, physical description, goals, motivations, character arc and extraction version.
- `character_profile_evidence`: fact/trait, source chapter, chunk/page reference, confidence and provenance.
- `character_relationships`: source/target characters, relationship label, description, source chapter and spoiler availability.
- `character_events`: plot events with chapter order and involved characters.
- `character_voice_defaults`: optional recommended voice attributes; do not store a provider-specific voice ID as the only character identity.

#### Reader-specific character experience

- `user_character_states`: unique per `(user_id, book_id, character_id)` for the reader's private emotional/PSI state and custom interaction settings.
- `character_state_events`: append-only state-change record per turn, with state version, input observations, delta, resulting state, model/prompt provenance and timestamp.
- `chat_sessions`: user, book, character, title, conversation language, session status and last activity.
- `chat_messages`: ordered messages with role, text, modality (`text`/`voice`), transcript metadata, voice metadata and optional private audio object key.
- `character_memories`: user-specific or session-scoped facts, with source message, provenance, confidence, created time and spoiler chapter boundary.

#### Reusable assets and voice catalog

- `avatar_assets`: R2 object key, metadata tags, style, source/licence, moderation/approval status and fallback flag.
- `voice_catalog`: provider, provider voice ID, asset status, provider model compatibility, language codes, perceived age band, gender presentation, accent, pitch/timbre descriptors, style, quality notes, source/licence/consent status, preview object key and active/deprecated status.
- `character_voice_assignments`: chosen voice profile for a canonical character or a reader override; record assignment reason and confidence.
- `voice_usage_events`: provider, model, duration/characters, cost fields where available, user/session/message IDs and failure state.

### 4.3 Important ownership and uniqueness constraints

- Supabase Auth `sub` is the external identity key. Do not trust a request's `user_id` without matching it to the verified token.
- Every private book, library relation, chat session, message, memory, state, user voice preference and audio object must be owned or authorizable by a verified user.
- Unique constraint on `(user_id, book_id, character_id)` for reader-specific character state.
- Unique constraint on `(session_id, sequence_number)` for messages.
- Unique constraint or idempotency key for ingestion of the same source version.
- A featured/public book is public only after rights review and explicit publication.
- A user-uploaded book remains private by default.

### 4.4 PostgreSQL vector storage

Use the PostgreSQL `pgvector` extension, not a JSON list of floats for similarity search.

For each chunk, store:

- `embedding vector(N)` using a dimension supported by the selected model.
- `embedding_provider`.
- `embedding_model`.
- `embedding_model_version` or stable deployment identifier.
- `embedding_dimensions` if helpful for diagnostics.
- `content_hash` to avoid duplicate embedding work.

Create indexes based on measured query patterns:

- HNSW cosine index for vector retrieval where appropriate.
- B-tree indexes for `book_id`, `chapter_order`, `language_code`, visibility and other filters.
- PostgreSQL full-text search index for lexical retrieval.

Do not hard-code the embedding dimension until the provider/model is selected and benchmarked. A model change that alters dimensions requires a versioned re-embedding migration; never compare vectors from incompatible models.

### 4.5 Data migration policy

1. Create a verified backup/snapshot.
2. Inventory Chroma/Qdrant/JSON vectors and relational records.
3. Create additive Alembic migrations.
4. Backfill in batches with progress and resumability.
5. Verify record counts, ownership links, hashes and retrieval results.
6. Switch reads to the new repository behind a feature flag if necessary.
7. Observe errors and compare old/new retrieval for a controlled period.
8. Remove legacy writes first, then legacy reads, then legacy storage and dependencies.
9. Keep rollback instructions and backup retention documented.

---

## 5. Book ingestion, classification and accurate character extraction

### 5.1 Supported upload types

Initial target:

- PDF.
- EPUB.
- Plain TXT.

DOCX can be considered after the initial production flow is reliable. Do not advertise a format unless parser and tests cover it.

### 5.2 Processing stages

1. **Preflight:** file type, file size, MIME, checksum, page count/EPUB metadata, encryption/corruption checks and malware/content scanning as appropriate.
2. **Direct upload:** backend authorizes and creates a short-lived R2 presigned PUT URL; browser uploads directly to R2.
3. **Inspect:** worker extracts metadata and text. Keep original file immutable.
4. **Document classification:** determine literary work versus non-literary document (cover letter, CV, invoice, academic paper, notes, etc.).
5. **Metadata review:** show detected title, author, language, work type and confidence. User can correct title/author and select intended book language.
6. **Chapter segmentation:** parse EPUB TOC and headings; PDF uses text structure and heuristic/LLM assistance where necessary; preserve page offsets.
7. **Character extraction:** process across all chapters, not only the first 50,000 characters.
8. **Entity resolution:** merge references/aliases to the same character across chapters; avoid treating the uploaded document owner or letter recipient as a fictional character.
9. **Evidence linking:** every important profile fact, relationship and event links to source passage/chapter/page.
10. **Chunking and embeddings:** produce chapter-aware chunks and embeddings.
11. **Persist and index:** write canonical rows, R2 artifacts and vector indexes in idempotent steps.
12. **Publish readiness:** mark `ready` only when all required stages complete; otherwise `failed` with a user-safe explanation and retry action.

### 5.3 Classification gate

Classification must happen before character extraction. Use deterministic file checks and lightweight classification first; ask a model only when necessary.

Structured output should include:

```json
{
  "document_type": "literary_work",
  "genre": "novel",
  "language": "en",
  "title": "Example Novel",
  "author": "Author Name",
  "confidence": 0.94,
  "supported_for_character_simulation": true,
  "reason": "Narrative prose with chapters, dialogue and recurring fictional entities."
}
```

The score is a model estimate, not an objective probability. Establish calibrated thresholds using a labelled evaluation set. If classification is uncertain, ask the user to confirm the intended use; do not silently run character extraction on a cover letter.

Evaluation set must include:

- Novel and short story.
- Plays/script.
- Poetry collection (define supported behavior separately).
- Biography/memoir.
- Academic paper.
- CV/resume.
- Cover letter/business correspondence.
- Invoice/receipt.
- Technical documentation.
- A short text with named people but no fictional narrative.
- A mixed or malformed document.

### 5.4 Chapter-aware character extraction

Do not extract every character solely from the first 50,000 characters. Use a staged pipeline:

- Identify document structure and chapters.
- Extract candidate characters per chapter.
- Capture aliases, descriptions, actions, relationships, motivations and events.
- Link each fact to exact source evidence.
- Resolve duplicate entities across chapters.
- Build a canonical character profile and chapter-specific evolution timeline.
- Preserve when a fact becomes known to the reader to enforce spoiler gating.

### 5.5 Chunking policy

The current architecture suggests 1,000-character chunks. Benchmark this rather than treating it as universally correct. Use token-aware, paragraph-aware chunking, a modest overlap and preserve chapter boundaries. Keep original text untouched. Avoid chunks that combine two chapters or include future-chapter text in metadata summaries that are shown to an earlier reader.

A practical starting experiment is roughly 400–800 tokens per chunk with 10–15% overlap, but choose final values through retrieval evaluation across prose, dialogue, poetry and translated text.

---

## 6. Retrieval, spoiler protection and answer accuracy

### 6.1 Hybrid retrieval

Use:

1. PostgreSQL full-text/lexical search for exact names, phrases and rare terms.
2. pgvector semantic search for meaning/similar concepts.
3. Hard metadata filtering by book, user access, language, chapter progress and visibility **before** passages are passed to the model.
4. A simple rank fusion method (for example Reciprocal Rank Fusion) and optional reranker after the hard spoiler filter.
5. Return passage references for internal grounding and, where product design allows, citations to chapter/page.

Avoid adding a separate vector vendor until load tests or operational needs prove pgvector is inadequate.

### 6.2 Spoiler-gate invariants

- A future chapter must never enter the model context if the reader's progress is earlier.
- Filter canonical events, relationship facts, character changes, memories and generated summaries—not just `book_chunks`.
- Store chapter/section provenance for every extracted fact.
- A memory created from a future chapter must not be shown to an earlier reading position.
- User-selected “spoilers allowed / full-book discussion” is an explicit opt-in setting.
- If progress is unknown, choose a clear conservative default or ask the user to set reading position; do not assume they finished the book.
- Test approximate-index behavior with filters; verify no short result set is incorrectly treated as complete when HNSW filtering prunes candidates.

### 6.3 Retrieval evaluation

Build a fixed evaluation set per book:

- Exact quote lookup.
- Character motivation question.
- Relationship question.
- Event ordering question.
- Ambiguous name/alias question.
- Questions where correct answer is “not established in the book.”
- Spoiler trap: an answer whose evidence only appears in a future chapter.
- English question over English book.
- Amharic question over English book (cross-lingual test).

Track retrieval hit rate, evidence correctness, unsupported-claim rate, spoiler leakage and language correctness. Do not judge quality only from whether the answer sounds fluent.

---

## 7. Character simulation, memory and psychological state

### 7.1 Separate the three layers of character data

**Canonical character profile:** book-derived facts, stable identity and personality. Shared for a public catalogue book.

**Reader-specific character state:** how this character's relationship and simulated state have evolved with one particular reader. Private per user/book/character.

**Conversation memory:** relevant facts, events and preferences retained for a particular reader and character/session. Do not confuse facts about the reader with facts about the fictional character.

### 7.2 Do not make one global character state

A featured character may be used by many readers. One reader's conversation must never change another reader's character state.

Use a unique reader-state record and append-only state events. The initial state derives from the canonical profile and the reader's spoiler boundary. Subsequent turns update only that reader's state.

### 7.3 Deterministic PSI transition engine

Keep the LLM responsible for language understanding and an interpretable structured assessment, not arbitrary free-form numeric state invention.

Suggested turn flow:

1. Retrieve source evidence, persona and eligible memories.
2. Build a versioned prompt and request a response plus structured observations (for example perceived event, valence, arousal, threat/goal relevance, certainty and confidence).
3. Validate with Pydantic and range checks.
4. Apply deterministic, documented Python transition rules to the current state.
5. Clamp and validate all values; preserve the previous state if the result is invalid.
6. Append an immutable `character_state_event` with model/prompt/rule version.
7. Persist message and resulting state in one transaction or with a reliable outbox workflow.

Do not claim that the resulting state is a scientifically validated reading of a real person's psychology. Label the interface as an interpretive simulation of a fictional character.

### 7.4 Memory policy

- Separate source-book facts from facts the reader shares about themselves.
- Store provenance: source message, character, session, timestamp, confidence and spoiler chapter.
- Avoid storing sensitive personal facts by default; provide user-visible memory controls.
- Deduplicate normalized memories and support correction/deletion.
- Summarize old conversations rather than sending unbounded chat history to every LLM call.
- Retrieve only relevant memories for a turn.
- Make memory retrieval user-scoped and character-scoped.
- Extract memory in background only if the current response does not need it; otherwise use a light synchronous update for immediate continuity and a richer asynchronous consolidation job.

---

## 8. Bilingual and future multilingual architecture

### 8.1 Language fields

Add language metadata to:

- User preference: `preferred_ui_language`, `preferred_conversation_language`.
- Book/source: `original_language`, `detected_language`.
- Chapter/chunk: `language_code`.
- Chat session: `conversation_language`.
- Message: `language_code`.
- Voice profile: supported input/output language codes and provider voice compatibility.

Use BCP-47/ISO-compatible language identifiers consistently (`en`, `am`, `am-ET` where region-specific speech services require it).

### 8.2 Keep source language and conversation language separate

Example: an English novel, an Amharic-speaking reader.

- Original book passages remain in English.
- The reader asks in Amharic.
- Retrieval uses a multilingual embedding space or a tested translation-assisted retrieval fallback.
- The same original evidence is supplied to the character.
- The character replies in Amharic when supported.
- Source citations and chapter references still point to the original English material.

Do not translate and store a duplicate of every book at ingestion time. Translate only what is needed, and preserve original evidence.

### 8.3 Embedding strategy

Evaluate a multilingual embedding model such as Google's current Gemini Embedding family against alternatives. Do not choose based only on vendor language claims. Benchmark:

- English query → English source.
- Amharic query → English source.
- English query → Amharic source.
- Amharic query → Amharic source.
- Proper names, transliterations and code-switching.

All vectors compared in one index must be generated by compatible model/version/dimensions. Store model metadata and re-embed through a background migration when changing models.

### 8.4 Amharic speech support: a known qualification

Official Google Cloud Speech-to-Text documentation currently lists Amharic (Ethiopia), language code `am-ET`, for transcription. The current Google Cloud Text-to-Speech voice inventory inspected for this plan did not return an Amharic voice. OpenAI's published TTS supported-language list also does not list Amharic.

Therefore:

- Amharic text conversation can be planned as a first-class feature, subject to LLM evaluation.
- Amharic speech input has a promising candidate in Google Cloud Speech-to-Text and must be benchmarked with real Amharic speakers, including code-switching and different microphones.
- Amharic spoken output must remain **provider-evaluation / experimental** until a provider voice is verified for natural Amharic pronunciation and intonation.
- Do not claim Amharic voice output is production-ready until human evaluation passes.

The application must support provider/language capability checks. If a chosen voice cannot speak the conversation language well, offer text mode or another validated voice, not a silently incorrect voice.

---

## 9. Reusable character avatar library

### 9.1 Objective

Avoid generating an image for every new character. Create a reusable approved portrait collection with descriptive metadata, stored as images in R2 and metadata in PostgreSQL.

### 9.2 Asset metadata

Each avatar asset should have:

- `asset_id`.
- R2 object key and image dimensions/format.
- Art style (illustrated, painterly, realistic, etc.).
- Tags for visible attributes (hair, clothing, apparent age range, period, presentation, mood, accessories).
- `source_type`, creator/source, licence and approval status.
- Optional generated provenance, prompt version and model.
- Reuse policy and active/deprecated status.

Do not use a copyrighted film/TV actor image as a shortcut for a public-domain literary character. A public-domain book does not automatically make modern illustrations or screen depictions public domain.

### 9.3 Matching algorithm

- Extract only physical features explicitly supported by the book.
- Mark each attribute as `explicit`, `inferred` or `unknown`.
- Do not infer a person's ethnicity or precise appearance from name alone.
- Use deterministic weighted metadata matching as the first implementation; do not call an image model for every match.
- Require a minimum match score; otherwise use a neutral generic portrait.
- Let user or admin override an assigned portrait.
- Keep avatar assignment stable; do not randomly change the character's face across sessions.
- Generate new assets only through an admin-curated workflow when the existing library has no suitable image.

### 9.4 Initial catalog

Build a modest, consistent starter library (for example 30–60 curated images, not an unbounded generation task). Cover a range of eras, appearances, age presentations, clothing and moods, with a few neutral fallbacks. The exact size should be selected based on visual QA and asset licensing.

---

## 10. Featured books and shared catalogue

### 10.1 Separate public catalogue from personal library

- `public_catalog_books`: curated canonical books, only published after rights review and processing QA.
- `user_library_books`: links a user to a public book or their own private upload.
- Public book characters, relationships, events and chunks are processed once and reused.
- Reader-specific states, progress, memories and chats are always separate.

### 10.2 Catalogue behavior

Users should be able to:

- Browse featured books before uploading their own.
- Search by title, author, genre and language.
- View cover, synopsis, source language and rights/edition information.
- Add a book to their library.
- Select reading progress before starting if spoiler-safe mode is enabled.
- Open a character board and immediately start a private conversation.

### 10.3 Rights and provenance

For every catalogue source, record source URL, edition, public-domain/licence basis, jurisdiction review, file provenance, cover-art licence and any redistribution limitations. Do not assume that “free online” means free to redistribute in every territory. Start with works and assets whose rights status has been reviewed.

---

## 11. Voice system — required product behavior

### 11.1 User experience requirements

Voice is not a separate chatbot. It is another input/output modality for the same Lorely conversation.

The user must be able to:

1. Open a character conversation and select **Voice Mode**.
2. Grant microphone permission.
3. See a clear microphone-active/listening state.
4. Speak naturally without pressing a Send button.
5. Have Lorely detect the end of the utterance using voice activity detection (VAD)/endpointing.
6. Have the recognized transcript automatically submitted to the same Lorely chat orchestration used by typed messages.
7. See the transcript in the message history.
8. Hear the character's response in the assigned voice.
9. Interrupt the character while it is speaking; playback stops and the user's new speech is captured.
10. Switch between text and voice without losing the session.
11. Turn off microphone access and leave voice mode at any time.
12. Choose a voice manually or keep automatic character voice matching.

There must be **no requirement to say “send”**. End-of-utterance detection should trigger submission automatically. A visible manual Stop/Finish control may be provided as a fallback, but it must not be the normal send action.

### 11.2 Voice interaction states

Implement explicit client states:

- `idle` — microphone off.
- `requesting_permission`.
- `listening` — microphone active and input meter visible.
- `transcribing` — speech segment closed; text being recognized.
- `submitting` — transcript sent to Lorely.
- `thinking` — Lorely is retrieving and generating the character response.
- `speaking` — audio response is playing.
- `interrupted` — user barged in; playback cancelled and listening resumed.
- `error` — recoverable error with retry and text fallback.

Do not show a generic spinner for all states. The UI must tell the reader whether Lorely is listening, processing, or speaking.

### 11.3 Automatic end-of-utterance without Send

Use provider/browser streaming and VAD endpointing, not an arbitrary one-shot “record then click Send” workflow.

- Prefer provider server-side VAD/turn detection when using a streaming/realtime audio provider.
- For a chained STT workflow, use browser audio capture with streaming/batched audio segments plus a tested silence endpoint detector.
- Start with a configurable endpoint silence threshold (benchmark approximately 0.8–1.5 seconds; do not hard-code one value as universally correct).
- Allow a longer pause for users who speak slowly or think between phrases.
- Add a user setting for endpoint sensitivity / pause length if the provider cannot adapt automatically.
- Use an optional push-to-talk fallback for noisy environments and accessibility.
- Prevent keyboard/microphone echo and duplicate submission.
- Handle false endpoints, network interruption, empty transcript and low-confidence transcription gracefully.
- After a transcript is finalized, auto-submit; do not wait for an additional confirmation click by default. If desired, provide a short “undo/cancel” window before the LLM call.

### 11.4 Interruptions / barge-in

- User speech while the character speaks should stop or fade out current audio immediately.
- Cancel or mark the current audio generation as interrupted.
- Do not append an incomplete assistant message as if it were fully spoken; retain its text and an interrupted status where appropriate.
- The new user turn must be sequenced after the partial assistant turn consistently.
- Use playback generation IDs/session IDs so stale audio chunks cannot resume after interruption.
- Test on laptop browsers, mobile Safari and Android Chrome.

### 11.5 Two implementation stages

**Stage A — Chained voice pipeline (recommended first release)**

`microphone -> VAD/endpoint detection -> STT -> transcript -> LorelyOrchestrator -> character text reply -> TTS -> streamed audio playback`

Advantages:

- Reuses the existing RAG, character, memory and PSI logic.
- Transcript is naturally available and saved as an ordinary chat message.
- Easier to debug and evaluate.
- Speech provider can be replaced independently.
- Keeps Lorely as the owner of book-grounded response generation.

Disadvantages:

- More latency than direct speech-to-speech.
- Separate STT and TTS costs.
- Requires careful streaming and cancellation logic.

**Stage B — Real-time speech-to-speech**

Use WebRTC to connect the browser to a realtime provider after the backend creates a short-lived session. The provider must delegate the application turn to Lorely's backend (function/tool call or equivalent controlled handoff) so the authoritative answer still uses spoiler-aware retrieval, character state and user-specific memory.

Do not permit the realtime provider to invent a character answer independently of Lorely's evidence and state engine. A realtime model can handle audio/turn-taking; Lorely remains authoritative for the content and persistence.

Stage B is an optimization after Stage A works reliably, not a prerequisite for launching basic voice conversations.

### 11.6 Voice provider recommendation and constraints

Implement provider adapters and benchmark before locking a vendor.

**ElevenLabs candidate:**
- Useful for a curated library of distinctive character voices.
- Voice Design can generate voices from descriptions including perceived age, gender, accent, tone and speaking style.
- Voice Design is documented as experimental; generated voice consistency and supported languages must be evaluated.
- It is a good candidate for an admin-created, pre-approved voice catalog rather than generating a voice on each chat turn.

**OpenAI candidate:**
- Realtime API supports direct speech-to-speech and session-level voice selection.
- The documented built-in Realtime voice set is finite. A session's voice cannot be changed after audio has been emitted; create a new session when a different character voice is needed.
- Prompt-generated custom voices are documented for GPT-Live but not the standard Text-to-Speech or Realtime APIs; do not assume a voice generated for one API workflow works with another.
- Current OpenAI TTS documentation states that `tts-1`, `tts-1-hd` and `gpt-4o-mini-tts` are deprecated and scheduled to shut down on 6 January 2027. Do not start a new long-lived implementation on those legacy endpoints without a supported migration plan.

**Google candidate:**
- Google Cloud Speech-to-Text currently lists `am-ET` support, making it a candidate for Amharic speech input.
- Do not assume that means Google Cloud Text-to-Speech offers a suitable Amharic voice; verify actual voice catalogue and spoken quality separately.

Initial recommendation: build the adapter interfaces and ship Stage A with the provider combination that wins a real audio-quality/latency/cost test. Evaluate ElevenLabs for expressive character TTS; evaluate Google STT for Amharic input; evaluate OpenAI Realtime for Stage B. Do not tie the business logic to any one provider.

### 11.7 Character voice archive / voice catalog

The user's requested “archive of voice types” should be a reusable voice catalog, not a generated voice per character.

Each catalog item should include:

- Provider and provider voice ID.
- Model/API compatibility.
- `language_codes` and supported accents.
- Perceived age band: youthful/adolescent (only where permitted and appropriate), young adult, adult, middle-aged, older adult.
- Gender presentation: feminine, masculine, androgynous/neutral, unknown.
- Pitch/timbre descriptors: low, mid, high, warm, bright, breathy, raspy, clear, etc.
- Accent and pronunciation notes.
- Speaking style: measured, energetic, formal, playful, narrator, dramatic, etc.
- Licence/consent/provenance/approval.
- Preview audio object and sample text.
- Active/deprecated status and fallback voice.

The interface should support filter/search and playable voice previews. Provider voice IDs must be stored in the backend, not hard-coded in React.

### 11.8 Automatic voice matching

At character extraction time, extract the following only when present in the book:

- Character's stated age or age range.
- Gender identity/presentation when explicitly given.
- Accent or dialect if described.
- Vocal descriptions (deep, soft, hoarse, youthful, commanding, etc.).
- Narrative personality/tone (for performance style only, not a factual vocal characteristic).
- Conversation language.

Track provenance/confidence for each attribute (`explicit`, `inferred`, `unknown`). Do not infer accent from ethnicity, nationality or name. Do not infer voice gender solely from a character's name.

A deterministic matching service should:

1. Filter to voices that support the selected language and TTS model.
2. Exclude unapproved, deprecated or unlicensed voices.
3. Match explicitly described age/gender/accent/timbre first.
4. Match speaking style secondarily.
5. Score candidates and select a default only above a threshold.
6. Otherwise use a neutral fallback and mark the assignment as low-confidence.
7. Store the selected `voice_catalog_id` so the character sounds consistent across sessions.
8. Allow the user to override the selected voice, without changing the canonical character profile.

Do not run an LLM or voice-generation job on every turn to select a voice. Matching is a cheap metadata operation. Admins may create new custom voices in batches as the catalog grows.

### 11.9 Child/adolescent-sounding fictional voices

A fictional character can be assigned a generic synthetic youthful/adolescent voice if the provider permits it and the source supports that age. This is technically possible through voice-design systems that accept age descriptions, but the results must be reviewed; age labels do not guarantee a convincing or suitable result.

Guardrails:

- Do not clone a real child's voice.
- Do not clone or imitate a real actor, author, celebrity or other identifiable person without the required rights and explicit consent.
- Prefer generic provider voices or properly licensed synthetic designs.
- Do not infer that a character is a child from illustration style alone; use book evidence.
- Add an admin approval step for all newly designed voices.
- Clearly disclose synthetic/AI-generated voice to users.

For the first release, support a broad range of adult/older voices and a limited, carefully reviewed set of youthful fictional voices. Do not make a “child voice” guarantee until provider terms, technical quality and product safety review are complete.

### 11.10 Audio persistence, caching and privacy

- Store transcript text as the normal chat message.
- Do not save raw microphone recordings by default.
- If users explicitly opt into saving voice recordings, explain retention and provide delete controls.
- TTS output may be streamed without permanent storage.
- If caching audio, cache by text hash + voice ID + model/version + language + speech settings.
- Public static catalogue narration can use shared cache where rights permit.
- Private conversation audio must never be globally shared; use user/session-scoped storage and a retention/expiry policy.
- Audio object keys must be unguessable and private; issue short-lived signed GET URLs.
- Do not log raw transcripts or audio payloads unnecessarily.
- Enforce per-user minute/character quotas, provider budgets, request rate limits and abuse controls.

---

## 12. Chat API and voice-ready conversation contract

The existing text chat endpoint should become the canonical turn API. Voice STT should submit a transcript to this same service.

### 12.1 Internal turn request

```json
{
  "session_id": "uuid",
  "character_id": "uuid",
  "book_id": "uuid",
  "input": {
    "modality": "voice",
    "text": "The recognized transcript goes here",
    "language_code": "en",
    "transcription": {
      "provider": "provider-name",
      "confidence": 0.97
    }
  },
  "conversation_language": "en",
  "reading_progress_chapter": 4
}
```

Typed messages use `modality: text` with the same remaining contract. Do not send client-supplied character state or user ID as authoritative values.

### 12.2 Internal turn response

```json
{
  "message_id": "uuid",
  "session_id": "uuid",
  "reply_text": "Character response",
  "language_code": "en",
  "citations": [
    {
      "chapter_id": "uuid",
      "chapter_order": 3,
      "page_start": 42,
      "page_end": 43
    }
  ],
  "character_state_version": 8,
  "voice": {
    "enabled": true,
    "voice_catalog_id": "uuid",
    "audio_status": "streaming-or-ready"
  }
}
```

The exact public API shape can differ, but the application-level contract should be stable across Gemini/OpenAI and voice providers.

### 12.3 Persistence/consistency

- Persist user message, assistant message, session sequence and state event in a safe transactional workflow.
- If TTS fails, the text answer remains valid and visible.
- If audio is interrupted, preserve text reply and mark playback state as interrupted.
- Retries must not duplicate the same chat turn. Use idempotency keys/turn IDs.
- Never save a voice transcript twice if the VAD/provider emits duplicate final events.

---

## 13. API and application module boundaries

Organize modules by capability, not by provider SDK.

Suggested backend structure (adapt to existing code; avoid mass file moves without need):

```text
backend/src/lorely/
  api/
    auth_routes.py
    books_routes.py
    catalog_routes.py
    characters_routes.py
    chats_routes.py
    settings_routes.py
    admin_routes.py
    voice_routes.py
    health_routes.py
  core/
    config.py
    errors.py
    logging.py
    security.py
    rate_limits.py
  db/
    models/
    session.py
    migrations/
  repositories/
    books.py
    characters.py
    chats.py
    memories.py
    chunks.py
    voices.py
  services/
    book_ingestion_service.py
    document_classifier.py
    character_extraction_service.py
    retrieval_service.py
    lorely_orchestrator.py
    psi_state_engine.py
    memory_service.py
    voice_service.py
    avatar_matching_service.py
    catalogue_service.py
    usage_service.py
  providers/
    llm/
    embeddings/
    speech_to_text/
    text_to_speech/
    realtime_voice/
    object_storage/
  workers/
    ingestion_worker.py
    embedding_worker.py
    memory_worker.py
  schemas/
  prompts/
    versions/
  tests/
```

Do not rename the whole package solely to match this tree. The key requirement is separation of responsibilities and testability.

### 13.1 Required API capabilities

- Authenticated user profile/settings read and update.
- Create/inspect/upload book, confirm metadata, request ingestion and retrieve job progress.
- List/search user's library and public catalogue.
- Add/remove a catalogue book from library.
- Fetch book metadata and reading progress.
- Fetch character board, individual profile, relationships, events and source evidence under spoiler rules.
- Create/list/retrieve/update/delete chat sessions.
- Paginated message history.
- Canonical chat turn endpoint.
- Voice session/token creation and safe close/end endpoint.
- Voice catalog list, voice previews and user voice override.
- Admin-only book catalogue, avatar catalog, voice catalog, user moderation and system configuration endpoints.

Every route needs input validation, authentication, authorization, pagination/limits where applicable and consistent error responses.

---

## 14. Admin, roles, settings and frontend integration

### 14.1 Roles

- Remove Manager role and Manager UI for current scope.
- Regular users have normal reader permissions.
- Admin has a separate login experience at `/admin/login` and an admin dashboard under `/admin`.
- Admin UI separation is not security. All admin APIs must verify the role server-side from trusted auth claims/role storage.
- Do not let users switch their own role from the profile dropdown.

### 14.2 Settings should actually work

Implement settings backed by the API and database:

- UI language.
- Default conversation language.
- Default voice mode (off/on where supported).
- Automatic voice selection versus manual preference.
- Audio playback speed and captions/transcript preference.
- Microphone privacy and recording retention preference.
- Reading/spoiler preference.
- Account profile and password/security flow via Supabase Auth.
- Memory review/delete controls.
- Data export/delete request workflow.

If a setting is not implemented, do not show an inert control.

### 14.3 Main reader navigation

Use reader-oriented terminology. Do not call a book upload a “Project”.

Recommended side navigation:

1. **Discover** — featured/public book catalogue.
2. **My Library** — user's uploaded and saved books.
3. **Characters** — character browser for selected book/current context.
4. **Conversations** — recent and saved conversations.
5. **Settings** — functioning reader preferences.

Group recent books separately under a “Recent books” label. Keep account/profile at the bottom. Remove team workspace labels if Lorely is a single-reader consumer product.

### 14.4 Chat layout principles

- Make the conversation the primary focus; do not permanently occupy a large right column with every state metric.
- Header: character portrait, name, book title, connection/state indicator, voice mode toggle and back/navigation.
- Message area: readable bubbles with adequate line length, clear speaker identity, timestamps only when useful, source references/citations as expandable detail.
- Composer: multiline text input, mic control, send button for text only, attachment controls only when functional.
- Voice mode: microphone/listening indicator, animated waveform or level meter, transcript captions, speaking state, stop/interrupt control and mute/exit.
- Character information: collapsible side drawer or popover containing profile, relationships, key events and memory summaries.
- Emotion/PSI: hide by default. Show an “Explore character state” panel or interactive drawer. Display a compact summary and reveal detailed indicators on user interaction. Use per-character user-specific state. Add a short explanation of what each simulated metric means.
- Do not put all five emotions and six PSI parameters on screen at all times. Prioritize the conversation and use progressive disclosure.
- Make mobile responsive: character information becomes a drawer/sheet; chat composer stays usable; voice mode uses a clear full-screen or bottom-sheet interaction.

---

## 15. Vercel and cloud deployment requirements

### 15.1 Frontend

- Deploy React/Vite as a Vercel project rooted at `frontend/`.
- Set production `VITE_API_URL` to the API domain.
- Configure SPA fallback/routing so React Router deep links work after refresh.
- Configure production Supabase URL and publishable key.
- Do not bundle server secrets.

### 15.2 Flask API

- Deploy as a separate Vercel project/root or supported Python Function configuration if the current Flask layout is compatible.
- Keep API functions stateless between requests.
- Do not rely on local filesystem persistence.
- Do not run a long book-ingestion pipeline inside a single request.
- Check Python dependency bundle size and cold-start behavior.
- Set CORS to exact production frontend origins.
- Use Supabase transaction pooling or another serverless-appropriate connection configuration; test prepared-statement/driver compatibility.

### 15.3 Worker

Deploy a dedicated Python worker process outside the Vercel request lifecycle. It consumes Supabase Queues/PGMQ messages, claims jobs, updates job status and retries failures. Keep its deployment independently scalable from the web/API tier.

### 15.4 R2 uploads/downloads

- API creates a short-lived presigned upload URL after authentication and quota/file checks.
- Browser uploads directly to R2.
- API verifies object metadata/checksum and creates an ingestion job.
- API issues signed download links for private originals and private voice audio.
- Public catalogue assets use a separate bucket/prefix and explicit rights review.
- Temporary uploads are cleaned up by lifecycle policy or scheduled cleanup jobs.
- Treat presigned URLs as bearer tokens and use short expirations.

### 15.5 Environment and deployment verification

Maintain separate dev/staging/production secrets and databases. Required checks:

- Health endpoint confirms required dependencies.
- DB migrations run in the deployment pipeline using a controlled migration job, not on every application boot.
- R2 read/write/delete smoke test.
- Supabase Auth JWT verification.
- Worker can receive and complete a test job.
- LLM provider health/capability check.
- Voice provider can create a safe test session.
- No secrets appear in build logs or client bundles.

---

## 16. Performance, scale and cost controls

### 16.1 Application scale

- Add pagination to library, catalogue, messages and admin lists.
- Use SQLAlchemy query limits and avoid N+1 loading.
- Add DB indexes based on observed queries.
- Use transaction pooling for serverless API database connections where appropriate.
- Keep request handlers short; offload ingestion and memory consolidation.
- Use idempotent jobs and bounded retry with exponential backoff.
- Add per-user and per-IP rate limits for expensive endpoints.
- Cap upload size, pages, tokens and concurrent jobs by plan/policy.
- Protect LLM/voice endpoints from abuse and runaway usage.

### 16.2 Latency controls

- Stream text model output where supported.
- Stream TTS audio rather than waiting for a complete file for every turn.
- Precompute book embeddings and character profiles once.
- Cache public catalogue retrieval artifacts and safe public static assets.
- Cache only deterministic operations or content-versioned results.
- Use compact conversation summaries plus recent turns.
- Retrieve a small, relevant, spoiler-safe context; do not send the whole book to the LLM.
- Use task-appropriate model sizes and prompt caching where available.
- Measure p50/p95 latency separately for upload, ingestion, retrieval, LLM response and TTS.

### 16.3 Cost controls

Track per-user:

- Tokens by provider/model.
- Embedding volume.
- Number of processed pages/chunks.
- STT audio minutes.
- TTS generated characters/audio seconds.
- Realtime voice session duration.
- Storage and bandwidth where available.

Provide limits/alerts and a text-only fallback when voice quota is exhausted. Do not promise unlimited voice or unlimited full-book processing.

---

## 17. Security, privacy, rights and safety

- Enforce authentication on all private API routes.
- Use owner-scoped repository methods and test cross-user access denial.
- Apply RLS to tables exposed through Supabase client access; remember that service-role access bypasses RLS and therefore requires server-side authorization checks.
- Never use frontend role state as authority.
- Validate file extension, MIME, size, file signature, archive expansion limits and parse safety.
- Store private books/audio in private buckets and use short-lived signed URLs.
- Encrypt/secure backups and restrict production DB/admin access.
- Add account data export and deletion behavior, including R2 objects, chat history, memories and generated audio.
- Retain raw microphone recordings only with explicit opt-in; transcript-only is the default.
- Clearly disclose that character voices are synthetic/AI-generated.
- Use generic synthetic voices, provider catalog voices or voices with documented permission. Do not impersonate real actors/authors/celebrities or clone anyone's voice without required rights and explicit consent.
- Do not clone voices of minors. For fictional child characters, use an approved generic synthetic youthful voice only if provider policy permits and quality/safety review passes.
- Maintain book, cover art, avatar, font and voice asset provenance/licence records.
- Public-domain status is jurisdiction- and edition-dependent; review before publishing a featured work or associated cover/art.

---

## 18. Testing and acceptance criteria

The codebase is not production-ready merely because the app starts. Each phase must satisfy the following tests.

### 18.1 Persistence and multi-user tests

- User A uploads a book, signs in on another browser/device and sees the same library.
- User B cannot list, fetch, edit or delete User A's private book.
- User B cannot fetch User A's chat messages, memories, state or audio URLs.
- Browser local storage clearing does not delete server-side library data.
- Public catalogue book content is shared but user progress/state/conversations are independent.
- Deleting a user/book respects retention and referential-integrity rules.

### 18.2 Ingestion/classification tests

- Valid novel PDF and EPUB are accepted.
- Short story and supported play are accepted according to policy.
- Cover letter/CV/invoice/academic paper are rejected or sent to manual confirmation, not converted into fictional characters.
- Corrupt/empty/password-protected/oversized files return safe actionable errors.
- Long books process beyond the old 50,000-character truncation.
- Duplicate upload is idempotent.
- Worker crash/retry does not duplicate characters/chunks.
- Chapter order and source passage/page references remain correct.

### 18.3 Retrieval/spoiler tests

- Exact quote and semantic question retrieve supporting passage.
- Chapter filter excludes all later chapters before model prompt construction.
- Future chapter facts do not leak through character profile, memory, relationship or summary.
- A question unsupported by the book returns an uncertainty/unknown answer rather than invented canon.
- Amharic query against English book retrieves correct English evidence in benchmark tests.
- Search results are tenant-scoped and book-scoped.

### 18.4 Character state and memory tests

- A character's canonical profile is not mutated by one reader's conversation.
- Two users get independent states for the same featured character.
- Invalid LLM state output is rejected and previous state remains safe.
- State transition is deterministic for the same observation and state version.
- Memory deduplicates and records provenance.
- User can inspect/delete personal memories.
- Spoiler-ineligible memories are excluded.

### 18.5 Voice tests

- Mic permission denied → clear fallback to text.
- Voice activity detected → `listening` UI shown.
- Silence endpoint automatically submits transcript without Send.
- Long natural pause does not prematurely submit at unacceptable rates.
- Empty/noisy/low-confidence transcript gets a retry or edit option.
- Voice and text appear in one ordered conversation history.
- Character response plays in the assigned voice.
- User interruption stops current audio and begins a new turn.
- Reconnect/reload does not duplicate messages.
- Provider TTS failure still leaves text reply.
- User can disable microphone and exit voice mode immediately.
- Voice catalog selection remains stable per character/session.
- Amharic STT and Amharic TTS are evaluated separately with native speakers; do not mark Amharic audio support complete until both input and output meet the acceptance threshold.
- API credentials are never exposed to the browser.

### 18.6 Performance/load tests

Establish a baseline and test progressive concurrent usage (for example 10, 25, 50, 100 concurrent readers) with a mix of:

- Library browsing.
- Book retrieval.
- Text chat.
- Book upload/ingestion jobs.
- Voice sessions.

Measure p50/p95/p99 latency, DB connection saturation, queue depth, worker throughput, provider rate limits, failure rate and cost per successful task. Set final SLOs only after a realistic baseline and hosting plan are known.

### 18.7 CI gates

- Backend lint/type checks where configured.
- Backend unit and integration tests.
- Frontend lint and tests.
- Production build.
- Migration upgrade/downgrade validation in a disposable database.
- Secret scanning/dependency audit.
- RAG/spoiler benchmark suite.
- Critical multi-tenant authorization tests.

---

## 19. Phased implementation order

Do not implement everything in one unreviewable agent run. Create a branch, keep commits focused and complete the acceptance criteria at each gate.

### Phase 0 — Reconcile architecture and secure the repository

- [ ] Confirm actual branch/commit and working-tree state.
- [ ] Compare current code with the November 2026 architecture guide.
- [ ] Create current-state inventory: used, unused, legacy, missing, risky.
- [ ] Rotate any exposed R2 credentials if they are real; purge secrets from docs/history as appropriate.
- [ ] Add/verify `.gitignore` and secret scanning.
- [ ] Back up DB/vector/object data before cleanup.
- [ ] Decide final provider/model candidates based on tests, not names in old env examples.

**Exit gate:** Reconciled inventory, secrets rotated, backups verified, proposed migrations reviewed.

### Phase 1 — Database authority and local-storage removal

- [ ] Make PostgreSQL the source of truth.
- [ ] Complete APIs for books, library, characters, sessions, messages, state and memories.
- [ ] Add owner-scoped access checks and RLS where applicable.
- [ ] Migrate existing user workspaces and chat snapshots out of localStorage.
- [ ] Keep local cache only as an optional performance optimization.
- [ ] Add cross-device and cross-user tests.

**Exit gate:** A user sees the same data after login on another browser; user isolation tests pass.

### Phase 2 — Storage/vector cleanup and ingestion modernization

- [ ] Standardize R2 object storage and remove production local fallback.
- [ ] Add presigned browser uploads.
- [ ] Standardize PostgreSQL `pgvector`; backfill current embeddings.
- [ ] Implement worker/queue and idempotent ingestion jobs.
- [ ] Add PDF/EPUB/TXT handling and classification gate.
- [ ] Add chapter segmentation and full-book character extraction.
- [ ] Remove Chroma/Qdrant only after successful migration and reference audit.

**Exit gate:** Large direct uploads work; ingestion is resumable; classification and chapter tests pass; legacy vector store no longer receives writes.

### Phase 3 — Retrieval and character-engine accuracy

- [ ] Implement hybrid lexical/vector retrieval.
- [ ] Enforce spoiler filtering across passages, character facts and memories.
- [ ] Add source evidence to character profile facts.
- [ ] Separate canonical profile, per-user character state and per-user memory.
- [ ] Implement deterministic PSI state transitions and append-only events.
- [ ] Add RAG golden tests and unsupported-answer handling.

**Exit gate:** Spoiler tests pass; same public character has independent reader states; answers are evidence-grounded.

### Phase 4 — Bilingual foundation

- [ ] Add language metadata fields and user language settings.
- [ ] Benchmark multilingual embeddings for English/Amharic cross-language retrieval.
- [ ] Add conversation-language prompt rules and entity/name consistency.
- [ ] Create Amharic evaluation set reviewed by fluent speakers.
- [ ] Test Amharic STT separately; do not ship TTS until provider voice quality is approved.

**Exit gate:** English baseline remains stable; Amharic text interactions and cross-language retrieval pass agreed evaluation.

### Phase 5 — Voice catalog and chained voice interaction

- [ ] Add provider-independent STT/TTS interfaces.
- [ ] Add voice catalog and metadata schema.
- [ ] Curate initial approved voice set and playable previews.
- [ ] Add automatic character-to-voice matching and user override.
- [ ] Implement VAD/endpointing with automatic submission (no Send phrase/button requirement).
- [ ] Connect transcript to canonical chat turn endpoint.
- [ ] Stream character TTS audio, store transcript and support interruption.
- [ ] Add user voice preferences and cost/usage tracking.

**Exit gate:** User speaks naturally, transcript is auto-submitted, character speaks, message persists once, interruption and text fallback work.

### Phase 6 — Real-time voice (optional advanced release)

- [ ] Evaluate OpenAI Realtime/WebRTC or another provider with a test harness.
- [ ] Create short-lived session credentials server-side.
- [ ] Implement controlled backend tool delegation so Lorely owns RAG/character response/state.
- [ ] Test voice selection per character and session recreation where provider voice cannot change mid-session.
- [ ] Measure latency, cost, turn detection and interruption against Stage A.
- [ ] Ship only if it materially improves UX without reducing grounding or privacy.

**Exit gate:** Real-time voice matches or improves Stage A's character correctness and passes privacy/cost tests.

### Phase 7 — Featured catalogue, avatars, admin and production launch

- [ ] Publish reviewed public-domain/licensed featured books.
- [ ] Add reusable avatar library and stable character assignment.
- [ ] Remove Manager role and implement secure `/admin/login` and `/admin`.
- [ ] Implement functional user settings.
- [ ] Deploy frontend/API on Vercel and worker separately.
- [ ] Configure monitoring, backups, limits, alerts and runbooks.
- [ ] Perform load/security regression testing.

**Exit gate:** Production deployment passes end-to-end flows, rights/security review, backup restore test and load evaluation.

---

## 20. Definition of done for the whole refactor

Lorely can be called production-ready for the agreed launch scope only when:

- No user library or chat depends on browser-only persistence.
- PostgreSQL is authoritative and private data is correctly owner-scoped.
- R2 is the only production object store; no local disk fallback is used for durable production data.
- Chroma/Qdrant legacy stores and unused dependencies are removed only after verified migration.
- `pgvector` and retrieval have measured quality and spoiler guarantees.
- Book ingestion is asynchronous, retryable, idempotent and observable.
- Document classification prevents ordinary personal/business documents from becoming fictional character boards.
- Character profiles cite source evidence; reader-specific state/memory is isolated per user.
- State updates are validated and versioned.
- English/Amharic language settings and retrieval are tested; unsupported voice output is clearly unavailable instead of misrepresented.
- Voice mode can auto-submit after the user finishes speaking without saying “send”; the character responds in its assigned reusable voice; interruption, captions, fallback and privacy controls work.
- Voice catalog uses approved provider voices/designs; no unapproved cloning/impersonation.
- Vercel deployment does not use ephemeral disk for persistence or route large uploads through function payloads.
- Admin access is separately presented and protected by backend authorization.
- CI tests, migrations, backups, observability and operational runbooks exist.

---

## 21. Official technical references

The following references were checked on **9 November 2026**. Agents should re-check provider docs when implementing because model names, voice IDs, pricing and lifecycle dates can change.

### Lorely stack and data

- [Supabase pgvector](https://supabase.com/docs/guides/database/extensions/pgvector) — vector type, index and query support.
- [Supabase Queues / PGMQ](https://supabase.com/docs/guides/queues/pgmq) — durable PostgreSQL-backed queue.
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — tenant/data access enforcement.
- [Supabase connection pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler) — serverless connection options.
- [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) — direct browser uploads and expiring object access.
- [Vercel Function limitations](https://vercel.com/docs/functions/limitations) — duration, memory, request/response payload constraints.

### Voice and speech

- [OpenAI Realtime conversations](https://developers.openai.com/api/docs/guides/realtime-conversations) — WebRTC/WebSocket, speech-to-speech, VAD/turn-taking and voice settings.
- [OpenAI Text-to-Speech](https://developers.openai.com/api/docs/guides/text-to-speech) — TTS model and language support, streaming, voice list and deprecation notice.
- [OpenAI custom voices](https://developers.openai.com/api/docs/guides/custom-voices) — consent-based voice creation and GPT-Live prompt-generated voices; check API/model compatibility carefully.
- [OpenAI Speech-to-Text](https://developers.openai.com/api/docs/guides/speech-to-text) — transcription models, input formats, supported languages and lifecycle notes.
- [ElevenLabs Voice Design](https://elevenlabs.io/docs/help-center/product/voices/voice-design/what-is-voice-design) — prompt-created voices and supported controls.
- [ElevenLabs voice customization](https://elevenlabs.io/docs/eleven-agents/customization/voice) — voice configuration, multi-voice and pronunciation controls.
- [ElevenLabs conversation flow](https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow) — endpointing, silence, interruptions and turn-taking.
- [Google Cloud Speech-to-Text supported languages](https://docs.cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages) — includes Amharic (`am-ET`) in current list; verify region/model and actual quality.
- [Google Cloud Text-to-Speech voice list](https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types) — verify available voice language codes before enabling spoken output.

### Voice product constraints verified for this plan

- OpenAI documents a finite set of built-in Realtime voices and states that the voice cannot be changed once audio has been emitted in a session. Create a new session when switching voices if required.
- OpenAI custom prompt-generated voices are documented for GPT-Live; do not assume they are interchangeable with standard TTS/Realtime voice IDs.
- OpenAI's current TTS guide says `tts-1`, `tts-1-hd` and `gpt-4o-mini-tts` are deprecated with a scheduled shutdown on **6 January 2027**. New implementation must use a supported migration path, not hard-wire these legacy models.
- ElevenLabs Voice Design supports descriptions including age, gender, accent, tone and speaking style, but its documentation labels Voice Design experimental. Review every voice before production.
- Google Cloud Speech-to-Text currently lists Amharic (`am-ET`). The current Google Cloud TTS voice inventory checked for this plan did not return an Amharic voice, and OpenAI's published TTS language list did not include Amharic. Amharic spoken output must therefore remain unverified until a provider and native-speaker quality test pass.

---

## 22. Agent's first task after reading this document

Do **not** immediately start deleting dependencies or implementing voice.

First return a short Phase 0 report containing:

1. Actual branch, commit SHA and working-tree status.
2. Current modules that implement R2, pgvector, classification, queues/workers, VoiceService and bilingual language support.
3. Actual database models and migrations versus Section 4 target.
4. Current installed dependencies and imports; specifically prove whether LangChain, ChromaDB and Qdrant are used.
5. All tracked local data directories and whether they contain data that must be migrated.
6. The exact secrets/documentation remediation needed (never print secret values).
7. A proposed safe migration sequence with backup/rollback steps.
8. Gaps grouped by phase and the tests that will prove each one is complete.

Only after the Phase 0 report should the agent implement Phase 1. Avoid unrelated UI redesign, landing-page work or payment/billing expansion until the foundational data, security and ingestion flows are reliable.

**End of plan.**
