/** Отображение иконки талисмана: emoji или картинка из /static/talismans/ */

function isTalismanIconImage(icon) {
    const s = String(icon || "").trim();
    return s.startsWith("/") || s.startsWith("http://") || s.startsWith("https://");
}

function renderTalismanIcon(icon, alt, opts = {}) {
    const label = alt == null ? "" : String(alt);
    const cls = opts.className || "talisman-icon-img";
    const size = opts.size || 64;
    if (isTalismanIconImage(icon)) {
        const src = String(icon).trim();
        const w = opts.width || size;
        const h = opts.height || size;
        return (
            `<img class="${cls} talisman-icon-img--art" src="${src.replace(/"/g, "&quot;")}" width="${w}" height="${h}" alt="${label.replace(/"/g, "&quot;")}" loading="lazy">`
        );
    }
    const d = document.createElement("span");
    d.textContent = icon || "🪬";
    return `<span class="${cls} talisman-icon-emoji" aria-hidden="true">${d.innerHTML}</span>`;
}

if (typeof window !== "undefined") {
    window.isTalismanIconImage = isTalismanIconImage;
    window.renderTalismanIcon = renderTalismanIcon;
}
