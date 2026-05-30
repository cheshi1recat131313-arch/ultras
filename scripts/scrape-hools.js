const urls = [
    "https://hools.online/",
    "https://hools.online/game",
    "https://hools.online/game/",
    "https://hools.online/m/",
    "https://hools.online/m/game",
    "https://hools.online/api/",
    "https://hools.online/raidon",
    "https://hools.online/raion",
    "https://hools.online/district",
];

(async () => {
    for (const u of urls) {
        try {
            const r = await fetch(u, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });
            const t = await r.text();
            console.log("\n===", u, r.status, "len", t.length, "final", r.url);
            const scripts = [...t.matchAll(/<script[^>]+src=["']([^"']+)/gi)].map((m) => m[1]);
            const hrefs = [...t.matchAll(/href=["']([^"']+)/gi)].map((m) => m[1]).filter((h) => !h.startsWith("#"));
            console.log("scripts:", scripts);
            console.log("hrefs sample:", [...new Set(hrefs)].slice(0, 30));
            if (t.includes("район") || t.includes("Район")) console.log("HAS raion");
            if (t.includes("тату")) console.log("HAS tattoo");
        } catch (e) {
            console.log(u, "ERR", e.message);
        }
    }
})();
