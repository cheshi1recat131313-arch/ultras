/**
 * Аватарка — слои:
 * z0 .player-avatar-bg — клубный градиент;
 * z2 .player-avatar-img — PNG персонажа.
 */

function clubAvatarFill(clubId, catalog) {
    const id = clubId ? String(clubId).trim() : "";
    const theme = id && catalog && catalog[id] ? catalog[id].avatarTheme : null;
    if (!theme) return null;
    if (theme.fill) return theme.fill;
    if (theme.primary && theme.secondary) {
        return `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`;
    }
    return null;
}

/** Слои: фон клуба (z0) → PNG персонажа (z2). */
function playerAvatarFrameHtml(avatarSrc, opts) {
    opts = opts || {};
    const src = avatarSrc ? String(avatarSrc) : "";
    const alt = opts.alt != null ? String(opts.alt) : "";
    const fill = opts.fill || null;
    const w = opts.width || 120;
    const h = opts.height || 120;
    const cls = ["player-avatar-frame", opts.className].filter(Boolean).join(" ");
    const imgCls = ["player-avatar-img", "avatar-img"].filter(Boolean).join(" ");
    const bgStyle = fill ? ` style="background:${fill}"` : "";
    const esc = (s) =>
        String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/"/g, "&quot;");
    return (
        `<div class="${cls}">` +
        `<div class="player-avatar-bg avatar-bg"${bgStyle} aria-hidden="true"></div>` +
        `<img class="${imgCls}" src="${esc(src)}" width="${w}" height="${h}" alt="${esc(alt)}" loading="lazy">` +
        `</div>`
    );
}

function fighterAvatarHtml(fighter, catalog, opts) {
    opts = opts || {};
    const src = fighter && fighter.avatar ? String(fighter.avatar) : "";
    const clubId = fighter && fighter.club ? fighter.club : null;
    const fill = clubId ? clubAvatarFill(clubId, catalog) : null;
    const w = opts.width || 56;
    const h = opts.height || 56;
    const alt = fighter && fighter.name ? String(fighter.name) : "";
    const wrapCls = opts.wrapClass || "bot-ava";
    const frameCls = opts.frameClass || "player-avatar-frame--bot";

    if (!src) {
        const fb = fighter && fighter.emoji ? String(fighter.emoji) : "👤";
        return `<div class="${wrapCls}"><span class="bot-ava-fallback">${fb}</span></div>`;
    }

    return (
        `<div class="${wrapCls}">` +
        playerAvatarFrameHtml(src, {
            fill,
            width: w,
            height: h,
            alt,
            className: frameCls
        }) +
        `</div>`
    );
}

function clubIdForTheme(user) {
    if (!user) return null;
    if (user.club) return user.club;
    try {
        return localStorage.getItem("club") || null;
    } catch {
        return null;
    }
}
