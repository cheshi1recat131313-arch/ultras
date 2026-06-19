const sqlite3 = require("sqlite3");
const { resolveDbPath } = require("../core/db-path");

const dbPath = resolveDbPath();
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
}

function fmtTs(ms) {
    const n = Number(ms);
    if (!n) return "(нет)";
    return new Date(n).toISOString().replace("T", " ").slice(0, 19);
}

(async () => {
    console.log("=== DB audit ===");
    console.log("Path:", dbPath);
    console.log("DB_PATH env:", process.env.DB_PATH || "(not set)");
    console.log("NOTE: this is NOT production unless DB_PATH points to prod copy\n");

    const total = (await all("SELECT COUNT(*) AS c FROM users"))[0].c;
    const withNick = (
        await all(
            "SELECT COUNT(*) AS c FROM users WHERE name IS NOT NULL AND TRIM(name) != ''"
        )
    )[0].c;
    console.log(`Total users: ${total}, with nick: ${withNick}\n`);

    const dupGroups = await all(`
        SELECT LOWER(TRIM(name)) AS nick, COUNT(*) AS cnt
        FROM users
        WHERE name IS NOT NULL AND TRIM(name) != ''
        GROUP BY LOWER(TRIM(name))
        HAVING cnt > 1
        ORDER BY cnt DESC, nick ASC
    `);

    console.log(`=== Duplicate nicks: ${dupGroups.length} group(s) ===\n`);

    for (const g of dupGroups) {
        console.log(`--- nick="${g.nick}" count=${g.cnt} ---`);
        const rows = await all(
            `SELECT id, email, recovery_email, name, level, club, registered_at, last_active_at
             FROM users
             WHERE LOWER(TRIM(name)) = ?
             ORDER BY id ASC`,
            [g.nick]
        );
        for (const r of rows) {
            console.log(
                [
                    `  id=${r.id}`,
                    `email=${r.email}`,
                    `recovery=${r.recovery_email || ""}`,
                    `name=${JSON.stringify(r.name)}`,
                    `level=${r.level ?? 1}`,
                    `club=${r.club || "(null)"}`,
                    `registered=${fmtTs(r.registered_at)}`,
                    `active=${fmtTs(r.last_active_at)}`
                ].join(" | ")
            );
        }
        console.log("");
    }

    const noName = await all(`
        SELECT id, email, recovery_email, name, character, club, level, registered_at, last_active_at
        FROM users
        WHERE name IS NULL OR TRIM(name) = ''
        ORDER BY id ASC
    `);

    console.log(`=== Accounts without nick: ${noName.length} ===\n`);
    for (const r of noName) {
        console.log(
            [
                `id=${r.id}`,
                `email=${r.email}`,
                `recovery=${r.recovery_email || ""}`,
                `name=${JSON.stringify(r.name)}`,
                `character=${r.character || "(null)"}`,
                `club=${r.club || "(null)"}`,
                `level=${r.level ?? 1}`,
                `registered=${fmtTs(r.registered_at)}`,
                `active=${fmtTs(r.last_active_at)}`
            ].join(" | ")
        );
    }

    db.close();
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
