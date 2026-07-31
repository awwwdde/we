# Передача: состояние проекта Orbit

Дата: 31 июля 2026. Файл для следующей сессии — прочитать первым, вместе с
[README.md](README.md) и [DEPLOY.md](DEPLOY.md).

---

## Где мы

**Фаза 1 (фундамент) — сделана и проверена.**
**Фаза 2 (аутентификация) — не начата.** Кода нет, только план ниже.

Реализация идёт строго по фазам из раздела 18 ТЗ ([orbit-TZ.md](orbit-TZ.md)).
Не начинать фазу N+1, пока N не прошла приёмку.

---

## Решения, принятые на прошлой сессии

### Ответы на вопросы раздела 21 ТЗ

| Вопрос | Ответ |
|---|---|
| Домен прода | **`welove.awwwdde.art`** (под-сайт платформы awwwdde) |
| Имена и цвета | **Влад — муж, `ember`** · **Ангелина — жена, `iris`** |
| Город KudaGo | **Москва → `msk`** |
| Ключ 2ГИС | ❗ **не спрошен** — нужен к Фазе 5 |
| Экспорт `.ics` | ❗ **не спрошен** — вне текущего ТЗ |

### Прод — под-сайт awwwdde, а не свой VPS

Раздел 17 ТЗ (VPS + Nginx + certbot) **заменён**. Платформа
`C:\Users\vlad\Documents\542\awwwdde` — мини-PaaS: на проект поднимает
`welove_app` (из корневого `Dockerfile`) + `welove_db` (Postgres 16 со своим
volume) и прописывает маршрут в Caddy с автоматическим TLS.

Образец такого же деплоя — `C:\Users\vlad\Documents\542\DomSouzov`
(`union.awwwdde.art`), его `Dockerfile` стоит держать под рукой как эталон.

Контракт гостя (выполнен): `Dockerfile` в корне · порт **8080** ·
`GET /healthz` → 200 · БД из `DATABASE_URL` · миграции на старте.

Панель прокидывает сама: `DATABASE_URL` (формат `postgresql://…` **без
драйвера** — `config.py` нормализует в `postgresql+asyncpg://`),
`PUBLIC_SITE_URL`, `SECRET_KEY`, `JWT_SECRET`. Остальное — env-переменные
проекта в админке панели.

### Два отклонения от ТЗ (оба вынужденные, зафиксированы в DEPLOY.md)

1. **Redis не используется.** Панель даёт гостю только Postgres. Его роль
   закрывает Postgres: challenge WebAuthn — короткоживущие строки, кэш мест —
   таблица `places_cache` (она в ТЗ и так основной уровень). Убран и из dev,
   чтобы окружения не разъезжались.
2. **Security-заголовки ставит приложение**, а не прокси: маршрут под-сайта в
   Caddy — голый `reverse_proxy` без заголовков (их получает только apex).
   Реализовано в `api/app/middleware/security.py`.

### RP_ID выводится, а не задаётся

`RP_ID` = хост из `PUBLIC_SITE_URL` → `welove.awwwdde.art`. Он вшивается в
каждый passkey **навсегда**: сменить домен потом = убить все ключи. Поэтому
руками не задаётся. Переопределение через env `RP_ID` есть, но трогать нельзя.

---

## Что уже работает (проверено вживую)

- `docker compose up` поднимает dev-стек одной командой — **критерий приёмки
  Фазы 1 выполнен**. Проверены `/healthz`, `/api/health` (`database: true`),
  Vite на 5173 и его прокси `/api` в бэкенд.
- Прод-образ `docker build -t orbit:local .` собирается; запущен против
  Postgres — миграции прошли, `/healthz` отвечает **той же командой, которой
  его дёргает панель**, deep link `/history` рендерится с таббаром,
  в консоли ноль ошибок и ноль нарушений CSP.
- Заголовки: CSP без `unsafe-eval`, HSTS, nosniff, `Referrer-Policy: same-origin`.
- Ключей внешних API в бандле нет (`grep` по `/app/static`).
- `mypy --strict` и `tsc --noEmit` — чисто. Бандл 107 КБ gzip (бюджет 200).
- Токены применились: фон `#0B0A0F`, текст `#F2EFF7`; Unbounded / Onest /
  Martian Mono загружены **с кириллицей** (сабсеты проверены в пакетах).
- Traversal `/../.env` и url-encoded варианты отдают index.html, не файлы.

---

## Как запустить

```bash
cp .env.example .env     # .env в git не хранится, его нет в рабочей копии
docker compose up
```

фронт http://localhost:5173 · API http://localhost:8000 · доки `/api/docs`

Проверки:

```bash
cd api && .venv/Scripts/python -m mypy app
cd web && npm run typecheck && npm run build
```

Прод-сборка целиком — команды в конце [DEPLOY.md](DEPLOY.md).

---

## Грабли окружения (сэкономят время)

- **Docker Desktop не стартует сам.** Поднять:
  `Start-Process "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"`, затем
  ждать `until docker info >/dev/null 2>&1; do sleep 3; done`.
