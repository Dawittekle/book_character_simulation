# Lorely Book Reader & Audio Narration: Implementation Audit
**Date**: November 9, 2026  
**Document**: `docs/reader/IMPLEMENTATION_AUDIT.md`  
**Purpose**: Comprehensive technical audit of the current Lorely codebase across models, ingestion, storage, extraction, chapter parsing, RAG, spoiler boundaries, APIs, voice engines, and frontend routes before implementing the unified Book Reader & Narration system.

---

## 1. Executive Summary

Lorely currently possesses a robust ingestion pipeline, relational database schema with PostgreSQL pgvector embeddings, Cloudflare R2 object storage, spoiler-filtered RAG retrieval, and an archetypal character simulation engine. However, the system currently treats books primarily as **raw semantic data sources for character generation**, rather than as **first-class readable literary works**.

This audit identifies what exists, what is partially implemented, what is missing, what must be reused, and what architectural bridges must be built to deliver the unified e-reader experience.

---

## 2. Area-by-Area Codebase Investigation

| Area | Current Codebase State | Status | What to Reuse / Extend | What is Missing |
| :--- | :--- | :--- | :--- | :--- |
| **1. Book Models** | `Book` (`books`), `BookSource` (`book_sources`), `BookChapter` (`book_chapters`), `BookChunk` (`book_chunks`), and `UserLibraryBook` (`user_library_books`) exist in `backend/src/book_character_simulation_backend/db/models.py`. | **Partially Implemented** | Reuse `Book`, `BookSource`, `BookChapter`, and `UserLibraryBook`. | Missing `BookAsset` (or extending `BookSource` with parser versions and sha256), `ReadingProgress` (rich locators for EPUB CFI, PDF page/offset, TXT paragraph offset), `Bookmark`, `Annotation`, and `NarrationSegment`. |
| **2. Ingestion** | `IngestionWorker` in `workers/ingestion_worker.py` and `lorely_service.py` (`inspect_source`, `create_book`). Processes jobs via `ProcessingJob` table. | **Implemented (AI-focused)** | Reuse async queue pattern, validation checks, and metadata extraction. | Currently extracts plain text for LLM character mining. Missing dedicated multi-format asset cataloging and preserving original EPUB/PDF files for client-side rendering. |
| **3. Storage** | `StorageService` in `services/storage_service.py` connects to Cloudflare R2 via `boto3` (S3 API) with local directory fallback. Handles bucket keys `books/{id}/...`. | **Implemented** | Reuse `StorageService.upload_file()`, `download_file()`, and bucket credentials. | Missing signed short-lived URL generation (`generate_presigned_url`) for secure client-side direct reading of private EPUB/PDF assets and narration audio streams. |
| **4. Extraction** | `document_extractor.py` uses `PyMuPDF` (`fitz`) to extract text from PDF, EPUB, and TXT. | **Implemented** | Reuse format detector (`detect_file_format`) and metadata inference. | Reader needs the **original binary files** (EPUB archive, PDF stream) served directly to the frontend adapters (EPUB.js, PDF.js), not just flattened text. |
| **5. Chapter Parsing** | `split_into_chapters` in `rag/chunker.py` uses regex heuristics (`CHAPTER I`, `Chapter 1`, etc.) to generate `BookChapter` records. | **Partially Implemented** | Reuse `BookChapter` schema and order indexes. | Missing EPUB Table of Contents (TOC) extraction (`toc.ncx` / `nav.xhtml`) and PDF bookmark tree extraction. Locators are currently char offsets instead of EPUB CFI or PDF page indices. |
| **6. RAG** | `SpoilerAwareRetriever` in `rag/retriever.py` searches `book_chunks` via native PostgreSQL pgvector cosine distance (`<->`). | **Fully Implemented** | Reuse for passage retrieval and character grounding. | RAG chunks currently lack bidirectional mapping to reader locators (e.g. mapping a selected passage in EPUB to its RAG chunk). |
| **7. Spoiler System** | `reading_progress_chapter` on `ChatSession` and `UserLibraryBook` gates evidence and chunk retrieval up to `max_allowed_chapter`. | **Fully Implemented** | Reuse strict chapter ceiling across all LLM prompts. | Reading progress must now update automatically as the reader advances through pages/chapters in the new reader interface. |
| **8. Authentication** | `SupabaseAuthService` (`auth.py`) validates JWTs and extracts `AuthenticatedUser`. `resolve_user()` enforces ownership checks. | **Fully Implemented** | Reuse `resolve_user()` and role-based permissions (`admin` vs `user`). | Need resource-level ownership validation for reading progress, annotations, and bookmarks. |
| **9. API Routes** | `api/v1/routes.py` has endpoints for books, characters, chat, voice catalog, avatars, admin, and export/delete. | **Partially Implemented** | Reuse router patterns, dependency injection, and Pydantic validation. | Missing: `/books/{id}/source-access`, `/books/{id}/chapters`, `/books/{id}/reading-progress`, `/books/{id}/bookmarks`, `/books/{id}/annotations`, and `/books/{id}/narration/segments`. |
| **10. Frontend** | `MyLibrary.jsx`, `Discover.jsx`, `CharacterGallery.jsx`, `ChatScreen.jsx`. Routes in `App.jsx`. | **Partially Implemented** | Reuse book card components, shelf layout, and navigation shell. | Missing: Book Overview page (`/books/:bookId`), Reader Shell (`/books/:bookId/read`), Reader Adapters (EPUB, PDF, TXT), Audio Narration Player, Contextual Annotation Toolbar, and "Ask a Character" panel. |
| **11. Voice & TTS** | `VoiceService` with `OpenAITTSProvider`, `ElevenLabsTTSProvider`, and `LocalHarmonicTTSProvider`. Browser `speechSynthesisService`. | **Fully Implemented (Character dialogue)** | Reuse TTS provider abstractions, cost estimator, and audio storage conventions. | Missing: `BookNarrationService` designed specifically for book text (paragraph chunking, alignment timestamps, audio prefetching, and sentence-level sync). |
| **12. Database Migrations** | 10 Alembic migrations applied to Supabase up to `20261109_0010_avatars_and_production_launch.py`. | **Up-to-Date** | Follow Alembic revision chain for clean rollback and upgrade. | Needs Migration `20261109_0011_reader_system_and_audio_narration.py`. |

