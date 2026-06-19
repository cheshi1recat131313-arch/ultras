/**
 * Общее отображение экипировки (гардероб, «Шмот и оружие» после боя).
 */
(function () {
    const AMULET_SLOTS = ["amulet1", "amulet2", "amulet3", "amulet4"];
    const TROPHY_SLOTS = ["trophy1", "trophy2", "trophy3"];

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

    const SLOT_KIND = {
        head: "head",
        clothes: "clothes",
        weapon: "weapon",
        boots: "boots",
        amulet1: "amulet",
        amulet2: "amulet",
        amulet3: "amulet",
        amulet4: "amulet",
        trophy1: "trophy",
        trophy2: "trophy",
        trophy3: "trophy"
    };

    function escapeGearHtml(s) {
        const d = document.createElement("div");
        d.textContent = s == null ? "" : String(s);
        return d.innerHTML;
    }

    function slotMeta(slot, kind) {
        return (
            SLOT_META[slot] || {
                ph: kind === "trophy" ? "trophy" : kind === "amulet" ? "amulet" : kind || slot,
                label: slot
            }
        );
    }

    /** Звёзды прокачки — та же логика, что в гардеробе. */
    function starsForItem(gearUpgrades, itemId) {
        if (!itemId) return 0;
        const up = (gearUpgrades || {})[itemId];
        if (!up) return 1;
        if (up.until && up.until > Date.now()) return 0;
        return Math.min(4, Math.max(1, up.level || 1));
    }

    function isItemUpgrading(gearUpgrades, itemId) {
        const up = (gearUpgrades || {})[itemId];
        return !!(up && up.until && up.until > Date.now());
    }

    /** Бонус прокачки — цепочка слота: tier×maxStars + звёзды (см. gear-catalog.chainBonusAtLevel). */
    function statBonusAtLevel(def, level) {
        const maxLevel = def?.maxLevel || 3;
        const l = Math.min(maxLevel, Math.max(1, Math.floor(Number(level) || 1)));
        if (def?.bonusAtStars?.[l] != null) {
            return def.bonusAtStars[l];
        }
        if (Number.isFinite(def?.chainTier)) {
            return def.chainTier * maxLevel + l;
        }
        const statKey =
            def?.primaryStat ||
            (def?.slot === "weapon"
                ? "power"
                : def?.slot === "boots"
                  ? "speed"
                  : def?.slot === "head"
                    ? "intel"
                    : "stamina");
        const base = Math.max(1, Math.floor(Number(def?.[statKey]) || 1));
        return base * l;
    }

    function primaryStatKey(def) {
        if (def?.primaryStat) return def.primaryStat;
        if (def?.slot === "weapon") return "power";
        if (def?.slot === "boots") return "speed";
        if (def?.slot === "head") return "intel";
        return "stamina";
    }

    function resolveEquippedItem(eq, slot, catalog) {
        const item = eq?.[slot];
        if (!item) return null;
        if (item.id && catalog && catalog[item.id]) {
            return { ...catalog[item.id], id: item.id, ...item };
        }
        return item;
    }

    function itemInnerHtml(item) {
        if (!item) return "";
        if (item.image) {
            return `<img class="garderob-item-img" src="${escapeGearHtml(item.image)}" alt="" loading="lazy">`;
        }
        if (item.icon) {
            return `<img class="garderob-item-img" src="${escapeGearHtml(item.icon)}" alt="" loading="lazy">`;
        }
        return escapeGearHtml(item.emoji || "📦");
    }

    function renderEmptyGearCell(slot, kind) {
        const meta = slotMeta(slot, kind);
        return (
            `<div class="garderob-cell garderob-cell--empty garderob-cell--slot-${escapeGearHtml(meta.ph)}" ` +
            `data-slot="${escapeGearHtml(slot)}" title="${escapeGearHtml(meta.label)}">` +
            `<span class="garderob-slot-ph garderob-slot-ph--${escapeGearHtml(meta.ph)}" aria-hidden="true"></span>` +
            `<span class="garderob-slot-label">${escapeGearHtml(meta.label)}</span>` +
            `</div>`
        );
    }

    function renderFilledGearCell(slot, kind, item, gearUpgrades) {
        const meta = slotMeta(slot, kind);
        const upgrading = item.id && isItemUpgrading(gearUpgrades, item.id);
        const stars = item.id ? starsForItem(gearUpgrades, item.id) : 0;
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
            `data-slot="${escapeGearHtml(slot)}"` +
            (item.id ? ` data-item-id="${escapeGearHtml(item.id)}"` : "") +
            ` title="${escapeGearHtml(label)}">` +
            `<span class="garderob-cell-inner">${itemInnerHtml(item)}</span>` +
            (stars > 0 ? `<span class="garderob-stars">${"★".repeat(stars)}</span>` : "") +
            `</div>`
        );
    }

    function renderGearSlotCell(slot, kind, eq, catalog, gearUpgrades) {
        const item = resolveEquippedItem(eq, slot, catalog);
        if (!item) return renderEmptyGearCell(slot, kind);
        return renderFilledGearCell(slot, kind, item, gearUpgrades);
    }

    function isUsableAvatarSrc(src) {
        const s = src ? String(src).trim() : "";
        return s.length > 0 && s !== "null" && s !== "undefined";
    }

    function resolvePortraitFill(data, opts) {
        if (data.avatarFill) return data.avatarFill;
        const clubId = (data.club || opts.club || "").trim();
        const catalog = opts.clubsCatalog;
        if (clubId && typeof clubAvatarFill === "function" && catalog) {
            return clubAvatarFill(clubId, catalog);
        }
        return null;
    }

    function buildPortraitInner(data, opts) {
        const isPlayer = !!opts.isPlayer;
        const size = opts.avatarSize || 96;
        const avatarSrc = isUsableAvatarSrc(data.avatar) ? String(data.avatar).trim() : "";
        const fill = resolvePortraitFill(data, opts);
        const frameClass = isPlayer
            ? opts.playerFrameClass || "player-avatar-frame--garderob"
            : "player-avatar-frame--bot";
        const fallbackEmoji = isPlayer
            ? opts.characterEmoji || data.emoji || "🧍"
            : data.emoji || "👤";

        if (avatarSrc && typeof playerAvatarFrameHtml === "function") {
            let inner = playerAvatarFrameHtml(avatarSrc, {
                width: size,
                height: size,
                className: frameClass,
                fill,
                alt: data.name || ""
            });
            if (isPlayer && opts.clubEmblem) {
                inner =
                    `<div class="shmot-ava-badge-wrap">` +
                    inner +
                    `<img class="shmot-club-badge" src="${escapeGearHtml(opts.clubEmblem)}" width="22" height="22" alt="" loading="lazy">` +
                    `</div>`;
            }
            return inner;
        }

        const emojiClass = isPlayer ? "garderob-cell-inner" : "garderob-cell-inner shmot-id-emoji";
        return `<span class="${emojiClass}">${escapeGearHtml(fallbackEmoji)}</span>`;
    }

    function buildAvatarCell(data, opts) {
        const inner = buildPortraitInner(data, { ...opts, avatarSize: 96 });
        return `<div class="garderob-cell garderob-cell--avatar">${inner}</div>`;
    }

    /** Сетка экипировки — как в гардеробе (Hools). */
    function buildGarderobStyleGrid(data, opts) {
        opts = opts || {};
        const eq = data.equipment || {};
        const catalog = opts.catalog || {};
        const gearUpgrades = data.gearUpgrades || opts.gearUpgrades || {};

        const gridCells = [
            renderGearSlotCell("amulet1", "amulet", eq, catalog, gearUpgrades),
            renderGearSlotCell("head", "head", eq, catalog, gearUpgrades),
            renderGearSlotCell("amulet2", "amulet", eq, catalog, gearUpgrades),
            renderGearSlotCell("clothes", "clothes", eq, catalog, gearUpgrades),
            buildAvatarCell(data, opts),
            renderGearSlotCell("weapon", "weapon", eq, catalog, gearUpgrades),
            renderGearSlotCell("amulet3", "amulet", eq, catalog, gearUpgrades),
            renderGearSlotCell("boots", "boots", eq, catalog, gearUpgrades),
            renderGearSlotCell("amulet4", "amulet", eq, catalog, gearUpgrades)
        ];

        const trophies = TROPHY_SLOTS.map((s) =>
            renderGearSlotCell(s, "trophy", eq, catalog, gearUpgrades)
        ).join("");

        return (
            `<div class="garderob-build shmot-gear-build">` +
            `<div class="garderob-grid">${gridCells.join("")}</div>` +
            `<div class="garderob-trophies">${trophies}</div>` +
            `</div>`
        );
    }

    function renderOptionalAmuletCell(slot, eq, catalog, gearUpgrades) {
        const item = resolveEquippedItem(eq, slot, catalog);
        if (!item) {
            return `<div class="shmot-grid-spacer" aria-hidden="true"></div>`;
        }
        return renderFilledGearCell(slot, "amulet", item, gearUpgrades);
    }

    /** «Шмот и оружие»: голова/одежда/обувь/оружие + аватар всегда; амулеты/трофеи — только если надеты. */
    function buildEquippedOnlyGrid(data, opts) {
        opts = opts || {};
        const eq = data.equipment || {};
        const catalog = opts.catalog || {};
        const gearUpgrades = data.gearUpgrades || opts.gearUpgrades || {};

        const gridCells = [
            renderOptionalAmuletCell("amulet1", eq, catalog, gearUpgrades),
            renderGearSlotCell("head", "head", eq, catalog, gearUpgrades),
            renderOptionalAmuletCell("amulet2", eq, catalog, gearUpgrades),
            renderGearSlotCell("clothes", "clothes", eq, catalog, gearUpgrades),
            buildAvatarCell(data, opts),
            renderGearSlotCell("weapon", "weapon", eq, catalog, gearUpgrades),
            renderOptionalAmuletCell("amulet3", eq, catalog, gearUpgrades),
            renderGearSlotCell("boots", "boots", eq, catalog, gearUpgrades),
            renderOptionalAmuletCell("amulet4", eq, catalog, gearUpgrades)
        ];

        const trophyCells = TROPHY_SLOTS.map((slot) => {
            const item = resolveEquippedItem(eq, slot, catalog);
            if (!item) return "";
            return renderFilledGearCell(slot, "trophy", item, gearUpgrades);
        }).filter(Boolean);

        const trophiesHtml = trophyCells.length
            ? `<div class="garderob-trophies">${trophyCells.join("")}</div>`
            : "";

        return (
            `<div class="garderob-build shmot-gear-build">` +
            `<div class="garderob-grid">${gridCells.join("")}</div>` +
            trophiesHtml +
            `</div>`
        );
    }

    function buildShmotIdentityHeader(data, opts) {
        opts = opts || {};
        const isPlayer = !!opts.isPlayer;
        const name = escapeGearHtml(data.name || "—");
        const level = data.level != null ? Number(data.level) : "—";

        const avaInner = buildPortraitInner(data, {
            ...opts,
            avatarSize: 56,
            playerFrameClass: "player-avatar-frame--shmot-id"
        });

        let clubLine = "";
        if (isPlayer && (opts.clubName || opts.clubEmblem)) {
            const emb = opts.clubEmblem
                ? `<img class="shmot-id-club-ico" src="${escapeGearHtml(opts.clubEmblem)}" width="18" height="18" alt="" loading="lazy">`
                : "";
            clubLine = `<p class="shmot-id-club">${emb}<span>${escapeGearHtml(opts.clubName || "")}</span></p>`;
        }

        let nationLine = "";
        if (isPlayer && opts.nationalTeamName) {
            const flag = opts.nationalTeamFlag
                ? `<img class="shmot-id-flag" src="${escapeGearHtml(opts.nationalTeamFlag)}" width="20" height="14" alt="" loading="lazy">`
                : "";
            nationLine =
                `<p class="shmot-id-nation">${flag}<span>${escapeGearHtml(opts.nationalTeamName)}</span></p>`;
        }

        return (
            `<header class="shmot-identity">` +
            `<div class="shmot-identity-ava">${avaInner}</div>` +
            `<div class="shmot-identity-body">` +
            `<p class="shmot-identity-name">${name} <span class="shmot-identity-lvl">[${escapeGearHtml(String(level))}]</span></p>` +
            clubLine +
            nationLine +
            `</div>` +
            `</header>`
        );
    }

    /** @deprecated — используй buildGarderobStyleGrid */
    function buildShmotGearGrid(data, opts) {
        return buildGarderobStyleGrid(data, opts);
    }

    window.gearDisplay = {
        AMULET_SLOTS,
        TROPHY_SLOTS,
        starsForItem,
        isItemUpgrading,
        statBonusAtLevel,
        primaryStatKey,
        resolveEquippedItem,
        itemInnerHtml,
        buildGarderobStyleGrid,
        buildEquippedOnlyGrid,
        buildShmotIdentityHeader,
        buildShmotGearGrid,
        escapeGearHtml
    };
})();
