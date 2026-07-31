# Развёртывание Orbit как под-сайта awwwdde

**Прод-адрес:** `https://welove.awwwdde.art`
**Slug проекта в панели:** `welove`

Orbit разворачивается платформой [awwwdde](../awwwdde) — тем же способом,
что и «Дом Союзов» (`union.awwwdde.art`). Раздел 17 ТЗ (отдельный VPS с
Nginx + certbot) заменён на этот сценарий.

---

## Как это устроено

```
              *.awwwdde.art  (wildcard DNS → VPS)
                        │
                   ┌────────┐
                   │ Caddy  │  автоматический TLS, маршрут по хосту
                   └───┬────┘
                       │  welove.awwwdde.art → welove_app:8080
                       ▼
                 welove_app  ──────►  welove_db (Postgres 16, свой volume)
            (наш контейнер: FastAPI + собранная SPA)
```

Панель на каждый деплой пересоздаёт `welove_app` из корневого `Dockerfile`,
а `welove_db` живёт постоянно вместе со своим volume `welove_db_data`.

## Контракт, который мы выполняем

| Требование панели | Где реализовано |
|---|---|
| `Dockerfile` в корне репозитория | [Dockerfile](Dockerfile) |
| Приложение слушает порт **8080** | `CMD` в Dockerfile |
| `GET /healthz` → `200` | [api/app/routers/health.py](api/app/routers/health.py) |
| БД из `DATABASE_URL` | [api/app/config.py](api/app/config.py) |
| Миграции на старте контейнера | `alembic upgrade head` в `CMD` |

Панель сама прокидывает в контейнер:

- `DATABASE_URL` — вида `postgresql://welove:<pass>@welove_db:5432/welove`
  (без драйвера; `config.py` нормализует его в `postgresql+asyncpg://`);
- `PUBLIC_SITE_URL` — `https://welove.awwwdde.art`;
- `SECRET_KEY` и `JWT_SECRET` — стабильные между деплоями.

Из `PUBLIC_SITE_URL` выводятся `ORIGIN` и **`RP_ID` = `welove.awwwdde.art`**.
`RP_ID` вшивается в каждый passkey навсегда: сменить домен потом нельзя,
не убив все ключи. Поэтому он не задаётся руками, а выводится из адреса.

## Переменные, которые нужно задать в админке панели

Вкладка env-переменных проекта `welove`:

```
VAPID_PUBLIC_KEY       — Фаза 7
VAPID_PRIVATE_KEY      — Фаза 7
VAPID_SUBJECT          — mailto:…
YANDEX_PLACES_API_KEY  — Фаза 5
TWOGIS_API_KEY         — Фаза 5, опционально
KUDAGO_CITY            — msk / spb / …
TIMEZONE               — Europe/Moscow
```

До Фаз 5 и 7 приложение работает и без них.

## Деплой

```bash
python back/cli.py deploy welove --source https://github.com/awwwdde/orbit.git
```

или через веб-админку: `https://awwwdde.art/admin` → Под-сайты → «+ Новый»
(slug `welove`, git-URL, галка «развернуть сразу»).

Проверка после деплоя:

```bash
curl -i https://welove.awwwdde.art/healthz
```

## Чем прод отличается от ТЗ 17

| ТЗ | Фактически |
|---|---|
| Отдельный VPS, Nginx, certbot | Общий VPS платформы, Caddy, автоматический TLS |
| `docker-compose.prod.yml` | Панель поднимает контейнеры сама |
| Nginx отдаёт статику, проксирует `/api` | Статику отдаёт сам FastAPI (`app/spa.py`) |
| Заголовки безопасности в Nginx | Их ставит приложение (`app/middleware/security.py`) — маршрут гостя в Caddy идёт голым `reverse_proxy`, заголовков от него не будет |
| Redis 7 | **Нет.** Панель даёт гостю только Postgres — см. ниже |
| `pg_dump` ежедневно в cron | Бэкапы гостевых БД в панели пока не реализованы (`README` панели, раздел «Статус») |

### Про Redis

Панель разворачивает гостю ровно два контейнера: приложение и Postgres.
Redis взять неоткуда, поэтому его роль закрывает Postgres:

- **challenge WebAuthn** (ТЗ 9.4, TTL 5 минут) — короткоживущие строки в БД;
- **кэш мест** (ТЗ 12.4) — таблица `places_cache`, которая в ТЗ и так была
  вторым уровнем с TTL 7 дней. Терялся только «горячий» слой на 6 часов,
  что при двух пользователях не даёт ничего.

Redis убран и из dev-окружения тоже — чтобы dev и прод не разъезжались.
Если проект однажды переедет на собственный VPS, вернуть его несложно.

### Про хранение файлов

У гостевого контейнера нет постоянного тома: всё, что записано на диск,
исчезает при следующем деплое. Для Orbit это не проблема — приложение
файлы не хранит (фото мест приходят ссылками от провайдеров).

## Локальная разработка

Прод-схему это не отменяет, локально по-прежнему удобнее раздельно:

```bash
cp .env.example .env
docker compose up
```

- фронт — http://localhost:5173 (Vite, HMR, проксирует `/api` в бэкенд)
- API — http://localhost:8000, документация на `/api/docs`

Проверить прод-сборку целиком (один контейнер, как на панели):

```bash
docker build -t orbit:local .
docker run --rm -p 8080:8080 \
  -e DATABASE_URL=postgresql://orbit:orbit@host.docker.internal:5432/orbit \
  -e PUBLIC_SITE_URL=http://localhost:8080 \
  orbit:local
```
