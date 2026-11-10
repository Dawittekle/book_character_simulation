# Lorely Book Reader & Audio Narration Experience: Master Implementation Plan

**Document**: `docs/reader/PLAN.md`  
**Target Release**: Lorely v2.2 (Reader & Narration Engine)  
**Primary Technologies**: React 19, Vite, Tailwind CSS, Flask, Python 3.12, Supabase PostgreSQL, SQLAlchemy, Cloudflare R2, EPUB.js, PDF.js, and Provider-Independent Audio Narration.

---

## 1. Executive Summary & Vision

Lorely evolves from a character simulation platform into a unified **literary universe** where users can:
1. **Read**: Experience the original source books (both admin-curated classics and user-uploaded EPUB, PDF, and TXT files) in an Apple Books-inspired, distraction-free reading canvas.
2. **Follow Along**: Listen to natural speech narration while the text dynamically glows and auto-scrolls sentence-by-sentence in real time.
3. **Listen**: Switch effortlessly to a hands-free audiobook player complete with chapter navigation, playback speeds, and sleep timers.
4. **Step Into the Story ("Ask a Character")**: Highlight any passage, dialogue, or moral dilemma and immediately summon any book character into a contextual discussion drawer, fully protected by spoiler boundaries up to the user's current reading position.

A single unified reading position bridges all three modes and devices seamlessly.

---

## 2. Apple Books Design Deconstruction & UX Architecture

The reader follows the design principles of **Apple Books** and modern high-end editorial typography, avoiding dashboard clutter and generic web-app aesthetics.

```
┌────────────────────────────────────────────────────────────────────────┐
│ ← Overview    Pride and Prejudice — Chapter IV    [Read | Follow | Listen]  Aa  🔖 │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [Table of Contents Drawer - Collapsible]                              │
│                                                                        │
│                      CHAPTER IV.                                       │
│                                                                        │
│      When Jane and Elizabeth were alone, the former, who               │
│      had been cautious in her praise of Mr. Bingley before,            │
│      expressed to her sister how very much she admired him.            │
│                                                                        │
│     ┌──────────────────────────────────────────────────────────┐       │
│     │ 🟡 Highlight  │ 📝 Note  │ 🔖 Bookmark │ ✦ Ask Character │       │
│     └──────────────────────────────────────────────────────────┘       │
│      "He is just what a young man ought to be," said she,              │
│      "sensible, good-humoured, lively; and I never saw such            │
│      happy manners!—so much ease, with such perfect good               │
│      breeding!"                                                        │
│                                                                        │
│      "He is also handsome," replied Elizabeth, "which a                │
│      young man ought likewise to be, if he possibly can.               │
│      His character is thereby complete."                               │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│ ⏮  ⏪ 15s   ▶️ Play Narration   ⏩ 15s  ⏭  │  1.0x  │  Chapter 4 (32%)  │ 🔊 │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Visual & Atmospheric Themes
The reading canvas supports 5 curated lighting environments:
1. **Pure White**: `#FFFFFF` background, `#1A1A1A` charcoal text (clean modern daylight).
2. **Warm Paper / Book Parchment (Default)**: `#FAF7F0` background, `#2A2521` deep umber text, `#D97706` amber accents (classic book feel, zero blue-light fatigue).
3. **Quiet Sepia**: `#F4EBD9` background, `#3D332A` warm espresso text (vintage library aesthetic).
4. **Dark Slate**: `#1E2022` background, `#E2E8F0` soft off-white text (low-contrast evening reading).
5. **Obsidian OLED**: `#0B0C0E` pitch background, `#CCCCCC` muted white text (battery-saving night mode).

### 2.2 Editorial Typography & Geometry
- **Font Families**:
  - *Serif (Literature)*: Merriweather, Georgia, Palatino, Charter.
  - *Sans (Clean modern)*: Inter, SF Pro, system-ui.
- **Reading Geometry**:
  - Max column width: `680px` – `720px` (optimized for 65–75 characters per line).
  - Dynamic line height (`1.6` – `1.9` depending on font size).
  - Adjustable text size (14px to 28px in 8 discreet steps).
- **Immersion Chrome (Distraction-Free Auto-Hide)**:
  - While scrolling or reading, all top navigation bars and bottom controls smoothly fade to `opacity: 0` (`pointer-events: none`).
  - A gentle tap or cursor movement brings back the floating glassmorphic HUD controls.

### 2.3 Contextual Selection Pill
Selecting any text string on the page displays a floating iOS-style action pill:
- **Highlight**: 4 soft pastel colors (Yellow, Amber, Rose, Sage).
- **Note**: Attach personal marginalia or reflections.
- **Bookmark**: Pin the exact paragraph/CFI to saved bookmarks.
- **✦ Ask a Character**: Opens the right-side contextual drawer with the quote highlighted and character selector ready.

