/** Касса стадиона — билеты на матчи своего клуба (неделя вперёд). */

async function loadKassa(email) {
    const res = await fetch(`/stadium/kassa/info?email=${encodeURIComponent(email)}`);
    return res.json();
}

function renderKassaMatchRow(item) {
    const buyBlock = item.hasTicket
        ? `<p class="stadium-kassa-owned">🎟 Билет куплен</p>`
        : item.canBuy
          ? `<button type="button" class="stadium-kassa-buy stadium-kassa-buy--row" data-match-id="${stadiumEscapeHtml(item.matchId)}">Купить билет</button>`
          : `<p class="stadium-kassa-meta stadium-kassa-warn">Покупка недоступна</p>`;

    return (
        `<article class="stadium-kassa-row" data-match-id="${stadiumEscapeHtml(item.matchId)}">` +
        `<div class="stadium-kassa-row-match">${stadiumRenderClubMatchLine(item)}</div>` +
        `<p class="stadium-kassa-row-time">${stadiumEscapeHtml(item.startsAtLabel)}</p>` +
        `<p class="stadium-kassa-row-price">Стоимость: ${stadiumDollarPriceHtml(item.ticketCost)}</p>` +
        buyBlock +
        `</article>`
    );
}

function renderKassa(card, data) {
    const k = data.kassa;
    if (!k || !k.ok) {
        card.innerHTML = `<p class="district-empty">${stadiumEscapeHtml(data.error || "Нет данных")}</p>`;
        return;
    }

    const matches = Array.isArray(k.matches) ? k.matches : [];
    if (!matches.length) {
        card.innerHTML = `<p class="district-empty">Нет матчей твоего клуба на ближайшую неделю.</p>`;
        return;
    }

    card.innerHTML =
        `<p class="stadium-kassa-ticket">🎟 ${stadiumEscapeHtml(k.ticketLabel || "Билеты")}</p>` +
        `<p class="stadium-kassa-meta">Ближайшие матчи (до ${matches.length})</p>` +
        `<div class="stadium-kassa-list">${matches.map(renderKassaMatchRow).join("")}</div>` +
        `<a class="stadium-kassa-link item" href="/stadium-schedule.html">Перейти в расписание</a>`;

    card.querySelectorAll(".stadium-kassa-buy--row").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const matchId = btn.getAttribute("data-match-id");
            const email = (await fetchUser())?.email;
            if (!email || !matchId) return;
            btn.disabled = true;
            const { ok, data: resp } = await postJson("/stadium/kassa/buy", { email, matchId });
            if (typeof showMsg === "function") {
                showMsg(ok ? resp?.message || "Билет куплен." : resp?.error || "Не удалось купить", !ok);
            } else if (!ok) {
                alert(resp?.error || "Не удалось купить");
            }
            btn.disabled = false;
            if (!ok) return;
            const again = await loadKassa(email);
            if (again.success) renderKassa(card, again);
        });
    });
}

(async () => {
    const user = await fetchUser();
    if (!user) return;
    renderHeaderBlock(user);

    const card = document.getElementById("stadiumKassaCard");
    if (!card) return;

    if (!user.club) {
        card.innerHTML = '<p class="district-empty">Сначала выбери клуб в профиле.</p>';
        return;
    }

    try {
        const data = await loadKassa(user.email);
        if (!data.success) {
            card.innerHTML = `<p class="district-empty">${stadiumEscapeHtml(data.error)}</p>`;
            return;
        }
        renderKassa(card, data);
    } catch (e) {
        card.innerHTML = `<p class="district-empty">${stadiumEscapeHtml(e.message)}</p>`;
    }
})();
