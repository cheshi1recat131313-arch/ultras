const path = require("path");
const sqlite3 = require("sqlite3");
const config = require("../pub-battle/config");
const { computeNextScheduledStart, computeRegistrationOpens } = require("../pub-battle/schedule");
const { roomClubIds, newBattleId } = require("../pub-battle/utils");

const db = new sqlite3.Database(path.join(__dirname, "../users.db"));
const now = Date.now();

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });
}

(async () => {
    await run(
        "UPDATE pub_battles SET status = 'ended', ended_at = ? WHERE status IN ('live', 'registration')",
        [now]
    );

    const scheduledStartsAt = computeNextScheduledStart(now);
    const registrationOpensAt = computeRegistrationOpens(scheduledStartsAt);
    const id = newBattleId();
    const roomClubs = roomClubIds();

    const rooms = {};
    roomClubs.forEach((clubId, index) => {
        rooms[String(index)] = {
            roomIndex: index,
            clubId,
            clubName: clubId,
            status: "waiting",
            feed: [],
            fighters: [],
            meta: { lastTickAt: 0, lastBotAt: 0, matchStats: {}, opponentSlots: {} }
        };
    });

    await run(
        `INSERT INTO pub_battles
         (id, status, room_clubs_json, registrations_json, players_json, rooms_json,
          coord_chat_json, meta_json, winner_club, registration_opens_at, scheduled_starts_at,
          created_at, started_at, ended_at)
         VALUES (?, 'registration', ?, '[]', '{}', ?, '[]', '{}', NULL, ?, ?, ?, 0, 0)`,
        [
            id,
            JSON.stringify(roomClubs),
            JSON.stringify(rooms),
            registrationOpensAt,
            scheduledStartsAt,
            now
        ]
    );

    const row = await get(
        "SELECT id, status, registration_opens_at, scheduled_starts_at FROM pub_battles WHERE id = ?",
        [id]
    );
    console.log("Created fresh pub battle:", row);
    console.log("Start at:", new Date(scheduledStartsAt).toLocaleString());
    console.log("Registration opens:", new Date(registrationOpensAt).toLocaleString());
    db.close();
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
