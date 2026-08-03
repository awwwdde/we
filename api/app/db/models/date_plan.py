"""Свидание — основная сущность приложения (ТЗ 10).

Модуль назван `date_plan`, а не `date`: имя `date` заняли бы одновременно
`datetime.date` и таблица, и читать такой код было бы больно.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DateStatus(str, enum.Enum):
    draft = "draft"  # черновик, виден только автору
    pending = "pending"  # приглашение отправлено, ответа нет
    confirmed = "confirmed"  # подтверждено — единственный повод для lime
    declined = "declined"
    cancelled = "cancelled"
    done = "done"  # прошло


class PlaceSource(str, enum.Enum):
    # yandex остался в enum на случай, если платный ключ однажды появится;
    # сейчас основной справочник — OSM (см. DEPLOY.md).
    yandex = "yandex"
    osm = "osm"
    twogis = "twogis"
    kudago = "kudago"
    custom = "custom"


NOTE_MAX_LENGTH = 280


class DatePlan(Base):
    __tablename__ = "dates"
    __table_args__ = (
        CheckConstraint(f"char_length(note) <= {NOTE_MAX_LENGTH}", name="ck_dates_note_length"),
        Index("idx_dates_scheduled", text("scheduled_at DESC")),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    guest_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    status: Mapped[DateStatus] = mapped_column(
        SAEnum(DateStatus, name="date_status", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        server_default=DateStatus.draft.value,
    )

    # Всё время хранится в UTC, показывается в Europe/Moscow (ТЗ 10).
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_all_day: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── СНИМОК места, а не ссылка (ТЗ 12.5) ──────────────────────────────────
    # Ресторан закроется, KudaGo удалит прошедшее событие, провайдер сменит
    # формат ответа — и вся история превратится в «место не найдено».
    # Копия полей делает запись о свидании самодостаточной навсегда.
    place_source: Mapped[PlaceSource] = mapped_column(
        SAEnum(PlaceSource, name="place_source", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    place_external_id: Mapped[str | None] = mapped_column(String, nullable=True)
    place_name: Mapped[str] = mapped_column(String, nullable=False)
    place_category: Mapped[str | None] = mapped_column(String, nullable=True)
    place_address: Mapped[str | None] = mapped_column(String, nullable=True)
    place_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    place_lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    place_photo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    # Сырой ответ провайдера на момент выбора — для отладки и восстановления.
    place_payload: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
