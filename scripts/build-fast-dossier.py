#!/usr/bin/env python3
"""Шустрый: rembg → квадрат 1024, крупный bust как в Hools."""
from __future__ import annotations

import io
import sys
from pathlib import Path

from PIL import Image
from rembg import remove

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/images/fast-dossier.png"
OUT_LEGACY = ROOT / "public/images/fast.png"
CANVAS = 1024
# Компоновка как в оригинальных Hools: персонаж почти на весь кадр.
# Целевое заполнение кадра (как tank-dossier / Hools).
CONTENT_PAD_RATIO = 0.008
BOTTOM_MARGIN_RATIO = 0.0
TOP_MARGIN_TARGET = 0.061
ALPHA_MIN = 12

SOURCES = [
    ROOT / "assets" / "fast-source.png",
    Path(
        r"C:\Users\vadim\.cursor\projects\c-Anomaly\assets\c__Users_vadim_AppData_Roaming_Cursor_User_workspaceStorage_dc33976521015eca047b7dafcf5cf736_images_ADCF4252-8098-432E-A4EE-FF0D9E90F339-095fdf07-6b02-4bc6-86a3-f480c4247394.png"
    ),
]


def pick_source() -> Path:
    if len(sys.argv) > 1:
        p = Path(sys.argv[1])
        if p.exists():
            return p
    for p in SOURCES:
        if p.exists():
            return p
    raise FileNotFoundError("No source image for fast dossier")


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
        raise ValueError("empty cutout")
    return min(xs), min(ys), max(xs), max(ys)


def solidify_fringe(im: Image.Image) -> Image.Image:
    """Убрать ореол фона (чёрный / сепия), не трогая персонажа."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if a < 40 and r <= 24 and g <= 24 and b <= 24:
                px[x, y] = (0, 0, 0, 0)
                continue
            if (
                a < 110
                and 55 <= r <= 195
                and 35 <= g <= 145
                and 15 <= b <= 95
                and r >= g >= b
            ):
                px[x, y] = (0, 0, 0, 0)
                continue
            if a > 72:
                px[x, y] = (r, g, b, 255)
    return im


def normalize_canvas(cutout: Image.Image) -> Image.Image:
    x0, y0, x1, y1 = content_bbox(cutout)
    pad = int(CANVAS * CONTENT_PAD_RATIO)
    sw, sh = cutout.size
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(sw - 1, x1 + pad)
    y1 = min(sh - 1, y1 + pad)
    content = cutout.crop((x0, y0, x1 + 1, y1 + 1))
    cw, ch = content.size
    top = int(CANVAS * TOP_MARGIN_TARGET)
    bottom = int(CANVAS * BOTTOM_MARGIN_RATIO)
    available_h = CANVAS - top - bottom
    scale = available_h / ch
    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))
    if (nw, nh) != (cw, ch):
        content = content.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    ox = (CANVAS - nw) // 2
    oy = CANVAS - bottom - nh
    if oy < top:
        oy = top
    canvas.alpha_composite(content, (ox, oy))
    return recenter_horizontal(canvas)


def recenter_horizontal(im: Image.Image) -> Image.Image:
    x0, _, x1, _ = content_bbox(im)
    dx = int(round(CANVAS / 2 - (x0 + x1) / 2))
    if dx == 0:
        return im
    out = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    out.alpha_composite(im, (dx, 0))
    return out


def save_png(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, format="PNG", compress_level=1)


def main() -> None:
    src = pick_source()
    cutout = Image.open(io.BytesIO(remove(src.read_bytes()))).convert("RGBA")
    cutout = solidify_fringe(cutout)
    out = normalize_canvas(cutout)
    save_png(out, OUT)
    save_png(out, OUT_LEGACY)
    bb = content_bbox(out)
    cx = (bb[0] + bb[2]) / 2
    cy = (bb[1] + bb[3]) / 2
    print(f"OK {src.name} -> {OUT.name} ({out.size[0]}x{out.size[1]})")
    print(f"bbox={bb} center=({cx:.1f},{cy:.1f}) canvas=({CANVAS/2},{CANVAS/2})")
    print(f"margins L/R/T/B={bb[0]} {CANVAS-1-bb[2]} {bb[1]} {CANVAS-1-bb[3]}")


if __name__ == "__main__":
    main()
