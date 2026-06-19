/**
 * Мост к stadium-engine — массовый бой в комнатах Битвы за Паб.
 */

const clubCharacters = require("../club-characters");
const clubsData = require("../clubs-data");
const provisionsData = require("../provisions-data");
const stadiumBots = require("../stadium-bots");
const talismansCatalog = require("../talismans");
const engine = require("./engine");
const { buildRoomOverview } = require("./rooms-overview");
const { clubName } = require("./utils");

const STADIUM_BOT_TICK_MS = 5500;
const STADIUM_FURY_NORMAL = 60;
const STADIUM_FURY_STRONG = 100;
const BOTS_PER_CLUB_IN_ROOM = 2;
const MAX_OPPONENTS = 3;

function pick(arr) {
    if (!arr?.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

function clubEmblemsForFighters(fighters) {
    const out = {};
    for (const f of fighters || []) {
        if (f.club && !out[f.club]) {
            out[f.club] = clubsData.getClubEmblem(f.club);
        }
    }
    return out;
}

function roomAsMatch(room, battleId) {
    return {
        id: `${battleId}_r${room.roomIndex}`,
        status: room.status === "live" ? "live" : room.status,
        homeClub: room.clubId,
        awayClub: "mixed",
        homeClubName: room.clubName,
        awayClubName: "Комната",
        fighters: room.fighters,
        feed: room.feed,
        meta: room.meta,
        scoreHome: 0,
        scoreAway: 0,
        endsAt: Date.now() + 86400000
    };
}

function botToFighter(bot, side) {
    const enriched = clubCharacters.enrichBotAvatar(bot);
    return {
        id: enriched.id,
        name: enriched.name,
        club: enriched.club,
        clubName: clubName(enriched.club),
        level: enriched.level,
        side,
        isBot: true,
        email: null,
        emoji: enriched.emoji || "👤",
        avatar: enriched.avatar,
        character: enriched.character,
        hp: 100,
        maxHp: 100,
        fury: 30 + Math.floor(Math.random() * 25),
        maxFury: 150,
        power: bot.power,
        speed: bot.speed,
        intel: bot.intel,
        stamina: bot.stamina,
        alive: true,
        talismansRaw: "{}"
    };
}

function playerToFighter(user, stats, player, side, avatarPath) {
    const eff = stats.effective;
    const maxHp = Math.max(1, Math.round(Number(player.maxHp) || 100));
    const hp = Math.min(maxHp, Math.max(0, Math.round(Number(player.hp) || maxHp)));
    return {
        id: `pb_${player.email}`,
        email: player.email,
        name: player.name || user.name || "Игрок",
        club: player.club,
        clubName: clubName(player.club),
        level: Math.max(1, user.level ?? 1),
        side,
        isBot: false,
        emoji: "👤",
        avatar: avatarPath ? avatarPath(user.character) : null,
        hp,
        maxHp,
        fury: Math.max(0, Math.min(150, Math.round(Number(user.rage) ?? 100))),
        maxFury: 150,
        power: eff.power || 10,
        speed: eff.speed || 10,
        intel: eff.intel || 10,
        stamina: eff.stamina || 10,
        alive: player.alive !== false,
        talismansRaw: talismansCatalog.resolveOwnedRaw(user)
    };
}

function sideForClub(clubId, roomClubId) {
    return clubId === roomClubId ? "home" : "away";
}

function createPubBattleCombatBridge({ stadiumEngine, avatarPath }) {
    function initEmptyRooms(battle) {
        const rooms = {};
        const clubs = battle.roomClubs || [];
        clubs.forEach((clubId, index) => {
            const room = emptyRoomState(index, clubId);
            room.status = "waiting";
            rooms[String(index)] = room;
        });
        battle.roomsState = rooms;
        return rooms;
    }

    function ensureRoomsShell(battle) {
        const clubs = battle.roomClubs || [];
        if (!clubs.length) return battle.roomsState || {};
        const existing = battle.roomsState || {};
        if (Object.keys(existing).length >= clubs.length) return existing;
        return initEmptyRooms(battle);
    }

    function emptyRoomState(roomIndex, clubId) {
        return {
            roomIndex,
            clubId,
            clubName: clubName(clubId),
            status: "idle",
            feed: [],
            fighters: [],
            meta: {
                lastTickAt: 0,
                lastBotAt: 0,
                matchStats: {},
                opponentSlots: {}
            }
        };
    }

    function addBotsForRoom(room, clubsInRoom) {
        const existingBotIds = new Set(room.fighters.filter((f) => f.isBot).map((f) => f.id));
        const present = new Set(clubsInRoom.length ? clubsInRoom : [room.clubId]);
        const allIds = clubsData.listSelectableClubs().map((c) => c.id);
        const enemyClubs = allIds.filter((c) => !present.has(c));
        const shuffled = enemyClubs.sort(() => Math.random() - 0.5);
        const botClubs = [...present, ...shuffled.slice(0, 3)];

        for (const cid of botClubs) {
            const roster = stadiumBots.getRoster(cid);
            let added = 0;
            for (const bot of roster) {
                if (added >= BOTS_PER_CLUB_IN_ROOM) break;
                if (existingBotIds.has(bot.id)) continue;
                room.fighters.push(botToFighter(bot, sideForClub(cid, room.clubId)));
                existingBotIds.add(bot.id);
                added += 1;
            }
        }
    }

    /**
     * Первичная инициализация комнат при старте битвы.
     */
    function bootstrapRooms(battle, players, userLoader) {
        const rooms = {};
        const clubs = battle.roomClubs || [];

        clubs.forEach((clubId, index) => {
            rooms[String(index)] = emptyRoomState(index, clubId);
        });

        const byRoom = {};
        for (const player of Object.values(players || {})) {
            if (!player?.alive) continue;
            const ri = String(player.roomIndex);
            if (!byRoom[ri]) byRoom[ri] = [];
            byRoom[ri].push(player);
        }

        for (const [ri, plist] of Object.entries(byRoom)) {
            const room = rooms[ri];
            if (!room) continue;
            const clubsInRoom = [...new Set(plist.map((p) => p.club).filter(Boolean))];

            plist.forEach((player, idx) => {
                const user = userLoader?.[player.email];
                const stats = user ? user._stats : null;
                if (user && stats) {
                    room.fighters.push(
                        playerToFighter(user, stats, player, sideForClub(player.club, room.clubId), avatarPath)
                    );
                } else {
                    room.fighters.push({
                        id: `pb_${player.email}`,
                        email: player.email,
                        name: player.name || "Игрок",
                        club: player.club,
                        clubName: clubName(player.club),
                        level: player.level ?? 1,
                        side: sideForClub(player.club, room.clubId),
                        isBot: false,
                        hp: player.hp,
                        maxHp: player.maxHp,
                        fury: 100,
                        maxFury: 150,
                        alive: true,
                        power: 10,
                        speed: 10,
                        stamina: 10,
                        emoji: "👤",
                        avatar: clubCharacters.avatarPathForCharacter(user?.character)
                    });
                }
            });

            addBotsForRoom(room, clubsInRoom.length ? clubsInRoom : [room.clubId]);
            if (room.fighters.some((f) => f.alive)) {
                room.status = "live";
                room.feed.push({
                    at: Date.now(),
                    kind: "sys",
                    text: `В комнате «${room.clubName}» завязалась потасовка (${room.fighters.filter((f) => f.alive).length} бойцов).`
                });
            }
        }

        battle.roomsState = rooms;
        battle.meta = battle.meta || {};
        battle.meta.combatBootstrappedAt = Date.now();
        return rooms;
    }

    function findFighterInRoom(room, id) {
        return room.fighters.find((f) => f.id === id || f.email === id) || null;
    }

    function syncPlayerFromFighter(player, fighter) {
        if (!player || !fighter) return;
        player.hp = Math.round(fighter.hp);
        player.maxHp = Math.round(fighter.maxHp);
        player.alive = !!fighter.alive;
    }

    function syncFighterHpToPlayers(battle) {
        for (const room of Object.values(battle.roomsState || {})) {
            for (const f of room.fighters || []) {
                if (!f.email) continue;
                const p = battle.players[f.email];
                if (p) syncPlayerFromFighter(p, f);
            }
        }
    }

    function pickEnemies(room, actor, limit = MAX_OPPONENTS) {
        return room.fighters
            .filter((f) => f.alive && f.id !== actor.id && f.club !== actor.club)
            .sort(() => Math.random() - 0.5)
            .slice(0, limit);
    }

    function pickOpponentsForPlayer(room, email, refresh = false) {
        room.meta = room.meta || {};
        room.meta.opponentSlots = room.meta.opponentSlots || {};
        const key = String(email).toLowerCase();
        const playerF = room.fighters.find((f) => f.email === key);
        if (!playerF?.alive) return [];

        if (!refresh && Array.isArray(room.meta.opponentSlots[key]) && room.meta.opponentSlots[key].length) {
            const resolved = room.meta.opponentSlots[key]
                .map((id) => findFighterInRoom(room, id))
                .filter((f) => f && f.alive && f.club !== playerF.club);
            if (resolved.length) return resolved.slice(0, MAX_OPPONENTS);
        }

        const picked = pickEnemies(room, playerF, MAX_OPPONENTS);
        room.meta.opponentSlots[key] = picked.map((f) => f.id);
        return picked;
    }

    function applyFuryRegenRoom(room, now) {
        const last = room.meta.lastTickAt || now;
        const ticks = Math.floor((now - last) / 1000);
        if (ticks < 1) return;
        for (const f of room.fighters) {
            if (!f.alive || f.email) continue;
            f.fury = Math.min(f.maxFury || 150, Math.round(f.fury + ticks));
        }
        room.meta.lastTickAt = last + ticks * 1000;
    }

    function processRoomBotTurn(room, battleId, now) {
        if (room.status !== "live" || !stadiumEngine) return;
        if (now - (room.meta.lastBotAt || 0) < STADIUM_BOT_TICK_MS) return;

        const bots = room.fighters.filter((f) => f.isBot && f.alive && f.fury >= STADIUM_FURY_NORMAL);
        if (!bots.length) return;

        const bot = pick(bots);
        const enemies = room.fighters.filter((f) => f.alive && f.club !== bot.club);
        const target = pick(enemies);
        if (!target) return;

        const attackType =
            bot.fury >= STADIUM_FURY_STRONG && Math.random() < 0.35 ? "strong" : "normal";
        const match = roomAsMatch(room, battleId);
        const defenderRage =
            target.email != null
                ? Math.max(0, Math.min(150, Math.round(Number(target.fury) || 100)))
                : undefined;
        const result = stadiumEngine.strike(bot, target, attackType, {
            attackerTalismans: "{}",
            defenderTalismans: target.talismansRaw || "{}",
            combatMode: talismansCatalog.MODES.PUB_BATTLE,
            defenderRage,
            match,
            now
        });
        if (!result.ok) return;

        stadiumEngine.recordStrike(match, bot, target, result);
        room.feed = match.feed;
        room.meta = match.meta;
        room.meta.lastBotAt = now;
    }

    function tickLiveBattle(battle, now = Date.now()) {
        if (!battle?.roomsState || battle.status !== "live") return battle;

        for (const room of Object.values(battle.roomsState)) {
            if (room.status !== "live") continue;
            applyFuryRegenRoom(room, now);
            processRoomBotTurn(room, battle.id, now);
            const alive = room.fighters.filter((f) => f.alive);
            if (alive.length < 2) room.status = alive.length ? "idle" : "ended";
        }

        syncFighterHpToPlayers(battle);
        syncEliminationsToPlayers(battle);
        return battle;
    }

    function getMyMatchStats(room, email) {
        const key = email ? `p:${String(email).toLowerCase()}` : "";
        const row = room.meta?.matchStats?.[key];
        if (!row) {
            return { damage: 0, rep: 0, kos: 0, hits: 0 };
        }
        return {
            damage: row.damage || 0,
            rep: row.rep || 0,
            kos: row.kos || 0,
            hits: row.hits || 0
        };
    }

    function syncEliminationsToPlayers(battle) {
        if (!battle?.roomsState || !battle.players) return;
        for (const room of Object.values(battle.roomsState)) {
            for (const f of room.fighters || []) {
                if (!f.email) continue;
                const p = battle.players[f.email];
                if (!p) continue;
                if (!f.alive) {
                    p.alive = false;
                    p.hp = 0;
                } else {
                    p.hp = Math.round(f.hp);
                    p.maxHp = Math.round(f.maxHp);
                }
            }
        }
    }

    function serializeFighter(f, playerRage) {
        if (!f.avatar && f.isBot) {
            const character = f.character || clubCharacters.pickClubCharacter(f.club, f.id);
            f.character = character;
            f.avatar = clubCharacters.avatarPathForCharacter(character);
        }
        const fury =
            f.email && playerRage != null
                ? Math.max(0, Math.min(150, Math.round(playerRage)))
                : Math.max(0, Math.min(150, Math.round(f.fury)));
        return {
            id: f.id,
            email: f.email || null,
            name: f.name,
            club: f.club,
            clubName: f.clubName || clubName(f.club),
            level: f.level ?? 1,
            hp: Math.round(f.hp),
            maxHp: Math.round(f.maxHp),
            fury,
            maxFury: f.maxFury || 150,
            alive: f.alive,
            emoji: f.emoji || "👤",
            avatar: f.avatar || null,
            isBot: !!f.isBot
        };
    }

    function buildCombatPayload(battle, roomIndex, user, opts = {}) {
        const room = battle.roomsState?.[String(roomIndex)];
        const email = String(user?.email || "").toLowerCase();
        const player = battle.players[email];

        if (!room) {
            return { ok: false, error: "Комната не найдена." };
        }

        const playerFighter = room.fighters.find((f) => f.email === email) || null;
        const opponents = playerFighter?.alive
            ? pickOpponentsForPlayer(room, email, !!opts.refreshOpponents).map((f) =>
                  serializeFighter(f, null)
              )
            : [];

        const match = roomAsMatch(room, battle.id);
        const clubEmblems = clubEmblemsForFighters(room.fighters);
        match.clubEmblems = clubEmblems;

        const bestPage = Math.max(1, Math.floor(Number(opts.bestPage) || 1));
        const allowedClubIds = new Set(
            room.fighters.map((f) => clubCharacters.normalizeClubId(f.club)).filter(Boolean)
        );
        const best = stadiumEngine
            ? stadiumEngine.buildBestFightersPayload(match, email, bestPage, { allowedClubIds })
            : { players: [], page: 1, totalPages: 1, totalPlayers: 0 };

        const roster = room.fighters
            .filter((f) => f.alive)
            .map((f) => ({
                ...serializeFighter(f, f.email === email ? user.rage : null),
                isMe: f.email === email
            }));

        return {
            ok: true,
            roomIndex,
            roomName: room.clubName,
            roomTitle: `Комната: ${room.clubName}`,
            inFight: !!(playerFighter && playerFighter.alive),
            eliminated: !!(player && !player.alive),
            playerRage: Math.max(0, Math.min(150, Math.round(Number(user.rage) ?? 100))),
            playerFighter: playerFighter
                ? serializeFighter(playerFighter, user.rage)
                : null,
            myStats: getMyMatchStats(room, email),
            opponents,
            roster,
            match: {
                id: match.id,
                status: room.status,
                feedEnabled: room.status === "live" || room.feed.length > 0,
                feedPlaceholder: room.status === "live" ? "" : "Бой в этой комнате завершён.",
                feed: room.feed.slice(-200),
                feedTotal: room.feed.length,
                clubEmblems,
                matchVsLabel: room.clubName
            },
            best,
            repIcon: "/static/icons/rep.png",
            gadgets: provisionsData.catalogOwnedForClient(user.consumables || {})
        };
    }

    function buildRoomCombatView(battle, roomIndex, viewerEmail) {
        const payload = buildCombatPayload(battle, roomIndex, { email: viewerEmail });
        if (!payload.ok) {
            return { feed: [], best: [], opponents: [], roster: [], roomName: null };
        }
        return {
            roomName: payload.roomName,
            feed: payload.match.feed,
            best: payload.best.players || [],
            opponents: payload.opponents,
            roster: payload.roster
        };
    }

    function playerStrike(battle, roomIndex, user, stats, targetId, attackType, attackOpts = {}) {
        const room = battle.roomsState?.[String(roomIndex)];
        const email = String(user.email || "").toLowerCase();
        if (!room || room.status !== "live") {
            return { ok: false, error: "Комната недоступна для боя." };
        }

        const attacker = room.fighters.find((f) => f.email === email);
        if (!attacker || !attacker.alive) {
            return { ok: false, error: "Ты выбыл из боя." };
        }

        const defender = findFighterInRoom(room, targetId);
        if (!defender || !defender.alive) {
            return { ok: false, error: "Противник уже выбыл." };
        }
        if (defender.club === attacker.club) {
            return { ok: false, error: "Нельзя атаковать своих." };
        }

        let consumables = provisionsData.countsFromConsumables(attackOpts.consumables);
        let userRage = Math.max(0, Math.min(150, Math.round(Number(user.rage) ?? attacker.fury)));
        attacker.fury = userRage;
        let userHp = attacker.hp;
        let gadgetUsed = null;
        const gadgetId = String(attackOpts.gadgetId || "").trim();

        const battleNow = Date.now();
        const consumablesUsedAt = provisionsData.parseConsumablesUsedAtRaw(attackOpts.consumablesUsedAt);

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
                attacker.fury = userRage;
                user.rage = userRage;
            } else if (spent.def.furyRestore) {
                userRage = Math.min(150, userRage + spent.def.furyRestore);
                attacker.fury = userRage;
                user.rage = userRage;
            }
            if (spent.def.healHp) {
                const maxHp = attacker.maxHp || 100;
                const newHp = Math.min(maxHp, (attacker.hp || 0) + spent.def.healHp);
                attacker.hp = newHp;
                attacker.alive = newHp > 0;
                userHp = newHp;
            }
        }

        const furyCost = attackType === "strong" ? STADIUM_FURY_STRONG : STADIUM_FURY_NORMAL;
        if (userRage < furyCost) {
            if (gadgetId) {
                consumables[gadgetId] = (consumables[gadgetId] || 0) + 1;
            }
            return { ok: false, error: "Недостаточно ярости", consumables };
        }

        const match = roomAsMatch(room, battle.id);
        const talRaw = talismansCatalog.resolveOwnedRaw(user);
        const defenderRage =
            defender.email != null
                ? Math.max(0, Math.min(150, Math.round(Number(defender.fury) || 100)))
                : undefined;
        const result = stadiumEngine.strike(attacker, defender, attackType || "normal", {
            userRage,
            defenderRage,
            attackerTalismans: talRaw,
            defenderTalismans: defender.talismansRaw || "{}",
            combatMode: talismansCatalog.MODES.PUB_BATTLE,
            match,
            now: battleNow
        });

        if (!result.ok) {
            if (gadgetId) {
                consumables[gadgetId] = (consumables[gadgetId] || 0) + 1;
            }
            return { ok: false, error: result.error || "Удар не прошёл.", consumables };
        }

        const feedResult = { ...result, gadgetUsed };
        stadiumEngine.recordStrike(match, attacker, defender, feedResult);
        room.feed = match.feed;
        room.meta = match.meta;

        if (user.rage != null && result.newFury != null) {
            user.rage = result.newFury;
            attacker.fury = result.newFury;
        } else {
            const cost = attackType === "strong" ? STADIUM_FURY_STRONG : STADIUM_FURY_NORMAL;
            attacker.fury = Math.max(0, attacker.fury - cost);
            user.rage = attacker.fury;
        }
        userHp = attacker.hp;

        const player = battle.players[email];
        if (player) syncPlayerFromFighter(player, attacker);
        if (defender.email) {
            const dp = battle.players[defender.email];
            if (dp) syncPlayerFromFighter(dp, defender);
        }

        const strikeFlash = {
            targetName: defender.name,
            dmg: result.dmg,
            knockout: !!result.knockout,
            dodged: !!result.dodgedByNeo,
            spring: !!result.springTriggered
        };

        return {
            ok: true,
            result: feedResult,
            strikeFlash,
            room,
            consumables,
            userHp,
            gadgetUsed,
            provisionUsedId: gadgetId || null,
            provisionUsedAt: battleNow
        };
    }

    function movePlayerBetweenRooms(battle, email, fromIndex, toIndex, user, stats) {
        if (!battle.roomsState) return;
        const key = String(email).toLowerCase();
        const fromRoom = battle.roomsState[String(fromIndex)];
        const toRoom = battle.roomsState[String(toIndex)];
        if (!fromRoom || !toRoom) return;

        const idx = fromRoom.fighters.findIndex((f) => f.email === key);
        let fighter = null;
        if (idx >= 0) {
            fighter = fromRoom.fighters.splice(idx, 1)[0];
        }

        const player = battle.players[key];
        if (!fighter && player && user && stats) {
            fighter = playerToFighter(user, stats, player, sideForClub(player.club, toRoom.clubId), avatarPath);
        }

        if (fighter) {
            fighter.side = sideForClub(fighter.club, toRoom.clubId);
            toRoom.fighters.push(fighter);
            toRoom.status = "live";
            if (toRoom.meta?.opponentSlots) delete toRoom.meta.opponentSlots[key];
        }
    }

    function parseRoomsFromRow(row) {
        return engine.battleRoomsState(row?.rooms_json);
    }

    function parseMetaFromRow(row) {
        return engine.battleMeta(row?.meta_json);
    }

    function collectPendingRageUpdates(battle) {
        const out = [];
        if (!battle?.roomsState) return out;
        for (const room of Object.values(battle.roomsState)) {
            const pending = room.meta?.pendingRageUpdates;
            if (!pending || typeof pending !== "object") continue;
            for (const [email, rage] of Object.entries(pending)) {
                out.push({ email: String(email).toLowerCase(), rage });
            }
            delete room.meta.pendingRageUpdates;
        }
        return out;
    }

    return {
        initEmptyRooms,
        ensureRoomsShell,
        bootstrapRooms,
        buildRoomsOverview: (battle, viewerEmail, moveCooldownMs) =>
            buildRoomOverview(battle, {
                clubNameFn: clubName,
                viewerEmail,
                moveCooldownMs
            }),
        tickLiveBattle,
        syncEliminationsToPlayers,
        buildRoomCombatView,
        buildCombatPayload,
        playerStrike,
        movePlayerBetweenRooms,
        pickOpponentsForPlayer,
        parseRoomsFromRow,
        parseMetaFromRow,
        collectPendingRageUpdates
    };
}

module.exports = { createPubBattleCombatBridge };
