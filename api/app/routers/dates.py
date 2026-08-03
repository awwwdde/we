"""Свидания: CRUD и лента (ТЗ 11).

Отправка приглашения (`/send`) появится в Фазе 6 вместе с токенами и
публичным экраном — здесь её намеренно нет, а не «есть заглушкой».
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Query, status
from sqlalchemy import or_, select

from app.db.models import DatePlan, DateStatus, User
from app.deps import CurrentUser, SessionDep
from app.errors import AppError
from app.schemas.dates import DateCreate, DateOut, DatePage, DatePatch
from app.services import dates_service as svc

router = APIRouter(prefix="/api/dates", tags=["dates"])

MAX_LIMIT = 50


async def _load(session: SessionDep, date_id: uuid.UUID, user: User) -> DatePlan:
    plan = await session.get(DatePlan, date_id)
    if plan is None:
        raise AppError("NOT_FOUND", "Свидание не найдено", status_code=404)
    svc.ensure_can_see(plan, user)
    return plan


async def _out(session: SessionDep, plan: DatePlan) -> DateOut:
    author = await session.get(User, plan.author_id)
    guest = await session.get(User, plan.guest_id)
    if author is None or guest is None:
        raise AppError("NOT_FOUND", "Участник свидания не найден", status_code=404)
    return svc.to_out(plan, author, guest)


@router.get("", response_model=DatePage)
async def list_dates(
    user: CurrentUser,
    session: SessionDep,
    date_status: DateStatus | None = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=1, le=MAX_LIMIT),
    cursor: str | None = None,
) -> DatePage:
    # Черновики видит только автор: показывать второму незаконченную задумку
    # значит испортить сюрприз.
    query = select(DatePlan).where(
        or_(
            DatePlan.author_id == user.id,
            (DatePlan.guest_id == user.id) & (DatePlan.status != DateStatus.draft),
        )
    )

    if date_status is not None:
        query = query.where(DatePlan.status == date_status)

    if cursor:
        moment, ident = svc.decode_cursor(cursor)
        query = query.where(
            (DatePlan.scheduled_at, DatePlan.id) < (moment, ident)  # type: ignore[operator]
        )

    # Берём на одну запись больше — так понятно, есть ли следующая страница.
    rows = (
        await session.scalars(
            query.order_by(DatePlan.scheduled_at.desc(), DatePlan.id.desc()).limit(limit + 1)
        )
    ).all()

    has_more = len(rows) > limit
    page = list(rows[:limit])
    for plan in page:
        svc.mark_done_if_past(plan)
    await session.commit()

    return DatePage(
        items=[await _out(session, plan) for plan in page],
        next_cursor=svc.encode_cursor(page[-1]) if has_more and page else None,
    )


@router.get("/upcoming", response_model=DateOut | None)
async def upcoming(user: CurrentUser, session: SessionDep) -> DateOut | None:
    """Ближайшее подтверждённое свидание — для главного экрана (ТЗ 11)."""
    plan = await session.scalar(
        select(DatePlan)
        .where(
            or_(DatePlan.author_id == user.id, DatePlan.guest_id == user.id),
            DatePlan.status == DateStatus.confirmed,
            DatePlan.scheduled_at >= datetime.now(timezone.utc),
        )
        .order_by(DatePlan.scheduled_at.asc())
        .limit(1)
    )
    return await _out(session, plan) if plan else None


@router.post("", response_model=DateOut, status_code=status.HTTP_201_CREATED)
async def create_date(payload: DateCreate, user: CurrentUser, session: SessionDep) -> DateOut:
    guest = await svc.other_user(session, user)

    plan = DatePlan(
        author_id=user.id,
        guest_id=guest.id,
        status=DateStatus.draft,
        scheduled_at=payload.scheduled_at,
        is_all_day=payload.is_all_day,
        note=payload.note,
    )
    svc.apply_place(plan, payload.place)

    session.add(plan)
    await session.commit()
    await session.refresh(plan)
    return svc.to_out(plan, user, guest)


@router.get("/{date_id}", response_model=DateOut)
async def get_date(date_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> DateOut:
    plan = await _load(session, date_id, user)
    svc.mark_done_if_past(plan)
    await session.commit()
    return await _out(session, plan)


@router.patch("/{date_id}", response_model=DateOut)
async def patch_date(
    date_id: uuid.UUID, payload: DatePatch, user: CurrentUser, session: SessionDep
) -> DateOut:
    plan = await _load(session, date_id, user)
    svc.ensure_author(plan, user)

    editable = plan.status in svc.EDITABLE_STATUSES

    if payload.note is not None:
        plan.note = payload.note

    # Дату, время и место после отправки приглашения менять нельзя: второй
    # человек уже согласился на конкретные условия (ТЗ 11).
    changes_plan = (
        payload.scheduled_at is not None
        or payload.is_all_day is not None
        or payload.place is not None
    )
    if changes_plan:
        if not editable:
            raise AppError(
                "ALREADY_SENT",
                "Приглашение уже отправлено — можно поменять только записку",
                status_code=409,
            )
        if payload.scheduled_at is not None:
            plan.scheduled_at = payload.scheduled_at
        if payload.is_all_day is not None:
            plan.is_all_day = payload.is_all_day
        if payload.place is not None:
            svc.apply_place(plan, payload.place)

    await session.commit()
    await session.refresh(plan)
    return await _out(session, plan)


@router.post("/{date_id}/cancel", response_model=DateOut)
async def cancel_date(date_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> DateOut:
    """Отменить может любой участник: передумать вправе оба."""
    plan = await _load(session, date_id, user)

    if plan.status in (DateStatus.cancelled, DateStatus.done):
        raise AppError("ALREADY_FINISHED", "Это свидание уже завершено", status_code=409)

    plan.status = DateStatus.cancelled
    await session.commit()
    await session.refresh(plan)
    return await _out(session, plan)


@router.delete("/{date_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_date(date_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> None:
    """Удалять можно только черновик — отправленное приглашение отменяют."""
    plan = await _load(session, date_id, user)
    svc.ensure_author(plan, user)

    if plan.status is not DateStatus.draft:
        raise AppError("NOT_DRAFT", "Удалить можно только черновик", status_code=409)

    await session.delete(plan)
    await session.commit()
