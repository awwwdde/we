"""Схемы внутренней ленты уведомлений (ТЗ 13.6)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.db.models import NotificationKind


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: NotificationKind
    title: str
    body: str
    url: str
    created_at: datetime
    read_at: datetime | None


class NotificationFeed(BaseModel):
    items: list[NotificationOut]
    # Счётчик считается по всей таблице, а не по отданной странице: точка
    # на главном экране обязана появиться и тогда, когда непрочитанное
    # уехало за пределы последних пятидесяти.
    unread: int
