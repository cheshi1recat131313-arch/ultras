/** Перс — достижения и награды (история «Героя дня» и др.). */

function escapeAchHtml(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
}

function renderHeroOfDayList(wins) {
    const list = document.getElementById("heroOfDayList");
    const empty = document.getElementById("heroOfDayEmpty");
    if (!list || !empty) return;

    if (!wins.length) {
        list.innerHTML = "";
        empty.hidden = false;
        return;
    }

    empty.hidden = true;
    list.innerHTML = wins
        .map(
            (win) =>
                `<li class="ref-list-item">` +
                `<span class="ref-list-name">🏆 Герой дня · ${escapeAchHtml(win.dateLabel)}</span>` +
                `<span class="ref-list-level">${escapeAchHtml(win.skullsLabel)}</span>` +
                `</li>`
        )
        .join("");
}

async function initPersAchievementsPage() {
    const user = await fetchUser();
    if (!user) return;
    renderHeaderBlock(user);

    try {
        const res = await fetch(`/pers/achievements?email=${encodeURIComponent(user.email)}`);
        const data = await res.json();
        if (!data.success) {
            if (typeof showMsg === "function") showMsg(data.error || "Не удалось загрузить достижения", true);
            return;
        }
        renderHeroOfDayList(data.achievements?.heroOfDay || []);
    } catch (err) {
        if (typeof showMsg === "function") showMsg(err.message || "Ошибка сети", true);
    }
}

initPersAchievementsPage();
