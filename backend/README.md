# Backend

Install in editable mode with:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Run locally with:

```bash
cd backend
python run.py
```

Run database migrations with:

```bash
cd backend
source .venv/bin/activate
alembic upgrade head
```

The startup output will print:

- API base URL
- health check URL
- whether the configured LLM provider is ready
- whether a relational database URL is configured
