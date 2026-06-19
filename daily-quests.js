/**
 * Ежедневные задания — сброс в 00:00 (Europe/Kyiv), как работа и «Счастливый час».
 */

const xpLevels = require("./xp-levels");
const gameTime = require("./game-time");

const DAILY_QUEST_PERIOD_MS = 24 * 60 * 60 * 1000;
const LEVEL_2_XP_NEED = xpLevels.LEVEL_XP_AT[1] ?? 10;
const WORK_ENERGY_GOAL = 600;

const DAILY_QUEST_DEFS = [
    {
        id: "rep_work",
        tier: 1,
        title: "Работа на репутацию",
        description: "Отметелить 20 соперников",
        goal: 20,
        track: "district_win",
        rewardType: "dollars",
        rewardAmount: 3,
        rewardLabel: "+3 золотых бакса"
    },
    {
        id: "stamina_train",
        tier: 1,
        title: "Тренировка выносливости",
        description: "Напасть на 30 соперников",
        goal: 30,
        track: "district_attack",
        rewardType: "dollars",
        rewardAmount: 3,
        rewardLabel: "+3 золотых бакса"
    },
    {
        id: "worker",
        tier: 1,
        title: "Работяга",
        description: "Выполнить работы суммарно на 600 энергии",
        goal: WORK_ENERGY_GOAL,
        track: "work_energy",
        rewardType: "lottery_ticket",
        rewardAmount: 1,
        rewardLabel: "1 бесплатный лотерейный билет"
    }
];

function defaultDailyQuestState(now = Date.now()) {
    const { startMs, dayKey } = gameTime.getKyivDayBounds(now);
    return {
        dayKey,
        periodStart: startMs,
        repDefeats: 0,
        repRewarded: false,
        attacks: 0,
        attackRewarded: false,
        workEnergy: 0,
        workRewarded: false,
        level2Rewarded: false
    };
}

function parseDailyQuestState(raw) {
    if (!raw || typeof raw !== "object") return defaultDailyQuestState();
    const periodStart = Number(raw.periodStart);
    const dayKey = String(raw.dayKey || "").trim();
    return {
        dayKey,
        periodStart: Number.isFinite(periodStart) && periodStart > 0 ? periodStart : Date.now(),
        repDefeats: Math.max(0, Math.floor(Number(raw.repDefeats) || 0)),
        repRewarded: Boolean(raw.repRewarded),
        attacks: Math.max(0, Math.floor(Number(raw.attacks) || 0)),
        attackRewarded: Boolean(raw.attackRewarded),
        workEnergy: Math.max(0, Math.floor(Number(raw.workEnergy) || 0)),
        workRewarded: Boolean(raw.workRewarded),
        level2Rewarded: Boolean(raw.level2Rewarded)
    };
}

/** Сброс при смене календарного дня (00:00 Kyiv). */
function ensureDailyQuestPeriod(state, now = Date.now()) {
    const { startMs, dayKey } = gameTime.getKyivDayBounds(now);

    if (state.dayKey) {
        if (state.dayKey !== dayKey) {
            return { state: defaultDailyQuestState(now), reset: true };
        }
        if (state.periodStart !== startMs) {
            return { state: { ...state, periodStart: startMs }, reset: false };
        }
        return { state, reset: false };
    }

    // Миграция со старой схемы «24 ч от periodStart»
    const oldDay = gameTime.getKyivDayBounds(state.periodStart).dayKey;
    if (oldDay !== dayKey || now - state.periodStart >= DAILY_QUEST_PERIOD_MS) {
        return { state: defaultDailyQuestState(now), reset: true };
    }

    return {
        state: { ...state, dayKey, periodStart: startMs },
        reset: false
    };
}

