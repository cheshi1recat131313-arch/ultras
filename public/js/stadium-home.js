(async () => {
    const user = await fetchUser();
    if (!user) return;
    renderHeaderBlock(user);

    try {
        const res = await fetch(`/stadium/home?email=${encodeURIComponent(user.email)}`);
        const data = await res.json();
        if (!data.success || !data.stadium?.showTribunesAlert) return;

        const alert = document.getElementById("stadiumAlert");
        const btn = document.getElementById("stadiumAlertBtn");
        if (!alert) return;

        alert.hidden = false;
        if (btn && data.stadium.matchId) {
            btn.href = "/stadium-tribunes.html?matchId=" + encodeURIComponent(data.stadium.matchId);
        }
    } catch {
        /* ignore */
    }
})();
