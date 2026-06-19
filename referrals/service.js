const { levelFromXp, normalizeXp } = require("../xp-levels");
const { REFERRAL_ACTIVE_MS } = require("./config");

function parseReferrerId(raw) {
    const id = Math.floor(Number(raw));
    if (!Number.isFinite(id) || id <= 0) return null;
    return id;
}

function createReferralsService(deps) {
    const { runQuery, getQuery, allQuery } = deps;

    async function ensureSchema() {
        const columns = await allQuery("PRAGMA table_info(users)");
        const existing = new Set(columns.map((col) => col.name));
        if (!existing.has("referred_by")) {
            await runQuery("ALTER TABLE users ADD COLUMN referred_by INTEGER DEFAULT NULL");
        }
        await runQuery(
            "CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by) WHERE referred_by IS NOT NULL"
        );
    }

    async function resolveReferrerId(raw) {
        const id = parseReferrerId(raw);
        if (!id) return null;
        const row = await getQuery("SELECT id FROM users WHERE id = ?", [id]);
        return row ? id : null;
    }

    function isReferralActive(lastActiveAt, now = Date.now()) {
        const t = Math.floor(Number(lastActiveAt) || 0);
        if (t <= 0) return false;
        return now - t < REFERRAL_ACTIVE_MS;
    }

    function buildReferralLink(req, playerId) {
        const proto = String(req.get("x-forwarded-proto") || req.protocol || "https")
            .split(",")[0]
            .trim();
        const host = String(req.get("x-forwarded-host") || req.get("host") || "localhost")
            .split(",")[0]
            .trim();
        return `${proto}://${host}/index.html?ref=${playerId}`;
    }

    async function getStateForUser(userRow, req) {
        const playerId = Math.floor(Number(userRow.id) || 0);
        if (!playerId) {
            return { error: "Не удалось определить ID игрока" };
        }

        const now = Date.now();
        const rows = await allQuery(
            `SELECT name, xp, last_active_at, registered_at
             FROM users
             WHERE referred_by = ?
             ORDER BY registered_at DESC, id DESC`,
            [playerId]
        );

        const invited = rows.map((row) => {
            const xp = normalizeXp(row.xp);
            const level = levelFromXp(xp);
            const active = isReferralActive(row.last_active_at, now);
            return {
                name: String(row.name || "Игрок").trim() || "Игрок",
                level,
                active
            };
        });

        const invitedCount = invited.length;
        const activeCount = invited.filter((r) => r.active).length;

        return {
            playerId,
            referralLink: buildReferralLink(req, playerId),
            invitedCount,
            activeCount,
            invited
        };
    }

    return {
        ensureSchema,
        parseReferrerId,
        resolveReferrerId,
        isReferralActive,
        buildReferralLink,
        getStateForUser,
        REFERRAL_ACTIVE_MS
    };
}

module.exports = { createReferralsService, parseReferrerId };
