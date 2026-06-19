/**

 * Подключить / отключить тёмную тему ULTRAS на страницах с hools.css.

 * Стадион и паб остаются в классическом зелёном стиле (ultras-theme-green).

 *

 *   node scripts/wire-ultras-dark-theme.js

 *   node scripts/wire-ultras-dark-theme.js --remove

 */



const fs = require("fs");

const path = require("path");



const publicDir = path.join(__dirname, "../public");

const remove = process.argv.includes("--remove");

const THEME_LINK = '    <link rel="stylesheet" href="css/ultras-dark-theme.css">';

const THEME_CLASS = "ultras-dark";

const GREEN_CLASS = "ultras-theme-green";

const OLD_LINK = '    <link rel="stylesheet" href="css/game-dark-test.css">';

const OLD_COMMENT = /\s*<!-- ТЕСТ тёмной темы.*?-->\s*/g;



/** Классическая зелёная зона — не тёмнить контент */

/** Магазины — светлый стиль ларька, не тёмная тема */
const SHOP_LIGHT_PAGES = new Set([
    "larek.html",
    "mag.html",
    "mag-talismans.html",
    "market-clothes.html",
    "market-weapons.html",
    "market-packages.html"
]);

const GREEN_ZONE_PAGES = new Set([

    "pub.html",

    "pub-battle.html",

    "stadium.html",

    "stadium-best.html",

    "stadium-bets.html",

    "stadium-bookmaker.html",

    "stadium-kassa.html",

    "stadium-perekup.html",

    "stadium-schedule.html",

    "stadium-stats.html",

    "stadium-tribunes.html"

]);



function ensureBodyClass(html, className) {

    if (new RegExp(`\\b${className}\\b`).test(html)) return html;



    if (/<body[^>]*class="/.test(html)) {

        return html.replace(/<body([^>]*)class="([^"]*)"/, (m, attrs, cls) => {

            const next = cls.trim() ? `${cls.trim()} ${className}` : className;

            return `<body${attrs}class="${next}"`;

        });

    }

    return html.replace(/<body([^>]*)>/, `<body$1 class="${className}">`);

}



function removeBodyClass(html, className) {

    return html

        .replace(new RegExp(`\\s*${className}\\s*`, "g"), " ")

        .replace(/\s{2,}/g, " ")

        .replace(/class="\s+/g, 'class="')

        .replace(/\s+"/g, '"');

}



let changed = 0;



for (const name of fs.readdirSync(publicDir)) {

    if (!name.endsWith(".html")) continue;

    const fp = path.join(publicDir, name);

    let t = fs.readFileSync(fp, "utf8");

    if (!t.includes("hools.css") && !t.includes("game-shell.css")) continue;



    const before = t;

    const isGreenZone = GREEN_ZONE_PAGES.has(name);
    const isShopLight = SHOP_LIGHT_PAGES.has(name);



    if (remove) {

        t = t.replace(OLD_COMMENT, "\n");

        t = t.replace(/\s*<link rel="stylesheet" href="css\/game-dark-test\.css">\s*/g, "\n");

        t = t.replace(/\s*<link rel="stylesheet" href="css\/ultras-dark-theme\.css">\s*/g, "\n");

        t = removeBodyClass(t, THEME_CLASS);

        t = removeBodyClass(t, GREEN_CLASS);

    } else if (isShopLight) {

        t = t.replace(/\s*<link rel="stylesheet" href="css\/ultras-dark-theme\.css">\s*/g, "\n");
        t = removeBodyClass(t, THEME_CLASS);
        t = removeBodyClass(t, GREEN_CLASS);
        t = ensureBodyClass(t, "shop-light");

    } else {

        t = t.replace(OLD_COMMENT, "\n");

        t = t.replace(/\s*<link rel="stylesheet" href="css\/game-dark-test\.css">\s*/g, "\n");

        t = t.replace(/\bgame-dark-test\b/g, "");



        if (!t.includes("ultras-dark-theme.css")) {

            t = t.replace("</head>", `${THEME_LINK}\n</head>`);

        }



        t = ensureBodyClass(t, THEME_CLASS);

        if (isGreenZone) {

            t = ensureBodyClass(t, GREEN_CLASS);

        } else {

            t = removeBodyClass(t, GREEN_CLASS);

        }

    }



    if (t !== before) {

        fs.writeFileSync(fp, t);

        changed += 1;

        console.log(remove ? "reverted:" : "wired:", name, isShopLight ? "(shop-light)" : isGreenZone ? "(green)" : "");

    }

}



console.log(remove ? `Removed theme from ${changed} files.` : `Wired theme to ${changed} files.`);


