const https = require("https");
const fs = require("fs");
const path = require("path");
const qs = require("querystring");

function request(method, urlPath, cookie, body) {
    return new Promise((resolve, reject) => {
        const opts = {
            hostname: "hools.online",
            path: urlPath,
            method,
            rejectUnauthorized: false,
            headers: { "User-Agent": "Mozilla/5.0", Host: "hools.online" }
        };
        if (cookie) opts.headers.Cookie = cookie;
        if (body) {
            opts.headers["Content-Type"] = "application/x-www-form-urlencoded";
            opts.headers["Content-Length"] = Buffer.byteLength(body);
        }
        const req = https.request(opts, (res) => {
            let data = "";
            res.on("data", (c) => (data += c));
            res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
        });
        req.on("error", reject);
        if (body) req.write(body);
        req.end();
    });
}

function mergeCookie(old, setCookie) {
    const jar = new Map();
    if (old) {
        for (const part of old.split(";").map((s) => s.trim()).filter(Boolean)) {
            const i = part.indexOf("=");
            if (i > 0) jar.set(part.slice(0, i), part.slice(i + 1));
        }
    }
    const arr = setCookie ? (Array.isArray(setCookie) ? setCookie : [setCookie]) : [];
    for (const line of arr) {
        const part = line.split(";")[0].trim();
        const i = part.indexOf("=");
        if (i > 0) jar.set(part.slice(0, i), part.slice(i + 1));
    }
    return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function main() {
    const email = process.env.H_EMAIL;
    const password = process.env.H_PASS;
    if (!email || !password) {
        console.log("Set H_EMAIL H_PASS to dump /home");
        return;
    }
    let cookie = "";
    let r = await request("GET", "/login?next=%2Fhome", cookie, null);
    cookie = mergeCookie(cookie, r.headers["set-cookie"]);
    r = await request("POST", "/login?next=%2Fhome", cookie, qs.stringify({ email, password }));
    cookie = mergeCookie(cookie, r.headers["set-cookie"]);
    if (r.status === 302 && r.headers.location) {
        let loc = r.headers.location;
        if (loc.startsWith("http")) loc = new URL(loc).pathname;
        r = await request("GET", loc, cookie, null);
        cookie = mergeCookie(cookie, r.headers["set-cookie"]);
    }
    r = await request("GET", "/home", cookie, null);
    const out = path.join(__dirname, "hools-dump/_home.html");
    fs.writeFileSync(out, r.body);
    console.log("saved", out, r.body.length);
    const imgs = [...r.body.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
    console.log(imgs.filter((u) => u.includes("static")).join("\n"));
}

main().catch(console.error);