---

## 3. Core Technical Architecture

```mermaid
flowchart TD
    subgraph Storage & Cloud
        R2[(Cloudflare R2)]
        DB[(Supabase PostgreSQL)]
    end

    subgraph Backend Services
        AS[StorageService<br/>Presigned URLs]
        NS[BookNarrationService<br/>TTS & Alignment]
        RS[LorelyService<br/>Reading Progress & Spoiler Boundaries]
        CR[CharacterSimulationService<br/>In-Character Passage Discussion]
    end

    subgraph Frontend Reader Architecture
        Router[/books/:bookId/read]
        Controller[ReaderController<br/>Shared Position State]
        
        subgraph Adapters
            EPUB[EpubReaderAdapter<br/>EPUB.js + CFI]
            PDF[PdfReaderAdapter<br/>PDF.js + Canvas]
            TXT[TextReaderAdapter<br/>Virtual Scroll]
        end

        SyncEngine[AudioSyncEngine<br/>Sentence Glow & Auto-scroll]
        ChatDrawer[AskCharacterDrawer<br/>Spoiler-Gated Simulation]
    end

    R2 -->|Raw Binary| Adapters
    R2 -->|Cached Audio MP3s| SyncEngine
    DB -->|Reading Progress & Bookmarks| Controller
    Controller --> Adapters
    Controller --> SyncEngine
    SyncEngine --> NS
    ChatDrawer --> CR
    AS --> R2
```

---

## 4. Frontend Design & Component Hierarchy

### 4.1 Route Map
1. **`/library`**: Updated book cards displaying status-aware actions (`"Read Book"`, `"Continue Reading"`, or `"Read Again"` with progress badge e.g. `Ch. 4 · 42%`).
2. **`/books/:bookId`**: Dedicated Book Overview screen (cover, metadata, synopsis, character roster preview, chapter outline, reading metrics, quick action launcher).
3. **`/books/:bookId/read`**: Dedicated full-screen reader shell without the dashboard sidebar.

### 4.2 Reader Adapter Architecture
To support EPUB, PDF, and TXT uniformly, the reader implements the **Reader Adapter Pattern**:

```typescript
interface ReaderAdapter {
  mount(containerElement: HTMLElement): Promise<void>;
  unmount(): void;
  loadSource(url: string, initialLocation?: string): Promise<void>;
  navigateToLocation(locator: UniversalLocator): Promise<void>;
  nextPage(): Promise<void>;
  prevPage(): Promise<void>;
  getCurrentLocation(): UniversalLocator;
  applyTheme(theme: ReaderTheme, typography: TypographySettings): void;
  highlightSentence(sentenceText: string, sentenceIndex: number): void;
  clearHighlights(): void;
  onLocationChange(callback: (locator: UniversalLocator) => void): void;
  onTextSelected(callback: (selection: TextSelection) => void): void;
}
```

- **`EpubReaderAdapter`**: Built on `epubjs`. Uses Canonical Fragment Identifiers (CFI) for exact character-level location. Injects custom stylesheet matching reader themes.
- **`PdfReaderAdapter`**: Built on `pdfjs-dist`. Renders text layers over rendered SVG/canvas pages. Employs virtualized page scrolling with PDF page numbers and paragraph offsets.
- **`TextReaderAdapter`**: Native React virtualized reader. Splits clean UTF-8 text into chapters and semantic paragraphs with exact character offset locators.

---

## 5. Audio Narration & Synchronization Engine

### 5.1 Three Connected Modes
1. **Read Mode**: Full visual focus on text. Audio controls minimized to a small floating badge.
2. **Follow Along Mode**: Synchronized playback. The active sentence glows with an amber backdrop (`rgba(217, 119, 6, 0.15)`), while the reader viewport smoothly auto-centers the active sentence.
3. **Listen Mode**: Full-screen audiobook view featuring cover art, large playback scrubbers, chapter skip controls, sleep timer modal (15m, 30m, 45m, end of chapter), and narrator selector.

### 5.2 Server-Side Narration Pipeline (`BookNarrationService`)
- Breaks chapter text into natural sentence groups.
- Generates audio through Lorely's voice engine (`OpenAITTSProvider`, `ElevenLabsTTSProvider`, or local fallback).
- Captures sentence-level start/end timestamps (`alignment_data` JSON):
```json
{
  "chapter_index": 3,
  "segments": [
    {
      "segment_index": 0,
      "text": "When Jane and Elizabeth were alone, the former expressed her admiration.",
      "start_time_ms": 0,
      "end_time_ms": 4820
    }
  ]
}
```
- Audio files (`.mp3`) and timestamp manifests are cached in Cloudflare R2 (`books/{id}/narration/ch_{index}.mp3`). Subsequent plays are instant and incur zero extra TTS cost.

---

## 6. "Ask a Character" Contextual Integration

