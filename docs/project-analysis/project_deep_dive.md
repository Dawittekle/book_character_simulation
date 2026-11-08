# Book Character Simulation - Comprehensive Project Deep Dive & Status Report

## 1. Executive Summary & Starting Point

This project originated from the specification outlined in **`docs/Copy of Langchain Training Task.pdf`** (*"AI Character Simulation with Emotional Adaptation"*). 

### Original Requirements:
1. **Character Extraction**: Users upload a book (PDF or plain text) or paste source text. An LLM parses the text and extracts a structured list of characters (protagonists, antagonists, recurring figures) with personality traits, key events, and initial psychological baselines.
2. **Dörner's Psi Theory Emotional Modeling**: Rather than static persona prompts, characters maintain dynamic psychological parameters (Valence, Arousal, Selection Threshold, Resolution Level, Goal-Directedness, Securing Rate) and emotional states (Anger, Sadness, Pride, Joy, Bliss) that update in real time after every conversational turn.
3. **Adaptive In-Character Dialogue**: Characters speak strictly in voice, modulated by their calculated emotional states and grounded in the source book text.
4. **Long-Term Memory**: The system extracts objective facts about users and past interactions across conversations, enabling cross-session recall and recognizing previous users (e.g., *"Do you know Birhanu Worku?"*).

---

## 2. Architecture & Tech Stack

### System Overview Diagram

```
[ Frontend: React 19 + Vite ] 
       │ (JWT / Bearer Token via Supabase Auth)
       ▼
[ Backend: Flask REST API (Port 5000) ]
  ├── CharacterService & ChatService
  ├── Dörner's Psi Theory & Fact Extraction Prompts
  ├── LLM Engine: Google GenAI (gemini-3.5-flash) / OpenAI
  ├── Vector Store: ChromaDB (Local chunk/character cache)
  └── Relational DB: PostgreSQL (Supabase / SQLAlchemy 2.0 + Alembic)
```

### Frontend Architecture
- **Framework**: React 19 with Vite 6.
- **Routing**: React Router (`react-router-dom` v7).
- **Authentication**: Supabase Auth client with session persistence.
- **Role-Based Access Control (RBAC)**: Integrated `RoleProvider` supporting three tiers:
  - `user`: Standard access to library dashboard, character selection, and live chat simulation.
  - `manager`: Access to departmental simulation overviews, team analytics, and approvals (`/manager/*`).
  - `admin`: System-level administration, user management, and settings (`/admin/*`).
- **UI Components**:
  - `AppShell`: Persistent navigation frame with search, breadcrumbs, user menu, and role switchers.
  - `TextUpload` / `UploadModal`: Dashboard supporting text pasting and drag-and-drop PDF uploads with PyMuPDF server parsing.
  - `CharacterSelection`: Character lobby showcasing extracted profiles, baseline emotion radar, and traits.
  - `ChatInterface`: Live chat environment with real-time Dörner Psi parameter gauges, emotion state indicators, and memory timeline (`CharacterInsights`).

### Backend Architecture
- **Framework**: Flask with structured application factory (`create_app`).
- **Database Layer**:
  - **Relational Source of Truth**: PostgreSQL via SQLAlchemy 2.0 with connection pooling (`pool_pre_ping=True`).
  - **Schema Migrations**: Alembic tracking (`20260405_0001_create_relational_core`).
  - **Core Tables**: `users`, `books`, `book_sources`, `characters`, `chat_sessions`, `chat_messages`, `factual_memories`.
- **LLM Integration**:
  - Extensible provider factory (`LLMProviderFactory`).
  - Primary provider: `GeminiProvider` using the official `google-genai` SDK with strict JSON response formatting and transient error retries.
  - Fallback / Alternative provider: `OpenAIProvider`.
- **Hybrid Storage & Vector Layer**:
  - ChromaDB acts as an in-memory/on-disk vector store and fast response cache.
  - PostgreSQL stores all durable user history, chat turns, and relational metadata.

---

## 3. Dörner's Psi Theory & Memory Simulation

### Psychological Parameters (0.0 to 1.0)
1. **Valence Level**: Spectrum of attraction (appetence) vs. aversion (positive vs. negative reinforcement).
2. **Arousal Level**: Readiness for action, physiological mobilization.
3. **Selection Threshold**: Difficulty of intention switching (motive dominance stability).
4. **Resolution Level**: Perceptual and cognitive granularity (fine-grained vs. rapid heuristic).
5. **Goal-Directedness**: Prioritization of active motives vs. passive environmental adaptation.
6. **Securing Rate**: Frequency of environment-checking, orientation, and reflective routines.

