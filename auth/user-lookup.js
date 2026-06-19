const {

    normalizeEmail,

    normalizePlayerName,

    isRecoveryEmail

} = require("./credentials");



function createUserLookup({ getQuery }) {

    async function findUserByLoginIdentifier(identifier) {

        const raw = String(identifier || "").trim();

        if (!raw) return null;



        const asEmail = normalizeEmail(raw);

        if (isRecoveryEmail(asEmail)) {

            const byRecoveryEmail = await getQuery(

                "SELECT * FROM users WHERE recovery_email = ? LIMIT 1",

                [asEmail]

            );

            if (byRecoveryEmail) return byRecoveryEmail;



            const byEmail = await getQuery("SELECT * FROM users WHERE email = ?", [asEmail]);

            if (byEmail) return byEmail;

        }



        const asLogin = normalizePlayerName(raw);

        if (asLogin.length >= 2) {

            const byName = await getQuery(

                "SELECT * FROM users WHERE LOWER(TRIM(name)) = LOWER(?) LIMIT 1",

                [asLogin]

            );

            if (byName) return byName;



            const legacy = await getQuery("SELECT * FROM users WHERE email = ? LIMIT 1", [asEmail]);

            if (legacy) return legacy;

        }



        return null;

    }



    async function isLoginTaken(login, exceptEmail = "") {

        const normalized = normalizePlayerName(login);

        if (normalized.length < 2) return false;

        const row = await getQuery(

            "SELECT email FROM users WHERE LOWER(TRIM(name)) = LOWER(?) AND email != ? LIMIT 1",

            [normalized, normalizeEmail(exceptEmail)]

        );

        return !!row;

    }



    async function isRecoveryEmailTaken(email, exceptEmail = "") {

        const normalized = normalizeEmail(email);

        if (!isRecoveryEmail(normalized)) return false;

        const row =

            (await getQuery(

                "SELECT email FROM users WHERE recovery_email = ? AND email != ? LIMIT 1",

                [normalized, normalizeEmail(exceptEmail)]

            )) ||

            (await getQuery(

                "SELECT email FROM users WHERE email = ? AND email != ? LIMIT 1",

                [normalized, normalizeEmail(exceptEmail)]

            ));

        return !!row;

    }



    return {

        findUserByLoginIdentifier,

        isLoginTaken,

        isRecoveryEmailTaken

    };

}



module.exports = { createUserLookup };

