/**
 * «Битва за Паб» — схема SQLite.
 */

async function ensurePubBattleSchema(runQuery, allQuery) {
    await runQuery(`
        CREATE TABLE IF NOT EXISTS pub_battles (
            id TEXT PRIMARY KEY,
            status TEXT NOT NULL DEFAULT 'registration',
            room_clubs_json TEXT NOT NULL DEFAULT '[]',
            registrations_json TEXT NOT NULL DEFAULT '[]',
            players_json TEXT NOT NULL DEFAULT '{}',
            rooms_json TEXT NOT NULL DEFAULT '{}',
            coord_chat_json TEXT NOT NULL DEFAULT '[]',
            meta_json TEXT NOT NULL DEFAULT '{}',
            winner_club TEXT,
            registration_opens_at INTEGER DEFAULT 0,
            scheduled_starts_at INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            started_at INTEGER DEFAULT 0,
            ended_at INTEGER DEFAULT 0
        )
    `);
    await runQuery(
        `CREATE INDEX IF NOT EXISTS idx_pub_battles_status ON pub_battles(status, scheduled_starts_at DESC)`
    );

    const cols = await allQuery("PRAGMA table_info(pub_battles)");
    const names = new Set(cols.map((c) => c.name));
    const alters = [
        ["rooms_json", "TEXT NOT NULL DEFAULT '{}'"],
        ["meta_json", "TEXT NOT NULL DEFAULT '{}'"],
        ["registration_opens_at", "INTEGER DEFAULT 0"],
        ["scheduled_starts_at", "INTEGER DEFAULT 0"]
    ];
    for (const [col, def] of alters) {
        if (!names.has(col)) {
            await runQuery(`ALTER TABLE pub_battles ADD COLUMN ${col} ${def}`);
        }
    }
}

module.exports = { ensurePubBattleSchema };
