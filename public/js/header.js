function escapeHeaderHtml(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
}

function formatHeaderClock() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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

function renderSiteFooter() {
    const el = document.getElementById("site-footer");
    if (!el || el.dataset.mounted === "1") return;
    el.dataset.mounted = "1";
    el.classList.add("site-footer");
    el.innerHTML = `
        <nav class="footer-nav-grid" aria-label="Нижнее меню">
            <a href="/pers.html" class="footer-nav-cell"><img class="footer-ico" src="/static/location/index/pers.png" width="16" height="16" alt="">Перс</a>
            <a href="#" class="footer-nav-cell"><img class="footer-ico" src="/static/location/index/pub2.png" width="16" height="16" alt="">Паб</a>
            <a href="#" class="footer-nav-cell"><img class="footer-ico" src="/static/location/index/mail.png" width="16" height="16" alt="">Почта</a>
            <a href="/work.html" class="footer-nav-cell"><img class="footer-ico" src="/static/location/index/work.png" width="16" height="16" alt="">Работа</a>
            <a href="#" class="footer-nav-cell"><img class="footer-ico" src="/static/location/index/firms.png" width="16" height="16" alt="">Фирма</a>
            <a href="#" class="footer-nav-cell"><img class="footer-ico" src="/static/location/index/mushrooms.png" width="16" height="16" alt="">Грибы</a>
        </nav>
        <div class="site-links" role="navigation" aria-label="Ссылки">
            <span class="site-links-row">
                <a href="/game.html">На главную</a><span class="site-links-sep">|</span>
                <a href="#">Помощь</a><span class="site-links-sep">|</span>
                <a href="#">Правила</a><span class="site-links-sep">|</span>
                <a href="#">Соглашение</a><span class="site-links-sep">|</span>
                <a href="#">Форум</a><span class="site-links-sep">|</span>
                <a href="#">Благодарности</a>
            </span>
            <span class="site-links-row">
                <a href="#">Игроки</a><span class="site-links-sep">|</span>
                <a href="#">Поиск</a><span class="site-links-sep">|</span>
                <a href="#">Поддержка</a><span class="site-links-sep">|</span>
                <a href="/index.html" class="site-logout">Выход</a>
            </span>
        </div>
    `;
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

let __hdrClockTimer = null;

function renderHeaderBlock(user) {
    const header = document.getElementById("header");
    if (!header) return;

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
    const stat = (id, img, alt, val) =>
        `<span id="${id}" class="hdr-stat">${ico(img, alt)}<span class="hdr-val">${escapeHeaderHtml(val)}</span></span>`;

    header.innerHTML = `
        <div class="hools-topbar">
            <a class="hools-logo" href="/game.html">Фанаты</a>
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

    if (__hdrClockTimer) clearInterval(__hdrClockTimer);
    __hdrClockTimer = setInterval(() => {
        const c = document.getElementById("hdrClock");
        if (c) c.textContent = formatHeaderClock();
        else {
            clearInterval(__hdrClockTimer);
            __hdrClockTimer = null;
        }
    }, 30000);

    renderHeader(user);
    startHeaderResourcePoll();
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
            const res = await fetch(`/getUser?email=${encodeURIComponent(email)}`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.success && data.user) renderHeaderBlock(data.user);
        } catch {
            /* ignore */
        }
    }, 30000);
}
