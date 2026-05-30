/** Ларёк — покупка; количество в user.consumables и в гардеробе. */

const LAREK_COST = {
    americano: { amount: 7, currency: "rubles" },
    hamburger: { amount: 5, currency: "rubles" },
    hotdog: { amount: 5, currency: "mushrooms" }
};

function syncLarekCounts(user) {
    const c = user.consumables || {};
    const am = document.getElementById("cnt-americano");
    const hb = document.getElementById("cnt-hamburger");
    const hd = document.getElementById("cnt-hotdog");
    if (am) am.textContent = String(c.americano ?? 0);
    if (hb) hb.textContent = String(c.hamburger ?? 0);
    if (hd) hd.textContent = String(c.hotdog ?? 0);

    document.querySelectorAll(".larek-buy").forEach((btn) => {
        const id = btn.dataset.item;
        const cost = LAREK_COST[id] || { amount: 0, currency: "rubles" };
        let can = false;
        if (cost.currency === "mushrooms") {
            can = (user.mushrooms ?? 0) >= cost.amount;
        } else {
            const rub = user.rubles ?? user.money ?? 0;
            can = rub >= cost.amount;
        }
        btn.disabled = !can;
    });
}

function bindLarekBuy() {
    const root = document.getElementById("larekItems");
    if (!root) return;

    root.querySelectorAll(".larek-buy").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const itemId = btn.dataset.item;
            if (!itemId || btn.disabled) return;
            const { ok, data } = await postJson("/larek/buy", {
                email: getEmail(),
                itemId,
                qty: 1
            });
            showMsg(ok ? data.message : data.error, !ok);
            if (data.user) {
                syncLarekCounts(data.user);
                renderHeaderBlock(data.user);
            } else if (!ok) {
                const u = await fetchUser();
                if (u) syncLarekCounts(u);
            }
        });
    });
}

function initLarekPage(user) {
    syncLarekCounts(user);
    bindLarekBuy();
}
