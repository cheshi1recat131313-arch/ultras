/**
 * Матчи стадиона: расписание, ярость, урон (calcStadiumDamage + усталость при HP ≤ 30).
 */

const fightSsr = require("./fight-ssr");
const gameTime = require("./game-time");
const clubsData = require("./clubs-data");
const clubCharacters = require("./club-characters");
const stadiumBots = require("./stadium-bots");
const talismanEffects = require("./talisman-effects");
const talismansCatalog = require("./talismans");

const STADIUM_FURY_MAX = 150;
/** +5 к ярости в шапке, когда игрока ударили (БМ / стадион). */
const STADIUM_RAGE_ON_HIT = 5;
/** +1 ярости в секунду (боты на матче). */
const STADIUM_FURY_REGEN = 1;
const STADIUM_FURY_REGEN_MS = 1000;
const STADIUM_FURY_NORMAL = 60;
const STADIUM_FURY_STRONG = 100;
/** Усталость: при HP ≤ порога урон × множитель (полсилы). */
const STADIUM_FATIGUE_HP_THRESHOLD = 30;
const STADIUM_FATIGUE_DMG_MULT = 0.5;
const STADIUM_MATCH_DURATION_MS = 18 * 60 * 1000;
const STADIUM_SIDE_SIZE = 10;
const STADIUM_MATCH_MAX_PARTICIPANTS = STADIUM_SIDE_SIZE * 2;
const STADIUM_BOT_TICK_MS = 5500;
const STADIUM_FIGHTER_HP = 100;

function parseEnvBool(value) {
    const s = String(value ?? "").trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes";
}

/** Dev-only: задайте STADIUM_TEST_MODE=1 локально. На production не включать. */
const STADIUM_TEST_MODE = parseEnvBool(process.env.STADIUM_TEST_MODE);
/** Ближайший матч: 12.06.2026 19:00 (Europe/Kyiv). */
const STADIUM_NEAREST_MATCH_AT_MS = Date.parse("2026-06-12T19:00:00+03:00");
const STADIUM_MATCH_HOURS = STADIUM_TEST_MODE ? [19] : [12, 16, 20, 22];
const STADIUM_TEST_HOME_CLUB = "hark";
const STADIUM_TEST_AWAY_CLUB = "dynamo";
const REP_ICON = "🤘";
const MAX_FEED = 200;
/** Серия: второй и следующие удары по той же цели в течение окна — +30% урона. */
const STADIUM_SERIES_WINDOW_MS = 4000;
const STADIUM_SERIES_DMG_MULT = 1.3;

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function clampFury(v) {
    return Math.max(0, Math.min(STADIUM_FURY_MAX, Math.round(v)));
}

function bumpPlayerHeaderRageOnHit(currentRage) {
    return clampFury(Number(currentRage ?? 100) + STADIUM_RAGE_ON_HIT);
}

function queuePlayerRageUpdate(match, email, rage) {
    if (!match || !email || rage == null) return;
    match.meta = match.meta || {};
    match.meta.pendingRageUpdates = match.meta.pendingRageUpdates || {};
    match.meta.pendingRageUpdates[String(email).toLowerCase()] = clampFury(rage);
}

/** ⌊урон / 5⌋ — только полные пятёрки HP. */
function repFromDamage(dmg) {
    return Math.max(0, Math.floor(Math.max(0, dmg) / 5));
}

function dmgInt(dmg) {
    return Math.max(1, Math.round(Number(dmg) || 0));
}

/** Усталость атакующего: только при HP ≤ 30, иначе полный урон. */
function stadiumFatigueMult(attacker) {
    const hp = Math.round(Number(attacker?.hp) || 0);
    return hp <= STADIUM_FATIGUE_HP_THRESHOLD ? STADIUM_FATIGUE_DMG_MULT : 1;
}

function isStadiumFatigued(attacker) {
    return stadiumFatigueMult(attacker) < 1;
}

/** Старт тестового матча: 12.06.2026 19:00 Europe/Kyiv (после — завтра в STADIUM_MATCH_HOURS[0]). */
function testMatchStartMs(now = Date.now()) {
    if (STADIUM_NEAREST_MATCH_AT_MS > now) return STADIUM_NEAREST_MATCH_AT_MS;
    return gameTime.nextKyivSlotAfter(now, STADIUM_MATCH_HOURS[0]);
}

function nextMatchStartMs(now = Date.now()) {
    if (STADIUM_NEAREST_MATCH_AT_MS > now) return STADIUM_NEAREST_MATCH_AT_MS;
    if (STADIUM_TEST_MODE) return testMatchStartMs(now);
    return gameTime.nextKyivSlotAfter(now, STADIUM_MATCH_HOURS);
}

