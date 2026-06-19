/**
 * Реальные игроки на районе: подбор по уровню, офлайн-защита, блок повторных нападений.
 */

const playerOnline = require("./player-online");

const PLAYER_SLOT_INDEX = 2;
const NPC_SLOT_GOP = 0;
const NPC_SLOT_FAN = 1;
const NPC_SLOT_COUNT = 2;
const DISTRICT_SLOT_COUNT = 3;
/** Нападение на игрока — только если офлайн не менее 30 минут. */
const DISTRICT_PLAYER_OFFLINE_MS = 30 * 60 * 1000;

const PLAYER_PHRASES = [
    "Ну что, поговорим по-мужски?",
    "Ты куда лезешь?",
    "Сейчас покажу, кто тут главный.",
    "Давай, не тяни."
];

function levelMatchRange(viewerLevel) {
    const lvl = Math.max(1, Math.floor(Number(viewerLevel) || 1));
    return {
        min: lvl,
        max: lvl + 1
    };
}

function randomPlayerPhrase() {
    return PLAYER_PHRASES[Math.floor(Math.random() * PLAYER_PHRASES.length)];
}

function isTargetOfflineLongEnough(lastActiveAt, now = Date.now()) {
    const t = Math.floor(Number(lastActiveAt) || 0);
    if (playerOnline.isPlayerOnline(t, now)) return false;
    if (t <= 0) return true;
    return now - t >= DISTRICT_PLAYER_OFFLINE_MS;
}

function createDistrictPlayersService(deps) {
    const { runQuery, allQuery } = deps;
    const minDistrictHp = Math.max(1, Math.floor(Number(deps.minDistrictHp) || 35));

    async function ensureSchema() {
        await runQuery(`
            CREATE TABLE IF NOT EXISTS district_pvp_attacked (
                target_email TEXT PRIMARY KEY,
                attacker_email TEXT NOT NULL,
                attacked_at INTEGER NOT NULL
            )
        `);
        await runQuery(
            "CREATE INDEX IF NOT EXISTS idx_district_pvp_attacked_at ON district_pvp_attacked(attacked_at)"
        );
    }

    async function getAttackedTargetEmails() {
        const rows = await allQuery("SELECT target_email FROM district_pvp_attacked");
        return new Set(rows.map((r) => String(r.target_email).toLowerCase()));
    }

    async function pickDistrictPlayer(viewer, viewerLevel) {
        const viewerEmail = String(viewer.email || "").trim().toLowerCase();
        if (!viewerEmail) return null;

        const { min, max } = levelMatchRange(viewerLevel);
        const blocked = await getAttackedTargetEmails();
        const now = Date.now();

        const rows = await allQuery(
            `SELECT email, name, character, club, xp, level, hp, rubles, money, last_active_at
             FROM users
             WHERE email != ?
               AND character IS NOT NULL AND TRIM(character) != ''
               AND name IS NOT NULL AND TRIM(name) != ''
               AND club IS NOT NULL AND TRIM(club) != ''
               AND COALESCE(level, 1) >= ?
               AND COALESCE(level, 1) <= ?
               AND COALESCE(hp, 0) >= ?
             ORDER BY RANDOM()
             LIMIT 60`,
            [viewerEmail, min, max, minDistrictHp]
        );

        for (const row of rows) {
            const email = String(row.email).toLowerCase();
            if (blocked.has(email)) continue;
            if (!isTargetOfflineLongEnough(row.last_active_at, now)) continue;
            const hp = Math.max(0, Math.floor(Number(row.hp) || 0));
            if (hp < minDistrictHp) continue;
            return row;
        }
        return null;
    }

    async function assertCanAttackPlayer(targetEmail, now = Date.now()) {
        const target = String(targetEmail || "").trim().toLowerCase();
        if (!target) {
            return { ok: false, error: "Противник не найден." };
        }
        const row = await allQuery(
            "SELECT email, last_active_at FROM users WHERE email = ? LIMIT 1",
            [target]
        );
        const user = row[0];
        if (!user) {
            return { ok: false, error: "Игрок больше не доступен." };
        }
        if (!isTargetOfflineLongEnough(user.last_active_at, now)) {
            return {
                ok: false,
                code: "player_protected",
                error: "На этого игрока нельзя нападать — он недавно был в игре. Подожди 30 минут после выхода."
            };
        }
        return { ok: true };
    }

    async function recordAttackOnPlayer(attackerEmail, targetEmail, now = Date.now()) {
        const attacker = String(attackerEmail || "").trim().toLowerCase();
        const target = String(targetEmail || "").trim().toLowerCase();
        if (!attacker || !target || attacker === target) return;
        await runQuery(
            `INSERT INTO district_pvp_attacked (target_email, attacker_email, attacked_at)
             VALUES (?, ?, ?)
             ON CONFLICT(target_email) DO UPDATE SET
               attacker_email = excluded.attacker_email,
               attacked_at = excluded.attacked_at`,
            [target, attacker, now]
        );
    }

    async function clearAttackBlockOnLogin(targetEmail) {
        const target = String(targetEmail || "").trim().toLowerCase();
        if (!target) return;
        await runQuery("DELETE FROM district_pvp_attacked WHERE target_email = ?", [target]);
    }

    function isPlayerSlot(index) {
        return index === PLAYER_SLOT_INDEX;
    }

    return {
        PLAYER_SLOT_INDEX,
        NPC_SLOT_GOP,
        NPC_SLOT_FAN,
        NPC_SLOT_COUNT,
        DISTRICT_SLOT_COUNT,
        DISTRICT_PLAYER_OFFLINE_MS,
        minDistrictHp,
        levelMatchRange,
        randomPlayerPhrase,
        isTargetOfflineLongEnough,
        ensureSchema,
        getAttackedTargetEmails,
        pickDistrictPlayer,
        assertCanAttackPlayer,
        recordAttackOnPlayer,
        clearAttackBlockOnLogin,
        isPlayerSlot
    };
}

module.exports = {
    createDistrictPlayersService,
    PLAYER_SLOT_INDEX,
    NPC_SLOT_GOP,
    NPC_SLOT_FAN,
    NPC_SLOT_COUNT,
    DISTRICT_SLOT_COUNT,
    DISTRICT_PLAYER_OFFLINE_MS,
    levelMatchRange,
    isTargetOfflineLongEnough
};
