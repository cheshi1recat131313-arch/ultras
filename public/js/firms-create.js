function escapeFirmHtml(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
}

function showFirmMsg(text, ok) {
    const root = document.getElementById("firmCreateMsg");
    if (!root) return;
    root.innerHTML = `<p class="firms-msg ${ok ? "firms-msg--ok" : "firms-msg--err"}">${escapeFirmHtml(text)}</p>`;
}

function formatCreateCost(config) {
    const dollars = Number(config?.createCostDollars) || 0;
    const mushrooms = Number(config?.createCostMushrooms) || 0;
    if (dollars > 0 && mushrooms > 0) {
        return `${dollars} долларов или ${mushrooms} грибов`;
    }
    if (dollars > 0) return `${dollars} долларов`;
    if (mushrooms > 0) return `${mushrooms} грибов`;
    return "бесплатно";
}

function paymentSuccessMessage(data, config) {
    if (data?.payWith === "mushrooms") {
        const amount = data.paidAmount ?? config?.createCostMushrooms ?? 0;
        return `Фирма создана. Списано ${amount} грибов.`;
    }
    const amount = data.paidAmount ?? config?.createCostDollars ?? 0;
    return `Фирма создана. Списано ${amount} долларов.`;
}

(async () => {
    const user = await fetchUser();
    if (!user) return;
    renderHeaderBlock(user);

    let config = {
        minLevel: 3,
        nameMinLength: 3,
        nameMaxLength: 32,
        createCostDollars: 100,
        createCostMushrooms: 100
    };

    try {
        const res = await fetch("/firms/config");
        const data = await res.json();
        if (data.success && data.config) config = data.config;
    } catch {
        /* fallback defaults */
    }

    const desc = document.getElementById("firmCreateDesc");
    if (desc) {
        desc.textContent = `Создание доступно с ${config.minLevel} уровня. Стоимость: ${formatCreateCost(config)}.`;
    }

    if (user.firmId || user.firm) {
        window.location.href = "/firm.html";
        return;
    }

    const form = document.getElementById("firmCreateForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if ((user.level ?? 1) < config.minLevel) {
            showFirmMsg(`Создать фирму можно только с ${config.minLevel} уровня.`, false);
            return;
        }

        const name = (document.getElementById("firmName")?.value || "").trim();
        if (!name) {
            showFirmMsg("Введи название фирмы.", false);
            return;
        }
        if (name.length < config.nameMinLength) {
            showFirmMsg(`Название фирмы: от ${config.nameMinLength} до ${config.nameMaxLength} символов.`, false);
            return;
        }

        const { ok, data } = await postJson("/firms/create", { email: user.email, name });
        if (!ok) {
            showFirmMsg(data?.error || "Не удалось создать фирму.", false);
            return;
        }

        if (data.user) renderHeaderBlock(data.user);
        showFirmMsg(paymentSuccessMessage(data, data.config || config), true);
        setTimeout(() => {
            window.location.href = "/firm.html";
        }, 500);
    });
})();
