# Book Character Simulation - Frontend Documentation

This document provides a comprehensive overview of the frontend application for the Book Character Simulation project. The frontend is built using React (with Vite as the bundler) and focuses heavily on providing an immersive interface for users to upload text and chat with characters extracted from that text.

## Tech Stack
- **Framework:** React
- **Bundler:** Vite
- **Routing:** React Router v6 (`react-router-dom`)
- **Authentication:** Supabase Auth
- **Styling:** Vanilla CSS (component-scoped styles, e.g., `AppShell.css`, `AuthScreen.css`)

## Project Structure
The source code is organized primarily inside the `src` directory:

- `components/`: Contains all the main UI elements and screens (see below).
- `lib/`: Contains utility modules, such as `supabase.js` for Supabase client configuration and `workspaceStore.js` for local/state workspace management.
- `services/`: Interfaces with the backend (contains `api.js`).

## Routing (`App.jsx`)
The application has a clear routing hierarchy defined in `App.jsx`, shielded by an authentication check:
1. **Root (`/`)**: Navigates to the `TextUpload` component, serving as the dashboard/home page.
2. **Workspace (`/workspace/:textId`)**: Renders `CharacterSelection`, where the user picks an extracted character to chat with based on the previously uploaded text.
3. **Chat (`/chat/:textId/:characterId`)**: Opens the `ChatInterface` to converse directly with the selected character.

*All routes are wrapped in the `AppShell` layout, which persists the overall structural frame and handles top-level workspace searching and sign out.*

## Key Components
- **`AppShell`**: The main layout wrapper for authenticated users, which holds the header/navigation and renders child routes.
- **`AuthScreen`**: Displayed when the user is not authenticated or when Supabase is not properly configured. It handles user login scenarios.
- **`TextUpload`**: The primary dashboard for uploading PDF files or pasting plain text so that characters can be extracted.
- **`CharacterSelection`**: Displays characters populated by the LLM extraction from the chosen text, acting as a lobby before a chat begins.
- **`ChatInterface`**: The core messaging view where users converse with the character.
- **`CharacterInsights`**: Additional component used within the chat view to show background info, traits, or memories related to the character.

## API Integration (`services/api.js`)
The `api.js` wrapper handles fetching endpoints via the core Backend API. It sets a timeout window (`90000ms`), adds JWT tokens (`Authorization: Bearer <accessToken>`) from the Supabase session, and handles the `FormData` creation cleanly.

Available service functions:
1. **`extractCharacters`**: Sends `file` or `text` along with `llmProvider` to `POST /api/extract-characters`.
2. **`chatWithCharacter`**: Sends `message`, `text_id`, and optionally `session_id` to `POST /api/chat/<character_id>`.

## Authentication Flow
Supabase governs authentication:
- `App.jsx` listens to `supabase.auth.onAuthStateChange` to keep track of the current user session.
- If the app is missing Supabase environment variables, it gracefully degrades to an `AuthScreen` in `setupMode`.
- Secured API calls simply pass `session.access_token` to Backend endpoints which validates them.

## Notes for Future Development
- **Styling updates**: If Tailwind CSS or another utility-first library is needed, it would replace the currently component-scoped vanilla CSS files (`XYZ.css`).
- **State Management**: Workspace state is seemingly decoupled to `getWorkspaceState` in `lib/workspaceStore.js` and local `useState`. Consider centralizing states if complexity grows beyond basic Prop drilling.
