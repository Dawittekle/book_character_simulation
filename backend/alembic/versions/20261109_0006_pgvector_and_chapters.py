"""add book chapters and pgvector embeddings to book_chunks

Revision ID: 20261109_0006
Revises: 20261108_0005
Create Date: 2026-11-09 15:30:00
"""

import hashlib
import uuid
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column

revision = "20261109_0006"
down_revision = "20261108_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    if is_postgres:
        op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # 1. Create book_chapters table
    op.create_table(
        "book_chapters",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("book_id", sa.String(length=36), nullable=False),
        sa.Column("chapter_order", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("start_char", sa.Integer(), nullable=True),
        sa.Column("end_char", sa.Integer(), nullable=True),
        sa.Column("word_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["book_id"],
            ["books.id"],
            name=op.f("fk_book_chapters_book_id_books"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_book_chapters")),
        sa.UniqueConstraint("book_id", "chapter_order", name="uq_book_chapters_book_id_order"),
    )
    op.create_index(
        op.f("ix_book_chapters_book_id"),
        "book_chapters",
        ["book_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_book_chapters_chapter_order"),
        "book_chapters",
        ["chapter_order"],
        unique=False,
    )

    # 2. Add new columns to book_chunks
    op.add_column(
        "book_chunks",
        sa.Column(
            "embedding_provider",
            sa.String(length=50),
            server_default="deterministic",
            nullable=False,
        ),
    )
    op.add_column(
        "book_chunks",
        sa.Column(
            "embedding_model",
            sa.String(length=100),
            server_default="deterministic-128",
            nullable=False,
        ),
    )
    op.add_column(
        "book_chunks",
        sa.Column(
            "embedding_dimensions",
            sa.Integer(),
            server_default="128",
            nullable=False,
        ),
    )
    op.add_column(
        "book_chunks",
        sa.Column("content_hash", sa.String(length=64), nullable=True),
    )
    op.create_index(
        op.f("ix_book_chunks_content_hash"),
        "book_chunks",
        ["content_hash"],
        unique=False,
    )

    # 3. For postgresql, alter embedding column to vector
    if is_postgres:
        op.execute(
            "ALTER TABLE book_chunks ALTER COLUMN embedding TYPE vector USING (embedding::text::vector);"
        )

    # 4. Backfill content_hash and initial chapters
    # Fetch existing chunks to backfill
    chunks_tbl = table(
        "book_chunks",
        column("id", sa.String),
        column("book_id", sa.String),
        column("chapter_order", sa.Integer),
        column("chapter_title", sa.String),
        column("content", sa.Text),
        column("content_hash", sa.String),
        column("created_at", sa.DateTime),
    )
    chapters_tbl = table(
        "book_chapters",
        column("id", sa.String),
        column("book_id", sa.String),
        column("chapter_order", sa.Integer),
        column("title", sa.String),
        column("word_count", sa.Integer),
        column("created_at", sa.DateTime),
    )

    connection = bind
    existing_chunks = connection.execute(
        sa.select(
            chunks_tbl.c.id,
            chunks_tbl.c.book_id,
            chunks_tbl.c.chapter_order,
            chunks_tbl.c.chapter_title,
            chunks_tbl.c.content,
            chunks_tbl.c.created_at,
        )
    ).fetchall()

    seen_chapters = set()
    for chunk in existing_chunks:
        c_hash = hashlib.sha256(chunk.content.encode("utf-8")).hexdigest()
        connection.execute(
            chunks_tbl.update()
            .where(chunks_tbl.c.id == chunk.id)
            .values(content_hash=c_hash)
        )
        ch_key = (chunk.book_id, chunk.chapter_order)
        if ch_key not in seen_chapters:
            seen_chapters.add(ch_key)
            title = chunk.chapter_title or f"Chapter {chunk.chapter_order}"
            words = len(chunk.content.split())
            connection.execute(
                chapters_tbl.insert().values(
                    id=str(uuid.uuid4()),
                    book_id=chunk.book_id,
                    chapter_order=chunk.chapter_order,
                    title=title,
                    word_count=words,
                    created_at=chunk.created_at,
                )
            )


def downgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    if is_postgres:
        op.execute(
            "ALTER TABLE book_chunks ALTER COLUMN embedding TYPE json USING (embedding::text::json);"
        )

    op.drop_index(op.f("ix_book_chunks_content_hash"), table_name="book_chunks")
    op.drop_column("book_chunks", "content_hash")
    op.drop_column("book_chunks", "embedding_dimensions")
    op.drop_column("book_chunks", "embedding_model")
    op.drop_column("book_chunks", "embedding_provider")

    op.drop_index(op.f("ix_book_chapters_chapter_order"), table_name="book_chapters")
    op.drop_index(op.f("ix_book_chapters_book_id"), table_name="book_chapters")
    op.drop_table("book_chapters")
