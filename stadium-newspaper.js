/**
 * Газета «Третий тайм» — отчёт по завершённому матчу стадиона.
 */

const clubsData = require("./clubs-data");
const clubCharacters = require("./club-characters");
const stadiumEngine = require("./stadium-engine");

const NEWSPAPER_MAX_ISSUES = 100;
const TOP_XP_BONUS = [3, 2, 1];
const REP_ICON = "🤘";
const HP_ICON = "❤️";

function formatMatchDate(ts) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildClubAggregates(match) {
    const stats = match.meta?.matchStats || {};
    const homeId = clubCharacters.normalizeClubId(match.homeClub);
    const awayId = clubCharacters.normalizeClubId(match.awayClub);
    const home = { knockouts: match.scoreHome ?? 0, rep: 0, damage: 0 };
    const away = { knockouts: match.scoreAway ?? 0, rep: 0, damage: 0 };
    for (const row of Object.values(stats)) {
        const club = clubCharacters.normalizeClubId(row.club);
        if (club === homeId) {
            home.rep += row.rep || 0;
            home.damage += row.damage || 0;
        } else if (club === awayId) {
            away.rep += row.rep || 0;
            away.damage += row.damage || 0;
        }
    }
    return { home, away };
}

function determineWinner(match) {
    if ((match.scoreHome ?? 0) > (match.scoreAway ?? 0)) {
        return { club: match.homeClub, name: match.homeClubName };
    }
    if ((match.scoreAway ?? 0) > (match.scoreHome ?? 0)) {
        return { club: match.awayClub, name: match.awayClubName };
    }
    return { club: match.homeClub, name: match.homeClubName };
}

function buildTopFighters(match, limit = 10) {
    const allowedClubIds = stadiumEngine.matchParticipantClubIds(match);
    return stadiumEngine
        .sortLeaderboardRows(match.meta?.matchStats || {}, {
            realPlayersOnly: false,
            allowedClubIds
        })
        .slice(0, limit)
        .map((r, i) => ({
            rank: i + 1,
            email: r.email,
            name: r.name,
            level: r.level ?? 1,
            club: r.club,
            clubName: r.clubName || clubsData.getClubName(r.club) || r.club || "",
            rep: r.rep || 0,
            damage: r.damage || 0,
            kos: r.kos || 0,
            isBot: !!r.isBot,
            xpBonus: !r.isBot && r.email && i < TOP_XP_BONUS.length ? TOP_XP_BONUS[i] : 0
        }));
}

function buildNarrative(match, homeAgg, awayAgg, winner) {
    return (
        `${match.homeClubName} вынесли ${homeAgg.knockouts} соперников, заработали ${homeAgg.rep} репутации и нанесли ${homeAgg.damage} урона. ` +
        `${match.awayClubName} вынесли ${awayAgg.knockouts} соперников, заработали ${awayAgg.rep} репутации и нанесли ${awayAgg.damage} урона. ` +
        `Победу одержали ${winner.name} и получают 1 балл рейтинга.`
    );
}

function buildThirdHalfReport(match) {
    const { home, away } = buildClubAggregates(match);
    const winner = determineWinner(match);
    const topFighters = buildTopFighters(match, 10);
    const endedAt = match.endsAt || Date.now();
    return {
        matchId: match.id,
        level: match.level,
        title: "Газета «Третий тайм»",
        matchLabel: `${match.homeClubName} — ${match.awayClubName}`,
        datetime: formatMatchDate(endedAt),
        endedAt,
        homeClub: match.homeClub,
        awayClub: match.awayClub,
        homeClubName: match.homeClubName,
        awayClubName: match.awayClubName,
        clubEmblems: {
            [match.homeClub]: clubsData.getClubEmblem(match.homeClub),
            [match.awayClub]: clubsData.getClubEmblem(match.awayClub)
        },
        home: { ...home, clubName: match.homeClubName },
        away: { ...away, clubName: match.awayClubName },
        scoreHome: match.scoreHome ?? 0,
        scoreAway: match.scoreAway ?? 0,
        winnerClub: winner.club,
        winnerClubName: winner.name,
        ratingPoint: 1,
        narrative: buildNarrative(match, home, away, winner),
        topFighters,
        xpNote:
            "3 лучших бойца (игроки) получают дополнительно +3, +2 и +1 опыта. Стадионные боты в топе — без бонуса XP.",
        repIcon: REP_ICON,
        hpIcon: HP_ICON
    };
}

