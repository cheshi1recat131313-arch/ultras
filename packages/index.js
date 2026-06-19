/**
 * Донат-пакеты Дилера — каталог и заготовка под оплату USDT.
 *
 * createPackagesModule(deps) → { service, registerRoutes }
 */

const { createPackagesService } = require("./service");
const { registerPackagesRoutes } = require("./routes");
const packagesData = require("./data");

function createPackagesModule() {
    const service = createPackagesService();

    return {
        service,
        packagesData,
        registerRoutes: (app, routeHelpers) =>
            registerPackagesRoutes(app, {
                packagesService: service,
                normalizeEmail: routeHelpers.normalizeEmail,
                requireExistingUser: routeHelpers.requireExistingUser
            })
    };
}

module.exports = { createPackagesModule };
