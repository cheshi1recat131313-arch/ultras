(async () => {
    const user = await fetchUser();
    if (!user) return;
    renderHeaderBlock(user);

    const root = document.getElementById("firmsCatalogRoot");
    const searchInput = document.getElementById("firmsSearch");
    if (!root) return;

    const esc = firmsUi.escapeFirmHtml;

    async function loadCatalog(query) {
        const q = String(query || "").trim();
        const url = q ? `/firms/catalog?q=${encodeURIComponent(q)}` : "/firms/catalog";
        root.innerHTML = `<p class="firms-msg">Загрузка…</p>`;
        try {
            const res = await fetch(url);
            const data = await res.json();
            if (!data.success) {
                root.innerHTML = `<p class="firms-msg firms-msg--err">${esc(data.error || "Ошибка каталога")}</p>`;
                return;
            }
            const firms = data.firms || [];
            if (!firms.length) {
                root.innerHTML = `<p class="firms-msg firms-msg--ok">${q ? "Ничего не найдено." : "Пока фирм нет — будь первым."}</p>`;
                return;
            }
            root.innerHTML = `<div class="firms-catalog-list">${firms.map((f) => firmsUi.renderCatalogCard(f)).join("")}</div>`;
        } catch (e) {
            root.innerHTML = `<p class="firms-msg firms-msg--err">${esc(e.message)}</p>`;
        }
    }

    let searchTimer = null;
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => loadCatalog(searchInput.value), 250);
        });
    }

    await loadCatalog("");
})();
