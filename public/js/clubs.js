/** Каталог клубов с сервера (clubs-data.js). */

let __clubsCatalog = null;

async function loadClubsCatalog() {
    if (__clubsCatalog) return __clubsCatalog;
    try {
        const res = await fetch("/clubs/catalog");
        const data = await res.json();
        __clubsCatalog = data.success && data.clubs ? data.clubs : {};
    } catch {
        __clubsCatalog = {};
    }
    return __clubsCatalog;
}

function clubDisplayName(userOrId, catalog) {
    if (userOrId && typeof userOrId === "object") {
        return userOrId.clubName || clubDisplayName(userOrId.club, catalog);
    }
    const id = userOrId;
    if (catalog && catalog[id]) return catalog[id].name;
    return id || "—";
}

function clubEmblemUrl(userOrId, catalog) {
    if (userOrId && typeof userOrId === "object") {
        return userOrId.clubEmblem || clubEmblemUrl(userOrId.club, catalog);
    }
    const id = userOrId;
    if (catalog && catalog[id]) return catalog[id].emblem;
    return null;
}

function clubEmblemImg(userOrId, catalog, size) {
    const url = clubEmblemUrl(userOrId, catalog);
    if (!url) return "";
    const px = size || 22;
    const alt = clubDisplayName(userOrId, catalog);
    return (
        `<img class="club-emblem" src="${url}" width="${px}" height="${px}" alt="${alt}" loading="lazy">`
    );
}
