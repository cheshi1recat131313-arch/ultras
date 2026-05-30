const fs = require("fs");
const path = require("path");
const { listSelectableClubs } = require("../clubs-data");

const cards = listSelectableClubs()
    .map(
        (c) => `    <div class="card">
    <img src="${c.emblem}" alt="${c.name}">
    <div class="info">
        <h2>${c.name}</h2>
        <button class="btn" type="button" data-club="${c.id}">Выбрать</button>
    </div>
</div>`
    )
    .join("\n");

const template = fs.readFileSync(path.join(__dirname, "club-template.html"), "utf8");
const html = template.replace("<!--CARDS-->", cards);

fs.writeFileSync(path.join(__dirname, "../public/club.html"), html);
console.log("OK club.html", listSelectableClubs().length, "clubs");
