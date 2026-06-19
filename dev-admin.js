/**
 * Тестовый набор ресурсов только для admin-аккаунта (перед публикацией).
 * Не меняет цены и не затрагивает других игроков.
 *
 * ADMIN_EMAILS — явный список email через запятую (приоритет).
 * Иначе: игрок с именем ровно «admin» (без учёта регистра).
 */

function normalizeEmail(email) {
    return String(email || "")
        .trim()
        .toLowerCase();
}

function parseAdminEmailAllowlist() {
    return String(process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((s) => normalizeEmail(s))
        .filter(Boolean);
}

/** Стоимость всей экипировки ~534k ₽; улучшения до ~556 $ за шаг. */
const ADMIN_TEST_KIT = Object.freeze({
    mushrooms: 1_000_000,
    rubles: 650_000,
    dollars: 120_000
});

function isAdminUser(userOrEmail, userRow) {
    const allowlist = parseAdminEmailAllowlist();
    const email =
        typeof userOrEmail === "string"
            ? normalizeEmail(userOrEmail)
            : normalizeEmail(userOrEmail?.email);
    if (!email) return false;
    if (allowlist.length > 0) return allowlist.includes(email);

    const row = userRow || (typeof userOrEmail === "object" ? userOrEmail : null);
    const name = String(row?.name || "").trim().toLowerCase();
    return name === "admin";
}

function adminTestKitPayload() {
    return { ...ADMIN_TEST_KIT };
}

function verifyAdminSecret(provided) {
    const expected = String(process.env.ADMIN_TEST_SECRET || "").trim();
    if (!expected) return true;
    return String(provided || "").trim() === expected;
}

module.exports = {
    ADMIN_TEST_KIT,
    normalizeEmail,
    isAdminUser,
    adminTestKitPayload,
    verifyAdminSecret
};
