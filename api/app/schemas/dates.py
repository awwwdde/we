"""Схемы свиданий и мест (контракт ТЗ 11)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.db.models import NOTE_MAX_LENGTH, DateStatus, PlaceSource


class PlaceSnapshot(BaseModel):
    """Копия данных о месте на момент выбора (ТЗ 12.5).

    Именно копия, а не ссылка: заведение закроется, событие исчезнет из
    афиши — запись о свидании обязана пережить это без потерь.
    """

    source: PlaceSource
    external_id: str | None = None
    name: str = Field(min_length=1, max_length=200)
    category: str | None = None
    address: str | None = None
    lat: float | None = None
    lon: float | None = None
    photo_url: str | None = None
    payload: dict[str, object] | None = None


class DateCreate(BaseModel):
    scheduled_at: datetime
    is_all_day: bool = False
    note: str | None = Field(default=None, max_length=NOTE_MAX_LENGTH)
    place: PlaceSnapshot


class DatePatch(BaseModel):
    """Правка. После отправки приглашения меняется только записка (ТЗ 11)."""

    scheduled_at: datetime | None = None
    is_all_day: bool | None = None
    note: str | None = Field(default=None, max_length=NOTE_MAX_LENGTH)
    place: PlaceSnapshot | None = None


class PersonBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    display_name: str
    color: str


class DateOut(BaseModel):
    id: uuid.UUID
    status: DateStatus
    scheduled_at: datetime
    is_all_day: bool
    note: str | None
    place: PlaceSnapshot
    author: PersonBrief
    guest: PersonBrief
    created_at: datetime
    confirmed_at: datetime | None


class DatePage(BaseModel):
    """Курсорная пагинация по `scheduled_at` (ТЗ 11)."""

    items: list[DateOut]
    next_cursor: str | None


# ── «Наши места» ─────────────────────────────────────────────────────────────


class CustomPlaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: str | None = None
    address: str | None = None
    lat: float | None = None
    lon: float | None = None
    note: str | None = Field(default=None, max_length=500)


class CustomPlaceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    category: str | None
    address: str | None
    lat: float | None
    lon: float | None
    note: str | None
    created_at: datetime
