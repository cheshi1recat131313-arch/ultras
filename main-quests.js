/**
 * Основные задания — параллельные стартовые + динамическая цепочка уровней 2→6.
 * В списке только невыполненные задания; после награды задание исчезает.
 */

const STATIC_MAIN_QUEST_DEFS = [
    {
        id: "main_gear_upgrade",
        order: 1,
        title: "Прокачай первую шмотку в Промзоне",
        description: "Улучши любой предмет на 1 уровень",
        track: "gear_upgrade",
        goal: 1,
        rewardType: "mushrooms",
        rewardAmount: 5,
        rewardLabel: "+5 грибов"
    },
    {
        id: "main_buy_talisman",
        order: 2,
        title: "Купи первый талисман",
        description: "Приобрети талисман у Мага Геннадия",
        track: "buy_talisman",
        goal: 1,
        rewardType: "mushrooms",
        rewardAmount: 5,
        rewardLabel: "+5 грибов"
    },
    {
        id: "main_first_work",
        order: 3,
        title: "Выполни первую работу",
        description: "Заверши любую работу",
        track: "work_complete",
        goal: 1,
        rewardType: "mushrooms",
        rewardAmount: 3,
        rewardLabel: "+3 гриба"
    },
    {
        id: "main_dealer_buy",
        order: 4,
        title: "Купи первый предмет у Дилера",
        description: "Приобрети оружие или одежду у Дилера в Центре",
        track: "dealer_buy",
        goal: 1,
        rewardType: "mushrooms",
        rewardAmount: 5,
        rewardLabel: "+5 грибов"
    },
    {
        id: "main_stadium",
        order: 5,
        title: "Сходи в Большой Махач",
        description: "Купи билет на стадион и займи место в фан-секторе",
        track: "stadium_ticket",
        goal: 1,
        rewardType: "mushrooms",
        rewardAmount: 5,
        rewardLabel: "+5 грибов"
    }
];

const LEVEL_6_MAIN_QUEST_DEFS = [
    {
        id: "main_wasteland",
        order: 7,
        title: "Выступи за фирму на Пустыре",
        description: "Зайди на Пустырь и выступи за свою фирму",
        track: "wasteland_visit",
        goal: 1,
        rewardType: "mushrooms",
        rewardAmount: 7,
        rewardLabel: "+7 грибов"
    },
    {
        id: "main_national_team_play",
        order: 8,
        title: "Выступи за сборную",
        description: "Прими участие в матче сборных или зайди в раздел «Сборные»",
        track: "national_team_play",
        goal: 1,
        rewardType: "mushrooms",
        rewardAmount: 7,
        rewardLabel: "+7 грибов"
    },
    {
        id: "main_pub_battle",
        order: 9,
        title: "Запишись на Битву за Паб",
        description: "Запишись на ближайшую Битву за Паб",
        track: "pub_battle_register",
        goal: 1,
        rewardType: "mushrooms",
        rewardAmount: 10,
        rewardLabel: "+10 грибов"
    }
];

const LEVEL_6_MAIN_QUEST_IDS = new Set(LEVEL_6_MAIN_QUEST_DEFS.map((d) => d.id));

const LEVEL_QUEST_MIN = 2;
const LEVEL_QUEST_MAX = 6;

const LEVEL_QUEST_REWARDS = {
    2: {
        rewardType: "combo",
        rewards: [
            { type: "gym_pass", amount: 5 },
            { type: "mushrooms", amount: 10 }
        ],
        rewardLabel: "Абонемент в качалку (5 занятий) + 10 грибов"
    },
    3: {
        rewardType: "mushrooms",
        rewardAmount: 5,
        rewardLabel: "+5 грибов"
    },
    4: {
        rewardType: "mushrooms",
        rewardAmount: 5,
        rewardLabel: "+5 грибов"
    },
    5: {
        rewardType: "mushrooms",
        rewardAmount: 5,
        rewardLabel: "+5 грибов"
    },
    6: {
        rewardType: "mushrooms",
        rewardAmount: 7,
        rewardLabel: "+7 грибов"
    }
};

/** Полный список определений (для совместимости и тестов). */
const MAIN_QUEST_DEFS = STATIC_MAIN_QUEST_DEFS.concat(
    buildAllLevelQuestDefs(),
    LEVEL_6_MAIN_QUEST_DEFS
);

function levelQuestId(targetLevel) {
    return `main_reach_level_${targetLevel}`;
}

