/** Расписание стадиона — список недели и подробности матча. */

const STADIUM_MATCH_POLL_MS = 7000;

let state = { match: null, email: "", clubsCatalog: null, rosterSig: "", matchPollTimer: null, detailMode: false };

function rostersSignature(match) {
    if (!match) return "";
    const pick = (list) =>
        (list || [])
            .map((f) => `${f.id || f.email || f.name}:${Math.round(Number(f.hp) || 0)}:${f.alive === false ? 0 : 1}`)
            .join("|");
    return `${pick(match.rosterHome)};${pick(match.rosterAway)}`;
}

function renderFeed(match, opts = {}) {
    const el = document.getElementById("stadiumFeed");
    const feedOpts = {
        pagerId: "stadiumFeedPager",
        stateKey: "stadiumScheduleFeedUi"
    };
    if (opts.incremental && typeof patchStadiumFeed === "function") {
        patchStadiumFeed(el, match, feedOpts);
    } else {
        renderStadiumFeed(el, match, { ...feedOpts, preserveScroll: !!opts.preserveScroll });
    }
}

function setScheduleMode(detail) {
    state.detailMode = !!detail;
    const week = document.getElementById("stadiumWeekBlock");
    const detailEl = document.getElementById("stadiumMatchDetail");
    const title = document.getElementById("stadiumTitle");
    const back = document.getElementById("stadiumBackLink");
    if (week) week.hidden = detail;
    if (detailEl) detailEl.hidden = !detail;
    if (title) title.textContent = detail ? "Матч" : "Расписание";
    if (back) {
        back.textContent = detail ? "← К расписанию" : "← Стадион";
        back.href = detail ? "/stadium-schedule.html" : "/stadium.html";
    }
}

function renderWeekList(schedule) {
    const root = document.getElementById("stadiumWeekList");
    const hint = document.getElementById("stadiumWeekHint");
    if (!root) return;

    const matches = Array.isArray(schedule?.matches) ? schedule.matches : [];
    if (hint) {
        hint.textContent = schedule?.scheduleLabel
            ? `Старты матчей: ${schedule.scheduleLabel}`
            : "";
    }

    if (!matches.length) {
        root.innerHTML = '<p class="district-empty">Нет матчей на ближайшую неделю.</p>';
        return;
    }

    root.innerHTML = matches
        .map((item) => {
            const statusCls = stadiumStatusClass(item.statusLabel);
            const tickets = `Билетов: ${item.participantsRegistered ?? 0} / ${item.participantsMax ?? 20}`;
            const score =
                item.status === "ended" || item.status === "live"
                    ? `<span class="stadium-week-score">[${item.scoreHome ?? 0} : ${item.scoreAway ?? 0}]</span>`
                    : "";
            return (
                `<a class="stadium-week-row" href="/stadium-schedule.html?matchId=${encodeURIComponent(item.matchId)}">` +
                `<div class="stadium-week-row-top">${stadiumRenderClubMatchLine(item)}${score}</div>` +
                `<div class="stadium-week-row-meta">` +
                `<span>${stadiumEscapeHtml(item.startsAtLabel)}</span>` +
                `<span class="stadium-week-status ${statusCls}">${stadiumEscapeHtml(item.statusLabel)}</span>` +
                `</div>` +
                `<div class="stadium-week-row-foot">${stadiumEscapeHtml(tickets)}</div>` +
                `</a>`
            );
        })
        .join("");
}

