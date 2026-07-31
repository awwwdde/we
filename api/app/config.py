"""Конфигурация приложения. Единственный источник правды по окружению.

Прод — под-сайт на платформе awwwdde (`welove.awwwdde.art`). Панель сама
прокидывает в контейнер `DATABASE_URL`, `PUBLIC_SITE_URL`, `SECRET_KEY`
и `JWT_SECRET`; остальное задаётся через env-переменные проекта в админке.
"""

from functools import lru_cache
from urllib.parse import urlparse

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _normalize_db_url(url: str) -> str:
    """`postgresql://` → `postgresql+asyncpg://`.

    Панель отдаёт URL без драйвера, а движок у нас асинхронный. Без явного
    драйвера SQLAlchemy возьмёт синхронный psycopg2 и упадёт на старте.
    """
    if url.startswith("postgresql+"):
        return url
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url[len("postgresql://") :]
    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url[len("postgres://") :]
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Инфраструктура ──────────────────────────────────────────────────────
    # На проде значение приходит от панели в виде postgresql://<slug>:<pass>@<slug>_db:5432/<slug>
    database_url: str = "postgresql+asyncpg://orbit:orbit@localhost:5432/orbit"

    # ── Публичный адрес ─────────────────────────────────────────────────────
    # PUBLIC_SITE_URL проставляет панель: https://welove.awwwdde.art
    public_site_url: str = "http://localhost:5173"

    # ── Сессии ──────────────────────────────────────────────────────────────
    jwt_secret: str = "dev-secret-change-me"

    # ── WebAuthn (Фаза 2) ───────────────────────────────────────────────────
    rp_name: str = "Orbit"
    # RP_ID вшивается в passkey НАВСЕГДА. По умолчанию берётся хост
    # PUBLIC_SITE_URL — так он детерминирован и не разъедется с доменом.
    # Переопределять руками только при осознанной смене домена (все passkey умрут).
    rp_id_override: str = Field(default="", alias="RP_ID")

    # ── Web Push (Фаза 7) ───────────────────────────────────────────────────
    vapid_private_key: str = ""
    vapid_public_key: str = ""
    vapid_subject: str = "mailto:admin@awwwdde.art"

    # ── Источники мест (Фаза 5) ─────────────────────────────────────────────
    yandex_places_api_key: str = ""
    twogis_api_key: str = ""
    kudago_city: str = "msk"

    # ── Общее ───────────────────────────────────────────────────────────────
    timezone: str = "Europe/Moscow"
    # Каталог с собранной SPA. В прод-образе — /app/static.
    static_dir: str = ""

    @computed_field  # type: ignore[prop-decorator]
    @property
    def sqlalchemy_url(self) -> str:
        return _normalize_db_url(self.database_url)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def origin(self) -> str:
        """Полный origin фронтенда — с ним сверяется WebAuthn."""
        return self.public_site_url.rstrip("/")

    @computed_field  # type: ignore[prop-decorator]
    @property
    def rp_id(self) -> str:
        """Домен без схемы и порта (например, `welove.awwwdde.art`)."""
        if self.rp_id_override:
            return self.rp_id_override
        host = urlparse(self.public_site_url).hostname
        return host or "localhost"

    @property
    def cors_origins(self) -> list[str]:
        """Единственный разрешённый origin (ТЗ 16). Никаких `*`."""
        return [self.origin]

    @property
    def is_https(self) -> bool:
        return self.origin.startswith("https://")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
