"""Простая защита от CSRF (ТЗ 16).

Изменяющие состояние запросы обязаны нести заголовок `X-Requested-With`.
Смысл: браузер не даст сторонней странице выставить кастомный заголовок без
успешного preflight, а CORS у нас разрешает единственный origin. Это
дополнение к `SameSite=Lax` на refresh-cookie, а не замена ему.

Swagger на `/api/docs` этот заголовок не шлёт, поэтому «Try it out» для
POST-эндпоинтов вернёт 403 — так и задумано, это не поломка.
"""

from collections.abc import Awaitable, Callable
from typing import Final

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

_PROTECTED_METHODS: Final = frozenset({"POST", "PATCH", "PUT", "DELETE"})
_HEADER: Final = "X-Requested-With"


class CsrfHeaderMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        is_api = request.url.path.startswith("/api/")
        if is_api and request.method in _PROTECTED_METHODS and _HEADER not in request.headers:
            return JSONResponse(
                status_code=403,
                content={
                    "error": {
                        "code": "CSRF_HEADER_REQUIRED",
                        "message": "Запрос отклонён",
                    }
                },
            )
        return await call_next(request)
