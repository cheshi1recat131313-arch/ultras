/** «Битва за Паб» — клиент (регистрация, комнаты, бой в стиле БМ). */

const PB_POLL_MS = 7000;

let pbState = null;
let pbCombat = null;
let pbPollTimer = null;
let pbCooldownTimer = null;
let pbCombatMode = false;
let pbUser = null;
let pbPrevBattleStatus = null;
let pbOpponentsSig = "";
let pbBestSig = "";

function pbEl(id) {
    return document.getElementById(id);
}

function formatPbTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
}

function showPbBanner(text) {
    const el = pbEl("pbBanner");
    if (!el) return;
    if (!text) {
        el.hidden = true;
        el.textContent = "";
        return;
    }
    el.hidden = false;
    el.textContent = text;
}

function showPbStrikeFlash(flash) {
    const el = pbEl("pbStrikeFlash");
    if (!el || !flash) return;
    const text =
        typeof buildStrikeFlashText === "function"
            ? buildStrikeFlashText(flash)
            : flash.error || `Удар: ${flash.dmg || 0} ❤️`;
    if (!text) return;
    el.textContent = "";
    el.innerHTML = escapeHtml(text);
    el.hidden = false;
    setTimeout(() => {
        el.hidden = true;
    }, 6000);
}

function statusLabel(status, schedule) {
    if (status === "registration") {
        if (schedule?.registrationOpen) return "Запись открыта";
        return "Ожидание записи";
    }
    if (status === "live") return "Битва идёт";
    if (status === "ended") return "Битва завершена";
    return status || "—";
}

function scheduleBlock(schedule, battle) {
    if (!schedule) return "";
    const mode = schedule.testMode ? " (тест: каждый день)" : " (вс 19:00)";
    let html = `<br>Старт: <strong>${escapeHtml(schedule.scheduledStartsLabel)}</strong>${mode}`;
    html += `<br>Запись с ${escapeHtml(schedule.registrationOpensLabel)}`;
    if (battle.status === "registration") {
        if (schedule.registrationOpen) {
            html += `<br>До старта: ${escapeHtml(schedule.countdownToStart)}`;
        } else if (schedule.msUntilRegistrationOpens > 0) {
            html += `<br>Запись откроется через ${escapeHtml(schedule.countdownToRegistration)}`;
        }
    }
    return html;
}

function renderCoordChat(messages) {
    const log = pbEl("pbCoordLog");
    if (!log) return;
    const list = Array.isArray(messages) ? messages : [];
    if (!list.length) {
        log.innerHTML = '<p class="pb-empty">Сообщений пока нет.</p>';
        return;
    }
    log.innerHTML = list
        .map((m) => {
            const head = `${playerNameHtml(m.name || "Игрок", m.email)} · ${escapeHtml(m.clubName || "")}${m.rankTitle ? ` · ${escapeHtml(m.rankTitle)}` : ""} · ${formatPbTime(m.at)}`;
            return `<div class="pb-coord-msg"><div class="pb-coord-head">${head}</div><p class="pb-coord-text">${escapeHtml(m.text || "")}</p></div>`;
        })
        .join("");
    log.scrollTop = log.scrollHeight;
}

function roomStatusLabel(status) {
    if (status === "waiting") return "Ожидание старта";
    if (status === "live") return "Бой идёт";
    if (status === "idle") return "Затишье";
    if (status === "ended") return "Завершена";
    return status || "—";
}

function renderClubRegList(battle) {
    const list = pbEl("pbClubRegList");
    if (!list) return;
    const clubs = battle.registrationsByClub || [];
    if (!clubs.length) {
        list.innerHTML = '<li class="pb-empty">Список клубов загружается…</li>';
        return;
    }
    list.innerHTML = clubs
        .map(
            (c) =>
                `<li class="pb-club-reg-item">` +
                `<span class="pb-club-reg-name">${escapeHtml(c.name)}</span>` +
                `<span class="pb-club-reg-count">${c.count}</span>` +
                `</li>`
        )
        .join("");
}

