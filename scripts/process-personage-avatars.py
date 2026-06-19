#!/usr/bin/env python3
"""Убирает фон у аватарок персонажей → PNG с alpha. Один исходник → один PNG."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent

# исходник (относительно ROOT) → выходной PNG (относительно ROOT)
JOBS = [
    # Здоровяк: public/images/tank-dossier.png (rembg), не из p1.jpg
    # Шустрый: public/images/fast-dossier.png (rembg)
    # Крепыш: public/images/tough-dossier.png (rembg)
    ("public/static/personage/x_b7c1209c.jpg", "public/static/personage/balanced.png"),
    ("public/static/personage/x_20f9ea90.jpg", "public/static/personage/valk.png"),
    ("public/static/personage/x_3c69aea4.jpg", "public/static/personage/shadow.png"),
    ("public/static/personage/x_34042d44.jpg", "public/static/personage/redhead.png"),
    ("public/static/personage/x_8d41c12d.jpg", "public/static/personage/fighter.png"),
    ("public/static/personage/x_d87b8a96.jpg", "public/static/personage/chick.png"),
]


def edge_median_rgb(im: Image.Image) -> tuple[int, int, int]:
    w, h = im.size
    px = im.load()
    samples: list[tuple[int, int, int]] = []
    for x in range(w):
        for y in (0, h - 1):
            r, g, b, a = px[x, y]
            if a > 0:
                samples.append((r, g, b))
    for y in range(h):
        for x in (0, w - 1):
            r, g, b, a = px[x, y]
            if a > 0:
                samples.append((r, g, b))
    if not samples:
        return (250, 219, 79)
    return tuple(sum(c[i] for c in samples) // len(samples) for i in range(3))


def color_dist(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5


def is_yellow_bg(r: int, g: int, b: int) -> bool:
    return r >= 165 and g >= 115 and b <= 140 and (r - b) >= 45


def is_near_bg(r: int, g: int, b: int, bg: tuple[int, int, int], tol: float) -> bool:
    if is_yellow_bg(r, g, b):
        return True
    return color_dist((r, g, b), bg) <= tol


def is_black_pixel(r: int, g: int, b: int, max_rgb: int = 12) -> bool:
    return r <= max_rgb and g <= max_rgb and b <= max_rgb


def is_dark_studio_bg(bg: tuple[int, int, int]) -> bool:
    return max(bg) <= 50 and sum(bg) / 3 <= 40


def remove_black_background(im: Image.Image) -> tuple[Image.Image, int, tuple[int, int, int]]:
    """Чёрный фон (p1/p2): снимаем только чёрные пиксели, связанные с края."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    bg = (0, 0, 0)
    seen = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()

    def push(x: int, y: int) -> None:
        if 0 <= x < w and 0 <= y < h:
            i = y * w + x
            if not seen[i]:
                seen[i] = 1
                q.append((x, y))

    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)

    removed = 0
    while q:
        x, y = q.popleft()
        r, g, b, a = px[x, y]
        if a == 0 or not is_black_pixel(r, g, b):
            continue
        px[x, y] = (0, 0, 0, 0)
        removed += 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            push(nx, ny)

    return im, removed, bg


def remove_background(im: Image.Image) -> tuple[Image.Image, int, tuple[int, int, int]]:
    im = im.convert("RGBA")
    bg = edge_median_rgb(im)
    if is_dark_studio_bg(bg):
        return remove_black_background(im)

    w, h = im.size
    px = im.load()
    tol = 52.0
    seen = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()

    def push(x: int, y: int) -> None:
        if 0 <= x < w and 0 <= y < h:
            i = y * w + x
            if not seen[i]:
                seen[i] = 1
                q.append((x, y))

    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)

    removed = 0
    while q:
        x, y = q.popleft()
        r, g, b, a = px[x, y]
        if a == 0:
            continue
        if not is_near_bg(r, g, b, bg, tol):
            continue
        px[x, y] = (r, g, b, 0)
        removed += 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            push(nx, ny)

    return im, removed, bg


def solidify_character_alpha(im: Image.Image) -> Image.Image:
    """Маска силуэта: фон с краёв → прозрачный, фигура внутри → непрозрачная."""
    from collections import deque

    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    is_bg = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def push_if_bg(x: int, y: int) -> None:
        if x < 0 or y < 0 or x >= w or y >= h or is_bg[y][x]:
            return
        if px[x, y][3] < 140:
            is_bg[y][x] = True
            q.append((x, y))

    for x in range(w):
        push_if_bg(x, 0)
        push_if_bg(x, h - 1)
    for y in range(h):
        push_if_bg(0, y)
        push_if_bg(w - 1, y)

    while q:
        x, y = q.popleft()
        push_if_bg(x + 1, y)
        push_if_bg(x - 1, y)
        push_if_bg(x, y + 1)
        push_if_bg(x, y - 1)

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_bg[y][x]:
                px[x, y] = (0, 0, 0, 0)
                continue
            if 0 < a < 255:
                nr = min(255, int(r * 255 / a))
                ng = min(255, int(g * 255 / a))
                nb = min(255, int(b * 255 / a))
                px[x, y] = (nr, ng, nb, 255)
    return im


def process(src_rel: str, out_rel: str) -> None:
    src = ROOT / src_rel
    out = ROOT / out_rel
    if not src.exists():
        print(f"SKIP missing {src_rel}")
        return
    if out.exists() and src_rel.endswith("tough") is False:
        # tough already processed manually; reprocess all others always
        pass
    im = Image.open(src)
    out_im, removed, bg = remove_background(im)
    out_im = solidify_character_alpha(out_im)
    out.parent.mkdir(parents=True, exist_ok=True)
    out_im.save(out, format="PNG", optimize=True)
    pct = round(100 * removed / (im.width * im.height), 1)
    print(f"OK {src_rel} -> {out_rel} ({im.size[0]}x{im.size[1]}, bg={bg}, -{pct}%)")


def main() -> None:
    for src, out in JOBS:
        process(src, out)
    # spark = redhead (тот же исходник)
    spark_out = ROOT / "public/static/personage/spark.png"
    redhead = ROOT / "public/static/personage/redhead.png"
    if redhead.exists():
        spark_out.write_bytes(redhead.read_bytes())
        print(f"OK copy redhead.png -> spark.png")
    print("Done.")


if __name__ == "__main__":
    main()
