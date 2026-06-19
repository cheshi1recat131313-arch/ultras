#!/usr/bin/env python3
"""Центрирует персонажа Шустрый в fast-dossier.png без изменения масштаба."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "public/images/fast-dossier.png"
ALPHA_MIN = 10


def content_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    xs: list[int] = []
    ys: list[int] = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > ALPHA_MIN:
                xs.append(x)
                ys.append(y)
    if not xs:
        raise ValueError("empty image")
    return min(xs), min(ys), max(xs), max(ys)


def recenter(im: Image.Image, dx: int | None = None, dy: int | None = None) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    x0, y0, x1, y1 = content_bbox(im)
    cx = (x0 + x1) / 2
    cy = (y0 + y1) / 2
    if dx is None:
        dx = int(round(w / 2 - cx))
    if dy is None:
        dy = int(round(h / 2 - cy))
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.alpha_composite(im, (dx, dy))
    return out


def main() -> None:
    im = Image.open(TARGET)
    before = content_bbox(im)
    out = recenter(im)
    after = content_bbox(out)
    out.save(TARGET, format="PNG", optimize=True)
    print(f"OK {TARGET.name} ({out.size[0]}x{out.size[1]})")
    print(f"bbox before={before} after={after}")


if __name__ == "__main__":
    main()
