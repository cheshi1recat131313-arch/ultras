#!/usr/bin/env python3
"""Здоровяк (досье): вырезка фона по силуэту (rembg), без color key."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image
from rembg import remove

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/images/tank-dossier.png"

SOURCES = [
    Path(
        r"C:\Users\vadim\.cursor\projects\c-Anomaly\assets\c__Users_vadim_AppData_Roaming_Cursor_User_workspaceStorage_dc33976521015eca047b7dafcf5cf736_images_f9e79980-b42d-4b42-930a-410a00faf4d3-233edb94-bac6-4e3a-837c-2c40b488aa00.png"
    ),
    Path(
        r"C:\Users\vadim\.cursor\projects\c-Anomaly\assets\c__Users_vadim_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_ChatGPT_Image_25_____2026__.__14_00_40-b42b6cbe-824c-447f-b965-6e092e3f8d10.png"
    ),
    ROOT / "public/images/p1.jpg",
    ROOT / "public/images/tank.png",
]


def pick_source() -> Path:
    if len(sys.argv) > 1:
        p = Path(sys.argv[1])
        if p.exists():
            return p
    for p in SOURCES:
        if p.exists():
            return p
    raise FileNotFoundError("No source image for tank dossier cutout")


def check_opaque_center(im: Image.Image) -> tuple[int, int, int]:
    r = im.convert("RGBA")
    w, h = r.size
    x0, x1 = int(w * 0.3), int(w * 0.7)
    y0, y1 = int(h * 0.2), int(h * 0.75)
    opaque = semi = trans = 0
    for y in range(y0, y1, 6):
        for x in range(x0, x1, 6):
            a = r.getpixel((x, y))[3]
            if a == 0:
                trans += 1
            elif a < 220:
                semi += 1
            else:
                opaque += 1
    return opaque, semi, trans


def main() -> None:
    src = pick_source()
    raw = src.read_bytes()
    out_bytes = remove(raw)
    out = Image.open(__import__("io").BytesIO(out_bytes)).convert("RGBA")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUT, format="PNG", optimize=True)
    o, s, t = check_opaque_center(out)
    print(f"OK {src.name} -> {OUT.name} ({out.size[0]}x{out.size[1]})")
    print(f"center sample opaque={o} semi={s} transparent={t}")
    print(f"corner alpha={out.getpixel((0, 0))[3]}")


if __name__ == "__main__":
    main()
