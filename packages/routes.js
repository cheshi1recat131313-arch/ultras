function registerPackagesRoutes(app, { packagesService, normalizeEmail, requireExistingUser }) {
    app.get("/api/dealer/packages", (_req, res) => {
        res.json({
            success: true,
            packages: packagesService.getCatalog(),
            quote:
                "Не спрашивай, откуда товар. Если нужны грибы — у меня найдётся нужный пакет. 😄"
        });
    });

    app.post("/api/dealer/packages/buy", async (req, res) => {
        try {
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const email = normalizeEmail(body.email);
            const packageId = String(body.packageId || "").trim();

            const user = await requireExistingUser(email);
            if (!user) {
                res.status(404).json({ success: false, error: "Пользователь не найден" });
                return;
            }

            const out = packagesService.requestPurchase(packageId);
            if (!out.ok) {
                res.status(400).json({ success: false, error: out.error });
                return;
            }

            res.json({
                success: true,
                stub: true,
                message: out.message,
                packageId
            });
        } catch (error) {
            console.error("dealer packages buy error:", error);
            res.status(500).json({ success: false, error: "Ошибка сервера" });
        }
    });
}

module.exports = { registerPackagesRoutes };
