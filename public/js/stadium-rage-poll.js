/**
 * Обновление ярости в шапке на страницах стадиона (без пересборки DOM).
 */
(function (global) {
    const RAGE_POLL_MS = 5000;
    let timerId = null;

    async function tick() {
        const email = typeof getEmail === "function" ? getEmail() : "";
        if (!email) return;
        try {
            const res = await fetch(
                `/getUser?email=${encodeURIComponent(email)}&viewer=${encodeURIComponent(email)}`
            );
            const data = await res.json();
            if (!data.success || !data.user) return;
            if (typeof global.updateHeaderFromUser === "function") {
                global.updateHeaderFromUser(data.user);
            } else if (typeof global.renderHeader === "function") {
                global.renderHeader(data.user);
            }
            if (typeof global.onStadiumRageTick === "function") {
                global.onStadiumRageTick(data.user);
            }
        } catch {
            /* ignore */
        }
    }

    function startStadiumRagePoll(shouldRun) {
        stopStadiumRagePoll();
        if (typeof shouldRun === "function" && !shouldRun()) return;
        tick();
        timerId = setInterval(() => {
            if (typeof shouldRun === "function" && !shouldRun()) return;
            tick();
        }, RAGE_POLL_MS);
    }

    function stopStadiumRagePoll() {
        if (timerId) {
            clearInterval(timerId);
            timerId = null;
        }
    }

    global.startStadiumRagePoll = startStadiumRagePoll;
    global.stopStadiumRagePoll = stopStadiumRagePoll;
})(typeof window !== "undefined" ? window : globalThis);
