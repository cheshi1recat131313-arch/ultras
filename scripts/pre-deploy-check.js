/**
 * Проверка users.db перед деплоем (только чтение).
 *
 *   node scripts/pre-deploy-check.js
 *   DB_PATH=/var/lib/fanaty/users.db node scripts/pre-deploy-check.js
 *   node scripts/pre-deploy-check.js --save-baseline
 *
 * Exit 1 — есть предупреждения (риск потери данных или регрессии).
 */
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3");
const { resolveDbPath } = require("../core/db-path");

const saveBaseline = process.argv.includes("--save-baseline");
const dbPath = resolveDbPath();
const baselinePath = path.join(path.dirname(dbPath), "backups", "deploy-baseline.json");

const warnings = [];
const info = [];

function warn(msg) {
    warnings.push(msg);
}

function note(msg) {
    info.push(msg);
}

function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
    });
}

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
    });
}

function fmtTs(ms) {
    const n = Number(ms);
    if (!n) return "(нет)";
    return new Date(n).toISOString().replace("T", " ").slice(0, 19);
}

function hoursFromNow(ms) {
    return ((Number(ms) - Date.now()) / (60 * 60 * 1000)).toFixed(1);
}

async function collectMetrics(db) {
    const metrics = {};

    metrics.dbPath = dbPath;
    metrics.dbSizeBytes = fs.statSync(dbPath).size;
    metrics.usersTotal = (await get(db, "SELECT COUNT(*) AS c FROM users")).c;
    metrics.usersWithNick = (
        await get(
            db,
            "SELECT COUNT(*) AS c FROM users WHERE name IS NOT NULL AND TRIM(name) != ''"
        )
    ).c;
    metrics.usersNoNick = metrics.usersTotal - metrics.usersWithNick;

    metrics.duplicateNickGroups = (
        await get(
            db,
            `SELECT COUNT(*) AS c FROM (
                SELECT LOWER(TRIM(name)) AS nick
                FROM users
                WHERE name IS NOT NULL AND TRIM(name) != ''
                GROUP BY LOWER(TRIM(name))
                HAVING COUNT(*) > 1
            )`
        )
    ).c;

    metrics.suspectedReRegs = (
        await get(
            db,
            `SELECT COUNT(*) AS c FROM users a
             JOIN users b ON LOWER(TRIM(a.name)) = LOWER(TRIM(b.name)) AND a.id < b.id
             WHERE a.name IS NOT NULL AND TRIM(a.name) != ''
               AND b.name IS NOT NULL AND TRIM(b.name) != ''
               AND (a.email LIKE '%@internal.local' OR b.email LIKE '%@internal.local')`
        )
    ).c;

    const hero = await get(db, "SELECT day_key, leader_email, leader_skulls, updated_at FROM hero_of_day_state WHERE id = 1");
    metrics.heroOfDay = hero
        ? {
              dayKey: hero.day_key,
              leaderEmail: hero.leader_email || "",
              leaderSkulls: hero.leader_skulls ?? 0,
              updatedAt: hero.updated_at
          }
        : null;

    const pub = await get(db, "SELECT COUNT(*) AS c, MIN(created_at) AS oldest, MAX(created_at) AS newest FROM pub_chat");
    metrics.pubChat = {
        count: pub?.c ?? 0,
        oldest: pub?.oldest ?? 0,
        newest: pub?.newest ?? 0
    };

    const stadiumRows = await all(
        db,
        `SELECT id, level, status, starts_at, ends_at FROM stadium_matches
         WHERE status IN ('scheduled', 'live')
         ORDER BY starts_at ASC`
    );
    metrics.stadiumScheduled = stadiumRows.map((r) => ({
        id: r.id,
        level: r.level,
        status: r.status,
        startsAt: r.starts_at,
        hoursUntil: hoursFromNow(r.starts_at)
    }));

    return metrics;
}

