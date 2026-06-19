/** Просмотр выпуска газеты «Третий тайм». */

function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
}

function clubIco(clubId, emblems) {
    const src = emblems?.[clubId] || "";
    if (!src) return "";
    return `<img class="gazeta-best-club-ico" src="${escapeHtml(src)}" width="14" height="14" alt="">`;
}

function renderArticle(report, myEmail) {
    const repIco = report.repIcon || "🤘";
    const hpIco = report.hpIcon || "❤️";
    const me = (myEmail || "").toLowerCase();
    const top = (report.topFighters || [])
        .map((r) => {
            const rowMe = r.email && r.email.toLowerCase() === me ? " gazeta-best-row--me" : "";
            return (
                `<div class="gazeta-best-row${rowMe}">` +
                `<span class="gazeta-best-rank">${r.rank}.</span>` +
                `${clubIco(r.club, report.clubEmblems)}` +
                `<span class="gazeta-best-name">${playerNameHtml(r.name, r.email)}</span>` +
                `<span class="gazeta-best-stats">(${r.rep} ${repIco}, ${r.damage} ${hpIco}, ${r.kos ?? 0} добив.)</span>` +
                `</div>`
            );
        })
        .join("");

    return (
        `<div class="gazeta-head">` +
        `<h1 class="gazeta-title">${escapeHtml(report.title || "Газета «Третий тайм»")}</h1>` +
        `<p class="gazeta-match">${escapeHtml(report.matchLabel || "")}</p>` +
        `<p class="gazeta-datetime">${escapeHtml(report.datetime || "")}</p>` +
        `</div>` +
        `<p class="gazeta-narrative">${escapeHtml(report.narrative || "")}</p>` +
        `<h2 class="gazeta-best-title">Лучшие бойцы:</h2>` +
        (top || "<p class=\"gazeta-narrative\">Нет данных по игрокам.</p>") +
        `<p class="gazeta-xp-note">${escapeHtml(report.xpNote || "")}</p>`
    );
}

(async () => {
    const user = await fetchUser();
    if (!user) return;
    renderHeaderBlock(user);

    const params = new URLSearchParams(location.search);
    const id = params.get("id") || "";
    if (!id) {
        document.getElementById("gazetaArticle").innerHTML =
            '<p class="mail-empty">Не указан выпуск.</p>';
        return;
    }

    try {
        const res = await fetch(
            `/api/mail/gazeta/detail?email=${encodeURIComponent(user.email)}&id=${encodeURIComponent(id)}`
        );
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Ошибка");
        const root = document.getElementById("gazetaArticle");
        if (root) root.innerHTML = renderArticle(data.report, user.email);
        if (data.user) renderHeaderBlock(data.user);
    } catch (e) {
        document.getElementById("gazetaArticle").innerHTML =
            `<p class="mail-empty">${escapeHtml(e.message)}</p>`;
    }
})();
