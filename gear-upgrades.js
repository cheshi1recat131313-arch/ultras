/**
 * Улучшение шмота (Коллайдер / Швейный цех).
 * Покупка = 1★, максимум = 3★ (как в Hools). Стоимость и время — из каталога предмета.
 */

const { MAX_GEAR_STARS, chainBonusAtLevel } = require("./gear-catalog");

const MAX_GEAR_LEVEL = MAX_GEAR_STARS;

const UPGRADE_SLOTS = {
    weapon: { stat: "power", maxLevel: MAX_GEAR_LEVEL },
    clothes: { stat: "stamina", maxLevel: MAX_GEAR_LEVEL },
    boots: { stat: "speed", maxLevel: MAX_GEAR_LEVEL },
    head: { stat: "intel", maxLevel: MAX_GEAR_LEVEL }
};

function capLevel(level, maxLevel = MAX_GEAR_LEVEL) {
    return Math.max(1, Math.min(maxLevel, Math.floor(Number(level) || 1)));
}

function parseUpgrades(raw) {
    if (!raw || typeof raw !== "object") return {};
    const out = {};
    for (const [id, v] of Object.entries(raw)) {
        if (!v || typeof v !== "object") continue;
        out[id] = {
            level: capLevel(v.level),
            until: Math.max(0, Math.floor(Number(v.until) || 0))
        };
    }
    return out;
}

function slotRulesForItem(shopDef) {
    if (!shopDef) return UPGRADE_SLOTS.weapon;
    if (shopDef.slot && UPGRADE_SLOTS[shopDef.slot]) return UPGRADE_SLOTS[shopDef.slot];
    if (shopDef.primaryStat) {
        for (const [slot, rules] of Object.entries(UPGRADE_SLOTS)) {
            if (rules.stat === shopDef.primaryStat) return rules;
        }
    }
    return UPGRADE_SLOTS.weapon;
}

function maxLevelForItem(shopDef) {
    if (shopDef && Number.isFinite(Number(shopDef.maxLevel))) {
        return capLevel(shopDef.maxLevel, 99);
    }
    return slotRulesForItem(shopDef).maxLevel;
}

function upgradeStepsForItem(shopDef) {
    if (Array.isArray(shopDef?.upgradeSteps) && shopDef.upgradeSteps.length) {
        return shopDef.upgradeSteps;
    }
    const max = maxLevelForItem(shopDef);
    const rules = slotRulesForItem(shopDef);
    const steps = [];
    for (let lv = 1; lv < max; lv += 1) {
        steps.push({
            costDollars: rules.stat === "power" ? lv : lv + 1,
            durationMs: (rules.stat === "power" ? 30 : 45) * 60 * 1000 * lv
        });
    }
    return steps;
}

function upgradeStepAtLevel(shopDef, level) {
    const steps = upgradeStepsForItem(shopDef);
    const idx = Math.max(0, Math.min(steps.length - 1, capLevel(level, maxLevelForItem(shopDef)) - 1));
    return steps[idx] || { costDollars: 1, durationMs: 30 * 60 * 1000 };
}

function starsForLevel(level, maxLevel = MAX_GEAR_LEVEL) {
    return capLevel(level, maxLevel);
}

function starsDisplay(level, maxLevel = MAX_GEAR_LEVEL) {
    return "★".repeat(starsForLevel(level, maxLevel));
}

function maxUpgradeMessage(shopDef) {
    if (shopDef?.slot === "weapon") return "Оружие прокачано максимально.";
    if (shopDef?.slot === "boots") return "Обувь прокачана максимально.";
    if (shopDef?.slot === "head") return "Головной убор прокачан максимально.";
    return "Предмет прокачан максимально.";
}

function statBonusAtLevel(shopDef, level) {
    const maxLevel = maxLevelForItem(shopDef);
    const l = capLevel(level, maxLevel);
    if (Number.isFinite(shopDef?.chainTier)) {
        return chainBonusAtLevel(shopDef.chainTier, l, maxLevel);
    }
    const rules = slotRulesForItem(shopDef);
    const stat = rules.stat;
    const base = Math.max(1, Math.floor(Number(shopDef[stat]) || 1));
    return base * l;
}

function itemStatsAtLevel(shopDef, level) {
    const rules = slotRulesForItem(shopDef);
    const stat = rules.stat;
    const bonus = statBonusAtLevel(shopDef, level);
    return {
        power: stat === "power" ? bonus : shopDef.power || 0,
        speed: stat === "speed" ? bonus : shopDef.speed || 0,
        intel: stat === "intel" ? bonus : shopDef.intel || 0,
        stamina: stat === "stamina" ? bonus : shopDef.stamina || 0
    };
}

function ensureItemUpgrade(upgrades, itemId) {
    const map = parseUpgrades(upgrades);
    if (!map[itemId]) {
        map[itemId] = { level: 1, until: 0 };
    }
    return map;
}