function renderWaitingPanel(state) {
    const panel = pbEl("pbWaitingPanel");
    if (!panel) return;

    const battle = state.battle;
    const me = state.me;
    const schedule = battle.schedule || {};
    const isWaiting = battle.status === "registration";

    panel.hidden = !isWaiting;

    const banner = pbEl("pbStartBanner");
    const countdown = pbEl("pbCountdownLine");
    const regLine = pbEl("pbWaitingRegLine");
    const registerBtn = pbEl("pbRegisterBtn");
    const registeredBadge = pbEl("pbRegisteredBadge");
    const registerHint = pbEl("pbRegisterHint");
    const devReset = pbEl("pbDevResetBtn");

    if (banner) {
        const full = schedule.scheduledStartsFull || schedule.scheduledStartsLabel || "—";
        banner.textContent = `Битва начнётся ${full}`;
    }

    if (countdown) {
        if (schedule.registrationOpen && schedule.countdownToStart) {
            countdown.hidden = false;
            countdown.textContent = `До старта: ${schedule.countdownToStart}`;
        } else if (schedule.msUntilRegistrationOpens > 0) {
            countdown.hidden = false;
            countdown.textContent = `Запись откроется через ${schedule.countdownToRegistration}`;
        } else {
            countdown.hidden = true;
            countdown.textContent = "";
        }
    }

    if (regLine) {
        regLine.textContent = `Записано игроков: ${battle.registrationCount || 0}`;
    }

    renderClubRegList(battle);

    const canRegister = schedule.registrationOpen && !battle.registered;
    if (registerBtn) {
        registerBtn.hidden = !!battle.registered;
        registerBtn.disabled = !canRegister;
        registerBtn.textContent = `Записаться за ${battle.entryCost || 10} $`;
    }
    if (registeredBadge) {
        registeredBadge.hidden = !battle.registered;
    }
    if (registerHint) {
        if (battle.registered) {
            registerHint.textContent = "";
        } else if (!schedule.registrationOpen) {
            registerHint.textContent = "Запись откроется за сутки до старта.";
        } else {
            registerHint.textContent = "Списание 10 $ из валюты в шапке профиля.";
        }
    }
    if (devReset) {
        devReset.hidden = !schedule.testMode;
    }
}

function renderRooms(state) {
    const wrap = pbEl("pbRooms");
    const panel = pbEl("pbRoomsPanel");
    if (!wrap || !panel) return;

    const battle = state.battle;
    const me = state.me;
    const overview = state.roomOverview || [];
    const showLive = battle.status === "live" && me.inBattle && me.alive && !pbCombatMode;
    const show = showLive && overview.length;
    panel.hidden = !show;
    if (!show) {
        wrap.innerHTML = "";
        return;
    }

    const cooldown = me.moveCooldownMs || 0;
    wrap.className = "pb-room-cards";
    wrap.innerHTML = overview
        .map((room) => {
            const mine = room.isMyRoom;
            const clubsText = room.clubsLabel || "—";
            const countLabel =
                battle.status === "registration"
                    ? "игроков: ?"
                    : `игроков: ${room.playerCount}, бойцов: ${room.fighterCount}`;
            let actions = "";
            if (battle.status === "live") {
                if (room.canEnter || room.isMyRoom) {
                    actions += `<button type="button" class="pb-room-enter-btn" data-action="enter" data-room="${room.index}">Зайти</button>`;
                }
                if (room.canMoveHere) {
                    actions += `<button type="button" class="pb-room-move-btn" data-action="move" data-room="${room.index}">Перейти</button>`;
                } else if (!room.isMyRoom && cooldown > 0) {
                    actions += `<button type="button" class="pb-room-move-btn" disabled>Перейти (${Math.ceil(cooldown / 1000)}с)</button>`;
                }
            }
            return (
                `<article class="pb-room-card${mine ? " pb-room-card--mine" : ""}">` +
                `<div class="pb-room-card-head">` +
                `<h3 class="pb-room-card-title">${escapeHtml(room.title || room.clubName)}</h3>` +
                `<span class="pb-room-card-count">${escapeHtml(countLabel)}</span>` +
                `</div>` +
                `<p class="pb-room-card-clubs">${escapeHtml(roomStatusLabel(room.status))} · ${escapeHtml(clubsText)}</p>` +
                (actions ? `<div class="pb-room-card-actions">${actions}</div>` : "") +
                `</article>`
            );
        })
        .join("");

    wrap.querySelectorAll("[data-action]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const idx = Number(btn.dataset.room);
            if (!Number.isFinite(idx)) return;
            if (btn.dataset.action === "enter") enterRoom(idx);
            else if (btn.dataset.action === "move") moveToRoom(idx);
        });
    });
}

