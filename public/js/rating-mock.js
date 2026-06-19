/** Временные данные рейтинга — заменить на API позже. */
const RATING_SECTIONS = [
    {
        id: "club_elite",
        title: "Элита клуба",
        hint: "Рейтинг лучших игроков клуба за последние 7 дней.",
        view: "club_elite"
    },
    {
        id: "level_best",
        title: "Лучшие на уровне",
        hint: "Игроки только вашего уровня.",
        view: "level_best"
    },
    {
        id: "top_best",
        title: "Лучшие из лучших",
        hint: "Лучшие из лучших.",
        view: "top_best"
    },
    {
        id: "records",
        title: "Рекорды",
        hint: "Рекорды игры.",
        records: [
            { label: "Макс. побед подряд в районе", value: "17", who: "Легенда_Стадиона" },
            { label: "Самая длинная серия на стадионе", value: "9", who: "Капитан_Фирмы" },
            { label: "Больше всего репутации за день", value: "420", who: "Северный_Удар" },
            { label: "Крупнейший выигрыш в лотерее", value: "3 $", who: "Фанат_1984" },
            { label: "Рекорд энергии на работе за сутки", value: "600", who: "Работяга_99" }
        ]
    },
    {
        id: "stadium_club",
        title: "Лучшие на стадионе (мой клуб)",
        hint: "Рейтинг внутри выбранного клуба.",
        columns: ["#", "Игрок", "Голы"],
        rows: [
            ["1", "Нападающий", "44"],
            ["2", "Ты", "38"],
            ["3", "Плеймейкер", "35"],
            ["4", "Вингер", "31"],
            ["5", "Дубль", "28"]
        ],
        meRow: 1
    },
    {
        id: "clubs",
        title: "Клубы",
        hint: "Рейтинг клубов по сумме репутации всех фанатов.",
        view: "clubs"
    },
    {
        id: "national_teams",
        title: "Сборные",
        hint: "Рейтинг сборных по числу игроков, репутации и силе.",
        view: "national_teams"
    },
    {
        id: "tournament",
        title: "Турнирная таблица",
        hint: "Таблица позиций клубов.",
        columns: ["#", "Клуб", "О", "В", "Н", "П"],
        rows: [
            ["1", "Зенит", "38", "12", "2", "0"],
            ["2", "Спартак", "34", "11", "1", "2"],
            ["3", "ЦСКА", "31", "10", "1", "3"],
            ["4", "Динамо", "28", "9", "1", "4"],
            ["5", "Локомотив", "25", "8", "1", "5"]
        ]
    },
    {
        id: "firms",
        title: "Фирмы",
        hint: "Рейтинг фирм.",
        columns: ["#", "Фирма", "Сила"],
        rows: [
            ["1", "Северные Медведи", "52 100"],
            ["2", "Южный Фронт", "48 900"],
            ["3", "Центральные", "45 200"],
            ["4", "Промзона", "41 800"],
            ["5", "Окраина", "39 500"]
        ]
    }
];

function getRatingSection(id) {
    return RATING_SECTIONS.find((s) => s.id === id) || null;
}

/** Краткое превью для раскрытия на главной (без лишней вёрстки). */
function getRatingPreviewLines(section, limit) {
    const max = Math.max(1, Math.floor(Number(limit) || 3));
    if (!section) return [];
    if (section.view === "clubs") {
        return [
            "Динамовцы — Рейтинг: 0",
            "Беларусы — Рейтинг: 0",
            "Горняки — Рейтинг: 0"
        ];
    }
    if (section.view === "national_teams") {
        return ["Открой раздел — живой рейтинг сборных"];
    }
    if (section.view === "club_elite") {
        return ["Открой раздел — живой рейтинг клуба за 7 дней"];
    }
    if (section.view === "top_best") {
        return ["Открой раздел — общий рейтинг всех игроков"];
    }
    if (section.view === "level_best") {
        return ["Открой раздел — рейтинг игроков вашего уровня"];
    }
    if (section.records) {
        return section.records.slice(0, max).map((r) => `${r.label}: ${r.value}`);
    }
    const cols = section.columns || [];
    const valIdx = cols.length - 1;
    return (section.rows || []).slice(0, max).map((row) => {
        const pos = row[0] || "";
        const name = row[1] || "";
        const val = row[valIdx] || "";
        return `${pos}. ${name} — ${val}`;
    });
}
