/**
 * Единый источник портрета районного NPC (район, бой, шмот, события).
 */

const clubCharacters = require("./club-characters");
const districtNpcTheme = require("./district-npc-theme");

function resolveFanOpponent(opponent) {
    const o = opponent && typeof opponent === "object" ? opponent : {};
    const templateId = o.templateId || o.id || null;
    if (templateId !== "fan") return o;
    return clubCharacters.normalizeDistrictFanBot(o);
}

function resolveDistrictOpponentDisplay(opponent, deps = {}) {
    const o = resolveFanOpponent(opponent);
    const botAvatarPath = typeof deps.botAvatarPath === "function" ? deps.botAvatarPath : () => null;
    const getClubAvatarTheme =
        typeof deps.getClubAvatarTheme === "function" ? deps.getClubAvatarTheme : () => null;

    const templateId = o.templateId || o.id || null;
    const isPlayer = !!o.isPlayer;
    const yellowPortrait = districtNpcTheme.usesDistrictNpcYellowPortrait(templateId);

    const themeAvatar =
        templateId && !isPlayer ? districtNpcTheme.districtNpcBotAvatar(templateId) : null;

    let avatar = themeAvatar || (o.avatar ? String(o.avatar) : null);
    if (!avatar && templateId && !isPlayer) {
        avatar = botAvatarPath(templateId) || null;
    }

    const club = o.club ? String(o.club).trim() : null;
    const name = String(o.name || o.templateName || "Бот").trim() || "Бот";
    const emoji = o.emoji || "👤";
    let avatarFill = null;
    if (districtNpcTheme.isDistrictFanNpc(templateId) && club) {
        avatarFill = getClubAvatarTheme(club)?.fill || null;
    } else if (yellowPortrait && avatar) {
        avatarFill = districtNpcTheme.DISTRICT_NPC_AVATAR_FILL;
    } else if (isPlayer && club) {
        avatarFill = getClubAvatarTheme(club)?.fill || null;
    }
    const level = o.level != null ? Math.max(1, Math.floor(Number(o.level) || 1)) : null;

    return {
        name,
        avatar,
        club: yellowPortrait && !districtNpcTheme.isDistrictFanNpc(templateId) ? null : club,
        emoji,
        avatarFill,
        templateId,
        templateName: o.templateName || null,
        isPlayer,
        level,
        isDistrictNpc: !isPlayer && (!!avatar || yellowPortrait)
    };
}

module.exports = { resolveDistrictOpponentDisplay };