async function collectParticipantEmails(match, allQuery, hasTicketFn) {
    const set = new Set();
    for (const row of Object.values(match.meta?.matchStats || {})) {
        if (row.email) set.add(String(row.email).toLowerCase());
    }
    for (const f of match.fighters || []) {
        if (f.email) set.add(String(f.email).toLowerCase());
    }
    const rows = await allQuery(
        "SELECT email, stadium_tickets FROM users WHERE club IN (?, ?)",
        [match.homeClub, match.awayClub]
    );
    for (const row of rows) {
        if (hasTicketFn(row, match.id)) set.add(String(row.email).toLowerCase());
    }
    return [...set];
}

function createNewspaperPublisher(deps) {
    const {
        runQuery,
        getQuery,
        allQuery,
        hasTicket,
        grantXpToEmail,
        recordPlayerEvent,
        normalizeXp,
        levelFromXp,
        grantStatPointsForLevelDelta,
        ensureUserLevelMatchesXp
    } = deps;

    async function trimOldIssues() {
        const rows = await allQuery(
            "SELECT id FROM stadium_newspaper ORDER BY created_at DESC"
        );
        if (rows.length <= NEWSPAPER_MAX_ISSUES) return;
        for (const row of rows.slice(NEWSPAPER_MAX_ISSUES)) {
            await runQuery("DELETE FROM stadium_newspaper WHERE id = ?", [row.id]);
        }
    }

    async function awardTopXp(topFighters) {
        for (const row of topFighters) {
            if (!row.xpBonus || !row.email) continue;
            const user = await getQuery("SELECT xp FROM users WHERE email = ?", [row.email]);
            if (!user) continue;
            const newXp = normalizeXp((user.xp ?? 0) + row.xpBonus);
            await runQuery("UPDATE users SET xp = ? WHERE email = ?", [newXp, row.email]);
            if (ensureUserLevelMatchesXp) {
                await ensureUserLevelMatchesXp(row.email);
            }
        }
    }

    async function bumpClubRating(winnerClub) {
        if (!winnerClub) return;
        await runQuery(
            `INSERT INTO stadium_club_rating (club, points) VALUES (?, 1)
             ON CONFLICT(club) DO UPDATE SET points = points + 1`,
            [winnerClub]
        );
    }

    async function notifyParticipants(report, emails) {
        if (!recordPlayerEvent) return;
        const summary = `Газета «Третий тайм»: ${report.matchLabel}`;
        for (const email of emails) {
            await recordPlayerEvent(email, {
                kind: "stadium_newspaper",
                summary,
                detail: { issueId: report.issueId, matchId: report.matchId }
            });
        }
    }

    async function deliverMailToParticipants(issueId, report, emails, now) {
        for (const email of emails) {
            const mailId = `mail_${issueId}_${email}`;
            await runQuery(
                `INSERT OR IGNORE INTO mail_messages
                 (id, email, category, subject, body_json, ref_id, created_at)
                 VALUES (?, ?, 'gazeta_third', ?, ?, ?, ?)`,
                [
                    mailId,
                    email,
                    report.matchLabel,
                    JSON.stringify({ issueId, matchId: report.matchId }),
                    issueId,
                    now
                ]
            );
        }
    }

    /** Публикует газету один раз при завершении матча. */
    async function publishThirdHalfIfNeeded(match) {
        if (match.status !== "ended") return false;
        match.meta = match.meta || {};
        if (match.meta.thirdHalfPublished) return false;

        const existing = await getQuery("SELECT id FROM stadium_newspaper WHERE match_id = ?", [match.id]);
        if (existing) {
            match.meta.thirdHalfPublished = true;
            match.meta.thirdHalfIssueId = existing.id;
            return false;
        }

        stadiumEngine.rebuildMatchStatsIfMissing(match);

        const report = buildThirdHalfReport(match);
        const issueId = `th_${match.id}`;
        const now = report.endedAt;
        report.issueId = issueId;

        await runQuery(
            `INSERT INTO stadium_newspaper (id, match_id, level, report_json, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [issueId, match.id, match.level, JSON.stringify(report), now]
        );
        await trimOldIssues();
        await bumpClubRating(report.winnerClub);
        await awardTopXp(report.topFighters);

        const participants = await collectParticipantEmails(match, allQuery, hasTicket);
        await deliverMailToParticipants(issueId, report, participants, now);
        await notifyParticipants(report, participants);

        match.meta.thirdHalfPublished = true;
        match.meta.thirdHalfIssueId = issueId;
        return true;
    }

    return { publishThirdHalfIfNeeded, buildThirdHalfReport, NEWSPAPER_MAX_ISSUES };
}

module.exports = {
    REP_ICON,
    HP_ICON,
    NEWSPAPER_MAX_ISSUES,
    buildThirdHalfReport,
    createNewspaperPublisher
};
