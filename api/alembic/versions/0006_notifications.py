"""in-app notification feed

Revision ID: c4a71d0f8e52
Revises: 9b36b2979ee2
Create Date: 2026-08-08 11:40:12.008417

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = 'c4a71d0f8e52'
down_revision: str | None = '9b36b2979ee2'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('notifications',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('kind', sa.Enum('invite_sent', 'invite_opened', 'confirmed', 'declined', 'cancelled', 'reminder_24h', 'reminder_2h', name='notification_kind'), nullable=False),
    sa.Column('title', sa.String(length=120), nullable=False),
    sa.Column('body', sa.String(length=400), nullable=False),
    sa.Column('url', sa.String(length=200), server_default='/', nullable=False),
    sa.Column('date_id', sa.UUID(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['date_id'], ['dates.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_notifications_feed', 'notifications', ['user_id', sa.text('created_at DESC')], unique=False)


def downgrade() -> None:
    op.drop_index('idx_notifications_feed', table_name='notifications')
    op.drop_table('notifications')
    # Автогенерация enum-типы не удаляет — приходится руками, иначе
    # повторный upgrade падает на «type already exists» (грабли из 0001_auth).
    sa.Enum(name='notification_kind').drop(op.get_bind(), checkfirst=True)
