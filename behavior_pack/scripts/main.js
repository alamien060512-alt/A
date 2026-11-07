import { world, system } from "@minecraft/server";
import * as store from "./lib/store.js";
import * as teamsLib from "./lib/teams.js";
import * as cluesLib from "./lib/clues.js";
import * as huntLib from "./lib/hunt.js";
import { openAdminMain, openLeaderboard } from "./lib/ui_admin.js";
import { openPlayerMain } from "./lib/ui_player.js";
import { tickActionbars } from "./lib/actionbar.js";
import { dist3D } from "./lib/util.js";

const ADMIN_ITEM = "th:admin_baton";
const TEAM_ITEM = "th:team_compass";

world.afterEvents.itemUse.subscribe((event) => {
    const { itemStack, source } = event;
    if (itemStack.typeId === ADMIN_ITEM) {
        system.run(() => openAdminMain(source));
    } else if (itemStack.typeId === TEAM_ITEM) {
        system.run(() => openPlayerMain(source));
    }
});

world.beforeEvents.chatSend.subscribe((event) => {
    const { sender, message } = event;
    const trimmed = message.trim();
    const lower = trimmed.toLowerCase();

    if (lower === "!thadmin" || lower === "!admin") {
        event.cancel = true;
        system.run(() => openAdminMain(sender));
        return;
    }
    if (lower === "!team" || lower === "!th") {
        event.cancel = true;
        system.run(() => openPlayerMain(sender));
        return;
    }
    if (lower === "!board" || lower === "!leaderboard") {
        event.cancel = true;
        system.run(() => {
            const h = store.getActiveHunt();
            if (!h) {
                sender.sendMessage("§cNo active hunt right now.");
                return;
            }
            openLeaderboard(sender, h, () => {});
        });
        return;
    }

    const h = store.getActiveHunt();
    if (h && h.state === "running") {
        const t = teamsLib.getPlayerTeam(h, sender.name);
        if (t && !t.finishTime) {
            const clue = cluesLib.getCurrentClue(h, t);
            if (clue && cluesLib.checkRiddleAnswer(clue, trimmed)) {
                event.cancel = true;
                system.run(() => {
                    sender.sendMessage("§a✔ Correct!");
                    huntLib.advanceTeam(h, t);
                });
            }
        }
    }
});

world.afterEvents.playerSpawn.subscribe((event) => {
    if (!event.initialSpawn) return;
    const { player } = event;
    system.run(() => {
        try {
            player.sendMessage(
                "§6§lTreasure Hunt§r §7— type §e!team§7 to join a team, or §e!board§7 to see the leaderboard."
            );
        } catch (e) {
            /* ignore */
        }
    });
});

function checkProximity() {
    const h = store.getActiveHunt();
    if (!h || h.state !== "running") return;

    for (const t of teamsLib.listTeams(h)) {
        if (t.finishTime) continue;
        const clue = cluesLib.getCurrentClue(h, t);
        if (!clue || clue.type !== "location") continue;

        const target = { x: clue.x + 0.5, y: clue.y, z: clue.z + 0.5 };
        for (const player of world.getAllPlayers()) {
            if (!t.members.includes(player.name)) continue;
            if (player.dimension.id !== clue.dimensionId) continue;
            if (dist3D(player.location, target) <= clue.radius) {
                huntLib.advanceTeam(h, t);
                break;
            }
        }
    }
}

system.runInterval(() => {
    try {
        checkProximity();
    } catch (e) {
        console.warn("[TreasureHunt] proximity check error: " + e);
    }
    try {
        tickActionbars();
    } catch (e) {
        console.warn("[TreasureHunt] actionbar tick error: " + e);
    }
}, 20);

console.log("[TreasureHunt] loaded.");