function normalizeUpgrades(upgrades, shopItems = {}, now = Date.now()) {
    const map = parseUpgrades(upgrades);
    let changed = false;
    for (const [id, row] of Object.entries(map)) {
        const def = shopItems[id];
        const maxLevel = def ? maxLevelForItem(def) : MAX_GEAR_LEVEL;
        const capped = capLevel(row.level, maxLevel);
        if (capped !== row.level) {
            row.level = capped;
            changed = true;
        }
        if (row.level >= maxLevel && row.until > 0) {
            row.until = 0;
            changed = true;
        }
    }
    return { upgrades: map, changed };
}

function tickUpgrades(upgrades, now = Date.now(), shopItems = null) {
    const map = parseUpgrades(upgrades);
    let changed = false;
    const completedIds = [];
    for (const [id, row] of Object.entries(map)) {
        if (row.until > 0 && row.until <= now) {
            const def = shopItems && shopItems[id];
            const maxLevel = def ? maxLevelForItem(def) : MAX_GEAR_LEVEL;
            if (row.level >= maxLevel) {
                row.until = 0;
                changed = true;
                continue;
            }
            row.level = Math.min(row.level + 1, maxLevel);
            row.until = 0;
            changed = true;
            completedIds.push(id);
        }
    }
    return { upgrades: map, changed, completedIds };
}

function isUpgrading(upgrades, itemId, now = Date.now()) {
    const row = parseUpgrades(upgrades)[itemId];
    return !!(row && row.until > now);
}

function formatDurationHms(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function speedupMushroomCost(remainingMs) {
    return Math.max(1, Math.ceil(remainingMs / (10 * 60 * 1000)));
}

function buildUpgradeView(itemId, shopDef, upgrades, now = Date.now()) {
    const map = ensureItemUpgrade(upgrades, itemId);
    const row = map[itemId];
    const maxLevel = maxLevelForItem(shopDef);
    row.level = capLevel(row.level, maxLevel);
    const level = row.level;
    const upgrading = row.until > now && level < maxLevel;
    const remainingMs = upgrading ? row.until - now : 0;
    const atMax = level >= maxLevel;
    const nextLevel = Math.min(maxLevel, level + 1);
    const currentStats = itemStatsAtLevel(shopDef, level);
    const nextStats = atMax ? null : itemStatsAtLevel(shopDef, nextLevel);
    const step = atMax ? null : upgradeStepAtLevel(shopDef, level);

    return {
        itemId,
        slot: shopDef.slot,
        label: shopDef.label,
        emoji: shopDef.emoji,
        image: shopDef.image || shopDef.icon || null,
        level,
        maxLevel,
        stars: starsForLevel(level, maxLevel),
        starsDisplay: starsDisplay(level, maxLevel),
        statKey: slotRulesForItem(shopDef).stat,
        currentBonus: currentStats[slotRulesForItem(shopDef).stat],
        nextBonus: nextStats ? nextStats[slotRulesForItem(shopDef).stat] : null,
        upgrading,
        remainingMs,
        remainingLabel: formatDurationHms(remainingMs),
        durationLabel: atMax ? null : formatDurationHms(step.durationMs),
        costDollars: atMax ? null : step.costDollars,
        speedupMushrooms: upgrading ? speedupMushroomCost(remainingMs) : null,
        atMax,
        canUpgrade: !upgrading && !atMax,
        maxMessage: atMax ? maxUpgradeMessage(shopDef) : null
    };
}

function startUpgrade(upgrades, itemId, shopDef, now = Date.now()) {
    const map = ensureItemUpgrade(upgrades, itemId);
    const row = map[itemId];
    const maxLevel = maxLevelForItem(shopDef);
    row.level = capLevel(row.level, maxLevel);
    if (row.until > now) {
        return { ok: false, error: "Улучшение уже идёт" };
    }
    if (row.level >= maxLevel) {
        return { ok: false, error: maxUpgradeMessage(shopDef) };
    }
    const step = upgradeStepAtLevel(shopDef, row.level);
    row.until = now + step.durationMs;
    return {
        ok: true,
        upgrades: map,
        costDollars: step.costDollars,
        until: row.until
    };
}

function finishUpgradeNow(upgrades, itemId, shopDef) {
    const map = ensureItemUpgrade(upgrades, itemId);
    const row = map[itemId];
    const maxLevel = maxLevelForItem(shopDef);
    row.level = capLevel(row.level, maxLevel);
    if (row.level >= maxLevel) {
        row.until = 0;
        return { ok: false, error: maxUpgradeMessage(shopDef) };
    }
    if (!row.until) {
        return { ok: false, error: "Нет активного улучшения" };
    }
    row.level = Math.min(row.level + 1, maxLevel);
    row.until = 0;
    return { ok: true, upgrades: map };
}

module.exports = {
    MAX_GEAR_LEVEL,
    UPGRADE_SLOTS,
    parseUpgrades,
    normalizeUpgrades,
    tickUpgrades,
    ensureItemUpgrade,
    isUpgrading,
    starsForLevel,
    starsDisplay,
    maxUpgradeMessage,
    statBonusAtLevel,
    itemStatsAtLevel,
    buildUpgradeView,
    startUpgrade,
    finishUpgradeNow,
    formatDurationHms,
    speedupMushroomCost,
    maxLevelForItem,
    upgradeStepsForItem
};
