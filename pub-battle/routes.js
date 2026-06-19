/**
 * HTTP-роуты «Битвы за Паб».
 */

function registerPubBattleRoutes(app, { pubBattleService, normalizeEmail, requireExistingUser, sanitizeUser }) {
    app.post("/api/pub-battle/dev/reset", async (req, res) => {
        try {
            if (!pubBattleService) {
                res.status(503).json({ success: false, error: "Сервис битвы недоступен" });
                return;
            }
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const email = normalizeEmail(body.email);
            const user = await requireExistingUser(email, { regen: true });
            if (!user) {
                res.status(404).json({ success: false, error: "Пользователь не найден" });
                return;
            }
            const out = await pubBattleService.resetForTesting();
            if (!out.ok) {
                res.status(400).json({ success: false, error: out.error });
                return;
            }
            const state = await pubBattleService.buildState(user);
            res.json({ success: true, battleId: out.battleId, state });
        } catch (error) {
            console.error("pub-battle dev reset error:", error);
            res.status(500).json({ success: false, error: "Ошибка сброса битвы" });
        }
    });

    app.get("/api/pub-battle/state", async (req, res) => {
        try {
            if (!pubBattleService) {
                res.status(503).json({ success: false, error: "Сервис битвы недоступен" });
                return;
            }
            const email = normalizeEmail(req.query.email);
            const user = await requireExistingUser(email, { regen: true });
            if (!user) {
                res.status(404).json({ success: false, error: "Пользователь не найден" });
                return;
            }
            const state = await pubBattleService.buildState(user);
            res.json({ success: true, user: sanitizeUser(user), state });
        } catch (error) {
            console.error("pub-battle state error:", error);
            res.status(500).json({ success: false, error: "Ошибка состояния битвы" });
        }
    });

    app.post("/api/pub-battle/register", async (req, res) => {
        try {
            if (!pubBattleService) {
                res.status(503).json({ success: false, error: "Сервис битвы недоступен" });
                return;
            }
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const email = normalizeEmail(body.email);
            const user = await requireExistingUser(email, { regen: true });
            if (!user) {
                res.status(404).json({ success: false, error: "Пользователь не найден" });
                return;
            }
            const out = await pubBattleService.register(user);
            if (!out.ok) {
                res.status(400).json({ success: false, error: out.error });
                return;
            }
            res.json({
                success: true,
                user: sanitizeUser(out.user),
                state: out.state
            });
        } catch (error) {
            console.error("pub-battle register error:", error);
            res.status(500).json({ success: false, error: "Ошибка записи" });
        }
    });

    app.post("/api/pub-battle/enter-room", async (req, res) => {
        try {
            if (!pubBattleService) {
                res.status(503).json({ success: false, error: "Сервис битвы недоступен" });
                return;
            }
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const email = normalizeEmail(body.email);
            const user = await requireExistingUser(email, { regen: true });
            if (!user) {
                res.status(404).json({ success: false, error: "Пользователь не найден" });
                return;
            }
            const out = await pubBattleService.enterRoom(user, body.roomIndex);
            if (!out.ok) {
                res.status(400).json({ success: false, error: out.error });
                return;
            }
            res.json({
                success: true,
                user: sanitizeUser(user),
                state: out.state,
                combat: out.combat
            });
        } catch (error) {
            console.error("pub-battle enter-room error:", error);
            res.status(500).json({ success: false, error: "Ошибка входа в комнату" });
        }
    });

    app.post("/api/pub-battle/move", async (req, res) => {
        try {
            if (!pubBattleService) {
                res.status(503).json({ success: false, error: "Сервис битвы недоступен" });
                return;
            }
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const email = normalizeEmail(body.email);
            const user = await requireExistingUser(email);
            if (!user) {
                res.status(404).json({ success: false, error: "Пользователь не найден" });
                return;
            }
            const out = await pubBattleService.moveRoom(user, body.roomIndex);
            if (!out.ok) {
                res.status(400).json({ success: false, error: out.error });
                return;
            }
            res.json({ success: true, state: out.state });
        } catch (error) {
            console.error("pub-battle move error:", error);
            res.status(500).json({ success: false, error: "Ошибка перехода" });
        }
    });

    app.post("/api/pub-battle/attack", async (req, res) => {
        try {
            if (!pubBattleService) {
                res.status(503).json({ success: false, error: "Сервис битвы недоступен" });
                return;
            }
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const email = normalizeEmail(body.email);
            const user = await requireExistingUser(email);
            if (!user) {
                res.status(404).json({ success: false, error: "Пользователь не найден" });
                return;
            }
            const out = await pubBattleService.playerStrike(
                user,
                body.targetId || body.targetEmail,
                body.attackType || "normal",
                { gadgetId: body.gadgetId }
            );
            if (!out.ok) {
                res.status(400).json({ success: false, error: out.error });
                return;
            }
            const updated = await requireExistingUser(email);
            res.json({
                success: true,
                user: sanitizeUser(updated),
                state: out.state,
                combat: out.combat,
                strikeFlash: out.strikeFlash,
                battleEnded: out.battleEnded,
                winnerClubName: out.winnerClubName
            });
        } catch (error) {
            console.error("pub-battle attack error:", error);
            res.status(500).json({ success: false, error: "Ошибка атаки" });
        }
    });

    app.get("/api/pub-battle/combat", async (req, res) => {
        try {
            if (!pubBattleService) {
                res.status(503).json({ success: false, error: "Сервис битвы недоступен" });
                return;
            }
            const email = normalizeEmail(req.query.email);
            const user = await requireExistingUser(email, { regen: true });
            if (!user) {
                res.status(404).json({ success: false, error: "Пользователь не найден" });
                return;
            }
            const out = await pubBattleService.getCombatState(user, {
                refreshOpponents: req.query.refresh === "1",
                bestPage: req.query.bestPage
            });
            if (!out.ok) {
                res.status(400).json({ success: false, error: out.error });
                return;
            }
            res.json({
                success: true,
                user: sanitizeUser(user),
                state: out.state,
                combat: out.combat
            });
        } catch (error) {
            console.error("pub-battle combat error:", error);
            res.status(500).json({ success: false, error: "Ошибка загрузки боя" });
        }
    });

    app.post("/api/pub-battle/refresh-opponents", async (req, res) => {
        try {
            if (!pubBattleService) {
                res.status(503).json({ success: false, error: "Сервис битвы недоступен" });
                return;
            }
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const email = normalizeEmail(body.email);
            const user = await requireExistingUser(email);
            if (!user) {
                res.status(404).json({ success: false, error: "Пользователь не найден" });
                return;
            }
            const out = await pubBattleService.refreshOpponents(user);
            if (!out.ok) {
                res.status(400).json({ success: false, error: out.error });
                return;
            }
            res.json({ success: true, state: out.state, combat: out.combat });
        } catch (error) {
            console.error("pub-battle refresh error:", error);
            res.status(500).json({ success: false, error: "Ошибка обновления" });
        }
    });

    app.post("/api/pub-battle/coord-chat", async (req, res) => {
        try {
            if (!pubBattleService) {
                res.status(503).json({ success: false, error: "Сервис битвы недоступен" });
                return;
            }
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const email = normalizeEmail(body.email);
            const user = await requireExistingUser(email);
            if (!user) {
                res.status(404).json({ success: false, error: "Пользователь не найден" });
                return;
            }
            const out = await pubBattleService.postCoordMessage(user, body.message);
            if (!out.ok) {
                res.status(400).json({ success: false, error: out.error });
                return;
            }
            res.json({ success: true, state: out.state, message: out.message });
        } catch (error) {
            console.error("pub-battle coord-chat error:", error);
            res.status(500).json({ success: false, error: "Ошибка чата" });
        }
    });
}

module.exports = { registerPubBattleRoutes };
