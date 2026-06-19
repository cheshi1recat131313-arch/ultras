/**
 * Настройки рангов «Элита клуба» (пороги можно менять без правок логики).
 */

const CLUB_ELITE_WINDOW_DAYS = 7;

/** Сколько репутации даёт один черепок (как в игре). */
const CLUB_ELITE_REP_PER_SKULL = 5;

/** Пороговые ранги по черепкам за 7 дней (от меньшего к большему). */
const CLUB_ELITE_THRESHOLD_RANKS = [
    { id: "green", title: "Зелёный", minSkulls: 10 },
    { id: "pioneer", title: "Пионер", minSkulls: 20 },
    { id: "fighter", title: "Боец", minSkulls: 30 },
    { id: "core", title: "Основа", minSkulls: 40 }
];

/** Ранги по общему числу черепков (досье, профиль). */
const SKULL_RANK_THRESHOLDS = [
    { id: "green", title: "Зелёный", minSkulls: 0 },
    { id: "pioneer", title: "Пионер", minSkulls: 10 },
    { id: "fighter", title: "Боец", minSkulls: 20 },
    { id: "core", title: "Основа", minSkulls: 30 }
];

const CLUB_ELITE_RANK_LEADER = "Лидер клуба";
const CLUB_ELITE_RANK_ASSISTANT = "Помощник лидера";
const CLUB_ELITE_ASSISTANT_COUNT = 2;

module.exports = {
    CLUB_ELITE_WINDOW_DAYS,
    CLUB_ELITE_REP_PER_SKULL,
    CLUB_ELITE_THRESHOLD_RANKS,
    CLUB_ELITE_RANK_LEADER,
    CLUB_ELITE_RANK_ASSISTANT,
    CLUB_ELITE_ASSISTANT_COUNT,
    SKULL_RANK_THRESHOLDS
};
