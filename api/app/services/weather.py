"""Прогноз погоды на дату свидания — Open-Meteo.

Почему именно он: бесплатно и **без ключа**. Ключ здесь был бы отдельной
проблемой — ТЗ 12.6 запрещает секретам попадать во фронтенд, а ТЗ 20
запрещает сторонние скрипты в приватном приложении. Запрос всё равно идёт
с сервера, и координаты пары наружу не утекают дальше самой точки встречи.

Горизонт прогноза — 16 суток. Дальше сервис отвечает пустотой, поэтому
такие даты отсекаются до сети: свидание можно задумать и за два месяца.

Погода — украшение карточки, а не её содержание. Любая ошибка здесь
означает «прогноза нет», и ничего больше: карточка обязана открыться
и без него.
"""

import hashlib
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Final
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import DatePlan, WeatherCache
from app.schemas.weather import WeatherOut

logger = logging.getLogger(__name__)

ENDPOINT: Final = "https://api.open-meteo.com/v1/forecast"
TIMEOUT: Final = 6.0
HORIZON_DAYS: Final = 16

# Прогноз на послезавтра за час не меняется, а вот «через два часа» —
# меняется. Шесть часов — компромисс, который переживает и то и другое.
FRESH_FOR: Final = timedelta(hours=6)
KEEP_FOR: Final = timedelta(days=1)

# Коды WMO. Словами, а не иконками: набор иконок пришлось бы рисовать
# под обе темы, а строка «дождь» одинаково читается везде.
_DESCRIPTIONS: Final[dict[int, str]] = {
    0: "ясно",
    1: "почти ясно",
    2: "переменная облачность",
    3: "пасмурно",
    45: "туман",
    48: "изморозь",
    51: "морось",
    53: "морось",
    55: "сильная морось",
    56: "ледяная морось",
    57: "ледяная морось",
    61: "небольшой дождь",
    63: "дождь",
    65: "сильный дождь",
    66: "ледяной дождь",
    67: "ледяной дождь",
    71: "небольшой снег",
    73: "снег",
    75: "сильный снег",
    77: "снежная крупа",
    80: "ливень",
    81: "ливень",
    82: "сильный ливень",
    85: "снегопад",
    86: "сильный снегопад",
    95: "гроза",
    96: "гроза с градом",
    99: "гроза с градом",
}


def describe(code: int) -> str:
    return _DESCRIPTIONS.get(code, "погода без названия")


def _cache_key(lat: float, lon: float, day: date) -> str:
    # Округление до 3 знаков (~100 метров) — как в кэше мест: без него
    # соседние точки одного парка давали бы разные ключи.
    raw = f"{lat:.3f}|{lon:.3f}|{day.isoformat()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _column(payload: dict[str, object], block: str, name: str) -> list[object]:
    """Один ряд значений из ответа. Чего нет — пустой список.

    Ответ разбирается защитно: у бесплатного сервиса нет обязательств
    перед нами, и любое расхождение с ожиданиями значит «прогноза нет».
    """
    section = payload.get(block)
    if not isinstance(section, dict):
        return []
    values = section.get(name)
    return values if isinstance(values, list) else []


def _parse(payload: dict[str, object], moment: datetime, all_day: bool) -> WeatherOut | None:
    """Достать из ответа Open-Meteo одну строку прогноза."""
    if all_day:
        # У «весь день» точки во времени нет — берём дневной максимум:
        # именно он отвечает на вопрос «как одеться».
        block, index = "daily", 0
        temps = _column(payload, block, "temperature_2m_max")
        chances = _column(payload, block, "precipitation_probability_max")
    else:
        block = "hourly"
        stamp = moment.strftime("%Y-%m-%dT%H:00")
        times = [str(value) for value in _column(payload, block, "time")]
        if stamp not in times:
            return None
        index = times.index(stamp)
        temps = _column(payload, block, "temperature_2m")
        chances = _column(payload, block, "precipitation_probability")

    codes = _column(payload, block, "weather_code")
    if index >= len(codes) or index >= len(temps):
        return None

    try:
        code = int(str(codes[index]))
        temp = float(str(temps[index]))
    except ValueError as exc:
        logger.info("Прогноз не разобрался: %s", exc)
        return None

    chance: int | None = None
    if index < len(chances) and chances[index] is not None:
        try:
            chance = int(str(chances[index]))
        except ValueError:
            chance = None

    return WeatherOut(
        temp_c=round(temp),
        code=code,
        description=describe(code),
        precipitation_chance=chance,
    )


async def _fetch(lat: float, lon: float, day: date) -> dict[str, object] | None:
    params = {
        "latitude": f"{lat:.4f}",
        "longitude": f"{lon:.4f}",
        "hourly": "temperature_2m,weather_code,precipitation_probability",
        "daily": "temperature_2m_max,weather_code,precipitation_probability_max",
        "timezone": settings.timezone,
        "start_date": day.isoformat(),
        "end_date": day.isoformat(),
    }

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.get(ENDPOINT, params=params)
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.info("Open-Meteo не ответил: %s", exc)
        return None

    return data if isinstance(data, dict) else None


async def forecast(session: AsyncSession, plan: DatePlan) -> WeatherOut | None:
    """Прогноз на свидание. `None` — прогноза нет, и это нормально.

    Причины, по которым его может не быть: у места нет координат (своё
    место заводится без карты), дата дальше горизонта, сервис не ответил
    и в кэше пусто.
    """
    if plan.place_lat is None or plan.place_lon is None:
        return None

    zone = ZoneInfo(settings.timezone)
    local = plan.scheduled_at.astimezone(zone)
    day = local.date()

    today = datetime.now(zone).date()
    if day < today or day > today + timedelta(days=HORIZON_DAYS):
        return None

    key = _cache_key(plan.place_lat, plan.place_lon, day)
    cached = await session.get(WeatherCache, key)
    now = datetime.now(timezone.utc)

    if cached is not None and now - cached.fetched_at <= FRESH_FOR:
        return _parse(cached.payload, local, plan.is_all_day)

    payload = await _fetch(plan.place_lat, plan.place_lon, day)

    if payload is None:
        # Сеть подвела — отдаём просроченное с пометкой, как в кэше мест.
        if cached is None or now - cached.fetched_at > KEEP_FOR:
            return None
        stale = _parse(cached.payload, local, plan.is_all_day)
        return None if stale is None else stale.model_copy(update={"stale": True})

    await session.execute(
        insert(WeatherCache)
        .values(cache_key=key, payload=payload, fetched_at=now)
        .on_conflict_do_update(
            index_elements=[WeatherCache.cache_key],
            set_={"payload": payload, "fetched_at": now},
        )
    )
    await session.commit()

    return _parse(payload, local, plan.is_all_day)
