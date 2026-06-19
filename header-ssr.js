/**
 * Серверная разметка зелёной шапки (как public/js/header.js).
 */

const xpLevels = require("./xp-levels");
const { formatGameClock } = require("./game-time");

function escapeHeaderHtml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatHeaderClock(ms = Date.now()) {
    return formatGameClock(ms);
}

function xpPercentLabel(user) {
    return xpLevels.xpPercentLabel(user);
}

function buildHeaderHtml(user) {
    if (!user) return "";

    const rub = user.rubles ?? user.money ?? 0;
    const usd = user.dollars ?? 0;
    const mush = user.mushrooms ?? 0;
    const hp = Math.round(user.hp ?? 0);
    const en = user.energy ?? 100;
    const rage = user.rage != null ? user.rage : 0;
    const nick = escapeHeaderHtml(user.name || "Игрок");
    const clubEmblem = user.clubEmblem
        ? `<img class="hdr-club-emblem" src="${escapeHeaderHtml(user.clubEmblem)}" width="18" height="18" alt="" loading="lazy">`
        : "";
    const lvl = escapeHeaderHtml(xpPercentLabel(user));
    const base = "/static/location/base";
    const clock = escapeHeaderHtml(formatHeaderClock());

    const ico = (src, alt) =>
        `<img class="hdr-ico" src="${src}" width="16" height="16" alt="${escapeHeaderHtml(alt)}" loading="lazy">`;
    const stat = (id, img, alt, val) =>
        `<span id="${id}" class="hdr-stat">${ico(img, alt)}<span class="hdr-val">${escapeHeaderHtml(val)}</span></span>`;

    return `
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
                <span id="hdrClock" class="hdr-stat hdr-time">${clock}</span>
                <a id="hdrNick" class="hdr-nick" href="/pers.html">${clubEmblem}${nick}</a>
                ${stat("hdrLevel", `${base}/user.png`, "Уровень", lvl)}
                ${stat("hdrRub", `${base}/ser.svg`, "Серебро", rub)}
                ${stat("hdrUsd", `${base}/gold.png`, "Золото", usd)}
                ${stat("hdrMush", `${base}/mushrooms.png`, "Грибы", mush)}
                ${stat("hdrHp", `${base}/healt.png`, "Здоровье", hp)}
                ${stat("hdrEn", `${base}/energy.png`, "Энергия", en)}
                ${stat("hdrRage", `${base}/evil.png`, "Ярость", rage)}
            </div>
        </div>`;
}

module.exports = {
    escapeHeaderHtml,
    formatHeaderClock,
    xpPercentLabel,
    buildHeaderHtml
};
