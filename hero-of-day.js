/**
 * «Герой дня» — лидер по черепкам за календарные сутки (00:00–23:59, время сервера).
 * Дневной счётчик строится из rep_earnings; общие skulls у игрока не сбрасываются.
 */

const gameTime = require("./game-time");
const { createMutex } = require("./core/async-mutex");

function getDayBounds(ts = Date.now()) {
    return gameTime.getKyivDayBounds(ts);
}

function dayKeyToStartMs(dayKey) {
    return gameTime.kyivDayKeyToStartMs(dayKey);
}

function normalizeEmail(email) {
    return String(email || "")
        .trim()
        .toLowerCase();
}

function skullWord(n) {
    const v = Math.abs(Math.floor(Number(n) || 0));
    const mod10 = v % 10;
    const mod100 = v % 100;
    if (mod10 === 1 && mod100 !== 11) return "черепок";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "черепка";
    return "черепков";
}

function createHeroOfDayService({ runQuery, allQuery, getQuery }) {
    async function ensureSchema() {
        await runQuery(`
            CREATE TABLE IF NOT EXISTS hero_of_day_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                day_key TEXT NOT NULL,
                leader_email TEXT,
                leader_skulls INTEGER NOT NULL DEFAULT 0,
                updated_at INTEGER NOT NULL
            )
        `);
        await runQuery(`
            CREATE TABLE IF NOT EXISTS hero_of_day_daily (
                day_key TEXT PRIMARY KEY,
                email TEXT NOT NULL DEFAULT '',
                skulls INTEGER NOT NULL DEFAULT 0,
                name TEXT NOT NULL DEFAULT '',
                achievement_granted INTEGER NOT NULL DEFAULT 0,
                finalized_at INTEGER NOT NULL
            )
        `);
        await runQuery(
            `CREATE INDEX IF NOT EXISTS idx_hero_of_day_daily_email ON hero_of_day_daily(email)`
        );

        const state = await getQuery("SELECT id FROM hero_of_day_state WHERE id = 1");
        if (!state) {
            const now = Date.now();
            await runQuery(
                `INSERT INTO hero_of_day_state (id, day_key, leader_email, leader_skulls, updated_at)
                 VALUES (1, ?, NULL, 0, ?)`,
                [gameTime.getKyivDayKey(now), now]
            );
        }
    }

    async function findLeader(startMs, endMs) {
        const row = await getQuery(
            `SELECT email, SUM(skulls) AS daily_skulls
             FROM rep_earnings
             WHERE created_at >= ? AND created_at < ?
             GROUP BY email
             HAVING daily_skulls > 0
             ORDER BY daily_skulls DESC, email ASC
             LIMIT 1`,
            [startMs, endMs]
        );
        if (!row) return null;
        return {
            email: normalizeEmail(row.email),
            skulls: Math.max(0, Math.floor(Number(row.daily_skulls) || 0))
        };
    }

    async function sumDailySkulls(email, startMs, endMs) {
        const key = normalizeEmail(email);
        if (!key) return 0;
        const row = await getQuery(
            `SELECT COALESCE(SUM(skulls), 0) AS total
             FROM rep_earnings
             WHERE email = ? AND created_at >= ? AND created_at < ?`,
            [key, startMs, endMs]
        );
        return Math.max(0, Math.floor(Number(row?.total) || 0));
    }

    async function syncStateLeader(leader, dayKey, now) {
        if (leader) {
            await runQuery(
                `UPDATE hero_of_day_state
                 SET day_key = ?, leader_email = ?, leader_skulls = ?, updated_at = ?
                 WHERE id = 1`,
                [dayKey, leader.email, leader.skulls, now]
            );
        } else {
            await runQuery(
                `UPDATE hero_of_day_state
                 SET day_key = ?, leader_email = NULL, leader_skulls = 0, updated_at = ?
                 WHERE id = 1`,
                [dayKey, now]
            );
        }
    }

    async function finalizeDay(oldDayKey, now) {
        const existing = await getQuery("SELECT day_key FROM hero_of_day_daily WHERE day_key = ?", [oldDayKey]);
        if (existing) return;

        const startMs = dayKeyToStartMs(oldDayKey);
        const endMs = startMs + 24 * 60 * 60 * 1000;
        const leader = await findLeader(startMs, endMs);

        if (!leader) {
            await runQuery(
                `INSERT INTO hero_of_day_daily (day_key, email, skulls, name, achievement_granted, finalized_at)
                 VALUES (?, '', 0, '', 0, ?)`,
                [oldDayKey, now]
            );
            return;
        }

        const user = await getQuery("SELECT name FROM users WHERE email = ?", [leader.email]);
        const name = user?.name || "Игрок";

        await runQuery(
            `INSERT INTO hero_of_day_daily (day_key, email, skulls, name, achievement_granted, finalized_at)
             VALUES (?, ?, ?, ?, 1, ?)`,
            [oldDayKey, leader.email, leader.skulls, name, now]
        );
        await runQuery(
            "UPDATE users SET hero_of_day_wins = COALESCE(hero_of_day_wins, 0) + 1 WHERE email = ?",
            [leader.email]
        );
    }

    async function ensureDayRollover(now = Date.now()) {
        const { dayKey } = getDayBounds(now);
        const state = await getQuery("SELECT day_key FROM hero_of_day_state WHERE id = 1");
        if (!state) {
            await runQuery(
                `INSERT INTO hero_of_day_state (id, day_key, leader_email, leader_skulls, updated_at)
                 VALUES (1, ?, NULL, 0, ?)`,
                [dayKey, now]
            );
            return false;
        }
        if (state.day_key === dayKey) return false;
        await finalizeDay(state.day_key, now);
        /** Новые сутки: сразу новый day_key, лидер пустой до первых черепков. */
        await syncStateLeader(null, dayKey, now);
        return true;
    }

    async function refreshLeader(now = Date.now()) {
        await ensureDayRollover(now);
        const { dayKey, startMs, endMs } = getDayBounds(now);
        const leader = await findLeader(startMs, endMs);
        await syncStateLeader(leader, dayKey, now);
        return leader;
    }

    async function onSkullsRecorded(email, skulls, now = Date.now()) {
        const earned = Math.max(0, Math.floor(Number(skulls) || 0));
        if (!normalizeEmail(email) || earned < 1) return;
        await refreshLeader(now);
    }

    async function buildPayloadFromLeader(leader, viewerEmail, startMs, endMs) {
        const viewer = normalizeEmail(viewerEmail);
        const yourSkulls = viewer ? await sumDailySkulls(viewer, startMs, endMs) : 0;

        if (!leader) {
            return {
                active: false,
                yourSkulls,
                yourSkullsLabel: `${yourSkulls} ${skullWord(yourSkulls)} сегодня`
            };
        }

        const user = await getQuery("SELECT name FROM users WHERE email = ?", [leader.email]);
        const leaderName = user?.name || "Игрок";
        const leaderSkulls = leader.skulls;
        const isYou = viewer && viewer === leader.email;

        return {
            active: true,
            email: leader.email,
            name: leaderName,
            skulls: leaderSkulls,
            skullsLabel: `${leaderSkulls} ${skullWord(leaderSkulls)} сегодня`,
            yourSkulls,
            yourSkullsLabel:
                isYou && yourSkulls === leaderSkulls ? "Ты лидер" : `Ты ${yourSkulls}`,
            isYou
        };
    }

    async function getPayload(viewerEmail, now = Date.now()) {
        const leader = await refreshLeader(now);
        const { startMs, endMs } = getDayBounds(now);
        return buildPayloadFromLeader(leader, viewerEmail, startMs, endMs);
    }

    function msUntilNextMidnight(now = Date.now()) {
        return gameTime.msUntilNextKyivMidnight(now);
    }

    /** Полночь (время сервера) + резервная проверка каждые 30 с — без рестарта и без входа игрока. */
    function startScheduler() {
        let midnightTimer = null;
        let backupTimer = null;
        const rolloverMutex = createMutex();

        async function runRollover(label) {
            return rolloverMutex.runExclusive(async () => {
                try {
                    const now = Date.now();
                    const prev = await getQuery("SELECT day_key FROM hero_of_day_state WHERE id = 1");
                    const prevKey = prev?.day_key;
                    const leader = await refreshLeader(now);
                    const { dayKey } = getDayBounds(now);
                    if (prevKey && prevKey !== dayKey) {
                        console.log(
                            `[hero-of-day] ${label}: новый day_key=${dayKey}, leader=${leader?.email || "(нет)"}`
                        );
                    }
                } catch (err) {
                    console.error(`[hero-of-day] ${label} error:`, err);
                }
            });
        }

        function scheduleMidnight() {
            if (midnightTimer) clearTimeout(midnightTimer);
            midnightTimer = setTimeout(async () => {
                await runRollover("midnight");
                scheduleMidnight();
            }, msUntilNextMidnight());
        }

        async function backupTick() {
            try {
                const now = Date.now();
                const { dayKey } = getDayBounds(now);
                const state = await getQuery("SELECT day_key FROM hero_of_day_state WHERE id = 1");
                if (state && state.day_key !== dayKey) {
                    await runRollover("backup-tick");
                }
            } catch (err) {
                console.error("[hero-of-day] backup tick error:", err);
            }
        }

        scheduleMidnight();
        backupTimer = setInterval(backupTick, 30_000);
        backupTick();

        return () => {
            if (midnightTimer) clearTimeout(midnightTimer);
            if (backupTimer) clearInterval(backupTimer);
        };
    }

    return {
        ensureSchema,
        getDayBounds,
        refreshLeader,
        onSkullsRecorded,
        getPayload,
        startScheduler,
        skullWord
    };
}

module.exports = {
    getDayBounds,
    dayKeyToStartMs,
    skullWord,
    createHeroOfDayService
};
