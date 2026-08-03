"""dates and custom places

Revision ID: c3fa2c15eb1a
Revises: 3d9a33e67356
Create Date: 2026-08-03 15:37:08.320417

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'c3fa2c15eb1a'
down_revision: str | None = '3d9a33e67356'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('custom_places',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('created_by', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('category', sa.String(), nullable=True),
    sa.Column('address', sa.String(), nullable=True),
    sa.Column('lat', sa.Float(), nullable=True),
    sa.Column('lon', sa.Float(), nullable=True),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_custom_places_created_by'), 'custom_places', ['created_by'], unique=False)
    op.create_table('dates',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('author_id', sa.UUID(), nullable=False),
    sa.Column('guest_id', sa.UUID(), nullable=False),
    sa.Column('status', sa.Enum('draft', 'pending', 'confirmed', 'declined', 'cancelled', 'done', name='date_status'), server_default='draft', nullable=False),
    sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('is_all_day', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('place_source', sa.Enum('yandex', 'twogis', 'kudago', 'custom', name='place_source'), nullable=False),
    sa.Column('place_external_id', sa.String(), nullable=True),
    sa.Column('place_name', sa.String(), nullable=False),
    sa.Column('place_category', sa.String(), nullable=True),
    sa.Column('place_address', sa.String(), nullable=True),
    sa.Column('place_lat', sa.Float(), nullable=True),
    sa.Column('place_lon', sa.Float(), nullable=True),
    sa.Column('place_photo_url', sa.String(), nullable=True),
    sa.Column('place_payload', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('char_length(note) <= 280', name='ck_dates_note_length'),
    sa.ForeignKeyConstraint(['author_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['guest_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_dates_scheduled', 'dates', [sa.literal_column('scheduled_at DESC')], unique=False)
    op.create_index(op.f('ix_dates_author_id'), 'dates', ['author_id'], unique=False)
    op.create_index(op.f('ix_dates_guest_id'), 'dates', ['guest_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_dates_guest_id'), table_name='dates')
    op.drop_index(op.f('ix_dates_author_id'), table_name='dates')
    op.drop_index('idx_dates_scheduled', table_name='dates')
    op.drop_table('dates')
    op.drop_index(op.f('ix_custom_places_created_by'), table_name='custom_places')
    op.drop_table('custom_places')
    # Автогенерация не удаляет enum-типы: без этого повторный upgrade падает.
    sa.Enum(name='place_source').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='date_status').drop(op.get_bind(), checkfirst=True)
