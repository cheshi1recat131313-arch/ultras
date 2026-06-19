/** Конфигурация системы фирм — единый источник правил и цен. */
const FIRM_CREATE_MIN_LEVEL = 3;
const FIRM_NAME_MIN_LENGTH = 3;
const FIRM_NAME_MAX_LENGTH = 32;
const FIRM_CREATE_COST_DOLLARS = 100;
const FIRM_CREATE_COST_MUSHROOMS = 100;

/** Пункты меню личной карточки фирмы (заглушки для будущих разделов). */
const FIRM_HUB_MENU = [
    { id: "members", label: "Кореша", icon: "/static/location/index/firms.png", href: null, stub: true },
    { id: "treasury", label: "Копилка", icon: "/static/location/index/gold.png", href: null, stub: true },
    { id: "charter", label: "Устав", icon: "/static/location/index/target.svg", href: null, stub: true },
    { id: "events", label: "Мероприятия", icon: "/static/location/index/favorite.png", href: null, stub: true },
    {
        id: "achievements",
        label: "Достижения и награды",
        icon: "/static/location/index/trophy.svg",
        href: null,
        stub: true
    },
    { id: "catalog", label: "Все фирмы", icon: "/static/location/index/firms.png", href: "/firms.html", stub: false }
];

/** Флаги будущих возможностей — расширять по мере реализации. */
const FIRM_CAPABILITIES = {
    levels: false,
    rating: true,
    upgrades: false,
    warehouse: false,
    treasury: false,
    achievements: false,
    actionLog: false,
    roles: true,
    logo: true,
    memberStats: true,
    economy: false,
    rosterManagement: false
};

function getPublicConfig() {
    return {
        minLevel: FIRM_CREATE_MIN_LEVEL,
        nameMinLength: FIRM_NAME_MIN_LENGTH,
        nameMaxLength: FIRM_NAME_MAX_LENGTH,
        createCostDollars: FIRM_CREATE_COST_DOLLARS,
        createCostMushrooms: FIRM_CREATE_COST_MUSHROOMS,
        hubMenu: FIRM_HUB_MENU,
        capabilities: FIRM_CAPABILITIES
    };
}

module.exports = {
    FIRM_CREATE_MIN_LEVEL,
    FIRM_NAME_MIN_LENGTH,
    FIRM_NAME_MAX_LENGTH,
    FIRM_CREATE_COST_DOLLARS,
    FIRM_CREATE_COST_MUSHROOMS,
    FIRM_HUB_MENU,
    FIRM_CAPABILITIES,
    getPublicConfig
};
