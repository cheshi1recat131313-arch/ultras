/**
 * Каталог талисманов Мага Геннадия.
 * Талисман покупается один раз и остаётся навсегда.
 *
 * scope — где автоматически работает эффект (см. MODES / modesForScope).
 */

const MODES = {
    DISTRICT: "district",
    STADIUM: "stadium",
    PUB_BATTLE: "pub_battle",
    WORK: "work",
    BOOKMAKER: "bookmaker",
    KICKER: "kicker"
};

/** Все режимы с драками — дополнять при добавлении новых боёв. */
const COMBAT_MODES = [MODES.DISTRICT, MODES.STADIUM, MODES.PUB_BATTLE];

/** Режимы, где игроку начисляется репутация. */
const REPUTATION_MODES = [MODES.DISTRICT, MODES.STADIUM, MODES.PUB_BATTLE];

/** scope из каталога → режимы боя/игры */
const SCOPE_MODES = {
    combat: COMBAT_MODES,
    reputation: REPUTATION_MODES,
    district: [MODES.DISTRICT],
    group_fight: [MODES.STADIUM, MODES.PUB_BATTLE],
    bookmaker_kicker: [MODES.BOOKMAKER, MODES.KICKER],
    district_work: [MODES.DISTRICT, MODES.WORK]
};

const SCOPE_LABELS = {
    combat: "Все драки (район, стадион, махач, паб)",
    reputation: "Везде, где начисляется репутация",
    district: "Район",
    group_fight: "Большой Махач / Битва за Паб",
    bookmaker_kicker: "Букмекер / настольный футбол",
    district_work: "Район / работа"
};

const TALISMANS = {
    klitschko_glove: {
        id: "klitschko_glove",
        name: "Перчатка Кличко",
        icon: "/static/talismans/klitschko-glove.png",
        description: "Сила удара +200%",
        scope: "combat",
        priceDollars: 99,
        priceMushrooms: 99,
        effectKey: "combat_damage_mult",
        basePercent: 0.5,
        stepPercent: 0.5
    },
    neo_figure: {
        id: "neo_figure",
        name: "Фигурка Нео",
        icon: "/static/talismans/neo-figure.png",
        description: "Уворот от удара.",
        scope: "combat",
        priceDollars: 99,
        priceMushrooms: 99,
        effectKey: "combat_dodge_chance",
        basePercent: 0.5,
        stepPercent: 0.5
    },
    maya_mask: {
        id: "maya_mask",
        name: "Маска Майя",
        icon: "/static/talismans/maya-mask.png",
        description: "Ярость 100%",
        scope: "group_fight",
        priceDollars: 125,
        priceMushrooms: 125,
        effectKey: "group_rage_gain",
        basePercent: 0.5,
        stepPercent: 0.5
    },
    clover: {
        id: "clover",
        name: "Клевер",
        icon: "/static/talismans/clover.png",
        description: "Нейтрализует амулеты оппонента на районе.",
        scope: "district",
        priceDollars: 80,
        priceMushrooms: 80,
        effectKey: "district_anti_amulet",
        basePercent: 0.5,
        stepPercent: 0.5
    },
    gold_clover: {
        id: "gold_clover",
        name: "Золотой клевер",
        icon: "/static/talismans/gold-clover.png",
        description: "Нейтрализует талисманы оппонента на групповом махаче.",
        scope: "group_fight",
        priceDollars: 100,
        priceMushrooms: 100,
        effectKey: "group_anti_talisman",
        basePercent: 0.5,
        stepPercent: 0.5
    },
    spring: {
        id: "spring",
        name: "Пружина",
        icon: "/static/talismans/spring.png",
        description: "Когда срабатывает пружина — соперник бьёт сам себя.",
        scope: "group_fight",
        priceDollars: 90,
        priceMushrooms: 90,
        effectKey: "group_reflect_chance",
        basePercent: 0.5,
        stepPercent: 0.5
    },
    mercedes_badge: {
        id: "mercedes_badge",
        name: "Шильдик от Мерса",
        icon: "/static/talismans/mercedes-badge.png",
        description: "Удваивает получаемую репутацию (район, стадион, паб и любые будущие режимы).",
        scope: "reputation",
        priceDollars: 90,
        priceMushrooms: 90,
        effectKey: "rep_mult",
        basePercent: 0.5,
        stepPercent: 0.5
    },
    zircon_bracelet: {
        id: "zircon_bracelet",
        name: "Циркониевый браслет",
        icon: "/static/talismans/zircon-bracelet.png",
        description: "Увеличивает в 2 раза остаток HP после боя на районе.",
        scope: "district",
        priceDollars: 90,
        priceMushrooms: 90,
        effectKey: "district_hp_after_fight_mult",
        basePercent: 0.5,
        stepPercent: 0.5
    },
    chip: {
        id: "chip",
        name: "Фишка",
        icon: "/static/talismans/chip.png",
        description: "Увеличивает в 2 раза выигрыш у букмекера и в настольный футбол.",
        scope: "bookmaker_kicker",
        priceDollars: 60,
        priceMushrooms: 60,
        effectKey: "bookmaker_kicker_win_mult",
        basePercent: 0.5,
        stepPercent: 0.5
    },
    lucky_dollar: {
        id: "lucky_dollar",
        name: "Счастливый доллар",
        icon: "/static/talismans/lucky-dollar.png",
        description: "Увеличивает в 2 раза добычу на районе и заработок на работе.",
        scope: "district_work",
        priceDollars: 60,
        priceMushrooms: 60,
        effectKey: "district_work_money_mult",
        basePercent: 0.5,
        stepPercent: 0.5
    }
};

