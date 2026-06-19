/** Архив газеты «Третий тайм» (~100 выпусков). */

function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
}

let state = { email: "", page: 1 };

function renderPager(page, totalPages) {
    const el = document.getElementById("gazetaPager");
    if (!el) return;
    if (totalPages <= 1) {
        el.innerHTML = `<span class="mail-gazeta-pager-label">Страница 1/1</span>`;
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
        nums += `<button type="button" class="gazeta-page${p === page ? " is-active" : ""}" data-page="${p}">${p}</button>`;
    }
    el.innerHTML =
        `<button type="button" class="gazeta-page" data-page="1">|&lt;</button>` +
        `<button type="button" class="gazeta-page" data-page="${Math.max(1, page - 1)}">&lt;</button>` +
        nums +
        `<button type="button" class="gazeta-page" data-page="${Math.min(totalPages, page + 1)}">&gt;</button>` +
        `<button type="button" class="gazeta-page" data-page="${totalPages}">&gt;|</button>` +
        `<span class="mail-gazeta-pager-label">Страница ${page}/${totalPages}</span>`;

    if (!el.dataset.bound) {
        el.dataset.bound = "1";
        el.addEventListener("click", (e) => {
            const btn = e.target.closest("[data-page]");
            if (!btn) return;
            const p = Math.max(1, Math.floor(Number(btn.getAttribute("data-page")) || 1));
            loadPage(p);
        });
    }
}

function renderList(issues) {
    const root = document.getElementById("gazetaList");
    if (!root) return;
    if (!issues.length) {
        root.innerHTML =
            '<p class="mail-empty" style="padding:14px;color:#444;">Пока нет выпусков. После матча стадиона здесь появится отчёт.</p>';
        return;
    }
    root.innerHTML = issues
        .map(
            (it) =>
                `<a class="mail-gazeta-item" href="/mail-gazeta-view.html?id=${encodeURIComponent(it.id)}">` +
                `<p class="mail-gazeta-item-title">${escapeHtml(it.matchLabel || "Матч")}</p>` +
                `<p class="mail-gazeta-item-meta">${escapeHtml(it.datetime || "")}` +
                (it.winnerClubName ? ` · ${escapeHtml(it.winnerClubName)}` : "") +
                `</p></a>`
        )
        .join("");
}

async function loadPage(page) {
    state.page = page;
    const res = await fetch(
        `/api/mail/gazeta?email=${encodeURIComponent(state.email)}&page=${page}`
    );
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Ошибка");
    renderList(data.issues || []);
    renderPager(data.page || 1, data.totalPages || 1);
}

(async () => {
    const user = await fetchUser();
    if (!user) return;
    renderHeaderBlock(user);
    state.email = user.email;
    const params = new URLSearchParams(location.search);
    const p = Math.max(1, Math.floor(Number(params.get("page")) || 1));
    try {
        await loadPage(p);
    } catch (e) {
        const root = document.getElementById("gazetaList");
        if (root) root.innerHTML = `<p class="mail-empty">${escapeHtml(e.message)}</p>`;
    }
})();
