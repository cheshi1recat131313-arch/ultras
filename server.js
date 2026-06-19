const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { resolveDbPath, ensureDbDirectory } = require("./core/db-path");
const { parseJson } = require("./core/parse-json");
const { createPlayerStats } = require("./core/player-stats");
const fightSsr = require("./fight-ssr");
const xpLevels = require("./xp-levels");
const workLogic = require("./work-logic");
const clubsData = require("./clubs-data");
const dailyQuests = require("./daily-quests");
const mainQuests = require("./main-quests");
const playerEvents = require("./player-events");
const silverLoss = require("./silver-loss");
const happyHour = require("./happy-hour");
const gearUpgrades = require("./gear-upgrades");
const industrialWorkshop = require("./industrial-workshop");
const pubChat = require("./pub-chat");
const talismans = require("./talismans");
const talismanEffects = require("./talisman-effects");
const provisionsData = require("./provisions-data");
const purchaseLogic = require("./purchase-logic");
const stadiumEngine = require("./stadium-engine");
const stadiumTickets = require("./stadium-tickets");
const { buildBotDisplayGear } = require("./bot-display-gear");
const { createStadiumService } = require("./stadium-service");
const { createPubBattleModule } = require("./pub-battle");
const { createNationalTeamsModule } = require("./national-teams");
const { createPackagesModule } = require("./packages");
const { createAuthModule, isRecoveryEmail: isUserRecoveryEmail } = require("./auth");
const nationalTeamsData = require("./national-teams/data");
const { createRepEarningsService } = require("./rep-earnings");
const { createHeroOfDayService } = require("./hero-of-day");
const { buildClubElitePayload, rankTitleFromTotalSkulls } = require("./club-elite");
const { createClubReputationRatingService } = require("./club-reputation-rating");
const stadiumBots = require("./stadium-bots");
const playerOnline = require("./player-online");
const districtNpcTheme = require("./district-npc-theme");
const { resolveDistrictOpponentDisplay } = require("./district-opponent-display");
const clubCharacters = require("./club-characters");
const {
    createDistrictPlayersService,
    PLAYER_SLOT_INDEX,
    NPC_SLOT_GOP,
    NPC_SLOT_FAN
} = require("./district-players");
const { createFirmsService } = require("./firms/service");
const { registerFirmsRoutes } = require("./firms/routes");
const { createReferralsModule } = require("./referrals");
const { createSqliteDatabase } = require("./core/sqlite-connection");
const express = require("express");

const app = express();
const PORT = 3000;
const MIN_EMAIL_LENGTH = 5;
const MIN_PASSWORD_LENGTH = 6;
const MAX_ENERGY = 100;
const MAX_HP_CAP = 100;
const MIN_DISTRICT_HP = 35;
const START_RUBLES = 69;
const START_DOLLARS = 10;
const START_MUSHROOMS = 30;
const REGEN_TICK_MS = 30 * 1000;
const XP_PER_GRANT = 1;
/** Опыт по таймеру: не чаще 1 раза в 2 ч 30 мин (район только проверяет окно). */
const XP_GRANT_COOLDOWN_MS = 150 * 60 * 1000;
const MAX_HP_BASE = 80;
const GYM_COST_BASE = 12;
const TATTOO_COST = 45;
const TATTOO_DURATION_MS = 12 * 60 * 60 * 1000;
const FIGHT_ENERGY_COST = 1;
const REP_PER_DISTRICT_WIN = 1;
const SKULL_EVERY_REP = 5;
const MAX_RAGE = 150;
const RAGE_BASE = 100;
const RAGE_ON_LOSS = 10;
const STEWARD_COOLDOWN_MS = 4 * 60 * 60 * 1000;
const DISTRICT_SLOT_COUNT = 3;
const KICKER_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const KICKER_OPPONENTS = {
    ney: { name: "Нэй", cost: 9, win: 1, power: 10 },
    massi: { name: "Масси", cost: 99, win: 3, power: 15 },
    ronny: { name: "Ронни", cost: 199, win: 7, power: 22 }
};
const LOTTERY_COST = 10;

const CHARACTER_STATS = {
    tank: { power: 14, speed: 8, intel: 8, stamina: 14 },
    fast: { power: 8, speed: 14, intel: 10, stamina: 10 },
    balanced: { power: 10, speed: 10, intel: 10, stamina: 10 },
    tough: { power: 11, speed: 9, intel: 9, stamina: 15 },
    redhead: { power: 9, speed: 13, intel: 10, stamina: 9 },
    fighter: { power: 15, speed: 8, intel: 7, stamina: 13 },
    chick: { power: 10, speed: 11, intel: 11, stamina: 10 }
};

/** Портреты ботов на районе — см. district-npc-theme.js */
const BOT_AVATAR = districtNpcTheme.DISTRICT_NPC_BOT_AVATARS;

function botAvatarPath(botId) {
    return districtNpcTheme.districtNpcBotAvatar(botId) || BOT_AVATAR[botId] || null;
}

function districtOpponentDisplay(opponent) {
    return resolveDistrictOpponentDisplay(opponent, {
        botAvatarPath,
        getClubAvatarTheme: (club) => clubsData.getClubAvatarTheme(club)
    });
}

/** Район: PNG у NPC; у игрока и «Чужого фана» — портрет и клубный фон. */
function enrichBotSlot(bot) {
    if (!bot) return null;
    if (bot.isPlayer) {
        return {
            ...bot,
            avatar: bot.avatar || avatarPath(bot.character),
            club: bot.club || null,
            level: Math.max(1, Math.floor(Number(bot.level) || 1)),
            emoji: bot.emoji || "👤",
            isPlayer: true
        };
    }
    const id = bot.templateId || bot.id;
    if (id === "fan") {
        const seed =
            bot.appearanceSeed ||
            `${bot.templateId || "fan"}:${bot.name || "fan"}:${randomInt(1, 999999999)}`;
        const appearance = clubCharacters.pickDistrictFanAppearance(null, seed);
        const out = {
            ...bot,
            character: appearance.character,
            club: appearance.club,
            avatar: appearance.avatar,
            appearanceSeed: seed,
            emoji: bot.emoji || "🧢",
            isPlayer: false
        };
        delete out.targetEmail;
        return out;
    }
    const districtAvatar = botAvatarPath(id);
    const out = {
        ...bot,
        avatar: districtAvatar || bot.avatar || null,
        club: bot.club || null,
        character: bot.character || null,
        emoji: bot.emoji || "👤",
        isPlayer: false
    };
    delete out.targetEmail;
    return out;
}

function districtNpcTemplate(templateId) {
    const tpl = DISTRICT_WEAK_BOTS.find((b) => b.id === templateId);
    if (tpl) return tpl;
    return DISTRICT_WEAK_BOTS[0];
}

function decorateFanBot(bot, user, appearanceSeed) {
    const seed =
        appearanceSeed ||
        `${user?.email || "fan"}:${Date.now()}:${randomInt(1, 999999999)}`;
    const appearance = clubCharacters.pickDistrictFanAppearance(user?.club, seed);
    return {
        ...bot,
        character: appearance.character,
        club: appearance.club,
        avatar: appearance.avatar,
        appearanceSeed: seed
    };
}

function buildDistrictPlayerSlot(row) {
    const level = Math.max(1, Math.floor(Number(row.level) || 1));
    const scale = (1.12 + (level - 1) * 0.02) * (level <= 1 ? 1.08 : 1);
    return {
        templateId: "player",
        name: row.name || "Игрок",
        phrase: districtPlayers().randomPlayerPhrase(),
        emoji: "👤",
        character: row.character,
        club: row.club,
        avatar: avatarPath(row.character),
        level,
        power: Math.round(10 * scale),
        speed: Math.round(10 * scale),
        intel: Math.round(10 * scale),
        stamina: Math.round(10 * scale),
        rubles: [3, 10],
        xp: [8, 12],
        isPlayer: true,
        targetEmail: String(row.email || "").trim().toLowerCase(),
        isSteward: false
    };
}

async function buildDistrictNpcSlot(slotIndex, user, level, playerEff) {
    if (slotIndex === NPC_SLOT_FAN) {
        return decorateFanBot(
            scaleWeakDistrictBot(districtNpcTemplate("fan"), level),
            user,
            `${user.email}:fan:${Date.now()}:${randomInt(1, 999999999)}`
        );
    }
    if (slotIndex === NPC_SLOT_GOP) {
        return scaleWeakDistrictBot(districtNpcTemplate("gop"), level);
    }
    return pickRefillNpc(user, playerEff, level);
}

async function pickRefillNpc(user, playerEff, level) {
    const now = Date.now();
    const lastSt = user.last_steward_spawn ?? 0;
    if (now - lastSt >= STEWARD_COOLDOWN_MS) {
        await runQuery("UPDATE users SET last_steward_spawn = ? WHERE email = ?", [now, user.email]);
        return scaleStewardBot(STEWARD_BOT, level, playerEff);
    }
    const npcPool = DISTRICT_WEAK_BOTS.filter((b) => b.id !== "fan");
    const tpl = npcPool[randomInt(0, npcPool.length - 1)];
    return scaleWeakDistrictBot(tpl, level);
}

/** Первые 5 — районные боты (сила задаётся балансом боя). */
const DISTRICT_WEAK_BOTS = [
    {
        id: "boro",
        name: "Бородач",
        phrase: "Р-р-р-ребят, я свой.",
        emoji: "🧔",
        power: 6,
        speed: 7,
        intel: 5,
        stamina: 8,
        rubles: [3, 10],
        xp: [8, 12]
    },
    {
        id: "kopch",
        name: "Копченый",
        phrase: "Чё нна?! Иди сюда нна!",
        emoji: "🥓",
        power: 7,
        speed: 8,
        intel: 6,
        stamina: 8,
        rubles: [4, 10],
        xp: [8, 14]
    },
    {
        id: "gop",
        name: "Гопник",
        phrase: "Сейчас как дам в ебло!",
        emoji: "👊",
        power: 7,
        speed: 7,
        intel: 5,
        stamina: 9,
        rubles: [3, 10],
        xp: [8, 13]
    },
    {
        id: "fan",
        name: "Чужой фан",
        phrase: "Ваши цвета — дерьмо.",
        emoji: "🧢",
        power: 8,
        speed: 9,
        intel: 6,
        stamina: 9,
        rubles: [4, 10],
        xp: [9, 15]
    },
    {
        id: "rayon",
        name: "Районный",
        phrase: "Тут наши правила.",
        emoji: "🏘️",
        power: 8,
        speed: 8,
        intel: 7,
        stamina: 10,
        rubles: [5, 10],
        xp: [10, 16]
    }
];

/** Серьёзный противник: ~раз в 4 ч, даёт доллары. */
const STEWARD_BOT = {
    id: "steward",
    name: "Стюард",
    phrase: "Колющее режущее имеется?",
    emoji: "🧐",
    power: 24,
    speed: 16,
    intel: 14,
    stamina: 18,
    rubles: [18, 32],
    xp: [12, 18],
    dollars: [1, 5],
    isSteward: true
};

const {
    SHOP_ITEMS,
    shopSections,
    primaryStatForItem
} = require("./gear-catalog");

const { getActiveTattoos, getEquipmentBonuses, getEffectiveStats } = createPlayerStats(SHOP_ITEMS);

function getUserInventory(row) {
    const raw = parseJson(row.inventory, []);
    return Array.isArray(raw) ? raw.filter((id) => SHOP_ITEMS[id]) : [];
}

/** Ларёк у мага Геннадия — расходники (покупка; использование — отдельно). */
const LAREK_ITEMS = {
    americano: {
        id: "americano",
        label: "Стаканчик Американо",
        emoji: "☕",
        icon: "/static/larek/americano.png",
        description: "Помогает быстрее закончить работу.",
        effectLabel: "Энергия: +100",
        usageLimit: "Использование: не чаще 1 раза в 5 часов.",
        cost: 7,
        currency: "rubles",
        cooldownMs: 3 * 60 * 60 * 1000,
        useEnergy: 100
    },
    hamburger: {
        id: "hamburger",
        label: "Гамбургер",
        emoji: "🍔",
        icon: "/static/larek/hamburger.png",
        description: "Восстанавливает здоровье.",
        effectLabel: "Здоровье: +100",
        usageLimit: "Использование: не чаще 1 раза в 60 минут.",
        cost: 5,
        currency: "rubles",
        cooldownMs: 60 * 60 * 1000,
        useHp: 100
    },
    hotdog: {
        id: "hotdog",
        label: "Хот-дог",
        emoji: "🌭",
        icon: "/static/larek/hotdog.png",
        description: "Восстанавливает здоровье.",
        effectLabel: "Здоровье: +100",
        usageLimit: "Использование: не чаще 1 раза в 5 минут.",
        cost: 5,
        currency: "mushrooms",
        cooldownMs: 5 * 60 * 1000,
        useHp: 100,
        useSuccessMessage: "🌭 Хот-дог съеден. Здоровье восстановлено."
    }
};

function getUserConsumables(row) {
    const raw = parseJson(row.consumables, {});
    const out = {};
    for (const id of Object.keys(LAREK_ITEMS)) {
        out[id] = Math.max(0, Math.floor(Number(raw[id]) || 0));
    }
    for (const id of provisionsData.PROVISION_IDS) {
        out[id] = Math.max(0, Math.floor(Number(raw[id]) || 0));
    }
    return out;
}

function findConsumableItem(itemId) {
    return LAREK_ITEMS[itemId] || provisionsData.PROVISION_ITEMS[itemId] || null;
}

function larekFoodCatalogForShop(consumables) {
    return Object.keys(LAREK_ITEMS).map((id) => {
        const def = LAREK_ITEMS[id];
        return {
            id: def.id,
            label: def.label,
            icon: def.icon,
            emoji: def.emoji,
            description: def.description,
            usageHtml: def.usageLimit,
            effectHtml: def.effectLabel,
            cost: def.cost,
            currency: def.currency,
            count: consumables[id] || 0,
            kind: "food"
        };
    });
}

function getConsumablesUsedAt(row) {
    const raw = parseJson(row.consumables_used_at, {});
    const out = { ...provisionsData.parseProvisionUsedAt(raw) };
    for (const id of Object.keys(LAREK_ITEMS)) {
        const t = Math.floor(Number(raw[id]) || 0);
        if (t > 0) out[id] = t;
    }
    return out;
}

function formatCooldownWait(ms) {
    const totalMin = Math.ceil(ms / 60000);
    if (totalMin >= 60) {
        const h = Math.ceil(ms / 3600000);
        return `${h} ч.`;
    }
    return `${totalMin} мин.`;
}

