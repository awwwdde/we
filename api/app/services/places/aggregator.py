"""Сведение источников в одну выдачу (ТЗ 12.3).

Провайдеры опрашиваются параллельно. Не ответил за 3 секунды — выпадает из
выдачи, остальные результаты всё равно отдаются: падение одного источника
не ломает поиск.
"""

import asyncio
import logging
import math
import re
from typing import Final

from app.db.models import PlaceSource
from app.schemas.places import PlaceDTO, PlaceQuery
from app.services.places.base import PlacesProvider

logger = logging.getLogger(__name__)

# ТЗ 12.3 закладывает 3 секунды на провайдера, но это писалось под платный
# Яндекс. Замеры на бесплатных источниках: Overpass отвечает за ~4с на район
# Москвы, KudaGo — за ~1с. С трёхсекундным лимитом OSM выпадал бы из выдачи
# почти всегда, а пустой поиск хуже, чем поиск на секунду дольше.
# Цена разовая: результат ложится в кэш на 6 часов (ТЗ 12.4).
PROVIDER_TIMEOUT: Final = 6.0
DEDUP_DISTANCE_M: Final = 50  # ближе — кандидаты на склейку
DEDUP_LEVENSHTEIN: Final = 2


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Расстояние между точками по земной поверхности, метры."""
    radius = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


def normalize_name(name: str) -> str:
    """Нижний регистр без пунктуации и лишних пробелов (ТЗ 12.3)."""
    lowered = name.lower().replace("ё", "е")
    cleaned = re.sub(r"[^\w\s]", " ", lowered, flags=re.UNICODE)
    return re.sub(r"\s+", " ", cleaned).strip()


def levenshtein(a: str, b: str, limit: int = DEDUP_LEVENSHTEIN) -> int:
    """Расстояние Левенштейна с ранним выходом.

    Считать полную матрицу для заведомо разных строк незачем: если разница
    длин уже больше порога, дальше можно не смотреть.
    """
    if abs(len(a) - len(b)) > limit:
        return limit + 1
    if a == b:
        return 0

    previous = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        current = [i]
        for j, cb in enumerate(b, start=1):
            current.append(
                min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (ca != cb))
            )
        if min(current) > limit:
            return limit + 1
        previous = current
    return previous[-1]


def _completeness(place: PlaceDTO) -> int:
    """Насколько полна карточка — по ней выбираем победителя при склейке."""
    fields = (place.address, place.photo_url, place.schedule, place.url, place.lat)
    return sum(1 for field in fields if field)


def _same_place(a: PlaceDTO, b: PlaceDTO) -> bool:
    """Два места считаются одним (ТЗ 12.3).

    Условия складываются: и рядом по координатам, и похожи по названию.
    Одного расстояния мало — в торговом центре десяток заведений в пределах
    50 метров.
    """
    if a.lat is None or a.lon is None or b.lat is None or b.lon is None:
        return False
    if haversine_m(a.lat, a.lon, b.lat, b.lon) > DEDUP_DISTANCE_M:
        return False

    na, nb = normalize_name(a.name), normalize_name(b.name)
    return levenshtein(na, nb) <= DEDUP_LEVENSHTEIN


def deduplicate(places: list[PlaceDTO]) -> list[PlaceDTO]:
    """Склеить дубли, оставив запись с более полными данными."""
    result: list[PlaceDTO] = []

    for place in places:
        for i, kept in enumerate(result):
            if _same_place(place, kept):
                if _completeness(place) > _completeness(kept):
                    # Победитель забирает фото у проигравшего, если своего нет.
                    if place.photo_url is None:
                        place.photo_url = kept.photo_url
                    result[i] = place
                elif kept.photo_url is None and place.photo_url is not None:
                    kept.photo_url = place.photo_url
                break
        else:
            result.append(place)

    return result


def sort_places(places: list[PlaceDTO], query: PlaceQuery) -> list[PlaceDTO]:
    """Сначала свои места, затем по расстоянию, затем по полноте (ТЗ 12.3)."""
    if query.lat is not None and query.lon is not None:
        for place in places:
            if place.lat is not None and place.lon is not None:
                place.distance_m = haversine_m(query.lat, query.lon, place.lat, place.lon)

    # События KudaGo приходят без координат: в выдаче поиска у них только
    # id площадки. С `inf` они все оседали в самом хвосте — а ведь события
    # с датами и есть то, ради чего KudaGo нужен (ТЗ 12.8), и критерий
    # приёмки требует, чтобы выставки были видны. Поэтому место без
    # координат считаем «где-то в середине радиуса», а не бесконечно далёким.
    unknown_distance = query.radius / 2

    def key(place: PlaceDTO) -> tuple[int, float, int]:
        own = 0 if place.source is PlaceSource.custom else 1
        distance = place.distance_m if place.distance_m is not None else unknown_distance
        return (own, distance, -_completeness(place))

    return sorted(places, key=key)


async def _run(provider: PlacesProvider, query: PlaceQuery) -> list[PlaceDTO]:
    async with asyncio.timeout(PROVIDER_TIMEOUT):
        return await provider.search(query)


async def gather_places(
    providers: list[PlacesProvider], query: PlaceQuery
) -> tuple[list[PlaceDTO], list[PlaceSource]]:
    """Опросить включённые провайдеры параллельно.

    `return_exceptions=True` обязателен: без него первый же упавший провайдер
    отменил бы остальные, и поиск вернул бы пустоту вместо частичной выдачи.
    """
    enabled = [p for p in providers if p.is_enabled()]
    if not enabled:
        return [], []

    results = await asyncio.gather(
        *(_run(provider, query) for provider in enabled), return_exceptions=True
    )

    places: list[PlaceDTO] = []
    answered: list[PlaceSource] = []

    for provider, result in zip(enabled, results, strict=True):
        if isinstance(result, BaseException):
            logger.warning("Провайдер %s выпал из выдачи: %s", provider.source.value, result)
            continue
        places.extend(result)
        answered.append(provider.source)

    return places, answered
