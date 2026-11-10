# Lorely Deployment Guide

Target setup:

| Piece | Where it runs | URL |
| --- | --- | --- |
| Frontend (React + Vite) | Vercel | `https://lorely.dawalink.space` |
| Backend (Flask + Gunicorn) | Render (Docker) | `https://api.lorely.dawalink.space` |
| Database + Auth | Supabase | `https://ffhnldtsxylwkgenemgs.supabase.co` |
| Files / audio | Cloudflare R2 | bucket `lorly` |
| LLM | Google Gemini | `gemini-3.5-flash` |

> **Why the backend is not on Vercel:** Vercel serverless functions cap request
> bodies at ~4.5 MB and time out on long jobs. Lorely uploads books (often tens of
> MB) and runs LLM ingestion/chat calls that take longer than that. Render (or
> Railway/Fly) runs it as a normal container, which is what it needs.
>
> The frontend *is* perfect for Vercel: it is a static Vite SPA.

---

## 0. Do this first: rotate every secret

`backend/.env` was read during development and the R2 keys were also committed to
`docs/test/system_architecture_and_guide.md` at some point, so they are in git
history. Treat all of these as compromised and create new ones before going live:

1. **Gemini API key** — Google AI Studio → API keys → delete the old key, create a new one.
2. **Supabase secret key** (`sb_secret_...`) — Supabase → Project Settings → API Keys → roll it.
3. **Supabase database password** — Supabase → Project Settings → Database → Reset database password.
4. **Cloudflare R2 API token** — Cloudflare → R2 → Manage API Tokens → delete and re-create.
5. **Google OAuth client secret** — Google Cloud Console → Credentials → reset the client secret.
6. **ElevenLabs key** (if you use voice) — revoke and re-create.
7. **Admin password** — pick a brand-new strong password; never keep `LorelyAdmin2026!Secure`.

Never commit `.env`. Only `.env.example` belongs in git.

---

## 1. Supabase

Project ref: `ffhnldtsxylwkgenemgs`.

### 1.1 Database is already migrated (RLS on)

The repo contains migrations up to `20261110_0013_enable_rls.py`, and they were
already applied to this project. If you ever point at a fresh database, run:

```bash
cd backend
.venv/bin/alembic upgrade head
```

This creates all tables and enables **Row Level Security** on every public table.
RLS matters because the publishable key ships in the browser: without it, anyone
could read/write your tables through Supabase's REST API. Verified after applying:
an anonymous REST read returns `[]`, and the backend (which connects as the table
owner) still works.

**Future tables:** when you add a model/table, add a migration that also runs
`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.

### 1.2 Connection string

Render must use the **session pooler** connection (IPv4-friendly):

```text
postgresql://postgres.ffhnldtsxylwkgenemgs:<NEW_DB_PASSWORD>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
```

The backend URL-encodes the password for you, so paste it exactly as Supabase
shows it (commas / `$` are fine).

### 1.3 Auth → URL configuration

Supabase Dashboard → **Authentication → URL Configuration**:

- **Site URL:** `https://lorely.dawalink.space`
- **Redirect URLs:** add all of these
  - `https://lorely.dawalink.space`
  - `https://lorely.dawalink.space/**`
  - `http://localhost:5173`
  - `http://localhost:5173/**`

The app calls `supabase.auth.signInWithOAuth({ redirectTo: window.location.origin })`,
so whatever domain the user started on must be allow-listed.

### 1.4 Auth → Google provider

Authentication → **Providers → Google**:

- Enable Google.
- Paste the **Client ID** and **Client Secret** from Google Cloud (section 2).
- Copy the callback URL shown there — it must be exactly:
  `https://ffhnldtsxylwkgenemgs.supabase.co/auth/v1/callback`

### 1.5 Auth → Email

Authentication → **Email**:

- Keep email confirmations on (recommended).
- Configure custom SMTP (Resend, SendGrid, Postmark, Gmail SMTP…) before launch.
  The built-in Supabase SMTP is rate-limited and only meant for testing.
- Set the sender name/address, e.g. `Lorely <no-reply@dawalink.space>`.
- Verify `dawalink.space` in your email provider (SPF/DKIM records).

