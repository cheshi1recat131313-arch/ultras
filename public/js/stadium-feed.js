/** Лента матча стадиона — компактный стиль Hools + пагинация. */

const STADIUM_FEED_PER_PAGE = 14;

function escapeFeedHtml(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
}

function feedClubIcon(match, clubId) {
    const src = match?.clubEmblems?.[clubId] || "";
    if (!src) return "";
    return `<img class="stadium-feed-club-ico" src="${escapeFeedHtml(src)}" width="12" height="12" alt="">`;
}

function feedFighterClickable(match, fighterClub) {
    return !!(
        match?.feedTargetLinks &&
        fighterClub &&
        match.viewerEnemyClub &&
        fighterClub === match.viewerEnemyClub
    );
}

function feedPlayerName(name, clubId, match, fighterId, email) {
    const icon = feedClubIcon(match, clubId);
    const playerEmail =
        email ||
        (typeof playerEmailFromFighterId === "function" ? playerEmailFromFighterId(fighterId) : "");
    if (playerEmail && typeof playerNameHtml === "function") {
        return `${icon}${playerNameHtml(name, playerEmail, { className: "player-link stadium-feed-name" })}`;
    }
    const n = escapeFeedHtml(name || "");
    return `${icon}<span class="stadium-feed-name">${n}</span>`;
}

function renderInlineParts(inline) {
    if (!Array.isArray(inline) || !inline.length) return "";
    return inline
        .map((part) => {
            if (part.type === "effect") {
                return ` <span class="stadium-feed-effect">${escapeFeedHtml(part.text)}</span>`;
            }
            if (part.type === "talisman") {
                const tk = part.talismanKind || "";
                const colorClass =
                    tk === "talisman_neo"
                        ? " stadium-feed-talisman--neo"
                        : tk === "talisman_klitschko"
                          ? " stadium-feed-talisman--klitschko"
                          : "";
                return (
                    ` <strong class="stadium-feed-talisman${colorClass}">Сработал талисман: «${escapeFeedHtml(part.label)}»</strong>`
                );
            }
            return "";
        })
        .join("");
}

function embedPlayerNames(text, entry, match) {
    const att = entry.attackerName;
    const def = entry.defenderName;
    if (!att || !def || !text.includes(att) || !text.includes(def)) {
        return escapeFeedHtml(text);
    }
    let marked = text;
    if (marked.includes(att)) marked = marked.split(att).join("\0ATT\0");
    if (marked.includes(def)) marked = marked.split(def).join("\0DEF\0");
    const parts = marked.split(/(\0ATT\0|\0DEF\0)/);
    let html = "";
    for (const p of parts) {
        if (p === "\0ATT\0") {
            html += feedPlayerName(att, entry.attackerClub, match, entry.attackerId, entry.attackerEmail);
        } else if (p === "\0DEF\0") {
            html += feedPlayerName(def, entry.defenderClub, match, entry.defenderId, entry.defenderEmail);
        } else html += escapeFeedHtml(p);
    }
    return html;
}

function formatStadiumFeedLine(entry, match, rowIndex) {
    const kind = String(entry?.kind || "");
    const alt = rowIndex % 2 === 0 ? " stadium-feed-line--alt" : "";
    const baseHtml = embedPlayerNames(entry.text || "", entry, match);
    const inlineHtml = renderInlineParts(entry.inline);
    const extraClass =
        kind === "hit_dodge"
            ? " stadium-feed-line--dodge"
            : kind === "hit_series" || kind === "ko_series"
              ? " stadium-feed-line--series"
              : kind === "talisman_klitschko" || kind === "hit_klitschko"
                ? " stadium-feed-line--klitschko"
                : kind === "sys"
                  ? " stadium-feed-line--sys"
                  : "";

    return `<p class="stadium-feed-line${alt}${extraClass}">${baseHtml}${inlineHtml}</p>`;
}

function buildFeedPagerHtml(page, totalPages) {
    if (totalPages <= 1) {
        return `<div class="stadium-feed-pager stadium-feed-pager--single">Страница 1/1</div>`;
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
        nums += `<button type="button" class="stadium-feed-page${p === page ? " is-active" : ""}" data-page="${p}">${p}</button>`;
    }

    return (
        `<div class="stadium-feed-pager">` +
        `<button type="button" class="stadium-feed-nav" data-page="1" title="Первая">|&lt;</button>` +
        `<button type="button" class="stadium-feed-nav" data-page="${Math.max(1, page - 1)}" title="Назад">&lt;</button>` +
        nums +
        `<button type="button" class="stadium-feed-nav" data-page="${Math.min(totalPages, page + 1)}" title="Вперёд">&gt;</button>` +
        `<button type="button" class="stadium-feed-nav" data-page="${totalPages}" title="Последняя">&gt;|</button>` +
        `<span class="stadium-feed-page-label">Страница ${page}/${totalPages}</span>` +
        `</div>`
    );
}

