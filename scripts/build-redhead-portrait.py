#!/usr/bin/env python3
"""
Рыжая бестия: оригинал с чёрным фоном → прозрачный PNG 1024×1024.
Только чистый чёрный (#000) снимается с краёв — линзы и тёмные контуры сохраняются.
"""
from __future__ import annotations

import shutil
import sys
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/static/personage/redhead.png"
CANVAS = 1024
CONTENT_PAD_RATIO = 0.006
BOTTOM_MARGIN_RATIO = 0.0
TOP_MARGIN_TARGET = 0.024
SCALE_BOOST = 1.04
SHIFT_Y = 8
MAX_HOLE_PIXELS = 180
ALPHA_MIN = 12

SOURCES = [
    ROOT / "assets/redhead-source.png",
    ROOT
    / ".cursor/projects/root/assets/c__Users_vadim_AppData_Roaming_Cursor_User_workspaceStorage_89fdb4b94e95cfed6dcfe708483646fa_images_b9749cdf-1802-4f07-addc-47be3b78f1fc-84359a5a-6bbd-402f-97fe-602bf574ecbb.png",
    Path(
        "/root/.cursor/projects/root/assets/c__Users_vadim_AppData_Roaming_Cursor_User_workspaceStorage_89fdb4b94e95cfed6dcfe708483646fa_images_b9749cdf-1802-4f07-addc-47be3b78f1fc-84359a5a-6bbd-402f-97fe-602bf574ecbb.png"
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
    raise FileNotFoundError("Place source at assets/redhead-source.png")


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


def character_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    """BBox всего, что не чисто-чёрный фон (включая тёмные линзы)."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    xs: list[int] = []
    ys: list[int] = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 0 and not is_pure_black(r, g, b):
                xs.append(x)
                ys.append(y)
    if not xs:
        raise ValueError("no character pixels")
    return min(xs), min(ys), max(xs), max(ys)


def remove_black_background(im: Image.Image) -> Image.Image:
    """Снимаем чистый чёрный, достижимый от краёв кадра (линзы остаются островками)."""
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
        push(x + 1, y)
        push(x - 1, y)
        push(x, y + 1)
        push(x, y - 1)

    return im


def purge_orphan_pure_black(im: Image.Image) -> Image.Image:
    """После ресайза — убрать оставшийся чистый чёрный, не связанный с линзами."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 0 and is_pure_black(r, g, b):
                touch_clear = False
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if nx < 0 or ny < 0 or nx >= w or ny >= h or px[nx, ny][3] == 0:
                        touch_clear = True
                        break
                if touch_clear:
                    px[x, y] = (0, 0, 0, 0)
    return im


def remove_light_fringe(im: Image.Image) -> Image.Image:
    """Светло-серый ореол на краях волос (не трогаем кожу и блики)."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            touch_clear = any(
                nx < 0
                or ny < 0
                or nx >= w
                or ny >= h
                or px[nx, ny][3] == 0
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))
            )
            if not touch_clear:
                continue
            lo, hi = min(r, g, b), max(r, g, b)
            if lo >= 168 and hi - lo <= 36 and a <= 255:
                px[x, y] = (0, 0, 0, 0)
    return im


def fill_interior_holes(im: Image.Image, max_pixels: int = MAX_HOLE_PIXELS) -> Image.Image:
    """Закрыть мелкие прозрачные дыры внутри силуэта (щель у чёлки)."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    try:
        x0, y0, x1, y1 = content_bbox(im)
    except ValueError:
        return im
    pad = 4
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
            rs = gs = bs = 0
            n = 0
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
    scale = (available_h / ch) * SCALE_BOOST
    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))
    if (nw, nh) != (cw, ch):
        content = content.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    ox = (CANVAS - nw) // 2
    oy = CANVAS - bottom - nh + SHIFT_Y
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


def main() -> None:
    src = pick_source()
    asset = ROOT / "assets/redhead-source.png"
    if src.resolve() != asset.resolve():
        shutil.copy2(src, asset)

    cutout = remove_black_background(Image.open(src))
    cutout = solidify_fringe(cutout)
    cutout = remove_light_fringe(cutout)
    cutout = fill_interior_holes(cutout)
    out = normalize_canvas(cutout)
    out = sharpen_alpha(out)
    out = purge_orphan_pure_black(out)
    out = remove_light_fringe(out)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUT, format="PNG", compress_level=1)

    bb = content_bbox(out)
    shutil.copy2(OUT, ROOT / "public/static/personage/spark.png")

    ch = bb[3] - bb[1] + 1
    print(f"OK {src.name} -> {OUT}")
    print(f"bbox={bb} height_ratio={ch/CANVAS:.3f} eff_h@56={ch*56/CANVAS:.1f}px")
    print("spark <- redhead.png")


if __name__ == "__main__":
    main()
