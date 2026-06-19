function registerReferralsRoutes(app, { referralsService, normalizeEmail, requireExistingUser }) {
    app.get("/api/referrals/state", async (req, res) => {
        try {
            const email = normalizeEmail(req.query.email);
            const user = await requireExistingUser(email);
            if (!user) {
                res.status(404).json({ success: false, error: "Пользователь не найден" });
                return;
            }

            const state = await referralsService.getStateForUser(user, req);
            if (state.error) {
                res.status(500).json({ success: false, error: state.error });
                return;
            }

            res.json({ success: true, state });
        } catch (error) {
            console.error("Referrals state error:", error);
            res.status(500).json({ success: false, error: "Ошибка загрузки рефералов" });
        }
    });
}

module.exports = { registerReferralsRoutes };
