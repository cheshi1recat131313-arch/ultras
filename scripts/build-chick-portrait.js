#!/usr/bin/env node
/**
 * Чёткая чувиха — сборка портрета с нуля из исходника.
 * Прозрачный PNG, без подложек, теней и обводок.
 *
 * Запуск: node scripts/build-chick-portrait.js
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "public/static/personage/chick.png");
const PREVIEW = path.join(ROOT, "scripts/chick-club-preview.png");
const CANVAS = 1024;

const TARGET_HEIGHT_RATIO = 0.92;
const TARGET_EYE_Y = Math.round(CANVAS * 0.33);
const EYE_LINE_FRAC = 0.2;
const MARGIN_TOP = Math.round(CANVAS * 0.045);
const MARGIN_BOTTOM = Math.round(CANVAS * 0.012);
const MARGIN_SIDE = Math.round(CANVAS * 0.028);

const SOURCE_CANDIDATES = [
    path.join(ROOT, "assets/chick-source.png"),
    path.join(
        ROOT,
        "assets/c__Users_vadim_AppData_Roaming_Cursor_User_workspaceStorage_dc33976521015eca047b7dafcf5cf736_images_86c88039-f211-4c60-a57c-b289f431cc36-e1c54415-69b7-4ed6-b55d-7735a24e45fd.png"
    ),
    path.join(ROOT, "public/static/personage/chick-source.png")
];

const CLUB_THEMES = {
    dynamo: ["#1671C0", "#FFFF15"],
    belarus: ["#3a62c8", "#2a7840"],
    hark: ["#1a171b", "#ee8541"],
    sparta: ["#c62828", "#f5f2f2"],
    kharki: ["#d8b830", "#2a5838"],
    parovozy: ["#c03030", "#2a7840"],
    army: ["#a83038", "#2c322a"],
    neva: ["#b8d8f2", "#ffffff"]
};

function pickSource() {
    if (process.argv[2]) {
        const custom = path.resolve(process.argv[2]);
        if (!fs.existsSync(custom)) {
            throw new Error(`Source not found: ${custom}`);
        }
        return custom;
    }
    for (const candidate of SOURCE_CANDIDATES) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    throw new Error(
        "Chick source not found. Place original PNG at assets/chick-source.png or pass path:\n" +
            "  node scripts/build-chick-portrait.js /path/to/source.png"
    );
}

function isBlackBg(r, g, b, a, threshold = 32) {
    return a > 0 && r <= threshold && g <= threshold && b <= threshold;
}

function removeFringe(data, w, h, maxDist = 8) {
    const out = Buffer.from(data);
    const dist = new Int16Array(w * h);
    dist.fill(-1);
    const queue = [];

    for (let idx = 0; idx < w * h; idx++) {
        if (out[idx * 4 + 3] === 0) {
            dist[idx] = 0;
            queue.push(idx);
        }
    }

    for (let head = 0; head < queue.length; head++) {
        const idx = queue[head];
        const d = dist[idx];
        if (d >= maxDist) continue;
        const x = idx % w;
        const y = (idx / w) | 0;
        for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ]) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const ni = ny * w + nx;
            if (dist[ni] !== -1) continue;
            if (out[ni * 4 + 3] === 0) continue;
            dist[ni] = d + 1;
            queue.push(ni);
        }
    }

    const core = new Uint8Array(w * h);
    for (let idx = 0; idx < w * h; idx++) {
        if (dist[idx] > maxDist) core[idx] = 1;
    }

    function touchesCore(idx) {
        const x = idx % w;
        const y = (idx / w) | 0;
        for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [1, 1],
            [-1, 1],
            [1, -1],
            [-1, -1]
        ]) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            if (core[ny * w + nx]) return true;
        }
        return false;
    }

    for (let idx = 0; idx < w * h; idx++) {
        const d = dist[idx];
        if (d <= 0 || d > maxDist) continue;
        const i = idx * 4;
        const r = out[i];
        const g = out[i + 1];
        const b = out[i + 2];
        const lum = (r + g + b) / 3;
        const sat = Math.max(r, g, b) - Math.min(r, g, b);
        const isLine = lum < 40 && touchesCore(idx);
        const isFringe =
            lum > 145 ||
            (sat < 60 && lum > 95) ||
            (d <= 4 && r > 190 && g > 190 && b > 190);
        if (isFringe && !isLine) {
            out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 0;
        }
    }

    return out;
}

function removePureBlackMatte(data, w, h) {
    const out = Buffer.from(data);
    const visited = new Uint8Array(w * h);
    const queue = [];
    const isPureBlack = (i) => out[i] === 0 && out[i + 1] === 0 && out[i + 2] === 0 && out[i + 3] === 255;

    async function seedFromTrim() {
        const trimmed = await sharp(out, { raw: { width: w, height: h, channels: 4 } })
            .trim()
            .toBuffer({ resolveWithObject: true });
        const x0 = -trimmed.info.trimOffsetLeft;
        const y0 = -trimmed.info.trimOffsetTop;
        const x1 = x0 + trimmed.info.width - 1;
        const y1 = y0 + trimmed.info.height - 1;
        return { x0, y0, x1, y1 };
    }

    return seedFromTrim().then(({ x0, y0, x1, y1 }) => {
        function seed(x, y) {
            if (x < x0 || x > x1 || y < y0 || y > y1) return;
            const idx = y * w + x;
            const i = idx * 4;
            if (visited[idx] || !isPureBlack(i)) return;
            queue.push(idx);
        }

        for (let x = x0; x <= x1; x++) {
            seed(x, y0);
            seed(x, y1);
        }
        for (let y = y0; y <= y1; y++) {
            seed(x0, y);
            seed(x1, y);
        }

        while (queue.length) {
            const idx = queue.pop();
            if (visited[idx]) continue;
            const i = idx * 4;
            if (!isPureBlack(i)) continue;
            visited[idx] = 1;
            out[i + 3] = 0;
            const x = idx % w;
            const y = (idx / w) | 0;
            if (x > 0) queue.push(idx - 1);
            if (x < w - 1) queue.push(idx + 1);
            if (y > 0) queue.push(idx - w);
            if (y < h - 1) queue.push(idx + w);
        }

        return out;
    });
}

function removeDarkBackground(data, w, h, threshold = 32) {
    const out = Buffer.from(data);
    const visited = new Uint8Array(w * h);
    const queue = [];

    function push(x, y) {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const idx = y * w + x;
        if (visited[idx]) return;
        visited[idx] = 1;
        queue.push([x, y]);
    }

    for (let x = 0; x < w; x++) {
        push(x, 0);
        push(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
        push(0, y);
        push(w - 1, y);
    }

    while (queue.length) {
        const [x, y] = queue.pop();
        const i = (y * w + x) * 4;
        const r = out[i];
        const g = out[i + 1];
        const b = out[i + 2];
        const a = out[i + 3];
        if (!isBlackBg(r, g, b, a, threshold)) continue;
        out[i + 3] = 0;
        for (const [nx, ny] of [
            [x + 1, y],
            [x - 1, y],
            [x, y + 1],
            [x, y - 1]
        ]) {
            push(nx, ny);
        }
    }

    return out;
}

function solidifyAlpha(data, w, h, alphaCutoff = 140) {
    const out = Buffer.from(data);
    const isBg = new Uint8Array(w * h);
    const queue = [];

    function pushIfBg(x, y) {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const idx = y * w + x;
        if (isBg[idx]) return;
        if (out[idx * 4 + 3] < alphaCutoff) {
            isBg[idx] = 1;
            queue.push(idx);
        }
    }

    for (let x = 0; x < w; x++) {
        pushIfBg(x, 0);
        pushIfBg(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
        pushIfBg(0, y);
        pushIfBg(w - 1, y);
    }

    while (queue.length) {
        const idx = queue.pop();
        if (isBg[idx]) continue;
        const i = idx * 4;
        if (out[i + 3] >= alphaCutoff) continue;
        isBg[idx] = 1;
        const x = idx % w;
        const y = (idx / w) | 0;
        pushIfBg(x + 1, y);
        pushIfBg(x - 1, y);
        pushIfBg(x, y + 1);
        pushIfBg(x, y - 1);
    }

    for (let idx = 0; idx < w * h; idx++) {
        const i = idx * 4;
        if (isBg[idx]) {
            out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 0;
            continue;
        }
        const a = out[i + 3];
        if (a > 0 && a < 255) {
            out[i] = Math.min(255, (out[i] * 255) / a | 0);
            out[i + 1] = Math.min(255, (out[i + 1] * 255) / a | 0);
            out[i + 2] = Math.min(255, (out[i + 2] * 255) / a | 0);
            out[i + 3] = 255;
        }
    }

    return out;
}

function fitScale(cw, ch) {
    const maxW = CANVAS - MARGIN_SIDE * 2;
    const maxH = CANVAS - MARGIN_TOP - MARGIN_BOTTOM;

    let scale = (CANVAS * TARGET_HEIGHT_RATIO) / ch;
    let sw = Math.max(1, Math.round(cw * scale));
    let sh = Math.max(1, Math.round(ch * scale));

    if (sw > maxW) {
        scale *= maxW / sw;
        sw = Math.max(1, Math.round(cw * scale));
        sh = Math.max(1, Math.round(ch * scale));
    }
    if (sh > maxH) {
        scale *= maxH / sh;
        sw = Math.max(1, Math.round(cw * scale));
        sh = Math.max(1, Math.round(ch * scale));
    }

    return { sw, sh };
}

function clampPlacement(charW, charH, topHint) {
    const top = Math.max(MARGIN_TOP, Math.min(topHint, CANVAS - MARGIN_BOTTOM - charH));
    const left = Math.round((CANVAS - charW) / 2);
    return { left, top };
}

async function prepareSourceBuffer(sourcePath) {
    const { data, info } = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;

    let cleaned = await removePureBlackMatte(data, w, h);
    cleaned = removeDarkBackground(cleaned, w, h);
    cleaned = removeFringe(cleaned, w, h);
    cleaned = solidifyAlpha(cleaned, w, h);

    const { data: trimData, info: trimInfo } = await sharp(cleaned, { raw: { width: w, height: h, channels: 4 } })
        .png()
        .trim()
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    return { data: trimData, width: trimInfo.width, height: trimInfo.height };
}

async function composePortrait(sourcePath) {
    const { data, width: cw, height: ch } = await prepareSourceBuffer(sourcePath);
    const { sw, sh } = fitScale(cw, ch);

    const resized = await sharp(data, { raw: { width: cw, height: ch, channels: 4 } })
        .resize(sw, sh, { fit: "fill", kernel: sharp.kernel.lanczos3 })
        .png()
        .toBuffer();

    const eyeY = Math.round(sh * EYE_LINE_FRAC);
    const { left, top } = clampPlacement(sw, sh, TARGET_EYE_Y - eyeY);

    await sharp({
        create: {
            width: CANVAS,
            height: CANVAS,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
    })
        .composite([{ input: resized, left, top }])
        .png({ compressionLevel: 9 })
        .toFile(OUT);

    return { cw, ch, sw, sh, left, top };
}

async function makeClubPreview() {
    const cell = 240;
    const cols = 4;
    const card = Math.round(cell * 0.82);
    const avatar = await sharp(OUT).resize(card, card, { fit: "inside" }).toBuffer();
    const avMeta = await sharp(avatar).metadata();
    const entries = Object.entries(CLUB_THEMES);
    const rows = Math.ceil(entries.length / cols);
    const composites = [];

    entries.forEach(([name, [primary, secondary]], index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = col * cell;
        const y = row * cell;
        const pad = Math.round((cell - card) / 2);

        composites.push({
            input: Buffer.from(
                `<svg width="${card}" height="${card}" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="g${index}" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="${primary}"/>
                            <stop offset="50%" stop-color="${primary}"/>
                            <stop offset="50%" stop-color="${secondary}"/>
                            <stop offset="100%" stop-color="${secondary}"/>
                        </linearGradient>
                    </defs>
                    <rect width="${card}" height="${card}" rx="16" fill="url(#g${index})"/>
                </svg>`
            ),
            left: x + pad,
            top: y + pad
        });

        composites.push({
            input: avatar,
            left: x + pad + Math.round((card - avMeta.width) / 2),
            top: y + pad + Math.round((card - avMeta.height) / 2)
        });
    });

    await sharp({
        create: {
            width: cols * cell,
            height: rows * cell,
            channels: 4,
            background: { r: 36, g: 38, b: 42, alpha: 255 }
        }
    })
        .composite(composites)
        .png()
        .toFile(PREVIEW);
}

async function verifyOutput() {
    const { data, info } = await sharp(OUT).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let blackRect = 0;
    let totalOpaque = 0;
    for (let i = 0; i < info.width * info.height; i++) {
        const p = i * 4;
        const a = data[p + 3];
        if (a !== 255) continue;
        totalOpaque++;
        if (data[p] === 0 && data[p + 1] === 0 && data[p + 2] === 0) blackRect++;
    }
    const trim = await sharp(OUT).trim().toBuffer({ resolveWithObject: true });
    return {
        blackRect,
        totalOpaque,
        blackPct: totalOpaque ? Math.round((100 * blackRect) / totalOpaque) : 0,
        trimW: trim.info.width,
        trimH: trim.info.height,
        heightRatio: (trim.info.height / CANVAS).toFixed(3)
    };
}

async function main() {
    const sourcePath = pickSource();
    console.log(`source ${sourcePath}`);
    const placement = await composePortrait(sourcePath);
    await makeClubPreview();
    const stats = await verifyOutput();

    console.log(`OK ${OUT}`);
    console.log(
        `trim ${placement.cw}x${placement.ch} -> ${placement.sw}x${placement.sh} at (${placement.left},${placement.top})`
    );
    console.log(
        `content ${stats.trimW}x${stats.trimH}, height ratio ${stats.heightRatio}, black line art ${stats.blackPct}%`
    );
    console.log(`preview ${PREVIEW}`);
}

if (require.main === module) {
    main().catch((err) => {
        console.error(err.message || err);
        process.exit(1);
    });
}