### Directed Affects / Emotional States (0.0 to 1.0)
- **Anger**: Goal obstacle encountered (high arousal, low resolution, high selection threshold).
- **Sadness**: Goal blocked without specific obstacle (low arousal, low action readiness, high affiliation demand).
- **Pride**: High self-competence and legitimacy with low securing rate.
- **Joy**: High arousal with fulfillment of higher-order motives.
- **Bliss**: Low arousal with profound satisfaction and transcendent cognitive demands.

### Memory Lifecycle
1. User sends message -> Backend retrieves character baseline, chat history, and known factual memories from PostgreSQL / Chroma.
2. LLM responds in-character and computes new Psi values and updated emotional state.
3. A parallel fact extraction prompt analyzes the exchange for new objective facts (`fact_extraction_prompt`).
4. Extracted facts are stored in `factual_memories` table linked to the character and book, enabling persistent cross-session recall.

---

## 4. Current Status & Problems Resolved

During the deep-dive inspection and test run, the following issues were identified and resolved:

1. **Gemini Model Deprecation (`404 NOT_FOUND`)**:
   - *Problem*: The project configuration was set to `gemini-2.0-flash`. Google GenAI retired this model endpoint and rejected requests with a 404.
   - *Solution*: Upgraded configuration and defaults across `config.py`, `.env.example`, and `.env` to `gemini-3.5-flash`, which is active, supported, and fast.

2. **Unhandled Transient Upstream Errors (`503 UNAVAILABLE`)**:
   - *Problem*: `gemini_provider.py` previously only caught `genai_errors.ClientError`. When Google's API returned a 503 (high demand) or 500, an uncaught `ServerError` crashed the route.
   - *Solution*: Updated `gemini_provider.py` to catch `genai_errors.APIError` and implemented an automatic 3-attempt exponential backoff retry mechanism.

3. **Supabase Database Pooler Cold-Start Handling**:
   - *Problem*: The remote Supabase pooler (`aws-0-eu-west-1.pooler.supabase.com:5432`) initially rejected connections with tenant-not-found while waking up from inactivity.
   - *Solution*: Verified pooler connectivity, verified Alembic migration (`20260405_0001 (head)`), and confirmed active session pooling with retry.

4. **Git Tracking & Hygiene**:
   - *Problem*: Root `.gitignore` previously ignored `docs/` completely, preventing documentation from being tracked. Additionally, `skills-lock.json` was tracked in git index despite being in `.gitignore`.
   - *Solution*: Removed `docs/` from `.gitignore`, untracked `skills-lock.json`, and reinforced secret protection rules (`.env`, `.env.*`) so zero secrets can ever be committed.

5. **End-to-End Verification**:
   - Backend health endpoint `/api/health` returns `200 OK` with all systems ready.
   - Character extraction tested and verified: extracted Sherlock Holmes, Dr. John Watson, Mrs. Hudson, and Agitated Visitor with full Psi and emotion baselines.
   - Live chat simulation tested and verified: Sherlock Holmes replied in character, updated emotional states dynamically, and persisted memory facts into the database.
   - Frontend build (`vite build`) compiled cleanly with zero errors.
   - Both backend (daemon port 5000) and frontend (daemon port 5173) are active and operational.

---

## 5. Environment Variables & API Key Audit

### Backend (`backend/.env`)
| Variable | Status | Description |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | **Configured & Active** | Google Gemini API key; tested and working. |
| `GEMINI_MODEL` | **Configured & Active** | Set to `gemini-3.5-flash`. |
| `LLM_PROVIDER` | **Configured & Active** | Set to `gemini`. |
| `DATABASE_URL` | **Configured & Active** | Connected to Supabase PostgreSQL pooler. |
| `SUPABASE_URL` | **Configured & Active** | Supabase project URL (`https://ffhnldtsxylwkgenemgs.supabase.co`). |
| `SUPABASE_PUBLISHABLE_KEY` | **Configured & Active** | Supabase anon public key. |
| `SUPABASE_SECRET_KEY` | **Configured & Active** | Supabase service role key for backend authentication. |
| `OPENAI_API_KEY` | **Optional / Empty** | Unset. Only required if switching `LLM_PROVIDER=openai`. |
| `CHROMA_DB_PATH` | **Configured** | Local cache directory `chroma_db`. |

### Frontend (`frontend/.env`)
| Variable | Status | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | **Configured** | Set to `http://localhost:5000/api`. |
| `VITE_SUPABASE_URL` | **Configured** | Set to Supabase project URL. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | **Configured** | Set to Supabase public key. |

---

## 6. How to Run

### Backend
```bash
cd backend
source .venv/bin/activate
python run.py
# Runs on http://127.0.0.1:5000
# Health check: http://127.0.0.1:5000/api/health
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

