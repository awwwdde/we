"""Сборка провайдеров и полный цикл поиска: кэш → опрос → склейка (ТЗ 12.3–12.4)."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CustomPlace, PlaceSource
from app.schemas.places import PlaceDTO, PlaceQuery, PlaceSearchResult
from app.services.places import cache
from app.services.places.aggregator import (
    PROVIDER_TIMEOUT,
    deduplicate,
    gather_places,
    normalize_name,
    sort_places,
)
from app.services.places.base import PlacesProvider
from app.services.places.kudago import KudaGoProvider
from app.services.places.osm import OsmProvider
from app.services.places.twogis import TwoGisProvider

logger = logging.getLogger(__name__)

# User-Agent обязателен для Overpass и вежлив по отношению к KudaGo:
# бесплатные сервисы вправе знать, кто их дёргает.
USER_AGENT = "Perigee/0.1 (private two-person app)"


@asynccontextmanager
async def http_client() -> AsyncIterator[httpx.AsyncClient]:
    async with httpx.AsyncClient(
        timeout=PROVIDER_TIMEOUT,
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
    ) as client:
        yield client


def build_providers(client: httpx.AsyncClient) -> list[PlacesProvider]:
    """Порядок здесь не важен — агрегатор опрашивает всех параллельно."""
    return [OsmProvider(client), KudaGoProvider(client), TwoGisProvider(client)]


async def _custom_places(session: AsyncSession, query: PlaceQuery) -> list[PlaceDTO]:
    """«Наши места» всегда в выдаче и всегда первыми (ТЗ 12.3)."""
    rows = (await session.scalars(select(CustomPlace))).all()

    needle = normalize_name(query.q)
    places: list[PlaceDTO] = []
    for row in rows:
        if needle and needle not in normalize_name(row.name):
            continue
        if query.category and row.category != query.category:
            continue

        places.append(
            PlaceDTO(
                source=PlaceSource.custom,
                external_id=str(row.id),
                name=row.name,
                category=row.category or "Другое",
                address=row.address,
                lat=row.lat,
                lon=row.lon,
            )
        )
    return places


async def search_places(session: AsyncSession, query: PlaceQuery) -> PlaceSearchResult:
    """Полный цикл поиска.

    Внешние источники кэшируются целиком одним ключом: они опрашиваются
    вместе и по одному запросу, поэтому дробить кэш по провайдерам смысла нет.
    «Наши места» берутся из базы напрямую — они всегда свежие.
    """
    key = cache.cache_key("aggregate", query)
    cached = await cache.read(session, key)

    own = await _custom_places(session, query)

    # Свежий кэш — внешние источники не трогаем вовсе.
    if cached is not None and not cached[1]:
        merged = deduplicate(own + cached[0])
        return PlaceSearchResult(
            items=sort_places(merged, query),
            stale=False,
            sources=sorted({p.source for p in merged}, key=lambda s: s.value),
        )

    async with http_client() as client:
        external, answered = await gather_places(build_providers(client), query)

    if answered:
        await cache.write(session, key, external)
        await session.commit()
        stale = False
    elif cached is not None:
        # Все источники молчат — отдаём просрочку с честной пометкой (ТЗ 12.4).
        logger.warning("Все провайдеры недоступны, отдаю просроченный кэш")
        external, stale = cached[0], True
    else:
        external, stale = [], False

    merged = deduplicate(own + external)
    return PlaceSearchResult(
        items=sort_places(merged, query),
        stale=stale,
        sources=sorted({p.source for p in merged}, key=lambda s: s.value),
    )


async def place_details(source: PlaceSource, external_id: str) -> PlaceDTO | None:
    async with http_client() as client:
        for provider in build_providers(client):
            if provider.source is source and provider.is_enabled():
                return await provider.details(external_id)
    return None