function formatCooldownMinSec(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m} мин ${s} сек`;
}

function equipmentItemFromShop(itemId) {
    const def = SHOP_ITEMS[itemId];
    if (!def) return null;
    const statKey = primaryStatForItem(def);
    return {
        id: itemId,
        slot: def.slot,
        label: def.label,
        emoji: def.emoji,
        power: statKey === "power" ? def.power || 0 : 0,
        speed: statKey === "speed" ? def.speed || 0 : 0,
        intel: statKey === "intel" ? def.intel || 0 : 0,
        stamina: statKey === "stamina" ? def.stamina || 0 : 0
    };
}

function shopItemForApi(id, def) {
    const statKey = primaryStatForItem(def);
    return {
        id,
        slot: def.slot,
        label: def.label,
        emoji: def.emoji,
        icon: def.icon || null,
        image: def.image || def.icon || null,
        cost: def.cost,
        currency: def.currency || "rubles",
        power: def.power || 0,
        speed: def.speed || 0,
        intel: def.intel || 0,
        stamina: def.stamina || 0,
        minLevel: def.minLevel,
        maxLevel: def.maxLevel || 3,
        primaryStat: statKey,
        chainTier: def.chainTier,
        bonusAtStars: def.bonusAtStars || null,
        maxBonus: def.maxBonus ?? null,
        shopHidden: !!def.shopHidden
    };
}
const DB_PATH = resolveDbPath();
ensureDbDirectory(DB_PATH);

let runQuery;
let getQuery;
let allQuery;
let runTransaction;

app.use(express.json());

/** Как на hools: относительные ссылки fight?kick=… и district?secret_key=… ведут на наши страницы. */
function redirectPreserveQuery(req, res, targetBase) {
    const q = req.url.indexOf("?");
    const qs = q >= 0 ? req.url.slice(q) : "";
    res.redirect(302, targetBase + qs);
}

app.get("/district", (req, res) => {
    redirectPreserveQuery(req, res, "/district.html");
});

app.get("/stadium", (req, res) => {
    redirectPreserveQuery(req, res, "/stadium.html");
});

app.get("/stadium/schedule", (req, res) => {
    redirectPreserveQuery(req, res, "/stadium-schedule.html");
});

app.get("/stadium/kassa", (req, res) => {
    redirectPreserveQuery(req, res, "/stadium-kassa.html");
});

app.get("/center", (req, res) => {
    redirectPreserveQuery(req, res, "/center.html");
});

app.get("/work", (req, res) => {
    redirectPreserveQuery(req, res, "/work.html");
});

app.get("/tasks", (req, res) => {
    redirectPreserveQuery(req, res, "/tasks.html");
});

app.get("/tasks/quest", (req, res) => {
    redirectPreserveQuery(req, res, "/tasks-quest.html");
});

app.get("/events", (req, res) => {
    redirectPreserveQuery(req, res, "/events.html");
});

app.get("/events/detail", (req, res) => {
    redirectPreserveQuery(req, res, "/event-detail.html");
});

function buildDisplayLogLinesFromStored(log) {
    const firstSys = log.find((x) => x.who === "sys" && x.text);
    const logLines = [];
    if (firstSys && firstSys.text) {
        logLines.push(`<p class="fight-quote">${fightSsr.escapeHtml(firstSys.text)}</p>`);
    }
    for (const row of log) {
        if (row.html) logLines.push(row.html);
    }
    for (const row of log) {
        if (!row.text || row.html) continue;
        if (row.text === (firstSys && firstSys.text)) continue;
        const t = row.text;
        if (/^Победа!/i.test(t) || /разобрался/i.test(t)) continue;
        logLines.push(`<p class="fight-end-msg">${fightSsr.escapeHtml(t)}</p>`);
    }
    return logLines;
}

async function resolveEventBattleView(email, detail) {
    if (!detail || typeof detail !== "object") return null;
    if (detail.battleView && Array.isArray(detail.battleView.logLines) && detail.battleView.logLines.length) {
        return detail.battleView;
    }

    const user = await getQuery("SELECT name, avatar, club FROM users WHERE email = ?", [email]);
    if (!user) return null;

    let opponentName = detail.opponentName || "Соперник";
    let opponentEmoji = detail.opponentEmoji || "👤";
    let opponentAvatar = detail.opponentAvatar || null;
    let logLines = Array.isArray(detail.logLines) ? detail.logLines : [];
    let status = detail.fightStatus === "won" ? "won" : "lost";
    let totalToEnemy = detail.totalToEnemy ?? 0;
    let totalToPlayer = detail.totalToPlayer ?? 0;

    if (detail.fightId) {
        const fight = await getQuery(
            "SELECT log, status, opponent FROM district_fights WHERE id = ? AND email = ?",
            [detail.fightId, email]
        );
        if (fight) {
            const opponent = parseJson(fight.opponent, {});
            opponentName = opponent.name || opponentName;
            opponentEmoji = opponent.emoji || opponentEmoji;
            opponentAvatar =
                opponent.avatar || botAvatarPath(opponent.templateId || opponent.id) || opponentAvatar;
            status = fight.status === "won" ? "won" : "lost";
            if (!logLines.length) {
                const log = parseJson(fight.log, []);
                logLines = buildDisplayLogLinesFromStored(log);
                const dmg = fightSsr.sumHitDamageFromLogRows(log);
                totalToEnemy = dmg.toEnemy;
                totalToPlayer = dmg.toPlayer;
            }
        }
    }

    if (!logLines.length) return null;

    return {
        status,
        playerName: user.name || "Игрок",
        playerEmail: email,
        opponentName,
        opponentEmail: detail.opponentEmail || null,
        opponentEmoji,
        opponentAvatar,
        playerAvatar: user.avatar,
        playerAvatarFill: clubsData.getClubAvatarTheme(user.club)?.fill || null,
        logLines,
        totalToEnemy,
        totalToPlayer,
        rublesGain: detail.rublesGain ?? 0,
        silverLoss: detail.silverLoss ?? 0,
        repGain: detail.repGain ?? 0,
        xpGain: detail.xpGain ?? 0,
        dollarsGain: detail.dollarsGain ?? 0,
        skullsEarned: detail.skullsEarned ?? 0,
        levelUp: detail.levelUp ?? null,
        statPointsMessage: detail.statPointsMessage ?? null,
        fightId: detail.fightId || null
    };
}

app.get("/api/events", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        if (!email) {
            res.status(400).json({ success: false, error: "Email обязателен" });
            return;
        }
        const rows = await allQuery(
            `SELECT id, kind, summary, created_at, detail_json FROM player_events WHERE email = ? ORDER BY created_at DESC LIMIT ?`,
            [email, playerEvents.MAX_PLAYER_EVENTS]
        );
        const events = rows.map((r) => {
            const detail = parseJson(r.detail_json, {});
            return {
                id: r.id,
                kind: r.kind,
                summary: r.summary,
                summaryHtml: playerEvents.eventSummaryHtml(r.kind, detail, r.summary),
                createdAt: r.created_at,
                timeLabel: playerEvents.formatEventTimestamp(r.created_at)
            };
        });
        res.json({ success: true, events });
    } catch (error) {
        console.error("events list error:", error);
        res.status(500).json({ success: false, error: "Ошибка загрузки событий" });
    }
});

app.get("/api/events/detail", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        const id = String(req.query.id || "").trim();
        if (!email || !id) {
            res.status(400).json({ success: false, error: "Нужны email и id" });
            return;
        }
        const row = await getQuery(
            "SELECT * FROM player_events WHERE id = ? AND email = ?",
            [id, email]
        );
        if (!row) {
            res.status(404).json({ success: false, error: "Событие не найдено" });
            return;
        }
        const detail = parseJson(row.detail_json, {});
        const battleView = playerEvents.isFightKind(row.kind)
            ? await resolveEventBattleView(email, detail)
            : null;
        res.json({
            success: true,
            event: {
                id: row.id,
                kind: row.kind,
                summary: row.summary,
                summaryHtml: playerEvents.eventSummaryHtml(row.kind, detail, row.summary),
                createdAt: row.created_at,
                timeLabel: playerEvents.formatEventTimestamp(row.created_at),
                detail,
                battleView,
                detailText: detail.text || ""
            }
        });
    } catch (error) {
        console.error("events detail error:", error);
        res.status(500).json({ success: false, error: "Ошибка загрузки события" });
    }
});

app.get("/rating", (req, res) => {
    redirectPreserveQuery(req, res, "/rating.html");
});

let repEarningsService = null;
let heroOfDayService = null;
let districtPlayersService = null;

function districtPlayers() {
    if (!districtPlayersService) {
        districtPlayersService = createDistrictPlayersService({
            runQuery,
            allQuery,
            minDistrictHp: MIN_DISTRICT_HP
        });
    }
    return districtPlayersService;
}

/** Элита клуба — черепки за 7 дней, все игроки клуба. */
app.get("/rating/club-elite", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }
        if (!user.club) {
            res.status(400).json({ success: false, error: "Сначала выбери клуб." });
            return;
        }
        if (!repEarningsService) {
            res.status(503).json({ success: false, error: "Сервис рейтинга недоступен" });
            return;
        }

        const sinceMs = Date.now() - repEarningsService.RETENTION_MS;
        const weeklyMap = await repEarningsService.sumWeeklySkullsByClub(user.club, sinceMs);
        const members = await allQuery(
            "SELECT email, name, level, character, club FROM users WHERE club = ? ORDER BY name ASC",
            [user.club]
        );
        const clubName = clubsData.getClubName(user.club) || user.club;
        const players = members.map((m) => {
            const key = normalizeEmail(m.email);
            const w = weeklyMap[key] || { weeklySkulls: 0 };
            return {
                email: key,
                name: m.name || "Игрок",
                level: m.level ?? 1,
                avatar: avatarPath(m.character),
                club: m.club || user.club || null,
                weeklySkulls: w.weeklySkulls
            };
        });

        const elite = buildClubElitePayload(clubName, players, email);
        res.json({ success: true, elite });
    } catch (error) {
        console.error("rating/club-elite error:", error);
        res.status(500).json({ success: false, error: "Ошибка элиты клуба" });
    }
});

/** Лучшие из лучших — рейтинг игроков по репутации. */
app.get("/rating/top-best", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
        const perPage = Math.min(50, Math.max(1, Math.floor(Number(req.query.perPage) || 20)));

        if (email) {
            const viewer = await requireExistingUser(email);
            if (!viewer) {
                res.status(404).json({ success: false, error: "Пользователь не найден" });
                return;
            }
        }

        res.json(await buildReputationRankingResponse({ email, page, perPage }));
    } catch (error) {
        console.error("rating/top-best error:", error);
        res.status(500).json({ success: false, error: "Ошибка рейтинга" });
    }
});

/** Лучшие на уровне — рейтинг игроков того же уровня по репутации. */
app.get("/rating/level-best", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
        const perPage = Math.min(50, Math.max(1, Math.floor(Number(req.query.perPage) || 20)));

        const viewer = email ? await requireExistingUser(email) : null;
        if (email && !viewer) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        const filterLevel = viewer ? levelFromXp(normalizeXp(viewer.xp)) : null;
        if (filterLevel == null) {
            res.status(400).json({ success: false, error: "Укажите email игрока" });
            return;
        }

        res.json(
            await buildReputationRankingResponse({
                email,
                page,
                perPage,
                filterLevel
            })
        );
    } catch (error) {
        console.error("rating/level-best error:", error);
        res.status(500).json({ success: false, error: "Ошибка рейтинга" });
    }
});

/** Каталог сборных — до static, чтобы всегда отдавался JSON (досье и др.). */
app.get("/national-teams/catalog", (req, res) => {
    try {
        res.json({ success: true, teams: nationalTeamsData.teamsCatalogForClient() });
    } catch (error) {
        console.error("national-teams/catalog error:", error);
        res.status(500).json({ success: false, error: "Ошибка каталога сборных" });
    }
});

/** Рейтинг клубов — сумма репутации всех игроков клуба. */
app.get("/rating/clubs", async (req, res) => {
    try {
        if (!clubReputationRatingService) {
            res.status(503).json({ success: false, error: "Сервис рейтинга клубов не готов" });
            return;
        }
        const clubs = await clubReputationRatingService.buildClubRankings();
        res.json({ success: true, clubs });
    } catch (error) {
        console.error("rating/clubs error:", error);
        res.status(500).json({ success: false, error: "Ошибка загрузки рейтинга клубов" });
    }
});

app.get("/fight", async (req, res) => {
    try {
        const kick = String(req.query.kick || "").trim();
        if (!kick) {
            res.status(400).type("html").send(fightSsr.buildFightPageHtml({ ok: false, error: "В ссылке нет параметра kick." }));
            return;
        }
        const out = await runDistrictFight(null, kick);
        if (!out.ok && out.code === "low_hp") {
            const hp = Math.round(out.hp ?? 0);
            res.redirect(302, `/district.html?lowHp=1&hp=${hp}`);
            return;
        }
        if (!out.ok && out.code === "no_rubles") {
            res.redirect(302, "/district.html?noRubles=1");
            return;
        }
        if (!out.ok && out.code === "low_energy") {
            res.redirect(302, "/district.html?lowEnergy=1");
            return;
        }
        if (!out.ok && out.code === "player_protected") {
            res.redirect(302, "/district.html?playerProtected=1");
            return;
        }
        res.status(out.ok ? 200 : 400).type("html").send(fightSsr.buildFightPageHtml(out));
    } catch (error) {
        console.error("GET /fight error:", error);
        res.status(500).type("html").send(fightSsr.buildFightPageHtml({ ok: false, error: "Ошибка сервера при бое." }));
    }
});

app.use(express.static(path.join(__dirname, "public")));

async function initDatabase() {
    await runQuery("PRAGMA busy_timeout = 5000");
    await runQuery("PRAGMA journal_mode = WAL");

    await runQuery(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT,
            character TEXT,
            club TEXT,
            power INTEGER DEFAULT 10,
            speed INTEGER DEFAULT 10,
            intel INTEGER DEFAULT 10,
            stamina INTEGER DEFAULT 10,
            xp INTEGER DEFAULT 0,
            level INTEGER DEFAULT 1,
            energy INTEGER DEFAULT 100,
            money INTEGER DEFAULT 69,
            rubles INTEGER DEFAULT 69,
            dollars INTEGER DEFAULT 10,
            mushrooms INTEGER DEFAULT 30,
            tattoos TEXT DEFAULT '{}',
            equipment TEXT DEFAULT '{}',
            hp INTEGER DEFAULT 80,
            max_hp INTEGER DEFAULT 80
        )
    `);

    await runQuery(`
        CREATE TABLE IF NOT EXISTS battles (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            opponent TEXT NOT NULL,
            player_hp INTEGER NOT NULL,
            enemy_hp INTEGER NOT NULL,
            enemy_max_hp INTEGER NOT NULL,
            player_blocking INTEGER DEFAULT 0,
            enemy_blocking INTEGER DEFAULT 0,
            turn_owner TEXT DEFAULT 'player',
            status TEXT DEFAULT 'active',
            log TEXT DEFAULT '[]'
        )
    `);

    await runQuery(`
        CREATE TABLE IF NOT EXISTS district_spawn (
            spawn_id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            bots_json TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )
    `);
    await runQuery(`
        CREATE TABLE IF NOT EXISTS district_fights (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            spawn_id TEXT NOT NULL,
            bot_index INTEGER NOT NULL,
            opponent TEXT NOT NULL,
            player_hp INTEGER NOT NULL,
            enemy_hp INTEGER NOT NULL,
            enemy_max_hp INTEGER NOT NULL,
            status TEXT DEFAULT 'active',
            log TEXT DEFAULT '[]',
            energy_spent INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL
        )
    `);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_district_fights_email ON district_fights(email)`);
    await runQuery(`
        CREATE TABLE IF NOT EXISTS district_kick_tokens (
            token TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            spawn_id TEXT NOT NULL,
            bot_index INTEGER NOT NULL,
            fight_id TEXT,
            side TEXT NOT NULL,
            used INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL
        )
    `);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_kick_spawn ON district_kick_tokens(spawn_id, bot_index)`);

    await runQuery(`
        CREATE TABLE IF NOT EXISTS stadium_matches (
            id TEXT PRIMARY KEY,
            level INTEGER NOT NULL,
            home_club TEXT NOT NULL,
            away_club TEXT NOT NULL,
            status TEXT NOT NULL,
            starts_at INTEGER NOT NULL,
            ends_at INTEGER NOT NULL,
            score_home INTEGER DEFAULT 0,
            score_away INTEGER DEFAULT 0,
            fighters_json TEXT NOT NULL,
            feed_json TEXT NOT NULL,
            meta_json TEXT NOT NULL DEFAULT '{}',
            created_at INTEGER NOT NULL
        )
    `);
    await runQuery(
        `CREATE INDEX IF NOT EXISTS idx_stadium_level_status ON stadium_matches(level, status)`
    );

    await runQuery(`
        CREATE TABLE IF NOT EXISTS stadium_newspaper (
            id TEXT PRIMARY KEY,
            match_id TEXT NOT NULL UNIQUE,
            level INTEGER NOT NULL,
            report_json TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )
    `);
    await runQuery(
        `CREATE INDEX IF NOT EXISTS idx_stadium_newspaper_created ON stadium_newspaper(created_at DESC)`
    );

    await runQuery(`
        CREATE TABLE IF NOT EXISTS stadium_club_rating (
            club TEXT PRIMARY KEY,
            points INTEGER NOT NULL DEFAULT 0
        )
    `);

    await runQuery(`
        CREATE TABLE IF NOT EXISTS mail_messages (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            category TEXT NOT NULL,
            subject TEXT,
            body_json TEXT NOT NULL DEFAULT '{}',
            ref_id TEXT,
            read_at INTEGER,
            created_at INTEGER NOT NULL
        )
    `);
    await runQuery(
        `CREATE INDEX IF NOT EXISTS idx_mail_email_cat ON mail_messages(email, category, created_at DESC)`
    );

    await runQuery(`
        CREATE TABLE IF NOT EXISTS rep_earnings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            club TEXT,
            rep INTEGER NOT NULL DEFAULT 0,
            skulls INTEGER NOT NULL DEFAULT 0,
            source TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )
    `);
    await runQuery(
        `CREATE INDEX IF NOT EXISTS idx_rep_earnings_club_time ON rep_earnings(club, created_at DESC)`
    );
    await runQuery(
        `CREATE INDEX IF NOT EXISTS idx_rep_earnings_email_time ON rep_earnings(email, created_at DESC)`
    );

    await runQuery(`
        CREATE TABLE IF NOT EXISTS firms (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            leader_email TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )
    `);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_firms_leader ON firms(leader_email)`);

    const columns = await allQuery("PRAGMA table_info(users)");
    const existing = new Set(columns.map((col) => col.name));
    const alterStatements = [];

    if (!existing.has("power")) alterStatements.push("ALTER TABLE users ADD COLUMN power INTEGER DEFAULT 10");
    if (!existing.has("speed")) alterStatements.push("ALTER TABLE users ADD COLUMN speed INTEGER DEFAULT 10");
    if (!existing.has("intel")) alterStatements.push("ALTER TABLE users ADD COLUMN intel INTEGER DEFAULT 10");
    if (!existing.has("stamina")) alterStatements.push("ALTER TABLE users ADD COLUMN stamina INTEGER DEFAULT 10");
    if (!existing.has("xp")) alterStatements.push("ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0");
    if (!existing.has("level")) alterStatements.push("ALTER TABLE users ADD COLUMN level INTEGER DEFAULT 1");
    if (!existing.has("name")) alterStatements.push("ALTER TABLE users ADD COLUMN name TEXT");
    if (!existing.has("character")) alterStatements.push("ALTER TABLE users ADD COLUMN character TEXT");
    if (!existing.has("club")) alterStatements.push("ALTER TABLE users ADD COLUMN club TEXT");
    if (!existing.has("energy")) alterStatements.push("ALTER TABLE users ADD COLUMN energy INTEGER DEFAULT 100");
    if (!existing.has("money")) alterStatements.push("ALTER TABLE users ADD COLUMN money INTEGER DEFAULT 69");
    if (!existing.has("rubles")) alterStatements.push("ALTER TABLE users ADD COLUMN rubles INTEGER DEFAULT 69");
    if (!existing.has("dollars")) alterStatements.push("ALTER TABLE users ADD COLUMN dollars INTEGER DEFAULT 10");
    if (!existing.has("mushrooms")) alterStatements.push("ALTER TABLE users ADD COLUMN mushrooms INTEGER DEFAULT 30");
    if (!existing.has("tattoos")) alterStatements.push("ALTER TABLE users ADD COLUMN tattoos TEXT DEFAULT '{}'");
    if (!existing.has("equipment")) alterStatements.push("ALTER TABLE users ADD COLUMN equipment TEXT DEFAULT '{}'");
    if (!existing.has("inventory")) alterStatements.push("ALTER TABLE users ADD COLUMN inventory TEXT DEFAULT '[]'");
    if (!existing.has("hp")) alterStatements.push("ALTER TABLE users ADD COLUMN hp INTEGER DEFAULT 80");
    if (!existing.has("max_hp")) alterStatements.push("ALTER TABLE users ADD COLUMN max_hp INTEGER DEFAULT 80");

    for (const sql of alterStatements) {
        // Миграция существующей базы без потери пользователей.
        await runQuery(sql);
    }

    await runQuery(`
        CREATE TABLE IF NOT EXISTS lottery_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            player_name TEXT NOT NULL,
            prize TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )
    `);

    await runQuery(`
        CREATE TABLE IF NOT EXISTS player_events (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            kind TEXT NOT NULL,
            summary TEXT NOT NULL,
            detail_json TEXT NOT NULL DEFAULT '{}',
            created_at INTEGER NOT NULL
        )
    `);
    await runQuery(
        `CREATE INDEX IF NOT EXISTS idx_player_events_email ON player_events(email, created_at DESC)`
    );

    await runQuery(`
        CREATE TABLE IF NOT EXISTS pub_chat (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            player_name TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )
    `);
    await runQuery(
        `CREATE INDEX IF NOT EXISTS idx_pub_chat_created ON pub_chat(created_at DESC)`
    );

    const colsK = await allQuery("PRAGMA table_info(users)");
    const exK = new Set(colsK.map((c) => c.name));
    if (!exK.has("kicker_last_play")) {
        await runQuery("ALTER TABLE users ADD COLUMN kicker_last_play INTEGER DEFAULT 0");
    }
    if (!exK.has("rage")) {
        await runQuery("ALTER TABLE users ADD COLUMN rage INTEGER DEFAULT 0");
    }
    const profileCols = [
        ["reputation", "INTEGER DEFAULT 0"],
        ["skulls", "INTEGER DEFAULT 0"],
        ["silver_won", "INTEGER DEFAULT 0"],
        ["silver_lost", "INTEGER DEFAULT 0"],
        ["district_streak", "INTEGER DEFAULT 0"],
        ["district_streak_max", "INTEGER DEFAULT 0"],
        ["last_xp_at", "INTEGER DEFAULT 0"],
        ["firm", "TEXT DEFAULT ''"],
        ["country", "TEXT DEFAULT ''"],
        ["rank_title", "TEXT DEFAULT ''"],
        ["last_regen_at", "INTEGER DEFAULT 0"],
        ["last_steward_spawn", "INTEGER DEFAULT 0"],
        ["work_job_name", "TEXT DEFAULT ''"],
        ["work_energy_done", "INTEGER DEFAULT 0"],
        ["work_energy_need", "INTEGER DEFAULT 40"],
        ["work_reward", "INTEGER DEFAULT 3"],
        ["work_jobs_completed", "INTEGER DEFAULT 0"],
        ["work_cooldown_until", "INTEGER DEFAULT 0"],
        ["work_status", "TEXT DEFAULT ''"],
        ["work_period_start", "INTEGER DEFAULT 0"],
        ["work_completed", "TEXT DEFAULT '[]'"],
        ["consumables", "TEXT DEFAULT '{}'"],
        ["consumables_used_at", "TEXT DEFAULT '{}'"],
        ["stat_points", "INTEGER DEFAULT 0"],
        ["daily_quests", "TEXT DEFAULT ''"],
        ["main_quests", "TEXT DEFAULT ''"],
        ["gym_passes", "INTEGER DEFAULT 0"],
        ["lottery_free_tickets", "INTEGER DEFAULT 0"],
        ["happy_hour_day", "TEXT DEFAULT ''"],
        ["happy_hour_claims", "INTEGER DEFAULT 0"],
        ["happy_hour_cooldown_until", "INTEGER DEFAULT 0"],
        ["gear_upgrades", "TEXT DEFAULT '{}'"],
        ["stadium_tickets", "TEXT DEFAULT '{}'"],
        ["talismans", "TEXT DEFAULT '{}'"],
        ["stadium_gadgets", "TEXT DEFAULT '{\"sharp_pepper\":3,\"chocolate\":3,\"energy_drink\":6}'"],
        ["national_team", "TEXT DEFAULT ''"],
        ["hero_of_day_wins", "INTEGER DEFAULT 0"],
        ["registered_at", "INTEGER DEFAULT 0"],
        ["last_active_at", "INTEGER DEFAULT 0"],
        ["ui_prefs", "TEXT DEFAULT '{}'"]
    ];
    for (const [col, def] of profileCols) {
        if (!exK.has(col)) {
            await runQuery(`ALTER TABLE users ADD COLUMN ${col} ${def}`);
        }
    }

    await runQuery(
        `UPDATE users SET registered_at = last_regen_at
         WHERE (registered_at IS NULL OR registered_at = 0) AND COALESCE(last_regen_at, 0) > 0`
    );
    await runQuery(
        `UPDATE users SET registered_at = ?
         WHERE registered_at IS NULL OR registered_at = 0`,
        [Date.now()]
    );

    await runQuery(
        `UPDATE users SET rage = ${RAGE_BASE} WHERE rage IS NULL OR rage < ${RAGE_BASE}`
    );

    try {
        await runQuery(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name_unique ON users(name) WHERE name IS NOT NULL AND TRIM(name) != ''"
        );
    } catch {
        /* дубликаты в старой базе — проверка в /name остаётся */
    }

    await runQuery(
        `UPDATE users SET
            hp = MIN(COALESCE(hp, ${MAX_HP_CAP}), ${MAX_HP_CAP}),
            max_hp = MIN(COALESCE(max_hp, ${MAX_HP_CAP}), ${MAX_HP_CAP}),
            energy = MIN(COALESCE(energy, ${MAX_ENERGY}), ${MAX_ENERGY})
         WHERE COALESCE(hp, 0) > ${MAX_HP_CAP}
            OR COALESCE(max_hp, 0) > ${MAX_HP_CAP}
            OR COALESCE(energy, 0) > ${MAX_ENERGY}`
    );

    const allUsers = await allQuery("SELECT email FROM users");
    for (const u of allUsers) {
        await ensureUserLevelMatchesXp(u.email);
    }

    authModule = createAuthModule({ runQuery, getQuery, allQuery });
    await authModule.ensureSchema();
}

let stadiumService = null;
let firmsService = null;
let pubBattleModule = null;
let nationalTeamsModule = null;
let packagesModule = null;
let authModule = null;
let referralsModule = null;
let clubReputationRatingService = null;

function mapUserToRatingPlayer(row) {
    const xp = normalizeXp(row.xp);
    const level = levelFromXp(xp);
    const reputation = Math.max(0, Math.floor(Number(row.reputation) || 0));
    return {
        email: normalizeEmail(row.email),
        name: row.name || "Игрок",
        level,
        avatar: avatarPath(row.character),
        club: row.club || null,
        reputation
    };
}

async function buildReputationRankingResponse({ email, page, perPage, filterLevel }) {
    const rows = await allQuery(
        `SELECT * FROM users WHERE name IS NOT NULL AND TRIM(name) != ''`
    );

    let ranked = rows.map((row) => mapUserToRatingPlayer(row));
    if (filterLevel != null) {
        ranked = ranked.filter((p) => p.level === filterLevel);
    }

    ranked.sort(
        (a, b) =>
            b.reputation - a.reputation || String(a.name).localeCompare(String(b.name), "ru")
    );

    const total = ranked.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage) || 1);
    const offset = (page - 1) * perPage;
    const slice = ranked.slice(offset, offset + perPage);

    let me = null;
    if (email) {
        const idx = ranked.findIndex((p) => p.email === email);
        if (idx >= 0) {
            const p = ranked[idx];
            me = {
                ...p,
                place: idx + 1,
                position: idx + 1,
                isMe: true
            };
        }
    }

    return {
        success: true,
        players: slice.map((p, i) => ({
            ...p,
            place: offset + i + 1,
            position: offset + i + 1,
            isMe: Boolean(email && p.email === email)
        })),
        page,
        perPage,
        total,
        totalPages,
        level: filterLevel != null ? filterLevel : undefined,
        me
    };
}

async function seedStadiumDemoIfEmpty() {
    const row = await getQuery("SELECT id FROM stadium_matches LIMIT 1");
    if (row) return;
    const now = Date.now();
    for (let lv = 1; lv <= 5; lv += 1) {
        const startsAt = stadiumEngine.nextMatchStartMs(now);
        const match = stadiumEngine.createMatch(lv, "army", "sparta", startsAt);
        const r = stadiumEngine.rowFromMatch(match);
        await runQuery(
            `INSERT INTO stadium_matches
             (id, level, home_club, away_club, status, starts_at, ends_at, score_home, score_away, fighters_json, feed_json, meta_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                r.id,
                r.level,
                r.home_club,
                r.away_club,
                r.status,
                r.starts_at,
                r.ends_at,
                r.score_home,
                r.score_away,
                r.fighters_json,
                r.feed_json,
                r.meta_json,
                now
            ]
        );
    }
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function trimPlayerEvents(email) {
    const keep = await allQuery(
        `SELECT id FROM player_events WHERE email = ? ORDER BY created_at DESC LIMIT ?`,
        [email, playerEvents.MAX_PLAYER_EVENTS]
    );
    const keepIds = new Set(keep.map((r) => r.id));
    const all = await allQuery("SELECT id FROM player_events WHERE email = ?", [email]);
    for (const row of all) {
        if (!keepIds.has(row.id)) {
            await runQuery("DELETE FROM player_events WHERE id = ?", [row.id]);
        }
    }
}

