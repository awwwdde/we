"""События уведомлений (ТЗ 13.5, 13.6).

| Событие | Кому | Текст |
|---|---|---|
| Приглашение отправлено | гостю | «{Имя} что-то задумал(а)» |
| Приглашение открыто | автору | «{Имя} читает твоё приглашение» |
| Подтверждено | автору | «Свидание подтверждено · {дата}» |
| За сутки | обоим | «Завтра в {время} — {место}» |
| За 2 часа | обоим | «Через 2 часа. {место}» |

Сверх таблицы — отмена (её требует контракт ТЗ 11) и отказ: иначе автор
приглашения не узнаёт об ответе никак.

**Каждое событие уходит в два канала сразу** — push и внутренняя лента
(ТЗ 13.6). Единственная точка, где это происходит, — `_deliver`: если
записывать ленту по месту вызова, рано или поздно появится событие,
доехавшее только push-ом и потерянное на iOS.

Тексты держим здесь, а не по месту вызова: так их видно списком и легко
править, не перечитывая роутеры.
"""

import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import DatePlan, Notification, NotificationKind, User
from app.schemas.weather import WeatherOut
from app.services.push_service import Notification as PushMessage, send_to_user


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


async def _deliver(
    session: AsyncSession,
    user_id: uuid.UUID,
    kind: NotificationKind,
    message: PushMessage,
    date_id: uuid.UUID | None,
) -> None:
    """Записать событие в ленту и попробовать доставить push.

    Порядок именно такой: лента — обязательство, push — попытка. Отправка
    ходит в сеть и может занять секунды, а строка должна существовать
    независимо от того, чем эта попытка кончилась.
    """
    session.add(
        Notification(
            user_id=user_id,
            kind=kind,
            title=message.title,
            body=message.body,
            url=message.url,
            date_id=date_id,
        )
    )
    await session.commit()

    await send_to_user(session, user_id, message)


async def invite_sent(session: AsyncSession, plan: DatePlan, author: User) -> None:
    """Гостю: кто-то что-то задумал. Без подробностей — это сюрприз."""
    await _deliver(
        session,
        plan.guest_id,
        NotificationKind.invite_sent,
        PushMessage(
            title="Перигей",
            body=f"{author.display_name} что-то задумал(а)",
            url="/",
            tag=f"invite:{plan.id}",
        ),
        plan.id,
    )


async def invite_opened(session: AsyncSession, plan: DatePlan, guest_name: str) -> None:
    await _deliver(
        session,
        plan.author_id,
        NotificationKind.invite_opened,
        PushMessage(
            title="Перигей",
            body=f"{guest_name} читает твоё приглашение",
            url=f"/date/{plan.id}",
            tag=f"opened:{plan.id}",
        ),
        plan.id,
    )


async def invite_confirmed(session: AsyncSession, plan: DatePlan) -> None:
    await _deliver(
        session,
        plan.author_id,
        NotificationKind.confirmed,
        PushMessage(
            title="Свидание подтверждено",
            body=_date(plan),
            url=f"/date/{plan.id}",
            tag=f"confirmed:{plan.id}",
        ),
        plan.id,
    )


async def invite_declined(session: AsyncSession, plan: DatePlan) -> None:
    """Автору: ответили «нет».

    В таблице ТЗ 13.5 события нет, но молчать здесь нельзя: приглашение
    просто перестало ждать ответа, и без сообщения это выглядит как
    «ничего не произошло».
    """
    await _deliver(
        session,
        plan.author_id,
        NotificationKind.declined,
        PushMessage(
            title="Перигей",
            body=f"На {_date(plan)} не получилось",
            url=f"/date/{plan.id}",
            tag=f"declined:{plan.id}",
        ),
        plan.id,
    )


async def date_cancelled(session: AsyncSession, plan: DatePlan, by: User) -> None:
    """Второму участнику: свидание отменено (ТЗ 11).

    Отменивший уведомление не получает — он и так знает.
    """
    other = plan.guest_id if by.id == plan.author_id else plan.author_id

    await _deliver(
        session,
        other,
        NotificationKind.cancelled,
        PushMessage(
            title="Свидание отменено",
            body=f"{_date(plan)} — не в этот раз",
            url=f"/date/{plan.id}",
            tag=f"cancelled:{plan.id}",
        ),
        plan.id,
    )


def _weather_tail(forecast: WeatherOut | None) -> str:
    """Хвост про погоду. Пусто, если прогноза нет — извиняться не за что.

    Вероятность осадков добавляем только когда она заметная: «дождь, 10%»
    в напоминании — шум, из-за которого перестают читать и остальное.
    """
    if forecast is None:
        return ""

    chance = forecast.precipitation_chance
    tail = f" · {forecast.temp_c:+d}°, {forecast.description}"
    if chance is not None and chance >= 40:
        tail += f", {chance}%"
    return tail


async def reminder(
    session: AsyncSession,
    plan: DatePlan,
    hours: int,
    forecast: WeatherOut | None = None,
) -> None:
    """Напоминание обоим участникам.

    Прогноз — главное, ради чего оно вообще нужно за сутки: «завтра дождь»
    меняет планы, а «завтра свидание» человек и так помнит.
    """
    if hours == 24:
        body = f"Завтра в {_time(plan)} — {plan.place_name}{_weather_tail(forecast)}"
        kind = NotificationKind.reminder_24h
    else:
        body = f"Через {hours} часа. {plan.place_name}{_weather_tail(forecast)}"
        kind = NotificationKind.reminder_2h

    message = PushMessage(
        title="Перигей",
        body=body,
        url=f"/date/{plan.id}",
        tag=f"remind:{plan.id}:{hours}",
    )

    for user_id in _participants(plan):
        await _deliver(session, user_id, kind, message, plan.id)


def _participants(plan: DatePlan) -> tuple[uuid.UUID, uuid.UUID]:
    return (plan.author_id, plan.guest_id)
