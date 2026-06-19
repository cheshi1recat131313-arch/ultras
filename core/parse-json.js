/**
 * Общий разбор JSON из SQLite (поля TEXT).
 */

function parseJson(value, fallback) {
    try {
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
}

module.exports = { parseJson };