function renderRoster(state) {
    const panel = pbEl("pbRosterPanel");
    const list = pbEl("pbRoster");
    if (!panel || !list) return;

    const battle = state.battle;
    const me = state.me;
    const roster = state.roomRoster || [];
    const show = battle.status === "live" && me.inBattle && roster.length && !pbCombatMode;

    panel.hidden = !show;
    if (!show) {
        list.innerHTML = "";
        return;
    }

    list.innerHTML = roster
        .map((f) => {
            const ava = fighterAvatarHtml(f, pbState?.clubsCatalog, {
                width: 32,
                height: 32,
                wrapClass: "pb-roster-ava",
                frameClass: "player-avatar-frame--xs"
            });
            return (
                `<li class="pb-roster-item${f.isMe ? " pb-roster-item--me" : ""}">` +
                ava +
                `<span class="pb-roster-body">` +
                `<span class="pb-roster-name">${playerNameHtml(f.name, f.email && !f.isBot ? f.email : null)}</span> ` +
                `<span class="pb-roster-meta">[${f.level}] ${escapeHtml(f.clubName || "")} · ${Math.round(f.hp)} ❤️</span>` +
                `${f.isBot ? ' <span class="pb-roster-bot">бот</span>' : ""}` +
                `</span></li>`
            );
        })
        .join("");
}

function renderBest(combat) {
    const wrap = pbEl("pbBest");
    if (!wrap || !combat?.best) return;

    const players = Array.isArray(combat.best)
        ? combat.best
        : combat.best?.players || [];
    if (!players.length) {
        wrap.innerHTML = '<p class="pb-empty">Статистика появится после первых ударов.</p>';
        return;
    }

    wrap.innerHTML = players.map((p) => renderBestRow(p)).join("");
}

function renderBestRow(p) {
    const fill = p.club ? clubAvatarFill(p.club, pbState?.clubsCatalog) : null;
    const ava = p.avatar
        ? `<div class="stadium-best-ava-wrap">${playerAvatarFrameHtml(p.avatar, {
              fill,
              width: 52,
              height: 52,
              alt: p.name
          })}</div>`
        : fighterAvatarHtml(p, pbState?.clubsCatalog, {
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
        `<p class="stadium-best-stat">Репутация: <b>${p.rep}</b></p>` +
        `<p class="stadium-best-stat">Снесённое HP: <b>${p.damage}</b></p>` +
        `<p class="stadium-best-stat">Вынес: <b>${p.kos}</b></p>` +
        `</div></article>`
    );
}

function renderCombatOpponentAvatar(o) {
    return fighterAvatarHtml(o, pbState?.clubsCatalog, { width: 56, height: 56 });
}

function renderCombatOpponents(combat) {
    const root = pbEl("pbOpponents");
    if (!root || !combat) return;

    const opponents = combat.opponents || [];
    const rage = combat.playerRage ?? 0;
    const canNormal = rage >= (window.STADIUM_FURY_NORMAL || 60);
    const canStrong = rage >= (window.STADIUM_FURY_STRONG || 100);

    if (!opponents.length) {
        root.innerHTML = '<p class="district-empty">Нет целей — нажми «Обновить».</p>';
        return;
    }

    root.innerHTML = "";
    opponents.forEach((o) => {
        const ava = renderCombatOpponentAvatar(o);
        const card = document.createElement("div");
        card.className = "bot-card stadium-battle-card";
        card.innerHTML =
            ava +
            `<div class="bot-info">` +
            `<div class="stadium-opp-head">` +
            `<span class="stadium-opp-name">${playerNameHtml(o.name, o.email && !o.isBot ? o.email : null)}</span>` +
            `<span class="stadium-opp-meta">[ ${o.level} ] ( ${Math.round(o.hp)} ❤️ )</span>` +
            `</div>` +
            `<p class="stadium-opp-club">${escapeHtml(o.clubName || "")}</p>` +
            `<p class="stadium-opp-fury">Ярость: ${Math.round(o.fury ?? 0)}/${o.maxFury ?? 150}</p>` +
            `<div class="stadium-battle-actions">` +
            `<div class="kick-row">` +
            `<button type="button" class="kick-btn kick-left" data-target="${escapeHtml(o.id)}" data-type="normal" ${canNormal ? "" : "disabled"}><span class="kick-label">🤛</span></button>` +
            `<button type="button" class="kick-btn kick-right" data-target="${escapeHtml(o.id)}" data-type="strong" ${canStrong ? "" : "disabled"}><span class="kick-label">🤜</span></button>` +
            `</div>` +
            `<div class="stadium-gadget-attack-row" data-target="${escapeHtml(o.id)}"></div>` +
            `</div></div>`;

        const gRow = card.querySelector(".stadium-gadget-attack-row");
        if (typeof renderProvisionAttackButtons === "function") {
            renderProvisionAttackButtons(gRow, combat.gadgets, o.id);
        }

        card.querySelectorAll(".kick-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                strikeTarget(btn.dataset.target, btn.dataset.type);
            });
        });
        card.querySelectorAll(".stadium-gadget-hit[data-target]").forEach((btn) => {
            btn.addEventListener("click", () => {
                strikeTarget(btn.dataset.target, "normal", btn.dataset.gadget);
            });
        });
        root.appendChild(card);
    });
}

