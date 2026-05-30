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

async function fetchUserByEmail(email) {
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized) return null;

    const response = await fetch(`/getUser?email=${encodeURIComponent(normalized)}`);
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

function getEmail() {
    return typeof getStoredEmail === "function" ? getStoredEmail() : localStorage.getItem("email");
}

/** Только переход на страницу входа — email в localStorage не трогаем (чтобы не «выкидывало» при сбое сети). */
function goToLoginPage() {
    window.location.href = "/index.html";
}

function logoutAndGoHome() {
    if (typeof clearSession === "function") {
        clearSession();
    } else {
        try {
            localStorage.removeItem("email");
        } catch (e) {
            /* ignore */
        }
    }
    window.location.href = "/index.html";
}

async function fetchUser() {
    const email = getEmail();
    if (!email) {
        goToLoginPage();
        return null;
    }

    const user = typeof fetchUserByEmail === "function"
        ? await fetchUserByEmail(email)
        : null;

    if (!user) {
        const response = await fetch(`/getUser?email=${encodeURIComponent(email)}`);
        if (!response.ok) {
            goToLoginPage();
            return null;
        }
        const data = await response.json();
        if (!data.success || !data.user) {
            goToLoginPage();
            return null;
        }
        if (typeof syncSessionFromUser === "function") syncSessionFromUser(data.user);
        if (!isProfileComplete(data.user)) {
            window.location.href = onboardingUrl(data.user);
            return null;
        }
        return data.user;
    }

    if (!isProfileComplete(user)) {
        window.location.href = onboardingUrl(user);
        return null;
    }

    return user;
}

async function postJson(url, payload) {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    return { ok: response.ok, data };
}

const clubLabels = {
    dynamo: "Динамовцы",
    belarus: "Беларусы",
    hark: "Горняки",
    kharki: "Харьки",
    sparta: "Спартачи",
    neva: "Нева",
    army: "Армейцы",
    parovozy: "Паровозы",
    gornyaki: "Горняки"
};

const characterLabels = {
    tank: "Здоровяк",
    fast: "Шустрый",
    balanced: "Ровный",
    valk: "Валькирия",
    shadow: "Тень",
    spark: "Искра",
    tough: "Крепыш",
    redhead: "Рыжая бестия",
    fighter: "Бой-баба",
    chick: "Четкая чувиха"
};

function renderHeader(user) {
    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    const rub = user.rubles ?? user.money ?? 0;
    const usd = user.dollars ?? 0;
    const mush = user.mushrooms ?? 0;
    const hp = Math.round(user.hp ?? 0);
    const en = user.energy ?? 100;
    const rage = user.rage != null ? user.rage : 100;
    const lvl =
        typeof xpPercentLabel === "function"
            ? xpPercentLabel(user)
            : (() => {
                  const p = user.xpProgress;
                  const lv = user.level ?? 1;
                  if (p && typeof p.percent === "number") return `${lv}(${p.percent}%)`;
                  return `${lv}(0%)`;
              })();

    const base = "/static/location/base";
    const setStatVal = (id, val) => {
        const el = document.getElementById(id);
        if (!el) return;
        const v = el.querySelector(".hdr-val");
        if (v) v.textContent = val;
    };

    set("hdrNick", user.name || "Игрок");
    setStatVal("hdrLevel", lvl);
    setStatVal("hdrRub", rub);
    setStatVal("hdrUsd", usd);
    setStatVal("hdrMush", mush);
    setStatVal("hdrHp", hp);
    setStatVal("hdrEn", en);
    setStatVal("hdrRage", rage);

    if (user.clubName) {
        set("clubName", user.clubName);
    } else if (user.club && clubLabels[user.club]) {
        set("clubName", clubLabels[user.club]);
    }
    if (user.character && characterLabels[user.character]) {
        set("characterName", characterLabels[user.character]);
    }
}

function showMsg(text, isError) {
    const el = document.getElementById("msg");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("err", !!isError);
}
