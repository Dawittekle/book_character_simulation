"""add avatar assets, user library books, and catalogue provenance

Revision ID: 20261109_0010
Revises: 20261109_0009
Create Date: 2026-11-09 17:00:00
"""

from alembic import op
import sqlalchemy as sa

revision = "20261109_0010"
down_revision = "20261109_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = insp.get_table_names()

    # 1. user_settings: voice_save_audio_recordings
    user_settings_cols = [c["name"] for c in insp.get_columns("user_settings")]
    with op.batch_alter_table("user_settings") as batch_op:
        if "voice_save_audio_recordings" not in user_settings_cols:
            batch_op.add_column(
                sa.Column("voice_save_audio_recordings", sa.Boolean(), server_default="false", nullable=False)
            )

    # 2. books: edition_notes, rights_basis, file_provenance, cover_art_licence
    book_cols = [c["name"] for c in insp.get_columns("books")]
    with op.batch_alter_table("books") as batch_op:
        if "edition_notes" not in book_cols:
            batch_op.add_column(sa.Column("edition_notes", sa.Text(), nullable=True))
        if "rights_basis" not in book_cols:
            batch_op.add_column(sa.Column("rights_basis", sa.String(length=100), server_default="Public Domain (US / Life+70)", nullable=True))
        if "file_provenance" not in book_cols:
            batch_op.add_column(sa.Column("file_provenance", sa.String(length=255), nullable=True))
        if "cover_art_licence" not in book_cols:
            batch_op.add_column(sa.Column("cover_art_licence", sa.String(length=100), server_default="Public Domain / CC0", nullable=True))

    # 3. avatar_assets
    if "avatar_assets" not in existing_tables:
        op.create_table(
            "avatar_assets",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("asset_id", sa.String(length=64), unique=True, nullable=False, index=True),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("storage_key", sa.String(length=255), nullable=True),
            sa.Column("image_url", sa.Text(), nullable=False),
            sa.Column("art_style", sa.String(length=50), server_default="illustrated", nullable=False),
            sa.Column("gender", sa.String(length=20), server_default="neutral", nullable=False),
            sa.Column("apparent_age", sa.String(length=50), server_default="adult", nullable=False),
            sa.Column("period_era", sa.String(length=50), server_default="19th_century", nullable=False),
            sa.Column("tags", sa.JSON(), nullable=False),
            sa.Column("source_type", sa.String(length=50), server_default="synthetic_approved", nullable=False),
            sa.Column("licence", sa.String(length=100), server_default="Public Domain / CC0", nullable=False),
            sa.Column("is_approved", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("is_fallback", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    # 4. user_library_books
    if "user_library_books" not in existing_tables:
        op.create_table(
            "user_library_books",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("book_id", sa.String(length=36), sa.ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("reading_progress_chapter", sa.Integer(), server_default="1", nullable=False),
            sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = insp.get_table_names()

    if "user_library_books" in existing_tables:
        op.drop_table("user_library_books")
    if "avatar_assets" in existing_tables:
        op.drop_table("avatar_assets")

    book_cols = [c["name"] for c in insp.get_columns("books")]
    with op.batch_alter_table("books") as batch_op:
        for c in ["cover_art_licence", "file_provenance", "rights_basis", "edition_notes"]:
            if c in book_cols:
                batch_op.drop_column(c)

    user_settings_cols = [c["name"] for c in insp.get_columns("user_settings")]
    with op.batch_alter_table("user_settings") as batch_op:
        if "voice_save_audio_recordings" in user_settings_cols:
            batch_op.drop_column("voice_save_audio_recordings")
