"""lorely persistence v2

Revision ID: 20261108_0002
Revises: 20260405_0001
Create Date: 2026-11-08 15:30:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20261108_0002"
down_revision = "20260405_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Update books table
    op.add_column(
        "books",
        sa.Column("visibility", sa.String(length=50), nullable=False, server_default="private"),
    )
    op.add_column(
        "books",
        sa.Column("source_type", sa.String(length=50), nullable=False, server_default="book"),
    )
    op.add_column(
        "books",
        sa.Column("cover_url", sa.Text(), nullable=True),
    )

    # 2. Update characters table
    op.add_column(
        "characters",
        sa.Column("role", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "characters",
        sa.Column("appearance_description", sa.Text(), nullable=True),
    )
    op.add_column(
        "characters",
        sa.Column("avatar_asset_id", sa.String(length=100), nullable=True),
    )

    # 3. Update chat_sessions table
    op.add_column(
        "chat_sessions",
        sa.Column("spoiler_policy", sa.String(length=50), nullable=False, server_default="cautious"),
    )

    # 4. Update chat_messages table
    op.add_column(
        "chat_messages",
        sa.Column("input_modality", sa.String(length=20), nullable=False, server_default="text"),
    )

    # 5. Create user_roles table
    op.create_table(
        "user_roles",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="user"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_user_roles_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user_roles")),
        sa.UniqueConstraint("user_id", name=op.f("uq_user_roles_user_id")),
    )

    # 6. Create user_settings table
    op.create_table(
        "user_settings",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("reading_theme", sa.String(length=50), nullable=False, server_default="parchment"),
        sa.Column("spoiler_policy", sa.String(length=50), nullable=False, server_default="cautious"),
        sa.Column("enter_to_send", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("preferences", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_user_settings_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user_settings")),
        sa.UniqueConstraint("user_id", name=op.f("uq_user_settings_user_id")),
    )

    # 7. Create user_character_states table
    op.create_table(
        "user_character_states",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("character_id", sa.String(length=36), nullable=False),
        sa.Column("psi_parameters", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("emotion_state", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_user_character_states_user_id_users"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["character_id"],
            ["characters.id"],
            name=op.f("fk_user_character_states_character_id_characters"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user_character_states")),
        sa.UniqueConstraint(
            "user_id", "character_id", name="uq_user_character_states_user_character"
        ),
    )


def downgrade() -> None:
    op.drop_table("user_character_states")
    op.drop_table("user_settings")
    op.drop_table("user_roles")
    op.drop_column("chat_messages", "input_modality")
    op.drop_column("chat_sessions", "spoiler_policy")
    op.drop_column("characters", "avatar_asset_id")
    op.drop_column("characters", "appearance_description")
    op.drop_column("characters", "role")
    op.drop_column("books", "cover_url")
    op.drop_column("books", "source_type")
    op.drop_column("books", "visibility")
