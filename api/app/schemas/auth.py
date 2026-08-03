"""Схемы аутентификации (контракт из ТЗ 11)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.db.models import UserColor


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    display_name: str
    color: UserColor


class RegisterOptionsIn(BaseModel):
    invite_code: str = Field(min_length=1, max_length=64)


class RegisterVerifyIn(BaseModel):
    # Сырой ответ браузера от navigator.credentials.create().
    credential: dict[str, object]
    device_label: str | None = Field(default=None, max_length=64)


class RegisterVerifyOut(BaseModel):
    user: UserOut
    # Показываются ровно один раз (ТЗ 9.4).
    recovery_codes: list[str]


class LoginVerifyIn(BaseModel):
    credential: dict[str, object]


class SessionOut(BaseModel):
    access_token: str
    user: UserOut


class AccessOut(BaseModel):
    access_token: str


class RecoveryIn(BaseModel):
    code: str = Field(min_length=1, max_length=64)


class DeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    device_label: str | None
    created_at: datetime
    last_used_at: datetime | None


class DeviceInviteOut(BaseModel):
    code: str
    expires_at: datetime
