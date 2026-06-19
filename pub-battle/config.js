/** «Битва за Паб» — настройки режима. */

const ENTRY_COST_DOLLARS = 10;
const ROOM_MOVE_COOLDOWN_MS = 3 * 60 * 1000;
const COORD_CHAT_MAX = 80;
const COORD_MESSAGE_MAX = 200;

/** Тест: каждый день в фиксированный час. Прод: воскресенье 19:00. */
const PUB_BATTLE_TEST_MODE = true;
const PUB_BATTLE_PROD_WEEKDAY = 0;
const PUB_BATTLE_PROD_HOUR = 19;
const PUB_BATTLE_PROD_MINUTE = 0;
const PUB_BATTLE_TEST_HOUR = 21;
const PUB_BATTLE_TEST_MINUTE = 0;

/** Запись открывается за сутки до старта. */
const REGISTRATION_OPEN_BEFORE_MS = 24 * 60 * 60 * 1000;

const SCHEDULER_TICK_MS = 30 * 1000;
const COMBAT_TICK_MS = 4000;

module.exports = {
    ENTRY_COST_DOLLARS,
    ROOM_MOVE_COOLDOWN_MS,
    COORD_CHAT_MAX,
    COORD_MESSAGE_MAX,
    PUB_BATTLE_TEST_MODE,
    PUB_BATTLE_PROD_WEEKDAY,
    PUB_BATTLE_PROD_HOUR,
    PUB_BATTLE_PROD_MINUTE,
    PUB_BATTLE_TEST_HOUR,
    PUB_BATTLE_TEST_MINUTE,
    REGISTRATION_OPEN_BEFORE_MS,
    SCHEDULER_TICK_MS,
    COMBAT_TICK_MS
};
