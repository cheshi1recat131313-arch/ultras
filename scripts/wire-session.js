const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname, "../public");
const sessionPath = path.join(publicDir, "js/session.js");
const apiPath = path.join(publicDir, "js/api.js");

const session = fs.readFileSync(sessionPath, "utf8");
const api = fs.readFileSync(apiPath, "utf8");
if (!api.startsWith("/** Сессия")) {
    fs.writeFileSync(apiPath, `${session}\n${api}`);
}

const files = [
    "district.html",
    "market-weapons.html",
    "garderob.html",
    "pers.html",
    "dossier.html",
    "market.html",
    "tattoo.html",
    "mag.html",
    "industrial.html",
    "center-tattoo.html",
    "market-clothes.html",
    "center.html",
    "gym.html",
    "game.html",
    "kicker.html",
    "lottery.html",
    "shmot.html"
];

for (const f of files) {
    const fp = path.join(publicDir, f);
    let t = fs.readFileSync(fp, "utf8");
    if (!t.includes("js/api.js") || t.includes("js/session.js")) continue;
    t = t.replace('<script src="js/api.js">', '<script src="js/session.js"></script>\n<script src="js/api.js">');
    t = t.replace('<script src="/js/api.js">', '<script src="/js/session.js"></script>\n<script src="/js/api.js">');
    fs.writeFileSync(fp, t);
}

console.log("wired");
