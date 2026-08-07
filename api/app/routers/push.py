"""Подписки на уведомления (ТЗ 11, 13)."""

from fastapi import APIRouter, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert

from app.config import settings
from app.db.models import PushSubscription
from app.deps import CurrentUser, SessionDep
from app.errors import AppError
from app.services import push_service

router = APIRouter(prefix="/api/push", tags=["push"])


class VapidKey(BaseModel):
    public_key: str


class SubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class SubscriptionIn(BaseModel):
    """То, что отдаёт `PushSubscription.toJSON()` в браузере."""

    endpoint: str = Field(min_length=1)
    keys: SubscriptionKeys


class UnsubscribeIn(BaseModel):
    endpoint: str


@router.get("/vapid-public-key", response_model=VapidKey)
async def vapid_public_key(user: CurrentUser) -> VapidKey:
    """Публичный ключ не секретен — он и должен попасть во фронтенд."""
    if not push_service.is_configured():
        raise AppError(
            "PUSH_NOT_CONFIGURED",
            "Уведомления не настроены: не заданы ключи VAPID",
            status_code=503,
        )
    return VapidKey(public_key=settings.vapid_public_key)


@router.post("/subscribe", status_code=status.HTTP_204_NO_CONTENT)
async def subscribe(
    payload: SubscriptionIn, user: CurrentUser, session: SessionDep, request: Request
) -> None:
    # Один и тот же endpoint может прийти повторно (переустановка, обновление
    # ключей) — обновляем строку, а не плодим дубли.
    statement = (
        insert(PushSubscription)
        .values(
            user_id=user.id,
            endpoint=payload.endpoint,
            p256dh=payload.keys.p256dh,
            auth=payload.keys.auth,
            user_agent=request.headers.get("User-Agent"),
        )
        .on_conflict_do_update(
            index_elements=[PushSubscription.endpoint],
            set_={
                "user_id": user.id,
                "p256dh": payload.keys.p256dh,
                "auth": payload.keys.auth,
                "failed_at": None,
            },
        )
    )
    await session.execute(statement)
    await session.commit()


@router.post("/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(payload: UnsubscribeIn, user: CurrentUser, session: SessionDep) -> None:
    await session.execute(
        delete(PushSubscription).where(
            PushSubscription.endpoint == payload.endpoint,
            PushSubscription.user_id == user.id,
        )
    )
    await session.commit()


class PushStatus(BaseModel):
    configured: bool
    subscriptions: int


@router.get("/status", response_model=PushStatus)
async def push_status(user: CurrentUser, session: SessionDep) -> PushStatus:
    """Сколько устройств подписано — для экрана настроек."""
    rows = (
        await session.scalars(
            select(PushSubscription).where(PushSubscription.user_id == user.id)
        )
    ).all()
    return PushStatus(configured=push_service.is_configured(), subscriptions=len(rows))


@router.post("/test", status_code=status.HTTP_204_NO_CONTENT)
async def send_test(user: CurrentUser, session: SessionDep) -> None:
    """Проверка канала: доставка не гарантирована, но хоть что-то видно."""
    delivered = await push_service.send_to_user(
        session,
        user.id,
        push_service.Notification(
            title="Перигей",
            body="Уведомления работают.",
            tag="test",
        ),
    )
    if delivered == 0:
        raise AppError(
            "PUSH_NOT_DELIVERED",
            "Ни одно устройство не приняло уведомление",
            status_code=503,
        )
