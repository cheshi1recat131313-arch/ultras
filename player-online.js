/**
 * Онлайн-статус игроков: активность по last_active_at в SQLite.
 * Игрок «в игре», если был активен за последние PLAYER_ONLINE_MS.
 */

/** Окно онлайна (10 минут). */
const PLAYER_ONLINE_MS = 10 * 60 * 1000;

/** Не чаще раза в минуту обновляем last_active_at в БД. */
const PLAYER_ACTIVITY_TOUCH_MS = 60 * 1000;

function isPlayerOnline(lastActiveAt, now = Date.now()) {
    const t = Math.floor(Number(lastActiveAt) || 0);
    if (t <= 0) return false;
    return now - t < PLAYER_ONLINE_MS;
}

function onlineSinceTimestamp(now = Date.now()) {
    return now - PLAYER_ONLINE_MS;
}

function playerStatusLabel(online) {
    return online ? "💡 В игре" : "⚫ Не в игре";
}

module.exports = {
    PLAYER_ONLINE_MS,
    PLAYER_ACTIVITY_TOUCH_MS,
    isPlayerOnline,
    onlineSinceTimestamp,
    playerStatusLabel,
    /** @deprecated используйте isPlayerOnline */
    isPlayerInGame: isPlayerOnline
};
