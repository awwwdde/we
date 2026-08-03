"""Логика свиданий: сборка ответа и переходы статусов."""

import base64
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import DatePlan, DateStatus, PlaceSource, User
from app.errors import AppError
from app.schemas.dates import DateOut, PersonBrief, PlaceSnapshot

# Статусы, которые ещё можно править целиком (ТЗ 11: после pending — только note).
EDITABLE_STATUSES = frozenset({DateStatus.draft})


async def other_user(session: AsyncSession, user: User) -> User:
    """Второй участник.

    Пользователей ровно два и больше не будет (ТЗ 20), поэтому «гость» —
    это просто тот, кто не автор. Отдельного выбора получателя нет.
    """
    partner = await session.scalar(select(User).where(User.id != user.id))
    if partner is None:
        raise AppError(
            "NO_PARTNER",
            "Второй пользователь ещё не заведён. Создайте его через CLI.",
            status_code=409,
        )
    return partner


def to_out(plan: DatePlan, author: User, guest: User) -> DateOut:
    return DateOut(
        id=plan.id,
        status=plan.status,
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
            payload=plan.place_payload,
        ),
        author=PersonBrief(id=author.id, display_name=author.display_name, color=author.color.value),
        guest=PersonBrief(id=guest.id, display_name=guest.display_name, color=guest.color.value),
        created_at=plan.created_at,
        confirmed_at=plan.confirmed_at,
    )


def apply_place(plan: DatePlan, place: PlaceSnapshot) -> None:
    """Скопировать место в свидание. Именно скопировать (ТЗ 12.5)."""
    plan.place_source = PlaceSource(place.source)
    plan.place_external_id = place.external_id
    plan.place_name = place.name
    plan.place_category = place.category
    plan.place_address = place.address
    plan.place_lat = place.lat
    plan.place_lon = place.lon
    plan.place_photo_url = place.photo_url
    plan.place_payload = place.payload


def ensure_can_see(plan: DatePlan, user: User) -> None:
    """Кто вправе видеть свидание.

    Автор — всегда. Гость — только после того, как приглашение отправлено:
    черновик это незаконченная задумка, и подсмотреть её по прямой ссылке
    значит испортить сюрприз. Отвечаем 404, а не 403: сам факт, что вторая
    половина что-то готовит, тоже часть сюрприза.
    """
    if user.id == plan.author_id:
        return
    if user.id == plan.guest_id and plan.status is not DateStatus.draft:
        return
    raise AppError("NOT_FOUND", "Свидание не найдено", status_code=404)


def ensure_author(plan: DatePlan, user: User) -> None:
    if plan.author_id != user.id:
        raise AppError("FORBIDDEN", "Это свидание задумал не ты", status_code=403)


# ── Курсор пагинации ─────────────────────────────────────────────────────────
#
# Курсор — это пара (scheduled_at, id) в base64. Пары, а не одной даты:
# два свидания могут быть назначены на одну минуту, и по одной дате
# страница зациклилась бы.


def encode_cursor(plan: DatePlan) -> str:
    raw = f"{plan.scheduled_at.isoformat()}|{plan.id}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii")


def decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("ascii")).decode("utf-8")
        moment, ident = raw.split("|", 1)
        return datetime.fromisoformat(moment), uuid.UUID(ident)
    except (ValueError, UnicodeDecodeError) as exc:
        raise AppError("BAD_CURSOR", "Некорректный курсор") from exc


def mark_done_if_past(plan: DatePlan) -> None:
    """Подтверждённое свидание, время которого прошло, становится `done`.

    Отдельного планировщика для этого не нужно: статус вычисляется в момент
    чтения, и лента истории всегда честная.
    """
    if plan.status is DateStatus.confirmed and plan.scheduled_at < datetime.now(timezone.utc):
        plan.status = DateStatus.done
