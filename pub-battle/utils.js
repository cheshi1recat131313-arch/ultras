const crypto = require("crypto");
const clubsData = require("../clubs-data");

function normalizeEmail(email) {
    return String(email || "")
        .trim()
        .toLowerCase();
}

function newBattleId() {
    return `pb_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function clubName(id) {
    return clubsData.getClubName(id) || id || "—";
}

function roomClubIds() {
    return clubsData.listSelectableClubs().map((c) => c.id);
}

module.exports = {
    normalizeEmail,
    newBattleId,
    clubName,
    roomClubIds
};
