/**
 * Гардероб — сборка персонажа и вкладки «На полках».
 */
(function () {
    const CHARACTER_LABELS = {
        tank: "Здоровяк",
        fast: "Шустрый",
        balanced: "Ровный",
        valk: "Валькирия",
        shadow: "Тень",
        spark: "Искра",
        tough: "Крепыш",
        redhead: "Рыжая бестия",
        fighter: "Бой-баба",
        chick: "Четкая чувиха"
    };

    const AMULET_SLOTS = ["amulet1", "amulet2", "amulet3", "amulet4"];
    const GEAR_CATALOG_SLOTS = new Set(["weapon", "clothes", "boots", "head"]);

    /** Подписи и тип иконки для пустых слотов. */
    const SLOT_META = {
        head: { ph: "head", label: "Голова" },
        clothes: { ph: "clothes", label: "Одежда" },
        weapon: { ph: "weapon", label: "Оружие" },
        boots: { ph: "boots", label: "Обувь" },
        trophy1: { ph: "trophy", label: "Трофей 1" },
        trophy2: { ph: "trophy", label: "Трофей 2" },
        trophy3: { ph: "trophy", label: "Трофей 3" },
        amulet1: { ph: "amulet", label: "Амулет 1" },
        amulet2: { ph: "amulet", label: "Амулет 2" },
        amulet3: { ph: "amulet", label: "Амулет 3" },
        amulet4: { ph: "amulet", label: "Амулет 4" }
    };

    const BATTLE_PROVISIONS = [
        {
            id: "ozverin",
            label: "Озверин",
            icon: "/static/provisions/ozverin.svg",
            effect: "Ярость до 150",
            usage: "Раз в 20 минут",
            cooldownMs: 20 * 60 * 1000
        },
        {
            id: "invisible",
            label: "Невидим",
            icon: "/static/provisions/invisible.svg",
            effect: "Невидимка 5 мин",
            usage: "Раз в 15 минут",
            cooldownMs: 15 * 60 * 1000
        },
        {
            id: "hot_pepper",
            label: "Острый перец",
            icon: "/static/provisions/hot_pepper.svg",
            effect: "Ярость +100",
            usage: "Раз в 5 минут",
            cooldownMs: 5 * 60 * 1000
        },
        {
            id: "black_chocolate",
            label: "Плитка чёрного шоколада",
            icon: "/static/provisions/black_chocolate.svg",
            effect: "+100 HP",
            usage: "Раз в 20 минут",
            cooldownMs: 20 * 60 * 1000
        },
        {
            id: "choco_bar",
            label: "Шоколадный батончик",
            icon: "/static/provisions/choco_bar.svg",
            effect: "+50 HP",
            usage: "Раз в 15 минут",
            cooldownMs: 15 * 60 * 1000
        }
    ];

    const FOOD_ITEMS = [
        {
            id: "hamburger",
            label: "Гамбургер",
            emoji: "🍔",
            icon: "/static/larek/hamburger.png",
            effect: "+100 HP",
            usage: "Раз в 1 час",
            cooldownMs: 60 * 60 * 1000
        },
        {
            id: "hotdog",
            label: "Хот-дог",
            emoji: "🌭",
            icon: "/static/larek/hotdog.png",
            effect: "+100 HP",
            usage: "Раз в 5 минут",
            cooldownMs: 5 * 60 * 1000
        },
        {
            id: "americano",
            label: "Американо",
            emoji: "☕",
            icon: "/static/larek/americano.png",
            effect: "+100 энергии",
            usage: "Раз в 3 часа",
            cooldownMs: 3 * 60 * 60 * 1000
        }
    ];

    let activeTab = "larek";
    let catalogCache = null;

    function escapeHtml(s) {
        const d = document.createElement("div");
        d.textContent = s;
        return d.innerHTML;
    }

    function starsForItem(user, itemId) {
        if (window.gearDisplay && typeof window.gearDisplay.starsForItem === "function") {
            return window.gearDisplay.starsForItem(user.gearUpgrades, itemId);
        }
        if (!itemId) return 0;
        const up = (user.gearUpgrades || {})[itemId];
        if (!up) return 1;
        if (up.until && up.until > Date.now()) return 0;
        return Math.min(4, Math.max(1, up.level || 1));
    }

    function isItemUpgrading(user, itemId) {
        if (window.gearDisplay && typeof window.gearDisplay.isItemUpgrading === "function") {
            return window.gearDisplay.isItemUpgrading(user.gearUpgrades, itemId);
        }
        const up = (user.gearUpgrades || {})[itemId];
        return !!(up && up.until && up.until > Date.now());
    }

    function resolveEquippedItem(eq, slot) {
        if (window.gearDisplay && typeof window.gearDisplay.resolveEquippedItem === "function") {
            return window.gearDisplay.resolveEquippedItem(eq, slot, catalogCache);
        }
        const item = eq[slot];
        if (!item) return null;
        if (item.id && catalogCache && catalogCache[item.id]) {
            return { ...catalogCache[item.id], id: item.id, ...item };
        }
        return item;
    }

    function findEquippedSlot(eq, itemId, catalogSlot) {
        if (!itemId) return null;
        if (catalogSlot === "amulet") {
            for (const s of AMULET_SLOTS) {
                if (eq[s]?.id === itemId) return s;
            }
            return null;
        }
        if (catalogSlot && eq[catalogSlot]?.id === itemId) return catalogSlot;
        for (const key of Object.keys(eq)) {
            if (eq[key]?.id === itemId) return key;
        }
        return null;
    }

    async function unequipItem({ itemId, slot }) {
        const payload = { email: getEmail() };
        if (itemId) payload.itemId = itemId;
        if (slot) payload.slot = slot;
        const { ok, data } = await postJson("/shop/unequip", payload);
        showMsg(ok ? data.message : data.error, !ok);
        if (data.user) await refreshGarderob(data.user);
        return ok;
    }

    function itemInnerHtml(item) {
        if (!item) return "";
        if (window.gearDisplay && typeof window.gearDisplay.itemInnerHtml === "function") {
            return window.gearDisplay.itemInnerHtml(item);
        }
        if (item.image || item.icon) {
            return `<img class="garderob-item-img" src="${escapeHtml(item.image || item.icon)}" alt="" loading="lazy">`;
        }
        return escapeHtml(item.emoji || "📦");
    }

    function itemEmoji(item) {
        if (!item) return "";
        return item.emoji || "📦";
    }

    function slotMeta(slot, kind) {
        return (
            SLOT_META[slot] || {
                ph: kind === "trophy" ? "trophy" : kind === "amulet" ? "amulet" : kind,
                label: slot
            }
        );
    }

    function renderEmptyCell(slot, kind) {
        const meta = slotMeta(slot, kind);
        return (
            `<div class="garderob-cell garderob-cell--empty garderob-cell--slot-${escapeHtml(meta.ph)}" ` +
            `data-slot="${escapeHtml(slot)}" title="${escapeHtml(meta.label)}">` +
            `<span class="garderob-slot-ph garderob-slot-ph--${escapeHtml(meta.ph)}" aria-hidden="true"></span>` +
            `<span class="garderob-slot-label">${escapeHtml(meta.label)}</span>` +
            `</div>`
        );
    }

    function renderGearCell(slot, kind, user) {
        const eq = user.equipment || {};
        const item = resolveEquippedItem(eq, slot);
        const meta = slotMeta(slot, kind);

        if (!item) {
            return renderEmptyCell(slot, kind);
        }

        return renderGearCellFilled(slot, kind, user, item, meta);
    }

    function renderGearCellFilled(slot, kind, user, item, meta) {
        const upgrading = item.id && isItemUpgrading(user, item.id);
        const stars = starsForItem(user, item.id);
        const kindClass =
            kind === "weapon"
                ? "garderob-cell--weapon"
                : kind === "clothes" || kind === "head" || kind === "boots"
                  ? `garderob-cell--${kind}`
                  : kind === "trophy"
                    ? "garderob-cell--trophy"
                    : "garderob-cell--amulet";

        const label = item.label || meta.label;
        return (
            `<div class="garderob-cell garderob-cell--gear garderob-cell--filled ${kindClass}${upgrading ? " garderob-cell--upgrading" : ""}" ` +
            `data-slot="${escapeHtml(slot)}"${item.id ? ` data-item-id="${escapeHtml(item.id)}"` : ""} ` +
            `role="button" tabindex="0" title="${escapeHtml(label)} — нажми, чтобы снять" aria-label="Снять: ${escapeHtml(label)}">` +
            `<span class="garderob-cell-inner">${itemInnerHtml(item)}</span>` +
            (stars > 0 ? `<span class="garderob-stars">${"★".repeat(stars)}</span>` : "") +
            `</div>`
        );
    }

    async function renderBuild(user) {
        const root = document.getElementById("garderobBuild");
        if (!root) return;

        const clubs = await loadClubsCatalog();
        const fill = clubAvatarFill(clubIdForTheme(user), clubs);
        const charLabel = CHARACTER_LABELS[user.character] || user.character || "Игрок";
        const avatarHtml = playerAvatarFrameHtml(user.avatar, {
            alt: charLabel,
            fill,
            className: "player-avatar-frame--garderob"
        });

        const eq = user.equipment || {};

        /* Сетка как в Hools: амулеты по углам, голова/обувь по центру, одежда/оружие по бокам. */
        const gridCells = [
            renderGearCell("amulet1", "amulet", user),
            renderGearCell("head", "head", user),
            renderGearCell("amulet2", "amulet", user),
            renderGearCell("clothes", "clothes", user),
            `<div class="garderob-cell garderob-cell--avatar">${avatarHtml}</div>`,
            renderGearCell("weapon", "weapon", user),
            renderGearCell("amulet3", "amulet", user),
            renderGearCell("boots", "boots", user),
            renderGearCell("amulet4", "amulet", user)
        ];

        const trophies = ["trophy1", "trophy2", "trophy3"]
            .map((s) => renderGearCell(s, "trophy", user))
            .join("");

        root.innerHTML =
            '<div class="garderob-grid">' +
            gridCells.join("") +
            "</div>" +
            '<div class="garderob-trophies">' +
            trophies +
            "</div>";

    }

    let shelfCooldownTimer = null;

    function cooldownRemainingMs(itemId, user, itemDef) {
        const used = (user.consumablesUsedAt || {})[itemId] || 0;
        const cd = itemDef.cooldownMs || 0;
        if (cd <= 0 || !used) return 0;
        const left = cd - (Date.now() - used);
        return left > 0 ? left : 0;
    }

    function formatShelfCooldown(ms) {
        const totalMin = Math.ceil(ms / 60000);
        if (totalMin >= 60) {
            const h = Math.ceil(ms / 3600000);
            return `${h} ч`;
        }
        if (ms < 5 * 60 * 1000) {
            const totalSec = Math.max(0, Math.ceil(ms / 1000));
            const m = Math.floor(totalSec / 60);
            const s = totalSec % 60;
            if (m > 0) return `${m} мин ${s} сек`;
            return `${s} сек`;
        }
        return `${totalMin} мин`;
    }

    function consumableDefById(itemId) {
        return FOOD_ITEMS.find((it) => it.id === itemId) || BATTLE_PROVISIONS.find((it) => it.id === itemId);
    }

    function consumableShelfIconHtml(it) {
        if (it.icon) {
            return `<img class="garderob-shelf-card-icon" src="${escapeHtml(it.icon)}" alt="" width="72" height="72">`;
        }
        return `<div class="garderob-shelf-card-icon garderob-shelf-card-icon--emoji" aria-hidden="true">${escapeHtml(it.emoji || "📦")}</div>`;
    }

    function renderConsumableShelfCard(user, it, kind) {
        const n = (user.consumables || {})[it.id] ?? 0;
        const remaining = cooldownRemainingMs(it.id, user, it);
        const onCd = remaining > 0;
        const timerHtml = onCd
            ? `<span class="garderob-shelf-cooldown" data-item="${escapeHtml(it.id)}" data-cooldown-ms="${it.cooldownMs}">⏳ <span class="garderob-shelf-cooldown-val">${escapeHtml(formatShelfCooldown(remaining))}</span></span>`
            : "";
        const btnClass = kind === "food" ? "garderob-use-food" : "garderob-use-provision";
        return (
            `<article class="garderob-shelf-card garderob-shelf-card--${kind}" data-item="${escapeHtml(it.id)}">` +
            consumableShelfIconHtml(it) +
            `<div class="garderob-shelf-card-body">` +
            `<div class="garderob-shelf-card-title">` +
            `<span class="garderob-shelf-card-name">${escapeHtml(it.label)}</span>${timerHtml}` +
            `</div>` +
            `<div class="garderob-shelf-card-owned">У тебя есть: <b>${n}</b></div>` +
            `<div class="garderob-shelf-card-meta">${escapeHtml(it.effect)} · ${escapeHtml(it.usage)}</div>` +
            `<button type="button" class="garderob-shelf-btn garderob-shelf-btn--use ${btnClass}" data-item="${escapeHtml(it.id)}" ${onCd ? "disabled" : ""}>Заточить</button>` +
            `</div></article>`
        );
    }

    function stopShelfCooldownTimer() {
        if (shelfCooldownTimer) {
            clearInterval(shelfCooldownTimer);
            shelfCooldownTimer = null;
        }
    }

    function updateShelfCooldowns(user) {
        let anyOnCd = false;
        document.querySelectorAll(".garderob-shelf-cooldown[data-item]").forEach((el) => {
            const itemId = el.dataset.item;
            const itemDef = consumableDefById(itemId);
            if (!itemDef) return;
            const remaining = cooldownRemainingMs(itemId, user, itemDef);
            const card = el.closest(".garderob-shelf-card");
            const btn = card?.querySelector(".garderob-shelf-btn--use");
            if (remaining > 0) {
                anyOnCd = true;
                const val = el.querySelector(".garderob-shelf-cooldown-val");
                if (val) val.textContent = formatShelfCooldown(remaining);
                if (btn) btn.disabled = true;
            } else {
                el.remove();
                if (btn) btn.disabled = false;
            }
        });
        if (!anyOnCd) stopShelfCooldownTimer();
    }

    function startShelfCooldownTimer(user) {
        stopShelfCooldownTimer();
        if (activeTab !== "larek") return;
        const hasCd = [...FOOD_ITEMS, ...BATTLE_PROVISIONS].some((it) => {
            if (((user.consumables || {})[it.id] ?? 0) < 1) return false;
            return cooldownRemainingMs(it.id, user, it) > 0;
        });
        if (!hasCd) return;
        shelfCooldownTimer = setInterval(() => {
            updateShelfCooldowns(window.__garderobUser || user);
        }, 1000);
    }

    function statLine(item, user) {
        if (!item || !item.id) return "";
        const up = (user.gearUpgrades || {})[item.id];
        const upgrading = up && up.until && up.until > Date.now();
        const slot = item.slot || catalogCache[item.id]?.slot;
        if (upgrading) {
            if (slot === "weapon") return "На прокачке в коллайдере";
            return "На прокачке в швейном цехе";
        }
        const level = up?.level || 1;
        const def = catalogCache[item.id] || item;
        const statKey =
            typeof window.gearDisplay?.primaryStatKey === "function"
                ? window.gearDisplay.primaryStatKey(def)
                : def.primaryStat || (def.slot === "weapon" ? "power" : "stamina");
        const statLabels = {
            power: "сила",
            stamina: "стойкость",
            speed: "ловкость",
            intel: "хитрость"
        };
        const bonus =
            typeof window.gearDisplay?.statBonusAtLevel === "function"
                ? window.gearDisplay.statBonusAtLevel(def, level)
                : Math.max(1, Number(def[statKey]) || 1) * level;
        if (!statLabels[statKey]) return "";
        return `${statLabels[statKey]} +${bonus}`;
    }

    function renderProvisions(user) {
        const c = user.consumables || {};
        const foodOwned = FOOD_ITEMS.filter((it) => (c[it.id] ?? 0) > 0);
        const battleOwned = BATTLE_PROVISIONS.filter((it) => (c[it.id] ?? 0) > 0);
        if (!foodOwned.length && !battleOwned.length) {
            return '<p class="garderob-empty-msg">Пусто. Загляни в <a href="/larek.html">ларёк</a> у мага Геннадия.</p>';
        }
        const cards = [];
        battleOwned.forEach((it) => {
            cards.push(renderConsumableShelfCard(user, it, "provision"));
        });
        foodOwned.forEach((it) => {
            cards.push(renderConsumableShelfCard(user, it, "food"));
        });
        return cards.join("");
    }

    function renderStuff(user) {
        const rows = [];
        const tickets = user.lotteryFreeTickets ?? 0;
        const passes = user.gymPasses ?? 0;
        if (tickets > 0) {
            rows.push(
                `<div class="garderob-shelf-item" title="Билет лотереи"><span class="garderob-shelf-emoji">🎟</span><span class="garderob-shelf-qty">${tickets}</span></div>`
            );
        }
        if (passes > 0) {
            rows.push(
                `<div class="garderob-shelf-item" title="Абонемент в качалку"><span class="garderob-shelf-emoji">🎫</span><span class="garderob-shelf-qty">${passes}</span></div>`
            );
        }
        if (!rows.length) {
            return '<p class="garderob-empty-msg">Штукенций пока нет.</p>';
        }
        return '<div class="garderob-shelf-grid">' + rows.join("") + "</div>";
    }

    function renderShelfGearCard(user, itemId, item, catalogSlot) {
        const eq = user.equipment || {};
        const equipSlot = findEquippedSlot(eq, itemId, catalogSlot);
        const worn = !!equipSlot;
        const upgrading = isItemUpgrading(user, itemId);
        let btnHtml;
        if (worn) {
            btnHtml =
                `<button type="button" class="garderob-shelf-btn garderob-shelf-btn--unequip garderob-unequip" ` +
                `data-item="${escapeHtml(itemId)}" data-slot="${escapeHtml(equipSlot)}">Надето · Снять</button>`;
        } else if (upgrading) {
            btnHtml = `<button type="button" class="garderob-shelf-btn" disabled>На прокачке</button>`;
        } else {
            btnHtml =
                `<button type="button" class="garderob-shelf-btn garderob-equip" data-item="${escapeHtml(itemId)}">Надеть</button>`;
        }
        let badge = "";
        if (worn) badge = `<span class="garderob-shelf-badge">надето</span>`;
        else if (upgrading) badge = `<span class="garderob-shelf-badge">прокачка</span>`;
        return (
            `<article class="garderob-shelf-card garderob-shelf-card--gear" data-item="${escapeHtml(itemId)}">` +
            `<span class="garderob-shelf-card-icon garderob-shelf-card-icon--gear">${itemInnerHtml(item)}</span>` +
            `<div class="garderob-shelf-card-body">` +
            `<div class="garderob-shelf-card-title">` +
            `<span class="garderob-shelf-card-name">${escapeHtml(item.label)}</span>${badge}` +
            `</div>` +
            `<div class="garderob-shelf-card-meta">${escapeHtml(statLine(item, user))}</div>` +
            btnHtml +
            `</div></article>`
        );
    }

    function renderAmuletsTab(user) {
        const inventory = user.inventory || [];
        const eq = user.equipment || {};
        const cards = [];
        const seen = new Set();

        AMULET_SLOTS.forEach((slot) => {
            const item = resolveEquippedItem(eq, slot);
            if (!item?.id) return;
            seen.add(item.id);
            cards.push(renderShelfGearCard(user, item.id, item, "amulet"));
        });

        inventory
            .filter((id) => catalogCache[id]?.slot === "amulet" && !seen.has(id))
            .forEach((id) => {
                cards.push(renderShelfGearCard(user, id, catalogCache[id], "amulet"));
            });

        if (!cards.length) {
            return '<p class="garderob-empty-msg">Амулетов пока нет.</p>';
        }
        return cards.join("");
    }

    function renderGearTab(user) {
        const inventory = user.inventory || [];
        const ids = inventory.filter((id) => catalogCache[id] && GEAR_CATALOG_SLOTS.has(catalogCache[id].slot));
        if (!ids.length) {
            return '<p class="garderob-empty-msg">Купи шмот у <a href="/market.html">дилера</a>.</p>';
        }
        return ids.map((id) => renderShelfGearCard(user, id, catalogCache[id], catalogCache[id].slot)).join("");
    }

    function renderPanel(user) {
        const panel = document.getElementById("garderobPanel");
        if (!panel) return;
        switch (activeTab) {
            case "larek":
                panel.innerHTML = renderProvisions(user);
                break;
            case "stuff":
                panel.innerHTML = renderStuff(user);
                break;
            case "amulets":
                panel.innerHTML = renderAmuletsTab(user);
                break;
            case "gear":
                panel.innerHTML = renderGearTab(user);
                break;
            default:
                panel.innerHTML = "";
        }
        bindPanelActions(user);
        stopShelfCooldownTimer();
        if (activeTab === "larek") startShelfCooldownTimer(user);
        applyGarderobFocus();
    }

    function bindPanelActions(user) {
        document.querySelectorAll(".garderob-use-food").forEach((btn) => {
            btn.addEventListener("click", async () => {
                if (btn.disabled) return;
                const { ok, data } = await postJson("/larek/use", {
                    email: getEmail(),
                    itemId: btn.dataset.item
                });
                showMsg(ok ? data.message : data.error, !ok);
                if (data.user) await refreshGarderob(data.user);
            });
        });

        document.querySelectorAll(".garderob-use-provision").forEach((btn) => {
            btn.addEventListener("click", async () => {
                if (btn.disabled) return;
                const { ok, data } = await postJson("/provisions/use", {
                    email: getEmail(),
                    itemId: btn.dataset.item
                });
                showMsg(ok ? data.message : data.error, !ok);
                if (data.user) await refreshGarderob(data.user);
            });
        });

        document.querySelectorAll(".garderob-equip").forEach((btn) => {
            btn.addEventListener("click", async () => {
                if (btn.disabled) return;
                const { ok, data } = await postJson("/shop/equip", {
                    email: getEmail(),
                    itemId: btn.dataset.item
                });
                showMsg(ok ? data.message : data.error, !ok);
                if (data.user) await refreshGarderob(data.user);
            });
        });

        document.querySelectorAll(".garderob-unequip").forEach((btn) => {
            btn.addEventListener("click", async () => {
                await unequipItem({
                    itemId: btn.dataset.item,
                    slot: btn.dataset.slot
                });
            });
        });
    }

    function bindBuildActions() {
        const root = document.getElementById("garderobBuild");
        if (!root) return;

        root.querySelectorAll(".garderob-cell--filled").forEach((cell) => {
            const activate = async () => {
                const slot = cell.dataset.slot;
                if (!slot) return;
                const eq = window.__garderobUser?.equipment || {};
                if (!resolveEquippedItem(eq, slot)) return;
                await unequipItem({
                    slot,
                    itemId: cell.dataset.itemId || undefined
                });
            };

            cell.addEventListener("click", activate);
            cell.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    activate();
                }
            });
        });
    }

    function bindTabs() {
        document.querySelectorAll(".garderob-tab").forEach((tab) => {
            tab.addEventListener("click", () => {
                activeTab = tab.dataset.tab || "larek";
                document.querySelectorAll(".garderob-tab").forEach((t) => {
                    t.classList.toggle("garderob-tab--active", t === tab);
                });
                const user = window.__garderobUser;
                if (user) renderPanel(user);
            });
        });
    }

    async function refreshGarderob(user) {
        window.__garderobUser = user;
        renderHeaderBlock(user);
        await renderBuild(user);
        bindBuildActions();
        renderPanel(user);
    }

    const GARDEROB_FOCUS_HP_ITEMS = ["black_chocolate", "choco_bar", "hotdog", "hamburger"];

    function applyTabFromUrl() {
        const tabParam = new URLSearchParams(window.location.search).get("tab");
        const valid = new Set(["larek", "stuff", "amulets", "gear"]);
        if (!tabParam || !valid.has(tabParam)) return;
        activeTab = tabParam;
        document.querySelectorAll(".garderob-tab").forEach((t) => {
            t.classList.toggle("garderob-tab--active", t.dataset.tab === activeTab);
        });
    }

    function applyGarderobFocus() {
        const focus = new URLSearchParams(window.location.search).get("focus");
        if (focus !== "hp") return;
        let card = null;
        for (const id of GARDEROB_FOCUS_HP_ITEMS) {
            card = document.querySelector(`.garderob-shelf-card[data-item="${id}"]`);
            if (card) break;
        }
        if (!card) return;
        card.classList.add("garderob-shelf-card--focus");
        requestAnimationFrame(() => {
            card.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
    }

    async function initGarderob(user, catalog) {
        catalogCache = catalog;
        window.__garderobUser = user;
        bindTabs();
        applyTabFromUrl();
        await renderBuild(user);
        bindBuildActions();
        renderPanel(user);
    }

    window.initGarderob = initGarderob;
    window.refreshGarderob = refreshGarderob;
})();
