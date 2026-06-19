#!/usr/bin/env python3
"""Районный: вырезка с чёрного фона → квадрат 1024×1024 RGB с жёлтым фоном в файле."""
from __future__ import annotations

import shutil
import sys
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/static/bots/rayon.png"
CANVAS = 1024
BG_RGB = (252, 200, 61)
TARGET_HEIGHT_RATIO = 0.94
TARGET_EYE_Y_FRAC = 0.31
EYE_LINE_FRAC = 0.19
MIN_TOP_MARGIN = 0.038
BOTTOM_MARGIN = 0.012
CROP_BOTTOM_FRAC = 0.17
FINAL_ZOOM_KEEP = 0.895
ALPHA_MIN = 12
MAX_HOLE_PIXELS = 50000

SOURCES = [
    ROOT / "assets/rayon-source.png",
    ROOT / ".cursor/projects/root/assets/rayon-source-new.png",
]


def pick_source() -> Path:
    if len(sys.argv) > 1:
        p = Path(sys.argv[1])
        if p.exists():
            return p
    for p in SOURCES:
        if p.exists():
            return p
    raise FileNotFoundError("Place source at assets/rayon-source.png")


def is_pure_black(r: int, g: int, b: int) -> bool:
    return r <= 8 and g <= 8 and b <= 8


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


def remove_black_background(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
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

    while q:
        x, y = q.popleft()
        r, g, b, a = px[x, y]
        if a == 0 or not is_pure_black(r, g, b):
            continue
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            push(nx, ny)

    return im


def solidify_fringe(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 72:
                px[x, y] = (r, g, b, 255)
    return im


def fill_interior_holes(im: Image.Image, max_pixels: int = MAX_HOLE_PIXELS) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    try:
        x0, y0, x1, y1 = content_bbox(im)
    except ValueError:
        return im
    pad = 6
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(w - 1, x1 + pad)
    y1 = min(h - 1, y1 + pad)

    seen = bytearray(w * h)
    for sy in range(y0, y1 + 1):
        for sx in range(x0, x1 + 1):
            i = sy * w + sx
            if seen[i] or px[sx, sy][3] > ALPHA_MIN:
                continue
            comp: list[tuple[int, int]] = []
            q: deque[tuple[int, int]] = deque([(sx, sy)])
            seen[i] = 1
            touches_border = False
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                if x <= x0 or x >= x1 or y <= y0 or y >= y1:
                    touches_border = True
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if nx < x0 or nx > x1 or ny < y0 or ny > y1:
                        continue
                    ni = ny * w + nx
                    if seen[ni] or px[nx, ny][3] > ALPHA_MIN:
                        continue
                    seen[ni] = 1
                    q.append((nx, ny))
            if touches_border or len(comp) > max_pixels:
                continue
            rs = gs = bs = n = 0
            for x, y in comp:
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if px[nx, ny][3] > ALPHA_MIN:
                        nr, ng, nb, _ = px[nx, ny]
                        rs += nr
                        gs += ng
                        bs += nb
                        n += 1
            if n == 0:
                continue
            fill = (rs // n, gs // n, bs // n, 255)
            for x, y in comp:
                px[x, y] = fill
    return im


def sharpen_alpha(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if 0 < a < 255:
                px[x, y] = (r, g, b, 255)
    return im


def normalize_canvas(cutout: Image.Image) -> Image.Image:
    x0, y0, x1, y1 = content_bbox(cutout)
    pad = int(CANVAS * 0.008)
    sw, sh = cutout.size
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(sw - 1, x1 + pad)
    y1 = min(sh - 1, y1 + pad)
    content = cutout.crop((x0, y0, x1 + 1, y1 + 1))
    cw, ch = content.size
    trim = int(round(ch * CROP_BOTTOM_FRAC))
    if 40 < trim < ch - 80:
        content = content.crop((0, 0, cw, ch - trim))
        ch = content.size[1]
    target_h = CANVAS * TARGET_HEIGHT_RATIO
    scale = min(target_h / ch, (CANVAS * (1 - MIN_TOP_MARGIN - BOTTOM_MARGIN)) / ch)
    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))
    if (nw, nh) != (cw, ch):
        content = content.resize((nw, nh), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    ox = (CANVAS - nw) // 2
    eye_y = int(round(nh * EYE_LINE_FRAC))
    target_eye_y = int(round(CANVAS * TARGET_EYE_Y_FRAC))
    oy = target_eye_y - eye_y
    min_top = int(round(CANVAS * MIN_TOP_MARGIN))
    max_top = CANVAS - int(round(CANVAS * BOTTOM_MARGIN)) - nh
    oy = max(min_top, min(oy, max_top))
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


def zoom_crop_bottom(im: Image.Image, keep_frac: float = FINAL_ZOOM_KEEP) -> Image.Image:
    """Срез снизу и масштаб обратно — крупнее лицо, без подмышек в кадре."""
    w, h = im.size
    nh = max(1, int(round(h * keep_frac)))
    cropped = im.crop((0, 0, w, nh))
    return cropped.resize((w, h), Image.Resampling.LANCZOS)


def flatten_on_yellow(rgba: Image.Image) -> Image.Image:
    base = Image.new("RGB", (CANVAS, CANVAS), BG_RGB)
    layer = rgba.convert("RGBA")
    base.paste(layer, (0, 0), layer)
    return base


def main() -> None:
    src = pick_source()
    asset = ROOT / "assets/rayon-source.png"
    if src.resolve() != asset.resolve():
        shutil.copy2(src, asset)

    if OUT.exists():
        OUT.unlink()

    cutout = remove_black_background(Image.open(asset))
    cutout = solidify_fringe(cutout)
    cutout = fill_interior_holes(cutout)
    rgba = normalize_canvas(cutout)
    rgba = sharpen_alpha(rgba)
    rgba = fill_interior_holes(rgba)
    rgba = fill_interior_holes(rgba)
    out = flatten_on_yellow(rgba)
    out = zoom_crop_bottom(out)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUT, format="PNG", compress_level=6)

    print(f"OK {src.name} -> {OUT} ({out.mode} {out.size[0]}x{out.size[1]})")


if __name__ == "__main__":
    main()
