#!/usr/bin/env node
/**
 * HD-версия «Футболки с радугой» для ULTRAS.
 * Основа — оригинальная иконка Hools (фон и композиция без изменений).
 * Улучшаются только пиксели футболки/радуги: ткань, складки, чёткость.
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const OUT_PNG = path.join(ROOT, "public/static/gear/rainbow-shirt.png");
const OUT_REF = path.join(ROOT, "public/static/gear/rainbow-shirt-hools-original.png");
const OUT_SIZE = 128;

const SOURCE_CANDIDATES = [
    path.join(ROOT, "public/static/gear/rainbow-shirt-hools-original.png"),
    path.join(
        ROOT,
        ".cursor/projects/root/assets/c__Users_vadim_AppData_Roaming_Cursor_User_workspaceStorage_89fdb4b94e95cfed6dcfe708483646fa_images_2_lvl_0_star-df763731-4ec4-440c-8775-3107b64f7432.png"
    ),
    "/root/.cursor/projects/root/assets/c__Users_vadim_AppData_Roaming_Cursor_User_workspaceStorage_89fdb4b94e95cfed6dcfe708483646fa_images_2_lvl_0_star-df763731-4ec4-440c-8775-3107b64f7432.png"
];

function pickSource() {
    if (process.argv[2]) {
        const custom = path.resolve(process.argv[2]);
        if (!fs.existsSync(custom)) throw new Error(`Source not found: ${custom}`);
        return custom;
    }
    for (const candidate of SOURCE_CANDIDATES) {
        if (fs.existsSync(candidate)) return candidate;
    }
    throw new Error("Hools rainbow shirt source not found.");
}

function clamp(v, min = 0, max = 255) {
    return Math.max(min, Math.min(max, Math.round(v)));
}

/** Лучи Hools: #00FFFF и #008080 (+ антиалиас). Фон не трогаем. */
function isBackground(r, g, b) {
    if (g > 210 && b > 210 && r < 120) return true;
    if (r < 50 && g > 90 && g < 175 && b > 90 && b < 175 && Math.abs(g - b) < 35) return true;
    return false;
}

function enhancePixel(r, g, b, x, y, w, h) {
    if (isBackground(r, g, b)) return [r, g, b];

    // Лавандовая ткань + тени Hools
    const isFabric = r > 70 && b > 120 && g > 55 && g < 215 && !(r > 220 && g > 200);
    if (isFabric) {
        let nr = r;
        let ng = g;
        let nb = b;
        const leftFold = Math.max(0, 1 - x / (w * 0.28));
        nr -= leftFold * 16;
        ng -= leftFold * 10;
        nb -= leftFold * 8;
        const rightLight = Math.max(0, (x - w * 0.62) / (w * 0.3));
        nr += rightLight * 7;
        ng += rightLight * 5;
        nb += rightLight * 4;
        const hem = Math.max(0, (y - h * 0.7) / (h * 0.26));
        nr -= hem * 12;
        ng -= hem * 9;
        nb -= hem * 7;
        const armpitL = Math.max(0, 1 - Math.abs(x - w * 0.22) / (w * 0.08)) * Math.max(0, 1 - Math.abs(y - h * 0.38) / (h * 0.1));
        const armpitR = Math.max(0, 1 - Math.abs(x - w * 0.78) / (w * 0.08)) * Math.max(0, 1 - Math.abs(y - h * 0.38) / (h * 0.1));
        const armpit = Math.max(armpitL, armpitR);
        nr -= armpit * 10;
        ng -= armpit * 7;
        nb -= armpit * 6;
        return [clamp(nr), clamp(ng), clamp(nb)];
    }

    // Радуга — чуть насыщеннее и контрастнее
    if (r > 190 && g < 130 && b < 150) return [clamp(r + 6), clamp(g - 4), clamp(b - 4)];
    if (r > 210 && g > 170 && g < 245 && b < 80) return [clamp(r + 4), clamp(g + 10), clamp(b - 6)];
    if (r < 110 && g > 170 && b > 190) return [clamp(r - 4), clamp(g + 6), clamp(b + 10)];

    // Горловина
    if (r < 130 && g < 100 && b < 130) {
        return [clamp(r - 4), clamp(g - 3), clamp(b - 3)];
    }

    return [r, g, b];
}

async function buildFromSource(srcPath) {
    fs.mkdirSync(path.dirname(OUT_PNG), { recursive: true });
    if (path.resolve(srcPath) !== path.resolve(OUT_REF)) {
        fs.copyFileSync(srcPath, OUT_REF);
    }

    const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const out = Buffer.from(data);
    const w = info.width;
    const h = info.height;

    for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
            const i = (y * w + x) * 4;
            const [nr, ng, nb] = enhancePixel(data[i], data[i + 1], data[i + 2], x, y, w, h);
            out[i] = nr;
            out[i + 1] = ng;
            out[i + 2] = nb;
        }
    }

    await sharp(out, { raw: { width: w, height: h, channels: 4 } })
        .sharpen({ sigma: 0.6, m1: 0.7, m2: 0.4 })
        .resize(OUT_SIZE, OUT_SIZE, { kernel: sharp.kernel.lanczos3 })
        .png({ compressionLevel: 9, palette: false })
        .toFile(OUT_PNG);

    console.log(`OK ${OUT_PNG} (${OUT_SIZE}x${OUT_SIZE}) <- ${srcPath}`);
}

if (require.main === module) {
    buildFromSource(pickSource()).catch((err) => {
        console.error(err.message || err);
        process.exit(1);
    });
}

module.exports = { buildFromSource, pickSource };
