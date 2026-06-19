/**
 * Работа: 7 слотов по энергии, сброс в 00:00 по серверному времени.
 */

const WORK_ENERGY_PER_CLICK = 20;

/** Стоимость работ (энергия) — уровень каталога 1. */
const WORK_ENERGY_TIERS = [40, 80, 200, 300, 400, 500, 600];

const WORK_BASE_REWARD_BY_ENERGY = {
    40: 3,
    80: 6,
    200: 15,
    300: 22,
    400: 30,
    500: 38,
    600: 45
};

const WORK_JOBS = [
    "Шахта",
    "Стройка",
    "Завод",
    "Курьер",
    "Разгрузка",
    "Оператор лифта",
    "Комбайнёр",
    "Склад"
];

const WORK_DAY_HEADING = "Работы дня";
const WORK_ALL_DONE_MESSAGE = "Новые работы появятся завтра";

/** Полночь текущих календарных суток (локальное время сервера). */
function getWorkDayStartMs(ts = Date.now()) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

function workMinutesEstimate(energyNeed) {
    const need = Math.max(WORK_ENERGY_PER_CLICK, Math.floor(Number(energyNeed) || 40));
    return Math.round(need / WORK_ENERGY_PER_CLICK);
}

function playerLevel(row) {
    return Math.max(1, Math.floor(Number(row?.level) || 1));
}

function workRewardForTier(energyNeed, level) {
    const need = Math.floor(Number(energyNeed) || 0);
    const base = WORK_BASE_REWARD_BY_ENERGY[need] ?? 0;
    const lv = Math.max(1, Math.floor(Number(level) || 1));
    return base + (lv - 1);
}

function pickRandomJob(excludeName) {
    const pool = excludeName ? WORK_JOBS.filter((j) => j !== excludeName) : WORK_JOBS;
    const list = pool.length ? pool : WORK_JOBS;
    return list[Math.floor(Math.random() * list.length)];
}

function parseCompletedList(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) {
        return raw.map((n) => Math.floor(Number(n))).filter((n) => WORK_ENERGY_TIERS.includes(n));
    }
    if (typeof raw === "string" && raw.trim()) {
        try {
            const parsed = JSON.parse(raw);
            return parseCompletedList(parsed);
        } catch {
            return [];
        }
    }
    return [];
}

function completedSet(list) {
    return new Set(parseCompletedList(list));
}

/**
 * Синхронизация с календарным днём: work_period_start = timestamp 00:00 сегодня.
 */
function ensureWorkPeriod(row, now = Date.now()) {
    const dayStart = getWorkDayStartMs(now);
    let periodStart = Number(row.work_period_start) || 0;
    let completed = parseCompletedList(row.work_completed);
    let reset = false;

    if (periodStart !== dayStart) {
        periodStart = dayStart;
        completed = [];
        reset = true;
    }

    return { periodStart, completed, reset, dayStart };
}

function nextAvailableTier(completed, excludeEnergy) {
    const done = completedSet(completed);
    for (const tier of WORK_ENERGY_TIERS) {
        if (tier === excludeEnergy) continue;
        if (!done.has(tier)) return tier;
    }
    return null;
}

function tierJobView(tier, level, status, jobName) {
    return {
        energyNeed: tier,
        reward: workRewardForTier(tier, level),
        minutes: workMinutesEstimate(tier),
        status,
        jobName: jobName || ""
    };
}

function buildJobsList(row, level, activeEnergy, activeJobName) {
    const { completed } = ensureWorkPeriod(row);
    const done = completedSet(completed);

    return WORK_ENERGY_TIERS.map((tier) => {
        let status = "available";
        if (done.has(tier)) status = "done";
        else if (activeEnergy === tier) status = "active";
        return tierJobView(tier, level, status, activeEnergy === tier ? activeJobName : "");
    });
}

