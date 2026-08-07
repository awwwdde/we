"""invites

Revision ID: 2f1593466ec6
Revises: 215018419a7f
Create Date: 2026-08-07 11:14:05.159942

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '2f1593466ec6'
down_revision: str | None = '215018419a7f'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('invites',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('date_id', sa.UUID(), nullable=False),
    sa.Column('token', sa.String(), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('opened_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('responded_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('evade_count', sa.Integer(), server_default=sa.text('0'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['date_id'], ['dates.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token')
    )
    op.create_index(op.f('ix_invites_date_id'), 'invites', ['date_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_invites_date_id'), table_name='invites')
    op.drop_table('invites')