async function loadWeekList() {
    const res = await fetch(`/stadium/schedule/list?email=${encodeURIComponent(state.email)}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Ошибка");
    renderWeekList(data.schedule);
}

function renderHead(match) {
    const score = document.getElementById("stadiumScoreBar");
    const cd = document.getElementById("stadiumCountdown");
    const participants = document.getElementById("stadiumParticipants");
    const tribunes = document.getElementById("stadiumToTribunes");
    const eliminated = document.getElementById("stadiumEliminatedMsg");
    const hint = document.getElementById("stadiumTicketHint");

    if (score) {
        const homeIco = match.homeEmblem
            ? `<img class="stadium-score-ico" src="${stadiumEscapeHtml(match.homeEmblem)}" alt="">`
            : "";
        const awayIco = match.awayEmblem
            ? `<img class="stadium-score-ico" src="${stadiumEscapeHtml(match.awayEmblem)}" alt="">`
            : "";
        score.innerHTML =
            `${homeIco}${stadiumEscapeHtml(match.homeClubName)} [${match.scoreHome}] — [${match.scoreAway}] ${stadiumEscapeHtml(match.awayClubName)}${awayIco}`;
    }

    if (participants) {
        if (match.participantsLabel) {
            participants.hidden = false;
            participants.textContent = match.participantsLabel;
        } else {
            participants.hidden = true;
        }
    }

    if (cd) {
        if (match.status === "scheduled") {
            const startLine = match.startsAtLabel
                ? `<br>Начало матча: <strong>${stadiumEscapeHtml(match.startsAtLabel)}</strong>`
                : "";
            cd.innerHTML =
                `До начала матча осталось<br><strong>${stadiumEscapeHtml(match.countdownLabel)}</strong>${startLine}`;
        } else if (match.status === "live") {
            cd.innerHTML = `Матч идёт · осталось <strong>${stadiumEscapeHtml(match.remainingLabel)}</strong>`;
        } else {
            cd.textContent = "Матч завершён";
        }
    }

    if (hint) {
        if (match.playerCanJoin && !match.hasTicket && match.status !== "ended") {
            hint.hidden = false;
            hint.innerHTML =
                'Нужен билет — <a href="/stadium-kassa.html">купи в кассе</a> (' +
                (match.ticketCost || 2) +
                ' <img class="stadium-kassa-price-ico" src="/static/location/base/gold.png" width="14" height="14" alt="доллары" loading="lazy">).';
        } else {
            hint.hidden = true;
        }
    }

    const canFight = !!(match.hasTicket && match.matchLive && match.playerCanJoin && match.playerCanFight);
    const isEliminated = !!(match.hasTicket && match.playerEliminated && match.matchLive);

    if (tribunes) {
        tribunes.hidden = !canFight;
        if (canFight && match.id) {
            tribunes.href = "/stadium-tribunes.html?matchId=" + encodeURIComponent(match.id);
        }
    }

    if (eliminated) {
        eliminated.hidden = !isEliminated;
    }

    const bestBtn = document.getElementById("stadiumBestBtn");
    if (bestBtn) {
        const showBest = match.status === "live" || match.status === "ended";
        bestBtn.hidden = !showBest;
        if (showBest && match.id) {
            bestBtn.href = "/stadium-best.html?matchId=" + encodeURIComponent(match.id);
        }
    }

    updateRostersVisibility(match);
}

function updateRostersVisibility(match) {
    const block = document.getElementById("stadiumRostersBlock");
    if (!block) return;
    const canFight = !!(match.hasTicket && match.matchLive && match.playerCanJoin && match.playerCanFight);
    block.hidden = canFight;
}

function renderRosters(match) {
    const root = document.getElementById("stadiumRosters");
    if (!root) return;

    function col(title, emblem, list) {
        const ico = emblem
            ? `<img class="stadium-roster-club-ico" src="${stadiumEscapeHtml(emblem)}" alt="">`
            : "";
        const rows = (list || [])
            .map((f) => {
                const ava = f.avatar
                    ? `<span class="stadium-roster-ava">${fighterAvatarHtml(f, state.clubsCatalog, {
                          width: 28,
                          height: 28,
                          wrapClass: "stadium-roster-ava-wrap",
                          frameClass: "player-avatar-frame--xs"
                      })}</span>`
                    : "";
                return (
                    `<div class="stadium-roster-row">` +
                    ava +
                    `<span class="stadium-roster-label">${stadiumEscapeHtml(f.memberLabel || f.name)}</span>` +
                    (f.isBot
                        ? ""
                        : `<span class="stadium-roster-name">${playerNameHtml(f.name, f.email)}</span>`) +
                    `<span class="stadium-roster-level">[${f.level}]</span>` +
                    `</div>`
                );
            })
            .join("");
        return `<div class="stadium-roster-col"><h4>${ico}${stadiumEscapeHtml(title)}</h4>${rows || '<div class="stadium-roster-row">—</div>'}</div>`;
    }

    root.innerHTML =
        col(match.homeClubName, match.homeEmblem, match.rosterHome) +
        col(match.awayClubName, match.awayEmblem, match.rosterAway);
}

async function fetchMatch() {
    const q = state.match?.id ? `&matchId=${encodeURIComponent(state.match.id)}` : "";
    const res = await fetch(`/stadium/match?email=${encodeURIComponent(state.email)}${q}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Ошибка");
    return data;
}

function shouldAutoPollMatch() {
    if (!state.detailMode) return false;
    const lines = state.match?.feed?.length || 0;
    if (typeof isStadiumFeedLivePage === "function") {
        return isStadiumFeedLivePage("stadiumScheduleFeedUi", lines);
    }
    return true;
}

function paintMatch(data, opts = {}) {
    const prev = state.match;
    state.match = data.match;
    renderHead(data.match);

    const nextSig = rostersSignature(data.match);
    if (opts.full || nextSig !== state.rosterSig) {
        renderRosters(data.match);
        state.rosterSig = nextSig;
    }

    renderFeed(data.match, {
        incremental: !opts.full && opts.incremental !== false,
        preserveScroll: !opts.full
    });

    renderOwnedProvisions(document.getElementById("stadiumProvisionsBar"), data.gadgets || []);
}

function refreshMatchFull() {
    return fetchMatch()
        .then((data) => paintMatch(data, { full: true }))
        .catch((e) => alert(e.message));
}

function startMatchPoll() {
    if (state.matchPollTimer) clearInterval(state.matchPollTimer);
    state.matchPollTimer = setInterval(() => {
        if (!shouldAutoPollMatch()) return;
        fetchMatch()
            .then((data) => paintMatch(data, { incremental: true }))
            .catch(() => {});
    }, STADIUM_MATCH_POLL_MS);
}

async function initSchedulePage() {
    const user = await fetchUser();
    if (!user) return;
    renderHeaderBlock(user);
    state.email = user.email;
    state.clubsCatalog = await loadClubsCatalog();

    const params = new URLSearchParams(location.search);
    const mid = params.get("matchId");

    document.getElementById("stadiumRefreshBtn")?.addEventListener("click", () => {
        if (state.detailMode) refreshMatchFull();
        else loadWeekList().catch((e) => alert(e.message));
    });
    document.getElementById("stadiumFeedRefreshBtn")?.addEventListener("click", () => refreshMatchFull());

    if (mid) {
        state.match = { id: mid };
        setScheduleMode(true);
        try {
            paintMatch(await fetchMatch(), { full: true });
        } catch (e) {
            const root = document.getElementById("stadiumFeed");
            if (root) root.innerHTML = `<p class="stadium-feed--idle">${stadiumEscapeHtml(e.message)}</p>`;
        }
        const strikeFlash = consumeStrikeFlash();
        if (strikeFlash) showStrikeFlash(strikeFlash);
        startMatchPoll();
        startStadiumRagePoll(() => state.match?.status === "live");
        return;
    }

    setScheduleMode(false);
    try {
        await loadWeekList();
    } catch (e) {
        const root = document.getElementById("stadiumWeekList");
        if (root) root.innerHTML = `<p class="district-empty">${stadiumEscapeHtml(e.message)}</p>`;
    }
}

if (document.getElementById("stadiumWeekList") || document.getElementById("stadiumFeed")) {
    initSchedulePage();
}
