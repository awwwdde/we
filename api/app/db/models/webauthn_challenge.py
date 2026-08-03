"""Challenge WebAuthn на 5 минут.

В ТЗ 9.4 он лежал в Redis, но платформа awwwdde не даёт гостю Redis
(см. DEPLOY.md), поэтому challenge живёт короткоживущей строкой в Postgres.
Смысл тот же: одноразовое случайное значение с TTL.

Какой именно challenge проверять на шаге verify, сервер узнаёт по httpOnly
cookie с id строки. Cookie выбрана вместо поля в JSON, чтобы форма ответа
осталась ровно такой, как описана в ТЗ 11 (`PublicKeyCredentialCreationOptions`
без посторонних полей), а идентификатор не попадал в JS.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, LargeBinary, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ChallengeKind(str, enum.Enum):
    registration = "registration"
    authentication = "authentication"


class WebAuthnChallenge(Base):
    __tablename__ = "webauthn_challenges"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    kind: Mapped[ChallengeKind] = mapped_column(
        SAEnum(ChallengeKind, name="challenge_kind", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    challenge: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    # Для регистрации — инвайт, по которому она идёт (ТЗ: ключ = invite_code).
    invite_code_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invite_codes.id", ondelete="CASCADE"), nullable=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
