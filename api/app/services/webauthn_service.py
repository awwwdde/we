"""WebAuthn: регистрация и вход по passkey (ТЗ 9.4, 9.5).

Пароля в системе не существует. Passkey лежит в Apple Keychain / Google
Password Manager и разблокируется биометрией.

Challenge живёт короткоживущей строкой в Postgres (в ТЗ был Redis, но
платформа его не даёт — см. DEPLOY.md). Какой именно challenge проверять,
сервер узнаёт по httpOnly-cookie с id строки: так форма ответа остаётся
ровно такой, как описана в ТЗ 11, а идентификатор не попадает в JS.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Final

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import options_to_json
from webauthn.helpers.exceptions import (
    InvalidAuthenticationResponse,
    InvalidRegistrationResponse,
)
from webauthn.helpers.structs import (
    AuthenticatorAttachment,
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialCreationOptions,
    PublicKeyCredentialDescriptor,
    PublicKeyCredentialRequestOptions,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from app.config import settings
from app.db.models import ChallengeKind, Credential, User, WebAuthnChallenge

CHALLENGE_TTL: Final = timedelta(minutes=5)
CHALLENGE_COOKIE: Final = "pg_challenge"


class WebAuthnError(Exception):
    """Ошибка проверки passkey."""


# ── Challenge ────────────────────────────────────────────────────────────────


async def _store_challenge(
    session: AsyncSession,
    kind: ChallengeKind,
    challenge: bytes,
    invite_code_id: uuid.UUID | None = None,
) -> uuid.UUID:
    row = WebAuthnChallenge(
        kind=kind,
        challenge=challenge,
        invite_code_id=invite_code_id,
        expires_at=datetime.now(timezone.utc) + CHALLENGE_TTL,
    )
    session.add(row)
    await session.flush()
    return row.id


async def consume_challenge(
    session: AsyncSession, challenge_id: uuid.UUID, kind: ChallengeKind
) -> WebAuthnChallenge:
    """Забрать challenge и сразу пометить использованным (он одноразовый)."""
    row = await session.scalar(
        select(WebAuthnChallenge).where(WebAuthnChallenge.id == challenge_id)
    )
    if row is None or row.kind is not kind:
        raise WebAuthnError("Запрос устарел, начните заново")
    if row.consumed_at is not None:
        raise WebAuthnError("Запрос уже использован")
    if row.expires_at <= datetime.now(timezone.utc):
        raise WebAuthnError("Запрос устарел, начните заново")

    row.consumed_at = datetime.now(timezone.utc)
    return row


# ── Регистрация ──────────────────────────────────────────────────────────────


async def build_registration_options(
    session: AsyncSession, user: User, invite_code_id: uuid.UUID
) -> tuple[str, uuid.UUID]:
    """Опции создания passkey. Возвращает (JSON, id challenge)."""
    existing = (
        await session.scalars(select(Credential).where(Credential.user_id == user.id))
    ).all()

    options: PublicKeyCredentialCreationOptions = generate_registration_options(
        rp_id=settings.rp_id,
        rp_name=settings.rp_name,
        user_id=user.id.bytes,
        user_name=user.username,
        user_display_name=user.display_name,
        authenticator_selection=AuthenticatorSelectionCriteria(
            # Только встроенная биометрия устройства — не внешние ключи.
            authenticator_attachment=AuthenticatorAttachment.PLATFORM,
            # discoverable credential: даёт вход вообще без ввода логина.
            resident_key=ResidentKeyRequirement.REQUIRED,
            # принудительный Face ID / Touch ID
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
        # Не даём завести второй passkey поверх уже существующего на этом же
        # устройстве — иначе в связке появятся дубли.
        exclude_credentials=[
            PublicKeyCredentialDescriptor(id=cred.credential_id) for cred in existing
        ],
    )

    challenge_id = await _store_challenge(
        session, ChallengeKind.registration, options.challenge, invite_code_id
    )
    return options_to_json(options), challenge_id


async def verify_registration(
    session: AsyncSession,
    user: User,
    credential_json: str,
    challenge: bytes,
    device_label: str | None,
) -> Credential:
    try:
        verified = verify_registration_response(
            credential=credential_json,
            expected_challenge=challenge,
            expected_rp_id=settings.rp_id,
            expected_origin=settings.origin,
            require_user_verification=True,
        )
    except (InvalidRegistrationResponse, ValueError) as exc:
        raise WebAuthnError("Не удалось подтвердить passkey") from exc

    credential = Credential(
        user_id=user.id,
        credential_id=verified.credential_id,
        public_key=verified.credential_public_key,
        sign_count=verified.sign_count,
        device_label=device_label,
    )
    session.add(credential)
    return credential


# ── Вход ─────────────────────────────────────────────────────────────────────


async def build_authentication_options(session: AsyncSession) -> tuple[str, uuid.UUID]:
    options: PublicKeyCredentialRequestOptions = generate_authentication_options(
        rp_id=settings.rp_id,
        user_verification=UserVerificationRequirement.REQUIRED,
        # Пустой список — намеренно: именно он включает usernameless-вход
        # через discoverable credentials (ТЗ 9.5).
        allow_credentials=[],
    )
    challenge_id = await _store_challenge(
        session, ChallengeKind.authentication, options.challenge
    )
    return options_to_json(options), challenge_id


async def verify_authentication(
    session: AsyncSession, credential_json: str, challenge: bytes, raw_id: bytes
) -> Credential:
    stored = await session.scalar(
        select(Credential).where(Credential.credential_id == raw_id)
    )
    if stored is None:
        raise WebAuthnError("Этот ключ не привязан")

    try:
        verified = verify_authentication_response(
            credential=credential_json,
            expected_challenge=challenge,
            expected_rp_id=settings.rp_id,
            expected_origin=settings.origin,
            credential_public_key=stored.public_key,
            credential_current_sign_count=stored.sign_count,
            require_user_verification=True,
        )
    except (InvalidAuthenticationResponse, ValueError) as exc:
        raise WebAuthnError("Не удалось подтвердить вход") from exc

    _check_sign_count(stored.sign_count, verified.new_sign_count)

    stored.sign_count = verified.new_sign_count
    stored.last_used_at = datetime.now(timezone.utc)
    return stored


def _check_sign_count(stored: int, received: int) -> None:
    """Защита от клонированного ключа (ТЗ 9.5).

    Счётчик обязан расти. Исключение — аутентификаторы, которые его вообще
    не ведут и всегда присылают 0: так работает passkey из iCloud Keychain,
    и это валидный случай, а не клон.
    """
    if stored == 0 and received == 0:
        return
    if received <= stored:
        raise WebAuthnError("Ключ отклонён: признак клонирования")
