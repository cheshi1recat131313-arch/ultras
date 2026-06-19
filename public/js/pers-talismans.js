function escapeTalHtml(s) {
    if (typeof TalismanUpgradeUi !== "undefined" && TalismanUpgradeUi.escapeTalHtml) {
        return TalismanUpgradeUi.escapeTalHtml(s);
    }
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
}

function talismanIconCell(icon, name) {
    if (typeof renderTalismanIcon === "function") {
        return renderTalismanIcon(icon, name, { className: "talisman-icon-img", size: 64 });
    }
    return escapeTalHtml(icon || "🪬");
}

function ownedTalismanHtml(t) {
    const upgradeBlock =
        typeof TalismanUpgradeUi !== "undefined"
            ? TalismanUpgradeUi.talismanUpgradeBlockHtml(t)
            : `<p class="talisman-meta"><b>Уровень:</b> ${t.level}</p>` +
              `<p class="talisman-meta"><b>Эффективность:</b> ${t.effectPercent}%</p>` +
              `<div class="talisman-actions"><button class="talisman-upgrade-btn" disabled>Улучшить</button></div>`;
    return (
        `<article class="talisman-card talisman-card--owned" data-id="${escapeTalHtml(t.id)}">` +
        `<div class="talisman-card-ico">${talismanIconCell(t.icon, t.name)}</div>` +
        `<div class="talisman-card-main">` +
        `<h3 class="talisman-title">${escapeTalHtml(t.name)}</h3>` +
        `<p class="talisman-desc">${escapeTalHtml(t.description)}</p>` +
        `<p class="talisman-meta"><b>Область:</b> ${escapeTalHtml(t.scopeLabel || t.scope)}</p>` +
        upgradeBlock +
        `</div></article>`
    );
}

function renderPersTalismans(list) {
    const root = document.getElementById("persTalismansList");
    if (!root) return;
    const owned = (list || []).filter((t) => t.owned);
    if (!owned.length) {
        root.innerHTML =
            '<p class="talismans-empty">Пока нет купленных талисманов. Загляни к Магу Геннадию.</p>';
        return;
    }
    root.innerHTML = owned.map(ownedTalismanHtml).join("");
    if (typeof TalismanUpgradeUi !== "undefined") {
        TalismanUpgradeUi.bindTalismanUpgradeButtons(root, list, {
            onUpgraded: (resp) => renderPersTalismans(resp.talismans)
        });
    }
    root.querySelectorAll(".talisman-desc-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const talismanId = btn.getAttribute("data-id");
            const tal = (list || []).find((item) => item?.id === talismanId);
            if (!tal) return;
            showMsg(`${tal.name}: ${tal.description}. Текущий эффект ${tal.effectPercent}% (ур. ${tal.level}).`, false);
        });
    });
}

(async () => {
    const user = await fetchUser();
    if (!user) return;
    renderHeaderBlock(user);

    const res = await fetch(`/mag/talismans?email=${encodeURIComponent(user.email)}`);
    const data = await res.json();
    if (!data.success) {
        const root = document.getElementById("persTalismansList");
        if (root) {
            root.innerHTML = `<p class="talismans-empty">${escapeTalHtml(data.error || "Ошибка загрузки")}</p>`;
        }
        return;
    }
    renderPersTalismans(data.talismans);
})();