function renderMyStats(combat) {
    const panel = pbEl("pbMyStats");
    const dmg = pbEl("pbMyDamage");
    const kos = pbEl("pbMyKos");
    const hits = pbEl("pbMyHits");
    if (!panel) return;
    const stats = combat?.myStats;
    if (!stats) {
        panel.hidden = true;
        return;
    }
    panel.hidden = false;
    if (dmg) dmg.textContent = String(stats.damage ?? 0);
    if (kos) kos.textContent = String(stats.kos ?? 0);
    if (hits) hits.textContent = String(stats.hits ?? 0);
}

function opponentsSignature(opponents) {
    return (opponents || [])
        .map((o) => `${o.id}:${Math.round(Number(o.hp) || 0)}:${Math.round(Number(o.fury) || 0)}`)
        .join("|");
}

function bestSignature(combat) {
    const players = Array.isArray(combat?.best) ? combat.best : combat?.best?.players || [];
    return players.map((p) => `${p.email || p.id}:${p.damage}:${p.kos}:${p.rep}`).join("|");
}

function renderCombatPanel(combat, opts = {}) {
    pbCombat = combat;
    const panel = pbEl("pbCombatPanel");
    const title = pbEl("pbCombatTitle");
    if (!panel || !combat) return;

    panel.hidden = !pbCombatMode;
    if (title) title.textContent = combat.roomTitle || combat.roomName || "Комната";

    const feedEl = pbEl("pbFeed");
    const feedOpts = { pagerId: "pbFeedPager", stateKey: "pbFeedUi" };
    if (typeof renderStadiumFeed === "function" && combat.match) {
        if (opts.feedIncremental && typeof patchStadiumFeed === "function") {
            patchStadiumFeed(feedEl, combat.match, feedOpts);
        } else {
            renderStadiumFeed(feedEl, combat.match, {
                ...feedOpts,
                preserveScroll: !!opts.preserveScroll
            });
        }
    }

    if (typeof renderOwnedProvisions === "function") {
        renderOwnedProvisions(pbEl("pbProvisionsBar"), combat.gadgets);
    }

    renderMyStats(combat);

    const nextBestSig = bestSignature(combat);
    if (!opts.feedIncremental || nextBestSig !== pbBestSig) {
        renderBest(combat);
        pbBestSig = nextBestSig;
    }

    const nextOppSig = opponentsSignature(combat.opponents);
    if (!opts.feedIncremental || nextOppSig !== pbOpponentsSig) {
        renderCombatOpponents(combat);
        pbOpponentsSig = nextOppSig;
    }
}

