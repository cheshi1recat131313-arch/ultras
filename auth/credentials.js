const crypto = require("crypto");

const MIN_LOGIN_LENGTH = 2;
const MAX_LOGIN_LENGTH = 24;
const MIN_EMAIL_LENGTH = 5;
const MIN_PASSWORD_LENGTH = 6;
const MIN_PHONE_DIGITS = 10;
const INTERNAL_EMAIL_SUFFIX = "@internal.local";

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function normalizePlayerName(name) {
    return String(name || "").trim();
}

function normalizePhone(phone) {
    let digits = String(phone || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.length === 11 && digits.startsWith("8")) {
        digits = `7${digits.slice(1)}`;
    }
    return digits;
}

function isInternalEmail(email) {
    return normalizeEmail(email).endsWith(INTERNAL_EMAIL_SUFFIX);
}

function isRecoveryEmail(email) {
    const normalized = normalizeEmail(email);
    if (normalized.length < MIN_EMAIL_LENGTH) return false;
    if (isInternalEmail(normalized)) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

function generateInternalEmail(login) {
    const slug =
        String(login || "user")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9а-яё]+/gi, "")
            .slice(0, 16) || "user";
    const suffix = crypto.randomBytes(6).toString("hex");
    return `${slug}.${suffix}${INTERNAL_EMAIL_SUFFIX}`;
}

function validateLogin(login) {
    const value = normalizePlayerName(login);
    if (value.length < MIN_LOGIN_LENGTH) {
        return { ok: false, error: `Никнейм: минимум ${MIN_LOGIN_LENGTH} символа` };
    }
    if (value.length > MAX_LOGIN_LENGTH) {
        return { ok: false, error: `Никнейм: максимум ${MAX_LOGIN_LENGTH} символа` };
    }
    return { ok: true, value };
}

function validatePassword(password) {
    const value = String(password || "").trim();
    if (value.length < MIN_PASSWORD_LENGTH) {
        return { ok: false, error: `Пароль: минимум ${MIN_PASSWORD_LENGTH} символов` };
    }
    return { ok: true, value };
}

function validateOptionalRecoveryEmail(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) return { ok: true, value: "" };
    if (normalized.length < MIN_EMAIL_LENGTH || !isRecoveryEmail(normalized)) {
        return { ok: false, error: "Укажи корректный email" };
    }
    return { ok: true, value: normalized };
}

function resolveRecoveryEmailInput({ recoveryEmail, skipRecoveryEmail }) {
    if (skipRecoveryEmail) return "";
    return normalizeEmail(recoveryEmail);
}

function validateOptionalPhone(phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) return { ok: true, value: "" };
    if (normalized.length < MIN_PHONE_DIGITS) {
        return { ok: false, error: "Телефон слишком короткий" };
    }
    return { ok: true, value: normalized };
}

function maskDestination(channel, destination) {
    if (channel === "email") {
        const [local, domain] = String(destination || "").split("@");
        if (!domain) return destination;
        const head = local.length <= 2 ? local[0] || "*" : `${local.slice(0, 2)}***`;
        return `${head}@${domain}`;
    }
    const digits = normalizePhone(destination);
    if (digits.length < 4) return "***";
    return `***${digits.slice(-4)}`;
}

module.exports = {
    MIN_LOGIN_LENGTH,
    MAX_LOGIN_LENGTH,
    MIN_EMAIL_LENGTH,
    MIN_PASSWORD_LENGTH,
    MIN_PHONE_DIGITS,
    INTERNAL_EMAIL_SUFFIX,
    normalizeEmail,
    normalizePlayerName,
    normalizePhone,
    isInternalEmail,
    isRecoveryEmail,
    generateInternalEmail,
    validateLogin,
    validatePassword,
    validateOptionalRecoveryEmail,
    resolveRecoveryEmailInput,
    maskDestination
};
