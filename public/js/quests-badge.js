/** Счётчик и подсветка кнопки «Задания» на главной. */

function computeQuestBadgeClient(mainQuests = [], dailyQuests = []) {
    const mainPending = (mainQuests || []).filter((q) => !q.done).length;
    const dailyPending = (dailyQuests || []).filter((q) => !q.done).length;
    const total = mainPending + dailyPending;
    return {
        total,
        mainPending,
        dailyPending,
        hasIncompleteDaily: dailyPending > 0
    };
}

function questBadgeFromPayload(data) {
    if (data?.questBadge) return data.questBadge;
    return computeQuestBadgeClient(
        data?.mainQuests,
        data?.dailyQuests || data?.quests
    );
}

function applyQuestBadgeToTab(badge) {
    const tab = document.getElementById("gameTasksTab");
    if (!tab) return;

    const total = Math.max(0, Math.floor(Number(badge?.total) || 0));
    const hasDaily = !!badge?.hasIncompleteDaily;

    let countEl = document.getElementById("gameTasksTabCount");
    if (!countEl) {
        const label = tab.querySelector(".game-tasks-tab-label");
        if (label) {
            countEl = document.createElement("span");
            countEl.id = "gameTasksTabCount";
            countEl.className = "game-tasks-tab-count";
            label.appendChild(countEl);
        }
    }

    if (countEl) {
        countEl.textContent = total > 0 ? ` [${total}]` : "";
    } else {
        const label = tab.querySelector(".game-tasks-tab-label");
        if (label) {
            label.textContent = total > 0 ? `Задания [${total}]` : "Задания";
        }
    }

    tab.classList.toggle("tab--daily-pending", hasDaily);
}

async function refreshQuestsTabBadge(email) {
    const key =
        email ||
        (typeof getStoredEmail === "function"
            ? getStoredEmail()
            : (() => {
                  try {
                      return (localStorage.getItem("email") || "").trim().toLowerCase();
                  } catch {
                      return "";
                  }
              })());
    if (!key || !document.getElementById("gameTasksTab")) return null;

    try {
        const res = await fetch(`/api/quests/badge?email=${encodeURIComponent(key)}`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.badge) {
                applyQuestBadgeToTab(data.badge);
                return data.badge;
            }
        }
    } catch {
        /* fallback below */
    }

    try {
        const res = await fetch(`/daily-quests?email=${encodeURIComponent(key)}`);
        const data = await res.json();
        if (!data.success) return null;
        const badge = questBadgeFromPayload(data);
        applyQuestBadgeToTab(badge);
        return badge;
    } catch {
        return null;
    }
}

function startQuestsTabBadgePoll(email) {
    const tab = document.getElementById("gameTasksTab");
    if (!tab || tab.dataset.badgePoll === "1") return;
    tab.dataset.badgePoll = "1";
    refreshQuestsTabBadge(email);
    setInterval(() => {
        refreshQuestsTabBadge(email).catch(() => {});
    }, 45000);
}

if (typeof window !== "undefined") {
    window.computeQuestBadgeClient = computeQuestBadgeClient;
    window.questBadgeFromPayload = questBadgeFromPayload;
    window.applyQuestBadgeToTab = applyQuestBadgeToTab;
    window.refreshQuestsTabBadge = refreshQuestsTabBadge;
    window.startQuestsTabBadgePoll = startQuestsTabBadgePoll;
}
