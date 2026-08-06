"""Первичное заполнение из переменных окружения.

На платформе awwwdde у гостевого проекта нет терминала: выполнить
`python -m app.cli create-user` попросту негде. Поэтому пользователи и
первый инвайт-код заводятся переменными окружения проекта — тем же
способом, каким «Дом Союзов» создаёт своего админа через `BOOTSTRAP_ADMIN_*`.

Обе операции идемпотентны: выполняются на каждом старте, но ничего не
создают повторно.

Безопасность: инвайт из `BOOTSTRAP_INVITES` создаётся **только для
пользователя, у которого ещё нет ни одного passkey**. Как только ключ
привязан, код перестаёт действовать сам, даже если переменная осталась
в окружении. Это снимает необходимость помнить про её удаление —
хотя убрать её после настройки всё равно правильно.
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import Credential, InviteCode, User, UserColor
from app.services.codes import hash_code, normalize_code, verify_code

logger = logging.getLogger(__name__)

# Инвайт из окружения живёт долго: он нужен, пока человек не дошёл до
# телефона. Настоящее ограничение — отсутствие passkey, а не срок.
BOOTSTRAP_INVITE_TTL = timedelta(days=30)
MIN_CODE_LENGTH = 8


def _parse_users(raw: str) -> list[tuple[str, str, UserColor]]:
    """`vlad:Влад:ember,angelina:Ангелина:iris` → список пользователей."""
    result: list[tuple[str, str, UserColor]] = []
    for chunk in raw.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        parts = [p.strip() for p in chunk.split(":")]
        if len(parts) != 3:
            logger.warning("BOOTSTRAP_USERS: пропускаю «%s» — нужно username:Имя:цвет", chunk)
            continue
        username, display_name, color = parts
        try:
            result.append((username, display_name, UserColor(color)))
        except ValueError:
            logger.warning("BOOTSTRAP_USERS: неизвестный цвет «%s» у %s", color, username)
    return result


def _parse_invites(raw: str) -> list[tuple[str, str]]:
    """`vlad:XXXX-XXXX-XXXX,angelina:YYYY-...` → пары (username, код)."""
    result: list[tuple[str, str]] = []
    for chunk in raw.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        username, _, code = chunk.partition(":")
        username, code = username.strip(), code.strip()
        if not username or not code:
            logger.warning("BOOTSTRAP_INVITES: пропускаю «%s» — нужно username:КОД", chunk)
            continue
        if len(normalize_code(code)) < MIN_CODE_LENGTH:
            logger.warning(
                "BOOTSTRAP_INVITES: код для %s короче %d символов, пропускаю",
                username,
                MIN_CODE_LENGTH,
            )
            continue
        result.append((username, code))
    return result


async def _ensure_users(session: AsyncSession) -> None:
    for username, display_name, color in _parse_users(settings.bootstrap_users):
        existing = await session.scalar(select(User).where(User.username == username))
        if existing is not None:
            continue
        session.add(User(username=username, display_name=display_name, color=color))
        logger.info("Создан пользователь %s (%s)", display_name, username)


async def _ensure_invites(session: AsyncSession) -> None:
    now = datetime.now(timezone.utc)

    for username, code in _parse_invites(settings.bootstrap_invites):
        user = await session.scalar(select(User).where(User.username == username))
        if user is None:
            logger.warning("BOOTSTRAP_INVITES: пользователь %s не найден", username)
            continue

        # Ключ уже привязан — код больше не нужен и не должен работать.
        has_passkey = await session.scalar(
            select(func.count()).select_from(Credential).where(Credential.user_id == user.id)
        )
        if has_passkey:
            continue

        # Не плодим дубли на каждый рестарт: если такой код уже живой, выходим.
        live = (
            await session.scalars(
                select(InviteCode).where(
                    InviteCode.user_id == user.id,
                    InviteCode.used_at.is_(None),
                    InviteCode.expires_at > now,
                )
            )
        ).all()
        if any(verify_code(code, invite.code_hash) for invite in live):
            continue

        session.add(
            InviteCode(
                user_id=user.id,
                code_hash=hash_code(code),
                expires_at=now + BOOTSTRAP_INVITE_TTL,
            )
        )
        logger.info("Выпущен стартовый инвайт для %s", username)


async def run(session: AsyncSession) -> None:
    """Вызывается на старте приложения. Молчит, если переменные не заданы."""
    if not settings.bootstrap_users and not settings.bootstrap_invites:
        return

    await _ensure_users(session)
    await session.flush()
    await _ensure_invites(session)
    await session.commit()
