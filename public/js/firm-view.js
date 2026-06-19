(async () => {
    const user = await fetchUser();
    if (!user) return;
    renderHeaderBlock(user);

    const root = document.getElementById("firmViewRoot");
    if (!root) return;

    const esc = firmsUi.escapeFirmHtml;
    const params = new URLSearchParams(window.location.search);
    const firmId = (params.get("firmId") || "").trim();

    if (!firmId) {
        root.innerHTML = `<p class="firms-msg firms-msg--err">Не указана фирма.</p>`;
        return;
    }

    try {
        const res = await fetch(`/firms/catalog/${encodeURIComponent(firmId)}`);
        const data = await res.json();
        if (!data.success || !data.firm) {
            root.innerHTML = `<p class="firms-msg firms-msg--err">${esc(data.error || "Фирма не найдена")}</p>`;
            return;
        }

        const firm = data.firm;
        const inThisFirm = user.firmId === firm.id || user.firm === firm.id;
        const joinBlock =
            !inThisFirm && !user.firm
                ? `<div class="firm-view-actions">` +
                  `<button type="button" class="firms-btn" id="firmViewJoinBtn">Вступить в фирму</button>` +
                  `</div>`
                : inThisFirm
                  ? `<p class="firms-msg firms-msg--ok">Ты состоишь в этой фирме. <a href="/firm.html">Открыть мою фирму</a></p>`
                  : "";

        root.innerHTML =
            firmsUi.renderFirmHubCard(
                {
                    ...firm,
                    menu: [
                        {
                            id: "my",
                            label: "Моя фирма",
                            icon: "/static/location/index/firms.png",
                            href: "/firm.html",
                            stub: false
                        }
                    ]
                },
                { showViewerRank: false }
            ) + joinBlock;

        document.getElementById("firmViewJoinBtn")?.addEventListener("click", async () => {
            const { ok, data: joinData } = await postJson("/firms/join", { email: user.email, firmId });
            if (!ok) {
                alert(joinData?.error || "Не удалось вступить.");
                return;
            }
            window.location.href = "/firm.html";
        });
    } catch (e) {
        root.innerHTML = `<p class="firms-msg firms-msg--err">${esc(e.message)}</p>`;
    }
})();
