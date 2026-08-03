"""CLI создания пользователей и инвайт-кодов (ТЗ 9.3).

Публичной регистрации нет и не будет: пользователи заводятся только отсюда.

    python -m app.cli create-user --username vlad --display-name "Влад" --color ember
    python -m app.cli issue-invite --username vlad
    python -m app.cli list-users

На проде — через панель awwwdde:
    docker exec perigee_app python -m app.cli issue-invite --username vlad
"""

import argparse
import asyncio
import io
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.db.models import InviteCode, User, UserColor
from app.db.session import SessionLocal
from app.services.codes import generate_code, hash_code

# Срок жизни кода первичной привязки. Для добавления устройства из настроек
# срок другой — 10 минут (ТЗ 9.7), он задаётся в роутере.
INVITE_TTL = timedelta(hours=24)


async def create_user(username: str, display_name: str, color: str) -> int:
    async with SessionLocal() as session:
        existing = await session.scalar(select(User).where(User.username == username))
        if existing is not None:
            print(f"Пользователь {username!r} уже есть.", file=sys.stderr)
            return 1

        user = User(username=username, display_name=display_name, color=UserColor(color))
        session.add(user)
        await session.commit()
        await session.refresh(user)

        print(f"Создан пользователь {user.display_name} ({user.username}), цвет {user.color.value}")
        print(f"id: {user.id}")
        print("Дальше: python -m app.cli issue-invite --username " + username)
        return 0


async def issue_invite(username: str) -> int:
    async with SessionLocal() as session:
        user = await session.scalar(select(User).where(User.username == username))
        if user is None:
            print(f"Пользователь {username!r} не найден.", file=sys.stderr)
            return 1

        code = generate_code()
        invite = InviteCode(
            user_id=user.id,
            code_hash=hash_code(code),
            expires_at=datetime.now(timezone.utc) + INVITE_TTL,
        )
        session.add(invite)
        await session.commit()

        print(f"Инвайт-код для {user.display_name}: {code}")
        print(f"Действует до {invite.expires_at:%d.%m.%Y %H:%M} UTC. Одноразовый.")
        return 0


async def list_users() -> int:
    async with SessionLocal() as session:
        users = (await session.scalars(select(User).order_by(User.created_at))).all()
        if not users:
            print("Пользователей нет.")
            return 0
        for user in users:
            print(f"{user.username:12} {user.display_name:12} {user.color.value:6} {user.id}")
        return 0


def main() -> int:
    # Консоль Windows по умолчанию не UTF-8, и кириллица в выводе превращается
    # в мусор. В контейнере (Linux) это ничего не меняет.
    for stream in (sys.stdout, sys.stderr):
        if isinstance(stream, io.TextIOWrapper):
            stream.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(prog="app.cli", description="Управление пользователями")
    sub = parser.add_subparsers(dest="command", required=True)

    create = sub.add_parser("create-user", help="Создать пользователя")
    create.add_argument("--username", required=True, help="латиницей, например vlad")
    create.add_argument("--display-name", required=True, help="как показывать, например Влад")
    create.add_argument(
        "--color", required=True, choices=[c.value for c in UserColor], help="цвет человека"
    )

    invite = sub.add_parser("issue-invite", help="Выдать одноразовый инвайт-код на 24 часа")
    invite.add_argument("--username", required=True)

    sub.add_parser("list-users", help="Показать пользователей")

    args = parser.parse_args()

    if args.command == "create-user":
        return asyncio.run(create_user(args.username, args.display_name, args.color))
    if args.command == "issue-invite":
        return asyncio.run(issue_invite(args.username))
    return asyncio.run(list_users())


if __name__ == "__main__":
    raise SystemExit(main())
