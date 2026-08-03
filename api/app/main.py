"""Точка входа FastAPI.

В проде это единственный процесс под-сайта perigee.awwwdde.art: он же API,
он же раздатчик собранной SPA (см. app/spa.py).
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.session import engine
from app.errors import register_error_handlers
from app.middleware.csrf import CsrfHeaderMiddleware
from app.middleware.security import SecurityHeadersMiddleware
from app.routers import auth, dates, health, places
from app.spa import mount_spa


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield
    await engine.dispose()


app = FastAPI(
    title="Перигей API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CsrfHeaderMiddleware)

# Фронт и API живут на одном origin, поэтому CORS нужен только для dev,
# где Vite крутится на отдельном порту.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,  # нужен для refresh-cookie
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)

register_error_handlers(app)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(dates.router)
app.include_router(places.router)

# Регистрируется последним: catch-all маршрут SPA не должен перекрывать API.
mount_spa(app, settings.static_dir)
