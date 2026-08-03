"""Контракт источника мест (ТЗ 12.2)."""

from typing import Protocol

from app.db.models import PlaceSource
from app.schemas.places import PlaceDTO, PlaceQuery


class PlacesProvider(Protocol):
    """Любой источник мест выглядит для агрегатора одинаково.

    Благодаря этому источник можно добавить или убрать, не трогая ни
    агрегатор, ни роутер, ни фронтенд.
    """

    source: PlaceSource

    async def search(self, query: PlaceQuery) -> list[PlaceDTO]: ...

    async def details(self, external_id: str) -> PlaceDTO | None: ...

    def is_enabled(self) -> bool:
        """Провайдер без ключа просто не участвует в выдаче (ТЗ 12.1-B)."""
        ...
