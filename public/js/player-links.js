/**
 * Кликабельные ники игроков → досье (/dossier.html?email=…).
 * UMD: браузер (window) и Node (require).
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) {
        module.exports = api;
    } else {
        root.dossierUrl = api.dossierUrl;
        root.playerEmailFromFighterId = api.playerEmailFromFighterId;
        root.playerNameHtml = api.playerNameHtml;
        root.playerNameLink = api.playerNameLink;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    function escapePlayerLinkText(s) {
        return String(s ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function dossierUrl(email) {
        const e = String(email || "")
            .trim()
            .toLowerCase();
        if (!e) return "";
        return "/dossier.html?email=" + encodeURIComponent(e);
    }

    function playerEmailFromFighterId(fighterId) {
        const id = String(fighterId || "");
        if (id.startsWith("player_")) return id.slice(7).toLowerCase();
        if (id.includes("@")) return id.toLowerCase();
        return "";
    }

    /**
     * @param {string} name
     * @param {string|null|undefined} email
     * @param {{ className?: string, extraClass?: string }} [opts]
     */
    function playerNameHtml(name, email, opts) {
        const o = opts || {};
        const label = escapePlayerLinkText(name || "Игрок");
        const e = String(email || "")
            .trim()
            .toLowerCase();
        if (!e) return label;
        const classes = ["player-link", o.className, o.extraClass].filter(Boolean).join(" ");
        return `<a class="${classes}" href="${dossierUrl(e)}">${label}</a>`;
    }

    function playerNameLink(name, email, className) {
        return playerNameHtml(name, email, className ? { className } : undefined);
    }

    return {
        escapePlayerLinkText,
        dossierUrl,
        playerEmailFromFighterId,
        playerNameHtml,
        playerNameLink
    };
});