async function recordPlayerEvent(email, { kind, summary, detail }) {
    const normEmail = normalizeEmail(email);
    if (!normEmail || !summary) return null;
    const id = `ev_${Date.now()}_${randomInt(1000, 9999)}`;
    const detailJson = JSON.stringify(detail && typeof detail === "object" ? detail : {});
    await runQuery(
        `INSERT INTO player_events (id, email, kind, summary, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, normEmail, String(kind || "misc"), String(summary), detailJson, Date.now()]
    );
    await trimPlayerEvents(normEmail);
    return id;
}

async function recordQuestEventsFromMessages(email, messages) {
    if (!messages || !messages.length) return;
    for (const msg of messages) {
        const title =
            playerEvents.extractQuestTitleFromMessage(msg.message) || "задание";
        const rewardPart = String(msg.message || "").split("выполнено:")[1]?.trim();
        await recordPlayerEvent(email, {
            kind: playerEvents.EVENT_KINDS.QUEST,
            summary: playerEvents.buildQuestSummary(title),
            detail: {
                text: playerEvents.buildQuestRewardDetail(rewardPart || msg.message),
                questTitle: title,
                fullMessage: msg.message || ""
            }
        });
    }
}

function makeKickToken() {
    return crypto.randomBytes(28).toString("base64url");
}

function shufflePick(arr, n) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, n);
}

function scaleWeakDistrictBot(template, playerLevel) {
    const lvl = playerLevel ?? 1;
    const scale = (1.12 + (lvl - 1) * 0.02) * (lvl <= 1 ? 1.08 : 1);
    return {
        templateId: template.id,
        name: template.name,
        phrase: template.phrase,
        emoji: template.emoji,
        avatar: botAvatarPath(template.id),
        power: Math.round(template.power * scale),
        speed: Math.round(template.speed * scale),
        intel: Math.round(template.intel * scale),
        stamina: Math.round(template.stamina * scale),
        rubles: template.rubles,
        xp: template.xp,
        isSteward: false
    };
}

function scaleStewardBot(template, playerLevel, playerEff) {
    const lvl = playerLevel ?? 1;
    const pe = playerEff || {};
    const scale = 1.25 + (lvl - 1) * 0.05;
    return {
        templateId: template.id,
        name: template.name,
        phrase: template.phrase,
        emoji: template.emoji,
        avatar: botAvatarPath(template.id),
        power: Math.round(Math.max(template.power * scale, (pe.power || 10) * 2.15)),
        speed: Math.round(Math.max(template.speed * scale, (pe.speed || 10) * 1.65)),
        intel: Math.round(Math.max(template.intel * scale, (pe.intel || 10) * 1.55)),
        stamina: Math.round(Math.max(template.stamina * scale, (pe.stamina || 10) * 2.0)),
        rubles: template.rubles,
        xp: template.xp,
        dollars: template.dollars,
        isSteward: true
    };
}

function normalizeRage(value) {
    const r = value ?? RAGE_BASE;
    return Math.max(RAGE_BASE, Math.min(MAX_RAGE, Math.round(r)));
}

/** Победа: ярость не меняется. Поражение: +10 (100→110→120…, макс. 150). */
function districtRageAfterFight(won, storedRage, opts = {}) {
    if (opts.mayaTriggered) return MAX_RAGE;
    const cur = normalizeRage(storedRage);
    if (won) return cur;
    return Math.min(MAX_RAGE, cur + RAGE_ON_LOSS);
}

function normalizeDistrictSlots(bots) {
    const arr = Array.isArray(bots) ? bots : [];
    const out = [];
    for (let i = 0; i < DISTRICT_SLOT_COUNT; i += 1) {
        out.push(arr[i] || null);
    }
    return out;
}

async function getKicksByIndex(spawnId) {
    const kickRows = await allQuery(
        "SELECT bot_index, side, token FROM district_kick_tokens WHERE spawn_id = ? AND used = 0",
        [spawnId]
    );
    const kicksByIndex = {};
    for (const kr of kickRows) {
        if (!kicksByIndex[kr.bot_index]) kicksByIndex[kr.bot_index] = {};
        if (kr.side === "left") kicksByIndex[kr.bot_index].leftKick = kr.token;
        else if (kr.side === "right") kicksByIndex[kr.bot_index].rightKick = kr.token;
    }
    return kicksByIndex;
}

function buildDistrictSpawnPayload(spawnId, slots, kicksByIndex) {
    const payload = [];
    for (let i = 0; i < DISTRICT_SLOT_COUNT; i += 1) {
        const bot = enrichBotSlot(slots[i]);
        if (!bot) continue;
        const k = kicksByIndex[i] || {};
        payload.push({
            ...bot,
            botIndex: i,
            leftKick: k.leftKick || null,
            rightKick: k.rightKick || null
        });
    }
    return { spawnId, bots: payload };
}

async function pickRefillBot(user, playerEff, slotIndex) {
    const level = user.level ?? 1;

    if (slotIndex === PLAYER_SLOT_INDEX) {
        const playerRow = await districtPlayers().pickDistrictPlayer(user, level);
        return playerRow
            ? buildDistrictPlayerSlot(playerRow)
            : scaleWeakDistrictBot(districtNpcTemplate("rayon"), level);
    }

    if (slotIndex === NPC_SLOT_FAN) {
        return decorateFanBot(
            scaleWeakDistrictBot(districtNpcTemplate("fan"), level),
            user,
            `${user.email}:fan:${Date.now()}:${randomInt(1, 999999999)}`
        );
    }

    if (slotIndex === NPC_SLOT_GOP) {
        return scaleWeakDistrictBot(districtNpcTemplate("gop"), level);
    }

    return pickRefillNpc(user, playerEff, level);
}

/** Новая волна района: Гопник + Чужой фан + реальный игрок (или Районный). */
async function createDistrictSpawnInitial(email, user) {
    await clearDistrictSession(email);
    await districtPlayers().ensureSchema();

    const level = user.level ?? 1;
    const { effective: playerEff } = getEffectiveStats(user);
    const now = Date.now();

    const slots = [];
    slots[NPC_SLOT_GOP] = await buildDistrictNpcSlot(NPC_SLOT_GOP, user, level, playerEff);
    slots[NPC_SLOT_FAN] = await buildDistrictNpcSlot(NPC_SLOT_FAN, user, level, playerEff);

    const playerRow = await districtPlayers().pickDistrictPlayer(user, level);
    slots[PLAYER_SLOT_INDEX] = playerRow
        ? buildDistrictPlayerSlot(playerRow)
        : scaleWeakDistrictBot(districtNpcTemplate("rayon"), level);

    const lastSt = user.last_steward_spawn ?? 0;
    if (now - lastSt >= STEWARD_COOLDOWN_MS) {
        const stewardSlot = randomInt(0, DISTRICT_SLOT_COUNT - 1);
        slots[stewardSlot] = scaleStewardBot(STEWARD_BOT, level, playerEff);
        await runQuery("UPDATE users SET last_steward_spawn = ? WHERE email = ?", [now, email]);
    }

    const spawnId = `s_${now}_${randomInt(1000, 9999)}`;
    await runQuery("INSERT INTO district_spawn (spawn_id, email, bots_json, created_at) VALUES (?, ?, ?, ?)", [
        spawnId,
        email,
        JSON.stringify(slots),
        now
    ]);

    const kicksByIndex = {};
    for (let i = 0; i < DISTRICT_SLOT_COUNT; i += 1) {
        const kicks = await insertKickPair(email, spawnId, i, null);
        kicksByIndex[i] = kicks;
    }

    return buildDistrictSpawnPayload(spawnId, slots, kicksByIndex);
}

/** «Искать ещё»: один новый бот вместо побеждённого (до 3 активных). */
async function refillDistrictSlot(email, user) {
    const row = await getQuery("SELECT * FROM district_spawn WHERE email = ? ORDER BY created_at DESC LIMIT 1", [
        email
    ]);
    if (!row) {
        const initial = await createDistrictSpawnInitial(email, user);
        return { ...initial, message: null };
    }

    let slots = normalizeDistrictSlots(JSON.parse(row.bots_json || "[]"));
    const stored = JSON.parse(row.bots_json || "[]");
    if (!Array.isArray(stored) || stored.length !== DISTRICT_SLOT_COUNT) {
        await runQuery("UPDATE district_spawn SET bots_json = ? WHERE spawn_id = ?", [
            JSON.stringify(slots),
            row.spawn_id
        ]);
    }

    const kicksByIndex = await getKicksByIndex(row.spawn_id);
    const { effective: playerEff } = getEffectiveStats(user);

    let refilled = false;
    for (let i = 0; i < DISTRICT_SLOT_COUNT; i += 1) {
        const k = kicksByIndex[i];
        if (k && k.leftKick && k.rightKick) continue;
        slots[i] = await pickRefillBot(user, playerEff, i);
        const kicks = await insertKickPair(email, row.spawn_id, i, null);
        kicksByIndex[i] = kicks;
        refilled = true;
        break;
    }

    await runQuery("UPDATE district_spawn SET bots_json = ? WHERE spawn_id = ?", [
        JSON.stringify(slots),
        row.spawn_id
    ]);

    const payload = buildDistrictSpawnPayload(row.spawn_id, slots, kicksByIndex);
    return {
        ...payload,
        message: refilled ? null : "На районе уже трое — сначала разберись с ними."
    };
}

async function getDistrictSpawnForClient(email, user) {
    const row = await getQuery("SELECT * FROM district_spawn WHERE email = ? ORDER BY created_at DESC LIMIT 1", [
        email
    ]);
    if (!row) {
        return createDistrictSpawnInitial(email, user);
    }

    const slots = normalizeDistrictSlots(JSON.parse(row.bots_json || "[]")).map(enrichBotSlot);
    const kicksByIndex = await getKicksByIndex(row.spawn_id);
    let payload = buildDistrictSpawnPayload(row.spawn_id, slots, kicksByIndex);
    const fightable = payload.bots.filter((b) => b.leftKick && b.rightKick).length;
    if (fightable < DISTRICT_SLOT_COUNT) {
        payload = await createDistrictSpawnInitial(email, user);
    }
    return {
        spawnId: payload.spawnId,
        bots: payload.bots.filter((b) => b.leftKick && b.rightKick)
    };
}

const { levelFromXp, normalizeXp, xpProgressFromTotals } = xpLevels;

function calcMaxHp(stamina, level) {
    return MAX_HP_CAP;
}

function resolveMaxHp() {
    return MAX_HP_CAP;
}

/** +1 HP и +1 энергии каждые 30 сек (онлайн и оффлайн), макс. 100. */
function applyResourceRegen(row) {
    const now = Date.now();
    const maxHp = MAX_HP_CAP;
    let hp = Number(row.hp);
    if (!Number.isFinite(hp)) hp = maxHp;
    hp = Math.min(maxHp, Math.max(0, hp));
    let energy = Math.min(MAX_ENERGY, Math.max(0, Number(row.energy) ?? MAX_ENERGY));
    let last = row.last_regen_at > 0 ? row.last_regen_at : now;

    const ticks = Math.floor((now - last) / REGEN_TICK_MS);
    if (ticks <= 0) {
        const needsClamp =
            (row.hp ?? 0) !== hp ||
            (row.energy ?? 0) !== energy ||
            (row.max_hp ?? 0) !== maxHp ||
            !row.last_regen_at;
        return { hp, energy, maxHp, last_regen_at: last, changed: needsClamp };
    }

    hp = Math.min(maxHp, hp + ticks);
    energy = Math.min(MAX_ENERGY, energy + ticks);
    return {
        hp,
        energy,
        maxHp,
        last_regen_at: last + ticks * REGEN_TICK_MS,
        changed: true
    };
}

async function syncGearUpgradesRow(email, user) {
    let upgrades = parseJson(user.gear_upgrades, {});
    const normalized = gearUpgrades.normalizeUpgrades(upgrades, SHOP_ITEMS);
    upgrades = normalized.upgrades;
    const ticked = gearUpgrades.tickUpgrades(upgrades, Date.now(), SHOP_ITEMS);
    if (!normalized.changed && !ticked.changed) return user;
    await runQuery("UPDATE users SET gear_upgrades = ? WHERE email = ?", [
        JSON.stringify(ticked.upgrades),
        email
    ]);
    return getQuery("SELECT * FROM users WHERE email = ?", [email]);
}

async function ensureRegisteredAt(email, userRow) {
    const ts = Number(userRow?.registered_at);
    if (Number.isFinite(ts) && ts > 0) return false;
    const now = Date.now();
    await runQuery("UPDATE users SET registered_at = ? WHERE email = ?", [now, email]);
    return true;
}

async function syncUserResources(email) {
    const user = await getQuery("SELECT * FROM users WHERE email = ?", [email]);
    if (!user) return null;

    await ensureRegisteredAt(email, user);

    const regen = applyResourceRegen(user);
    const needsSave =
        regen.changed ||
        (user.hp ?? 0) !== regen.hp ||
        (user.energy ?? 0) !== regen.energy ||
        (user.max_hp ?? 0) !== regen.maxHp ||
        (user.last_regen_at ?? 0) !== regen.last_regen_at;

    if (needsSave) {
        await runQuery(
            "UPDATE users SET hp = ?, energy = ?, max_hp = ?, last_regen_at = ? WHERE email = ?",
            [regen.hp, regen.energy, regen.maxHp, regen.last_regen_at, email]
        );
    }

    let fresh = await getQuery("SELECT * FROM users WHERE email = ?", [email]);
    if (fresh) {
        fresh = await syncGearUpgradesRow(email, fresh);
        await ensureUserLevelMatchesXp(email);
    }
    return getQuery("SELECT * FROM users WHERE email = ?", [email]);
}

/** Очки за достижение уровня L: 1→0, 2→5, 3→6, 4→7, 5→8, далее +1 за уровень. */
function statPointsAwardedForLevel(level) {
    const lv = Math.max(1, Math.floor(Number(level) || 1));
    if (lv <= 1) return 0;
    if (lv === 2) return 5;
    if (lv === 3) return 6;
    if (lv === 4) return 7;
    if (lv === 5) return 8;
    return 8 + (lv - 5);
}

function statPointsForLevelDelta(oldLevel, newLevel) {
    const from = Math.max(1, Math.floor(Number(oldLevel) || 1));
    const to = Math.max(1, Math.floor(Number(newLevel) || 1));
    if (to <= from) return 0;
    let total = 0;
    for (let lv = from + 1; lv <= to; lv += 1) {
        total += statPointsAwardedForLevel(lv);
    }
    return total;
}

function statPointsGainMessage(gained) {
    const n = Math.max(0, Math.floor(Number(gained) || 0));
    if (n < 1) return null;
    return `Получено +${n} ${n === 1 ? "очко" : n < 5 ? "очка" : "очков"} характеристик`;
}

async function grantStatPointsForLevelDelta(email, oldLevel, newLevel) {
    const gained = statPointsForLevelDelta(oldLevel, newLevel);
    if (gained < 1) return 0;
    await runQuery("UPDATE users SET stat_points = COALESCE(stat_points, 0) + ? WHERE email = ?", [
        gained,
        email
    ]);
    return gained;
}

async function ensureUserLevelMatchesXp(email) {
    const row = await getQuery("SELECT xp, level FROM users WHERE email = ?", [email]);
    if (!row) return;
    const xp = normalizeXp(row.xp);
    const level = levelFromXp(xp);
    const oldLevel = row.level ?? 1;
    if (oldLevel !== level) {
        await grantStatPointsForLevelDelta(email, oldLevel, level);
        await runQuery("UPDATE users SET level = ? WHERE email = ?", [level, email]);
    }
}

function avatarPath(character) {
    return clubCharacters.avatarPathForCharacter(character);
}

/** Стаж: 1-й день в день регистрации, +1 за каждый новый календарный день. */
function computeTenureDays(registeredAtMs) {
    const ts = Number(registeredAtMs);
    if (!Number.isFinite(ts) || ts <= 0) return 1;
    const start = new Date(ts);
    const now = new Date();
    const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
    const todayDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const diff = Math.floor((todayDay - startDay) / 86400000);
    return Math.max(1, diff + 1);
}

function formatTenureLabel(days) {
    const n = Math.max(1, Math.floor(Number(days) || 1));
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return `${n} день`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} дня`;
    return `${n} дней`;
}

function sanitizeUser(row) {
    if (!row) return null;

    const { base, effective, tattoos, equipment, bonuses } = getEffectiveStats(row);
    const xp = normalizeXp(row.xp);
    const level = levelFromXp(xp);
    const maxHp = MAX_HP_CAP;
    const rubles = row.rubles ?? row.money ?? START_RUBLES;
    const skulls = row.skulls ?? Math.floor((row.reputation ?? 0) / SKULL_EVERY_REP);

    return {
        id: row.id,
        email: row.email,
        recoveryEmail:
            normalizeEmail(row.recovery_email) ||
            (isUserRecoveryEmail(row.email) ? normalizeEmail(row.email) : null),
        hasRecoveryContact: !!(
            normalizeEmail(row.recovery_email) ||
            isUserRecoveryEmail(row.email)
        ),
        name: row.name,
        character: row.character,
        club: row.club,
        clubName: clubsData.getClubName(row.club) || row.club || null,
        clubEmblem: clubsData.getClubEmblem(row.club) || null,
        nationalTeam: row.national_team ? String(row.national_team).trim() || null : null,
        nationalTeamName: nationalTeamsData.getTeamName(row.national_team) || null,
        nationalTeamFlag: nationalTeamsData.getTeamFlag(row.national_team) || null,
        power: base.power,
        speed: base.speed,
        intel: base.intel,
        stamina: base.stamina,
        effective,
        bonuses,
        tattoos,
        equipment,
        inventory: getUserInventory(row),
        consumables: getUserConsumables(row),
        consumablesUsedAt: getConsumablesUsedAt(row),
        xp,
        level,
        rubles,
        money: rubles,
        dollars: row.dollars ?? 0,
        mushrooms: row.mushrooms ?? 0,
        hp: Math.min(maxHp, Math.max(0, Math.round(Number.isFinite(Number(row.hp)) ? row.hp : maxHp))),
        maxHp,
        energy: Math.min(MAX_ENERGY, Math.max(0, row.energy ?? MAX_ENERGY)),
        rage:
            row.rage == null || !Number.isFinite(Number(row.rage))
                ? RAGE_BASE
                : Math.max(0, Math.min(MAX_RAGE, Math.round(Number(row.rage)))),
        reputation: row.reputation ?? 0,
        skulls,
        silverWon: row.silver_won ?? 0,
        silverLost: row.silver_lost ?? 0,
        districtStreak: row.district_streak ?? 0,
        districtStreakMax: row.district_streak_max ?? 0,
        statPoints: Math.max(0, Math.floor(Number(row.stat_points) || 0)),
        gymPasses: Math.max(0, Math.floor(Number(row.gym_passes) || 0)),
        lotteryFreeTickets: Math.max(0, Math.floor(Number(row.lottery_free_tickets) || 0)),
        stadiumTickets: parseJson(row.stadium_tickets, {}),
        talismans: talismans.catalogWithOwnership(row.talismans),
        talismansOwned: talismans.parseOwnedTalismans(row.talismans),
        firm: row.firm || "",
        country: row.country || "",
        rank: rankTitleFromTotalSkulls(skulls),
        heroOfDayWins: Math.max(0, Math.floor(Number(row.hero_of_day_wins) || 0)),
        avatar: avatarPath(row.character),
        xpProgress: xpProgressFromTotals(xp, level),
        gearUpgrades: gearUpgrades.parseUpgrades(parseJson(row.gear_upgrades, {})),
        tenureDays: computeTenureDays(row.registered_at),
        tenureLabel: formatTenureLabel(computeTenureDays(row.registered_at))
    };
}

/** Публичное досье — без денег, опыта, навыков и скрытых ресурсов. */
function sanitizePublicUser(row) {
    const full = sanitizeUser(row);
    if (!full) return null;
    return {
        email: full.email,
        name: full.name,
        character: full.character,
        avatar: full.avatar,
        club: full.club,
        clubName: full.clubName,
        clubEmblem: full.clubEmblem,
        nationalTeam: full.nationalTeam,
        nationalTeamName: full.nationalTeamName,
        nationalTeamFlag: full.nationalTeamFlag,
        level: full.level,
        rank: full.rank,
        reputation: full.reputation,
        tenureDays: full.tenureDays,
        tenureLabel: full.tenureLabel,
        silverWon: full.silverWon,
        silverLost: full.silverLost,
        districtStreak: full.districtStreak,
        districtStreakMax: full.districtStreakMax,
        firm: full.firm || "",
        firmId: "",
        firmName: "",
        inGame: isPlayerInGame(row.last_active_at),
        playerStatus: playerStatusLabel(isPlayerInGame(row.last_active_at))
    };
}

function appendLog(log, text, who) {
    log.push({ text, who });
}

async function clearDistrictSession(email) {
    await runQuery("DELETE FROM district_kick_tokens WHERE email = ?", [email]);
    await runQuery("DELETE FROM district_fights WHERE email = ? AND status = 'active'", [email]);
    await runQuery("DELETE FROM district_spawn WHERE email = ?", [email]);
}

async function insertKickPair(email, spawnId, botIndex, fightId) {
    const left = makeKickToken();
    const right = makeKickToken();
    const t = Date.now();
    await runQuery(
        `INSERT INTO district_kick_tokens (token, email, spawn_id, bot_index, fight_id, side, used, created_at) VALUES (?, ?, ?, ?, ?, 'left', 0, ?)`,
        [left, email, spawnId, botIndex, fightId, t]
    );
    await runQuery(
        `INSERT INTO district_kick_tokens (token, email, spawn_id, bot_index, fight_id, side, used, created_at) VALUES (?, ?, ?, ?, ?, 'right', 0, ?)`,
        [right, email, spawnId, botIndex, fightId, t]
    );
    return { leftKick: left, rightKick: right };
}

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

/** @deprecated — см. player-online.js */
const PLAYER_IN_GAME_MS = playerOnline.PLAYER_ONLINE_MS;
const PLAYER_ACTIVITY_TOUCH_MS = playerOnline.PLAYER_ACTIVITY_TOUCH_MS;

function isPlayerInGame(lastActiveAt, now = Date.now()) {
    return playerOnline.isPlayerOnline(lastActiveAt, now);
}

function playerStatusLabel(inGame) {
    return playerOnline.playerStatusLabel(inGame);
}

async function touchPlayerActivity(email, now = Date.now()) {
    const key = normalizeEmail(email);
    if (!key) return;
    await runQuery(
        `UPDATE users SET last_active_at = ? WHERE email = ? AND COALESCE(last_active_at, 0) < ?`,
        [now, key, now - PLAYER_ACTIVITY_TOUCH_MS]
    );
    await districtPlayers().clearAttackBlockOnLogin(key);
}

async function enrichUserProfileExtras(row, payload) {
    if (!payload || !row) return payload;
    const inGame = isPlayerInGame(row.last_active_at);
    payload.inGame = inGame;
    payload.playerStatus = playerStatusLabel(inGame);
    const firm = await resolveUserFirm(row);
    payload.firmId = firm?.id || "";
    payload.firmName = firm?.name || "";
    return payload;
}

async function requireExistingUser(email, opts = {}) {
    const key = normalizeEmail(email);
    if (!key) return null;
    if (opts.regen === false) {
        const user = await getQuery("SELECT * FROM users WHERE email = ?", [key]);
        return user || null;
    }
    const user = await syncUserResources(key);
    if (user && opts.touchActivity !== false) {
        await touchPlayerActivity(key);
        user.last_active_at = Math.max(
            Math.floor(Number(user.last_active_at) || 0),
            Date.now()
        );
    }
    return user;
}

const CLUB_FIGHT_EMOJI = {
    dynamo: "🔵",
    belarus: "⚪",
    hark: "⚫",
    kharki: "🟡",
    sparta: "🔴",
    neva: "🔵",
    army: "🟢",
    parovozy: "🚂",
    gornyaki: "⛏️"
};

function normalizePlayerName(name) {
    return String(name || "").trim();
}

async function resolveUserFirm(user) {
    if (!firmsService) return null;
    return firmsService.resolveUserFirm(user);
}

function dailyQuestUserCtx(row) {
    return {
        level: row.level ?? 1,
        xp: row.xp ?? 0
    };
}

function parseUiPrefs(raw) {
    const o = parseJson(raw, {});
    if (!o || typeof o !== "object") {
        return { mainQuestWidgetDismissedQuestId: null };
    }
    const id = String(o.mainQuestWidgetDismissedQuestId || "").trim();
    return { mainQuestWidgetDismissedQuestId: id || null };
}

function mergeUiPrefs(raw, patch) {
    const cur = parseJson(raw, {});
    const base = cur && typeof cur === "object" ? { ...cur } : {};
    return JSON.stringify({ ...base, ...patch });
}

function isMainQuestWidgetHidden(uiPrefs, activeMainQuest) {
    if (!activeMainQuest?.id || !uiPrefs?.mainQuestWidgetDismissedQuestId) return false;
    return uiPrefs.mainQuestWidgetDismissedQuestId === activeMainQuest.id;
}

function hasGearUpgrade(gearUpgradesRaw) {
    const upgrades = parseJson(gearUpgradesRaw, {});
    return Object.values(upgrades).some((row) => {
        if (!row || typeof row !== "object") return false;
        return (row.level || 0) >= 2 || !!row.until;
    });
}

function hasDealerItem(inventoryRaw) {
    const inventory = parseJson(inventoryRaw, []);
    return Array.isArray(inventory) && inventory.length > 0;
}

function hasStadiumTicket(stadiumTicketsRaw) {
    const tickets = stadiumTickets.parseTickets(stadiumTicketsRaw);
    return Object.keys(tickets).length > 0;
}

function hasCompletedWork(workCompletedRaw) {
    const done = parseJson(workCompletedRaw, {});
    return Object.keys(done).length > 0;
}

function mainQuestUserCtx(row) {
    const owned = talismans.parseOwnedTalismans(row.talismans);
    const dailyState = dailyQuests.parseDailyQuestState(parseJson(row.daily_quests, null));
    return {
        level: row.level ?? 1,
        xp: row.xp ?? 0,
        club: row.club || null,
        rubles: row.rubles ?? row.money ?? 0,
        hasTalisman: Object.keys(owned).length > 0,
        hasStadiumTicket: hasStadiumTicket(row.stadium_tickets),
        hasGearUpgrade: hasGearUpgrade(row.gear_upgrades),
        hasDealerItem: hasDealerItem(row.inventory),
        hasCompletedWork: hasCompletedWork(row.work_completed),
        dailyLevel2Rewarded: Boolean(dailyState.level2Rewarded)
    };
}

async function saveMainQuestResult(email, result) {
    const row = await getQuery("SELECT mushrooms, gym_passes FROM users WHERE email = ?", [email]);
    if (!row) return;
    const rewards = result.rewards || {};
    const mushrooms = (row.mushrooms ?? 0) + (rewards.mushrooms || 0);
    const gymPasses = (row.gym_passes ?? 0) + (rewards.gymPasses || 0);
    await runQuery("UPDATE users SET main_quests = ?, mushrooms = ?, gym_passes = ? WHERE email = ?", [
        JSON.stringify(result.state),
        mushrooms,
        gymPasses,
        email
    ]);
    if (result.messages?.length) {
        await recordQuestEventsFromMessages(email, result.messages);
    }
}

async function persistMainQuestEvent(email, event) {
    const row = await getQuery(
        `SELECT main_quests, daily_quests, level, xp, club, rubles, money, talismans, stadium_tickets,
                gear_upgrades, work_completed, inventory FROM users WHERE email = ?`,
        [email]
    );
    if (!row) return { messages: [], rewards: { mushrooms: 0, gymPasses: 0 } };

    const raw = parseJson(row.main_quests, null);
    const ctx = mainQuestUserCtx(row);
    const result = mainQuests.processEvent(raw, ctx, event);
    await saveMainQuestResult(email, result);
    return result;
}

async function loadMainQuestsForUser(email) {
    const row = await getQuery(
        `SELECT main_quests, daily_quests, level, xp, club, rubles, money, talismans, stadium_tickets,
                gear_upgrades, work_completed, inventory, mushrooms FROM users WHERE email = ?`,
        [email]
    );
    if (!row) return null;

    const ctx = mainQuestUserCtx(row);
    const raw = parseJson(row.main_quests, null);
    const settled = mainQuests.settleMainQuestState(raw, ctx);
    await saveMainQuestResult(email, settled);

    const payload = mainQuests.getMainQuestsPayload(settled.state, ctx);
    return {
        mainQuests: payload.quests,
        activeMainQuest: payload.activeHomeQuest || null,
        mainQuestsAllDone: payload.allDone,
        rewardMessages: settled.messages.map((m) => m.message)
    };
}

async function saveDailyQuestResult(email, result) {
    const row = await getQuery(
        "SELECT dollars, gym_passes, lottery_free_tickets FROM users WHERE email = ?",
        [email]
    );
    if (!row) return;
    const rewards = result.rewards || {};
    const dollars = (row.dollars ?? 0) + (rewards.dollars || 0);
    const gymPasses = (row.gym_passes ?? 0) + (rewards.gymPasses || 0);
    const lotteryFreeTickets = (row.lottery_free_tickets ?? 0) + (rewards.lotteryTickets || 0);
    await runQuery(
        "UPDATE users SET daily_quests = ?, dollars = ?, gym_passes = ?, lottery_free_tickets = ? WHERE email = ?",
        [JSON.stringify(result.state), dollars, gymPasses, lotteryFreeTickets, email]
    );
    if (result.messages?.length) {
        await recordQuestEventsFromMessages(email, result.messages);
    }
}

async function persistDailyQuestFightProgress(email, won) {
    const row = await getQuery(
        "SELECT daily_quests, dollars, level, xp, gym_passes, lottery_free_tickets FROM users WHERE email = ?",
        [email]
    );
    if (!row) return { messages: [], rewards: { dollars: 0, gymPasses: 0, lotteryTickets: 0 } };

    const raw = parseJson(row.daily_quests, null);
    const result = dailyQuests.recordDistrictFightProgress(raw, won, dailyQuestUserCtx(row));
    await saveDailyQuestResult(email, result);
    await persistMainQuestEvent(email, "sync");
    return result;
}

async function persistDailyQuestWorkProgress(email, energySpent) {
    const row = await getQuery(
        "SELECT daily_quests, level, xp, gym_passes, lottery_free_tickets FROM users WHERE email = ?",
        [email]
    );
    if (!row) return { messages: [], rewards: { dollars: 0, gymPasses: 0, lotteryTickets: 0 } };

    const raw = parseJson(row.daily_quests, null);
    const result = dailyQuests.recordWorkEnergyProgress(raw, energySpent, dailyQuestUserCtx(row));
    await saveDailyQuestResult(email, result);
    return result;
}

async function loadDailyQuestsForUser(email) {
    const user = await requireExistingUser(email);
    if (!user) return null;

    const raw = parseJson(user.daily_quests, null);
    const ctx = dailyQuestUserCtx(user);
    const settled = dailyQuests.settleDailyQuestState(raw, ctx);
    await saveDailyQuestResult(email, settled);

    const payload = dailyQuests.getDailyQuestsPayload(settled.state, ctx);
    const main = await loadMainQuestsForUser(email);
    const updated = await requireExistingUser(email);
    const dailyRewardMessages = settled.messages.map((m) => m.message);
    const mainRewardMessages = main?.rewardMessages || [];
    const uiPrefs = parseUiPrefs(user.ui_prefs);
    const activeMainQuest = main?.activeMainQuest || null;
    return {
        quests: payload.quests,
        dailyQuests: payload.quests,
        mainQuests: main?.mainQuests || [],
        activeMainQuest,
        mainQuestWidgetHidden: isMainQuestWidgetHidden(uiPrefs, activeMainQuest),
        mainQuestsAllDone: main?.mainQuestsAllDone ?? false,
        resetInMs: payload.resetInMs,
        resetLabel: payload.resetLabel,
        rewardMessages: dailyRewardMessages.concat(mainRewardMessages),
        user: sanitizeUser(updated)
    };
}

async function isNameTaken(name, exceptEmail) {
    const normalized = normalizePlayerName(name);
    if (normalized.length < 2) return false;
    const row = await getQuery(
        "SELECT email FROM users WHERE LOWER(TRIM(name)) = LOWER(?) AND email != ? LIMIT 1",
        [normalized, normalizeEmail(exceptEmail)]
    );
    return !!row;
}

/** HP после боя: старт − полученный урон, не ниже 0, без автолечения. */
function hpAfterDistrictFight(hpStart, dmgTaken, maxHp) {
    const cap = maxHp ?? MAX_HP_CAP;
    let start = Number(hpStart);
    if (!Number.isFinite(start)) start = cap;
    start = fightSsr.round2(Math.min(cap, Math.max(0, start)));
    const dmg = Math.max(0, Math.round(Number(dmgTaken) || 0));
    return fightSsr.round2(Math.max(0, Math.min(cap, start - dmg)));
}

function logHpAfterFight(startHp, totalDamageTaken, endHp) {
    console.log(
        `START_HP=${Math.round(startHp)} TOTAL_DAMAGE_TAKEN=${Math.round(totalDamageTaken)} END_HP=${Math.round(endHp)}`
    );
}

function readUserHpForFight(user, maxHp) {
    let hp = Number(user.hp);
    if (!Number.isFinite(hp)) hp = maxHp;
    return fightSsr.round2(Math.min(maxHp, Math.max(0, hp)));
}

/**
 * Один бой по токену kick. emailFromClient — если передан, должен совпадать с владельцем токена (POST из клиента).
 * Возвращает объект для JSON (POST) или для fightSsr.buildFightPageHtml (GET).
 */
async function runDistrictFight(emailFromClient, kickToken) {
    const kick = String(kickToken || "").trim();
    if (!kick) {
        return { ok: false, error: "Нет ссылки на удар." };
    }

    const tok = await getQuery("SELECT * FROM district_kick_tokens WHERE token = ? AND used = 0", [kick]);
    if (!tok) {
        return { ok: false, error: "Ссылка недействительна или удар уже нанесён." };
    }

    const email = normalizeEmail(tok.email);
    if (emailFromClient && normalizeEmail(emailFromClient) !== email) {
        return { ok: false, error: "Это не твоя ссылка на бой — войди под тем же аккаунтом, что в районе." };
    }

    let user = await requireExistingUser(email, { regen: true });
    if (!user) {
        return { ok: false, error: "Пользователь не найден." };
    }

    const maxHpCheck = MAX_HP_CAP;
    const hpNow = Math.min(maxHpCheck, user.hp ?? 0);
    if (hpNow < MIN_DISTRICT_HP) {
        return {
            ok: false,
            code: "low_hp",
            hp: Math.round(hpNow),
            minHp: MIN_DISTRICT_HP,
            error: `Мало здоровья для нападения (нужно минимум ${MIN_DISTRICT_HP}, сейчас ${Math.round(hpNow)}).`,
            user: sanitizeUser(user)
        };
    }

    const rublesNow = Math.max(0, Math.floor(user.rubles ?? user.money ?? 0));
    if (rublesNow < 1) {
        return {
            ok: false,
            code: "no_rubles",
            rubles: rublesNow,
            error: "Нет серебра для нападения.",
            user: sanitizeUser(user)
        };
    }

    const spawn = await getQuery("SELECT * FROM district_spawn WHERE spawn_id = ?", [tok.spawn_id]);
    if (!spawn) {
        return { ok: false, error: "Сессия района устарела — нажми «Искать ещё» в районе." };
    }

    const bots = normalizeDistrictSlots(JSON.parse(spawn.bots_json || "[]"));
    const botTemplate = bots[tok.bot_index];
    if (!botTemplate) {
        return { ok: false, error: "Противник не найден." };
    }

    if (botTemplate.isPlayer && botTemplate.targetEmail) {
        const guard = await districtPlayers().assertCanAttackPlayer(botTemplate.targetEmail);
        if (!guard.ok) {
            return {
                ok: false,
                code: guard.code || "player_protected",
                error: guard.error,
                user: sanitizeUser(user)
            };
        }
    }

    let fight = tok.fight_id
        ? await getQuery("SELECT * FROM district_fights WHERE id = ? AND email = ?", [tok.fight_id, email])
        : null;

    if (!fight) {
        if ((user.energy ?? MAX_ENERGY) < FIGHT_ENERGY_COST) {
            return {
                ok: false,
                code: "low_energy",
                energy: Math.max(0, Math.floor(Number(user.energy) || 0)),
                need: FIGHT_ENERGY_COST,
                error: "Мало энергии для боя.",
                user: sanitizeUser(user)
            };
        }

        const stats = getEffectiveStats(user);
        const maxHp = calcMaxHp(stats.effective.stamina, user.level ?? 1);
        const playerHp = readUserHpForFight(user, maxHp);
        let enemyMax = fightSsr.round2(Math.min(MAX_HP_CAP, 70 + (botTemplate.stamina || 10) * 2));
        if (botTemplate.isSteward) {
            enemyMax = MAX_HP_CAP;
        }
        const fightId = `df_${Date.now()}_${randomInt(1000, 9999)}`;
        const opponent = { ...botTemplate };
        delete opponent.leftKick;
        delete opponent.rightKick;
        delete opponent.botIndex;

        const log = [{ text: `${opponent.name}: «${botTemplate.phrase || "Ну чо?"}»`, who: "sys" }];

        await runQuery(
            `INSERT INTO district_fights (id, email, spawn_id, bot_index, opponent, player_hp, enemy_hp, enemy_max_hp, status, log, energy_spent, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, 1, ?)`,
            [
                fightId,
                email,
                tok.spawn_id,
                tok.bot_index,
                JSON.stringify(opponent),
                playerHp,
                enemyMax,
                enemyMax,
                JSON.stringify(log),
                Date.now()
            ]
        );

        await runQuery("UPDATE users SET energy = energy - ?, max_hp = ? WHERE email = ?", [
            FIGHT_ENERGY_COST,
            maxHp,
            email
        ]);

        fight = await getQuery("SELECT * FROM district_fights WHERE id = ?", [fightId]);
        user = await requireExistingUser(email);

        if (botTemplate.isPlayer && botTemplate.targetEmail) {
            await districtPlayers().recordAttackOnPlayer(email, botTemplate.targetEmail);
        }
    }

    await runQuery("DELETE FROM district_kick_tokens WHERE spawn_id = ? AND bot_index = ? AND used = 0", [
        tok.spawn_id,
        tok.bot_index
    ]);

    const opponent = JSON.parse(fight.opponent);
    const log = JSON.parse(fight.log || "[]");
    const stats = getEffectiveStats(await requireExistingUser(email));
    const openingSide = tok.side;
    const playerName = user.name || "Игрок";

    const resolved = fightSsr.resolveNarrativeFightFull(
        playerName,
        stats.effective,
        opponent,
        fight.player_hp,
        fight.enemy_hp,
        openingSide,
        {
            playerLevel: user.level ?? 1,
            startRage: normalizeRage(user.rage),
            equipment: stats.equipment,
            bonuses: stats.bonuses,
            statPointsPending: Math.max(0, Math.floor(Number(user.stat_points) || 0)),
            playerTalismans: user.talismans || "{}",
            enemyTalismans: "{}"
        }
    );

    const compactLog = fightSsr.compactFightResolvedLog(resolved);
    const displayDamage = fightSsr.sumHitDamageFromLogRows(compactLog);
    for (const line of compactLog) {
        log.push({ who: line.who, html: line.html });
    }

    const enemyHp = resolved.enemyHp;
    const startHp = fightSsr.round2(Number(fight.player_hp));
    const totalDamageTaken = Math.max(0, Math.round(displayDamage.toPlayer));
    const maxHpForFight = calcMaxHp(stats.effective.stamina, user.level ?? 1);
    const hpAfterFight = hpAfterDistrictFight(startHp, totalDamageTaken, maxHpForFight);
    logHpAfterFight(startHp, totalDamageTaken, hpAfterFight);

    const fightHpMeta = {
        hpStart: startHp,
        totalDamageTaken,
        hpAfter: hpAfterFight,
        startRage: normalizeRage(user.rage),
        mayaTriggered: !!resolved.mayaTriggered
    };

    let xpGain = 0;
    let rublesGain = 0;
    let dollarsGain = 0;
    let repGain = 0;
    let skullsEarned = 0;
    let levelUp = null;
    let winRewards = null;
    let silverLoss = 0;
    const rublesMax = Array.isArray(opponent.rubles) ? opponent.rubles[1] : rublesGain;
    if (resolved.status === "won") {
        rublesGain = randomInt(opponent.rubles[0], opponent.rubles[1]);
        const freshUser = await requireExistingUser(email);
        winRewards = await finishDistrictFightWin(
            freshUser,
            opponent,
            email,
            fight.id,
            log,
            enemyHp,
            { rublesGain },
            fightHpMeta
        );
        xpGain = winRewards.xpGain;
        rublesGain = winRewards.rublesGain;
        dollarsGain = winRewards.dollarsGain || 0;
        repGain = winRewards.repGain || REP_PER_DISTRICT_WIN;
        skullsEarned = winRewards.skullsEarned || 0;
        levelUp = winRewards.levelUp ?? null;
    } else {
        const u2 = await requireExistingUser(email);
        const lossResult = await finishDistrictFightLost(u2, email, fight.id, log, enemyHp, fightHpMeta);
        silverLoss = lossResult.silverLoss ?? 0;
    }

    await persistDailyQuestFightProgress(email, resolved.status === "won");

    const updated = await syncUserResources(email);
    const su = sanitizeUser(updated);

    const firstSys = log.find((x) => x.who === "sys" && x.text);
    const logLines = [];
    if (firstSys && firstSys.text) {
        logLines.push(`<p class="fight-quote">${fightSsr.escapeHtml(firstSys.text)}</p>`);
    }
    for (const row of compactLog) {
        if (row.html) logLines.push(row.html);
    }
    for (const row of log) {
        if (!row.text || row.html) continue;
        if (row.text === (firstSys && firstSys.text)) continue;
        const t = row.text;
        if (/^Победа!/i.test(t) || /разобрался/i.test(t)) continue;
        logLines.push(`<p class="fight-end-msg">${fightSsr.escapeHtml(t)}</p>`);
    }

    const opponentEmoji = opponent.emoji || "👤";
    const opponentAvatar = opponent.avatar || botAvatarPath(opponent.templateId || opponent.id) || null;
    const playerAvatarFill = clubsData.getClubAvatarTheme(su.club)?.fill || null;

    const battleView = {
        status: resolved.status,
        playerName,
        playerEmail: email,
        opponentName: opponent.name,
        opponentEmail: opponent.email ? String(opponent.email).toLowerCase() : null,
        opponentEmoji,
        opponentAvatar,
        playerAvatar: su.avatar,
        playerAvatarFill,
        logLines,
        totalToEnemy: displayDamage.toEnemy,
        totalToPlayer: displayDamage.toPlayer,
        rublesGain,
        silverLoss,
        repGain,
        xpGain,
        dollarsGain,
        skullsEarned,
        levelUp,
        statPointsMessage: winRewards?.statPointsMessage ?? null,
        fightId: fight.id
    };

    if (resolved.status === "won") {
        await recordPlayerEvent(email, {
            kind: playerEvents.EVENT_KINDS.FIGHT_WIN,
            summary: playerEvents.buildFightWinSummary(opponent.name, rublesGain),
            detail: {
                fightId: fight.id,
                opponentName: opponent.name,
                fightStatus: "won",
                logLines,
                rublesGain,
                repGain,
                xpGain,
                dollarsGain,
                skullsEarned,
                levelUp,
                statPointsMessage: winRewards?.statPointsMessage ?? null,
                totalToEnemy: displayDamage.toEnemy,
                totalToPlayer: displayDamage.toPlayer,
                opponentEmoji,
                opponentAvatar,
                battleView,
                text: `Бой против ${opponent.name}. Победа.`
            }
        });
    } else {
        await recordPlayerEvent(email, {
            kind: playerEvents.EVENT_KINDS.FIGHT_LOSS,
            summary: playerEvents.buildFightLossSummary(opponent.name, silverLoss),
            detail: {
                fightId: fight.id,
                opponentName: opponent.name,
                fightStatus: "lost",
                logLines,
                silverLoss,
                totalToEnemy: displayDamage.toEnemy,
                totalToPlayer: displayDamage.toPlayer,
                opponentEmoji,
                opponentAvatar,
                battleView,
                text: `Бой против ${opponent.name}. Поражение.`
            }
        });
    }

    return {
        ok: true,
        status: resolved.status,
        playerName,
        playerEmail: email,
        opponentName: opponent.name,
        opponentEmail: opponent.email ? String(opponent.email).toLowerCase() : null,
        opponentEmoji,
        opponentAvatar,
        playerAvatar: su.avatar,
        playerAvatarFill,
        user: su,
        totalToEnemy: displayDamage.toEnemy,
        totalToPlayer: displayDamage.toPlayer,
        rublesGain,
        rublesMax,
        repGain,
        skullsEarned,
        dollarsGain,
        xpGain,
        levelUp,
        statPointsGained: winRewards?.statPointsGained ?? 0,
        statPointsMessage: winRewards?.statPointsMessage ?? null,
        logLines,
        log,
        playerHp: hpAfterFight,
        enemyHp,
        opponent,
        enemyMaxHp: fight.enemy_max_hp,
        playerMaxHp: su.maxHp,
        fightId: fight.id
    };
}

app.post("/character", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const character = String(body.character || "").trim();

        if (!character) {
            res.status(400).json({ success: false, error: "Персонаж не выбран" });
            return;
        }

        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        const stats = CHARACTER_STATS[character];
        if (!stats) {
            res.status(400).json({ success: false, error: "Неизвестный тип персонажа" });
            return;
        }
        const maxHp = calcMaxHp(stats.stamina, 1);

        await runQuery(
            `UPDATE users SET "character" = ?, power = ?, speed = ?, intel = ?, stamina = ?,
             hp = ?, max_hp = ?, rubles = ?, money = ?, dollars = ?, mushrooms = ? WHERE email = ?`,
            [
                character,
                stats.power,
                stats.speed,
                stats.intel,
                stats.stamina,
                maxHp,
                maxHp,
                START_RUBLES,
                START_RUBLES,
                START_DOLLARS,
                START_MUSHROOMS,
                email
            ]
        );
        const updated = await requireExistingUser(email);
        res.json({ success: true, stats, user: sanitizeUser(updated) });
    } catch (error) {
        console.error("Character error:", error);
        res.status(500).json({ success: false, error: "Ошибка сервера при выборе персонажа" });
    }
});