function formatResetCountdown(msLeft) {
    const totalMin = Math.max(0, Math.ceil(msLeft / 60000));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function userLevel(userCtx) {
    return Math.max(1, Math.floor(Number(userCtx?.level) || 1));
}

function userXp(userCtx) {
    return xpLevels.normalizeXp(userCtx?.xp ?? 0);
}

function progressForQuest(state, def, userCtx) {
    if (def.track === "level_2") {
        const lv = userLevel(userCtx);
        if (lv >= 2) return LEVEL_2_XP_NEED;
        return Math.min(LEVEL_2_XP_NEED, userXp(userCtx));
    }
    if (def.track === "district_win") return state.repDefeats;
    if (def.track === "district_attack") return state.attacks;
    if (def.track === "work_energy") return state.workEnergy;
    return 0;
}

function rewardedForQuest(state, def) {
    if (def.id === "reach_level_2") return state.level2Rewarded;
    if (def.id === "rep_work") return state.repRewarded;
    if (def.id === "stamina_train") return state.attackRewarded;
    if (def.id === "worker") return state.workRewarded;
    return false;
}

function markRewarded(state, def) {
    if (def.id === "reach_level_2") return { ...state, level2Rewarded: true };
    if (def.id === "rep_work") return { ...state, repRewarded: true };
    if (def.id === "stamina_train") return { ...state, attackRewarded: true };
    if (def.id === "worker") return { ...state, workRewarded: true };
    return state;
}

function isQuestComplete(state, def, userCtx) {
    if (def.track === "level_2") return userLevel(userCtx) >= 2;
    return progressForQuest(state, def, userCtx) >= def.goal;
}

function buildQuestView(state, def, userCtx) {
    const rawProgress = progressForQuest(state, def, userCtx);
    const progress = def.track === "level_2" ? rawProgress : Math.min(def.goal, rawProgress);
    const completed = isQuestComplete(state, def, userCtx);
    const rewarded = rewardedForQuest(state, def);
    const percent =
        def.goal > 0 ? Math.min(100, Math.round((progress / def.goal) * 100)) : 0;

    let progressText;
    if (def.track === "level_2") {
        const lv = userLevel(userCtx);
        if (lv >= 2) {
            progressText = `${LEVEL_2_XP_NEED} / ${LEVEL_2_XP_NEED}`;
        } else {
            progressText = `${progress} / ${def.goal}`;
        }
    } else {
        progressText = `${progress} / ${def.goal}`;
    }

    return {
        id: def.id,
        category: "daily",
        tier: def.tier,
        title: def.title,
        description: def.description,
        progress,
        goal: def.goal,
        progressText,
        percent,
        rewardLabel: def.rewardLabel,
        rewardType: def.rewardType,
        rewardAmount: def.rewardAmount,
        completed,
        rewarded,
        done: completed && rewarded
    };
}

function emptyRewards() {
    return { dollars: 0, gymPasses: 0, lotteryTickets: 0 };
}

function mergeRewards(acc, part) {
    return {
        dollars: acc.dollars + (part.dollars || 0),
        gymPasses: acc.gymPasses + (part.gymPasses || 0),
        lotteryTickets: acc.lotteryTickets + (part.lotteryTickets || 0)
    };
}

function rewardsForDef(def) {
    const r = emptyRewards();
    if (def.rewardType === "dollars") r.dollars = def.rewardAmount;
    if (def.rewardType === "gym_pass") r.gymPasses = def.rewardAmount;
    if (def.rewardType === "lottery_ticket") r.lotteryTickets = def.rewardAmount;
    return r;
}

function applyAutoRewards(state, defs, userCtx) {
    const messages = [];
    let next = { ...state };
    let rewards = emptyRewards();

    for (const def of defs) {
        if (!isQuestComplete(next, def, userCtx) || rewardedForQuest(next, def)) continue;
        next = markRewarded(next, def);
        const part = rewardsForDef(def);
        rewards = mergeRewards(rewards, part);
        messages.push({
            questId: def.id,
            ...part,
            message: `Задание «${def.title}» выполнено: ${def.rewardLabel}`
        });
    }

    return { state: next, messages, rewards };
}

function getDailyQuestsPayload(stateRaw, userCtx) {
    let state = parseDailyQuestState(stateRaw);
    const ensured = ensureDailyQuestPeriod(state);
    state = ensured.state;

    const level = userLevel(userCtx);
    const defs = DAILY_QUEST_DEFS.filter((q) => q.tier <= level);
    const quests = defs.map((d) => buildQuestView(state, d, userCtx));
    const resetInMs = gameTime.msUntilNextKyivMidnight();

    return {
        state,
        quests,
        resetInMs,
        resetLabel: formatResetCountdown(resetInMs),
        periodReset: ensured.reset
    };
}

function processProgress(stateRaw, userCtx, mutate) {
    let state = parseDailyQuestState(stateRaw);
    const ensured = ensureDailyQuestPeriod(state);
    state = ensured.state;
    state = mutate(state);
    const { state: afterReward, messages, rewards } = applyAutoRewards(
        state,
        DAILY_QUEST_DEFS,
        userCtx
    );
    return {
        state: afterReward,
        messages,
        rewards,
        periodReset: ensured.reset
    };
}

function recordDistrictFightProgress(stateRaw, won, userCtx) {
    return processProgress(stateRaw, userCtx, (state) => {
        let next = { ...state, attacks: state.attacks + 1 };
        if (won) next = { ...next, repDefeats: next.repDefeats + 1 };
        return next;
    });
}

function recordWorkEnergyProgress(stateRaw, energySpent, userCtx) {
    const spent = Math.max(0, Math.floor(Number(energySpent) || 0));
    if (spent <= 0) {
        let state = parseDailyQuestState(stateRaw);
        const ensured = ensureDailyQuestPeriod(state);
        return {
            state: ensured.state,
            messages: [],
            rewards: emptyRewards(),
            periodReset: ensured.reset
        };
    }
    return processProgress(stateRaw, userCtx, (state) => ({
        ...state,
        workEnergy: state.workEnergy + spent
    }));
}

function settleDailyQuestState(stateRaw, userCtx) {
    let state = parseDailyQuestState(stateRaw);
    const ensured = ensureDailyQuestPeriod(state);
    state = ensured.state;
    const { state: afterReward, messages, rewards } = applyAutoRewards(
        state,
        DAILY_QUEST_DEFS,
        userCtx
    );
    return { state: afterReward, messages, rewards, periodReset: ensured.reset };
}

module.exports = {
    DAILY_QUEST_PERIOD_MS,
    DAILY_QUEST_DEFS,
    LEVEL_2_XP_NEED,
    parseDailyQuestState,
    getDailyQuestsPayload,
    recordDistrictFightProgress,
    recordWorkEnergyProgress,
    settleDailyQuestState,
    formatResetCountdown,
    ensureDailyQuestPeriod
};
