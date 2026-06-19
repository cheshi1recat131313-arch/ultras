/** Клиентский каталог сборных. */

let nationalTeamsCatalogCache = null;

async function loadNationalTeamsCatalog() {
    if (nationalTeamsCatalogCache) return nationalTeamsCatalogCache;
    try {
        const res = await fetch("/national-teams/catalog");
        if (!res.ok) return {};
        const data = await res.json();
        if (!data.success || !data.teams) return {};
        nationalTeamsCatalogCache = data.teams;
        return nationalTeamsCatalogCache;
    } catch {
        return {};
    }
}

function nationalTeamDisplayName(teamId, catalog) {
    if (!teamId) return null;
    const cat = catalog || nationalTeamsCatalogCache;
    if (cat && cat[teamId]) return cat[teamId].name;
    return teamId;
}

function nationalTeamFlagUrl(teamId, catalog) {
    if (!teamId) return null;
    const cat = catalog || nationalTeamsCatalogCache;
    if (cat && cat[teamId]) return cat[teamId].flag;
    return null;
}
