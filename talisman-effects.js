const talismans = require("./talismans");



function ownedForMode(rawOwned, mode) {

    if (!mode) return talismans.parseOwnedTalismans(talismans.resolveOwnedRaw(rawOwned));

    return talismans.filterOwnedForMode(rawOwned, mode);

}



function chanceFromOwned(rawOwned, talismanId, mode) {

    const owned = ownedForMode(rawOwned, mode);

    const state = owned[talismanId];

    if (!state) return 0;

    const def = talismans.TALISMANS[talismanId];

    if (!def) return 0;

    const level = Math.max(1, Math.floor(Number(state.level) || 1));

    const percent = (def.basePercent || 0) + (level - 1) * (def.stepPercent || 0);

    return Math.max(0, Number(percent) / 100);

}



function isTalismanOwned(rawOwned, talismanId, mode) {

    return chanceFromOwned(rawOwned, talismanId, mode) > 0;

}



function rollTriggered(chance, rng = Math.random) {

    if (!(chance > 0)) return false;

    return rng() < chance;

}



/** Единый бросок срабатывания талисмана по уровню игрока. */

function rollTalisman(rawOwned, talismanId, mode, rng = Math.random) {

    return rollTriggered(chanceFromOwned(rawOwned, talismanId, mode), rng);

}



function repSourceToMode(source) {

    const s = String(source || "")

        .trim()

        .toLowerCase();

    if (s === "stadium") return talismans.MODES.STADIUM;

    if (s === "pub_battle") return talismans.MODES.PUB_BATTLE;

    return talismans.MODES.DISTRICT;

}



function rollNeoDodge(rawOwned, rng = Math.random, mode = talismans.MODES.STADIUM) {

    return rollTalisman(rawOwned, "neo_figure", mode, rng);

}



function rollMayaMask(rawOwned, rng = Math.random, mode = talismans.MODES.STADIUM) {

    return rollTalisman(rawOwned, "maya_mask", mode, rng);

}



function applyKlitschkoMultiplier(rawOwned, damage, rng = Math.random, mode = talismans.MODES.STADIUM) {

    const triggered = rollTalisman(rawOwned, "klitschko_glove", mode, rng);

    if (!triggered) return { triggered: false, damage };

    return { triggered: true, damage: Math.round(Math.max(0, Number(damage) || 0) * 2) };

}



function rollGoldClover(rawOwned, rng = Math.random, mode = talismans.MODES.STADIUM) {

    return rollTalisman(rawOwned, "gold_clover", mode, rng);

}



function rollClover(rawOwned, rng = Math.random, mode = talismans.MODES.DISTRICT) {

    return rollTalisman(rawOwned, "clover", mode, rng);

}



function rollSpring(rawOwned, rng = Math.random, mode = talismans.MODES.STADIUM) {

    return rollTalisman(rawOwned, "spring", mode, rng);

}



function rollMercedesRep(rawOwned, rng = Math.random, mode) {

    const m = mode ?? null;

    return rollTalisman(rawOwned, "mercedes_badge", m, rng);

}



function rollZirconBracelet(rawOwned, rng = Math.random, mode = talismans.MODES.DISTRICT) {

    return rollTalisman(rawOwned, "zircon_bracelet", mode, rng);

}



function rollLuckyDollar(rawOwned, rng = Math.random, mode = talismans.MODES.DISTRICT) {

    return rollTalisman(rawOwned, "lucky_dollar", mode, rng);

}



function rollChip(rawOwned, rng = Math.random, mode = talismans.MODES.KICKER) {

    return rollTalisman(rawOwned, "chip", mode, rng);

}



/** Удвоение репутации (Шильдик Мерседеса) при успешном броске. */

function applyMercedesRep(rawOwned, repGain, opts = {}) {

    const base = Math.max(0, Math.floor(Number(repGain) || 0));

    const rng = opts.rng || Math.random;

    const mode = opts.mode != null ? opts.mode : repSourceToMode(opts.source);

    if (base < 1 || !rollMercedesRep(rawOwned, rng, mode)) {

        return { repGain: base, mercedesBoost: false };

    }

    return { repGain: base * 2, mercedesBoost: true };

}



module.exports = {

    isTalismanOwned,

    chanceFromOwned,

    rollTalisman,

    rollTriggered,

    repSourceToMode,

    rollNeoDodge,

    rollMayaMask,

    applyKlitschkoMultiplier,

    rollGoldClover,

    rollClover,

    rollSpring,

    rollMercedesRep,

    applyMercedesRep,

    rollZirconBracelet,

    rollLuckyDollar,

    rollChip

};