function checkCodeRisks() {
    try {
        const stadiumEngine = require("../stadium-engine");
        const envFlag = String(process.env.STADIUM_TEST_MODE ?? "").trim();
        if (stadiumEngine.STADIUM_TEST_MODE) {
            warn(
                "STADIUM_TEST_MODE включён (ENV STADIUM_TEST_MODE=1): при рестарте scheduled-матчи сбрасываются на «завтра 23:00». На production переменную не задавать."
            );
        } else if (envFlag) {
            warn(`STADIUM_TEST_MODE в ENV = "${envFlag}" — для production оставьте переменную пустой или удалите.`);
        }
    } catch {
        /* ignore */
    }

    if (dbPath.includes("Anomaly") || dbPath.includes("фанаты")) {
        note("Путь похож на локальную dev-базу. На production задайте DB_PATH вне папки деплоя.");
    }

    if (!process.env.DB_PATH) {
        warn(
            "DB_PATH не задан — используется users.db рядом с проектом. На production это риск перезаписи при scp."
        );
    }
}

function compareBaseline(metrics) {
    if (!fs.existsSync(baselinePath)) {
        note(`Baseline не найден (${baselinePath}). После проверки prod: node scripts/pre-deploy-check.js --save-baseline`);
        return;
    }

    let baseline;
    try {
        baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    } catch {
        warn("Не удалось прочитать deploy-baseline.json");
        return;
    }

    const checks = [
        ["usersTotal", "игроков в users"],
        ["usersWithNick", "игроков с ником"],
        ["pubChat.count", "сообщений pub_chat"]
    ];

    for (const [key, label] of checks) {
        const prev = key.includes(".")
            ? key.split(".").reduce((o, k) => o?.[k], baseline.metrics)
            : baseline.metrics?.[key];
        const cur = key.includes(".")
            ? key.split(".").reduce((o, k) => o?.[k], metrics)
            : metrics[key];
        if (typeof prev === "number" && typeof cur === "number" && cur < prev) {
            warn(`${label}: было ${prev}, сейчас ${cur} (падение после деплоя/рестарта)`);
        }
    }

    if (baseline.metrics?.heroOfDay?.leaderEmail && !metrics.heroOfDay?.leaderEmail) {
        warn("Герой дня: в baseline был лидер, сейчас пусто.");
    }
}

async function printDetails(db) {
    const dups = await all(
        db,
        `SELECT LOWER(TRIM(name)) AS nick, COUNT(*) AS cnt
         FROM users WHERE name IS NOT NULL AND TRIM(name) != ''
         GROUP BY LOWER(TRIM(name)) HAVING cnt > 1
         ORDER BY cnt DESC LIMIT 10`
    );
    if (dups.length) {
        console.log("\n--- Дубликаты ников (до 10 групп) ---");
        for (const g of dups) {
            const rows = await all(
                db,
                `SELECT id, email, recovery_email, name, level, club, registered_at
                 FROM users WHERE LOWER(TRIM(name)) = ? ORDER BY id`,
                [g.nick]
            );
            console.log(`  nick="${g.nick}" × ${g.cnt}`);
            rows.forEach((r) => {
                console.log(
                    `    id=${r.id} email=${r.email} lvl=${r.level} club=${r.club || "-"} reg=${fmtTs(r.registered_at)}`
                );
            });
        }
    }

    const reRegs = await all(
        db,
        `SELECT a.id AS old_id, a.email AS old_email, a.level AS old_level, a.registered_at AS old_reg,
                b.id AS new_id, b.email AS new_email, b.level AS new_level, b.registered_at AS new_reg,
                a.name
         FROM users a
         JOIN users b ON LOWER(TRIM(a.name)) = LOWER(TRIM(b.name)) AND a.id < b.id
         WHERE a.name IS NOT NULL AND TRIM(a.name) != ''
           AND b.name IS NOT NULL AND TRIM(b.name) != ''
           AND (a.email NOT LIKE '%@internal.local' AND b.email LIKE '%@internal.local')
         ORDER BY b.registered_at DESC
         LIMIT 20`
    );
    if (reRegs.length) {
        console.log("\n--- Подозрение: старый прогресс + новый @internal.local ---");
        reRegs.forEach((r) => {
            console.log(
                `  "${r.name}": old id=${r.old_id} lvl=${r.old_level} | new id=${r.new_id} lvl=${r.new_level} (${r.new_email})`
            );
        });
    }

    const noNick = await all(
        db,
        `SELECT id, email, character, club, level FROM users
         WHERE name IS NULL OR TRIM(name) = '' ORDER BY id LIMIT 20`
    );
    if (noNick.length) {
        console.log("\n--- Без ника (вход только по email) ---");
        noNick.forEach((r) => {
            console.log(`  id=${r.id} email=${r.email} char=${r.character || "-"} club=${r.club || "-"} lvl=${r.level}`);
        });
    }
}

