/** Каталог барыги — секции подгружаются с сервера (синхрон с gear-catalog). */

let shopCatalog = null;
let shopSections = null;

function barygaItemArt(item) {
    return item?.image || item?.icon || null;
}

async function loadShopCatalog() {
    if (shopCatalog) return shopCatalog;
    const res = await fetch("/shop/items", { cache: "no-store" });
    const data = await res.json();
    if (data.success) {
        shopCatalog = data.items || {};
        shopSections = data.sections || null;
    } else {
        shopCatalog = {};
        shopSections = { weapon: [], clothes: [] };
    }
    return shopCatalog;
}

function getBarygaSectionIds(sectionId) {
    if (shopSections && shopSections[sectionId]) {
        return shopSections[sectionId];
    }
    const fallback = { weapon: ["newspaper"], clothes: ["rainbow_shirt"] };
    return fallback[sectionId] || [];
}

/** Дилер: всё до текущего ур. + превью следующего предмета в цепочке. */
function filterDealerVisibleIds(sectionId, user, catalog) {
    const level = Math.max(1, Math.floor(Number(user?.level) || 1));
    const ids = getBarygaSectionIds(sectionId);
    const visible = [];
    let nextPreviewId = null;

    for (const id of ids) {
        const item = catalog[id];
        if (!item || item.shopHidden) continue;
        const minLv = Math.max(1, Math.floor(Number(item.minLevel) || 1));
        if (minLv <= level) {
            visible.push(id);
        } else if (nextPreviewId == null) {
            nextPreviewId = id;
        }
    }

    if (nextPreviewId && !visible.includes(nextPreviewId)) {
        visible.push(nextPreviewId);
    }

    return visible;
}

function statLine(item) {
    const slotLabels = {
        weapon: "оружие",
        clothes: "одежда",
        head: "голова",
        boots: "обувь"
    };
    const statLabels = {
        power: "сила",
        stamina: "стойкость",
        speed: "ловкость",
        intel: "хитрость"
    };
    const key =
        item.primaryStat ||
        (item.slot === "weapon"
            ? "power"
            : item.slot === "boots"
              ? "speed"
              : item.slot === "head"
                ? "intel"
                : "stamina");
    const base = item.bonusAtStars?.[1] ?? item[key];
    const max = item.maxBonus ?? item.bonusAtStars?.[3];
    if (!base) return "";
    const statLabel = statLabels[key] || key;
    const slotLabel = slotLabels[item.slot] || "";
    const range = max && max > base ? `+${base} → +${max}` : `+${base}`;
    return `${slotLabel ? slotLabel + ": " : ""}${statLabel} ${range} · до ${item.maxLevel || 3}★`;
}

function silverPriceHtml(cost) {
    return (
        `<span class="baryga-price">${cost} <img src="/static/location/base/ser.svg" alt="сер"></span>`
    );
}

function renderBarygaCard(itemId, item, user) {
    const level = user.level || 1;
    const inventory = user.inventory || [];
    const owned = inventory.includes(itemId);
    const locked = level < (item.minLevel || 1);

    let btnLabel = "Купить";
    let btnDisabled = false;
    if (owned) {
        btnLabel = "Куплено";
        btnDisabled = true;
    } else if (locked) {
        btnDisabled = true;
    }

    const lockHtml = locked && !owned
        ? `<div class="baryga-lock">Доступно с ${item.minLevel} уровня</div>`
        : "";
    const ownedHtml = owned
        ? '<div class="baryga-owned">В гардеробе · <a href="/garderob.html">надеть</a></div>'
        : "";
    const art = barygaItemArt(item);
    const iconHtml = art
        ? `<img class="baryga-card-img" src="${art}" width="62" height="62" alt="" loading="lazy">`
        : `<span class="baryga-card-emoji">${item.emoji || "📦"}</span>`;

    return (
        `<article class="baryga-card" data-item-id="${itemId}">` +
        `<div class="baryga-card-icon">${iconHtml}</div>` +
        `<div class="baryga-card-main">` +
        `<div class="baryga-card-name">${item.label}</div>` +
        `<div class="baryga-stat">${statLine(item)}</div>` +
        `<div class="baryga-card-meta">` +
        silverPriceHtml(item.cost) +
        `<span class="baryga-level">с ${item.minLevel} уровня</span>` +
        `</div>` +
        lockHtml +
        ownedHtml +
        `</div>` +
        `<div class="baryga-card-actions">` +
        `<button type="button" class="baryga-buy" data-item="${itemId}" ${btnDisabled ? "disabled" : ""}>${btnLabel}</button>` +
        `</div>` +
        `</article>`
    );
}

function renderBarygaSection(sectionId, user, catalog) {
    const ids = filterDealerVisibleIds(sectionId, user, catalog);
    const root = document.getElementById("barygaItems");
    if (!root) return;
    root.innerHTML = ids.length
        ? ids.map((id) => (catalog[id] ? renderBarygaCard(id, catalog[id], user) : "")).join("")
        : `<p class="baryga-empty">Пока нет предметов в этом разделе.</p>`;
    bindBarygaBuy(root, user);
}

function bindBarygaBuy(root, userRef) {
    root.querySelectorAll(".baryga-buy").forEach((btn) => {
        btn.addEventListener("click", async () => {
            if (btn.disabled) return;
            const itemId = btn.dataset.item;
            const { ok, data } = await postJson("/shop/buy", {
                email: getEmail(),
                itemId
            });
            showMsg(ok ? data.message : data.error, !ok);
            if (data.user) {
                renderHeaderBlock(data.user);
                const catalog = await loadShopCatalog();
                const section = document.body.dataset.barygaSection;
                if (section) renderBarygaSection(section, data.user, catalog);
            }
        });
    });
}
