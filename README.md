# Orbit

Приватное installable PWA для планирования свиданий. Ровно два пользователя,
регистрации нет. Прод — под-сайт платформы awwwdde: **https://welove.awwwdde.art**

Полное техническое задание: [orbit-TZ.md](orbit-TZ.md) · развёртывание: [DEPLOY.md](DEPLOY.md)
Состояние работ и план следующей фазы: [HANDOFF.md](HANDOFF.md)

Пользователи: **Влад** (`ember`) и **Ангелина** (`iris`). Город — Москва (`msk`).

## Быстрый старт

```bash
cp .env.example .env
docker compose up
```

- фронт — http://localhost:5173
- API — http://localhost:8000, документация http://localhost:8000/api/docs

Без Docker:

```bash
# бэкенд
cd api && python -m venv .venv && .venv/Scripts/activate
pip install -e ".[dev]" && alembic upgrade head
uvicorn app.main:app --reload --port 8000

# фронт
cd web && npm install && npm run dev
```

## Структура

```
orbit/
├── Dockerfile              # прод: один контейнер (фронт + API) на 8080
├── docker-compose.yml      # dev: Postgres + API + Vite по отдельности
├── api/                    # FastAPI, SQLAlchemy 2 async, Alembic
│   └── app/
│       ├── config.py       # env → настройки, вывод RP_ID из PUBLIC_SITE_URL
│       ├── db/             # движок, сессии, модели
│       ├── routers/        # /healthz, /api/*
│       ├── middleware/     # security-заголовки
│       └── spa.py          # раздача собранной SPA
└── web/                    # Vite + React 18 + TypeScript strict + Tailwind
    └── src/
        ├── app/            # роутер, layout
        ├── screens/        # экран = папка
        ├── components/     # ui, calendar, orb, layout
        ├── lib/            # api, auth, push, motion
        ├── styles/
        └── types/
```

## Проверки

```bash
cd api && .venv/Scripts/python -m mypy app    # strict, без ошибок
cd web && npm run typecheck                   # tsc --noEmit
cd web && npm run build
```

## Состояние по фазам

Реализация идёт строго по фазам (ТЗ, раздел 18).

- [x] **Фаза 1 — фундамент.** Docker, FastAPI + Postgres + Alembic, Vite +
      React + Tailwind с токенами и шрифтами, layout с таббаром, роутинг,
      экраны-заглушки, деплой под-сайтом на awwwdde.
- [ ] **Фаза 2 — аутентификация.** CLI, WebAuthn, сессии, коды восстановления.
- [ ] **Фаза 3 — PWA-оболочка.** Манифест, иконки, Service Worker, онбординг.
- [ ] **Фаза 4 — свидания и календарь.**
- [ ] **Фаза 5 — места.** Яндекс + KudaGo, агрегатор, кэш.
- [ ] **Фаза 6 — приглашения.** Публичный экран, опросник.
- [ ] **Фаза 7 — уведомления.** VAPID, подписки, напоминания.
- [ ] **Фаза 8 — сферы и полировка.**

## Отклонения от ТЗ

Оба продиктованы платформой развёртывания, подробности в [DEPLOY.md](DEPLOY.md):

1. **Redis не используется** — панель awwwdde даёт гостю только Postgres.
   Его роль (challenge WebAuthn, кэш мест) закрывает Postgres; таблица
   `places_cache` в ТЗ и так была основным уровнем кэша.
2. **Раздел 17 (Nginx + certbot на своём VPS) заменён** на деплой под-сайтом:
   Caddy платформы, автоматический TLS, один контейнер на порту 8080.
