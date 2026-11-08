# Lorely — Product Refinement & Production Readiness Plan

**Document type:** Product, UX, architecture, and implementation reference for coding agents  
**Prepared:** 7 November 2026  
**Repository reviewed:** <https://github.com/Dawittekle/book_character_simulation>  
**Primary product direction:** A literary character exploration platform: bring a book or story into Lorely, discover its characters, and explore them through grounded, persistent text conversations (with voice designed as a future conversation mode).

---

## 0. How agents should use this document

This is the shared product and engineering brief. Treat the decisions in this document as the default source of truth unless the repository owner explicitly changes them.

Before implementation, agents must:

1. Read this entire document and inspect the current repository again. Do not assume the repository has stayed unchanged since this review.
2. Produce a phased implementation plan that maps each requirement to the actual files, APIs, migrations, and tests that will change.
3. Identify data migrations and backwards-compatibility risks before changing database schemas or removing local-storage support.
4. Implement in small, reviewable phases. Do not attempt a full rewrite in one enormous change.
5. Do not create fake users, fake metrics, fake billing values, placeholder buttons, or sample production data that looks real.
6. Do not add voice generation, character-image generation, or other paid AI calls to a normal user flow without a cost-control and fallback plan.
7. Keep the visual system consistent. Do not invent a new colour palette, navigation model, card style, or typography in each page.
8. Add tests with the feature. “It renders” is not an acceptance test.

**Important:** This file defines product intent and target behaviour. It is not permission to run destructive migrations, delete user data, rotate production credentials, or change live infrastructure without an explicit owner-approved migration plan.

## 1. Product definition

### 1.1 What Lorely is

Lorely is a book-to-character exploration platform. A reader imports a book, manuscript, or story. Lorely identifies whether the source is actually narrative content, extracts its meaningful characters and story context, builds character profiles, and lets the reader explore those characters in persistent conversations.

The product's core value is not “chat with an AI.” It is:

- Character discovery from a reader's own book or a curated featured title.
- Character profiles grounded in the source: personality, physical description when actually stated, relationships, and important events.
- Conversations that use the book's source passages, character profile, relevant conversation history, and remembered facts.
- A per-reader character simulation state that can evolve as that reader interacts with a character.
- A future voice mode that uses the same underlying conversation and character state as text chat.

### 1.2 Product promise

**Lorely — Step into the stories.**

Bring a book. Discover its characters. Explore their personalities, relationships, memories, and motivations through conversations that continue to evolve.

Avoid positioning Lorely as a book marketplace, a generic chatbot, a writing assistant, or an AI image generator. It is a companion for exploring stories and fictional characters.

### 1.3 Core user journeys

**Journey A — Discover a featured book**

1. Visitor opens Discover.
2. They browse a curated collection of books already processed by Lorely.
3. They open a title, see its description and character cast, and choose a character.
4. They start a conversation without uploading or processing the book themselves.
5. Their own chat history and character state are stored under their account; they do not modify the shared featured-book source profile.

**Journey B — Import a personal book or story**

1. User clicks **Add a book** (not “New project”).
2. They select PDF, EPUB, TXT, or paste text.
3. Lorely extracts metadata and classifies the source.
4. User sees a confirmation step with title, author, type, cover, and processing details.
5. If it is a book/story, extraction starts as a background job.
6. User sees processing progress and can leave the page.
7. When ready, the book appears in My Library with a cover, title, author (when found), character count, and processing status.
8. User opens its character gallery, then a character dossier, then starts a conversation.

**Journey C — Continue a conversation**

1. User opens Conversations or returns to a specific character.
2. Lorely loads messages from the server, not solely from browser storage.
3. The conversation opens with the correct book and character context.
4. User can inspect profile, story facts, memories, and state using contextual panels.
5. They can return on another browser/device and continue the same conversation.

**Journey D — Admin operations**

1. Administrator visits `/admin`.
2. A dedicated admin sign-in screen appears.
3. Supabase authenticates the account; the backend checks an authoritative admin role.
4. Only an approved admin may enter the admin application.
5. Admin can manage users, featured books, avatar assets, processing jobs, providers, usage, and system settings.

---

## 2. Current repository audit — confirmed findings

The public repository was inspected at the `main` branch. The current tree is relatively small: a React 19/Vite frontend and a Flask/Python backend.

### 2.1 Current frontend

Relevant files:

- `frontend/src/App.jsx` — authentication bootstrap, app routes, and a client-side `RoleGuard`.
- `frontend/src/components/AppShell.jsx` — current sidebar, topbar, profile menu, navigation, and upload modal.
- `frontend/src/components/TextUpload.jsx` — current library/dashboard.
- `frontend/src/components/UploadModal.jsx` — pasted-text/PDF import UI.
- `frontend/src/components/CharacterSelection.jsx` — character card grid and selected-character dossier.
- `frontend/src/components/ChatInterface.jsx` — chat screen, provider selector, transcript, composer, and permanently visible right-side panels.
- `frontend/src/components/CharacterInsights.jsx` — all emotion and PSI metrics rendered as stacked progress bars.
- `frontend/src/lib/workspaceStore.js` — books, profiles, selected character, and conversation snapshots stored in browser `localStorage`.
- `frontend/src/services/api.js` — only extraction and chat API client methods.
- `frontend/src/pages/admin/SystemSettings.jsx` and `UserManagement.jsx` — placeholder/dummy admin pages.
- `frontend/src/pages/manager/Approvals.jsx` and `TeamAnalytics.jsx` — placeholder manager pages.

Confirmed UX and functional issues:

- The user-facing navigation contains “Projects” even though the product is about books/stories. Rename all user-facing project terminology.
- “Characters” and “Conversations” are currently routed around the most recent book instead of having clear, complete global pages.
- The sidebar uses placeholder repeated book icons and does not show a useful book-library hierarchy.
- The workspace header includes an unhelpful team/workspace identity (“Dawit Teklebrhan Team”) instead of a Lorely reader identity.
- The banner, plan button, notification bell, and several account-menu entries do not have complete working behaviour.
- Settings uses `to: '#'`; there is no functional normal-user `/settings` page.
- The provider selector exposes “Server default / Gemini / OpenAI” in the chat header. This is implementation detail, not a normal reader control.
- Character state is displayed in an always-visible stack of emotion and PSI progress bars. It makes the conversation feel secondary and forces users to interpret unexplained numbers.
- The chat layout has excessive empty space and the always-visible details column competes with the transcript.
- The character avatar is currently initials, not a reusable illustrated profile asset.
- The current composer is a large textarea without a prepared, explicit voice-mode affordance.
- The app shell contains a client-only development role switch and fake Manager/Admin navigation.
- Admin screens contain hardcoded example users, fabricated usage/billing values, and inert buttons.

### 2.2 Current backend

Relevant files:

- `backend/src/book_character_simulation_backend/api/routes.py` — currently exposes `/api/health`, `/api/extract-characters`, and `/api/chat/<character_id>`.
- `backend/src/book_character_simulation_backend/auth.py` — Supabase token verification, but `authenticate_request()` returns `None` when there is no Authorization header.
- `backend/src/book_character_simulation_backend/services/character_service.py` — LLM character extraction, optional relational persistence, and Chroma fallback for unauthenticated usage.
- `backend/src/book_character_simulation_backend/services/chat_service.py` — prompt composition, session handling, PSI/emotion update, and fact extraction.
- `backend/src/book_character_simulation_backend/services/relational_persistence_service.py` — optional PostgreSQL persistence.
- `backend/src/book_character_simulation_backend/repositories/chroma.py` — `chromadb.PersistentClient` on a local directory.
- `backend/src/book_character_simulation_backend/repositories/relational.py` — SQLAlchemy relational access.
- `backend/src/book_character_simulation_backend/db/models.py` — current relational schema.
- `backend/src/book_character_simulation_backend/prompts.py` — character, chat, and fact-extraction prompts.
- `backend/src/book_character_simulation_backend/config.py` — environment-based configuration.
- `backend/alembic/versions/20260405_0001_create_relational_core.py` — one initial relational migration.

Confirmed backend gaps and risks:

- PostgreSQL is optional. `RelationalPersistenceService` silently becomes inactive when `DATABASE_URL` is missing.
- ChromaDB is local-disk persistent storage. That is not an acceptable production source of truth for serverless deployment.
- The Chroma repository uses `_placeholder_embeddings()` which creates all-zero vectors. Those are not useful semantic embeddings and must not be mistaken for a working retrieval system.
- `qdrant_storage` is also present in the backend tree, but the current backend dependencies and service composition do not show a production Qdrant integration. Avoid keeping multiple unused vector stores.
- `text_id` is a SHA-256 hash of source text and is being used as the book identifier. It should become a content fingerprint/deduplication key, not the canonical book primary key.
- Relational book creation writes a generic title such as `Imported Book <hash>` and a prototype summary. The actual filename/title currently shown by the frontend is locally derived; the database does not yet have a reliable book metadata ingestion flow.
- `get_or_create_book()` creates a text/plain source record and does not persist the original filename, file size, or source storage path from the uploaded PDF.
- `/extract-characters` currently accepts PDF or pasted text; EPUB is not implemented. The browser's upload flow only accepts PDF or pasted text.
- There is no book-type classifier to distinguish a novel/story from a cover letter, résumé, report, or other document.
- The current extraction prompt asks for every meaningful “character” and can treat a real person's name in a cover letter as a fictional character. A narrative/document classification gate is needed before extraction.
- Chat uses the character profile, chat history, factual memories, and state, but it does not retrieve relevant passages from the original source on every turn. “Book-grounded answers” are therefore not yet guaranteed.
- Character extraction truncates source text at `MAX_SOURCE_CHARACTERS` (default 50,000 characters). Longer books need chunk-based processing instead of silently truncating the source.
- Fact extraction is another LLM call after the character reply. This increases response latency and cost for every chat turn; it should be evaluated for async/background processing or lower-cost extraction.
- Current character emotion/PSI state is primarily stored in the chat session. Starting a new session can initialise from the original character profile rather than the latest per-reader character state. The product needs an explicit state-ownership model.
- A supplied session ID that cannot be restored may result in a new session instead of a clear not-found/ownership error. Session IDs must be validated and must not silently create a new conversation when the user expected an existing one.
- No complete book-list, book-detail, character-list, session-list, message-history, settings, admin, featured-catalog, avatar-catalog, or background-job API exists in the current route file.
- The API currently permits missing authentication headers on the extraction and chat routes. Production private operations must require a valid user.
- Existing authentication claim handling is not a complete application-role authorization strategy. A decoded Supabase `role` claim is not proof that an account is Lorely's platform administrator.