function renderAliveSummary(battle) {
    const entries = Object.entries(battle.aliveByClub || {});
    if (!entries.length) return "";
    const items = entries
        .map(([, v]) => `<li>${escapeHtml(v.clubName)} — ${v.count}</li>`)
        .join("");
    return `<ul class="pb-alive-list">${items}</ul>`;
}

function updateCooldownLine(me) {
    const line = pbEl("pbCooldownLine");
    if (!line) return;
    const ms = me.moveCooldownMs || 0;
    if (!me.inBattle || !me.alive || ms <= 0 || pbCombatMode) {
        line.hidden = true;
        line.textContent = "";
        return;
    }
    line.hidden = false;
    line.textContent = `Переход через ${Math.ceil(ms / 1000)} сек.`;
}

function setCombatMode(on) {
    pbCombatMode = !!on;
    const combat = pbEl("pbCombatPanel");
    if (combat) combat.hidden = !pbCombatMode;
    if (pbState) {
        renderRooms(pbState);
        renderRoster(pbState);
        const coordPanel = pbEl("pbCoordPanel");
        if (coordPanel && pbState.battle) {
            coordPanel.hidden =
                pbCombatMode || !(pbState.battle.status === "live" || pbState.battle.status === "ended");
        }
    }
}

function renderPubBattle(state) {
    pbState = state;
    const battle = state.battle;
    const me = state.me;
    const isWaiting = battle.status === "registration";
    const isLive = battle.status === "live";
    const isEnded = battle.status === "ended";

    const waitingPanel = pbEl("pbWaitingPanel");
    const overviewPanel = pbEl("pbOverviewPanel");
    const coordPanel = pbEl("pbCoordPanel");
    const coordCompose = pbEl("pbCoordCompose");
    const coordHint = pbEl("pbCoordHint");
    const liveActions = pbEl("pbLiveActions");
    const roomLine = pbEl("pbRoomLine");
    const statusText = pbEl("pbStatusText");
    const rosterPanel = pbEl("pbRosterPanel");
    const combatPanel = pbEl("pbCombatPanel");

    renderWaitingPanel(state);

    if (waitingPanel) waitingPanel.hidden = !isWaiting;
    if (overviewPanel) overviewPanel.hidden = isWaiting;
    if (rosterPanel) rosterPanel.hidden = isWaiting || !isLive || pbCombatMode;
    if (combatPanel && !pbCombatMode) combatPanel.hidden = true;
    if (coordPanel) coordPanel.hidden = isWaiting || pbCombatMode || !(isLive || isEnded);

    if (statusText && !isWaiting) {
        const schedule = battle.schedule;
        let html = "";
        if (isLive) {
            html = `<strong>Битва идёт</strong>`;
            html += `<br>Участников: <strong>${battle.participantCount || 0}</strong>`;
            html += renderAliveSummary(battle);
            if (me.eliminated) html += "<br>Ты выбыл из боя.";
        } else if (isEnded) {
            html = `<strong>Битва завершена</strong>`;
            if (battle.winnerClubName) {
                html += `<br>Победил клуб: <strong>${escapeHtml(battle.winnerClubName)}</strong>`;
            }
            if (schedule?.scheduledStartsLabel) {
                html += `<br>Следующая битва: ${escapeHtml(schedule.scheduledStartsLabel)}`;
            }
        }
        statusText.innerHTML = html;
    }

    if (roomLine) {
        if (isLive && me.inBattle && me.roomName) {
            roomLine.hidden = false;
            roomLine.textContent = `Текущая комната: ${me.roomName}`;
        } else {
            roomLine.hidden = true;
        }
    }

    updateCooldownLine(me);

    if (liveActions) {
        liveActions.hidden = !(isLive && me.inBattle && me.alive);
    }

    const roomsSubtitle = pbEl("pbRoomsSubtitle");
    if (roomsSubtitle) {
        if (isLive && me.inBattle && me.alive) {
            roomsSubtitle.textContent = "Зайди в свою комнату или перейди в другую (раз в 3 мин).";
        } else {
            roomsSubtitle.textContent = "";
        }
    }

    if (coordCompose) {
        const canWrite = isLive && me.canCoordWrite;
        coordCompose.hidden = !canWrite;
    }
    if (coordHint) {
        coordHint.textContent = me.canCoordWrite
            ? "Ты можешь писать указания для клуба."
            : "Читать могут все. Писать — лидер и помощники клуба.";
    }

    renderRooms(state);
    renderRoster(state);
    renderCoordChat(state.coordChat);

    if (pbCombatMode && pbCombat) {
        renderCombatPanel(pbCombat);
    }

    if (
        pbPrevBattleStatus === "registration" &&
        isLive &&
        me.inBattle &&
        me.alive &&
        !pbCombatMode
    ) {
        const idx = me.roomIndex;
        if (idx != null) enterRoom(idx);
    }
    pbPrevBattleStatus = battle.status;
}