app.post("/club", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const club = String(body.club || "").trim();

        if (!club) {
            res.status(400).json({ success: false, error: "Клуб не выбран" });
            return;
        }

        if (!clubsData.isValidClub(club)) {
            res.status(400).json({ success: false, error: "Неизвестный клуб" });
            return;
        }

        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        await runQuery("UPDATE users SET club = ? WHERE email = ?", [club, email]);
        const updated = await requireExistingUser(email);
        res.json({ success: true, user: sanitizeUser(updated) });
    } catch (error) {
        console.error("Club error:", error);
        res.status(500).json({ success: false, error: "Ошибка сервера при выборе клуба" });
    }
});

app.post("/name", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const name = normalizePlayerName(body.name);

        if (name.length < 2) {
            res.status(400).json({ success: false, error: "Имя слишком короткое" });
            return;
        }

        if (name.length > 24) {
            res.status(400).json({ success: false, error: "Имя слишком длинное (макс. 24)" });
            return;
        }

        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        if (await isNameTaken(name, email)) {
            res.status(409).json({ success: false, error: "Это имя уже занято" });
            return;
        }

        await runQuery("UPDATE users SET name = ? WHERE email = ?", [name, email]);
        const updated = await requireExistingUser(email);
        res.json({ success: true, user: sanitizeUser(updated) });
    } catch (error) {
        console.error("Name error:", error);
        res.status(500).json({ success: false, error: "Ошибка сервера при сохранении имени" });
    }
});

