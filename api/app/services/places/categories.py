"""Внутренний справочник категорий и маппинг рубрик провайдеров (ТЗ 12.7).

Рубрика, которую не удалось смапить, попадает в «Другое», но пишется в лог —
так словарь постепенно дополняется реальными данными, а не догадками.
"""

import logging
from typing import Final

logger = logging.getLogger(__name__)

# Единственный список категорий, который видит пользователь.
CATEGORIES: Final[tuple[str, ...]] = (
    "Поесть",
    "Кофе",
    "Бар",
    "Кино",
    "Выставка",
    "Театр",
    "Концерт",
    "Прогулка",
    "Активность",
    "Спа",
    "Дома",
    "Другое",
)

OTHER: Final = "Другое"

# ── OpenStreetMap ────────────────────────────────────────────────────────────
# Ключ — «тег=значение» из OSM.
_OSM: Final[dict[str, str]] = {
    "amenity=restaurant": "Поесть",
    "amenity=fast_food": "Поесть",
    "amenity=food_court": "Поесть",
    "amenity=cafe": "Кофе",
    "shop=coffee": "Кофе",
    "amenity=bar": "Бар",
    "amenity=pub": "Бар",
    "amenity=biergarten": "Бар",
    "amenity=nightclub": "Бар",
    "amenity=cinema": "Кино",
    "tourism=museum": "Выставка",
    "tourism=gallery": "Выставка",
    "amenity=arts_centre": "Выставка",
    "amenity=theatre": "Театр",
    "amenity=music_venue": "Концерт",
    "leisure=park": "Прогулка",
    "leisure=garden": "Прогулка",
    "tourism=viewpoint": "Прогулка",
    "natural=beach": "Прогулка",
    "leisure=bowling_alley": "Активность",
    "leisure=ice_rink": "Активность",
    "leisure=fitness_centre": "Активность",
    "leisure=sports_centre": "Активность",
    "leisure=escape_game": "Активность",
    "leisure=spa": "Спа",
    "amenity=public_bath": "Спа",
    "leisure=sauna": "Спа",
}

# ── KudaGo ───────────────────────────────────────────────────────────────────
# Слаги категорий из их API.
_KUDAGO: Final[dict[str, str]] = {
    "exhibition": "Выставка",
    "photo": "Выставка",
    "art": "Выставка",
    "theater": "Театр",
    "concert": "Концерт",
    "party": "Концерт",
    "festival": "Концерт",
    "cinema": "Кино",
    "movie": "Кино",
    "restaurants": "Поесть",
    "cafe": "Кофе",
    "bar": "Бар",
    "bars": "Бар",
    "park": "Прогулка",
    "walk": "Прогулка",
    "entertainment": "Активность",
    "quest": "Активность",
    "sport": "Активность",
    "education": "Другое",
    "lecture": "Другое",
}

# ── 2ГИС ─────────────────────────────────────────────────────────────────────
_TWOGIS: Final[dict[str, str]] = {
    "Рестораны": "Поесть",
    "Быстрое питание": "Поесть",
    "Кафе": "Кофе",
    "Кофейни": "Кофе",
    "Бары": "Бар",
    "Кинотеатры": "Кино",
    "Музеи": "Выставка",
    "Галереи": "Выставка",
    "Театры": "Театр",
    "Концертные залы": "Концерт",
    "Парки": "Прогулка",
    "Боулинг": "Активность",
    "Спа-салоны": "Спа",
    "Бани": "Спа",
}

_TABLES: Final[dict[str, dict[str, str]]] = {
    "osm": _OSM,
    "kudago": _KUDAGO,
    "twogis": _TWOGIS,
}


def map_category(provider: str, raw: str | None) -> str:
    """Рубрика провайдера → внутренняя категория."""
    if not raw:
        return OTHER

    table = _TABLES.get(provider, {})
    mapped = table.get(raw)
    if mapped is not None:
        return mapped

    # Не догадка, а сигнал: словарь дополняется по реальным данным (ТЗ 12.7).
    logger.info("Несмапленная рубрика: provider=%s raw=%s", provider, raw)
    return OTHER
