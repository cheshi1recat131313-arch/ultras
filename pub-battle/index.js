/**
 * «Битва за Паб» — точка входа модуля.
 *
 * createPubBattleModule(deps) → { service, combatBridge, ensureSchema, registerRoutes, startScheduler }
 */

const { ensurePubBattleSchema } = require("./db");
const { createPubBattleService } = require("./service");
const { registerPubBattleRoutes } = require("./routes");
const { createPubBattleScheduler } = require("./scheduler");
const { createPubBattleCombatBridge } = require("./combat-bridge");

function createPubBattleModule(deps) {
    const combatBridge = createPubBattleCombatBridge({
        stadiumEngine: deps.stadiumEngine,
        avatarPath: deps.avatarPath
    });

    const service = createPubBattleService({
        runQuery: deps.runQuery,
        getQuery: deps.getQuery,
        allQuery: deps.allQuery,
        getEffectiveStats: deps.getEffectiveStats,
        readUserHpForFight: deps.readUserHpForFight,
        calcMaxHp: deps.calcMaxHp,
        repEarningsService: deps.repEarningsService,
        combatBridge,
        onMainQuestEvent: deps.onMainQuestEvent
    });

    const scheduler = createPubBattleScheduler(service);

    return {
        service,
        combatBridge,
        scheduler,
        ensureSchema: () => ensurePubBattleSchema(deps.runQuery, deps.allQuery),
        registerRoutes: (app, routeHelpers) =>
            registerPubBattleRoutes(app, {
                pubBattleService: service,
                normalizeEmail: routeHelpers.normalizeEmail,
                requireExistingUser: routeHelpers.requireExistingUser,
                sanitizeUser: routeHelpers.sanitizeUser
            }),
        startScheduler: () => scheduler.start(),
        stopScheduler: () => scheduler.stop()
    };
}

module.exports = { createPubBattleModule };
