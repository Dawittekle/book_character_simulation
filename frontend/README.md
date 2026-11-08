# Lorely Simulation Frontend

The client-side single page application for **Lorely**, featuring a bespoke warm editorial aesthetic inspired by classical literature, serif typography (Georgia, Garamond), deep forest greens, creamy parchment canvases, and terracotta accents. Built with React 19, Vite, and React Router.

---

## Key Features & Pages

- **Timeless Literary Library (`/discover` & `/library`)**:
  - Browse authentic classic works by Fyodor Dostoevsky (*White Nights*, *The Dream of a Ridiculous Man*, *An Honest Thief*).
  - Inspect character dossiers, personality traits, and canonical relationship webs.
- **Interactive Character Chat Studio (`/characters/:characterId/chat`)**:
  - Live dialogue stream with literary character simulations.
  - Real-time animated typing bubbles with bouncing dots while generating responses.
  - Source citations highlighting exact chapters and verbatim book passages.
  - Collapsible **Character Dossier** drawer with dynamic **Emotion State** radial gauges and psychological insight summaries.
- **Voice Mode & Waveform Player**:
  - Speech synthesis and waveform playback of characters reading their replies.
- **Document Ingestion Modal**:
  - Upload stories in `.pdf`, `.epub`, or `.txt` format.
  - Automated classification with friendly error feedback preventing accidental uploads of non-narrative documents (such as resumes).
- **Dedicated Admin Console (`/admin`) & Isolated Login (`/admin/login`)**:
  - Completely isolated from reader navigation.
  - Requires administrator authentication (`admin@lorely.app`).
  - Catalog management: Toggle books between featured and private.
  - Job monitor: Track extraction pipelines and retry failed document runs.
  - Plan and user management: Reassign subscription tiers (Free, Scholar, Bibliophile) and user roles.
  - System broadcast notifications.

---

## Environment Variables

Copy `frontend/.env.example` to `frontend/.env`:

```bash
cp .env.example .env
```

Configuration:

```ini
VITE_API_URL=http://127.0.0.1:5000/api
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
VITE_DEFAULT_ADMIN_EMAIL=admin@lorely.app
```

---

## Running Locally

### Option 1: Using the Root Script (Recommended)
From the repository root:
```bash
./run.sh frontend
```

### Option 2: Direct npm Execution
```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://127.0.0.1:5173`.

---

## Building for Production

```bash
cd frontend
npm run build
```

Generates optimized production assets in `frontend/dist/`.

---

## Running with Docker

From the repository root:
```bash
docker compose up --build frontend
```

The production build is served via high-performance Nginx on port `5173`, with an embedded reverse-proxy to the backend API.

---

## Running Tests

Execute the frontend unit and integration tests with Vitest:

```bash
cd frontend
npm run test -- --run
```
