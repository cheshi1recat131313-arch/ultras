/**
 * Каталог экипировки ULTRAS — оружие и одежда по уровням (1–35).
 * Стоимость создания — серебро (₽), улучшения — $ и время (как в Hools).
 */

const MAX_GEAR_STARS = 3;

/**
 * Бонус характеристики в цепочке слота (оружие / одежда / обувь / голова).
 * tier — порядок предмета в цепочке (0 = первый), level — звёзды 1…maxStars.
 * Следующий предмет (tier+1, 1★) всегда сильнее максимума предыдущего (tier, 3★).
 */
function chainBonusAtLevel(chainTier, starLevel, maxStars = MAX_GEAR_STARS) {
    const tier = Math.max(0, Math.floor(Number(chainTier) || 0));
    const stars = Math.min(maxStars, Math.max(1, Math.floor(Number(starLevel) || 1)));
    return tier * maxStars + stars;
}

/** Кастомная иконка «Футболка с радугой» (PNG для карточек магазина). */
const RAINBOW_SHIRT_ART = "/static/gear/rainbow-shirt.png?v=4";

/** Парсинг времени Hools: 1.30 → 1ч 30м, 3.05 → 3ч 5м, 4 → 4ч. */
function parseHoolsDuration(value) {
    const raw = String(value).trim().replace(":", ".");
    const parts = raw.split(".");
    const hours = Math.max(0, Math.floor(Number(parts[0]) || 0));
    const tail = parts[1] != null ? parts[1].padEnd(2, "0").slice(0, 2) : "00";
    const minutes = Math.max(0, Math.min(59, Math.floor(Number(tail) || 0)));
    return hours * 60 * 60 * 1000 + minutes * 60 * 1000;
}

function step(costDollars, duration) {
    return { costDollars, durationMs: parseHoolsDuration(duration) };
}

function weapon(id, label, emoji, minLevel, cost, upgrades) {
    return {
        slot: "weapon",
        primaryStat: "power",
        label,
        emoji,
        minLevel,
        cost,
        currency: "rubles",
        power: 0,
        speed: 0,
        intel: 0,
        stamina: 0,
        maxLevel: MAX_GEAR_STARS,
        upgradeSteps: upgrades
    };
}

/** Обувь, головной убор или одежда — тип определяется по названию. */
const BOOTS_LABEL_RE =
    /(?:^|[\s-])(?:тапк|ботин|берц|бутс|кон[её]к|кроссов|сапог|сandal|туфл|шл[её]п|каток)/i;
const HEAD_LABEL_RE = /(?:^|[\s-])(?:фуражк|кепк|каск|шлем|шапк|маск|противогаз)/i;

const GEAR_SLOT_STATS = {
    weapon: "power",
    clothes: "stamina",
    boots: "speed",
    head: "intel"
};

function classifyGearLabel(label) {
    const text = String(label || "").trim();
    if (BOOTS_LABEL_RE.test(text)) return { slot: "boots", stat: "speed" };
    if (HEAD_LABEL_RE.test(text)) return { slot: "head", stat: "intel" };
    return { slot: "clothes", stat: "stamina" };
}

function gearItem(id, label, emoji, minLevel, cost, upgrades, slotOverride = null) {
    const classified = classifyGearLabel(label);
    const slot = slotOverride || classified.slot;
    const stat = GEAR_SLOT_STATS[slot] || classified.stat;
    return {
        slot,
        primaryStat: stat,
        label,
        emoji,
        minLevel,
        cost,
        currency: "rubles",
        power: 0,
        speed: 0,
        intel: 0,
        stamina: 0,
        maxLevel: MAX_GEAR_STARS,
        upgradeSteps: upgrades
    };
}

/** @deprecated — используй gearItem; оставлено для совместимости импортов. */
function clothes(id, label, emoji, minLevel, cost, upgrades) {
    return gearItem(id, label, emoji, minLevel, cost, upgrades);
}

