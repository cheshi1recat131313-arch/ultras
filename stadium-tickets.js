/**
 * Билеты стадиона — только на матчи своего клуба.
 */

const TICKET_COST = 2;

function parseTickets(raw) {
    try {
        const o = raw ? JSON.parse(raw) : {};
        return o && typeof o === "object" ? o : {};
    } catch {
        return {};
    }
}

function hasTicket(row, matchId) {
    if (!row || !matchId) return false;
    const t = parseTickets(row.stadium_tickets);
    return !!t[matchId];
}

function grantTicket(tickets, matchId) {
    const t = { ...tickets };
    t[matchId] = Date.now();
    return t;
}

module.exports = {
    TICKET_COST,
    parseTickets,
    hasTicket,
    grantTicket
};
