/**
 * «Счастливый час» — коробки при входе в игру.
 * Кулдаун 4 ч после награды; не более 4 раз в календарные сутки (сброс в 00:00).
 */

const MAX_CLAIMS_PER_DAY = 4;
const COOLDOWN_MS = 4 * 60 * 60 * 1000;
const JACKPOT_CHANCE = 0.015;
const JACKPOT_DOLLARS = 10;
const NORMAL_PRIZES = [1, 2, 3];

function getDayKey(ts = Date.now()) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function normalizeDailyState(user, now = Date.now()) {
    const dayKey = getDayKey(now);
    const storedDay = String(user?.happy_hour_day ?? user?.happyHourDay ?? "").trim();
    let claims = Math.max(0, Math.floor(Number(user?.happy_hour_claims ?? user?.happyHourClaims) || 0));
    if (storedDay !== dayKey) {
        claims = 0;
    }
    return {
        dayKey,
        claims,
        claimsRemaining: Math.max(0, MAX_CLAIMS_PER_DAY - claims),
        canClaimToday: claims < MAX_CLAIMS_PER_DAY
    };
}

function getCooldownUntil(user) {
    return Math.max(0, Math.floor(Number(user?.happy_hour_cooldown_until ?? user?.happyHourCooldownUntil) || 0));
}

/**
 * Полное состояние для проверки показа окна.
 */
function evaluateHappyHourState(user, now = Date.now()) {
    const daily = normalizeDailyState(user, now);
    const cooldownUntil = getCooldownUntil(user);
    const onCooldown = cooldownUntil > now;
    const canShow = daily.canClaimToday && !onCooldown;

    return {
        ...daily,
        cooldownUntil,
        onCooldown,
        cooldownRemainingMs: onCooldown ? cooldownUntil - now : 0,
        canShow,
        maxClaims: MAX_CLAIMS_PER_DAY
    };
}

function nextCooldownUntil(now = Date.now()) {
    return now + COOLDOWN_MS;
}

function rollPrize(random = Math.random) {
    if (random() < JACKPOT_CHANCE) {
        return { dollars: JACKPOT_DOLLARS, jackpot: true };
    }
    const dollars = NORMAL_PRIZES[Math.floor(random() * NORMAL_PRIZES.length)];
    return { dollars, jackpot: false };
}

module.exports = {
    MAX_CLAIMS_PER_DAY,
    COOLDOWN_MS,
    JACKPOT_CHANCE,
    JACKPOT_DOLLARS,
    getDayKey,
    normalizeDailyState,
    evaluateHappyHourState,
    nextCooldownUntil,
    rollPrize
};
