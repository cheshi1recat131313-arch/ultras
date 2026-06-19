/**
 * Скриншоты проверки мобильной ширины (тот же CSS, что game.html).
 * Запуск: node scripts/screenshot-mobile-layout.mjs
 */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../screenshots/mobile-layout");
const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3000";
const pageUrl = `${baseUrl}/dev-layout-check.html`;

const viewports = [
    { name: "motorola-g72", width: 412, height: 915, label: "Motorola G72 (412px)" },
    { name: "android-390", width: 390, height: 844, label: "Android 390px" },
    { name: "pc-1280", width: 1280, height: 800, label: "ПК 1280px" }
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(pageUrl, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const file = path.join(outDir, `${vp.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    const innerWidth = await page.evaluate(() => window.innerWidth);
    const appWidth = await page.evaluate(() => {
        const el = document.querySelector(".app");
        return el ? Math.round(el.getBoundingClientRect().width) : 0;
    });
    console.log(`${vp.label}: innerWidth=${innerWidth}, .app width=${appWidth}px → ${file}`);
}

await browser.close();
