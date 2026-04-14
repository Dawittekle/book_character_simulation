# Frontend

This frontend is a React 19 + Vite workspace for the book character simulation product.

## What It Does

- signs users in with Supabase Auth
- lets a user upload a pasted story excerpt or PDF-backed source
- creates a character board from the backend extraction API
- keeps a polished logged-in library/dashboard experience
- opens a chat studio for a selected character

## Environment Variables

Create `frontend/.env` from `frontend/.env.example` and set:

- `VITE_API_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Run Locally

```bash
cd frontend
npm install
npm run dev
```

The frontend expects the Flask backend to already be running.

## Current Frontend Architecture

- `src/App.jsx`
  Auth bootstrap and route wiring
- `src/components/AppShell.jsx`
  Logged-in workspace shell, sidebar, top search, and page chrome
- `src/components/AuthScreen.jsx`
  Sign-in / sign-up experience plus setup guidance
- `src/components/TextUpload.jsx`
  Dashboard, upload composer, and local library index
- `src/components/CharacterSelection.jsx`
  Character board for a single uploaded book
- `src/components/ChatInterface.jsx`
  Chat studio for a chosen character
- `src/lib/supabase.js`
  Frontend Supabase client
- `src/lib/workspaceStore.js`
  Temporary user-scoped browser storage until backend list endpoints are added
