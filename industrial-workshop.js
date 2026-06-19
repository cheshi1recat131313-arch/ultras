/**
 * Общая логика мастерских Промзоны (Коллайдер / Швейный цех).
 * Один слот инвентаря — одна мастерская: weapon → Коллайдер, clothes → Швейный цех.
 */

const gearUpgrades = require("./gear-upgrades");
const { parseJson } = require("./core/parse-json");

/**
 * @typedef {object} WorkshopConfig
 * @property {string} slot — "weapon" (один слот)
 * @property {string[]} [slots] — для швейного: clothes, boots, head
 * @property {string} itemsKey — ключ списка в ответе API ("weapons" | "clothes")
 * @property {string} [equipKey] — ключ в equipment (legacy)
 */

function workshopSlots(config) {
    if (Array.isArray(config.slots) && config.slots.length) return config.slots;
    if (config.slot) return [config.slot];
    return [];
}

/**
 * @param {string[]} inventory
 * @param {Record<string, object>} shopItems
 * @param {string|string[]} slotOrSlots
 */
function inventoryIdsForSlot(inventory, shopItems, slotOrSlots) {
    const slots = Array.isArray(slotOrSlots) ? slotOrSlots : [slotOrSlots];
    return inventory.filter((id) => slots.includes(shopItems[id]?.slot));
}

/**
 * @param {object} user
 * @param {Record<string, object>} shopItems
 * @param {string[]} inventory
 * @param {WorkshopConfig} config
 * @param {string|null} selectedId
 */
function buildWorkshopPayload(user, shopItems, inventory, config, selectedId) {
    let upgrades = parseJson(user.gear_upgrades, {});

    const normalized = gearUpgrades.normalizeUpgrades(upgrades, shopItems);
    upgrades = normalized.upgrades;

    const itemIds = inventoryIdsForSlot(inventory, shopItems, workshopSlots(config));
    let upgradesDirty = normalized.changed;

    for (const id of itemIds) {
        const before = JSON.stringify(upgrades[id]);
        upgrades = gearUpgrades.ensureItemUpgrade(upgrades, id);
        if (JSON.stringify(upgrades[id]) !== before) upgradesDirty = true;
    }

    const eq = parseJson(user.equipment, {});
    const equippedId =
        (config.equipKey && eq[config.equipKey]?.id) ||
        itemIds.find((id) => Object.values(eq).some((item) => item?.id === id)) ||
        null;

    let activeId = selectedId && itemIds.includes(selectedId) ? selectedId : null;
    if (!activeId) {
        activeId = equippedId && itemIds.includes(equippedId) ? equippedId : itemIds[0] || null;
    }

    const items = itemIds.map((id) =>
        gearUpgrades.buildUpgradeView(id, shopItems[id], upgrades)
    );
    const active = activeId ? gearUpgrades.buildUpgradeView(activeId, shopItems[activeId], upgrades) : null;

    return {
        success: true,
        [config.itemsKey]: items,
        active,
        activeId,
        _upgradesDirty: upgradesDirty,
        _upgrades: upgrades
    };
}

/**
 * @param {Function} runQuery
 * @param {Function} getQuery
 * @param {string} email
 * @param {object} payload
 * @param {WorkshopConfig} config
 * @param {Function} rebuild — (user, activeId) => payload
 */
async function saveWorkshopUpgradesIfNeeded(runQuery, getQuery, email, payload, rebuild) {
    if (payload._upgradesDirty) {
        await runQuery("UPDATE users SET gear_upgrades = ? WHERE email = ?", [
            JSON.stringify(payload._upgrades),
            email
        ]);
        const user = await getQuery("SELECT * FROM users WHERE email = ?", [email]);
        return rebuild(user, payload.activeId);
    }
    const { _upgradesDirty, _upgrades, ...clean } = payload;
    return clean;
}

function stripInternalPayloadFields(payload) {
    const { _upgradesDirty, _upgrades, ...clean } = payload;
    return clean;
}

module.exports = {
    workshopSlots,
    inventoryIdsForSlot,
    buildWorkshopPayload,
    saveWorkshopUpgradesIfNeeded,
    stripInternalPayloadFields
};
