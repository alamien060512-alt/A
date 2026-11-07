import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import * as store from "./store.js";
import * as teams from "./teams.js";
import * as clues from "./clues.js";
import { colorCodeOf } from "./util.js";
import { openLeaderboard } from "./ui_admin.js";

function show(form, player, buttons) {
    form.show(player).then((res) => {
        if (res.canceled) return;
        const action = buttons[res.selection];
        if (action) action[1]();
    });
}

export function openPlayerMain(player) {
    const h = store.getActiveHunt();
    if (!h) {
        player.sendMessage("§cThere is no active treasure hunt right now. Ask an admin to set one up!");
        return;
    }
    const myTeam = teams.getPlayerTeam(h, player.name);
    if (!myTeam) {
        openJoinTeam(player, h);
        return;
    }
    openMyTeam(player, h, myTeam);
}

function openJoinTeam(player, h) {
    const list = teams.listTeams(h);
    const form = new ActionFormData().title("🏴‍☠ Join a Team").body(`Hunt: ${h.name}\nPick a team to join:`);
    const buttons = [];
    for (const t of list) {
        buttons.push([
            `${colorCodeOf(t.color)}● ${t.name}§r (${t.members.length} players)`,
            () => {
                teams.addPlayerToTeam(h, t.id, player.name);
                player.sendMessage(`§aYou joined ${t.name}!`);
                openMyTeam(player, h, t);
            },
        ]);
    }
    buttons.push(["➕ Create & Join New Team", () => promptCreateAndJoin(player, h)]);
    buttons.push(["🏆 Leaderboard", () => openLeaderboard(player, h, () => openPlayerMain(player))]);
    for (const [label] of buttons) form.button(label);
    show(form, player, buttons);
}

function promptCreateAndJoin(player, h) {
    const form = new ModalFormData().title("Create a Team").textField("Team name", `${player.name}'s Team`);
    form.show(player).then((res) => {
        if (res.canceled) return openJoinTeam(player, h);
        const [name] = res.formValues;
        const colorKey = teams.pickUnusedColor(h);
        const t = teams.createTeam(h, name && name.trim() ? name : `${player.name}'s Team`, colorKey);
        teams.addPlayerToTeam(h, t.id, player.name);
        player.sendMessage(`§aCreated and joined team "${t.name}"!`);
        openMyTeam(player, h, t);
    });
}

function openMyTeam(player, h, t) {
    const current = clues.getCurrentClue(h, t);
    let status;
    if (t.finishTime) {
        status = "§a🏆 Your team already found the treasure!";
    } else if (h.state === "running" && current) {
        status = clues.formatClueMessage(current, t.progress + 1, clues.getTeamClues(h, t).length);
    } else if (h.state === "paused") {
        status = "§eThe hunt is currently paused by an admin.";
    } else {
        status = "§7The hunt hasn't started yet. Sit tight!";
    }
    const body = `Team: ${colorCodeOf(t.color)}${t.name}§r\nMembers: ${t.members.join(", ")}\n\n${status}`;
    const form = new ActionFormData().title("My Team").body(body);
    const buttons = [
        ["📜 Show Current Clue Again", () => openMyTeam(player, h, t)],
        ["✏ Rename My Team", () => promptRenameMyTeam(player, h, t)],
        ["🏆 Leaderboard", () => openLeaderboard(player, h, () => openMyTeam(player, h, t))],
        ["🚪 Leave Team", () => confirmLeaveTeam(player, h, t)],
    ];
    for (const [label] of buttons) form.button(label);
    show(form, player, buttons);
}

function promptRenameMyTeam(player, h, t) {
    const form = new ModalFormData().title("Rename My Team").textField("New name", t.name, t.name);
    form.show(player).then((res) => {
        if (res.canceled) return openMyTeam(player, h, t);
        const [name] = res.formValues;
        teams.renameTeam(h, t.id, name && name.trim() ? name : t.name);
        openMyTeam(player, h, t);
    });
}

function confirmLeaveTeam(player, h, t) {
    const form = new MessageFormData().title("Leave Team?").body(`Leave "${t.name}"?`).button1("Cancel").button2("Leave");
    form.show(player).then((res) => {
        if (res.canceled || res.selection === 0) return openMyTeam(player, h, t);
        teams.removePlayerFromTeam(h, player.name);
        player.sendMessage(`§eYou left ${t.name}.`);
        openPlayerMain(player);
    });
}
