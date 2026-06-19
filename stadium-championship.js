/**
 * Круговой чемпионат стадиона: 8 клубов, 28 матчей, 18:00 и 20:00 (Europe/Kyiv).
 */

const gameTime = require("./game-time");
const stadiumBots = require("./stadium-bots");

const CHAMPIONSHIP_SEASON_ID = "2026-summer";
const CHAMPIONSHIP_START = { year: 2026, month: 6, day: 18 };
const CHAMPIONSHIP_MATCH_HOURS = [18, 20];
const CHAMPIONSHIP_MATCH_COUNT = 28;
/** Игровая неделя: пн–пт × 2 матча в день. */
const CHAMPIONSHIP_WEEK_MATCH_LIMIT = 10;
const SCHEDULE_LABEL = "18:00 · 20:00 (Киев)";

function roundRobinPairs(clubIds) {
    const teams = [...clubIds];
    if (teams.length % 2) teams.push(null);
    const n = teams.length;
    const pairs = [];
    for (let round = 0; round < n - 1; round += 1) {
        for (let i = 0; i < n / 2; i += 1) {
            const home = teams[i];
            const away = teams[n - 1 - i];
            if (home && away) pairs.push([home, away]);
        }
        teams.splice(1, 0, teams.pop());
    }
    return pairs;
}

function buildChampionshipSchedule(clubIds = stadiumBots.STADIUM_CLUB_IDS) {
    const pairs = roundRobinPairs(clubIds);
    if (pairs.length !== CHAMPIONSHIP_MATCH_COUNT) {
        throw new Error(`Expected ${CHAMPIONSHIP_MATCH_COUNT} pairs, got ${pairs.length}`);
    }

    return pairs.map(([homeClub, awayClub], index) => {
        const dayOffset = Math.floor(index / CHAMPIONSHIP_MATCH_HOURS.length);
        const hour = CHAMPIONSHIP_MATCH_HOURS[index % CHAMPIONSHIP_MATCH_HOURS.length];
        const parts = gameTime.addKyivDays(CHAMPIONSHIP_START, dayOffset);
        const startsAt = gameTime.kyivLocalToUtcMs(parts.year, parts.month, parts.day, hour, 0, 0);
        const round = index + 1;
        return {
            id: `champ26_${String(round).padStart(2, "0")}`,
            round,
            homeClub,
            awayClub,
            startsAt
        };
    });
}

function isChampionshipMatch(matchOrMeta) {
    if (!matchOrMeta) return false;
    const meta =
        matchOrMeta.meta && typeof matchOrMeta.meta === "object"
            ? matchOrMeta.meta
            : matchOrMeta;
    return meta?.championshipSeason === CHAMPIONSHIP_SEASON_ID;
}

module.exports = {
    CHAMPIONSHIP_SEASON_ID,
    CHAMPIONSHIP_START,
    CHAMPIONSHIP_MATCH_HOURS,
    CHAMPIONSHIP_MATCH_COUNT,
    CHAMPIONSHIP_WEEK_MATCH_LIMIT,
    SCHEDULE_LABEL,
    roundRobinPairs,
    buildChampionshipSchedule,
    isChampionshipMatch
};
