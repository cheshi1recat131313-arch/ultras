/**
 * Обзор комнат «Битвы за Паб».
 */

function buildRoomOverview(battle, opts = {}) {
    const clubNameFn = opts.clubNameFn || ((id) => id || "—");
    const viewerEmail = opts.viewerEmail ? String(opts.viewerEmail).toLowerCase() : "";
    const clubIds = battle.roomClubs || [];
    const player = viewerEmail ? battle.players?.[viewerEmail] : null;
    const battleLive = battle.status === "live";

    return clubIds.map((clubId, index) => {
        const room = battle.roomsState?.[String(index)];
        const alivePlayers = battleLive
            ? Object.values(battle.players || {}).filter(
                  (p) => p && p.alive && p.roomIndex === index
              )
            : [];

        const clubsMap = {};
        for (const p of alivePlayers) {
            if (!p.club) continue;
            if (!clubsMap[p.club]) {
                clubsMap[p.club] = { id: p.club, name: clubNameFn(p.club), playerCount: 0 };
            }
            clubsMap[p.club].playerCount += 1;
        }

        const fighterCount = room?.fighters?.filter((f) => f.alive).length ?? alivePlayers.length;
        const waiting = battle.status === "registration";

        return {
            index,
            clubId,
            clubName: clubNameFn(clubId),
            title: `Комната «${clubNameFn(clubId)}»`,
            playerCount: waiting ? 0 : alivePlayers.length,
            fighterCount: waiting ? 0 : fighterCount,
            clubs: waiting ? [] : Object.values(clubsMap),
            clubsLabel: waiting
                ? "Распределение при старте"
                : Object.values(clubsMap)
                      .map((c) => `${c.name} (${c.playerCount})`)
                      .join(", ") || "—",
            isMyRoom: battleLive && player?.alive && player.roomIndex === index,
            status: waiting ? "waiting" : room?.status || "idle",
            canEnter: battleLive && player?.alive && player.roomIndex === index,
            canMoveHere:
                battleLive &&
                player?.alive &&
                player.roomIndex !== index &&
                (opts.moveCooldownMs == null || opts.moveCooldownMs <= 0)
        };
    });
}

module.exports = { buildRoomOverview };
