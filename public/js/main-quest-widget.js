/** Виджет текущего основного задания на главной. */

let mainQuestWidgetEmail = "";
let mainQuestWidgetActiveId = null;

function renderMainQuestWidget(data) {
    const root = document.getElementById("mainQuestRoot");
    if (!root) return;

    const quest = data?.activeMainQuest;
    mainQuestWidgetActiveId = quest?.id || null;

    if (data?.mainQuestWidgetHidden || !quest) {
        root.hidden = true;
        root.innerHTML = "";
        return;
    }

    root.hidden = false;
    const locked = quest.locked;
    const title = escapeTasksHtml(quest.title);
    const desc = escapeTasksHtml(quest.description || "");
    const progress = locked
        ? "Доступно с 6 уровня"
        : escapeTasksHtml(formatQuestProgressHuman(quest));

    root.innerHTML =
        `<div class="mq-widget">` +
        `<div class="mq-widget-head">` +
        `<span class="mq-widget-label">Основное задание</span>` +
        `<button type="button" class="mq-widget-dismiss" aria-label="Скрыть виджет">✕</button>` +
        `</div>` +
        `<a class="mq-widget-link" href="/tasks.html?tab=main">` +
        `<strong class="mq-widget-title">${title}</strong>` +
        `<span class="mq-widget-desc">${desc}</span>` +
        (locked
            ? `<span class="mq-widget-locked">${progress}</span>`
            : `${renderProgressBarHtml(quest, "mq-widget-bar")}`) +
        `<span class="mq-widget-cta">Перейти →</span>` +
        `</a>` +
        `</div>`;

    root.querySelector(".mq-widget-dismiss")?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dismissMainQuestWidget();
    });
}

function dismissMainQuestWidget() {
    const email = mainQuestWidgetEmail;
    if (!email) return;

    renderMainQuestWidget({
        mainQuestWidgetHidden: true,
        activeMainQuest: null
    });

    hideMainQuestWidget(email, mainQuestWidgetActiveId);
}

async function hideMainQuestWidget(email, questId) {
    const { ok, data } = await postJson("/main-quest-widget/hide", {
        email,
        questId: questId || ""
    });
    if (!ok || !data?.success) {
        loadMainQuestWidget(email);
    }
}

async function loadMainQuestWidget(email) {
    if (!email) return;
    mainQuestWidgetEmail = email;
    try {
        const res = await fetch("/daily-quests?email=" + encodeURIComponent(email));
        const data = await res.json();
        if (data.success) {
            renderMainQuestWidget(data);
            if (typeof applyQuestBadgeToTab === "function") {
                const badge =
                    typeof questBadgeFromPayload === "function"
                        ? questBadgeFromPayload(data)
                        : data.questBadge;
                if (badge) applyQuestBadgeToTab(badge);
            }
        }
    } catch {
        /* ignore */
    }
}
