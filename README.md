# Перигей

Приватное installable PWA для планирования свиданий. Ровно два пользователя,
регистрации нет. Прод — под-сайт платформы awwwdde: **https://perigee.awwwdde.art**

Исходное ТЗ (кодовое имя проекта было `orbit`): [orbit-TZ.md](orbit-TZ.md) · развёртывание: [DEPLOY.md](DEPLOY.md)
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
perigee/
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
- [x] **Фаза 2 — аутентификация.** CLI, WebAuthn регистрация и вход, сессии
      с ротацией refresh, коды восстановления, экран настроек с устройствами.
      Осталась приёмка на живом iPhone (вход по Face ID).
- [x] **Фаза 3 — PWA-оболочка.** Манифест, иконки (генерируются скриптом),
      Service Worker с стратегиями кэша, экран установки с детекцией
      standalone и разными инструкциями для iOS и Android, плашка обновления.
      Осталась приёмка: иконка на домашнем экране, запуск без адресной строки.
- [x] **Фаза 4 — свидания и календарь.** Модель `dates` со снимком места,
      CRUD, самописный календарь со свайпом, барабан времени, мастер из
      пяти шагов, главный экран с отсчётом, лента истории, «наши места».
      Отправка приглашения (`/send`) — в Фазе 6.
- [x] **Фаза 5 — места.** KudaGo + OpenStreetMap, агрегатор, кэш, поиск с фильтрами.
- [x] **Редизайн «Тёплая ночь и одна орбита».** Тёплая палитра, светлая
      тема, крупная типографика, сферы на общей орбите. Макет заказчика —
      [USE_DESIGN.md](USE_DESIGN.md).
- [ ] **Фаза 6 — приглашения.** Публичный экран, опросник.
- [ ] **Фаза 7 — уведомления.** VAPID, подписки, напоминания.
- [ ] **Фаза 8 — сферы и полировка.**

## Отклонения от ТЗ

Первые два продиктованы платформой развёртывания, подробности в [DEPLOY.md](DEPLOY.md):

1. **Redis не используется** — панель awwwdde даёт гостю только Postgres.
   Его роль (challenge WebAuthn, кэш мест) закрывает Postgres; таблица
   `places_cache` в ТЗ и так была основным уровнем кэша.
2. **Раздел 17 (Nginx + certbot на своём VPS) заменён** на деплой под-сайтом:
   Caddy платформы, автоматический TLS, один контейнер на порту 8080.
3. **Две таблицы сверх схемы ТЗ 10** — `refresh_tokens` (отзыв цепочки
   из ТЗ 9.6) и `webauthn_challenges` (замена Redis).
4. **`GET /api/auth/me` сверх таблицы ТЗ 11** — нужен для восстановления
   сессии, потому что access-токен живёт только в памяти JS.
5. **Не-телефоны получают заглушку** вместо приложения (`app/DeviceGate.tsx`).
   ТЗ 20 требовало лишь «не разваливаться на широком экране»; заказчик
   попросил жёсткий блок. Планшеты тоже отсекаются.
