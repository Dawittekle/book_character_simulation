# Lorely: System Architecture, Data Flow, & Technology Guide

> **Document Location:** `docs/test/system_architecture_and_guide.md`  
> **Last Updated:** November 2026  
> **Status:** Production-Ready (Branch: `redesign`)

---

## 1. Executive Summary

**Lorely** is an AI-powered interactive literary character simulation and reading companion platform. It transforms classical literature into psychological AI personas using:
1. **Dörner’s Psi Theory of Human Action**: Characters have dynamic psychological needs, competence, certainty, and emotional drifts that update after every conversational turn.
2. **Spoiler-Gate Protocol**: RAG retrieval respects the reader's current reading chapter, preventing spoilers from future chapters.
3. **Hybrid Architecture**:
   - **Relational Data**: PostgreSQL (hosted on Supabase) via SQLAlchemy 2.0.
   - **Object Storage**: Cloudflare R2 (S3-compatible via `boto3`) with resilient local fallback for heavy files (PDFs, EPUBs, long texts, voice audio).
   - **Semantic Embeddings & Vectors**: Stored in PostgreSQL with cosine similarity ranking and chapter-boundary SQL filtering (with ChromaDB available for local prototype testing).
   - **LLM Engine**: Native Google Gemini (`gemini-3.5-flash`) and OpenAI (`gpt-4.1-mini`), without third-party LangChain bloat.
   - **Frontend**: Modern React 19 SPA with Vite, tailored literary typography, and responsive mobile-first UI.

---

## 2. End-to-End System Architecture Diagram

```mermaid
flowchart TD
    subgraph Frontend ["Frontend (React 19 + Vite)"]
        UI["Reader Web App (Port 5173)"]
        Landing["Landing Page / Showcase"]
        Reader["Reading Salon / Chat"]
        Upload["Book Ingestion UI"]
    end

    subgraph Backend ["Backend API (Flask + Python 3.13)"]
        API["Flask REST API (Port 5000)"]
        Auth["SupabaseAuthService (JWT / Bearer)"]
        Classifier["ClassificationService (Narrative Gate)"]
        Lorely["LorelyService (Core Orchestration)"]
        Voice["VoiceService (TTS / Speech)"]
        Storage["StorageService (Cloudflare R2 / Fallback)"]
        Retriever["SpoilerAwareRetriever"]
        LLMFactory["LLM Factory (Gemini / OpenAI)"]
    end

    subgraph StorageLayer ["Storage & Databases"]
        PG[("PostgreSQL (Supabase)
        Users, Books, Characters,
        Chat Sessions, Chunks,
        Embeddings, Memories")]
        R2[("Cloudflare R2 Object Storage
        Original Books (.pdf/.epub),
        Full Extracted Texts,
        Synthesized Audio (.wav)")]
        LocalDisk[("Local Storage Fallback
        backend/storage/")]
    end

    subgraph AIProviders ["External AI Services"]
        Gemini["Google Gemini API
        (gemini-3.5-flash / text-embedding-004)"]
        OpenAI["OpenAI API
        (gpt-4.1-mini / text-embedding-3-small)"]
    end

    UI -->|HTTP / JSON| API
    API --> Auth
    API --> Lorely
    Lorely --> Classifier
    Lorely --> Retriever
    Lorely --> Voice
    Lorely --> Storage
    Lorely --> LLMFactory

    Retriever -->|Vector SQL + Cosine Sim| PG
    Lorely -->|Relational Queries| PG
    Storage -->|S3 API (Zero Egress)| R2
    Storage -.->|Fallback if Offline| LocalDisk

    LLMFactory --> Gemini
    LLMFactory --> OpenAI
    Voice --> OpenAI
```

---

## 3. How the Process Works: Core User Flows

