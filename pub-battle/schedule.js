/**
 * Расписание «Битвы за Паб».
 */

const config = require("./config");

function atLocalTime(date, hour, minute) {
    const d = new Date(date);
    d.setHours(hour, minute, 0, 0);
    return d.getTime();
}

/** Следующий запланированный старт (мс). */
function computeNextScheduledStart(now = Date.now()) {
    if (config.PUB_BATTLE_TEST_MODE) {
        const today = atLocalTime(now, config.PUB_BATTLE_TEST_HOUR, config.PUB_BATTLE_TEST_MINUTE);
        if (today > now) return today;
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return atLocalTime(tomorrow, config.PUB_BATTLE_TEST_HOUR, config.PUB_BATTLE_TEST_MINUTE);
    }

    const d = new Date(now);
    const day = d.getDay();
    let daysUntil = (config.PUB_BATTLE_PROD_WEEKDAY - day + 7) % 7;
    const candidate = new Date(d);
    candidate.setDate(candidate.getDate() + daysUntil);
    let startMs = atLocalTime(
        candidate,
        config.PUB_BATTLE_PROD_HOUR,
        config.PUB_BATTLE_PROD_MINUTE
    );
    if (startMs <= now) {
        candidate.setDate(candidate.getDate() + 7);
        startMs = atLocalTime(
            candidate,
            config.PUB_BATTLE_PROD_HOUR,
            config.PUB_BATTLE_PROD_MINUTE
        );
    }
    return startMs;
}

function computeRegistrationOpens(scheduledStartsAt) {
    return Math.max(0, scheduledStartsAt - config.REGISTRATION_OPEN_BEFORE_MS);
}

function formatScheduleLabel(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Полная дата для баннера ожидания: 14-06-2026 19:00:00 */
function formatScheduleFull(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatCountdown(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function scheduleInfoForBattle(battle, now = Date.now()) {
    const opensAt = Number(battle.registrationOpensAt) || 0;
    const startsAt = Number(battle.scheduledStartsAt) || 0;
    const registrationOpen = now >= opensAt && now < startsAt;
    const untilStart = Math.max(0, startsAt - now);
    const untilOpens = Math.max(0, opensAt - now);

    return {
        registrationOpensAt: opensAt,
        scheduledStartsAt: startsAt,
        registrationOpensLabel: formatScheduleLabel(opensAt),
        scheduledStartsLabel: formatScheduleLabel(startsAt),
        scheduledStartsFull: formatScheduleFull(startsAt),
        registrationOpen,
        msUntilStart: untilStart,
        msUntilRegistrationOpens: untilOpens,
        countdownToStart: formatCountdown(untilStart),
        countdownToRegistration: formatCountdown(untilOpens),
        testMode: config.PUB_BATTLE_TEST_MODE
    };
}

module.exports = {
    computeNextScheduledStart,
    computeRegistrationOpens,
    formatScheduleLabel,
    formatScheduleFull,
    formatCountdown,
    scheduleInfoForBattle
};