async function loadPubBattleState() {
    const email = getEmail();
    const response = await fetch(`/api/pub-battle/state?email=${encodeURIComponent(email)}`);
    const data = await response.json();
    if (!response.ok || !data.success) {
        showMsg(data.error || "Ошибка загрузки", true);
        return null;
    }
    if (data.user) {
        pbUser = data.user;
        renderHeaderBlock(data.user);
    }
    if (data.state) renderPubBattle(data.state);
    return data.state;
}

async function loadCombat(refresh, opts = {}) {
    const email = getEmail();
    const url =
        `/api/pub-battle/combat?email=${encodeURIComponent(email)}` +
        (refresh ? "&refresh=1" : "");
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok || !data.success) {
        showMsg(data.error || "Не удалось загрузить бой", true);
        return null;
    }
    if (data.user) {
        pbUser = data.user;
        renderHeaderBlock(data.user);
    }
    if (data.combat) {
        pbCombat = data.combat;
        setCombatMode(true);
        renderCombatPanel(data.combat, {
            feedIncremental: !!opts.feedIncremental && !refresh,
            preserveScroll: !!opts.feedIncremental && !refresh
        });
    }
    if (data.state) renderPubBattle(data.state);
    return data;
}

function shouldPbCombatAutoPoll() {
    const lines = pbCombat?.match?.feed?.length || 0;
    if (typeof isStadiumFeedLivePage === "function") {
        return isStadiumFeedLivePage("pbFeedUi", lines);
    }
    return true;
}

async function resetBattleForTest() {
    if (!confirm("Сбросить текущую битву и создать новую по расписанию?")) return;
    const { ok, data } = await postJson("/api/pub-battle/dev/reset", { email: getEmail() });
    if (!ok) {
        showMsg(data.error || "Сброс не удался", true);
        return;
    }
    showMsg("Битва сброшена. Можно тестировать с нуля.");
    pbPrevBattleStatus = null;
    pbCombatMode = false;
    if (data.state) renderPubBattle(data.state);
}

async function registerForBattle() {
    const btn = pbEl("pbRegisterBtn");
    if (btn) btn.disabled = true;
    const { ok, data } = await postJson("/api/pub-battle/register", { email: getEmail() });
    if (!ok) {
        showMsg(data.error || "Не удалось записаться", true);
        if (btn) btn.disabled = false;
        return;
    }
    showMsg("Ты записан на битву.");
    if (data.user) renderHeaderBlock(data.user);
    if (data.state) renderPubBattle(data.state);
}

async function enterRoom(roomIndex) {
    const { ok, data } = await postJson("/api/pub-battle/enter-room", {
        email: getEmail(),
        roomIndex
    });
    if (!ok) {
        showMsg(data.error || "Не удалось войти в комнату", true);
        return;
    }
    if (data.user) renderHeaderBlock(data.user);
    if (data.combat) {
        pbCombat = data.combat;
        setCombatMode(true);
        renderCombatPanel(data.combat);
    }
    if (data.state) renderPubBattle(data.state);
}

async function moveToRoom(roomIndex) {
    const { ok, data } = await postJson("/api/pub-battle/move", {
        email: getEmail(),
        roomIndex
    });
    if (!ok) {
        showMsg(data.error || "Переход недоступен", true);
        return;
    }
    if (data.state) renderPubBattle(data.state);
    showMsg("Ты перешёл в другую комнату.");
    if (pbCombatMode) await loadCombat(false);
}