app.get("/api/stadium/upcoming-count", async (req, res) => {
    try {
        const count = await stadiumService.countChampionshipMatchesNext7Days(Date.now());
        res.json({ success: true, count });
    } catch (error) {
        console.error("stadium upcoming-count error:", error);
        res.status(500).json({ success: false, error: "Ошибка расписания" });
    }
});

app.get("/stadium/schedule/list", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }
        const list = await stadiumService.listScheduleWeek(user);
        res.json({ success: true, user: sanitizeUser(user), schedule: list });
    } catch (error) {
        console.error("stadium schedule list error:", error);
        res.status(500).json({ success: false, error: "Ошибка расписания" });
    }
});

app.get("/stadium/kassa/info", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }
        const info = await stadiumService.getKassaInfo(user);
        if (!info.ok) {
            res.status(400).json({ success: false, error: info.error });
            return;
        }
        res.json({ success: true, user: sanitizeUser(user), kassa: info });
    } catch (error) {
        console.error("stadium kassa info error:", error);
        res.status(500).json({ success: false, error: "Ошибка кассы" });
    }
});

app.post("/stadium/kassa/buy", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }
        const out = await stadiumService.buyTicket(email, user, body.matchId || null);
        if (!out.ok) {
            res.status(400).json({ success: false, error: out.error });
            return;
        }
        await persistMainQuestEvent(email, "stadium_ticket");
        const updated = await requireExistingUser(email);
        const info = await stadiumService.getKassaInfo(updated);
        res.json({
            success: true,
            user: sanitizeUser(updated),
            kassa: info.ok ? info : null,
            message: "Билет куплен."
        });
    } catch (error) {
        console.error("stadium kassa buy error:", error);
        res.status(500).json({ success: false, error: "Ошибка покупки" });
    }
});

app.get("/stadium/home", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }
        const status = await stadiumService.getHomeStatus(user);
        res.json({ success: true, user: sanitizeUser(user), stadium: status });
    } catch (error) {
        console.error("stadium home error:", error);
        res.status(500).json({ success: false, error: "Ошибка стадиона" });
    }
});

app.get("/api/mail/menu", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }
        const unreadGazeta = await getQuery(
            `SELECT COUNT(*) AS c FROM mail_messages WHERE email = ? AND category = 'gazeta_third' AND read_at IS NULL`,
            [email]
        );
        const gazetaTotal = await getQuery("SELECT COUNT(*) AS c FROM stadium_newspaper");
        res.json({
            success: true,
            sections: [
                { id: "personal", label: "Личные", href: "/mail-personal.html", unread: 0, stub: true },
                { id: "firm", label: "Почта фирмы", href: "/mail-firm.html", unread: 0, stub: true },
                { id: "firm_leader", label: "Сообщения лидера фирмы", href: "/mail-firm-leader.html", unread: 0, stub: true },
                { id: "club", label: "Клубные сообщения", href: "/mail-club.html", unread: 0, stub: true },
                { id: "game_news", label: "Новости игры", href: "/mail-news.html", unread: 0, stub: true },
                {
                    id: "gazeta_third",
                    label: "Газета «Третий тайм»",
                    href: "/mail-gazeta.html",
                    unread: unreadGazeta?.c ?? 0,
                    stub: false,
                    total: gazetaTotal?.c ?? 0
                }
            ]
        });
    } catch (error) {
        console.error("mail menu error:", error);
        res.status(500).json({ success: false, error: "Ошибка почты" });
    }
});

app.get("/api/mail/gazeta", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }
        const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
        const list = await stadiumService.listNewspaperIssues(page);
        res.json({ success: true, ...list });
    } catch (error) {
        console.error("mail gazeta list error:", error);
        res.status(500).json({ success: false, error: "Ошибка газеты" });
    }
});

app.get("/api/mail/gazeta/detail", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        const issueId = String(req.query.id || "").trim();
        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }
        if (!issueId) {
            res.status(400).json({ success: false, error: "Нет номера газеты" });
            return;
        }
        const report = await stadiumService.getNewspaperIssue(issueId);
        if (!report) {
            res.status(404).json({ success: false, error: "Выпуск не найден" });
            return;
        }
        await runQuery(
            `UPDATE mail_messages SET read_at = ? WHERE email = ? AND category = 'gazeta_third' AND ref_id = ? AND read_at IS NULL`,
            [Date.now(), email, issueId]
        );
        res.json({ success: true, report });
    } catch (error) {
        console.error("mail gazeta detail error:", error);
        res.status(500).json({ success: false, error: "Ошибка выпуска" });
    }
});

app.get("/stadium/best-fighters", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        const matchId = String(req.query.matchId || "").trim();
        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        let match = matchId
            ? await stadiumService.loadMatch(matchId)
            : await stadiumService.getOrCreateMatchForLevel(Math.max(1, user.level ?? 1), user.club);

        if (!match) {
            res.status(404).json({ success: false, error: "Матч не найден" });
            return;
        }

        const page = Math.max(1, Math.floor(Number(req.query.page) || 1));

        res.json({
            success: true,
            user: sanitizeUser(user),
            best: stadiumService.buildBestFighters(match, user, page)
        });
    } catch (error) {
        console.error("stadium best-fighters error:", error);
        res.status(500).json({ success: false, error: "Ошибка рейтинга" });
    }
});

app.get("/stadium/match", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        const matchId = String(req.query.matchId || "").trim();
        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        let match = matchId
            ? await stadiumService.loadMatch(matchId)
            : await stadiumService.getOrCreateMatchForLevel(Math.max(1, user.level ?? 1), user.club);

        if (!match) {
            res.status(404).json({ success: false, error: "Матч не найден" });
            return;
        }

        const stats = getEffectiveStats(user);
        const updated = await requireExistingUser(email);
        res.json({
            success: true,
            user: sanitizeUser(updated),
            match: await stadiumService.buildScheduleResponse(match, updated, stats),
            gadgets: provisionsData.catalogOwnedForClient(getUserConsumables(updated))
        });
    } catch (error) {
        console.error("stadium match error:", error);
        res.status(500).json({ success: false, error: "Ошибка матча" });
    }
});

app.get("/stadium/tribunes", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        const matchId = String(req.query.matchId || "").trim();
        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }
        if (!user.club) {
            res.status(400).json({ success: false, error: "Сначала выбери клуб." });
            return;
        }

        let match = matchId
            ? await stadiumService.loadMatch(matchId)
            : await stadiumService.getOrCreateMatchForLevel(Math.max(1, user.level ?? 1), user.club);

        if (!match) {
            res.status(404).json({ success: false, error: "Матч не найден" });
            return;
        }

        const stats = getEffectiveStats(user);
        const updated = await requireExistingUser(email);
        const focusTargetId = String(req.query.targetId || "").trim();
        const matchPayload = await stadiumService.buildTribunesPayload(match, updated, stats, {
            focusTargetId
        });

        const consumables = getUserConsumables(updated);
        res.json({
            success: true,
            user: sanitizeUser(updated),
            match: matchPayload,
            gadgets: provisionsData.catalogOwnedForClient(consumables)
        });
    } catch (error) {
        console.error("stadium tribunes error:", error);
        res.status(500).json({ success: false, error: "Ошибка фан-сектора" });
    }
});

app.post("/stadium/tribunes/refresh", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const matchId = String(body.matchId || "").trim();
        const user = await requireExistingUser(email);
        if (!user?.club) {
            res.status(400).json({ success: false, error: "Сначала выбери клуб." });
            return;
        }
        if (!matchId) {
            res.status(400).json({ success: false, error: "Нет матча." });
            return;
        }

        const out = await stadiumService.refreshTribuneOpponents(matchId, user);
        if (!out.ok) {
            res.status(400).json({ success: false, error: out.error });
            return;
        }

        const match = await stadiumService.loadMatch(matchId);
        const stats = getEffectiveStats(user);
        const updated = await requireExistingUser(email);
        const consumables = getUserConsumables(updated);
        res.json({
            success: true,
            user: sanitizeUser(updated),
            match: await stadiumService.buildTribunesPayload(match, updated, stats),
            gadgets: provisionsData.catalogOwnedForClient(consumables)
        });
    } catch (error) {
        console.error("stadium tribunes refresh error:", error);
        res.status(500).json({ success: false, error: "Ошибка обновления" });
    }
});

app.post("/stadium/join", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const matchId = String(body.matchId || "").trim();
        const user = await requireExistingUser(email);
        if (!user?.club) {
            res.status(400).json({ success: false, error: "Сначала выбери клуб." });
            return;
        }
        if (!matchId) {
            res.status(400).json({ success: false, error: "Нет матча." });
            return;
        }

        const stats = getEffectiveStats(user);
        const out = await stadiumService.joinMatch(matchId, user, stats);
        if (!out.ok) {
            res.status(400).json({ success: false, error: out.error });
            return;
        }

        const match = await stadiumService.loadMatch(matchId);
        const updated = await requireExistingUser(email);
        res.json({
            success: true,
            user: sanitizeUser(updated),
            match: await stadiumService.buildTribunesPayload(match, updated, stats, {
                playerFighter: out.fighter
            })
        });
    } catch (error) {
        console.error("stadium join error:", error);
        res.status(500).json({ success: false, error: "Ошибка входа в бой" });
    }
});

app.post("/stadium/attack", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const matchId = String(body.matchId || "").trim();
        const targetId = String(body.targetId || "").trim();
        const attackType = body.attackType === "strong" ? "strong" : "normal";
        const gadgetId = String(body.gadgetId || "").trim();

        const user = await requireExistingUser(email, { regen: true });
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }
        if (!user.club) {
            res.status(400).json({ success: false, error: "Сначала выбери клуб." });
            return;
        }
        if (!matchId || !targetId) {
            res.status(400).json({ success: false, error: "Нет цели или матча." });
            return;
        }

        const stats = getEffectiveStats(user);
        const out = await stadiumService.playerAttack(matchId, user, stats, targetId, attackType, {
            gadgetId: gadgetId || null
        });
        if (!out.ok) {
            res.status(400).json({ success: false, error: out.error });
            return;
        }

        const updated = await requireExistingUser(email);
        res.json({
            success: true,
            user: sanitizeUser(updated),
            strike: out.result,
            strikeFlash: out.strikeFlash || null,
            repGain: out.repGain ?? 0,
            matchId: out.matchId,
            gadgets: out.gadgets || provisionsData.catalogOwnedForClient(getUserConsumables(updated))
        });
    } catch (error) {
        console.error("stadium attack error:", error);
        res.status(500).json({ success: false, error: "Ошибка удара" });
    }
});

app.post("/district/attack-check", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const user = await requireExistingUser(email, { regen: true });
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }
        const hpNow = Math.min(MAX_HP_CAP, Math.max(0, Math.round(Number(user.hp) || 0)));
        if (hpNow < MIN_DISTRICT_HP) {
            res.json({
                success: false,
                code: "low_hp",
                hp: hpNow,
                minHp: MIN_DISTRICT_HP
            });
            return;
        }
        const rublesNow = Math.max(0, Math.floor(user.rubles ?? user.money ?? 0));
        if (rublesNow < 1) {
            res.json({ success: false, code: "no_rubles", rubles: rublesNow, user: sanitizeUser(user) });
            return;
        }
        const energyNow = Math.max(0, Math.floor(Number(user.energy) || 0));
        if (energyNow < FIGHT_ENERGY_COST) {
            res.json({
                success: false,
                code: "low_energy",
                energy: energyNow,
                need: FIGHT_ENERGY_COST,
                user: sanitizeUser(user)
            });
            return;
        }
        res.json({ success: true, user: sanitizeUser(user) });
    } catch (error) {
        console.error("district attack-check error:", error);
        res.status(500).json({ success: false, error: "Ошибка проверки" });
    }
});

app.get("/api/hero-of-day", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        const heroOfDay =
            heroOfDayService ? await heroOfDayService.getPayload(email) : { active: false, yourSkulls: 0 };
        res.json({ success: true, heroOfDay });
    } catch (error) {
        console.error("hero-of-day error:", error);
        res.status(500).json({ success: false, error: "Ошибка героя дня" });
    }
});

app.get("/district/spawn", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        const user = await requireExistingUser(email, { regen: true });
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }
        const payload = await getDistrictSpawnForClient(email, user);
        const heroOfDay =
            heroOfDayService ? await heroOfDayService.getPayload(email) : { active: false, yourSkulls: 0 };
        res.json({
            success: true,
            spawn: { spawnId: payload.spawnId, bots: payload.bots },
            heroOfDay,
            user: sanitizeUser(user)
        });
    } catch (error) {
        console.error("District spawn get error:", error);
        res.status(500).json({ success: false, error: "Ошибка района" });
    }
});

app.post("/district/refresh", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const user = await requireExistingUser(email, { regen: true });
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        const result = await createDistrictSpawnInitial(email, user);
        const heroOfDay =
            heroOfDayService ? await heroOfDayService.getPayload(email) : { active: false, yourSkulls: 0 };

        res.json({
            success: true,
            spawn: { spawnId: result.spawnId, bots: result.bots },
            heroOfDay,
            user: sanitizeUser(await requireExistingUser(email))
        });
    } catch (error) {
        console.error("District refresh error:", error);
        res.status(500).json({ success: false, error: "Не удалось обновить район" });
    }
});

app.get("/district/fight-gear", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        const fightId = String(req.query.fightId || "").trim();
        if (!email || !fightId) {
            res.status(400).json({ success: false, error: "Нужны email и fightId" });
            return;
        }

        const userRow = await requireExistingUser(email);
        if (!userRow) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        const row = await getQuery(
            "SELECT * FROM district_fights WHERE id = ? AND email = ? AND status IN ('won','lost')",
            [fightId, email]
        );
        if (!row) {
            res.status(404).json({ success: false, error: "Бой не найден или ещё не завершён" });
            return;
        }

        const opponent = JSON.parse(row.opponent || "{}");
        const fightLog = parseJson(row.log, []);
        const { base } = getEffectiveStats(userRow);
        const gearB = getEquipmentBonuses(userRow).bonuses;
        const tat = getActiveTattoos(userRow);

        const sumB = (b) => (b.power || 0) + (b.speed || 0) + (b.intel || 0) + (b.stamina || 0);

        const charSum = sumB(base);
        const gearSum = sumB(gearB);
        const tattooSum = (tat.power || 0) + (tat.speed || 0) + (tat.intel || 0) + (tat.stamina || 0);
        const sumItemStats = (item) =>
            (item?.power || 0) + (item?.speed || 0) + (item?.intel || 0) + (item?.stamina || 0);

        let oPow = opponent.power ?? 10;
        let oSp = opponent.speed ?? 10;
        let oIn = opponent.intel ?? 10;
        let oSt = opponent.stamina ?? 10;
        let oppLevel = opponent.level ?? userRow.level ?? 1;
        let oppGearSum = 0;
        let oppEquipment = {};
        let oppGearUpgrades = {};
        let oppDisplayGearSum = 0;
        let oppDisplayTattooSum = 0;
        let oppDisplayAmuletSum = 0;
        let oppDisplayTattoo = null;
        if (opponent.isPlayer && opponent.targetEmail) {
            const targetRow = await requireExistingUser(opponent.targetEmail);
            if (targetRow) {
                const tStats = getEffectiveStats(targetRow);
                const suTarget = sanitizeUser(targetRow);
                oppLevel = suTarget.level ?? 1;
                oPow = tStats.effective.power;
                oSp = tStats.effective.speed;
                oIn = tStats.effective.intel;
                oSt = tStats.effective.stamina;
                oppGearSum = sumB(getEquipmentBonuses(targetRow).bonuses);
                oppEquipment = suTarget.equipment || {};
                oppGearUpgrades = suTarget.gearUpgrades || {};
            }
        }
        const oppCharSum = oPow + oSp + oIn + oSt;
        const oppTotal = oppCharSum + oppGearSum;

        const su = sanitizeUser(userRow);
        const eq = su.equipment || {};
        const playerAmulets = [];
        let computedAmuletSum = 0;
        for (const key of Object.keys(eq)) {
            const item = eq[key];
            if (!item || typeof item !== "object") continue;
            const isAmuletSlot = String(key).startsWith("amulet") || item.slot === "amulet";
            if (!isAmuletSlot) continue;
            if (typeof item.label === "string" && item.label.trim()) {
                playerAmulets.push(item);
                computedAmuletSum += sumItemStats(item);
            }
        }
        const playerTalismans = (su.talismans || [])
            .filter((t) => t && t.owned)
            .map((t) => ({
                id: t.id,
                name: t.name,
                icon: t.icon,
                level: t.level,
                effectPercent: t.effectPercent
            }));
        const talismanSum = playerTalismans.reduce(
            (acc, t) => acc + Math.max(0, Math.round(Number(t.effectPercent) || 0)),
            0
        );
        const playerTotalWithExtras = charSum + gearSum + tattooSum + computedAmuletSum;

        if (!opponent.isPlayer) {
            const visual = buildBotDisplayGear({
                opponentLevel: oppLevel,
                oppTotal,
                playerTotal: playerTotalWithExtras,
                playerLost: row.status === "lost",
                seedKey: `${fightId}:${opponent.id || opponent.name || "bot"}`
            });
            oppEquipment = visual.equipment;
            oppGearUpgrades = visual.gearUpgrades;
            oppDisplayGearSum = visual.displayGearSum;
            oppDisplayTattooSum = visual.displayTattooSum;
            oppDisplayAmuletSum = visual.displayAmuletSum;
            oppDisplayTattoo = visual.displayTattoo;
        }

        const triggeredTalismans = [];
        const seenTalismans = new Set();
        for (const rowLine of fightLog) {
            const rawHtml = String(rowLine?.html || rowLine?.text || "");
            if (!rawHtml) continue;
            const text = rawHtml.replace(/<[^>]*>/g, " ");
            const m = text.match(/Сработал талисман:\s*([^\n\r]+)/i);
            if (!m) continue;
            const talName = String(m[1] || "").trim().replace(/\s+/g, " ");
            if (!talName) continue;
            const key = talName.toLowerCase();
            if (seenTalismans.has(key)) continue;
            seenTalismans.add(key);
            triggeredTalismans.push(talName);
        }

        res.json({
            success: true,
            fightId,
            player: {
                name: su.name,
                level: su.level,
                character: su.character,
                avatar: su.avatar,
                club: su.club,
                clubName: su.clubName,
                clubEmblem: su.clubEmblem,
                nationalTeam: su.nationalTeam,
                nationalTeamName: su.nationalTeamName,
                nationalTeamFlag: su.nationalTeamFlag,
                equipment: eq,
                gearUpgrades: su.gearUpgrades || {},
                amulets: playerAmulets,
                talismans: playerTalismans,
                triggeredTalismans,
                charSum,
                gearSum,
                tattooSum,
                amuletSum: computedAmuletSum,
                talismanSum,
                total: playerTotalWithExtras
            },
            opponent: (() => {
                const oppDisplay = districtOpponentDisplay(opponent);
                const isBot = !opponent.isPlayer;
                const oppAmulets = [];
                let oppAmuletSum = 0;
                for (const key of Object.keys(oppEquipment)) {
                    const item = oppEquipment[key];
                    if (!item || typeof item !== "object") continue;
                    const isAmuletSlot = String(key).startsWith("amulet") || item.slot === "amulet";
                    if (!isAmuletSlot || !String(item.label || "").trim()) continue;
                    oppAmulets.push(item);
                    if (isBot) {
                        oppAmuletSum +=
                            oppDisplayAmuletSum > 0
                                ? Math.ceil(oppDisplayAmuletSum / Math.max(1, oppAmulets.length))
                                : 0;
                    } else {
                        oppAmuletSum += sumItemStats(item);
                    }
                }
                const botTotal =
                    oppCharSum +
                    (isBot ? oppDisplayGearSum + oppDisplayTattooSum + oppDisplayAmuletSum : 0);
                return {
                    name: oppDisplay.name,
                    level: oppLevel,
                    isPlayer: !!opponent.isPlayer,
                    emoji: oppDisplay.avatar ? null : oppDisplay.emoji,
                    avatar: oppDisplay.avatar,
                    club: oppDisplay.club,
                    avatarFill: oppDisplay.avatarFill,
                    templateId: oppDisplay.templateId,
                    equipment: oppEquipment,
                    gearUpgrades: oppGearUpgrades,
                    amulets: oppAmulets,
                    charSum: oppCharSum,
                    gearSum: isBot ? oppDisplayGearSum : oppGearSum,
                    tattooSum: isBot ? oppDisplayTattooSum : 0,
                    amuletSum: isBot ? oppDisplayAmuletSum : oppAmuletSum,
                    displayTattoo: isBot ? oppDisplayTattoo : null,
                    total: isBot ? botTotal : oppTotal + oppAmuletSum
                };
            })()
        });
    } catch (error) {
        console.error("fight-gear error:", error);
        res.status(500).json({ success: false, error: "Ошибка загрузки" });
    }
});

