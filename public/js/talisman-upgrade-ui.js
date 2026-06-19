/**
 * Общий UI прокачки талисманов (магазин Мага Геннадия, персонаж).
 */
(function (root) {
    function escapeTalHtml(s) {
        const d = document.createElement("div");
        d.textContent = s == null ? "" : String(s);
        return d.innerHTML;
    }

    function talismanUpgradeBlockHtml(t, options) {
        const opts = options || {};
        if (!t.owned) return "";
        const cost = Math.max(0, Math.floor(Number(t.nextUpgradeCost) || 0));
        const nextPct = t.nextEffectPercent != null ? t.nextEffectPercent : t.effectPercent;
        const flash =
            opts.flashOwned && t.id === opts.flashOwned
                ? `<p class="talisman-owned-flash" data-flash-id="${escapeTalHtml(t.id)}">Куплено навсегда</p>`
                : "";
        const badge = `<span class="talisman-owned-badge" title="Куплено навсегда">✓ навсегда</span>`;
        return (
            flash +
            `<div class="talisman-upgrade-block">` +
            `<p class="talisman-meta talisman-upgrade-meta"><b>Уровень:</b> ${t.level} · <b>Эффект:</b> ${t.effectPercent}%</p>` +
            `<p class="talisman-upgrade-cost">Следующее улучшение: <b>${cost}</b> <img class="talisman-price-ico" src="/static/location/base/gold.png" alt="$"></p>` +
            `<p class="talisman-upgrade-next">После улучшения: <b>${nextPct}%</b></p>` +
            `<div class="talisman-actions">` +
            `<button type="button" class="talisman-upgrade-btn" data-id="${escapeTalHtml(t.id)}">Улучшить</button>` +
            `<button type="button" class="talisman-buy-btn talisman-desc-btn" data-id="${escapeTalHtml(t.id)}">Описание</button>` +
            `</div>` +
            badge +
            `</div>`
        );
    }

    function scheduleOwnedFlashHide(root, delayMs) {
        const ms = Math.max(3000, Math.min(5000, Number(delayMs) || 4000));
        root?.querySelectorAll(".talisman-owned-flash").forEach((el) => {
            window.setTimeout(() => {
                el.classList.add("talisman-owned-flash--hide");
                window.setTimeout(() => el.remove(), 400);
            }, ms);
        });
    }

    function bindTalismanUpgradeButtons(root, list, callbacks) {
        const cbs = callbacks || {};
        root?.querySelectorAll(".talisman-upgrade-btn").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const talismanId = btn.getAttribute("data-id") || btn.closest(".talisman-card")?.getAttribute("data-id");
                if (!talismanId || typeof getEmail !== "function" || typeof postJson !== "function") return;
                btn.disabled = true;
                const { ok, data } = await postJson("/mag/talismans/upgrade", {
                    email: getEmail(),
                    talismanId
                });
                btn.disabled = false;
                if (!ok) {
                    if (typeof showMsg === "function") {
                        showMsg(data?.error || "Не удалось улучшить талисман.", true);
                    }
                    return;
                }
                if (typeof renderHeaderBlock === "function" && data.user) {
                    renderHeaderBlock(data.user);
                }
                if (typeof cbs.onUpgraded === "function") {
                    cbs.onUpgraded(data, talismanId);
                }
                const tal = (data.talismans || list || []).find((item) => item?.id === talismanId);
                if (typeof showMsg === "function") {
                    showMsg(
                        tal
                            ? `${tal.name}: уровень ${tal.level}, эффект ${tal.effectPercent}%.`
                            : "Талисман улучшен.",
                        false
                    );
                }
            });
        });
    }

    root.TalismanUpgradeUi = {
        escapeTalHtml,
        talismanUpgradeBlockHtml,
        scheduleOwnedFlashHide,
        bindTalismanUpgradeButtons
    };
})(typeof globalThis !== "undefined" ? globalThis : this);
