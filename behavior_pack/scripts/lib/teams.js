import { save } from "./store.js";
import { newId, sanitizeIdentifier, COLORS } from "./util.js";
import { removeTeamFromScoreboard, syncTeam } from "./scoreboard.js";

export function listTeams(hunt) {
    return Object.values(hunt.teams).sort((a, b) => a.createdAt - b.createdAt);
}

export function createTeam(hunt, name, colorKey) {
    const id = newId("team");
    const color = COLORS.some((c) => c.key === colorKey) ? colorKey : pickUnusedColor(hunt);
    const team = {
        id,
        name: sanitizeIdentifier(name, 24),
        color,
        members: [],
        progress: 0,
        lapTimes: [],
        lastAdvanceAt: null,
        finishTime: null,
        createdAt: Date.now(),
    };
    hunt.teams[id] = team;
    save();
    return team;
}

export function pickUnusedColor(hunt) {
    const used = new Set(Object.values(hunt.teams).map((t) => t.color));
    const free = COLORS.find((c) => !used.has(c.key));
    return (free ?? COLORS[Object.keys(hunt.teams).length % COLORS.length]).key;
}

export function deleteTeam(hunt, teamId) {
    const team = hunt.teams[teamId];
    if (!team) return false;
    removeTeamFromScoreboard(team);
    delete hunt.teams[teamId];
    // clues made just for this team fall back to "shared" instead of silently vanishing
    for (const clue of hunt.clues) {
        if (clue.teamId === teamId) clue.teamId = null;
    }
    save();
    return true;
}

export function renameTeam(hunt, teamId, name) {
    const team = hunt.teams[teamId];
    if (!team) return;
    removeTeamFromScoreboard(team);
    team.name = sanitizeIdentifier(name, 24);
    save();
    syncTeam(team);
}

export function setTeamColor(hunt, teamId, colorKey) {
    const team = hunt.teams[teamId];
    if (!team) return;
    removeTeamFromScoreboard(team);
    team.color = colorKey;
    save();
    syncTeam(team);
}

export function getPlayerTeam(hunt, playerName) {
    return listTeams(hunt).find((t) => t.members.includes(playerName)) ?? null;
}

export function addPlayerToTeam(hunt, teamId, playerName) {
    const team = hunt.teams[teamId];
    if (!team) return false;
    for (const t of Object.values(hunt.teams)) {
        const idx = t.members.indexOf(playerName);
        if (idx !== -1) t.members.splice(idx, 1);
    }
    team.members.push(playerName);
    save();
    return true;
}

export function removePlayerFromTeam(hunt, playerName) {
    let changed = false;
    for (const t of Object.values(hunt.teams)) {
        const idx = t.members.indexOf(playerName);
        if (idx !== -1) {
            t.members.splice(idx, 1);
            changed = true;
        }
    }
    if (changed) save();
    return changed;
}
