/**
 * Single SQLite connection with WAL, busy_timeout, serialized access, and BUSY retries.
 */
const sqlite3 = require("sqlite3").verbose();

const BUSY_RE = /SQLITE_BUSY|database is locked/i;
const MAX_BUSY_RETRIES = 8;
const BUSY_RETRY_BASE_MS = 25;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isBusyError(err) {
    if (!err) return false;
    if (err.code === "SQLITE_BUSY" || err.errno === 5) return true;
    return BUSY_RE.test(String(err.message || ""));
}

function promisifyDbMethod(db, method, sql, params = []) {
    return new Promise((resolve, reject) => {
        db[method](sql, params, function onResult(err, result) {
            if (err) {
                reject(err);
                return;
            }
            if (method === "run") {
                resolve(this);
                return;
            }
            resolve(result);
        });
    });
}

async function execWithBusyRetry(fn, attempt = 0) {
    try {
        return await fn();
    } catch (err) {
        if (isBusyError(err) && attempt < MAX_BUSY_RETRIES) {
            await sleep(BUSY_RETRY_BASE_MS * (attempt + 1));
            return execWithBusyRetry(fn, attempt + 1);
        }
        throw err;
    }
}

function createDirectOps(db) {
    return {
        runQuery(sql, params = []) {
            return execWithBusyRetry(() => promisifyDbMethod(db, "run", sql, params));
        },
        getQuery(sql, params = []) {
            return execWithBusyRetry(() => promisifyDbMethod(db, "get", sql, params));
        },
        allQuery(sql, params = []) {
            return execWithBusyRetry(() => promisifyDbMethod(db, "all", sql, params));
        }
    };
}

function openDatabase(dbPath) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) reject(err);
            else resolve(db);
        });
    });
}

async function configurePragmas(db) {
    const direct = createDirectOps(db);
    await direct.runQuery("PRAGMA busy_timeout = 15000");
    await direct.runQuery("PRAGMA journal_mode = WAL");
    await direct.runQuery("PRAGMA synchronous = NORMAL");
    await direct.runQuery("PRAGMA foreign_keys = ON");
}

/**
 * @param {string} dbPath
 * @returns {Promise<{ runQuery, getQuery, allQuery, runTransaction, close }>}
 */
async function createSqliteDatabase(dbPath) {
    const db = await openDatabase(dbPath);
    await configurePragmas(db);

    let chain = Promise.resolve();
    const direct = createDirectOps(db);

    function enqueue(fn) {
        const task = chain.then(fn, fn);
        chain = task.then(
            () => {},
            () => {}
        );
        return task;
    }

    function runQuery(sql, params = []) {
        return enqueue(() => direct.runQuery(sql, params));
    }

    function getQuery(sql, params = []) {
        return enqueue(() => direct.getQuery(sql, params));
    }

    function allQuery(sql, params = []) {
        return enqueue(() => direct.allQuery(sql, params));
    }

    function runTransaction(fn) {
        return enqueue(async () => {
            await direct.runQuery("BEGIN IMMEDIATE");
            const tx = createDirectOps(db);
            try {
                const result = await fn({
                    runQuery: (sql, params) => tx.runQuery(sql, params),
                    getQuery: (sql, params) => tx.getQuery(sql, params),
                    allQuery: (sql, params) => tx.allQuery(sql, params)
                });
                await direct.runQuery("COMMIT");
                return result;
            } catch (err) {
                await direct.runQuery("ROLLBACK").catch(() => {});
                throw err;
            }
        });
    }

    function close() {
        return new Promise((resolve, reject) => {
            db.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    return { runQuery, getQuery, allQuery, runTransaction, close };
}

module.exports = { createSqliteDatabase, isBusyError };