function formatCountdown(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function fighterFromBot(bot, side) {
    return {
        id: bot.id,
        name: bot.name,
        club: bot.club,
        clubName: clubsData.getClubName(bot.club) || bot.club,
        level: bot.level,
        side,
        isBot: true,
        email: null,
        emoji: bot.emoji || "👤",
        character: bot.character || clubCharacters.pickClubCharacter(bot.club, bot.id),
        avatar: bot.avatar || clubCharacters.avatarForClubBot(bot.club, bot.id),
        hp: STADIUM_FIGHTER_HP,
        maxHp: STADIUM_FIGHTER_HP,
        fury: randomInt(STADIUM_FURY_NORMAL, STADIUM_FURY_NORMAL + 25),
        maxFury: STADIUM_FURY_MAX,
        power: bot.power,
        speed: bot.speed,
        intel: bot.intel,
        stamina: bot.stamina,
        alive: true
    };
}

function fighterFromUser(user, stats, side) {
    const eff = stats.effective;
    const maxHp = Math.max(1, Math.floor(Number(user.maxHp ?? user.max_hp) || STADIUM_FIGHTER_HP));
    const hp = Math.min(maxHp, Math.max(0, Math.round(Number(user.hp) ?? maxHp)));
    return {
        id: `player_${user.email}`,
        name: user.name || "Игрок",
        club: user.club,
        clubName: clubsData.getClubName(user.club) || user.club || "",
        level: user.level ?? 1,
        side,
        isBot: false,
        email: user.email,
        emoji: "👤",
        avatar: user.avatar || clubCharacters.avatarPathForCharacter(user.character),
        hp,
        maxHp,
        fury: randomInt(20, 50),
        maxFury: STADIUM_FURY_MAX,
        power: eff.power,
        speed: eff.speed,
        intel: eff.intel,
        stamina: eff.stamina,
        talismansRaw: user.talismansOwned
            ? JSON.stringify(user.talismansOwned)
            : talismansCatalog.resolveOwnedRaw(user),
        alive: hp > 0
    };
}

/** HP игрока на БМ = HP из профиля (шапка ❤️). */
function syncPlayerFighterFromUser(fighter, user) {
    if (!fighter || !user || !fighter.email) return fighter;
    const maxHp = Math.max(1, Math.floor(Number(user.maxHp ?? user.max_hp) || STADIUM_FIGHTER_HP));
    const hp = Math.min(maxHp, Math.max(0, Math.round(Number(user.hp) ?? maxHp)));
    fighter.hp = hp;
    fighter.maxHp = maxHp;
    fighter.alive = hp > 0;
    return fighter;
}

function initFighters(homeClub, awayClub) {
    return syncMatchRoster(
        { homeClub, awayClub, fighters: [], status: "scheduled" },
        [],
        null
    ).fighters;
}

/** 10 на 10: игроки с билетом + боты на свободные места. */
function syncMatchRoster(match, registrants, statsForUser) {
    if (match.status === "ended") return match;

    const existingByEmail = new Map();
    for (const f of match.fighters || []) {
        if (f.email) existingByEmail.set(String(f.email).toLowerCase(), f);
    }

    const homePlayers = [];
    const awayPlayers = [];

    for (const user of registrants || []) {
        const email = String(user.email || "").toLowerCase();
        if (!email) continue;
        let side = null;
        if (user.club === match.homeClub) side = "home";
        else if (user.club === match.awayClub) side = "away";
        else continue;

        const list = side === "home" ? homePlayers : awayPlayers;
        if (list.length >= STADIUM_SIDE_SIZE) continue;

        const stats =
            typeof statsForUser === "function"
                ? statsForUser(user)
                : { effective: { power: 10, speed: 10, intel: 10, stamina: 10 } };
        let fighter = existingByEmail.get(email);
        if (!fighter) {
            fighter = fighterFromUser(user, stats, side);
        } else {
            fighter.side = side;
            fighter.isBot = false;
            syncPlayerFighterFromUser(fighter, user);
        }
        list.push(fighter);
    }

    const homeBotPool = stadiumBots
        .getRoster(match.homeClub)
        .slice(0, STADIUM_SIDE_SIZE - homePlayers.length);
    const awayBotPool = stadiumBots
        .getRoster(match.awayClub)
        .slice(0, STADIUM_SIDE_SIZE - awayPlayers.length);

    match.fighters = [
        ...homePlayers,
        ...homeBotPool.map((b) => fighterFromBot(b, "home")),
        ...awayPlayers,
        ...awayBotPool.map((b) => fighterFromBot(b, "away"))
    ];
    return match;
}

function countRegisteredParticipants(registrants) {
    return Math.min(STADIUM_MATCH_MAX_PARTICIPANTS, (registrants || []).length);
}

function createMatch(level, homeClub, awayClub, startsAt) {
    const now = Date.now();
    const id = `sm_${level}_${now}_${randomInt(1000, 9999)}`;
    return {
        id,
        level: Math.max(1, Math.floor(level)),
        homeClub,
        awayClub,
        homeClubName: clubsData.getClubName(homeClub) || homeClub,
        awayClubName: clubsData.getClubName(awayClub) || awayClub,
        status: startsAt > now ? "scheduled" : "live",
        startsAt,
        endsAt: startsAt + STADIUM_MATCH_DURATION_MS,
        scoreHome: 0,
        scoreAway: 0,
        fighters: initFighters(homeClub, awayClub),
        feed: [],
        meta: { lastTickAt: now, lastBotAt: 0 }
    };
}

function pushFeed(match, entry) {
    const row =
        typeof entry === "string"
            ? { at: Date.now(), text: entry, kind: "sys" }
            : { at: Date.now(), ...entry };
    match.feed.push(row);
    if (match.feed.length > MAX_FEED) {
        match.feed.splice(0, match.feed.length - MAX_FEED);
    }
}

function resetFightersForLive(match) {
    const now = Date.now();
    for (const f of match.fighters) {
        if (f.email) continue;
        f.hp = STADIUM_FIGHTER_HP;
        f.maxHp = STADIUM_FIGHTER_HP;
        f.alive = true;
        f.fury = randomInt(STADIUM_FURY_NORMAL, STADIUM_FURY_NORMAL + 25);
    }
    match.scoreHome = 0;
    match.scoreAway = 0;
    match.feed = [];
    match.meta = {
        lastTickAt: now,
        lastBotAt: 0,
        opponentSlots: {},
        playerRageTick: {},
        matchStats: {},
        lastHitOnTarget: {}
    };
}

function beginLiveMatch(match, now = Date.now()) {
    if (match.status === "live") return;
    resetFightersForLive(match);
    for (const f of match.fighters || []) {
        ensureFighterStatRow(match, f);
    }
    match.status = "live";
    pushFeed(match, {
        kind: "sys",
        text: `Матч начался: ${match.homeClubName} против ${match.awayClubName}.`
    });
}

function aliveFighters(match, side) {
    return match.fighters.filter((f) => f.alive && f.side === side);
}

function findFighter(match, id) {
    const key = String(id || "");
    if (!key) return null;
    return (
        match.fighters.find((f) => f.id === key || (f.email && f.email === key)) || null
    );
}

function defenderSeriesKey(defender) {
    return String(defender?.id || defender?.email || "");
}

function isSeriesBonusActive(match, defender, now = Date.now()) {
    if (!match?.meta || !defender) return false;
    const map = match.meta.lastHitOnTarget || {};
    const last = map[defenderSeriesKey(defender)];
    if (!last) return false;
    return now - last <= STADIUM_SERIES_WINDOW_MS;
}

function markDefenderHit(match, defender, now = Date.now()) {
    if (!match || !defender) return;
    match.meta = match.meta || {};
    match.meta.lastHitOnTarget = match.meta.lastHitOnTarget || {};
    match.meta.lastHitOnTarget[defenderSeriesKey(defender)] = now;
}

function applyFuryRegen(match, now) {
    const last = match.meta.lastTickAt || now;
    const ticks = Math.floor((now - last) / STADIUM_FURY_REGEN_MS);
    if (ticks < 1) return;
    for (const f of match.fighters) {
        if (!f.alive || f.email) continue;
        f.fury = clampFury(f.fury + ticks * STADIUM_FURY_REGEN);
    }
    match.meta.lastTickAt = last + ticks * STADIUM_FURY_REGEN_MS;
}

/** Сила бойца на стадионе: уровень, статы и шмот (power/speed/stamina на fighter). */
function stadiumCombatScore(fighter) {
    const lvl = Math.max(1, Math.floor(Number(fighter.level) || 1));
    const power = fighter.power || 10;
    const speed = fighter.speed || 10;
    const stamina = fighter.stamina || 10;
    return power * 1.15 + speed * 0.35 + stamina * 0.5 + lvl * 4.5;
}

/**
 * Урон с учётом уровня и экипировки: высокий уровень бьёт низкий заметно сильнее, наоборот — слабее.
 */
function calcStadiumDamage(attacker, defender, attackType) {
    const attLvl = Math.max(1, Math.floor(Number(attacker.level) || 1));
    const defLvl = Math.max(1, Math.floor(Number(defender.level) || 1));
    const levelGap = attLvl - defLvl;

    const attScore = stadiumCombatScore(attacker);
    const defScore = Math.max(8, stadiumCombatScore(defender));
    const powerRatio = attScore / defScore;

    let dmg = attackType === "strong" ? randomInt(13, 18) : randomInt(10, 14);
    dmg *= Math.pow(powerRatio, 0.82);

    const levelMult = Math.pow(1.16, levelGap);
    dmg *= Math.max(0.28, Math.min(3.2, levelMult));

    dmg -= (defender.stamina || 10) * 0.07;
    dmg = Math.round(dmg);

    const minHit =
        attackType === "strong"
            ? Math.max(4, Math.floor(3 + attLvl * 0.55))
            : Math.max(3, Math.floor(2 + attLvl * 0.45));
    const maxHit = Math.min(
        Math.max(1, Math.ceil(defender.hp)),
        Math.floor(10 + attLvl * 2.8 + Math.max(0, levelGap) * 4.5)
    );

    if (levelGap <= -3) {
        dmg = Math.min(dmg, Math.max(minHit, Math.floor(4 + attLvl * 0.6)));
    }

    dmg = Math.max(minHit, Math.min(maxHit, dmg));

    if (isStadiumFatigued(attacker)) {
        dmg = Math.round(dmg * STADIUM_FATIGUE_DMG_MULT);
    }

    return dmgInt(dmg);
}

function strike(attacker, defender, attackType, opts = {}) {
    const furyCost = attackType === "strong" ? STADIUM_FURY_STRONG : STADIUM_FURY_NORMAL;
    const isPlayer = !!attacker.email;
    let fury = isPlayer ? clampFury(opts.userRage ?? attacker.fury) : attacker.fury;

    if (fury < furyCost) {
        return { ok: false, error: "Недостаточно ярости" };
    }
    if (!defender.alive) {
        return { ok: false, error: "Противник уже выбыл из боя." };
    }

    const combatMode = opts.combatMode || talismansCatalog.MODES.STADIUM;
    const attackerTalismans = talismansCatalog.filterOwnedJsonForMode(
        opts.attackerTalismans || attacker.talismansRaw || "{}",
        combatMode
    );
    const defenderTalismans = talismansCatalog.filterOwnedJsonForMode(
        opts.defenderTalismans || defender.talismansRaw || "{}",
        combatMode
    );
    const antiTalismans = !!opts.antiTalismans;
    const effectiveDefTalismans = antiTalismans ? "{}" : defenderTalismans;
    const effectiveAttTalismans = attackerTalismans;

    let mayaTriggered = false;
    let springTriggered = false;
    let antiTriggered = antiTalismans;

    if (!antiTalismans && talismanEffects.rollGoldClover(effectiveAttTalismans, Math.random, combatMode)) {
        antiTriggered = true;
    }

    const defForDefense = antiTriggered ? "{}" : effectiveDefTalismans;
    if (talismanEffects.rollNeoDodge(defForDefense, Math.random, combatMode)) {
        const newFury = clampFury(fury - furyCost);
        attacker.fury = newFury;
        return {
            ok: true,
            dmg: 0,
            rep: 0,
            knockout: false,
            furyCost,
            attackType,
            dodgedByNeo: true,
            springTriggered: false,
            mayaTriggered: false,
            antiTalismansTriggered: antiTriggered,
            newFury: isPlayer ? attacker.fury : undefined
        };
    }

    if (talismanEffects.rollSpring(defForDefense, Math.random, combatMode)) {
        springTriggered = true;
        const reflected = calcStadiumDamage(attacker, attacker, attackType);
        let newFury = clampFury(fury - furyCost);
        if (isPlayer && reflected > 0) {
            newFury = bumpPlayerHeaderRageOnHit(newFury);
            queuePlayerRageUpdate(opts.match, attacker.email, newFury);
        }
        attacker.fury = newFury;
        attacker.hp = Math.max(0, Math.round(attacker.hp) - reflected);
        if (attacker.hp <= 0) {
            attacker.alive = false;
            attacker.hp = 0;
        }
        return {
            ok: true,
            dmg: 0,
            reflectedDmg: reflected,
            rep: 0,
            knockout: false,
            attackerSelfKnockout: attacker.hp <= 0,
            furyCost,
            attackType,
            dodgedByNeo: false,
            springTriggered: true,
            mayaTriggered: false,
            antiTalismansTriggered: antiTriggered,
            newFury: isPlayer ? newFury : undefined
        };
    }

    const now = opts.now ?? Date.now();
    const seriesBonus = opts.match ? isSeriesBonusActive(opts.match, defender, now) : false;

    let dmg = calcStadiumDamage(attacker, defender, attackType);
    const dmgMult = Math.max(1, Number(opts.dmgMult) || 1);
    if (dmgMult > 1) {
        dmg = dmgInt(Math.min(dmg * dmgMult, Math.max(1, Math.ceil(defender.hp))));
    }
    if (seriesBonus) {
        dmg = dmgInt(Math.min(dmg * STADIUM_SERIES_DMG_MULT, Math.max(1, Math.ceil(defender.hp))));
    }
    const glove = talismanEffects.applyKlitschkoMultiplier(effectiveAttTalismans, dmg, Math.random, combatMode);
    if (glove.triggered) {
        dmg = dmgInt(Math.min(glove.damage, Math.max(1, Math.ceil(defender.hp))));
    }
    const newFury = clampFury(fury - furyCost);
    if (talismanEffects.rollMayaMask(effectiveAttTalismans, Math.random, combatMode)) {
        mayaTriggered = true;
    }
    attacker.fury = newFury;
    if (mayaTriggered) attacker.fury = STADIUM_FURY_MAX;
    defender.hp = Math.max(0, Math.round(defender.hp) - dmg);
    const rep = repFromDamage(dmg);
    const knockout = defender.hp <= 0;

    if (knockout) {
        defender.alive = false;
        defender.hp = 0;
    }

    let defenderNewRage;
    if (defender.email && dmg > 0) {
        defenderNewRage = bumpPlayerHeaderRageOnHit(opts.defenderRage ?? defender.fury);
        defender.fury = defenderNewRage;
        queuePlayerRageUpdate(opts.match, defender.email, defenderNewRage);
    }

    return {
        ok: true,
        dmg,
        rep,
        knockout,
        furyCost,
        attackType,
        klitschkoBoost: glove.triggered,
        dodgedByNeo: false,
        springTriggered: false,
        mayaTriggered,
        antiTalismansTriggered: antiTriggered,
        seriesBonus,
        newFury: isPlayer ? attacker.fury : undefined,
        defenderNewRage
    };
}

function feedRepSuffix(rep) {
    const n = Math.max(0, Math.floor(Number(rep) || 0));
    return n > 0 ? ` и заработал ${n} ${REP_ICON}` : "";
}

function getMatchStatsMap(match) {
    match.meta = match.meta || {};
    if (!match.meta.matchStats || typeof match.meta.matchStats !== "object") {
        match.meta.matchStats = {};
    }
    return match.meta.matchStats;
}

function fighterStatsKey(fighter) {
    if (fighter.email) return `p:${String(fighter.email).toLowerCase()}`;
    return `b:${fighter.id}`;
}

function ensureFighterStatRow(match, fighter) {
    if (!fighter) return null;
    const map = getMatchStatsMap(match);
    const key = fighterStatsKey(fighter);
    if (!map[key]) {
        map[key] = {
            key,
            email: fighter.email ? String(fighter.email).toLowerCase() : null,
            fighterId: fighter.id,
            name: fighter.name || "Боец",
            level: fighter.level ?? 1,
            club: fighter.club,
            clubName: fighter.clubName || clubsData.getClubName(fighter.club) || fighter.club || "",
            avatar: fighter.avatar || null,
            emoji: fighter.emoji || "👤",
            isBot: !!fighter.isBot,
            rep: 0,
            damage: 0,
            hits: 0,
            kos: 0
        };
    } else {
        map[key].name = fighter.name || map[key].name;
        map[key].level = fighter.level ?? map[key].level;
        map[key].avatar = fighter.avatar || map[key].avatar;
        map[key].emoji = fighter.emoji || map[key].emoji;
        map[key].clubName =
            fighter.clubName || map[key].clubName || clubsData.getClubName(fighter.club) || "";
    }
    return map[key];
}

function accumulateMatchStats(match, attacker, result) {
    const row = ensureFighterStatRow(match, attacker);
    if (!row) return;
    row.hits += 1;
    const rep = Math.max(0, Math.floor(Number(result.repEarned ?? result.rep) || 0));
    row.rep += rep;
    row.damage += Math.max(0, Math.floor(Number(result.dmg) || 0));
    if (result.knockout) row.kos += 1;
}

const BEST_FIGHTERS_PER_PAGE = 10;

function matchParticipantClubIds(match) {
    const ids = new Set();
    if (match?.homeClub) ids.add(clubCharacters.normalizeClubId(match.homeClub));
    if (match?.awayClub && match.awayClub !== "mixed") {
        ids.add(clubCharacters.normalizeClubId(match.awayClub));
    }
    return ids;
}

function filterLeaderboardRows(map, opts = {}) {
    const allowed =
        opts.allowedClubIds instanceof Set
            ? opts.allowedClubIds
            : opts.allowedClubIds
              ? new Set([...opts.allowedClubIds].map((c) => clubCharacters.normalizeClubId(c)))
              : null;

    return Object.values(map || {}).filter((r) => {
        if (opts.realPlayersOnly && (r.isBot || !r.email)) return false;
        if (allowed && allowed.size > 0) {
            const club = clubCharacters.normalizeClubId(r.club);
            if (!club || !allowed.has(club)) return false;
        }
        return r.rep > 0 || r.damage > 0 || r.hits > 0 || r.kos > 0;
    });
}

/** Сортировка за матч: репутация → урон → добивания. */
function sortLeaderboardRows(map, opts = {}) {
    return filterLeaderboardRows(map, opts).sort(
        (a, b) =>
            b.rep - a.rep ||
            b.damage - a.damage ||
            b.kos - a.kos ||
            b.hits - a.hits
    );
}

/** «Лучшие бойцы» — участники матча с ударами (боты допускаются), только клубы матча. */
function buildBestFightersPayload(match, viewerEmail, page = 1, opts = {}) {
    const allowedClubIds = opts.allowedClubIds || matchParticipantClubIds(match);
    const sorted = sortLeaderboardRows(getMatchStatsMap(match), { allowedClubIds });
    const perPage = BEST_FIGHTERS_PER_PAGE;
    const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
    const p = Math.max(1, Math.min(Math.floor(Number(page) || 1), totalPages));
    const start = (p - 1) * perPage;
    const me = viewerEmail ? String(viewerEmail).toLowerCase() : "";

    const players = sorted.slice(start, start + perPage).map((r, i) => ({
        rank: start + i + 1,
        email: r.email || null,
        name: r.name,
        level: r.level,
        avatar: r.avatar,
        emoji: r.emoji,
        rep: r.rep,
        damage: r.damage,
        kos: r.kos,
        isMe: !!(r.email && r.email === me),
        isBot: !!r.isBot,
        club: r.club || null
    }));

    return {
        matchId: match.id,
        matchVsLabel: `${match.homeClubName} vs ${match.awayClubName}`,
        status: match.status,
        page: p,
        perPage,
        totalPages,
        totalPlayers: sorted.length,
        players,
        repIcon: "/static/icons/rep.png"
    };
}

function feedDisplayName(name, level) {
    return `${name} [${level ?? 1}]`;
}

function feedActorNames(attacker, defender) {
    const attackerName = feedDisplayName(attacker.name, attacker.level);
    const defenderName = feedDisplayName(defender.name, defender.level);
    return {
        attackerName,
        defenderName,
        attackerClub: attacker.club,
        defenderClub: defender.club,
        attackerId: attacker.id || attacker.email || null,
        defenderId: defender.id || defender.email || null,
        attackerEmail:
            attacker.email && !attacker.isBot ? String(attacker.email).toLowerCase() : null,
        defenderEmail:
            defender.email && !defender.isBot ? String(defender.email).toLowerCase() : null
    };
}

function feedInlineTalisman(kind, label) {
    return { type: "talisman", talismanKind: kind, label };
}

function feedInlineEffect(text) {
    return { type: "effect", text };
}

/** Одна запись ленты: удар + штукенция + эффекты + талисманы внутри строки (как Hools). */
function buildStrikeFeedEntry(attacker, defender, result) {
    const meta = feedActorNames(attacker, defender);
    const { attackerName, defenderName } = meta;
    const inline = [];
    let text = "";
    let kind = "hit";

    if (result.gadgetUsed) {
        const phrase = result.gadgetUsed.feedPhrase || result.gadgetUsed.label;
        text += `${attackerName} ${phrase}, `;
    }

    if (result.springTriggered) {
        text += `${attackerName} нанес удар ${defenderName}, сработала Пружина — ${attackerName} получил ${result.reflectedDmg} ❤️`;
        inline.push(feedInlineTalisman("talisman_spring", "Пружина"));
        return { kind: "talisman_spring", text, inline, ...meta };
    }

    if (result.dodgedByNeo) {
        text += `${attackerName} нанес удар ${defenderName}, но он увернулся`;
        inline.push(feedInlineTalisman("talisman_neo", "Фигурка Нео"));
        return { kind: "hit_dodge", text, inline, ...meta };
    }

    const dmg = String(result.dmg);
    const feedRep = result.repEarned ?? result.rep;
    const seriesPart = result.seriesBonus ? " (+30%)" : "";
    if (result.knockout) {
        text += `${attackerName} нокаутировал ${defenderName}${seriesPart}${feedRepSuffix(feedRep)}`;
        kind = result.seriesBonus ? "ko_series" : "ko";
    } else {
        text += `${attackerName} нанес удар ${defenderName}, снес ${dmg} ❤️${seriesPart}${feedRepSuffix(feedRep)}`;
        if (result.seriesBonus) kind = "hit_series";
        else kind = result.klitschkoBoost ? "hit_klitschko" : "hit";
    }

    if (result.seriesBonus) {
        inline.push(feedInlineEffect("Серия ударов!"));
    }

    if (result.gadgetUsed?.effectFeed) {
        inline.push(feedInlineEffect(result.gadgetUsed.effectFeed));
    }
    if (result.antiTalismansTriggered) {
        inline.push(feedInlineTalisman("talisman_gold_clover", "Золотой Клевер"));
    }
    if (result.klitschkoBoost) {
        inline.push(feedInlineTalisman("talisman_klitschko", "Перчатка Кличко"));
    }
    if (result.mayaTriggered) {
        inline.push(feedInlineTalisman("talisman_maya", "Маска Майя"));
    }
    if (result.mercedesBoost) {
        inline.push(feedInlineTalisman("talisman_mercedes", "Шильдик от Мерса"));
    }

    return { kind, text, inline, attackType: result.attackType, ...meta };
}

function feedClubLostFighter(clubName) {
    return `${clubName} потеряли бойца.`;
}

function feedClubVictory(clubName) {
    return `Победу одержали ${clubName}.`;
}

function recordStrike(match, attacker, defender, result) {
    if (match.status !== "live") return;

    accumulateMatchStats(match, attacker, result);
    if (
        (result.dmg || 0) > 0 &&
        !result.dodgedByNeo &&
        !result.springTriggered
    ) {
        markDefenderHit(match, defender, Date.now());
    }
    pushFeed(match, buildStrikeFeedEntry(attacker, defender, result));

    if (result.knockout) {
        pushFeed(match, { kind: "sys", text: feedClubLostFighter(defender.clubName) });
        if (attacker.side === "home") match.scoreHome += 1;
        else match.scoreAway += 1;
    }
    if (result.attackerSelfKnockout) {
        pushFeed(match, { kind: "sys", text: feedClubLostFighter(attacker.clubName) });
        if (attacker.side === "home") match.scoreAway += 1;
        else match.scoreHome += 1;
    }
}

function pickBotTarget(match, bot) {
    const enemies = aliveFighters(match, bot.side === "home" ? "away" : "home");
    if (!enemies.length) return null;

    const botLevel = Math.max(1, Math.floor(Number(bot.level) || 1));
    const sameLevel = enemies.filter((f) => Math.max(1, Math.floor(Number(f.level) || 1)) === botLevel);
    if (sameLevel.length) return pick(sameLevel);

    let minDist = Infinity;
    for (const f of enemies) {
        const lvl = Math.max(1, Math.floor(Number(f.level) || 1));
        const dist = Math.abs(lvl - botLevel);
        if (dist < minDist) minDist = dist;
    }
    const nearest = enemies.filter((f) => {
        const lvl = Math.max(1, Math.floor(Number(f.level) || 1));
        return Math.abs(lvl - botLevel) === minDist;
    });
    return pick(nearest.length ? nearest : enemies);
}

function processBotTurn(match, now) {
    if (match.status !== "live") return;
    if (now - (match.meta.lastBotAt || 0) < STADIUM_BOT_TICK_MS) return;

    const bots = match.fighters.filter((f) => f.isBot && f.alive);
    const ready = bots.filter((f) => f.fury >= STADIUM_FURY_NORMAL);
    if (!ready.length) return;

    const bot = pick(ready);
    const attackType = bot.fury >= STADIUM_FURY_STRONG && Math.random() < 0.35 ? "strong" : "normal";
    const target = pickBotTarget(match, bot);
    if (!target) return;

    const result = strike(bot, target, attackType, {
        attackerTalismans: bot.talismansRaw || "{}",
        defenderTalismans: target.talismansRaw || "{}",
        combatMode: talismansCatalog.MODES.STADIUM,
        defenderRage: target.email ? target.fury : undefined,
        match,
        now
    });
    if (!result.ok) return;

    recordStrike(match, bot, target, result);
    match.meta.lastBotAt = now;
    checkMatchEnd(match);
}

function checkMatchEnd(match) {
    const homeAlive = aliveFighters(match, "home").length;
    const awayAlive = aliveFighters(match, "away").length;
    if (homeAlive === 0 || awayAlive === 0) {
        match.status = "ended";
        const winner =
            homeAlive > 0 ? match.homeClubName : awayAlive > 0 ? match.awayClubName : match.homeClubName;
        pushFeed(match, feedClubVictory(winner));
        return;
    }
    if (Date.now() >= match.endsAt) {
        match.status = "ended";
        const homeAgg = sumSideMatchStats(match, match.homeClub);
        const awayAgg = sumSideMatchStats(match, match.awayClub);
        let winner;
        if (match.scoreHome > match.scoreAway) {
            winner = match.homeClubName;
        } else if (match.scoreAway > match.scoreHome) {
            winner = match.awayClubName;
        } else if (homeAgg.damage > awayAgg.damage) {
            winner = match.homeClubName;
        } else if (awayAgg.damage > homeAgg.damage) {
            winner = match.awayClubName;
        } else if (homeAgg.rep > awayAgg.rep) {
            winner = match.homeClubName;
        } else if (awayAgg.rep > homeAgg.rep) {
            winner = match.awayClubName;
        } else {
            winner = match.homeClubName;
        }
        pushFeed(match, feedClubVictory(winner));
    }
}

function sumSideMatchStats(match, clubId) {
    const target = clubCharacters.normalizeClubId(clubId);
    let rep = 0;
    let damage = 0;
    for (const row of Object.values(getMatchStatsMap(match))) {
        if (clubCharacters.normalizeClubId(row.club) !== target) continue;
        rep += row.rep || 0;
        damage += row.damage || 0;
    }
    return { rep, damage };
}

/** Восстановить matchStats из ленты боя (старые матчи до учёта статистики). */
function rebuildMatchStatsIfMissing(match) {
    const map = getMatchStatsMap(match);
    const hasStats = Object.values(map).some((r) => (r.damage || 0) > 0 || (r.hits || 0) > 0);
    if (hasStats) return false;

    const byName = new Map();
    for (const f of match.fighters || []) {
        byName.set(String(f.name || "").trim().toLowerCase(), f);
    }
    if (!byName.size) return false;

    let rebuilt = false;
    for (const entry of match.feed || []) {
        if (!entry || typeof entry !== "object") continue;

        if (entry.attackerId && entry.kind && String(entry.kind).startsWith("hit")) {
            const attacker = findFighter(match, entry.attackerId);
            if (!attacker) continue;
            const dmgMatch = String(entry.text || "").match(/(\d+)\s*❤️/);
            const dmg = dmgMatch ? parseInt(dmgMatch[1], 10) : 0;
            const repMatch = String(entry.text || "").match(/(\d+)\s*🤘/);
            const rep = repMatch ? parseInt(repMatch[1], 10) : repFromDamage(dmg);
            accumulateMatchStats(match, attacker, {
                dmg,
                rep,
                repEarned: rep,
                knockout: entry.kind === "ko" || entry.kind === "ko_series"
            });
            rebuilt = true;
            continue;
        }

        const text = String(entry.text || entry).trim();
        const legacy = text.match(
            /^(.+?)\s+(?:нан(?:ёс|ес)|ударил)\s+(?:сильный\s+)?(?:удар\s+)?(.+?)\s*[—-]\s*([\d.]+)\s*х?п/i
        );
        if (!legacy) continue;
        const attacker = byName.get(legacy[1].trim().toLowerCase());
        if (!attacker) continue;
        const dmg = Math.max(0, Math.round(parseFloat(legacy[3]) || 0));
        const rep = repFromDamage(dmg);
        accumulateMatchStats(match, attacker, { dmg, rep, repEarned: rep, knockout: /нокаут/i.test(text) });
        rebuilt = true;
    }
    return rebuilt;
}

function tickMatch(match, now = Date.now()) {
    if (match.status === "scheduled") {
        if (now < match.startsAt) return match;
        beginLiveMatch(match, now);
    }
    if (match.status !== "live") return match;

    applyFuryRegen(match, now);
    processBotTurn(match, now);
    checkMatchEnd(match);
    return match;
}

function isMatchLive(match, now = Date.now()) {
    return match.status === "live" || (match.status === "scheduled" && now >= match.startsAt);
}

function lineupForSide(match, side) {
    const fighters = match.fighters.filter((f) => f.side === side);
    let playerN = 0;
    let botN = 0;
    return fighters.map((f) => {
        const memberKind = f.isBot ? "bot" : "player";
        const memberLabel = f.isBot ? `Бот ${(botN += 1)}` : `Игрок ${(playerN += 1)}`;
        return {
            ...serializeFighter(f),
            memberKind,
            memberLabel
        };
    });
}

function rosterForSide(match, side) {
    return lineupForSide(match, side);
}

function ensurePlayerFighter(match, user, stats) {
    const club = user.club;
    if (!club) return null;
    let side = null;
    if (club === match.homeClub) side = "home";
    else if (club === match.awayClub) side = "away";
    else return null;

    let fighter = match.fighters.find((f) => f.email === user.email);
    if (!fighter) {
        fighter = fighterFromUser(user, stats, side);
        match.fighters.push(fighter);
    } else {
        fighter.talismansRaw = talismansCatalog.resolveOwnedRaw(user);
        syncPlayerFighterFromUser(fighter, user);
    }
    return fighter;
}

function pickOpponentPool(match, playerLevel, enemyClub) {
    const alive = match.fighters.filter((f) => f.alive && f.club === enemyClub && f.isBot);
    if (!alive.length) return [];
    const same = alive.filter((f) => f.level === playerLevel);
    const near = alive.filter((f) => Math.abs(f.level - playerLevel) <= 2);
    if (same.length >= 3) return same;
    if (near.length >= 3) return near;
    return alive;
}

function pickOpponents(match, playerLevel, enemyClub) {
    const pool = pickOpponentPool(match, playerLevel, enemyClub);
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
}

function refillOpponentSlots(match, playerLevel, enemyClub, current) {
    const out = current.slice();
    const seen = new Set(out.map((f) => f.id));
    const extra = pickOpponents(match, playerLevel, enemyClub);
    for (const f of extra) {
        if (out.length >= 3) break;
        if (!seen.has(f.id)) {
            out.push(f);
            seen.add(f.id);
        }
    }
    return out.slice(0, 3);
}

function pickOpponentsForPlayer(match, playerLevel, enemyClub, email, refresh = false) {
    if (!email) return pickOpponents(match, playerLevel, enemyClub);
    match.meta = match.meta || {};
    match.meta.opponentSlots = match.meta.opponentSlots || {};
    const key = String(email).toLowerCase();
    if (!refresh && Array.isArray(match.meta.opponentSlots[key]) && match.meta.opponentSlots[key].length) {
        const ids = match.meta.opponentSlots[key];
        let resolved = ids.map((id) => findFighter(match, id)).filter((f) => f && f.alive);
        if (resolved.length) {
            if (resolved.length < 3) resolved = refillOpponentSlots(match, playerLevel, enemyClub, resolved);
            match.meta.opponentSlots[key] = resolved.map((f) => f.id);
            return resolved;
        }
    }
    const picked = pickOpponents(match, playerLevel, enemyClub);
    match.meta.opponentSlots[key] = picked.map((f) => f.id);
    return picked;
}

function serializeFighter(f, opts = {}) {
    const fury =
        opts.playerRage != null && f.email
            ? clampFury(opts.playerRage)
            : clampFury(f.fury);
    return {
        id: f.id,
        email: f.email && !f.isBot ? String(f.email).toLowerCase() : null,
        name: f.name,
        club: f.club,
        clubName: f.clubName,
        level: f.level,
        hp: Math.round(f.hp),
        maxHp: Math.round(f.maxHp),
        fury,
        maxFury: f.maxFury,
        alive: f.alive,
        emoji: f.emoji,
        avatar: f.avatar,
        isBot: f.isBot
    };
}

function enrichFighterAvatars(match) {
    for (const f of match.fighters || []) {
        if (f.avatar) continue;
        if (f.email && !f.isBot) continue;
        const character = f.character || clubCharacters.pickClubCharacter(f.club, f.id);
        f.character = character;
        f.avatar = clubCharacters.avatarPathForCharacter(character);
    }
    return match;
}

function matchPayload(match, ctx = {}) {
    enrichFighterAvatars(match);
    const now = Date.now();
    const beforeStart = match.status === "scheduled" && now < match.startsAt;

    if (!beforeStart) {
        tickMatch(match, now);
    }

    const countdownMs = beforeStart ? Math.max(0, match.startsAt - now) : 0;
    const remainingMs =
        match.status === "live" ? Math.max(0, match.endsAt - now) : 0;
    const feedEnabled = match.status === "live" || match.status === "ended";
    const regCount =
        ctx.participantsRegistered != null
            ? ctx.participantsRegistered
            : countRegisteredParticipants(
                  (match.fighters || []).filter((f) => f.email && !f.isBot)
              );

    return {
        id: match.id,
        level: match.level,
        status: match.status,
        startsAt: match.startsAt,
        endsAt: match.endsAt,
        startsAtLabel: gameTime.formatGameDateTime(match.startsAt),
        countdownMs,
        countdownLabel: formatCountdown(countdownMs),
        remainingMs,
        remainingLabel: formatCountdown(remainingMs),
        matchTitle: `${match.homeClubName} — ${match.awayClubName}`,
        matchVsLabel: `${match.homeClubName} vs ${match.awayClubName}`,
        homeClub: match.homeClub,
        awayClub: match.awayClub,
        homeClubName: match.homeClubName,
        awayClubName: match.awayClubName,
        homeEmblem: clubsData.getClubEmblem(match.homeClub),
        awayEmblem: clubsData.getClubEmblem(match.awayClub),
        clubEmblems: {
            [match.homeClub]: clubsData.getClubEmblem(match.homeClub),
            [match.awayClub]: clubsData.getClubEmblem(match.awayClub)
        },
        scoreHome: beforeStart ? 0 : match.scoreHome,
        scoreAway: beforeStart ? 0 : match.scoreAway,
        feedEnabled,
        feedPlaceholder: beforeStart
            ? `До начала матча осталось ${formatCountdown(countdownMs)} · начало ${gameTime.formatGameDateTime(match.startsAt)}`
            : match.status === "ended"
              ? "Матч завершён"
              : "",
        feed: feedEnabled ? match.feed.slice(-MAX_FEED) : [],
        feedTotal: match.feed.length,
        rosterHome: lineupForSide(match, "home"),
        rosterAway: lineupForSide(match, "away"),
        participantsRegistered: regCount,
        participantsMax: STADIUM_MATCH_MAX_PARTICIPANTS,
        participantsLabel: beforeStart
            ? `Записалось: ${regCount} / ${STADIUM_MATCH_MAX_PARTICIPANTS}`
            : `Участников: ${regCount} / ${STADIUM_MATCH_MAX_PARTICIPANTS}`,
        playerInMatch: !!ctx.playerInMatch,
        playerCanJoin: !!ctx.playerCanJoin,
        playerFighter: ctx.playerFighter
            ? serializeFighter(ctx.playerFighter, { playerRage: ctx.playerRage })
            : null,
        playerEliminated: !!(ctx.playerFighter && !ctx.playerFighter.alive),
        playerCanFight: !!(
            ctx.playerFighter &&
            ctx.playerFighter.alive &&
            match.status === "live" &&
            ctx.playerCanJoin
        ),
        viewerEnemyClub: ctx.enemyClub || null,
        feedTargetLinks: !!(
            ctx.playerFighter &&
            ctx.playerFighter.alive &&
            match.status === "live" &&
            ctx.playerCanJoin &&
            ctx.enemyClub
        ),
        playerRage: ctx.playerRage != null ? clampFury(ctx.playerRage) : null,
        opponents: feedEnabled
            ? (ctx.opponents || []).map((o) => serializeFighter(o))
            : [],
        scheduleHours: STADIUM_MATCH_HOURS
    };
}

function parseMatchRow(row) {
    if (!row) return null;
    return {
        id: row.id,
        level: row.level,
        homeClub: row.home_club,
        awayClub: row.away_club,
        homeClubName: clubsData.getClubName(row.home_club) || row.home_club,
        awayClubName: clubsData.getClubName(row.away_club) || row.away_club,
        status: row.status,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        scoreHome: row.score_home ?? 0,
        scoreAway: row.score_away ?? 0,
        fighters: JSON.parse(row.fighters_json || "[]"),
        feed: JSON.parse(row.feed_json || "[]"),
        meta: JSON.parse(row.meta_json || "{}")
    };
}

function rowFromMatch(match) {
    return {
        id: match.id,
        level: match.level,
        home_club: match.homeClub,
        away_club: match.awayClub,
        status: match.status,
        starts_at: match.startsAt,
        ends_at: match.endsAt,
        score_home: match.scoreHome,
        score_away: match.scoreAway,
        fighters_json: JSON.stringify(match.fighters),
        feed_json: JSON.stringify(match.feed),
        meta_json: JSON.stringify(match.meta || {})
    };
}

module.exports = {
    STADIUM_TEST_MODE,
    STADIUM_NEAREST_MATCH_AT_MS,
    STADIUM_TEST_HOME_CLUB,
    STADIUM_TEST_AWAY_CLUB,
    STADIUM_MATCH_HOURS,
    STADIUM_MATCH_DURATION_MS,
    STADIUM_SIDE_SIZE,
    STADIUM_MATCH_MAX_PARTICIPANTS,
    syncMatchRoster,
    countRegisteredParticipants,
    testMatchStartMs,
    STADIUM_FURY_NORMAL,
    STADIUM_FURY_STRONG,
    STADIUM_RAGE_ON_HIT,
    queuePlayerRageUpdate,
    STADIUM_FATIGUE_HP_THRESHOLD,
    STADIUM_FATIGUE_DMG_MULT,
    STADIUM_SERIES_WINDOW_MS,
    STADIUM_SERIES_DMG_MULT,
    nextMatchStartMs,
    formatCountdown,
    createMatch,
    initFighters,
    tickMatch,
    parseMatchRow,
    rowFromMatch,
    ensurePlayerFighter,
    pickOpponents,
    pickOpponentsForPlayer,
    pickOpponentPool,
    repFromDamage,
    dmgInt,
    calcStadiumDamage,
    stadiumFatigueMult,
    isStadiumFatigued,
    strike,
    recordStrike,
    buildBestFightersPayload,
    matchParticipantClubIds,
    filterLeaderboardRows,
    sortLeaderboardRows,
    rebuildMatchStatsIfMissing,
    BEST_FIGHTERS_PER_PAGE,
    checkMatchEnd,
    beginLiveMatch,
    resetFightersForLive,
    isMatchLive,
    rosterForSide,
    lineupForSide,
    enrichFighterAvatars,
    matchPayload,
    findFighter,
    enemyClubForPlayer: stadiumBots.enemyClubForPlayer,
    syncPlayerFighterFromUser
};
