"""Отправка web-push (ТЗ 13).

Своя реализация на VAPID: `pywebpush` шлёт напрямую в push-сервисы
браузеров, Firebase не нужен.

Честные ограничения (ТЗ 13.6): на iOS push работает только с 16.4+ и только
для установленного на домашний экран приложения; доставка не гарантирована
и не мгновенна. Поэтому push — удобство, а не единственный канал: внутри
приложения состояние видно и без него.
"""

import asyncio
import json
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Final

from pywebpush import WebPushException, webpush
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import PushSubscription

logger = logging.getLogger(__name__)

# Payload больше 4 КБ push-сервисы отвергают (ТЗ 13.4).
MAX_PAYLOAD: Final = 3800


@dataclass(frozen=True)
class Notification:
    title: str
    body: str
    url: str = "/"
    # Склеивает повторные уведомления одного смысла.
    tag: str = "perigee"


def is_configured() -> bool:
    """Без ключей VAPID отправка невозможна — молча ничего не делаем."""
    return bool(settings.vapid_private_key and settings.vapid_public_key)


def _payload(notification: Notification) -> str:
    raw = json.dumps(
        {
            "title": notification.title,
            "body": notification.body,
            "url": notification.url,
            "tag": notification.tag,
        },
        ensure_ascii=False,
    )
    if len(raw.encode("utf-8")) <= MAX_PAYLOAD:
        return raw

    # Не влезли — режем текст, а не роняем отправку целиком.
    trimmed = notification.body[: MAX_PAYLOAD // 4] + "…"
    return json.dumps(
        {
            "title": notification.title,
            "body": trimmed,
            "url": notification.url,
            "tag": notification.tag,
        },
        ensure_ascii=False,
    )


# Возвращаемое значение _send_one: None — доставлено, число — HTTP-код
# ошибки, BROKEN — подписка непригодна и работать уже не будет.
BROKEN: Final = -1


def _send_one(subscription: PushSubscription, payload: str) -> int | None:
    """Отправить синхронно. `pywebpush` синхронный — вызывается в потоке.

    Ловим не только `WebPushException`: битые ключи в подписке дают
    `ValueError` из криптографии ещё до сети. Без широкого перехвата одна
    испорченная запись роняла рассылку всем остальным устройствам.
    """
    try:
        webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
            },
            data=payload,
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": settings.vapid_subject},
            timeout=10,
        )
        return None
    except WebPushException as exc:
        status = exc.response.status_code if exc.response is not None else None
        logger.warning("Push не доставлен (%s): %s", status, exc)
        return status
    except Exception as exc:  # noqa: BLE001
        # Ключи подписки нечитаемы — она не заработает никогда, удаляем.
        logger.warning("Подписка непригодна, удаляю: %s", exc)
        return BROKEN


async def send_to_user(
    session: AsyncSession, user_id: uuid.UUID, notification: Notification
) -> int:
    """Разослать на все подписки человека. Возвращает число доставленных.

    Мёртвые подписки (404/410) удаляются: устройство больше не существует,
    держать строку незачем (ТЗ 13.4).
    """
    if not is_configured():
        logger.info("VAPID не настроен, push пропущен: %s", notification.title)
        return 0

    subscriptions = (
        await session.scalars(
            select(PushSubscription).where(PushSubscription.user_id == user_id)
        )
    ).all()
    if not subscriptions:
        return 0

    payload = _payload(notification)
    dead: list[str] = []
    delivered = 0

    for subscription in subscriptions:
        # pywebpush синхронный: уводим в поток, чтобы не блокировать цикл.
        status = await asyncio.to_thread(_send_one, subscription, payload)

        if status is None:
            delivered += 1
        elif status in (404, 410) or status == BROKEN:
            # 404/410 — устройства больше нет; BROKEN — ключи нечитаемы.
            dead.append(subscription.endpoint)
        else:
            # 429 и прочее — подписка жива, отметим неудачу и оставим.
            subscription.failed_at = datetime.now(timezone.utc)

    if dead:
        await session.execute(
            delete(PushSubscription).where(PushSubscription.endpoint.in_(dead))
        )
        logger.info("Удалено мёртвых подписок: %d", len(dead))

    await session.commit()
    return delivered
