/** Меню почты (разделы как в Hools). */

function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
}

function renderMailMenu(sections) {
    const root = document.getElementById("mailMenu");
    if (!root) return;
    if (!sections.length) {
        root.innerHTML = '<p class="mail-empty">Разделы почты недоступны.</p>';
        return;
    }
    root.innerHTML = sections
        .map((s) => {
            const badge =
                s.unread > 0 ? `<span class="mail-badge">${s.unread}</span>` : "";
            const sub =
                !s.stub && s.total != null
                    ? `<span class="mail-section-meta">${s.total} выпусков</span>`
                    : s.stub
                      ? `<span class="mail-section-meta">скоро</span>`
                      : "";
            return (
                `<a class="item mail-section-item" href="${escapeHtml(s.href)}">` +
                `<img class="mail-section-ico" src="/static/location/index/mail.png" width="18" height="18" alt="">` +
                `<span class="mail-section-label">${escapeHtml(s.label)}</span>` +
                badge +
                sub +
                `</a>`
            );
        })
        .join("");
}

(async () => {
    const user = await fetchUser();
    if (!user) return;
    renderHeaderBlock(user);
    try {
        const res = await fetch(`/api/mail/menu?email=${encodeURIComponent(user.email)}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Ошибка");
        renderMailMenu(data.sections || []);
    } catch (e) {
        const root = document.getElementById("mailMenu");
        if (root) root.innerHTML = `<p class="mail-empty">${escapeHtml(e.message)}</p>`;
    }
})();
