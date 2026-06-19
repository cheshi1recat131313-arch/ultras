from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path(
    r"C:\Users\vadim\.cursor\projects\c-Anomaly\assets\c__Users_vadim_AppData_Roaming_Cursor_User_workspaceStorage_dc33976521015eca047b7dafcf5cf736_images_21fd18d6-9b6b-4fb1-afa2-52a51f151c3b-86344e3e-ed56-49dd-9938-8c6acc31843c.png"
)
OUT = Path(__file__).resolve().parents[1] / "public" / "static" / "personage" / "balanced.png"
CANVAS = 1024
THRESH = 32
TOP_MARGIN = 66
BOTTOM_TRIM_RATIO = 0.24


def remove_dark_background(img: Image.Image, threshold: int = THRESH) -> Image.Image:
    arr = np.array(img.convert("RGBA"))
    h, w = arr.shape[:2]
    visited = np.zeros((h, w), dtype=bool)
    q = deque()

    def is_bg(y, x):
        r, g, b, _a = arr[y, x]
        return r <= threshold and g <= threshold and b <= threshold

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


def main():
    im = remove_dark_background(Image.open(SRC))
    x0, y0, x1, y1 = bbox_from_alpha(im)
    full_h = y1 - y0 + 1
    keep_h = max(1, int(round(full_h * (1 - BOTTOM_TRIM_RATIO))))
    crop = im.crop((x0, y0, x1 + 1, y0 + keep_h))

    cw, ch = crop.size
    target_h = CANVAS - TOP_MARGIN
    scale = target_h / ch
    new_w = max(1, int(round(cw * scale)))
    new_h = max(1, int(round(ch * scale)))
    resized = crop.resize((new_w, new_h), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    ox = (CANVAS - new_w) // 2
    oy = TOP_MARGIN
    canvas.paste(resized, (ox, oy), resized)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT, format="PNG", optimize=True)

    # Маска силуэта: фон прозрачный, фигура непрозрачная (клубный градиент только за персонажем).
    import subprocess

    solidify = Path(__file__).resolve().parent / "solidify-portrait-alpha.js"
    subprocess.run(["node", str(solidify), str(OUT)], check=False)

    arr = np.array(canvas)
    alpha = arr[:, :, 3] > 12
    ys, xs = np.where(alpha)
    print(f"saved {OUT} size={canvas.size}")
    print(f"top={ys.min()} bottom={ys.max()} content_h={ys.max()-ys.min()}")


if __name__ == "__main__":
    main()