### 1.6 Auth → Attack protection

Enable **Leaked password protection** and set sensible rate limits.

---

## 2. Google Cloud Console (OAuth)

1. Go to <https://console.cloud.google.com> and select (or create) a project.
2. **APIs & Services → OAuth consent screen**
   - User type: **External**
   - App name: `Lorely`
   - User support email: your email
   - **Authorized domains:** `dawalink.space`
     (do **not** add `https://`; just the domain)
   - Developer contact email: your email
   - **Scopes:** only `openid`, `.../auth/userinfo.email`,
     `.../auth/userinfo.profile` (these are non-sensitive; no Google verification
     review is needed for them).
   - Save, then click **Publish app** (move it out of "Testing" so any user can sign in).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `Lorely Web`
   - **Authorized JavaScript origins**
     - `https://lorely.dawalink.space`
     - `http://localhost:5173` (for local development)
   - **Authorized redirect URIs**
     - `https://ffhnldtsxylwkgenemgs.supabase.co/auth/v1/callback`
     - `http://localhost:54321/auth/v1/callback` (only if you run Supabase locally)
   - Create, then copy the **Client ID** and **Client secret** into Supabase
     (section 1.4) and into the backend env (`GOOGLE_CLIENT_ID`,
     `GOOGLE_CLIENT_SECRET`).
4. Wait a few minutes for changes to propagate.

Common mistake: putting `https://` in Authorized domains, or adding
`https://lorely.dawalink.space` as a redirect URI instead of the Supabase callback.
Google sends the user to Supabase, and Supabase sends them back to your site.

---

## 3. Backend on Render

### 3.1 Create the service

1. Push the repo to GitHub.
2. Render → **New → Web Service** → connect the repo.
3. Settings:
   - **Name:** `lorely-api`
   - **Root Directory:** `backend`
   - **Runtime:** Docker
   - **Dockerfile Path:** `./Dockerfile`
   - **Health Check Path:** `/api/health`
   - **Instance type:** Starter or higher (free instances sleep and have little RAM;
     the app imports PDF/EPUB/LLM libraries).
4. Add the environment variables below.

You can also use the included `render.yaml` blueprint (New → Blueprint), which
pre-fills the same settings.

### 3.2 Environment variables

```env
APP_ENV=production
DEBUG=false
HOST=0.0.0.0
# PORT is injected by Render; the Docker CMD reads it automatically.

LLM_PROVIDER=gemini
LLM_TEMPERATURE=0.7
MAX_SOURCE_CHARACTERS=50000
GEMINI_API_KEY=<new key>
GEMINI_MODEL=gemini-3.5-flash

DATABASE_URL=postgresql://postgres.ffhnldtsxylwkgenemgs:<NEW_DB_PASSWORD>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
DATABASE_CONNECT_TIMEOUT=10
SQLALCHEMY_ECHO=false
AUTO_CREATE_RELATIONAL_SCHEMA=false

SUPABASE_URL=https://ffhnldtsxylwkgenemgs.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable key>
SUPABASE_SECRET_KEY=<new secret key>

GOOGLE_CLIENT_ID=<google client id>
GOOGLE_CLIENT_SECRET=<new google client secret>

CORS_ORIGINS=https://lorely.dawalink.space
ANONYMIZED_TELEMETRY=false

ADMIN_EMAIL=admin@lorely.app
ADMIN_PASSWORD=<new strong password>

R2_ACCOUNT_ID=<new>
R2_ACCESS_KEY_ID=<new>
R2_SECRET_ACCESS_KEY=<new>
R2_BUCKET_NAME=lorly
R2_PUBLIC_URL=<your R2 public bucket URL>
STORAGE_LOCAL_DIR=storage

ELEVENLABS_API_KEY=<new, only if using ElevenLabs voice>
```

Notes:

- `APP_ENV=production` is **important**. It disables the `X-Test-User-Id`
  impersonation shortcut, blocks self-service role switching, and stops the
  startup demo purge from deleting real user books.
- `CORS_ORIGINS` must be the exact frontend origin (no trailing slash). Add
  `http://localhost:5173` too if you want to test locally against production.
