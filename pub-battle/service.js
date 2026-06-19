/**
 * «Битва за Паб» — персистентность и бизнес-логика.
 */

const crypto = require("crypto");
const engine = require("./engine");
const config = require("./config");
const provisionsData = require("../provisions-data");
const { computeNextScheduledStart, computeRegistrationOpens, scheduleInfoForBattle } = require("./schedule");
const { normalizeEmail, newBattleId, clubName, roomClubIds } = require("./utils");
const { assignClubRanks } = require("../club-elite");

function parseRegistrations(raw) {
    const arr = engine.parseJson(raw, []);
    return Array.isArray(arr) ? arr : [];
}

function rowToBattle(row, combatBridge) {
    if (!row) return null;
    return {
        id: row.id,
        status: row.status,
        roomClubs: engine.battleRoomClubs(row.room_clubs_json),
        registrations: parseRegistrations(row.registrations_json),
        players: engine.battlePlayers(row.players_json),
        roomsState: combatBridge ? combatBridge.parseRoomsFromRow(row) : engine.battleRoomsState(row.rooms_json),
        coordChat: engine.battleCoordChat(row.coord_chat_json),
        meta: combatBridge ? combatBridge.parseMetaFromRow(row) : engine.battleMeta(row.meta_json),
        winnerClub: row.winner_club || null,
        registrationOpensAt: Number(row.registration_opens_at) || 0,
        scheduledStartsAt: Number(row.scheduled_starts_at) || 0,
        createdAt: Number(row.created_at) || 0,
        startedAt: Number(row.started_at) || 0,
        endedAt: Number(row.ended_at) || 0
    };
}

