"""Сессии: короткий access-JWT и refresh с ротацией (ТЗ 9.6).

Access-токен живёт 15 минут и хранится только в памяти JS — не в
`localStorage`, откуда его достал бы любой XSS.

Refresh-токен живёт 90 дней в httpOnly-cookie и **ротируется при каждом
обновлении**: старая строка помечается использованной, выдаётся новая из той
же цепочки (`family_id`). Если приходит токен, который уже был использован —
это признак кражи: гасится вся цепочка целиком.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Final

import jwt
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import RefreshToken
from app.services.codes import generate_token, hash_token

ACCESS_TTL: Final = timedelta(minutes=15)
REFRESH_TTL: Final = timedelta(days=90)
_ALGORITHM: Final = "HS256"

REFRESH_COOKIE: Final = "pg_refresh"


class TokenError(Exception):
    """Токен невалиден, истёк или отозван."""


def create_access_token(user_id: uuid.UUID) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + ACCESS_TTL).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM)


def decode_access_token(token: str) -> uuid.UUID:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise TokenError("Токен недействителен") from exc

    subject = payload.get("sub")
    if not isinstance(subject, str):
        raise TokenError("Токен без владельца")
    try:
        return uuid.UUID(subject)
    except ValueError as exc:
        raise TokenError("Токен с некорректным владельцем") from exc


async def issue_refresh_token(
    session: AsyncSession,
    user_id: uuid.UUID,
    family_id: uuid.UUID | None = None,
) -> str:
    """Выдать refresh-токен. Без `family_id` начинается новая цепочка (вход)."""
    raw = generate_token()
    session.add(
        RefreshToken(
            user_id=user_id,
            family_id=family_id or uuid.uuid4(),
            token_hash=hash_token(raw),
            expires_at=datetime.now(timezone.utc) + REFRESH_TTL,
        )
    )
    return raw


async def _revoke_family(session: AsyncSession, family_id: uuid.UUID) -> None:
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )


async def rotate_refresh_token(session: AsyncSession, raw: str) -> tuple[uuid.UUID, str]:
    """Обменять refresh-токен на новый. Возвращает (user_id, новый токен).

    Повторное использование уже обменянного токена гасит всю цепочку.
    """
    now = datetime.now(timezone.utc)
    stored = await session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw))
    )
    if stored is None:
        raise TokenError("Сессия не найдена")

    if stored.revoked_at is not None:
        raise TokenError("Сессия отозвана")

    if stored.used_at is not None:
        # Токен предъявлен второй раз — значит, у кого-то есть его копия.
        await _revoke_family(session, stored.family_id)
        await session.commit()
        raise TokenError("Сессия скомпрометирована")

    if stored.expires_at <= now:
        raise TokenError("Сессия истекла")

    stored.used_at = now
    new_raw = await issue_refresh_token(session, stored.user_id, stored.family_id)
    return stored.user_id, new_raw


async def revoke_refresh_token(session: AsyncSession, raw: str) -> None:
    """Выход: гасим всю цепочку, а не только предъявленный токен."""
    stored = await session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw))
    )
    if stored is not None:
        await _revoke_family(session, stored.family_id)


async def revoke_all_for_user(session: AsyncSession, user_id: uuid.UUID) -> None:
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )
