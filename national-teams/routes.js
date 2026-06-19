function registerNationalTeamsRoutes(
    app,
    { nationalTeamsService, normalizeEmail, requireExistingUser, sanitizeUser, onMainQuestEvent }
) {
    app.get("/national-teams/state", async (req, res) => {
        try {
            const email = normalizeEmail(req.query.email);
            let user = null;
            if (email) {
                user = await requireExistingUser(email);
            }
            const state = await nationalTeamsService.buildPageState(user ? email : null);
            res.json({ success: true, state });
        } catch (error) {
            console.error("national-teams/state error:", error);
            res.status(500).json({ success: false, error: "Ошибка загрузки сборных" });
        }
    });

    app.post("/national-teams/play", async (req, res) => {
        try {
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const email = normalizeEmail(body.email);
            const user = await requireExistingUser(email);
            if (!user) {
                res.status(404).json({ success: false, error: "Пользователь не найден" });
                return;
            }

            let rewardMessages = [];
            if (onMainQuestEvent) {
                const result = await onMainQuestEvent(email, "national_team_play");
                rewardMessages = (result?.messages || []).map((m) => m.message);
            }

            const updated = await requireExistingUser(email);
            res.json({
                success: true,
                user: sanitizeUser(updated),
                rewardMessages
            });
        } catch (error) {
            console.error("national-teams/play error:", error);
            res.status(500).json({ success: false, error: "Ошибка выступления за сборную" });
        }
    });

    app.post("/national-team", async (req, res) => {
        try {
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const email = normalizeEmail(body.email);
            const team = String(body.team || "").trim();

            if (!team) {
                res.status(400).json({ success: false, error: "Сборная не выбрана" });
                return;
            }

            const user = await requireExistingUser(email);
            if (!user) {
                res.status(404).json({ success: false, error: "Пользователь не найден" });
                return;
            }

            const confirmChange = Boolean(body.confirmChange);
            const onboarding = Boolean(body.onboarding);
            const out = await nationalTeamsService.selectOrChangeTeam(email, team, { confirmChange });
            if (!out.ok) {
                const status = out.needsConfirm ? 409 : 400;
                res.status(status).json({
                    success: false,
                    error: out.error,
                    needsConfirm: Boolean(out.needsConfirm),
                    cost: out.cost || null
                });
                return;
            }

            let rewardMessages = [];
            if (onMainQuestEvent && !onboarding) {
                const result = await onMainQuestEvent(email, "national_team_play");
                rewardMessages = (result?.messages || []).map((m) => m.message);
            }

            const updated = await requireExistingUser(email);
            res.json({
                success: true,
                user: sanitizeUser(updated),
                charged: out.charged || 0,
                firstChoice: Boolean(out.firstChoice),
                rewardMessages
            });
        } catch (error) {
            console.error("national-team error:", error);
            res.status(500).json({ success: false, error: "Ошибка при выборе сборной" });
        }
    });

    app.get("/rating/national-teams", async (req, res) => {
        try {
            const teams = await nationalTeamsService.buildStandings();
            res.json({ success: true, teams });
        } catch (error) {
            console.error("rating/national-teams error:", error);
            res.status(500).json({ success: false, error: "Ошибка рейтинга сборных" });
        }
    });
}

module.exports = { registerNationalTeamsRoutes };