function tribunesUrlForFighter(match, fighterId) {
    if (!match?.id || !fighterId) return "/stadium-tribunes.html";
    return (
        `/stadium-tribunes.html?matchId=${encodeURIComponent(match.id)}` +
        `&targetId=${encodeURIComponent(fighterId)}`
    );
}

function getFeedUi(stateKey, totalPages) {
    if (!window[stateKey]) {
        window[stateKey] = { page: totalPages, lastCount: 0, onLivePage: true };
    }
    return window[stateKey];
}

/** Актуальная страница ленты (последняя — самые новые события). */
function isStadiumFeedLivePage(stateKey, lineCount) {
    const totalPages = Math.max(1, Math.ceil((lineCount || 0) / STADIUM_FEED_PER_PAGE));
    const ui = window[stateKey];
    if (!ui) return true;
    return ui.onLivePage !== false && ui.page === totalPages;
}

function getFeedScrollEl(el, opts = {}) {
    if (opts.scrollEl) return opts.scrollEl;
    if (!el) return null;
    return el.closest(".stadium-feed-wrap") || el.parentElement;
}

function readFeedScroll(scrollEl) {
    if (scrollEl && scrollEl.scrollHeight > scrollEl.clientHeight + 2) {
        return {
            scrollTop: scrollEl.scrollTop,
            atBottom: scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 6
        };
    }
    const doc = document.documentElement;
    return {
        scrollTop: window.scrollY,
        atBottom: window.innerHeight + window.scrollY >= doc.scrollHeight - 12
    };
}

function restoreFeedScroll(scrollEl, scrollTop) {
    if (scrollEl && scrollEl.scrollHeight > scrollEl.clientHeight + 2) {
        scrollEl.scrollTop = scrollTop;
        return;
    }
    window.scrollTo(0, scrollTop);
}

function bindFeedFighterClicks(el, match, opts = {}) {
    if (!el || !match?.feedTargetLinks) return;
    if (el.dataset.fighterClicksBound) return;
    el.dataset.fighterClicksBound = "1";
    el.addEventListener("click", (e) => {
        const btn = e.target.closest(".stadium-feed-name-btn[data-fighter-id]");
        if (!btn) return;
        e.preventDefault();
        const fighterId = btn.getAttribute("data-fighter-id");
        if (!fighterId) return;
        if (typeof opts.onFighterClick === "function") {
            opts.onFighterClick(fighterId);
            return;
        }
        window.location.href = tribunesUrlForFighter(match, fighterId);
    });
}

function mountFeedPager(pagerEl, el, match, opts, ui, page, totalPages) {
    if (!pagerEl) return;
    pagerEl.innerHTML = buildFeedPagerHtml(page, totalPages);
    delete pagerEl.dataset.bound;
    bindFeedPager(pagerEl, (p) => {
        ui.page = p;
        ui.onLivePage = p === totalPages;
        renderStadiumFeed(el, match, { ...opts, page: p, preserveScroll: true });
    });
}

function bindFeedPager(pagerEl, onPage) {
    if (!pagerEl || pagerEl.dataset.bound) return;
    pagerEl.dataset.bound = "1";
    pagerEl.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-page]");
        if (!btn) return;
        const p = Math.max(1, Math.floor(Number(btn.getAttribute("data-page")) || 1));
        onPage(p);
    });
}

/**
 * @param {HTMLElement} el — контейнер строк ленты
 * @param {object} match — payload матча
 * @param {{ pagerId?: string, page?: number, preserveScroll?: boolean }} opts
 */
