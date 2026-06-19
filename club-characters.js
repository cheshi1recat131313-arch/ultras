/**
 * Портреты персонажей и клубные наборы для ботов (стадион, БМ, лента матча).
 * Боты не участвуют в глобальных рейтингах — только в игровых механиках матча.
 *
 * Актуальные PNG — только public/static/personage/current/ (sync-personage-current.js).
 */

const PERSONAGE_CURRENT = "/static/personage/current";

const CHARACTER_AVATAR = {
    tank: `${PERSONAGE_CURRENT}/tank.png`,
    fast: `${PERSONAGE_CURRENT}/fast.png`,
    balanced: `${PERSONAGE_CURRENT}/balanced.png`,
    tough: `${PERSONAGE_CURRENT}/tough.png`,
    redhead: `${PERSONAGE_CURRENT}/redhead.png`,
    fighter: `${PERSONAGE_CURRENT}/fighter.png`,
    chick: `${PERSONAGE_CURRENT}/chick.png`,
    valk: `${PERSONAGE_CURRENT}/valk.png`,
    shadow: `${PERSONAGE_CURRENT}/shadow.png`,
    spark: `${PERSONAGE_CURRENT}/spark.png`
};

/** Персонажи с экрана выбора — единственный пул для «Чужого фана». */
const SELECT_SCREEN_CHARACTERS = [
    "tank",
    "fast",
    "balanced",
    "tough",
    "redhead",
    "fighter",
    "chick"
];

/** Устаревшие портреты и старые пути — никогда не показывать. */
const LEGACY_CHARACTER_AVATAR_PATHS = new Set([
    "/static/personage/tough.png",
    "/static/personage/x_ac291681.jpg",
    "/static/personage/x_3c69aea4.jpg",
    "/static/personage/x_b7c1209c.jpg",
    "/static/personage/x_20f9ea90.jpg",
    "/static/personage/x_34042d44.jpg",
    "/static/personage/x_8d41c12d.jpg",
    "/static/personage/x_d87b8a96.jpg",
    "/images/tank-dossier.png",
    "/images/fast-dossier.png",
    "/images/tough-dossier.png",
    "/static/personage/balanced.png",
    "/static/personage/redhead.png",
    "/static/personage/fighter.png",
    "/static/personage/chick.png",
    "/static/personage/valk.png",
    "/static/personage/shadow.png",
    "/static/personage/spark.png"
]);

const CURRENT_CHARACTER_AVATAR_PATHS = new Set(Object.values(CHARACTER_AVATAR));

/** «Чужой фан» — только герои с экрана выбора персонажа. */
const DISTRICT_FAN_CHARACTERS = SELECT_SCREEN_CHARACTERS.slice();

/** Клубы с темой фона аватарки (clubs-data CLUB_AVATAR_THEMES). */
const DISTRICT_FAN_CLUBS = ["neva", "hark", "sparta", "dynamo", "belarus", "kharki", "parovozy", "army"];

/** Персонажи, доступные ботам каждого клуба (без чужих клубов). */
const CLUB_CHARACTERS = {
    hark: ["tough", "redhead", "balanced", "fighter", "tank", "fast", "chick"],
    dynamo: ["balanced", "fast", "spark", "valk", "shadow", "fighter"],
    sparta: ["tough", "fighter", "tank", "redhead", "shadow", "balanced"],
    army: ["tank", "tough", "shadow", "valk", "balanced"],
    neva: ["balanced", "shadow", "chick", "fast", "valk"],
    belarus: ["balanced", "tough", "redhead", "fighter", "tank"],
    kharki: ["redhead", "fighter", "fast", "chick", "spark"],
    parovozy: ["tough", "tank", "shadow", "spark", "fast"]
};

const DEFAULT_CHARACTERS = ["balanced", "tough", "fighter", "redhead"];

function normalizeClubId(clubId) {
    const id = String(clubId || "").trim();
    if (!id) return "";
    if (id === "gornyaki") return "hark";
    return id;
}

function stableIndex(seed, length) {
    if (length <= 0) return 0;
    let h = 2166136261;
    const s = String(seed ?? "");
    for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % length;
}

function charactersForClub(clubId) {
    const key = normalizeClubId(clubId);
    return CLUB_CHARACTERS[key] || DEFAULT_CHARACTERS;
}

function pickClubCharacter(clubId, seed = "") {
    const list = charactersForClub(clubId);
    return list[stableIndex(seed, list.length)];
}

function avatarPathForCharacter(characterId) {
    const id = String(characterId || "").trim() || "balanced";
    return CHARACTER_AVATAR[id] || CHARACTER_AVATAR.balanced;
}

