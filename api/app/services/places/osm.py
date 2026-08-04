"""OpenStreetMap через Overpass API.

Основной справочник заведений: бесплатно, без ключей, работает из России.
Москва размечена плотно — рестораны, кафе, бары, кино, парки.

Чего у OSM нет: фотографий. Часы работы есть не у всех объектов. Это
принятое ограничение (карточка места в ТЗ 7.4 и так помечает фото как
«если есть»), плата за отсутствие платного справочника.
"""

import logging
from typing import Final

import httpx

from app.db.models import PlaceSource
from app.schemas.places import PlaceDTO, PlaceQuery, Schedule
from app.services.places.categories import CATEGORIES, map_category

logger = logging.getLogger(__name__)

# Зеркала Overpass: основной часто перегружен, поэтому держим запасной.
ENDPOINTS: Final[tuple[str, ...]] = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)

# Теги, которые нас интересуют, сгруппированные по внутренним категориям.
_TAGS_BY_CATEGORY: Final[dict[str, tuple[str, ...]]] = {
    "Поесть": ("amenity=restaurant", "amenity=fast_food", "amenity=food_court"),
    "Кофе": ("amenity=cafe",),
    "Бар": ("amenity=bar", "amenity=pub", "amenity=nightclub"),
    "Кино": ("amenity=cinema",),
    "Выставка": ("tourism=museum", "tourism=gallery", "amenity=arts_centre"),
    "Театр": ("amenity=theatre",),
    "Концерт": ("amenity=music_venue",),
    "Прогулка": ("leisure=park", "leisure=garden", "tourism=viewpoint"),
    "Активность": (
        "leisure=bowling_alley",
        "leisure=ice_rink",
        "leisure=fitness_centre",
        "leisure=sports_centre",
    ),
    "Спа": ("leisure=spa", "amenity=public_bath", "leisure=sauna"),
}

_ALL_TAGS: Final[tuple[str, ...]] = tuple(
    tag for tags in _TAGS_BY_CATEGORY.values() for tag in tags
)

MAX_RESULTS: Final = 40
# Бюджет самого Overpass. Держим ниже нашего таймаута провайдера, чтобы
# сервер успел ответить отказом, а не оборвал соединение молча.
OVERPASS_TIMEOUT: Final = 8


def _build_query(query: PlaceQuery) -> str:
    """Собрать запрос на Overpass QL.

    Подзапросы группируются по ключу тега и объединяются регуляркой:
    один `nwr["amenity"~"^(cafe|bar|…)$"]` вместо десятка отдельных строк.
    Разница принципиальная — развёрнутый вариант давал полсотни подзапросов
    и не укладывался в трёхсекундный бюджет провайдера (ТЗ 12.3).

    `nwr` — точки, контуры и отношения разом: заведение может быть размечено
    и точкой, и зданием.

    Ищем всегда вокруг точки: без ограничения Overpass обходил бы всю
    планету, что и медленно, и невежливо по отношению к бесплатному сервису.
    """
    tags = _TAGS_BY_CATEGORY.get(query.category, _ALL_TAGS) if query.category else _ALL_TAGS

    lat = query.lat if query.lat is not None else 55.7558  # центр Москвы
    lon = query.lon if query.lon is not None else 37.6173
    around = f"around:{query.radius},{lat},{lon}"

    # По названию НЕ фильтруем на стороне Overpass: регулярка по name
    # превращает запрос в полный перебор и стоила 7.6с против 4.0с без неё.
    # Требуем лишь наличие имени, а совпадение с запросом проверяем локально.
    name_filter = '["name"]'

    by_key: dict[str, list[str]] = {}
    for tag in tags:
        key, _, value = tag.partition("=")
        by_key.setdefault(key, []).append(value)

    parts = [
        f'nwr["{key}"~"^({"|".join(values)})$"]{name_filter}({around});'
        for key, values in by_key.items()
    ]

    body = "\n".join(parts)
    # `center` даёт координаты для way и relation: здание — это контур, а не точка.
    return f"[out:json][timeout:{OVERPASS_TIMEOUT}];\n({body}\n);\nout center {MAX_RESULTS};"


def _filter_by_name(places: list[PlaceDTO], needle: str) -> list[PlaceDTO]:
    """Отбор по названию на нашей стороне — Overpass это делает слишком дорого."""
    if not needle:
        return places
    lowered = needle.lower().replace("ё", "е")
    return [p for p in places if lowered in p.name.lower().replace("ё", "е")]