### Flow A: Book Upload & Ingestion
When a user uploads a new book (e.g., `Crime_and_Punishment.epub` or a PDF):
```
1. [User uploads file] ──> Frontend sends multipart/form-data to POST /api/v1/books/inspect
2. [PyMuPDF / Extractor] ──> Extracts raw text, detects format, word count, embedded metadata
3. [Object Storage Upload] ──> Raw file is saved to R2 at temp_uploads/{job_id}/original.epub
                               Extracted text is saved to R2 at temp_uploads/{job_id}/extracted.txt
4. [Document Classifier] ──> LLM evaluates if the text is literary fiction vs. non-narrative document
5. [ProcessingJob Created] ──> PostgreSQL saves job record with metadata (title, author, confidence)
6. [User confirms Ingestion] ──> POST /api/v1/books/ingest
7. [Character Extraction] ──> LLM analyzes first 50k characters and extracts structured character dossiers
8. [Semantic Chunking] ──> Chunker splits text into chapters and paragraphs (max 1000 chars per chunk)
9. [Embedding Generation] ──> Gemini text-embedding-004 generates vectors for each chunk
10. [Database Commit] ──> Permanent Book, BookSource, CharacterProfileRecord, and BookChunk records saved
11. [R2 Permanent Storage] ──> Files moved from temp_uploads/ to books/{book_id}/original/ and books/{book_id}/text/
```

### Flow B: Interactive Dialogue & Reading Salon
When a reader chats with a character (e.g., *Rodion Raskolnikov*):
```
1. [Reader sends message] ──> POST /api/v1/chat/sessions/{id}/turns
2. [Identity Resolution] ──> Auth token resolves user account and verifies access
3. [Spoiler-Gate Retrieval] ──> SpoilerAwareRetriever queries BookChunk WHERE book_id = :id 
                               AND chapter_order <= :user_progress_chapter.
                               Calculates cosine similarity to find top 3 relevant book passages.
4. [Emotional State Fetch] ──> Loads character's current Dörner Psi parameters (Valence, Arousal,
                               Competence, Certainty) and persistent emotional state (Pride, Guilt, etc.).
5. [Cross-Session Memories] ──> Retrieves past factual memories about the user (e.g. "User loves chess").
6. [LLM Prompt Construction] ──> Combines character persona, emotional state, citations, memories,
                                 and conversation history into system and user prompts.
7. [LLM Turn Generation] ──> Gemini / OpenAI streams the in-character response + new emotional delta.
8. [Emotion & State Update] ──> Updates character's emotional trajectory in UserCharacterState table.
9. [Fact Extraction Task] ──> Background extraction captures any new objective facts about the user.
10. [Voice Audio Synthesis] ──> VoiceService synthesizes speech audio; caches .wav in Cloudflare R2
                                (audio/{session_id}/{message_id}.wav) for instant future replay.
11. [Response to Reader] ──> JSON response returns message text, citations, updated emotion radar, 
                             and audio stream link.
```

---

## 4. Database Architecture & Connectivity

### Which Database Systems Are Used?

Lorely uses a **multi-tiered storage architecture** where each database handles the task it is best suited for:

| Storage System | Provider / Technology | Primary Purpose |
| :--- | :--- | :--- |
| **Relational Database** | **PostgreSQL (Supabase)** | Single source of truth for users, books, characters, messages, permissions, payments, and billing tiers. |
| **Object Storage** | **Cloudflare R2** | Bulk file storage for large original book files (`.pdf`, `.epub`, `.txt`), extracted book text files, and voice audio clips (`.wav`). |
| **Local Storage Fallback** | **Local Filesystem (`backend/storage/`)** | Zero-downtime safety net when Cloudflare R2 is offline or running in local dev/testing. |
| **Vector Store** | **PostgreSQL (`book_chunks`)** | Semantic vectors (`list[float]` JSON columns) with strict relational filtering (`chapter_order <= N`) and cosine similarity. |
| **Prototype Vector Cache** | **ChromaDB (`chroma_db/`)** | Local embedding prototype cache maintained for backwards compatibility. |
| **Authentication Service** | **Supabase Auth (GoTrue)** | User authentication, password management, OAuth, and signed JWT issuance. |

---

### How PostgreSQL is Connected

1. **Connection String**: Loaded from `.env` via `DATABASE_URL`:
   ```
   postgresql://postgres.<project_ref>:<password>@<host>:5432/postgres
   ```
   Automatically normalized by `config.py` to use Python's modern **Psycopg 3** driver:
   ```
   postgresql+psycopg://postgres.<project_ref>:<password>@<host>:5432/postgres
   ```
2. **SQLAlchemy 2.0 Engine**:
   - Connection pooling enabled with `pool_pre_ping=True` to immediately detect and recover from stale connections.
   - `pool_size=5`, `max_overflow=10`, `pool_recycle=1800` (recycles connections every 30 minutes to prevent idle disconnects on Supabase transaction poolers).
