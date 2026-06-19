#!/usr/bin/env node
/**
 * Бой-баба — смещение портрета вниз внутри квадрата 1024×1024.
 * Масштаб не меняется, только вертикальная позиция на прозрачном холсте.
 *
 * Запуск: node scripts/reframe-fighter-portrait.js
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const INPUT = path.join(ROOT, "public/static/personage/fighter.png");
const BACKUP = path.join(ROOT, "public/static/personage/fighter.png.bak");
const CANVAS = 1024;
/** Смещение вниз относительно высоты холста (~12%, диапазон 10–15%). */
const SHIFT_DOWN_RATIO = 0.12;

async function alphaBBox(filePath) {
    const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let x0 = info.width;
    let y0 = info.height;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < info.height; y += 1) {
        for (let x = 0; x < info.width; x += 1) {
            const a = data[(y * info.width + x) * 4 + 3];
            if (a <= 12) continue;
            if (x < x0) x0 = x;
            if (y < y0) y0 = y;
            if (x > x1) x1 = x;
            if (y > y1) y1 = y;
        }
    }
    if (x1 < x0) return null;
    return { x0, y0, x1, y1, w: info.width, h: info.height };
}

async function reframe() {
    if (!fs.existsSync(INPUT)) {
        throw new Error(`Portrait not found: ${INPUT}`);
    }
    if (!fs.existsSync(BACKUP)) {
        fs.copyFileSync(INPUT, BACKUP);
    }

    const meta = await sharp(INPUT).metadata();
    const shiftDown = Math.round(CANVAS * SHIFT_DOWN_RATIO);
    const width = meta.width || CANVAS;
    const height = meta.height || CANVAS;

    await sharp({
        create: {
            width,
            height,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
    })
        .composite([{ input: INPUT, top: shiftDown, left: 0 }])
        .png({ compressionLevel: 9 })
        .toFile(INPUT + ".tmp");

    fs.renameSync(INPUT + ".tmp", INPUT);

    const before = await alphaBBox(BACKUP);
    const after = await alphaBBox(INPUT);
    console.log(`OK ${INPUT}`);
    console.log(`shift down ${shiftDown}px (${Math.round(SHIFT_DOWN_RATIO * 100)}% of canvas)`);
    if (before && after) {
        console.log(
            `bbox top ${before.y0}→${after.y0}, bottom ${before.y1}→${after.y1}, ` +
                `margins top ${before.y0}/${after.y0}, bottom ${before.h - 1 - before.y1}/${after.h - 1 - after.y1}`
        );
    }
}

if (require.main === module) {
    reframe().catch((err) => {
        console.error(err.message || err);
        process.exit(1);
    });
}