def _parse_schedule(raw: str | None) -> Schedule | None:
    """Разбор `opening_hours` из OSM.

    Формат богатый (`Mo-Fr 09:00-18:00; Sa 10:00-16:00; PH off`), полный
    парсер — отдельная библиотека. Нам достаточно сохранить исходную строку
    и показать её как есть: врать про «открыто сейчас» хуже, чем не знать.
    """
    if not raw:
        return None
    return Schedule(raw=raw, days=[], is_open_now=None)


class OsmProvider:
    source = PlaceSource.osm

    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    def is_enabled(self) -> bool:
        # Ключей не требует — доступен всегда.
        return True

    async def search(self, query: PlaceQuery) -> list[PlaceDTO]:
        """Ищем в OSM только при выборе категории.

        Причина: фильтровать по названию на стороне Overpass слишком дорого
        (регулярка по `name` стоила 7.6с против 4.0с без неё), а фильтровать
        локально нечем — сервер отдаёт лишь `out center 40`, и до нашего
        фильтра доходят случайные сорок заведений, среди которых нужного
        обычно нет. Поднять лимит не выходит: на 300 и 800 публичный
        Overpass отвечает 504.

        Поэтому разделение труда: текст ищет KudaGo (у него для этого есть
        `/search/`), а OSM отвечает за просмотр по категориям, где он силён —
        «покажи кофейни рядом».
        """
        if query.q:
            return []

        payload = _build_query(query)

        for endpoint in ENDPOINTS:
            try:
                response = await self._client.post(endpoint, data={"data": payload})
                response.raise_for_status()
                return _filter_by_name(self._parse(response.json()), query.q)
            except (httpx.HTTPError, ValueError) as exc:
                logger.warning("Overpass %s не ответил: %s", endpoint, exc)
                continue

        # Все зеркала молчат — пусть агрегатор решает, что делать.
        raise RuntimeError("Overpass недоступен")

    async def details(self, external_id: str) -> PlaceDTO | None:
        kind, _, ident = external_id.partition("/")
        if kind not in ("node", "way", "relation") or not ident.isdigit():
            return None

        payload = f"[out:json][timeout:{OVERPASS_TIMEOUT}];{kind}({ident});out center 1;"
        for endpoint in ENDPOINTS:
            try:
                response = await self._client.post(endpoint, data={"data": payload})
                response.raise_for_status()
                items = self._parse(response.json())
                return items[0] if items else None
            except (httpx.HTTPError, ValueError):
                continue
        return None

    def _parse(self, payload: object) -> list[PlaceDTO]:
        if not isinstance(payload, dict):
            return []
        elements = payload.get("elements")
        if not isinstance(elements, list):
            return []

        places: list[PlaceDTO] = []
        for element in elements:
            place = self._parse_one(element)
            if place is not None:
                places.append(place)
        return places

    def _parse_one(self, element: object) -> PlaceDTO | None:
        if not isinstance(element, dict):
            return None

        tags = element.get("tags")
        if not isinstance(tags, dict):
            return None

        name = tags.get("name")
        if not isinstance(name, str) or not name.strip():
            return None  # безымянные объекты в выдаче бесполезны

        # У way координаты лежат в `center`, у node — прямо в элементе.
        center = element.get("center") if isinstance(element.get("center"), dict) else element
        lat = center.get("lat") if isinstance(center, dict) else None
        lon = center.get("lon") if isinstance(center, dict) else None

        category = self._detect_category(tags)

        return PlaceDTO(
            source=self.source,
            external_id=f"{element.get('type', 'node')}/{element.get('id')}",
            name=name,
            category=category,
            address=self._build_address(tags),
            lat=float(lat) if isinstance(lat, (int, float)) else None,
            lon=float(lon) if isinstance(lon, (int, float)) else None,
            photo_url=None,  # у OSM фотографий нет
            schedule=_parse_schedule(
                tags.get("opening_hours") if isinstance(tags.get("opening_hours"), str) else None
            ),
            url=tags.get("website") if isinstance(tags.get("website"), str) else None,
        )

    def _detect_category(self, tags: dict[str, object]) -> str:
        for key in ("amenity", "tourism", "leisure", "shop", "natural"):
            value = tags.get(key)
            if isinstance(value, str):
                mapped = map_category("osm", f"{key}={value}")
                if mapped in CATEGORIES and mapped != "Другое":
                    return mapped
        return "Другое"

    def _build_address(self, tags: dict[str, object]) -> str | None:
        street = tags.get("addr:street")
        house = tags.get("addr:housenumber")
        if isinstance(street, str) and isinstance(house, str):
            return f"{street}, {house}"
        if isinstance(street, str):
            return street
        return None
