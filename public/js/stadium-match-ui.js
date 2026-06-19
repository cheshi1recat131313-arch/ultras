/** Общие элементы UI матчей стадиона (касса, расписание). */

function stadiumEscapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
}

function stadiumDollarPriceHtml(cost) {
    const value = Math.max(0, Math.floor(Number(cost) || 0));
    return (
        `<b>${value}</b> ` +
        `<img class="stadium-kassa-price-ico" src="/static/location/base/gold.png" width="16" height="16" alt="доллары" loading="lazy">`
    );
}

function stadiumRenderClubMatchLine(item) {
    const homeIco = item.homeEmblem
        ? `<img class="stadium-club-ico" src="${stadiumEscapeHtml(item.homeEmblem)}" alt="">`
        : "";
    const awayIco = item.awayEmblem
        ? `<img class="stadium-club-ico" src="${stadiumEscapeHtml(item.awayEmblem)}" alt="">`
        : "";
    const homeName = stadiumEscapeHtml(item.homeClubName || "");
    const awayName = stadiumEscapeHtml(item.awayClubName || "");
    return `<span class="stadium-club-match">${homeIco}${homeName} vs ${awayName}${awayIco}</span>`;
}

function stadiumStatusClass(statusLabel) {
    if (statusLabel === "Идёт матч") return "stadium-week-status--live";
    if (statusLabel === "Завершён") return "stadium-week-status--ended";
    return "stadium-week-status--wait";
}
