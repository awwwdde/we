"""Кэш прогноза погоды.

Устроен как `places_cache` и по той же причине (ТЗ 12.4): бесплатный
внешний сервис нельзя дёргать на каждое открытие карточки. Отличие одно —
здесь в `payload` объект, а не список.

Просроченную запись не выбрасываем: если Open-Meteo не ответит, показать
вчерашний прогноз честнее, чем пустое место.
"""

from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class WeatherCache(Base):
    __tablename__ = "weather_cache"

    # sha256(координаты, округлённые до 3 знаков + дата)
    cache_key: Mapped[str] = mapped_column(String, primary_key=True)
    payload: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