async function finishDistrictFightWin(user, opponent, email, fightId, log, enemyHp, preRewards, fightMeta) {
    const now = Date.now();
    const talRaw = talismans.resolveOwnedRaw(user);
    const luckyDollar = talismanEffects.rollLuckyDollar(talRaw, Math.random, talismans.MODES.DISTRICT);
    const zircon = talismanEffects.rollZirconBracelet(talRaw, Math.random, talismans.MODES.DISTRICT);

    let rublesGain =
        preRewards && typeof preRewards.rublesGain === "number"
            ? preRewards.rublesGain
            : randomInt(opponent.rubles[0], opponent.rubles[1]);
    const silverCap = opponent.isSteward ? 32 : 10;
    rublesGain = Math.min(silverCap, Math.max(0, rublesGain));
    if (luckyDollar) {
        rublesGain = Math.min(silverCap * 2, rublesGain * 2);
    }

    const oldLevel = levelFromXp(user.xp ?? 0);
    const lastXpAt = user.last_xp_at ?? 0;
    let xpGain = 0;
    if (now - lastXpAt >= XP_GRANT_COOLDOWN_MS) {
        xpGain = XP_PER_GRANT;
    }
    const newXp = normalizeXp((user.xp ?? 0) + xpGain);
    const newLevel = levelFromXp(newXp);
    const newLastXpAt = xpGain > 0 ? now : lastXpAt;
    const newRubles = (user.rubles ?? user.money ?? 0) + rublesGain;
    const grant = repEarningsService
        ? await repEarningsService.grantPlayerReputation({
              email,
              baseRep: REP_PER_DISTRICT_WIN,
              source: "district",
              club: user.club,
              prevReputation: user.reputation ?? 0,
              talismansRaw: talRaw
          })
        : { repGain: REP_PER_DISTRICT_WIN, skullsEarned: 0, mercedesBoost: false };
    const repReward = grant.repGain || 0;
    const skullsEarned = grant.skullsEarned || 0;
    const newRep = (user.reputation ?? 0) + repReward;
    const newSkulls = (user.skulls ?? 0) + skullsEarned;
    const newStreak = (user.district_streak ?? 0) + 1;
    const newStreakMax = Math.max(user.district_streak_max ?? 0, newStreak);
    const newSilverWon = (user.silver_won ?? 0) + rublesGain;
    const endRage = districtRageAfterFight(true, fightMeta?.startRage ?? user.rage ?? RAGE_BASE, {
        mayaTriggered: !!fightMeta?.mayaTriggered
    });
    let dollarsGain = 0;
    if (opponent.isSteward) {
        dollarsGain = randomInt(opponent.dollars?.[0] ?? 1, opponent.dollars?.[1] ?? 5);
    }
    const newDollars = (user.dollars ?? 0) + dollarsGain;

    let statPointsGained = 0;
    if (newLevel > oldLevel) {
        statPointsGained = await grantStatPointsForLevelDelta(email, oldLevel, newLevel);
    }

    const stats = getEffectiveStats(user);
    const maxHp = calcMaxHp(stats.effective.stamina, newLevel);
    let hpAfter = fightSsr.round2(
        Math.max(0, Math.min(maxHp, Number(fightMeta?.hpAfter ?? fightMeta?.hpStart ?? user.hp)))
    );
    if (zircon) {
        hpAfter = fightSsr.round2(Math.max(0, Math.min(maxHp, hpAfter * 2)));
    }

    await runQuery(
        "UPDATE district_fights SET status = 'won', player_hp = ?, enemy_hp = ?, log = ? WHERE id = ?",
        [hpAfter, enemyHp, JSON.stringify(log), fightId]
    );
    await runQuery("DELETE FROM district_kick_tokens WHERE fight_id = ?", [fightId]);

    await runQuery(
        `UPDATE users SET xp = ?, level = ?, rubles = ?, money = ?, dollars = ?, hp = ?, max_hp = ?,
         power = ?, speed = ?, intel = ?, stamina = ?, rage = ?, reputation = ?, skulls = ?,
         silver_won = ?, district_streak = ?, district_streak_max = ?,
         last_xp_at = ? WHERE email = ?`,
        [
            newXp,
            newLevel,
            newRubles,
            newRubles,
            newDollars,
            hpAfter,
            maxHp,
            stats.base.power,
            stats.base.speed,
            stats.base.intel,
            stats.base.stamina,
            endRage,
            newRep,
            newSkulls,
            newSilverWon,
            newStreak,
            newStreakMax,
            newLastXpAt,
            email
        ]
    );
    return {
        xpGain,
        rublesGain,
        dollarsGain,
        repGain: repReward,
        skullsEarned,
        mercedesBoost: !!grant.mercedesBoost,
        levelUp: newLevel > oldLevel ? newLevel : null,
        statPointsGained,
        statPointsMessage: statPointsGainMessage(statPointsGained),
        newLevel,
        newXp
    };
}

async function finishDistrictFightLost(user, email, fightId, log, enemyHp, fightMeta) {
    const rublesBefore = Math.max(0, Math.floor(user.rubles ?? user.money ?? 0));
    const cashOnHand = silverLoss.getCashOnHand(user);
    const lostAmount = silverLoss.calcSilverLossOnDefeat(cashOnHand);
    const silverLossAmount = Math.min(lostAmount, rublesBefore);
    const newSilverLost = (user.silver_lost ?? 0) + silverLossAmount;
    const prevRage = normalizeRage(fightMeta?.startRage ?? user.rage ?? RAGE_BASE);
    const endRage = districtRageAfterFight(false, prevRage, {
        mayaTriggered: !!fightMeta?.mayaTriggered
    });

    const stats = getEffectiveStats(user);
    const maxHp = calcMaxHp(stats.effective.stamina, user.level ?? 1);
    const hpAfter = fightSsr.round2(
        Math.max(0, Math.min(maxHp, Number(fightMeta?.hpAfter ?? fightMeta?.hpStart ?? user.hp)))
    );

    appendLog(log, `Ты на полу. −${silverLossAmount} сер. Ярость ${prevRage}→${endRage}.`, "sys");
    await runQuery(
        "UPDATE district_fights SET status = 'lost', player_hp = ?, enemy_hp = ?, log = ? WHERE id = ?",
        [hpAfter, enemyHp, JSON.stringify(log), fightId]
    );
    const rub = rublesBefore - silverLossAmount;
    await runQuery(
        `UPDATE users SET hp = ?, rage = ?, district_streak = 0, silver_lost = ?, rubles = ?, money = ? WHERE email = ?`,
        [hpAfter, endRage, newSilverLost, rub, rub, email]
    );
    await runQuery("DELETE FROM district_kick_tokens WHERE fight_id = ?", [fightId]);
    return { silverLoss: silverLossAmount, cashOnHand };
}

app.post("/wasteland/visit", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }
        const result = await persistMainQuestEvent(email, "wasteland_visit");
        const updated = await requireExistingUser(email);
        res.json({
            success: true,
            user: sanitizeUser(updated),
            rewardMessages: (result.messages || []).map((m) => m.message)
        });
    } catch (error) {
        console.error("wasteland visit error:", error);
        res.status(500).json({ success: false, error: "Ошибка посещения" });
    }
});

app.get("/daily-quests", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        const data = await loadDailyQuestsForUser(email);
        if (!data) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }
        res.json({ success: true, ...data });
    } catch (error) {
        console.error("daily-quests error:", error);
        res.status(500).json({ success: false, error: "Ошибка загрузки заданий" });
    }
});

app.post("/main-quest-widget/hide", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        const main = await loadMainQuestsForUser(email);
        const questId =
            main?.activeMainQuest?.id || String(body.questId || body.itemId || "").trim();
        if (!questId) {
            res.json({ success: true, mainQuestWidgetHidden: true });
            return;
        }

        await runQuery("UPDATE users SET ui_prefs = ? WHERE email = ?", [
            mergeUiPrefs(user.ui_prefs, { mainQuestWidgetDismissedQuestId: questId }),
            email
        ]);

        res.json({
            success: true,
            mainQuestWidgetHidden: true,
            dismissedQuestId: questId
        });
    } catch (error) {
        console.error("main-quest-widget hide error:", error);
        res.status(500).json({ success: false, error: "Ошибка сохранения" });
    }
});

app.get("/district/gym", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }
        res.json({ success: true, user: sanitizeUser(user) });
    } catch (error) {
        console.error("Gym GET error:", error);
        res.status(500).json({ success: false, error: "Ошибка качалки" });
    }
});

app.post("/district/gym", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const stat = String(body.stat || "").trim();

        const allocMap = { power: "power", speed: "speed", stamina: "stamina" };
        const column = allocMap[stat];
        if (!column) {
            res.status(400).json({ success: false, error: "Выбери: сила, ловкость или выносливость" });
            return;
        }

        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        const labels = {
            power: "Сила",
            speed: "Ловкость",
            stamina: "Выносливость"
        };

        const pending = Math.max(0, Math.floor(Number(user.stat_points) || 0));
        if (pending < 1) {
            res.status(400).json({
                success: false,
                error: "Нет свободных очков. Повысь уровень в районе."
            });
            return;
        }

        const current = user[column] ?? 10;
        if (current >= 50) {
            res.status(400).json({ success: false, error: "Стат на максимуме" });
            return;
        }

        await runQuery(
            `UPDATE users SET ${column} = ${column} + 1, stat_points = stat_points - 1 WHERE email = ? AND stat_points > 0`,
            [email]
        );
        const updated = await requireExistingUser(email);
        const left = Math.max(0, Math.floor(Number(updated.stat_points) || 0));
        res.json({
            success: true,
            message: `${labels[stat]} +1 · осталось очков: ${left}`,
            user: sanitizeUser(updated)
        });
    } catch (error) {
        console.error("Gym error:", error);
        res.status(500).json({ success: false, error: "Ошибка качалки" });
    }
});

app.post("/district/tattoo", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const stat = String(body.stat || "").trim();

        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        const rubles = user.rubles ?? user.money ?? 0;
        const pay = purchaseLogic.rublesPayPlan(rubles, TATTOO_COST);
        if (!pay.ok) {
            res.status(400).json({ success: false, error: pay.error });
            return;
        }

        const tattoos = getActiveTattoos(user);
        const bonus = 2;
        if (stat === "power") tattoos.power = (tattoos.power || 0) + bonus;
        else if (stat === "speed") tattoos.speed = (tattoos.speed || 0) + bonus;
        else if (stat === "intel") tattoos.intel = (tattoos.intel || 0) + bonus;
        else if (stat === "stamina") tattoos.stamina = (tattoos.stamina || 0) + bonus;
        else {
            res.status(400).json({ success: false, error: "Выбери тату" });
            return;
        }
        tattoos.expiresAt = Date.now() + TATTOO_DURATION_MS;

        const newRubles = pay.newRubles;
        await runQuery("UPDATE users SET tattoos = ?, rubles = ?, money = ? WHERE email = ?", [
            JSON.stringify(tattoos),
            newRubles,
            newRubles,
            email
        ]);

        const updated = await requireExistingUser(email);
        res.json({
            success: true,
            message: "Тату набита на 12 часов",
            user: sanitizeUser(updated)
        });
    } catch (error) {
        console.error("Tattoo error:", error);
        res.status(500).json({ success: false, error: "Ошибка тату-салона" });
    }
});

app.get("/clubs/catalog", (req, res) => {
    res.json({ success: true, clubs: clubsData.clubsCatalogForClient() });
});

app.get("/clubs/profile", async (req, res) => {
    try {
        const clubId = String(req.query.club || req.query.id || "").trim();
        const club = clubsData.getClub(clubId);
        if (!club) {
            res.status(404).json({ success: false, error: "Клуб не найден" });
            return;
        }
        const rankStats = clubReputationRatingService
            ? await clubReputationRatingService.getClubRankingStats(clubId)
            : null;
        const fanCount = rankStats?.fanCount ?? 0;
        const totalReputation = rankStats?.totalReputation ?? 0;
        res.json({
            success: true,
            club: {
                id: club.id,
                name: club.name,
                emblem: club.emblem,
                description: clubsData.getClubDescription(clubId),
                fanCount,
                fanCountLabel: `${fanCount} ${clubsData.fanWord(fanCount)}`,
                totalReputation,
                rating: totalReputation,
                rankPosition: rankStats?.position ?? null,
                position: rankStats?.position ?? null
            }
        });
    } catch (error) {
        console.error("clubs/profile error:", error);
        res.status(500).json({ success: false, error: "Ошибка загрузки клуба" });
    }
});

app.get("/mag/talismans", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }
        res.json({
            success: true,
            user: sanitizeUser(user),
            talismans: talismans.catalogWithOwnership(user.talismans)
        });
    } catch (error) {
        console.error("mag/talismans error:", error);
        res.status(500).json({ success: false, error: "Ошибка талисманов" });
    }
});

app.post("/mag/talismans/buy", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const talismanId = String(body.talismanId || "").trim();
        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }
        const def = talismans.TALISMANS[talismanId];
        if (!def) {
            res.status(400).json({ success: false, error: "Талисман не найден." });
            return;
        }

        const ownedCheck = talismans.parseOwnedTalismans(talismans.resolveOwnedRaw(user));
        if (ownedCheck[talismanId]) {
            res.status(400).json({ success: false, error: "Талисман уже куплен." });
            return;
        }

        const haveDollars = Math.max(0, Math.floor(Number(user.dollars) || 0));
        const haveMushrooms = Math.max(0, Math.floor(Number(user.mushrooms) || 0));
        const needDollars = Math.max(0, Math.floor(Number(def.priceDollars) || 0));
        const needMushrooms = Math.max(0, Math.floor(Number(def.priceMushrooms) || 0));

        const pay = purchaseLogic.dualCurrencyPayPlan(
            haveDollars,
            haveMushrooms,
            needDollars,
            needMushrooms
        );
        if (!pay.ok) {
            res.status(400).json({ success: false, error: pay.error });
            return;
        }

        const bought = talismans.buyTalisman(user, talismanId);
        if (!bought.ok) {
            res.status(400).json({ success: false, error: bought.error });
            return;
        }

        if (pay.payWith === "dollars") {
            await runQuery("UPDATE users SET dollars = ?, talismans = ? WHERE email = ?", [
                pay.newDollars,
                JSON.stringify(bought.owned),
                email
            ]);
        } else {
            await runQuery("UPDATE users SET mushrooms = ?, talismans = ? WHERE email = ?", [
                pay.newMushrooms,
                JSON.stringify(bought.owned),
                email
            ]);
        }

        await persistMainQuestEvent(email, "talisman_buy");
        const updated = await requireExistingUser(email);
        res.json({
            success: true,
            user: sanitizeUser(updated),
            talismans: talismans.catalogWithOwnership(updated.talismans)
        });
    } catch (error) {
        console.error("mag/talismans/buy error:", error);
        res.status(500).json({ success: false, error: "Ошибка покупки талисмана" });
    }
});

app.get("/shop/items", (req, res) => {
    const items = {};
    for (const [id, def] of Object.entries(SHOP_ITEMS)) {
        items[id] = shopItemForApi(id, def);
    }
    res.json({ success: true, items, sections: shopSections() });
});

app.post("/shop/buy", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const itemId = String(body.itemId || "").trim();

        const item = SHOP_ITEMS[itemId];
        if (!item) {
            res.status(400).json({ success: false, error: "Товар не найден" });
            return;
        }
        if (item.shopHidden) {
            res.status(400).json({ success: false, error: "Этот предмет больше не продаётся у дилера" });
            return;
        }

        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        const xp = normalizeXp(user.xp);
        const level = levelFromXp(xp);
        if (level < item.minLevel) {
            res.status(400).json({ success: false, error: "Доступно на следующем уровне" });
            return;
        }

        const inventory = getUserInventory(user);
        if (inventory.includes(itemId)) {
            res.status(400).json({ success: false, error: "Уже куплено" });
            return;
        }

        const rubles = user.rubles ?? user.money ?? 0;
        const pay = purchaseLogic.rublesPayPlan(rubles, item.cost);
        if (!pay.ok) {
            res.status(400).json({ success: false, error: pay.error });
            return;
        }

        inventory.push(itemId);
        const newRubles = pay.newRubles;
        const upgrades = gearUpgrades.ensureItemUpgrade(parseJson(user.gear_upgrades, {}), itemId);
        await runQuery(
            "UPDATE users SET inventory = ?, rubles = ?, money = ?, gear_upgrades = ? WHERE email = ?",
            [JSON.stringify(inventory), newRubles, newRubles, JSON.stringify(upgrades), email]
        );

        await persistMainQuestEvent(email, "dealer_buy");
        const updated = await requireExistingUser(email);
        res.json({
            success: true,
            message: `Куплено: ${item.label}. Надень вещь в гардеробе.`,
            user: sanitizeUser(updated)
        });
    } catch (error) {
        console.error("Shop error:", error);
        res.status(500).json({ success: false, error: "Ошибка покупки" });
    }
});

app.get("/larek/items", (req, res) => {
    const items = {};
    for (const [id, def] of Object.entries(LAREK_ITEMS)) {
        items[id] = { ...def };
    }
    res.json({ success: true, items });
});

app.get("/larek/catalog", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }
        const consumables = getUserConsumables(user);
        res.json({
            success: true,
            user: sanitizeUser(user),
            food: larekFoodCatalogForShop(consumables),
            provisions: provisionsData.catalogForShop(consumables)
        });
    } catch (error) {
        console.error("larek catalog error:", error);
        res.status(500).json({ success: false, error: "Ошибка ларька" });
    }
});

/** @deprecated — используй /larek/catalog */
app.get("/mag/provisions", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }
        const consumables = getUserConsumables(user);
        res.json({
            success: true,
            user: sanitizeUser(user),
            items: provisionsData.catalogForShop(consumables)
        });
    } catch (error) {
        console.error("mag provisions error:", error);
        res.status(500).json({ success: false, error: "Ошибка провианта" });
    }
});

async function buyProvisionItems(user, itemId, qty) {
    const item = provisionsData.PROVISION_ITEMS[itemId];
    if (!item) return { ok: false, error: "Товар не найден" };

    const totalDollars = item.priceDollars * qty;
    const totalMushrooms = item.priceMushrooms * qty;
    const haveDollars = Math.max(0, Math.floor(Number(user.dollars) || 0));
    const haveMushrooms = Math.max(0, Math.floor(Number(user.mushrooms) || 0));

    const pay = purchaseLogic.dualCurrencyPayPlan(
        haveDollars,
        haveMushrooms,
        totalDollars,
        totalMushrooms
    );
    if (!pay.ok) return { ok: false, error: pay.error };

    const consumables = { ...parseJson(user.consumables, {}), ...getUserConsumables(user) };
    consumables[itemId] = (consumables[itemId] || 0) + qty;

    if (pay.payWith === "dollars") {
        await runQuery("UPDATE users SET consumables = ?, dollars = ? WHERE email = ?", [
            JSON.stringify(consumables),
            pay.newDollars,
            user.email
        ]);
    } else {
        await runQuery("UPDATE users SET consumables = ?, mushrooms = ? WHERE email = ?", [
            JSON.stringify(consumables),
            pay.newMushrooms,
            user.email
        ]);
    }

    return {
        ok: true,
        message: `Куплено: ${item.label} ×${qty}. Смотри в гардеробе.`,
        count: consumables[itemId]
    };
}

app.post("/provisions/use", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const itemId = String(body.itemId || "").trim();

        if (!provisionsData.PROVISION_ITEMS[itemId]) {
            res.status(400).json({ success: false, error: "Предмет не найден" });
            return;
        }

        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        const maxHp = MAX_HP_CAP;
        const out = provisionsData.useProvisionFromInventory(
            {
                consumables: getUserConsumables(user),
                consumablesUsedAt: getConsumablesUsedAt(user),
                rage: user.rage,
                hp: user.hp
            },
            itemId,
            Date.now(),
            { maxHp }
        );

        if (!out.ok) {
            res.status(400).json({ success: false, error: out.error });
            return;
        }

        const sets = ["consumables = ?", "consumables_used_at = ?"];
        const params = [JSON.stringify(out.consumables), JSON.stringify(out.usedAt)];

        if (out.updates?.hp != null) {
            sets.push("hp = ?");
            params.push(out.updates.hp);
        }
        if (out.updates?.rage != null) {
            sets.push("rage = ?");
            params.push(out.updates.rage);
        }

        params.push(email);
        await runQuery(`UPDATE users SET ${sets.join(", ")} WHERE email = ?`, params);

        const updated = await requireExistingUser(email);
        res.json({
            success: true,
            message: out.message,
            user: sanitizeUser(updated),
            count: out.consumables[itemId] ?? 0
        });
    } catch (error) {
        console.error("provisions use error:", error);
        res.status(500).json({ success: false, error: "Ошибка использования" });
    }
});

app.post("/provisions/buy", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const itemId = String(body.itemId || "").trim();
        const qty = Math.max(1, Math.min(10, Math.floor(Number(body.qty) || 1)));

        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        const out = await buyProvisionItems(user, itemId, qty);
        if (!out.ok) {
            res.status(400).json({ success: false, error: out.error });
            return;
        }

        const updated = await requireExistingUser(email);
        res.json({
            success: true,
            message: out.message,
            user: sanitizeUser(updated),
            count: out.count
        });
    } catch (error) {
        console.error("provisions buy error:", error);
        res.status(500).json({ success: false, error: "Ошибка покупки" });
    }
});

app.post("/larek/buy", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const itemId = String(body.itemId || "").trim();
        const qty = Math.max(1, Math.min(10, Math.floor(Number(body.qty) || 1)));

        const item = findConsumableItem(itemId);
        if (!item) {
            res.status(400).json({ success: false, error: "Товар не найден" });
            return;
        }

        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        if (provisionsData.PROVISION_ITEMS[itemId]) {
            const out = await buyProvisionItems(user, itemId, qty);
            if (!out.ok) {
                res.status(400).json({ success: false, error: out.error });
                return;
            }
            const updated = await requireExistingUser(email);
            res.json({
                success: true,
                message: out.message,
                user: sanitizeUser(updated),
                count: out.count
            });
            return;
        }

        const food = LAREK_ITEMS[itemId];
        if (!food) {
            res.status(400).json({ success: false, error: "Товар не найден" });
            return;
        }

        const totalCost = food.cost * qty;
        const currency = food.currency === "mushrooms" ? "mushrooms" : "rubles";
        const consumables = { ...parseJson(user.consumables, {}), ...getUserConsumables(user) };
        consumables[itemId] = (consumables[itemId] || 0) + qty;

        if (currency === "mushrooms") {
            const mushrooms = user.mushrooms ?? 0;
            const pay = purchaseLogic.mushroomsPayPlan(mushrooms, totalCost);
            if (!pay.ok) {
                res.status(400).json({ success: false, error: pay.error });
                return;
            }
            await runQuery("UPDATE users SET consumables = ?, mushrooms = ? WHERE email = ?", [
                JSON.stringify(consumables),
                pay.newMushrooms,
                email
            ]);
        } else {
            const rubles = user.rubles ?? user.money ?? 0;
            const pay = purchaseLogic.rublesPayPlan(rubles, totalCost);
            if (!pay.ok) {
                res.status(400).json({ success: false, error: pay.error });
                return;
            }
            const newRubles = pay.newRubles;
            await runQuery("UPDATE users SET consumables = ?, rubles = ?, money = ? WHERE email = ?", [
                JSON.stringify(consumables),
                newRubles,
                newRubles,
                email
            ]);
        }

        const updated = await requireExistingUser(email);
        res.json({
            success: true,
            message: `Куплено: ${food.label} ×${qty}. Смотри в гардеробе.`,
            user: sanitizeUser(updated),
            count: consumables[itemId]
        });
    } catch (error) {
        console.error("Larek buy error:", error);
        res.status(500).json({ success: false, error: "Ошибка покупки" });
    }
});

