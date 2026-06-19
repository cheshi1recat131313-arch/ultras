/** Ларёк — еда и провиант (покупка; хранение — в гардеробе). */

function escapeLarekHtml(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
}

function foodPriceLine(item) {
    const ico =
        item.currency === "mushrooms"
            ? `<img class="larek-price-ico" src="/static/location/base/mushrooms.png" alt="грибы">`
            : `<img class="larek-price-ico" src="/static/location/base/ser.svg" alt="монеты">`;
    return `Цена: <b>${item.cost}</b> ${ico}`;
}

function provisionPriceLine(item) {
    return (
        `Цена: <b>${item.priceDollars}</b> ` +
        `<img class="larek-price-ico" src="/static/location/base/gold.png" alt="доллары">` +
        ` или <b>${item.priceMushrooms}</b> ` +
        `<img class="larek-price-ico" src="/static/location/base/mushrooms.png" alt="грибы">`
    );
}

function iconHtml(item) {
    if (item.icon) {
        return `<img class="larek-card-icon" src="${escapeLarekHtml(item.icon)}" alt="${escapeLarekHtml(item.label)}" width="88" height="88">`;
    }
    return `<div class="larek-card-icon larek-card-icon--emoji" aria-hidden="true">${escapeLarekHtml(item.emoji || "📦")}</div>`;
}

function foodCardHtml(item, user) {
    return (
        `<article class="larek-card" data-item-id="${escapeLarekHtml(item.id)}" data-kind="food">` +
        iconHtml(item) +
        `<div class="larek-card-body">` +
        `<div class="larek-card-name">${escapeLarekHtml(item.label)}</div>` +
        `<div class="larek-card-desc">${escapeLarekHtml(item.description)}</div>` +
        `<div class="larek-card-meta">${item.usageHtml || ""}</div>` +
        `<div class="larek-card-meta">${item.effectHtml || ""}</div>` +
        `<div class="larek-card-owned">У тебя есть: <b class="larek-cnt">${item.count ?? 0}</b> шт.</div>` +
        `<div class="larek-card-price">${foodPriceLine(item)}</div>` +
        `<div class="larek-card-actions">` +
        `<button type="button" class="larek-buy" data-item="${escapeLarekHtml(item.id)}" data-qty="1">Купить</button>` +
        `<button type="button" class="larek-buy10" data-item="${escapeLarekHtml(item.id)}" data-qty="10">Купить 10 шт.</button>` +
        `</div></div></article>`
    );
}

function provisionCardHtml(item, user) {
    return (
        `<article class="larek-card" data-item-id="${escapeLarekHtml(item.id)}" data-kind="provision">` +
        iconHtml(item) +
        `<div class="larek-card-body">` +
        `<div class="larek-card-name">${escapeLarekHtml(item.label)}</div>` +
        `<div class="larek-card-desc">${escapeLarekHtml(item.description)}</div>` +
        `<div class="larek-card-meta">${item.usageHtml || ""}</div>` +
        `<div class="larek-card-meta">${item.effectHtml || ""}</div>` +
        `<div class="larek-card-owned">У тебя есть: <b class="larek-cnt">${item.count ?? 0}</b> шт.</div>` +
        `<div class="larek-card-price">${provisionPriceLine(item)}</div>` +
        `<div class="larek-card-actions">` +
        `<button type="button" class="larek-buy" data-item="${escapeLarekHtml(item.id)}" data-qty="1">Купить</button>` +
        `<button type="button" class="larek-buy10" data-item="${escapeLarekHtml(item.id)}" data-qty="10">Купить 10 шт.</button>` +
        `</div></div></article>`
    );
}

function bindLarekBuy(root) {
    root.querySelectorAll(".larek-buy, .larek-buy10").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const itemId = btn.dataset.item;
            const qty = Math.max(1, Math.min(10, Number(btn.dataset.qty) || 1));
            if (!itemId) return;
            const { ok, data } = await postJson("/larek/buy", {
                email: getEmail(),
                itemId,
                qty
            });
            showMsg(ok ? data.message : data.error, !ok);
            if (!ok) return;
            if (data.user) renderHeaderBlock(data.user);
            await reloadLarekCatalog(data.user);
        });
    });
}

async function reloadLarekCatalog(userHint) {
    const email = getEmail();
    const res = await fetch(`/larek/catalog?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    if (!data.success) {
        showMsg(data.error || "Ошибка ларька.", true);
        return;
    }
    renderLarekShop(data.food || [], data.provisions || [], data.user || userHint);
}

const LAREK_FOCUS_TARGETS = {
    energy: ["americano"],
    rage: ["ozverin", "hot_pepper"]
};

function applyLarekFocus() {
    const focus = new URLSearchParams(window.location.search).get("focus");
    const ids = LAREK_FOCUS_TARGETS[focus];
    if (!ids || !ids.length) return;
    let card = null;
    for (const id of ids) {
        card = document.querySelector(`.larek-card[data-item-id="${id}"]`);
        if (card) break;
    }
    if (!card) return;
    card.classList.add("larek-card--focus");
    requestAnimationFrame(() => {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
    });
}

function renderLarekShop(food, provisions, user) {
    const root = document.getElementById("larekItems");
    if (!root || !user) return;
    const html = (food || []).map((it) => foodCardHtml(it, user)).concat((provisions || []).map((it) => provisionCardHtml(it, user)));
    root.innerHTML = html.join("");
    bindLarekBuy(root);
    applyLarekFocus();
}

async function initLarekPage(user) {
    document.querySelector(".larek-hint")?.addEventListener("click", () => {
        showMsg(
            "Еду можно съесть из гардероба. Провиант для групповых боёв — на стадионе и в других махачах.",
            false
        );
    });
    const res = await fetch(`/larek/catalog?email=${encodeURIComponent(user.email)}`);
    const data = await res.json();
    if (!data.success) {
        showMsg(data.error || "Ошибка загрузки ларька.", true);
        return;
    }
    renderLarekShop(data.food, data.provisions, data.user || user);
}

(async () => {
    const user = await fetchUser();
    if (!user) return;
    renderHeaderBlock(user);
    initLarekPage(user);
})();