/** Стоимость создания (₽) по уровню — из скринов + интерполяция. */
const CREATE_RUBLES = {
    1: 9,
    2: 24,
    3: 135,
    4: 246,
    5: 357,
    6: 468,
    7: 648,
    8: 828,
    9: 1048,
    10: 1110,
    11: 999,
    12: 2704,
    13: 3091,
    14: 4248,
    15: 4040,
    16: 4617,
    17: 5255,
    18: 5988,
    19: 6608,
    20: 7300,
    21: 8078,
    22: 8948,
    23: 9726,
    24: 10504,
    25: 11467,
    26: 12430,
    27: 12397,
    28: 13636,
    29: 14800,
    30: 16000,
    31: 17250,
    32: 18500,
    33: 19800,
    34: 21150,
    35: 22550
};

/** Эталонные улучшения 6–35 ур. (из скринов + интерполяция). */
const REFERENCE_UPGRADES = {
    6: {
        weapon: [step(3, "1"), step(5, "1.30")],
        clothes: [step(3, "1"), step(6, "1.30")]
    },
    7: {
        weapon: [step(5, "1.30"), step(20, "2")],
        clothes: [step(5, "1.30"), step(24, "2")]
    },
    8: {
        weapon: [step(11, "1.45"), step(27, "2.30")],
        clothes: [step(16, "1.45"), step(52, "2.30")]
    },
    9: {
        weapon: [step(20, "2"), step(45, "2.45")],
        clothes: [step(24, "2"), step(64, "2.45")]
    },
    10: {
        weapon: [step(24, "3"), step(50, "4.30")],
        clothes: [step(25, "3"), step(50, "4.30")]
    },
    11: {
        weapon: [step(23, "4"), step(50, "5.30")],
        clothes: [step(16, "5"), step(52, "6")]
    },
    12: {
        weapon: [step(28, "5"), step(56, "6")],
        clothes: [step(42, "5"), step(86, "6")]
    },
    13: {
        weapon: [step(34, "3.05"), step(67, "6.10")],
        clothes: [step(50, "3.05"), step(101, "6.10")]
    },
    14: {
        weapon: [step(37, "3.15"), step(74, "6.30")],
        clothes: [step(56, "3.15"), step(111, "6.30")]
    },
    15: {
        weapon: [step(41, "3.25"), step(81, "6.50")],
        clothes: [step(61, "3.25"), step(122, "6.50")]
    },
    16: {
        weapon: [step(48, "3.35"), step(97, "7.10")],
        clothes: [step(73, "3.35"), step(145, "7.10")]
    },
    17: {
        weapon: [step(53, "3.45"), step(107, "7.30")],
        clothes: [step(80, "3.45"), step(160, "7.30")]
    },
    18: {
        weapon: [step(59, "3.55"), step(117, "7.50")],
        clothes: [step(88, "3.55"), step(176, "7.50")]
    },
    19: {
        weapon: [step(67, "4.05"), step(135, "8.10")],
        clothes: [step(101, "4.05"), step(202, "8.10")]
    },
    20: {
        weapon: [step(72, "4.15"), step(144, "8.30")],
        clothes: [step(108, "4.15"), step(216, "8.30")]
    },
    21: {
        weapon: [step(83, "4.25"), step(166, "8.50")],
        clothes: [step(124, "4.25"), step(249, "8.50")]
    },
    22: {
        weapon: [step(89, "4.35"), step(178, "9.10")],
        clothes: [step(133, "4.35"), step(267, "9.10")]
    },
    23: {
        weapon: [step(94, "4.45"), step(187, "9.30")],
        clothes: [step(140, "4.45"), step(281, "9.30")]
    },
    24: {
        weapon: [step(99, "4.55"), step(197, "9.50")],
        clothes: [step(148, "4.55"), step(296, "9.50")]
    },
    25: {
        weapon: [step(108, "5.00"), step(216, "10.00")],
        clothes: [step(162, "5.00"), step(324, "10.00")]
    },
    26: {
        weapon: [step(118, "5.15"), step(235, "10.30")],
        clothes: [step(177, "5.15"), step(353, "10.30")]
    },
    27: {
        weapon: [step(125, "5.30"), step(300, "12.30")],
        clothes: [step(158, "5.25"), step(324, "11.30")]
    },
    28: {
        weapon: [step(140, "6.00"), step(300, "13.30")],
        clothes: [step(190, "5.45"), step(380, "12.30")]
    },
    29: {
        weapon: [step(148, "6.25"), step(380, "14.30")],
        clothes: [step(200, "5.45"), step(402, "11.30")]
    },
    /** 30–35: военная тематика ветеранов, прогрессия от эталона 29 ур. */
    30: {
        weapon: [step(156, "6.35"), step(395, "14.45")],
        clothes: [step(212, "5.55"), step(425, "11.45")]
    },
    31: {
        weapon: [step(165, "6.45"), step(418, "14.55")],
        clothes: [step(224, "5.65"), step(448, "11.55")]
    },
    32: {
        weapon: [step(174, "6.55"), step(442, "14.65")],
        clothes: [step(236, "5.75"), step(472, "11.65")]
    },
    33: {
        weapon: [step(184, "6.65"), step(467, "14.75")],
        clothes: [step(249, "5.85"), step(498, "11.75")]
    },
    34: {
        weapon: [step(194, "6.75"), step(493, "14.85")],
        clothes: [step(263, "5.95"), step(526, "11.85")]
    },
    35: {
        weapon: [step(205, "6.85"), step(520, "15.00")],
        clothes: [step(278, "6.05"), step(556, "12.00")]
    }
};

