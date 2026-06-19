/** Сессия: localStorage (email) + сервер (профиль в SQLite). */

function getStoredEmail() {
    try {
        return (localStorage.getItem("email") || "").trim().toLowerCase();
    } catch {
        return "";
    }
}

function saveSessionEmail(email) {
    try {
        localStorage.setItem("email", String(email || "").trim().toLowerCase());
    } catch {
        /* ignore */
    }
}

function clearSession() {
    try {
        localStorage.removeItem("email");
        localStorage.removeItem("character");
        localStorage.removeItem("club");
        localStorage.removeItem("nickname");
    } catch {
        /* ignore */
    }
}

function syncSessionFromUser(user) {
    if (!user) return;
    try {
        if (user.character) localStorage.setItem("character", user.character);
        if (user.club) localStorage.setItem("club", user.club);
        if (user.name) localStorage.setItem("nickname", user.name);
    } catch {
        /* ignore */
    }
}

function isProfileComplete(user) {
    return !!(user && user.character && user.club && user.name);
}

function onboardingUrl(user) {
    if (!user) return "/index.html";
    if (!user.name) return "/name.html";
    if (!user.character) return "/character.html";
    if (!user.club) return "/club.html";
    return "/game.html";
}

function goToOnboarding(user) {
    window.location.href = onboardingUrl(user);
}

async function fetchUserByEmail(email, opts = {}) {
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized) return null;
    const viewer = String(opts.viewer ?? getStoredEmail() ?? normalized)
        .trim()
        .toLowerCase();

    const response = await fetch(
        `/getUser?email=${encodeURIComponent(normalized)}&viewer=${encodeURIComponent(viewer)}`
    );
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.success || !data.user) return null;
    return data.user;
}

async function tryRestoreSession() {
    const email = getStoredEmail();
    if (!email) return null;

    const user = await fetchUserByEmail(email);
    if (!user) {
        clearSession();
        return null;
    }

    syncSessionFromUser(user);
    return user;
}

async function handleAuthSuccess(email, user) {
    saveSessionEmail(email);
    syncSessionFromUser(user);
    window.location.href = onboardingUrl(user);
}
