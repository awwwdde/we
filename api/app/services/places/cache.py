"""Кэш поисковой выдачи (ТЗ 12.4)."""

import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Final

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import PlacesCache
from app.schemas.places import PlaceDTO, PlaceQuery

logger = logging.getLogger(__name__)

FRESH_FOR: Final = timedelta(hours=6)
KEEP_FOR: Final = timedelta(days=7)


def cache_key(provider: str, query: PlaceQuery) -> str:
    """Ключ кэша.

    Запрос нормализуется перед хэшированием: `strip`, нижний регистр,
    схлопывание пробелов, округление координат до 3 знаков (~100 метров).
    Без этого кэш не попадал бы почти никогда — каждый пиксель карты давал
    бы новый ключ (ТЗ 12.4).
    """
    text = " ".join(query.q.lower().split())
    lat = f"{query.lat:.3f}" if query.lat is not None else "-"
    lon = f"{query.lon:.3f}" if query.lon is not None else "-"
    raw = f"{provider}|{text}|{query.category or '-'}|{lat}|{lon}|{query.radius}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def read(
    session: AsyncSession, key: str
) -> tuple[list[PlaceDTO], bool] | None:
    """Достать из кэша. Второе значение — просрочена ли запись.

    Просроченную не выбрасываем: она пригодится, если провайдер не ответит.
    """
    row = await session.get(PlacesCache, key)
    if row is None:
        return None

    age = datetime.now(timezone.utc) - row.fetched_at
    if age > KEEP_FOR:
        return None

    try:
        places = [PlaceDTO.model_validate(item) for item in row.payload]
    except ValueError as exc:
        # Формат DTO мог поменяться между версиями — кэш просто игнорируем.
        logger.info("Кэш %s не разобрался, пропускаю: %s", key[:12], exc)
        return None

    return places, age > FRESH_FOR


async def write(session: AsyncSession, key: str, places: list[PlaceDTO]) -> None:
    payload = [place.model_dump(mode="json") for place in places]
    statement = (
        insert(PlacesCache)
        .values(cache_key=key, payload=payload, fetched_at=datetime.now(timezone.utc))
        .on_conflict_do_update(
            index_elements=[PlacesCache.cache_key],
            set_={"payload": payload, "fetched_at": datetime.now(timezone.utc)},
        )
    )
    await session.execute(statement)
