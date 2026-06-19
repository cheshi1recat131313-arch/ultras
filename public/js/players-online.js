/** Список игроков, которые сейчас в игре (last_active_at). */

function escapePlayersHtml(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
}

function renderPlayerAvatar(p, clubsCatalog) {
    if (!p.avatar || typeof playerAvatarFrameHtml !== "function") {
        return `<span class="players-avatar players-avatar--ph" aria-hidden="true"></span>`;
    }
    const fill = p.club ? clubAvatarFill(p.club, clubsCatalog) : null;
    return (
        `<div class="players-ava-wrap">` +
        playerAvatarFrameHtml(p.avatar, {
            fill,
            width: 40,
            height: 40,
            alt: p.name || "",
            className: "player-avatar-frame--players"
        }) +
        `</div>`
    );
}

function renderOnlineList(players, clubsCatalog) {
    const root = document.getElementById("playersOnlineList");
    if (!root) return;

    if (!players.length) {
        root.innerHTML =
            '<p class="players-online-empty">Сейчас никого нет в игре. Загляни позже.</p>';
        return;
    }

    const nameHtml =
        typeof playerNameHtml === "function"
            ? (p) => playerNameHtml(p.name, p.email, { className: "players-name-link" })
            : (p) => escapePlayersHtml(p.name);

    root.innerHTML = players
        .map((p) => {
            const avatar = renderPlayerAvatar(p, clubsCatalog);
            const clubLabel = escapePlayersHtml(p.clubName || "—");
            return (
                `<article class="players-row players-row--online">` +
                avatar +
                `<div class="players-body">` +
                `<p class="players-name players-name--online">` +
                `${nameHtml(p)}` +
                `<span class="players-online-sep"> — </span>` +
                `<span class="players-level">ур. ${Math.max(1, Math.floor(Number(p.level) || 1))}</span>` +
                `<span class="players-online-sep"> — </span>` +
                `<span class="players-club">${clubLabel}</span>` +
                `</p>` +
                `</div></article>`
            );
        })
        .join("");
}

let onlineClubsCatalog = null;

async function loadOnlinePlayers() {
    if (!onlineClubsCatalog && typeof loadClubsCatalog === "function") {
        onlineClubsCatalog = await loadClubsCatalog();
    }
    const res = await fetch("/api/players/online");
    const data = await res.json();
    if (!data.success) {
        throw new Error(data.error || "Ошибка загрузки");
    }

    const hint = document.getElementById("playersOnlineHint");
    if (hint) {
        const mins = Math.max(1, Math.round((data.onlineWindowMs || 600000) / 60000));
        hint.textContent = `Сейчас в игре: ${data.count ?? 0} (активность за последние ${mins} мин.)`;
    }

    renderOnlineList(data.players || [], onlineClubsCatalog || {});
}

(async () => {
    const user = await fetchUser();
    if (user) renderHeaderBlock(user);

    try {
        await loadOnlinePlayers();
        setInterval(() => {
            loadOnlinePlayers().catch(() => {});
        }, 60000);
    } catch (e) {
        const root = document.getElementById("playersOnlineList");
        if (root) {
            root.innerHTML = `<p class="players-online-empty">${escapePlayersHtml(e.message || "Ошибка")}</p>`;
        }
    }
})();
