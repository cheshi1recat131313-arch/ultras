/**
 * Рейтинг «Элита клуба» — черепки за 7 дней, ранги, сортировка.
 */

const eliteConfig = require("./club-elite-config");

function thresholdRankForSkulls(skulls) {
    let title = null;
    for (const t of eliteConfig.CLUB_ELITE_THRESHOLD_RANKS) {
        if (skulls >= t.minSkulls) title = t.title;
    }
    return title;
}

/** Ранг игрока по общему числу черепков (досье, API профиля). */
function rankTitleFromTotalSkulls(skulls) {
    const n = Math.max(0, Math.floor(Number(skulls) || 0));
    let title = eliteConfig.SKULL_RANK_THRESHOLDS[0].title;
    for (const t of eliteConfig.SKULL_RANK_THRESHOLDS) {
        if (n >= t.minSkulls) title = t.title;
    }
    return title;
}

function nextThresholdAfter(skulls) {
    for (const t of eliteConfig.CLUB_ELITE_THRESHOLD_RANKS) {
        if (skulls < t.minSkulls) {
            return { title: t.title, skullsNeeded: t.minSkulls - skulls };
        }
    }
    return null;
}

/**
 * @param {Array<{email, weeklySkulls, ...}>} members — уже отсортированы по weeklySkulls DESC
 */
function assignClubRanks(members) {
    const sorted = members.slice().sort((a, b) => b.weeklySkulls - a.weeklySkulls || String(a.name).localeCompare(String(b.name)));
    const leaderSkulls = sorted[0]?.weeklySkulls ?? 0;

    return sorted.map((m, index) => {
        let rankTitle = thresholdRankForSkulls(m.weeklySkulls);
        let rankKind = "threshold";

        if (index === 0 && m.weeklySkulls > 0) {
            rankTitle = eliteConfig.CLUB_ELITE_RANK_LEADER;
            rankKind = "leader";
        } else if (
            index >= 1 &&
            index <= eliteConfig.CLUB_ELITE_ASSISTANT_COUNT &&
            m.weeklySkulls > 0
        ) {
            rankTitle = eliteConfig.CLUB_ELITE_RANK_ASSISTANT;
            rankKind = "assistant";
        }

        let nextRank = null;
        let skullsToNext = 0;

        if (rankKind === "leader") {
            nextRank = null;
            skullsToNext = 0;
        } else {
            const nextTh = nextThresholdAfter(m.weeklySkulls);
            if (nextTh) {
                nextRank = nextTh.title;
                skullsToNext = nextTh.skullsNeeded;
            } else if (leaderSkulls > m.weeklySkulls) {
                nextRank = eliteConfig.CLUB_ELITE_RANK_LEADER;
                skullsToNext = Math.max(0, leaderSkulls - m.weeklySkulls);
            } else {
                nextRank = null;
                skullsToNext = 0;
            }
        }

        return {
            ...m,
            position: index + 1,
            rankTitle: rankTitle || "—",
            rankKind,
            nextRank,
            skullsToNext
        };
    });
}

function buildClubElitePayload(clubName, members, viewerEmail) {
    const ranked = assignClubRanks(members);
    const meKey = viewerEmail ? String(viewerEmail).toLowerCase() : "";
    const me = ranked.find((r) => r.email === meKey) || null;

    return {
        clubName,
        windowDays: eliteConfig.CLUB_ELITE_WINDOW_DAYS,
        updateNote: "Рейтинг обновляется автоматически.",
        thresholdRanks: eliteConfig.CLUB_ELITE_THRESHOLD_RANKS,
        me: me
            ? {
                  weeklySkulls: me.weeklySkulls,
                  rankTitle: me.rankTitle,
                  nextRank: me.nextRank,
                  skullsToNext: me.skullsToNext
              }
            : null,
        players: ranked.map((p) => ({
            ...p,
            isMe: meKey && p.email === meKey
        }))
    };
}

module.exports = {
    assignClubRanks,
    buildClubElitePayload,
    thresholdRankForSkulls,
    rankTitleFromTotalSkulls
};