function parseWorkRow(row) {
    const now = Date.now();
    const level = playerLevel(row);
    const { periodStart, completed, reset } = ensureWorkPeriod(row, now);
    const done = completedSet(completed);

    const rawStatus = String(row.work_status || "").trim();
    const activeEnergy = Math.floor(Number(row.work_energy_need) || 0);
    const hasActiveTier = WORK_ENERGY_TIERS.includes(activeEnergy);

    const jobs = buildJobsList(
        { work_period_start: periodStart, work_completed: completed },
        level,
        hasActiveTier && (rawStatus === "active" || rawStatus === "offered") ? activeEnergy : null,
        row.work_job_name || ""
    );

    let status = "idle";
    let jobName = "";
    let energyDone = 0;
    let energyNeed = 0;
    let reward = 0;
    let minutes = 0;

    const allDone = WORK_ENERGY_TIERS.every((t) => done.has(t));

    if (allDone) {
        status = "period_wait";
    } else if (hasActiveTier && rawStatus === "active") {
        status = "active";
        jobName = row.work_job_name || "";
        energyDone = row.work_energy_done ?? 0;
        energyNeed = activeEnergy;
        reward = row.work_reward ?? workRewardForTier(activeEnergy, level);
        minutes = workMinutesEstimate(energyNeed);
    } else if (hasActiveTier && rawStatus === "offered") {
        status = "offered";
        jobName = row.work_job_name || "";
        energyNeed = activeEnergy;
        reward = row.work_reward ?? workRewardForTier(activeEnergy, level);
        minutes = workMinutesEstimate(energyNeed);
    } else {
        const next = nextAvailableTier(completed, null);
        if (next) {
            status = "pick";
            energyNeed = next;
            reward = workRewardForTier(next, level);
            minutes = workMinutesEstimate(next);
        } else {
            status = "period_wait";
        }
    }

    return {
        status,
        jobName,
        energyDone,
        energyNeed,
        reward,
        minutes,
        jobsCompleted: done.size,
        jobsTotal: WORK_ENERGY_TIERS.length,
        completedTiers: [...done],
        jobs,
        dayHeading: allDone ? WORK_ALL_DONE_MESSAGE : WORK_DAY_HEADING,
        periodStart,
        periodReset: reset,
        playerLevel: level
    };
}

function newJobFields(energyTier, playerLevel, excludeName) {
    const tier = WORK_ENERGY_TIERS.includes(energyTier) ? energyTier : WORK_ENERGY_TIERS[0];
    return {
        work_job_name: pickRandomJob(excludeName),
        work_energy_done: 0,
        work_energy_need: tier,
        work_reward: workRewardForTier(tier, playerLevel),
        work_status: "offered",
        work_cooldown_until: 0
    };
}

function markTierCompleted(completed, energyTier) {
    const list = parseCompletedList(completed);
    const tier = Math.floor(Number(energyTier) || 0);
    if (!WORK_ENERGY_TIERS.includes(tier) || list.includes(tier)) return list;
    return [...list, tier].sort((a, b) => WORK_ENERGY_TIERS.indexOf(a) - WORK_ENERGY_TIERS.indexOf(b));
}

function periodFieldsAfterReset(row, now = Date.now()) {
    const ensured = ensureWorkPeriod(row, now);
    return {
        work_period_start: ensured.periodStart,
        work_completed: JSON.stringify(ensured.completed)
    };
}

module.exports = {
    WORK_ENERGY_PER_CLICK,
    WORK_ENERGY_TIERS,
    WORK_JOBS,
    WORK_BASE_REWARD_BY_ENERGY,
    WORK_DAY_HEADING,
    WORK_ALL_DONE_MESSAGE,
    getWorkDayStartMs,
    workRewardForTier,
    workMinutesEstimate,
    pickRandomJob,
    parseWorkRow,
    newJobFields,
    ensureWorkPeriod,
    nextAvailableTier,
    parseCompletedList,
    markTierCompleted,
    periodFieldsAfterReset
};
