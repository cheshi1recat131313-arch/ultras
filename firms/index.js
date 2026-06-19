const { createFirmsService } = require("./service");
const { registerFirmsRoutes } = require("./routes");
const config = require("./config");

function createFirmsModule(deps) {
    const service = createFirmsService(deps);

    return {
        service,
        config,
        registerRoutes: (app, routeHelpers) =>
            registerFirmsRoutes(app, {
                firmsService: service,
                normalizeEmail: routeHelpers.normalizeEmail,
                requireExistingUser: routeHelpers.requireExistingUser,
                sanitizeUser: routeHelpers.sanitizeUser
            })
    };
}

module.exports = { createFirmsModule };
