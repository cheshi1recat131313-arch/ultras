/** Сейф — хранение серебра (Перс). */

const SILVER_ICO =
    '<img class="safe-coin-ico" src="/static/location/base/ser.svg" width="16" height="16" alt="" loading="lazy">';
const GOLD_ICO =
    '<img class="safe-coin-ico safe-coin-ico--gold" src="/static/location/base/gold.png" width="16" height="16" alt="" loading="lazy">';

function escapeSafeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
}

function fmtNum(n) {
    return Math.max(0, Math.floor(Number(n) || 0)).toLocaleString("ru-RU");
}

function readAmountInput() {
    const raw = document.getElementById("safeAmountInput")?.value;
    return Math.max(0, Math.floor(Number(raw) || 0));
}

function renderSafe(safe, user) {
    const bar = document.getElementById("safeBalanceBar");
    if (bar) {
        bar.innerHTML = `Сейчас в сейфе: ${fmtNum(safe.safeBalance)} ${SILVER_ICO}`;
    }

    const levelLine = document.getElementById("safeLevelLine");
    if (levelLine) {
        levelLine.innerHTML = `<b>Уровень:</b> ${fmtNum(safe.safeLevel)}`;
    }

    const capLine = document.getElementById("safeCapacityLine");
    if (capLine) {
        capLine.innerHTML =
            `<b>Этот уровень:</b> макс. ${fmtNum(safe.capacity)} ${SILVER_ICO}`;
    }

    const nextLine = document.getElementById("safeNextLevelLine");
    if (nextLine) {
        if (safe.nextCapacity != null) {
            nextLine.innerHTML =
                `<b>Следующий уровень:</b> макс. ${fmtNum(safe.nextCapacity)} ${SILVER_ICO}`;
            nextLine.hidden = false;
        } else {
            nextLine.textContent = "Максимальный уровень достигнут.";
            nextLine.hidden = false;
        }
    }

    const costLine = document.getElementById("safeUpgradeCostLine");
    const upgradeBtn = document.getElementById("safeUpgradeBtn");
    if (costLine) {
        if (safe.canUpgrade && safe.upgradeCost != null) {
            costLine.innerHTML =
                `<b>Цена улучшения:</b> ${fmtNum(safe.upgradeCost)} ${GOLD_ICO}`;
            costLine.hidden = false;
        } else {
            costLine.hidden = true;
        }
    }
    if (upgradeBtn) {
        upgradeBtn.disabled = !safe.canUpgrade;
        upgradeBtn.textContent = safe.canUpgrade ? "Улучшить" : "Максимальный уровень";
    }

    if (user) renderHeaderBlock(user);
}

async function loadSafe(email) {
    const res = await fetch(`/pers/safe?email=${encodeURIComponent(email)}`);
    return res.json();
}

async function postSafeAction(path, email, amount) {
    const body = { email };
    if (amount != null) body.amount = amount;
    return postJson(path, body);
}

function bindSafeActions(email) {
    document.getElementById("safeDepositBtn")?.addEventListener("click", async () => {
        const amount = readAmountInput();
        const { ok, data } = await postSafeAction("/pers/safe/deposit", email, amount);
        showMsg(ok ? data?.message || "Готово." : data?.error || "Ошибка", !ok);
        if (!ok) return;
        if (data?.safe) renderSafe(data.safe, data.user);
        document.getElementById("safeAmountInput").value = "";
    });

    document.getElementById("safeWithdrawBtn")?.addEventListener("click", async () => {
        const amount = readAmountInput();
        const { ok, data } = await postSafeAction("/pers/safe/withdraw", email, amount);
        showMsg(ok ? data?.message || "Готово." : data?.error || "Ошибка", !ok);
        if (!ok) return;
        if (data?.safe) renderSafe(data.safe, data.user);
        document.getElementById("safeAmountInput").value = "";
    });

    document.getElementById("safeUpgradeBtn")?.addEventListener("click", async () => {
        const btn = document.getElementById("safeUpgradeBtn");
        if (btn?.disabled) return;
        btn.disabled = true;
        const { ok, data } = await postSafeAction("/pers/safe/upgrade", email);
        showMsg(ok ? data?.message || "Сейф улучшен." : data?.error || "Ошибка", !ok);
        if (data?.safe) renderSafe(data.safe, data.user);
        else if (btn) btn.disabled = false;
    });
}

(async () => {
    const user = await fetchUser();
    if (!user) return;
    renderHeaderBlock(user);

    try {
        const data = await loadSafe(user.email);
        if (!data.success) {
            showMsg(data.error || "Ошибка загрузки", true);
            return;
        }
        renderSafe(data.safe, data.user);
        bindSafeActions(user.email);
    } catch (e) {
        showMsg(escapeSafeHtml(e.message), true);
    }
})();
