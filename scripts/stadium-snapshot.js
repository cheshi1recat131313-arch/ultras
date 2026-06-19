/**
 * Снимок stadium_matches (read-only) — для проверки, что рестарт не меняет расписание.
 *
 *   DB_PATH=... node scripts/stadium-snapshot.js
 *   # pm2 restart ...
 *   DB_PATH=... node scripts/stadium-snapshot.js
 *
 * Поля id, status, starts_at, ends_at должны совпадать.
 */
const sqlite3 = require("sqlite3");
const { resolveDbPath } = require("../core/db-path");
const stadiumEngine = require("../stadium-engine");

const dbPath = resolveDbPath();
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

db.all(
    `SELECT id, level, status, starts_at, ends_at, score_home, score_away, created_at
     FROM stadium_matches
     WHERE status IN ('scheduled', 'live')
     ORDER BY starts_at ASC`,
    [],
    (err, rows) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }
        console.log("DB:", dbPath);
        console.log("STADIUM_TEST_MODE:", stadiumEngine.STADIUM_TEST_MODE ? "1 (dev)" : "off (production)");
        console.log("Now:", new Date().toISOString());
        if (!rows.length) {
            console.log("No scheduled/live matches.");
            db.close();
            return;
        }
        for (const r of rows) {
            const h = ((r.starts_at - Date.now()) / (60 * 60 * 1000)).toFixed(2);
            console.log(
                `${r.id} L${r.level} ${r.status} starts=${r.starts_at} (~${h}h) score=${r.score_home}:${r.score_away}`
            );
        }
        db.close();
    }
);
