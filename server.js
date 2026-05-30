const crypto = require("crypto");
const path = require("path");
const fightSsr = require("./fight-ssr");
const xpLevels = require("./xp-levels");
const workLogic = require("./work-logic");
const clubsData = require("./clubs-data");
const dailyQuests = require("./daily-quests");
const playerEvents = require("./player-events");
const silverLoss = require("./silver-loss");
const happyHour = require("./happy-hour");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();

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
    valk: { power: 12, speed: 10, intel: 8, stamina: 12 },
    shadow: { power: 9, speed: 12, intel: 12, stamina: 9 },
    spark: { power: 10, speed: 13, intel: 11, stamina: 8 },
    tough: { power: 11, speed: 9, intel: 9, stamina: 15 },
    redhead: { power: 9, speed: 13, intel: 10, stamina: 9 },
    fighter: { power: 15, speed: 8, intel: 7, stamina: 13 },
    chick: { power: 10, speed: 11, intel: 11, stamina: 10 }
};

/** Портреты ботов на районе. */
const BOT_AVATAR = {
    boro: "/static/bots/boro.png",
    kopch: "/static/bots/kopch.png",
    steward: "/static/bots/steward.png"
};

function botAvatarPath(botId) {
    return BOT_AVATAR[botId] || null;
}

function enrichBotSlot(bot) {
    if (!bot) return null;
    const id = bot.templateId || bot.id;
    return {
        ...bot,
        avatar: bot.avatar || botAvatarPath(id)
    };
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

const SHOP_ITEMS = {
    newspaper: {
        slot: "weapon",
        label: "Газета",
        emoji: "📰",
        cost: 9,
        currency: "rubles",
        power: 1,
        speed: 0,
        intel: 0,
        stamina: 0,
        minLevel: 1
    },
    rainbow_shirt: {
        slot: "clothes",
        label: "Футболка с радугой",
        emoji: "👕",
        cost: 24,
        currency: "rubles",
        power: 0,
        speed: 0,
        intel: 0,
        stamina: 2,
        minLevel: 2
    }
};

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
    return out;
}

function getConsumablesUsedAt(row) {
    const raw = parseJson(row.consumables_used_at, {});
    const out = {};
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
    return {
        id: itemId,
        label: def.label,
        emoji: def.emoji,
        power: def.power,
        speed: def.speed,
        intel: def.intel,
        stamina: def.stamina
    };
}

const db = new sqlite3.Database(path.join(__dirname, "users.db"));

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
        opponentName,
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

/** Рейтинг клубов (пока заглушка: все клубы, rating = 0). */
app.get("/rating/clubs", (req, res) => {
    try {
        const clubs = clubsData.listSelectableClubs().map((c) => ({
            id: c.id,
            name: c.name,
            emblem: c.emblem,
            rating: 0
        }));
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
        res.status(out.ok ? 200 : 400).type("html").send(fightSsr.buildFightPageHtml(out));
    } catch (error) {
        console.error("GET /fight error:", error);
        res.status(500).type("html").send(fightSsr.buildFightPageHtml({ ok: false, error: "Ошибка сервера при бое." }));
    }
});

app.use(express.static(path.join(__dirname, "public")));

function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(err) {
            if (err) {
                reject(err);
                return;
            }
            resolve(this);
        });
    });
}

function getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(row);
        });
    });
}

function allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows);
        });
    });
}

async function initDatabase() {
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
        ["gym_passes", "INTEGER DEFAULT 0"],
        ["lottery_free_tickets", "INTEGER DEFAULT 0"],
        ["happy_hour_day", "TEXT DEFAULT ''"],
        ["happy_hour_claims", "INTEGER DEFAULT 0"],
        ["happy_hour_cooldown_until", "INTEGER DEFAULT 0"]
    ];
    for (const [col, def] of profileCols) {
        if (!exK.has(col)) {
            await runQuery(`ALTER TABLE users ADD COLUMN ${col} ${def}`);
        }
    }

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
}

