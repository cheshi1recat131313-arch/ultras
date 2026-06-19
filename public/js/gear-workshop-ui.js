/**
 * Универсальный UI мастерской Промзоны (Коллайдер / Швейный цех).
 *
 * @param {object} config
 * @param {string} config.apiBase — например "/industrial/collider"
 * @param {string} config.rootId — id контейнера
 * @param {string} config.flashId — id блока flash-сообщения
 * @param {string} config.itemsKey — "weapons" | "clothes"
 * @param {string} config.pickLabel — подпись селектора
 * @param {string} config.emptyHtml — HTML при отсутствии предметов
 * @param {string} [config.defaultEmoji] — запасной emoji
 * @param {string} [config.maxMessageDefault]
 */
function createGearWorkshopUi(config) {
    const ICO_USD =
        '<img src="/static/icons/gold.svg" class="collider-usd-ico" alt="">';

    const STAT_LABELS = {
        power: "Сила",
        speed: "Ловкость",
        intel: "Хитрость",
        stamina: "Стойкость"
    };

    let timer = null;

    function escapeHtml(s) {
        const d = document.createElement("div");
        d.textContent = s;
        return d.innerHTML;
    }

    function showFlash(text) {
        const el = document.getElementById(config.flashId);
        if (!el) return;
        if (!text) {
            el.hidden = true;
            el.textContent = "";
            return;
        }
        el.textContent = text;
        el.hidden = false;
    }

    function stopTimer() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    function formatHms(ms) {
        const totalSec = Math.max(0, Math.ceil(ms / 1000));
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    function itemArtHtml(item) {
        if (item.image || item.icon) {
            return `<img class="workshop-item-img" src="${escapeHtml(item.image || item.icon)}" alt="" loading="lazy">`;
        }
        if (item.slot) {
            return `<div class="workshop-item-ph workshop-item-ph--${escapeHtml(item.slot)}" role="img" aria-hidden="true"></div>`;
        }
        return `<span class="collider-emoji">${item.emoji || config.defaultEmoji || "📦"}</span>`;
    }

    function renderPanel(data) {
        const root = document.getElementById(config.rootId);
        if (!root) return;

        const items = data[config.itemsKey] || [];
        if (!items.length) {
            root.innerHTML = config.emptyHtml;
            stopTimer();
            return;
        }

        const active = data.active;
        const activeId = data.activeId || active?.itemId;

        let pickHtml = "";
        if (items.length > 1) {
            const selectId = `${config.rootId}Select`;
            pickHtml =
                `<div class="collider-pick"><label for="${selectId}">${escapeHtml(config.pickLabel)}</label>` +
                `<select id="${selectId}">` +
                items
                    .map(
                        (w) =>
                            `<option value="${escapeHtml(w.itemId)}"${w.itemId === activeId ? " selected" : ""}>${escapeHtml(w.starsDisplay + " " + w.label)}</option>`
                    )
                    .join("") +
                "</select></div>";
        }

        const statLabel = STAT_LABELS[active.statKey] || "Бонус";

        let bodyHtml;
        if (active.upgrading) {
            bodyHtml =
                '<div class="collider-working">' +
                '<p class="collider-working-title">Мы работаем над этим.</p>' +
                `<p class="collider-timer">Приходи через: <b id="${config.rootId}Countdown">${escapeHtml(active.remainingLabel)}</b></p>` +
                `<button type="button" class="collider-btn collider-btn--mush" id="${config.rootId}Speedup">Ускорить за грибы (${active.speedupMushrooms} 🍄)</button>` +
                "</div>";
        } else if (active.atMax) {
            bodyHtml =
                `<p class="collider-max">${escapeHtml(active.maxMessage || config.maxMessageDefault || "Предмет прокачан максимально.")}</p>` +
                `<button type="button" class="collider-btn" id="${config.rootId}Upgrade" disabled>Улучшить</button>`;
        } else {
            bodyHtml =
                `<div class="collider-meta">` +
                `<div class="collider-meta-row"><span>Время улучшения:</span><span>${escapeHtml(active.durationLabel)}</span></div>` +
                `<div class="collider-meta-row"><span>Стоимость:</span><span>${active.costDollars} ${ICO_USD}</span></div>` +
                `</div>` +
                `<button type="button" class="collider-btn" id="${config.rootId}Upgrade">Улучшить</button>`;
        }

        root.innerHTML =
            pickHtml +
            '<article class="collider-panel workshop-panel" data-item-id="' +
            escapeHtml(activeId) +
            '">' +
            '<div class="collider-head workshop-head">' +
            itemArtHtml(active) +
            `<div><h2 class="collider-name">${escapeHtml(active.label)}</h2>` +
            `<span class="collider-stars">${escapeHtml(active.starsDisplay)}</span></div>` +
            "</div>" +
            `<p class="collider-stat">${statLabel}: <b>+${active.currentBonus}</b></p>` +
            (active.nextBonus != null
                ? `<p class="collider-stat">Следующий уровень: <b>+${active.nextBonus}</b></p>`
                : "") +
            (active.atMax
                ? ""
                : `<p class="collider-level-line">Уровень: ${active.level} → ${active.level + 1}</p>`) +
            bodyHtml +
            "</article>";

        const selectId = `${config.rootId}Select`;
        const select = document.getElementById(selectId);
        if (select) {
            select.addEventListener("change", () => load(select.value));
        }

        const upgradeBtn = document.getElementById(`${config.rootId}Upgrade`);
        if (upgradeBtn) {
            upgradeBtn.addEventListener("click", () => doUpgrade(activeId));
        }

        const speedBtn = document.getElementById(`${config.rootId}Speedup`);
        if (speedBtn) {
            speedBtn.addEventListener("click", () => doSpeedup(activeId));
        }

        if (active.upgrading) {
            startTimer(active.remainingMs, activeId);
        } else {
            stopTimer();
        }
    }

    function startTimer(msLeft, itemId) {
        stopTimer();
        const deadline = Date.now() + msLeft;
        const countdownId = `${config.rootId}Countdown`;
        const tick = () => {
            const left = deadline - Date.now();
            const el = document.getElementById(countdownId);
            if (el) el.textContent = formatHms(left);
            if (left <= 0) {
                stopTimer();
                load(itemId);
            }
        };
        tick();
        timer = setInterval(tick, 1000);
    }

    async function load(itemId) {
        const email = getEmail();
        if (!email) return;
        let url = `${config.apiBase}/state?email=` + encodeURIComponent(email);
        if (itemId) url += "&itemId=" + encodeURIComponent(itemId);
        const res = await fetch(url);
        const data = await res.json();
        if (!data.success) {
            showMsg(data.error || "Ошибка", true);
            return;
        }
        if (data.user) renderHeaderBlock(data.user);
        if (data.flash) showFlash(data.flash);
        renderPanel(data);
    }

    async function doUpgrade(itemId) {
        showFlash(null);
        const { ok, data } = await postJson(`${config.apiBase}/upgrade`, {
            email: getEmail(),
            itemId
        });
        if (!ok || !data.success) {
            showMsg(data.error || "Не удалось улучшить", true);
            return;
        }
        if (data.user) renderHeaderBlock(data.user);
        if (data.flash) showFlash(data.flash);
        renderPanel(data);
    }

    async function doSpeedup(itemId) {
        const { ok, data } = await postJson(`${config.apiBase}/speedup`, {
            email: getEmail(),
            itemId
        });
        if (!ok || !data.success) {
            showMsg(data.error || "Не удалось ускорить", true);
            return;
        }
        if (data.user) renderHeaderBlock(data.user);
        if (data.flash) showFlash(data.flash);
        renderPanel(data);
    }

    return { load, renderPanel, doUpgrade, doSpeedup };
}
