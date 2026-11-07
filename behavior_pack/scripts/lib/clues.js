import { save } from "./store.js";
import { newId, cleanText, sanitizeIdentifier } from "./util.js";

export function listClues(hunt) {
    return hunt.clues;
}

export function addLocationClue(hunt, { name, hint, location, dimensionId, radius, teamId }) {
    const clue = {
        id: newId("clue"),
        type: "location",
        name: sanitizeIdentifier(name, 32),
        hint: cleanText(hint, 240),
        dimensionId,
        x: Math.floor(location.x),
        y: Math.floor(location.y),
        z: Math.floor(location.z),
        radius: Math.min(50, Math.max(1, Math.round(radius ?? 5))),
        teamId: teamId ?? null,
    };
    hunt.clues.push(clue);
    save();
    return clue;
}

export function addRiddleClue(hunt, { name, hint, answer, teamId }) {
    const clue = {
        id: newId("clue"),
        type: "riddle",
        name: sanitizeIdentifier(name, 32),
        hint: cleanText(hint, 240),
        answer: cleanText(answer, 60),
        teamId: teamId ?? null,
    };
    hunt.clues.push(clue);
    save();
    return clue;
}

export function editClue(hunt, clueId, { name, hint, answer, radius, teamId }) {
    const clue = hunt.clues.find((c) => c.id === clueId);
    if (!clue) return null;
    if (name !== undefined) clue.name = sanitizeIdentifier(name, 32);
    if (hint !== undefined) clue.hint = cleanText(hint, 240);
    if (answer !== undefined && clue.type === "riddle") clue.answer = cleanText(answer, 60);
    if (radius !== undefined && clue.type === "location") clue.radius = Math.min(50, Math.max(1, Math.round(radius)));
    if (teamId !== undefined) clue.teamId = teamId;
    save();
    return clue;
}

export function deleteClue(hunt, clueId) {
    const idx = hunt.clues.findIndex((c) => c.id === clueId);
    if (idx === -1) return false;
    hunt.clues.splice(idx, 1);
    save();
    return true;
}

export function moveClue(hunt, clueId, delta) {
    const idx = hunt.clues.findIndex((c) => c.id === clueId);
    if (idx === -1) return false;
    const target = idx + delta;
    if (target < 0 || target >= hunt.clues.length) return false;
    const [clue] = hunt.clues.splice(idx, 1);
    hunt.clues.splice(target, 0, clue);
    save();
    return true;
}

export function getClue(hunt, clueId) {
    return hunt.clues.find((c) => c.id === clueId) ?? null;
}

/** A team's own ordered path: clues made just for them, plus every shared clue, in authoring order. */
export function getTeamClues(hunt, team) {
    return hunt.clues.filter((c) => !c.teamId || c.teamId === team.id);
}

export function getCurrentClue(hunt, team) {
    return getTeamClues(hunt, team)[team.progress] ?? null;
}

export function clueScopeLabel(hunt, clue) {
    if (!clue.teamId) return "Shared";
    const team = hunt.teams[clue.teamId];
    return team ? team.name : "Unknown team (deleted)";
}

export function checkRiddleAnswer(clue, message) {
    if (!clue || clue.type !== "riddle" || !clue.answer) return false;
    return message.trim().toLowerCase() === clue.answer.trim().toLowerCase();
}

export function formatClueMessage(clue, number, total) {
    if (!clue) return "";
    const lines = [`§e§l📜 Clue ${number}/${total}: ${clue.name}`, `§f${clue.hint}`];
    if (clue.type === "riddle") {
        lines.push("§7Type your answer in chat to solve it.");
    }
    return lines.join("\n");
}
