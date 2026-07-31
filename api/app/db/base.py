"""Декларативная база SQLAlchemy.

Все модели наследуются отсюда. Alembic импортирует этот модуль,
чтобы `Base.metadata` знал обо всех таблицах при автогенерации.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