- In production the storage service **requires** valid R2 credentials; it fails
  loudly instead of silently writing to ephemeral disk. That is intentional.

### 3.3 First deploy

Render builds `backend/Dockerfile` and starts:

```text
gunicorn --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 180 \
  'book_character_simulation_backend:create_app()'
```

The app seeds the Dostoevsky catalog and membership plans idempotently on boot.
Watch the logs until you see the health check pass.

### 3.4 Custom domain

Render → your service → **Settings → Custom Domains** → add:

```text
api.lorely.dawalink.space
```

Render gives you a CNAME target (e.g. `lorely-api.onrender.com`). Add in
Cloudflare DNS:

| Type | Name | Target | Proxy |
| --- | --- | --- | --- |
| CNAME | `api` | `lorely-api.onrender.com` | **DNS only** (grey cloud) |

Use DNS-only while Render issues the TLS certificate. Once the certificate is
active you may turn the orange cloud on, but set SSL mode to **Full (strict)**.

Verify:

```bash
curl https://api.lorely.dawalink.space/api/health
```

Expected: `"status": "ok"`, `"environment": "production"`, and
`"database_connected": true`.

---

## 4. Frontend on Vercel

### 4.1 Import the project

1. Vercel → **Add New → Project** → import the GitHub repo.
2. Settings:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm ci`
3. `frontend/vercel.json` already adds the SPA rewrite so React Router routes
   such as `/library` and `/characters/...` work on refresh.

### 4.2 Environment variables (Production **and** Preview)

```env
VITE_API_URL=https://api.lorely.dawalink.space/api
VITE_SUPABASE_URL=https://ffhnldtsxylwkgenemgs.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
VITE_DEFAULT_ADMIN_EMAIL=admin@lorely.app
```

These are baked in at **build time**. After changing any of them you must
redeploy (Vercel → Deployments → … → Redeploy). The publishable key is safe to
expose; the secret key must never appear in frontend env.

### 4.3 Custom domain

Vercel → Project → **Settings → Domains** → add:

```text
lorely.dawalink.space
```

Then in Cloudflare DNS:

| Type | Name | Target | Proxy |
| --- | --- | --- | --- |
| CNAME | `lorely` | `cname.vercel-dns.com` | **DNS only** initially |

Vercel will show the exact target. Once TLS is issued you can enable proxying.

### 4.4 API URL sanity check

`lorelyApi.js` strips a trailing `/api` and then appends `/api/v1`, so both
`https://api.lorely.dawalink.space/api` and `https://api.lorely.dawalink.space`
resolve to the same endpoints.

---

## 5. Cloudflare R2

1. Confirm the bucket `lorly` exists.
2. **Public access:** either enable the `r2.dev` public URL or attach a custom
   domain (e.g. `files.dawalink.space`). Put that URL in `R2_PUBLIC_URL`.
3. **API token:** R2 → Manage R2 API Tokens → Create token with
   **Object Read & Write** for the `lorly` bucket. Copy Account ID, Access Key
   ID, and Secret Access Key into Render.
4. **CORS** (required — the reader fetches EPUB/PDF/audio directly from R2 in the
   browser). R2 → bucket → Settings → CORS Policy:

```json
[
  {
    "AllowedOrigins": [
      "https://lorely.dawalink.space",
      "http://localhost:5173"
    ],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Range", "Accept-Ranges"],
    "MaxAgeSeconds": 3600
  }
]
```

The reader needs `Range` requests, so keep `Accept-Ranges` / `Content-Range`
exposed and do not block `Range` via headers.

> R2 is **required** in production. Render's disk is ephemeral: without R2,
> uploads disappear on every deploy/restart.

---

## 6. Gemini API key restrictions

In Google Cloud Console → APIs & Services → Credentials → your API key:

