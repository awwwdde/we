"""Раздача собранной SPA тем же процессом, что и API.

Контракт платформы awwwdde — один контейнер, один порт. Поэтому статику
фронта отдаёт сам FastAPI, без nginx: `/api/*` и `/healthz` обрабатываются
роутерами, всё остальное отдаёт SPA (клиентский роутинг React Router).
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse

# Ассеты Vite имеют хэш в имени — их можно кэшировать вечно.
# index.html и sw.js кэшировать нельзя, иначе обновление не доедет (ТЗ 17).
_IMMUTABLE = "public, max-age=31536000, immutable"
_NO_CACHE = "no-cache"


def mount_spa(app: FastAPI, static_dir: str) -> None:
    """Подключить SPA, если каталог со сборкой существует.

    В dev статики нет — фронт крутится на Vite, и функция ничего не делает.
    В прод-образе каталог всегда на месте.
    """
    root = Path(static_dir).resolve()
    index = root / "index.html"
    if not index.is_file():
        return

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str) -> FileResponse:
        if full_path:
            candidate = (root / full_path).resolve()
            # `root in parents` отсекает выход за пределы каталога (../).
            if candidate.is_file() and root in candidate.parents:
                cache = _IMMUTABLE if full_path.startswith("assets/") else _NO_CACHE
                return FileResponse(candidate, headers={"Cache-Control": cache})

        # Всё остальное — клиентский маршрут: отдаём index, роутер разберётся.
        return FileResponse(index, headers={"Cache-Control": _NO_CACHE})
