"""Напоминания о свиданиях (ТЗ 13.5).

Задача раз в 15 минут выбирает подтверждённые свидания, до которых осталось
меньше суток или меньше двух часов, и рассылает напоминание обоим.

Дедупликация — флагами `reminded_24h` / `reminded_2h` в самой записи,
а не памятью планировщика: иначе после рестарта контейнера напоминания
пришли бы повторно.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Final

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from app.db.models import DatePlan, DateStatus
from app.db.session import SessionLocal
from app.services import notifications, push_service, weather

logger = logging.getLogger(__name__)

INTERVAL_MINUTES: Final = 15


async def _tick() -> None:
    now = datetime.now(timezone.utc)

    async with SessionLocal() as session:
        plans = (
            await session.scalars(
                select(DatePlan).where(
                    DatePlan.status == DateStatus.confirmed,
                    DatePlan.scheduled_at > now,
                    DatePlan.scheduled_at <= now + timedelta(hours=24),
                )
            )
        ).all()

        for plan in plans:
            left = plan.scheduled_at - now

            # Порядок важен: если до свидания меньше двух часов, суточное
            # напоминание слать уже поздно — просто помечаем отправленным.
            if left <= timedelta(hours=2):
                if not plan.reminded_2h:
                    await notifications.reminder(
                        session, plan, hours=2, forecast=await weather.forecast(session, plan)
                    )
                    plan.reminded_2h = True
                plan.reminded_24h = True
            elif not plan.reminded_24h:
                # Ради этой строки напоминание за сутки и существует:
                # «завтра дождь» меняет планы, «завтра свидание» — нет.
                await notifications.reminder(
                    session, plan, hours=24, forecast=await weather.forecast(session, plan)
                )
                plan.reminded_24h = True

        await session.commit()


def start(scheduler: AsyncIOScheduler) -> None:
    if not push_service.is_configured():
        logger.info("VAPID не настроен — планировщик напоминаний не запускается")
        return

    scheduler.add_job(
        _tick,
        "interval",
        minutes=INTERVAL_MINUTES,
        id="reminders",
        # Пропущенные запуски не копим: смысл имеет только последний.
        coalesce=True,
        max_instances=1,
    )
    scheduler.start()
    logger.info("Напоминания включены, интервал %d мин", INTERVAL_MINUTES)
