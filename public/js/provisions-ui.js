/** Отображение провианта (иконки + количество). */

function escapeProvHtml(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
}

function provisionIconHtml(item) {
    const icon = item.icon || "";
    const label = escapeProvHtml(item.label || "");
    if (icon) {
        return `<img class="provision-ico" src="${escapeProvHtml(icon)}" alt="${label}" width="44" height="44">`;
    }
    return `<span class="provision-ico-ph">${escapeProvHtml(item.emoji || "📦")}</span>`;
}

/** Панель только с предметами count > 0. */
function renderOwnedProvisions(container, items) {
    if (!container) return;
    const list = (items || []).filter((g) => (g.count ?? 0) > 0);
    if (!list.length) {
        container.innerHTML = "";
        container.hidden = true;
        return;
    }
    container.hidden = false;
    container.innerHTML = list
        .map(
            (g) =>
                `<div class="provision-slot" title="${escapeProvHtml(g.label)} × ${g.count}">` +
                provisionIconHtml(g) +
                `<span class="provision-count">${g.count}</span>` +
                `</div>`
        )
        .join("");
}

/** Кнопки провианта для удара по противнику. */
function renderProvisionAttackButtons(row, items, targetId) {
    if (!row) return;
    row.innerHTML = "";
    const list = (items || []).filter((g) => (g.count ?? 0) > 0);
    list.forEach((g) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "stadium-gadget-hit provision-hit-btn";
        btn.title = `${g.label} × ${g.count}`;
        btn.dataset.target = targetId;
        btn.dataset.gadget = g.id;
        btn.innerHTML = provisionIconHtml(g) + `<span class="stadium-gadget-count">${g.count}</span>`;
        row.appendChild(btn);
    });
}
