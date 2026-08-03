"""Кэш выдачи провайдеров (ТЗ 12.4).

В ТЗ уровней было два — Redis на 6 часов и Postgres на 7 дней. Redis
платформа не даёт (см. DEPLOY.md), поэтому остаётся один: Postgres.

Он же аварийный источник: если внешний API недоступен, отдаём просроченную
запись с флагом `stale`, и фронт показывает подпись «данные могли устареть».
Это лучше, чем пустой экран.
"""

from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PlacesCache(Base):
    __tablename__ = "places_cache"

    # sha256(provider + нормализованный запрос)
    cache_key: Mapped[str] = mapped_column(String, primary_key=True)
    payload: Mapped[list[dict[str, object]]] = mapped_column(JSONB, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
