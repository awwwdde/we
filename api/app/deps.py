"""Общие зависимости FastAPI."""

from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User
from app.db.session import get_session
from app.errors import AppError
from app.services.tokens import TokenError, decode_access_token

SessionDep = Annotated[AsyncSession, Depends(get_session)]


def client_ip(request: Request) -> str:
    """IP клиента с учётом того, что перед нами стоит ровно один прокси (Caddy).

    Берём последний элемент X-Forwarded-For: его добавил наш прокси, и
    подделать его клиент не может, в отличие от начала цепочки.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


async def get_current_user(request: Request, session: SessionDep) -> User:
    header = request.headers.get("Authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise AppError("UNAUTHORIZED", "Нужен вход", status_code=401)

    try:
        user_id = decode_access_token(token)
    except TokenError as exc:
        raise AppError("UNAUTHORIZED", "Сессия истекла", status_code=401) from exc

    user = await session.get(User, user_id)
    if user is None:
        raise AppError("UNAUTHORIZED", "Пользователь не найден", status_code=401)
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
ClientIp = Annotated[str, Depends(client_ip)]
