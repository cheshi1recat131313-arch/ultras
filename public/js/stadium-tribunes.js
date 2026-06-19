/** Фан-сектор — выбор противника и удар (как в Hools). */



function escapeHtml(s) {

    const d = document.createElement("div");

    d.textContent = s == null ? "" : String(s);

    return d.innerHTML;

}



let state = { match: null, gadgets: [], email: "", playerRage: 100, clubsCatalog: null };



function scheduleUrl() {

    const id = state.match?.id;

    return id ? `/stadium-schedule.html?matchId=${encodeURIComponent(id)}` : "/stadium-schedule.html";

}



function renderOpponents(opponents, match) {

    const root = document.getElementById("stadiumOpponents");

    if (!root) return;

    root.innerHTML = "";



    if (match.status !== "live") {

        root.innerHTML = '<p class="district-empty">Бой начнётся после старта матча.</p>';

        return;

    }

    if (!match.hasTicket) {

        root.innerHTML = '<p class="district-empty">Купи билет в <a href="/stadium-kassa.html">кассе</a>.</p>';

        return;

    }

    if (match.playerEliminated || match.playerFighter?.alive === false) {

        root.innerHTML =
            '<p class="district-empty">Ты выбыл из боя. Смотри <a href="' +
            escapeHtml(scheduleUrl()) +
            '">ленту матча</a> и лучших бойцов.</p>';

        return;

    }

    if (!match.playerCanFight) {

        root.innerHTML =
            '<p class="district-empty">Бой недоступен. <a href="' +
            escapeHtml(scheduleUrl()) +
            '">Вернуться к матчу</a>.</p>';

        return;

    }

    if (!opponents.length) {

        root.innerHTML = '<p class="district-empty">Нет целей — нажми «Искать ещё».</p>';

        return;

    }



    const rage = state.playerRage ?? match.playerRage ?? 0;

    const canNormal = rage >= 60;
    const canStrong = rage >= 100;



    opponents.forEach((o) => {

        const ava = fighterAvatarHtml(o, state.clubsCatalog, {
            width: 56,
            height: 56
        });

        const card = document.createElement("div");

        card.className = "bot-card stadium-battle-card";

        card.innerHTML =

            ava +

            `<div class="bot-info">` +

            `<div class="stadium-opp-head">` +

            `<span class="stadium-opp-name">${playerNameHtml(o.name, o.email && !o.isBot ? o.email : null)}</span>` +

            `<span class="stadium-opp-meta">[ ${o.level} ] ( ${Math.round(o.hp)} ❤️ )</span>` +

            `</div>` +

            `<p class="stadium-opp-fury">Ярость: ${Math.round(o.fury ?? 0)}/${o.maxFury ?? 100}</p>` +

            `<div class="stadium-battle-actions">` +

            `<div class="kick-row">` +

            `<button type="button" class="kick-btn kick-left" data-target="${escapeHtml(o.id)}" data-type="normal" title="Обычный удар" ${canNormal ? "" : "disabled"}><span class="kick-label">🤛</span></button>` +

            `<button type="button" class="kick-btn kick-right" data-target="${escapeHtml(o.id)}" data-type="strong" title="Сильный удар" ${canStrong ? "" : "disabled"}><span class="kick-label">🤜</span></button>` +

            `</div>` +

            `<div class="stadium-gadget-attack-row" data-target="${escapeHtml(o.id)}"></div>` +

            `</div></div>`;



        const gRow = card.querySelector(".stadium-gadget-attack-row");

        renderProvisionAttackButtons(gRow, state.gadgets, o.id);



        root.appendChild(card);

    });



    root.querySelectorAll(".kick-btn[data-target]").forEach((btn) => {

        btn.addEventListener("click", () => {

            onAttack(btn.getAttribute("data-target"), btn.getAttribute("data-type") || "normal", null);

        });

    });

    root.querySelectorAll(".stadium-gadget-hit[data-target]").forEach((btn) => {

        btn.addEventListener("click", () => {

            onAttack(btn.getAttribute("data-target"), "normal", btn.getAttribute("data-gadget"));

        });

    });

}



async function fetchTribunes() {

    const params = new URLSearchParams();
    if (state.match?.id) params.set("matchId", state.match.id);
    if (state.focusTargetId) params.set("targetId", state.focusTargetId);
    const q = params.toString() ? `&${params.toString()}` : "";

    const res = await fetch(`/stadium/tribunes?email=${encodeURIComponent(state.email)}${q}`);

    const data = await res.json();

    if (!data.success) throw new Error(data.error || "Ошибка");

    return data;

}



function paint(data) {

    state.match = data.match;

    state.gadgets = data.gadgets || [];

    state.playerRage = data.user?.rage ?? data.match?.playerRage ?? 0;

    if (data.user) renderHeaderBlock(data.user);

    const vs = document.getElementById("stadiumTribunesVs");

    if (vs) vs.textContent = data.match?.matchVsLabel || "";

    renderOwnedProvisions(document.getElementById("stadiumGadgetBar"), state.gadgets);

    renderOpponents(data.match.opponents || [], data.match);

}



async function onAttack(targetId, attackType, gadgetId) {
    if (!state.match?.id || !targetId) return;

    const need = furyCostForAttack(attackType);
    const rage = state.playerRage ?? 0;
    if (rage < need) {
        showStadiumFlash("Недостаточно ярости");
        return;
    }

    const body = {
        email: state.email,
        matchId: state.match.id,
        targetId,
        attackType
    };
    if (gadgetId) body.gadgetId = gadgetId;

    const { ok, data } = await postJson("/stadium/attack", body);
    if (!ok) {
        showStadiumFlash(data?.error || "Не удалось ударить");
        return;
    }

    if (data.strikeFlash) {
        saveStrikeFlashForRedirect({
            ...data.strikeFlash,
            repGain: data.strikeFlash.repGain ?? data.repGain ?? 0
        });
    }
    window.location.href = scheduleUrl();
}



async function onSearchMore() {

    const { ok, data } = await postJson("/stadium/tribunes/refresh", {

        email: state.email,

        matchId: state.match?.id

    });

    if (!ok) {

        showStadiumFlash(data?.error || "Не удалось обновить");

        return;

    }

    paint(data);

}



(async () => {

    const user = await fetchUser();

    if (!user) return;

    renderHeaderBlock(user);

    state.email = user.email;
    state.clubsCatalog = await loadClubsCatalog();



    const params = new URLSearchParams(location.search);

    const mid = params.get("matchId");
    const targetId = params.get("targetId");

    if (mid) state.match = { id: mid };
    if (targetId) state.focusTargetId = targetId;



    document.getElementById("stadiumSearchMore")?.addEventListener("click", () => onSearchMore());

    document.getElementById("stadiumBackSchedule")?.setAttribute("href", scheduleUrl());



    window.onStadiumRageTick = function (user) {
        state.playerRage = user.rage ?? state.playerRage;
        if (state.match?.status === "live") {
            renderOpponents(state.match.opponents || [], state.match);
        }
    };

    try {
        paint(await fetchTribunes());
    } catch (e) {
        const root = document.getElementById("stadiumOpponents");
        if (root) root.innerHTML = `<p class="district-empty">${escapeHtml(e.message)}</p>`;
    }

    startStadiumRagePoll(() => state.match?.status === "live" && state.match?.hasTicket);
})();