function scaledUpgrades(level, slot) {
    const refSlot = slot === "weapon" ? "weapon" : "clothes";
    if (REFERENCE_UPGRADES[level]) {
        return REFERENCE_UPGRADES[level][refSlot].map((s) => ({ ...s }));
    }
    const refLevel = 21;
    const ref = REFERENCE_UPGRADES[refLevel][refSlot];
    const earlyScale = level < 6 ? Math.max(0.35, level / 6) : 1;
    const scale = 1 + (level - refLevel) * 0.08;
    return ref.map((s) => ({
        costDollars: Math.max(1, Math.round(s.costDollars * scale * earlyScale)),
        durationMs: Math.round(s.durationMs * (level < 6 ? 0.7 : 1))
    }));
}

/**
 * Слоты, открываемые на уровне.
 * 1–4: по одному слоту (оружие → одежда → голова → обувь).
 * 5+: нечётный — оружие + одежда; чётный — голова + обувь.
 */
function unlockSlotsForLevel(level) {
    if (level === 1) return ["weapon"];
    if (level === 2) return ["clothes"];
    if (level === 3) return ["head"];
    if (level === 4) return ["boots"];
    if (level >= 5 && level % 2 === 1) return ["weapon", "clothes"];
    if (level >= 6 && level % 2 === 0) return ["head", "boots"];
    return [];
}

/** @deprecated — первый слот уровня; используй unlockSlotsForLevel */
function unlockSlotForLevel(level) {
    const slots = unlockSlotsForLevel(level);
    return slots[0] || "weapon";
}

