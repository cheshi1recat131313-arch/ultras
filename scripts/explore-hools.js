/**
 * One-off: login to hools.online and dump page structure (no credentials in file).
 * Usage: H_EMAIL=... H_PASS=... node scripts/explore-hools.js [path]
 * Example: node scripts/explore-hools.js /game
 */
const https = require("https");
const qs = require("querystring");
const fs = require("fs");
const path = require("path");

const HOST = "hools.online";

function request(method, urlPath, cookieHdr, body) {
    return new Promise((resolve, reject) => {
        const opts = {
            hostname: HOST,
            port: 443,
            method,
            path: urlPath,
            rejectUnauthorized: false,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120",
                Host: HOST
            }
        };
        if (cookieHdr) opts.headers.Cookie = cookieHdr;
        if (body) {
            opts.headers["Content-Type"] = "application/x-www-form-urlencoded";
            opts.headers["Content-Length"] = Buffer.byteLength(body);
        }
        const req = https.request(opts, (res) => {
            let data = "";
            res.on("data", (c) => {
                data += c;
            });
            res.on("end", () => {
                resolve({ status: res.statusCode, headers: res.headers, body: data });
            });
        });
        req.on("error", reject);
        if (body) req.write(body);
        req.end();
    });
}

function mergeCookie(oldHdr, setCookie) {
    const jar = new Map();
    if (oldHdr) {
        for (const part of oldHdr.split(";").map((s) => s.trim()).filter(Boolean)) {
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

function followGet(startPath, cookie) {
    return new Promise(async (resolve) => {
        let path = startPath;
        let c = cookie;
        for (let i = 0; i < 12; i += 1) {
            if (!path.startsWith("/")) path = `/${path}`;
            const r = await request("GET", path, c, null);
            c = mergeCookie(c, r.headers["set-cookie"]);
            if (r.status >= 300 && r.status < 400 && r.headers.location) {
                let loc = r.headers.location;
                if (loc.startsWith("http")) loc = new URL(loc).pathname + new URL(loc).search;
                path = loc;
                continue;
            }
            resolve({ cookie: c, status: r.status, path, body: r.body });
            return;
        }
        resolve({ cookie: c, status: 0, path: startPath, body: "" });
    });
}

function extractHrefs(html) {
    const re = /href="([^"]+)"/g;
    const out = [];
    let m;
    while ((m = re.exec(html)) !== null) {
        const h = m[1];
        if (h.startsWith("/") && !h.startsWith("//")) out.push(h);
    }
    return [...new Set(out)].sort();
}

async function login(email, password) {
    let cookie = "";
    let r = await request("GET", "/login?next=%2Fgame", cookie, null);
    cookie = mergeCookie(cookie, r.headers["set-cookie"]);
    const post = qs.stringify({ email, password });
    r = await request("POST", "/login?next=%2Fgame", cookie, post);
    cookie = mergeCookie(cookie, r.headers["set-cookie"]);
    if (r.status !== 302 || !r.headers.location) {
        throw new Error(`Login failed status=${r.status} body=${r.body.slice(0, 200)}`);
    }
    let loc = r.headers.location;
    if (loc.startsWith("http")) loc = new URL(loc).pathname + new URL(loc).search;
    const after = await followGet(loc, cookie);
    return { cookie: after.cookie, body: after.body, path: after.path };
}

async function main() {
    const email = process.env.H_EMAIL;
    const password = process.env.H_PASS;
    if (!email || !password) {
        console.error("Set H_EMAIL and H_PASS env vars");
        process.exit(1);
    }

    const targetArg = process.argv[2];
    const { cookie, body: loginBody, path: loginPath } = await login(email, password);
    console.log("After login path:", loginPath, "body len:", loginBody.length);

    const target =
        targetArg || (loginPath && loginPath !== "/game" ? loginPath.split("?")[0] : "/game");
    const final = await followGet(target.startsWith("/") ? target : `/${target}`, cookie);

    const outDir = path.join(__dirname, "hools-dump");
    fs.mkdirSync(outDir, { recursive: true });
    const safe = final.path.replace(/[/?&=]/g, "_") || "root";
    const file = path.join(outDir, `${safe}.html`);
    fs.writeFileSync(file, final.body, "utf8");
    console.log("Wrote", file);
    console.log("Hrefs:", extractHrefs(final.body).join("\n"));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
