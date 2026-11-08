# Lorely Simulation Backend

The backend for **Lorely**, an AI-powered literary character simulation and dialogic exploration engine. Built with Flask, SQLAlchemy 2.0, PostgreSQL (Neon/Supabase), ChromaDB, and Google Gemini / OpenAI.

---

## Capabilities & Architecture

- **Narrative Document Classification & Guard**:
  - Automatically identifies whether an uploaded document is a literary story or an accidental upload (such as a resume or technical paper).
  - Provides user-friendly, empathetic error handling for readers.
- **Fyodor Dostoevsky Timeless Catalog**:
  - Pre-seeded authentic literary catalog featuring *White Nights*, *The Dream of a Ridiculous Man*, and *An Honest Thief*.
  - Rich psychological profiles, canonical relationships, and grounded character citations.
- **Grounded Chat with Spoiler-Aware RAG**:
  - Semantic vector retrieval with chapter-aware spoiler filters.
  - Returns exact chapter citations, sequence numbers, and verbatim quotes from the text.
- **Dynamic Emotion Simulation**:
  - Real-time updates to character emotion states based on dialogue turns.
- **Voice Mode & Speech Synthesis**:
  - Synthesizes lifelike character speech audio with waveform visualization endpoints.
- **Dedicated Administrative Portal & Management**:
  - Isolated admin authentication (`POST /api/v1/admin/login`) with strict RBAC enforcement.
  - Administrative endpoints for managing books, triggering extraction jobs, retrying failed documents, reassigning user roles/plans, and broadcasting system alerts.

---

## Requirements

- Python 3.11, 3.12, or 3.13
- PostgreSQL database (Neon or Supabase)
- Google Gemini API key (`GEMINI_API_KEY`) or OpenAI API key (`OPENAI_API_KEY`)

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env`:

```bash
cp .env.example .env
```

Key configuration options:

```ini
APP_ENV=development
DEBUG=True
HOST=0.0.0.0
PORT=5000
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Relational Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# Supabase Auth
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# LLM Configuration
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash

# Dedicated Administrator Credentials
ADMIN_EMAIL=admin@lorely.app
ADMIN_PASSWORD=LorelyAdmin2026!Secure
```

---

## Running Locally

### Option 1: Using the Root Script (Recommended)
From the repository root:
```bash
./run.sh backend
```

### Option 2: Direct Python Execution
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python run.py
```

The server starts on `http://127.0.0.1:5000`.

---

## Running with Docker

From the repository root:
```bash
docker compose up --build backend
```

Or build the image directly:
```bash
cd backend
docker build -t lorely-backend .
docker run -p 5000:5000 --env-file .env lorely-backend
```

---

## Running Tests

Execute the comprehensive test suite with pytest:
```bash
cd backend
source .venv/bin/activate
pytest tests/
```

Includes unit tests for document extraction, prompt formatting, RAG chunking, spoiler retrieval, and integration tests for catalog seeding, grounded chat turns, and administrative authorization rejection.
