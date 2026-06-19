/**
 * Путь к SQLite. В проде задайте DB_PATH вне каталога деплоя, чтобы scp/git pull не затирали базу.
 *
 * Пример (Linux): DB_PATH=/var/lib/fanaty/users.db
 */
const fs = require("fs");
const path = require("path");

function resolveDbPath() {
    const env = String(process.env.DB_PATH || "").trim();
    if (env) return path.resolve(env);
    return path.join(__dirname, "..", "users.db");
}

function ensureDbDirectory(dbPath) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

module.exports = { resolveDbPath, ensureDbDirectory };