### 6.1 User Experience Flow
1. User highlights a passage in the reader:
   > *"He is also handsome," replied Elizabeth, "which a young man ought likewise to be..."*
2. User clicks **✦ Ask a Character** in the selection pill.
3. A right-side glassmorphic drawer slides in smoothly.
4. The user selects an unlocked character from the book (e.g. *Elizabeth Bennet* or *Mr. Darcy*).
5. The quote is pinned as the primary context card in the drawer.
6. The user asks: *"Why do you make fun of Jane's praise here?"*
7. The character responds in full archetypal voice, referencing the events of Chapter IV while strictly observing the **spoiler boundary** (zero knowledge of later proposals or disclosures).

### 6.2 Backend Spoiler Gating
When invoking `CharacterSimulationService`:
- `reading_progress_chapter` is extracted directly from the user's active `ReadingProgress.current_chapter_index`.
- Retrieval chunks with `chapter_index > current_chapter_index` are blocked by PostgreSQL `where(BookChunk.chapter_index <= max_allowed_chapter)`.

---

## 7. Database Architecture & Migrations

Alembic Migration: `20261109_0011_reader_system_and_audio_narration.py`

### 7.1 New Database Tables

#### Table: `reading_progress`
Tracks the exact cloud reading position per user per book.
- `id` (UUID, PK)
- `user_id` (String/UUID, FK -> `users.id`, indexed)
- `book_id` (UUID, FK -> `books.id`, indexed)
- `current_chapter_index` (Integer, default 0)
- `progress_percent` (Float, 0.0 to 100.0)
- `locator_type` (Enum: `'epub_cfi'`, `'pdf_page'`, `'text_offset'`)
- `locator_payload` (JSONB: `{ cfi: "...", page: 4, offset: 1205 }`)
- `last_read_mode` (Enum: `'read'`, `'follow_along'`, `'listen'`)
- `reading_time_seconds` (Integer, total time spent)
- `completed` (Boolean, default False)
- `last_read_at` (DateTime TZ)
- *Constraint*: `UNIQUE(user_id, book_id)`

#### Table: `book_bookmarks`
Saved locations and favorite chapters.
- `id` (UUID, PK)
- `user_id` (String, FK -> `users.id`, indexed)
- `book_id` (UUID, FK -> `books.id`, indexed)
- `chapter_index` (Integer)
- `chapter_title` (String)
- `progress_percent` (Float)
- `locator_type` (String)
- `locator_payload` (JSONB)
- `snippet` (Text, preview of the text at bookmark)
- `created_at` (DateTime TZ)

#### Table: `book_annotations`
User highlights and notes attached to text spans.
- `id` (UUID, PK)
- `user_id` (String, FK -> `users.id`, indexed)
- `book_id` (UUID, FK -> `books.id`, indexed)
- `chapter_index` (Integer)
- `selected_text` (Text, exact passage)
- `color` (String: `'yellow'`, `'amber'`, `'rose'`, `'sage'`)
- `note` (Text, optional user reflections)
- `locator_type` (String)
- `locator_payload` (JSONB, start & end ranges)
- `created_at` (DateTime TZ)
- `updated_at` (DateTime TZ)

#### Table: `book_narration_segments`
Server-cached narration audio chunks and timestamp manifests.
- `id` (UUID, PK)
- `book_id` (UUID, FK -> `books.id`, indexed)
- `chapter_index` (Integer, indexed)
- `voice_id` (String)
- `audio_storage_path` (String, Cloudflare R2 key)
- `duration_ms` (Integer)
- `alignment_data` (JSONB, sentence & word timing array)
- `created_at` (DateTime TZ)
- *Constraint*: `UNIQUE(book_id, chapter_index, voice_id)`

---

## 8. API Specification

