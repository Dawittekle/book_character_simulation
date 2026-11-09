"""add voice catalog, voice preferences, and voice interaction tracking

Revision ID: 20261109_0009
Revises: 20261109_0008
Create Date: 2026-11-09 16:38:00
"""

from alembic import op
import sqlalchemy as sa

revision = "20261109_0009"
down_revision = "20261109_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = insp.get_table_names()

    # 1. user_settings
    user_settings_cols = [c["name"] for c in insp.get_columns("user_settings")]
    with op.batch_alter_table("user_settings") as batch_op:
        if "voice_vad_silence_ms" not in user_settings_cols:
            batch_op.add_column(
                sa.Column("voice_vad_silence_ms", sa.Integer(), server_default="1200", nullable=False)
            )
        if "voice_auto_play" not in user_settings_cols:
            batch_op.add_column(
                sa.Column("voice_auto_play", sa.Boolean(), server_default="true", nullable=False)
            )

    # 2. characters
    char_cols = [c["name"] for c in insp.get_columns("characters")]
    with op.batch_alter_table("characters") as batch_op:
        if "assigned_voice_id" not in char_cols:
            batch_op.add_column(
                sa.Column("assigned_voice_id", sa.String(length=100), nullable=True)
            )
        if "voice_matching_confidence" not in char_cols:
            batch_op.add_column(
                sa.Column("voice_matching_confidence", sa.String(length=50), nullable=True)
            )

    # 3. chat_sessions
    session_cols = [c["name"] for c in insp.get_columns("chat_sessions")]
    with op.batch_alter_table("chat_sessions") as batch_op:
        if "session_voice_override" not in session_cols:
            batch_op.add_column(
                sa.Column("session_voice_override", sa.String(length=100), nullable=True)
            )
        if "is_speaking" not in session_cols:
            batch_op.add_column(
                sa.Column("is_speaking", sa.Boolean(), server_default="false", nullable=False)
            )
        if "active_playback_generation_id" not in session_cols:
            batch_op.add_column(
                sa.Column("active_playback_generation_id", sa.String(length=64), nullable=True)
            )

    # 4. chat_messages
    msg_cols = [c["name"] for c in insp.get_columns("chat_messages")]
    with op.batch_alter_table("chat_messages") as batch_op:
        if "is_interrupted" not in msg_cols:
            batch_op.add_column(
                sa.Column("is_interrupted", sa.Boolean(), server_default="false", nullable=False)
            )
        if "audio_storage_path" not in msg_cols:
            batch_op.add_column(
                sa.Column("audio_storage_path", sa.String(length=255), nullable=True)
            )

    # 5. voice_catalog table
    if "voice_catalog" not in existing_tables:
        op.create_table(
            "voice_catalog",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("voice_id", sa.String(length=100), nullable=False, unique=True),
            sa.Column("provider", sa.String(length=50), server_default="openai", nullable=False),
            sa.Column("name", sa.String(length=150), nullable=False),
            sa.Column("gender", sa.String(length=30), server_default="neutral", nullable=False),
            sa.Column("age_bracket", sa.String(length=30), server_default="adult", nullable=False),
            sa.Column("pitch", sa.String(length=30), server_default="mid", nullable=False),
            sa.Column("speaking_style", sa.String(length=50), server_default="warm", nullable=False),
            sa.Column("accent", sa.String(length=50), server_default="neutral", nullable=False),
            sa.Column("language_codes", sa.JSON(), nullable=False),
            sa.Column("sample_text", sa.Text(), nullable=True),
            sa.Column("preview_audio_url", sa.Text(), nullable=True),
            sa.Column("is_approved", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_voice_catalog_voice_id", "voice_catalog", ["voice_id"])

    # 6. voice_usage_logs table
    if "voice_usage_logs" not in existing_tables:
        op.create_table(
            "voice_usage_logs",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("session_id", sa.String(length=36), sa.ForeignKey("chat_sessions.id", ondelete="SET NULL"), nullable=True),
            sa.Column("character_id", sa.String(length=36), sa.ForeignKey("characters.id", ondelete="SET NULL"), nullable=True),
            sa.Column("modality", sa.String(length=20), server_default="voice_turn", nullable=False),
            sa.Column("stt_provider", sa.String(length=50), nullable=True),
            sa.Column("stt_audio_seconds", sa.Float(), server_default="0.0", nullable=False),
            sa.Column("tts_provider", sa.String(length=50), nullable=True),
            sa.Column("tts_character_count", sa.Integer(), server_default="0", nullable=False),
            sa.Column("voice_id", sa.String(length=100), nullable=True),
            sa.Column("cost_usd", sa.Float(), server_default="0.0", nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_voice_usage_logs_user_id", "voice_usage_logs", ["user_id"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = insp.get_table_names()

    if "voice_usage_logs" in existing_tables:
        op.drop_index("ix_voice_usage_logs_user_id", table_name="voice_usage_logs")
        op.drop_table("voice_usage_logs")

    if "voice_catalog" in existing_tables:
        op.drop_index("ix_voice_catalog_voice_id", table_name="voice_catalog")
        op.drop_table("voice_catalog")

    with op.batch_alter_table("chat_messages") as batch_op:
        batch_op.drop_column("audio_storage_path")
        batch_op.drop_column("is_interrupted")

    with op.batch_alter_table("chat_sessions") as batch_op:
        batch_op.drop_column("active_playback_generation_id")
        batch_op.drop_column("is_speaking")
        batch_op.drop_column("session_voice_override")

    with op.batch_alter_table("characters") as batch_op:
        batch_op.drop_column("voice_matching_confidence")
        batch_op.drop_column("assigned_voice_id")

    with op.batch_alter_table("user_settings") as batch_op:
        batch_op.drop_column("voice_auto_play")
        batch_op.drop_column("voice_vad_silence_ms")