- **Application restrictions:** None (the key is used server-side by Render; IP
  restrictions would break it because Render's egress IP is not fixed).
- **API restrictions:** restrict to **Generative Language API** only.
- Set a **budget/quota alert** in Google Cloud Billing so a bug cannot burn
  through your quota silently.
- If the key leaks again, rotate it in AI Studio and update Render.

---

## 7. Deploy checklist (in order)

1. [ ] Rotate every secret (section 0).
2. [ ] Update Supabase Auth Site URL + redirect URLs.
3. [ ] Create the Google OAuth client; paste credentials into Supabase + Render.
4. [ ] Deploy the backend to Render with all env vars; health check is green.
5. [ ] Run `alembic upgrade head` if the database is new.
6. [ ] Deploy the frontend to Vercel with the four `VITE_*` variables.
7. [ ] Point `api.lorely.dawalink.space` at Render and `lorely.dawalink.space`
       at Vercel.
8. [ ] Configure R2 CORS + public URL.
9. [ ] Smoke-test (section 8).

---

## 8. Post-deploy smoke tests

```bash
# Backend health
curl -s https://api.lorely.dawalink.space/api/health

# Public catalog (no auth)
curl -s "https://api.lorely.dawalink.space/api/v1/books?scope=featured" | head

# Auth must be enforced
curl -s -o /dev/null -w "%{http_code}\n" https://api.lorely.dawalink.space/api/v1/me
# expect 401

# The old impersonation header must NOT work
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "X-Test-User-Id: hacker" https://api.lorely.dawalink.space/api/v1/me
# expect 401

# Supabase anon REST must return nothing sensitive
curl -s "https://ffhnldtsxylwkgenemgs.supabase.co/rest/v1/users?select=id,email&limit=1" \
  -H "apikey: <publishable key>" -H "Authorization: Bearer <publishable key>"
# expect []
```

In the browser on `https://lorely.dawalink.space`:

1. Landing page loads, no console CORS errors.
2. Sign up with email → confirmation email arrives.
3. Sign in with Google → returns to `lorely.dawalink.space`.
4. Open a featured book, chat with a character, confirm a grounded reply and
   citations.
5. Upload a small PDF/EPUB → processing completes → open the reader.
6. Refresh a deep link such as `/library` → Vercel rewrite keeps the page.
7. Change your avatar → it persists after refresh (R2 + CORS).
8. Open the admin portal at `/admin/login` with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

---

## 9. Common errors

| Symptom | Cause | Fix |
| --- | --- | --- |
| `blocked by CORS policy` | `CORS_ORIGINS` wrong | Set exactly `https://lorely.dawalink.space`, no trailing slash, redeploy backend |
| Google login: `redirect_uri_mismatch` | Wrong redirect URI in Google | Must be `https://ffhnldtsxylwkgenemgs.supabase.co/auth/v1/callback` |
| Google login returns to `localhost` | Supabase Site URL still local | Set Site URL + redirect URLs in Supabase |
| `Invalid login: Email not confirmed` | SMTP/confirmation not set up | Configure SMTP or resend confirmation |
| 401 on every authenticated call | Frontend has stale Supabase keys or backend `SUPABASE_URL` mismatch | Re-check env, redeploy both |
| `database_connected: false` | Bad `DATABASE_URL` or DB password rotated | Paste the current session-pooler URL |
| Uploads vanish after restart | R2 not configured | Set the four `R2_*` vars + `R2_PUBLIC_URL` |
| Reader blank / PDF won't load | R2 CORS missing | Apply the CORS policy in section 5 |
| Admin login says invalid | Default password still in use or `ADMIN_*` mismatch | Set `ADMIN_EMAIL` / `ADMIN_PASSWORD` in Render |
| Vercel 404 on refresh | SPA rewrite missing | Keep `frontend/vercel.json` and redeploy |
| Backend crashes at boot | `APP_ENV=production` without R2 | Add R2 credentials (required in production) |

---

## 10. What was fixed before this deploy

Recent commits on branch `redesign`:

- `267ac57` — avatar URLs resolve correctly; profile refreshes in the app shell.
- `82931b8` — blocked `X-Test-User-Id` impersonation outside tests, blocked
  self-service role escalation in production, stopped the startup demo purge
  from deleting real books, switched the container to Gunicorn, excluded local
  storage from Docker builds, redacted leaked credentials, added Vercel config.
- `8d25d7c` — enabled Row Level Security on all public tables (applied to
  Supabase).

Test status before deploy: **118 backend tests passed**, **204 frontend tests
passed**, frontend production build succeeds, and the production Gunicorn smoke
test returned a healthy `environment: production` response.