- **Скриншоты в панели Browser не работают**, пока панель не открыта у
  пользователя («not compositing frames»). Проверять через `read_page`
  (дерево доступности) и `javascript_tool` (computed-стили).
- **Vite, запущенный через `preview_start`, недоступен из шелла и из
  `navigate`.** Рабочий обход: `npx vite --host 127.0.0.1 --port 5199`,
  и уже туда ходить браузером.
- **`disallow_any_explicit` в mypy убран намеренно** — конфликтует с плагином
  pydantic (Any в синтезированных `__init__`). В `--strict` он не входит,
  ТЗ требует именно `--strict`.
- **`exactOptionalPropertyTypes: true` включён.** Опциональные пропсы,
  которым может прилететь `undefined`, объявлять как `foo?: string | undefined`,
  иначе TS ругается.
- Локально стоит venv в `api/.venv` (Python 3.13; в образе — 3.12).

---

## Следующий шаг: Фаза 2 — аутентификация

Объём по ТЗ 18: CLI создания пользователей и инвайт-кодов, WebAuthn
регистрация и вход, сессии с ротацией refresh, коды восстановления, экран
настроек с устройствами.
**Приёмка: вход по Face ID на реальном iPhone, а не в эмуляторе.**

### Спроектированное решение

**Новые зависимости бэкенда** (обосновать в описании PR):
`webauthn` (py_webauthn 2.x) · `pyjwt` · `argon2-cffi` (хэш кодов
восстановления, ТЗ 9.7).

**Таблицы.** Из ТЗ 10 берутся `users`, `credentials`, `recovery_codes`,
`invite_codes`. Сверх ТЗ нужны две — обе следствие того, что Redis нет:

- `refresh_tokens` — ротация и отзыв цепочки при повторном использовании
  (ТЗ 9.6 это требует, но таблицы в схеме не предусмотрел);
- `webauthn_challenges` — challenge на 5 минут (в ТЗ 9.4 лежал в Redis).

Обе задокументировать в DEPLOY.md рядом с объяснением про Redis.

**Файлы бэкенда:**

```
api/app/db/models/{user,credential,recovery_code,invite_code,
                  refresh_token,webauthn_challenge}.py
api/alembic/versions/0001_auth.py     # первая миграция, versions/ сейчас пуст
api/app/schemas/auth.py
api/app/services/webauthn_service.py
api/app/services/tokens.py            # JWT access 15 мин + ротация refresh
api/app/deps.py                       # current_user
api/app/routers/auth.py
api/app/cli.py                        # create-user, issue-invite
```

Эндпоинты — по таблице ТЗ 11. Ключевые тонкости оттуда:
`residentKey: 'required'` + `userVerification: 'required'`;
`allowCredentials: []` на входе (usernameless);
**проверка `sign_count`**, причём для passkey из iCloud Keychain счётчик
всегда `0` — это валидный случай, обрабатывать отдельно;
access-токен только в памяти JS, refresh — httpOnly+Secure+SameSite=Lax.

Ещё из ТЗ 16, чего пока нет: заголовок `X-Requested-With` на изменяющих
состояние POST и rate limit 5 попыток входа в минуту на IP (хранилища нет —
делать в памяти процесса, с комментарием, что сбрасывается при редеплое).

**Фронтенд** (новые зависимости: `@simplewebauthn/browser`,
`@tanstack/react-query`, `zustand`, `zod`):

```
web/src/lib/api/client.ts     # fetch + X-Requested-With + на 401 один refresh
                              # через промис-синглтон, затем повтор запроса
web/src/lib/api/schemas.ts    # Zod-схемы ответов
web/src/lib/auth/passkey.ts
web/src/lib/auth/session.ts
web/src/app/RequireAuth.tsx   # редирект на /onboarding, исходный путь в state
web/src/screens/onboarding/   # инвайт-код → passkey → 10 кодов восстановления
web/src/screens/settings/     # список устройств, добавить, отозвать
```

Детекция standalone и инструкция установки — **это Фаза 3**, сюда не тащить.

### Первый шаг

Начать с моделей и миграции (`versions/` сейчас пуст, первая миграция —
вся схема аутентификации), затем CLI, затем эндпоинты, затем фронт.

Полезно свериться с CLI из ТЗ 9.3:

```bash
docker compose exec api python -m app.cli create-user \
    --username vlad --display-name "Влад" --color ember
docker compose exec api python -m app.cli create-user \
    --username angelina --display-name "Ангелина" --color iris
docker compose exec api python -m app.cli issue-invite --username vlad
```

---

## Правила проекта (не забыть)

- TypeScript `strict`, `any` запрещён везде, включая тесты.
- Python: полная аннотация, `mypy --strict` без ошибок.
- **Никаких TODO-заглушек.** Если что-то не реализуемо — остановиться и
  спросить, не делать мок.
- Каждая новая зависимость обоснована. UI-киты, библиотеки календарей,
  moment.js, axios, Redux — не ставить.
- Дисциплина цвета: `lime` = только «подтверждено», больше нигде.
  `ember`/`iris` — цвета людей (Влад / Ангелина), не украшение.
