"""Схемы приглашений (ТЗ 11)."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.dates import PlaceSnapshot


class SendResult(BaseModel):
    """Ответ на отправку приглашения — ссылка для share-sheet."""

    token: str
    url: str
    expires_at: datetime


class InvitePublic(BaseModel):
    """Данные свидания для публичного экрана.

    ID пользователей сюда **не попадают** (ТЗ 16): по ссылке видно только
    отображаемое имя и цвет автора. Знание токена даёт доступ к свиданию,
    но не к внутренним идентификаторам.
    """

    author_name: str
    author_color: str
    scheduled_at: datetime
    is_all_day: bool
    note: str | None
    place: PlaceSnapshot
    # Уже отвеченное приглашение открывается повторно и показывает исход.
    answered: bool
    accepted: bool


class InviteResponse(BaseModel):
    accepted: bool
    # Сколько раз убежала кнопка «Нет» — для истории, не для логики.
    evade_count: int = Field(default=0, ge=0, le=100)
