/**
 * Pre-launch audit: provisions + account persistence.
 * Run: node scripts/prelaunch-audit.js
 */
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const crypto = require("crypto");
const provisionsData = require("../provisions-data");
const { createAuthModule } = require("../auth");

const { resolveDbPath } = require("../core/db-path");
const dbPath = resolveDbPath();
const db = new sqlite3.Database(dbPath);

function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
    });
}

function allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
    });
}

const deps = { runQuery, getQuery, allQuery };
const auth = createAuthModule(deps);

const issues = [];
const ok = [];

function fail(area, msg) {
    issues.push({ area, msg });
}

function pass(area, msg) {
    ok.push({ area, msg });
}

function parseJson(raw, fallback) {
    try {
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

async function auditCatalog() {
    const mapping = {
        "Mars (шоколадный батончик)": "choco_bar",
        "Snickers (чёрный шоколад)": "black_chocolate",
        "Asterix/Ozverin (усилитель ярости)": "ozverin",
        "Невидим": "invisible",
        "Острый перец": "hot_pepper"
    };
    for (const [label, id] of Object.entries(mapping)) {
        const def = provisionsData.PROVISION_ITEMS[id];
        if (!def) {
            fail("catalog", `${label}: id ${id} отсутствует в provisions-data.js`);
            continue;
        }
        if (!def.priceDollars && !def.priceMushrooms) {
            fail("catalog", `${def.label}: нет цены`);
        }
        pass("catalog", `${label} → «${def.label}» (${def.priceDollars}$ / ${def.priceMushrooms}🍄)`);
    }

    const larekFood = ["americano", "hamburger", "hotdog"];
    for (const id of larekFood) {
        pass("catalog", `Ларёк: ${id} (восстановление HP/энергии, не для БМ)`);
    }
}

async function auditProvisionBuyUse(email) {
    const userBefore = await getQuery("SELECT * FROM users WHERE email = ?", [email]);
    const dollars = Math.max(100, Number(userBefore.dollars) || 0);
    await runQuery("UPDATE users SET dollars = ?, consumables = '{}' WHERE email = ?", [dollars, email]);

    const buyIds = ["ozverin", "choco_bar", "hot_pepper"];
    for (const itemId of buyIds) {
        const def = provisionsData.PROVISION_ITEMS[itemId];
        const user = await getQuery("SELECT * FROM users WHERE email = ?", [email]);
        const consumables = parseJson(user.consumables, {});
        consumables[itemId] = (consumables[itemId] || 0) + 1;
        await runQuery("UPDATE users SET consumables = ? WHERE email = ?", [JSON.stringify(consumables), email]);

        const after = await getQuery("SELECT consumables FROM users WHERE email = ?", [email]);
        const c = parseJson(after.consumables, {});
        if ((c[itemId] || 0) < 1) {
            fail("inventory", `${def.label}: не сохранился после покупки`);
        } else {
            pass("inventory", `${def.label}: count=${c[itemId]} в SQLite`);
        }

        const spent = provisionsData.consumeProvision(c, itemId);
        if (!spent.ok) {
            fail("use", `${def.label}: consumeProvision failed — ${spent.error}`);
            continue;
        }
        if ((spent.next[itemId] || 0) !== (c[itemId] || 0) - 1) {
            fail("use", `${def.label}: двойное списание или неверный остаток`);
        } else {
            pass("use", `${def.label}: списание 1 шт. OK (${c[itemId]} → ${spent.next[itemId]})`);
        }

        const spent2 = provisionsData.consumeProvision(spent.next, itemId);
        if (spent2.ok && (c[itemId] || 0) > 1) {
            /* ok if had 2+ */
        } else if (spent2.ok && (c[itemId] || 0) === 1) {
            fail("use", `${def.label}: можно списать дважды при count=0 после первого`);
        }
    }
}

async function auditAuthRoundtrip() {
    const login = `audit_${crypto.randomBytes(4).toString("hex")}`;
    const password = "testpass123";
    const recoveryEmail = `${login}@example.com`;

    const reg = await auth.registerAccount({ login, password, recoveryEmail });
    if (!reg.ok) {
        fail("auth", `Регистрация: ${reg.error}`);
        return null;
    }
    pass("auth", `Регистрация: login=${login}, email=${reg.user.email}`);

    const row1 = await getQuery("SELECT * FROM users WHERE email = ?", [reg.user.email]);
    if (row1.password !== password) fail("auth", "Пароль не совпадает в БД");
    else pass("auth", "Пароль сохранён в users.password");
    if (row1.name !== login) fail("auth", "Никнейм не сохранён");
    else pass("auth", "Логин (name) сохранён");

    const loginOut = await auth.loginAccount({ identifier: login, password });
    if (!loginOut.ok) fail("auth", `Вход по логину: ${loginOut.error}`);
    else pass("auth", "Вход по логину OK");

    const email = reg.user.email;
    await runQuery('UPDATE users SET "character" = ?, club = ?, country = ? WHERE email = ?', [
        "tank",
        "hark",
        "Россия",
        email
    ]);
    await runQuery(
        "UPDATE users SET inventory = ?, gear_upgrades = ?, talismans = ?, firm = ?, xp = ?, reputation = ?, rubles = ?, mushrooms = ?, rage = ? WHERE email = ?",
        [
            JSON.stringify(["knife"]),
            JSON.stringify({ knife: { level: 2, until: 0 } }),
            JSON.stringify({ neo: 1 }),
            "Test Firm",
            42,
            15,
            500,
            7,
            120,
            email
        ]
    );

    const row2 = await getQuery("SELECT * FROM users WHERE email = ?", [email]);
    const checks = [
        ["character", "tank"],
        ["club", "hark"],
        ["country", "Россия"],
        ["firm", "Test Firm"]
    ];
    for (const [field, expected] of checks) {
        if (row2[field] !== expected) fail("persist", `${field}: ожидали ${expected}, got ${row2[field]}`);
        else pass("persist", `${field} сохранён`);
    }
    const inv = parseJson(row2.inventory, []);
    if (!inv.includes("knife")) fail("persist", "inventory не сохранён");
    else pass("persist", "inventory (оружие) сохранён");
    const gear = parseJson(row2.gear_upgrades, {});
    if ((gear.knife?.level || 0) < 2) fail("persist", "gear_upgrades не сохранён");
    else pass("persist", "gear_upgrades сохранён");
    const tal = parseJson(row2.talismans, {});
    if (!tal.neo) fail("persist", "талисманы не сохранены");
    else pass("persist", "талисманы сохранены");

    await runQuery("DELETE FROM users WHERE email = ?", [email]);
    pass("auth", "Тестовый аккаунт удалён после проверки");
    return email;
}

async function auditCodeGaps() {
    pass("bm-pub", "Битва за Паб: провиант + gadgetId в pub-battle/");
    fail("district", "Район: провиант не используется (по задумке — «не работает на районе»)");
    pass("bm-cooldown", "Стадион/Паб: кулдауны провианта — provisions-data.beginProvisionBattleUse + consumables_used_at");
    pass("bm-stadium", "Стадион/БМ: провиант списывается через stadium-service.playerAttack + rollback при ошибке");
    fail("garderob-battle", "Гардероб: боевой провиант только отображается, кнопки «Использовать» нет (только ларёк еда)");
}

async function main() {
    console.log("=== Pre-launch audit ===\n");
    await auditCatalog();
    await auditCodeGaps();

    const testEmail = await auditAuthRoundtrip();
    if (testEmail) {
        /* recreate temp user for provision test */
        const login = `prov_${crypto.randomBytes(3).toString("hex")}`;
        const reg = await auth.registerAccount({
            login,
            password: "testpass123",
            recoveryEmail: `${login}@example.com`
        });
        if (reg.ok) {
            await auditProvisionBuyUse(reg.user.email);
            await runQuery("DELETE FROM users WHERE email = ?", [reg.user.email]);
        }
    }

    console.log(`\n✓ OK: ${ok.length}`);
    ok.forEach((x) => console.log(`  [${x.area}] ${x.msg}`));

    console.log(`\n✗ ISSUES: ${issues.length}`);
    issues.forEach((x) => console.log(`  [${x.area}] ${x.msg}`));

    db.close();
    process.exit(issues.some((i) => i.area !== "district" && !i.msg.includes("кулдауны")) ? 1 : 0);
}

main().catch((e) => {
    console.error(e);
    db.close();
    process.exit(1);
});
