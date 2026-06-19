/**
 * «Счастливый час» — блок на главной (стиль Hools).
 */
(function () {
    const HH_BOX_SRC = "/images/happy-hour-box.png";
    const HH_DOLLAR_ICO = "/static/location/base/gold.png";

    function prizeLine(dollars) {
        const n = Math.abs(Math.floor(Number(dollars) || 0));
        return (
            '<span class="hh-prize-value">' +
            `<span class="hh-prize-num">${n}</span>` +
            `<img src="${HH_DOLLAR_ICO}" class="hh-prize-ico" alt="$" loading="lazy">` +
            "</span>"
        );
    }

    function buildBlockHtml() {
        return (
            '<section class="hh-block" aria-labelledby="hhTitle">' +
            '<div class="hh-panel" id="hhPanel">' +
            '<h2 class="hh-title" id="hhTitle">Твой счастливый час!</h2>' +
            '<p class="hh-text" id="hhText">Выбери одну из трёх коробок и получи приз!</p>' +
            '<div class="hh-boxes" id="hhBoxes">' +
            [0, 1, 2]
                .map(
                    (i) =>
                        `<button type="button" class="hh-gift" data-box="${i}" aria-label="Коробка ${i + 1}">` +
                        '<span class="hh-gift-inner">' +
                        `<img class="hh-gift-img" src="${HH_BOX_SRC}" width="256" height="256" alt="" loading="lazy">` +
                        "</span></button>"
                )
                .join("") +
            "</div>" +
            '<div class="hh-result hh-hidden" id="hhResult">' +
            '<p class="hh-found">Ты нашёл:</p>' +
            '<p class="hh-prize" id="hhPrizeText"></p>' +
            "</div>" +
            "</div></section>"
        );
    }

    function hideBlock() {
        const root = document.getElementById("happyHourRoot");
        if (!root) return;
        root.classList.remove("hh-root--visible");
        root.hidden = true;
        root.innerHTML = "";
    }

    function showBlock() {
        const root = document.getElementById("happyHourRoot");
        if (!root) return;
        root.innerHTML = buildBlockHtml();
        root.hidden = false;
        root.classList.add("hh-root--visible");

        root.querySelectorAll(".hh-gift").forEach((btn) => {
            btn.addEventListener("click", () => onBoxPick(btn));
        });
    }

    function revealPrize(data, pickedBtn) {
        const panel = document.getElementById("hhPanel");
        const result = document.getElementById("hhResult");
        const prizeEl = document.getElementById("hhPrizeText");
        if (!panel || !result || !prizeEl) return;

        if (pickedBtn) {
            pickedBtn.classList.add("hh-gift--open");
        }

        panel.querySelectorAll(".hh-gift").forEach((b) => {
            if (b !== pickedBtn) {
                b.classList.add("hh-gift--gone");
            }
        });

        prizeEl.textContent = "";
        prizeEl.innerHTML = prizeLine(data.dollars);
        prizeEl.classList.toggle("hh-prize--jackpot", !!data.jackpot);
        result.classList.remove("hh-hidden");
        panel.classList.add("hh-panel--done");
        panel.classList.remove("hh-panel--busy");

        if (data.user && typeof renderHeaderBlock === "function") {
            renderHeaderBlock(data.user);
        }

        window.setTimeout(hideBlock, 4500);
    }

    async function onBoxPick(btn) {
        const email = typeof getEmail === "function" ? getEmail() : "";
        if (!email || btn.disabled) return;

        const panel = document.getElementById("hhPanel");
        if (panel) panel.classList.add("hh-panel--busy");

        const boxIndex = Number(btn.getAttribute("data-box"));
        panel.querySelectorAll(".hh-gift").forEach((b) => {
            b.disabled = true;
        });

        const { ok, data } = await postJson("/happy-hour/open", { email, boxIndex });
        if (!ok || !data.success) {
            if (panel) panel.classList.remove("hh-panel--busy");
            if (typeof showMsg === "function") {
                showMsg(data.error || "Не удалось открыть коробку", true);
            }
            hideBlock();
            return;
        }

        window.setTimeout(() => revealPrize(data, btn), 450);
    }

    async function tryShowHappyHourOnEntry() {
        const email = typeof getEmail === "function" ? getEmail() : "";
        if (!email) return;

        try {
            const res = await fetch("/happy-hour/check?email=" + encodeURIComponent(email));
            const data = await res.json();
            if (data.success && data.show) {
                showBlock();
            } else {
                hideBlock();
            }
        } catch {
            hideBlock();
        }
    }

    window.tryShowHappyHourOnEntry = tryShowHappyHourOnEntry;
    window.hideHappyHourBlock = hideBlock;
})();
