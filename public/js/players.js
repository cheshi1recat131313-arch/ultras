/** Список зарегистрированных игроков (read-only API). */

function escapePlayersHtml(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
}

function renderPager(page, totalPages) {
    const el = document.getElementById("playersPager");
    if (!el) return;
    if (totalPages <= 1) {
        el.innerHTML =
            totalPages === 1
                ? `<span class="players-pager-label">Страница 1/1</span>`
                : "";
        return;
    }
    const windowSize = 7;
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end = start + windowSize - 1;
    if (end > totalPages) {
        end = totalPages;
        start = Math.max(1, end - windowSize + 1);
    }
    let nums = "";
    for (let p = start; p <= end; p += 1) {
        nums += `<button type="button" class="players-page${p === page ? " is-active" : ""}" data-page="${p}">${p}</button>`;
    }
    el.innerHTML =
        `<button type="button" class="players-page" data-page="1">|&lt;</button>` +
        `<button type="button" class="players-page" data-page="${Math.max(1, page - 1)}">&lt;</button>` +
        nums +
        `<button type="button" class="players-page" data-page="${Math.min(totalPages, page + 1)}">&gt;</button>` +
        `<button type="button" class="players-page" data-page="${totalPages}">&gt;|</button>` +
        `<span class="players-pager-label">Страница ${page}/${totalPages}</span>`;

    if (!el.dataset.bound) {
        el.dataset.bound = "1";
        el.addEventListener("click", (e) => {
            const btn = e.target.closest("[data-page]");
            if (!btn) return;
            const p = Math.max(1, Math.floor(Number(btn.getAttribute("data-page")) || 1));
            loadPlayers(p);
        });
    }
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

function renderList(players, clubsCatalog) {
    const root = document.getElementById("playersList");
    if (!root) return;
    if (!players.length) {
        root.innerHTML = '<p class="district-hint" style="padding:12px">Пока нет зарегистрированных игроков.</p>';
        return;
    }
    const nameHtml =
        typeof playerNameHtml === "function"
            ? (p) => playerNameHtml(p.name, p.email, { className: "players-name-link" })
            : (p) => escapePlayersHtml(p.name);

    root.innerHTML = players
        .map((p) => {
            const onlineMark = p.online
                ? ' <span class="players-online-dot" title="В игре">●</span>'
                : "";
            const avatar = renderPlayerAvatar(p, clubsCatalog);
            return (
                `<article class="players-row">` +
                avatar +
                `<div class="players-body">` +
                `<p class="players-name">${nameHtml(p)}<span class="players-level"> [${p.level}]</span>${onlineMark}</p>` +
                `<p class="players-meta">Репутация: ${Math.max(0, Math.floor(Number(p.reputation) || 0))}</p>` +
                `<p class="players-meta">Ранг: ${escapePlayersHtml(p.rank || "Новичок")}</p>` +
                `</div></article>`
            );
        })
        .join("");
}

let playersClubsCatalog = null;

async function loadPlayers(page) {
    if (!playersClubsCatalog && typeof loadClubsCatalog === "function") {
        playersClubsCatalog = await loadClubsCatalog();
    }
    const res = await fetch(`/api/players?page=${encodeURIComponent(page)}&perPage=20`);
    const data = await res.json();
    if (!data.success) {
        throw new Error(data.error || "Ошибка загрузки");
    }
    const hint = document.getElementById("playersTotalHint");
    if (hint) {
        hint.textContent = `Всего зарегистрировано: ${data.total ?? 0}`;
    }
    const onlineEl = document.getElementById("playersOnline");
    if (onlineEl) {
        const n = data.onlineCount ?? 0;
        onlineEl.innerHTML =
            `Пользователей онлайн: <a href="/players-online.html" class="site-online-link">${n}</a>`;
    }
    renderList(data.players || [], playersClubsCatalog || {});
    renderPager(data.page || 1, data.totalPages || 1);
}

(async () => {
    const user = await fetchUser();
    if (user) renderHeaderBlock(user);
    try {
        await loadPlayers(1);
    } catch (e) {
        const root = document.getElementById("playersList");
        if (root) {
            root.innerHTML = `<p class="district-hint" style="padding:12px">${escapePlayersHtml(e.message || "Ошибка")}</p>`;
        }
    }
})();
