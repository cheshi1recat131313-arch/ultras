const {
    FIRM_CREATE_MIN_LEVEL,
    FIRM_NAME_MIN_LENGTH,
    FIRM_NAME_MAX_LENGTH,
    FIRM_CREATE_COST_DOLLARS,
    FIRM_CREATE_COST_MUSHROOMS,
    getPublicConfig
} = require("./config");

function createFirmsService(deps) {
    const {
        runQuery,
        getQuery,
        allQuery,
        normalizeEmail,
        levelFromXp,
        normalizeXp,
        avatarPath,
        purchaseLogic,
        randomInt,
        getClubName
    } = deps;

    const clubName = (clubId) => {
        if (typeof getClubName === "function") return getClubName(clubId) || clubId || "";
        return clubId || "";
    };

    function viewerRole(viewerEmail, firm) {
        const email = normalizeEmail(viewerEmail);
        if (!email || !firm) return "guest";
        if (normalizeEmail(firm.leader_email) === email) return "leader";
        if (normalizeEmail(firm.assistant_email) === email) return "assistant";
        return "member";
    }

    function rankTitle(role) {
        if (role === "leader") return "Лидер";
        if (role === "assistant") return "Помощник лидера";
        if (role === "member") return "Основа";
        return "Гость";
    }

    function normalizeFirmName(name) {
        return String(name || "")
            .trim()
            .replace(/\s+/g, " ");
    }

    function makeFirmId(name) {
        const base = normalizeFirmName(name)
            .toLowerCase()
            .replace(/[^a-z0-9а-яё]+/gi, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 24);
        return `firm_${base || randomInt(1000, 9999)}`;
    }

    function memberLevel(row) {
        return levelFromXp(normalizeXp(row?.xp));
    }

    async function ensureSchema() {
        const firmExtraCols = [
            ["assistant_email", "TEXT DEFAULT ''"],
            ["firm_level", "INTEGER DEFAULT 1"],
            ["rating", "INTEGER DEFAULT 0"],
            ["logo", "TEXT DEFAULT ''"],
            ["treasury", "INTEGER DEFAULT 0"],
            ["charter", "TEXT DEFAULT ''"],
            ["meta_json", "TEXT DEFAULT '{}'"]
        ];
        const cols = await allQuery("PRAGMA table_info(firms)");
        const existing = new Set(cols.map((c) => c.name));
        for (const [name, def] of firmExtraCols) {
            if (!existing.has(name)) {
                await runQuery(`ALTER TABLE firms ADD COLUMN ${name} ${def}`);
            }
        }
    }

    async function resolveUserFirm(user) {
        const firmRef = String(user?.firm || "").trim();
        if (!firmRef) return null;
        const firm =
            (await getQuery("SELECT * FROM firms WHERE id = ?", [firmRef])) ||
            (await getQuery("SELECT * FROM firms WHERE LOWER(name) = LOWER(?)", [firmRef]));
        if (!firm) {
            if (user?.email) {
                await runQuery("UPDATE users SET firm = '' WHERE email = ?", [normalizeEmail(user.email)]);
                user.firm = "";
            }
            return null;
        }
        if (user.firm !== firm.id && user?.email) {
            await runQuery("UPDATE users SET firm = ? WHERE email = ?", [firm.id, normalizeEmail(user.email)]);
            user.firm = firm.id;
        }
        return firm;
    }

    async function listMembers(firmId) {
        return allQuery(
            `SELECT email, name, xp, reputation, club, character
             FROM users WHERE firm = ?
             ORDER BY reputation DESC, xp DESC, name ASC`,
            [firmId]
        );
    }

    function mapMemberRow(row) {
        return {
            email: row.email,
            name: row.name || "Игрок",
            level: memberLevel(row),
            reputation: row.reputation ?? 0,
            club: row.club || "",
            avatar: avatarPath(row.character)
        };
    }

    async function buildFirmPayload(firm) {
        if (!firm) return null;
        const members = await listMembers(firm.id);
        const leaderEmail = normalizeEmail(firm.leader_email);
        const assistantEmail = normalizeEmail(firm.assistant_email);
        const leader = members.find((m) => normalizeEmail(m.email) === leaderEmail);
        const assistant = assistantEmail
            ? members.find((m) => normalizeEmail(m.email) === assistantEmail)
            : null;
        const reputation = members.reduce((acc, m) => acc + Math.max(0, Number(m.reputation) || 0), 0);
        const leaderClub = leader?.club || "";
        return {
            id: firm.id,
            name: firm.name,
            leaderEmail: firm.leader_email,
            leaderName: leader?.name || "Лидер",
            leaderClub,
            leaderClubName: clubName(leaderClub),
            assistantEmail: firm.assistant_email || "",
            assistantName: assistant?.name || "",
            firmLevel: firm.firm_level ?? 1,
            rating: firm.rating ?? 0,
            logo: firm.logo || "",
            treasury: firm.treasury ?? 0,
            reputation,
            fightersCount: members.length,
            members: members.map(mapMemberRow)
        };
    }

    async function buildCatalogSummary(firm) {
        const payload = await buildFirmPayload(firm);
        if (!payload) return null;
        return {
            id: payload.id,
            name: payload.name,
            leaderEmail: payload.leaderEmail,
            leaderName: payload.leaderName,
            leaderClubName: payload.leaderClubName,
            reputation: payload.reputation,
            rating: payload.rating,
            fightersCount: payload.fightersCount,
            firmLevel: payload.firmLevel,
            logo: payload.logo
        };
    }

    async function getCatalog(queryRaw) {
        const q = normalizeFirmName(queryRaw).toLowerCase();
        const rows = q
            ? await allQuery(
                  "SELECT * FROM firms WHERE LOWER(name) LIKE ? ORDER BY created_at DESC",
                  [`%${q}%`]
              )
            : await allQuery("SELECT * FROM firms ORDER BY created_at DESC");
        const firms = [];
        for (const row of rows) {
            const summary = await buildCatalogSummary(row);
            if (summary) firms.push(summary);
        }
        return firms;
    }

    async function getCatalogFirm(firmIdRaw) {
        const firmId = String(firmIdRaw || "").trim();
        if (!firmId) return null;
        const firm = await getQuery("SELECT * FROM firms WHERE id = ?", [firmId]);
        if (!firm) return null;
        return buildFirmPayload(firm);
    }

    async function buildMyFirmHub(viewerEmail, firm) {
        const payload = await buildFirmPayload(firm);
        if (!payload) return null;
        const role = viewerRole(viewerEmail, firm);
        return {
            ...payload,
            viewerRole: role,
            viewerRankTitle: rankTitle(role),
            isLeader: role === "leader",
            isAssistant: role === "assistant",
            menu: getPublicConfig().hubMenu,
            capabilities: getPublicConfig().capabilities
        };
    }

    async function getMyFirmHub(email) {
        const user = await getQuery("SELECT * FROM users WHERE email = ?", [email]);
        if (!user) {
            return { ok: false, status: 404, error: "Пользователь не найден" };
        }
        const firm = await resolveUserFirm(user);
        if (!firm) {
            return { ok: true, hasFirm: false, config: getPublicConfig() };
        }
        const hub = await buildMyFirmHub(email, firm);
        return { ok: true, hasFirm: true, firm: hub, config: getPublicConfig() };
    }

    async function runTransaction(work) {
        await runQuery("BEGIN IMMEDIATE");
        try {
            const result = await work();
            await runQuery("COMMIT");
            return result;
        } catch (error) {
            try {
                await runQuery("ROLLBACK");
            } catch {
                /* ignore rollback errors */
            }
            throw error;
        }
    }

    async function createFirm(email, rawName) {
        const user = await getQuery("SELECT * FROM users WHERE email = ?", [email]);
        if (!user) {
            return { ok: false, status: 404, error: "Пользователь не найден" };
        }

        const level = memberLevel(user);
        if (level < FIRM_CREATE_MIN_LEVEL) {
            return { ok: false, status: 400, error: "Создать фирму можно только с 3 уровня." };
        }

        const name = normalizeFirmName(rawName);
        if (name.length < FIRM_NAME_MIN_LENGTH || name.length > FIRM_NAME_MAX_LENGTH) {
            return {
                ok: false,
                status: 400,
                error: `Название фирмы: от ${FIRM_NAME_MIN_LENGTH} до ${FIRM_NAME_MAX_LENGTH} символов.`
            };
        }

        const existingMembership = await resolveUserFirm(user);
        if (existingMembership) {
            return { ok: false, status: 400, error: "Ты уже состоишь в фирме." };
        }

        const pay = purchaseLogic.dualCurrencyPayPlan(
            user.dollars ?? 0,
            user.mushrooms ?? 0,
            FIRM_CREATE_COST_DOLLARS,
            FIRM_CREATE_COST_MUSHROOMS
        );
        if (!pay.ok) {
            return { ok: false, status: 400, error: pay.error };
        }

        const existing = await getQuery("SELECT id FROM firms WHERE LOWER(name) = LOWER(?)", [name]);
        if (existing) {
            return { ok: false, status: 409, error: "Фирма с таким названием уже существует." };
        }

        const firmId = makeFirmId(name);
        const duplicateId = await getQuery("SELECT id FROM firms WHERE id = ?", [firmId]);
        if (duplicateId) {
            return { ok: false, status: 409, error: "Не удалось сгенерировать id фирмы. Попробуй другое название." };
        }

        await runTransaction(async () => {
            await runQuery("INSERT INTO firms (id, name, leader_email, created_at) VALUES (?, ?, ?, ?)", [
                firmId,
                name,
                email,
                Date.now()
            ]);
            if (pay.payWith === "dollars") {
                await runQuery("UPDATE users SET dollars = ?, firm = ? WHERE email = ?", [
                    pay.newDollars,
                    firmId,
                    email
                ]);
            } else {
                await runQuery("UPDATE users SET mushrooms = ?, firm = ? WHERE email = ?", [
                    pay.newMushrooms,
                    firmId,
                    email
                ]);
            }
        });

        const firm = await getQuery("SELECT * FROM firms WHERE id = ?", [firmId]);
        const payload = await buildFirmPayload(firm);
        return {
            ok: true,
            firm: payload,
            payWith: pay.payWith,
            paidAmount: pay.payWith === "dollars" ? FIRM_CREATE_COST_DOLLARS : FIRM_CREATE_COST_MUSHROOMS
        };
    }

    async function joinFirm(email, firmIdRaw) {
        const firmId = String(firmIdRaw || "").trim();
        if (!firmId) {
            return { ok: false, status: 400, error: "Укажи фирму." };
        }

        const user = await getQuery("SELECT * FROM users WHERE email = ?", [email]);
        if (!user) {
            return { ok: false, status: 404, error: "Пользователь не найден" };
        }

        const currentFirm = await resolveUserFirm(user);
        if (currentFirm) {
            return { ok: false, status: 400, error: "Сначала выйди из текущей фирмы." };
        }

        const firm = await getQuery("SELECT * FROM firms WHERE id = ?", [firmId]);
        if (!firm) {
            return { ok: false, status: 404, error: "Фирма не найдена." };
        }

        await runQuery("UPDATE users SET firm = ? WHERE email = ?", [firmId, email]);
        return { ok: true, firm: await buildFirmPayload(firm) };
    }

    async function leaveFirm(email) {
        const user = await getQuery("SELECT * FROM users WHERE email = ?", [email]);
        if (!user) {
            return { ok: false, status: 404, error: "Пользователь не найден" };
        }

        const firm = await resolveUserFirm(user);
        if (!firm) {
            return { ok: false, status: 400, error: "Ты не состоишь в фирме." };
        }

        const members = await listMembers(firm.id);
        const isLeader = normalizeEmail(firm.leader_email) === email;

        await runTransaction(async () => {
            await runQuery("UPDATE users SET firm = '' WHERE email = ?", [email]);

            if (!isLeader) {
                if (normalizeEmail(firm.assistant_email) === email) {
                    await runQuery("UPDATE firms SET assistant_email = '' WHERE id = ?", [firm.id]);
                }
                return;
            }

            const remaining = members.filter((m) => normalizeEmail(m.email) !== email);
            if (!remaining.length) {
                await runQuery("DELETE FROM firms WHERE id = ?", [firm.id]);
                return;
            }

            const assistant = remaining.find(
                (m) => normalizeEmail(m.email) === normalizeEmail(firm.assistant_email)
            );
            const nextLeader = assistant || remaining[0];
            await runQuery("UPDATE firms SET leader_email = ?, assistant_email = '' WHERE id = ?", [
                normalizeEmail(nextLeader.email),
                firm.id
            ]);
        });

        return { ok: true };
    }

    async function setAssistant(email, targetEmailRaw) {
        const targetEmail = normalizeEmail(targetEmailRaw);
        if (!targetEmail) {
            return { ok: false, status: 400, error: "Укажи участника." };
        }

        const user = await getQuery("SELECT * FROM users WHERE email = ?", [email]);
        if (!user) {
            return { ok: false, status: 404, error: "Пользователь не найден" };
        }

        const firm = await resolveUserFirm(user);
        if (!firm) {
            return { ok: false, status: 400, error: "Ты не состоишь в фирме." };
        }
        if (normalizeEmail(firm.leader_email) !== email) {
            return { ok: false, status: 403, error: "Назначать помощника может только лидер." };
        }
        if (targetEmail === email) {
            return { ok: false, status: 400, error: "Лидер не может быть помощником." };
        }

        const target = await getQuery("SELECT email FROM users WHERE email = ? AND firm = ?", [
            targetEmail,
            firm.id
        ]);
        if (!target) {
            return { ok: false, status: 404, error: "Игрок не состоит в твоей фирме." };
        }

        await runQuery("UPDATE firms SET assistant_email = ? WHERE id = ?", [targetEmail, firm.id]);
        const updated = await getQuery("SELECT * FROM firms WHERE id = ?", [firm.id]);
        return { ok: true, firm: await buildFirmPayload(updated) };
    }

    return {
        getPublicConfig,
        ensureSchema,
        normalizeFirmName,
        makeFirmId,
        resolveUserFirm,
        buildFirmPayload,
        buildCatalogSummary,
        getCatalog,
        getCatalogFirm,
        buildMyFirmHub,
        getMyFirmHub,
        viewerRole,
        rankTitle,
        createFirm,
        joinFirm,
        leaveFirm,
        setAssistant
    };
}

module.exports = { createFirmsService };
