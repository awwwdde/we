"""Единый формат места (ТЗ 12.2).

Фронтенд никогда не видит различий между провайдерами: он получает
одинаковые `PlaceDTO`. Это позволит потом добавить или убрать источник,
не трогая UI вообще.
"""

from datetime import date

from pydantic import BaseModel, Field

from app.db.models import PlaceSource


class DayHours(BaseModel):
    """Часы работы в один день недели. `None` — выходной."""

    opens: str | None = None  # «10:00»
    closes: str | None = None


class Schedule(BaseModel):
    """Режим работы, приведённый к общему виду.

    Провайдеры описывают его по-разному (OSM — строкой `opening_hours`,
    KudaGo — текстом), поэтому храним и разобранное, и исходный текст:
    если разобрать не удалось, покажем хотя бы как есть.
    """

    raw: str | None = None
    # Понедельник = 0. Пустой список — расписание разобрать не удалось.
    days: list[DayHours] = Field(default_factory=list)
    is_open_now: bool | None = None


class PlaceDTO(BaseModel):
    source: PlaceSource
    external_id: str
    name: str
    category: str  # уже маппленная внутренняя категория
    address: str | None = None
    lat: float | None = None
    lon: float | None = None
    photo_url: str | None = None
    schedule: Schedule | None = None
    # Только для KudaGo: события с датами проведения (ТЗ 12.8).
    event_dates: list[date] | None = None
    url: str | None = None
    # Расстояние от переданной точки, метры. Считаем сами, у провайдеров не берём.
    distance_m: float | None = None


class PlaceQuery(BaseModel):
    q: str = ""
    category: str | None = None
    lat: float | None = None
    lon: float | None = None
    radius: int = 3000  # метры


class PlaceSearchResult(BaseModel):
    items: list[PlaceDTO]
    # Хотя бы один провайдер ответил из просроченного кэша (ТЗ 12.4):
    # фронт покажет ненавязчивую подпись «данные могли устареть».
    stale: bool = False
    # Какие источники реально ответили — видно, если что-то отвалилось.
    sources: list[PlaceSource] = Field(default_factory=list)
