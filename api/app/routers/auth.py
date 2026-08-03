"""Аутентификация по passkey (ТЗ 9, контракт ТЗ 11).

Пароля нет. Первый passkey привязывается по одноразовому инвайт-коду из CLI,
дальнейшие устройства — по коду из настроек. Потеря всех устройств лечится
кодом восстановления.
"""

import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Final

from fastapi import APIRouter, Cookie, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from webauthn.helpers import base64url_to_bytes

from app.config import settings
from app.db.models import ChallengeKind, Credential, InviteCode, RecoveryCode, User
from app.deps import ClientIp, CurrentUser, SessionDep
from app.errors import AppError
from app.schemas.auth import (
    AccessOut,
    DeviceInviteOut,
    DeviceOut,
    LoginVerifyIn,
    RecoveryIn,
    RegisterOptionsIn,
    RegisterVerifyIn,
    RegisterVerifyOut,
    SessionOut,
    UserOut,
)
from app.services import rate_limit, webauthn_service as wa
from app.services.codes import generate_code, hash_code, verify_code
from app.services.tokens import (
    REFRESH_COOKIE,
    REFRESH_TTL,
    TokenError,
    create_access_token,
    issue_refresh_token,
    revoke_all_for_user,
    revoke_refresh_token,
    rotate_refresh_token,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

RECOVERY_CODES_COUNT: Final = 10
DEVICE_INVITE_TTL: Final = timedelta(minutes=10)


# ── Cookies ──────────────────────────────────────────────────────────────────


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        REFRESH_COOKIE,
        token,
        max_age=int(REFRESH_TTL.total_seconds()),
        httponly=True,
        secure=settings.is_https,
        samesite="lax",
        path="/api/auth",
    )


def _set_challenge_cookie(response: Response, challenge_id: uuid.UUID) -> None:
    response.set_cookie(
        wa.CHALLENGE_COOKIE,
        str(challenge_id),
        max_age=int(wa.CHALLENGE_TTL.total_seconds()),
        httponly=True,
        secure=settings.is_https,
        samesite="lax",
        path="/api/auth",
    )


def _clear(response: Response, name: str) -> None:
    response.delete_cookie(name, path="/api/auth")


def _parse_challenge_cookie(raw: str | None) -> uuid.UUID:
    if not raw:
        raise AppError("CHALLENGE_MISSING", "Запрос устарел, начните заново")
    try:
        return uuid.UUID(raw)
    except ValueError as exc:
        raise AppError("CHALLENGE_MISSING", "Запрос устарел, начните заново") from exc


# ── Регистрация passkey ──────────────────────────────────────────────────────


async def _find_valid_invite(session: SessionDep, code: str) -> InviteCode:
    """Найти неиспользованный непросроченный инвайт по коду.

    Коды хранятся хэшем Argon2, по коду не найти строку индексом — приходится
    перебирать живые инвайты. Их единицы, так что это дёшево.
    """
    now = datetime.now(timezone.utc)
    candidates = (
        await session.scalars(
            select(InviteCode).where(InviteCode.used_at.is_(None), InviteCode.expires_at > now)
        )
    ).all()

    for invite in candidates:
        if verify_code(code, invite.code_hash):
            return invite
    raise AppError("INVITE_INVALID", "Код не подошёл или истёк")


@router.post("/register/options")
async def register_options(
    payload: RegisterOptionsIn, session: SessionDep, ip: ClientIp
) -> Response:
    try:
        rate_limit.check(f"register:{ip}", rate_limit.LOGIN_LIMIT)
    except rate_limit.RateLimited as exc:
        raise AppError("RATE_LIMITED", "Слишком много попыток", status_code=429) from exc

    invite = await _find_valid_invite(session, payload.invite_code)
    user = await session.get(User, invite.user_id)
    if user is None:
        raise AppError("INVITE_INVALID", "Код не подошёл или истёк")

    options_json, challenge_id = await wa.build_registration_options(session, user, invite.id)
    await session.commit()

    result = Response(content=options_json, media_type="application/json")
    _set_challenge_cookie(result, challenge_id)
    return result


