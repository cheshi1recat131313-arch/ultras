#!/usr/bin/env python3
"""Подгонка компоновки tough-dossier: масштаб и сдвиг без rembg."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TARGETS = [
    ROOT / "public/images/tough-dossier.png",
    ROOT / "public/static/personage/tough.png",
]
CANVAS = 1024
ALPHA_MIN = 12
SCALE_BOOST = 1.11
SHIFT_Y = 24
TOP_MARGIN_PX = 12


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


def recenter_horizontal(im: Image.Image) -> Image.Image:
    x0, _, x1, _ = content_bbox(im)
    dx = int(round(CANVAS / 2 - (x0 + x1) / 2))
    if dx == 0:
        return im
    out = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    out.alpha_composite(im, (dx, 0))
    return out


def adjust(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    x0, y0, x1, y1 = content_bbox(im)
    pad = 2
    content = im.crop(
        (
            max(0, x0 - pad),
            max(0, y0 - pad),
            min(CANVAS, x1 + pad + 1),
            min(CANVAS, y1 + pad + 1),
        )
    )
    cw, ch = content.size
    nw = max(1, int(round(cw * SCALE_BOOST)))
    nh = max(1, int(round(ch * SCALE_BOOST)))
    content = content.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    ox = (CANVAS - nw) // 2
    oy = CANVAS - nh + SHIFT_Y
    if oy < TOP_MARGIN_PX:
        oy = TOP_MARGIN_PX
    canvas.alpha_composite(content, (ox, oy))
    return recenter_horizontal(canvas)


def main() -> None:
    src = TARGETS[0]
    out = adjust(Image.open(src))
    for path in TARGETS:
        path.parent.mkdir(parents=True, exist_ok=True)
        out.save(path, format="PNG", compress_level=1)
    bb = content_bbox(out)
    print(f"OK scale={SCALE_BOOST} shift_y={SHIFT_Y}")
    print(f"bbox={bb} margins T/B/L/R={bb[1]} {CANVAS-1-bb[3]} {bb[0]} {CANVAS-1-bb[2]}")


if __name__ == "__main__":
    main()
