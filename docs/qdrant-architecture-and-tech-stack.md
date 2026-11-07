# Qdrant Architecture And Tech Stack

## Purpose

This document describes the new storage architecture after removing ChromaDB.

The goal is to keep product data and vector data in the right systems:

- PostgreSQL for application state
- Qdrant for semantic retrieval

## Final Storage Split

### PostgreSQL owns

- users
- books
- book sources
- characters
- chat sessions
- chat messages
- factual memories

### Qdrant owns

- embedded chunks of uploaded book text
- semantic similarity lookup for user questions during chat

## Why This Is Better Than Chroma Here

Chroma was being used as a hybrid cache/document database/session store, which made the architecture muddy.

Qdrant is a better vector layer because:

- it is purpose-built for vector search
- payload filtering is strong enough for `owner_scope` and `text_id`
- it cleanly supports the RAG flow this app actually needs
- it scales better as the library of uploaded books grows

## Current Backend Shape

### Inference layer

- OpenAI
- Gemini

### Embedding layer

- OpenAI embeddings with `text-embedding-3-small`
- Gemini embeddings with `gemini-embedding-001`

### Vector retrieval layer

- Qdrant local storage for development through `QDRANT_PATH`
- Qdrant server or cloud through `QDRANT_URL` and `QDRANT_API_KEY`

## Retrieval Flow

1. A book is uploaded and converted to text.
2. The text is chunked with overlap.
3. Each chunk is embedded.
4. Chunks are stored in Qdrant with payload:
   - `record_type`
   - `owner_scope`
   - `text_id`
   - `chunk_index`
   - `char_start`
   - `char_end`
   - `content`
5. During chat, the user message is embedded.
6. Qdrant returns the top matching chunks filtered by:
   - current user
   - current `text_id`
7. Those excerpts are injected into the prompt so the character stays grounded in the book.

## Tech Stack Summary

- Flask
- SQLAlchemy
- Alembic
- Supabase Auth
- Supabase Postgres
- Qdrant
- OpenAI SDK
- Google GenAI SDK
- PyMuPDF

## Current Limitation

This pass focuses on book chunk retrieval only.

We have not yet added:

- background indexing jobs
- reindex commands for existing books
- hybrid search across factual memories
- backend list endpoints for the new frontend workspace
