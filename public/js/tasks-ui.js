/** Отображение заданий (без логики прогресса и наград на сервере). */

const TASKS_GOLD_ICO =
    '<img class="tasks-ico" src="/static/location/base/gold.png" width="18" height="18" alt="" role="presentation">';

const TASK_QUEST_FLAVOR = {
    reach_level_2:
        "Набери достаточно опыта, чтобы подняться до второго уровня. Опыт дают победы в районе и другие действия.",
    rep_work: "Сражайся в районе и побеждай соперников — так растёт твоя репутация среди фанатов.",
    stamina_train:
        "Нападай на соперников в районе. Победа не обязательна — засчитывается каждое нападение.",
    worker: "Трать энергию на работу. Считается суммарная энергия за все выполненные смены за день."
};

function escapeTasksHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
}

function formatQuestProgressHuman(q) {
    const cur = Math.max(0, Math.floor(Number(q.progress) || 0));
    const goal = Math.max(1, Math.floor(Number(q.goal) || 1));
    const shown = q.id === "reach_level_2" && q.done ? goal : Math.min(cur, goal);
    return `${shown} из ${goal}`;
}

function formatQuestRewardHtml(q) {
    if (q.done) {
        return '<span class="tasks-reward-got">получено</span>';
    }
    const n = Math.max(0, Math.floor(Number(q.rewardAmount) || 0));
    if (q.rewardType === "dollars") {
        return `<span class="tasks-reward-val">${n} ${TASKS_GOLD_ICO}</span>`;
    }
    if (q.rewardType === "lottery_ticket") {
        return `<span class="tasks-reward-val">${n} <span class="tasks-ico-emoji" aria-hidden="true">🎟</span></span>`;
    }
    if (q.rewardType === "gym_pass") {
        return `<span class="tasks-reward-val tasks-reward-val--text">Абонемент в качалку на ${n} ${pluralZanyatiya(n)}</span>`;
    }
    return `<span class="tasks-reward-val">${escapeTasksHtml(q.rewardLabel || "")}</span>`;
}

function pluralZanyatiya(n) {
    const x = Math.abs(n) % 100;
    const d = x % 10;
    if (x > 10 && x < 20) return "занятий";
    if (d > 1 && d < 5) return "занятия";
    if (d === 1) return "занятие";
    return "занятий";
}

function questFlavorText(q) {
    return TASK_QUEST_FLAVOR[q.id] || q.description || "";
}

function questDetailUrl(id) {
    return "/tasks-quest.html?id=" + encodeURIComponent(id || "");
}

function renderProgressBarHtml(q, extraClass) {
    const pct = Math.min(100, Math.max(0, q.percent ?? 0));
    const label = formatQuestProgressHuman(q);
    const cls = extraClass ? " " + extraClass : "";
    return (
        `<div class="tasks-progress-bar${cls}" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">` +
        `<div class="tasks-progress-fill" style="width:${pct}%"></div>` +
        `<span class="tasks-progress-label">${escapeTasksHtml(label)}</span>` +
        "</div>"
    );
}