async function strikeTarget(targetId, attackType, gadgetId) {
    const body = {
        email: getEmail(),
        targetId,
        attackType: attackType || "normal"
    };
    if (gadgetId) body.gadgetId = gadgetId;

    const { ok, data } = await postJson("/api/pub-battle/attack", body);
    if (!ok) {
        showMsg(data.error || "Удар не прошёл", true);
        return;
    }
    if (data.strikeFlash) showPbStrikeFlash(data.strikeFlash);
    if (data.battleEnded && data.winnerClubName) {
        showMsg(`Битва окончена! Победил клуб: ${data.winnerClubName}`);
        setCombatMode(false);
    }
    if (data.user) renderHeaderBlock(data.user);
    if (data.combat) {
        pbCombat = data.combat;
        renderCombatPanel(data.combat);
    }
    if (data.state) renderPubBattle(data.state);
}

async function sendCoordMessage() {
    const input = pbEl("pbCoordInput");
    const text = input ? input.value : "";
    const { ok, data } = await postJson("/api/pub-battle/coord-chat", {
        email: getEmail(),
        message: text
    });
    if (!ok) {
        showMsg(data.error || "Сообщение не отправлено", true);
        return;
    }
    if (input) input.value = "";
    if (data.state) renderPubBattle(data.state);
}

function scheduleCooldownTick() {
    if (pbCooldownTimer) clearInterval(pbCooldownTimer);
    pbCooldownTimer = setInterval(() => {
        if (pbState?.battle?.status === "registration" && pbState.battle.schedule) {
            const s = pbState.battle.schedule;
            s.msUntilStart = Math.max(0, (s.msUntilStart || 0) - 1000);
            s.msUntilRegistrationOpens = Math.max(0, (s.msUntilRegistrationOpens || 0) - 1000);
            s.countdownToStart = formatCountdownClient(s.msUntilStart);
            s.countdownToRegistration = formatCountdownClient(s.msUntilRegistrationOpens);
            renderWaitingPanel(pbState);
        }
        if (!pbState?.me?.moveCooldownMs) return;
        pbState.me.moveCooldownMs = Math.max(0, pbState.me.moveCooldownMs - 1000);
        updateCooldownLine(pbState.me);
        if (pbState.me.moveCooldownMs <= 0 && pbState.battle?.status === "live") {
            renderRooms(pbState);
        }
    }, 1000);
}

function formatCountdownClient(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function startPubBattlePoll() {
    if (pbPollTimer) clearInterval(pbPollTimer);
    pbPollTimer = setInterval(() => {
        if (pbCombatMode) {
            if (!shouldPbCombatAutoPoll()) return;
            loadCombat(false, { feedIncremental: true }).catch(() => {});
        } else {
            loadPubBattleState().catch(() => {});
        }
    }, PB_POLL_MS);
}

async function initPubBattle(user) {
    pbUser = user;
    if (!pbState) pbState = {};
    pbState.clubsCatalog = await loadClubsCatalog();
    const registerBtn = pbEl("pbRegisterBtn");
    if (registerBtn) registerBtn.addEventListener("click", () => registerForBattle());
    pbEl("pbDevResetBtn")?.addEventListener("click", () => resetBattleForTest());

    pbEl("pbEnterFightBtn")?.addEventListener("click", () => {
        const idx = pbState?.me?.roomIndex;
        if (idx != null) enterRoom(idx);
        else loadCombat(false);
    });
    pbEl("pbRefreshBtn")?.addEventListener("click", () => loadCombat(true));
    pbEl("pbBackBtn")?.addEventListener("click", () => {
        setCombatMode(false);
        pbEl("pbCombatPanel").hidden = true;
        loadPubBattleState();
    });

    const coordSend = pbEl("pbCoordSend");
    const coordInput = pbEl("pbCoordInput");
    if (coordSend) coordSend.addEventListener("click", () => sendCoordMessage());
    if (coordInput) {
        coordInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") sendCoordMessage();
        });
    }

    await loadPubBattleState();
    scheduleCooldownTick();
    startPubBattlePoll();
}
