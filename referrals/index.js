const { createReferralsService } = require("./service");
const { registerReferralsRoutes } = require("./routes");
const { REFERRAL_ACTIVE_MS } = require("./config");

function createReferralsModule(deps) {
    const service = createReferralsService(deps);

    return {
        service,
        REFERRAL_ACTIVE_MS,
        registerRoutes: (app, routeHelpers) =>
            registerReferralsRoutes(app, {
                referralsService: service,
                normalizeEmail: routeHelpers.normalizeEmail,
                requireExistingUser: routeHelpers.requireExistingUser
            })
    };
}

module.exports = { createReferralsModule };
