"""enable row level security on public tables

Revision ID: 20261110_0013
Revises: 20261109_0012
Create Date: 2026-11-10 16:30:00

Supabase exposes the public schema through PostgREST. All application data is
accessed by the Flask backend through its PostgreSQL connection, so the public
tables should deny direct anon/authenticated access by default. The table owner
(the backend database user) and the service role continue to bypass RLS.
"""

from alembic import op
import sqlalchemy as sa


revision = "20261110_0013"
down_revision = "20261109_0012"
branch_labels = None
depends_on = None


def _public_tables(bind) -> list[str]:
    rows = bind.execute(
        sa.text(
            """
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename <> 'alembic_version'
            ORDER BY tablename
            """
        )
    ).scalars()
    return list(rows)


def _quote(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def upgrade() -> None:
    bind = op.get_bind()
    for table in _public_tables(bind):
        op.execute(
            sa.text(
                f"ALTER TABLE public.{_quote(table)} ENABLE ROW LEVEL SECURITY"
            )
        )


def downgrade() -> None:
    bind = op.get_bind()
    for table in _public_tables(bind):
        op.execute(
            sa.text(
                f"ALTER TABLE public.{_quote(table)} DISABLE ROW LEVEL SECURITY"
            )
        )
