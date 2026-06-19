/**
 * Жёлтый фон районных NPC (Гопник, Районный).
 * «Чужой фан» — портрет персонажа с клубным градиентом.
 */

const DISTRICT_NPC_AVATAR_FILL = "linear-gradient(135deg, #fcc83e 0%, #f0b830 50%, #e8a820 100%)";

const DISTRICT_NPC_BOT_AVATARS = {
    boro: "/static/bots/boro.png",
    kopch: "/static/bots/kopch.png",
    gop: "/static/bots/gop.png",
    steward: "/static/bots/steward.png",
    rayon: "/static/bots/rayon.png?v=9"
};

/** Прозрачный портрет + CSS-фон — только если понадобится в будущем. */
const DISTRICT_NPC_YELLOW_PORTRAIT_IDS = new Set([]);

function districtNpcBotAvatar(templateId) {
    const id = String(templateId || "").trim();
    return DISTRICT_NPC_BOT_AVATARS[id] || null;
}

function isDistrictFanNpc(templateId) {
    return String(templateId || "").trim() === "fan";
}

function usesDistrictNpcYellowPortrait(templateId) {
    return DISTRICT_NPC_YELLOW_PORTRAIT_IDS.has(String(templateId || "").trim());
}

function isDistrictNpcBotImage(templateId) {
    const id = String(templateId || "").trim();
    return !!DISTRICT_NPC_BOT_AVATARS[id] && !usesDistrictNpcYellowPortrait(id);
}

module.exports = {
    DISTRICT_NPC_AVATAR_FILL,
    DISTRICT_NPC_BOT_AVATARS,
    DISTRICT_NPC_YELLOW_PORTRAIT_IDS,
    districtNpcBotAvatar,
    isDistrictFanNpc,
    usesDistrictNpcYellowPortrait,
    isDistrictNpcBotImage
};

