"""Места: агрегированный поиск и «наши места» (ТЗ 11, 12).

Источники — OpenStreetMap и KudaGo, оба бесплатные и без ключей; 2ГИС
подключается, если появится ключ. Яндекс не используется: бесплатного
серверного тарифа у него не оказалось (см. DEPLOY.md).
"""

import uuid

from fastapi import APIRouter, Query, status
from sqlalchemy import select

from app.db.models import CustomPlace, PlaceSource
from app.deps import CurrentUser, SessionDep
from app.errors import AppError
from app.schemas.dates import CustomPlaceCreate, CustomPlaceOut
from app.schemas.places import PlaceDTO, PlaceQuery, PlaceSearchResult
from app.services.places.categories import CATEGORIES
from app.services.places.registry import place_details, search_places

router = APIRouter(prefix="/api/places", tags=["places"])


@router.get("/categories", response_model=list[str])
async def categories(user: CurrentUser) -> list[str]:
    """Справочник категорий, к которому маппятся рубрики всех провайдеров."""
    return list(CATEGORIES)


@router.get("/search", response_model=PlaceSearchResult)
async def search(
    user: CurrentUser,
    session: SessionDep,
    q: str = Query(default="", max_length=200),
    category: str | None = None,
    lat: float | None = Query(default=None, ge=-90, le=90),
    lon: float | None = Query(default=None, ge=-180, le=180),
    radius: int = Query(default=3000, ge=100, le=30_000),
) -> PlaceSearchResult:
    return await search_places(
        session, PlaceQuery(q=q, category=category, lat=lat, lon=lon, radius=radius)
    )



@router.get("/custom", response_model=list[CustomPlaceOut])
async def list_custom(user: CurrentUser, session: SessionDep) -> list[CustomPlaceOut]:
    # Места общие для обоих: это «наши» места, а не «мои».
    rows = (
        await session.scalars(select(CustomPlace).order_by(CustomPlace.created_at.desc()))
    ).all()
    return [CustomPlaceOut.model_validate(row) for row in rows]


@router.post("/custom", response_model=CustomPlaceOut, status_code=status.HTTP_201_CREATED)
async def create_custom(
    payload: CustomPlaceCreate, user: CurrentUser, session: SessionDep
) -> CustomPlaceOut:
    place = CustomPlace(
        created_by=user.id,
        name=payload.name,
        category=payload.category,
        address=payload.address,
        lat=payload.lat,
        lon=payload.lon,
        note=payload.note,
    )
    session.add(place)
    await session.commit()
    await session.refresh(place)
    return CustomPlaceOut.model_validate(place)


@router.delete("/custom/{place_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom(place_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> None:
    place = await session.get(CustomPlace, place_id)
    if place is None:
        raise AppError("NOT_FOUND", "Место не найдено", status_code=404)

    await session.delete(place)
    await session.commit()


# Объявлен последним намеренно: `{source}/{external_id:path}` иначе перехватил бы
# `/custom` — FastAPI подбирает маршруты в порядке объявления.
@router.get("/{source}/{external_id:path}", response_model=PlaceDTO)
async def details(source: PlaceSource, external_id: str, user: CurrentUser) -> PlaceDTO:
    """Детали места. У OSM external_id выглядит как `node/123`, отсюда `:path`."""
    place = await place_details(source, external_id)
    if place is None:
        raise AppError("NOT_FOUND", "Место не найдено", status_code=404)
    return place
