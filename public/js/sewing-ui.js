/**
 * Швейный цех — UI улучшения одежды.
 */
const sewingWorkshop = createGearWorkshopUi({
    apiBase: "/industrial/sewing",
    rootId: "sewingRoot",
    flashId: "sewingFlash",
    itemsKey: "clothes",
    pickLabel: "Одежда",
    defaultEmoji: "👕",
    maxMessageDefault: "Предмет прокачан максимально.",
    emptyHtml:
        '<p class="collider-empty">У тебя пока нет одежды. Купи её у <a href="/market-clothes.html">дилера</a> и возвращайся.</p>'
});

window.loadSewing = (itemId) => sewingWorkshop.load(itemId);
