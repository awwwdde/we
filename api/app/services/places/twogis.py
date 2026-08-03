"""2ГИС Catalog API (ТЗ 12.1-B) — опциональный источник.

Ключ выдают по заявке. Если `TWOGIS_API_KEY` не задан, провайдер сообщает
`is_enabled() == False` и просто не участвует в агрегации — приложение
работает без него, ничего не ломая.

По России 2ГИС детальнее OSM: есть фотографии и подробный рубрикатор.
"""

import logging
from typing import Final

import httpx

from app.config import settings
from app.db.models import PlaceSource
from app.schemas.places import PlaceDTO, PlaceQuery, Schedule
from app.services.places.categories import map_category

logger = logging.getLogger(__name__)

BASE: Final = "https://catalog.api.2gis.com/3.0/items"
FIELDS: Final = "items.point,items.rubrics,items.schedule,items.address,items.external_content"
PAGE_SIZE: Final = 30


class TwoGisProvider:
    source = PlaceSource.twogis

    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client
        self._key = settings.twogis_api_key

    def is_enabled(self) -> bool:
        return bool(self._key)

    async def search(self, query: PlaceQuery) -> list[PlaceDTO]:
        if not self.is_enabled():
            return []

        params: dict[str, str | int | float] = {
            "key": self._key,
            "fields": FIELDS,
            "page_size": PAGE_SIZE,
            "locale": "ru_RU",
        }
        if query.q:
            params["q"] = query.q
        if query.lat is not None and query.lon is not None:
            params["point"] = f"{query.lon},{query.lat}"
            params["radius"] = query.radius

        response = await self._client.get(BASE, params=params)
        response.raise_for_status()

        body = response.json()
        if not isinstance(body, dict):
            return []
        result = body.get("result")
        items = result.get("items") if isinstance(result, dict) else None
        if not isinstance(items, list):
            return []

        return [p for p in (self._parse(item) for item in items) if p is not None]

    async def details(self, external_id: str) -> PlaceDTO | None:
        if not self.is_enabled():
            return None

        response = await self._client.get(
            f"{BASE}/byid",
            params={"key": self._key, "id": external_id, "fields": FIELDS, "locale": "ru_RU"},
        )
        response.raise_for_status()

        body = response.json()
        result = body.get("result") if isinstance(body, dict) else None
        items = result.get("items") if isinstance(result, dict) else None
        if isinstance(items, list) and items:
            return self._parse(items[0])
        return None

    def _parse(self, raw: object) -> PlaceDTO | None:
        if not isinstance(raw, dict):
            return None

        name = raw.get("name")
        ident = raw.get("id")
        if not isinstance(name, str) or not isinstance(ident, str):
            return None

        point = raw.get("point") if isinstance(raw.get("point"), dict) else {}
        lat = point.get("lat") if isinstance(point, dict) else None
        lon = point.get("lon") if isinstance(point, dict) else None

        rubrics = raw.get("rubrics")
        rubric = None
        if isinstance(rubrics, list) and rubrics:
            first = rubrics[0]
            if isinstance(first, dict) and isinstance(first.get("name"), str):
                rubric = first["name"]

        schedule_raw = raw.get("schedule")

        return PlaceDTO(
            source=self.source,
            external_id=ident,
            name=name,
            category=map_category("twogis", rubric),
            address=raw.get("address_name") if isinstance(raw.get("address_name"), str) else None,
            lat=float(lat) if isinstance(lat, (int, float)) else None,
            lon=float(lon) if isinstance(lon, (int, float)) else None,
            photo_url=None,
            schedule=Schedule(raw=None) if isinstance(schedule_raw, dict) else None,
        )