const GEAR_NAMES = {
    3: { weapon: ["Кастет", "🔧"], clothes: ["Майка", "👕"] },
    4: { weapon: ["Ремень", "🪢"], clothes: ["Кофта", "🧥"] },
    5: { weapon: ["Цепь", "⛓️"], clothes: ["Куртка", "🧥"] },
    6: { weapon: ["Вешалка", "🪝"], clothes: ["Тапки", "🥿"] },
    7: { weapon: ["Метла", "🧹"], clothes: ["Фуражка", "🧢"] },
    8: { weapon: ["Бита", "🏏"], clothes: ["Свитер", "🧶"] },
    9: { weapon: ["Скакалка", "🪢"], clothes: ["Ботинок", "🥾"] },
    10: { weapon: ["Булава", "🔨"], clothes: ["Каска", "⛑️"] },
    11: { weapon: ["Пистолет", "🔫"], clothes: ["Толстовка", "👘"] },
    12: { weapon: ["Линейка", "📏"], clothes: ["Конёк", "⛸️"] },
    13: { weapon: ["Ключ", "🔧"], clothes: ["Шлем", "🪖"] },
    14: { weapon: ["Зонт", "☂️"], clothes: ["Плащ", "🧥"] },
    15: { weapon: ["Рогатка", "🎯"], clothes: ["Бутсы", "👟"] },
    16: { weapon: ["Арбалет", "🏹"], clothes: ["Шапка", "🧢"] },
    17: { weapon: ["Подзорная труба", "🔭"], clothes: ["Пуховик", "🧥"] },
    18: { weapon: ["Цепь", "⛓️"], clothes: ["Берцы", "🥾"] },
    19: { weapon: ["Огнетушитель", "🧯"], clothes: ["Маска", "😷"] },
    20: { weapon: ["Лом", "🔧"], clothes: ["Футболка клубная", "👕"] },
    21: { weapon: ["Клюшка", "⛳"], clothes: ["Ковбойский сапог", "🤠"] },
    22: { weapon: ["Электрошокер", "⚡"], clothes: ["Противогаз", "😷"] },
    23: { weapon: ["Дубинка рез.", "🪵"], clothes: ["Кожаное пальто", "🧥"] },
    24: { weapon: ["Бензопила", "🪚"], clothes: ["Кастет-каток", "👊"] },
    25: { weapon: ["Молоток", "🔨"], clothes: ["Плащ длинный", "🧥"] },
    26: { weapon: ["Лук", "🏹"], clothes: ["Плащ", "🧥"] },
    27: { weapon: ["Утюг", "🧺"], clothes: ["Кроссовки", "👟"] },
    28: { weapon: ["Гитара", "🎸"], clothes: ["Шлем спорт.", "⛑️"] },
    29: { weapon: ["Удочка", "🎣"], clothes: ["Форменная рубашка", "👔"] },
    30: { weapon: ["Армейский нож", "🗡️"], clothes: ["Бронежилет", "🦺"] },
    31: { weapon: ["Ручная граната", "💣"], clothes: ["Камуфляжная куртка", "🪖"] },
    32: { weapon: ["Приклад", "🔩"], clothes: ["Армейские берцы", "🥾"] },
    33: { weapon: ["Сапёрная лопата", "⛏️"], clothes: ["Штурмовая куртка", "🧥"] },
    34: { weapon: ["РПГ учебный", "🚀"], clothes: ["Тактический шлем", "🪖"] },
    35: { weapon: ["Армейская дубина", "🏏"], clothes: ["Костюм ветерана", "🎖️"] }
};

/** Пулы предметов по слотам (из эталонных названий GEAR_NAMES). */
function buildGearPools() {
    const weaponPool = [];
    const clothesPool = [];
    const headPool = [];
    const bootsPool = [];
    for (let lv = 3; lv <= 35; lv += 1) {
        const row = GEAR_NAMES[lv];
        if (!row) continue;
        weaponPool.push({ label: row.weapon[0], emoji: row.weapon[1] });
        const classified = classifyGearLabel(row.clothes[0]);
        const entry = { label: row.clothes[0], emoji: row.clothes[1] };
        if (classified.slot === "clothes") clothesPool.push(entry);
        else if (classified.slot === "head") headPool.push(entry);
        else if (classified.slot === "boots") bootsPool.push(entry);
    }
    return { weaponPool, clothesPool, headPool, bootsPool };
}

function gearIdForSlot(slot, level) {
    if (slot === "weapon") return `weapon_lv${level}`;
    if (slot === "clothes") return `clothes_gear_lv${level}`;
    return `${slot}_lv${level}`;
}

function putGearItem(items, slot, id, label, emoji, level, rub, upgrades) {
    if (slot === "weapon") {
        items[id] = weapon(id, label, emoji, level, rub, upgrades);
    } else {
        items[id] = gearItem(id, label, emoji, level, rub, upgrades, slot);
    }
}

function takeFromPool(pool, cursors, slot) {
    if (!pool.length) return { label: "?", emoji: "📦" };
    const idx = Math.min(cursors[slot], pool.length - 1);
    cursors[slot] += 1;
    return pool[idx];
}

function registerLegacyItem(items, id, def) {
    items[id] = Object.assign({}, def, { shopHidden: true, legacy: true });
}