async function main() {
    if (!fs.existsSync(dbPath)) {
        console.error("База не найдена:", dbPath);
        process.exit(1);
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
    const metrics = await collectMetrics(db);

    console.log("=== Pre-deploy check (read-only) ===");
    console.log("DB:", dbPath);
    console.log("Size:", metrics.dbSizeBytes, "bytes\n");

    console.log("Игроки:");
    console.log(`  users (всего):     ${metrics.usersTotal}`);
    console.log(`  с ником:           ${metrics.usersWithNick}`);
    console.log(`  без ника:          ${metrics.usersNoNick}`);
    console.log(`  дубликаты ников:   ${metrics.duplicateNickGroups} групп`);
    console.log(`  подозр. re-reg:    ${metrics.suspectedReRegs} пар\n`);

    console.log("Герой дня:");
    if (metrics.heroOfDay) {
        console.log(
            `  day=${metrics.heroOfDay.dayKey} leader=${metrics.heroOfDay.leaderEmail || "(нет)"} skulls=${metrics.heroOfDay.leaderSkulls}`
        );
    } else {
        warn("hero_of_day_state пуст — после деплоя герой может сброситься.");
    }

    console.log("\nПаб (pub_chat):");
    console.log(`  сообщений: ${metrics.pubChat.count} (лимит хранения: 100 последних при отправке)`);
    if (metrics.pubChat.oldest) {
        console.log(`  старейшее: ${fmtTs(metrics.pubChat.oldest)}`);
        console.log(`  новейшее:  ${fmtTs(metrics.pubChat.newest)}`);
    }

    console.log("\nСтадион (scheduled/live):");
    if (!metrics.stadiumScheduled.length) {
        note("Нет матчей scheduled/live — seedChampionshipIfMissing посеет чемпионат при первом старте.");
    } else {
        metrics.stadiumScheduled.forEach((m) => {
            console.log(`  L${m.level} ${m.status} id=${m.id} starts=${fmtTs(m.startsAt)} (~${m.hoursUntil}ч)`);
        });
    }

    if (metrics.usersTotal === 0) {
        warn("users пустая — не деплоить на production без восстановления бэкапа.");
    }
    if (metrics.usersNoNick > 0) {
        note(`${metrics.usersNoNick} аккаунт(ов) без ника — вход только по email, риск повторной регистрации.`);
    }
    if (metrics.duplicateNickGroups > 0) {
        warn(`${metrics.duplicateNickGroups} групп с одинаковым ником — возможны параллельные аккаунты.`);
    }

    checkCodeRisks();
    compareBaseline(metrics);

    await printDetails(db);
    db.close();

    if (saveBaseline) {
        const dir = path.dirname(baselinePath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            baselinePath,
            JSON.stringify({ savedAt: new Date().toISOString(), metrics }, null, 2),
            "utf8"
        );
        console.log("\nBaseline сохранён:", baselinePath);
    }

    info.forEach((m) => console.log("\nℹ", m));
    if (warnings.length) {
        console.log("\n⚠ ПРЕДУПРЕЖДЕНИЯ:");
        warnings.forEach((w) => console.log("  -", w));
        console.log("\nРекомендация: node scripts/backup-users-db.js → деплой только кода → снова этот скрипт.");
        process.exit(1);
    }

    console.log("\n✓ Критических предупреждений нет (сверьте цифры с ожиданиями вручную).");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
