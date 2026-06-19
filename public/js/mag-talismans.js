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

function talismanCardHtml(t, user, options) {
    const opts = options || {};
    const price =
        `Стоимость: ${t.priceDollars} <img class="talisman-price-ico" src="/static/location/base/gold.png" alt="">` +
        ` или ${t.priceMushrooms} <img class="talisman-price-ico" src="/static/location/base/mushrooms.png" alt="">`;
    let actionsHtml;
    if (t.owned) {
        actionsHtml =
            typeof TalismanUpgradeUi !== "undefined"
                ? TalismanUpgradeUi.talismanUpgradeBlockHtml(t, {
                      flashOwned: opts.flashOwnedId || null
                  })
                : `<p class="talisman-owned">Куплено навсегда</p>`;
    } else {
        actionsHtml =
            `<p class="talisman-meta talisman-meta--preview"><b>Уровень:</b> 1 · <b>Эффект:</b> ${t.effectPercent}%</p>` +
            `<p class="talisman-prices">${price}</p>` +
            `<div class="talisman-actions">` +
            `<button type="button" class="talisman-buy-btn">Купить</button>` +
            `<button type="button" class="talisman-buy-btn talisman-desc-btn">Описание</button>` +
            `</div>`;
    }
    return (
        `<article class="talisman-card${t.owned ? " talisman-card--owned" : ""}" data-id="${escapeTalHtml(t.id)}">` +
        `<div class="talisman-card-ico">${talismanIconCell(t.icon, t.name)}</div>` +
        `<div class="talisman-card-main">` +
        `<h3 class="talisman-title">${escapeTalHtml(t.name)}</h3>` +
        `<p class="talisman-desc">${escapeTalHtml(t.description)}</p>` +
        actionsHtml +
        `</div></article>`
    );
}

function bindTalismanDescButtons(root, list) {
    root.querySelectorAll(".talisman-desc-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const card = btn.closest(".talisman-card");
            const talismanId = btn.getAttribute("data-id") || card?.getAttribute("data-id");
            const tal = (list || []).find((item) => item?.id === talismanId);
            if (!tal) return;
            showMsg(`${tal.name}: ${tal.description}. Текущий эффект ${tal.effectPercent}% (ур. ${tal.level}).`, false);
        });
    });
}

function renderMagTalismans(list, user, options) {
    const root = document.getElementById("magTalismansList");
    if (!root) return;
    const opts = options || {};
    root.innerHTML = (list || []).map((t) => talismanCardHtml(t, user, opts)).join("");

    root.querySelectorAll(".talisman-buy-btn:not(.talisman-desc-btn)").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const card = btn.closest(".talisman-card");
            const talismanId = card?.getAttribute("data-id");
            if (!talismanId) return;
            const email = getEmail();
            const { ok, data } = await postJson("/mag/talismans/buy", { email, talismanId });
            if (!ok) {
                showMsg(data?.error || "Не удалось купить талисман.", true);
                return;
            }
            renderHeaderBlock(data.user);
            renderMagTalismans(data.talismans, data.user, { flashOwnedId: talismanId });
            if (typeof TalismanUpgradeUi !== "undefined") {
                TalismanUpgradeUi.scheduleOwnedFlashHide(root);
                TalismanUpgradeUi.bindTalismanUpgradeButtons(root, data.talismans, {
                    onUpgraded: (resp) => renderMagTalismans(resp.talismans, resp.user)
                });
            }
            showMsg("Талисман куплен. Можно улучшать эффект.", false);
        });
    });

    if (typeof TalismanUpgradeUi !== "undefined") {
        if (opts.flashOwnedId) {
            TalismanUpgradeUi.scheduleOwnedFlashHide(root);
        }
        TalismanUpgradeUi.bindTalismanUpgradeButtons(root, list, {
            onUpgraded: (resp) => renderMagTalismans(resp.talismans, resp.user)
        });
    }

    bindTalismanDescButtons(root, list);
}

(async () => {
    const user = await fetchUser();
    if (!user) return;
    renderHeaderBlock(user);

    document.getElementById("talismansHint")?.addEventListener("click", (e) => {
        e.preventDefault();
        showMsg(
            "Талисманы работают автоматически. После покупки их можно улучшать у Мага — каждый уровень даёт +0.5% к шансу эффекта.",
            false
        );
    });

    const res = await fetch(`/mag/talismans?email=${encodeURIComponent(user.email)}`);
    const data = await res.json();
    if (!data.success) {
        showMsg(data.error || "Ошибка загрузки талисманов.", true);
        return;
    }
    renderMagTalismans(data.talismans, data.user || user);
})();
