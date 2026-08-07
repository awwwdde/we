"""Внутренняя лента уведомлений (ТЗ 13.6).

Сюда попадает всё, что уходит в push, — и остаётся здесь, даже если push
не доехал. Пагинации нет намеренно: пользователей ровно двое, событий
десятки в год, а курсор ради двадцати строк в месяц — сложность без повода.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Query, status
from sqlalchemy import func, select, update

from app.db.models import Notification
from app.deps import CurrentUser, SessionDep
from app.schemas.notifications import NotificationFeed, NotificationOut

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

MAX_LIMIT = 50


@router.get("", response_model=NotificationFeed)
async def list_notifications(
    user: CurrentUser,
    session: SessionDep,
    limit: int = Query(default=30, ge=1, le=MAX_LIMIT),
) -> NotificationFeed:
    rows = (
        await session.scalars(
            select(Notification)
            .where(Notification.user_id == user.id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
        )
    ).all()

    unread = await session.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
    )

    return NotificationFeed(
        items=[NotificationOut.model_validate(row) for row in rows],
        unread=unread or 0,
    )


@router.post("/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(user: CurrentUser, session: SessionDep) -> None:
    """Открыл ленту — прочитал всё.

    Отдельная отметка на каждую строку здесь была бы враньём: события
    короткие, человек видит их все одним экраном.
    """
    await session.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
        .values(read_at=datetime.now(timezone.utc))
    )
    await session.commit()