function parseOwnedTalismans(raw) {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        return raw;
    }
    try {
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

/** Сырой JSON владения из user (sanitizeUser) или строки БД. */
function resolveOwnedRaw(source) {
    if (!source) return "{}";
    if (typeof source === "string") return source;
    if (source.talismansOwned && typeof source.talismansOwned === "object") {
        return JSON.stringify(source.talismansOwned);
    }
    if (typeof source.talismans === "string") return source.talismans;
    return "{}";
}

function modesForScope(scope) {
    return SCOPE_MODES[scope] || (scope ? [scope] : []);
}

function scopeAppliesToMode(scope, mode) {
    if (!scope || !mode) return false;
    return modesForScope(scope).includes(mode);
}

/** Только талисманы, действующие в данном режиме. */
function filterOwnedForMode(rawOwned, mode) {
    const owned = parseOwnedTalismans(resolveOwnedRaw(rawOwned));
    const out = {};
    for (const [id, state] of Object.entries(owned)) {
        const def = TALISMANS[id];
        if (def && scopeAppliesToMode(def.scope, mode)) {
            out[id] = state;
        }
    }
    return out;
}

function filterOwnedJsonForMode(rawOwned, mode) {
    return JSON.stringify(filterOwnedForMode(rawOwned, mode));
}

function scopeLabel(scope) {
    return SCOPE_LABELS[scope] || scope || "—";
}

function levelFromState(state) {
    const lv = Math.floor(Number(state?.level) || 1);
    return Math.max(1, lv);
}

function effectPercent(def, level) {
    const pct = (def.basePercent || 0) + (level - 1) * (def.stepPercent || 0);
    return Math.max(0, Math.round(pct * 100) / 100);
}

/** Стоимость улучшения с текущего уровня на следующий (только $). */
const UPGRADE_COST_TABLE = [60, 90, 135, 200];
const UPGRADE_COST_RATIO = UPGRADE_COST_TABLE[UPGRADE_COST_TABLE.length - 1] / UPGRADE_COST_TABLE[UPGRADE_COST_TABLE.length - 2];

function upgradeCostDollars(currentLevel) {
    const fromLevel = Math.max(1, Math.floor(Number(currentLevel) || 1));
    const idx = fromLevel - 1;
    if (idx < UPGRADE_COST_TABLE.length) {
        return UPGRADE_COST_TABLE[idx];
    }
    let cost = UPGRADE_COST_TABLE[UPGRADE_COST_TABLE.length - 1];
    for (let i = UPGRADE_COST_TABLE.length; i <= idx; i += 1) {
        cost = Math.round(cost * UPGRADE_COST_RATIO);
    }
    return cost;
}

function upgradeTalisman(rawOwned, id) {
    const owned = parseOwnedTalismans(resolveOwnedRaw(rawOwned));
    const state = owned[id];
    if (!state) return { ok: false, error: "Сначала нужно купить талисман." };
    const def = TALISMANS[id];
    if (!def) return { ok: false, error: "Неизвестный талисман." };
    const level = levelFromState(state);
    owned[id] = {
        ...state,
        level: level + 1,
        upgradedAt: Date.now()
    };
    return { ok: true, owned, newLevel: level + 1 };
}

function talismanView(def, ownedState) {
    const bought = !!ownedState;
    const level = bought ? levelFromState(ownedState) : 1;
    const nextUpgradeCost = bought ? upgradeCostDollars(level) : null;
    return {
        id: def.id,
        name: def.name,
        icon: def.icon,
        description: def.description,
        scope: def.scope,
        scopeLabel: scopeLabel(def.scope),
        effectKey: def.effectKey,
        priceDollars: def.priceDollars,
        priceMushrooms: def.priceMushrooms,
        owned: bought,
        level,
        effectPercent: effectPercent(def, level),
        nextEffectPercent: bought ? effectPercent(def, level + 1) : null,
        nextUpgradeCost,
        canUpgrade: bought
    };
}

function catalogWithOwnership(rawOwned) {
    const owned = parseOwnedTalismans(resolveOwnedRaw(rawOwned));
    return Object.values(TALISMANS).map((t) => talismanView(t, owned[t.id]));
}

function boughtOnly(rawOwned) {
    return catalogWithOwnership(rawOwned).filter((t) => t.owned);
}

function hasTalisman(rawOwned, id, mode) {
    if (mode) {
        return !!filterOwnedForMode(rawOwned, mode)[id];
    }
    const owned = parseOwnedTalismans(resolveOwnedRaw(rawOwned));
    return !!owned[id];
}

function buyTalisman(rawOwned, id) {
    const owned = parseOwnedTalismans(resolveOwnedRaw(rawOwned));
    if (owned[id]) return { ok: false, error: "Талисман уже куплен." };
    const def = TALISMANS[id];
    if (!def) return { ok: false, error: "Неизвестный талисман." };
    owned[id] = { level: 1, boughtAt: Date.now() };
    return { ok: true, owned };
}

module.exports = {
    MODES,
    COMBAT_MODES,
    REPUTATION_MODES,
    SCOPE_MODES,
    SCOPE_LABELS,
    TALISMANS,
    parseOwnedTalismans,
    resolveOwnedRaw,
    modesForScope,
    scopeAppliesToMode,
    scopeLabel,
    filterOwnedForMode,
    filterOwnedJsonForMode,
    catalogWithOwnership,
    boughtOnly,
    hasTalisman,
    buyTalisman,
    upgradeCostDollars,
    upgradeTalisman,
    effectPercent
};
