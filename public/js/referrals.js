function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function renderInvitedList(invited) {
    const listEl = document.getElementById("refList");
    const emptyEl = document.getElementById("refEmpty");
    if (!listEl) return;

    const rows = Array.isArray(invited) ? invited : [];
    if (!rows.length) {
        listEl.innerHTML = "";
        if (emptyEl) emptyEl.hidden = false;
        return;
    }

    if (emptyEl) emptyEl.hidden = true;
    listEl.innerHTML = rows
        .map((row) => {
            const name = escapeHtml(row.name || "Игрок");
            const level = Math.max(1, Math.floor(Number(row.level) || 1));
            return (
                `<li class="ref-list-item">` +
                `<span class="ref-list-name">${name}</span>` +
                `<span class="ref-list-level">(уровень ${level})</span>` +
                `</li>`
            );
        })
        .join("");
}

function renderReferralStats(state) {
    const invitedEl = document.getElementById("refInvitedCount");
    const activeEl = document.getElementById("refActiveCount");
    if (invitedEl) invitedEl.textContent = String(state.invitedCount ?? 0);
    if (activeEl) activeEl.textContent = String(state.activeCount ?? 0);
}

function renderReferralLink(state) {
    const linkInput = document.getElementById("refLinkInput");
    if (linkInput) linkInput.value = state.referralLink || "";
}

async function loadReferralsState() {
    const email = getEmail();
    if (!email) return null;

    const res = await fetch(`/api/referrals/state?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось загрузить данные");
    }
    return data.state;
}

function bindCopyReferralLink() {
    const copyBtn = document.getElementById("refCopyBtn");
    const linkInput = document.getElementById("refLinkInput");
    if (!copyBtn || !linkInput || copyBtn.dataset.bound === "1") return;
    copyBtn.dataset.bound = "1";

    copyBtn.addEventListener("click", async () => {
        const text = linkInput.value;
        if (!text) return;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                linkInput.select();
                document.execCommand("copy");
            }
            showMsg("Ссылка скопирована");
        } catch {
            showMsg("Не удалось скопировать ссылку", true);
        }
    });
}

async function initMushroomsPage() {
    bindCopyReferralLink();
    try {
        const state = await loadReferralsState();
        if (!state) return;
        renderReferralLink(state);
        renderReferralStats(state);
    } catch (error) {
        showMsg(error.message || "Ошибка загрузки", true);
    }
}

async function initNotebookPage() {
    try {
        const state = await loadReferralsState();
        if (!state) return;
        renderInvitedList(state.invited);
    } catch (error) {
        showMsg(error.message || "Ошибка загрузки", true);
    }
}