app.post("/larek/use", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const itemId = String(body.itemId || "").trim();

        const item = LAREK_ITEMS[itemId];
        if (!item) {
            res.status(400).json({ success: false, error: "Предмет не найден" });
            return;
        }

        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        const consumables = getUserConsumables(user);
        if ((consumables[itemId] || 0) < 1) {
            res.status(400).json({ success: false, error: "Нет предметов в наличии" });
            return;
        }

        const usedAt = getConsumablesUsedAt(user);
        const now = Date.now();
        const last = usedAt[itemId] || 0;
        const cooldownMs = item.cooldownMs || 0;
        if (cooldownMs > 0 && now - last < cooldownMs) {
            const left = cooldownMs - (now - last);
            const wait =
                itemId === "hotdog"
                    ? formatCooldownMinSec(left)
                    : formatCooldownWait(left);
            const errMsg =
                itemId === "hotdog"
                    ? `⏳ Следующий хот-дог можно использовать через ${wait}`
                    : `Можно использовать снова через ${wait}`;
            res.status(400).json({
                success: false,
                error: errMsg
            });
            return;
        }

        consumables[itemId] = consumables[itemId] - 1;
        usedAt[itemId] = now;

        let hp = Math.min(MAX_HP_CAP, Math.max(0, Math.round(user.hp ?? MAX_HP_CAP)));
        let energy = Math.min(MAX_ENERGY, Math.max(0, user.energy ?? MAX_ENERGY));
        let message = "";

        if (item.useHp) {
            hp = Math.min(MAX_HP_CAP, hp + item.useHp);
            message = item.useSuccessMessage || `${item.label}: +${item.useHp} HP`;
        } else if (item.useEnergy) {
            energy = Math.min(MAX_ENERGY, energy + item.useEnergy);
            message = `${item.label}: +${item.useEnergy} энергии`;
        } else {
            res.status(400).json({ success: false, error: "Предмет нельзя использовать" });
            return;
        }

        await runQuery(
            "UPDATE users SET consumables = ?, consumables_used_at = ?, hp = ?, energy = ? WHERE email = ?",
            [JSON.stringify(consumables), JSON.stringify(usedAt), hp, energy, email]
        );

        const updated = await requireExistingUser(email);
        res.json({
            success: true,
            message,
            user: sanitizeUser(updated),
            count: consumables[itemId]
        });
    } catch (error) {
        console.error("Larek use error:", error);
        res.status(500).json({ success: false, error: "Ошибка использования" });
    }
});

app.post("/shop/equip", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const itemId = String(body.itemId || "").trim();

        const item = SHOP_ITEMS[itemId];
        if (!item) {
            res.status(400).json({ success: false, error: "Предмет не найден" });
            return;
        }

        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        const inventory = getUserInventory(user);
        if (!inventory.includes(itemId)) {
            res.status(400).json({ success: false, error: "Сначала купи предмет у дилера" });
            return;
        }

        const equipment = parseJson(user.equipment, {});
        equipment[item.slot] = equipmentItemFromShop(itemId);

        await runQuery("UPDATE users SET equipment = ? WHERE email = ?", [JSON.stringify(equipment), email]);

        const updated = await requireExistingUser(email);
        res.json({
            success: true,
            message: `Надето: ${item.label}`,
            user: sanitizeUser(updated)
        });
    } catch (error) {
        console.error("Shop equip error:", error);
        res.status(500).json({ success: false, error: "Ошибка экипировки" });
    }
});

function findEquipmentSlotForItem(equipment, itemId) {
    if (!itemId) return null;
    for (const key of Object.keys(equipment)) {
        const item = equipment[key];
        if (item && item.id === itemId) return key;
    }
    const def = SHOP_ITEMS[itemId];
    if (def && equipment[def.slot]?.id === itemId) return def.slot;
    return null;
}

app.post("/shop/unequip", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const itemId = String(body.itemId || "").trim();
        const slot = String(body.slot || "").trim();

        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        const equipment = parseJson(user.equipment, {});
        const targetSlot = slot || findEquipmentSlotForItem(equipment, itemId);
        const equipped = targetSlot ? equipment[targetSlot] : null;

        if (!targetSlot || !equipped) {
            res.status(400).json({ success: false, error: "Предмет не надет" });
            return;
        }

        const label =
            equipped.label ||
            (equipped.id && SHOP_ITEMS[equipped.id]?.label) ||
            "Предмет";

        delete equipment[targetSlot];

        await runQuery("UPDATE users SET equipment = ? WHERE email = ?", [JSON.stringify(equipment), email]);

        const updated = await requireExistingUser(email);
        res.json({
            success: true,
            message: `Снято: ${label}`,
            user: sanitizeUser(updated)
        });
    } catch (error) {
        console.error("Shop unequip error:", error);
        res.status(500).json({ success: false, error: "Ошибка снятия предмета" });
    }
});

const COLLIDER_WORKSHOP = { slot: "weapon", itemsKey: "weapons", equipKey: "weapon" };
const SEWING_WORKSHOP = {
    slots: ["clothes", "boots", "head"],
    itemsKey: "clothes",
    equipKey: "clothes"
};

function workshopPayload(user, workshopConfig, selectedId) {
    const inventory = getUserInventory(user);
    const payload = industrialWorkshop.buildWorkshopPayload(
        user,
        SHOP_ITEMS,
        inventory,
        workshopConfig,
        selectedId || null
    );
    return { ...payload, user: sanitizeUser(user) };
}

async function saveWorkshopUpgradesIfNeeded(email, payload, workshopConfig) {
    return industrialWorkshop.saveWorkshopUpgradesIfNeeded(
        runQuery,
        getQuery,
        email,
        payload,
        (user, activeId) => workshopPayload(user, workshopConfig, activeId)
    );
}

function registerIndustrialWorkshopRoutes(routePrefix, workshopConfig, messages) {
    app.get(`${routePrefix}/state`, async (req, res) => {
        try {
            const email = normalizeEmail(req.query.email);
            const selectedId = String(req.query.itemId || "").trim();
            if (!email) {
                res.status(400).json({ success: false, error: "Email обязателен" });
                return;
            }
            const user = await syncUserResources(email);
            if (!user) {
                res.status(404).json({ success: false, error: "Пользователь не найден" });
                return;
            }
            res.json(
                await saveWorkshopUpgradesIfNeeded(
                    email,
                    workshopPayload(user, workshopConfig, selectedId || null),
                    workshopConfig
                )
            );
        } catch (error) {
            console.error(`${routePrefix} state error:`, error);
            res.status(500).json({ success: false, error: messages.stateError });
        }
    });

    app.post(`${routePrefix}/upgrade`, async (req, res) => {
        try {
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const email = normalizeEmail(body.email);
            const itemId = String(body.itemId || "").trim();
            const def = SHOP_ITEMS[itemId];
            const allowedSlots = industrialWorkshop.workshopSlots(workshopConfig);

            if (!email || !def || !allowedSlots.includes(def.slot)) {
                res.status(400).json({ success: false, error: messages.invalidItem });
                return;
            }

            let user = await syncUserResources(email);
            if (!user) {
                res.status(404).json({ success: false, error: "Пользователь не найден" });
                return;
            }

            const inventory = getUserInventory(user);
            if (!inventory.includes(itemId)) {
                res.status(400).json({ success: false, error: messages.notOwned });
                return;
            }

            let upgrades = parseJson(user.gear_upgrades, {});
            upgrades = gearUpgrades.normalizeUpgrades(upgrades, SHOP_ITEMS).upgrades;
            const started = gearUpgrades.startUpgrade(upgrades, itemId, def);
            if (!started.ok) {
                res.status(400).json({ success: false, error: started.error });
                return;
            }

            const dollars = Math.max(0, Math.floor(Number(user.dollars) || 0));
            const mushrooms = Math.max(0, Math.floor(Number(user.mushrooms) || 0));
            const pay = purchaseLogic.dualCurrencyPayPlan(
                dollars,
                mushrooms,
                started.costDollars,
                started.costDollars
            );
            if (!pay.ok) {
                res.status(400).json({ success: false, error: pay.error });
                return;
            }

            if (pay.payWith === "dollars") {
                await runQuery("UPDATE users SET dollars = ?, gear_upgrades = ? WHERE email = ?", [
                    pay.newDollars,
                    JSON.stringify(started.upgrades),
                    email
                ]);
            } else {
                await runQuery("UPDATE users SET mushrooms = ?, gear_upgrades = ? WHERE email = ?", [
                    pay.newMushrooms,
                    JSON.stringify(started.upgrades),
                    email
                ]);
            }

            await persistMainQuestEvent(email, "gear_upgrade");
            user = await getQuery("SELECT * FROM users WHERE email = ?", [email]);
            res.json({
                ...(await saveWorkshopUpgradesIfNeeded(
                    email,
                    workshopPayload(user, workshopConfig, itemId),
                    workshopConfig
                )),
                flash: messages.upgradeFlash
            });
        } catch (error) {
            console.error(`${routePrefix} upgrade error:`, error);
            res.status(500).json({ success: false, error: messages.upgradeError });
        }
    });

    app.post(`${routePrefix}/speedup`, async (req, res) => {
        try {
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const email = normalizeEmail(body.email);
            const itemId = String(body.itemId || "").trim();
            const def = SHOP_ITEMS[itemId];
            const allowedSlots = industrialWorkshop.workshopSlots(workshopConfig);

            if (!email || !def || !allowedSlots.includes(def.slot)) {
                res.status(400).json({ success: false, error: messages.invalidItem });
                return;
            }

            let user = await syncUserResources(email);
            if (!user) {
                res.status(404).json({ success: false, error: "Пользователь не найден" });
                return;
            }

            let upgrades = parseJson(user.gear_upgrades, {});
            upgrades = gearUpgrades.normalizeUpgrades(upgrades, SHOP_ITEMS).upgrades;
            const row = upgrades[itemId];
            if (!row || !row.until || row.until <= Date.now()) {
                res.status(400).json({ success: false, error: "Нет активного улучшения" });
                return;
            }
            if (row.level >= gearUpgrades.MAX_GEAR_LEVEL) {
                res.status(400).json({ success: false, error: gearUpgrades.maxUpgradeMessage(def) });
                return;
            }

            const cost = gearUpgrades.speedupMushroomCost(row.until - Date.now());
            const mushrooms = Math.max(0, Math.floor(Number(user.mushrooms) || 0));
            const pay = purchaseLogic.mushroomsPayPlan(mushrooms, cost);
            if (!pay.ok) {
                res.status(400).json({ success: false, error: pay.error });
                return;
            }

            const finished = gearUpgrades.finishUpgradeNow(upgrades, itemId, def);
            if (!finished.ok) {
                res.status(400).json({ success: false, error: finished.error });
                return;
            }

            await runQuery("UPDATE users SET mushrooms = ?, gear_upgrades = ? WHERE email = ?", [
                pay.newMushrooms,
                JSON.stringify(finished.upgrades),
                email
            ]);

            user = await getQuery("SELECT * FROM users WHERE email = ?", [email]);
            res.json({
                ...(await saveWorkshopUpgradesIfNeeded(
                    email,
                    workshopPayload(user, workshopConfig, itemId),
                    workshopConfig
                )),
                flash: messages.speedupFlash
            });
        } catch (error) {
            console.error(`${routePrefix} speedup error:`, error);
            res.status(500).json({ success: false, error: messages.speedupError });
        }
    });
}

registerIndustrialWorkshopRoutes("/industrial/collider", COLLIDER_WORKSHOP, {
    stateError: "Ошибка коллайдера",
    invalidItem: "Некорректное оружие",
    notOwned: "Сначала купи оружие у дилера",
    upgradeFlash: "Ты оставил оружие на прокачку!",
    upgradeError: "Ошибка улучшения",
    speedupFlash: "Улучшение завершено!",
    speedupError: "Ошибка ускорения"
});

registerIndustrialWorkshopRoutes("/industrial/sewing", SEWING_WORKSHOP, {
    stateError: "Ошибка швейного цеха",
    invalidItem: "Некорректная одежда",
    notOwned: "Сначала купи одежду у дилера",
    upgradeFlash: "Ты оставил одежду на прокачку!",
    upgradeError: "Ошибка улучшения",
    speedupFlash: "Улучшение завершено!",
    speedupError: "Ошибка ускорения"
});

app.post("/mushrooms", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }
        const energy = user.energy ?? MAX_ENERGY;
        if (energy >= MAX_ENERGY) {
            res.json({ success: true, message: "Энергия полная", user: sanitizeUser(user) });
            return;
        }
        const newEnergy = Math.min(MAX_ENERGY, energy + 35);
        await runQuery("UPDATE users SET energy = ? WHERE email = ?", [newEnergy, email]);
        const updated = await requireExistingUser(email);
        res.json({ success: true, message: "+35 энергии", user: sanitizeUser(updated) });
    } catch (error) {
        console.error("Mushrooms error:", error);
        res.status(500).json({ success: false, error: "Ошибка" });
    }
});

function formatLotteryLogTs(ms) {
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function pickLotteryPrize() {
    const roll = randomInt(1, 100);
    if (roll <= 30) return { label: "+25 ₽", rubles: 25, dollars: 0, mushrooms: 0, energy: 0 };
    if (roll <= 48) return { label: "+1 $", rubles: 0, dollars: 1, mushrooms: 0, energy: 0 };
    if (roll <= 62) return { label: "+2 🍄", rubles: 0, dollars: 0, mushrooms: 2, energy: 0 };
    if (roll <= 75) return { label: "+10 энергии", rubles: 0, dollars: 0, mushrooms: 0, energy: 10 };
    if (roll <= 85) return { label: "Патроны удачи", rubles: 0, dollars: 0, mushrooms: 0, energy: 0 };
    if (roll <= 92) return { label: "+3 $", rubles: 0, dollars: 3, mushrooms: 0, energy: 0 };
    if (roll <= 97) return { label: "Озверин", rubles: 0, dollars: 0, mushrooms: 0, energy: 0 };
    return { label: "VIP статус на 7 дней", rubles: 0, dollars: 0, mushrooms: 0, energy: 0 };
}

app.get("/center/kicker/state", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        if (!email) {
            res.status(400).json({ success: false, error: "Email обязателен" });
            return;
        }
        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }
        const last = user.kicker_last_play ?? 0;
        const cooldownUntil = last + KICKER_COOLDOWN_MS;
        res.json({ success: true, cooldownUntil });
    } catch (error) {
        console.error("Kicker state error:", error);
        res.status(500).json({ success: false, error: "Ошибка" });
    }
});

app.post("/center/kicker/play", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const opponentId = String(body.opponentId || "").trim();
        const opp = KICKER_OPPONENTS[opponentId];

        if (!email) {
            res.status(400).json({ success: false, error: "Email обязателен" });
            return;
        }
        if (!opp) {
            res.status(400).json({ success: false, error: "Неверный соперник" });
            return;
        }

        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        const last = user.kicker_last_play ?? 0;
        if (Date.now() < last + KICKER_COOLDOWN_MS) {
            res.status(400).json({ success: false, error: "Подожди, кулдаун ещё не прошёл" });
            return;
        }

        const rubles = user.rubles ?? user.money ?? 0;
        const pay = purchaseLogic.rublesPayPlan(rubles, opp.cost);
        if (!pay.ok) {
            res.status(400).json({ success: false, error: pay.error });
            return;
        }

        const { effective } = getEffectiveStats(user);
        const playerScore = effective.power + effective.speed * 0.35 + randomInt(0, 14);
        const botScore = opp.power + randomInt(0, 12);
        const win = playerScore >= botScore;

        let newRubles = pay.newRubles;
        let newDollars = user.dollars ?? 0;
        let message = `Проигрыш: ${opp.name} сильнее. Потеряно ${opp.cost} ₽`;
        if (win) {
            const winDollars = talismanEffects.rollChip(
                talismans.resolveOwnedRaw(user),
                Math.random,
                talismans.MODES.KICKER
            )
                ? opp.win * 2
                : opp.win;
            newDollars += winDollars;
            message = `Победа над ${opp.name}! +${winDollars} $ (ставка ${opp.cost} ₽)`;
        }

        const now = Date.now();
        await runQuery(
            "UPDATE users SET rubles = ?, money = ?, dollars = ?, kicker_last_play = ? WHERE email = ?",
            [newRubles, newRubles, newDollars, now, email]
        );
        const updated = await requireExistingUser(email);
        await recordPlayerEvent(email, {
            kind: win ? playerEvents.EVENT_KINDS.KICKER_WIN : playerEvents.EVENT_KINDS.KICKER_LOSS,
            summary: win ? "Ты выиграл матч." : "Ты проиграл матч.",
            detail: {
                text: message,
                opponentName: opp.name,
                win
            }
        });
        res.json({ success: true, message, user: sanitizeUser(updated) });
    } catch (error) {
        console.error("Kicker play error:", error);
        res.status(500).json({ success: false, error: "Ошибка игры" });
    }
});

app.get("/center/lottery/log", async (req, res) => {
    try {
        const rows = await allQuery(
            "SELECT email, player_name, prize, created_at FROM lottery_log ORDER BY id DESC LIMIT 25"
        );
        const out = rows.map((r) => ({
            email: r.email ? String(r.email).toLowerCase() : null,
            name: r.player_name,
            prize: r.prize,
            ts: formatLotteryLogTs(r.created_at)
        }));
        res.json({ success: true, rows: out });
    } catch (error) {
        console.error("Lottery log error:", error);
        res.status(500).json({ success: false, error: "Ошибка" });
    }
});

app.post("/center/lottery/play", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const currency = String(body.currency || "").trim().toLowerCase();

        if (!email) {
            res.status(400).json({ success: false, error: "Email обязателен" });
            return;
        }
        if (currency !== "dollars" && currency !== "mushrooms") {
            res.status(400).json({ success: false, error: "Выбери валюту: dollars или mushrooms" });
            return;
        }

        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        const dollars = user.dollars ?? 0;
        const mushrooms = user.mushrooms ?? 0;
        let payDollars = dollars;
        let payMushrooms = mushrooms;

        const freeTickets = Math.max(0, Math.floor(Number(user.lottery_free_tickets) || 0));
        let usedFreeTicket = false;

        if (currency === "dollars") {
            if (freeTickets > 0) {
                usedFreeTicket = true;
            } else {
                const pay = purchaseLogic.dualCurrencyPayPlan(
                    dollars,
                    mushrooms,
                    LOTTERY_COST,
                    LOTTERY_COST
                );
                if (!pay.ok) {
                    res.status(400).json({ success: false, error: pay.error });
                    return;
                }
                payDollars = pay.newDollars;
                payMushrooms = pay.newMushrooms;
            }
        } else {
            const pay = purchaseLogic.mushroomsPayPlan(mushrooms, LOTTERY_COST);
            if (!pay.ok) {
                res.status(400).json({ success: false, error: pay.error });
                return;
            }
            payMushrooms = pay.newMushrooms;
        }

        const prize = pickLotteryPrize();
        const rubles = user.rubles ?? user.money ?? 0;
        let newRubles = rubles + (prize.rubles || 0);
        let newDollars = payDollars + (prize.dollars || 0);
        let newMushrooms = payMushrooms + (prize.mushrooms || 0);
        const energy = user.energy ?? MAX_ENERGY;
        let newEnergy = Math.min(MAX_ENERGY, energy + (prize.energy || 0));

        const now = Date.now();
        const name = user.name || "Игрок";

        const ticketsLeft = usedFreeTicket ? freeTickets - 1 : freeTickets;

        await runQuery(
            "UPDATE users SET rubles = ?, money = ?, dollars = ?, mushrooms = ?, energy = ?, lottery_free_tickets = ? WHERE email = ?",
            [newRubles, newRubles, newDollars, newMushrooms, newEnergy, ticketsLeft, email]
        );
        await runQuery("INSERT INTO lottery_log (email, player_name, prize, created_at) VALUES (?, ?, ?, ?)", [
            email,
            name,
            prize.label,
            now
        ]);

        const updated = await requireExistingUser(email);
        const message = usedFreeTicket
            ? `Бесплатный билет. Приз: ${prize.label}`
            : `Билет куплен. Приз: ${prize.label}`;
        if ((prize.dollars || 0) > 10) {
            await recordPlayerEvent(email, {
                kind: playerEvents.EVENT_KINDS.LOTTERY,
                summary: `Выигрыш по билету: ${prize.label}`,
                detail: {
                    text: message,
                    prizeLabel: prize.label,
                    dollars: prize.dollars || 0
                }
            });
        }
        res.json({ success: true, message, user: sanitizeUser(updated) });
    } catch (error) {
        console.error("Lottery play error:", error);
        res.status(500).json({ success: false, error: "Ошибка лотереи" });
    }
});

async function assignWorkJob(email, energyTier, playerLevel, excludeName) {
    const fields = workLogic.newJobFields(energyTier, playerLevel, excludeName);
    await runQuery(
        `UPDATE users SET work_job_name = ?, work_energy_done = 0, work_energy_need = ?, work_reward = ?,
         work_status = 'offered', work_cooldown_until = 0 WHERE email = ?`,
        [fields.work_job_name, fields.work_energy_need, fields.work_reward, email]
    );
}

async function applyWorkPeriodToDb(email, user) {
    const now = Date.now();
    const ensured = workLogic.ensureWorkPeriod(user, now);
    const completedJson = JSON.stringify(ensured.completed);
    const periodStart = ensured.periodStart;

    if (ensured.reset) {
        await runQuery(
            `UPDATE users SET work_period_start = ?, work_completed = ?, work_cooldown_until = 0,
             work_status = '', work_job_name = '', work_energy_done = 0 WHERE email = ?`,
            [periodStart, completedJson, email]
        );
        return getQuery("SELECT * FROM users WHERE email = ?", [email]);
    }

    if (
        (user.work_period_start ?? 0) !== periodStart ||
        JSON.stringify(workLogic.parseCompletedList(user.work_completed)) !== completedJson
    ) {
        await runQuery("UPDATE users SET work_period_start = ?, work_completed = ? WHERE email = ?", [
            periodStart,
            completedJson,
            email
        ]);
        return getQuery("SELECT * FROM users WHERE email = ?", [email]);
    }

    return user;
}