/** Порядок в цепочке слота: каждый следующий предмет начинается с max бонуса предыдущего. */
function assignChainTiers(items) {
    const bySlot = {};
    for (const [id, def] of Object.entries(items)) {
        if (def?.shopHidden) continue;
        if (!def?.slot || !Number.isFinite(def.maxLevel)) continue;
        if (!Array.isArray(def.upgradeSteps) || !def.upgradeSteps.length) continue;
        if (!bySlot[def.slot]) bySlot[def.slot] = [];
        bySlot[def.slot].push({ id, minLevel: def.minLevel });
    }
    for (const entries of Object.values(bySlot)) {
        entries.sort((a, b) => a.minLevel - b.minLevel || a.id.localeCompare(b.id));
        entries.forEach((entry, index) => {
            items[entry.id].chainTier = index;
        });
    }
}

/** Старые предметы (shopHidden) — tier по позиции в пуле слота (+1 после стартовой вещи слота). */
function assignLegacyChainTiers(items, pools) {
    const poolBySlot = {
        weapon: pools.weaponPool,
        clothes: pools.clothesPool,
        head: pools.headPool,
        boots: pools.bootsPool
    };
    for (const def of Object.values(items)) {
        if (!def?.shopHidden) continue;
        const pool = poolBySlot[def.slot];
        if (!pool) continue;
        const idx = pool.findIndex((entry) => entry.label === def.label);
        if (idx < 0) continue;
        def.chainTier = idx + 1;
    }
}

/** После расстановки chainTier — выставить бонусы 1★/3★ в полях каталога (магазин, API). */
function syncChainStatFields(items) {
    for (const def of Object.values(items)) {
        if (!Number.isFinite(def?.chainTier)) continue;
        const statKey = primaryStatForItem(def);
        const at1 = chainBonusAtLevel(def.chainTier, 1);
        const at2 = chainBonusAtLevel(def.chainTier, 2);
        const at3 = chainBonusAtLevel(def.chainTier, MAX_GEAR_STARS);
        def.power = 0;
        def.speed = 0;
        def.intel = 0;
        def.stamina = 0;
        def[statKey] = at1;
        def.bonusAtStars = { 1: at1, 2: at2, 3: at3 };
        def.maxBonus = at3;
    }
}

function buildCatalog() {
    const items = {
        newspaper: weapon("newspaper", "Газета", "📰", 1, 9, [step(1, "0.30"), step(2, "0.45")]),
        rainbow_shirt: Object.assign(
            gearItem("rainbow_shirt", "Футболка с радугой", "👕", 2, 24, [
                step(1, "0.30"),
                step(3, "0.45")
            ]),
            { image: RAINBOW_SHIRT_ART, icon: RAINBOW_SHIRT_ART }
        )
    };

    const pools = buildGearPools();
    const cursors = { weapon: 0, clothes: 0, head: 0, boots: 0 };

    /** Legacy: старая схема «оружие + одежда» на каждом уровне — для сохранений. */
    for (let lv = 3; lv <= 35; lv += 1) {
        const names = GEAR_NAMES[lv];
        if (!names) continue;
        const rub = CREATE_RUBLES[lv];
        registerLegacyItem(
            items,
            `weapon_lv${lv}`,
            weapon(
                `weapon_lv${lv}`,
                names.weapon[0],
                names.weapon[1],
                lv,
                rub,
                scaledUpgrades(lv, "weapon")
            )
        );
        registerLegacyItem(
            items,
            `clothes_lv${lv}`,
            gearItem(
                `clothes_lv${lv}`,
                names.clothes[0],
                names.clothes[1],
                lv,
                rub,
                scaledUpgrades(lv, "clothes")
            )
        );
    }

    /** 3–4 ур.: открытие головы и обуви */
    const headIntro = takeFromPool(pools.headPool, cursors, "head");
    putGearItem(
        items,
        "head",
        "head_lv3",
        headIntro.label,
        headIntro.emoji,
        3,
        CREATE_RUBLES[3],
        scaledUpgrades(3, "head")
    );

    const bootsIntro = takeFromPool(pools.bootsPool, cursors, "boots");
    putGearItem(
        items,
        "boots",
        "boots_lv4",
        bootsIntro.label,
        bootsIntro.emoji,
        4,
        CREATE_RUBLES[4],
        scaledUpgrades(4, "boots")
    );

    /** 5+ ур.: по два предмета — апгрейд слотов внутри цепочки */
    for (let lv = 5; lv <= 35; lv += 1) {
        const rub = CREATE_RUBLES[lv];
        const slots = unlockSlotsForLevel(lv);
        for (const slot of slots) {
            let entry;
            if (slot === "weapon") entry = takeFromPool(pools.weaponPool, cursors, "weapon");
            else if (slot === "clothes") entry = takeFromPool(pools.clothesPool, cursors, "clothes");
            else if (slot === "head") entry = takeFromPool(pools.headPool, cursors, "head");
            else entry = takeFromPool(pools.bootsPool, cursors, "boots");

            const id = gearIdForSlot(slot, lv);
            putGearItem(items, slot, id, entry.label, entry.emoji, lv, rub, scaledUpgrades(lv, slot));
        }
    }

    assignChainTiers(items);
    assignLegacyChainTiers(items, pools);
    syncChainStatFields(items);
    return items;
}

