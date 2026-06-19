#!/usr/bin/env node
/**
 * Копирует актуальные портреты (как на экране выбора персонажа) в public/static/personage/current/.
 * Запуск: node scripts/sync-personage-current.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public/static/personage/current");

/** Источники — те же файлы, что на character.html до миграции путей. */
const SOURCES = {
    tank: "public/images/tank-dossier.png",
    fast: "public/images/fast-dossier.png",
    balanced: "public/static/personage/balanced.png",
    tough: "public/images/tough-dossier.png",
    redhead: "public/static/personage/redhead.png",
    fighter: "public/static/personage/fighter.png",
    chick: "public/static/personage/chick.png",
    valk: "public/static/personage/valk.png",
    shadow: "public/static/personage/shadow.png",
    spark: "public/static/personage/spark.png"
};

function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    for (const [id, rel] of Object.entries(SOURCES)) {
        const src = path.join(ROOT, rel);
        const dest = path.join(OUT_DIR, `${id}.png`);
        if (!fs.existsSync(src)) {
            throw new Error(`Missing source for ${id}: ${src}`);
        }
        fs.copyFileSync(src, dest);
        console.log(`${id}.png <- ${rel}`);
    }
    console.log(`OK ${OUT_DIR}`);
}

if (require.main === module) {
    main();
}

module.exports = { SOURCES, OUT_DIR };
