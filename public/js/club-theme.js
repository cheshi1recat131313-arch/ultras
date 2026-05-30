/** Фон внутри квадрата аватарки по клубу (слой под PNG, без blend-mode). */

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

/** Слои: фон клуба (z0) → PNG (z1) → рамка. */
function playerAvatarFrameHtml(avatarSrc, opts) {
    opts = opts || {};
    const src = avatarSrc ? String(avatarSrc) : "";
    const alt = opts.alt != null ? String(opts.alt) : "";
    const fill = opts.fill || null;
    const w = opts.width || 120;
    const h = opts.height || 120;
    const cls = ["player-avatar-frame", opts.className].filter(Boolean).join(" ");
    const bgStyle = fill ? ` style="background:${fill}"` : "";
    const esc = (s) =>
        String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/"/g, "&quot;");
    return (
        `<div class="${cls}">` +
        `<div class="player-avatar-bg avatar-bg"${bgStyle} aria-hidden="true"></div>` +
        `<img class="player-avatar-img avatar-img" src="${esc(src)}" width="${w}" height="${h}" alt="${esc(alt)}" loading="lazy">` +
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