function buildLevelQuestDef(targetLevel) {
    const reward = LEVEL_QUEST_REWARDS[targetLevel] || LEVEL_QUEST_REWARDS[6];
    return {
        id: levelQuestId(targetLevel),
        order: 6,
        title: `Перейти на ${targetLevel} уровень`,
        description: `Получить ${targetLevel} уровень`,
        track: "level_reach",
        goal: targetLevel,
        ...reward
    };
}

function buildAllLevelQuestDefs() {
    const defs = [];
    for (let level = LEVEL_QUEST_MIN; level <= LEVEL_QUEST_MAX; level++) {
        defs.push(buildLevelQuestDef(level));
    }
    return defs;
}

function defaultMainQuestState() {
    return {
        rewarded: [],
        workCompleted: false,
        gearUpgraded: false,
        talismanBought: false,
        dealerItemBought: false,
        stadiumTicket: false,
        wastelandVisited: false,
        nationalTeamPlayed: false,
        pubBattleRegistered: false
    };
}

function parseMainQuestState(raw) {
    if (!raw || typeof raw !== "object") return defaultMainQuestState();
    const rewarded = Array.isArray(raw.rewarded)
        ? raw.rewarded.filter((id) => typeof id === "string")
        : [];
    return {
        rewarded,
        workCompleted: Boolean(raw.workCompleted || raw.earnedOnce),
        gearUpgraded: Boolean(raw.gearUpgraded),
        talismanBought: Boolean(raw.talismanBought),
        dealerItemBought: Boolean(raw.dealerItemBought),
        stadiumTicket: Boolean(raw.stadiumTicket),
        wastelandVisited: Boolean(raw.wastelandVisited),
        nationalTeamPlayed: Boolean(raw.nationalTeamPlayed),
        pubBattleRegistered: Boolean(raw.pubBattleRegistered)
    };
}

function userLevel(userCtx) {
    return Math.max(1, Math.floor(Number(userCtx?.level) || 1));
}

function isRewarded(state, def) {
    return state.rewarded.includes(def.id);
}

function migrateLegacyQuestIds(state) {
    const rewarded = new Set(state.rewarded);
    if (rewarded.has("main_level_6")) {
        rewarded.add(levelQuestId(6));
    }
    return { ...state, rewarded: [...rewarded] };
}

function getActiveLevelTarget(state) {
    for (let level = LEVEL_QUEST_MIN; level <= LEVEL_QUEST_MAX; level++) {
        if (!state.rewarded.includes(levelQuestId(level))) {
            return level;
        }
    }
    return null;
}

function isQuestUnlocked(state, def, userCtx) {
    if (LEVEL_6_MAIN_QUEST_IDS.has(def.id)) {
        return userLevel(userCtx) >= 6;
    }
    return true;
}

function applyRetroactiveFlags(state, userCtx) {
    let next = { ...state };
    if (userCtx.hasGearUpgrade) next = { ...next, gearUpgraded: true };
    if (userCtx.hasTalisman) next = { ...next, talismanBought: true };
    if (userCtx.hasCompletedWork) next = { ...next, workCompleted: true };
    if (userCtx.hasDealerItem) next = { ...next, dealerItemBought: true };
    if (userCtx.hasStadiumTicket) next = { ...next, stadiumTicket: true };
    return next;
}

function progressForQuest(state, def, userCtx) {
    switch (def.track) {
        case "work_complete":
            return state.workCompleted || userCtx.hasCompletedWork ? 1 : 0;
        case "gear_upgrade":
            return state.gearUpgraded || userCtx.hasGearUpgrade ? 1 : 0;
        case "buy_talisman":
            return state.talismanBought || userCtx.hasTalisman ? 1 : 0;
        case "dealer_buy":
            return state.dealerItemBought || userCtx.hasDealerItem ? 1 : 0;
        case "stadium_ticket":
            return state.stadiumTicket || userCtx.hasStadiumTicket ? 1 : 0;
        case "level_reach":
            return Math.min(def.goal, userLevel(userCtx));
        case "wasteland_visit":
            return state.wastelandVisited ? 1 : 0;
        case "national_team_play":
            return state.nationalTeamPlayed ? 1 : 0;
        case "pub_battle_register":
            return state.pubBattleRegistered ? 1 : 0;
        default:
            return 0;
    }
}

