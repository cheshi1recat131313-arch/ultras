#!/usr/bin/env node
/**
 * Выдать admin-аккаунту тестовый набор (грибы + ₽ + $ для промзоны).
 *
 *   node scripts/grant-admin-test-kit.js
 *   node scripts/grant-admin-test-kit.js admin@example.com
 */
const sqlite3 = require("sqlite3").verbose();
const { resolveDbPath } = require("../core/db-path");
const { isAdminUser, adminTestKitPayload, normalizeEmail } = require("../dev-admin");

const dbPath = resolveDbPath();
const db = new sqlite3.Database(dbPath);

function getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
    });
}

function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
        });
    });
}

async function findAdminUser(explicitEmail) {
    if (explicitEmail) {
        const user = await getQuery("SELECT email, name, mushrooms, rubles, dollars FROM users WHERE email = ?", [
            explicitEmail
        ]);
        if (!user) throw new Error(`Пользователь не найден: ${explicitEmail}`);
        if (!isAdminUser(user.email, user)) {
            throw new Error(`Не admin-аккаунт: ${explicitEmail}`);
        }
        return user;
    }

    const allowlist = String(process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((s) => normalizeEmail(s))
        .filter(Boolean);

    if (allowlist.length) {
        for (const email of allowlist) {
            const user = await getQuery(
                "SELECT email, name, mushrooms, rubles, dollars FROM users WHERE email = ?",
                [email]
            );
            if (user) return user;
        }
        throw new Error("ADMIN_EMAILS задан, но пользователи не найдены в БД.");
    }

    const user = await getQuery(
        `SELECT email, name, mushrooms, rubles, dollars FROM users
         WHERE lower(trim(name)) = 'admin'
         ORDER BY rowid ASC
         LIMIT 1`
    );
    if (!user) throw new Error('Admin не найден (имя «admin»). Укажите email аргументом или ADMIN_EMAILS.');
    return user;
}

async function main() {
    const explicit = normalizeEmail(process.argv[2] || "");
    const user = await findAdminUser(explicit || null);
    const kit = adminTestKitPayload();

    await runQuery(
        "UPDATE users SET mushrooms = ?, rubles = ?, money = ?, dollars = ? WHERE email = ?",
        [kit.mushrooms, kit.rubles, kit.rubles, kit.dollars, user.email]
    );

    const updated = await getQuery(
        "SELECT email, name, mushrooms, rubles, dollars FROM users WHERE email = ?",
        [user.email]
    );

    console.log("Admin test kit granted:");
    console.log(`  email: ${updated.email}`);
    console.log(`  name: ${updated.name}`);
    console.log(`  mushrooms: ${updated.mushrooms}`);
    console.log(`  rubles: ${updated.rubles}`);
    console.log(`  dollars: ${updated.dollars}`);
}

main()
    .catch((err) => {
        console.error(err.message || err);
        process.exit(1);
    })
    .finally(() => db.close());
