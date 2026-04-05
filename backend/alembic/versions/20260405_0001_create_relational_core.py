"""create relational core

Revision ID: 20260405_0001
Revises: 
Create Date: 2026-04-05 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260405_0001"
down_revision = None
branch_labels = None
depends_on = None


book_processing_status = sa.Enum(
    "uploaded",
    "extracting",
    "ready",
    "failed",
    name="bookprocessingstatus",
)
chat_role = sa.Enum("user", "assistant", "system", name="chatrole")


def upgrade() -> None:
    book_processing_status.create(op.get_bind(), checkfirst=True)
    chat_role.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("supabase_user_id", sa.String(length=36), nullable=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
        sa.UniqueConstraint("supabase_user_id", name=op.f("uq_users_supabase_user_id")),
    )

    op.create_table(
        "books",
        sa.Column("owner_user_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("author", sa.String(length=255), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("processing_status", book_processing_status, nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["owner_user_id"], ["users.id"], name=op.f("fk_books_owner_user_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_books")),
    )

    op.create_table(
        "book_sources",
        sa.Column("book_id", sa.String(length=36), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=True),
        sa.Column("mime_type", sa.String(length=255), nullable=True),
        sa.Column("storage_bucket", sa.String(length=255), nullable=True),
        sa.Column("storage_path", sa.Text(), nullable=True),
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column("extracted_text_hash", sa.String(length=64), nullable=True),
        sa.Column("file_size_bytes", sa.Integer(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["book_id"], ["books.id"], name=op.f("fk_book_sources_book_id_books")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_book_sources")),
    )
    op.create_index(
        op.f("ix_book_sources_extracted_text_hash"),
        "book_sources",
        ["extracted_text_hash"],
        unique=False,
    )

    op.create_table(
        "characters",
        sa.Column("book_id", sa.String(length=36), nullable=False),
        sa.Column("source_text_id", sa.String(length=64), nullable=True),
        sa.Column("stable_character_key", sa.String(length=64), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("personality", sa.Text(), nullable=False),
        sa.Column("key_events", sa.JSON(), nullable=False),
        sa.Column("relationships", sa.JSON(), nullable=False),
        sa.Column("psi_parameters", sa.JSON(), nullable=False),
        sa.Column("emotion_state", sa.JSON(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["book_id"], ["books.id"], name=op.f("fk_characters_book_id_books")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_characters")),
    )
    op.create_index(op.f("ix_characters_source_text_id"), "characters", ["source_text_id"])
    op.create_index(
        op.f("ix_characters_stable_character_key"),
        "characters",
        ["stable_character_key"],
    )

    op.create_table(
        "chat_sessions",
        sa.Column("owner_user_id", sa.String(length=36), nullable=False),
        sa.Column("book_id", sa.String(length=36), nullable=False),
        sa.Column("character_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("latest_psi_parameters", sa.JSON(), nullable=False),
        sa.Column("latest_emotion_state", sa.JSON(), nullable=False),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["book_id"], ["books.id"], name=op.f("fk_chat_sessions_book_id_books")
        ),
        sa.ForeignKeyConstraint(
            ["character_id"],
            ["characters.id"],
            name=op.f("fk_chat_sessions_character_id_characters"),
        ),
        sa.ForeignKeyConstraint(
            ["owner_user_id"], ["users.id"], name=op.f("fk_chat_sessions_owner_user_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_chat_sessions")),
    )

    op.create_table(
        "chat_messages",
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("role", chat_role, nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sequence_number", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(
            ["session_id"], ["chat_sessions.id"], name=op.f("fk_chat_messages_session_id_chat_sessions")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_chat_messages")),
    )

    op.create_table(
        "character_memories",
        sa.Column("owner_user_id", sa.String(length=36), nullable=False),
        sa.Column("book_id", sa.String(length=36), nullable=False),
        sa.Column("character_id", sa.String(length=36), nullable=False),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("fact", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(
            ["book_id"], ["books.id"], name=op.f("fk_character_memories_book_id_books")
        ),
        sa.ForeignKeyConstraint(
            ["character_id"],
            ["characters.id"],
            name=op.f("fk_character_memories_character_id_characters"),
        ),
        sa.ForeignKeyConstraint(
            ["owner_user_id"],
            ["users.id"],
            name=op.f("fk_character_memories_owner_user_id_users"),
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["chat_sessions.id"],
            name=op.f("fk_character_memories_session_id_chat_sessions"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_character_memories")),
    )


def downgrade() -> None:
    op.drop_table("character_memories")
    op.drop_table("chat_messages")
    op.drop_table("chat_sessions")
    op.drop_index(op.f("ix_characters_stable_character_key"), table_name="characters")
    op.drop_index(op.f("ix_characters_source_text_id"), table_name="characters")
    op.drop_table("characters")
    op.drop_index(op.f("ix_book_sources_extracted_text_hash"), table_name="book_sources")
    op.drop_table("book_sources")
    op.drop_table("books")
    op.drop_table("users")
    chat_role.drop(op.get_bind(), checkfirst=True)
    book_processing_status.drop(op.get_bind(), checkfirst=True)
