/** PM2: production-конфиг с базой вне папки деплоя. */
module.exports = {
    apps: [
        {
            name: "fanaty",
            script: "server.js",
            cwd: __dirname,
            env: {
                DB_PATH: "/var/lib/fanaty/users.db"
            }
        }
    ]
};
