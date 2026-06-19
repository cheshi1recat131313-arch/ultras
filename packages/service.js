const { catalogForClient, getPackageById } = require("./data");

const STUB_MESSAGE = "Платёжная система будет подключена позже.";

function createPackagesService() {
    function getCatalog() {
        return catalogForClient();
    }

    /** Заготовка под USDT-оплату: пока только валидация и заглушка. */
    function requestPurchase(packageId) {
        const pkg = getPackageById(packageId);
        if (!pkg) {
            return { ok: false, error: "Пакет не найден" };
        }
        return {
            ok: true,
            stub: true,
            message: STUB_MESSAGE,
            package: {
                id: pkg.id,
                title: pkg.title,
                costUsdt: pkg.costUsdt
            }
        };
    }

    return {
        getCatalog,
        requestPurchase,
        STUB_MESSAGE
    };
}

module.exports = { createPackagesService };
