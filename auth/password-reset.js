const crypto = require("crypto");

const { normalizeEmail, isRecoveryEmail, maskDestination } = require("./credentials");



const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;



function hashToken(token) {

    return crypto.createHash("sha256").update(String(token || "")).digest("hex");

}



function createPasswordResetService({ runQuery, getQuery, findUserByLoginIdentifier }) {

    async function ensureSchema() {

        await runQuery(`

            CREATE TABLE IF NOT EXISTS password_reset_requests (

                id TEXT PRIMARY KEY,

                user_email TEXT NOT NULL,

                channel TEXT NOT NULL,

                destination TEXT NOT NULL,

                token_hash TEXT NOT NULL,

                expires_at INTEGER NOT NULL,

                created_at INTEGER NOT NULL,

                consumed_at INTEGER

            )

        `);

        await runQuery(

            "CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_requests(user_email, created_at DESC)"

        );

    }



    async function resolveRecoveryTarget({ email }) {

        const normalizedEmail = normalizeEmail(email);



        if (normalizedEmail && isRecoveryEmail(normalizedEmail)) {

            const user =

                (await getQuery("SELECT * FROM users WHERE recovery_email = ?", [normalizedEmail])) ||

                (await getQuery("SELECT * FROM users WHERE email = ?", [normalizedEmail]));

            if (user) {

                const destination = normalizeEmail(user.recovery_email) || normalizedEmail;

                return { user, channel: "email", destination };

            }

        }



        if (normalizedEmail) {

            const user = await findUserByLoginIdentifier(normalizedEmail);

            const destination =

                normalizeEmail(user?.recovery_email) ||

                (isRecoveryEmail(user?.email) ? normalizeEmail(user.email) : "");

            if (user && destination) {

                return { user, channel: "email", destination };

            }

        }



        return null;

    }



    async function requestReset({ email }) {

        const target = await resolveRecoveryTarget({ email });

        const genericMessage =

            "Если аккаунт найден, код для сброса пароля будет отправлен на email, когда восстановление заработает.";



        if (!target) {

            return {

                ok: true,

                message: genericMessage,

                deliveryPrepared: false

            };

        }



        const token = crypto.randomBytes(24).toString("hex");

        const now = Date.now();

        const id = `pr_${now}_${crypto.randomBytes(4).toString("hex")}`;



        await runQuery(

            `INSERT INTO password_reset_requests

             (id, user_email, channel, destination, token_hash, expires_at, created_at, consumed_at)

             VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,

            [

                id,

                target.user.email,

                target.channel,

                target.destination,

                hashToken(token),

                now + RESET_TOKEN_TTL_MS,

                now

            ]

        );



        return {

            ok: true,

            message: `${genericMessage} Email: ${maskDestination(target.channel, target.destination)}.`,

            deliveryPrepared: true,

            channel: target.channel,

            destinationMasked: maskDestination(target.channel, target.destination),

            devToken: process.env.NODE_ENV === "production" ? undefined : token

        };

    }



    async function confirmReset({ token, newPassword }) {

        void token;

        void newPassword;

        return {

            ok: false,

            error: "Подтверждение сброса пароля по коду пока не подключено"

        };

    }



    return {

        ensureSchema,

        requestReset,

        confirmReset

    };

}



module.exports = { createPasswordResetService };

