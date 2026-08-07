"""События уведомлений (ТЗ 13.5).

| Событие | Кому | Текст |
|---|---|---|
| Приглашение отправлено | гостю | «{Имя} что-то задумал(а)» |
| Приглашение открыто | автору | «{Имя} читает твоё приглашение» |
| Подтверждено | автору | «Свидание подтверждено · {дата}» |
| За сутки | обоим | «Завтра в {время} — {место}» |
| За 2 часа | обоим | «Через 2 часа. {место}» |

Тексты держим здесь, а не по месту вызова: так их видно списком и легко
править, не перечитывая роутеры.
"""

import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import DatePlan, User
from app.services.push_service import Notification, send_to_user


def _local(moment: datetime) -> datetime:
    """Время показывается в Москве, а не в таймзоне сервера (ТЗ 10)."""
    return moment.astimezone(ZoneInfo(settings.timezone))


def _time(plan: DatePlan) -> str:
    return "весь день" if plan.is_all_day else _local(plan.scheduled_at).strftime("%H:%M")


def _date(plan: DatePlan) -> str:
    moment = _local(plan.scheduled_at)
    months = (
        "января", "февраля", "марта", "апреля", "мая", "июня",
        "июля", "августа", "сентября", "октября", "ноября", "декабря",
    )
    return f"{moment.day} {months[moment.month - 1]}"


async def invite_sent(session: AsyncSession, plan: DatePlan, author: User) -> None:
    """Гостю: кто-то что-то задумал. Без подробностей — это сюрприз."""
    await send_to_user(
        session,
        plan.guest_id,
        Notification(
            title="Перигей",
            body=f"{author.display_name} что-то задумал(а)",
            url="/",
            tag=f"invite:{plan.id}",
        ),
    )


async def invite_opened(session: AsyncSession, plan: DatePlan, guest_name: str) -> None:
    await send_to_user(
        session,
        plan.author_id,
        Notification(
            title="Перигей",
            body=f"{guest_name} читает твоё приглашение",
            url=f"/date/{plan.id}",
            tag=f"opened:{plan.id}",
        ),
    )


async def invite_confirmed(session: AsyncSession, plan: DatePlan) -> None:
    await send_to_user(
        session,
        plan.author_id,
        Notification(
            title="Свидание подтверждено",
            body=_date(plan),
            url=f"/date/{plan.id}",
            tag=f"confirmed:{plan.id}",
        ),
    )


async def reminder(session: AsyncSession, plan: DatePlan, hours: int) -> None:
    """Напоминание обоим участникам."""
    if hours == 24:
        body = f"Завтра в {_time(plan)} — {plan.place_name}"
    else:
        body = f"Через {hours} часа. {plan.place_name}"

    notification = Notification(
        title="Перигей",
        body=body,
        url=f"/date/{plan.id}",
        tag=f"remind:{plan.id}:{hours}",
    )

    for user_id in _participants(plan):
        await send_to_user(session, user_id, notification)


def _participants(plan: DatePlan) -> tuple[uuid.UUID, uuid.UUID]:
    return (plan.author_id, plan.guest_id)
