/**
 * Единый каталог клубов: id, название, путь к эмблеме (прозрачные PNG в /static/clubs/).
 */

const EMBLEM_DIR = "/static/clubs";

/**
 * Фон под аватаркой игрока (слой .player-avatar-bg).
 * Менять цвета клуба только здесь — досье, бой, район, стадион, рейтинг, газета и др.
 * берут fill через getClubAvatarTheme / /clubs/catalog.
 *
 * primary — верхняя часть, secondary — нижняя, fill — CSS-градиент с диагональю.
 */
const CLUB_AVATAR_THEMES = {
    neva: {
        primary: "#b8d8f2",
        secondary: "#ffffff",
        fill: "linear-gradient(145deg, #b8d8f2 0%, #b8d8f2 46%, #ffffff 46%, #ffffff 100%)"
    },
    hark: {
        primary: "#1a171b",
        secondary: "#ee8541",
        fill: "linear-gradient(96deg, #1a171b 0%, #1a171b 58%, #ee8541 58%, #ee8541 100%)"
    },
    gornyaki: {
        primary: "#1a171b",
        secondary: "#ee8541",
        fill: "linear-gradient(96deg, #1a171b 0%, #1a171b 58%, #ee8541 58%, #ee8541 100%)"
    },
    sparta: {
        primary: "#c62828",
        secondary: "#f5f2f2",
        fill: "linear-gradient(145deg, #c62828 0%, #c62828 50%, #f5f2f2 50%, #f5f2f2 100%)"
    },
    dynamo: {
        primary: "#1671C0",
        secondary: "#FFFF15",
        fill: "linear-gradient(145deg, #1671C0 0%, #1671C0 50%, #FFFF15 50%, #FFFF15 100%)"
    },
    belarus: {
        primary: "#2a52b0",
        secondary: "#e8c830",
        fill:
            "linear-gradient(180deg, #3a62c8 0%, #4a72d0 20%, #e8d058 48%, #e0c850 52%, #3a9868 80%, #2a7840 100%)"
    },
    kharki: {
        primary: "#d8b830",
        secondary: "#2a5838",
        fill: "linear-gradient(145deg, #d8b830 0%, #d8b830 48%, #2a5838 48%, #2a5838 100%)"
    },
    parovozy: {
        primary: "#c03030",
        secondary: "#2a7840",
        fill: "linear-gradient(145deg, #c03030 0%, #c03030 50%, #2a7840 50%, #2a7840 100%)"
    },
    army: {
        primary: "#a83038",
        secondary: "#2c322a",
        fill: "linear-gradient(145deg, #a83038 0%, #a83038 44%, #2c322a 44%, #2c322a 100%)"
    }
};

const CLUBS = {
    dynamo: {
        id: "dynamo",
        name: "Динамовцы",
        emblem: `${EMBLEM_DIR}/dynamo.png`,
        description: "Сине-белая армия ультрас. На трибуне с девяностых, за клуб до конца."
    },
    belarus: {
        id: "belarus",
        name: "Беларусы",
        emblem: `${EMBLEM_DIR}/belarus.png`,
        description: "Бело-голубые с красным акцентом. Сборная духа и жёсткой поддержки."
    },
    hark: {
        id: "hark",
        name: "Горняки",
        emblem: `${EMBLEM_DIR}/gornyaki.png`,
        description: "Оранжево-чёрные горняки. Грубый район, жёсткий стадион и свой кодекс."
    },
    kharki: {
        id: "kharki",
        name: "Харьки",
        emblem: `${EMBLEM_DIR}/kharki.png`,
        description: "Жёлто-зелёная братва с северных трибун. Любят выезд и громкий сектор."
    },
    sparta: {
        id: "sparta",
        name: "Спартачи",
        emblem: `${EMBLEM_DIR}/sparta.png`,
        description: "Красно-белые спартаковцы. Агрессивный сектор и горячая голова на матчах."
    },
    neva: {
        id: "neva",
        name: "Нева",
        emblem: `${EMBLEM_DIR}/neva.png`,
        description: "Голубые с белым — северная школа фанатов. Спокойные снаружи, жёсткие внутри."
    },
    army: {
        id: "army",
        name: "Армейцы",
        emblem: `${EMBLEM_DIR}/army.png`,
        description: "Красно-зелёные армейцы. Дисциплина, строй и готовность к любой стычке."
    },
    parovozy: {
        id: "parovozy",
        name: "Паровозы",
        emblem: `${EMBLEM_DIR}/parovozy.png`,
        description: "Красно-зелёные паровозы. Старый клуб, старые традиции, новые разборки."
    },
    gornyaki: {
        id: "gornyaki",
        name: "Горняки",
        emblem: `${EMBLEM_DIR}/gornyaki.png`,
        description: "Оранжево-чёрные горняки. Грубый район, жёсткий стадион и свой кодекс.",
        /** Только для старых сохранений в БД — в выборе клуба не показываем */
        hiddenFromSelection: true
    }
};

/** Один клуб в БД может храниться под разными id (legacy). */
const CLUB_FAN_ALIASES = {
    hark: ["hark", "gornyaki"],
    gornyaki: ["hark", "gornyaki"]
};

/** Клубы, которые нельзя выбрать при регистрации (остаются в каталоге для старых аккаунтов). */
const HIDDEN_FROM_SELECTION = new Set(
    Object.values(CLUBS)
        .filter((c) => c.hiddenFromSelection)
        .map((c) => c.id)
);

function getClub(id) {
    if (!id) return null;
    return CLUBS[String(id).trim()] || null;
}

function getClubName(id) {
    const c = getClub(id);
    return c ? c.name : null;
}

function getClubEmblem(id) {
    const c = getClub(id);
    return c ? c.emblem : null;
}

function getClubDescription(id) {
    const c = getClub(id);
    return c && c.description ? c.description : "";
}

/** Id записей users.club для подсчёта фанатов (учитывает legacy-алиасы). */
function clubIdsForFanCount(id) {
    const key = String(id || "").trim();
    if (!key) return [];
    const aliases = CLUB_FAN_ALIASES[key];
    if (aliases && aliases.length) return [...new Set(aliases)];
    return [key];
}

function fanWord(n) {
    const v = Math.abs(Math.floor(Number(n) || 0));
    const mod10 = v % 10;
    const mod100 = v % 100;
    if (mod10 === 1 && mod100 !== 11) return "фанат";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "фаната";
    return "фанатов";
}

function getClubAvatarTheme(id) {
    const key = String(id || "").trim();
    return CLUB_AVATAR_THEMES[key] || null;
}

function isValidClub(id) {
    return !!getClub(id);
}

function listClubs() {
    return Object.values(CLUBS);
}

function listSelectableClubs() {
    return Object.values(CLUBS).filter((c) => !HIDDEN_FROM_SELECTION.has(c.id));
}

function clubsCatalogForClient() {
    const out = {};
    for (const [id, c] of Object.entries(CLUBS)) {
        out[id] = {
            id: c.id,
            name: c.name,
            emblem: c.emblem,
            description: c.description || "",
            avatarTheme: getClubAvatarTheme(id),
            selectable: !HIDDEN_FROM_SELECTION.has(id)
        };
    }
    return out;
}

module.exports = {
    CLUBS,
    getClub,
    getClubName,
    getClubEmblem,
    getClubDescription,
    getClubAvatarTheme,
    clubIdsForFanCount,
    fanWord,
    isValidClub,
    listClubs,
    listSelectableClubs,
    clubsCatalogForClient
};