@router.post("/register/verify", response_model=RegisterVerifyOut)
async def register_verify(
    payload: RegisterVerifyIn,
    session: SessionDep,
    response: Response,
    pg_challenge: str | None = Cookie(default=None),
) -> RegisterVerifyOut:
    challenge_id = _parse_challenge_cookie(pg_challenge)

    try:
        challenge = await wa.consume_challenge(session, challenge_id, ChallengeKind.registration)
    except wa.WebAuthnError as exc:
        raise AppError("CHALLENGE_INVALID", str(exc)) from exc

    if challenge.invite_code_id is None:
        raise AppError("CHALLENGE_INVALID", "Запрос устарел, начните заново")

    invite = await session.get(InviteCode, challenge.invite_code_id)
    if invite is None or invite.used_at is not None:
        raise AppError("INVITE_INVALID", "Код уже использован")

    user = await session.get(User, invite.user_id)
    if user is None:
        raise AppError("INVITE_INVALID", "Код не подошёл")

    try:
        await wa.verify_registration(
            session,
            user,
            json.dumps(payload.credential),
            challenge.challenge,
            payload.device_label,
        )
    except wa.WebAuthnError as exc:
        raise AppError("PASSKEY_INVALID", str(exc)) from exc

    invite.used_at = datetime.now(timezone.utc)

    # Коды восстановления выдаются только при первой привязке: если человек
    # добавляет второе устройство, старые коды продолжают работать.
    has_codes = await session.scalar(
        select(RecoveryCode.id).where(RecoveryCode.user_id == user.id).limit(1)
    )
    codes: list[str] = []
    if has_codes is None:
        codes = [generate_code() for _ in range(RECOVERY_CODES_COUNT)]
        for code in codes:
            session.add(RecoveryCode(user_id=user.id, code_hash=hash_code(code)))

    refresh = await issue_refresh_token(session, user.id)
    await session.commit()

    _set_refresh_cookie(response, refresh)
    _clear(response, wa.CHALLENGE_COOKIE)
    return RegisterVerifyOut(user=UserOut.model_validate(user), recovery_codes=codes)


# ── Вход ─────────────────────────────────────────────────────────────────────


@router.post("/login/options")
async def login_options(session: SessionDep, ip: ClientIp) -> Response:
    try:
        rate_limit.check(f"login:{ip}", rate_limit.LOGIN_LIMIT)
    except rate_limit.RateLimited as exc:
        raise AppError("RATE_LIMITED", "Слишком много попыток", status_code=429) from exc

    options_json, challenge_id = await wa.build_authentication_options(session)
    await session.commit()

    result = Response(content=options_json, media_type="application/json")
    _set_challenge_cookie(result, challenge_id)
    return result


@router.post("/login/verify", response_model=SessionOut)
async def login_verify(
    payload: LoginVerifyIn,
    session: SessionDep,
    response: Response,
    ip: ClientIp,
    pg_challenge: str | None = Cookie(default=None),
) -> SessionOut:
    challenge_id = _parse_challenge_cookie(pg_challenge)

    try:
        challenge = await wa.consume_challenge(session, challenge_id, ChallengeKind.authentication)
    except wa.WebAuthnError as exc:
        raise AppError("CHALLENGE_INVALID", str(exc)) from exc

    raw_id = payload.credential.get("rawId") or payload.credential.get("id")
    if not isinstance(raw_id, str):
        raise AppError("PASSKEY_INVALID", "Некорректный ответ ключа")

    try:
        credential_id = base64url_to_bytes(raw_id)
    except ValueError as exc:
        raise AppError("PASSKEY_INVALID", "Некорректный ответ ключа") from exc

    try:
        credential = await wa.verify_authentication(
            session, json.dumps(payload.credential), challenge.challenge, credential_id
        )
    except wa.WebAuthnError as exc:
        raise AppError("PASSKEY_INVALID", str(exc), status_code=401) from exc

    user = await session.get(User, credential.user_id)
    if user is None:
        raise AppError("UNAUTHORIZED", "Пользователь не найден", status_code=401)

    refresh = await issue_refresh_token(session, user.id)
    await session.commit()

    rate_limit.reset(f"login:{ip}")
    _set_refresh_cookie(response, refresh)
    _clear(response, wa.CHALLENGE_COOKIE)
    return SessionOut(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


# ── Сессия ───────────────────────────────────────────────────────────────────


@router.post("/refresh", response_model=AccessOut)
async def refresh_session(
    session: SessionDep,
    response: Response,
    pg_refresh: str | None = Cookie(default=None),
) -> AccessOut:
    if not pg_refresh:
        raise AppError("UNAUTHORIZED", "Нужен вход", status_code=401)

    try:
        user_id, new_refresh = await rotate_refresh_token(session, pg_refresh)
    except TokenError as exc:
        _clear(response, REFRESH_COOKIE)
        raise AppError("UNAUTHORIZED", str(exc), status_code=401) from exc

    await session.commit()
    _set_refresh_cookie(response, new_refresh)
    return AccessOut(access_token=create_access_token(user_id))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    session: SessionDep,
    response: Response,
    pg_refresh: str | None = Cookie(default=None),
) -> None:
    if pg_refresh:
        await revoke_refresh_token(session, pg_refresh)
        await session.commit()
    _clear(response, REFRESH_COOKIE)