---

## 3. Classification of Components

### What Already Exists and Must Be Kept & Reused
- **Core Book Entities**: `books`, `book_sources`, `book_chapters`, `book_chunks`, and `user_library_books` tables.
- **RAG & Vector Retrieval**: Native pgvector similarity search with strict spoiler boundary enforcement (`SpoilerAwareRetriever`).
- **Object Storage**: Cloudflare R2 connectivity via `StorageService`.
- **Character Cognitive Engine**: Deterministic PSI engine (`PsiEngine`) and character memory extraction.
- **Voice System**: Multi-provider TTS engine (`VoiceService`) and browser `speechSynthesisService`.
- **Admin Infrastructure**: Catalog publishing, subscriber management, and GDPR export/delete.

### What Is Partially Implemented and Must Be Enhanced
- **`BookSource`**: Stores `storage_path` of original uploaded file, but lacks SHA256 checksums, parser versions, and signed download URL endpoints for client-side e-reading.
- **`BookChapter`**: Has `chapter_order`, `title`, and character offsets, but lacks EPUB CFI or PDF page ranges (`start_locator`, `end_locator`) and structural TOC hierarchy.
- **`UserLibraryBook`**: Tracks `reading_progress_chapter`, but lacks granular locators (CFI, page index, character offset) and reading mode state.
- **`frontend/src/pages/MyLibrary.jsx`**: Displays book cards, but clicking a book currently routes directly to `CharacterGallery` rather than offering a choice between Reading, Listening, or Exploring Characters.

### What Is Missing and Must Be Built
1. **Database Tables**:
   - `reading_progress`: Authoritative persistent reading position with format-specific JSON locators.
   - `book_bookmarks`: Reader bookmarks with locators and labels.
   - `book_annotations`: User highlights, notes, and quote tags with locators and colors.
   - `book_narration_segments`: Narration audio cache with duration, text hash, and alignment timestamps.
2. **Backend Services**:
   - `BookNarrationService`: Segments book text, synthesizes narration audio, caches segments in R2, and retrieves sentence/word alignment timing.
   - Presigned R2 URL generation on `StorageService` for authorized, expiring book file streaming.
3. **API Endpoints**:
   - Book reading progress (`GET/PUT /api/v1/books/{id}/reading-progress`).
   - Book source secure access (`GET /api/v1/books/{id}/source-access`).
   - Bookmarks & Annotations CRUD (`/api/v1/books/{id}/bookmarks`, `/api/v1/books/{id}/annotations`).
   - Narration segment pipeline (`POST /api/v1/books/{id}/narration/segments`).
4. **Frontend Architecture**:
   - **Book Overview Page** (`/books/:bookId`): Literary bridge showing book metadata, reading stats, chapter index, and action buttons (`Read`, `Listen`, `Characters`).
   - **Dedicated Reader Interface** (`/books/:bookId/read`): Distraction-free, responsive full-screen e-reader inspired by Apple Books.
   - **Shared Reader Adapter System**: Pluggable interface supporting EPUB.js (EPUB), PDF.js (PDF), and Native Lorely Reader (TXT).
   - **Immersion Narration Dock**: Audio player capsule with synchronized glowing text highlighting and auto-scrolling.
   - **Contextual Selection & "Ask a Character"**: Popover toolbar on text selection allowing readers to highlight, note, or immediately discuss the passage with a character within spoiler boundaries.

### What Should Be Replaced or Refactored
- **Direct Book Click Navigation**: Replace the direct redirect from `/library` to `/characters` with the new Book Overview route (`/books/:bookId`).
- **Static Page Estimation**: Replace estimated page counts (word count / 300) with format-native pagination (PDF physical pages, EPUB synthetic locations).

### What Is Genuinely Unused and Safe to Clean Up
- No production database tables or APIs need to be dropped. All existing features remain backward-compatible.
