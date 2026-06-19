/** «Лучшие из лучших» / «Лучшие на уровне» — карточки, ТОП-100, 20 на страницу. */

function escapeHtmlRating(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
}

function formatRatingNum(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "0";
    return v.toLocaleString("ru-RU");
}

function repIco() {
    return '<img class="rating-best-rep-ico" src="/static/icons/rep.png" width="14" height="14" alt="">';
}

function renderTopBestPlayerRow(p, clubsCatalog, opts) {
    const o = opts || {};
    const ava = p.avatar
        ? `<div class="rating-best-ava-wrap">${playerAvatarFrameHtml(p.avatar, {
              fill: p.club ? clubAvatarFill(p.club, clubsCatalog) : null,
              width: 52,
              height: 52,
              alt: p.name,
              className: "player-avatar-frame--best"
          })}</div>`
        : `<span class="rating-best-ava rating-best-ava--ph" aria-hidden="true">👤</span>`;
    const me = p.isMe || o.isMe ? " rating-best-player--me" : "";
    return (
        `<article class="rating-best-player${me}">` +
        ava +
        `<div class="rating-best-player-body">` +
        `<p class="rating-best-player-name">${playerNameHtml(p.name, p.email)} <span class="rating-best-player-lvl">[${p.level}]</span></p>` +
        `<p class="rating-best-stat rating-best-stat--place">Место: <b>${formatRatingNum(p.place ?? p.position)}</b></p>` +
        `<p class="rating-best-stat">Репутация: <b>${formatRatingNum(p.reputation)}</b> ${repIco()}</p>` +
        `</div></article>`
    );
}

function renderTopBestPager(page, totalPages) {
    if (totalPages <= 1) {
        return "";
    }

    const windowSize = 5;
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end = start + windowSize - 1;
    if (end > totalPages) {
        end = totalPages;
        start = Math.max(1, end - windowSize + 1);
    }

    let nums = "";
    if (start > 1) {
        nums += `<button type="button" class="rating-best-page-num" data-page="1">1</button>`;
        if (start > 2) nums += `<span class="rating-best-page-gap">…</span>`;
    }
    for (let n = start; n <= end; n += 1) {
        nums += `<button type="button" class="rating-best-page-num${n === page ? " is-active" : ""}" data-page="${n}">${n}</button>`;
    }
    if (end < totalPages) {
        if (end < totalPages - 1) nums += `<span class="rating-best-page-gap">…</span>`;
        nums += `<button type="button" class="rating-best-page-num" data-page="${totalPages}">${totalPages}</button>`;
    }

    const nextPage = Math.min(totalPages, page + 1);
    return (
        `<nav class="rating-best-pager" aria-label="Страницы рейтинга">` +
        `<div class="rating-best-pager-inner">` +
        nums +
        (page < totalPages
            ? `<button type="button" class="rating-best-page-next" data-page="${nextPage}">Следующая</button>`
            : "") +
        `</div></nav>`
    );
}

async function renderRatingBestCards(apiPath, email, rootEl, opts) {
    const o = opts || {};
    const state = { email, page: 1, clubsCatalog: null };

    async function loadPage(page) {
        state.page = Math.max(1, Math.floor(Number(page) || 1));
        const res = await fetch(
            apiPath +
                "?email=" +
                encodeURIComponent(state.email) +
                "&page=" +
                encodeURIComponent(String(state.page))
        );
        const data = await res.json();
        if (!data.success) {
            rootEl.innerHTML = `<p class="rating-mock-tag">${escapeHtmlRating(data.error || "Не удалось загрузить рейтинг.")}</p>`;
            return;
        }

        if (!state.clubsCatalog) {
            state.clubsCatalog = await loadClubsCatalog();
        }

        let html = "";
        if (data.me) {
            html +=
                `<section class="rating-best-me" aria-label="Ваше место в рейтинге">` +
                renderTopBestPlayerRow(data.me, state.clubsCatalog, { isMe: true }) +
                `</section>`;
        }

        const players = data.players || [];
        const emptyText =
            o.emptyText ||
            (typeof data.level === "number"
                ? `Пока нет других игроков ${data.level} уровня.`
                : "Пока нет других игроков в рейтинге.");
        html +=
            `<section class="rating-best-list-wrap" aria-label="ТОП игроков">` +
            `<div class="rating-best-players">` +
            (players.length
                ? players.map((p) => renderTopBestPlayerRow(p, state.clubsCatalog)).join("")
                : `<p class="rating-best-empty">${escapeHtmlRating(emptyText)}</p>`) +
            `</div>` +
            renderTopBestPager(data.page || 1, data.totalPages || 1) +
            `</section>`;

        rootEl.innerHTML = html;

        const pager = rootEl.querySelector(".rating-best-pager");
        if (pager && !pager.dataset.bound) {
            pager.dataset.bound = "1";
            pager.addEventListener("click", (e) => {
                const btn = e.target.closest("[data-page]");
                if (!btn) return;
                loadPage(btn.getAttribute("data-page"));
            });
        }
    }

    rootEl.innerHTML = `<p class="rating-mock-tag">Загрузка рейтинга…</p>`;
    await loadPage(
        Math.max(1, Math.floor(Number(new URLSearchParams(window.location.search).get("page")) || 1))
    );
}

async function renderTopBest(email, rootEl) {
    return renderRatingBestCards("/rating/top-best", email, rootEl);
}

async function renderLevelBest(email, rootEl) {
    return renderRatingBestCards("/rating/level-best", email, rootEl);
}
