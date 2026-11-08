"""add processing jobs table

Revision ID: 20261108_0003
Revises: 20261108_0002
Create Date: 2026-11-08 16:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20261108_0003"
down_revision = "20261108_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "processing_jobs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("owner_user_id", sa.String(length=36), nullable=False),
        sa.Column("book_id", sa.String(length=36), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("stage", sa.String(length=50), nullable=False, server_default="queued"),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("document_type", sa.String(length=50), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("inferred_title", sa.String(length=255), nullable=True),
        sa.Column("inferred_author", sa.String(length=255), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("job_metadata", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["owner_user_id"],
            ["users.id"],
            name=op.f("fk_processing_jobs_owner_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["book_id"],
            ["books.id"],
            name=op.f("fk_processing_jobs_book_id_books"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_processing_jobs")),
    )
    op.create_index(
        op.f("ix_processing_jobs_owner_user_id"),
        "processing_jobs",
        ["owner_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_processing_jobs_owner_user_id"), table_name="processing_jobs")
    op.drop_table("processing_jobs")
