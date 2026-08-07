"""Генератор иконок приложения.

Иконка — фирменная сфера в состоянии слияния: ember и iris, смешанные
в одну. Ровно то, что значит перигей — момент максимального сближения.

Поверх — «жидкое стекло»: блик, световая кромка и внутренняя тень.
Эффект строится слоями, каждый из которых считается отдельно и потом
накладывается: так его можно править по одному, не трогая остальные.

Рисуется кодом, а не в редакторе: иконку можно пересобрать под любой
размер и поправить цвет одним числом.

    npm run icons

Pillow нужен только здесь и в зависимости проекта не входит.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

# Токены редизайна «Тёплая ночь и одна орбита».
COAL = (11, 9, 8)  # #0B0908 — фон приложения
EMBER = (255, 122, 92)  # #FF7A5C — Влад
IRIS = (143, 160, 255)  # #8FA0FF — Ангелина

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"

# Считаем с запасом и уменьшаем — дешёвое сглаживание краёв.
SUPERSAMPLE = 2


def _lerp(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return (
        round(a[0] + (b[0] - a[0]) * t),
        round(a[1] + (b[1] - a[1]) * t),
        round(a[2] + (b[2] - a[2]) * t),
    )


def _clip_to_sphere(layer: Image.Image, size: int, radius: float) -> Image.Image:
    """Оставить от слоя только то, что попадает внутрь сферы.

    Без этого блик и кромка выползают за круг и превращают шар в кляксу.
    """
    mask = Image.new("L", (size, size), 0)
    cx = cy = size / 2
    ImageDraw.Draw(mask).ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=255)
    # Смягчаем границу маски, иначе на краю появляется ступенька.
    mask = mask.filter(ImageFilter.GaussianBlur(radius=max(1.0, radius * 0.012)))

    clipped = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    clipped.paste(layer, (0, 0), mask)
    return clipped


def _sphere_body(size: int, radius: float) -> Image.Image:
    """Тело сферы: ember сверху слева перетекает в iris снизу справа."""
    body = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pixels = body.load()
    assert pixels is not None

    cx = cy = size / 2
    # Ось смешения почти горизонтальная: по диагонали iris попадал целиком
    # в теневую сторону и читался тёмно-синим вместо своего цвета.
    axis = radius * 1.15

    for y in range(size):
        for x in range(size):
            dx, dy = x - cx, y - cy
            dist = math.hypot(dx, dy)
            if dist > radius:
                continue

            # Положение вдоль оси, приведённое к 0..1.
            t = ((dx * 0.92 + dy * 0.38) / (2 * axis)) + 0.5
            colour = _lerp(EMBER, IRIS, t)

            # Затенение умножением, а не подмешиванием фона: подмешивание
            # обесцвечивало сферу в мутную сирень, умножение сохраняет тон.
            # Свет падает сверху слева, поэтому там ярче, у дальнего края темнее.
            nx, ny = dx / radius, dy / radius
            nz = math.sqrt(max(0.0, 1.0 - nx * nx - ny * ny))
            lambert = max(0.0, (-nx * 0.45) + (-ny * 0.62) + nz * 0.64)
            # Подсветка снизу не даёт теневой половине провалиться в чёрное.
            shade = 0.46 + 0.72 * lambert
            colour = (
                min(255, round(colour[0] * shade)),
                min(255, round(colour[1] * shade)),
                min(255, round(colour[2] * shade)),
            )

            # Мягкая кромка — последние 2% радиуса растворяются.
            edge = min(1.0, (radius - dist) / (radius * 0.02))
            pixels[x, y] = (*colour, round(255 * edge))

    return body


def _glow(size: int, radius: float) -> Image.Image:
    """Свечение вокруг сферы: на тёмном фоне именно оно даёт глубину."""
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    cx = cy = size / 2
    spread = radius * 1.14

    draw.ellipse(
        (cx - spread, cy - spread, cx + spread, cy + spread),
        fill=(*_lerp(EMBER, IRIS, 0.5), 95),
    )
    return glow.filter(ImageFilter.GaussianBlur(radius=radius * 0.22))


def _sheen(size: int, radius: float) -> Image.Image:
    """Блик — широкая мягкая полоса вдоль верхнего края.

    Первая версия рисовала яркую точку по центру верхней половины, и она
    читалась как глаз. У стекла блик повторяет форму поверхности: это
    вытянутая дуга, обнимающая край, а не кружок.
    """
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    cx = cy = size / 2
    # Эллипс шире сферы и сдвинут вверх: внутрь попадает только его нижний край,
    # получается серп.
    ex, ey = cx - radius * 0.26, cy - radius * 0.86
    rx, ry = radius * 0.58, radius * 0.44

    draw.ellipse((ex - rx, ey - ry, ex + rx, ey + ry), fill=(255, 252, 250, 165))
    layer = layer.filter(ImageFilter.GaussianBlur(radius=radius * 0.10))

    return _clip_to_sphere(layer, size, radius)


def _rim(size: int, radius: float) -> Image.Image:
    """Световая кромка: свет огибает шар и подсвечивает дальний край."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    cx = cy = size / 2

    # Дуга снизу справа — противоположно блику.
    draw.arc(
        (cx - radius * 0.985, cy - radius * 0.985, cx + radius * 0.985, cy + radius * 0.985),
        start=25,
        end=155,
        fill=(255, 244, 238, 235),
        width=max(2, round(radius * 0.022)),
    )
    blurred = layer.filter(ImageFilter.GaussianBlur(radius=radius * 0.016))
    return _clip_to_sphere(blurred, size, radius)


