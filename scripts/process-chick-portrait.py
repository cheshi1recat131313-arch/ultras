from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "chick-source.png"
OUT = ROOT / "public" / "static" / "personage" / "chick.png"
CANVAS = 1024
THRESH = 32
TOP_MARGIN = 42
BOTTOM_MARGIN = 42
WIDTH_FILL = 0.92
ZOOM = 0.96


def remove_dark_background(img: Image.Image, threshold: int = THRESH) -> Image.Image:
    arr = img.convert("RGBA")
    px = arr.load()
    w, h = arr.size
    visited = set()
    q = deque()

    def is_bg(x, y):
        r, g, b, _a = px[x, y]
        return r <= threshold and g <= threshold and b <= threshold

    for x in range(w):
        for y in (0, h - 1):
            if is_bg(x, y):
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_bg(x, y):
                q.append((x, y))

    while q:
        x, y = q.popleft()
        if (x, y) in visited or not is_bg(x, y):
            continue
        visited.add((x, y))
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                q.append((nx, ny))

    return arr


def bbox_from_alpha(img: Image.Image, min_alpha: int = 12):
    px = img.load()
    w, h = img.size
    xs = []
    ys = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > min_alpha:
                xs.append(x)
                ys.append(y)
    if not xs:
        raise RuntimeError("No opaque pixels found")
    return min(xs), min(ys), max(xs), max(ys)


def crop_with_padding(img: Image.Image, pad_ratio: float = 0.02):
    x0, y0, x1, y1 = bbox_from_alpha(img)
    cw = x1 - x0 + 1
    ch = y1 - y0 + 1
    pad_x = int(round(cw * pad_ratio))
    pad_y = int(round(ch * pad_ratio))
    w, h = img.size
    left = max(0, x0 - pad_x)
    top = max(0, y0 - pad_y)
    right = min(w, x1 + 1 + pad_x)
    bottom = min(h, y1 + 1 + pad_y)
    return img.crop((left, top, right, bottom))


def main():
    if not SRC.exists():
        raise SystemExit(
            f"Missing source: {SRC}\n"
            "Place original chick illustration (black background PNG) at assets/chick-source.png,\n"
            "then run: node scripts/build-chick-portrait.js"
        )

    im = remove_dark_background(Image.open(SRC))
    crop = crop_with_padding(im)

    cw, ch = crop.size
    target_w = int(CANVAS * WIDTH_FILL)
    target_h = CANVAS - TOP_MARGIN - BOTTOM_MARGIN
    scale = min(target_w / cw, target_h / ch) * ZOOM
    new_w = max(1, int(round(cw * scale)))
    new_h = max(1, int(round(ch * scale)))
    resized = crop.resize((new_w, new_h), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    ox = (CANVAS - new_w) // 2
    oy = TOP_MARGIN + max(0, (target_h - new_h) // 2)
    canvas.paste(resized, (ox, oy), resized)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT, format="PNG", optimize=True)
    print(f"saved {OUT} size={canvas.size}")


if __name__ == "__main__":
    main()