function parseJson(value, fallback) {
    try {
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
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

/** Победа: ярость чуть тратится. Поражение: +10 к максимуму (100→110→120…). */
function districtRageAfterFight(won, storedRage) {
    const cur = normalizeRage(storedRage);
    if (won) {
        const spend = randomInt(3, 10);
        return Math.max(RAGE_BASE, cur - spend);
    }
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

async function pickRefillBot(user, playerEff) {
    const level = user.level ?? 1;
    const email = user.email;
    const now = Date.now();
    const lastSt = user.last_steward_spawn ?? 0;
    if (now - lastSt >= STEWARD_COOLDOWN_MS) {
        await runQuery("UPDATE users SET last_steward_spawn = ? WHERE email = ?", [now, email]);
        return scaleStewardBot(STEWARD_BOT, level, playerEff);
    }
    const tpl = DISTRICT_WEAK_BOTS[randomInt(0, DISTRICT_WEAK_BOTS.length - 1)];
    return scaleWeakDistrictBot(tpl, level);
}

/** Новая волна района: 3 бота (иногда один слот — Стюард). */
async function createDistrictSpawnInitial(email, user) {
    await clearDistrictSession(email);

    const level = user.level ?? 1;
    const picks = shufflePick(DISTRICT_WEAK_BOTS, DISTRICT_SLOT_COUNT);
    const slots = picks.map((tpl) => scaleWeakDistrictBot(tpl, level));
    const { effective: playerEff } = getEffectiveStats(user);
    const now = Date.now();
    const lastSt = user.last_steward_spawn ?? 0;
    if (now - lastSt >= STEWARD_COOLDOWN_MS) {
        const slot = randomInt(0, DISTRICT_SLOT_COUNT - 1);
        slots[slot] = scaleStewardBot(STEWARD_BOT, level, playerEff);
        await runQuery("UPDATE users SET last_steward_spawn = ? WHERE email = ?", [now, email]);
    }

    const spawnId = `s_${Date.now()}_${randomInt(1000, 9999)}`;
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
        slots[i] = await pickRefillBot(user, playerEff);
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

function getActiveTattoos(row) {
    const tattoos = parseJson(row.tattoos, {});
    if (tattoos.expiresAt && Date.now() > tattoos.expiresAt) {
        return { power: 0, speed: 0, intel: 0, stamina: 0, expiresAt: 0 };
    }
    return tattoos;
}

function getEquipmentBonuses(row) {
    const eq = parseJson(row.equipment, {});
    const bonuses = { power: 0, speed: 0, intel: 0, stamina: 0 };
    for (const key of Object.keys(eq)) {
        const item = eq[key];
        if (!item) continue;
        const def = item.id ? SHOP_ITEMS[item.id] : null;
        if (item.id && !def) {
            delete eq[key];
            continue;
        }
        bonuses.power += def ? def.power : item.power || 0;
        bonuses.speed += def ? def.speed : item.speed || 0;
        bonuses.intel += def ? def.intel : item.intel || 0;
        bonuses.stamina += def ? def.stamina : item.stamina || 0;
    }
    return { equipment: eq, bonuses };
}

function getEffectiveStats(row) {
    const tattoos = getActiveTattoos(row);
    const { equipment, bonuses } = getEquipmentBonuses(row);
    const base = {
        power: row.power ?? 10,
        speed: row.speed ?? 10,
        intel: row.intel ?? 10,
        stamina: row.stamina ?? 10
    };
    const effective = {
        power: base.power + (tattoos.power || 0) + bonuses.power,
        speed: base.speed + (tattoos.speed || 0) + bonuses.speed,
        intel: base.intel + (tattoos.intel || 0) + bonuses.intel,
        stamina: base.stamina + (tattoos.stamina || 0) + bonuses.stamina
    };
    return { base, effective, tattoos, equipment, bonuses };
}

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

async function syncUserResources(email) {
    const user = await getQuery("SELECT * FROM users WHERE email = ?", [email]);
    if (!user) return null;

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

    if (user) {
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
        await runQuery("UPDATE users SET level = ?, rank_title = ? WHERE email = ?", [
            level,
            rankFromLevel(level),
            email
        ]);
    }
}

function rankFromLevel(level) {
    const lv = level ?? 1;
    if (lv >= 20) return "Легенда района";
    if (lv >= 15) return "Старший боец";
    if (lv >= 10) return "Помощник лидера";
    if (lv >= 5) return "Свой в доску";
    return "Молодой фан";
}

/** Аватарки: свои (tank/fast) + personage из Hools для остальных. */
const CHARACTER_AVATAR = {
    tank: "/images/tank-dossier.png",
    fast: "/images/fast-dossier.png",
    balanced: "/static/personage/balanced.png",
    tough: "/static/personage/tough.png",
    redhead: "/static/personage/redhead.png",
    fighter: "/static/personage/fighter.png",
    chick: "/static/personage/chick.png",
    valk: "/static/personage/valk.png",
    shadow: "/static/personage/shadow.png",
    spark: "/static/personage/spark.png"
};

function avatarPath(character) {
    const id = String(character || "").trim() || "balanced";
    return CHARACTER_AVATAR[id] || CHARACTER_AVATAR.balanced;
}

function sanitizeUser(row) {
    if (!row) return null;

    const { base, effective, tattoos, equipment, bonuses } = getEffectiveStats(row);
    const xp = normalizeXp(row.xp);
    const level = levelFromXp(xp);
    const maxHp = MAX_HP_CAP;
    const rubles = row.rubles ?? row.money ?? START_RUBLES;

    return {
        id: row.id,
        email: row.email,
        name: row.name,
        character: row.character,
        club: row.club,
        clubName: clubsData.getClubName(row.club) || row.club || null,
        clubEmblem: clubsData.getClubEmblem(row.club) || null,
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
        rage: normalizeRage(row.rage),
        reputation: row.reputation ?? 0,
        skulls: row.skulls ?? Math.floor((row.reputation ?? 0) / SKULL_EVERY_REP),
        silverWon: row.silver_won ?? 0,
        silverLost: row.silver_lost ?? 0,
        districtStreak: row.district_streak ?? 0,
        districtStreakMax: row.district_streak_max ?? 0,
        statPoints: Math.max(0, Math.floor(Number(row.stat_points) || 0)),
        gymPasses: Math.max(0, Math.floor(Number(row.gym_passes) || 0)),
        lotteryFreeTickets: Math.max(0, Math.floor(Number(row.lottery_free_tickets) || 0)),
        firm: row.firm || "",
        country: row.country || "",
        rank: row.rank_title || rankFromLevel(level),
        avatar: avatarPath(row.character),
        xpProgress: xpProgressFromTotals(xp, level)
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

async function requireExistingUser(email, opts = {}) {
    if (opts.regen === false) {
        const user = await getQuery("SELECT * FROM users WHERE email = ?", [email]);
        return user || null;
    }
    return syncUserResources(email);
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

function dailyQuestUserCtx(row) {
    return {
        level: row.level ?? 1,
        xp: row.xp ?? 0
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
    const updated = await requireExistingUser(email);
    return {
        quests: payload.quests,
        resetInMs: payload.resetInMs,
        resetLabel: payload.resetLabel,
        rewardMessages: settled.messages.map((m) => m.message),
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

    let fight = tok.fight_id
        ? await getQuery("SELECT * FROM district_fights WHERE id = ? AND email = ?", [tok.fight_id, email])
        : null;

    if (!fight) {
        if ((user.energy ?? MAX_ENERGY) < FIGHT_ENERGY_COST) {
            return { ok: false, error: "Мало энергии для боя.", user: sanitizeUser(user) };
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
            statPointsPending: Math.max(0, Math.floor(Number(user.stat_points) || 0))
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
        endRage: resolved.endRage
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
        opponentName: opponent.name,
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
        opponentName: opponent.name,
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

app.post("/register", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const password = String(body.password || "").trim();

        if (email.length < MIN_EMAIL_LENGTH) {
            res.status(400).json({ success: false, error: "Email слишком короткий" });
            return;
        }

        if (password.length < MIN_PASSWORD_LENGTH) {
            res.status(400).json({ success: false, error: "Пароль слишком короткий" });
            return;
        }

        const exists = await requireExistingUser(email);
        if (exists) {
            res.status(409).json({ success: false, error: "Пользователь с таким email уже существует" });
            return;
        }

        const t = Date.now();
        await runQuery("INSERT INTO users (email, password, last_regen_at) VALUES (?, ?, ?)", [email, password, t]);
        const created = await getQuery("SELECT * FROM users WHERE email = ?", [email]);
        res.json({ success: true, user: sanitizeUser(created) });
    } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({ success: false, error: "Ошибка сервера при регистрации" });
    }
});

app.post("/login", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const password = String(body.password || "").trim();

        if (email.length < MIN_EMAIL_LENGTH || password.length < MIN_PASSWORD_LENGTH) {
            res.status(400).json({ success: false, error: "Введите корректные email и пароль" });
            return;
        }

        const user = await getQuery(
            "SELECT * FROM users WHERE email = ? AND password = ?",
            [email, password]
        );

        if (!user) {
            res.status(401).json({ success: false, error: "Неверный email или пароль" });
            return;
        }

        const synced = await syncUserResources(email);
        res.json({
            success: true,
            user: sanitizeUser(synced),
            onboarded: !!(synced.character && synced.club && synced.name)
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ success: false, error: "Ошибка сервера при входе" });
    }
});

app.post("/reset-password", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const newPassword = String(body.newPassword || "").trim();

        if (email.length < MIN_EMAIL_LENGTH) {
            res.status(400).json({ success: false, error: "Email слишком короткий" });
            return;
        }

        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            res.status(400).json({ success: false, error: "Новый пароль слишком короткий" });
            return;
        }

        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        await runQuery("UPDATE users SET password = ? WHERE email = ?", [newPassword, email]);
        res.json({ success: true, message: "Пароль успешно обновлён" });
    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ success: false, error: "Ошибка сервера при смене пароля" });
    }
});

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

        const stats = CHARACTER_STATS[character] || CHARACTER_STATS.balanced;
        const maxHp = calcMaxHp(stats.stamina, 1);
        if (!CHARACTER_STATS[character]) {
            res.status(400).json({ success: false, error: "Неизвестный тип персонажа" });
            return;
        }

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
            res.json({ success: false, code: "no_rubles", rubles: rublesNow });
            return;
        }
        res.json({ success: true, user: sanitizeUser(user) });
    } catch (error) {
        console.error("district attack-check error:", error);
        res.status(500).json({ success: false, error: "Ошибка проверки" });
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
        res.json({
            success: true,
            spawn: { spawnId: payload.spawnId, bots: payload.bots },
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

        res.json({
            success: true,
            spawn: { spawnId: result.spawnId, bots: result.bots },
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
        const { base } = getEffectiveStats(userRow);
        const gearB = getEquipmentBonuses(userRow).bonuses;
        const tat = getActiveTattoos(userRow);

        const sumB = (b) => (b.power || 0) + (b.speed || 0) + (b.intel || 0) + (b.stamina || 0);

        const charSum = sumB(base);
        const gearSum = sumB(gearB);
        const tattooSum = (tat.power || 0) + (tat.speed || 0) + (tat.intel || 0) + (tat.stamina || 0);
        const amuletSum = 0;
        const playerTotal = charSum + gearSum + tattooSum + amuletSum;

        const oPow = opponent.power ?? 10;
        const oSp = opponent.speed ?? 10;
        const oIn = opponent.intel ?? 10;
        const oSt = opponent.stamina ?? 10;
        const oppCharSum = oPow + oSp + oIn + oSt;
        const oppGearSum = 0;
        const oppTotal = oppCharSum + oppGearSum;

        const su = sanitizeUser(userRow);
        const eq = su.equipment || {};

        res.json({
            success: true,
            fightId,
            player: {
                name: su.name,
                level: su.level,
                character: su.character,
                avatar: su.avatar,
                equipment: eq,
                charSum,
                gearSum,
                tattooSum,
                amuletSum,
                total: playerTotal
            },
            opponent: {
                name: opponent.name || "Бот",
                level: userRow.level ?? 1,
                emoji: opponent.emoji || "👤",
                charSum: oppCharSum,
                gearSum: oppGearSum,
                total: oppTotal
            }
        });
    } catch (error) {
        console.error("fight-gear error:", error);
        res.status(500).json({ success: false, error: "Ошибка загрузки" });
    }
});

async function finishDistrictFightWin(user, opponent, email, fightId, log, enemyHp, preRewards, fightMeta) {
    const now = Date.now();
    let rublesGain =
        preRewards && typeof preRewards.rublesGain === "number"
            ? preRewards.rublesGain
            : randomInt(opponent.rubles[0], opponent.rubles[1]);
    const silverCap = opponent.isSteward ? 32 : 10;
    rublesGain = Math.min(silverCap, Math.max(0, rublesGain));

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
    const newRep = (user.reputation ?? 0) + REP_PER_DISTRICT_WIN;
    const skullsEarned = Math.floor(newRep / SKULL_EVERY_REP) - Math.floor((user.reputation ?? 0) / SKULL_EVERY_REP);
    const newSkulls = (user.skulls ?? 0) + Math.max(0, skullsEarned);
    const newStreak = (user.district_streak ?? 0) + 1;
    const newStreakMax = Math.max(user.district_streak_max ?? 0, newStreak);
    const newSilverWon = (user.silver_won ?? 0) + rublesGain;
    const endRage = fightMeta?.endRage ?? districtRageAfterFight(true, user.rage ?? RAGE_BASE);
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
    const hpAfter = fightSsr.round2(
        Math.max(0, Math.min(maxHp, Number(fightMeta?.hpAfter ?? fightMeta?.hpStart ?? user.hp)))
    );

    await runQuery(
        "UPDATE district_fights SET status = 'won', player_hp = ?, enemy_hp = ?, log = ? WHERE id = ?",
        [hpAfter, enemyHp, JSON.stringify(log), fightId]
    );
    await runQuery("DELETE FROM district_kick_tokens WHERE fight_id = ?", [fightId]);

    await runQuery(
        `UPDATE users SET xp = ?, level = ?, rubles = ?, money = ?, dollars = ?, hp = ?, max_hp = ?,
         power = ?, speed = ?, intel = ?, stamina = ?, rage = ?, reputation = ?, skulls = ?,
         silver_won = ?, district_streak = ?, district_streak_max = ?,
         last_xp_at = ?,
         rank_title = ? WHERE email = ?`,
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
            rankFromLevel(newLevel),
            email
        ]
    );
    return {
        xpGain,
        rublesGain,
        dollarsGain,
        repGain: REP_PER_DISTRICT_WIN,
        skullsEarned: Math.max(0, skullsEarned),
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
    const prevRage = normalizeRage(user.rage ?? RAGE_BASE);
    const endRage = fightMeta?.endRage ?? districtRageAfterFight(false, prevRage);

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
        if (rubles < TATTOO_COST) {
            res.status(400).json({ success: false, error: `Нужно ${TATTOO_COST} ₽` });
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

        const newRubles = rubles - TATTOO_COST;
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

app.get("/shop/items", (req, res) => {
    const items = {};
    for (const [id, def] of Object.entries(SHOP_ITEMS)) {
        items[id] = {
            id,
            slot: def.slot,
            label: def.label,
            emoji: def.emoji,
            cost: def.cost,
            power: def.power,
            speed: def.speed,
            intel: def.intel,
            stamina: def.stamina,
            minLevel: def.minLevel
        };
    }
    res.json({ success: true, items });
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
        if (rubles < item.cost) {
            res.status(400).json({ success: false, error: `Нужно ${item.cost} серебра` });
            return;
        }

        inventory.push(itemId);
        const newRubles = rubles - item.cost;
        await runQuery("UPDATE users SET inventory = ?, rubles = ?, money = ? WHERE email = ?", [
            JSON.stringify(inventory),
            newRubles,
            newRubles,
            email
        ]);

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

app.post("/larek/buy", async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const email = normalizeEmail(body.email);
        const itemId = String(body.itemId || "").trim();
        const qty = Math.max(1, Math.min(10, Math.floor(Number(body.qty) || 1)));

        const item = LAREK_ITEMS[itemId];
        if (!item) {
            res.status(400).json({ success: false, error: "Товар не найден" });
            return;
        }

        const user = await requireExistingUser(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        const totalCost = item.cost * qty;
        const currency = item.currency === "mushrooms" ? "mushrooms" : "rubles";
        const consumables = getUserConsumables(user);
        consumables[itemId] = (consumables[itemId] || 0) + qty;

        if (currency === "mushrooms") {
            const mushrooms = user.mushrooms ?? 0;
            if (mushrooms < totalCost) {
                res.status(400).json({ success: false, error: `Нужно ${totalCost} грибов` });
                return;
            }
            const newMushrooms = mushrooms - totalCost;
            await runQuery("UPDATE users SET consumables = ?, mushrooms = ? WHERE email = ?", [
                JSON.stringify(consumables),
                newMushrooms,
                email
            ]);
        } else {
            const rubles = user.rubles ?? user.money ?? 0;
            if (rubles < totalCost) {
                res.status(400).json({ success: false, error: `Нужно ${totalCost} серебра` });
                return;
            }
            const newRubles = rubles - totalCost;
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
            message: `Куплено: ${item.label} ×${qty}. Смотри в гардеробе.`,
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
            res.status(400).json({ success: false, error: "Сначала купи предмет у барыги" });
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
        if (rubles < opp.cost) {
            res.status(400).json({ success: false, error: `Нужно ${opp.cost} ₽` });
            return;
        }

        const { effective } = getEffectiveStats(user);
        const playerScore = effective.power + effective.speed * 0.35 + randomInt(0, 14);
        const botScore = opp.power + randomInt(0, 12);
        const win = playerScore >= botScore;

        let newRubles = rubles - opp.cost;
        let newDollars = user.dollars ?? 0;
        let message = `Проигрыш: ${opp.name} сильнее. Потеряно ${opp.cost} ₽`;
        if (win) {
            newDollars += opp.win;
            message = `Победа над ${opp.name}! +${opp.win} $ (ставка ${opp.cost} ₽)`;
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
            "SELECT player_name, prize, created_at FROM lottery_log ORDER BY id DESC LIMIT 25"
        );
        const out = rows.map((r) => ({
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
            } else if (dollars < LOTTERY_COST) {
                res.status(400).json({ success: false, error: `Нужно ${LOTTERY_COST} $` });
                return;
            } else {
                payDollars = dollars - LOTTERY_COST;
            }
        } else {
            if (mushrooms < LOTTERY_COST) {
                res.status(400).json({ success: false, error: `Нужно ${LOTTERY_COST} грибов` });
                return;
            }
            payMushrooms = mushrooms - LOTTERY_COST;
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
            const updated = await getQuery("SELECT * FROM users WHERE email = ?", [email]);
            res.json(workPayloadFromUser(updated));
            return;
        }

        done = need;
        const reward = user.work_reward ?? workLogic.workRewardForTier(need, user.level ?? 1);
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
        const user = await requireExistingUser(email, { regen: true });
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

app.get("/getUser", async (req, res) => {
    try {
        const email = normalizeEmail(req.query.email);

        if (!email) {
            res.status(400).json({ success: false, error: "Email обязателен" });
            return;
        }

        const user = await syncUserResources(email);
        if (!user) {
            res.status(404).json({ success: false, error: "Пользователь не найден" });
            return;
        }

        res.json({ success: true, user: sanitizeUser(user) });
    } catch (error) {
        console.error("GetUser error:", error);
        res.status(500).json({ success: false, error: "Ошибка сервера при получении пользователя" });
    }
});

initDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server started: http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error("Database init error:", error);
        process.exit(1);
    });