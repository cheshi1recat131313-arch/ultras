/** Каталог барыги (синхрон с server SHOP_ITEMS). */
const BARYGA_SECTIONS = {
    weapon: ["newspaper"],
    clothes: ["rainbow_shirt"]
};

let shopCatalog = null;

async function loadShopCatalog() {
    if (shopCatalog) return shopCatalog;
    const res = await fetch("/shop/items");
    const data = await res.json();
    shopCatalog = data.success ? data.items : {};
    return shopCatalog;
}

function statLine(item) {
    const parts = [];
    if (item.power) parts.push(`сила: +${item.power}`);
    if (item.stamina) parts.push(`стойкость: +${item.stamina}`);
    if (item.speed) parts.push(`ловкость: +${item.speed}`);
    if (item.intel) parts.push(`хитрость: +${item.intel}`);
    return parts.join(" · ") || "";
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
    const rubles = user.rubles ?? user.money ?? 0;
    const canAfford = rubles >= item.cost;

    let btnLabel = "Купить";
    let btnDisabled = false;
    if (owned) {
        btnLabel = "Куплено";
        btnDisabled = true;
    } else if (locked) {
        btnLabel = "Купить";
        btnDisabled = true;
    } else if (!canAfford) {
        btnDisabled = false;
    }

    const lockHtml = locked && !owned
        ? '<div class="baryga-lock">Доступно на следующем уровне</div>'
        : "";
    const ownedHtml = owned
        ? '<div class="baryga-owned">В гардеробе · <a href="/garderob.html">надеть</a></div>'
        : "";

    return (
        `<article class="baryga-card" data-item-id="${itemId}">` +
        `<div class="baryga-card-head">` +
        `<span class="baryga-card-emoji">${item.emoji || "📦"}</span>` +
        `<span class="baryga-card-name">${item.label}</span>` +
        `</div>` +
        `<div class="baryga-card-body">` +
        `<div class="baryga-stat">${statLine(item)}</div>` +
        silverPriceHtml(item.cost) +
        `<div class="baryga-level">с ${item.minLevel} уровня</div>` +
        lockHtml +
        ownedHtml +
        `<div class="baryga-card-actions">` +
        `<button type="button" class="baryga-buy" data-item="${itemId}" ${btnDisabled ? "disabled" : ""}>${btnLabel}</button>` +
        `</div>` +
        `</div>` +
        `</article>`
    );
}

function renderBarygaSection(sectionId, user, catalog) {
    const ids = BARYGA_SECTIONS[sectionId] || [];
    const root = document.getElementById("barygaItems");
    if (!root) return;
    root.innerHTML = ids
        .map((id) => (catalog[id] ? renderBarygaCard(id, catalog[id], user) : ""))
        .join("");
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
