/** «Лучшие бойцы» матча — список как в Hools, 10 на страницу. */

function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
}

const state = { email: "", matchId: "", page: 1, clubsCatalog: null };

function repIco(src) {
    return `<img class="stadium-best-rep-ico" src="${escapeHtml(src || "/static/icons/rep.png")}" width="14" height="14" alt="">`;
}

function renderPlayerRow(p, repIcon) {
    const fill = p.club ? clubAvatarFill(p.club, state.clubsCatalog) : null;
    const ava = p.avatar
        ? `<div class="stadium-best-ava-wrap">${playerAvatarFrameHtml(p.avatar, {
              fill,
              width: 52,
              height: 52,
              alt: p.name
          })}</div>`
        : fighterAvatarHtml(p, state.clubsCatalog, {
              width: 52,
              height: 52,
              wrapClass: "stadium-best-ava-wrap",
              frameClass: "player-avatar-frame--best"
          });
    const me = p.isMe ? " stadium-best-player--me" : "";
    return (
        `<article class="stadium-best-player${me}">` +
        ava +
        `<div class="stadium-best-player-body">` +
        `<p class="stadium-best-player-name">${playerNameHtml(p.name, p.email && !p.isBot ? p.email : null)} <span class="stadium-best-player-lvl">[${p.level}]</span></p>` +
        `<p class="stadium-best-stat">Репутация: <b>${escapeHtml(String(p.rep))}</b> ${repIco(repIcon)}</p>` +
        `<p class="stadium-best-stat">Снесённое HP: <b>${escapeHtml(String(p.damage))}</b></p>` +
        `<p class="stadium-best-stat">Вынес соперников: <b>${escapeHtml(String(p.kos))}</b></p>` +
        `</div></article>`
    );
}

function renderPager(page, totalPages) {
    const el = document.getElementById("stadiumBestPager");
    if (!el) return;
    if (totalPages <= 1) {
        el.innerHTML = "";
        el.hidden = true;
        return;
    }
    el.hidden = false;

    const windowSize = 5;
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end = start + windowSize - 1;
    if (end > totalPages) {
        end = totalPages;
        start = Math.max(1, end - windowSize + 1);
    }

    let nums = "";
    if (start > 1) {
        nums += `<button type="button" class="stadium-best-page-num" data-page="1">1</button>`;
        if (start > 2) nums += `<span class="stadium-best-page-gap">…</span>`;
    }
    for (let n = start; n <= end; n += 1) {
        nums += `<button type="button" class="stadium-best-page-num${n === page ? " is-active" : ""}" data-page="${n}">${n}</button>`;
    }
    if (end < totalPages) {
        if (end < totalPages - 1) nums += `<span class="stadium-best-page-gap">…</span>`;
        nums += `<button type="button" class="stadium-best-page-num" data-page="${totalPages}">${totalPages}</button>`;
    }

    const nextPage = Math.min(totalPages, page + 1);
    el.innerHTML =
        `<div class="stadium-best-pager-inner">` +
        nums +
        (page < totalPages
            ? `<button type="button" class="stadium-best-page-next" data-page="${nextPage}">Следующая</button>`
            : "") +
        `</div>`;

    if (!el.dataset.bound) {
        el.dataset.bound = "1";
        el.addEventListener("click", (e) => {
            const btn = e.target.closest("[data-page]");
            if (!btn) return;
            loadPage(Math.max(1, Math.floor(Number(btn.getAttribute("data-page")) || 1)));
        });
    }
}

function paint(best) {
    const list = document.getElementById("stadiumBestList");
    const empty = document.getElementById("stadiumBestEmpty");
    const matchEl = document.getElementById("stadiumBestMatch");
    const back = document.getElementById("stadiumBestBack");

    if (matchEl) {
        matchEl.textContent = best.matchVsLabel
            ? `${best.matchVsLabel} · стр. ${best.page}/${best.totalPages}`
            : "";
    }

    const players = best.players || [];
    if (list) {
        list.innerHTML = players.length
            ? players.map((p) => renderPlayerRow(p, best.repIcon)).join("")
            : "";
    }
    if (empty) empty.hidden = players.length > 0;
    renderPager(best.page || 1, best.totalPages || 1);

    if (back && best.matchId) {
        back.href = "/stadium-schedule.html?matchId=" + encodeURIComponent(best.matchId);
    }
}

async function loadPage(page) {
    state.page = page;
    const q =
        `?email=${encodeURIComponent(state.email)}` +
        (state.matchId ? `&matchId=${encodeURIComponent(state.matchId)}` : "") +
        `&page=${page}`;
    const res = await fetch("/stadium/best-fighters" + q);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Ошибка");
    if (data.user) renderHeaderBlock(data.user);
    paint(data.best);
}

(async () => {
    const user = await fetchUser();
    if (!user) return;
    renderHeaderBlock(user);
    state.email = user.email;
    state.clubsCatalog = await loadClubsCatalog();

    const params = new URLSearchParams(location.search);
    state.matchId = params.get("matchId") || "";
    state.page = Math.max(1, Math.floor(Number(params.get("page")) || 1));

    try {
        await loadPage(state.page);
    } catch (e) {
        const list = document.getElementById("stadiumBestList");
        if (list) list.innerHTML = `<p class="district-empty">${escapeHtml(e.message)}</p>`;
    }
})();
