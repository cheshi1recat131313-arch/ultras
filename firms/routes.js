function registerFirmsRoutes(app, { firmsService, normalizeEmail, requireExistingUser, sanitizeUser }) {
    app.get("/firms/config", (_req, res) => {
        res.json({ success: true, config: firmsService.getPublicConfig() });
    });

    /** Каталог всех фирм сервера (страница «Фирмы»). */
    app.get("/firms/catalog", async (req, res) => {
        try {
            const q = String(req.query.q || "").trim();
            const firms = await firmsService.getCatalog(q);
            res.json({ success: true, firms, query: q });
        } catch (error) {
            console.error("firms/catalog error:", error);
            res.status(500).json({ success: false, error: "Ошибка каталога фирм" });
        }
    });

    /** Публичная карточка фирмы из каталога. */
    app.get("/firms/catalog/:firmId", async (req, res) => {
        try {
            const firmId = String(req.params.firmId || "").trim();
            const firm = await firmsService.getCatalogFirm(firmId);
            if (!firm) {
                res.status(404).json({ success: false, error: "Фирма не найдена" });
                return;
            }
            res.json({ success: true, firm });
        } catch (error) {
            console.error("firms/catalog/:firmId error:", error);
            res.status(500).json({ success: false, error: "Ошибка карточки фирмы" });
        }
    });

    /** Личный раздел игрока (страница «Фирма»). */
    app.get("/firm/me", async (req, res) => {
        try {
            const email = normalizeEmail(req.query.email);
            const user = await requireExistingUser(email);
            if (!user) {
                res.status(404).json({ success: false, error: "Пользователь не найден" });
                return;
            }
            const result = await firmsService.getMyFirmHub(email);
            if (!result.ok) {
                res.status(result.status || 500).json({ success: false, error: result.error });
                return;
            }
            if (!result.hasFirm) {
                res.json({
                    success: true,
                    hasFirm: false,
                    user: sanitizeUser(user),
                    config: result.config
                });
                return;
            }
            res.json({
                success: true,
                hasFirm: true,
                user: sanitizeUser(user),
                firm: result.firm,
                config: result.config
            });
        } catch (error) {
            console.error("firm/me error:", error);
            res.status(500).json({ success: false, error: "Ошибка раздела «Фирма»" });
        }
    });

    app.post("/firms/create", async (req, res) => {
        try {
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const email = normalizeEmail(body.email);
            const result = await firmsService.createFirm(email, body.name);
            if (!result.ok) {
                res.status(result.status || 400).json({ success: false, error: result.error });
                return;
            }
            const updated = await requireExistingUser(email);
            res.json({
                success: true,
                user: sanitizeUser(updated),
                firm: result.firm,
                payWith: result.payWith,
                paidAmount: result.paidAmount,
                config: firmsService.getPublicConfig()
            });
        } catch (error) {
            console.error("firms/create error:", error);
            res.status(500).json({ success: false, error: "Ошибка создания фирмы" });
        }
    });

    app.post("/firms/join", async (req, res) => {
        try {
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const email = normalizeEmail(body.email);
            const result = await firmsService.joinFirm(email, body.firmId);
            if (!result.ok) {
                res.status(result.status || 400).json({ success: false, error: result.error });
                return;
            }
            const updated = await requireExistingUser(email);
            res.json({ success: true, user: sanitizeUser(updated), firm: result.firm });
        } catch (error) {
            console.error("firms/join error:", error);
            res.status(500).json({ success: false, error: "Ошибка вступления в фирму" });
        }
    });

    app.post("/firms/leave", async (req, res) => {
        try {
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const email = normalizeEmail(body.email);
            const result = await firmsService.leaveFirm(email);
            if (!result.ok) {
                res.status(result.status || 400).json({ success: false, error: result.error });
                return;
            }
            const updated = await requireExistingUser(email);
            res.json({ success: true, user: sanitizeUser(updated) });
        } catch (error) {
            console.error("firms/leave error:", error);
            res.status(500).json({ success: false, error: "Ошибка выхода из фирмы" });
        }
    });

    app.post("/firms/set-assistant", async (req, res) => {
        try {
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const email = normalizeEmail(body.email);
            const result = await firmsService.setAssistant(email, body.targetEmail);
            if (!result.ok) {
                res.status(result.status || 400).json({ success: false, error: result.error });
                return;
            }
            res.json({ success: true, firm: result.firm });
        } catch (error) {
            console.error("firms/set-assistant error:", error);
            res.status(500).json({ success: false, error: "Ошибка назначения помощника" });
        }
    });
}

module.exports = { registerFirmsRoutes };
