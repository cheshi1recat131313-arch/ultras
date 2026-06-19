#!/usr/bin/env node
/**
 * Посев чемпионата стадиона (28 матчей) в SQLite.
 * Запуск: node scripts/seed-stadium-championship.js
 */
const path = require("path");
const sqlite3 = require("sqlite3");

const ROOT = path.resolve(__dirname, "..");
const DB_PATH = process.env.DB_PATH || path.join(ROOT, "users.db");

function openDb() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) reject(err);
            else resolve(db);
        });
    });
}

function runQuery(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes, lastID: this.lastID });
        });
    });
}

function getQuery(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

async function main() {
    const stadiumEngine = require(path.join(ROOT, "stadium-engine"));
    const stadiumChampionship = require(path.join(ROOT, "stadium-championship"));

    const db = await openDb();
    try {
        const marker = await getQuery(
            db,
            `SELECT id FROM stadium_matches
             WHERE meta_json LIKE ?
             LIMIT 1`,
            [`%"championshipSeason":"${stadiumChampionship.CHAMPIONSHIP_SEASON_ID}"%`]
        );
        if (marker) {
            console.log("Чемпионат уже посеян:", marker.id);
            return;
        }

        await runQuery(
            db,
            `DELETE FROM stadium_matches
             WHERE status IN ('scheduled', 'live')
               AND (meta_json IS NULL OR meta_json NOT LIKE ?)`,
            [`%"championshipSeason":"${stadiumChampionship.CHAMPIONSHIP_SEASON_ID}"%`]
        );

        const schedule = stadiumChampionship.buildChampionshipSchedule();
        const now = Date.now();
        for (const item of schedule) {
            const match = stadiumEngine.createMatch(1, item.homeClub, item.awayClub, item.startsAt);
            match.id = item.id;
            match.createdAt = now;
            match.meta = match.meta || {};
            match.meta.championshipSeason = stadiumChampionship.CHAMPIONSHIP_SEASON_ID;
            match.meta.round = item.round;
            const r = stadiumEngine.rowFromMatch(match);
            await runQuery(
                db,
                `INSERT OR REPLACE INTO stadium_matches
                 (id, level, home_club, away_club, status, starts_at, ends_at, score_home, score_away, fighters_json, feed_json, meta_json, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    r.id,
                    r.level,
                    r.home_club,
                    r.away_club,
                    r.status,
                    r.starts_at,
                    r.ends_at,
                    r.score_home,
                    r.score_away,
                    r.fighters_json,
                    r.feed_json,
                    r.meta_json,
                    match.createdAt
                ]
            );
        }

        console.log(`Посеяно ${schedule.length} матчей чемпионата (${stadiumChampionship.CHAMPIONSHIP_SEASON_ID}).`);
        console.log("Первый:", schedule[0].id, new Date(schedule[0].startsAt).toISOString());
        console.log("Последний:", schedule[27].id, new Date(schedule[27].startsAt).toISOString());
    } finally {
        db.close();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