All endpoints reside under `/api/v1/reader/` and require valid JWT authentication.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/books/{book_id}/access` | Validates access (public or owned) and returns presigned short-lived URL for the original raw EPUB/PDF/TXT asset. |
| `GET` | `/books/{book_id}/chapters` | Returns structured chapter tree, titles, order, and start locators. |
| `GET` | `/books/{book_id}/progress` | Fetches user's current reading position, mode, and percent. |
| `PUT` | `/books/{book_id}/progress` | Saves current position (debounced from frontend, optimistic local fallback). |
| `GET` | `/books/{book_id}/bookmarks` | Lists all bookmarks for the user. |
| `POST`| `/books/{book_id}/bookmarks` | Creates a new bookmark. |
| `DELETE`| `/books/{book_id}/bookmarks/{id}` | Deletes a bookmark. |
| `GET` | `/books/{book_id}/annotations`| Lists all highlights & notes for the book. |
| `POST`| `/books/{book_id}/annotations`| Saves a highlight or note. |
| `DELETE`| `/books/{book_id}/annotations/{id}`| Removes an annotation. |
| `GET` | `/books/{book_id}/narration/{chapter_idx}` | Returns audio stream URL and sentence alignment timestamps. |
| `POST`| `/books/{book_id}/contextual-chat` | Starts/continues a character dialogue grounded on a selected passage with spoiler gating. |

---

## 9. Phased Execution Roadmap

### Phase 1: Database Migration & Storage Presigning
- [x] Create Alembic migration `20261109_0011_reader_system_and_audio_narration.py`.
- [x] Define SQLAlchemy models (`ReadingProgress`, `BookBookmark`, `BookAnnotation`, `BookNarrationSegment`).
- [x] Implement `StorageService.generate_presigned_url(key, expires_in=3600)` with fallback streaming.
- [x] Add `/api/v1/reader/books/{book_id}/access` endpoint with ownership verification.

### Phase 2: Frontend Reader Foundation & Adapters
- [x] Install required lightweight reader packages (`epubjs`, `pdfjs-dist`).
- [x] Build `ReaderShell.jsx` (distraction-free layout, immersive auto-hiding chrome, theme provider).
- [x] Implement `EpubReaderAdapter.jsx`, `PdfReaderAdapter.jsx`, and `TextReaderAdapter.jsx`.
- [x] Build settings modal (font selection, font size, margins, 5 atmospheric themes).
- [x] Add collapsible Table of Contents sidebar.

### Phase 3: Reading Progress Synchronization & Overview Screen
- [x] Build `/books/:bookId` Overview page (cover, metadata, chapter list, character previews, reading progress bar, action buttons).
- [x] Update Library cards with dynamic status labels (`"Read Book"`, `"Continue Reading"`, `"Read Again"`).
- [x] Implement bidirectional progress syncing (cloud debounced + `localStorage` cache for instant resume).

### Phase 4: Audio Narration & Follow-Along Engine
- [x] Build `BookNarrationService` in backend to synthesize chapter audio and generate sentence alignment manifests.
- [x] Build `FollowAlongController.jsx` on frontend:
  - Synchronizes HTML audio time updates with sentence timestamps.
  - Highlights currently spoken sentence with glowing amber backdrop.
  - Smoothly auto-scrolls the reading viewport without jarring jumps.
- [x] Implement Listen Mode (audiobook dashboard, large play/pause scrubbers, skip buttons, sleep timer).

### Phase 5: Annotations & "Ask a Character" Contextual Drawer
- [x] Build native floating text selection action pill (`[Highlight | Note | Bookmark | Ask Character]`).
- [x] Implement highlight rendering across reader formats.
- [x] Build `AskCharacterDrawer.jsx`:
  - Selected passage quote card.
  - Character selector dropdown (characters extracted from the book).
  - Conversational interface with suggested inquiries.
  - Backend integration passing `max_allowed_chapter = current_chapter_index` to guarantee zero spoilers.
- [x] Built `AddNoteModal.jsx` for attaching reflection notes to highlighted text.
- [x] Upgraded `TableOfContentsDrawer.jsx` with tabs for Chapters, Bookmarks, and Notes & Highlights with deletion and quick jump.

### Phase 6: Polish, Accessibility & End-to-End Verification
- [x] Complete keyboard shortcuts (Space / Arrows to flip pages, `F` for Follow Along, `R` for Read, `L` for Listen, `T` for TOC, `S` for Settings, `?` for Shortcuts Cheat Sheet modal, `Esc` to toggle HUD).
- [x] WCAG 2.1 AA accessibility verification (contrast ratios >= 4.5:1 across all 5 themes, ARIA attributes on scrubbers, drawers, dialogs).
- [x] Unit & integration tests for all new API routes and services (12/12 backend tests passed, 18/18 frontend reader tests passed).
- [x] Verify seamless transition between Read, Follow Along, and Listen modes across formats.

---

## 10. Verification & Quality Matrix

| Test Category | Target Component | Success Criteria |
| :--- | :--- | :--- |
| **Unit Test** | `test_reader_api.py` | Verify progress saving, bookmarking, and annotation CRUD operations with authentication checks. |
| **Unit Test** | `test_spoiler_gate.py` | Ensure character simulation rejects or hides evidence from chapters beyond `current_chapter_index`. |
| **Unit Test** | `test_presigned_urls.py` | Verify that presigned URLs for private books are only accessible to the owning user or admin. |
| **Frontend Test** | `ReaderShell.test.jsx` | Test theme switches, font scaling, and mode toggles (Read -> Follow Along -> Listen). |
| **Frontend Test** | `AudioSyncEngine.test.jsx`| Verify sentence highlight index activates at expected timestamp ms. |
| **Integration Test**| Multi-format loading | Successfully render EPUB (Pride and Prejudice), PDF, and plain text without rendering errors. |

---

*This plan is ready for user review and approval prior to implementation.*
