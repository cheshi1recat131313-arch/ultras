/**
 * «Счастливый час» — встроенное событие на главной (стиль Hools).
 */
(function () {
    const ICO_DOLLAR = '<img src="/static/icons/gold.svg" class="fight-reward-ico" alt="">';

    function ensureOverlay() {
        let el = document.getElementById("happyHourOverlay");
        if (el) return el;

        el = document.createElement("div");
        el.id = "happyHourOverlay";
        el.className = "hh-overlay hh-hidden";
        el.innerHTML =
            '<div class="hh-sheet" role="dialog" aria-labelledby="hhBanner">' +
            '<h2 class="hh-banner" id="hhBanner">Твой счастливый час</h2>' +
            '<p class="hh-lead" id="hhLead">Выбери одну из трёх коробок и получи приз!</p>' +
            '<div class="hh-boxes" id="hhBoxes">' +
            [0, 1, 2]
                .map(
                    (i) =>
                        `<button type="button" class="hh-box" data-box="${i}" aria-label="Коробка ${i + 1}">` +
                        '<span class="hh-crate">' +
                        '<span class="hh-crate-lid" aria-hidden="true"></span>' +
                        '<span class="hh-crate-body" aria-hidden="true"></span>' +
                        '<span class="hh-crate-prize"></span>' +
                        "</span></button>"
                )
                .join("") +
            "</div>" +
            '<div class="hh-reward hh-hidden" id="hhReward">' +
            '<p class="hh-reward-label">Твой приз</p>' +
            '<p class="hh-reward-amount" id="hhPrizeText"></p>' +
            "</div>" +
            '<button type="button" class="hh-continue hh-hidden" id="hhContinueBtn">Продолжить игру</button>' +
            "</div>";
        document.body.appendChild(el);

        el.querySelector("#hhContinueBtn").addEventListener("click", () => hideOverlay());
        el.querySelectorAll(".hh-box").forEach((btn) => {
            btn.addEventListener("click", () => onBoxPick(btn));
        });
        return el;
    }

    function hideOverlay() {
        const el = document.getElementById("happyHourOverlay");
        if (el) el.classList.add("hh-hidden");
        document.body.style.overflow = "";
    }

    function resetOverlay() {
        const el = ensureOverlay();
        const sheet = el.querySelector(".hh-sheet");
        sheet.classList.remove("hh-busy");
        el.querySelector("#hhLead").classList.remove("hh-hidden");
        el.querySelector("#hhReward").classList.add("hh-hidden");
        el.querySelector("#hhReward").classList.remove("hh-jackpot");
        el.querySelector("#hhContinueBtn").classList.add("hh-hidden");
        el.querySelectorAll(".hh-box").forEach((b) => {
            b.disabled = false;
            b.classList.remove("hh-box--open", "hh-box--muted");
            const prize = b.querySelector(".hh-crate-prize");
            if (prize) prize.innerHTML = "";
        });
    }

    function showOverlay() {
        resetOverlay();
        const el = ensureOverlay();
        document.body.style.overflow = "hidden";
        el.classList.remove("hh-hidden");
    }

    function prizeHtml(dollars, jackpot) {
        const n = Math.max(0, Math.floor(Number(dollars) || 0));
        if (jackpot) {
            return `Джекпот +${n} ${ICO_DOLLAR}`;
        }
        return `+${n} ${ICO_DOLLAR}`;
    }

    function revealPrize(data, pickedBtn) {
        const overlay = ensureOverlay();
        const sheet = overlay.querySelector(".hh-sheet");
        const prizeInner = prizeHtml(data.dollars, data.jackpot);

        if (pickedBtn) {
            const slot = pickedBtn.querySelector(".hh-crate-prize");
            if (slot) slot.innerHTML = prizeInner;
            pickedBtn.classList.add("hh-box--open");
        }

        const reward = overlay.querySelector("#hhReward");
        overlay.querySelector("#hhPrizeText").innerHTML = prizeInner;
        reward.classList.toggle("hh-jackpot", !!data.jackpot);
        reward.classList.remove("hh-hidden");
        overlay.querySelector("#hhContinueBtn").classList.remove("hh-hidden");
        sheet.classList.remove("hh-busy");

        if (data.user && typeof renderHeaderBlock === "function") {
            renderHeaderBlock(data.user);
        }
    }

    async function onBoxPick(btn) {
        const overlay = ensureOverlay();
        const email = typeof getEmail === "function" ? getEmail() : "";
        if (!email || btn.disabled) return;

        const boxIndex = Number(btn.getAttribute("data-box"));
        const sheet = overlay.querySelector(".hh-sheet");
        sheet.classList.add("hh-busy");

        overlay.querySelectorAll(".hh-box").forEach((b) => {
            b.disabled = true;
            if (b !== btn) {
                b.classList.add("hh-box--muted");
            }
        });

        const { ok, data } = await postJson("/happy-hour/open", { email, boxIndex });
        if (!ok || !data.success) {
            sheet.classList.remove("hh-busy");
            if (typeof showMsg === "function") {
                showMsg(data.error || "Не удалось открыть коробку", true);
            }
            hideOverlay();
            return;
        }

        setTimeout(() => revealPrize(data, btn), 400);
    }

    async function tryShowHappyHourOnEntry() {
        const email = typeof getEmail === "function" ? getEmail() : "";
        if (!email) return;

        try {
            const res = await fetch("/happy-hour/check?email=" + encodeURIComponent(email));
            const data = await res.json();
            if (data.success && data.show) {
                showOverlay();
            }
        } catch {
            /* ignore */
        }
    }

    window.tryShowHappyHourOnEntry = tryShowHappyHourOnEntry;
})();
