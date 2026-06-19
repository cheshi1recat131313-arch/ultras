function escapeHeaderHtml(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
}

const GAME_TZ = "Europe/Kyiv";

function formatGameClock(ms = Date.now()) {
    return new Intl.DateTimeFormat("ru-RU", {
        timeZone: GAME_TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).format(new Date(ms));
}

function formatHeaderClock() {
    return formatGameClock();
}

/** Быстрые переходы по ресурсам в верхней панели. */
const HDR_STAT_NAV = {
    hdrRub: { href: "/work.html", title: "Работа — заработать серебро" },
    hdrUsd: { href: "/tasks.html", title: "Задания — заработать доллары" },
    hdrMush: { href: "/market-packages.html", title: "Пакеты у дилера" },
    hdrHp: { href: "/garderob.html?tab=larek&focus=hp", title: "Провиант — восстановить здоровье" },
    hdrEn: { href: "/larek.html?focus=energy", title: "Ларёк — восстановить энергию" },
    hdrRage: { href: "/larek.html?focus=rage", title: "Ларёк — восстановить ярость" }
};

function isHeaderNavCurrentPage(href) {
    try {
        const target = new URL(href, window.location.origin);
        const current = new URL(window.location.href);
        if (target.pathname !== current.pathname) return false;
        if (target.pathname === "/garderob.html") {
            const targetTab = target.searchParams.get("tab") || "";
            const currentTab = current.searchParams.get("tab") || "";
            const targetFocus = target.searchParams.get("focus") || "";
            const currentFocus = current.searchParams.get("focus") || "";
            return targetTab === currentTab && targetFocus === currentFocus;
        }
        if (target.pathname === "/larek.html") {
            return (target.searchParams.get("focus") || "") === (current.searchParams.get("focus") || "");
        }
        return true;
    } catch {
        return false;
    }
}

function bindHeaderStatNav() {
    Object.entries(HDR_STAT_NAV).forEach(([id, meta]) => {
        const el = document.getElementById(id);
        if (!el || el.dataset.hdrNavBound === "1") return;
        el.dataset.hdrNavBound = "1";
        el.addEventListener("click", (e) => {
            if (isHeaderNavCurrentPage(meta.href)) {
                e.preventDefault();
            }
        });
    });
}

function xpPercentLabel(user) {
    const p = user && user.xpProgress;
    if (p && typeof p.percent === "number") {
        const lv = user.level ?? p.level ?? 1;
        return `${lv}(${p.percent}%)`;
    }
    const lv = user.level ?? 1;
    return `${lv}(0%)`;
}

function updateHeaderNick(user) {
    const el = document.getElementById("hdrNick");
    if (!el || !user) return;
    const nick = escapeHeaderHtml(user.name || "Игрок");
    const emblem = user.clubEmblem
        ? `<img class="hdr-club-emblem" src="${escapeHeaderHtml(user.clubEmblem)}" width="18" height="18" alt="" loading="lazy">`
        : "";
    const html = emblem + nick;
    if (el.innerHTML !== html) el.innerHTML = html;
}

/** Лёгкое обновление цифр в шапке без пересборки DOM. */
function updateHeaderFromUser(user) {
    if (!user) return;
    if (typeof renderHeader === "function") {
        renderHeader(user);
    }
    updateHeaderNick(user);
}

function renderSiteFooter() {
    const el = document.getElementById("site-footer");
    if (!el || el.dataset.mounted === "1") return;
    el.dataset.mounted = "1";
    el.classList.add("site-footer");
    el.innerHTML = `
        <nav class="footer-nav-grid" aria-label="Нижнее меню">
            <a href="/pers.html" class="footer-nav-cell"><img class="footer-ico" src="/static/location/index/pers.png" width="16" height="16" alt="">Перс</a>
            <a href="/pub.html" class="footer-nav-cell"><img class="footer-ico" src="/static/location/index/pub2.png" width="16" height="16" alt="">Паб</a>
            <a href="/mail.html" class="footer-nav-cell"><img class="footer-ico" src="/static/location/index/mail.png" width="16" height="16" alt="">Почта</a>
            <a href="/work.html" class="footer-nav-cell"><img class="footer-ico" src="/static/location/index/work.png" width="16" height="16" alt="">Работа</a>
            <a href="/firm.html" class="footer-nav-cell"><img class="footer-ico" src="/static/location/index/firms.png" width="16" height="16" alt="">Фирма</a>
            <a href="/mushrooms.html" class="footer-nav-cell"><img class="footer-ico" src="/static/location/index/mushrooms.png" width="16" height="16" alt="">Грибы</a>
        </nav>
        <div class="site-links" role="navigation" aria-label="Ссылки">
            <span class="site-links-row">
                <a href="/game.html">На главную</a><span class="site-links-sep">|</span>
                <a href="#">Помощь</a><span class="site-links-sep">|</span>
                <a href="#">Правила</a><span class="site-links-sep">|</span>
                <a href="#">Форум</a><span class="site-links-sep">|</span>
                <a href="#">Благодарности</a><span class="site-links-sep">|</span>
                <a href="/players.html">Игроки</a><span class="site-links-sep">|</span>
                <a href="#">Соглашение</a>
            </span>
            <span class="site-links-row">
                <a href="#">Поиск</a><span class="site-links-sep">|</span>
                <a href="#">Поддержка</a><span class="site-links-sep">|</span>
                <a href="/index.html" class="site-logout">Выход</a>
            </span>
            <p class="site-online">Игроков онлайн: <a href="/players-online.html" class="site-online-link" id="footerOnlineCount">…</a></p>
        </div>
    `;
    refreshFooterOnlineCount();
    if (!el.dataset.onlinePoll) {
        el.dataset.onlinePoll = "1";
        setInterval(refreshFooterOnlineCount, 60000);
    }
    const lo = el.querySelector(".site-logout");
    if (lo) {
        lo.addEventListener("click", (e) => {
            if (typeof clearSession === "function") clearSession();
            else {
                try {
                    localStorage.removeItem("email");
                } catch (err) {
                    /* ignore */
                }
            }
        });
    }
}

function mountSiteFooterWhenReady() {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", renderSiteFooter, { once: true });
    } else {
        renderSiteFooter();
    }
}

