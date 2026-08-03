"""KudaGo — события и площадки (ТЗ 12.1-C).

Ключ не нужен вообще, публичный открытый API. Единственный источник, где у
события есть **дата проведения**, а не только адрес здания: справочники
организаций отдают музей, но не конкретную экспозицию (ТЗ 12.8).

Отсюда же берём фотографии — у OSM их нет.
"""

import asyncio
import logging
from datetime import date, datetime, timezone
from typing import Final

import httpx

from app.config import settings
from app.db.models import PlaceSource
from app.schemas.places import PlaceDTO, PlaceQuery, Schedule
from app.services.places.categories import map_category

logger = logging.getLogger(__name__)

BASE: Final = "https://kudago.com/public-api/v1.4"
PAGE_SIZE: Final = 30


def _first_image(payload: dict[str, object]) -> str | None:
    images = payload.get("images")
    if isinstance(images, list) and images:
        first = images[0]
        if isinstance(first, dict):
            url = first.get("image")
            if isinstance(url, str):
                return url
    return None


def _coords(payload: dict[str, object]) -> tuple[float | None, float | None]:
    coords = payload.get("coords")
    if isinstance(coords, dict):
        lat, lon = coords.get("lat"), coords.get("lon")
        if isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
            return float(lat), float(lon)
    return None, None


