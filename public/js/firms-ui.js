(function () {
    function escapeFirmHtml(s) {
        const d = document.createElement("div");
        d.textContent = s == null ? "" : String(s);
        return d.innerHTML;
    }

    function firmStatRow(label, valueHtml) {
        return (
            `<div class="firm-hub-stat">` +
            `<span class="firm-hub-stat-label">${escapeFirmHtml(label)}:</span> ` +
            `<span class="firm-hub-stat-value">${valueHtml}</span>` +
            `</div>`
        );
    }

    function firmLogoHtml(firm) {
        const logo = firm.logo ? String(firm.logo).trim() : "";
        if (logo) {
            return `<img class="firm-hub-logo-img" src="${escapeFirmHtml(logo)}" width="168" height="168" alt="" loading="lazy">`;
        }
        return `<div class="firm-hub-logo-ph" aria-hidden="true">${escapeFirmHtml((firm.name || "F").slice(0, 1))}</div>`;
    }

    function renderFirmHubCard(firm, opts) {
        opts = opts || {};
        const viewerRank = firm.viewerRankTitle || opts.viewerRankTitle || "";
        const showRank = !!viewerRank && opts.showViewerRank !== false;

        const clubLine = firm.leaderClubName
            ? firmStatRow("Клуб", `<span>${escapeFirmHtml(firm.leaderClubName)}</span>`)
            : "";

        const assistantLine = firm.assistantName
            ? firmStatRow(
                  "Помощник лидера",
                  playerNameHtml(firm.assistantName, firm.assistantEmail)
              )
            : "";

        const menuHtml = Array.isArray(firm.menu)
            ? firm.menu
                  .map((item) => {
                      const icon = item.icon
                          ? `<img class="firm-hub-menu-ico" src="${escapeFirmHtml(item.icon)}" width="24" height="24" alt="">`
                          : "";
                      if (item.stub || !item.href) {
                          return (
                              `<span class="firm-hub-menu-row firm-hub-menu-row--stub">` +
                              icon +
                              `<span>${escapeFirmHtml(item.label)}</span>` +
                              `<span class="firm-hub-soon">скоро</span>` +
                              `</span>`
                          );
                      }
                      return (
                          `<a class="firm-hub-menu-row" href="${escapeFirmHtml(item.href)}">` +
                          icon +
                          `<span>${escapeFirmHtml(item.label)}</span>` +
                          `</a>`
                      );
                  })
                  .join("")
            : "";

        return (
            `<article class="firm-hub">` +
            `<h2 class="firm-hub-title">${escapeFirmHtml(firm.name)}</h2>` +
            `<div class="firm-hub-logo">${firmLogoHtml(firm)}</div>` +
            `<div class="firm-hub-stats">` +
            firmStatRow("Фанатов", escapeFirmHtml(String(firm.fightersCount ?? 0))) +
            clubLine +
            firmStatRow("Лидер", playerNameHtml(firm.leaderName, firm.leaderEmail)) +
            assistantLine +
            firmStatRow("Рейтинг", escapeFirmHtml(String(firm.rating ?? 0))) +
            (showRank ? firmStatRow("Ранг", `<strong>${escapeFirmHtml(viewerRank)}</strong>`) : "") +
            firmStatRow("Репутация", escapeFirmHtml(String(firm.reputation ?? 0))) +
            `</div>` +
            (menuHtml ? `<nav class="firm-hub-menu" aria-label="Разделы фирмы">${menuHtml}</nav>` : "") +
            `</article>`
        );
    }

    function renderCatalogCard(firm) {
        return (
            `<a class="firms-catalog-card" href="/firm-view.html?firmId=${encodeURIComponent(firm.id)}">` +
            `<h3 class="firms-catalog-name">${escapeFirmHtml(firm.name)}</h3>` +
            `<p class="firms-catalog-meta">Лидер: ${escapeFirmHtml(firm.leaderName || "—")}</p>` +
            `<p class="firms-catalog-meta">Фанатов: ${escapeFirmHtml(String(firm.fightersCount ?? 0))} · Реп.: ${escapeFirmHtml(String(firm.reputation ?? 0))}</p>` +
            `</a>`
        );
    }

    window.firmsUi = {
        escapeFirmHtml,
        renderFirmHubCard,
        renderCatalogCard,
        firmStatRow
    };
})();
