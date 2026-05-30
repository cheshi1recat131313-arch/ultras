/**
 * Бой в стиле hools: полный расчёт урона + короткий лог (~3 удара с каждой стороны).
 */

const headerSsr = require("./header-ssr");
const battleLog = require("./public/js/battle-log.js");

const MAX_RAGE = 150;
const FIGHT_DMG_CAP = 40;
const FIGHT_MAX_ROUNDS = 10;
const HEART_IMG = battleLog.HEART_IMG;
const escapeHtml = battleLog.escapeHtml;

function bold(s) {
    return `<b>${escapeHtml(s)}</b>`;
}

function round2(x) {
    return Math.round(Number(x) * 100) / 100;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function combatRating(eff, level) {
    const lvl = level ?? 1;
    return (
        (eff.power || 10) * 1.15 +
        (eff.speed || 10) * 0.95 +
        (eff.intel || 10) * 0.85 +
        (eff.stamina || 10) * 1.0 +
        lvl * 2.5
    );
}

function equipmentGearMult(equipment) {
    if (!equipment || !equipment.weapon) return 1;
    let mult = 1.02;
    if (equipment.clothes) mult *= 1.1;
    return mult;
}

/** Сила боя: база × уровень × 5 × шмот × прокачка. */
function fightStrengthScore(eff, level, opts = {}) {
    const lvl = Math.max(1, level ?? 1);
    const base = (eff.power || 10) * 1.2 + (eff.speed || 10) * 0.35 + (eff.stamina || 10) * 0.45;
    const gear = opts.gearMult ?? equipmentGearMult(opts.equipment);
    const bonus = opts.bonuses || {};
    const gearBonus = 1 + ((bonus.power || 0) + (bonus.speed || 0) + (bonus.stamina || 0)) * 0.1;
    const trained =
        1 +
        (Math.max(0, (eff.power || 10) - 10) +
            Math.max(0, (eff.speed || 10) - 10) +
            Math.max(0, (eff.stamina || 10) - 10)) *
            0.06;
    let score = base * lvl * 5 * gear * gearBonus * trained;

    if (lvl <= 1 && (!opts.equipment || !opts.equipment.weapon)) score *= 0.5;
    if (lvl >= 2 && (opts.statPointsPending || 0) > 0) score *= 0.55;

    return score;
}

function enemyStrengthScore(opponent, playerLevel) {
    const lvl = Math.max(1, playerLevel ?? 1);
    const base =
        (opponent.power || 10) * 1.2 + (opponent.speed || 10) * 0.35 + (opponent.stamina || 10) * 0.45;
    const scale = 1 + (lvl - 1) * 0.32;
    return base * (opponent.isSteward ? 5.8 : 6.35) * scale;
}

function computeWinChance(playerScore, enemyScore, steward) {
    const diff = playerScore - enemyScore;
    const slope = steward ? 0.016 : 0.019;
    return Math.max(0.1, Math.min(0.9, 0.5 + diff * slope));
}

function tinyDamageNoise() {
    return (Math.random() - 0.5) * 0.5;
}

function planBalancedTotals(playerScore, enemyScore, won) {
    const mid = 30;
    const edge = Math.max(-1.2, Math.min(1.2, (playerScore - enemyScore) / 28));
    let toEnemy = mid + edge * 0.35 + tinyDamageNoise();
    let toPlayer = mid - edge * 0.35 + tinyDamageNoise();

    if (won) {
        if (toEnemy < toPlayer + 0.5) toEnemy = toPlayer + 0.5 + Math.random() * 0.5;
        if (toEnemy > toPlayer + 1.0) toEnemy = toPlayer + 0.5 + Math.random() * 0.5;
    } else {
        if (toPlayer < toEnemy + 0.5) toPlayer = toEnemy + 0.5 + Math.random() * 0.5;
        if (toPlayer > toEnemy + 1.0) toPlayer = toEnemy + 0.5 + Math.random() * 0.5;
    }

    return {
        totalToEnemy: round2(Math.min(FIGHT_DMG_CAP, Math.max(18, toEnemy))),
        totalToPlayer: round2(Math.min(FIGHT_DMG_CAP, Math.max(18, toPlayer)))
    };
}

function splitDamageTight(total, parts) {
    const n = Math.max(1, parts);
    let left = round2(Math.max(0, total));
    if (left <= 0) return [];
    if (n === 1) return [left];
    const hits = [];
    for (let i = 0; i < n - 1; i += 1) {
        const remaining = n - i;
        const fair = left / remaining;
        const chunk = round2(Math.max(0.5, Math.min(left - (remaining - 1) * 0.5, fair + tinyDamageNoise())));
        hits.push(chunk);
        left = round2(left - chunk);
    }
    hits.push(round2(Math.max(0.5, left)));
    const sum = round2(hits.reduce((a, b) => a + b, 0));
    const fix = round2(total - sum);
    if (Math.abs(fix) >= 0.05) hits[hits.length - 1] = round2(Math.max(0.5, hits[hits.length - 1] + fix));
    return hits;
}

function buildFightLogFromTotals(playerName, opponent, totalToEnemy, totalToPlayer, won, startRage, openingSide) {
    const log = [];
    const en = opponent.name;
    if (startRage > 100 && Math.random() < 0.22) {
        log.push(logEntry("sys", shortRageBoil(playerName)));
    }
    const pHits = splitDamageTight(totalToEnemy, 3);
    const eHits = splitDamageTight(totalToPlayer, 3);
    const pVerbs = ["ударил", "врезал по корпусу", "дёрнул в челюсть"];
    const eVerbs = ["ударил в нос", "врезал", "пнул"];
    const rounds = Math.max(pHits.length, eHits.length);
    const playerFirst = openingSide === "right";
    for (let i = 0; i < rounds; i += 1) {
        const pLine = pHits[i] ? logEntry("me", shortHit(playerName, pick(pVerbs), pHits[i])) : null;
        const eLine = eHits[i] ? logEntry("en", shortHit(en, pick(eVerbs), eHits[i])) : null;
        if (playerFirst) {
            if (pLine) log.push(pLine);
            if (eLine) log.push(eLine);
        } else {
            if (eLine) log.push(eLine);
            if (pLine) log.push(pLine);
        }
    }
    if (won) log.push(logEntry("sys", shortFinisher(playerName, en)));
    return log;
}

/** Криты только при ярости выше 100 (110, 120…). При 100 и ниже — без критов. */
function rageCritStats(rage) {
    const r = Math.max(0, rage ?? 0);
    if (r <= 100) {
        return { chance: 0, mult: 1 };
    }
    const over = r - 100;
    return {
        chance: Math.min(0.48, 0.03 + over / 100),
        mult: 1.22 + Math.min(0.45, over / 90)
    };
}

function calcDamageFloat(attackerPower, defenderStamina, multiplier = 1, critChance = 0, critMult = 1.3) {
    const jitter = (Math.random() - 0.5) * 1.4;
    let dmg = attackerPower * multiplier * 0.38 - defenderStamina * 0.1 + jitter;
    dmg = Math.max(1.2, Math.min(12, dmg));
    if (critChance > 0 && Math.random() < critChance) {
        dmg = Math.min(16, dmg * critMult);
    }
    return round2(dmg);
}

/** Урон бота в районе — близко к урону игрока (равный размен). */
function enemyStrikePower(playerEff, opponent) {
    const pp = playerEff.power || 10;
    const op = opponent.power || 10;
    if (opponent.isSteward) {
        return Math.round(Math.max(op, pp * 1.22));
    }
    return Math.round(Math.max(op, pp * 0.92));
}

function dmgTag(dmg) {
    const d = round2(dmg);
    return `(−${d % 1 === 0 ? d.toFixed(0) : d.toFixed(1)} ${HEART_IMG})`;
}

function shortHit(attacker, verb, dmg) {
    return `<p class="fight-log-line">${bold(attacker)} ${verb} ${dmgTag(dmg)}</p>`;
}

function shortCrit(attacker, dmg) {
    return `<p class="fight-log-line fight-crit">${bold(attacker)} кританул ${dmgTag(dmg)}</p>`;
}

function shortDodge(defender) {
    return `<p class="fight-log-line">${bold(defender)} увернулся</p>`;
}

function shortBlock(defender) {
    return `<p class="fight-log-line">${bold(defender)} встал в блок</p>`;
}

function shortMiss(attacker) {
    return `<p class="fight-log-line">${bold(attacker)} промахнулся</p>`;
}

function shortRageBoil(name) {
    return `<p class="fight-log-line fight-sys">${bold(name)}: ярость вскипела!</p>`;
}

function shortFinisher(attacker, defender) {
    return `<p class="fight-log-line fight-sys">${bold(attacker)} добил ${bold(defender)}</p>`;
}

function logEntry(who, html) {
    return { who, html };
}

function capHitDamage(dmg, remaining) {
    if (remaining == null) return dmg;
    return round2(Math.max(0, Math.min(dmg, remaining)));
}

function runNarrativeKickRound(playerName, playerEff, opponent, playerHp, enemyHp, side, opts = {}) {
    const log = [];
    let eHp = round2(enemyHp);
    let pHp = round2(playerHp);
    let dmgToEnemy = 0;
    let dmgToPlayer = 0;
    let rage = Math.min(MAX_RAGE, Math.max(0, opts.rage ?? 0));
    const playerLevel = opts.playerLevel ?? 1;
    const pRate = combatRating(playerEff, playerLevel);
    const eRate = combatRating(opponent, 1);
    const edge = Math.max(-0.35, Math.min(0.35, (pRate - eRate) / 48));
    const mult = (side === "right" ? 1.05 : 1.0) * (1 + edge * 0.08);
    const en = opponent.name;
    const rc = rageCritStats(opts.startRage ?? rage);

    if (opts.capEnemy > 0) {
        const isCrit = rc.chance > 0 && Math.random() < rc.chance;
        let dmg = calcDamageFloat(playerEff.power, opponent.stamina, mult, 0, rc.mult);
        if (isCrit) dmg = round2(Math.min(16, dmg * rc.mult));
        if (rage > 100 && Math.random() < 0.2) {
            log.push(logEntry("sys", shortRageBoil(playerName)));
            dmg = round2(Math.min(16, dmg * 1.08));
        }
        if (opponent.isSteward) dmg = round2(dmg * 0.92);
        dmg = capHitDamage(dmg, opts.capEnemy);
        const verbs = ["ударил", "врезал по корпусу", "дёрнул в челюсть"];
        if (isCrit) {
            log.push(logEntry("me", shortCrit(playerName, dmg)));
        } else {
            log.push(logEntry("me", shortHit(playerName, pick(verbs), dmg)));
        }
        dmgToEnemy = dmg;
        eHp = round2(Math.max(0, eHp - dmg));
        rage = Math.max(0, rage - randomInt(2, 4));
    }

    if (eHp <= 0) {
        log.push(logEntry("sys", shortFinisher(playerName, en)));
        return { log, playerHp: pHp, enemyHp: 0, status: "won", dmgToEnemy, dmgToPlayer, rage };
    }

    if (opts.capPlayer > 0) {
        const verbs = ["ударил в нос", "врезал", "пнул"];
        const ePow = enemyStrikePower(playerEff, opponent);
        let edmg = calcDamageFloat(ePow, playerEff.stamina, 1.02 - edge * 0.03, 0, 1);
        if (opponent.isSteward) edmg = round2(Math.min(16, edmg * 1.08));
        edmg = capHitDamage(edmg, opts.capPlayer);
        dmgToPlayer = edmg;
        log.push(logEntry("en", shortHit(en, pick(verbs), edmg)));
        pHp = round2(Math.max(0, pHp - edmg));
        rage = Math.max(0, rage - randomInt(1, 3));
    }

    if (pHp <= 0) {
        return { log, playerHp: 0, enemyHp: eHp, status: "lost", dmgToEnemy, dmgToPlayer, rage };
    }
    return { log, playerHp: pHp, enemyHp: eHp, status: "continue", dmgToEnemy, dmgToPlayer, rage };
}

function resolveNarrativeFightFull(playerName, playerEff, opponent, playerHp, enemyHp, openingSide, opts = {}) {
    const playerLevel = opts.playerLevel ?? 1;
    const startRage = Math.min(MAX_RAGE, Math.max(0, opts.startRage ?? 100));
    const pHp = round2(playerHp);
    const eHp = round2(enemyHp);

    const balanceOpts = {
        equipment: opts.equipment,
        bonuses: opts.bonuses,
        statPointsPending: opts.statPointsPending ?? 0,
        gearMult: opts.gearMult
    };
    const pScore = fightStrengthScore(playerEff, playerLevel, balanceOpts);
    const eScore = enemyStrengthScore(opponent, playerLevel);
    const winChance = computeWinChance(pScore, eScore, opponent.isSteward);
    const won = Math.random() < winChance;
    const { totalToEnemy, totalToPlayer } = planBalancedTotals(pScore, eScore, won);
    const log = buildFightLogFromTotals(
        playerName,
        opponent,
        totalToEnemy,
        totalToPlayer,
        won,
        startRage,
        openingSide
    );
    const endRage = Math.max(0, startRage - randomInt(2, 6));

    return applyDamageAdjudication({
        status: won ? "won" : "lost",
        log,
        playerHp: round2(Math.max(0, pHp - totalToPlayer)),
        enemyHp: won ? 0 : round2(Math.max(0, eHp - totalToEnemy)),
        totalToEnemy,
        totalToPlayer,
        endRage
    });
}

function pickSpread(items, n) {
    if (!items.length) return [];
    if (items.length <= n) return items.slice();
    const out = [];
    for (let i = 0; i < n; i += 1) {
        const idx = Math.min(items.length - 1, Math.round((i * (items.length - 1)) / Math.max(1, n - 1)));
        out.push(items[idx]);
    }
    return out;
}

function isFightDamageLogLine(row) {
    return Boolean(row?.html && /\(−[\d.]+/.test(row.html));
}

/** Сумма урона по строкам лога с меткой (−X ❤); промахи/уклонения/блоки не учитываются. */
function sumHitDamageFromLogRows(rows) {
    let toEnemy = 0;
    let toPlayer = 0;
    for (const row of rows || []) {
        if (!isFightDamageLogLine(row)) continue;
        const m = row.html.match(/\(−([\d.]+)/);
        if (!m) continue;
        const d = parseFloat(m[1]);
        if (row.who === "me") toEnemy += d;
        else if (row.who === "en") toPlayer += d;
    }
    return { toEnemy: Math.round(toEnemy), toPlayer: Math.round(toPlayer) };
}

/** Короткий лог: ~3 удара игрока и ~3 противника, чередованием. */
function compactFightResolvedLog(resolved) {
    const log = resolved.log || [];
    const player = log.filter((r) => r.who === "me" && isFightDamageLogLine(r));
    const enemy = log.filter((r) => r.who === "en" && isFightDamageLogLine(r));
    const finisher = log.find((r) => r.who === "sys" && r.html && r.html.includes("добил"));
    const rageLine = log.find((r) => r.who === "sys" && r.html && r.html.includes("вскипела"));

    const p3 = pickSpread(player, 3);
    const e3 = pickSpread(enemy, 3);
    const out = [];

    if (rageLine) out.push(rageLine);
    const rounds = Math.max(p3.length, e3.length);
    for (let i = 0; i < rounds; i += 1) {
        if (p3[i]) out.push(p3[i]);
        if (e3[i]) out.push(e3[i]);
    }
    if (finisher && resolved.status === "won") out.push(finisher);

    return out;
}

function applyDamageAdjudication(resolved) {
    return {
        ...resolved,
        totalToEnemy: round2(Math.min(FIGHT_DMG_CAP, resolved.totalToEnemy || 0)),
        totalToPlayer: round2(Math.min(FIGHT_DMG_CAP, resolved.totalToPlayer || 0)),
        endRage: resolved.endRage ?? 0
    };
}

function buildFightPageHtml(ctx) {
    const headerHtml = headerSsr.buildHeaderHtml(ctx.user || null);

    if (!ctx.ok) {
        return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Бой</title><link rel="stylesheet" href="/css/hools.css"><link rel="stylesheet" href="/css/fight-page.css"></head>
<body class="hools fight-body">
<div class="app fight-app"><header class="header" id="header">${headerHtml}</header><div class="fight-container">
  <h5 class="fight-title fight-title-bad">Ошибка</h5>
  <p class="fight-error">${escapeHtml(ctx.error || "Неизвестная ошибка")}</p>
  <a class="fight-btn-row" href="/district.html"><button type="button" class="fight-btn fight-btn-wide">← В район</button></a>
</div></div>
  <script src="/js/session.js"></script>
  <script src="/js/api.js"></script>
  <script src="/js/header.js"></script>
  <script>
  (function(){
    var email = localStorage.getItem('email');
    if (!email) return;
    fetch('/getUser?email=' + encodeURIComponent(email)).then(function(r){ return r.json(); }).then(function(d){
      if (d.success && d.user && typeof renderHeaderBlock === 'function') renderHeaderBlock(d.user);
    }).catch(function(){});
  })();
  </script>
</body></html>`;
    }

    const won = ctx.status === "won";
    const mainBlock = battleLog.buildBattleLogBlock(ctx);
    const navBlock = battleLog.buildBattleLogNav(ctx, { showDistrictNav: true });

    const userJson = JSON.stringify(ctx.user || {}).replace(/</g, "\\u003c");

    return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>Бой — ${won ? "победа" : "поражение"}</title>
  <link rel="stylesheet" href="/css/hools.css">
  <link rel="stylesheet" href="/css/fight-page.css">
</head>
<body class="hools fight-body">
  <div class="app fight-app">
    <header class="header" id="header">${headerHtml}</header>
    ${mainBlock}
    ${navBlock}
    <footer class="site-footer" id="site-footer"></footer>
  </div>
  <script src="/js/session.js"></script>
  <script src="/js/api.js"></script>
  <script src="/js/header.js"></script>
  <script>
  (function(){
    try {
      var u = ${userJson};
      if (u && typeof renderHeaderBlock === "function") renderHeaderBlock(u);
    } catch (e) { /* ignore */ }
    var searchBtn = document.querySelector(".fight-search-js");
    if (!searchBtn) return;
    searchBtn.addEventListener("click", function (e) {
      e.preventDefault();
      var email = localStorage.getItem("email");
      if (!email) {
        window.location = "/district.html";
        return;
      }
      fetch("/district/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email })
      })
        .then(function () {
          window.location = "/district.html";
        })
        .catch(function () {
          window.location = "/district.html";
        });
    });
  })();
  </script>
</body>
</html>`;
}

module.exports = {
    escapeHtml,
    bold,
    round2,
    calcDamageFloat,
    resolveNarrativeFightFull,
    compactFightResolvedLog,
    sumHitDamageFromLogRows,
    applyDamageAdjudication,
    buildFightPageHtml,
    MAX_RAGE
};
