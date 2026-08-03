"""Ограничение частоты запросов (ТЗ 16).

Счётчики живут в памяти процесса. Это осознанный выбор: Redis платформа не
даёт, а класть их в Postgres ради двух пользователей — лишняя запись на
каждый запрос. Минус ровно один: при редеплое счётчики обнуляются. Для
защиты от перебора это приемлемо — она мешает автоматическому подбору, а не
ведёт аудит.
"""

import time
from collections import defaultdict
from typing import Final

# Скользящее окно: список отметок времени на ключ.
_hits: dict[str, list[float]] = defaultdict(list)

LOGIN_LIMIT: Final = 5  # попыток входа в минуту на IP
PUBLIC_LIMIT: Final = 20  # запросов в минуту на публичные эндпоинты
WINDOW: Final = 60.0


class RateLimited(Exception):
    """Лимит исчерпан."""


def check(key: str, limit: int, window: float = WINDOW) -> None:
    now = time.monotonic()
    marks = _hits[key]

    # Выбрасываем всё, что вышло из окна.
    fresh = [t for t in marks if now - t < window]
    if len(fresh) >= limit:
        _hits[key] = fresh
        raise RateLimited

    fresh.append(now)
    _hits[key] = fresh


def reset(key: str) -> None:
    """Сбросить счётчик — например, после успешного входа."""
    _hits.pop(key, None)
