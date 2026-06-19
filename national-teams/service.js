const teamsData = require("./data");
const { NATIONAL_TEAM_CHANGE_COST } = require("./config");

function createNationalTeamsService({ runQuery, getQuery, allQuery, getEffectiveStats }) {
    async function getUserTeamRow(email) {
        return getQuery("SELECT national_team, club, mushrooms FROM users WHERE email = ?", [email]);
    }

    async function getUserTeamId(email) {
        const row = await getUserTeamRow(email);
        const id = row && row.national_team ? String(row.national_team).trim() : "";
        return id || null;
    }

    async function selectOrChangeTeam(email, teamId, { confirmChange = false } = {}) {
        if (!teamsData.isValidTeam(teamId)) {
            return { ok: false, error: "Неизвестная сборная" };
        }

        const row = await getUserTeamRow(email);
        if (!row) {
            return { ok: false, error: "Пользователь не найден" };
        }

        const existing = row.national_team ? String(row.national_team).trim() : "";
        if (existing === teamId) {
            return { ok: false, error: "Эта сборная уже выбрана" };
        }

        if (!existing) {
            await runQuery("UPDATE users SET national_team = ? WHERE email = ?", [teamId, email]);
            return { ok: true, teamId, charged: 0, firstChoice: true };
        }

        if (!confirmChange) {
            return {
                ok: false,
                needsConfirm: true,
                cost: NATIONAL_TEAM_CHANGE_COST,
                error: `Смена сборной стоит ${NATIONAL_TEAM_CHANGE_COST} грибов. Продолжить?`
            };
        }

        const mushrooms = Math.max(0, Math.floor(Number(row.mushrooms) || 0));
        if (mushrooms < NATIONAL_TEAM_CHANGE_COST) {
            return {
                ok: false,
                error: `Недостаточно грибов. Нужно ${NATIONAL_TEAM_CHANGE_COST}, у тебя ${mushrooms}.`
            };
        }

        await runQuery("UPDATE users SET national_team = ?, mushrooms = ? WHERE email = ?", [
            teamId,
            mushrooms - NATIONAL_TEAM_CHANGE_COST,
            email
        ]);
        return { ok: true, teamId, charged: NATIONAL_TEAM_CHANGE_COST, firstChoice: false };
    }

    function playerPowerFromRow(row) {
        if (!row) return 0;
        if (typeof getEffectiveStats === "function") {
            const { effective } = getEffectiveStats(row);
            return (effective.power || 0) + (effective.speed || 0) + (effective.intel || 0) + (effective.stamina || 0);
        }
        return (
            (Number(row.power) || 0) +
            (Number(row.speed) || 0) +
            (Number(row.intel) || 0) +
            (Number(row.stamina) || 0)
        );
    }

    async function buildStandings() {
        const rows = await allQuery(
            `SELECT national_team, reputation, power, speed, intel, stamina,
                    gear_upgrades, tattoos, equipment
             FROM users
             WHERE national_team IS NOT NULL AND TRIM(national_team) != ''`
        );

        const agg = {};
        for (const row of rows) {
            const id = String(row.national_team || "").trim();
            if (!teamsData.isValidTeam(id)) continue;
            if (!agg[id]) {
                agg[id] = { players: 0, totalReputation: 0, totalPower: 0 };
            }
            agg[id].players += 1;
            agg[id].totalReputation += Number(row.reputation) || 0;
            agg[id].totalPower += playerPowerFromRow(row);
        }

        const standings = teamsData.listTeams().map((team) => {
            const stats = agg[team.id] || { players: 0, totalReputation: 0, totalPower: 0 };
            return {
                id: team.id,
                name: team.name,
                flag: team.flag,
                players: stats.players,
                totalReputation: stats.totalReputation,
                totalPower: stats.totalPower,
                rating: stats.totalReputation
            };
        });

        standings.sort((a, b) => {
            if (b.totalReputation !== a.totalReputation) return b.totalReputation - a.totalReputation;
            if (b.totalPower !== a.totalPower) return b.totalPower - a.totalPower;
            return b.players - a.players;
        });

        return standings.map((row, index) => ({ ...row, position: index + 1 }));
    }

    async function buildPageState(email) {
        let myTeamId = null;
        let inOnboarding = false;
        let mushrooms = 0;

        if (email) {
            const row = await getUserTeamRow(email);
            if (row) {
                myTeamId = row.national_team ? String(row.national_team).trim() || null : null;
                const hasClub = !!(row.club && String(row.club).trim());
                inOnboarding = hasClub && !myTeamId;
                mushrooms = Math.max(0, Math.floor(Number(row.mushrooms) || 0));
            }
        }

        const teams = teamsData.listTeams().map((team) => ({
            ...team,
            selected: team.id === myTeamId,
            canSelect: !myTeamId || team.id !== myTeamId
        }));

        return {
            teams,
            myTeamId,
            myTeamName: myTeamId ? teamsData.getTeamName(myTeamId) : null,
            hasTeam: Boolean(myTeamId),
            inOnboarding,
            changeCost: NATIONAL_TEAM_CHANGE_COST,
            mushrooms,
            warning: inOnboarding
                ? "Первый выбор сборной бесплатный. Можно пропустить и выбрать позже."
                : myTeamId
                  ? `Смена сборной стоит ${NATIONAL_TEAM_CHANGE_COST} грибов.`
                  : "Первый выбор сборной бесплатный.",
            skipWarning:
                "Ты уверен? В дальнейшем вступление или смена сборной будет стоить 1000 грибов.",
            changeConfirmText: `Смена сборной стоит ${NATIONAL_TEAM_CHANGE_COST} грибов. Продолжить?`
        };
    }

    return {
        getUserTeamId,
        selectOrChangeTeam,
        buildStandings,
        buildPageState,
        NATIONAL_TEAM_CHANGE_COST
    };
}

module.exports = { createNationalTeamsService };
