"""Приглашения: отправка и публичный ответ (ТЗ 11).

Эндпоинты `/api/invites/*` **публичные** — их открывает второй человек,
у которого в этом браузере нет сессии. Знание токена и есть доступ (ТЗ 2.3).
Отсюда два следствия: rate limit по IP и ни одного внутреннего ID в ответе.
"""

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Final

from fastapi import APIRouter
from sqlalchemy import select

from app.config import settings
from app.db.models import DatePlan, DateStatus, Invite, User
from app.deps import ClientIp, CurrentUser, SessionDep
from app.errors import AppError
from app.schemas.dates import PlaceSnapshot
from app.schemas.invites import InvitePublic, InviteResponse, SendResult
from app.services import dates_service as svc
from app.services import notifications, rate_limit

router = APIRouter(tags=["invites"])

# ТЗ 16: токен приглашения — `secrets.token_urlsafe(24)`, живёт 7 дней.
TOKEN_BYTES: Final = 24
INVITE_TTL: Final = timedelta(days=7)


async def _load_invite(session: SessionDep, token: str) -> Invite:
    invite = await session.scalar(select(Invite).where(Invite.token == token))
    if invite is None:
        raise AppError("INVITE_NOT_FOUND", "Приглашение не найдено", status_code=404)
    if invite.expires_at <= datetime.now(timezone.utc):
        raise AppError("INVITE_EXPIRED", "Приглашение истекло", status_code=410)
    return invite


def _guard_public(ip: str) -> None:
    """Rate limit на публичные эндпоинты: 20 запросов в минуту на IP (ТЗ 16)."""
    try:
        rate_limit.check(f"invite:{ip}", rate_limit.PUBLIC_LIMIT)
    except rate_limit.RateLimited as exc:
        raise AppError("RATE_LIMITED", "Слишком много запросов", status_code=429) from exc


async def _build_public(session: SessionDep, invite: Invite) -> InvitePublic:
    plan = await session.get(DatePlan, invite.date_id)
    if plan is None:
        raise AppError("INVITE_NOT_FOUND", "Приглашение не найдено", status_code=404)

    author = await session.get(User, plan.author_id)
    if author is None:
        raise AppError("INVITE_NOT_FOUND", "Приглашение не найдено", status_code=404)

    return InvitePublic(
        author_name=author.display_name,
        author_color=author.color.value,
        scheduled_at=plan.scheduled_at,
        is_all_day=plan.is_all_day,
        note=plan.note,
        place=PlaceSnapshot(
            source=plan.place_source,
            external_id=plan.place_external_id,
            name=plan.place_name,
            category=plan.place_category,
            address=plan.place_address,
            lat=plan.place_lat,
            lon=plan.place_lon,
            photo_url=plan.place_photo_url,
        ),
        answered=invite.responded_at is not None,
        accepted=plan.status is DateStatus.confirmed,
    )


# ── Отправка (требует входа) ─────────────────────────────────────────────────


@router.post("/api/dates/{date_id}/send", response_model=SendResult)
async def send_invite(date_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> SendResult:
    """`draft` → `pending`, создаёт приглашение и отдаёт ссылку (ТЗ 11)."""
    plan = await session.get(DatePlan, date_id)
    if plan is None:
        raise AppError("NOT_FOUND", "Свидание не найдено", status_code=404)

    # Сначала видимость, потом права: для гостя чужой черновик не существует
    # вовсе, и отвечать 403 нельзя — это подтвердило бы, что свидание есть.
    svc.ensure_can_see(plan, user)
    svc.ensure_author(plan, user)

    if plan.status not in (DateStatus.draft, DateStatus.pending):
        raise AppError(
            "NOT_SENDABLE", "Это свидание больше не ждёт отправки", status_code=409
        )

    now = datetime.now(timezone.utc)

    # Уже отправленное — отдаём ту же ссылку, а не ошибку. Иначе ссылка,
    # потерянная вместе с закрытым share-sheet, пропадала бы навсегда,
    # и отправить приглашение второй раз было бы нечем.
    existing = await session.scalar(
        select(Invite)
        .where(
            Invite.date_id == plan.id,
            Invite.responded_at.is_(None),
            Invite.expires_at > now,
        )
        .order_by(Invite.created_at.desc())
        .limit(1)
    )
    if existing is not None:
        return SendResult(
            token=existing.token,
            url=f"{settings.origin}/i/{existing.token}",
            expires_at=existing.expires_at,
        )

    invite = Invite(
        date_id=plan.id,
        token=secrets.token_urlsafe(TOKEN_BYTES),
        expires_at=now + INVITE_TTL,
    )
    plan.status = DateStatus.pending

    session.add(invite)
    await session.commit()

    # Гостю: «кто-то что-то задумал». Подробностей нет — это сюрприз.
    await notifications.invite_sent(session, plan, user)

    # Ссылку собираем от публичного адреса, а не от заголовка Host:
    # его можно подделать, а приглашение уходит наружу.
    return SendResult(
        token=invite.token,
        url=f"{settings.origin}/i/{invite.token}",
        expires_at=invite.expires_at,
    )


# ── Публичное (без входа) ────────────────────────────────────────────────────


@router.get("/api/invites/{token}", response_model=InvitePublic)
async def read_invite(token: str, session: SessionDep, ip: ClientIp) -> InvitePublic:
    _guard_public(ip)
    invite = await _load_invite(session, token)

    # Отметка об открытии — по ней автору уходит push «читает твоё
    # приглашение» (ТЗ 13.5). Ставится один раз: повторные заходы не в счёт.
    if invite.opened_at is None:
        invite.opened_at = datetime.now(timezone.utc)
        await session.commit()

        plan = await session.get(DatePlan, invite.date_id)
        guest = await session.get(User, plan.guest_id) if plan else None
        if plan is not None and guest is not None:
            await notifications.invite_opened(session, plan, guest.display_name)

    return await _build_public(session, invite)


@router.post("/api/invites/{token}/respond", response_model=InvitePublic)
async def respond_to_invite(
    token: str, payload: InviteResponse, session: SessionDep, ip: ClientIp
) -> InvitePublic:
    _guard_public(ip)
    invite = await _load_invite(session, token)

    plan = await session.get(DatePlan, invite.date_id)
    if plan is None:
        raise AppError("INVITE_NOT_FOUND", "Приглашение не найдено", status_code=404)

    if invite.responded_at is not None:
        raise AppError("ALREADY_ANSWERED", "Ответ уже дан", status_code=409)

    # Отменённое свидание подтвердить нельзя: автор мог передумать, пока
    # приглашение лежало непрочитанным.
    if plan.status is not DateStatus.pending:
        raise AppError("NOT_PENDING", "Это свидание больше не ждёт ответа", status_code=409)

    now = datetime.now(timezone.utc)
    invite.responded_at = now
    invite.evade_count = payload.evade_count

    if payload.accepted:
        plan.status = DateStatus.confirmed
        plan.confirmed_at = now
    else:
        plan.status = DateStatus.declined

    await session.commit()

    if payload.accepted:
        await notifications.invite_confirmed(session, plan)
    else:
        await notifications.invite_declined(session, plan)

    return await _build_public(session, invite)
