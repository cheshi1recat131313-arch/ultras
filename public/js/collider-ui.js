/**
 * Коллайдер — UI улучшения оружия.
 */
const colliderWorkshop = createGearWorkshopUi({
    apiBase: "/industrial/collider",
    rootId: "colliderRoot",
    flashId: "colliderFlash",
    itemsKey: "weapons",
    pickLabel: "Оружие",
    defaultEmoji: "🔫",
    maxMessageDefault: "Оружие прокачано максимально.",
    emptyHtml:
        '<p class="collider-empty">У тебя пока нет оружия. Купи его у <a href="/market-weapons.html">дилера</a> и возвращайся.</p>'
});

window.loadCollider = (itemId) => colliderWorkshop.load(itemId);