const SHOP_ITEMS = buildCatalog();

function shopSections() {
    const weapon = [];
    const clothes = [];
    const head = [];
    const boots = [];
    for (const [id, def] of Object.entries(SHOP_ITEMS)) {
        if (def.shopHidden) continue;
        if (def.slot === "weapon") weapon.push(id);
        else if (def.slot === "head") head.push(id);
        else if (def.slot === "boots") boots.push(id);
        else clothes.push(id);
    }
    const byLevel = (a, b) => SHOP_ITEMS[a].minLevel - SHOP_ITEMS[b].minLevel;
    weapon.sort(byLevel);
    clothes.sort(byLevel);
    head.sort(byLevel);
    boots.sort(byLevel);
    /** Раздел дилера «Одежда» — всё, кроме оружия (одежда, голова, обувь). */
    const apparel = [...clothes, ...head, ...boots].sort(byLevel);
    return { weapon, clothes: apparel, head, boots };
}

function primaryStatForItem(def) {
    if (!def) return "power";
    if (def.primaryStat) return def.primaryStat;
    if (def.slot === "weapon") return "power";
    return GEAR_SLOT_STATS[def.slot] || "stamina";
}

function gearCatalogTable() {
    const rows = [];
    for (const [id, def] of Object.entries(SHOP_ITEMS)) {
        const statKey = primaryStatForItem(def);
        const base = def[statKey];
        const steps = def.upgradeSteps || [];
        const tier = Number.isFinite(def.chainTier) ? def.chainTier : 0;
        const bonusAt = (stars) => chainBonusAtLevel(tier, stars);
        rows.push({
            level: def.minLevel,
            id,
            item: def.label,
            slot: def.slot,
            stat: statKey,
            chainTier: tier,
            baseBonus: base,
            bonusStar1: bonusAt(1),
            bonusStar2: bonusAt(2),
            bonusStar3: bonusAt(3),
            createCostRubles: def.cost,
            upgrade1CostDollars: steps[0]?.costDollars ?? null,
            upgrade1TimeMin: steps[0] ? Math.round(steps[0].durationMs / 60000) : null,
            upgrade2CostDollars: steps[1]?.costDollars ?? null,
            upgrade2TimeMin: steps[1] ? Math.round(steps[1].durationMs / 60000) : null
        });
    }
    rows.sort((a, b) => a.level - b.level || a.slot.localeCompare(b.slot));
    return rows;
}

module.exports = {
    MAX_GEAR_STARS,
    chainBonusAtLevel,
    unlockSlotsForLevel,
    unlockSlotForLevel,
    parseHoolsDuration,
    SHOP_ITEMS,
    shopSections,
    gearCatalogTable,
    classifyGearLabel,
    primaryStatForItem,
    GEAR_SLOT_STATS,
    CREATE_RUBLES,
    REFERENCE_UPGRADES
};
