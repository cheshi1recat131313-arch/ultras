/**
 * Провиант — боевые расходники (маг Геннадий, стадион, гардероб).
 */

const PROVISION_ORDER = ["ozverin", "invisible", "hot_pepper", "black_chocolate", "choco_bar"];

const PROVISION_ITEMS = {
    ozverin: {
        id: "ozverin",
        label: "Озверин",
        icon: "/static/provisions/ozverin.svg",
        description: "Увеличивает ярость во время группового махача.",
        usageHtml: "Использование: не чаще <b>1 раза</b> в <b>20 минут</b>",
        effectHtml: "Максимальная ярость: <b>150</b> · Время действия: <b>10 минут</b>",
        priceDollars: 15,
        priceMushrooms: 15,
        kind: "battle",
        cooldownMs: 20 * 60 * 1000,
        feedPhrase: "использовал Озверин",
        furySetTo: 150,
        effectFeed: "Ярость 150"
    },
    invisible: {
        id: "invisible",
        label: "Невидим",
        icon: "/static/provisions/invisible.svg",
        description: "Делает тебя невидимкой на групповом махаче.",
        usageHtml: "Использование: не чаще <b>1 раза</b> в <b>15 минут</b>",
        effectHtml: "Время действия: <b>5 минут</b>",
        priceDollars: 19,
        priceMushrooms: 19,
        kind: "battle",
        cooldownMs: 15 * 60 * 1000,
        feedPhrase: "использовал Невидим",
        effectFeed: "Невидимка"
    },
    hot_pepper: {
        id: "hot_pepper",
        label: "Острый перец",
        icon: "/static/provisions/hot_pepper.svg",
        description: "Моментально восстанавливает твою ярость. Пригодится на групповом махаче.",
        usageHtml: "Использование: не чаще <b>1 раза</b> в <b>5 минут</b>",
        effectHtml: "Ярость: <b>+100</b>",
        priceDollars: 19,
        priceMushrooms: 19,
        kind: "battle",
        cooldownMs: 5 * 60 * 1000,
        feedPhrase: "использовал Острый перец",
        furyRestore: 100,
        effectFeed: "Ярость +100"
    },
    black_chocolate: {
        id: "black_chocolate",
        label: "Плитка чёрного шоколада",
        icon: "/static/provisions/black_chocolate.svg",
        description: "Восстанавливает здоровье на групповом махаче. Не работает на районе.",
        usageHtml: "Использование: не чаще <b>1 раза</b> в <b>20 минут</b>",
        effectHtml: "Здоровье: <b>+100</b>",
        priceDollars: 19,
        priceMushrooms: 19,
        kind: "battle",
        cooldownMs: 20 * 60 * 1000,
        feedPhrase: "съел Плитку чёрного шоколада",
        healHp: 100,
        effectFeed: "+100 ❤️"
    },
    choco_bar: {
        id: "choco_bar",
        label: "Шоколадный батончик",
        icon: "/static/provisions/choco_bar.svg",
        description: "Восстанавливает здоровье на групповом махаче. Не работает на районе.",
        usageHtml: "Использование: не чаще <b>1 раза</b> в <b>15 минут</b>",
        effectHtml: "Здоровье: <b>+50</b>",
        priceDollars: 10,
        priceMushrooms: 10,
        kind: "battle",
        cooldownMs: 15 * 60 * 1000,
        feedPhrase: "съел Шоколадный батончик",
        healHp: 50,
        effectFeed: "+50 ❤️"
    }
};

const PROVISION_IDS = PROVISION_ORDER;

function countsFromConsumables(consumables) {
    const c = consumables && typeof consumables === "object" ? consumables : {};
    const out = {};
    for (const id of PROVISION_IDS) {
        out[id] = Math.max(0, Math.floor(Number(c[id]) || 0));
    }
    return out;
}

/** Только предметы с count > 0 — для стадиона и боя. */
function catalogOwnedForClient(consumables) {
    const counts = countsFromConsumables(consumables);
    return PROVISION_IDS.filter((id) => counts[id] > 0).map((id) => {
        const def = PROVISION_ITEMS[id];
        return {
            id: def.id,
            label: def.label,
            icon: def.icon,
            count: counts[id]
        };
    });
}

function consumeProvision(consumables, itemId) {
    const def = PROVISION_ITEMS[itemId];
    if (!def) return { ok: false, error: "Неизвестный предмет провианта." };
    const counts = countsFromConsumables(consumables);
    const have = counts[itemId] || 0;
    if (have < 1) return { ok: false, error: `Нет «${def.label}».` };
    const next = { ...consumables, [itemId]: have - 1 };
    return { ok: true, def, next };
}

function parseConsumablesUsedAtRaw(raw) {
    let parsed = raw;
    if (typeof raw === "string") {
        try {
            parsed = JSON.parse(raw);
        } catch {
            parsed = {};
        }
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        parsed = {};
    }
    const out = {};
    for (const [key, val] of Object.entries(parsed)) {
        const t = Math.floor(Number(val) || 0);
        if (t > 0) out[key] = t;
    }
    return out;
}

function parseProvisionUsedAt(raw) {
    const full = parseConsumablesUsedAtRaw(raw);
    const out = {};
    for (const id of PROVISION_IDS) {
        if (full[id]) out[id] = full[id];
    }
    return out;
}

