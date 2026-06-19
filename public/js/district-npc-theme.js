/** Жёлтый фон районных NPC — см. district-npc-theme.js на сервере. */
const DISTRICT_NPC_AVATAR_FILL =
    "linear-gradient(135deg, #fcc83e 0%, #f0b830 50%, #e8a820 100%)";

const DISTRICT_NPC_YELLOW_PORTRAIT_IDS = new Set([]);

const DISTRICT_NPC_BOT_AVATARS = {
    boro: "/static/bots/boro.png",
    kopch: "/static/bots/kopch.png",
    gop: "/static/bots/gop.png",
    steward: "/static/bots/steward.png",
    rayon: "/static/bots/rayon.png?v=9"
};

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

function districtNpcPortraitFill(bot, clubsCatalog) {
    if (!bot) return null;
    if (bot.isPlayer && bot.club && typeof clubAvatarFill === "function") {
        return clubAvatarFill(bot.club, clubsCatalog || {});
    }
    if (isDistrictFanNpc(bot.templateId || bot.id)) {
        if (bot.club && typeof clubAvatarFill === "function") {
            return clubAvatarFill(bot.club, clubsCatalog || {});
        }
        return null;
    }
    if (usesDistrictNpcYellowPortrait(bot.templateId || bot.id)) {
        return DISTRICT_NPC_AVATAR_FILL;
    }
    return null;
}

function districtNpcPortraitSrc(bot) {
    if (!bot) return "";
    if (bot.isPlayer && bot.avatar) return String(bot.avatar).trim();
    const id = bot.templateId || bot.id;
    if (isDistrictFanNpc(id)) {
        return bot.avatar ? String(bot.avatar).trim() : "";
    }
    if (usesDistrictNpcYellowPortrait(id)) {
        return districtNpcBotAvatar(id) || "";
    }
    if (districtNpcBotAvatar(id)) {
        return districtNpcBotAvatar(id) || "";
    }
    return "";
}

