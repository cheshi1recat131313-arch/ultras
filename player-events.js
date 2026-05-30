/**
 * Журнал событий игрока (События).
 */

const battleLog = require("./public/js/battle-log.js");

const MAX_PLAYER_EVENTS = 100;

const EVENT_KINDS = {
    FIGHT_WIN: "fight_win",
    FIGHT_LOSS: "fight_loss",
    FIGHT_PVP_LOSS: "fight_pvp_loss",
    WORK: "work",
    QUEST: "quest",
    KICKER_WIN: "kicker_win",
    KICKER_LOSS: "kicker_loss",
    LOTTERY: "lottery",
    HAPPY_HOUR: "happy_hour"
};

function escapeHtml(s) {
    return battleLog.escapeHtml(s);
}

function formatEventTimestamp(ms) {
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(-2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildFightWinSummary(opponentName, rubles) {
    const name = String(opponentName || "соперника").trim();
    const amount = Math.max(0, Math.floor(Number(rubles) || 0));
    return `Ты напал на ${name}, победил и отжал ${amount}.`;
}

function buildFightLossSummary(opponentName, silverLoss) {
    const name = String(opponentName || "соперника").trim();
    const amount = Math.max(0, Math.floor(Number(silverLoss) || 0));
    return `Ты напал на ${name}, но получил по шее и потерял ${amount}.`;
}

function buildFightWinSummaryHtml(opponentName, rubles) {
    const name = escapeHtml(String(opponentName || "соперника").trim());
    return `Ты напал на ${name}, победил и отжал ${battleLog.silverAmountHtml(rubles)}.`;
}

function buildFightLossSummaryHtml(opponentName, silverLoss) {
    const name = escapeHtml(String(opponentName || "соперника").trim());
    return `Ты напал на ${name}, но получил по шее и потерял ${battleLog.silverAmountHtml(silverLoss)}.`;
}

function buildPvpLossSummary(attackerName, rubles) {
    const name = String(attackerName || "игрок").trim();
    const amount = Math.max(0, Math.floor(Number(rubles) || 0));
    return `На тебя напал игрок ${name} и отжал ${amount}.`;
}

function buildPvpLossSummaryHtml(attackerName, rubles) {
    const name = escapeHtml(String(attackerName || "игрок").trim());
    return `На тебя напал игрок ${name} и отжал ${battleLog.silverAmountHtml(rubles)}.`;
}

function buildWorkSummary(energySpent, reward) {
    const en = Math.max(0, Math.floor(Number(energySpent) || 0));
    const rub = Math.max(0, Math.floor(Number(reward) || 0));
    if (rub > 0) {
        return `Ты отработал ${en} энергии и получил ${rub}.`;
    }
    return `Ты отработал ${en} энергии и получил награду.`;
}

function buildWorkSummaryHtml(energySpent, reward) {
    const en = Math.max(0, Math.floor(Number(energySpent) || 0));
    const rub = Math.max(0, Math.floor(Number(reward) || 0));
    if (rub > 0) {
        return `Ты отработал ${en} энергии и получил ${battleLog.silverAmountHtml(rub)}.`;
    }
    return `Ты отработал ${en} энергии и получил награду.`;
}

function buildQuestSummary(questTitle) {
    const title = String(questTitle || "задание").trim();
    return `Выполнено задание «${title}».`;
}

function buildQuestRewardDetail(rewardLabel) {
    const label = String(rewardLabel || "").trim();
    return label ? `Получена награда: ${label}.` : "Получена награда.";
}

const ICO_DOLLAR = '<img src="/static/icons/gold.svg" class="fight-reward-ico" alt="">';

function buildHappyHourSummary(dollars, jackpot) {
    const n = Math.max(0, Math.floor(Number(dollars) || 0));
    if (jackpot) {
        return `🎁 Ты открыл коробку и сорвал джекпот — ${n} долларов!`;
    }
    const word = n === 1 ? "доллар" : n >= 2 && n <= 4 ? "доллара" : "долларов";
    return `🎁 Ты открыл коробку и получил ${n} ${word}.`;
}

function buildHappyHourSummaryHtml(dollars, jackpot) {
    const n = Math.max(0, Math.floor(Number(dollars) || 0));
    if (jackpot) {
        return `🎁 Ты открыл коробку и сорвал джекпот — ${n} ${ICO_DOLLAR}!`;
    }
    return `🎁 Ты открыл коробку и получил ${n} ${ICO_DOLLAR}.`;
}

function extractQuestTitleFromMessage(message) {
    const m = String(message || "").match(/Задание «([^»]+)»/);
    return m ? m[1] : null;
}

function isFightKind(kind) {
    return (
        kind === EVENT_KINDS.FIGHT_WIN ||
        kind === EVENT_KINDS.FIGHT_LOSS ||
        kind === EVENT_KINDS.FIGHT_PVP_LOSS
    );
}

/** HTML-версия краткого описания для списка событий. */
function eventSummaryHtml(kind, detail, fallbackSummary) {
    const d = detail && typeof detail === "object" ? detail : {};
    switch (kind) {
        case EVENT_KINDS.FIGHT_WIN:
            return buildFightWinSummaryHtml(d.opponentName, d.rublesGain ?? 0);
        case EVENT_KINDS.FIGHT_LOSS:
            return buildFightLossSummaryHtml(d.opponentName, d.silverLoss ?? 0);
        case EVENT_KINDS.FIGHT_PVP_LOSS:
            return buildPvpLossSummaryHtml(d.attackerName || d.opponentName, d.rublesTaken ?? d.rublesGain ?? 0);
        case EVENT_KINDS.WORK:
            return buildWorkSummaryHtml(d.energySpent, d.reward);
        case EVENT_KINDS.QUEST:
            return escapeHtml(buildQuestSummary(d.questTitle || extractQuestTitleFromMessage(d.text)));
        case EVENT_KINDS.HAPPY_HOUR:
            return buildHappyHourSummaryHtml(d.dollars ?? 0, !!d.jackpot);
        case EVENT_KINDS.KICKER_WIN:
        case EVENT_KINDS.KICKER_LOSS:
        case EVENT_KINDS.LOTTERY:
            return escapeHtml(String(fallbackSummary || d.text || ""));
        default:
            return escapeHtml(String(fallbackSummary || ""));
    }
}

module.exports = {
    MAX_PLAYER_EVENTS,
    EVENT_KINDS,
    formatEventTimestamp,
    buildFightWinSummary,
    buildFightLossSummary,
    buildPvpLossSummary,
    buildWorkSummary,
    buildQuestSummary,
    buildQuestRewardDetail,
    extractQuestTitleFromMessage,
    buildHappyHourSummary,
    buildHappyHourSummaryHtml,
    isFightKind,
    eventSummaryHtml
};
