/**
 * Боты стадиона: 8 клубов × 10 бойцов (уровни 1–10).
 */

const clubCharacters = require("./club-characters");

const STADIUM_CLUB_IDS = ["army", "sparta", "dynamo", "belarus", "neva", "kharki", "hark", "parovozy"];

const BOT_NAMES = {
    army: [
        "Сержант",
        "Патрон",
        "Гранит",
        "Штык",
        "Бункер",
        "Каска",
        "Погран",
        "Марш",
        "Колонна",
        "Генерал"
    ],
    sparta: [
        "Бородач",
        "Копченый",
        "Рыжий",
        "Толстый",
        "Хромой",
        "Бритый",
        "Клык",
        "Молот",
        "Ярость",
        "Вождь"
    ],
    dynamo: [
        "Турбина",
        "Мотор",
        "Свисток",
        "Фланг",
        "Пас",
        "Угловой",
        "Капитан",
        "Болт",
        "Рельс",
        "Паровозик"
    ],
    belarus: [
        "Лён",
        "Клен",
        "Берёза",
        "Сокол",
        "Волк",
        "Медведь",
        "Батько",
        "Кума",
        "Сосед",
        "Хозяин"
    ],
    neva: [
        "Туман",
        "Мост",
        "Канал",
        "Волна",
        "Лёд",
        "Питер",
        "Невский",
        "Гранит",
        "Ветер",
        "Прилив"
    ],
    kharki: [
        "Жёлтый",
        "Ромб",
        "Шеврон",
        "Трибуна",
        "Флаг",
        "Сектор",
        "Кура",
        "Харьк",
        "Город",
        "Баннер"
    ],
    hark: [
        "Шахтёр",
        "Руда",
        "Каска",
        "Лампа",
        "Шурф",
        "Пласт",
        "Вагон",
        "Забой",
        "Кирка",
        "Горняк"
    ],
    parovozy: [
        "Машинист",
        "Кочегар",
        "Пар",
        "Рельс",
        "Вагон",
        "Тормоз",
        "Свисток",
        "Уголь",
        "Стрелка",
        "Депо"
    ]
};

const BASE_STATS = { power: 10, speed: 10, intel: 10, stamina: 10 };

function buildClubRoster(clubId) {
    const names = BOT_NAMES[clubId] || [];
    const roster = [];
    for (let i = 0; i < 10; i += 1) {
        const level = i + 1;
        const bump = (level - 1) * 1.05;
        const botId = `stadium_${clubId}_${i + 1}`;
        const character = clubCharacters.pickClubCharacter(clubId, botId);
        roster.push({
            id: botId,
            club: clubId,
            name: names[i] || `Боец ${i + 1}`,
            level,
            character,
            avatar: clubCharacters.avatarPathForCharacter(character),
            power: Math.round(BASE_STATS.power + bump),
            speed: Math.round(BASE_STATS.speed + bump * 0.75),
            intel: Math.round(BASE_STATS.intel + bump * 0.55),
            stamina: Math.round(BASE_STATS.stamina + bump * 0.95),
            emoji: "👤",
            isBot: true
        });
    }
    return roster;
}

const ROSTERS = {};
for (const clubId of STADIUM_CLUB_IDS) {
    ROSTERS[clubId] = buildClubRoster(clubId);
}

function listStadiumClubIds() {
    return STADIUM_CLUB_IDS.slice();
}

function getRoster(clubId) {
    return (ROSTERS[clubId] || []).slice();
}

function pickMatchClubs(excludeClub) {
    const ids = STADIUM_CLUB_IDS.filter((c) => c !== excludeClub);
    const shuffled = ids.slice().sort(() => Math.random() - 0.5);
    if (shuffled.length < 2) return ["army", "sparta"];
    return [shuffled[0], shuffled[1]];
}

function enemyClubForPlayer(playerClub, homeClub, awayClub) {
    if (playerClub === homeClub) return awayClub;
    if (playerClub === awayClub) return homeClub;
    return null;
}

module.exports = {
    STADIUM_CLUB_IDS,
    listStadiumClubIds,
    getRoster,
    pickMatchClubs,
    enemyClubForPlayer
};
