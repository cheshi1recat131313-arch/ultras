/** Каталог национальных сборных — единый источник правды. */

const NATIONAL_TEAMS = {
    ukraine: {
        id: "ukraine",
        name: "Украина",
        description: "Национальная сборная",
        flag: "/static/national-teams/ukraine.svg"
    },
    russia: {
        id: "russia",
        name: "Россия",
        description: "Национальная сборная",
        flag: "/static/national-teams/russia.svg"
    },
    belarus: {
        id: "belarus",
        name: "Беларусь",
        description: "Национальная сборная",
        flag: "/static/national-teams/belarus.svg"
    },
    kazakhstan: {
        id: "kazakhstan",
        name: "Казахстан",
        description: "Национальная сборная",
        flag: "/static/national-teams/kazakhstan.svg"
    },
    europe: {
        id: "europe",
        name: "Европа",
        description: "Национальная сборная",
        flag: "/static/national-teams/europe.svg"
    },
    world: {
        id: "world",
        name: "Остальной мир",
        description: "Национальная сборная",
        flag: "/static/national-teams/world.svg"
    }
};

const TEAM_ORDER = ["ukraine", "russia", "belarus", "kazakhstan", "europe", "world"];

function listTeams() {
    return TEAM_ORDER.map((id) => NATIONAL_TEAMS[id]).filter(Boolean);
}

function isValidTeam(teamId) {
    return Boolean(teamId && NATIONAL_TEAMS[teamId]);
}

function getTeam(teamId) {
    return NATIONAL_TEAMS[teamId] || null;
}

function getTeamName(teamId) {
    const t = getTeam(teamId);
    return t ? t.name : null;
}

function getTeamFlag(teamId) {
    const t = getTeam(teamId);
    return t ? t.flag : null;
}

function teamsCatalogForClient() {
    const out = {};
    for (const team of listTeams()) {
        out[team.id] = { ...team };
    }
    return out;
}

module.exports = {
    NATIONAL_TEAMS,
    TEAM_ORDER,
    listTeams,
    isValidTeam,
    getTeam,
    getTeamName,
    getTeamFlag,
    teamsCatalogForClient
};
