# Production Deployment & Qdrant Cloud Architecture Guide

## Overview
Lorely uses **PostgreSQL** (Neon / Supabase) as the authoritative relational source of truth and **Qdrant Cloud** as the managed vector database for high-dimensional semantic search and chapter-aware spoiler prevention.

---

## Required Deployment Environment Variables

Configure these in your production host (e.g. Vercel Project Settings -> Environment Variables, or Render/Railway/Fly.io):

| Variable Name | Required | Default / Example | Purpose |
|---|---|---|---|
| `QDRANT_URL` | **Yes** | `https://xxxx.sa-east-1-0.aws.cloud.qdrant.io:6333` | Managed Qdrant Cloud cluster endpoint |
| `QDRANT_API_KEY` | **Yes** | `ey...` | Qdrant Cloud API Key (kept secret) |
| `QDRANT_COLLECTION` | No | `lorely_book_chunks` | Qdrant vector collection name |
| `QDRANT_TIMEOUT` | No | `10` | Request timeout in seconds |
| `GEMINI_API_KEY` | **Yes** | `AIzaSy...` | Google GenAI API Key for chat and embeddings |
| `GEMINI_MODEL` | No | `gemini-3.5-flash` | LLM dialogue simulation model |
| `GEMINI_EMBEDDING_MODEL` | No | `models/gemini-embedding-001` | High-dimensional embedding model |
| `EMBEDDING_DIMENSIONS` | No | `1536` | Vector dimensionality (1536 Cosine) |
| `DATABASE_URL` | **Yes** | `postgresql://...` | Authoritative PostgreSQL connection string |
| `SUPABASE_URL` | **Yes** | `https://xxxx.supabase.co` | User authentication & sessions |
| `SUPABASE_PUBLISHABLE_KEY` | **Yes** | `sb_publishable_...` | Supabase public client key |
| `SUPABASE_SECRET_KEY` | **Yes** | `sb_secret_...` | Supabase service role secret key |
| `ADMIN_EMAIL` | No | `admin@lorely.app` | Dedicated admin login email |
| `ADMIN_PASSWORD` | **Yes** | `...` | Dedicated admin secure password |

---

## Production Guarantees & Features

1. **Strict User & Catalog Isolation**:
   - Private shelf uploads are indexed with `owner_user_id` and `visibility='private'`.
   - Vector queries strictly filter on `owner_user_id` for non-public content.
2. **Spoiler Protection Filter**:
   - Queries contain a range filter: `chapter_order <= max_allowed_chapter`.
   - Chunks beyond the reader's current chapter are never returned in search results.
3. **Hybrid Reciprocal Rank Fusion (RRF)**:
   - Vector ranking from Qdrant combined with token-level lexical score ($k=60$).
   - Cross-lingual literary dictionary expands Amharic character names to English references.
4. **Resilience & Graceful Degradation**:
   - Automatic 3x retries with exponential backoff on transient network errors.
   - If Qdrant Cloud experiences downtime, the system falls back to relational database chunks rather than crashing user conversation turns.
5. **Idempotent Deduplication**:
   - Chunks use deterministic RFC 4122 UUIDv5 point IDs based on `f"{book_id}:{chapter_order}:{chunk_index}"`.
   - Re-deployments and re-indexing do not create duplicate vector points.
