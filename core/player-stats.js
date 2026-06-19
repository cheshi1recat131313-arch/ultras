/**
 * Эффективные статы игрока: база + тату + экипировка + уровни прокачки шмота.
 * Единый расчёт для боя, досье, API /getUser.
 */

const { parseJson } = require("./parse-json");
const gearUpgrades = require("../gear-upgrades");

/**
 * @param {Record<string, object>} shopItems — каталог предметов (SHOP_ITEMS)
 */
function createPlayerStats(shopItems) {
    const catalog = shopItems || {};

    function getActiveTattoos(row) {
        const tattoos = parseJson(row.tattoos, {});
        if (tattoos.expiresAt && Date.now() > tattoos.expiresAt) {
            return { power: 0, speed: 0, intel: 0, stamina: 0, expiresAt: 0 };
        }
        return tattoos;
    }

    function getEquipmentBonuses(row) {
        const eq = parseJson(row.equipment, {});
        const upgrades = gearUpgrades.parseUpgrades(parseJson(row.gear_upgrades, {}));
        const now = Date.now();
        const bonuses = { power: 0, speed: 0, intel: 0, stamina: 0 };
        for (const key of Object.keys(eq)) {
            const item = eq[key];
            if (!item) continue;
            const def = item.id ? catalog[item.id] : null;
            if (item.id && !def) {
                delete eq[key];
                continue;
            }
            if (item.id && gearUpgrades.isUpgrading(upgrades, item.id, now)) {
                continue;
            }
            if (def && item.id) {
                const level = upgrades[item.id]?.level || 1;
                const stats = gearUpgrades.itemStatsAtLevel(def, level);
                bonuses.power += stats.power;
                bonuses.speed += stats.speed;
                bonuses.intel += stats.intel;
                bonuses.stamina += stats.stamina;
            } else {
                bonuses.power += item.power || 0;
                bonuses.speed += item.speed || 0;
                bonuses.intel += item.intel || 0;
                bonuses.stamina += item.stamina || 0;
            }
        }
        return { equipment: eq, bonuses };
    }

    function getEffectiveStats(row) {
        const tattoos = getActiveTattoos(row);
        const { equipment, bonuses } = getEquipmentBonuses(row);
        const base = {
            power: row.power ?? 10,
            speed: row.speed ?? 10,
            intel: row.intel ?? 10,
            stamina: row.stamina ?? 10
        };
        const effective = {
            power: base.power + (tattoos.power || 0) + bonuses.power,
            speed: base.speed + (tattoos.speed || 0) + bonuses.speed,
            intel: base.intel + (tattoos.intel || 0) + bonuses.intel,
            stamina: base.stamina + (tattoos.stamina || 0) + bonuses.stamina
        };
        return { base, effective, tattoos, equipment, bonuses };
    }

    return { getActiveTattoos, getEquipmentBonuses, getEffectiveStats };
}

module.exports = { createPlayerStats };
