"""Refresh-токены с ротацией и отзывом цепочки (ТЗ 9.6).

Таблицы в схеме ТЗ 10 нет, но без неё требование «повторное использование
отозванного токена отзывает всю цепочку» не реализуемо: нужно помнить,
какой токен из какого выпущен.

Модель: у каждой цепочки свой `family_id`. При обновлении старая строка
получает `used_at`, выдаётся новая с тем же `family_id`. Если приходит токен,
у которого `used_at` уже стоит — значит, его украли и им воспользовались
дважды: гасим всю семью, оба устройства идут авторизовываться заново.

Хранится sha256-хэш: токен из БД не восстановить. Argon2 здесь не нужен —
токен и так 32 случайных байта, перебирать нечего.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    # Проставляется при обновлении: с этого момента токен считается
    # использованным, и повторное предъявление — сигнал кражи.
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
