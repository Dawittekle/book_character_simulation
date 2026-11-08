# Lorely — Literary Character Simulation & Dialogic Experience

> **"Step into classical literature and converse with minds forged by history's greatest storytellers."**

**Lorely** is an AI-powered dialogic platform that brings timeless literary characters to life. Grounded in verbatim book passages with spoiler-aware vector retrieval (RAG), dynamic emotion state tracking, and lifelike voice synthesis, Lorely allows readers to hold authentic, psychologically rich conversations with characters from world literature.

---

## 📚 Featured Catalog: Fyodor Dostoevsky

Lorely comes pre-seeded with authentic short works by **Fyodor Dostoevsky**:

1. **White Nights** (*The Dreamer*, *Nástyenka*)
2. **The Dream of a Ridiculous Man** (*The Ridiculous Man*)
3. **An Honest Thief** (*Astafy Ivanovich*, *Emelyan Ilyitch*)

Every dialogue turn retrieves citations from exact chapters with spoiler protection, ensuring character responses remain faithful to their stories.

---

## 💎 Membership Plans & Subscription System

Lorely features a complete database-backed membership, billing checkout, and verification pipeline:

- **Four Subscription Tiers**:
  - **Free Reader ($0/mo)**: Unlimited basic dialogues, standard classics, community access.
  - **Explorer ($5/mo)**: 10 personal shelf imports, 100 daily dialogue turns, expanded memory.
  - **Literary Scholar ($20/mo)**: Unlimited books, HD voice mode, dynamic emotional drift telemetry, and spoiler-gated indexing.
  - **Institutional Archive ($100/mo)**: Isolated vector namespace, custom persona fine-tuning, multi-seat classroom access.
- **AI Model Selection**: Readers choose between **Gemini 3.5 Flash** (balanced & fast) and **Gemini 2.5 Pro** (deep literary reasoning) during plan checkout.
- **Admin Verification Console (`/admin/subscribers`)**: Operations console for approving incoming payments, tracking MRR, and managing subscriber allocations.
- **Admin Plan Editor (`/admin/plans`)**: Live plan editor allowing administrators to adjust pricing, quotas, features, and active status in real time.
- **Persistent Chat Sessions**: Full conversation histories and emotional states are preserved across page refreshes and browser sessions via PostgreSQL.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Linux / macOS / Windows (WSL2)**
- **Python 3.11+**
- **Node.js 20+** and **npm**
- *(Optional)* **Docker & Docker Compose**

### 2. Configure Environment Files
```bash
# Backend configuration
cp backend/.env.example backend/.env

# Frontend configuration
cp frontend/.env.example frontend/.env
```

Ensure your `backend/.env` has:
- `GEMINI_API_KEY` (or `OPENAI_API_KEY`)
- `DATABASE_URL` (PostgreSQL / Neon connection string)
- `ADMIN_EMAIL=admin@lorely.app`
- `ADMIN_PASSWORD=LorelyAdmin2026!Secure`

---

## 🏃 Ways to Run

Lorely provides multiple execution options to suit your workflow:

### Option A: Using the Orchestration Script (Easiest)

We provide an executable `./run.sh` script that handles virtual environments, dependencies, and graceful startup:

```bash
# Run both backend and frontend together
./run.sh

# Or run components individually
./run.sh backend       # Backend only on http://127.0.0.1:5000
./run.sh frontend      # Frontend only on http://127.0.0.1:5173
./run.sh test          # Run complete test suites (pytest + vitest)
./run.sh docker        # Start via Docker Compose
./run.sh docker-down   # Stop Docker Compose
```

### Option B: Running via Docker Compose

Run the entire stack in isolated production containers:

```bash
# Build and start services
docker compose up --build

# Run in background
docker compose up -d

# Stop services
docker compose down
```

Services exposed:
- **Frontend (Nginx SPA + Reverse Proxy)**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000/api](http://localhost:5000/api)

### Option C: Manual Local Development

#### Terminal 1 — Backend (Flask)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python run.py
```

#### Terminal 2 — Frontend (Vite)
```bash
cd frontend
npm install
npm run dev
```

---

## 🏛️ Application URLs & Portals

| Portal | URL | Purpose |
| :--- | :--- | :--- |
| **Reader Library & Discover** | `http://127.0.0.1:5173/discover` | Browse classic works and character dossiers |
| **Character Chat Studio** | `http://127.0.0.1:5173/characters/:id/chat` | Interactive dialogue, citations, and emotion gauges |
| **Admin Login** | `http://127.0.0.1:5173/admin/login` | Dedicated isolated administrator login |
| **Admin Console** | `http://127.0.0.1:5173/admin` | Catalog curation, pipeline jobs, user tiers |
| **Backend Health Check** | `http://127.0.0.1:5000/api/health` | Health & LLM/Database status |

### Default Admin Credentials
- **Email**: `admin@lorely.app`
- **Password**: `LorelyAdmin2026!Secure`

---

## 🧪 Testing

Lorely maintains a strict, regression-tested codebase:

```bash
# Run all tests via run.sh
./run.sh test

# Or run individually:
# Backend (54 integration & unit tests)
cd backend && .venv/bin/pytest tests/

# Frontend (67 unit & component tests across 12 test suites)
cd frontend && npm run test -- --run
```

---

## 📂 Repository Structure

```
.
├── backend/
│   ├── src/book_character_simulation_backend/
│   │   ├── api/v1/          # REST endpoints (auth, books, characters, chat, voice, admin)
│   │   ├── db/seeds/        # Dostoevsky catalog seeder & demo cleanup
│   │   ├── embeddings/      # Vector embedding models
│   │   ├── llm/             # Gemini & OpenAI providers with automatic downgrade
│   │   ├── services/        # Lorely, Chat, Character, Voice, and RAG services
│   │   └── config.py        # Environment & settings dataclass
│   ├── tests/               # pytest test suites
│   ├── Dockerfile           # Backend container
│   ├── run.py               # Flask entrypoint
│   └── README.md            # Detailed backend documentation
├── frontend/
│   ├── src/
│   │   ├── components/      # UI components (AppShell, Drawer, EmotionState, Waveform)
│   │   ├── pages/           # Pages (Discover, Library, ChatScreen, Admin)
│   │   ├── services/        # lorelyApi client
│   │   └── lib/             # Formatters and friendly error translation
│   ├── src/__tests__/       # vitest test suites
│   ├── Dockerfile           # Multi-stage production Nginx container
│   ├── nginx.conf           # SPA fallback & reverse-proxy configuration
│   └── README.md            # Detailed frontend documentation
├── docker-compose.yml       # Multi-container composition
├── run.sh                   # Unified orchestration script
└── README.md                # Project documentation
```

---

## 📜 License

MIT License. See individual package metadata for details.
