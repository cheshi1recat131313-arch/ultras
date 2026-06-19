/**
 * Персистентность матчей стадиона (SQLite).
 */

const clubCharacters = require("./club-characters");
const stadiumEngine = require("./stadium-engine");
const stadiumBots = require("./stadium-bots");
const stadiumTickets = require("./stadium-tickets");
const clubsData = require("./clubs-data");
const talismansMod = require("./talismans");
const purchaseLogic = require("./purchase-logic");
const provisionsData = require("./provisions-data");
const stadiumNewspaper = require("./stadium-newspaper");
const xpLevels = require("./xp-levels");
const stadiumChampionship = require("./stadium-championship");
const gameTime = require("./game-time");
const { createMutex } = require("./core/async-mutex");

/** Как в server.js / шапке профиля (evil.png). */
const RAGE_BASE = 100;
const MAX_RAGE = 150;
/** Ярость игрока на live-матче: +1 в секунду (как у ботов на поле). */
const STADIUM_RAGE_PER_SEC = 1;

function parseJson(value, fallback) {
    try {
        const parsed = value ? JSON.parse(value) : fallback;
        return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
        return fallback;
    }
}

/** Ярость из БД — как в шапке (evil.png): 0…MAX, без искусственного пола 100. */
function rageFromDb(value) {
    if (value == null || !Number.isFinite(Number(value))) return RAGE_BASE;
    return Math.max(0, Math.min(MAX_RAGE, Math.round(Number(value))));
}

