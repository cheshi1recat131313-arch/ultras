/**
 * Резервная копия users.db перед деплоем.
 * Запуск: node scripts/backup-users-db.js
 * Или: DB_PATH=/var/lib/fanaty/users.db node scripts/backup-users-db.js
 */
const fs = require("fs");
const path = require("path");
const { resolveDbPath } = require("../core/db-path");

const dbPath = resolveDbPath();
if (!fs.existsSync(dbPath)) {
    console.error("База не найдена:", dbPath);
    process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const backupDir = path.join(path.dirname(dbPath), "backups");
fs.mkdirSync(backupDir, { recursive: true });

const dest = path.join(backupDir, `users-${stamp}.db`);
fs.copyFileSync(dbPath, dest);

const stat = fs.statSync(dest);
console.log("Backup OK:", dest);
console.log("Size:", stat.size, "bytes");
