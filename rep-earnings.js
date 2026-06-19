/**
 * Учёт заработанной репутации / черепков по событиям (для «Элита клуба» и др.).
 */

const eliteConfig = require("./club-elite-config");
const talismanEffects = require("./talisman-effects");
const talismans = require("./talismans");

const RETENTION_MS = eliteConfig.CLUB_ELITE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

function skullsFromRepDelta(prevRep, repGain) {
    const prev = Math.max(0, Math.floor(Number(prevRep) || 0));
    const gain = Math.max(0, Math.floor(Number(repGain) || 0));
    if (gain < 1) return 0;
    const next = prev + gain;
    const per = eliteConfig.CLUB_ELITE_REP_PER_SKULL;
    return Math.floor(next / per) - Math.floor(prev / per);
}

function createRepEarningsService({ runQuery, allQuery, getQuery }) {
    let heroOfDayService = null;

    function setHeroOfDayService(service) {
        heroOfDayService = service || null;
    }
    async function pruneOldRows(now = Date.now()) {
        const cutoff = now - RETENTION_MS;
        await runQuery("DELETE FROM rep_earnings WHERE created_at < ?", [cutoff]);
    }

    /**
     * @param {object} opts — email, club, repGain, source, prevReputation?, createdAt?
     */
    async function recordRepEarning(opts) {
        const email = String(opts.email || "")
            .trim()
            .toLowerCase();
        const repGain = Math.max(0, Math.floor(Number(opts.repGain) || 0));
        if (!email || repGain < 1) return { ok: false };

        const prevRep = Math.max(0, Math.floor(Number(opts.prevReputation) || 0));
        const skulls = skullsFromRepDelta(prevRep, repGain);
        const club = opts.club ? String(opts.club).trim() : null;
        const source = String(opts.source || "misc").trim().slice(0, 32);
        const createdAt = opts.createdAt || Date.now();

        await runQuery(
            `INSERT INTO rep_earnings (email, club, rep, skulls, source, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [email, club, repGain, skulls, source, createdAt]
        );
        await pruneOldRows(createdAt);
        return { ok: true, skulls, repGain };
    }

    /**
     * Единая точка начисления репутации: Mercedes, профиль игрока, элита клуба.
     * @param {object} opts — email, baseRep, source, club?, prevReputation?, talismansRaw?, createdAt?
     */
    async function grantPlayerReputation(opts) {
        const email = String(opts.email || "")
            .trim()
            .toLowerCase();
        const baseRep = Math.max(0, Math.floor(Number(opts.baseRep) || 0));
        if (!email || baseRep < 1 || opts.isBot) {
            return { ok: false, repGain: 0, mercedesBoost: false, skullsEarned: 0 };
        }

        let prevRep = opts.prevReputation;
        let talRaw = opts.talismansRaw;
        if (getQuery) {
            const row = await getQuery("SELECT email, reputation, talismans FROM users WHERE email = ?", [email]);
            if (!row) {
                return { ok: false, repGain: 0, mercedesBoost: false, skullsEarned: 0 };
            }
            if (prevRep == null) prevRep = row.reputation ?? 0;
            if (talRaw == null) talRaw = row.talismans;
        }
        prevRep = Math.max(0, Math.floor(Number(prevRep) || 0));
        talRaw = talismans.resolveOwnedRaw(talRaw ?? "{}");

        const mercedesRep = talismanEffects.applyMercedesRep(talRaw, baseRep, {
            source: opts.source,
            rng: opts.rng
        });
        const repGain = mercedesRep.repGain;
        if (repGain < 1) {
            return { ok: false, repGain: 0, mercedesBoost: false, skullsEarned: 0 };
        }

        const skullsEarned = skullsFromRepDelta(prevRep, repGain);
        await recordRepEarning({
            email,
            club: opts.club,
            repGain,
            prevReputation: prevRep,
            source: opts.source,
            createdAt: opts.createdAt
        });
        await runQuery(
            "UPDATE users SET reputation = COALESCE(reputation, 0) + ?, skulls = COALESCE(skulls, 0) + ? WHERE email = ?",
            [repGain, skullsEarned, email]
        );

        if (skullsEarned > 0 && heroOfDayService) {
            await heroOfDayService.onSkullsRecorded(email, skullsEarned, opts.createdAt || Date.now());
        }

        return {
            ok: true,
            repGain,
            mercedesBoost: mercedesRep.mercedesBoost,
            skullsEarned,
            newReputation: prevRep + repGain
        };
    }

    async function sumWeeklySkullsByClub(club, sinceMs) {
        const rows = await allQuery(
            `SELECT email, SUM(skulls) AS weekly_skulls, SUM(rep) AS weekly_rep
             FROM rep_earnings
             WHERE club = ? AND created_at >= ?
             GROUP BY email`,
            [club, sinceMs]
        );
        const map = {};
        for (const row of rows) {
            map[String(row.email).toLowerCase()] = {
                weeklySkulls: Math.max(0, Math.floor(Number(row.weekly_skulls) || 0)),
                weeklyRep: Math.max(0, Math.floor(Number(row.weekly_rep) || 0))
            };
        }
        return map;
    }

    return {
        recordRepEarning,
        grantPlayerReputation,
        skullsFromRepDelta,
        pruneOldRows,
        sumWeeklySkullsByClub,
        setHeroOfDayService,
        RETENTION_MS
    };
}

module.exports = {
    skullsFromRepDelta,
    createRepEarningsService
};
