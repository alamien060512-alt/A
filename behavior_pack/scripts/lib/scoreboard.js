import { runCmd, colorCodeOf, sanitizeIdentifier } from "./util.js";

const OBJECTIVE_ID = "th_progress";

function identity(team) {
    return `${colorCodeOf(team.color)}${sanitizeIdentifier(team.name, 24)}`;
}

export async function ensureObjective() {
    await runCmd(`scoreboard objectives add ${OBJECTIVE_ID} dummy "Treasure Hunt"`);
    await runCmd(`scoreboard objectives setdisplay sidebar ${OBJECTIVE_ID}`);
}

export async function clearObjective() {
    await runCmd(`scoreboard objectives remove ${OBJECTIVE_ID}`);
}

export async function syncTeam(team) {
    await ensureObjective();
    await runCmd(`scoreboard players set "${identity(team)}" ${OBJECTIVE_ID} ${team.progress}`);
}

export async function removeTeamFromScoreboard(team) {
    await runCmd(`scoreboard players reset "${identity(team)}" ${OBJECTIVE_ID}`);
}

export async function resetAndSync(hunt) {
    await clearObjective();
    await ensureObjective();
    for (const team of Object.values(hunt.teams)) {
        await runCmd(`scoreboard players set "${identity(team)}" ${OBJECTIVE_ID} ${team.progress}`);
    }
}