function createStadiumService({
    runQuery,
    getQuery,
    allQuery,
    runTransaction,
    recordPlayerEvent,
    grantStatPointsForLevelDelta,
    ensureUserLevelMatchesXp,
    grantPlayerReputation,
    getEffectiveStats
}) {
    const tickMutex = createMutex();
    const matchLocks = new Map();

    function withMatchLock(matchId, fn) {
        const key = String(matchId || "");
        if (!matchLocks.has(key)) {
            matchLocks.set(key, createMutex());
        }
        return matchLocks.get(key).runExclusive(fn);
    }

    async function updateMatchMeta(match) {
        await runQuery("UPDATE stadium_matches SET meta_json = ? WHERE id = ?", [
            JSON.stringify(match.meta || {}),
            match.id
        ]);
    }
    const newspaper = stadiumNewspaper.createNewspaperPublisher({
        runQuery,
        getQuery,
        allQuery,
        hasTicket: stadiumTickets.hasTicket,
        normalizeXp: xpLevels.normalizeXp,
        levelFromXp: xpLevels.levelFromXp,
        grantStatPointsForLevelDelta:
            grantStatPointsForLevelDelta ||
            (async function noopGrantStatPoints() {}),
        ensureUserLevelMatchesXp,
        recordPlayerEvent
    });
    async function flushPendingRageUpdates(match) {
        const pending = match?.meta?.pendingRageUpdates;
        if (!pending || typeof pending !== "object") return;
        for (const [email, rage] of Object.entries(pending)) {
            await runQuery("UPDATE users SET rage = ? WHERE email = ?", [
                rageFromDb(rage),
                String(email).toLowerCase()
            ]);
        }
        delete match.meta.pendingRageUpdates;
    }

    async function syncPlayerFightersToDb(match) {
        if (!match?.fighters?.length) return;
        await flushPendingRageUpdates(match);
        for (const f of match.fighters) {
            if (!f.email) continue;
            await runQuery("UPDATE users SET hp = ? WHERE email = ?", [
                Math.max(0, Math.round(f.hp)),
                String(f.email).toLowerCase()
            ]);
        }
    }

    async function applyPlayerRageRegen(email, match) {
        const row = await getQuery("SELECT rage FROM users WHERE email = ?", [email]);
        if (!row || match.status !== "live") {
            return rageFromDb(row?.rage ?? RAGE_BASE);
        }
        match.meta = match.meta || {};
        match.meta.playerRageTick = match.meta.playerRageTick || {};
        const key = String(email).toLowerCase();
        const now = Date.now();
        const last = match.meta.playerRageTick[key] || match.meta.lastTickAt || now;
        const ticks = Math.floor((now - last) / 1000);
        if (ticks < 1) return rageFromDb(row.rage);

        let rage = rageFromDb(row.rage) + ticks * STADIUM_RAGE_PER_SEC;
        match.meta.playerRageTick[key] = last + ticks * 1000;
        await runQuery("UPDATE users SET rage = ? WHERE email = ?", [rage, email]);
        return rage;
    }

    async function loadMatchRegistrants(match) {
        const rows = await allQuery("SELECT * FROM users WHERE club IN (?, ?)", [
            match.homeClub,
            match.awayClub
        ]);
        return rows.filter((row) => stadiumTickets.hasTicket(row, match.id));
    }

    async function syncMatchRosterFromDb(match) {
        if (match.status !== "scheduled") return 0;
        const registrants = await loadMatchRegistrants(match);
        for (const user of registrants) {
            if (!user.avatar && user.character) {
                user.avatar = clubCharacters.avatarPathForCharacter(user.character);
            }
        }
        if (typeof getEffectiveStats === "function") {
            stadiumEngine.syncMatchRoster(match, registrants, getEffectiveStats);
        } else {
            stadiumEngine.syncMatchRoster(match, registrants, null);
        }
        return registrants.length;
    }

    async function getMatchParticipantsCount(match) {
        const registrants = await loadMatchRegistrants(match);
        return stadiumEngine.countRegisteredParticipants(registrants);
    }

    function matchStatusLabel(match, now = Date.now()) {
        if (match.status === "ended") return "Завершён";
        if (match.status === "live" || now >= match.startsAt) return "Идёт матч";
        return "Ожидание";
    }

    async function listWeekMatches({ club = null, limit = stadiumChampionship.CHAMPIONSHIP_WEEK_MATCH_LIMIT } = {}) {
        const season = stadiumChampionship.CHAMPIONSHIP_SEASON_ID;
        const rows = await allQuery(
            `SELECT * FROM stadium_matches
             WHERE meta_json LIKE ?
             ORDER BY starts_at ASC`,
            [`%"championshipSeason":"${season}"%`]
        );
        const now = Date.now();
        const cap = Math.max(1, Math.min(20, Math.floor(limit) || stadiumChampionship.CHAMPIONSHIP_WEEK_MATCH_LIMIT));
        const list = [];
        for (const row of rows) {
            const match = stadiumEngine.parseMatchRow(row);
            if (!match) continue;
            if (club && match.homeClub !== club && match.awayClub !== club) continue;
            if (match.status === "ended" || match.endsAt <= now) continue;
            if (match.status === "scheduled" && now >= match.startsAt) {
                stadiumEngine.tickMatch(match, now);
                if (match.status === "ended") continue;
            }
            list.push(match);
            if (list.length >= cap) break;
        }
        return list;
    }

    async function buildKassaMatchItem(match, user, now = Date.now()) {
        await syncMatchRosterFromDb(match);
        const playerClub = user?.club;
        const inMatch = !!(playerClub && (playerClub === match.homeClub || playerClub === match.awayClub));
        const hasTicket = stadiumTickets.hasTicket(user, match.id);
        const userLevel = Math.max(1, Math.floor(Number(user.level) || 1));
        const canBuyByLevel = userLevel >= 2;
        const participantsRegistered = await getMatchParticipantsCount(match);
        return {
            matchId: match.id,
            homeClubName: match.homeClubName,
            awayClubName: match.awayClubName,
            homeEmblem: clubsData.getClubEmblem(match.homeClub),
            awayEmblem: clubsData.getClubEmblem(match.awayClub),
            startsAt: match.startsAt,
            startsAtLabel: gameTime.formatGameDateTime(match.startsAt),
            ticketCost: stadiumTickets.TICKET_COST,
            hasTicket,
            canBuy:
                canBuyByLevel &&
                inMatch &&
                !hasTicket &&
                match.status === "scheduled" &&
                now < match.startsAt,
            buyBlockedReason: !canBuyByLevel ? "Покупка билетов доступна со 2 уровня." : null,
            status: match.status,
            statusLabel: matchStatusLabel(match, now),
            participantsRegistered,
            participantsMax: stadiumEngine.STADIUM_MATCH_MAX_PARTICIPANTS
        };
    }

    async function buildScheduleListItem(match, user, now = Date.now()) {
        const participantsRegistered = await getMatchParticipantsCount(match);
        const playerClub = user?.club;
        return {
            matchId: match.id,
            homeClubName: match.homeClubName,
            awayClubName: match.awayClubName,
            homeEmblem: clubsData.getClubEmblem(match.homeClub),
            awayEmblem: clubsData.getClubEmblem(match.awayClub),
            startsAt: match.startsAt,
            startsAtLabel: gameTime.formatGameDateTime(match.startsAt),
            status: match.status,
            statusLabel: matchStatusLabel(match, now),
            participantsRegistered,
            participantsMax: stadiumEngine.STADIUM_MATCH_MAX_PARTICIPANTS,
            playerCanJoin:
                !!playerClub && (playerClub === match.homeClub || playerClub === match.awayClub),
            hasTicket: user ? stadiumTickets.hasTicket(user, match.id) : false,
            scoreHome: match.scoreHome,
            scoreAway: match.scoreAway
        };
    }

    async function listScheduleWeek(user) {
        const matches = await listWeekMatches();
        const now = Date.now();
        const items = [];
        for (const match of matches) {
            items.push(await buildScheduleListItem(match, user, now));
        }
        return {
            ok: true,
            scheduleLabel: stadiumChampionship.SCHEDULE_LABEL,
            matches: items
        };
    }

    async function countChampionshipMatchesNext7Days(now = Date.now()) {
        const season = stadiumChampionship.CHAMPIONSHIP_SEASON_ID;
        const until = now + 7 * 24 * 60 * 60 * 1000;
        const row = await getQuery(
            `SELECT COUNT(*) AS c FROM stadium_matches
             WHERE meta_json LIKE ?
               AND status IN ('scheduled', 'live')
               AND starts_at >= ?
               AND starts_at <= ?`,
            [`%"championshipSeason":"${season}"%`, now, until]
        );
        return Math.max(0, Math.floor(Number(row?.c) || 0));
    }

    function isMatchLiveNow(match) {
        const now = Date.now();
        return match.status === "live" || (match.status === "scheduled" && now >= match.startsAt);
    }

    /** Синхронизация ярости игрока на live-матче (для опроса шапки раз в секунду). */
    async function syncPlayerRageForLiveMatch(email, user) {
        if (!user?.club) return;
        const match = await findActiveMatchForClub(user.club);
        if (!match || match.status !== "live") return;
        await withMatchLock(match.id, async () => {
            await applyPlayerRageRegen(email, match);
            await updateMatchMeta(match);
        });
    }

    async function getHomeStatus(user) {
        if (!user?.club) {
            return { showTribunesAlert: false };
        }
        const match = await findActiveMatchForClub(user.club);
        if (!match) return { showTribunesAlert: false };
        const hasTicket = stadiumTickets.hasTicket(user, match.id);
        const now = Date.now();
        const live =
            match.status === "live" ||
            (match.status === "scheduled" && now >= match.startsAt);
        const email = String(user.email || "").toLowerCase();
        const playerFighter = match.fighters.find((f) => f.email === email);
        const playerAlive = !playerFighter || playerFighter.alive;
        return {
            showTribunesAlert: !!(hasTicket && live && playerAlive),
            matchId: match.id,
            matchVs: `${match.homeClubName} vs ${match.awayClubName}`
        };
    }
    async function persistMatchRow(match, published) {
        const r = stadiumEngine.rowFromMatch(match);
        const params = [
            r.id,
            r.level,
            r.home_club,
            r.away_club,
            r.status,
            r.starts_at,
            r.ends_at,
            r.score_home,
            r.score_away,
            r.fighters_json,
            r.feed_json,
            r.meta_json,
            match.createdAt || Date.now()
        ];
        const insertSql = `INSERT OR REPLACE INTO stadium_matches
             (id, level, home_club, away_club, status, starts_at, ends_at, score_home, score_away, fighters_json, feed_json, meta_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        if (runTransaction) {
            await runTransaction(async (tx) => {
                await tx.runQuery(insertSql, params);
                if (published) {
                    await tx.runQuery("UPDATE stadium_matches SET meta_json = ? WHERE id = ?", [
                        JSON.stringify(match.meta || {}),
                        match.id
                    ]);
                }
            });
            return;
        }

        await runQuery(insertSql, params);
        if (published) {
            await runQuery("UPDATE stadium_matches SET meta_json = ? WHERE id = ?", [
                JSON.stringify(match.meta || {}),
                match.id
            ]);
        }
    }

    async function saveMatchUnsafe(match) {
        const published = await newspaper.publishThirdHalfIfNeeded(match);
        await persistMatchRow(match, published);
    }

    async function saveMatch(match) {
        return withMatchLock(match.id, () => saveMatchUnsafe(match));
    }

    async function loadMatch(id) {
        const row = await getQuery("SELECT * FROM stadium_matches WHERE id = ?", [id]);
        return stadiumEngine.parseMatchRow(row);
    }

    async function findActiveMatchForClub(playerClub) {
        if (playerClub) {
            const row = await getQuery(
                `SELECT * FROM stadium_matches
                 WHERE status IN ('scheduled', 'live')
                   AND (home_club = ? OR away_club = ?)
                 ORDER BY CASE WHEN status = 'live' THEN 0 ELSE 1 END, starts_at ASC
                 LIMIT 1`,
                [playerClub, playerClub]
            );
            if (row) return stadiumEngine.parseMatchRow(row);
        }
        const row = await getQuery(
            `SELECT * FROM stadium_matches
             WHERE status IN ('scheduled', 'live')
             ORDER BY CASE WHEN status = 'live' THEN 0 ELSE 1 END, starts_at ASC
             LIMIT 1`
        );
        return stadiumEngine.parseMatchRow(row);
    }

    async function getOrCreateMatchForLevel(level, playerClub) {
        const lv = Math.max(1, Math.min(50, Math.floor(level)));
        let match = await findActiveMatchForClub(playerClub);
        const now = Date.now();

        if (match) {
            if (match.status === "scheduled") {
                await syncMatchRosterFromDb(match);
            }
            if (!(match.status === "scheduled" && now < match.startsAt)) {
                stadiumEngine.tickMatch(match, now);
            }
            await saveMatch(match);
            return match;
        }

        const startsAt = stadiumEngine.nextMatchStartMs(now);
        let homeClub;
        let awayClub;
        if (stadiumEngine.STADIUM_TEST_MODE) {
            homeClub = stadiumEngine.STADIUM_TEST_HOME_CLUB;
            awayClub = stadiumEngine.STADIUM_TEST_AWAY_CLUB;
        } else if (playerClub && stadiumBots.listStadiumClubIds().includes(playerClub)) {
            homeClub = playerClub;
            const rivals = stadiumBots.listStadiumClubIds().filter((c) => c !== playerClub);
            awayClub = rivals[Math.floor(Math.random() * rivals.length)] || "sparta";
        } else {
            [homeClub, awayClub] = stadiumBots.pickMatchClubs(null);
        }
        match = stadiumEngine.createMatch(lv, homeClub, awayClub, startsAt);
        match.createdAt = now;
        await saveMatch(match);
        return match;
    }

    async function sanitizeScheduledMatches() {
        if (!stadiumEngine.STADIUM_TEST_MODE) {
            /** Production: матчи читаются из stadium_matches as-is; рестарт не трогает расписание. */
            return;
        }

        const rows = await allQuery(
            `SELECT * FROM stadium_matches WHERE status IN ('scheduled', 'live')`
        );
        const now = Date.now();
        for (const row of rows) {
            const match = stadiumEngine.parseMatchRow(row);
            if (!match) continue;

            if (match.status === "scheduled") {
                const start = stadiumEngine.testMatchStartMs(now);
                const home = stadiumEngine.STADIUM_TEST_HOME_CLUB;
                const away = stadiumEngine.STADIUM_TEST_AWAY_CLUB;
                const clubsChanged = match.homeClub !== home || match.awayClub !== away;
                match.homeClub = home;
                match.awayClub = away;
                match.homeClubName = clubsData.getClubName(home) || home;
                match.awayClubName = clubsData.getClubName(away) || away;
                match.startsAt = start;
                match.endsAt = start + stadiumEngine.STADIUM_MATCH_DURATION_MS;
                if (clubsChanged) {
                    match.fighters = stadiumEngine.initFighters(home, away);
                }
                match.feed = [];
                match.scoreHome = 0;
                match.scoreAway = 0;
                match.meta = { lastTickAt: now, lastBotAt: 0 };
                await saveMatch(match);
            }
        }
    }

    async function processAllLiveMatches() {
        return tickMutex.runExclusive(async () => {
            const now = Date.now();
            const rows = await allQuery(
                `SELECT * FROM stadium_matches WHERE status IN ('live', 'scheduled')`
            );
            for (const row of rows) {
                const match = stadiumEngine.parseMatchRow(row);
                if (!match) continue;
                await withMatchLock(match.id, async () => {
                    if (match.status === "scheduled" && now < match.startsAt) {
                        await syncMatchRosterFromDb(match);
                        await saveMatchUnsafe(match);
                        return;
                    }
                    if (match.status === "scheduled" && now >= match.startsAt) {
                        await syncMatchRosterFromDb(match);
                    }
                    stadiumEngine.tickMatch(match, now);
                    await syncPlayerFightersToDb(match);
                    await saveMatchUnsafe(match);
                });
            }
        });
    }

    async function joinMatch(matchId, user, stats) {
        return withMatchLock(matchId, async () => {
            const match = await loadMatch(matchId);
            if (!match) return { ok: false, error: "Матч не найден." };
            if (!stadiumTickets.hasTicket(user, matchId)) {
                return { ok: false, error: "Нужен билет — купи в кассе стадиона." };
            }
            const fighter = stadiumEngine.ensurePlayerFighter(match, user, stats);
            if (!fighter) {
                return { ok: false, error: "Твой клуб не участвует в этом матче." };
            }
            stadiumEngine.syncPlayerFighterFromUser(fighter, user);
            const rage = rageFromDb(user.rage);
            fighter.fury = rage;
            await saveMatchUnsafe(match);
            return { ok: true, fighter };
        });
    }

    async function refreshTribuneOpponents(matchId, user) {
        return withMatchLock(matchId, async () => {
            const match = await loadMatch(matchId);
            if (!match) return { ok: false, error: "Матч не найден." };
            const email = user?.email;
            const playerFighter = email ? match.fighters.find((f) => f.email === email) : null;
            if (playerFighter && !playerFighter.alive) {
                return { ok: false, error: "Ты выбыл из боя." };
            }
            const enemyClub = stadiumBots.enemyClubForPlayer(user.club, match.homeClub, match.awayClub);
            if (!enemyClub) return { ok: false, error: "Твой клуб не в этом матче." };
            const opponents = stadiumEngine.pickOpponentsForPlayer(
                match,
                user.level ?? 1,
                enemyClub,
                user.email,
                true
            );
            await saveMatchUnsafe(match);
            return { ok: true, opponents };
        });
    }

    async function playerAttack(matchId, user, stats, targetId, attackType, attackOpts = {}) {
        return withMatchLock(matchId, async () => {
        const match = await loadMatch(matchId);
        if (!match) return { ok: false, error: "Матч не найден." };
        if (match.status !== "live") {
            return { ok: false, error: "Матч ещё не начался или уже завершён." };
        }
        if (!stadiumTickets.hasTicket(user, matchId)) {
            return { ok: false, error: "Нужен билет — купи в кассе стадиона." };
        }

        const email = user.email;
        stadiumEngine.tickMatch(match, Date.now());
        await applyPlayerRageRegen(email, match);

        let playerFighter = match.fighters.find((f) => f.email === email);
        if (!playerFighter) {
            playerFighter = stadiumEngine.ensurePlayerFighter(match, user, stats);
        }
        if (!playerFighter) {
            return { ok: false, error: "Сначала зайди в фан-сектор." };
        }
        if (!playerFighter.alive) {
            return { ok: false, error: "Ты выбыл из боя." };
        }

        const freshRow = await getQuery(
            "SELECT rage, consumables, consumables_used_at, hp, max_hp FROM users WHERE email = ?",
            [email]
        );
        let userRage = rageFromDb(freshRow?.rage);
        playerFighter.fury = userRage;
        stadiumEngine.syncPlayerFighterFromUser(playerFighter, {
            ...user,
            hp: freshRow?.hp,
            max_hp: freshRow?.max_hp
        });

        let gadgetUsed = null;
        let consumables = parseJson(freshRow?.consumables, {});
        let consumablesUsedAt = provisionsData.parseConsumablesUsedAtRaw(freshRow?.consumables_used_at);
        const battleNow = Date.now();
        const gadgetId = String(attackOpts.gadgetId || "").trim();

        function rollbackGadget() {
            if (!gadgetId) return;
            consumables[gadgetId] = (consumables[gadgetId] || 0) + 1;
        }

        if (gadgetId) {
            const spent = provisionsData.beginProvisionBattleUse(
                consumables,
                consumablesUsedAt,
                gadgetId,
                battleNow
            );
            if (!spent.ok) return { ok: false, error: spent.error };
            consumables = spent.consumables;
            gadgetUsed = spent.gadgetUsed;
            if (spent.def.furySetTo != null) {
                userRage = Math.max(0, Math.floor(Number(spent.def.furySetTo) || 0));
                playerFighter.fury = userRage;
                await runQuery("UPDATE users SET rage = ? WHERE email = ?", [userRage, email]);
            } else if (spent.def.furyRestore) {
                userRage = Math.min(150, userRage + spent.def.furyRestore);
                playerFighter.fury = userRage;
                await runQuery("UPDATE users SET rage = ? WHERE email = ?", [userRage, email]);
            }
            if (spent.def.healHp) {
                const maxHp = playerFighter.maxHp || 100;
                const newHp = Math.min(maxHp, (playerFighter.hp || 0) + spent.def.healHp);
                playerFighter.hp = newHp;
                playerFighter.alive = newHp > 0;
                await runQuery("UPDATE users SET hp = ? WHERE email = ?", [newHp, email]);
            }
        }

        const enemyClub = stadiumBots.enemyClubForPlayer(user.club, match.homeClub, match.awayClub);
        if (!enemyClub) {
            rollbackGadget();
            return { ok: false, error: "Твой клуб не участвует в этом матче." };
        }
        const target = stadiumEngine.findFighter(match, targetId);
        if (!target || !target.alive || target.club !== enemyClub) {
            rollbackGadget();
            return { ok: false, error: "Неверная цель." };
        }

        const furyCost =
            attackType === "strong"
                ? stadiumEngine.STADIUM_FURY_STRONG
                : stadiumEngine.STADIUM_FURY_NORMAL;
        if (userRage < furyCost) {
            rollbackGadget();
            return { ok: false, error: "Недостаточно ярости" };
        }

        const talismansRaw = talismansMod.resolveOwnedRaw(user);

        const result = stadiumEngine.strike(playerFighter, target, attackType, {
            userRage,
            defenderRage: target.email ? rageFromDb((await getQuery("SELECT rage FROM users WHERE email = ?", [String(target.email).toLowerCase()]))?.rage) : undefined,
            attackerTalismans: talismansRaw,
            defenderTalismans: target.talismansRaw || "{}",
            combatMode: talismansMod.MODES.STADIUM,
            dmgMult: 1,
            match,
            now: battleNow
        });
        if (!result.ok) {
            rollbackGadget();
            return result;
        }

        if (gadgetId) {
            consumablesUsedAt = provisionsData.stampProvisionUsed(consumablesUsedAt, gadgetId, battleNow);
            await runQuery("UPDATE users SET consumables = ?, consumables_used_at = ? WHERE email = ?", [
                JSON.stringify(consumables),
                JSON.stringify(consumablesUsedAt),
                email
            ]);
        }

        if (result.newFury != null) {
            await runQuery("UPDATE users SET rage = ? WHERE email = ?", [result.newFury, email]);
            playerFighter.fury = result.newFury;
        }
        if (result.defenderNewRage != null && target.email) {
            await runQuery("UPDATE users SET rage = ? WHERE email = ?", [
                result.defenderNewRage,
                String(target.email).toLowerCase()
            ]);
            target.fury = result.defenderNewRage;
            if (match.meta?.pendingRageUpdates) {
                delete match.meta.pendingRageUpdates[String(target.email).toLowerCase()];
            }
        }
        await runQuery("UPDATE users SET hp = ? WHERE email = ?", [
            Math.max(0, Math.round(playerFighter.hp)),
            email
        ]);
        let repGain = 0;
        let mercedesBoost = false;
        if (result.rep > 0 && grantPlayerReputation) {
            const grant = await grantPlayerReputation({
                email,
                baseRep: result.rep,
                source: "stadium",
                club: user.club,
                prevReputation: user.reputation ?? 0,
                talismansRaw: talismansRaw
            });
            repGain = grant.repGain || 0;
            mercedesBoost = !!grant.mercedesBoost;
        }

        const repEarned = repGain;
        const feedResult = {
            ...result,
            repEarned,
            mercedesBoost,
            gadgetUsed
        };
        stadiumEngine.recordStrike(match, playerFighter, target, feedResult);
        if (target.email) {
            await runQuery("UPDATE users SET hp = ? WHERE email = ?", [
                Math.max(0, Math.round(target.hp)),
                target.email
            ]);
        }
        stadiumEngine.checkMatchEnd(match);
        await syncPlayerFightersToDb(match);
        await saveMatchUnsafe(match);

        return {
            ok: true,
            result: feedResult,
            repGain,
            matchId: match.id,
            gadgets: provisionsData.catalogOwnedForClient(consumables),
            strikeFlash: {
                targetName: target.name || "противника",
                dmg: feedResult.dmg || 0,
                dodged: !!feedResult.dodgedByNeo,
                knockout: !!feedResult.knockout,
                spring: !!feedResult.springTriggered
            }
        };
        });
    }

    function enrichMatchPayload(payload, match, user) {
        const playerClub = user?.club;
        payload.hasTicket = user ? stadiumTickets.hasTicket(user, match.id) : false;
        payload.ticketCost = stadiumTickets.TICKET_COST;
        payload.playerCanJoin =
            !!playerClub && (playerClub === match.homeClub || playerClub === match.awayClub);
        const hoursLabel = stadiumEngine.STADIUM_MATCH_HOURS.map((h) =>
            `${String(h).padStart(2, "0")}:00`
        ).join(" · ");
        payload.scheduleLabel = stadiumEngine.STADIUM_TEST_MODE
            ? "23:00 (тест: Горняки — Динамовцы)"
            : hoursLabel;
        payload.matchLive = isMatchLiveNow(match) && match.status === "live";
        if (match.status === "ended") {
            payload.thirdHalfIssueId = match.meta?.thirdHalfIssueId || `th_${match.id}`;
        }
        return payload;
    }

    async function buildScheduleResponse(match, user, stats) {
        const email = user?.email;
        const playerClub = user?.club;
        let playerFighter = null;
        let playerRage = rageFromDb(user?.rage);
        const participantsRegistered = await syncMatchRosterFromDb(match);

        if (email && playerClub && stadiumTickets.hasTicket(user, match.id)) {
            playerFighter = match.fighters.find((f) => f.email === email) || null;
            if (!playerFighter) {
                playerFighter = stadiumEngine.ensurePlayerFighter(match, user, stats);
            }
            if (playerFighter) {
                if (match.status === "live") {
                    playerRage = await applyPlayerRageRegen(email, match);
                    playerFighter.fury = playerRage;
                } else {
                    stadiumEngine.syncPlayerFighterFromUser(playerFighter, user);
                }
            }
        }

        const enemyClub = playerClub
            ? stadiumBots.enemyClubForPlayer(playerClub, match.homeClub, match.awayClub)
            : null;

        const payload = stadiumEngine.matchPayload(match, {
            playerFighter,
            playerInMatch: !!playerFighter,
            playerCanJoin:
                !!playerClub && (playerClub === match.homeClub || playerClub === match.awayClub),
            opponents: [],
            playerRage,
            enemyClub,
            participantsRegistered
        });
        if (match.status === "scheduled") {
            await saveMatch(match);
        }
        return enrichMatchPayload(payload, match, user);
    }

    async function buildTribunesPayload(match, user, stats, extra = {}) {
        if (match.status === "scheduled") {
            await syncMatchRosterFromDb(match);
        }
        const email = user?.email;
        const playerClub = user?.club;
        let playerRage = rageFromDb(user?.rage);
        if (email && match.status === "live") {
            playerRage = await applyPlayerRageRegen(email, match);
        }

        let playerFighter =
            extra.playerFighter ||
            match.fighters.find((f) => f.email === email) ||
            null;
        if (!playerFighter && email && playerClub) {
            playerFighter = stadiumEngine.ensurePlayerFighter(match, user, stats);
        }
        if (playerFighter) {
            if (match.status !== "live") {
                stadiumEngine.syncPlayerFighterFromUser(playerFighter, user);
            }
            playerFighter.fury = playerRage;
        }

        const playerEliminated = !!(playerFighter && !playerFighter.alive);
        const enemyClub = playerClub
            ? stadiumBots.enemyClubForPlayer(playerClub, match.homeClub, match.awayClub)
            : null;
        let opponents =
            playerFighter && !playerEliminated && enemyClub && match.status === "live"
                ? stadiumEngine.pickOpponentsForPlayer(
                      match,
                      user.level ?? 1,
                      enemyClub,
                      email,
                      false
                  )
                : [];

        const focusId = String(extra.focusTargetId || "").trim();
        if (focusId && enemyClub && !playerEliminated) {
            const focused = stadiumEngine.findFighter(match, focusId);
            if (focused && focused.alive && focused.club === enemyClub) {
                opponents = [focused];
                match.meta = match.meta || {};
                match.meta.opponentSlots = match.meta.opponentSlots || {};
                match.meta.opponentSlots[String(email).toLowerCase()] = [focused.id];
            }
        }

        const payload = stadiumEngine.matchPayload(match, {
            playerFighter,
            playerInMatch: !!playerFighter,
            playerCanJoin:
                !!playerClub && (playerClub === match.homeClub || playerClub === match.awayClub),
            opponents,
            playerRage,
            enemyClub,
            participantsRegistered: await getMatchParticipantsCount(match)
        });
        return enrichMatchPayload(payload, match, user);
    }

    function buildMatchResponse(match, user, stats, extra = {}) {
        return buildScheduleResponse(match, user, stats);
    }

    async function getKassaInfo(user) {
        if (!user?.club) {
            return { ok: false, error: "Сначала выбери клуб." };
        }
        const clubName = clubsData.getClubName(user.club) || user.club;
        const weekMatches = await listWeekMatches({ club: user.club });
        if (!weekMatches.length) {
            return { ok: false, error: "Нет матча твоего клуба." };
        }
        const now = Date.now();
        const matches = [];
        for (const match of weekMatches) {
            await saveMatch(match);
            matches.push(await buildKassaMatchItem(match, user, now));
        }
        return {
            ok: true,
            clubName,
            ticketLabel: `Билеты на матчи ${clubName}`,
            ticketCost: stadiumTickets.TICKET_COST,
            matches
        };
    }

    async function buyTicket(email, user, matchId = null) {
        if (!user?.club) {
            return { ok: false, error: "Сначала выбери клуб." };
        }
        const userLevel = Math.max(1, Math.floor(Number(user.level) || 1));
        if (userLevel < 2) {
            return { ok: false, error: "Покупка билетов доступна со 2 уровня." };
        }
        let match;
        if (matchId) {
            match = await loadMatch(matchId);
            if (!match) {
                return { ok: false, error: "Матч не найден." };
            }
        } else {
            const level = Math.max(1, user.level ?? 1);
            match = await getOrCreateMatchForLevel(level, user.club);
            if (!match) {
                return { ok: false, error: "Нет матча твоего клуба." };
            }
        }
        if (user.club !== match.homeClub && user.club !== match.awayClub) {
            return { ok: false, error: "Нельзя купить билет на чужой матч." };
        }
        if (stadiumTickets.hasTicket(user, match.id)) {
            return { ok: false, error: "Билет на этот матч уже есть." };
        }
        const now = Date.now();
        if (match.status !== "scheduled" || now >= match.startsAt) {
            return { ok: false, error: "Покупка билетов на этот матч закрыта." };
        }
        const dollars = Math.max(0, Math.floor(user.dollars ?? 0));
        const cost = stadiumTickets.TICKET_COST;
        if (dollars < cost) {
            return {
                ok: false,
                error: purchaseLogic.dualCurrencyLackError(dollars, 0, cost, 0)
            };
        }
        const tickets = stadiumTickets.grantTicket(stadiumTickets.parseTickets(user.stadium_tickets), match.id);
        await runQuery("UPDATE users SET dollars = ?, stadium_tickets = ? WHERE email = ?", [
            dollars - cost,
            JSON.stringify(tickets),
            email
        ]);
        await syncMatchRosterFromDb(match);
        await saveMatch(match);
        return { ok: true, matchId: match.id, cost };
    }

    function buildBestFighters(match, user, page = 1) {
        return stadiumEngine.buildBestFightersPayload(match, user?.email, page);
    }

    const GAZETA_PER_PAGE = 10;

    async function listNewspaperIssues(page = 1) {
        const p = Math.max(1, Math.floor(page));
        const perPage = GAZETA_PER_PAGE;
        const offset = (p - 1) * perPage;
        const totalRow = await getQuery("SELECT COUNT(*) AS c FROM stadium_newspaper");
        const total = totalRow?.c ?? 0;
        const totalPages = Math.max(1, Math.ceil(total / perPage));
        const rows = await allQuery(
            `SELECT id, match_id, level, created_at, report_json FROM stadium_newspaper
             ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [perPage, offset]
        );
        const issues = rows.map((row) => {
            let report = {};
            try {
                report = JSON.parse(row.report_json || "{}");
            } catch {
                report = {};
            }
            return {
                id: row.id,
                matchId: row.match_id,
                level: row.level,
                createdAt: row.created_at,
                matchLabel: report.matchLabel || "",
                datetime: report.datetime || "",
                winnerClubName: report.winnerClubName || ""
            };
        });
        return { issues, page: p, totalPages, total, perPage };
    }

    async function getNewspaperIssue(issueId) {
        const row = await getQuery("SELECT * FROM stadium_newspaper WHERE id = ?", [issueId]);
        if (!row) return null;
        try {
            return JSON.parse(row.report_json || "{}");
        } catch {
            return null;
        }
    }

    return {
        saveMatch,
        loadMatch,
        buildBestFighters,
        listNewspaperIssues,
        getNewspaperIssue,
        findActiveMatchForClub,
        getOrCreateMatchForLevel,
        sanitizeScheduledMatches,
        processAllLiveMatches,
        syncPlayerFightersToDb,
        joinMatch,
        buildMatchResponse,
        buildScheduleResponse,
        buildTribunesPayload,
        getHomeStatus,
        refreshTribuneOpponents,
        applyPlayerRageRegen,
        syncPlayerRageForLiveMatch,
        getKassaInfo,
        buyTicket,
        listScheduleWeek,
        countChampionshipMatchesNext7Days,
        playerAttack
    };
}

module.exports = { createStadiumService };