function isQuestComplete(state, def, userCtx) {
    if (!isQuestUnlocked(state, def, userCtx)) return false;
    return progressForQuest(state, def, userCtx) >= def.goal;
}

function buildQuestView(state, def, userCtx) {
    const unlocked = isQuestUnlocked(state, def, userCtx);
    const progress = unlocked ? progressForQuest(state, def, userCtx) : 0;
    const capped =
        def.track === "level_reach" ? progress : Math.min(def.goal, progress);
    const completed = isQuestComplete(state, def, userCtx);
    const rewarded = isRewarded(state, def);
    const percent = def.goal > 0 ? Math.min(100, Math.round((capped / def.goal) * 100)) : 0;
    const locked = !unlocked;
    const active = unlocked && !rewarded && !completed;
    let lockReason = null;
    if (locked) {
        lockReason = "level";
    }

    let progressText;
    if (def.track === "level_reach") {
        progressText = `${Math.min(userLevel(userCtx), def.goal)} / ${def.goal}`;
    } else {
        progressText = `${capped} / ${def.goal}`;
    }

    return {
        id: def.id,
        category: "main",
        order: def.order,
        title: def.title,
        description: def.description,
        progress: capped,
        goal: def.goal,
        progressText,
        percent: locked ? 0 : percent,
        rewardLabel: def.rewardLabel,
        rewardType: def.rewardType,
        rewardAmount: def.rewardAmount,
        rewards: def.rewards || null,
        completed,
        rewarded,
        done: rewarded,
        locked,
        lockReason,
        active
    };
}

function getProcessingQuestDefs(state) {
    const defs = STATIC_MAIN_QUEST_DEFS.slice();
    for (let level = LEVEL_QUEST_MIN; level <= LEVEL_QUEST_MAX; level++) {
        if (!state.rewarded.includes(levelQuestId(level))) {
            defs.push(buildLevelQuestDef(level));
        }
    }
    defs.push(...LEVEL_6_MAIN_QUEST_DEFS);
    return defs;
}

function getVisibleQuestDefs(state) {
    const defs = STATIC_MAIN_QUEST_DEFS.slice();
    const levelTarget = getActiveLevelTarget(state);
    if (levelTarget !== null) {
        defs.push(buildLevelQuestDef(levelTarget));
    }
    defs.push(...LEVEL_6_MAIN_QUEST_DEFS);
    return defs;
}

function isQuestVisible(state, def) {
    return !isRewarded(state, def);
}

function emptyRewards() {
    return { mushrooms: 0, gymPasses: 0 };
}

function mergeRewards(acc, part) {
    return {
        mushrooms: acc.mushrooms + (part.mushrooms || 0),
        gymPasses: acc.gymPasses + (part.gymPasses || 0)
    };
}

function rewardsForPart(part) {
    if (!part || typeof part !== "object") return emptyRewards();
    if (part.type === "mushrooms") return { mushrooms: part.amount || 0, gymPasses: 0 };
    if (part.type === "gym_pass") return { mushrooms: 0, gymPasses: part.amount || 0 };
    return emptyRewards();
}

function rewardsForDef(def) {
    if (Array.isArray(def.rewards) && def.rewards.length) {
        return def.rewards.reduce((acc, part) => mergeRewards(acc, rewardsForPart(part)), emptyRewards());
    }
    if (def.rewardType === "mushrooms") {
        return { mushrooms: def.rewardAmount || 0, gymPasses: 0 };
    }
    return emptyRewards();
}

function migrateDailyLevel2Reward(state, userCtx) {
    if (!userCtx.dailyLevel2Rewarded) return state;
    const def = buildLevelQuestDef(2);
    if (isRewarded(state, def)) return state;
    return markRewarded(state, def);
}

function markRewarded(state, def) {
    if (state.rewarded.includes(def.id)) return state;
    return { ...state, rewarded: state.rewarded.concat(def.id) };
}

function applyAutoRewards(state, userCtx) {
    const messages = [];
    let next = applyRetroactiveFlags(state, userCtx);
    let rewards = emptyRewards();

    for (const def of getProcessingQuestDefs(next)) {
        if (!isQuestComplete(next, def, userCtx) || isRewarded(next, def)) continue;
        next = markRewarded(next, def);
        const part = rewardsForDef(def);
        rewards = mergeRewards(rewards, part);
        messages.push({
            questId: def.id,
            ...part,
            message: `Основное задание «${def.title}» выполнено: ${def.rewardLabel}`
        });
    }

    return { state: next, messages, rewards };
}

