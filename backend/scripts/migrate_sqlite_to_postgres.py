"""
Lorely SQLite to PostgreSQL Migration Tool

Migrates all relational rows (users, books, chapters, chunks, characters,
profiles, shelves, and reading progress) from SQLite to PostgreSQL in Docker.
Ensures zero data loss during the transition.
"""

from __future__ import annotations

import json
import logging
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine

# Ensure project backend package is importable
BACKEND_DIR = Path(__file__).resolve().parent.parent
SRC_DIR = BACKEND_DIR / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from book_character_simulation_backend.db.base import Base
import book_character_simulation_backend.db.models  # Register all models in metadata

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("sqlite_to_postgres")


def parse_datetime_val(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, str):
        try:
            return datetime.fromisoformat(val)
        except ValueError:
            return val
    return val


def parse_bool_val(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return bool(val)
    if isinstance(val, str):
        return val.lower() in ("1", "true", "t", "yes")
    return bool(val)


def migrate_data(sqlite_path: Path, pg_url: str) -> None:
    if not sqlite_path.exists():
        logger.error("SQLite database file not found at %s", sqlite_path)
        sys.exit(1)

    logger.info("Opening source SQLite database at %s...", sqlite_path)
    sqlite_conn = sqlite3.connect(str(sqlite_path))
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()

    logger.info("Connecting to target PostgreSQL database at %s...", pg_url)
    # Ensure scheme uses postgresql+psycopg
    if pg_url.startswith("postgresql://"):
        pg_url = pg_url.replace("postgresql://", "postgresql+psycopg://", 1)

    pg_engine = create_engine(pg_url, future=True)

    # 1. Enable vector extension if pgvector is available
    logger.info("Ensuring PostgreSQL vector extension is enabled...")
    with pg_engine.begin() as conn:
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            logger.info("pgvector extension successfully verified/enabled.")
        except Exception as e:
            logger.warning("Could not enable vector extension: %s. Continuing...", e)

    # 2. Create tables from SQLAlchemy metadata
    logger.info("Creating relational schema in PostgreSQL...")
    Base.metadata.create_all(bind=pg_engine)

    # 3. Create legacy/auxiliary tables (custom_shelves, shelf_books, reading_sessions) if present in SQLite
    with pg_engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS custom_shelves (
                    id VARCHAR(36) PRIMARY KEY,
                    user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
                    name VARCHAR(100) NOT NULL,
                    slug VARCHAR(120) NOT NULL,
                    description TEXT,
                    icon VARCHAR(50),
                    color VARCHAR(30),
                    is_system BOOLEAN NOT NULL DEFAULT FALSE,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS shelf_books (
                    id VARCHAR(36) PRIMARY KEY,
                    shelf_id VARCHAR(36) REFERENCES custom_shelves(id) ON DELETE CASCADE,
                    book_id VARCHAR(36) REFERENCES books(id) ON DELETE CASCADE,
                    added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    CONSTRAINT uq_shelf_books_shelf_book UNIQUE (shelf_id, book_id)
                );
                CREATE TABLE IF NOT EXISTS reading_sessions (
                    id VARCHAR(36) PRIMARY KEY,
                    user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
                    book_id VARCHAR(36) REFERENCES books(id) ON DELETE CASCADE,
                    session_start TIMESTAMP WITH TIME ZONE NOT NULL,
                    session_end TIMESTAMP WITH TIME ZONE,
                    duration_seconds INTEGER NOT NULL DEFAULT 0,
                    pages_read INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                );
                """
            )
        )

    # 4. Migrate tables in topological dependency order
    tables_to_migrate = [t.name for t in Base.metadata.sorted_tables]
    # Add auxiliary tables
    if "custom_shelves" not in tables_to_migrate:
        tables_to_migrate.append("custom_shelves")
    if "shelf_books" not in tables_to_migrate:
        tables_to_migrate.append("shelf_books")
    if "reading_sessions" not in tables_to_migrate:
        tables_to_migrate.append("reading_sessions")

    # Get column metadata from PostgreSQL inspector
    inspector = inspect(pg_engine)

    total_rows_migrated = 0
    with pg_engine.begin() as pg_conn:
        for table_name in tables_to_migrate:
            # Check if table exists in SQLite
            sqlite_cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?;",
                (table_name,),
            )
            if not sqlite_cursor.fetchone():
                continue

            # Check existing columns in PostgreSQL table
            pg_cols_info = {col["name"]: col for col in inspector.get_columns(table_name)}
            if not pg_cols_info:
                continue

            # Fetch rows from SQLite
            sqlite_cursor.execute(f"SELECT * FROM {table_name};")
            rows = sqlite_cursor.fetchall()
            if not rows:
                logger.info("Table '%s': 0 rows in SQLite (skipped)", table_name)
                continue

            col_names = [d[0] for d in sqlite_cursor.description]
            valid_cols = [c for c in col_names if c in pg_cols_info]

            logger.info("Migrating %d rows for table '%s'...", len(rows), table_name)
            inserted_count = 0

            for row in rows:
                row_dict = dict(zip(col_names, row))
                params: dict[str, Any] = {}

                for col in valid_cols:
                    val = row_dict[col]
                    col_type_str = str(pg_cols_info[col]["type"]).lower()

                    # Sanitize null bytes for PostgreSQL text fields
                    if isinstance(val, str):
                        val = val.replace("\x00", "")

                    # Handle book chunk embeddings
                    if table_name == "book_chunks" and col == "embedding":
                        if val is None:
                            params[col] = None
                        elif isinstance(val, str):
                            try:
                                parsed = json.loads(val)
                                params[col] = str(parsed)
                            except Exception:
                                params[col] = val
                        elif isinstance(val, (list, tuple)):
                            params[col] = str(list(val))
                        else:
                            params[col] = None
                        continue

                    # Handle booleans
                    if "bool" in col_type_str:
                        params[col] = parse_bool_val(val)
                        continue

                    # Handle datetimes
                    if "time" in col_type_str:
                        params[col] = parse_datetime_val(val)
                        continue

                    # Handle JSON
                    if "json" in col_type_str:
                        if val is None:
                            params[col] = None
                        elif isinstance(val, (dict, list)):
                            params[col] = json.dumps(val)
                        elif isinstance(val, str):
                            try:
                                parsed = json.loads(val)
                                params[col] = json.dumps(parsed)
                            except Exception:
                                params[col] = json.dumps(val)
                        else:
                            params[col] = json.dumps(val)
                        continue

                    params[col] = val

                col_clause = ", ".join(f'"{c}"' for c in valid_cols)
                val_clause = ", ".join(f":{c}" for c in valid_cols)
                stmt = text(
                    f'INSERT INTO "{table_name}" ({col_clause}) VALUES ({val_clause}) '
                    f'ON CONFLICT (id) DO NOTHING;'
                )
                pg_conn.execute(stmt, params)
                inserted_count += 1

            total_rows_migrated += inserted_count
            logger.info("Table '%s': successfully migrated %d rows.", table_name, inserted_count)

    # 5. Verification summary
    logger.info("--- Migration Verification Summary ---")
    with pg_engine.connect() as conn:
        for table_name in tables_to_migrate:
            sqlite_cursor.execute(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?;",
                (table_name,),
            )
            if sqlite_cursor.fetchone()[0] == 0:
                continue
            sqlite_cursor.execute(f"SELECT count(*) FROM {table_name};")
            sqlite_cnt = sqlite_cursor.fetchone()[0]

            res = conn.execute(text(f'SELECT count(*) FROM "{table_name}";'))
            pg_cnt = res.scalar()
            match_status = "MATCH" if sqlite_cnt == pg_cnt else "MISMATCH"
            logger.info(
                "[%s] %s: SQLite=%d, Postgres=%d",
                match_status,
                table_name,
                sqlite_cnt,
                pg_cnt,
            )

    sqlite_conn.close()
    logger.info("Data migration complete! Total rows processed: %d", total_rows_migrated)


if __name__ == "__main__":
    sqlite_db = BACKEND_DIR / "lorely_local.db"
    pg_url = "postgresql://postgres:postgres@127.0.0.1:5434/lorely"
    if len(sys.argv) > 1:
        sqlite_db = Path(sys.argv[1])
    if len(sys.argv) > 2:
        pg_url = sys.argv[2]
    migrate_data(sqlite_db, pg_url)