function renderStadiumFeed(el, match, opts = {}) {
    const pagerEl = document.getElementById(opts.pagerId || "stadiumFeedPager");
    const stateKey = opts.stateKey || "stadiumFeedUi";
    const scrollEl = getFeedScrollEl(el, opts);
    const scrollBefore = opts.preserveScroll ? readFeedScroll(scrollEl) : null;

    if (!el) return 0;

    if (!match?.feedEnabled) {
        el.className = "stadium-feed stadium-feed--idle";
        const msg =
            match?.status === "scheduled" && match.countdownLabel
                ? `До начала матча осталось ${match.countdownLabel}` +
                  (match.startsAtLabel ? ` · начало ${match.startsAtLabel}` : "")
                : match?.feedPlaceholder || "Матч ещё не начался";
        el.innerHTML = `<p class="stadium-feed-idle-msg">${escapeFeedHtml(msg)}</p>`;
        if (pagerEl) pagerEl.innerHTML = "";
        delete el.dataset.fighterClicksBound;
        window[stateKey] = { page: 1, lastCount: 0, onLivePage: true };
        return 0;
    }

    el.className = "stadium-feed";
    const lines = match.feed || [];
    const totalPages = Math.max(1, Math.ceil(lines.length / STADIUM_FEED_PER_PAGE));
    const ui = getFeedUi(stateKey, totalPages);

    if (opts.page != null) {
        ui.page = Math.max(1, Math.min(totalPages, opts.page));
        ui.onLivePage = ui.page === totalPages;
    } else if (ui.page > totalPages) {
        ui.page = totalPages;
        ui.onLivePage = true;
    } else if (ui.onLivePage) {
        ui.page = totalPages;
    }

    if (!lines.length) {
        el.innerHTML = "";
        if (pagerEl) pagerEl.innerHTML = "";
        ui.lastCount = 0;
        return 0;
    }

    const page = ui.page;
    const start = (page - 1) * STADIUM_FEED_PER_PAGE;
    const slice = lines.slice(start, start + STADIUM_FEED_PER_PAGE);

    el.innerHTML = slice.map((line, i) => formatStadiumFeedLine(line, match, i)).join("");
    delete el.dataset.fighterClicksBound;
    bindFeedFighterClicks(el, match, opts);
    mountFeedPager(pagerEl, el, match, opts, ui, page, totalPages);

    ui.lastCount = lines.length;

    if (scrollBefore && !scrollBefore.atBottom) {
        restoreFeedScroll(scrollEl, scrollBefore.scrollTop);
    }

    return lines.length;
}

/**
 * Добавляет только новые строки на актуальной странице ленты (без полной перерисовки).
 */
function patchStadiumFeed(el, match, opts = {}) {
    const pagerEl = document.getElementById(opts.pagerId || "stadiumFeedPager");
    const stateKey = opts.stateKey || "stadiumFeedUi";

    if (!el || !match?.feedEnabled) {
        return renderStadiumFeed(el, match, opts);
    }

    const lines = match.feed || [];
    const totalPages = Math.max(1, Math.ceil(lines.length / STADIUM_FEED_PER_PAGE));
    const ui = getFeedUi(stateKey, totalPages);

    if (!isStadiumFeedLivePage(stateKey, lines.length)) {
        return lines.length;
    }

    if (ui.page > totalPages) {
        ui.page = totalPages;
        ui.onLivePage = true;
    }

    const scrollEl = getFeedScrollEl(el, opts);
    const scrollBefore = readFeedScroll(scrollEl);
    const prevCount = ui.lastCount;
    const page = totalPages;
    ui.page = page;
    ui.onLivePage = true;

    if (!lines.length || prevCount === 0 || el.childElementCount === 0 || lines.length < prevCount) {
        return renderStadiumFeed(el, match, { ...opts, page, preserveScroll: !scrollBefore.atBottom });
    }

    if (lines.length === prevCount) {
        return lines.length;
    }

    const start = (page - 1) * STADIUM_FEED_PER_PAGE;
    const sliceEnd = Math.min(lines.length, start + STADIUM_FEED_PER_PAGE);
    const newOnPage = lines.length - Math.max(prevCount, start);

    if (newOnPage > STADIUM_FEED_PER_PAGE || lines.length - prevCount > STADIUM_FEED_PER_PAGE) {
        return renderStadiumFeed(el, match, {
            ...opts,
            page,
            preserveScroll: !scrollBefore.atBottom
        });
    }

    for (let i = Math.max(prevCount, start); i < sliceEnd; i += 1) {
        const rowIndex = i - start;
        el.insertAdjacentHTML("beforeend", formatStadiumFeedLine(lines[i], match, rowIndex));
    }

    while (el.childElementCount > STADIUM_FEED_PER_PAGE) {
        el.removeChild(el.firstElementChild);
    }

    Array.from(el.children).forEach((node, idx) => {
        node.classList.toggle("stadium-feed-line--alt", idx % 2 === 0);
    });

    ui.lastCount = lines.length;
    mountFeedPager(pagerEl, el, match, opts, ui, page, totalPages);

    if (scrollBefore.atBottom) {
        if (scrollEl && scrollEl.scrollHeight > scrollEl.clientHeight + 2) {
            scrollEl.scrollTop = scrollEl.scrollHeight;
        }
    } else {
        restoreFeedScroll(scrollEl, scrollBefore.scrollTop);
    }

    return lines.length;
}

if (typeof window !== "undefined") {
    window.STADIUM_FEED_PER_PAGE = STADIUM_FEED_PER_PAGE;
    window.formatStadiumFeedLine = formatStadiumFeedLine;
    window.renderStadiumFeed = renderStadiumFeed;
    window.patchStadiumFeed = patchStadiumFeed;
    window.isStadiumFeedLivePage = isStadiumFeedLivePage;
}
