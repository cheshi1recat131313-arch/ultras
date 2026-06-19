/** Игрок считается «активным» рефералом, если был в игре за последние 7 дней. */
const REFERRAL_ACTIVE_MS = 7 * 24 * 60 * 60 * 1000;

module.exports = { REFERRAL_ACTIVE_MS };
