#!/usr/bin/env python3
"""Если fast.png без прозрачности — снять только чёрный фон от краёв."""
from __future__ import annotations

import sys
from importlib.machinery import SourceFileLoader
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FAST = ROOT / "public/images/fast.png"


def main() -> None:
    from PIL import Image

    if not FAST.exists():
        print("SKIP no fast.png")
        return

    im = Image.open(FAST).convert("RGBA")
    corners = [im.getpixel((0, 0)), im.getpixel((im.width - 1, 0)), im.getpixel((0, im.height - 1))]
    if all(p[3] < 20 for p in corners):
        print("OK fast.png already transparent")
        return

    ppa = SourceFileLoader("ppa", str(ROOT / "scripts/process-personage-avatars.py")).load_module()
    out, removed, _bg = ppa.remove_black_background(im)
    out.save(FAST, format="PNG", optimize=True)
    pct = round(100 * removed / (im.width * im.height), 1)
    print(f"OK fast.png matte fixed (-{pct}%)")


if __name__ == "__main__":
    main()
    sys.exit(0)
