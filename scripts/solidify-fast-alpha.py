#!/usr/bin/env python3
"""Шустрый: укрепить альфа-канал без цветовой маски (не трогать лицо/куртку)."""
from pathlib import Path

from PIL import Image

FAST = Path(__file__).resolve().parent.parent / "public/images/fast.png"


def solidify(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            # только явный чёрный остаток фона — в прозрачность
            if a < 48 and r <= 18 and g <= 18 and b <= 18:
                px[x, y] = (0, 0, 0, 0)
                continue
            # персонаж: не размывать полупрозрачные пиксели тела/одежды
            if a > 64:
                px[x, y] = (r, g, b, 255)
    return im


def main() -> None:
    im = Image.open(FAST)
    out = solidify(im)
    out.save(FAST, format="PNG", optimize=True)
    print("OK solidify fast.png")


if __name__ == "__main__":
    main()
