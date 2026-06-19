/**
 * Национальные сборные — точка входа модуля.
 *
 * createNationalTeamsModule(deps) → { service, registerRoutes }
 */

const { createNationalTeamsService } = require("./service");
const { registerNationalTeamsRoutes } = require("./routes");
const teamsData = require("./data");
const { NATIONAL_TEAM_CHANGE_COST } = require("./config");

function createNationalTeamsModule(deps) {
    const service = createNationalTeamsService({
        runQuery: deps.runQuery,
        getQuery: deps.getQuery,
        allQuery: deps.allQuery,
        getEffectiveStats: deps.getEffectiveStats
    });

    return {
        service,
        teamsData,
        NATIONAL_TEAM_CHANGE_COST,
        registerRoutes: (app, routeHelpers) =>
            registerNationalTeamsRoutes(app, {
                nationalTeamsService: service,
                normalizeEmail: routeHelpers.normalizeEmail,
                requireExistingUser: routeHelpers.requireExistingUser,
                sanitizeUser: routeHelpers.sanitizeUser,
                onMainQuestEvent: routeHelpers.onMainQuestEvent
            })
    };
}

module.exports = { createNationalTeamsModule };
