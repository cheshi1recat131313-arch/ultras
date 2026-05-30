/**
 * Единый каталог клубов: id, название, путь к эмблеме (прозрачные PNG в /static/clubs/).
 */

const EMBLEM_DIR = "/static/clubs";

/** Фон под аватаркой: primary/secondary + диагональ (fill) для слоя .avatar-bg. */
const CLUB_AVATAR_THEMES = {
    neva: {
        primary: "#b8d8f2",
        secondary: "#ffffff",
        fill: "linear-gradient(145deg, #b8d8f2 0%, #b8d8f2 46%, #ffffff 46%, #ffffff 100%)"
    },
    hark: {
        primary: "#52504c",
        secondary: "#d07830",
        fill: "linear-gradient(152deg, #52504c 0%, #52504c 58%, #d07830 58%, #d07830 100%)"
    },
    gornyaki: {
        primary: "#52504c",
        secondary: "#d07830",
        fill: "linear-gradient(152deg, #52504c 0%, #52504c 58%, #d07830 58%, #d07830 100%)"
    },
    sparta: {
        primary: "#c62828",
        secondary: "#f5f2f2",
        fill: "linear-gradient(145deg, #c62828 0%, #c62828 50%, #f5f2f2 50%, #f5f2f2 100%)"
    },
    dynamo: {
        primary: "#f5d76e",
        secondary: "#4a6ec8",
        fill: "linear-gradient(145deg, #f5d76e 0%, #f5d76e 50%, #4a6ec8 50%, #4a6ec8 100%)"
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
        emblem: `${EMBLEM_DIR}/dynamo.png`
    },
    belarus: {
        id: "belarus",
        name: "Беларусы",
        emblem: `${EMBLEM_DIR}/belarus.png`
    },
    hark: {
        id: "hark",
        name: "Горняки",
        emblem: `${EMBLEM_DIR}/gornyaki.png`
    },
    kharki: {
        id: "kharki",
        name: "Харьки",
        emblem: `${EMBLEM_DIR}/kharki.png`
    },
    sparta: {
        id: "sparta",
        name: "Спартачи",
        emblem: `${EMBLEM_DIR}/sparta.png`
    },
    neva: {
        id: "neva",
        name: "Нева",
        emblem: `${EMBLEM_DIR}/neva.png`
    },
    army: {
        id: "army",
        name: "Армейцы",
        emblem: `${EMBLEM_DIR}/army.png`
    },
    parovozy: {
        id: "parovozy",
        name: "Паровозы",
        emblem: `${EMBLEM_DIR}/parovozy.png`
    },
    gornyaki: {
        id: "gornyaki",
        name: "Горняки",
        emblem: `${EMBLEM_DIR}/gornyaki.png`,
        /** Только для старых сохранений в БД — в выборе клуба не показываем */
        hiddenFromSelection: true
    }
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
    getClubAvatarTheme,
    isValidClub,
    listClubs,
    listSelectableClubs,
    clubsCatalogForClient
};
