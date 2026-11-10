"""add user profiles table and expand user settings

Revision ID: 20261109_0012
Revises: 20261109_0011
Create Date: 2026-11-09 21:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20261109_0012"
down_revision = "20261109_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = insp.get_table_names()

    # 1. profiles table
    if "profiles" not in existing_tables:
        op.create_table(
            "profiles",
            sa.Column(
                "id",
                sa.String(length=36),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                primary_key=True,
            ),
            sa.Column("full_name", sa.String(length=255), nullable=True),
            sa.Column("display_name", sa.String(length=255), nullable=True),
            sa.Column("avatar_path", sa.String(length=512), nullable=True),
            sa.Column("preferred_language", sa.String(length=10), server_default="en", nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_profiles_display_name", "profiles", ["display_name"])

    # 2. expand user_settings columns
    if "user_settings" in existing_tables:
        user_settings_cols = [c["name"] for c in insp.get_columns("user_settings")]
        with op.batch_alter_table("user_settings") as batch_op:
            if "app_theme" not in user_settings_cols:
                batch_op.add_column(
                    sa.Column("app_theme", sa.String(length=20), server_default="system", nullable=False)
                )
            if "accent_color" not in user_settings_cols:
                batch_op.add_column(
                    sa.Column("accent_color", sa.String(length=20), server_default="coral", nullable=False)
                )
            if "reduced_motion" not in user_settings_cols:
                batch_op.add_column(
                    sa.Column("reduced_motion", sa.Boolean(), server_default="false", nullable=False)
                )
            if "high_contrast" not in user_settings_cols:
                batch_op.add_column(
                    sa.Column("high_contrast", sa.Boolean(), server_default="false", nullable=False)
                )
            if "notification_preferences" not in user_settings_cols:
                batch_op.add_column(
                    sa.Column("notification_preferences", sa.JSON(), server_default="{}", nullable=False)
                )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = insp.get_table_names()

    if "profiles" in existing_tables:
        op.drop_index("ix_profiles_display_name", table_name="profiles")
        op.drop_table("profiles")

    if "user_settings" in existing_tables:
        user_settings_cols = [c["name"] for c in insp.get_columns("user_settings")]
        with op.batch_alter_table("user_settings") as batch_op:
            for col in [
                "notification_preferences",
                "high_contrast",
                "reduced_motion",
                "accent_color",
                "app_theme",
            ]:
                if col in user_settings_cols:
                    batch_op.drop_column(col)
