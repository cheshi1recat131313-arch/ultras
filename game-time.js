/**
 * Игровое время — Europe/Kyiv.
 */

const GAME_TZ = "Europe/Kyiv";

function kyivParts(date = new Date()) {
    const fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: GAME_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    });
    const parts = {};
    for (const p of fmt.formatToParts(date)) {
        if (p.type !== "literal") parts[p.type] = p.value;
    }
    return {
        year: +parts.year,
        month: +parts.month,
        day: +parts.day,
        hour: +parts.hour,
        minute: +parts.minute,
        second: +parts.second
    };
}

function kyivLocalToUtcMs(year, month, day, hour, minute = 0, second = 0) {
    let t = Date.UTC(year, month - 1, day, hour - 2, minute, second);
    for (let i = 0; i < 8; i += 1) {
        const p = kyivParts(new Date(t));
        if (
            p.year === year &&
            p.month === month &&
            p.day === day &&
            p.hour === hour &&
            p.minute === minute &&
            p.second === second
        ) {
            return t;
        }
        const targetOrd = year * 10000 + month * 100 + day;
        const curOrd = p.year * 10000 + p.month * 100 + p.day;
        const dayDiff = targetOrd - curOrd;
        const secDiff =
            dayDiff * 86400 + (hour - p.hour) * 3600 + (minute - p.minute) * 60 + (second - p.second);
        t += secDiff * 1000;
    }
    return t;
}

function addKyivDays(parts, days) {
    const noon = kyivLocalToUtcMs(parts.year, parts.month, parts.day, 12, 0, 0);
    return kyivParts(new Date(noon + days * 86400000));
}

function formatGameClock(ms = Date.now()) {
    return new Intl.DateTimeFormat("ru-RU", {
        timeZone: GAME_TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).format(new Date(ms));
}

function formatGameDateTime(ms, opts = {}) {
    const options = {
        timeZone: GAME_TZ,
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    };
    if (opts.date !== false) {
        options.year = opts.shortYear ? "2-digit" : "numeric";
    }
    return new Intl.DateTimeFormat("ru-RU", options).format(new Date(ms));
}

function formatGameEventTimestamp(ms) {
    const p = kyivParts(new Date(ms));
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(p.day)}.${pad(p.month)}.${String(p.year).slice(-2)} ${pad(p.hour)}:${pad(p.minute)}`;
}

function nextKyivSlotAfter(now, hours) {
    const list = Array.isArray(hours) ? hours : [hours];
    const p = kyivParts(new Date(now));
    const candidates = [];
    for (const h of list) {
        const t = kyivLocalToUtcMs(p.year, p.month, p.day, h, 0, 0);
        if (t > now) candidates.push(t);
    }
    if (candidates.length) return Math.min(...candidates);
    const next = addKyivDays(p, 1);
    return kyivLocalToUtcMs(next.year, next.month, next.day, list[0], 0, 0);
}

/** Ключ календарного дня Europe/Kyiv: YYYY-MM-DD */
function getKyivDayKey(ts = Date.now()) {
    const p = kyivParts(new Date(ts));
    const pad = (n) => String(n).padStart(2, "0");
    return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Границы суток 00:00–24:00 Europe/Kyiv (UTC ms). */
function getKyivDayBounds(ts = Date.now()) {
    const p = kyivParts(new Date(ts));
    const startMs = kyivLocalToUtcMs(p.year, p.month, p.day, 0, 0, 0);
    return {
        dayKey: getKyivDayKey(ts),
        startMs,
        endMs: startMs + 24 * 60 * 60 * 1000
    };
}

function kyivDayKeyToStartMs(dayKey) {
    const parts = String(dayKey || "")
        .trim()
        .split("-")
        .map((n) => Number(n));
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
        return getKyivDayBounds().startMs;
    }
    return kyivLocalToUtcMs(parts[0], parts[1], parts[2], 0, 0, 0);
}

function msUntilNextKyivMidnight(ts = Date.now()) {
    const p = kyivParts(new Date(ts));
    const next = addKyivDays(p, 1);
    const nextMidnight = kyivLocalToUtcMs(next.year, next.month, next.day, 0, 0, 0);
    return Math.max(1000, nextMidnight - ts);
}

module.exports = {
    GAME_TZ,
    kyivParts,
    kyivLocalToUtcMs,
    addKyivDays,
    formatGameClock,
    formatGameDateTime,
    formatGameEventTimestamp,
    nextKyivSlotAfter,
    getKyivDayKey,
    getKyivDayBounds,
    kyivDayKeyToStartMs,
    msUntilNextKyivMidnight
};
