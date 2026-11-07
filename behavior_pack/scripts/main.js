import { world, system } from "@minecraft/server";
// Namespace import (not named) so a missing export/event on an older game build never crashes
// the whole script at load time -- a named import of something absent would, and did.
import * as mcServer from "@minecraft/server";
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

/** Subscribes to `emitter` only if it actually exists on this game version; otherwise warns and no-ops. */
function safeSubscribe(emitter, label, handler) {
    if (!emitter || typeof emitter.subscribe !== "function") {
        console.warn(`[TreasureHunt] "${label}" is not available on this game version -- related feature disabled.`);
        return false;
    }
    try {
        emitter.subscribe(handler);
        return true;
    } catch (e) {
        console.warn(`[TreasureHunt] failed to subscribe to "${label}": ${e}`);
        return false;
    }
}

safeSubscribe(world.afterEvents?.itemUse, "afterEvents.itemUse", (event) => {
    const { itemStack, source } = event;
    if (itemStack.typeId === ADMIN_ITEM) {
        system.run(() => openAdminMain(source));
    } else if (itemStack.typeId === TEAM_ITEM) {
        system.run(() => openPlayerMain(source));
    }
});

// Real slash commands (/th:admin etc.) need a newer game build than everyone running this
// addon may have. Feature-detect instead of statically importing the named exports: a named
// import of something the installed module doesn't have crashes the ENTIRE script at load time,
// whereas checking a property on the namespace object just evaluates to undefined.
const hasCustomCommands =
    !!mcServer.CommandPermissionLevel && !!mcServer.CustomCommandStatus && !!system.beforeEvents?.startup;

if (hasCustomCommands) {
    const CommandPermissionLevel = mcServer.CommandPermissionLevel;
    const CustomCommandStatus = mcServer.CustomCommandStatus;
    const PlayerClass = mcServer.Player;

    safeSubscribe(system.beforeEvents.startup, "beforeEvents.startup", ({ customCommandRegistry }) => {
        const base = { permissionLevel: CommandPermissionLevel.Any, cheatsRequired: false };

        const register = (name, description, handler) => {
            try {
                customCommandRegistry.registerCommand({ name, description, ...base }, handler);
            } catch (e) {
                console.warn(`[TreasureHunt] couldn't register /${name}: ${e}`);
            }
        };

        register("th:admin", "Open the Treasure Hunt admin panel.", (origin) => {
            const player = origin.sourceEntity;
            if (!(player instanceof PlayerClass)) return { status: CustomCommandStatus.Failure, message: "Players only." };
            system.run(() => openAdminMain(player));
            return { status: CustomCommandStatus.Success };
        });

        register("th:team", "Open your Treasure Hunt team menu.", (origin) => {
            const player = origin.sourceEntity;
            if (!(player instanceof PlayerClass)) return { status: CustomCommandStatus.Failure, message: "Players only." };
            system.run(() => openPlayerMain(player));
            return { status: CustomCommandStatus.Success };
        });

        register("th:board", "Show the Treasure Hunt leaderboard.", (origin) => {
            const player = origin.sourceEntity;
            if (!(player instanceof PlayerClass)) return { status: CustomCommandStatus.Failure, message: "Players only." };
            system.run(() => {
                const h = store.getActiveHunt();
                if (!h) {
                    player.sendMessage("§cNo active hunt right now.");
                    return;
                }
                openLeaderboard(player, h, () => {});
            });
            return { status: CustomCommandStatus.Success };
        });
    });
} else {
    console.warn("[TreasureHunt] Custom commands API not present on this game version -- use !thadmin / !team / !board, or the Admin Baton / Team Compass items.");
}

function handleChatText(sender, trimmed, cancel) {
    const lower = trimmed.toLowerCase();

    if (lower === "!thadmin" || lower === "!admin") {
        cancel();
        system.run(() => openAdminMain(sender));
        return;
    }
    if (lower === "!team" || lower === "!th") {
        cancel();
        system.run(() => openPlayerMain(sender));
        return;
    }
    if (lower === "!board" || lower === "!leaderboard") {
        cancel();
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
                cancel();
                system.run(() => {
                    sender.sendMessage("§a✔ Correct!");
                    huntLib.advanceTeam(h, t);
                });
            }
        }
    }
}

// Prefer the cancelable before-event (hides "!thadmin" etc. from public chat). If this game
// version doesn't have it, fall back to the non-cancelable after-event: commands/riddle answers
// still work, they just also stay visible in chat.
const usedBeforeChat = safeSubscribe(world.beforeEvents?.chatSend, "beforeEvents.chatSend", (event) => {
    handleChatText(event.sender, event.message.trim(), () => {
        event.cancel = true;
    });
});
if (!usedBeforeChat) {
    safeSubscribe(world.afterEvents?.chatSend, "afterEvents.chatSend", (event) => {
        handleChatText(event.sender, event.message.trim(), () => {});
    });
}

safeSubscribe(world.afterEvents?.playerSpawn, "afterEvents.playerSpawn", (event) => {
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
