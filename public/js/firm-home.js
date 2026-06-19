(async () => {
    const user = await fetchUser();
    if (!user) return;
    renderHeaderBlock(user);

    const root = document.getElementById("firmHomeRoot");
    if (!root) return;

    const esc = firmsUi.escapeFirmHtml;

    function renderNoFirm(config) {
        const minLevel = config?.minLevel ?? 3;
        const costDollars = config?.createCostDollars ?? 100;
        const costMushrooms = config?.createCostMushrooms ?? 100;
        root.innerHTML =
            `<div class="firm-empty">` +
            `<p class="firm-empty-lead">Ты пока не состоишь в фирме.</p>` +
            `<p class="firm-empty-desc">Создай свою или вступи в существующую через каталог.</p>` +
            `<nav class="firm-empty-actions">` +
            `<a class="firm-empty-btn" href="/firms-create.html">Создать фирму</a>` +
            `<a class="firm-empty-btn firm-empty-btn--ghost" href="/firms.html">Каталог фирм</a>` +
            `</nav>` +
            `<p class="firm-empty-note">Создание доступно с ${esc(String(minLevel))} уровня. Стоимость: ${esc(String(costDollars))} $ или ${esc(String(costMushrooms))} грибов.</p>` +
            `<div class="firm-join-box">` +
            `<label class="firm-join-label" for="firmJoinId">Вступить по id фирмы</label>` +
            `<div class="firm-join-row">` +
            `<input class="firms-input" id="firmJoinId" placeholder="firm_example">` +
            `<button class="firms-btn" type="button" id="firmJoinBtn">Вступить</button>` +
            `</div>` +
            `<p class="firm-join-hint" id="firmJoinMsg"></p>` +
            `</div>` +
            `</div>`;

        document.getElementById("firmJoinBtn")?.addEventListener("click", async () => {
            const firmId = (document.getElementById("firmJoinId")?.value || "").trim();
            const msg = document.getElementById("firmJoinMsg");
            if (!firmId) {
                if (msg) msg.textContent = "Укажи id фирмы из каталога.";
                return;
            }
            const { ok, data } = await postJson("/firms/join", { email: user.email, firmId });
            if (!ok) {
                if (msg) msg.textContent = data?.error || "Не удалось вступить.";
                return;
            }
            window.location.reload();
        });
    }

    async function leaveFirm() {
        if (!confirm("Выйти из фирмы?")) return;
        const { ok, data } = await postJson("/firms/leave", { email: user.email });
        if (!ok) {
            alert(data?.error || "Не удалось выйти из фирмы.");
            return;
        }
        window.location.reload();
    }

    try {
        const res = await fetch(`/firm/me?email=${encodeURIComponent(user.email)}`);
        const data = await res.json();
        if (!data.success) {
            root.innerHTML = `<p class="firms-msg firms-msg--err">${esc(data.error || "Ошибка раздела")}</p>`;
            return;
        }
        if (!data.hasFirm || !data.firm) {
            renderNoFirm(data.config);
            return;
        }

        root.innerHTML =
            firmsUi.renderFirmHubCard(data.firm, { showViewerRank: true }) +
            `<div class="firm-home-actions">` +
            `<button type="button" class="firm-leave-btn" id="firmLeaveBtn">Покинуть фирму</button>` +
            `</div>`;
        document.getElementById("firmLeaveBtn")?.addEventListener("click", leaveFirm);
    } catch (e) {
        root.innerHTML = `<p class="firms-msg firms-msg--err">${esc(e.message)}</p>`;
    }
})();
