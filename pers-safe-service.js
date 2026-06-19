/**
 * Операции сейфа (персистентность в users).
 */

const safe = require("./safe");
const purchaseLogic = require("./purchase-logic");

function createPersSafeService({ runQuery, getQuery, requireExistingUser }) {
    async function getSafeInfo(email) {
        const user = await requireExistingUser(email);
        if (!user) return { ok: false, error: "Пользователь не найден." };
        const state = safe.buildSafeState(user);
        return {
            ok: true,
            ...state,
            dollars: Math.max(0, Math.floor(Number(user.dollars) || 0))
        };
    }

    async function deposit(email, rawAmount) {
        const amount = safe.normalizeBalance(rawAmount);
        if (amount < 1) {
            return { ok: false, error: "Укажи количество больше 0." };
        }

        const user = await requireExistingUser(email);
        if (!user) return { ok: false, error: "Пользователь не найден." };

        const state = safe.buildSafeState(user);
        const wallet = state.walletRubles;
        if (wallet < amount) {
            return { ok: false, error: "Недостаточно серебра." };
        }
        if (state.safeBalance + amount > state.capacity) {
            return { ok: false, error: "Недостаточно места в сейфе." };
        }

        const newWallet = wallet - amount;
        const newSafe = state.safeBalance + amount;
        await runQuery("UPDATE users SET rubles = ?, money = ?, safe_balance = ? WHERE email = ?", [
            newWallet,
            newWallet,
            newSafe,
            email
        ]);

        const updated = await requireExistingUser(email);
        return {
            ok: true,
            message: `В сейф положено ${amount} серебра.`,
            safe: safe.buildSafeState(updated)
        };
    }

    async function withdraw(email, rawAmount) {
        const amount = safe.normalizeBalance(rawAmount);
        if (amount < 1) {
            return { ok: false, error: "Укажи количество больше 0." };
        }

        const user = await requireExistingUser(email);
        if (!user) return { ok: false, error: "Пользователь не найден." };

        const state = safe.buildSafeState(user);
        if (state.safeBalance < amount) {
            return { ok: false, error: "В сейфе недостаточно серебра." };
        }

        const newWallet = state.walletRubles + amount;
        const newSafe = state.safeBalance - amount;
        await runQuery("UPDATE users SET rubles = ?, money = ?, safe_balance = ? WHERE email = ?", [
            newWallet,
            newWallet,
            newSafe,
            email
        ]);

        const updated = await requireExistingUser(email);
        return {
            ok: true,
            message: `Из сейфа снято ${amount} серебра.`,
            safe: safe.buildSafeState(updated)
        };
    }

    async function upgrade(email) {
        const user = await requireExistingUser(email);
        if (!user) return { ok: false, error: "Пользователь не найден." };

        const state = safe.buildSafeState(user);
        if (!state.canUpgrade) {
            return { ok: false, error: "Сейф уже максимального уровня." };
        }

        const cost = state.upgradeCost;
        const dollars = Math.max(0, Math.floor(Number(user.dollars) || 0));
        if (dollars < cost) {
            return {
                ok: false,
                error: purchaseLogic.dualCurrencyLackError(dollars, 0, cost, 0)
            };
        }

        const newLevel = state.safeLevel + 1;
        if (state.safeBalance > safe.capacityForLevel(newLevel)) {
            return {
                ok: false,
                error: "Сначала сними лишнее серебро — оно не помещается на новом уровне."
            };
        }

        await runQuery("UPDATE users SET dollars = ?, safe_level = ? WHERE email = ?", [
            dollars - cost,
            newLevel,
            email
        ]);

        const updated = await requireExistingUser(email);
        return {
            ok: true,
            message: `Сейф улучшен до уровня ${newLevel}.`,
            safe: safe.buildSafeState(updated)
        };
    }

    return {
        getSafeInfo,
        deposit,
        withdraw,
        upgrade
    };
}

module.exports = { createPersSafeService };