async function ensureWorkJobForUser(email) {
    let user = await syncUserResources(email);
    if (!user) return null;

    user = await applyWorkPeriodToDb(email, user);

    const snapshot = workLogic.parseWorkRow(user);
    if (snapshot.status === "period_wait") {
        return user;
    }

    if (
        user.work_job_name &&
        (user.work_status === "offered" || user.work_status === "active") &&
        workLogic.WORK_ENERGY_TIERS.includes(user.work_energy_need ?? 0) &&
        !snapshot.completedTiers.includes(user.work_energy_need)
    ) {
        return user;
    }

    const next = workLogic.nextAvailableTier(snapshot.completedTiers, null);
    if (!next) {
        return user;
    }

    await assignWorkJob(email, next, user.level ?? 1);
    return getQuery("SELECT * FROM users WHERE email = ?", [email]);
}

function workPayloadFromUser(user, extra) {
    const work = workLogic.parseWorkRow(user);
    return {
        success: true,
        work,
        user: sanitizeUser(user),
        ...extra
    };
}

app.get("/work/state", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        const user = await requireExistingUser(email, { regen: true });
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }
        const ready = await ensureWorkJobForUser(email);
        res.json(workPayloadFromUser(ready));
    } catch (error) {
        console.error("Work state error:", error);
        res.status(500).json({ success: false, error: "Ошибка работы" });
    }
});

app.post("/work/perform", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        let user = await requireExistingUser(email, { regen: true });
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        user = await applyWorkPeriodToDb(email, user);
        const snap = workLogic.parseWorkRow(user);
        if (snap.status === "period_wait") {
            res.json({ success: false, error: "Все работы на сегодня выполнены. Новые работы появятся завтра." });
            return;
        }

        if (!user.work_job_name) {
            user = await ensureWorkJobForUser(email);
        }

        if (user.work_status !== "active") {
            res.json({ success: false, error: "Сначала нажми «Я берусь!»" });
            return;
        }

        const energy = user.energy ?? 0;
        if (energy < workLogic.WORK_ENERGY_PER_CLICK) {
            res.json({ success: false, error: "Недостаточно энергии" });
            return;
        }

        const need = user.work_energy_need ?? workLogic.WORK_ENERGY_TIERS[0];
        let done = (user.work_energy_done ?? 0) + workLogic.WORK_ENERGY_PER_CLICK;
        const newEnergy = energy - workLogic.WORK_ENERGY_PER_CLICK;

        if (done < need) {
            await runQuery(
                "UPDATE users SET energy = ?, work_energy_done = ? WHERE email = ?",
                [newEnergy, done, email]
            );
            await persistDailyQuestWorkProgress(email, workLogic.WORK_ENERGY_PER_CLICK);
            await persistMainQuestEvent(email, "work_click");
            const updated = await getQuery("SELECT * FROM users WHERE email = ?", [email]);
            res.json(workPayloadFromUser(updated));
            return;
        }

        done = need;
        const baseReward = user.work_reward ?? workLogic.workRewardForTier(need, user.level ?? 1);
        const reward = talismanEffects.rollLuckyDollar(
            talismans.resolveOwnedRaw(user),
            Math.random,
            talismans.MODES.WORK
        )
            ? baseReward * 2
            : baseReward;
        const rubles = (user.rubles ?? user.money ?? 0) + reward;
        const completedJson = JSON.stringify(
            workLogic.markTierCompleted(user.work_completed, need)
        );

        await runQuery(
            `UPDATE users SET energy = ?, rubles = ?, money = ?, work_energy_done = ?, work_completed = ?,
             work_status = '', work_job_name = '', work_cooldown_until = 0 WHERE email = ?`,
            [newEnergy, rubles, rubles, done, completedJson, email]
        );

        await persistDailyQuestWorkProgress(email, workLogic.WORK_ENERGY_PER_CLICK);
        await persistMainQuestEvent(email, "work_click");
        await persistMainQuestEvent(email, "work_paid");

        await ensureWorkJobForUser(email);
        const after = await getQuery("SELECT * FROM users WHERE email = ?", [email]);
        await recordPlayerEvent(email, {
            kind: playerEvents.EVENT_KINDS.WORK,
            summary: playerEvents.buildWorkSummary(need, reward),
            detail: {
                text: `Отработано ${need} энергии.`,
                energySpent: need,
                reward
            }
        });
        res.json(
            workPayloadFromUser(after, {
                completed: true,
                rublesGain: reward,
                flash: "Работа выполнена!"
            })
        );
    } catch (error) {
        console.error("Work perform error:", error);
        res.status(500).json({ success: false, error: "Ошибка выполнения работы" });
    }
});

app.post("/work/accept", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        let user = await requireExistingUser(email, { regen: true });
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        user = await applyWorkPeriodToDb(email, user);
        const snap = workLogic.parseWorkRow(user);
        if (snap.status === "period_wait") {
            res.json({ success: false, error: "Все работы на сегодня выполнены. Новые работы появятся завтра." });
            return;
        }

        if (!user.work_job_name) {
            user = await ensureWorkJobForUser(email);
        }

        if (user.work_status === "active") {
            res.json(workPayloadFromUser(user));
            return;
        }

        await runQuery(
            "UPDATE users SET work_status = 'active', work_energy_done = 0 WHERE email = ?",
            [email]
        );
        const updated = await getQuery("SELECT * FROM users WHERE email = ?", [email]);
        res.json(workPayloadFromUser(updated));
    } catch (error) {
        console.error("Work accept error:", error);
        res.status(500).json({ success: false, error: "Ошибка работы" });
    }
});

app.post("/work/leave", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        let user = await requireExistingUser(email, { regen: true });
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        user = await applyWorkPeriodToDb(email, user);
        const snap = workLogic.parseWorkRow(user);

        if (user.work_status !== "active" && user.work_status !== "offered") {
            res.json({ success: false, error: "Нет активной работы." });
            return;
        }

        const currentTier = user.work_energy_need ?? 0;
        const next = workLogic.nextAvailableTier(snap.completedTiers, currentTier);
        if (!next) {
            await runQuery(
                "UPDATE users SET work_status = '', work_job_name = '', work_energy_done = 0 WHERE email = ?",
                [email]
            );
        } else {
            await assignWorkJob(email, next, user.level ?? 1, user.work_job_name);
        }
        const updated = await getQuery("SELECT * FROM users WHERE email = ?", [email]);
        res.json(workPayloadFromUser(updated));
    } catch (error) {
        console.error("Work leave error:", error);
        res.status(500).json({ success: false, error: "Ошибка работы" });
    }
});

async function syncHappyHourDayRow(email, user) {
    const state = happyHour.evaluateHappyHourState(user);
    const storedDay = String(user.happy_hour_day ?? "").trim();
    const storedClaims = Math.max(0, Math.floor(Number(user.happy_hour_claims) || 0));
    if (storedDay !== state.dayKey || storedClaims !== state.claims) {
        await runQuery("UPDATE users SET happy_hour_day = ?, happy_hour_claims = ? WHERE email = ?", [
            state.dayKey,
            state.claims,
            email
        ]);
        user.happy_hour_day = state.dayKey;
        user.happy_hour_claims = state.claims;
    }
    return state;
}

app.get("/happy-hour/check", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        if (!email) {
            res.status(400).json({ success: false, error: "Email обязателен" });
            return;
        }
        const user = await requireExistingUser(email);
        const state = await syncHappyHourDayRow(email, user);
        res.json({
            success: true,
            show: state.canShow,
            claimsToday: state.claims,
            maxClaims: state.maxClaims,
            claimsRemaining: state.claimsRemaining,
            onCooldown: state.onCooldown
        });
    } catch (error) {
        console.error("happy-hour check error:", error);
        res.status(500).json({ success: false, error: "Ошибка проверки счастливого часа" });
    }
});

app.post("/happy-hour/open", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const boxIndex = Math.floor(Number(body.boxIndex));
        if (!email) {
            res.status(400).json({ success: false, error: "Email обязателен" });
            return;
        }
        if (!Number.isFinite(boxIndex) || boxIndex < 0 || boxIndex > 2) {
            res.status(400).json({ success: false, error: "Некорректная коробка" });
            return;
        }

        const user = await requireExistingUser(email);
        const state = await syncHappyHourDayRow(email, user);
        if (!state.canClaimToday) {
            res.status(400).json({
                success: false,
                error: "Счастливый час на сегодня исчерпан. Загляни завтра.",
                claimsToday: state.claims,
                maxClaims: state.maxClaims
            });
            return;
        }
        if (state.onCooldown) {
            res.status(400).json({
                success: false,
                error: "Счастливый час ещё не готов. Зайди позже.",
                onCooldown: true
            });
            return;
        }

        const now = Date.now();
        const prize = happyHour.rollPrize();
        const dollarsBefore = Math.max(0, Math.floor(Number(user.dollars) || 0));
        const newDollars = dollarsBefore + prize.dollars;
        const newClaims = state.claims + 1;
        const cooldownUntil = happyHour.nextCooldownUntil(now);

        await runQuery(
            `UPDATE users SET dollars = ?, happy_hour_day = ?, happy_hour_claims = ?,
             happy_hour_cooldown_until = ? WHERE email = ?`,
            [newDollars, state.dayKey, newClaims, cooldownUntil, email]
        );

        const summary = playerEvents.buildHappyHourSummary(prize.dollars, prize.jackpot);
        await recordPlayerEvent(email, {
            kind: playerEvents.EVENT_KINDS.HAPPY_HOUR,
            summary,
            detail: {
                dollars: prize.dollars,
                jackpot: prize.jackpot,
                boxIndex,
                text: summary
            }
        });

        const updated = await requireExistingUser(email);
        res.json({
            success: true,
            dollars: prize.dollars,
            jackpot: prize.jackpot,
            boxIndex,
            message: summary,
            claimsToday: newClaims,
            maxClaims: state.maxClaims,
            claimsRemaining: Math.max(0, state.maxClaims - newClaims),
            cooldownUntil,
            user: sanitizeUser(updated)
        });
    } catch (error) {
        console.error("happy-hour open error:", error);
        res.status(500).json({ success: false, error: "Ошибка открытия коробки" });
    }
});

async function trimPubChatMessages() {
    const rows = await allQuery(
        `SELECT id FROM pub_chat ORDER BY created_at DESC LIMIT ?`,
        [pubChat.MAX_MESSAGES]
    );
    const keepIds = new Set(rows.map((r) => r.id));
    if (!keepIds.size) return;
    const placeholders = [...keepIds].map(() => "?").join(",");
    await runQuery(`DELETE FROM pub_chat WHERE id NOT IN (${placeholders})`, [...keepIds]);
}

async function loadPubChatMessages() {
    const rows = await allQuery(
        `SELECT id, email, player_name, message, created_at FROM pub_chat ORDER BY created_at ASC LIMIT ?`,
        [pubChat.MAX_MESSAGES]
    );
    return rows.map(pubChat.rowToMessage);
}

/** Игроки онлайн — только SELECT. */
app.get("/api/players/online", async (req, res) => {
    try {
        const now = Date.now();
        const onlineSince = playerOnline.onlineSinceTimestamp(now);

        const onlineRow = await getQuery(
            `SELECT COUNT(*) AS c FROM users
             WHERE name IS NOT NULL AND TRIM(name) != ''
               AND COALESCE(last_active_at, 0) >= ?`,
            [onlineSince]
        );
        const count = Math.max(0, Math.floor(Number(onlineRow?.c) || 0));

        const rows = await allQuery(
            `SELECT email, name, xp, character, club, last_active_at
             FROM users
             WHERE name IS NOT NULL AND TRIM(name) != ''
               AND COALESCE(last_active_at, 0) >= ?
             ORDER BY last_active_at DESC, LOWER(TRIM(name)) ASC`,
            [onlineSince]
        );

        const players = rows.map((row) => {
            const level = levelFromXp(normalizeXp(row.xp));
            return {
                email: row.email,
                name: row.name || "Игрок",
                level,
                avatar: avatarPath(row.character),
                club: row.club || null,
                clubName: clubsData.getClubName(row.club) || row.club || "—",
                lastActiveAt: row.last_active_at
            };
        });

        res.json({
            success: true,
            count,
            players,
            onlineWindowMs: playerOnline.PLAYER_ONLINE_MS
        });
    } catch (error) {
        console.error("players online error:", error);
        res.status(500).json({ success: false, error: "Ошибка загрузки онлайна" });
    }
});

/** Список игроков — только SELECT, без изменений БД. */
app.get("/api/players", async (req, res) => {
    try {
        const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
        const perPage = Math.min(50, Math.max(1, Math.floor(Number(req.query.perPage) || 20)));
        const offset = (page - 1) * perPage;
        const now = Date.now();
        const onlineSince = playerOnline.onlineSinceTimestamp(now);

        const totalRow = await getQuery(
            `SELECT COUNT(*) AS c FROM users WHERE name IS NOT NULL AND TRIM(name) != ''`
        );
        const total = Math.max(0, Math.floor(Number(totalRow?.c) || 0));
        const onlineRow = await getQuery(
            `SELECT COUNT(*) AS c FROM users
             WHERE name IS NOT NULL AND TRIM(name) != ''
               AND COALESCE(last_active_at, 0) >= ?`,
            [onlineSince]
        );
        const onlineCount = Math.max(0, Math.floor(Number(onlineRow?.c) || 0));

        const rows = await allQuery(
            `SELECT u.email, u.name, u.xp, u.reputation, u.skulls, u.character, u.club, u.last_active_at
             FROM users u
             WHERE u.name IS NOT NULL AND TRIM(u.name) != ''
             ORDER BY LOWER(TRIM(u.name)) ASC, u.id ASC
             LIMIT ? OFFSET ?`,
            [perPage, offset]
        );

        const players = rows.map((row) => {
            const xp = normalizeXp(row.xp);
            const level = levelFromXp(xp);
            const reputation = Math.max(0, Math.floor(Number(row.reputation) || 0));
            const skulls = row.skulls ?? Math.floor(reputation / SKULL_EVERY_REP);
            const rank = rankTitleFromTotalSkulls(skulls) || "Новичок";
            return {
                email: row.email,
                name: row.name || "Игрок",
                level,
                reputation,
                rank,
                avatar: avatarPath(row.character),
                club: row.club || null,
                online: playerOnline.isPlayerOnline(row.last_active_at, now)
            };
        });

        const totalPages = Math.max(1, Math.ceil(total / perPage) || 1);

        res.json({
            success: true,
            players,
            page,
            perPage,
            total,
            totalPages,
            onlineCount
        });
    } catch (error) {
        console.error("players list error:", error);
        res.status(500).json({ success: false, error: "Ошибка загрузки списка игроков" });
    }
});

app.get("/api/pub/chat/messages", async (req, res) => {
    try {
        const messages = await loadPubChatMessages();
        res.json({ success: true, messages });
    } catch (error) {
        console.error("pub chat messages error:", error);
        res.status(500).json({ success: false, error: "Ошибка загрузки чата" });
    }
});

app.post("/api/pub/chat/send", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const validated = pubChat.validateMessage(body.message);

        if (!email) {
            res.status(400).json({ success: false, error: "Email обязателен" });
            return;
        }
        if (!validated.ok) {
            res.status(400).json({ success: false, error: validated.error });
            return;
        }

        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        const last = await getQuery(
            `SELECT created_at FROM pub_chat WHERE email = ? ORDER BY created_at DESC LIMIT 1`,
            [email]
        );
        if (last && Date.now() - last.created_at < pubChat.SEND_COOLDOWN_MS) {
            res.status(429).json({
                success: false,
                error: "Подожди 5 секунд перед следующим сообщением"
            });
            return;
        }

        const playerName = String(user.name || "Игрок").trim() || "Игрок";
        const now = Date.now();

        await runQuery(
            `INSERT INTO pub_chat (email, player_name, message, created_at) VALUES (?, ?, ?, ?)`,
            [email, playerName, validated.message, now]
        );
        await trimPubChatMessages();

        const messages = await loadPubChatMessages();
        res.json({ success: true, messages });
    } catch (error) {
        console.error("pub chat send error:", error);
        res.status(500).json({ success: false, error: "Ошибка отправки" });
    }
});

app.get("/getUser", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);
        const viewerEmail = normalizeEmail(req.query.viewer || "");

        if (!email) {
            res.status(400).json({ success: false, error: "Email обязателен" });
            return;
        }

        let user = await syncUserResources(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        const isOwnerView = !!viewerEmail && viewerEmail === email;
        if (viewerEmail) {
            await touchPlayerActivity(viewerEmail);
        }
        if (isOwnerView && stadiumService) {
            await stadiumService.syncPlayerRageForLiveMatch(email, user);
            user = await getQuery("SELECT * FROM users WHERE email = ?", [email]);
        }

        let payload = isOwnerView ? sanitizeUser(user) : sanitizePublicUser(user);
        payload = await enrichUserProfileExtras(user, payload);
        res.json({
            success: true,
            user: payload,
            isPublicProfile: !isOwnerView
        });
    } catch (error) {
        console.error("GetUser error:", error);
        res.status(500).json({ success: false, error: "Ошибка сервера при получении пользователя" });
    }
});

async function logDatabaseHealth() {
    const row = await getQuery("SELECT COUNT(*) AS c FROM users");
    const count = Math.max(0, Math.floor(Number(row?.c) || 0));
    let sizeBytes = 0;
    try {
        sizeBytes = fs.statSync(DB_PATH).size;
    } catch {
        /* ignore */
    }
    console.log(`[db] ${DB_PATH}`);
    console.log(`[db] зарегистрировано игроков: ${count}, размер файла: ${sizeBytes} байт`);
    try {
        const journal = await getQuery("PRAGMA journal_mode");
        const busy = await getQuery("PRAGMA busy_timeout");
        console.log(
            `[db] journal_mode=${journal?.journal_mode ?? journal}, busy_timeout=${busy?.timeout ?? busy}`
        );
    } catch {
        /* ignore */
    }
    if (count === 0 && sizeBytes < 64 * 1024) {
        console.warn(
            "[db] ВНИМАНИЕ: база пустая или почти пустая. Если это прод — проверьте DB_PATH и восстановите бэкап users.db."
        );
    }
}

async function startServer() {
    const dbApi = await createSqliteDatabase(DB_PATH);
    runQuery = dbApi.runQuery;
    getQuery = dbApi.getQuery;
    allQuery = dbApi.allQuery;
    runTransaction = dbApi.runTransaction;

    await initDatabase();
    await logDatabaseHealth();
    repEarningsService = createRepEarningsService({ runQuery, allQuery, getQuery });
    heroOfDayService = createHeroOfDayService({ runQuery, allQuery, getQuery });
    await heroOfDayService.ensureSchema();
    await districtPlayers().ensureSchema();
    repEarningsService.setHeroOfDayService(heroOfDayService);
    await repEarningsService.pruneOldRows();
    await heroOfDayService.refreshLeader();
    heroOfDayService.startScheduler();

    stadiumService = createStadiumService({
        runQuery,
        getQuery,
        allQuery,
        runTransaction,
        recordPlayerEvent,
        grantStatPointsForLevelDelta,
        ensureUserLevelMatchesXp,
        grantPlayerReputation: (opts) => repEarningsService.grantPlayerReputation(opts),
        getEffectiveStats
    });
    pubBattleModule = createPubBattleModule({
        runQuery,
        getQuery,
        allQuery,
        getEffectiveStats,
        readUserHpForFight,
        calcMaxHp,
        repEarningsService,
        stadiumEngine,
        avatarPath,
        onMainQuestEvent: (email, event) => persistMainQuestEvent(email, event)
    });
    nationalTeamsModule = createNationalTeamsModule({
        runQuery,
        getQuery,
        allQuery,
        getEffectiveStats
    });
    packagesModule = createPackagesModule();
    await pubBattleModule.ensureSchema();
    pubBattleModule.registerRoutes(app, {
        normalizeEmail,
        requireExistingUser,
        sanitizeUser
    });
    nationalTeamsModule.registerRoutes(app, {
        normalizeEmail,
        requireExistingUser,
        sanitizeUser,
        onMainQuestEvent: (email, event) => persistMainQuestEvent(email, event)
    });
    packagesModule.registerRoutes(app, {
        normalizeEmail,
        requireExistingUser
    });
    authModule.registerRoutes(app, {
        sanitizeUser,
        syncUserResources
    });
    firmsService = createFirmsService({
        runQuery,
        getQuery,
        allQuery,
        normalizeEmail,
        levelFromXp,
        normalizeXp,
        avatarPath,
        purchaseLogic,
        randomInt,
        getClubName: (clubId) => clubsData.getClubName(clubId)
    });
    await firmsService.ensureSchema();
    registerFirmsRoutes(app, {
        firmsService,
        normalizeEmail,
        requireExistingUser,
        sanitizeUser
    });

    referralsModule = createReferralsModule({ runQuery, getQuery, allQuery });
    await referralsModule.service.ensureSchema();
    referralsModule.registerRoutes(app, {
        normalizeEmail,
        requireExistingUser
    });

    clubReputationRatingService = createClubReputationRatingService({ allQuery, clubsData });

    pubBattleModule.startScheduler();
    await stadiumService.sanitizeScheduledMatches();
    await seedStadiumDemoIfEmpty();
    if (stadiumEngine.STADIUM_TEST_MODE) {
        console.warn("[stadium] STADIUM_TEST_MODE=1 — тестовое расписание (только dev)");
    } else {
        const nextStadium = await getQuery(
            `SELECT id, status, starts_at FROM stadium_matches
             WHERE status IN ('scheduled', 'live')
             ORDER BY starts_at ASC LIMIT 1`
        );
        if (nextStadium) {
            console.log(
                `[stadium] расписание из БД: ${nextStadium.id} ${nextStadium.status}, starts_at=${nextStadium.starts_at}`
            );
        }
    }
    let stadiumTickRunning = false;
    setInterval(async () => {
        if (stadiumTickRunning) return;
        stadiumTickRunning = true;
        try {
            await stadiumService.processAllLiveMatches();
        } catch (e) {
            console.error("stadium tick:", e);
        } finally {
            stadiumTickRunning = false;
        }
    }, 4000);

    app.listen(PORT, () => {
        console.log(`Server started: http://localhost:${PORT} (db: ${DB_PATH})`);
    });
}

startServer().catch((error) => {
    console.error("Database init error:", error);
    process.exit(1);
});