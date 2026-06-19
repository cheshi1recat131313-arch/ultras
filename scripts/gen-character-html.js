const fs = require("fs");
const path = require("path");
const { CHARACTER_AVATAR, SELECT_SCREEN_CHARACTERS } = require("../club-characters");

const chars = [
    ["tank", "Здоровяк", "Жёсткий и выносливый. Давит силой и не падает."],
    ["fast", "Шустрый", "Быстрый и дерзкий. Уходит от ударов и бьёт внезапно."],
    ["balanced", "Ровный", "Баланс силы и скорости. Универсальный боец."],
    ["tough", "Крепыш", "Стойкость — главное. Тело неповальное."],
    ["redhead", "Рыжая бестия", "Рыжая шевелюра и быстрые удары."],
    ["fighter", "Бой-баба", "Бывшая тяжелоатлетка. Такую лучше не злить!"],
    ["chick", "Четкая чувиха", "Отошьёт кого угодно, а если надо — слиняет."]
].filter(([id]) => SELECT_SCREEN_CHARACTERS.includes(id));

const cards = chars
    .map(([id, title, desc]) => {
        return `    <div class="card">
    <img src="${CHARACTER_AVATAR[id]}" alt="">
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
