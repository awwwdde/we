"""weather forecast cache

Revision ID: e18b5c3a9d47
Revises: c4a71d0f8e52
Create Date: 2026-08-08 12:55:41.663200

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = 'e18b5c3a9d47'
down_revision: str | None = 'c4a71d0f8e52'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('weather_cache',
    sa.Column('cache_key', sa.String(), nullable=False),
    sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('fetched_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('cache_key')
    )


def downgrade() -> None:
    op.drop_table('weather_cache')