function isLevelQuestDef(def) {
    return def?.track === "level_reach" || String(def?.id || "").startsWith("main_reach_level_");
}

function getActiveQuest(state, userCtx) {
    const visible = getVisibleQuestDefs(state)
        .filter((def) => isQuestVisible(state, def))
        .sort((a, b) => a.order - b.order);

    for (const def of visible) {
        const view = buildQuestView(state, def, userCtx);
        if (view.locked) continue;
        if (view.rewarded || view.done) continue;
        return view;
    }

    for (const def of visible) {
        const view = buildQuestView(state, def, userCtx);
        if (view.rewarded || view.done) continue;
        return view;
    }

    return null;
}

/** Первое невыполненное действие для виджета на главной — без «Перейти на N уровень». */
function getHomeWidgetQuest(state, userCtx) {
    const visible = getVisibleQuestDefs(state)
        .filter((def) => isQuestVisible(state, def) && !isLevelQuestDef(def))
        .sort((a, b) => a.order - b.order);

    for (const def of visible) {
        const view = buildQuestView(state, def, userCtx);
        if (view.locked) continue;
        if (view.rewarded || view.done) continue;
        return view;
    }

    for (const def of visible) {
        const view = buildQuestView(state, def, userCtx);
        if (view.rewarded || view.done) continue;
        return view;
    }

    return null;
}

function areAllMainQuestsDone(state) {
    for (const def of STATIC_MAIN_QUEST_DEFS) {
        if (!isRewarded(state, def)) return false;
    }
    for (let level = LEVEL_QUEST_MIN; level <= LEVEL_QUEST_MAX; level++) {
        if (!state.rewarded.includes(levelQuestId(level))) return false;
    }
    for (const def of LEVEL_6_MAIN_QUEST_DEFS) {
        if (!isRewarded(state, def)) return false;
    }
    return true;
}

function getMainQuestsPayload(stateRaw, userCtx) {
    let state = parseMainQuestState(stateRaw);
    state = migrateLegacyQuestIds(state);
    state = applyRetroactiveFlags(state, userCtx);
    state = migrateDailyLevel2Reward(state, userCtx);

    const activeQuest = getActiveQuest(state, userCtx);
    const activeHomeQuest = getHomeWidgetQuest(state, userCtx);
    const activeId = activeQuest?.id || null;
    const quests = getVisibleQuestDefs(state)
        .filter((def) => isQuestVisible(state, def))
        .map((def) => {
            const view = buildQuestView(state, def, userCtx);
            return { ...view, active: def.id === activeId };
        })
        .sort((a, b) => a.order - b.order);

    const allDone = areAllMainQuestsDone(state);
    return { state, quests, activeQuest, activeHomeQuest, allDone };
}

function settleMainQuestState(stateRaw, userCtx) {
    let state = parseMainQuestState(stateRaw);
    state = migrateLegacyQuestIds(state);
    state = applyRetroactiveFlags(state, userCtx);
    state = migrateDailyLevel2Reward(state, userCtx);
    return applyAutoRewards(state, userCtx);
}

function processEvent(stateRaw, userCtx, event) {
    let state = parseMainQuestState(stateRaw);
    state = migrateLegacyQuestIds(state);
    state = applyRetroactiveFlags(state, userCtx);

    switch (event) {
        case "work_paid":
            state = { ...state, workCompleted: true };
            break;
        case "gear_upgrade":
            state = { ...state, gearUpgraded: true };
            break;
        case "talisman_buy":
            state = { ...state, talismanBought: true };
            break;
        case "dealer_buy":
            state = { ...state, dealerItemBought: true };
            break;
        case "stadium_ticket":
            state = { ...state, stadiumTicket: true };
            break;
        case "wasteland_visit":
            state = { ...state, wastelandVisited: true };
            break;
        case "national_team_play":
            state = { ...state, nationalTeamPlayed: true };
            break;
        case "pub_battle_register":
            state = { ...state, pubBattleRegistered: true };
            break;
        case "sync":
            break;
        default:
            break;
    }

    return applyAutoRewards(state, userCtx);
}

module.exports = {
    MAIN_QUEST_DEFS,
    parseMainQuestState,
    getMainQuestsPayload,
    settleMainQuestState,
    processEvent,
    getHomeWidgetQuest,
    isLevelQuestDef,
    levelQuestId,
    buildLevelQuestDef
};
