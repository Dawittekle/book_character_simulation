# Agent Operating Guidelines & Standards

These rules govern all engineering work, architectural choices, and feature development on this project.

---

## 1. Core Operating Principles

1. **Commit Often, Never Push**
   - Make clean, focused local Git commits for every milestone or completed subtask using conventional commit messages (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).
   - **Never run `git push`** unless explicitly instructed by the user.

2. **Simple and Short Explanations**
   - Communicate findings, progress, and options in plain, concise terms.
   - Avoid long prose or boilerplate. Get straight to the point.

3. **Deep Research Before Decisions**
   - Never guess or rush an implementation.
   - Inspect existing schemas, endpoints, tests, and configuration before modifying code.
   - Benchmark or study reference platforms (e.g. BookFusion) and document the findings before drafting architectures.

4. **Document Decisions in `docs/worker/decision.md`**
   - Every architectural choice, schema modification, protocol shift, or feature addition must be logged in `docs/worker/decision.md`.
   - Include: Context, Decision, Rationale, and Consequences.

5. **Store Research in `docs/worker/research/`**
   - Maintain deep-dive technical studies, reverse-engineering analyses, and feature comparisons as markdown files inside `docs/worker/research/`.

6. **Production-Level Engineering Quality**
   - **Type Safety & Data Integrity**: Use SQLAlchemy 2.0 ORM models, Alembic migrations, and Pydantic schemas.
   - **Error Handling**: Graceful degradation, structured API error responses, and retries with backoff for transient AI provider errors.
   - **Security**: Strict Row-Level Security (RLS), RBAC enforcement (`user`, `manager`, `admin`), parameterized queries, and strict secret protection (never commit `.env` or keys).
   - **Automated Testing**: Write and run unit/integration tests (`pytest`, `vitest`) for all core workflows before marking tasks complete.

7. **Verification Routine**
   - Backend: run `pytest` and verify `/api/health`.
   - Frontend: run `npm run build` or `npm test`.
   - Database: verify Alembic head migrations and schema compatibility.
