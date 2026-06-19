/**
 * Потеря наличного серебра при поражении (район, PvP и т.д.).
 * В расчёт попадает только кошелёк — safe_balance хранится отдельно.
 */

function randomInt(min, max) {
    const lo = Math.floor(min);
    const hi = Math.floor(max);
    if (hi < lo) return lo;
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/** Наличные на руках — только кошелёк (серебро в сейфе не учитывается). */
function getCashOnHand(userOrRubles) {
    if (userOrRubles != null && typeof userOrRubles === "object") {
        const u = userOrRubles;
        return Math.max(0, Math.floor(Number(u.rubles ?? u.money) || 0));
    }
    return Math.max(0, Math.floor(Number(userOrRubles) || 0));
}

/**
 * Диапазон потери для заданной суммы на руках (без броска).
 * @returns {{ min: number, max: number }}
 */
function getSilverLossRange(cashOnHand) {
    const onHand = Math.max(0, Math.floor(Number(cashOnHand) || 0));
    if (onHand <= 0) return { min: 0, max: 0 };
    if (onHand <= 50) return { min: 1, max: 5 };
    if (onHand <= 100) return { min: 3, max: 10 };
    if (onHand <= 300) return { min: 5, max: 25 };
    if (onHand <= 1000) return { min: 10, max: 80 };
    const min = Math.max(10, Math.floor(onHand * 0.06));
    const max = Math.max(min, Math.floor(onHand * 0.1));
    return { min, max };
}

/**
 * Сколько серебра теряется при поражении.
 * @param {number|object} cashOnHand — сумма на руках или объект пользователя
 * @param {{ safeBalance?: number, randomInt?: (min: number, max: number) => number }} [options]
 * @returns {number} 0…cashOnHand, баланс не уходит в минус
 */
function calcSilverLossOnDefeat(cashOnHand, options = {}) {
    let onHand;
    if (cashOnHand != null && typeof cashOnHand === "object") {
        onHand = getCashOnHand(cashOnHand);
    } else {
        onHand = Math.max(0, Math.floor(Number(cashOnHand) || 0));
    }

    if (onHand <= 0) return 0;

    const { min, max } = getSilverLossRange(onHand);
    const rollFn = typeof options.randomInt === "function" ? options.randomInt : randomInt;
    const rolled = rollFn(min, max);
    return Math.min(onHand, Math.max(0, Math.floor(rolled)));
}

module.exports = {
    getCashOnHand,
    getSilverLossRange,
    calcSilverLossOnDefeat,
    randomInt
};
