function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
}

function formatClubNum(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "0";
    return v.toLocaleString("ru-RU");
}

function stubSection(title, note) {
    return (
        '<section class="club-profile-section">' +
        '<h3 class="club-profile-section-title">' +
        esc(title) +
        "</h3>" +
        '<div class="club-profile-section-body">' +
        '<p class="club-profile-stub">' +
        esc(note || "Скоро") +
        "</p>" +
        "</div></section>"
    );
}

function renderClubProfile(club) {
    const emblemHtml = club.emblem
        ? '<img class="club-profile-emblem" src="' +
          esc(club.emblem) +
          '" width="96" height="96" alt="" loading="lazy">'
        : "";
    const desc =
        club.description ||
        "Описание клуба появится позже — здесь будет краткая история и дух сектора.";
    const fanCount = club.fanCount != null ? club.fanCount : 0;
    const totalRep =
        club.totalReputation != null ? club.totalReputation : club.rating != null ? club.rating : 0;
    const rankPos = club.rankPosition != null ? club.rankPosition : club.position != null ? club.position : "—";

    return (
        '<div class="club-profile-hero">' +
        emblemHtml +
        '<h1 class="club-profile-name">' +
        esc(club.name) +
        "</h1></div>" +
        '<div class="club-profile-stats club-profile-stats--grid">' +
        '<p class="club-profile-stat">Фанатов: <b>' +
        esc(formatClubNum(fanCount)) +
        "</b></p>" +
        '<p class="club-profile-stat">Общая репутация: <b>' +
        esc(formatClubNum(totalRep)) +
        "</b></p>" +
        '<p class="club-profile-stat">Место в рейтинге: <b>' +
        esc(String(rankPos)) +
        "</b></p></div>" +
        '<p class="club-profile-desc">' +
        esc(desc) +
        "</p>" +
        stubSection("Достижения клуба") +
        stubSection("Герой дня клуба") +
        stubSection("Лучшие бойцы клуба") +
        stubSection("История БМ")
    );
}

async function initClubProfile() {
    const root = document.getElementById("clubProfileRoot");
    if (!root) return;

    const user = await fetchUser();
    if (!user) return;
    renderHeaderBlock(user);

    const params = new URLSearchParams(window.location.search);
    const clubId = (params.get("club") || params.get("id") || "").trim();
    if (!clubId) {
        root.innerHTML =
            '<p class="dossier-row" style="padding:16px;">Клуб не указан.</p>';
        return;
    }

    try {
        const res = await fetch("/clubs/profile?club=" + encodeURIComponent(clubId));
        const data = await res.json();
        if (!res.ok || !data.success || !data.club) {
            root.innerHTML =
                '<p class="dossier-row" style="padding:16px;">' +
                esc((data && data.error) || "Клуб не найден") +
                "</p>";
            document.title = "Клуб не найден";
            return;
        }
        document.title = data.club.name || "Клуб";
        root.innerHTML = renderClubProfile(data.club);
    } catch (err) {
        console.error("club profile load error:", err);
        root.innerHTML =
            '<p class="dossier-row" style="padding:16px;">Не удалось загрузить страницу клуба.</p>';
    }
}

initClubProfile();
