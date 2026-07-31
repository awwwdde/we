"""Health-check.

`GET /healthz` — часть контракта платформы awwwdde: панель ждёт 200,
прежде чем прописать маршрут в Caddy. Отвечает 200, как только приложение
готово принимать запросы.

`GET /api/health` — диагностика для нас: показывает, отвечает ли БД.
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session

router = APIRouter(tags=["health"])


class HealthzResponse(BaseModel):
    status: Literal["ok"]


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    database: bool


@router.get("/healthz", response_model=HealthzResponse)
async def healthz() -> HealthzResponse:
    return HealthzResponse(status="ok")


@router.get("/api/health", response_model=HealthResponse)
async def health(session: Annotated[AsyncSession, Depends(get_session)]) -> HealthResponse:
    try:
        await session.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    return HealthResponse(status="ok" if db_ok else "degraded", database=db_ok)
