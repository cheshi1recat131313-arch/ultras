/**
 * Общий чат «Паб» — одна комната для всех игроков.
 */

const MAX_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 200;
const SEND_COOLDOWN_MS = 5000;

const { formatGameClock } = require("./game-time");

function formatChatTime(ms) {
    return formatGameClock(ms);
}

function normalizeMessage(text) {
    return String(text ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_MESSAGE_LENGTH);
}

function validateMessage(text) {
    const msg = normalizeMessage(text);
    if (!msg) {
        return { ok: false, error: "Сообщение не может быть пустым" };
    }
    return { ok: true, message: msg };
}

function rowToMessage(row) {
    return {
        id: row.id,
        email: row.email ? String(row.email).toLowerCase() : null,
        playerName: row.player_name,
        message: row.message,
        createdAt: row.created_at,
        timeLabel: formatChatTime(row.created_at)
    };
}

module.exports = {
    MAX_MESSAGES,
    MAX_MESSAGE_LENGTH,
    SEND_COOLDOWN_MS,
    formatChatTime,
    normalizeMessage,
    validateMessage,
    rowToMessage
};
