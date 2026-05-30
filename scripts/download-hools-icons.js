const https = require("https");
const fs = require("fs");
const path = require("path");

const FILES = [
    "/static/location/index/brass.png",
    "/static/location/index/center.png",
    "/static/location/index/promzona.png",
    "/static/location/index/stadium.png",
    "/static/location/index/firms-fight.png",
    "/static/location/index/pub.png",
    "/static/location/index/target.svg",
    "/static/location/index/favorite.png",
    "/static/location/index/trophy.svg",
    "/static/location/index/pers.png",
    "/static/location/index/mail.png",
    "/static/location/index/firms.png",
    "/static/location/index/pub2.png",
    "/static/location/index/work.png",
    "/static/location/index/mushrooms.png",
    "/static/assets/img/mushroom.svg",
    "/static/fight/muscle.png",
    "/static/fight/abs.png",
    "/static/fight/running.png",
    "/static/fight/brain.png",
    "/static/personage/x_ac291681.jpg",
    "/static/personage/x_3c69aea4.jpg",
    "/static/personage/x_b7c1209c.jpg",
    "/static/personage/x_20f9ea90.jpg",
    "/static/personage/x_34042d44.jpg",
    "/static/personage/x_8d41c12d.jpg",
    "/static/personage/x_d87b8a96.jpg"
];

function get(urlPath) {
    return new Promise((resolve, reject) => {
        https
            .get(
                {
                    hostname: "hools.online",
                    path: urlPath,
                    rejectUnauthorized: false,
                    headers: { "User-Agent": "Mozilla/5.0" }
                },
                (res) => {
                    const chunks = [];
                    res.on("data", (c) => chunks.push(c));
                    res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
                }
            )
            .on("error", reject);
    });
}

async function main() {
    const outDir = path.join(__dirname, "../public/static/location/index");
    fs.mkdirSync(outDir, { recursive: true });
    fs.mkdirSync(path.join(__dirname, "../public/static/assets/img"), { recursive: true });

    for (const urlPath of FILES) {
        const r = await get(urlPath);
        if (r.status !== 200 || r.body.length < 50) {
            console.log("FAIL", urlPath, r.status);
            continue;
        }
        const rel = urlPath.replace(/^\/static\//, "");
        const dest = path.join(__dirname, "../public/static", rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, r.body);
        console.log("OK", urlPath, r.body.length);
    }
}

main().catch(console.error);