3. **Session Management (`session_scope`)**:
   - Handled via `DatabaseManager.session_scope()` context manager.
   - Automatically commits successful transactions and issues a `rollback()` on exceptions.
4. **Relational Schema**:
   Managed via declarative SQLAlchemy models in [`backend/src/book_character_simulation_backend/db/models.py`](file:///home/dawit/Documents/Projects/AI%20Projects/book_character_simulation/backend/src/book_character_simulation_backend/db/models.py):

```mermaid
erDiagram
    UserAccount ||--o{ Book : owns
    UserAccount ||--o{ ChatSession : initiates
    UserAccount ||--o{ UserCharacterState : maintains
    UserAccount ||--o{ ProcessingJob : submits
    UserAccount ||--o| UserRole : has
    UserAccount ||--o| UserSettings : configures

    Book ||--o{ BookSource : contains
    Book ||--o{ BookChunk : split_into
    Book ||--o{ CharacterProfileRecord : features
    Book ||--o{ ChatSession : referenced_by

    CharacterProfileRecord ||--o{ ChatSession : converses_with
    CharacterProfileRecord ||--o{ CharacterMemory : remembers
    CharacterProfileRecord ||--o{ UserCharacterState : tracked_in

    ChatSession ||--o{ ChatMessage : logs
```

---

## 5. Cloudflare R2 Object Storage Architecture

### Why Cloudflare R2?
Before object storage was integrated, large book files, entire 500-page book texts, and synthesized voice audio were stored directly inside PostgreSQL table rows. For 100 books, this causes hundreds of megabytes of database table bloat, slow VACUUM operations, and high Supabase storage costs.

**Cloudflare R2 provides:**
1. **Zero Egress Fees**: Unlike AWS S3 (which charges \$0.09 per GB downloaded), Cloudflare R2 charges **\$0.00** for downloads.
2. **Generous Free Tier**: 10 GB of storage, 1,000,000 Class A write operations, and 10,000,000 Class B read operations every month for free.
3. **Global CDN**: Public bucket domain (`https://pub-8cc6d8415c22493487979ef72ed2316a.r2.dev`) serves book downloads directly from Cloudflare's edge in milliseconds.

### How Cloudflare R2 is Connected
- Connected via `boto3` (AWS S3-compatible client).
- Account Endpoint: `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`.
- Signed via AWS-v4 HMAC signature (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`).
- Configured in [`backend/src/book_character_simulation_backend/services/storage_service.py`](file:///home/dawit/Documents/Projects/AI%20Projects/book_character_simulation/backend/src/book_character_simulation_backend/services/storage_service.py).

### Object Hierarchy in Cloudflare R2:
```
lorly (Bucket)
  ├── books/
  │    └── {book_id}/
  │         ├── original/{filename.epub}   <-- Original binary uploaded by reader
  │         └── text/extracted.txt          <-- Clean extracted plain text
  ├── temp_uploads/
  │    └── {job_id}/
  │         ├── {filename}                 <-- Staged raw file during inspection
  │         └── extracted.txt              <-- Staged extracted text
  └── audio/
       └── {session_id}/
            └── {message_id}.wav           <-- Synthesized TTS voice cache
```

---

## 6. The "LangChain" Question: What We Actually Use

### Did this project use LangChain?
The project specification was originally named **`Copy of Langchain Training Task.pdf`** (*"AI Character Simulation with Emotional Adaptation"*).

However, **we do NOT use the third-party `langchain` Python package.**

### Why was LangChain omitted?
1. **Bloat and Instability**: `langchain` frequently introduces breaking changes across minor versions and adds dozens of heavy sub-dependencies.
2. **Loss of Control**: LangChain hides system prompts and memory mechanics behind opaque abstractions (e.g. `ConversationBufferMemory`, `LLMChain`), making precise psychological tuning (Dörner's Psi theory) difficult.
3. **Performance**: Native SDK calls (`google-genai` and `openai`) execute with minimal overhead, start up instantly, and support structured Pydantic JSON validation directly.

### What We Use Instead (Native LLM & RAG Pipeline):
Instead of LangChain, Lorely implements an **industrial-grade Native LLM Orchestration** engine:

```
┌────────────────────────────────────────────────────────┐
│                   Lorely LLM Engine                    │
├──────────────────────────┬─────────────────────────────┤
│ Component                │ Implementation              │
├──────────────────────────┼─────────────────────────────┤
│ LLM Provider Factory     │ backend/src/.../llm/factory │
│ Google Gemini SDK        │ google-genai (v0.5+)        │
│ OpenAI SDK               │ openai (v1.35+)             │
│ Structured Outputs       │ Pydantic v2 BaseModels      │
│ Vector Embeddings        │ text-embedding-004          │
│ Chunker & Chapter Parser │ rag/chunker.py              │
│ Spoiler-Gate Retrieval   │ rag/retriever.py            │
│ Emotional Engine         │ Dörner Psi Matrix in Python │
│ Memory Extraction        │ fact_extraction_prompt      │
└──────────────────────────┴─────────────────────────────┘
```

---

## 7. Technology Matrix: What Is Used vs. What Is NOT Used

| Capability | In Use | Replaced / NOT In Use | Reason |
| :--- | :--- | :--- | :--- |
| **Relational Database** | PostgreSQL via Supabase + SQLAlchemy 2.0 | SQLite / MySQL | Scalable multi-tenant cloud PostgreSQL with connection pooling. |
| **Object Storage** | Cloudflare R2 (S3-compatible) | PostgreSQL bytea / AWS S3 | Cloudflare R2 has zero egress download costs and huge free tier. |
| **Local Storage Fallback** | `backend/storage/` directory | Crashing on S3 error | Guarantees zero downtime if cloud network has a glitch. |
| **Vector Search** | PostgreSQL `BookChunk` + Cosine Similarity | Pinecone / Weaviate / pgvector | Allows strict SQL spoiler filtering (`chapter <= N`) in the same query. |
| **Legacy Vector Store** | ChromaDB (`chroma_db/`) | - | Retained for prototype backwards compatibility. |
| **LLM Orchestration** | Native SDKs (`google-genai`, `openai`) | LangChain / LlamaIndex | Cleaner code, faster cold starts, and full prompt control. |
| **User Authentication** | Supabase Auth (JWT) | Flask-Login / Sessions | Stateless JWT authentication shared between React and Flask. |
| **Document Parsing** | PyMuPDF (`fitz`) | Textract / Unstructured | Fast, local, high-fidelity PDF and EPUB text extraction. |
| **Voice Synthesis (TTS)** | OpenAI Audio API + R2 Audio Cache | ElevenLabs | Low-latency speech with permanent Cloudflare R2 audio caching. |
| **Frontend Framework** | React 19 + Vite 6 + React Router 7 | Next.js / SSR | High-performance client-side SPA with zero server compute costs. |

---

## 8. Environment Variables Reference (`.env`)

```ini
# Application Configuration
APP_ENV=development
DEBUG=true
PORT=5000
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# LLM Providers
LLM_PROVIDER=gemini
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-3.5-flash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini

# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://postgres.ffhnldtsxylwkgenemgs:...@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
DATABASE_CONNECT_TIMEOUT=10
AUTO_CREATE_RELATIONAL_SCHEMA=false

# Supabase Auth
SUPABASE_URL=https://ffhnldtsxylwkgenemgs.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...

# Cloudflare R2 Object Storage (Live & Verified)
R2_ACCOUNT_ID=a7157189109e85abcfe2e5626aa99086
R2_ACCESS_KEY_ID=c1a2910ba980ee8a31b07cffbc052517
R2_SECRET_ACCESS_KEY=ad618370b1ced225c55b58ee97ac1f4ed31adc187fc0798946a4cbe820de12f1
R2_BUCKET_NAME=lorly
R2_PUBLIC_URL=https://pub-8cc6d8415c22493487979ef72ed2316a.r2.dev
STORAGE_LOCAL_DIR=storage
```

---

## 9. Verification & Maintenance Commands

### Run Full Backend Test Suite
```bash
backend/.venv/bin/pytest backend/tests
```
*(Result: 63 passed, 0 failed in 6.10s)*

### Run Full Frontend Test Suite
```bash
npm --prefix frontend test -- --run
```
*(Result: 19 test files passed, 131 tests passed in 8.50s)*

### Sync Database Objects to Cloudflare R2
```bash
backend/.venv/bin/python backend/scripts/migrate_to_storage.py
```

### Health Check Endpoint
```bash
curl http://127.0.0.1:5000/api/health
```
*(Returns: `{"status": "ok", "database_connected": true, "configured_provider_ready": true}`)*
