import { world } from "@minecraft/server";
import * as store from "./store.js";
import * as teams from "./teams.js";
import * as clues from "./clues.js";
import { bearingTo, verticalHint, dist3D } from "./util.js";

export function tickActionbars() {
    const h = store.getActiveHunt();
    if (!h) return;

    for (const player of world.getAllPlayers()) {
        try {
            const t = teams.getPlayerTeam(h, player.name);
            if (!t) continue;

            let text;
            if (t.finishTime) {
                text = "§a🏆 Treasure found! Check the leaderboard.";
            } else if (h.state === "paused") {
                text = "§e⏸ Hunt paused";
            } else if (h.state !== "running") {
                text = "§7Waiting for the hunt to start...";
            } else {
                const clue = clues.getCurrentClue(h, t);
                if (!clue) {
                    text = "§7...";
                } else if (clue.type === "riddle") {
                    text = `§e❓ ${clue.name} — type your answer in chat`;
                } else if (clue.dimensionId !== player.dimension.id) {
                    text = `§c📍 ${clue.name} is in the ${clue.dimensionId.replace("the_", "")}`;
                } else {
                    const target = { x: clue.x + 0.5, y: clue.y, z: clue.z + 0.5 };
                    const d = dist3D(player.location, target);
                    const bearing = bearingTo(player.location, target);
                    const v = verticalHint(player.location, target);
                    text = `§e${bearing.arrow} ${bearing.label}${v} §f${Math.round(d)}m §7— ${clue.name}`;
                }
            }
            player.onScreenDisplay.setActionBar(text);
        } catch (e) {
            // player may be disconnecting, or dimension/component briefly unavailable
        }
    }
}
