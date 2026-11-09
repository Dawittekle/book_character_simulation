"""add character profile evidence, state events, reading progress and memory provenance

Revision ID: 20261109_0007
Revises: 20261109_0006
Create Date: 2026-11-09 16:00:00
"""

import uuid
from datetime import datetime, timezone
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column

revision = "20261109_0007"
down_revision = "20261109_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create character_profile_evidence table
    op.create_table(
        "character_profile_evidence",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("character_id", sa.String(length=36), nullable=False),
        sa.Column("book_id", sa.String(length=36), nullable=False),
        sa.Column("fact_text", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=50), server_default="trait", nullable=False),
        sa.Column("chapter_order", sa.Integer(), server_default="1", nullable=False),
        sa.Column("chunk_id", sa.String(length=36), nullable=True),
        sa.Column("confidence", sa.Float(), server_default="1.0", nullable=False),
        sa.Column("provenance", sa.String(length=100), server_default="canonical", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["character_id"],
            ["characters.id"],
            name=op.f("fk_character_profile_evidence_character_id_characters"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["book_id"],
            ["books.id"],
            name=op.f("fk_character_profile_evidence_book_id_books"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["chunk_id"],
            ["book_chunks.id"],
            name=op.f("fk_character_profile_evidence_chunk_id_book_chunks"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_character_profile_evidence")),
    )
    op.create_index(
        op.f("ix_character_profile_evidence_character_id"),
        "character_profile_evidence",
        ["character_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_character_profile_evidence_book_id"),
        "character_profile_evidence",
        ["book_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_character_profile_evidence_chapter_order"),
        "character_profile_evidence",
        ["chapter_order"],
        unique=False,
    )

    # 2. Create character_state_events table
    op.create_table(
        "character_state_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("character_id", sa.String(length=36), nullable=False),
        sa.Column("session_id", sa.String(length=36), nullable=True),
        sa.Column("state_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("trigger_modality", sa.String(length=20), server_default="text", nullable=False),
        sa.Column("trigger_text", sa.Text(), nullable=True),
        sa.Column("perceived_observation", sa.JSON(), nullable=True),
        sa.Column("previous_psi", sa.JSON(), nullable=False),
        sa.Column("resulting_psi", sa.JSON(), nullable=False),
        sa.Column("previous_emotion", sa.JSON(), nullable=False),
        sa.Column("resulting_emotion", sa.JSON(), nullable=False),
        sa.Column("transition_rules_version", sa.String(length=20), server_default="v1.0", nullable=False),
        sa.Column("model_provenance", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_character_state_events_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["character_id"],
            ["characters.id"],
            name=op.f("fk_character_state_events_character_id_characters"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["chat_sessions.id"],
            name=op.f("fk_character_state_events_session_id_chat_sessions"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_character_state_events")),
    )
    op.create_index(
        op.f("ix_character_state_events_user_id"),
        "character_state_events",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_character_state_events_character_id"),
        "character_state_events",
        ["character_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_character_state_events_session_id"),
        "character_state_events",
        ["session_id"],
        unique=False,
    )

    # 3. Add reading_progress_chapter to chat_sessions
    with op.batch_alter_table("chat_sessions") as batch_op:
        batch_op.add_column(
            sa.Column("reading_progress_chapter", sa.Integer(), server_default="1", nullable=False)
        )

    # 4. Add spoiler_chapter, provenance, and confidence to character_memories
    with op.batch_alter_table("character_memories") as batch_op:
        batch_op.add_column(
            sa.Column("spoiler_chapter", sa.Integer(), nullable=True)
        )
        batch_op.add_column(
            sa.Column("provenance", sa.String(length=50), server_default="chat", nullable=False)
        )
        batch_op.add_column(
            sa.Column("confidence", sa.Float(), server_default="1.0", nullable=False)
        )


def downgrade() -> None:
    with op.batch_alter_table("character_memories") as batch_op:
        batch_op.drop_column("confidence")
        batch_op.drop_column("provenance")
        batch_op.drop_column("spoiler_chapter")

    with op.batch_alter_table("chat_sessions") as batch_op:
        batch_op.drop_column("reading_progress_chapter")

    op.drop_table("character_state_events")
    op.drop_table("character_profile_evidence")
