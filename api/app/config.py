"""Конфигурация приложения. Единственный источник правды по окружению.

Прод — под-сайт на платформе awwwdde (`perigee.awwwdde.art`). Панель сама
прокидывает в контейнер `DATABASE_URL`, `PUBLIC_SITE_URL`, `SECRET_KEY`
и `JWT_SECRET`; остальное задаётся через env-переменные проекта в админке.
"""

from functools import lru_cache
from urllib.parse import urlparse

from pydantic import Field, computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Значения-заглушки, с которыми нельзя выходить в прод.
_WEAK_SECRETS = frozenset(
    {"dev-secret-change-me", "change_me_to_a_long_random_string", ""}
)


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
    database_url: str = "postgresql+asyncpg://perigee:perigee@localhost:5432/perigee"

    # ── Публичный адрес ─────────────────────────────────────────────────────
    # PUBLIC_SITE_URL проставляет панель: https://perigee.awwwdde.art
    public_site_url: str = "http://localhost:5173"

    # ── Сессии ──────────────────────────────────────────────────────────────
    jwt_secret: str = "dev-secret-change-me"

    # ── WebAuthn (Фаза 2) ───────────────────────────────────────────────────
    rp_name: str = "Перигей"
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

    # ── Разработка ──────────────────────────────────────────────────────────
    # Вход без passkey для отладки в браузере на ПК. Включается только
    # локально: валидатор ниже не даёт поднять приложение с этим флагом
    # на боевом домене (см. `_guard_production_secrets`).
    dev_auth_enabled: bool = False

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
        """Домен без схемы и порта (например, `perigee.awwwdde.art`)."""
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

    @model_validator(mode="after")
    def _guard_production_secrets(self) -> "Settings":
        """На боевом домене отказываемся стартовать со слабым секретом.

        Подписью JWT защищены все сессии: угаданный секрет = вход под любым
        пользователем. Панель awwwdde проставляет JWT_SECRET сама, так что
        сработать это может только если что-то настроено неправильно —
        и тогда лучше упасть на старте, чем тихо работать дырявым.
        """
        if self.is_https and (
            self.jwt_secret in _WEAK_SECRETS or len(self.jwt_secret) < 32
        ):
            raise ValueError(
                "JWT_SECRET не задан или слишком короткий (нужно ≥32 символов). "
                "Сгенерировать: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )

        # Отладочный вход — это обход аутентификации целиком. На боевом
        # домене он не «выключен по умолчанию», а невозможен: приложение
        # откажется стартовать, если флаг случайно окажется в окружении.
        if self.is_https and self.dev_auth_enabled:
            raise ValueError(
                "DEV_AUTH_ENABLED=true на боевом домене. Это обход входа — "
                "уберите переменную из окружения проекта."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
