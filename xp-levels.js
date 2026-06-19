/**
 * Таблица уровней: минимальный суммарный опыт для каждого уровня.
 * LEVEL_XP_AT[0] = 0 → уровень 1, [1] = 10 → уровень 2, [2] = 50 → уровень 3, …
 * Чтобы добавить уровни — допишите пороги в массив.
 */
/** Пороги суммарного опыта: ур.2 = 10, ур.3 = 50, дальше — дописать в массив. */
const LEVEL_XP_AT = [0, 10, 50, 120, 250, 500];

function normalizeXp(xp) {
    return Math.max(0, Math.floor(Number(xp) || 0));
}

function levelFromXp(xp) {
    const total = normalizeXp(xp);
    let level = 1;
    for (let i = LEVEL_XP_AT.length - 1; i >= 0; i -= 1) {
        if (total >= LEVEL_XP_AT[i]) {
            level = i + 1;
            break;
        }
    }
    return level;
}

function xpThresholdForLevel(level) {
    const lv = Math.max(1, Math.floor(Number(level) || 1));
    if (lv <= LEVEL_XP_AT.length) {
        return LEVEL_XP_AT[lv - 1];
    }
    const last = LEVEL_XP_AT[LEVEL_XP_AT.length - 1];
    const extra = lv - LEVEL_XP_AT.length;
    return last + extra * 100;
}

function xpNeededForNextLevel(level) {
    const lv = Math.max(1, Math.floor(Number(level) || 1));
    if (lv < LEVEL_XP_AT.length) {
        return Math.max(1, LEVEL_XP_AT[lv] - LEVEL_XP_AT[lv - 1]);
    }
    return 100;
}

function xpProgressFromTotals(xp, levelHint) {
    const totalXp = normalizeXp(xp);
    const level = levelFromXp(totalXp);
    const floor = xpThresholdForLevel(level);
    const hasNext = level < LEVEL_XP_AT.length || level >= LEVEL_XP_AT.length;
    const ceil =
        level < LEVEL_XP_AT.length
            ? LEVEL_XP_AT[level]
            : xpThresholdForLevel(level + 1);
    const need = Math.max(1, ceil - floor);
    const cur = Math.max(0, Math.min(need, totalXp - floor));
    const percent = need > 0 ? Math.min(99, Math.round((cur / need) * 100)) : 0;
    return {
        cur,
        need,
        totalXp,
        level: levelHint != null ? levelFromXp(totalXp) : level,
        percent,
        isMax: level >= LEVEL_XP_AT.length && totalXp >= LEVEL_XP_AT[LEVEL_XP_AT.length - 1]
    };
}

function xpPercentLabel(user) {
    const p = user && user.xpProgress;
    if (p && typeof p.percent === "number") {
        const lv = user.level ?? p.level ?? 1;
        return `${lv}(${p.percent}%)`;
    }
    const prog = xpProgressFromTotals(user?.xp ?? 0);
    const lv = user?.level ?? prog.level;
    return `${lv}(${prog.percent}%)`;
}

module.exports = {
    LEVEL_XP_AT,
    normalizeXp,
    levelFromXp,
    xpThresholdForLevel,
    xpNeededForNextLevel,
    xpProgressFromTotals,
    xpPercentLabel
};
