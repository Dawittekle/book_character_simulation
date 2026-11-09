"""add bilingual foundation language metadata to settings, books, chapters, chunks, sessions, and messages

Revision ID: 20261109_0008
Revises: 20261109_0007
Create Date: 2026-11-09 16:30:00
"""

from alembic import op
import sqlalchemy as sa

revision = "20261109_0008"
down_revision = "20261109_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. user_settings
    with op.batch_alter_table("user_settings") as batch_op:
        batch_op.add_column(
            sa.Column("preferred_ui_language", sa.String(length=10), server_default="en", nullable=False)
        )
        batch_op.add_column(
            sa.Column("preferred_conversation_language", sa.String(length=10), server_default="en", nullable=False)
        )

    # 2. books
    with op.batch_alter_table("books") as batch_op:
        batch_op.add_column(
            sa.Column("original_language", sa.String(length=10), server_default="en", nullable=False)
        )
        batch_op.add_column(
            sa.Column("detected_language", sa.String(length=10), nullable=True)
        )

    # 3. book_chapters
    with op.batch_alter_table("book_chapters") as batch_op:
        batch_op.add_column(
            sa.Column("language_code", sa.String(length=10), server_default="en", nullable=False)
        )

    # 4. book_chunks
    with op.batch_alter_table("book_chunks") as batch_op:
        batch_op.add_column(
            sa.Column("language_code", sa.String(length=10), server_default="en", nullable=False)
        )

    # 5. chat_sessions
    with op.batch_alter_table("chat_sessions") as batch_op:
        batch_op.add_column(
            sa.Column("conversation_language", sa.String(length=10), server_default="en", nullable=False)
        )

    # 6. chat_messages
    with op.batch_alter_table("chat_messages") as batch_op:
        batch_op.add_column(
            sa.Column("language_code", sa.String(length=10), server_default="en", nullable=False)
        )


def downgrade() -> None:
    with op.batch_alter_table("chat_messages") as batch_op:
        batch_op.drop_column("language_code")

    with op.batch_alter_table("chat_sessions") as batch_op:
        batch_op.drop_column("conversation_language")

    with op.batch_alter_table("book_chunks") as batch_op:
        batch_op.drop_column("language_code")

    with op.batch_alter_table("book_chapters") as batch_op:
        batch_op.drop_column("language_code")

    with op.batch_alter_table("books") as batch_op:
        batch_op.drop_column("detected_language")
        batch_op.drop_column("original_language")

    with op.batch_alter_table("user_settings") as batch_op:
        batch_op.drop_column("preferred_conversation_language")
        batch_op.drop_column("preferred_ui_language")