# ── Восстановление ───────────────────────────────────────────────────────────


@router.post("/recovery", response_model=SessionOut)
async def recovery(
    payload: RecoveryIn, session: SessionDep, response: Response, ip: ClientIp
) -> SessionOut:
    try:
        rate_limit.check(f"recovery:{ip}", rate_limit.LOGIN_LIMIT)
    except rate_limit.RateLimited as exc:
        raise AppError("RATE_LIMITED", "Слишком много попыток", status_code=429) from exc

    unused = (
        await session.scalars(select(RecoveryCode).where(RecoveryCode.used_at.is_(None)))
    ).all()

    match = next((rc for rc in unused if verify_code(payload.code, rc.code_hash)), None)
    if match is None:
        raise AppError("RECOVERY_INVALID", "Код не подошёл", status_code=401)

    user = await session.get(User, match.user_id)
    if user is None:
        raise AppError("RECOVERY_INVALID", "Код не подошёл", status_code=401)

    match.used_at = datetime.now(timezone.utc)

    # Вход по коду восстановления означает, что устройства потеряны: гасим все
    # прежние сессии, чтобы тот, кто их держит, вылетел.
    await revoke_all_for_user(session, user.id)

    refresh = await issue_refresh_token(session, user.id)
    await session.commit()

    _set_refresh_cookie(response, refresh)
    return SessionOut(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


# ── Отладочный вход (только локально) ────────────────────────────────────────

if settings.dev_auth_enabled:
    # Эндпоинт регистрируется, только если флаг включён, — в проде его
    # не существует вовсе, а не «существует и запрещён». Плюс config.py
    # не даёт включить флаг на HTTPS-домене.
    #
    # Нужен, чтобы гонять сценарии в браузере на ПК: WebAuthn там требует
    # реального биометрического ключа, которого у десктопа нет.

    class DevLoginIn(BaseModel):
        username: str

    @router.post("/dev-login", response_model=SessionOut)
    async def dev_login(
        payload: DevLoginIn, session: SessionDep, response: Response
    ) -> SessionOut:
        user = await session.scalar(select(User).where(User.username == payload.username))
        if user is None:
            raise AppError("NOT_FOUND", f"Нет пользователя {payload.username}", status_code=404)

        refresh = await issue_refresh_token(session, user.id)
        await session.commit()

        _set_refresh_cookie(response, refresh)
        return SessionOut(
            access_token=create_access_token(user.id), user=UserOut.model_validate(user)
        )


# ── Текущий пользователь ─────────────────────────────────────────────────────


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> UserOut:
    """Кто вошёл.

    В таблице ТЗ 11 эндпоинта нет, но он необходим: access-токен живёт только
    в памяти JS, и после перезагрузки приложение знает лишь то, что refresh
    сработал — имя и цвет человека приходится спрашивать у сервера.
    """
    return UserOut.model_validate(user)


# ── Устройства ───────────────────────────────────────────────────────────────


@router.get("/devices", response_model=list[DeviceOut])
async def list_devices(user: CurrentUser, session: SessionDep) -> list[DeviceOut]:
    rows = (
        await session.scalars(
            select(Credential)
            .where(Credential.user_id == user.id)
            .order_by(Credential.created_at)
        )
    ).all()
    return [DeviceOut.model_validate(row) for row in rows]


@router.delete("/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_device(device_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> None:
    credential = await session.get(Credential, device_id)
    if credential is None or credential.user_id != user.id:
        raise AppError("NOT_FOUND", "Устройство не найдено", status_code=404)

    remaining = (
        await session.scalars(select(Credential).where(Credential.user_id == user.id))
    ).all()
    if len(remaining) <= 1:
        # Иначе человек останется вообще без входа и попадёт на коды
        # восстановления там, где этого не ожидал.
        raise AppError(
            "LAST_DEVICE",
            "Это единственное устройство. Сначала добавьте новое.",
            status_code=409,
        )

    await session.delete(credential)
    await session.commit()


@router.post("/devices/invite", response_model=DeviceInviteOut)
async def create_device_invite(user: CurrentUser, session: SessionDep) -> DeviceInviteOut:
    code = generate_code()
    invite = InviteCode(
        user_id=user.id,
        code_hash=hash_code(code),
        expires_at=datetime.now(timezone.utc) + DEVICE_INVITE_TTL,
    )
    session.add(invite)
    await session.commit()
    return DeviceInviteOut(code=code, expires_at=invite.expires_at)
