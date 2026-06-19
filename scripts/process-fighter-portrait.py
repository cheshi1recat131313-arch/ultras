from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path(
    r"C:\Users\vadim\.cursor\projects\c-Anomaly\assets\c__Users_vadim_AppData_Roaming_Cursor_User_workspaceStorage_dc33976521015eca047b7dafcf5cf736_images_66C6DCFD-5916-4F62-9CC3-A0244CD19537-5df6a784-1d04-439b-ba7b-80eaeda99914.png"
)
OUT = Path(__file__).resolve().parents[1] / "public" / "static" / "personage" / "fighter.png"
CANVAS = 1024
LIGHT_THRESH = 240
TOP_MARGIN = 18
BOTTOM_MARGIN = 20
WIDTH_FILL = 0.998
ZOOM = 1.0
# Смещение портрета вниз внутри холста (0.12 ≈ 12%).
VERTICAL_BIAS = 0.12


def remove_light_background(img: Image.Image, threshold: int = LIGHT_THRESH) -> Image.Image:
    arr = np.array(img.convert("RGBA"))
    h, w = arr.shape[:2]
    visited = np.zeros((h, w), dtype=bool)
    q = deque()

    def is_bg(y, x):
        r, g, b, _a = arr[y, x]
        return r >= threshold and g >= threshold and b >= threshold

    for x in range(w):
        for y in (0, h - 1):
            if is_bg(y, x):
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if is_bg(y, x):
                q.append((y, x))

    while q:
        y, x = q.popleft()
        if visited[y, x] or not is_bg(y, x):
            continue
        visited[y, x] = True
        arr[y, x, 3] = 0
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                q.append((ny, nx))

    return Image.fromarray(arr)


def bbox_from_alpha(img: Image.Image, min_alpha: int = 12):
    arr = np.array(img)
    mask = arr[:, :, 3] > min_alpha
    ys, xs = np.where(mask)
    if len(xs) == 0:
        raise RuntimeError("No opaque pixels found")
    return xs.min(), ys.min(), xs.max(), ys.max()


def crop_with_padding(img: Image.Image, pad_ratio: float = 0.01):
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
    im = remove_light_background(Image.open(SRC))
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
    oy = TOP_MARGIN + max(0, int((target_h - new_h) * (0.5 + VERTICAL_BIAS)))
    canvas.paste(resized, (ox, oy), resized)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT, format="PNG", optimize=True)

    arr = np.array(canvas)
    alpha = arr[:, :, 3] > 12
    ys, xs = np.where(alpha)
    print(f"saved {OUT} size={canvas.size}")
    print(
        f"top={ys.min()} bottom={ys.max()} "
        f"content_h={ys.max()-ys.min()} content_w={xs.max()-xs.min()}"
    )


if __name__ == "__main__":
    main()
