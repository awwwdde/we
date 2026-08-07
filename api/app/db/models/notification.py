"""Событие внутренней ленты уведомлений (ТЗ 13.6).

Push — удобство, а не канал доставки: на iOS его не будет вовсе, пока
приложение не поставлено на домашний экран, а дальше доставка всё равно
не гарантирована. Поэтому каждое событие ложится ещё и сюда, и человек
видит его, просто открыв приложение.

Текст хранится готовым, а не собирается при чтении. Причина та же, по
которой место копируется снимком (ТЗ 12.5): «Завтра в 19:00 — Кофейня»
должно остаться правдой о том дне, даже если свидание потом отменили
или место переименовали.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Enum as SAEnum, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class NotificationKind(str, enum.Enum):
    """События из таблицы ТЗ 13.5 плюс отмена и отказ.

    Отмена есть в контракте ТЗ 11 (`/dates/{id}/cancel` — «push второму»),
    а отказ не описан нигде: без него автор приглашения не узнаёт об ответе
    вообще никак, кроме как зайдя на карточку.
    """

    invite_sent = "invite_sent"
    invite_opened = "invite_opened"
    confirmed = "confirmed"
    declined = "declined"
    cancelled = "cancelled"
    reminder_24h = "reminder_24h"
    reminder_2h = "reminder_2h"


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        # Лента читается всегда одинаково: свои, свежие сверху.
        Index("idx_notifications_feed", "user_id", text("created_at DESC")),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[NotificationKind] = mapped_column(
        SAEnum(
            NotificationKind,
            name="notification_kind",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    body: Mapped[str] = mapped_column(String(400), nullable=False)

    # Куда ведёт запись. Тот же адрес, что и у push: одно событие — одно
    # место назначения, независимо от того, каким путём человек до него дошёл.
    url: Mapped[str] = mapped_column(String(200), nullable=False, server_default="/")

    # Ссылка на свидание нужна ради каскада: удалили черновик — уведомления
    # о нём тоже незачем держать. Навигация идёт по `url`, не по этому полю.
    date_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dates.id", ondelete="CASCADE"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
