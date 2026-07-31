# ============================================================================
# Orbit — один контейнер под платформу awwwdde (welove.awwwdde.art).
#
# Контракт гостя:
#   • Dockerfile в корне репозитория (этот файл)
#   • приложение слушает порт 8080
#   • GET /healthz отдаёт 200, когда готово
#   • БД берётся из переменной окружения DATABASE_URL
#   • миграции запускаются на старте контейнера
#
# Архитектура: фронт (Vite/React) собирается в статику и раздаётся тем же
# FastAPI, который обслуживает /api/*. Один процесс, один порт — без nginx.
# ============================================================================

# ── Stage 1: сборка фронта ──────────────────────────────────────────────────
FROM node:22-alpine AS frontend

WORKDIR /build

# Сначала манифесты — лучший слой-кэш.
COPY web/package.json web/package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY web/ ./
RUN npm run build


# ── Stage 2: рантайм ────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    STATIC_DIR=/app/static

WORKDIR /app

# curl — для отладочного пинга /healthz изнутри контейнера.
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY api/ ./
RUN pip install --upgrade pip && pip install --no-cache-dir .

# Собранная SPA из stage 1 — её раздаёт сам FastAPI.
COPY --from=frontend /build/dist /app/static

EXPOSE 8080

# Миграции на старте, затем uvicorn.
# --no-server-header: не отдавать «Server: uvicorn» — по названию стека
# проще подобрать known-CVE. Убирается только флагом запуска.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8080 --no-server-header"]