function formatCooldownWait(ms) {
    const totalMin = Math.ceil(Math.max(0, ms) / 60000);
    if (totalMin >= 60) {
        const h = Math.ceil(ms / 3600000);
        return `${h} ч.`;
    }
    return `${totalMin} мин.`;
}

function formatProvisionCooldownError(def, remainingMs) {
    const wait = formatCooldownWait(remainingMs);
    return `«${def.label}» можно использовать снова через ${wait}`;
}

/** Проверка кулдауна перед боевым использованием (стадион, битва за паб). */
function checkProvisionCooldown(usedAt, itemId, now = Date.now()) {
    const id = String(itemId || "").trim();
    const def = PROVISION_ITEMS[id];
    if (!def) {
        return { ok: false, error: "Неизвестный предмет провианта." };
    }
    const cooldownMs = Math.max(0, Number(def.cooldownMs) || 0);
    if (cooldownMs < 1) {
        return { ok: true, def };
    }
    const last = Math.floor(Number(usedAt?.[id]) || 0);
    if (last > 0 && now - last < cooldownMs) {
        const remainingMs = cooldownMs - (now - last);
        return {
            ok: false,
            error: formatProvisionCooldownError(def, remainingMs),
            remainingMs
        };
    }
    return { ok: true, def };
}

function stampProvisionUsed(usedAt, itemId, now = Date.now()) {
    const id = String(itemId || "").trim();
    const full = parseConsumablesUsedAtRaw(usedAt);
    if (!id || !PROVISION_ITEMS[id]) {
        return full;
    }
    return { ...full, [id]: now };
}

/**
 * Кулдаун + списание одного предмета в памяти (без записи timestamp — только после успешного удара).
 */
function beginProvisionBattleUse(consumables, usedAt, itemId, now = Date.now()) {
    const id = String(itemId || "").trim();
    if (!id) {
        return { ok: false, error: "Не указан предмет провианта." };
    }
    const cd = checkProvisionCooldown(usedAt, id, now);
    if (!cd.ok) {
        return cd;
    }
    const spent = consumeProvision(consumables, id);
    if (!spent.ok) {
        return spent;
    }
    return {
        ok: true,
        def: spent.def,
        consumables: spent.next,
        gadgetUsed: {
            label: spent.def.label,
            feedPhrase: spent.def.feedPhrase,
            effectFeed: spent.def.effectFeed || null
        }
    };
}

/**
 * Использование провианта вне боя (гардероб): кулдаун, списание, эффекты на rage/hp.
 */
function useProvisionFromInventory(user, itemId, now = Date.now(), opts = {}) {
    const id = String(itemId || "").trim();
    const maxHp = Math.max(1, Math.floor(Number(opts.maxHp) || 100));

    const consumablesRaw =
        user?.consumables && typeof user.consumables === "object" ? user.consumables : {};
    const consumables = { ...consumablesRaw, ...countsFromConsumables(consumablesRaw) };
    const usedAt = parseConsumablesUsedAtRaw(user?.consumablesUsedAt ?? user?.consumables_used_at);

    const cd = checkProvisionCooldown(usedAt, id, now);
    if (!cd.ok) {
        return cd;
    }

    const spent = consumeProvision(consumables, id);
    if (!spent.ok) {
        return spent;
    }

    const def = spent.def;
    const updates = {};
    let message = `Использован: ${def.label}`;

    if (def.furySetTo != null) {
        updates.rage = Math.max(0, Math.min(150, Math.floor(Number(def.furySetTo) || 0)));
        message = `${def.label}: ярость ${updates.rage}`;
    } else if (def.furyRestore) {
        const cur = Math.max(0, Math.min(150, Math.floor(Number(user?.rage) || 0)));
        updates.rage = Math.min(150, cur + def.furyRestore);
        message = `${def.label}: ярость +${def.furyRestore}`;
    } else if (def.healHp) {
        const hp = Math.max(0, Math.min(maxHp, Math.round(Number(user?.hp) || maxHp)));
        updates.hp = Math.min(maxHp, hp + def.healHp);
        message = `${def.label}: +${def.healHp} HP`;
    } else if (def.effectFeed) {
        message = `${def.label}: ${def.effectFeed}`;
    }

    return {
        ok: true,
        def,
        consumables: spent.next,
        usedAt: stampProvisionUsed(usedAt, id, now),
        updates,
        message
    };
}

function catalogForShop(consumables) {
    const counts = countsFromConsumables(consumables);
    return PROVISION_IDS.map((id) => {
        const def = PROVISION_ITEMS[id];
        return {
            id: def.id,
            label: def.label,
            icon: def.icon,
            description: def.description,
            usageHtml: def.usageHtml,
            effectHtml: def.effectHtml,
            priceDollars: def.priceDollars,
            priceMushrooms: def.priceMushrooms,
            count: counts[id]
        };
    });
}

module.exports = {
    PROVISION_ITEMS,
    PROVISION_IDS,
    PROVISION_ORDER,
    countsFromConsumables,
    catalogOwnedForClient,
    catalogForShop,
    consumeProvision,
    parseConsumablesUsedAtRaw,
    parseProvisionUsedAt,
    checkProvisionCooldown,
    stampProvisionUsed,
    beginProvisionBattleUse,
    useProvisionFromInventory,
    formatProvisionCooldownError
};
