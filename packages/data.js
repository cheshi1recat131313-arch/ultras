/** Донат-пакеты Дилера (синхрон с UI и будущей оплатой). */
const DEALER_PACKAGES = [
    {
        id: "standard",
        title: "Стандарт",
        costUsdt: 5,
        receive: 100,
        bonus: 0
    },
    {
        id: "vip",
        title: "VIP",
        costUsdt: 10,
        receive: 200,
        bonus: 30
    },
    {
        id: "opt",
        title: "Опт",
        costUsdt: 25,
        receive: 500,
        bonus: 100
    },
    {
        id: "patron",
        title: "Меценат",
        costUsdt: 50,
        receive: 1000,
        bonus: 250
    },
    {
        id: "max",
        title: "Максимум",
        costUsdt: 75,
        receive: 1500,
        bonus: 450
    },
    {
        id: "max_plus",
        title: "Максимум+",
        costUsdt: 100,
        receive: 2000,
        bonus: 700
    },
    {
        id: "max_plus_plus",
        title: "Максимум++",
        costUsdt: 150,
        receive: 2500,
        bonus: 1000
    }
];

function packageTotal(pkg) {
    return (pkg.receive || 0) + (pkg.bonus || 0);
}

function getPackageById(id) {
    return DEALER_PACKAGES.find((p) => p.id === id) || null;
}

function catalogForClient() {
    return DEALER_PACKAGES.map((pkg) => ({
        id: pkg.id,
        title: pkg.title,
        costUsdt: pkg.costUsdt,
        receive: pkg.receive,
        bonus: pkg.bonus || 0,
        total: packageTotal(pkg)
    }));
}

module.exports = {
    DEALER_PACKAGES,
    packageTotal,
    getPackageById,
    catalogForClient
};
