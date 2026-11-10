"""add reading progress, bookmarks, annotations, and narration segments

Revision ID: 20261109_0011
Revises: 20261109_0010
Create Date: 2026-11-09 19:25:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20261109_0011"
down_revision = "20261109_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = insp.get_table_names()

    # 1. reading_progress
    if "reading_progress" not in existing_tables:
        op.create_table(
            "reading_progress",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("book_id", sa.String(length=36), sa.ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("current_chapter_index", sa.Integer(), server_default="0", nullable=False),
            sa.Column("progress_percent", sa.Float(), server_default="0.0", nullable=False),
            sa.Column("locator_type", sa.String(length=50), server_default="epub_cfi", nullable=False),
            sa.Column("locator_payload", sa.JSON(), nullable=False),
            sa.Column("last_read_mode", sa.String(length=30), server_default="read", nullable=False),
            sa.Column("reading_time_seconds", sa.Integer(), server_default="0", nullable=False),
            sa.Column("completed", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("user_id", "book_id", name="uq_reading_progress_user_book"),
        )

    # 2. book_bookmarks
    if "book_bookmarks" not in existing_tables:
        op.create_table(
            "book_bookmarks",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("book_id", sa.String(length=36), sa.ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("chapter_index", sa.Integer(), server_default="0", nullable=False),
            sa.Column("chapter_title", sa.String(length=255), nullable=True),
            sa.Column("progress_percent", sa.Float(), server_default="0.0", nullable=False),
            sa.Column("locator_type", sa.String(length=50), server_default="epub_cfi", nullable=False),
            sa.Column("locator_payload", sa.JSON(), nullable=False),
            sa.Column("snippet", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )

    # 3. book_annotations
    if "book_annotations" not in existing_tables:
        op.create_table(
            "book_annotations",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("book_id", sa.String(length=36), sa.ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("chapter_index", sa.Integer(), server_default="0", nullable=False),
            sa.Column("selected_text", sa.Text(), nullable=False),
            sa.Column("color", sa.String(length=30), server_default="amber", nullable=False),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("locator_type", sa.String(length=50), server_default="epub_cfi", nullable=False),
            sa.Column("locator_payload", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )

    # 4. book_narration_segments
    if "book_narration_segments" not in existing_tables:
        op.create_table(
            "book_narration_segments",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("book_id", sa.String(length=36), sa.ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("chapter_index", sa.Integer(), nullable=False, index=True),
            sa.Column("voice_id", sa.String(length=100), nullable=False),
            sa.Column("audio_storage_path", sa.String(length=500), nullable=False),
            sa.Column("duration_ms", sa.Integer(), server_default="0", nullable=False),
            sa.Column("alignment_data", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("book_id", "chapter_index", "voice_id", name="uq_narration_book_chapter_voice"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = insp.get_table_names()

    if "book_narration_segments" in existing_tables:
        op.drop_table("book_narration_segments")
    if "book_annotations" in existing_tables:
        op.drop_table("book_annotations")
    if "book_bookmarks" in existing_tables:
        op.drop_table("book_bookmarks")
    if "reading_progress" in existing_tables:
        op.drop_table("reading_progress")
