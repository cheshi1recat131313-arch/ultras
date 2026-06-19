/** Счётчик матчей чемпионата на главной: «Стадион [N]». */

const STADIUM_COUNT_POLL_MS = 60000;

function applyStadiumUpcomingCount(count) {
    const el = document.getElementById("gameStadiumCount");
    if (!el) return;
    const n = Math.max(0, Math.floor(Number(count) || 0));
    el.textContent = ` [${n}]`;
}

async function refreshStadiumUpcomingCount() {
    if (!document.getElementById("gameStadiumCount")) return null;
    try {
        const res = await fetch("/api/stadium/upcoming-count");
        const data = await res.json();
        if (!data.success) return null;
        applyStadiumUpcomingCount(data.count);
        return data.count;
    } catch {
        return null;
    }
}

function startStadiumUpcomingCountPoll() {
    const el = document.getElementById("gameStadiumCount");
    if (!el || el.dataset.countPoll === "1") return;
    el.dataset.countPoll = "1";
    refreshStadiumUpcomingCount();
    setInterval(() => {
        refreshStadiumUpcomingCount().catch(() => {});
    }, STADIUM_COUNT_POLL_MS);
}

if (typeof window !== "undefined") {
    window.applyStadiumUpcomingCount = applyStadiumUpcomingCount;
    window.refreshStadiumUpcomingCount = refreshStadiumUpcomingCount;
    window.startStadiumUpcomingCountPoll = startStadiumUpcomingCountPoll;
}