def _inner_shadow(size: int, radius: float) -> Image.Image:
    """Внутренняя тень у верхнего края — под ней стекло выглядит толстым."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    cx = cy = size / 2

    draw.arc(
        (cx - radius * 0.97, cy - radius * 0.97, cx + radius * 0.97, cy + radius * 0.97),
        start=195,
        end=345,
        fill=(*COAL, 150),
        width=max(2, round(radius * 0.07)),
    )
    blurred = layer.filter(ImageFilter.GaussianBlur(radius=radius * 0.06))
    return _clip_to_sphere(blurred, size, radius)


def render(size: int, sphere_ratio: float) -> Image.Image:
    """Иконка заданного размера.

    `sphere_ratio` — диаметр сферы относительно стороны. Для maskable он
    меньше: значимое содержимое обязано помещаться в центральные 80%,
    иначе Android срежет края (ТЗ 14.1).
    """
    big = size * SUPERSAMPLE
    radius = big * sphere_ratio / 2

    canvas = Image.new("RGBA", (big, big), (*COAL, 255))

    # Порядок слоёв: свет за сферой → тело → объём → блики поверх.
    canvas.alpha_composite(_glow(big, radius))
    canvas.alpha_composite(_sphere_body(big, radius))
    canvas.alpha_composite(_inner_shadow(big, radius))
    canvas.alpha_composite(_rim(big, radius))
    canvas.alpha_composite(_sheen(big, radius))

    icon = canvas.resize((size, size), Image.LANCZOS).convert("RGB")
    # Лёгкое размытие: сфера в приложении тоже под blur — иконка должна
    # выглядеть тем же элементом, а не его контуром.
    return icon.filter(ImageFilter.GaussianBlur(radius=size / 400))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    for size in (192, 512):
        render(size, sphere_ratio=0.84).save(OUT / f"icon-{size}.png")

    # Maskable: сфера в центральных 80%, вокруг только фон.
    render(512, sphere_ratio=0.60).save(OUT / "maskable-512.png")

    # iOS маску не применяет и рисует иконку как есть.
    render(180, sphere_ratio=0.84).save(OUT / "apple-touch-icon-180.png")

    # Значок уведомлений: Android рисует его монохромным по альфа-каналу,
    # поэтому здесь важен только силуэт.
    render(72, sphere_ratio=0.9).save(OUT / "badge-72.png")

    for path in sorted(OUT.iterdir()):
        print(f"{path.name:28} {path.stat().st_size:>7} B")


if __name__ == "__main__":
    main()
