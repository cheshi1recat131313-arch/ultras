const fs = require("fs");
const path = require("path");

const AVATAR_SRC = {
    tank: "/images/tank-dossier.png",
    fast: "/images/fast-dossier.png",
    balanced: "/static/personage/balanced.png",
    tough: "/static/personage/tough.png",
    redhead: "/static/personage/redhead.png",
    fighter: "/static/personage/fighter.png",
    chick: "/static/personage/chick.png",
    valk: "/static/personage/valk.png",
    shadow: "/static/personage/shadow.png",
    spark: "/static/personage/spark.png"
};

/** Без жёлтой подложки — у PNG с прозрачным фоном */
const AVATAR_IMG_CLASS = {
    fast: "img-ava-clear"
};

const chars = [
    ["tank", "Здоровяк", "Жёсткий и выносливый. Давит силой и не падает."],
    ["fast", "Шустрый", "Быстрый и дерзкий. Уходит от ударов и бьёт внезапно."],
    ["balanced", "Ровный", "Баланс силы и скорости. Универсальный боец."],
    ["valk", "Валькирия", "Идёт до конца. Не знает страха."],
    ["shadow", "Тень", "Невидимая и опасная. Атака из ниоткуда."],
    ["spark", "Искра", "Хаос и скорость. Меняет ход боя."],
    ["tough", "Крепыш", "Стойкость — главное. Тело неповальное."],
    ["redhead", "Рыжая бестия", "Рыжая шевелюра и быстрые удары."],
    ["fighter", "Бой-баба", "Бывшая тяжелоатлетка. Такую лучше не злить!"],
    ["chick", "Четкая чувиха", "Отошьёт кого угодно, а если надо — слиняет."]
];

const cards = chars
    .map(([id, title, desc]) => {
        const cls = AVATAR_IMG_CLASS[id] ? ` class="${AVATAR_IMG_CLASS[id]}"` : "";
        return `    <div class="card">
    <img src="${AVATAR_SRC[id]}" alt=""${cls}>
    <div class="info">
        <h2>${title}</h2>
        <p>${desc}</p>
        <button class="btn" type="button" data-id="${id}">Выбрать</button>
    </div>
    </div>`;
    })
    .join("\n");

const template = fs.readFileSync(path.join(__dirname, "character-template.html"), "utf8");
const html = template.replace("<!--CARDS-->", cards);

fs.writeFileSync(path.join(__dirname, "../public/character.html"), html);
console.log("OK character.html");
