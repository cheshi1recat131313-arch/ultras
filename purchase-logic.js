/**
 * Единая логика оплаты: сначала доллары (монеты), при нехватке — грибы.
 */

function lackCoinWord(amount) {
    const n = Math.abs(Math.floor(Number(amount) || 0)) % 100;
    const d = n % 10;
    if (d >= 2 && d <= 4 && (n < 10 || n >= 20)) return "монеты";
    if (d === 1 && n !== 11) return "монеты";
    return "монет";
}

function dualCurrencyLackError(haveDollars, haveMushrooms, needDollars, needMushrooms) {
    const lackD = Math.max(0, Math.floor(needDollars) - Math.floor(haveDollars));
    const lackM = Math.max(0, Math.floor(needMushrooms) - Math.floor(haveMushrooms));
    if (lackD > 0 && lackM > 0) {
        return `Не хватает ${lackD} ${lackCoinWord(lackD)} и ${lackM} грибов.`;
    }
    if (lackD > 0) return `Не хватает ${lackD} ${lackCoinWord(lackD)}.`;
    if (lackM > 0) return `Не хватает ${lackM} грибов.`;
    return "Недостаточно средств.";
}

/** Доллары → при нехватке грибы. */
function dualCurrencyPayPlan(haveDollars, haveMushrooms, needDollars, needMushrooms) {
    const haveD = Math.max(0, Math.floor(Number(haveDollars) || 0));
    const haveM = Math.max(0, Math.floor(Number(haveMushrooms) || 0));
    const needD = Math.max(0, Math.floor(Number(needDollars) || 0));
    const needM = Math.max(0, Math.floor(Number(needMushrooms) || 0));

    if (haveD >= needD) {
        return {
            ok: true,
            payWith: "dollars",
            newDollars: haveD - needD,
            newMushrooms: haveM
        };
    }
    if (haveM >= needM) {
        return {
            ok: true,
            payWith: "mushrooms",
            newDollars: haveD,
            newMushrooms: haveM - needM
        };
    }
    return {
        ok: false,
        error: dualCurrencyLackError(haveD, haveM, needD, needM)
    };
}

function rublesLackError(haveRubles, needRubles) {
    const lack = Math.max(0, Math.floor(needRubles) - Math.floor(haveRubles));
    return lack > 0 ? `Не хватает ${lack} серебра` : "Недостаточно средств";
}

function rublesPayPlan(haveRubles, needRubles) {
    const have = Math.max(0, Math.floor(Number(haveRubles) || 0));
    const need = Math.max(0, Math.floor(Number(needRubles) || 0));
    if (have >= need) {
        return { ok: true, newRubles: have - need };
    }
    return { ok: false, error: rublesLackError(have, need) };
}

function mushroomsLackError(haveMushrooms, needMushrooms) {
    const lack = Math.max(0, Math.floor(needMushrooms) - Math.floor(haveMushrooms));
    return lack > 0 ? `Не хватает ${lack} грибов` : "Недостаточно средств";
}

function mushroomsPayPlan(haveMushrooms, needMushrooms) {
    const have = Math.max(0, Math.floor(Number(haveMushrooms) || 0));
    const need = Math.max(0, Math.floor(Number(needMushrooms) || 0));
    if (have >= need) {
        return { ok: true, newMushrooms: have - need };
    }
    return { ok: false, error: mushroomsLackError(have, need) };
}

module.exports = {
    dualCurrencyLackError,
    dualCurrencyPayPlan,
    rublesLackError,
    rublesPayPlan,
    mushroomsLackError,
    mushroomsPayPlan
};