class KudaGoProvider:
    source = PlaceSource.kudago

    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client
        self._city = settings.kudago_city

    def is_enabled(self) -> bool:
        # Публичный API без ключа — доступен всегда.
        return True

    async def search(self, query: PlaceQuery) -> list[PlaceDTO]:
        """Ищем и события, и площадки: события дают даты, площадки — постоянные места.

        Запросы идут параллельно: последовательно они не укладывались
        в бюджет провайдера (ТЗ 12.3).

        Эндпоинт зависит от того, есть ли текст запроса. У `/places/`
        параметр `q` **молча игнорируется** — выдача с ним и без него
        одинаковая, это проверено. Текстовый поиск умеет только `/search/`,
        зато у него беднее поля: у площадок нет фотографий и категорий.
        Поэтому просмотр без запроса идёт через `/places/` и `/events/`,
        а поиск по тексту — через `/search/`.
        """
        if query.q:
            events, places = await asyncio.gather(
                self._search_text(query.q, "event"), self._search_text(query.q, "place")
            )
        else:
            events, places = await asyncio.gather(
                self._search_events(query), self._search_places(query)
            )
        return events + places

    async def _search_text(self, text: str, ctype: str) -> list[PlaceDTO]:
        params: dict[str, str | int] = {
            "q": text,
            "ctype": ctype,
            "location": self._city,
            "page_size": PAGE_SIZE,
            "text_format": "text",
        }
        payload = await self._get(f"{BASE}/search/", params)
        parse = self._parse_search_event if ctype == "event" else self._parse_search_place
        return [p for p in (parse(item) for item in payload) if p is not None]

    def _parse_search_place(self, raw: object) -> PlaceDTO | None:
        if not isinstance(raw, dict):
            return None
        title = raw.get("title")
        if not isinstance(title, str) or not title.strip():
            return None
        # Закрывшиеся заведения предлагать нельзя.
        if raw.get("is_closed") is True:
            return None

        lat, lon = _coords(raw)
        return PlaceDTO(
            source=self.source,
            external_id=f"place/{raw.get('id')}",
            name=title.strip(),
            category="Другое",  # /search/ рубрики не отдаёт
            address=raw.get("address") if isinstance(raw.get("address"), str) else None,
            lat=lat,
            lon=lon,
        )

    def _parse_search_event(self, raw: object) -> PlaceDTO | None:
        if not isinstance(raw, dict):
            return None
        title = raw.get("title")
        if not isinstance(title, str) or not title.strip():
            return None

        place = raw.get("place") if isinstance(raw.get("place"), dict) else {}
        lat, lon = _coords(place) if isinstance(place, dict) else (None, None)
        image = raw.get("first_image")
        photo = image.get("image") if isinstance(image, dict) else None

        return PlaceDTO(
            source=self.source,
            external_id=f"event/{raw.get('id')}",
            name=title.strip().capitalize(),
            category="Другое",
            address=place.get("address") if isinstance(place, dict) else None,
            lat=lat,
            lon=lon,
            photo_url=photo if isinstance(photo, str) else None,
            event_dates=self._parse_daterange(raw.get("daterange")),
        )

    def _parse_daterange(self, raw: object) -> list[date] | None:
        """`/search/` отдаёт диапазон, а не список дат — берём дату начала."""
        if not isinstance(raw, dict):
            return None
        start = raw.get("start")
        if not isinstance(start, int) or start <= 0:
            return None
        try:
            moment = datetime.fromtimestamp(start, timezone.utc).date()
        except (OverflowError, OSError, ValueError):
            return None
        return [moment] if moment >= datetime.now(timezone.utc).date() else None

    async def _search_events(self, query: PlaceQuery) -> list[PlaceDTO]:
        params: dict[str, str | int] = {
            "location": self._city,
            "page_size": PAGE_SIZE,
            "text_format": "text",
            "fields": "id,title,place,images,site_url,dates,categories",
            # `expand` намеренно НЕ используется: с ним запрос занимал 9.9с
            # вместо 1.1с и не укладывался в бюджет провайдера. Адрес события
            # подтягивается на экране деталей — там запрос одиночный.
            # Прошедшие события не предлагаем: их уже не посетить.
            "actual_since": int(datetime.now(timezone.utc).timestamp()),
        }
        if query.q:
            params["q"] = query.q

        payload = await self._get(f"{BASE}/events/", params)
        return [p for p in (self._parse_event(item) for item in payload) if p is not None]

    async def _search_places(self, query: PlaceQuery) -> list[PlaceDTO]:
        params: dict[str, str | int] = {
            "location": self._city,
            "page_size": PAGE_SIZE,
            "text_format": "text",
            "fields": "id,title,address,coords,images,site_url,categories,timetable",
        }
        if query.q:
            params["q"] = query.q

        payload = await self._get(f"{BASE}/places/", params)
        return [p for p in (self._parse_place(item) for item in payload) if p is not None]

    async def _get(self, url: str, params: dict[str, str | int]) -> list[object]:
        response = await self._client.get(url, params=params)
        response.raise_for_status()
        body = response.json()
        if not isinstance(body, dict):
            return []
        results = body.get("results")
        return results if isinstance(results, list) else []

    def _category_of(self, payload: dict[str, object]) -> str:
        categories = payload.get("categories")
        if isinstance(categories, list):
            for item in categories:
                if isinstance(item, str):
                    mapped = map_category("kudago", item)
                    if mapped != "Другое":
                        return mapped
        return "Другое"

    def _parse_event(self, raw: object) -> PlaceDTO | None:
        if not isinstance(raw, dict):
            return None

        title = raw.get("title")
        if not isinstance(title, str) or not title.strip():
            return None

        place = raw.get("place") if isinstance(raw.get("place"), dict) else {}
        lat, lon = _coords(place) if isinstance(place, dict) else (None, None)
        address = place.get("address") if isinstance(place, dict) else None

        return PlaceDTO(
            source=self.source,
            external_id=f"event/{raw.get('id')}",
            name=title.strip().capitalize(),
            category=self._category_of(raw),
            address=address if isinstance(address, str) else None,
            lat=lat,
            lon=lon,
            photo_url=_first_image(raw),
            event_dates=self._parse_dates(raw.get("dates")),
            url=raw.get("site_url") if isinstance(raw.get("site_url"), str) else None,
        )

    def _parse_place(self, raw: object) -> PlaceDTO | None:
        if not isinstance(raw, dict):
            return None

        title = raw.get("title")
        if not isinstance(title, str) or not title.strip():
            return None

        lat, lon = _coords(raw)
        timetable = raw.get("timetable")

        return PlaceDTO(
            source=self.source,
            external_id=f"place/{raw.get('id')}",
            name=title.strip(),
            category=self._category_of(raw),
            address=raw.get("address") if isinstance(raw.get("address"), str) else None,
            lat=lat,
            lon=lon,
            photo_url=_first_image(raw),
            schedule=Schedule(raw=timetable) if isinstance(timetable, str) and timetable else None,
            url=raw.get("site_url") if isinstance(raw.get("site_url"), str) else None,
        )

    def _parse_dates(self, raw: object) -> list[date] | None:
        """Даты проведения события — то, ради чего KudaGo и нужен.

        У повторяющихся событий API отдаёт всю историю показов, вплоть до
        давно прошедших лет. Оставляем только будущие: предлагать свидание
        на выставку, которая закрылась, — хуже, чем не предлагать вовсе.
        """
        if not isinstance(raw, list):
            return None

        today = datetime.now(timezone.utc).date()
        result: list[date] = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            start = item.get("start")
            if isinstance(start, int) and start > 0:
                try:
                    moment = datetime.fromtimestamp(start, timezone.utc).date()
                except (OverflowError, OSError, ValueError):
                    continue
                if moment >= today:
                    result.append(moment)

        return sorted(set(result))[:20] if result else None

    async def details(self, external_id: str) -> PlaceDTO | None:
        kind, _, ident = external_id.partition("/")
        if kind not in ("event", "place") or not ident:
            return None

        try:
            response = await self._client.get(
                f"{BASE}/{'events' if kind == 'event' else 'places'}/{ident}/",
                params={"text_format": "text", "expand": "place,dates"},
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            logger.warning("KudaGo details не ответил: %s", exc)
            return None

        body = response.json()
        return self._parse_event(body) if kind == "event" else self._parse_place(body)
