"""Реестр моделей.

Alembic импортирует этот пакет, чтобы все таблицы попали в `Base.metadata`.
Каждая новая модель добавляется сюда явным импортом.
"""

from app.db.base import Base
from app.db.models.credential import Credential
from app.db.models.custom_place import CustomPlace
from app.db.models.date_plan import NOTE_MAX_LENGTH, DatePlan, DateStatus, PlaceSource
from app.db.models.invite import Invite
from app.db.models.invite_code import InviteCode
from app.db.models.places_cache import PlacesCache
from app.db.models.push_subscription import PushSubscription
from app.db.models.recovery_code import RecoveryCode
from app.db.models.refresh_token import RefreshToken
from app.db.models.user import User, UserColor
from app.db.models.webauthn_challenge import ChallengeKind, WebAuthnChallenge

__all__ = [
    "NOTE_MAX_LENGTH",
    "Base",
    "ChallengeKind",
    "Credential",
    "CustomPlace",
    "DatePlan",
    "DateStatus",
    "Invite",
    "InviteCode",
    "PlaceSource",
    "PlacesCache",
    "PushSubscription",
    "RecoveryCode",
    "RefreshToken",
    "User",
    "UserColor",
    "WebAuthnChallenge",
]
