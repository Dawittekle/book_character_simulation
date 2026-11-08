"""add citations column to chat_messages

Revision ID: 20261108_0005
Revises: 20261108_0004
Create Date: 2026-11-08 16:15:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20261108_0005"
down_revision = "20261108_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "chat_messages",
        sa.Column("citations", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("chat_messages", "citations")
