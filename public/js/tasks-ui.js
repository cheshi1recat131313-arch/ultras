/** Отображение заданий (без логики прогресса и наград на сервере). */

const TASKS_GOLD_ICO =
    '<img class="tasks-ico" src="/static/location/base/gold.png" width="18" height="18" alt="" role="presentation">';

const TASKS_MUSHROOM_ICO =
    '<img class="tasks-ico" src="/static/assets/img/mushroom.svg" width="16" height="16" alt="" role="presentation">';

const TASK_QUEST_FLAVOR = {
    reach_level_2:
        "Набери достаточно опыта, чтобы подняться до второго уровня. Опыт дают победы в районе и другие действия.",
    main_reach_level_2:
        "Набери достаточно опыта, чтобы подняться до второго уровня. Опыт дают победы в районе и другие действия.",
    main_reach_level_3:
        "Продолжай побеждать в районе и выполнять задания — так ты дойдёшь до третьего уровня.",
    main_reach_level_4:
        "Набирай опыт в районе и на работе, чтобы подняться до четвёртого уровня.",
    main_reach_level_5:
        "Ещё немного опыта — и ты достигнешь пятого уровня.",
    main_reach_level_6:
        "Побеждай в районе и выполняй задания — опыт поднимет тебя до 6 уровня.",
    rep_work: "Сражайся в районе и побеждай соперников — так растёт твоя репутация среди фанатов.",
    stamina_train:
        "Нападай на соперников в районе. Победа не обязательна — засчитывается каждое нападение.",
    worker: "Трать энергию на работу. Считается суммарная энергия за все выполненные смены за день.",
    main_gear_upgrade:
        "Купи оружие или одежду у дилера и улучши на 1 уровень в Промзоне — в Коллайдере или Швейном цехе.",
    main_buy_talisman: "Зайди к Магу Геннадию в Центре и купи любой талисман.",
    main_first_work: "Открой раздел «Работа» и заверши любую смену до конца.",
    main_dealer_buy: "Зайди к Дилеру в Центре и купи оружие или одежду.",
    main_stadium: "На стадионе купи билет на матч своего клуба в кассе.",
    main_wasteland: "На главной открой «Пустырь» и выступи за свою фирму.",
    main_national_team_play:
        "Зайди в раздел «Сборные» с главной или из рейтинга. Когда появятся матчи сборных — участие в них тоже засчитается.",
    main_pub_battle: "Запишись на ближайшую Битву за Паб (10 $) — раздел на главной."
};

function escapeTasksHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
}

function isLevelReachQuestId(id) {
    return id === "reach_level_2" || /^main_reach_level_\d+$/.test(id || "");
}

function formatQuestProgressHuman(q) {
    const cur = Math.max(0, Math.floor(Number(q.progress) || 0));
    const goal = Math.max(1, Math.floor(Number(q.goal) || 1));
    const shown = isLevelReachQuestId(q.id) && q.done ? goal : Math.min(cur, goal);
    return `${shown} из ${goal}`;
}

function formatRewardPartHtml(part) {
    const n = Math.max(0, Math.floor(Number(part.amount) || 0));
    if (part.type === "dollars") {
        return `<span class="tasks-reward-val">${n} ${TASKS_GOLD_ICO}</span>`;
    }
    if (part.type === "lottery_ticket") {
        return `<span class="tasks-reward-val">${n} <span class="tasks-ico-emoji" aria-hidden="true">🎟</span></span>`;
    }
    if (part.type === "gym_pass") {
        return `<span class="tasks-reward-val tasks-reward-val--text">Абонемент в качалку (${n} ${pluralZanyatiya(n)})</span>`;
    }
    if (part.type === "mushrooms") {
        return `<span class="tasks-reward-val">${n} ${TASKS_MUSHROOM_ICO}</span>`;
    }
    return `<span class="tasks-reward-val">${escapeTasksHtml(part.label || "")}</span>`;
}

function formatQuestRewardHtml(q) {
    if (q.done) {
        return '<span class="tasks-reward-got">получено</span>';
    }
    if (Array.isArray(q.rewards) && q.rewards.length) {
        return q.rewards.map((part) => formatRewardPartHtml(part)).join('<span class="tasks-reward-plus"> + </span>');
    }
    const n = Math.max(0, Math.floor(Number(q.rewardAmount) || 0));
    if (q.rewardType === "dollars") {
        return `<span class="tasks-reward-val">${n} ${TASKS_GOLD_ICO}</span>`;
    }
    if (q.rewardType === "lottery_ticket") {
        return `<span class="tasks-reward-val">${n} <span class="tasks-ico-emoji" aria-hidden="true">🎟</span></span>`;
    }
    if (q.rewardType === "gym_pass") {
        return `<span class="tasks-reward-val tasks-reward-val--text">Абонемент в качалку (${n} ${pluralZanyatiya(n)})</span>`;
    }
    if (q.rewardType === "mushrooms") {
        return `<span class="tasks-reward-val">${n} ${TASKS_MUSHROOM_ICO}</span>`;
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
    if (TASK_QUEST_FLAVOR[q.id]) return TASK_QUEST_FLAVOR[q.id];
    const levelMatch = /^main_reach_level_(\d+)$/.exec(q.id || "");
    if (levelMatch) {
        const n = levelMatch[1];
        return `Набери достаточно опыта, чтобы подняться до ${n} уровня. Опыт дают победы в районе и другие действия.`;
    }
    return q.description || "";
}

function questDetailUrl(id, category) {
    const cat = category === "main" ? "main" : "daily";
    return (
        "/tasks-quest.html?id=" +
        encodeURIComponent(id || "") +
        "&cat=" +
        encodeURIComponent(cat)
    );
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

function mainQuestStatusIcon(q) {
    if (q.locked) return "🔒";
    return "▶️";
}

function mainQuestStatusClass(q) {
    if (q.locked) return "tasks-card--main-locked";
    return "tasks-card--main-active";
}

function renderMainQuestCard(q) {
    const statusClass = mainQuestStatusClass(q);
    const icon = mainQuestStatusIcon(q);
    const title = escapeTasksHtml(q.title || "");
    let body = "";

    if (q.locked) {
        body = '<span class="tasks-locked-badge">Доступно с 6 уровня</span>';
    } else {
        body = renderProgressBarHtml(q);
    }

    return (
        `<article class="tasks-card tasks-card--main ${statusClass}">` +
        `<div class="tasks-card-title-row">` +
        `<span class="tasks-card-status" aria-hidden="true">${icon}</span>` +
        `<h3 class="tasks-card-title">${title}</h3>` +
        `</div>` +
        `<div class="tasks-reward-row">` +
        `<span class="tasks-reward-label">Награда:</span>` +
        `${formatQuestRewardHtml(q)}` +
        `</div>` +
        body +
        `<a class="tasks-desc-btn" href="${questDetailUrl(q.id, "main")}">Описание</a>` +
        `</article>`
    );
}

function renderMainQuestChainHtml(quests) {
    const list = Array.isArray(quests) ? quests.slice() : [];
    if (!list.length) {
        return '<p class="district-hint">Все основные задания выполнены!</p>';
    }
    list.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    return (
        `<div class="tasks-main-chain">` +
        list.map((q) => renderMainQuestCard(q)).join("") +
        `</div>`
    );
}
