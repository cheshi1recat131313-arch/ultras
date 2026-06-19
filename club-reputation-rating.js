/**
 * Рейтинг клубов = сумма репутации всех игроков клуба (users.reputation).
 */

function createClubReputationRatingService({ allQuery, clubsData }) {
    async function loadRepByClubId() {
        const rows = await allQuery(
            `SELECT club, COUNT(*) AS fan_count, SUM(COALESCE(reputation, 0)) AS total_reputation
             FROM users
             WHERE club IS NOT NULL AND TRIM(club) != ''
             GROUP BY club`
        );
        const map = {};
        for (const row of rows || []) {
            const key = String(row.club || "").trim();
            if (!key) continue;
            map[key] = {
                fanCount: Math.max(0, Math.floor(Number(row.fan_count) || 0)),
                totalReputation: Math.max(0, Math.floor(Number(row.total_reputation) || 0))
            };
        }
        return map;
    }

    function aggregateClubStats(clubId, repByClubId) {
        const ids = clubsData.clubIdsForFanCount(clubId);
        let fanCount = 0;
        let totalReputation = 0;
        for (const id of ids) {
            const row = repByClubId[id];
            if (!row) continue;
            fanCount += row.fanCount;
            totalReputation += row.totalReputation;
        }
        return { fanCount, totalReputation };
    }

    function canonicalRankClubId(clubId) {
        const club = clubsData.getClub(clubId);
        if (!club) return String(clubId || "").trim() || null;
        if (!club.hiddenFromSelection) return club.id;
        for (const selectable of clubsData.listSelectableClubs()) {
            const ids = clubsData.clubIdsForFanCount(selectable.id);
            if (ids.includes(club.id)) return selectable.id;
        }
        return club.id;
    }

    async function buildClubRankings() {
        const repByClubId = await loadRepByClubId();
        const items = clubsData.listSelectableClubs().map((c) => {
            const stats = aggregateClubStats(c.id, repByClubId);
            return {
                id: c.id,
                name: c.name,
                emblem: c.emblem,
                fanCount: stats.fanCount,
                totalReputation: stats.totalReputation,
                rating: stats.totalReputation
            };
        });

        items.sort((a, b) => {
            if (b.totalReputation !== a.totalReputation) return b.totalReputation - a.totalReputation;
            if (b.fanCount !== a.fanCount) return b.fanCount - a.fanCount;
            return String(a.name).localeCompare(String(b.name), "ru");
        });

        items.forEach((item, index) => {
            item.position = index + 1;
            item.rank = index + 1;
        });

        return items;
    }

    async function getClubRankingStats(clubId) {
        const club = clubsData.getClub(clubId);
        if (!club) return null;

        const rankClubId = canonicalRankClubId(clubId);
        const rankings = await buildClubRankings();
        const entry = rankings.find((r) => r.id === rankClubId);
        if (!entry) {
            return {
                fanCount: 0,
                totalReputation: 0,
                rating: 0,
                position: rankings.length,
                rankPosition: rankings.length
            };
        }
        return {
            fanCount: entry.fanCount,
            totalReputation: entry.totalReputation,
            rating: entry.totalReputation,
            position: entry.position,
            rankPosition: entry.position
        };
    }

    return {
        buildClubRankings,
        getClubRankingStats
    };
}

module.exports = {
    createClubReputationRatingService
};
