const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const db = new sqlite3.Database(path.join(__dirname, "../users.db"));

db.all("SELECT email, name FROM users WHERE name = ?", ["SameNickTest"], (err, rows) => {
    console.log("rows", rows);
    db.close();
});
