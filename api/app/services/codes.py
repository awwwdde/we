"""Генерация и проверка человекочитаемых кодов.

Используется для инвайт-кодов (ТЗ 9.3, вид `7K2M-9QX4-LP31`) и кодов
восстановления (ТЗ 9.7). Оба хранятся хэшем Argon2id — из БД не восстановить.
"""

import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError

# Алфавит без символов, которые путаются при чтении с экрана: 0/O, 1/I/L.
_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_GROUP = 4
_GROUPS = 3

_hasher = PasswordHasher()


def generate_code() -> str:
    """Код вида `7K2M-9QX4-LP31`."""
    groups = [
        "".join(secrets.choice(_ALPHABET) for _ in range(_GROUP)) for _ in range(_GROUPS)
    ]
    return "-".join(groups)


def normalize_code(raw: str) -> str:
    """Пользователь вводит код руками: регистр и дефисы не должны мешать."""
    return raw.strip().upper().replace(" ", "").replace("-", "")


def hash_code(code: str) -> str:
    return _hasher.hash(normalize_code(code))


def verify_code(code: str, code_hash: str) -> bool:
    try:
        return _hasher.verify(code_hash, normalize_code(code))
    except (VerifyMismatchError, VerificationError):
        return False


def generate_token(nbytes: int = 32) -> str:
    """Случайный токен для refresh-сессий и ссылок-приглашений."""
    return secrets.token_urlsafe(nbytes)


def hash_token(token: str) -> str:
    """sha256 для токенов.

    Argon2 здесь не нужен: токен и так 32 случайных байта, перебирать нечего,
    а хэш должен считаться на каждом запросе обновления сессии.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
