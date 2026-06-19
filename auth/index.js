const {

    normalizeEmail,

    normalizePlayerName,

    isRecoveryEmail,

    generateInternalEmail,

    validateLogin,

    validatePassword,

    validateOptionalRecoveryEmail,

    resolveRecoveryEmailInput,

    isInternalEmail,

    MIN_LOGIN_LENGTH,

    MIN_PASSWORD_LENGTH,

    INTERNAL_EMAIL_SUFFIX

} = require("./credentials");

const { createUserLookup } = require("./user-lookup");

const { createPasswordResetService } = require("./password-reset");
const { parseReferrerId } = require("../referrals/service");



function createAuthModule(deps) {

    const lookup = createUserLookup(deps);

    const passwordReset = createPasswordResetService({

        ...deps,

        findUserByLoginIdentifier: lookup.findUserByLoginIdentifier

    });



    async function ensureSchema() {

        const { runQuery } = deps;

        const columns = await deps.allQuery("PRAGMA table_info(users)");

        const existing = new Set(columns.map((col) => col.name));

        if (!existing.has("recovery_email")) {

            await runQuery("ALTER TABLE users ADD COLUMN recovery_email TEXT DEFAULT ''");

            await runQuery(

                `UPDATE users

                 SET recovery_email = email

                 WHERE recovery_email IS NULL OR TRIM(recovery_email) = ''`

            );

            await runQuery(

                `UPDATE users

                 SET recovery_email = ''

                 WHERE email LIKE '%${INTERNAL_EMAIL_SUFFIX}'`

            );

        }

        await runQuery(

            "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_recovery_email_unique ON users(recovery_email) WHERE recovery_email IS NOT NULL AND TRIM(recovery_email) != ''"

        );

        await passwordReset.ensureSchema();

    }



    function recoveryMetaFromUser(row) {

        if (!row) {

            return {

                recoveryEmail: null,

                hasRecoveryContact: false

            };

        }

        const storedRecovery = normalizeEmail(row.recovery_email);

        const legacyRecovery = isRecoveryEmail(row.email) ? normalizeEmail(row.email) : "";

        const recoveryEmail = storedRecovery || legacyRecovery || null;

        return {

            recoveryEmail,

            hasRecoveryContact: !!recoveryEmail

        };

    }



    async function resolveReferrerId(raw) {
        const id = parseReferrerId(raw);
        if (!id) return null;
        const row = await deps.getQuery("SELECT id FROM users WHERE id = ?", [id]);
        return row ? id : null;
    }

    async function registerAccount({ login, password, recoveryEmail, skipRecoveryEmail, referrerId }) {

        const loginCheck = validateLogin(login);

        if (!loginCheck.ok) return loginCheck;



        const passwordCheck = validatePassword(password);

        if (!passwordCheck.ok) return passwordCheck;



        const recoveryValue = resolveRecoveryEmailInput({ recoveryEmail, skipRecoveryEmail });

        const emailCheck = recoveryValue

            ? validateOptionalRecoveryEmail(recoveryValue)

            : { ok: true, value: "" };

        if (!emailCheck.ok) return emailCheck;



        if (await lookup.isLoginTaken(loginCheck.value)) {

            return {
                ok: false,
                code: "nickname_taken",
                error:
                    "Аккаунт с таким ником уже есть. Перейдите на вкладку «Вход» и войдите по нику и паролю."
            };

        }



        if (emailCheck.value && (await lookup.isRecoveryEmailTaken(emailCheck.value))) {

            return {
                ok: false,
                code: "recovery_email_taken",
                error:
                    "Этот email уже привязан к другому аккаунту. Войдите через вкладку «Вход» (ник или этот email)."
            };

        }



        let accountEmail = generateInternalEmail(loginCheck.value);

        while (await deps.getQuery("SELECT email FROM users WHERE email = ?", [accountEmail])) {

            accountEmail = generateInternalEmail(loginCheck.value);

        }



        const now = Date.now();
        const referredBy = await resolveReferrerId(referrerId);

        await deps.runQuery(

            "INSERT INTO users (email, password, name, recovery_email, last_regen_at, registered_at, referred_by) VALUES (?, ?, ?, ?, ?, ?, ?)",

            [
                accountEmail,
                passwordCheck.value,
                loginCheck.value,
                emailCheck.value || "",
                now,
                now,
                referredBy
            ]

        );



        const created = await deps.getQuery("SELECT * FROM users WHERE email = ?", [accountEmail]);

        return {

            ok: true,

            user: created,

            recoveryWarning: !emailCheck.value

        };

    }



    async function loginAccount({ identifier, password }) {

        const passwordCheck = validatePassword(password);

        if (!passwordCheck.ok) {

            return { ok: false, error: "Введите корректный логин и пароль" };

        }



        const raw = String(identifier || "").trim();

        if (raw.length < MIN_LOGIN_LENGTH) {

            return { ok: false, error: "Введите корректный логин и пароль" };

        }



        const user = await lookup.findUserByLoginIdentifier(raw);

        if (!user || user.password !== passwordCheck.value) {

            return { ok: false, error: "Неверный логин или пароль" };

        }



        return { ok: true, user };

    }



    async function updateRecoveryContact(email, { recoveryEmail }) {

        const user = await deps.getQuery("SELECT * FROM users WHERE email = ?", [normalizeEmail(email)]);

        if (!user) {

            return { ok: false, error: "Пользователь не найден" };

        }



        const emailCheck = validateOptionalRecoveryEmail(recoveryEmail);

        if (!emailCheck.ok) return emailCheck;



        if (emailCheck.value && (await lookup.isRecoveryEmailTaken(emailCheck.value, user.email))) {

            return { ok: false, error: "Этот email уже используется" };

        }



        await deps.runQuery("UPDATE users SET recovery_email = ? WHERE email = ?", [

            emailCheck.value || "",

            user.email

        ]);



        const updated = await deps.getQuery("SELECT * FROM users WHERE email = ?", [user.email]);

        return { ok: true, user: updated };

    }



    function registerRoutes(app, { sanitizeUser, syncUserResources, onLogin }) {

        app.post("/register", async (req, res) => {

            try {

                const body = req.body && typeof req.body === "object" ? req.body : {};

                const out = await registerAccount({

                    login: body.login || body.nickname || body.name,

                    password: body.password,

                    recoveryEmail: body.recoveryEmail,

                    skipRecoveryEmail: body.skipRecoveryEmail === true || body.emailSkipped === true,

                    referrerId: body.referrerId || body.ref

                });



                if (!out.ok) {

                    res.status(400).json({
                        success: false,
                        error: out.error,
                        code: out.code || null
                    });

                    return;

                }



                res.json({

                    success: true,

                    user: sanitizeUser(out.user),

                    recoveryWarning: !!out.recoveryWarning

                });

            } catch (error) {

                console.error("Register error:", error);

                res.status(500).json({ success: false, error: "Ошибка сервера при регистрации" });

            }

        });



        app.post("/login", async (req, res) => {

            try {

                const body = req.body && typeof req.body === "object" ? req.body : {};

                const out = await loginAccount({

                    identifier: body.login || body.identifier || body.email,

                    password: body.password

                });



                if (!out.ok) {

                    res.status(out.error === "Неверный логин или пароль" ? 401 : 400).json({

                        success: false,

                        error: out.error

                    });

                    return;

                }



                const synced = await syncUserResources(out.user.email);

                if (typeof onLogin === "function") {
                    try {
                        await onLogin(synced.email);
                    } catch (loginHookErr) {
                        console.error("onLogin hook error:", loginHookErr);
                    }
                }

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



        app.post("/auth/password-reset/request", async (req, res) => {

            try {

                const body = req.body && typeof req.body === "object" ? req.body : {};

                const out = await passwordReset.requestReset({

                    email: body.email || body.recoveryEmail

                });

                res.json({

                    success: true,

                    message: out.message,

                    deliveryPrepared: out.deliveryPrepared,

                    channel: out.channel || null,

                    destinationMasked: out.destinationMasked || null,

                    stub: true,

                    devToken: out.devToken

                });

            } catch (error) {

                console.error("Password reset request error:", error);

                res.status(500).json({ success: false, error: "Ошибка сервера" });

            }

        });



        app.post("/auth/password-reset/confirm", async (req, res) => {

            try {

                const body = req.body && typeof req.body === "object" ? req.body : {};

                const out = await passwordReset.confirmReset({

                    token: body.token,

                    newPassword: body.newPassword

                });

                res.status(501).json({ success: false, error: out.error });

            } catch (error) {

                console.error("Password reset confirm error:", error);

                res.status(500).json({ success: false, error: "Ошибка сервера" });

            }

        });



        app.post("/auth/recovery-contact", async (req, res) => {

            try {

                const body = req.body && typeof req.body === "object" ? req.body : {};

                const email = normalizeEmail(body.email);

                const user = await deps.getQuery("SELECT * FROM users WHERE email = ?", [email]);

                if (!user) {

                    res.status(404).json({ success: false, error: "Пользователь не найден" });

                    return;

                }



                const out = await updateRecoveryContact(email, {

                    recoveryEmail: body.recoveryEmail

                });



                if (!out.ok) {

                    res.status(400).json({ success: false, error: out.error });

                    return;

                }



                res.json({ success: true, user: sanitizeUser(out.user) });

            } catch (error) {

                console.error("Recovery contact error:", error);

                res.status(500).json({ success: false, error: "Ошибка сервера" });

            }

        });



        app.post("/reset-password", async (_req, res) => {

            res.status(410).json({

                success: false,

                error: "Старый способ сброса отключён. Используй «Забыли пароль?» на экране входа."

            });

        });

    }



    return {

        ensureSchema,

        registerRoutes,

        registerAccount,

        loginAccount,

        recoveryMetaFromUser,

        passwordReset,

        ...lookup

    };

}



module.exports = {

    createAuthModule,

    normalizeEmail,

    normalizePlayerName,

    isRecoveryEmail,

    isInternalEmail,

    MIN_LOGIN_LENGTH,

    MIN_PASSWORD_LENGTH

};