mountSiteFooterWhenReady();

async function refreshFooterOnlineCount() {
    const el = document.getElementById("footerOnlineCount");
    if (!el) return;
    try {
        const res = await fetch("/api/players/online");
        const data = await res.json();
        if (data.success) {
            el.textContent = String(Math.max(0, Math.floor(Number(data.count) || 0)));
        }
    } catch {
        if (el.textContent === "…") el.textContent = "—";
    }
}

let __hdrClockTimer = null;

function startHeaderClockTimer() {
    if (__hdrClockTimer) return;
    __hdrClockTimer = setInterval(() => {
        const c = document.getElementById("hdrClock");
        if (c) c.textContent = formatHeaderClock();
        else {
            clearInterval(__hdrClockTimer);
            __hdrClockTimer = null;
        }
    }, 30000);
}

function mountHeaderBlock(user) {
    const header = document.getElementById("header");
    if (!header || !user) return;

    const rub = user.rubles ?? user.money ?? 0;
    const usd = user.dollars ?? 0;
    const mush = user.mushrooms ?? 0;
    const hp = Math.round(user.hp ?? 0);
    const en = user.energy ?? 100;
    const rage = user.rage != null ? user.rage : 100;
    const nick = escapeHeaderHtml(user.name || "Игрок");
    const clubEmblem = user.clubEmblem
        ? `<img class="hdr-club-emblem" src="${escapeHeaderHtml(user.clubEmblem)}" width="18" height="18" alt="" loading="lazy">`
        : "";
    const lvl = escapeHeaderHtml(xpPercentLabel(user));
    const base = "/static/location/base";
    const ico = (src, alt) =>
        `<img class="hdr-ico" src="${src}" width="16" height="16" alt="${alt}" loading="lazy">`;
    const stat = (id, img, alt, val) => {
        const nav = HDR_STAT_NAV[id];
        if (nav) {
            return (
                `<a id="${id}" class="hdr-stat hdr-stat--link" href="${nav.href}" title="${escapeHeaderHtml(nav.title)}">` +
                `${ico(img, alt)}<span class="hdr-val">${escapeHeaderHtml(val)}</span></a>`
            );
        }
        return `<span id="${id}" class="hdr-stat">${ico(img, alt)}<span class="hdr-val">${escapeHeaderHtml(val)}</span></span>`;
    };

    header.innerHTML = `
        <div class="hools-topbar">
            <a class="hools-topbar-home" href="/game.html" aria-label="На главную">
                <img class="hools-logo-img" src="/images/ultras-header-banner.png?v=2" width="256" height="34" alt="ULTRAS">
            </a>
            <button type="button" class="hools-refresh" onclick="location.reload()" title="Обновить" aria-label="Обновить">
                <img src="/static/assets/img/recycle.svg" width="22" height="22" alt="">
            </button>
        </div>
        <div class="hools-statbar">
            <div class="hools-stats-row">
                <span id="hdrClock" class="hdr-stat hdr-time">${escapeHeaderHtml(formatHeaderClock())}</span>
                <a id="hdrNick" class="hdr-nick" href="/pers.html">${clubEmblem}${nick}</a>
                ${stat("hdrLevel", `${base}/user.png`, "Уровень", lvl)}
                ${stat("hdrRub", `${base}/ser.svg`, "Серебро", rub)}
                ${stat("hdrUsd", `${base}/gold.png`, "Золото", usd)}
                ${stat("hdrMush", `${base}/mushrooms.png`, "Грибы", mush)}
                ${stat("hdrHp", `${base}/healt.png`, "Здоровье", hp)}
                ${stat("hdrEn", `${base}/energy.png`, "Энергия", en)}
                ${stat("hdrRage", `${base}/evil.png`, "Ярость", rage)}
            </div>
        </div>
    `;

    header.dataset.hdrMounted = "1";
    startHeaderClockTimer();
    bindHeaderStatNav();
}

