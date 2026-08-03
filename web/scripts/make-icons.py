"""Генератор иконок приложения.

Иконка — фирменная сфера на почти-чёрном фоне (ТЗ 14.1): те же ember и iris,
слитые в одну, то есть состояние «подтверждено». Ровно то, что означает
перигей — момент максимального сближения.

Рисуется кодом, а не в редакторе: так иконку можно пересобрать под любой
размер и поправить цвета одним числом. Запуск:

    python scripts/make-icons.py

Pillow нужен только здесь и в зависимости проекта не входит.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageFilter

VOID = (11, 10, 15)  # #0B0A0F — фон приложения
EMBER = (255, 77, 77)  # #FF4D4D — Влад
IRIS = (123, 92, 255)  # #7B5CFF — Ангелина

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"


def _mix(base: tuple[int, int, int], color: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return tuple(round(b + (c - b) * t) for b, c in zip(base, color))  # type: ignore[return-value]


def render(size: int, sphere_ratio: float) -> Image.Image:
    """Сфера заданной доли от холста на фоне void.

    `sphere_ratio` — диаметр сферы относительно стороны. Для maskable он
    меньше: значимое содержимое обязано помещаться в центральные 80%,
    иначе Android срежет края (ТЗ 14.1).
    """
    # Рисуем с запасом и уменьшаем — дешёвое сглаживание краёв.
    scale = 4
    big = size * scale
    img = Image.new("RGB", (big, big), VOID)
    pixels = img.load()
    assert pixels is not None

    radius = big * sphere_ratio / 2
    cx = cy = big / 2

    # Два центра свечения внутри сферы: тёплый сверху слева, холодный снизу справа.
    ember_c = (cx - radius * 0.32, cy - radius * 0.34)
    iris_c = (cx + radius * 0.30, cy + radius * 0.32)
    falloff = radius * 1.15

    for y in range(big):
        for x in range(big):
            dx, dy = x - cx, y - cy
            dist = math.hypot(dx, dy)
            if dist > radius:
                continue

            # Мягкий край: последние 6% радиуса растворяются в фоне.
            edge = min(1.0, (radius - dist) / (radius * 0.06))

            e = max(0.0, 1.0 - math.hypot(x - ember_c[0], y - ember_c[1]) / falloff)
            i = max(0.0, 1.0 - math.hypot(x - iris_c[0], y - iris_c[1]) / falloff)

            color = _mix(VOID, EMBER, e**1.7 * edge)
            color = _mix(color, IRIS, i**1.7 * 0.85 * edge)
            pixels[x, y] = color

    img = img.resize((size, size), Image.LANCZOS)
    # Лёгкое размытие: сфера в приложении тоже под blur, иконка должна совпадать.
    return img.filter(ImageFilter.GaussianBlur(radius=size / 220))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    # Обычные иконки: сфера почти во весь холст.
    for size in (192, 512):
        render(size, sphere_ratio=0.86).save(OUT / f"icon-{size}.png")

    # Maskable: сфера в центральных 80%, вокруг только фон.
    render(512, sphere_ratio=0.62).save(OUT / "maskable-512.png")

    # iOS не применяет маску и рисует иконку как есть.
    render(180, sphere_ratio=0.86).save(OUT / "apple-touch-icon-180.png")

    # Значок для уведомлений (ТЗ 13.3). Android рисует его монохромным
    # по альфа-каналу, поэтому здесь важен только силуэт.
    render(72, sphere_ratio=0.9).save(OUT / "badge-72.png")

    for path in sorted(OUT.iterdir()):
        print(f"{path.name:28} {path.stat().st_size:>7} B")


if __name__ == "__main__":
    main()
