const https = require("https");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "../public/static/hools-original");

const CANDIDATES = [
    "/static/location/district.png",
    "/static/location/center.png",
    "/static/location/factory.png",
    "/static/location/industrial.png",
    "/static/location/stadium.png",
    "/static/location/wasteland.png",
    "/static/location/pub.png",
    "/static/location/pab.png",
    "/static/location/base/district.png",
    "/static/location/base/center.png",
    "/static/location/base/factory.png",
    "/static/location/base/stadium.png",
    "/static/location/base/wasteland.png",
    "/static/location/base/pub.png",
    "/static/location/base/pab.png",
    "/static/location/base/mushrooms.png",
    "/static/location/base/mushroom.png",
    "/static/img/district.png",
    "/static/img/center.png",
    "/static/img/factory.png",
    "/static/img/stadium.png",
    "/static/img/wasteland.png",
    "/static/img/pub.png",
    "/static/menu/district.png",
    "/static/menu/center.png",
    "/static/menu/factory.png",
    "/static/menu/stadium.png",
    "/static/menu/wasteland.png",
    "/static/menu/pub.png",
    "/static/menu/pers.png",
    "/static/menu/pab.png",
    "/static/menu/mail.png",
    "/static/menu/work.png",
    "/static/menu/firm.png",
    "/static/menu/mushrooms.png",
    "/static/menu/tasks.png",
    "/static/menu/events.png",
    "/static/menu/rating.png",
    "/static/icons/district.png",
    "/static/icons/center.png",
    "/static/icons/factory.png",
    "/static/icons/stadium.png",
    "/static/icons/wasteland.png",
    "/static/icons/pub.png",
    "/static/icons/mushroom.png",
    "/static/location/district.gif",
    "/static/location/center.gif",
    "/static/location/factory.gif",
    "/static/location/stadium.gif",
    "/static/location/wasteland.gif",
    "/static/location/pub.gif",
    "/static/location/pab.gif",
    "/static/location/base/district.gif",
    "/static/location/base/center.gif",
    "/static/location/base/factory.gif",
    "/static/location/base/stadium.gif",
    "/static/location/base/wasteland.gif",
    "/static/location/base/pub.gif",
    "/static/location/base/pab.gif",
    "/static/location/base/work.gif",
    "/static/location/base/mail.gif",
    "/static/location/base/firm.gif",
    "/static/location/base/pers.gif",
    "/static/location/base/tasks.gif",
    "/static/location/base/events.gif",
    "/static/location/base/rating.gif"
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
    fs.mkdirSync(OUT, { recursive: true });
    for (const p of CANDIDATES) {
        const r = await get(p);
        if (r.status === 200 && r.body.length > 80) {
            const name = p.replace(/\//g, "_").replace(/^_/, "");
            fs.writeFileSync(path.join(OUT, name), r.body);
            console.log("OK", p, r.body.length);
        }
    }
}

main().catch(console.error);
