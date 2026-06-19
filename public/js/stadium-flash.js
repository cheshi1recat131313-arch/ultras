/** Плашки БМ (оранжевая полоса над лентой / на трибунах). */
(function (global) {
    const STORAGE_KEY = "stadiumStrikeFlash";
    let hideTimer = null;

    const STADIUM_FURY_NORMAL = 60;
    const STADIUM_FURY_STRONG = 100;

    function escapeHtml(s) {
        const d = document.createElement("div");
        d.textContent = s == null ? "" : String(s);
        return d.innerHTML;
    }

    function flashEl() {
        return document.getElementById("stadiumStrikeFlash");
    }

    function appendRepGainLine(text, flash) {
        const rep = Math.max(0, Math.floor(Number(flash?.repGain) || 0));
        if (rep < 1) return text;
        return `${text}. Получено +${rep} 👑 репутации.`;
    }

    function buildStrikeFlashText(flash) {
        if (!flash) return "";
        if (flash.error) return String(flash.error);
        if (flash.dodged) {
            return appendRepGainLine(
                `Ты ударил ${flash.targetName || "противника"}, но он увернулся`,
                flash
            );
        }
        if (flash.spring) {
            return appendRepGainLine("Сработала Пружина — удар отразился", flash);
        }
        if (flash.knockout) {
            return appendRepGainLine(
                `Ты ударил ${flash.targetName || "противника"} и добил (${flash.dmg} ❤️)`,
                flash
            );
        }
        return appendRepGainLine(
            `Ты ударил ${flash.targetName || "противника"} и снёс ${flash.dmg} ❤️`,
            flash
        );
    }

    function showStadiumFlash(text, opts) {
        opts = opts || {};
        const el = flashEl();
        if (!el || !text) return;
        el.textContent = "";
        el.innerHTML = escapeHtml(text);
        el.hidden = false;
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            el.hidden = true;
        }, opts.durationMs || 6000);
    }

    function showStrikeFlash(flash) {
        showStadiumFlash(buildStrikeFlashText(flash));
        const el = flashEl();
        if (el && !el.hidden) {
            window.scrollTo({ top: 0, behavior: "auto" });
        }
    }

    function saveStrikeFlashForRedirect(flash) {
        if (!flash) return;
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(flash));
        } catch {
            /* ignore */
        }
    }

    function consumeStrikeFlash() {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            sessionStorage.removeItem(STORAGE_KEY);
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    function furyCostForAttack(attackType) {
        return attackType === "strong" ? STADIUM_FURY_STRONG : STADIUM_FURY_NORMAL;
    }

    global.STADIUM_FURY_NORMAL = STADIUM_FURY_NORMAL;
    global.STADIUM_FURY_STRONG = STADIUM_FURY_STRONG;
    global.buildStrikeFlashText = buildStrikeFlashText;
    global.showStadiumFlash = showStadiumFlash;
    global.showStrikeFlash = showStrikeFlash;
    global.saveStrikeFlashForRedirect = saveStrikeFlashForRedirect;
    global.consumeStrikeFlash = consumeStrikeFlash;
    global.furyCostForAttack = furyCostForAttack;
})(typeof window !== "undefined" ? window : globalThis);