function renderHeaderBlock(user, opts = {}) {
    const header = document.getElementById("header");
    if (!header || !user) return;

    const force = !!(opts && opts.force);
    if (header.dataset.hdrMounted === "1" && !force) {
        updateHeaderFromUser(user);
        return;
    }

    mountHeaderBlock(user);
    updateHeaderFromUser(user);

    if (!header.dataset.hdrPollStarted) {
        header.dataset.hdrPollStarted = "1";
        startHeaderResourcePoll();
        if (typeof refreshQuestsTabBadge === "function" && user.email) {
            refreshQuestsTabBadge(user.email).catch(() => {});
        }
    }
}

let __hdrResPoll = null;

function startHeaderResourcePoll() {
    if (__hdrResPoll) return;
    __hdrResPoll = setInterval(async () => {
        const email =
            typeof getStoredEmail === "function"
                ? getStoredEmail()
                : (() => {
                      try {
                          return (localStorage.getItem("email") || "").trim().toLowerCase();
                      } catch {
                          return "";
                      }
                  })();
        if (!email) return;
        try {
            const res = await fetch(
                `/getUser?email=${encodeURIComponent(email)}&viewer=${encodeURIComponent(email)}`
            );
            if (!res.ok) return;
            const data = await res.json();
            if (data.success && data.user) {
                updateHeaderFromUser(data.user);
            }
        } catch {
            /* ignore */
        }
    }, 30000);
}

if (typeof window !== "undefined") {
    window.updateHeaderFromUser = updateHeaderFromUser;
}