function createPubBattleService({
    runQuery,
    getQuery,
    allQuery,
    getEffectiveStats,
    readUserHpForFight,
    calcMaxHp,
    repEarningsService,
    combatBridge,
    onMainQuestEvent
}) {
    const MAX_RAGE = 150;

    function clampRage(value) {
        if (value == null || !Number.isFinite(Number(value))) return 100;
        return Math.max(0, Math.min(MAX_RAGE, Math.round(Number(value))));
    }

    async function applyPendingRageUpdates(battle) {
        if (!combatBridge?.collectPendingRageUpdates) return;
        const updates = combatBridge.collectPendingRageUpdates(battle);
        for (const { email, rage } of updates) {
            await runQuery("UPDATE users SET rage = ? WHERE email = ?", [clampRage(rage), email]);
        }
    }

    async function loadLatestBattle() {
        const row = await getQuery(
            "SELECT * FROM pub_battles ORDER BY scheduled_starts_at DESC, created_at DESC LIMIT 1"
        );
        return rowToBattle(row, combatBridge);
    }

    /** Актуальное событие для UI: registration → live → последняя завершённая. */
    async function loadCurrentEvent(now = Date.now()) {
        await reconcileBattleState(now);

        const reg = await getQuery(
            `SELECT * FROM pub_battles WHERE status = 'registration'
             ORDER BY scheduled_starts_at ASC LIMIT 1`
        );
        if (reg) return rowToBattle(reg, combatBridge);

        const live = await getQuery("SELECT * FROM pub_battles WHERE status = 'live' LIMIT 1");
        if (live) return rowToBattle(live, combatBridge);

        const ended = await getQuery(
            "SELECT * FROM pub_battles WHERE status = 'ended' ORDER BY ended_at DESC LIMIT 1"
        );
        return rowToBattle(ended, combatBridge);
    }

    /** Закрывает устаревшие live-битвы и стартует просроченную запись. */
    async function reconcileBattleState(now = Date.now()) {
        const liveRows = await allQuery("SELECT * FROM pub_battles WHERE status = 'live'");
        for (const row of liveRows) {
            const battle = rowToBattle(row, combatBridge);
            const legacy = !battle.scheduledStartsAt;
            const maxLiveMs = 6 * 60 * 60 * 1000;
            const expired = battle.startedAt && now - battle.startedAt > maxLiveMs;
            const winner = engine.checkWinnerClub(battle.players);
            if (legacy || expired || winner) {
                battle.status = "ended";
                battle.endedAt = now;
                battle.winnerClub = winner || battle.winnerClub || null;
                await saveBattle(battle);
            }
        }

        const overdue = await allQuery(
            `SELECT * FROM pub_battles WHERE status = 'registration'
             AND scheduled_starts_at > 0 AND scheduled_starts_at <= ?`,
            [now]
        );
        for (const row of overdue) {
            await startBattle(rowToBattle(row, combatBridge), now);
        }
    }

    async function loadUpcomingRegistration(now = Date.now()) {
        const row = await getQuery(
            `SELECT * FROM pub_battles WHERE status = 'registration' AND scheduled_starts_at > ?
             ORDER BY scheduled_starts_at ASC LIMIT 1`,
            [now]
        );
        return rowToBattle(row, combatBridge);
    }

    async function loadBattleById(id) {
        const row = await getQuery("SELECT * FROM pub_battles WHERE id = ?", [id]);
        return rowToBattle(row, combatBridge);
    }

    async function saveBattle(battle) {
        await runQuery(
            `INSERT OR REPLACE INTO pub_battles
             (id, status, room_clubs_json, registrations_json, players_json, rooms_json,
              coord_chat_json, meta_json, winner_club, registration_opens_at, scheduled_starts_at,
              created_at, started_at, ended_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                battle.id,
                battle.status,
                JSON.stringify(battle.roomClubs || []),
                JSON.stringify(battle.registrations || []),
                JSON.stringify(battle.players || {}),
                JSON.stringify(battle.roomsState || {}),
                JSON.stringify(battle.coordChat || []),
                JSON.stringify(battle.meta || {}),
                battle.winnerClub || null,
                battle.registrationOpensAt || 0,
                battle.scheduledStartsAt || 0,
                battle.createdAt || Date.now(),
                battle.startedAt || 0,
                battle.endedAt || 0
            ]
        );
    }

    function buildScheduleWindow(now = Date.now()) {
        const scheduledStartsAt = computeNextScheduledStart(now);
        const registrationOpensAt = computeRegistrationOpens(scheduledStartsAt);
        return { registrationOpensAt, scheduledStartsAt };
    }

    async function resetForTesting(now = Date.now()) {
        if (!config.PUB_BATTLE_TEST_MODE) {
            return { ok: false, error: "Сброс доступен только в тестовом режиме." };
        }
        await runQuery(
            `UPDATE pub_battles SET status = 'ended', ended_at = ?
             WHERE status IN ('live', 'registration')`,
            [now]
        );
        const battle = await createScheduledBattle(now);
        return { ok: true, battleId: battle.id, state: null };
    }

    async function createScheduledBattle(now = Date.now()) {
        const { registrationOpensAt, scheduledStartsAt } = buildScheduleWindow(now);
        const battle = {
            id: newBattleId(),
            status: "registration",
            roomClubs: roomClubIds(),
            registrations: [],
            players: {},
            roomsState: {},
            coordChat: [],
            meta: {},
            winnerClub: null,
            registrationOpensAt,
            scheduledStartsAt,
            createdAt: now,
            startedAt: 0,
            endedAt: 0
        };
        if (combatBridge) {
            combatBridge.initEmptyRooms(battle);
        }
        await saveBattle(battle);
        return battle;
    }

    /** Гарантирует следующее событие в расписании после завершения. */
    async function ensureScheduledEvent(now = Date.now()) {
        const live = await getQuery("SELECT id FROM pub_battles WHERE status = 'live' LIMIT 1");
        if (live) return loadCurrentEvent();

        const openReg = await getQuery(
            "SELECT id FROM pub_battles WHERE status = 'registration' LIMIT 1"
        );
        if (openReg) return loadCurrentEvent();

        const upcoming = await loadUpcomingRegistration(now);
        if (upcoming) return upcoming;

        return createScheduledBattle(now);
    }

    async function getCoordWriteAccess(email, club) {
        if (!club || !repEarningsService) {
            return { canWrite: false, rankKind: null };
        }
        const key = normalizeEmail(email);
        const sinceMs = Date.now() - repEarningsService.RETENTION_MS;
        const weeklyMap = await repEarningsService.sumWeeklySkullsByClub(club, sinceMs);
        const members = await allQuery(
            "SELECT email, name FROM users WHERE club = ? ORDER BY name ASC",
            [club]
        );
        const players = members.map((m) => {
            const em = normalizeEmail(m.email);
            return {
                email: em,
                name: m.name || "Игрок",
                weeklySkulls: weeklyMap[em]?.weeklySkulls ?? 0
            };
        });
        const ranked = assignClubRanks(players);
        const me = ranked.find((r) => r.email === key);
        if (!me) return { canWrite: false, rankKind: null };
        const canWrite = me.rankKind === "leader" || me.rankKind === "assistant";
        return { canWrite, rankKind: me.rankKind, rankTitle: me.rankTitle };
    }

    function buildRooms(battle) {
        const clubs = battle.roomClubs?.length ? battle.roomClubs : roomClubIds();
        return clubs.map((clubId, index) => ({
            index,
            clubId,
            clubName: clubName(clubId)
        }));
    }

    async function buildState(user) {
        const email = normalizeEmail(user.email);
        const now = Date.now();
        let battle = await loadCurrentEvent(now);
        if (!battle || battle.status === "ended") {
            battle = await ensureScheduledEvent(now);
        }

        const rooms = buildRooms(battle);
        const coordAccess = await getCoordWriteAccess(email, user.club);
        const regKey = battle.registrations.find((r) => normalizeEmail(r.email) === email);
        const player = battle.players[email] || null;
        const schedule = scheduleInfoForBattle(battle, now);
        const isParticipant = !!regKey || !!player;

        if (combatBridge && battle.status === "registration") {
            const before = Object.keys(battle.roomsState || {}).length;
            combatBridge.ensureRoomsShell(battle);
            if (Object.keys(battle.roomsState || {}).length > before) {
                await saveBattle(battle);
            }
        }

        const clubIds = battle.roomClubs?.length ? battle.roomClubs : roomClubIds();
        const registrationsByClub = engine.registrationByClub(
            battle.registrations,
            clubIds,
            clubName
        );

        const moveCooldownMs = player ? engine.moveCooldownMs(player, now) : 0;
        const roomOverview =
            combatBridge && battle.status === "live"
                ? combatBridge.buildRoomsOverview(battle, email, moveCooldownMs)
                : [];

        let roomRoster = [];
        let roomOpponents = [];
        let combatView = null;
        let myStats = null;
        if (battle.status === "live" && player) {
            if (combatBridge && battle.roomsState) {
                const payload = combatBridge.buildCombatPayload(battle, player.roomIndex, user, {});
                if (payload.ok) {
                    combatView = {
                        roomName: payload.roomName,
                        feed: payload.match.feed,
                        best: payload.best.players || [],
                        opponents: payload.opponents,
                        roster: payload.roster,
                        myStats: payload.myStats
                    };
                    roomRoster = payload.roster || [];
                    roomOpponents = payload.opponents || [];
                    myStats = payload.myStats;
                }
            } else {
                roomOpponents = engine.playersInRoom(battle.players, player.roomIndex, {
                    viewerEmail: email,
                    clubNameFn: clubName
                });
            }
        }

        const participantCount =
            battle.status === "live"
                ? Object.values(battle.players).filter((p) => p?.alive).length
                : 0;

        const aliveCounts = engine.aliveByClub(battle.players);
        const aliveCountsNamed = {};
        for (const [cid, n] of Object.entries(aliveCounts)) {
            aliveCountsNamed[cid] = { count: n, clubName: clubName(cid) };
        }

        const roomIndex = player?.roomIndex ?? null;
        const currentRoom =
            roomIndex != null && rooms[roomIndex] ? rooms[roomIndex] : null;

        return {
            battle: {
                id: battle.id,
                status: battle.status,
                entryCost: config.ENTRY_COST_DOLLARS,
                registrationCount: battle.registrations.length,
                registrationsByClub,
                participantCount,
                registered: !!regKey,
                isParticipant,
                winnerClub: battle.winnerClub,
                winnerClubName: battle.winnerClub ? clubName(battle.winnerClub) : null,
                rooms,
                aliveByClub: aliveCountsNamed,
                startedAt: battle.startedAt,
                endedAt: battle.endedAt,
                schedule
            },
            me: {
                isParticipant,
                registered: !!regKey,
                inBattle: !!player,
                alive: !!(player && player.alive),
                eliminated: !!(player && !player.alive),
                roomIndex,
                roomName: currentRoom?.clubName || null,
                moveCooldownMs,
                canCoordWrite: coordAccess.canWrite,
                coordRankTitle: coordAccess.rankTitle || null
            },
            roomOverview,
            roomOpponents,
            roomRoster,
            myStats,
            combat: combatView,
            coordChat: (battle.coordChat || []).slice(-config.COORD_CHAT_MAX)
        };
    }

    async function register(user) {
        const email = normalizeEmail(user.email);
        if (!user.club) {
            return { ok: false, error: "Сначала выбери клуб." };
        }

        const now = Date.now();
        let battle = await loadCurrentEvent();

        if (battle?.status === "live") {
            if (battle.players[email]) {
                return { ok: false, error: "Ты уже участвуешь в текущей битве." };
            }
            return { ok: false, error: "Идёт битва. Дождись окончания, чтобы записаться снова." };
        }

        if (battle?.status === "ended" || !battle || battle.status !== "registration") {
            battle = await ensureScheduledEvent(now);
        }

        if (now < battle.registrationOpensAt) {
            return { ok: false, error: "Запись ещё не открыта." };
        }
        if (now >= battle.scheduledStartsAt) {
            return { ok: false, error: "Запись на эту битву уже закрыта." };
        }

        if (battle.registrations.some((r) => normalizeEmail(r.email) === email)) {
            return { ok: false, error: "Ты уже записан." };
        }

        const dollars = Math.max(0, Math.floor(Number(user.dollars) || 0));
        if (dollars < config.ENTRY_COST_DOLLARS) {
            return { ok: false, error: "Недостаточно долларов для участия" };
        }

        const stats = getEffectiveStats(user);
        const maxHp = calcMaxHp(stats.effective.stamina, user.level ?? 1);
        const hp = readUserHpForFight(user, maxHp);

        await runQuery("UPDATE users SET dollars = ? WHERE email = ?", [
            dollars - config.ENTRY_COST_DOLLARS,
            email
        ]);

        battle.registrations.push({
            email,
            name: user.name || "Игрок",
            club: user.club,
            hp,
            maxHp,
            level: user.level ?? 1,
            registeredAt: now
        });

        await saveBattle(battle);

        if (onMainQuestEvent) {
            await onMainQuestEvent(email, "pub_battle_register");
        }

        const updatedUser = await getQuery("SELECT * FROM users WHERE email = ?", [email]);
        const state = await buildState(updatedUser);
        return { ok: true, user: updatedUser, state };
    }

    async function startBattle(battle, now = Date.now()) {
        const clubs = battle.roomClubs?.length ? battle.roomClubs : roomClubIds();
        battle.roomClubs = clubs;
        battle.players = engine.assignRooms(battle.registrations, clubs.length);
        battle.registrations = [];
        battle.status = "live";
        battle.startedAt = now;
        battle.endedAt = 0;
        battle.winnerClub = null;

        if (combatBridge) {
            const userLoader = {};
            for (const em of Object.keys(battle.players)) {
                const row = await getQuery("SELECT * FROM users WHERE email = ?", [em]);
                if (row) {
                    row._stats = getEffectiveStats(row);
                    userLoader[em] = row;
                }
            }
            combatBridge.bootstrapRooms(battle, battle.players, userLoader);
        }

        await saveBattle(battle);
        return battle;
    }

    async function processScheduleTick(now = Date.now()) {
        await reconcileBattleState(now);
        let battle = await loadCurrentEvent(now);

        if (!battle) {
            await ensureScheduledEvent(now);
            return;
        }

        if (battle.status === "registration" && now >= battle.scheduledStartsAt) {
            battle = await startBattle(battle, now);
        }

        if (battle.status === "live" && combatBridge) {
            combatBridge.tickLiveBattle(battle, now);
            await applyPendingRageUpdates(battle);
            combatBridge.syncEliminationsToPlayers(battle);

            const winner = engine.checkWinnerClub(battle.players);
            if (winner) {
                battle.status = "ended";
                battle.winnerClub = winner;
                battle.endedAt = now;
                await saveBattle(battle);
                await ensureScheduledEvent(now);
                return;
            }
            await saveBattle(battle);
            return;
        }

        if (battle.status === "ended") {
            const openReg = await getQuery(
                "SELECT id FROM pub_battles WHERE status = 'registration' LIMIT 1"
            );
            if (!openReg) {
                await ensureScheduledEvent(now);
            }
        }
    }

    async function enterRoom(user, roomIndex) {
        const email = normalizeEmail(user.email);
        const battle = await loadCurrentEvent();
        if (!battle || battle.status !== "live") {
            return { ok: false, error: "Сейчас нет активной битвы." };
        }
        const player = battle.players[email];
        if (!player) {
            return { ok: false, error: "Ты не участвуешь в этой битве." };
        }
        if (!player.alive) {
            return { ok: false, error: "Ты выбыл из боя." };
        }

        const idx = Math.floor(Number(roomIndex));
        const maxRoom = battle.roomClubs.length - 1;
        if (!Number.isFinite(idx) || idx < 0 || idx > maxRoom) {
            return { ok: false, error: "Неверная комната." };
        }
        if (player.roomIndex !== idx) {
            return { ok: false, error: "Сначала перейди в эту комнату." };
        }

        return getCombatState(user);
    }

    async function moveRoom(user, roomIndex) {
        const email = normalizeEmail(user.email);
        const battle = await loadCurrentEvent();
        if (!battle || battle.status !== "live") {
            return { ok: false, error: "Сейчас нет активной битвы." };
        }
        const player = battle.players[email];
        const moveCheck = engine.canMoveRoom(player);
        if (!moveCheck.ok) return { ok: false, error: moveCheck.error };

        const idx = Math.floor(Number(roomIndex));
        const maxRoom = battle.roomClubs.length - 1;
        if (!Number.isFinite(idx) || idx < 0 || idx > maxRoom) {
            return { ok: false, error: "Неверная комната." };
        }
        if (player.roomIndex === idx) {
            return { ok: false, error: "Ты уже в этой комнате." };
        }

        const fromIndex = player.roomIndex;
        player.roomIndex = idx;
        player.lastMoveAt = Date.now();
        battle.players[email] = player;

        if (combatBridge && battle.roomsState) {
            const stats = getEffectiveStats(user);
            combatBridge.movePlayerBetweenRooms(battle, email, fromIndex, idx, user, stats);
        }

        await saveBattle(battle);

        const state = await buildState(user);
        return { ok: true, state };
    }

    async function loadLiveBattleForUser(email) {
        const battle = await loadCurrentEvent();
        if (!battle || battle.status !== "live") {
            return { ok: false, error: "Сейчас нет активной битвы." };
        }
        const player = battle.players[email];
        if (!player) {
            return { ok: false, error: "Ты не участвуешь в этой битве." };
        }
        return { ok: true, battle, player };
    }

    async function finalizeIfWinner(battle, now = Date.now()) {
        const winner = engine.checkWinnerClub(battle.players);
        if (!winner) return null;
        battle.status = "ended";
        battle.winnerClub = winner;
        battle.endedAt = now;
        await saveBattle(battle);
        await ensureScheduledEvent(now);
        return winner;
    }

    async function getCombatState(user, opts = {}) {
        const email = normalizeEmail(user.email);
        const loaded = await loadLiveBattleForUser(email);
        if (!loaded.ok) return loaded;
        const { battle, player } = loaded;

        if (!player.alive) {
            return { ok: false, error: "Ты выбыл из боя." };
        }

        if (
            combatBridge &&
            (!battle.roomsState || !Object.keys(battle.roomsState).length)
        ) {
            const userLoader = {};
            for (const em of Object.keys(battle.players)) {
                const row = await getQuery("SELECT * FROM users WHERE email = ?", [em]);
                if (row) {
                    row._stats = getEffectiveStats(row);
                    userLoader[em] = row;
                }
            }
            combatBridge.bootstrapRooms(battle, battle.players, userLoader);
        }

        if (combatBridge) {
            combatBridge.tickLiveBattle(battle, Date.now());
        }

        const combat = combatBridge.buildCombatPayload(battle, player.roomIndex, user, {
            refreshOpponents: !!opts.refreshOpponents,
            bestPage: opts.bestPage
        });

        await finalizeIfWinner(battle);
        await saveBattle(battle);

        const state = await buildState(user);
        return { ok: true, combat, state };
    }

    async function refreshOpponents(user) {
        return getCombatState(user, { refreshOpponents: true });
    }

    async function playerStrike(user, targetId, attackType, attackOpts = {}) {
        const email = normalizeEmail(user.email);
        const loaded = await loadLiveBattleForUser(email);
        if (!loaded.ok) return loaded;
        const { battle, player } = loaded;

        if (!player.alive) {
            return { ok: false, error: "Ты выбыл из боя." };
        }
        if (!combatBridge) {
            return { ok: false, error: "Бой недоступен." };
        }

        const freshRow = await getQuery(
            "SELECT rage, consumables, consumables_used_at, hp FROM users WHERE email = ?",
            [email]
        );
        user.rage = clampRage(freshRow?.rage ?? user.rage);
        user.hp = freshRow?.hp ?? user.hp;
        user.consumables = provisionsData.countsFromConsumables(
            engine.parseJson(freshRow?.consumables, {})
        );
        const consumablesUsedAt = provisionsData.parseConsumablesUsedAtRaw(freshRow?.consumables_used_at);

        const stats = getEffectiveStats(user);
        const out = combatBridge.playerStrike(
            battle,
            player.roomIndex,
            user,
            stats,
            targetId,
            attackType || "normal",
            {
                gadgetId: attackOpts.gadgetId,
                consumables: user.consumables,
                consumablesUsedAt
            }
        );

        if (!out.ok) {
            if (out.consumables) {
                await runQuery("UPDATE users SET consumables = ? WHERE email = ?", [
                    JSON.stringify(out.consumables),
                    email
                ]);
                user.consumables = out.consumables;
            }
            return out;
        }

        if (out.consumables) {
            let nextUsedAt = consumablesUsedAt;
            if (out.provisionUsedId) {
                nextUsedAt = provisionsData.stampProvisionUsed(
                    consumablesUsedAt,
                    out.provisionUsedId,
                    out.provisionUsedAt || Date.now()
                );
            }
            await runQuery(
                "UPDATE users SET consumables = ?, consumables_used_at = ? WHERE email = ?",
                [JSON.stringify(out.consumables), JSON.stringify(nextUsedAt), email]
            );
            user.consumables = out.consumables;
        }
        if (out.userHp != null) {
            const hp = Math.max(0, Math.round(out.userHp));
            await runQuery("UPDATE users SET hp = ? WHERE email = ?", [hp, email]);
            user.hp = hp;
        }

        let repEarned = 0;
        let mercedesBoost = false;
        if (out.result?.rep > 0 && repEarningsService?.grantPlayerReputation) {
            const grant = await repEarningsService.grantPlayerReputation({
                email,
                baseRep: out.result.rep,
                source: "pub_battle",
                club: user.club,
                prevReputation: user.reputation ?? 0,
                talismansRaw: user.talismans
            });
            repEarned = grant.repGain || 0;
            mercedesBoost = !!grant.mercedesBoost;
            if (repEarned > 0) {
                user.reputation = (user.reputation ?? 0) + repEarned;
                user.skulls = (user.skulls ?? 0) + (grant.skullsEarned || 0);
            }
        }

        if (out.result?.newFury != null) {
            await runQuery("UPDATE users SET rage = ? WHERE email = ?", [out.result.newFury, email]);
            user.rage = out.result.newFury;
        } else if (out.strikeFlash) {
            const room = battle.roomsState[String(player.roomIndex)];
            const att = room?.fighters?.find((f) => f.email === email);
            if (att) {
                await runQuery("UPDATE users SET rage = ? WHERE email = ?", [att.fury, email]);
                user.rage = att.fury;
            }
        }

        if (out.result?.defenderNewRage != null) {
            const room = battle.roomsState[String(player.roomIndex)];
            const defender = room?.fighters?.find((f) => f.id === targetId || f.email === targetId);
            if (defender?.email) {
                const defEmail = String(defender.email).toLowerCase();
                await runQuery("UPDATE users SET rage = ? WHERE email = ?", [
                    out.result.defenderNewRage,
                    defEmail
                ]);
                if (defEmail === email) {
                    user.rage = out.result.defenderNewRage;
                }
            }
        }

        await applyPendingRageUpdates(battle);

        combatBridge.syncEliminationsToPlayers(battle);
        const winner = await finalizeIfWinner(battle);
        await saveBattle(battle);

        const state = await buildState(user);
        const combat = combatBridge.buildCombatPayload(battle, player.roomIndex, user, {});

        return {
            ok: true,
            state,
            combat,
            strikeFlash: out.strikeFlash,
            repEarned,
            mercedesBoost,
            gadgets: provisionsData.catalogOwnedForClient(out.consumables || user.consumables),
            battleEnded: !!winner,
            winnerClubName: winner ? clubName(winner) : null
        };
    }

    /** @deprecated — используй playerStrike */
    async function attack(user, targetEmail) {
        const battle = await loadCurrentEvent();
        if (!battle?.roomsState) {
            return { ok: false, error: "Используй удар через стадионный бой." };
        }
        const email = normalizeEmail(user.email);
        const player = battle.players[email];
        const target = normalizeEmail(targetEmail);
        const room = battle.roomsState[String(player?.roomIndex)];
        const fighter = room?.fighters?.find((f) => f.email === target);
        if (!fighter) return { ok: false, error: "Противник не найден." };
        return playerStrike(user, fighter.id, "normal");
    }

    async function postCoordMessage(user, text) {
        const email = normalizeEmail(user.email);
        if (!user.club) {
            return { ok: false, error: "Сначала выбери клуб." };
        }

        const battle = await loadLatestBattle();
        if (!battle || battle.status !== "live") {
            return { ok: false, error: "Чат координации доступен во время битвы." };
        }

        const access = await getCoordWriteAccess(email, user.club);
        if (!access.canWrite) {
            return { ok: false, error: "Писать могут только лидер и помощники клуба." };
        }

        const body = String(text || "").trim();
        if (!body) return { ok: false, error: "Пустое сообщение." };
        if (body.length > config.COORD_MESSAGE_MAX) {
            return { ok: false, error: `До ${config.COORD_MESSAGE_MAX} символов.` };
        }

        const msg = {
            id: crypto.randomBytes(6).toString("hex"),
            email,
            name: user.name || "Игрок",
            club: user.club,
            clubName: clubName(user.club),
            rankTitle: access.rankTitle || "",
            text: body,
            at: Date.now()
        };

        battle.coordChat = (battle.coordChat || []).concat(msg);
        if (battle.coordChat.length > config.COORD_CHAT_MAX) {
            battle.coordChat = battle.coordChat.slice(-config.COORD_CHAT_MAX);
        }
        await saveBattle(battle);

        const state = await buildState(user);
        return { ok: true, state, message: msg };
    }

    return {
        buildState,
        register,
        moveRoom,
        enterRoom,
        getCombatState,
        refreshOpponents,
        playerStrike,
        attack,
        postCoordMessage,
        loadLatestBattle,
        loadCurrentEvent,
        ensureScheduledEvent,
        startBattle,
        processScheduleTick,
        reconcileBattleState,
        resetForTesting,
        saveBattle
    };
}

module.exports = { createPubBattleService };
