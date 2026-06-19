/**
 * Визуальная экипировка ботов района для экрана «Шмот и оружие».
 * Не влияет на бой и статы — только отображение.
 */
const { SHOP_ITEMS } = require("./gear-catalog");

const AMULETS = [
    { label: "Оберег", emoji: "🧿" },
    { label: "Кулон", emoji: "📿" },
    { label: "Медальон", emoji: "🔮" }
];

const TATTOOS = [
    { label: "Тату: сила", emoji: "☠️" },
    { label: "Тату: стойкость", emoji: "⚓" },
    { label: "Тату: ловкость", emoji: "💜" },
    { label: "Тату: интуиция", emoji: "🎯" }
];

const TIER_CONFIG = {
    weak: {
        slots: ["weapon", "clothes"],
        stars: { weapon: [1, 2], clothes: [1, 1] },
        amulets: 0,
        tattoo: false,
        displayGearSum: 3,
        displayTattooSum: 0,
        displayAmuletSum: 0
    },
    equal: {
        slots: ["weapon", "clothes", "boots"],
        stars: { weapon: [2, 3], clothes: [2, 2], boots: [1, 2] },
        amulets: 1,
        tattoo: true,
        displayGearSum: 8,
        displayTattooSum: 2,
        displayAmuletSum: 2
    },
    strong: {
        slots: ["weapon", "clothes", "boots", "head"],
        stars: { weapon: [3, 4], clothes: [3, 3], boots: [2, 3], head: [2, 2] },
        amulets: 2,
        tattoo: true,
        displayGearSum: 14,
        displayTattooSum: 4,
        displayAmuletSum: 4
    }
};

function hashSeed(str) {
    let h = 2166136261;
    const text = String(str || "bot");
    for (let i = 0; i < text.length; i += 1) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function pickStarLevel(range, seed) {
    const min = Math.max(1, range[0] || 1);
    const max = Math.max(min, range[1] || min);
    if (min >= max) return min;
    return min + (seed % (max - min + 1));
}

function pickShopVisual(slot, level, seed) {
    const lv = Math.max(3, Math.min(35, Math.floor(Number(level) || 10)));
    const entries = Object.entries(SHOP_ITEMS)
        .filter(([, def]) => def?.slot === slot && !def.shopHidden && (def.minLevel || 0) <= lv)
        .sort((a, b) => (b[1].minLevel || 0) - (a[1].minLevel || 0) || a[0].localeCompare(b[0]));
    const picked = entries[seed % Math.max(1, entries.length)]?.[1];
    if (picked) {
        return {
            id: `bot_vis_${slot}`,
            slot,
            label: picked.label,
            emoji: picked.emoji || "📦"
        };
    }
    return { id: `bot_vis_${slot}`, slot, label: slot, emoji: "📦" };
}

/**
 * @param {{ oppTotal: number, playerTotal: number, playerLost: boolean }} params
 * @returns {"weak"|"equal"|"strong"}
 */
function resolveBotGearTier({ oppTotal, playerTotal, playerLost }) {
    const ratio = oppTotal / Math.max(1, playerTotal);
    if (playerLost) {
        return ratio >= 0.9 ? "strong" : "equal";
    }
    if (ratio >= 1.1) return "strong";
    if (ratio >= 0.85) return "equal";
    return "weak";
}

/**
 * @param {{
 *   opponentLevel?: number,
 *   oppTotal: number,
 *   playerTotal: number,
 *   playerLost: boolean,
 *   seedKey?: string
 * }} params
 */
function buildBotDisplayGear({ opponentLevel, oppTotal, playerTotal, playerLost, seedKey }) {
    const tier = resolveBotGearTier({ oppTotal, playerTotal, playerLost });
    const cfg = TIER_CONFIG[tier];
    const seed = hashSeed(seedKey);
    const equipment = {};
    const gearUpgrades = {};

    cfg.slots.forEach((slot, index) => {
        const slotSeed = seed + index * 17;
        equipment[slot] = pickShopVisual(slot, opponentLevel, slotSeed);
        gearUpgrades[equipment[slot].id] = {
            level: pickStarLevel(cfg.stars[slot] || [1, 1], slotSeed)
        };
    });

    for (let i = 0; i < cfg.amulets; i += 1) {
        const am = AMULETS[(seed + i * 7) % AMULETS.length];
        const key = `amulet${i + 1}`;
        const item = {
            id: `bot_vis_amulet${i + 1}`,
            slot: "amulet",
            label: am.label,
            emoji: am.emoji
        };
        equipment[key] = item;
        gearUpgrades[item.id] = { level: tier === "strong" ? 2 : 1 };
    }

    const lvBonus = Math.floor((Number(opponentLevel) || 1) / 10);
    const displayTattoo = cfg.tattoo ? TATTOOS[seed % TATTOOS.length] : null;

    return {
        equipment,
        gearUpgrades,
        displayGearSum: cfg.displayGearSum + lvBonus,
        displayTattooSum: cfg.tattoo ? cfg.displayTattooSum : 0,
        displayAmuletSum: cfg.displayAmuletSum,
        displayTattoo,
        displayTier: tier
    };
}

module.exports = {
    buildBotDisplayGear,
    resolveBotGearTier
};
