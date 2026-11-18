# Project Evolution & Database Architecture Audit

**Target**: Lorely (Book Character Simulation & Reader Platform)  
**Date**: 2026-11-15  
**Author**: Senior Software Developer & AI Engineer  

---

## 1. Project Genesis & Evolution

### 1.1 Original Foundation (`docs/Copy of Langchain Training Task.pdf`)
The project originated from an AI engineering challenge titled *"AI Character Simulation with Emotional Adaptation"*.
Key requirements from the initial task specification:
- **Character Extraction**: Accept book text or file uploads; extract characters and baselines using an LLM.
- **Dörner's Psi Theory Emotional Engine**:
  - 6 Psychological parameters (0.0 to 1.0): Valence Level, Arousal Level, Selection Threshold, Resolution Level, Goal-Directedness, Securing Rate.
  - 5 Directed affects / emotional states: Anger, Sadness, Pride, Joy, Bliss.
  - Real-time updates after each conversational turn.
- **Cross-Session Long-Term Memory**: Recall interactions with past users (e.g., *"Do you know Birhanu Worku?"*).
- **Initial Stack**: React, Flask, LangChain, ChromaDB.

### 1.2 Evolution to Production Platform ("Lorely")
From that seed, the platform evolved into a comprehensive digital reading and character simulation ecosystem:
1. **Relational Source of Truth**: Added SQLAlchemy 2.0 models and Alembic migrations (13 revisions), replacing ephemeral vector-only storage.
2. **Document Ingestion Pipeline**: Asynchronous worker parsing PDF (PyMuPDF), EPUB, and plain text into structured chapters and spoiler-aware RAG chunks.
3. **Voice & Avatars**: Integrated voice catalog (Edge TTS, realtime voice simulation) and avatar matching engine.
4. **Universal Reader Shell**: Built `ReaderShell` supporting Text, PDF, and EPUB with table of contents, reading progress, sleep timers, audio follow-along, and in-reader character querying.
5. **Security & RBAC**: Supabase Auth with Row-Level Security (RLS) policies and three role tiers (`user`, `manager`, `admin`).
6. **Settings & Profiles**: Complete user preferences, billing tiers, notifications, and theme management.

---

## 2. Complete Database Audit

The database schema contains **31 tables**, structured for high relational integrity, user isolation, and multi-tenant scalability.

### 2.1 Table Categorization & Inventory

#### A. Books & Content Ingestion
- `books`: Core catalog entries (title, author, summary, cover_url, processing_status, total_words, total_pages, language).
- `book_sources`: Uploaded source files (file path, MIME type, hash, checksums, provenance).
- `book_chapters`: Hierarchical chapter breakdown (chapter index, title, start/end char offsets, reading time).
- `book_chunks`: Semantic chunks for spoiler-aware RAG retrieval with chapter boundaries.

#### B. Character Simulation & Dörner's Psi Theory
- `characters`: Character profiles (name, personality, role, archetype, baseline Psi parameters, initial emotional state, assigned voice ID).
- `character_profile_evidence`: Source text citations grounding character personality traits.
- `character_memories`: Long-term episodic and factual memories extracted from user conversations.
- `character_state_events`: Audit trail of emotional and psychological parameter shifts over time.
- `user_character_states`: Per-user isolated character emotional state and intimacy levels.
- `avatar_assets`: Visual portraits and avatar expressions for characters.

#### C. Live Chat & Memory
- `chat_sessions`: Conversational threads between a user and a character.
- `chat_messages`: Turn-by-turn dialogue, including role, message content, Psi parameter snapshots, and citations.

#### D. Reader & Bookshelf
- `user_library_books`: Books added to an individual user's personal collection.
- `custom_shelves`: User-defined virtual bookshelves (e.g., *Favorites*, *TBR*, *Classics*).
- `shelf_books`: Many-to-many junction mapping books to custom shelves.
- `reading_progress`: Reading telemetry (last read position, percentage complete, active chapter, reading duration).
- `reading_sessions`: Historical reading activity logs for analytics and streaks.
- `book_annotations`: User highlights, margin notes, and tagged excerpts.
- `book_bookmarks`: Pinned page and chapter markers.
- `book_narration_segments`: Audio timestamps and transcript alignments for follow-along listen mode.

#### E. Voice & Audio
- `voice_catalog`: Available AI narrator and character voice configurations (gender, tone, language, engine).
- `voice_usage_logs`: Telemetry tracking audio generation minutes and quota consumption.

#### F. Users, Roles & Subscriptions
- `users`: Core user accounts linked with Supabase Auth UUIDs.
- `profiles`: User display names, avatars, bios, and reading preferences.
- `user_roles`: Role assignments (`user`, `manager`, `admin`).
- `user_settings`: User configuration (theme, font size, audio speed, language).
- `membership_plans`: Subscription tiers (Free, Reader, Scholar, Patron).
- `payment_transactions`: Transaction records and subscription status.
- `notifications`: User notifications (system alerts, reading milestones, new book drops).

#### G. System Operations
- `processing_jobs`: Background job queue for text extraction, character generation, and audio rendering.
- `system_settings`: Global platform flags and API limits.

---

## 3. Seed Data & Current Local State

The local SQLite database (`backend/lorely_local.db`) is initialized with:
- **Books**:
  1. *White Nights* by Fyodor Dostoevsky (ID: `book-dostoevsky-white-nights`)
  2. *The Dream of a Ridiculous Man* by Fyodor Dostoevsky (ID: `book-dostoevsky-ridiculous-man`)
  3. *An Honest Thief* by Fyodor Dostoevsky (ID: `book-dostoevsky-honest-thief`)
- **Characters**:
  - The Dreamer & Nástyenka (*White Nights*)
  - The Ridiculous Man (*The Dream of a Ridiculous Man*)
  - Astafy Ivanovich & Emelyan Ilyitch (*An Honest Thief*)
- **Chapters & Evidence**: 11 chapters, 11 RAG chunks, 31 grounded character evidence quotes, 8 custom shelves, and 4 membership tiers.

---

## 4. Migration History (Alembic)

1. `20260405_0001_create_relational_core`: Initial user, book, character, and chat tables.
2. `20261108_0002_lorely_persistence_v2`: Character memories, state events, and profile evidence.
3. `20261108_0003_processing_jobs`: Background worker job queue.
4. `20261108_0004_book_chunks`: Semantic chunks for spoiler-aware search.
5. `20261108_0005_chat_message_citations`: Citation links between chat messages and book excerpts.
6. `20261109_0006_pgvector_and_chapters`: PostgreSQL pgvector support and chapter boundaries.
7. `20261109_0007_retrieval_and_character_evidence`: Evidence linkage to characters.
8. `20261109_0008_bilingual_foundation`: Multi-language book metadata support.
9. `20261109_0009_voice_catalog_and_interaction`: Voice profiles and audio narration metadata.
10. `20261109_0010_avatars_and_production_launch`: Avatar assets and visual matching.
11. `20261109_0011_reader_system_and_audio_narration`: Reader progress, bookmarks, annotations, and narration segments.
12. `20261109_0012_user_profiles_and_settings_expansion`: User settings, shelves, plans, notifications.
13. `20261110_0013_enable_rls`: Supabase Row Level Security hardening.
