const MUSHROOM_ICO =
    '<img class="package-mush-ico" src="/static/location/base/mushrooms.png" alt="грибы">';

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatMushrooms(n) {
    return `${n} ${MUSHROOM_ICO}`;
}

function renderPackageCard(pkg) {
    const title = `Пакет «${escapeHtml(pkg.title)}»`;
    let rows =
        `<div class="package-row">` +
        `<span class="package-row-label">Стоимость:</span> ` +
        `<span class="package-row-value">${pkg.costUsdt} USDT</span>` +
        `</div>` +
        `<div class="package-row">` +
        `<span class="package-row-label">Получите:</span> ` +
        `<span class="package-row-value">${formatMushrooms(pkg.receive)}</span>` +
        `</div>`;

    if (pkg.bonus > 0) {
        rows +=
            `<div class="package-row">` +
            `<span class="package-row-label">Бонус:</span> ` +
            `<span class="package-row-value">${formatMushrooms(pkg.bonus)}</span>` +
            `</div>` +
            `<div class="package-row">` +
            `<span class="package-row-label">Всего:</span> ` +
            `<span class="package-row-value package-row-value--total">${formatMushrooms(pkg.total)}</span>` +
            `</div>`;
    }

    return (
        `<article class="package-card" data-package-id="${escapeHtml(pkg.id)}">` +
        `<img class="package-card-ico" src="/static/dealer/package.svg" alt="">` +
        `<div class="package-card-main">` +
        `<h2 class="package-card-title">${title}</h2>` +
        `<div class="package-rows">${rows}</div>` +
        `<button type="button" class="package-buy" data-package-id="${escapeHtml(pkg.id)}">Купить</button>` +
        `</div>` +
        `</article>`
    );
}

async function loadPackagesCatalog() {
    const res = await fetch("/api/dealer/packages");
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось загрузить пакеты");
    }
    return data;
}

async function requestPackageBuy(packageId) {
    const { ok, data } = await postJson("/api/dealer/packages/buy", {
        email: getEmail(),
        packageId
    });
    return { ok, data };
}

async function initMarketPackages() {
    const listEl = document.getElementById("packageList");
    const quoteEl = document.getElementById("dealerQuote");

    try {
        const data = await loadPackagesCatalog();
        if (quoteEl && data.quote) {
            quoteEl.textContent = data.quote;
        }
        const packages = data.packages || [];
        listEl.innerHTML = packages.map(renderPackageCard).join("");

        listEl.querySelectorAll(".package-buy").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const packageId = btn.dataset.packageId;
                const { ok, data } = await requestPackageBuy(packageId);
                showMsg(
                    ok ? data.message || "Платёжная система будет подключена позже." : data.error,
                    !ok
                );
            });
        });
    } catch (error) {
        listEl.innerHTML =
            '<p class="center-desc" style="padding:0 14px">Не удалось загрузить пакеты.</p>';
        showMsg(error.message || "Ошибка загрузки", true);
    }
}
