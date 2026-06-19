/**
 * Сейф — хранение серебра отдельно от кошелька.
 */

const SAFE_MAX_LEVEL = 10;

/** Максимум хранения по уровню сейфа (0…10). */
const CAPACITY_BY_LEVEL = [50, 100, 200, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];

const UPGRADE_COST_DOLLARS = 1;

function normalizeLevel(level) {
    return Math.max(0, Math.min(SAFE_MAX_LEVEL, Math.floor(Number(level) || 0)));
}

function capacityForLevel(level) {
    return CAPACITY_BY_LEVEL[normalizeLevel(level)];
}

function nextLevelCapacity(level) {
    const lv = normalizeLevel(level);
    if (lv >= SAFE_MAX_LEVEL) return null;
    return CAPACITY_BY_LEVEL[lv + 1];
}

function upgradeCostForLevel(level) {
    if (normalizeLevel(level) >= SAFE_MAX_LEVEL) return null;
    return UPGRADE_COST_DOLLARS;
}

function normalizeBalance(value) {
    return Math.max(0, Math.floor(Number(value) || 0));
}

function buildSafeState(row) {
    const safeLevel = normalizeLevel(row?.safe_level);
    const safeBalance = normalizeBalance(row?.safe_balance);
    const capacity = capacityForLevel(safeLevel);
    const nextCapacity = nextLevelCapacity(safeLevel);
    const upgradeCost = upgradeCostForLevel(safeLevel);
    const walletRubles = Math.max(0, Math.floor(Number(row?.rubles ?? row?.money) || 0));

    return {
        safeLevel,
        safeBalance,
        capacity,
        freeSpace: Math.max(0, capacity - safeBalance),
        nextLevel: safeLevel < SAFE_MAX_LEVEL ? safeLevel + 1 : null,
        nextCapacity,
        upgradeCost,
        canUpgrade: safeLevel < SAFE_MAX_LEVEL,
        walletRubles
    };
}

module.exports = {
    SAFE_MAX_LEVEL,
    CAPACITY_BY_LEVEL,
    UPGRADE_COST_DOLLARS,
    normalizeLevel,
    capacityForLevel,
    nextLevelCapacity,
    upgradeCostForLevel,
    normalizeBalance,
    buildSafeState
};
