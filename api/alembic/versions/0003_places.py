"""places cache and osm source

Revision ID: 215018419a7f
Revises: c3fa2c15eb1a
Create Date: 2026-08-03 16:24:25.606675

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '215018419a7f'
down_revision: str | None = 'c3fa2c15eb1a'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Alembic не отслеживает изменения enum — добавляем значение руками.
    # В PostgreSQL 12+ это допустимо внутри транзакции, пока новое значение
    # не используется в ней же.
    op.execute("ALTER TYPE place_source ADD VALUE IF NOT EXISTS 'osm'")
    op.create_table('places_cache',
    sa.Column('cache_key', sa.String(), nullable=False),
    sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('fetched_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('cache_key')
    )


def downgrade() -> None:
    # Значение 'osm' из enum не удаляем: PostgreSQL этого не умеет, а обходной
    # путь — пересоздать тип и переписать колонку в таблице dates, рискуя
    # данными ради отката, который в проде не понадобится. Повторный upgrade
    # безопасен благодаря IF NOT EXISTS выше.
    op.drop_table('places_cache')
