"""add book chunks table for rag

Revision ID: 20261108_0004
Revises: 20261108_0003
Create Date: 2026-11-08 16:10:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20261108_0004"
down_revision = "20261108_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "book_chunks",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("book_id", sa.String(length=36), nullable=False),
        sa.Column("chapter_order", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("chapter_title", sa.String(length=255), nullable=True),
        sa.Column("chunk_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["book_id"],
            ["books.id"],
            name=op.f("fk_book_chunks_book_id_books"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_book_chunks")),
    )
    op.create_index(
        op.f("ix_book_chunks_book_id"),
        "book_chunks",
        ["book_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_book_chunks_chapter_order"),
        "book_chunks",
        ["chapter_order"],
        unique=False,
    )
    op.create_index(
        "ix_book_chunks_book_id_chapter_order",
        "book_chunks",
        ["book_id", "chapter_order"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_book_chunks_book_id_chapter_order", table_name="book_chunks")
    op.drop_index(op.f("ix_book_chunks_chapter_order"), table_name="book_chunks")
    op.drop_index(op.f("ix_book_chunks_book_id"), table_name="book_chunks")
    op.drop_table("book_chunks")