function isLegacyCharacterAvatarPath(avatarPath) {
    const path = String(avatarPath || "").trim();
    if (!path) return true;
    if (LEGACY_CHARACTER_AVATAR_PATHS.has(path)) return true;
    return !CURRENT_CHARACTER_AVATAR_PATHS.has(path);
}

function isCurrentCharacterAvatarPath(avatarPath) {
    return !isLegacyCharacterAvatarPath(avatarPath);
}

function isDistrictFanCharacter(characterId) {
    const id = String(characterId || "").trim();
    return !!id && DISTRICT_FAN_CHARACTERS.includes(id);
}

function isDistrictFanClub(clubId) {
    const id = normalizeClubId(clubId);
    return !!id && DISTRICT_FAN_CLUBS.includes(id);
}

function avatarForClubBot(clubId, seed = "") {
    return avatarPathForCharacter(pickClubCharacter(clubId, seed));
}

/** Случайный персонаж + чужой клуб для бота «Чужой фан». */
function pickDistrictFanAppearance(viewerClub, seed = "") {
    const viewerNorm = normalizeClubId(String(viewerClub || "").trim());
    let clubs = DISTRICT_FAN_CLUBS.filter((c) => c !== viewerNorm);
    if (!clubs.length) clubs = DISTRICT_FAN_CLUBS.slice();
    const character = DISTRICT_FAN_CHARACTERS[stableIndex(`${seed}:char`, DISTRICT_FAN_CHARACTERS.length)];
    const club = clubs[stableIndex(`${seed}:club`, clubs.length)];
    return {
        character,
        club,
        avatar: avatarPathForCharacter(character)
    };
}

/** Пересобрать внешность фана (новый персонаж + новый клуб + актуальный PNG). */
function refreshDistrictFanAppearance(storedBot, seedExtra = "") {
    const club = normalizeClubId(storedBot?.club) || DISTRICT_FAN_CLUBS[0];
    const seed = `${storedBot?.name || "fan"}:${club}:${seedExtra}`;
    return pickDistrictFanAppearance(null, seed.replace(/^:/, "") || seed);
}

/** Канонический вид «Чужого фана»: только SELECT_SCREEN + current/ + клуб из пула. */
function resolveDistrictFanAppearance(storedBot, seedExtra = "") {
    const character = String(storedBot?.character || "").trim();
    const club = normalizeClubId(storedBot?.club) || null;
    const canonicalAvatar = character ? avatarPathForCharacter(character) : null;
    const storedAvatar = String(storedBot?.avatar || "").trim();

    if (
        isDistrictFanCharacter(character) &&
        isDistrictFanClub(club) &&
        storedAvatar === canonicalAvatar &&
        isCurrentCharacterAvatarPath(canonicalAvatar)
    ) {
        return {
            character,
            club,
            avatar: canonicalAvatar
        };
    }
    return refreshDistrictFanAppearance(storedBot, seedExtra);
}

/** Нормализация слота «Чужой фан» перед показом и боем. */
function normalizeDistrictFanBot(bot) {
    if (!bot) return bot;
    const id = bot.templateId || bot.id;
    if (id !== "fan") return bot;
    const resolved = resolveDistrictFanAppearance(bot, id || "fan");
    return {
        ...bot,
        character: resolved.character,
        avatar: resolved.avatar,
        club: resolved.club
    };
}

function enrichBotAvatar(bot) {
    if (!bot) return bot;
    const club = bot.club || bot.clubId;
    const seed = bot.id || bot.name || bot.club;
    const character = bot.character || pickClubCharacter(club, seed);
    return {
        ...bot,
        character,
        avatar: avatarPathForCharacter(character)
    };
}

module.exports = {
    PERSONAGE_CURRENT,
    CHARACTER_AVATAR,
    SELECT_SCREEN_CHARACTERS,
    LEGACY_CHARACTER_AVATAR_PATHS,
    DISTRICT_FAN_CHARACTERS,
    DISTRICT_FAN_CLUBS,
    CLUB_CHARACTERS,
    normalizeClubId,
    charactersForClub,
    pickClubCharacter,
    avatarPathForCharacter,
    isLegacyCharacterAvatarPath,
    isCurrentCharacterAvatarPath,
    isDistrictFanCharacter,
    isDistrictFanClub,
    avatarForClubBot,
    pickDistrictFanAppearance,
    refreshDistrictFanAppearance,
    resolveDistrictFanAppearance,
    normalizeDistrictFanBot,
    enrichBotAvatar
};
