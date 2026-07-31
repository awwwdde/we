"""Security-заголовки (ТЗ 16).

Важно: на платформе awwwdde маршрут под-сайта — голый `reverse_proxy` без
заголовков (их получает только apex-домен). Значит, HSTS/CSP/nosniff обязано
выставлять само приложение, иначе их не будет ни от кого.
"""

from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

from app.config import settings

# CSP без unsafe-eval. 'unsafe-inline' допустим для стилей (Tailwind), для
# скриптов — нет. img-src https: нужен для фотографий мест от провайдеров.
_CSP = "; ".join(
    [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ]
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        response = await call_next(request)
        headers = response.headers
        headers["X-Content-Type-Options"] = "nosniff"
        headers["Referrer-Policy"] = "same-origin"
        headers["Content-Security-Policy"] = _CSP
        headers["X-Frame-Options"] = "DENY"
        if settings.is_https:
            headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response
