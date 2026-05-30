#!/usr/bin/env python3
"""Удаляет сплошной фон у эмблем клубов и обрезает по контуру (RGBA)."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

CLUBS_DIR = Path(__file__).resolve().parent.parent / "public" / "static" / "clubs"
TOLERANCE = 48
PADDING = 4


def corner_bg_rgb(im: Image.Image) -> tuple[int, int, int]:
    w, h = im.size
    px = im.load()
    samples: list[tuple[int, int, int]] = []
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        r, g, b, a = px[x, y]
        if a > 0:
            samples.append((r, g, b))
    if not samples:
        return (0, 0, 0)
    return tuple(sum(c[i] for c in samples) // len(samples) for i in range(3))


def color_dist(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5


def flood_remove_background(im: Image.Image, bg_rgb: tuple[int, int, int], tolerance: float) -> Image.Image:
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()

    def mark(x: int, y: int) -> None:
        if 0 <= x < w and 0 <= y < h:
            i = y * w + x
            if not seen[i]:
                seen[i] = 1
                q.append((x, y))

    for x in range(w):
        mark(x, 0)
        mark(x, h - 1)
    for y in range(h):
        mark(0, y)
        mark(w - 1, y)

    while q:
        x, y = q.popleft()
        r, g, b, a = px[x, y]
        if a == 0:
            continue
        if color_dist((r, g, b), bg_rgb) > tolerance:
            continue
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            mark(nx, ny)

    return im


def crop_to_content(im: Image.Image, padding: int = PADDING) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - padding)
    y0 = max(0, y0 - padding)
    x1 = min(im.width, x1 + padding)
    y1 = min(im.height, y1 + padding)
    return im.crop((x0, y0, x1, y1))


def process_file(path: Path) -> None:
    before = Image.open(path)
    im = before.convert("RGBA")
    bg = corner_bg_rgb(im)
    im = flood_remove_background(im, bg, TOLERANCE)
    im = crop_to_content(im)
    im.save(path, format="PNG", optimize=True)
    corners = [im.getpixel((0, 0))[3], im.getpixel((im.width - 1, 0))[3]]
    print(f"{path.name}: {before.size} -> {im.size}, corner alpha {corners}")


def main() -> None:
    files = sorted(CLUBS_DIR.glob("*.png"))
    if not files:
        raise SystemExit(f"No PNG in {CLUBS_DIR}")
    for path in files:
        process_file(path)
    print(f"Done: {len(files)} files")


if __name__ == "__main__":
    main()
