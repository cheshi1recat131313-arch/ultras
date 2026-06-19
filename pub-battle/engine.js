/**
 * «Битва за Паб» — чистая логика состояния (без БД).
 */

const config = require("./config");

function parseJson(raw, fallback) {
    if (raw == null || raw === "") return fallback;
    try {
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function battleRoomClubs(roomClubsJson) {
    const clubs = parseJson(roomClubsJson, []);
    return Array.isArray(clubs) ? clubs : [];
}

function battlePlayers(playersJson) {
    const obj = parseJson(playersJson, {});
    return obj && typeof obj === "object" ? obj : {};
}

function battleCoordChat(coordJson) {
    const arr = parseJson(coordJson, []);
    return Array.isArray(arr) ? arr : [];
}

function battleRoomsState(roomsJson) {
    const obj = parseJson(roomsJson, {});
    return obj && typeof obj === "object" ? obj : {};
}

function battleMeta(metaJson) {
    const obj = parseJson(metaJson, {});
    return obj && typeof obj === "object" ? obj : {};
}

function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** Случайное распределение записавшихся по комнатам (индекс 0..n-1). */
function assignRooms(registrations, roomCount) {
    const shuffled = shuffle(registrations);
    const out = {};
    shuffled.forEach((reg) => {
        const email = String(reg.email || "").toLowerCase();
        if (!email) return;
        out[email] = {
            email,
            name: reg.name || "Игрок",
            club: reg.club || "",
            roomIndex: Math.floor(Math.random() * Math.max(1, roomCount)),
            hp: Math.max(1, Math.round(Number(reg.hp) || 100)),
            maxHp: Math.max(1, Math.round(Number(reg.maxHp) || 100)),
            alive: true,
            lastMoveAt: 0
        };
    });
    return out;
}

function aliveByClub(players) {
    const counts = {};
    for (const p of Object.values(players)) {
        if (!p || !p.alive || !p.club) continue;
        counts[p.club] = (counts[p.club] || 0) + 1;
    }
    return counts;
}

function checkWinnerClub(players) {
    const counts = aliveByClub(players);
    const clubs = Object.keys(counts).filter((c) => counts[c] > 0);
    if (clubs.length === 1) return clubs[0];
    return null;
}

function canMoveRoom(player, now = Date.now()) {
    if (!player || !player.alive) return { ok: false, error: "Ты выбыл из боя." };
    const last = Math.max(0, Number(player.lastMoveAt) || 0);
    const wait = config.ROOM_MOVE_COOLDOWN_MS - (now - last);
    if (last > 0 && wait > 0) {
        return { ok: false, error: `Переход возможен через ${Math.ceil(wait / 1000)} сек.` };
    }
    return { ok: true };
}

function moveCooldownMs(player, now = Date.now()) {
    const last = Math.max(0, Number(player.lastMoveAt) || 0);
    if (!last) return 0;
    return Math.max(0, config.ROOM_MOVE_COOLDOWN_MS - (now - last));
}

function playersInRoom(players, roomIndex, opts = {}) {
    const email = opts.viewerEmail ? String(opts.viewerEmail).toLowerCase() : "";
    return Object.values(players)
        .filter((p) => p && p.alive && p.roomIndex === roomIndex)
        .map((p) => ({
            email: p.email,
            name: p.name,
            club: p.club,
            clubName: opts.clubNameFn ? opts.clubNameFn(p.club) : p.club,
            hp: p.hp,
            maxHp: p.maxHp,
            isMe: email && p.email === email
        }));
}

function canAttack(attacker, defender) {
    if (!attacker || !attacker.alive) return { ok: false, error: "Ты выбыл из боя." };
    if (!defender || !defender.alive) return { ok: false, error: "Противник уже выбыл." };
    if (attacker.email === defender.email) return { ok: false, error: "Нельзя атаковать себя." };
    if (attacker.club && defender.club && attacker.club === defender.club) {
        return { ok: false, error: "Нельзя атаковать своих." };
    }
    if (attacker.roomIndex !== defender.roomIndex) {
        return { ok: false, error: "Противник в другой комнате." };
    }
    return { ok: true };
}

function registrationByClub(registrations, clubIds, clubNameFn) {
    const counts = {};
    for (const id of clubIds || []) {
        counts[id] = 0;
    }
    for (const r of registrations || []) {
        const club = r.club;
        if (!club) continue;
        counts[club] = (counts[club] || 0) + 1;
    }
    return (clubIds || []).map((id) => ({
        id,
        name: clubNameFn ? clubNameFn(id) : id,
        count: counts[id] || 0
    }));
}

function registrationOpen(now, battle) {
    const opens = Number(battle.registrationOpensAt) || 0;
    const starts = Number(battle.scheduledStartsAt) || 0;
    if (!opens || !starts) return false;
    return now >= opens && now < starts;
}

function msUntilStart(now, battle) {
    const starts = Number(battle.scheduledStartsAt) || 0;
    if (!starts) return 0;
    return Math.max(0, starts - now);
}

function msUntilRegistrationOpens(now, battle) {
    const opens = Number(battle.registrationOpensAt) || 0;
    if (!opens) return 0;
    return Math.max(0, opens - now);
}

module.exports = {
    parseJson,
    battleRoomClubs,
    battlePlayers,
    battleCoordChat,
    battleRoomsState,
    battleMeta,
    assignRooms,
    aliveByClub,
    checkWinnerClub,
    canMoveRoom,
    moveCooldownMs,
    playersInRoom,
    canAttack,
    registrationByClub,
    registrationOpen,
    msUntilStart,
    msUntilRegistrationOpens,
    shuffle
};