### 2.3 Repository hygiene and testing

- `backend/chroma_db/` contains committed ChromaDB binary/database artifacts.
- `backend/qdrant_storage/` contains committed storage artifacts.
- Remove runtime-generated database contents from the application repository. Before deletion, establish whether any real user/source data is present and back it up appropriately. Do not publish user uploads, extracted private text, embeddings, or conversation data in Git.
- Add explicit `.gitignore` rules for `.env` files, local databases, model/cache directories, local uploads, temporary audio, build artefacts, and test output.
- The root `.gitignore` currently ignores `docs/`. Put this plan at the repository root as `LORELY_IMPLEMENTATION_PLAN.md`, or deliberately change the ignore rule before placing it under `docs/`.
- The current backend `pyproject.toml` includes pytest in its dev extras, but no test suite is visible in the inspected backend tree.
- The frontend `package.json` currently has ESLint but no visible Vitest/React Testing Library/Playwright test scripts or dependencies.
- There is no visible `.github/workflows` CI configuration in the inspected repository tree.

**Do not ship the current code as a production multi-user system without fixing persistence, authentication/authorization, owner isolation, upload processing, and tests.**

### 2.4 Direct source files for agents

Use these exact files as the first inspection points when starting implementation work:

| Concern | Current source |
|---|---|
| App routes and client-side role guard | [frontend/src/App.jsx](https://github.com/Dawittekle/book_character_simulation/blob/main/frontend/src/App.jsx) |
| Sidebar, topbar, fake role switch, recent books | [frontend/src/components/AppShell.jsx](https://github.com/Dawittekle/book_character_simulation/blob/main/frontend/src/components/AppShell.jsx) |
| Local-only book/session source of truth | [frontend/src/lib/workspaceStore.js](https://github.com/Dawittekle/book_character_simulation/blob/main/frontend/src/lib/workspaceStore.js) |
| Current library page | [frontend/src/components/TextUpload.jsx](https://github.com/Dawittekle/book_character_simulation/blob/main/frontend/src/components/TextUpload.jsx) |
| Current import flow and file-type checks | [frontend/src/components/UploadModal.jsx](https://github.com/Dawittekle/book_character_simulation/blob/main/frontend/src/components/UploadModal.jsx) |
| Current chat and provider selector | [frontend/src/components/ChatInterface.jsx](https://github.com/Dawittekle/book_character_simulation/blob/main/frontend/src/components/ChatInterface.jsx) |
| Always-visible emotion/PSI meters | [frontend/src/components/CharacterInsights.jsx](https://github.com/Dawittekle/book_character_simulation/blob/main/frontend/src/components/CharacterInsights.jsx) |
| User settings are not yet present; admin placeholder | [frontend/src/pages/admin/SystemSettings.jsx](https://github.com/Dawittekle/book_character_simulation/blob/main/frontend/src/pages/admin/SystemSettings.jsx) |
| Fake users in admin UI | [frontend/src/pages/admin/UserManagement.jsx](https://github.com/Dawittekle/book_character_simulation/blob/main/frontend/src/pages/admin/UserManagement.jsx) |
| Current API routes | [backend/src/book_character_simulation_backend/api/routes.py](https://github.com/Dawittekle/book_character_simulation/blob/main/backend/src/book_character_simulation_backend/api/routes.py) |
| Optional/local ChromaDB service composition | [backend/src/book_character_simulation_backend/app.py](https://github.com/Dawittekle/book_character_simulation/blob/main/backend/src/book_character_simulation_backend/app.py) |
| Local ChromaDB and all-zero placeholder vectors | [backend/src/book_character_simulation_backend/repositories/chroma.py](https://github.com/Dawittekle/book_character_simulation/blob/main/backend/src/book_character_simulation_backend/repositories/chroma.py) |
| Character extraction and cache logic | [backend/src/book_character_simulation_backend/services/character_service.py](https://github.com/Dawittekle/book_character_simulation/blob/main/backend/src/book_character_simulation_backend/services/character_service.py) |
| Chat state, retrieval context, and fact extraction | [backend/src/book_character_simulation_backend/services/chat_service.py](https://github.com/Dawittekle/book_character_simulation/blob/main/backend/src/book_character_simulation_backend/services/chat_service.py) |
| Character/chat/fact prompt contracts | [backend/src/book_character_simulation_backend/prompts.py](https://github.com/Dawittekle/book_character_simulation/blob/main/backend/src/book_character_simulation_backend/prompts.py) |
| Supabase token verification | [backend/src/book_character_simulation_backend/auth.py](https://github.com/Dawittekle/book_character_simulation/blob/main/backend/src/book_character_simulation_backend/auth.py) |
| Relational persistence and ownership queries | [backend/src/book_character_simulation_backend/repositories/relational.py](https://github.com/Dawittekle/book_character_simulation/blob/main/backend/src/book_character_simulation_backend/repositories/relational.py) |
| SQLAlchemy models | [backend/src/book_character_simulation_backend/db/models.py](https://github.com/Dawittekle/book_character_simulation/blob/main/backend/src/book_character_simulation_backend/db/models.py) |
| Database connection/pooling setup | [backend/src/book_character_simulation_backend/db/session.py](https://github.com/Dawittekle/book_character_simulation/blob/main/backend/src/book_character_simulation_backend/db/session.py) |
| Initial relational migration | [backend/alembic/versions/20260405_0001_create_relational_core.py](https://github.com/Dawittekle/book_character_simulation/blob/main/backend/alembic/versions/20260405_0001_create_relational_core.py) |
| Backend dependency/runtime config | [backend/pyproject.toml](https://github.com/Dawittekle/book_character_simulation/blob/main/backend/pyproject.toml) |


---

## 3. Product and architecture decisions

These are the recommended defaults for the next development cycle.

### 3.1 Product naming and content model

Use these terms consistently:

| Current term | New term |
|---|---|
| Project | Book or Story |
| New project / New book | Add a book |
| Project list | Recent books |
| Workspace (when referring to one imported source) | Book space / Book details |
| Simulation | Character conversation (use “simulation state” only in technical detail) |
| AI character | Character / Book character |

“Book” is the primary object in the interface. “Story” is the broader option when the source is a short story or pasted narrative. Keep “document” as an explicit alternative for a source that is not a narrative.

### 3.2 Persistent cloud source of truth

PostgreSQL must become the authoritative store for user libraries, source metadata, characters, relationships, character state, chat sessions, messages, memories, settings, featured books, and avatar metadata.

The browser may use a cache for performance, but it must never be the only place where a user's books or conversations exist. Clearing browser storage, signing in on a second device, or using a new browser must not destroy or hide server-owned user data.

Recommended services:

- **Supabase Auth:** user identity and sign-in.
- **Supabase PostgreSQL:** primary relational data.
- **Supabase Storage:** original private uploads and public curated image assets.
- **Supabase pgvector:** initial vector store for book passages.
- **Background worker / queue:** PDF/EPUB extraction, OCR where needed, chunking, embedding, character extraction, and memory compaction.
- **Vercel:** frontend and request/response API deployment if function constraints are respected.

Do not introduce Qdrant, Redis, a second database, and several queue systems just because they are available. Start with Supabase/Postgres/pgvector plus one worker. Revisit a dedicated vector database only when real benchmarks show that pgvector is insufficient.

### 3.3 Recommended logical data model

Agents may adapt field types and naming, but preserve these entities and ownership rules.

| Entity | Purpose / important fields |
|---|---|
| `users` / `profiles` | Supabase user ID, display name, avatar, preferences, timestamps. |
| `user_roles` | Authoritative platform role; initially `user` or `admin`. No Manager role in this product stage. |
| `books` | UUID ID, owner or public-catalog visibility, title, author, description, language, cover asset, type, status, publication metadata. |
| `book_sources` | Original file metadata, storage bucket/path, source URL, MIME, byte size, content hash, extracted text reference, rights metadata. |
| `book_chapters` | Book ID, chapter order, chapter title, extracted start/end offsets, status. |
| `book_chunks` | Book ID, chapter ID/order, chunk text, source offsets/page reference, embedding, metadata. |
| `characters` | Book ID, stable character key, name, role/archetype, personality, source-grounded appearance description, key-event list, extraction confidence, avatar ID. |
| `character_relationships` | Character-to-character relationship edges, description, type, source passage references. |
| `user_character_states` | Owner/user ID + character ID, latest per-reader emotion/PSI values, last updated, optional state version. |
| `chat_sessions` | Owner ID, book ID, character ID, title, spoiler/read-progress boundary, timestamps, session state/version. |
| `chat_messages` | Session ID, sequence, role, text, input modality (`text`/`voice`), provider-neutral metadata, timestamps. |
| `character_memories` | Owner ID, character ID, fact, source session/message, confidence, visibility, created/updated. |
| `avatar_assets` | Stable asset ID, image storage path, style, tags, license/source/creator, dimensions, enabled flag. |
| `featured_books` | Public catalogue visibility, order, curated collection, rights review, processing version. |
| `processing_jobs` | Book/source ID, stage, status, progress, retry count, error code, timestamps. |
| `usage_events` | Provider, model, token/audio duration, request type, cost estimate, owner, timestamp. |
| `user_settings` | Theme, display, audio preferences, reading/spoiler preference, privacy settings. |

Recommended identity rules:

- Use UUIDs or equivalent opaque primary keys for book, character, session, and message records.
- Keep a SHA-256 content hash as a deduplication/fingerprint field, scoped by owner or source rights; do not use the hash as the user-facing book ID.
- A character is a canonical entity within a particular book edition/source. A user's simulation state and memories are private to that user-character relationship.
- The featured-book character profile is shared as immutable curated source data. Every reader gets their own `user_character_state`, memory, and chat sessions. One reader must never mutate another reader's character relationship or history.
- Keep source text/chunks, book metadata, and cover images separate. Do not store large image blobs in PostgreSQL rows.
- Use migrations for every schema change. Do not rely on `create_all()` for production schema evolution.

### 3.4 Character-state ownership

Use a clear state model:

- **Canonical character profile:** the extracted character's stable source-grounded baseline.
- **Per-user character state:** each reader's evolving simulation of that character. It is private to the reader, even for a featured book.
- **Conversation history:** each conversation/session has its own transcript.
- **Memory:** selected facts from the reader's conversation with that character, retrievable across sessions for that reader.

When a reader begins another conversation with the same character, Lorely should continue from that user's latest character state by default, while preserving a separate transcript for the new session. Add a “Reset character experience” action that is clearly scoped to that reader's own state/memories. Never update the shared featured-book character baseline with an individual user's interactions.

State metrics are an AI simulation representation, not clinical or scientifically validated psychological measurements. Label them accordingly and explain their interpretation in the UI.

---

## 4. Book and document recognition — required fix

This directly addresses the screenshot where a file named `cover_letter.pdf` was displayed as a book and a person's name was extracted as a character.

### 4.1 Required behaviour

Lorely must not assume that every PDF or text upload is a book. A filename is a hint, not reliable evidence of content type.

Classify imported content into at least:

- `book` — a book-length narrative or nonfiction title that the user intends to explore as a book.
- `story` — short story, screenplay, manuscript, or other narrative fiction.
- `document` — report, cover letter, résumé/CV, article, essay, notes, or other non-book document.
- `unknown` — insufficient evidence; ask the user to confirm.

The platform can still offer an explicit “Try character extraction anyway” mode for a user who wants to experiment with arbitrary text, but do not silently treat a résumé/cover letter/report as a fictional book.

### 4.2 Import pipeline

1. Validate extension, MIME type, signature/magic bytes, file-size policy, and supported format.
2. Save original file to a private Storage path such as `users/{user_id}/books/{book_id}/source/{source_id}.{ext}` using an opaque generated key. Never use the user filename directly as a path.
3. Extract embedded metadata first: PDF document metadata, EPUB OPF title/creator/language/identifier, and user-supplied fields.
4. Extract text in a controlled pipeline. For scanned PDFs, detect whether text extraction is empty/very low and offer or queue OCR; do not silently send unreadable pages to the LLM.
5. Detect title-page/front-matter signals and author metadata. Use a content classifier as a second signal, not the sole source of truth.
6. Optionally look up likely book metadata by title/author/ISBN using Open Library Search API. Cache results and show candidates for user confirmation. Open Library is a metadata discovery source, not a backend for high-volume bulk scraping.
7. Display a confirmation card before expensive character extraction: title, author, cover, detected type, language, page/word estimate, and a “This looks like a document/story/book” message.
8. If type is `document`, do not run character extraction by default. Offer the explicit experiment path with a warning that names in documents may be treated as entities, not fictional characters.
9. Queue the job and return a job ID. The frontend polls or subscribes to job status; it does not wait for an entire book to finish inside one upload request.
10. On success, show a book/character-ready state and allow the user to open the character gallery.

### 4.3 Metadata rules

- Prefer user-confirmed metadata and embedded EPUB/PDF metadata.
- Infer title/author from the title page or front matter when clear.
- Use external catalogue lookup to suggest likely matches, not silently overwrite source metadata.
- Use the filename only as a final fallback title.
- For a pasted excerpt, ask for an optional title/author and allow “Untitled story”.
- Keep the original filename as source metadata; never confuse it with the canonical book title.
- Record metadata confidence and its source (user, embedded file, extracted, external catalogue).

### 4.4 Extraction prompt changes

Before extracting character profiles, establish whether the text is narrative and whether each person/entity is a fictional character within that narrative.

Add to character data:

- Character name and source aliases.
- Story role (protagonist, antagonist, supporting, narrator, etc.).
- Personality and voice/speech-style observations grounded in passages.
- Physical appearance only when explicitly described in source text; include short evidence references and confidence.
- Relationships as structured links where possible, not only freeform strings.
- Important events with chapter/passage references and spoiler boundary metadata.
- Missing or uncertain data as `unknown`; do not invent unsupported details.

If the source is a cover letter, CV, report, or other non-fiction document, return a classification result and a user-facing explanation rather than manufacturing fictional characters from author names, referees, or people mentioned in the text.

### 4.5 Supported file types

**Target MVP:** PDF, EPUB, TXT, and pasted text.  
**Later:** DOCX and OCR for scanned image-only PDFs, once security, costs, and processing limits are in place.

The current backend handles PDF/pasted text, not EPUB. The current frontend accepts PDF/pasted text only. Implement format support explicitly rather than changing the file input accept attribute alone.

---

## 5. Book knowledge and character intelligence

### 5.1 Source-grounded RAG

Implement real retrieval from original book passages before claiming that characters can reliably discuss the source.

Recommended pipeline:

1. Extract text while preserving page, chapter, heading, and source offsets.
2. Split into meaningful chunks using chapter boundaries and paragraph structure. Avoid cutting every N characters without regard to paragraphs or dialogue.
3. Store chunks with `book_id`, `source_id`, `chapter_id`, `chapter_order`, `page_number` (when available), character references if known, and source offsets.
4. Generate embeddings with a selected embedding provider/model. Store the model/version and embedding dimensions with the records.
5. Query by the user's message, current character, book, and spoiler-progress boundary.
6. Retrieve a small set of high-relevance source passages; rerank if needed.
7. Build the character prompt from canonical profile + relevant source passages + relevant memories + recent transcript + per-user state.
8. Generate the reply and preserve the relevant source references for optional “Why did they say that?” / source-citation UI.

Do not reuse the current all-zero placeholder embeddings. Add tests that demonstrate semantically related passages are retrieved and irrelevant passages are not.

Supabase pgvector is a sensible first choice because the application already uses PostgreSQL. Enable the extension, store genuine embeddings, index and benchmark queries, and filter retrieval by book/owner/visibility/chapter. Supabase documentation: <https://supabase.com/docs/guides/database/extensions/pgvector>.

### 5.2 Spoiler-aware retrieval

Build a spoiler policy into the data model and prompt workflow now, even if the first UI is simple:

- `no_spoilers` / reader progress limited to selected chapter.
- `all_book` / allow references to the full source.
- Optional explicit “Discuss the ending” override.

Never send source passages from later chapters to the character prompt when the current conversation is marked spoiler-safe. Add regression tests using a book with a reveal near the end.

### 5.3 Memory design

Do not persist every sentence as a long-term memory. Store a small set of useful, deduplicated facts that are actually relevant to future conversations.

Memory needs:

- owner/user ID;
- character ID;
- text/fact;
- source session/message ID;
- creation/update time;
- confidence and optional category;
- privacy/deletion behaviour.

Memory extraction can run after the visible reply is safely persisted, but the next turn must not race and miss the latest memory update. Use a job/event status or an explicit “memory update pending” state. Avoid an unbounded second LLM call on every turn if a cheaper/less frequent strategy performs acceptably.

### 5.4 Character profile quality

Profiles should be evidence-grounded, structured, and concise. Do not give every character generic traits like “brave, intelligent, curious”. Require the extraction process to cite or retain source evidence for key personality and appearance claims. Keep contradictory descriptions and uncertainty explicit.

---

## 6. Reusable character-avatar library — no per-character image generation

The product should not call an image-generation model every time it discovers a character. This would create unnecessary per-book costs, long processing times, inconsistent visual styles, and a difficult moderation/rights problem.

### 6.1 Recommended solution

Create a curated, reusable Lorely avatar catalogue. Seed it once, store each image once, and assign an existing asset to characters using metadata tags.

Start with approximately 40–80 original, consistently styled portrait assets, then expand the library as gaps are identified. This number is a starting target, not a requirement to block the application launch.

Preferred storage:

- Image files in Supabase Storage, e.g. a `character-avatars` bucket.
- Metadata in `avatar_assets` table or a versioned JSON seed file in the repository.
- `characters.avatar_asset_id` references the selected asset.
- Keep a local fallback portrait/monogram so the app always has a deterministic image even when an asset fails to load.

For a small static catalogue, a repository directory under `frontend/public/avatars/` is acceptable initially, but large growing collections should use object storage and a CDN. Do not store raw image bytes in Postgres.

### 6.2 Avatar asset metadata

Each asset should include:

- stable `asset_id`;
- file path/URL;
- art style (e.g. painterly, ink, illustrated portrait);
- age presentation band (only where visually and explicitly represented by the design);
- hair colour/style tags;
- eye/face/hairstyle tags where appropriate;
- clothing/period tags;
- genre/archetype tags (e.g. scholar, sailor, royal court, traveller, fantasy, gothic);
- optional mood/expression tag;
- file format, dimensions, size;
- creator/source and explicit licence/permission metadata;
- enabled/disabled status.

Do not infer a character's ethnicity or other sensitive identity from a name. Use only appearance explicitly stated in the source, or provide a neutral/default illustrated avatar when the source does not describe appearance.

### 6.3 Matching workflow

1. Character extraction records an `appearance_description` only when evidence exists.
2. A lightweight tag mapper converts the description to known avatar tags; this can use deterministic rules first and a low-cost structured LLM extraction only when useful.
3. Compute a weighted match from tags and genre/style compatibility.
4. Prefer an unassigned or underused portrait within the same book to avoid every character receiving the same image.
5. If the confidence is low, choose a neutral portrait or book-themed avatar rather than pretending to know what the character looks like.
6. Allow the reader to change the character avatar from the available catalogue if that feature is later approved.
7. Cache the selected `avatar_asset_id`; do not re-run the matching or image generation for every page view.

### 6.4 Visual consistency and rights

Use an original, consistent illustration style. Do not use film/TV actor photographs, copyrighted adaptation stills, arbitrary Google Images assets, or unlicensed fan art. If using Wikimedia Commons, verify each file's own licence and attribution terms; the Commons reuse guidance explicitly requires checking each file page: <https://commons.wikimedia.org/wiki/Commons:REUSE>.

CC0 assets are suitable where the source/rightsholder has actually applied CC0; Creative Commons explains CC0 at <https://creativecommons.org/public-domain/>. Record the licence and source for every asset. Do not label a work CC0 yourself unless the rights holder has the authority to do so.

---

## 7. Featured books and public character catalogue

This is a strong product feature. It removes the first-upload barrier and lets new users try Lorely immediately.

### 7.1 Discover page

Add a **Discover** area with:

- Featured books.
- Curated collections (e.g. mystery, adventure, classic literature, science fiction, folklore).
- Popular characters.
- Recently added catalogue titles.
- Search by book title, author, and character.
- A visible indicator that a title is a curated featured book.

Each book detail page should show its cover, title, author, short description, source/edition information, language, character count, and available characters.

### 7.2 Pre-process featured titles

Featured books must be ingested and processed once by an admin/worker pipeline. Do not run a full character extraction every time a user clicks a featured title.

Each featured title should have:

- verified source file and source URL;
- title, author, edition/publication information, language;
- cover image provenance and rights;
- copyright/rights status and jurisdiction notes;
- licence URL or public-domain assessment source;
- date of rights review and reviewer;
- ingestion/processing version;
- character profile set and book chunks;
- public visibility flag and catalogue collection.

### 7.3 Copyright and distribution guardrails

Do not assume that a famous book is free to distribute merely because it is old, available on the internet, or appears in a public ebook catalogue.

Project Gutenberg states that much of its collection is not restricted by U.S. copyright law, but it also instructs non-U.S. users to check local laws and warns that some books are included with permission that does not automatically grant redistribution rights. Read the individual ebook licence and the jurisdiction where Lorely makes it available: <https://www.gutenberg.org/policy/license> and <https://www.gutenberg.org/policy/terms_of_use>.

Recommended approach:

- Begin with carefully reviewed public-domain titles or books with explicit commercial redistribution/processing permission.
- Keep the original title/author and source attribution.
- Do not use a modern copyrighted novel as a public featured source without a licence or a reviewed legal basis.
- For user uploads, keep uploaded files private and isolate them per user. Do not make them featured or visible to other readers by default.
- Add a takedown/contact process before public launch.
- Keep rights status in the data model rather than hiding it in an admin note.

### 7.4 Metadata and cover lookup

Open Library can provide book metadata and cover lookups. Its Search API returns work/edition information and cover identifiers: <https://openlibrary.org/dev/docs/api/search>. The Covers API provides cover images by ISBN/OLID/cover ID and recommends using the `covers.openlibrary.org` image URL and a courtesy link back to Open Library: <https://openlibrary.org/dev/docs/api/covers>.

Open Library explicitly says its APIs are not a high-traffic commercial backend and asks apps to cache, identify themselves, and avoid bulk scraping: <https://openlibrary.org/developers/api>. Use it as a human-facing metadata lookup with caching, not as Lorely's content database or ebook source.

---

## 8. Information architecture and navigation

The existing sidebar is a generic team/project sidebar. Lorely is a personal literary library and character conversation product; its navigation should reflect those objects.

### 8.1 New primary sidebar

Use this information architecture:

**EXPLORE**
- Discover

**YOUR LIBRARY**
- My Library
- Conversations
- Saved (optional for the first release; include only when favourites/bookmarks work)

**RECENT BOOKS**
- Up to 5 recently opened books, each with a small cover thumbnail and shortened title.
- “View all” takes the user to My Library.

**BOTTOM AREA**
- Settings
- Help / Feedback
- User profile menu
- A visually clear **Add a book** action near the top (or above the recent-books group).

Do not show a standalone global Characters link in the primary sidebar unless a functional all-books character discovery page exists. For the initial information architecture, characters belong inside a book's character gallery and are also discoverable from search and Conversations.

### 8.2 Sidebar behaviour

- Desktop expanded width: approximately 232–248px.
- Collapsed desktop rail: approximately 64–72px, with tooltips and accessible labels.
- Tablet: compact rail or overlay depending on viewport.
- Mobile: slide-in drawer opened by a visible menu button; selecting a destination closes the drawer.
- Keep the top brand area small: Lorely mark + “Lorely”, not a fake organization/team switcher.
- Use one icon per destination from a consistent icon library (Lucide is fine). No repeated book icon for every nav item.
- The active nav item has a quiet filled background and high-contrast text; do not rely on colour alone.
- Recent book rows show a miniature cover or fallback cover artwork, title, and optional unread/new indicator.
- No drag-and-drop requirement. Any future sidebar customization must also be operable through a normal button/menu.

Reference patterns: Slack's sidebar organization and starred conversations show how persistent conversations can be grouped, filtered, and kept visible without turning the sidebar into a general-purpose project tree: <https://slack.com/help/articles/360043207674-Organize-your-sidebar-with-custom-sections> and <https://slack.com/help/articles/201331016-Star-channels-and-direct-messages>.

### 8.3 Global topbar

- Global search placeholder: **Search books, characters, and conversations…**
- A single primary **Add a book** action.
- User profile menu containing Profile, Settings, Help, and Sign out.
- Remove the fake notification count until real notifications exist.
- Remove the “See Plans” banner until billing/pricing is an actual working product feature.
- Do not expose model provider names in the normal reader topbar or chat header.

---

## 9. Visual design system — fixed recommendations

### 9.1 Brand direction

**Direction:** quiet literary editorial with restrained magical atmosphere.

The product should feel like a beautiful modern reading room, not a generic enterprise admin dashboard, a loud gaming interface, or a dark neon chatbot.

The generated visual concept shown during this conversation is an optional visual reference. Implement the exact design system below rather than treating an AI-generated mockup as pixel-perfect source code.

### 9.2 Colour tokens

Use these as the starting design tokens. Confirm text contrast in implementation; do not use a colour just because it looks attractive in a mockup.

| Token | Hex | Usage |
|---|---|---|
| `ink` | `#252A25` | Main text and high-contrast elements |
| `forest` | `#203B2F` | Primary action, active nav, user message bubble |
| `forest-soft` | `#E7EEE8` | Selected/quiet forest surface |
| `parchment` | `#F5F0E6` | Main app background |
| `paper` | `#FFFCF7` | Cards, chat surface, drawers |
| `sand` | `#E9E1D3` | Subtle surface and border contrast |
| `brass` | `#B58A4D` | Small highlights, decorative details, selected accents |
| `olive` | `#788C71` | Secondary status accent |
| `muted` | `#76766F` | Secondary text; verify contrast |
| `border` | `#E4DED3` | Dividers and card borders |
| `danger` | `#A84B43` | Destructive/error state only |

Use warm light mode as the launch default. A dark theme can be introduced later through tokens; do not mix arbitrary dark/light panels on the same screen.

### 9.3 Typography

- Display/headings: `Fraunces` or `Cormorant Garamond` (choose one and use consistently).
- UI/body: `DM Sans` or `Inter` (choose one and use consistently).
- Book titles may use the display font; interface labels, navigation, buttons, form controls, and chat text use the UI font.
- Use a readable body size (16px base where possible), sensible line height, and restrained all-caps eyebrow labels.
- Avoid long italic text, ultra-thin grey body copy, and decorative typography in buttons or metadata.

### 9.4 Surfaces, spacing, and effects

- Card radius: 12–16px.
- Inputs/buttons: 10–12px radius.
- Border: 1px subtle border token.
- Shadows: soft and restrained; avoid heavy neumorphism.
- Content max width: approximately 1440px.
- Main page padding: 28–40px desktop, 16–20px mobile.
- Use an 8px spacing rhythm.
- Avoid giant empty areas, tall unnecessary cards, and overuse of pill badges.
- Use decorative book/ink/leaf motifs sparingly, mainly on Discover and empty states.
- No full-screen 3D inside the signed-in workspace. A future marketing landing page may have one strong 3D hero.

### 9.5 Interaction and accessibility

- Every control must work and have visible hover, pressed, disabled, and keyboard-focus states.
- Keep keyboard focus visible. WCAG 2.2 guidance: <https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html>.
- Aim for touch targets of at least 24×24 CSS pixels as the WCAG 2.2 minimum; larger targets (around 40–44px) are preferred for common actions: <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum>.
- Use semantic buttons and links. Typical website navigation should not use ARIA `menu` roles unless implementing the complex keyboard behaviour that role implies. WAI-ARIA disclosure navigation guidance: <https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/>.
- Popovers/disclosures need an accessible trigger with `aria-expanded`, Escape handling where appropriate, logical focus behaviour, and screen-reader labels. See <https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/>.
- Respect `prefers-reduced-motion`; animations must not be required to understand the interface.
- Avoid hover-only functionality. Anything revealed on hover must also be available on click/tap and keyboard focus.

---

## 10. Required page and component designs

### 10.1 Discover

Purpose: let users explore Lorely without needing to upload a book first.

Layout:

- Small page heading: “Discover stories”.
- Search books/authors/characters.
- Featured collection hero with one or two featured book covers/illustrations.
- Horizontal shelves or responsive grids: Featured, Classics, Adventure, Mystery, Science Fiction, New to Lorely.
- Book cards show cover, title, author, `N characters`, and concise description.
- Cards have clear focus/hover treatment and a single predictable action.
- Add category filters only when they are backed by real catalogue data.
- Public featured books must be clearly marked as curated.

Avoid: endless generic AI-generated artwork, fictional ratings, empty social metrics, and fake “popular” counts.

### 10.2 My Library

Purpose: show books/stories imported by the currently signed-in user.

- Page heading: **My Library**.
- Primary CTA: **Add a book**.
- Search/filter by title, author, type, and processing status.
- Responsive cover-led grid/list toggle (the toggle must actually work if shown).
- Each book card: real cover or consistent generated fallback, title, author if known, source/type, character count, last opened date, and processing state.
- Context menu: Open, Rename, Edit metadata, Remove from Library. Destructive removal requires confirmation and clearly says what will be deleted.
- Loading, empty, failed, and processing states must be designed—not just a blank grid.
- A processing card can show stage/progress, e.g. “Extracting chapters”, “Finding characters”, “Building book memory”. Do not show a fake percentage unless the worker can calculate meaningful progress.

### 10.3 Book detail / character gallery

- Header has book cover, title, author, short description, source/edition badge, and book-level actions.
- Show processing or source warnings clearly.
- Character gallery uses curated avatars; cards display name, role, short personality description, and a small relationship/context hint.
- Selected character opens a proper dossier panel/page, not a tiny cramped list.
- Dossier sections: Overview, Personality, Relationships, Important events, Appearance (only when source-grounded), and Start conversation.
- Show citations/chapter references for important events where available.
- Add sorting/search when cast size grows.

### 10.4 Character dossier

The dossier is a focused profile, not a metrics dashboard.

- Large character portrait.
- Name, book title, narrative role, and one-sentence description.
- Personality and speech style.
- Relationships displayed as a small visual list/graph only if the data is structured and accurate.
- Important events with chapter references and spoiler policy.
- A compact “Current character state” summary for this reader.
- Primary CTA: **Talk to [Character]**.
- Secondary: Save/favourite character; change avatar (if implemented).

Never invent age, appearance, nationality, relationships, or life events that are not stated or clearly supported by source passages.

### 10.5 Conversations index

Create a real cross-book Conversations page backed by the database.

- Group recent chats by last activity.
- Show character portrait, character name, book title, last message preview, updated timestamp, and unread indicator only if unread state exists.
- Search/filter by book or character.
- Resume opens the correct `session_id` and loads messages from the API.
- Provide a way to start a second conversation with the same character without losing the older one.
- Support archive/delete with clear scope.

### 10.6 Character chat — priority UI redesign

The chat is the core product experience. Design it before the marketing landing page.

**Layout:**

- Keep the global navigation compact and persistent on desktop.
- Conversation area is central and dominant (comfortable max width around 760–900px).
- Character details are a collapsible side drawer or popover, not a permanently stacked right column.
- The default chat view should prioritise the transcript and composer.
- On mobile, the conversation fills the viewport and details open as a bottom sheet/full-screen subview.

**Chat header:**

- Character portrait (small but recognizable).
- Character name.
- Book title as a secondary link.
- Short personality tag/description, truncated carefully.
- A **Character** or **Details** button opens the character dossier drawer.
- A compact **State** button/pill opens the simulation-state popover/drawer.
- Optional “New conversation” action.
- Remove the Gemini/OpenAI provider dropdown from ordinary chat. Provider/model is an admin/system configuration unless there is a deliberate paid user choice later.

**Transcript:**

- Character messages left-aligned with small character avatar and name.
- Reader messages right-aligned with restrained forest surface.
- Character message surface uses paper/white with clear text contrast.
- Preserve paragraphs, lists, emphasis, and message timestamps in a quiet way.
- Add copy and regenerate/retry controls only where implemented.
- Use a clear typing/loading state and an error retry action.
- Keep the conversation scroll anchored sensibly; do not jump the reader unexpectedly when they scroll up.
- Provide “Continue from here” or regenerate only if the server can branch/replay safely.
- Show a small source/citation affordance when the response was grounded in book passages (e.g. “Based on Chapter 4”).

**Composer:**

- Sticky at bottom of the conversation container.
- One main text field with a clear placeholder such as “Ask [Character] about a moment in [Book]…”.
- Send action with keyboard hint.
- Reserve a microphone control and a voice-mode entry point now, but do not show a non-working microphone button. It should remain hidden or be labelled “Voice (coming soon)” until implemented.
- Input focus, send-disabled, sending, and network failure states must be clear.
- `Enter` sends and `Shift+Enter` inserts a newline on desktop; mobile uses a clear send button.
- Keep draft text when requests fail.

**Right-side context / details drawer:**

Open only when the reader presses the Character/Details button. Tabs/sections:

1. Profile — personality, role, appearance, speech style.
2. Story — key events, relationships, chapter references.
3. Memory — reader-specific facts the character remembers, with edit/delete controls where appropriate.
4. State — the per-reader emotional/simulation state and its recent changes.

This panel should not occupy one-third of the screen by default.

### 10.7 Emotion and simulation-state UI

The current always-visible progress-bar list is not suitable as the primary chat layout.

New behaviour:

- Show only a compact state summary in the character header, for example **State · Reflective** or a small ring/indicator.
- Clicking **State** opens a popover on desktop or a drawer/bottom sheet on mobile.
- In that panel, separate **Emotion indicators** from **Simulation parameters**.
- Use a clean visualization: one small circular/radial summary or a short horizontal group for the strongest indicators, plus expandable metric details.
- Provide a simple plain-language interpretation such as “The character is currently more hopeful and determined than at the start of this reader's conversation.” The wording must be generated from the data using restrained rules and must not make clinical claims.
- Show a small “Updated after your last conversation” timestamp/state version.
- Provide a simple timeline/trend view only after state history is stored; do not invent historical data from the latest value.
- A tooltip/info icon explains that values are AI-generated simulation indicators, not validated measures of a real person's psychology.
- Animate state changes subtly (short fill/number transition) without flashing or distracting from chat.
- Use labels plus values; never rely only on colour.
- Keep these values specific to the selected character and current user's state. Changing character must change the displayed state immediately.

Suggested display model:

- Summary: “Hopeful”, “Tense”, “Guarded”, “Confident”, etc. Use a cautious deterministic mapping based on the relevant current indicators.
- Emotion details: anger, sadness, pride, joy, bliss (or rename bliss to a more understandable label only after a deliberate schema/product decision).
- PSI/simulation parameters: valence, arousal, selection threshold, resolution level, goal-directedness, securing rate. Explain them in plain language behind an info tooltip rather than showing raw technical names to every reader.

### 10.8 Settings — make it genuinely functional

Create `/settings` with user-facing settings, not fake platform controls.

Recommended sections:

**Profile**
- Display name.
- Email (read-only or changed through Supabase Auth's supported flow).
- Profile image/avatar.

**Reading & conversation**
- Default spoiler policy.
- Default conversation language when supported.
- Chat text-size preference if needed.
- Enter-to-send preference.

**Appearance**
- Light mode (launch default).
- Dark mode only after all pages support the full token system.
- Reduced motion (follow system setting by default).

**Voice preferences (prepare for later)**
- Default voice enabled/disabled.
- Auto-play character replies (default OFF until the user opts in).
- Voice speed.
- Preferred voice/language only where the user is allowed to choose from supported voices.

**Privacy & data**
- Export my data.
- Delete a book/source.
- Delete a conversation.
- Clear a character's reader-specific memory/state.
- Delete account (with confirmation and a clear explanation of what is removed).

**Security**
- Sign out.
- Session/device controls if supported.
- Password/auth provider management through Supabase Auth.

Every setting needs a real persistence endpoint or Supabase-supported mutation, validation, success/failure feedback, and tests. Do not display model API keys or provider secrets to ordinary users.

### 10.9 Separate admin application

Remove the Manager role completely for now. Do not leave Manager routes, fake dashboards, a role switcher, or a half-working Manager navigation state.

**Admin entry:**

- `/admin` is the independent admin entry point.
- If signed out, render the dedicated admin sign-in screen.
- Use Supabase Auth for identity, but require an authoritative admin role check after sign-in. “Separate login page” means a separate interface and guarded route, not a second home-built password system.
- If authenticated but not an admin, show a proper Access Denied page or redirect to the normal application. Do not reveal admin content.
- Every admin API route must independently verify admin permission on the server. Client-side route guards are only presentation, never security.
- Store the platform role in a protected `user_roles` table or trusted Supabase `app_metadata`/custom claims. Do not trust user-editable `user_metadata` for authorization. Supabase explicitly warns that user metadata can be edited by the user and is not a safe authorization source: <https://supabase.com/docs/guides/database/postgres/row-level-security>.

**Admin navigation:**

- Overview (real platform health/metrics only).
- Users.
- Featured Books / Catalogue.
- Characters (catalogue moderation/repair).
- Avatar Library.
- Processing Jobs.
- Usage & Cost.
- Integrations / Model configuration.
- System Settings.
- Audit Log.

Do not create billing pages until billing is real. Do not hardcode sample users or made-up metrics. Empty states should say there is no data yet.

### 10.10 User profile menu

- Profile.
- Settings.
- Help / Feedback.
- Sign out.

Remove “DEV: SWITCH ROLE”, Admin/Manager/User role switches, and inert Account Setting / Help buttons.

---

## 11. Voice-ready conversation architecture (do not implement voice before core persistence)

The user wants voice later. The present refactor must make voice a transport/mode added to the same conversation engine, not a separate chat implementation.

### 11.1 Provider-neutral conversation contract

Create a frontend conversation layer that separates UI from transport:

- `ConversationMessage`: stable ID, role, text, created timestamp, input modality (`text`/`voice`), optional audio metadata, delivery status, session ID.
- `ConversationTransport`: `sendText()`, `loadHistory()`, optional `startVoiceSession()`, `stopVoiceSession()`, `interruptResponse()`.
- `VoiceSessionState`: `idle`, `requesting_permission`, `connecting`, `listening`, `thinking`, `speaking`, `interrupted`, `error`, `ended`.
- `VoiceProviderAdapter`: provider-specific implementation hidden behind this interface.

Use one canonical session and message history. A voice transcript is persisted as a message in the same conversation. A text message and a voice message must update the same user-specific character state and memories.

### 11.2 Recommended staged voice roadmap

**Voice V1 — playback**

- User can play a character's text reply as audio.
- Assign a default licensed synthetic voice per character from a curated voice map.
- Show play/pause, progress, and loading state.
- Do not auto-play by default; user opts in through a clear action or preference.

**Voice V1.1 — push-to-talk**

- User presses/holds or taps the microphone to record a turn.
- Speech-to-text creates a transcript.
- Send the transcript to the same backend chat service.
- Generate spoken audio from the returned text.
- Store transcript in normal chat history; store audio file only when necessary and with consent/retention rules.

**Voice V2 — realtime conversation**

- Full duplex audio, natural turn-taking, interruption/barge-in.
- Browser connects directly to a realtime provider using a short-lived ephemeral credential minted by the backend.
- Backend owns the user authentication, character profile, retrieved passages, memory, tools, and state updates.
- Provider never receives a permanent server API key from the browser.
- A realtime voice model must not invent a separate character identity/memory separate from Lorely's authoritative state.

### 11.3 Provider research / implementation options

OpenAI's current voice-agent documentation distinguishes three approaches:

- **GPT-Live:** full-duplex conversations with a separate delegated backend; attractive if Lorely must keep its own ChatService/context as the authoritative character engine.
- **Realtime API sessions:** speech-to-speech with tools/function calling; good for low-latency natural voice, but the app must design the right server tool/delegation boundary.
- **Chained pipeline:** speech-to-text → Lorely ChatService → text-to-speech; easier to inspect, test, moderate, and reuse existing chat logic.

Official reference: <https://developers.openai.com/api/docs/guides/voice-agents>.

For browser real-time sessions, OpenAI recommends WebRTC and short-lived client secrets created server-side: <https://developers.openai.com/api/docs/guides/realtime> and <https://developers.openai.com/api/docs/guides/voice-webrtc>.

ElevenLabs is a second provider to evaluate for high-quality character voices and voice-agent features. Its documentation describes voice selection/customization, speed and pronunciation settings, and multi-voice support: <https://elevenlabs.io/docs/eleven-agents/customization/voice>. Its speech-to-text overview documents transcription and language capabilities: <https://elevenlabs.io/docs/overview/capabilities/speech-to-text>.

Do not select a provider based only on a demo. Build a small benchmark with the same 10–20 scripted character turns. Compare audio latency, transcription quality, interruption handling, pronunciation, language coverage, voice consistency, cost per minute, and licensing/terms.

### 11.4 Voice safety, user control, and cost

- Explicit microphone permission; clear active-mic indicator.
- Visible stop/end control at all times.
- No hidden recording.
- Prefer transcript persistence; do not retain raw audio unless necessary and disclosed.
- Tell users that voices and dialogue are AI-generated.
- Do not clone or imitate real actors/people without appropriate rights and consent.
- Add provider usage limits, per-account quotas, audio-minute accounting, abuse controls, and a kill switch.
- Provide text mode as a full alternative for accessibility, quiet environments, or provider failure.

---

## 12. Security, privacy, and production reliability

This is a multi-user product. Data isolation is a release blocker.

### 12.1 Authentication and authorization

- Require a valid Supabase access token for private user book/chat APIs.
- Reject missing/expired/invalid tokens with `401`.
- Check resource ownership for every book, character, conversation, file, memory, and state access.
- Never accept `owner_user_id` from the browser as the authority. Derive it from verified identity.
- Admin APIs must enforce server-side admin authorization.
- Remove the shared `local-demo@...` fallback from production paths. Keep any demo/test mode behind an explicit non-production setting and tests.
- Never ship Supabase service-role/secret keys or LLM API keys to Vite variables or browser code.
- The existing role provider is a local React state toggle and must not be used for authorization.

Supabase recommends enabling RLS for exposed tables, matching grants/policies, and writing tests for both allowed and denied access: <https://supabase.com/docs/guides/database/postgres/row-level-security>.

Choose one consistent access pattern:

1. User-scoped Supabase access with RLS for operations that can run under the user's JWT; or
2. Flask service-role access where the Flask backend verifies the user's token and enforces owner filters/authorization on every query.

If using service-role access in Flask, RLS is still valuable defence-in-depth, but do not assume RLS will protect a service-role request that bypasses it. The server must enforce identity and ownership correctly. Never expose service-role secrets in the client.

### 12.2 File security

- Private bucket for user documents.
- Generate opaque storage paths.
- Use signed upload/read URLs with short expiry where appropriate.
- Validate type using file signature and parser, not only filename/MIME.
- Set max file size/page count/word count and per-user storage quotas.
- Scan or sandbox parsers where practical; isolate worker processing from web requests.
- Prevent path traversal, decompression bombs, extremely large PDFs, malformed EPUB archives, and prompt injection in source text.
- Deleting a book should delete or schedule deletion of its source file, chunks, character profiles, sessions, and memories according to the user's confirmation and retention policy.

### 12.3 Operational reliability

- Structured logs with request ID, user ID (internal opaque ID), book/job/session IDs, provider, elapsed time, status, and error category. Never log raw book contents or full private conversations by default.
- Central error monitoring and alerting.
- Retries with backoff for transient provider/storage/database errors.
- Idempotent upload/job creation and chat-send handling.
- Database transactions around message/state persistence.
- Prevent duplicate messages when the browser retries a failed request; use an idempotency key per send.
- Handle two simultaneous messages to the same session safely; use transaction locking/version checks and unique sequence constraints.
- Rate limits for uploads, extraction, chat turns, and voice minutes.
- AI spend tracking by user, model, and feature.
- Queue backlog/failed-job visibility for admins.

---

## 13. Deployment architecture — Vercel and Supabase

### 13.1 Recommended deployment split

Use two Vercel projects connected to the same GitHub repository:

| Vercel project | Root directory | Job |
|---|---|---|
| `lorely-web` | `frontend/` | React/Vite signed-in product UI and, later, public landing page |
| `lorely-api` | `backend/` | Flask HTTP API if functions fit within Vercel's limits |

External managed services:

- Supabase Auth + Postgres + Storage + pgvector.
- A background worker/queue for book processing and memory jobs. This may be a separate Python worker host or a suitable managed worker product; it should not require a user's browser to remain open.
- OpenAI/ElevenLabs secrets stored only in server-side environment variables.

### 13.2 Vercel feasibility and constraints

Vercel announced Python as generally available on 15 October 2026 and lists automatic framework support for Flask, FastAPI, and Django: <https://vercel.com/changelog/python-on-vercel-is-now-generally-available>.

The repository already exports a Flask application instance from `backend/app.py`, which is compatible with Vercel's documented Flask entrypoint pattern when `backend/` is the project root: <https://vercel.com/docs/frameworks/backend/flask>.

However, keep these constraints in mind:

- Vercel Functions have a 4.5 MB request/response body limit. Do not proxy full book uploads through a function. Browser uploads should go directly to Supabase Storage with a signed upload flow.
- Function execution duration and memory are plan/configuration dependent. Long-running extraction and embedding jobs should be moved to a worker rather than relying on a request staying alive.
- Function filesystem storage is not the persistent application database. Never write ChromaDB, user uploads, vector indexes, or chat state to local function disk and expect it to survive another invocation.
- Python dependency bundle size and memory need to be measured. Remove ChromaDB/Qdrant remnants from the Vercel API dependency path once PostgreSQL/pgvector is authoritative.
- Place the API region close to the Supabase database region to reduce latency.
- Use Supabase's transaction pooler for serverless database connections where appropriate and configure SQLAlchemy pooling for the deployed runtime.

Vercel limits reference: <https://vercel.com/docs/functions/limitations>. The documented request payload limit is 4.5 MB. Vercel duration configuration: <https://vercel.com/docs/functions/configuring-functions/duration>.

### 13.3 Direct-to-Storage upload

- API creates a pending book/source record and an authorised signed upload destination.
- Browser uploads directly to Supabase Storage.
- For small files, standard Storage upload is suitable; Supabase recommends resumable TUS uploads for files larger than 6 MB or unreliable networks.
- Browser tells the API that upload has completed; backend verifies object existence, size, owner/path, and metadata.
- Backend enqueues processing job.

Supabase upload docs: <https://supabase.com/docs/guides/storage/uploads/standard-uploads> and <https://supabase.com/docs/guides/storage/uploads/resumable-uploads>.

### 13.4 Deployment environment and migrations

Maintain separate local, preview/staging, and production environment variables and Supabase projects where feasible.

Required environment configuration should be documented and validated at startup:

- Supabase URL and public/publishable key for frontend.
- API URL for frontend.
- Supabase service/secret key for backend-only privileged operations if required.
- Database URL / pooler connection settings.
- OpenAI/Gemini API keys and enabled provider configuration.
- Embedding provider/model.
- Storage bucket names and limits.
- Queue/worker connection settings.
- CORS allowed origins.
- App environment and logging level.

Use Alembic/Supabase migrations in CI/staging before production. Do not use `AUTO_CREATE_RELATIONAL_SCHEMA` as the production migration strategy. Run a health check that reports database, storage, and provider readiness without exposing secrets.

---

## 14. Admin operations and content management

Admin should be a real control panel, not a visual-only role.

### 14.1 MVP admin features

1. **Overview:** API/database/storage/worker health; current queue status; useful daily/monthly usage metrics only when backed by telemetry.
2. **Users:** search users, view account status and usage, suspend/reactivate if implemented, inspect user-owned resource counts (not private content by default).
3. **Featured books:** add/remove title, metadata, cover, source/rights info, visibility, processing status, collection placement.
4. **Characters:** review failed/low-confidence extraction, edit public character metadata, repair avatar assignment.
5. **Avatar Library:** upload asset, add tags, record license/source, preview, disable asset.
6. **Jobs:** view processing stages, retries, error categories, retry/cancel.
7. **Usage & Cost:** model requests, token/audio estimates, cost breakdown and limits.
8. **Integrations:** select server-side default providers/models, test provider configuration, enable/disable providers. Do not show secret values after save.
9. **Audit Log:** record admin actions such as changing visibility, deleting public content, changing roles, and editing system settings.

### 14.2 Remove Manager role for this release

- Delete the Manager role switching UI.
- Remove Manager route registration.
- Remove Manager-only pages and any unused components after confirming there are no remaining imports.
- Remove fake approval and analytics content.
- Simplify all role checks to `user` and `admin` for now.
- Do not leave a hidden/disabled manager mode that can accidentally be reached through frontend state.

---

## 15. API surface target

Use a versioned API prefix such as `/api/v1`. Exact response schemas can be finalised during implementation, but maintain predictable resource boundaries.

### Authentication/profile

- `GET /api/v1/me`
- `PATCH /api/v1/me`
- `GET /api/v1/me/settings`
- `PATCH /api/v1/me/settings`
- `POST /api/v1/me/export` (or an async export job)
- `DELETE /api/v1/me` (account deletion workflow)

### Books

- `POST /api/v1/books/upload-intent`
- `POST /api/v1/books/{book_id}/complete-upload`
- `POST /api/v1/books` (pasted text or metadata-only supported flow)
- `GET /api/v1/books`
- `GET /api/v1/books/{book_id}`
- `PATCH /api/v1/books/{book_id}`
- `DELETE /api/v1/books/{book_id}`
- `GET /api/v1/books/{book_id}/processing-status`
- `GET /api/v1/books/{book_id}/chapters`

### Characters

- `GET /api/v1/books/{book_id}/characters`
- `GET /api/v1/characters/{character_id}`
- `PATCH /api/v1/characters/{character_id}/avatar`
- `GET /api/v1/characters/{character_id}/state`
- `GET /api/v1/characters/{character_id}/memories`
- `DELETE /api/v1/characters/{character_id}/memories` (clear only current reader's state)

### Conversations

- `POST /api/v1/characters/{character_id}/conversations`
- `GET /api/v1/conversations`
- `GET /api/v1/conversations/{session_id}`
- `GET /api/v1/conversations/{session_id}/messages`
- `POST /api/v1/conversations/{session_id}/messages`
- `PATCH /api/v1/conversations/{session_id}`
- `DELETE /api/v1/conversations/{session_id}`

### Discover / public catalog

- `GET /api/v1/discover/books`
- `GET /api/v1/discover/books/{slug}`
- `GET /api/v1/discover/collections`
- `GET /api/v1/discover/characters`

### Jobs / voice / admin

- `GET /api/v1/jobs/{job_id}`
- `POST /api/v1/voice/sessions` (server-minted short-lived provider credential; future phase)
- `POST /api/v1/voice/usage` or provider-session completion callback (future phase)
- Admin routes under `/api/v1/admin/...` with server-side admin checks.

Use stable IDs, cursor pagination, consistent error envelopes, schema validation, request IDs, and explicit HTTP status codes. Do not leak internal stack traces or provider secrets.

---

## 16. Testing and quality gates

Build a test suite before public launch. Suggested stack: pytest for backend, Vitest + React Testing Library for frontend units/components, and Playwright for end-to-end browser flows. Use Supabase local development/pgTAP or equivalent integration checks for RLS policies.

### 16.1 Backend tests

- Missing/invalid/expired access token is rejected for private APIs.
- A user cannot read, update, delete, or chat against another user's book/character/session.
- Admin-only routes reject ordinary users.
- File signature/type validation rejects disguised/malformed formats.
- PDF/EPUB/TXT extraction tests preserve metadata and chapter boundaries.
- `cover_letter.pdf`/CV/report fixtures classify as `document`, do not silently create fictional characters, and show a user override path.
- Book/story fixture classifies correctly and yields expected characters.
- Character extraction handles no characters, duplicates, aliases, and uncertainty.
- Retrieval returns the correct source passages and respects spoiler limits.
- Character state persists per user/character across separate sessions.
- Two different users interacting with the same featured character have separate memories/state.
- Concurrent message sends do not duplicate or reorder messages.
- Idempotent retry does not append the same user message twice.
- Memory extraction failure does not lose a successfully generated reply.
- Worker retries failed jobs and records useful error states.

### 16.2 Frontend tests

- Sidebar navigation and responsive mobile drawer work.
- Add a book opens the import flow; no “Project” terminology remains in user UI.
- Library renders real API data, loading, empty, failed, and processing states.
- Book metadata confirmation can be edited before processing.
- Character cards and dossier show the correct book and character.
- Switching characters changes the state panel to the correct character.
- State popover/drawer opens via click, keyboard, and touch.
- The chat details panel is closed by default and does not steal space.
- Chat messages restore from the server after sign-out/sign-in or a second browser session.
- Settings save to backend and show success/failure feedback.
- Admin login cannot be bypassed by changing frontend state.
- Manager navigation and routes do not exist.

### 16.3 End-to-end acceptance scenarios

1. New user signs up, imports a book, closes the browser, signs in on another browser/device, and sees the same library.
2. User uploads `cover_letter.pdf`; Lorely identifies it as a non-narrative document and does not produce a fictional character from the applicant's name without explicit opt-in.
3. User imports a novel PDF/EPUB, confirms title and author, watches processing, opens the generated character gallery, and starts a chat.
4. User chats with a character, leaves, returns later, and the transcript, memory, and per-reader state continue correctly.
5. Two users talk with the same featured character; their messages/memories/state remain completely isolated.
6. A non-admin visits `/admin` and cannot see the admin dashboard or call admin APIs.
7. An admin can log in separately and manage a featured book/avatar asset.
8. User's file upload succeeds for a large supported file through direct Storage/TUS upload and does not hit the Vercel 4.5 MB function request limit.

### 16.4 Release gates

Do not call the project production-ready until:

- migrations work on a clean database and on a staging copy;
- ownership/RLS/security tests pass;
- there are no local-disk persistence dependencies in production execution;
- book upload is asynchronous/retryable;
- book metadata/classification works;
- character/chat persistence works across devices;
- admin routes are server-protected;
- settings are functional;
- no visible buttons are inert;
- mobile/desktop layouts are usable;
- CI runs lint, tests, build, and migration checks;
- backup/restore and data deletion flows are documented;
- observability, rate limits, usage budgets, and failure handling exist.

---

## 17. Phased implementation backlog

Agents should produce their own task breakdown, but keep this order unless a concrete dependency requires adjustment.

### Phase 0 — Repository safety and baseline

- Add a proper root README with architecture, local setup, environment variables, and development commands.
- Add `.gitignore` rules for all `.env` files, DB folders, local uploads, cache, `dist`, coverage, and test artefacts.
- Remove committed ChromaDB/Qdrant runtime data after confirming it is not user data that needs backup.
- Scan repository and commit history for accidental secrets; rotate any secret that was actually exposed.
- Add CI for frontend lint/build and backend lint/tests.
- Remove unused/experimental dependencies and dead modules only after mapping references.

**Acceptance:** clean clone can be set up; no database/runtime data is committed; CI runs on pull request.

### Phase 1 — Database becomes the source of truth

- Finalise schema and migrations.
- Make PostgreSQL mandatory in deployed environments.
- Implement user/book/character/session/message/memory/settings CRUD APIs.
- Replace `workspaceStore.js` as source of truth with API-backed React data hooks/query cache. Keep optimistic UI/cache only as a cache.
- Add secure owner checks and RLS/authorization tests.
- Add multiple conversations per character.
- Persist current user-character state independently of session transcript.
- Implement delete/export lifecycle.

**Acceptance:** same user library and conversations work across devices; cross-user isolation tests pass.

### Phase 2 — Import and book recognition

- Support PDF, EPUB, TXT, pasted text.
- Direct upload to Supabase Storage.
- Add content classification/metadata confirmation.
- Fix title/author/cover extraction and prevent cover-letter/CV false characters.
- Add jobs/processing states and background worker.
- Add retry, cancel, failed, and completed states.

**Acceptance:** importing a supported book works without a long blocking web request; non-book documents are not silently treated as books.

### Phase 3 — Source-grounded character intelligence

- Chunk by chapter/paragraph.
- Generate real embeddings and store in pgvector.
- Add retrieval and evidence references.
- Add spoiler-aware filtering.
- Improve character schemas and extraction validation.
- Improve memory strategy and persistence.
- Add semantic retrieval and character-response evaluation tests.

**Acceptance:** chat can cite relevant source context and respects spoiler settings; no placeholder embeddings remain.

### Phase 4 — UI redesign and product navigation

- Replace generic project/team shell with Lorely navigation.
- Add Discover, My Library, Conversations, and Settings.
- Redesign book detail and character gallery.
- Redesign chat and contextual Character/State drawers.
- Add reusable avatar catalogue and assignment.
- Remove Manager role and fake role switcher.
- Add separate `/admin` interface with real role authorization.
- Remove fake banner/notification/pricing UI until those features exist.

**Acceptance:** all primary journeys work using real data at desktop and mobile sizes; no fake controls/data.

### Phase 5 — Admin tools and production operations

- Featured-book management and rights metadata.
- Avatar asset management and licensing metadata.
- Processing queue admin view.
- Usage, cost, rate-limit, and provider configuration views.
- Audit log.
- Observability and backups/restore.

**Acceptance:** admin can operate the catalogue and troubleshoot processing without database editing by hand.

### Phase 6 — Vercel/Supabase deployment

- Deploy `frontend/` and `backend/` as separate Vercel projects if backend function constraints pass.
- Move background worker to a suitable persistent worker service.
- Configure Supabase pooler and secrets.
- Configure private storage, signed upload, TUS where appropriate.
- Configure staging and production environments, CORS, API domains, health checks, and migrations.
- Run full acceptance suite against staging.

**Acceptance:** production has no local-disk dependencies and large imports work through direct object storage uploads.

### Phase 7 — Voice

- Start with text-to-speech playback for replies.
- Add push-to-talk transcription and transcript persistence.
- Add realtime WebRTC voice after provider benchmark.
- Add voice state UI and quotas/cost reporting.
- Reuse the same ChatService, retrieval, memory, and user-character state.

**Acceptance:** text and voice sessions are coherent; permission, interruption, timeout, and cost controls are tested.

### Phase 8 — Marketing landing page

Only after the product is usable and stable:

- Create the public marketing site separate from the signed-in application shell.
- Show a real product walkthrough (book → character gallery → conversation → state/memory).
- Include feature claims only when the feature is shipped.
- Feature public-domain/licensed books, not private user uploads.

---

## 18. Visual and product references for agents

Use references to understand interaction patterns and product expectations. Do not copy another company's visual design or assets directly.

### Direct product/category references

1. **PageSpeak** — close direct comparator: featured classic books, upload own books (TXT/EPUB), text and voice interaction, character memory, story-event context. <https://www.pagespeak.ai/> and <https://www.pagespeak.ai/how-it-works>.
2. **Narra** — book-first experience combining character portraits, character conversations, illustrated scenes, and book audio; note its own disclosure that generated images/voices/replies may be inaccurate. <https://get-narra.app/en> and <https://get-narra.app/en/about>.
3. **Novelium** — voice-first conversations with literary characters and a browseable catalogue. <https://www.novelium.app/>.
4. **Bookatomy** — useful reference for book context navigation and character/location/event galleries. <https://bookatomy.com/decouverte.html>.
5. **Character.AI** — useful voice-call benchmark for familiar character conversation interaction; do not copy its visual identity. <https://character.ai/>.

### Interface and visual inspiration

- E-book dashboard and book-led visual shelves: <https://dribbble.com/shots/20454786-E-Book-Dashboard>.
- AI character chat dashboard: <https://dribbble.com/shots/25034416-AI-Chat-with-Character-Dashboard-Design>.
- Character discovery/profile page: <https://dribbble.com/shots/25597022-DreamPress-AI-Web-Design-Animation-Characters-Page>.
- Character conversation mobile UI: <https://dribbble.com/shots/25419988-Interactive-Chat-App-Inspired-by-The-Vampire-Diaries>.
- Awwwards for broader visual and interaction inspiration: <https://www.awwwards.com/>.
- Spline for a future single focused 3D hero on the marketing site: <https://spline.design/>.

### Technical references

- Supabase pgvector: <https://supabase.com/docs/guides/database/extensions/pgvector>.
- Supabase RLS: <https://supabase.com/docs/guides/database/postgres/row-level-security>.
- Supabase standard uploads: <https://supabase.com/docs/guides/storage/uploads/standard-uploads>.
- Supabase resumable uploads: <https://supabase.com/docs/guides/storage/uploads/resumable-uploads>.
- Open Library Search API: <https://openlibrary.org/dev/docs/api/search>.
- Open Library Covers API: <https://openlibrary.org/dev/docs/api/covers>.
- Open Library API usage guidelines: <https://openlibrary.org/developers/api>.
- Project Gutenberg licensing: <https://www.gutenberg.org/policy/license>.
- Project Gutenberg non-US terms: <https://www.gutenberg.org/policy/terms_of_use>.
- Creative Commons public domain / CC0: <https://creativecommons.org/public-domain/>.
- Wikimedia Commons reuse rules: <https://commons.wikimedia.org/wiki/Commons:REUSE>.
- Vercel Python general availability announcement: <https://vercel.com/changelog/python-on-vercel-is-now-generally-available>.
- Vercel Flask: <https://vercel.com/docs/frameworks/backend/flask>.
- Vercel function limits: <https://vercel.com/docs/functions/limitations>.
- OpenAI voice agent architecture: <https://developers.openai.com/api/docs/guides/voice-agents>.
- OpenAI Realtime API: <https://developers.openai.com/api/docs/guides/realtime>.
- OpenAI Realtime WebRTC: <https://developers.openai.com/api/docs/guides/voice-webrtc>.
- ElevenLabs voice customization: <https://elevenlabs.io/docs/eleven-agents/customization/voice>.
- ElevenLabs speech-to-text: <https://elevenlabs.io/docs/overview/capabilities/speech-to-text>.
- WAI-ARIA disclosure pattern: <https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/>.
- WAI-ARIA disclosure navigation: <https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/>.
- WCAG 2.2 focus visible: <https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html>.
- WCAG 2.2 target size: <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum>.

---

## 19. Final definition of a successful Lorely release

A successful release is not defined by the number of animations, AI models, or landing-page sections. It is defined by the reader's experience and the reliability of the underlying data.

A reader can:

- Discover a featured book or import their own supported source.
- See an accurate title/author/source classification before processing.
- Avoid having a cover letter, résumé, or generic PDF silently treated as a fictional book.
- See a useful character gallery with consistent reusable portraits.
- Open a character dossier with information grounded in the source.
- Start, close, and later resume multiple conversations with that character.
- See relevant book context and spoiler-safe answers.
- Inspect character state only when they choose, without losing space in the chat UI.
- Change real settings and manage their own data.
- Use the product on another device without losing books or chats.
- Trust that their source files and conversations are private to their account.

An admin can:

- Sign in at `/admin` through a distinct, role-protected interface.
- Manage a curated public book catalogue and avatar library.
- Inspect processing jobs, provider health, and usage.
- Perform platform operations without pretending that placeholder data is real.

An engineer can:

- Deploy the app without local ChromaDB or Qdrant directories.
- Run migrations and tests from a clean checkout.
- Recover from failed jobs without user re-upload where possible.
- Trace errors and costs without logging private book text by default.
- Add a new voice transport without rewriting the character engine or duplicating conversation memory.

**Priority order:** cloud persistence and security → book recognition and background processing → source-grounded character intelligence → core UI/navigation/admin/settings → deployment hardening → voice → marketing landing page.

That order protects the product's core promise: Lorely should remember the books and characters that belong to each reader, not depend on a particular browser or pretend that unfinished features are already working.
