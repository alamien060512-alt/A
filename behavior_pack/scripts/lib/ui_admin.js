import { world } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import * as store from "./store.js";
import * as teams from "./teams.js";
import * as clues from "./clues.js";
import * as huntLib from "./hunt.js";
import { COLORS, colorCodeOf, colorLabelOf, fmtTime } from "./util.js";

export const ADMIN_TAG = "th_admin";

export function isAdmin(player) {
    return player.hasTag(ADMIN_TAG);
}

function show(form, player, buttons) {
    form.show(player).then((res) => {
        if (res.canceled) return;
        const action = buttons[res.selection];
        if (action) action[1]();
    });
}

function describeState(h) {
    switch (h.state) {
        case "setup":
            return "Not started";
        case "running":
            return `Running — ${fmtTime(huntLib.getElapsed(h))} elapsed`;
        case "paused":
            return `Paused — ${fmtTime(huntLib.getElapsed(h))} elapsed`;
        case "finished":
            return "Finished!";
        default:
            return h.state;
    }
}

function describeHuntSummary(h) {
    return `${h.name}\nStatus: ${describeState(h)}\nClues: ${h.clues.length}   Teams: ${Object.keys(h.teams).length}`;
}

export function openAdminMain(player) {
    if (!isAdmin(player)) {
        player.sendMessage("§cYou need the 'th_admin' tag to use this. Ask an operator to run: /tag " + player.name + " add th_admin");
        return;
    }
    const active = store.getActiveHunt();
    const form = new ActionFormData()
        .title("🏴‍☠ Treasure Hunt — Admin")
        .body(active ? describeHuntSummary(active) : "§7No active hunt selected yet.");

    const buttons = [["📋 Manage Hunts", () => openHuntsList(player)]];

    if (active) {
        buttons.push(["📍 Manage Clues", () => openCluesList(player, active)]);
        buttons.push(["👥 Manage Teams", () => openTeamsList(player, active)]);
        if (active.state === "setup" || active.state === "finished") {
            buttons.push(["▶ Start / Restart Hunt", () => confirmStart(player, active)]);
        } else if (active.state === "running") {
            buttons.push(["⏸ Pause Hunt", () => { huntLib.pauseHunt(active); openAdminMain(player); }]);
        } else if (active.state === "paused") {
            buttons.push(["▶ Resume Hunt", () => { huntLib.resumeHunt(active); openAdminMain(player); }]);
        }
        buttons.push(["🔄 Reset Progress", () => confirmReset(player, active)]);
        buttons.push(["🏆 Leaderboard", () => openLeaderboard(player, active, () => openAdminMain(player))]);
        buttons.push(["⚙ Settings", () => openSettings(player, active)]);
        buttons.push(["🗑 Delete This Hunt", () => confirmDeleteHunt(player, active, () => openAdminMain(player))]);
    }

    for (const [label] of buttons) form.button(label);
    show(form, player, buttons);
}

// ---------------- Hunts ----------------

function openHuntsList(player) {
    const all = store.listHunts();
    const activeId = store.getActiveHuntId();
    const form = new ActionFormData().title("📋 Manage Hunts").body(`${all.length} hunt(s) saved.`);
    const buttons = [];
    for (const h of all) {
        const mark = h.id === activeId ? "✅ " : "";
        buttons.push([`${mark}${h.name} (${h.state})`, () => openHuntDetail(player, h)]);
    }
    buttons.push(["➕ Create New Hunt", () => promptCreateHunt(player)]);
    buttons.push(["← Back", () => openAdminMain(player)]);
    for (const [label] of buttons) form.button(label);
    show(form, player, buttons);
}

function openHuntDetail(player, h) {
    const form = new ActionFormData().title(h.name).body(describeHuntSummary(h));
    const buttons = [
        ["✅ Make Active", () => { store.setActiveHunt(h.id); openAdminMain(player); }],
        ["✏ Rename", () => promptRenameHunt(player, h)],
        ["🗑 Delete", () => confirmDeleteHunt(player, h, () => openHuntsList(player))],
        ["← Back", () => openHuntsList(player)],
    ];
    for (const [label] of buttons) form.button(label);
    show(form, player, buttons);
}

function promptCreateHunt(player) {
    const form = new ModalFormData().title("Create New Hunt").textField("Hunt name", "e.g. Pirate Cove Hunt");
    form.show(player).then((res) => {
        if (res.canceled) return openHuntsList(player);
        const [name] = res.formValues;
        const trimmed = (name ?? "").trim();
        const h = store.createHunt(trimmed.length > 0 ? trimmed : "New Hunt");
        player.sendMessage(`§aCreated and activated hunt "${h.name}".`);
        openAdminMain(player);
    });
}

function promptRenameHunt(player, h) {
    const form = new ModalFormData().title("Rename Hunt").textField("New name", h.name, h.name);
    form.show(player).then((res) => {
        if (res.canceled) return openHuntDetail(player, h);
        const [name] = res.formValues;
        store.renameHunt(h, (name ?? "").trim() || h.name);
        openHuntDetail(player, h);
    });
}

function confirmDeleteHunt(player, h, onDone) {
    const form = new MessageFormData()
        .title("Delete Hunt?")
        .body(`This permanently deletes "${h.name}", its clues, teams and progress. This cannot be undone.`)
        .button1("Cancel")
        .button2("Delete");
    form.show(player).then((res) => {
        if (res.canceled || res.selection === 0) return onDone();
        store.deleteHunt(h.id);
        player.sendMessage(`§cDeleted hunt "${h.name}".`);
        openAdminMain(player);
    });
}

// ---------------- Clues ----------------

function openCluesList(player, h) {
    const form = new ActionFormData()
        .title("📍 Manage Clues — " + h.name)
        .body(h.state !== "setup" ? "§e⚠ Hunt is live — editing clues may shift team progress!" : `${h.clues.length} clue(s) in order.`);
    const buttons = [];
    h.clues.forEach((c, i) => {
        const icon = c.type === "location" ? "📍" : "❓";
        buttons.push([`${i + 1}. ${icon} ${c.name} §7[${clues.clueScopeLabel(h, c)}]`, () => openClueDetail(player, h, c)]);
    });
    buttons.push(["➕ Add Location Clue (at my position)", () => promptAddLocationClue(player, h)]);
    buttons.push(["➕ Add Riddle Clue (chat answer)", () => promptAddRiddleClue(player, h)]);
    buttons.push(["← Back", () => openAdminMain(player)]);
    for (const [label] of buttons) form.button(label);
    show(form, player, buttons);
}

function openClueDetail(player, h, c) {
    const idx = h.clues.findIndex((x) => x.id === c.id);
    const details =
        (c.type === "location"
            ? `Type: Location\nHint: ${c.hint}\nPosition: ${c.x}, ${c.y}, ${c.z} (${c.dimensionId})\nRadius: ${c.radius} blocks`
            : `Type: Riddle\nHint: ${c.hint}\nAnswer: ${c.answer}`) + `\nFor: ${clues.clueScopeLabel(h, c)}`;
    const form = new ActionFormData().title(`Clue ${idx + 1}: ${c.name}`).body(details);
    const buttons = [
        ["✏ Edit Text", () => promptEditClue(player, h, c)],
        ["⬆ Move Up", () => { clues.moveClue(h, c.id, -1); openCluesList(player, h); }],
        ["⬇ Move Down", () => { clues.moveClue(h, c.id, 1); openCluesList(player, h); }],
    ];
    if (c.type === "location") {
        buttons.push([
            "📍 Teleport Me Here",
            () => {
                try {
                    player.teleport({ x: c.x + 0.5, y: c.y, z: c.z + 0.5 }, { dimension: world.getDimension(c.dimensionId) });
                } catch (e) {
                    player.sendMessage("§cCouldn't teleport there.");
                }
                openClueDetail(player, h, c);
            },
        ]);
    }
    buttons.push(["🗑 Delete Clue", () => confirmDeleteClue(player, h, c)]);
    buttons.push(["← Back", () => openCluesList(player, h)]);
    for (const [label] of buttons) form.button(label);
    show(form, player, buttons);
}

/** Dropdown choices for "who is this clue for": Shared + every team, in matching order. */
function teamScopeChoices(h) {
    const list = teams.listTeams(h);
    const labels = ["🌐 Shared (all teams)", ...list.map((t) => `${colorCodeOf(t.color)}${t.name}`)];
    const ids = [null, ...list.map((t) => t.id)];
    return { labels, ids };
}

function promptAddLocationClue(player, h) {
    const { labels, ids } = teamScopeChoices(h);
    const form = new ModalFormData()
        .title("Add Location Clue")
        .textField("Clue name", "e.g. Old Oak Tree")
        .textField("Hint shown to the team", "e.g. Look where the river bends near the big oak...")
        .slider("Trigger radius (blocks)", 1, 30, 1, 5)
        .dropdown("Who is this clue for? (pick a team for a scattered start, Shared for everyone)", labels, 0);
    form.show(player).then((res) => {
        if (res.canceled) return openCluesList(player, h);
        const [name, hintText, radius, scopeIdx] = res.formValues;
        clues.addLocationClue(h, {
            name: name && name.trim() ? name : "Clue",
            hint: hintText ?? "",
            location: player.location,
            dimensionId: player.dimension.id,
            radius,
            teamId: ids[scopeIdx] ?? null,
        });
        player.sendMessage("§aClue added at your current location.");
        openCluesList(player, h);
    });
}

function promptAddRiddleClue(player, h) {
    const { labels, ids } = teamScopeChoices(h);
    const form = new ModalFormData()
        .title("Add Riddle Clue")
        .textField("Clue name", "e.g. The Riddle of Sands")
        .textField("Hint / riddle text", "e.g. I have cities but no houses...")
        .textField("Expected answer (not case sensitive)", "e.g. map")
        .dropdown("Who is this clue for? (pick a team for a scattered start, Shared for everyone)", labels, 0);
    form.show(player).then((res) => {
        if (res.canceled) return openCluesList(player, h);
        const [name, hintText, answer, scopeIdx] = res.formValues;
        if (!answer || answer.trim().length === 0) {
            player.sendMessage("§cAnswer cannot be empty — clue was not added.");
            return openCluesList(player, h);
        }
        clues.addRiddleClue(h, { name: name && name.trim() ? name : "Riddle", hint: hintText ?? "", answer, teamId: ids[scopeIdx] ?? null });
        player.sendMessage("§aRiddle clue added.");
        openCluesList(player, h);
    });
}

function promptEditClue(player, h, c) {
    const { labels, ids } = teamScopeChoices(h);
    const currentScopeIdx = Math.max(0, ids.indexOf(c.teamId ?? null));
    const form = new ModalFormData().title("Edit Clue").textField("Name", c.name, c.name).textField("Hint", c.hint, c.hint);
    if (c.type === "riddle") form.textField("Answer", c.answer, c.answer);
    if (c.type === "location") form.slider("Trigger radius (blocks)", 1, 30, 1, c.radius);
    form.dropdown("Who is this clue for?", labels, currentScopeIdx);
    form.show(player).then((res) => {
        if (res.canceled) return openClueDetail(player, h, c);
        const values = res.formValues;
        const patch = { name: values[0], hint: values[1] };
        let i = 2;
        if (c.type === "riddle") patch.answer = values[i++];
        if (c.type === "location") patch.radius = values[i++];
        patch.teamId = ids[values[i]] ?? null;
        clues.editClue(h, c.id, patch);
        openClueDetail(player, h, c);
    });
}

function confirmDeleteClue(player, h, c) {
    const form = new MessageFormData().title("Delete Clue?").body(`Delete clue "${c.name}"? This cannot be undone.`).button1("Cancel").button2("Delete");
    form.show(player).then((res) => {
        if (res.canceled || res.selection === 0) return openClueDetail(player, h, c);
        clues.deleteClue(h, c.id);
        player.sendMessage(`§cDeleted clue "${c.name}".`);
        openCluesList(player, h);
    });
}

// ---------------- Teams ----------------

function openTeamsList(player, h) {
    const form = new ActionFormData().title("👥 Manage Teams — " + h.name).body(`${Object.keys(h.teams).length} team(s).`);
    const buttons = [];
    for (const t of teams.listTeams(h)) {
        buttons.push([
            `${colorCodeOf(t.color)}● ${t.name}§r (${t.members.length} players) — Clue ${t.progress}/${clues.getTeamClues(h, t).length}`,
            () => openTeamDetail(player, h, t),
        ]);
    }
    buttons.push(["➕ Create Team", () => promptCreateTeam(player, h)]);
    buttons.push(["← Back", () => openAdminMain(player)]);
    for (const [label] of buttons) form.button(label);
    show(form, player, buttons);
}

function promptCreateTeam(player, h) {
    const colorNames = COLORS.map((c) => c.label);
    const form = new ModalFormData().title("Create Team").textField("Team name", "e.g. Red Raiders").dropdown("Color", colorNames, 0);
    form.show(player).then((res) => {
        if (res.canceled) return openTeamsList(player, h);
        const [name, colorIdx] = res.formValues;
        const colorKey = COLORS[colorIdx]?.key ?? "white";
        const t = teams.createTeam(h, name && name.trim() ? name : "New Team", colorKey);
        player.sendMessage(`§aCreated team "${t.name}".`);
        openTeamsList(player, h);
    });
}

function openTeamDetail(player, h, t) {
    const body =
        `Color: ${colorLabelOf(t.color)}\n` +
        `Members: ${t.members.length > 0 ? t.members.join(", ") : "(none)"}\n` +
        `Progress: Clue ${t.progress}/${clues.getTeamClues(h, t).length}` +
        (t.finishTime ? `\n§aFinished in ${fmtTime(t.finishTime - h.startedAt)}` : "");
    const form = new ActionFormData().title(t.name).body(body);
    const buttons = [
        ["✏ Rename", () => promptRenameTeam(player, h, t)],
        ["🎨 Change Color", () => promptChangeColor(player, h, t)],
        ["➕ Add / Move Player Here", () => promptAddPlayer(player, h, t)],
        ["➖ Remove Player", () => promptRemovePlayer(player, h, t)],
        ["🗑 Delete Team", () => confirmDeleteTeam(player, h, t)],
        ["← Back", () => openTeamsList(player, h)],
    ];
    for (const [label] of buttons) form.button(label);
    show(form, player, buttons);
}

function promptRenameTeam(player, h, t) {
    const form = new ModalFormData().title("Rename Team").textField("New name", t.name, t.name);
    form.show(player).then((res) => {
        if (res.canceled) return openTeamDetail(player, h, t);
        const [name] = res.formValues;
        teams.renameTeam(h, t.id, name && name.trim() ? name : t.name);
        openTeamDetail(player, h, t);
    });
}

function promptChangeColor(player, h, t) {
    const colorNames = COLORS.map((c) => c.label);
    const currentIdx = COLORS.findIndex((c) => c.key === t.color);
    const form = new ModalFormData().title("Change Color").dropdown("Color", colorNames, currentIdx >= 0 ? currentIdx : 0);
    form.show(player).then((res) => {
        if (res.canceled) return openTeamDetail(player, h, t);
        const [colorIdx] = res.formValues;
        teams.setTeamColor(h, t.id, COLORS[colorIdx]?.key ?? t.color);
        openTeamDetail(player, h, t);
    });
}

function promptAddPlayer(player, h, t) {
    const online = world.getAllPlayers().map((p) => p.name);
    if (online.length === 0) {
        player.sendMessage("§cNo players online.");
        return openTeamDetail(player, h, t);
    }
    const labels = online.map((name) => {
        const current = teams.getPlayerTeam(h, name);
        return current ? `${name}  (currently: ${current.name})` : name;
    });
    const form = new ActionFormData().title("Add Player to " + t.name).body("Select an online player:");
    labels.forEach((l) => form.button(l));
    form.button("← Back");
    form.show(player).then((res) => {
        if (res.canceled || res.selection >= online.length) return openTeamDetail(player, h, t);
        const name = online[res.selection];
        teams.addPlayerToTeam(h, t.id, name);
        player.sendMessage(`§aAdded ${name} to ${t.name}.`);
        openTeamDetail(player, h, t);
    });
}

function promptRemovePlayer(player, h, t) {
    if (t.members.length === 0) {
        player.sendMessage("§cThis team has no members.");
        return openTeamDetail(player, h, t);
    }
    const form = new ActionFormData().title("Remove Player from " + t.name).body("Select a member to remove:");
    t.members.forEach((m) => form.button(m));
    form.button("← Back");
    form.show(player).then((res) => {
        if (res.canceled || res.selection >= t.members.length) return openTeamDetail(player, h, t);
        const name = t.members[res.selection];
        teams.removePlayerFromTeam(h, name);
        player.sendMessage(`§aRemoved ${name} from ${t.name}.`);
        openTeamDetail(player, h, t);
    });
}

function confirmDeleteTeam(player, h, t) {
    const form = new MessageFormData().title("Delete Team?").body(`Delete team "${t.name}" and its progress? This cannot be undone.`).button1("Cancel").button2("Delete");
    form.show(player).then((res) => {
        if (res.canceled || res.selection === 0) return openTeamDetail(player, h, t);
        teams.deleteTeam(h, t.id);
        player.sendMessage(`§cDeleted team "${t.name}".`);
        openTeamsList(player, h);
    });
}

// ---------------- Start / Reset / Settings ----------------

function confirmStart(player, h) {
    const form = new MessageFormData()
        .title("Start Hunt?")
        .body(`Start "${h.name}"? This resets all team progress and timers, and announces to everyone.`)
        .button1("Cancel")
        .button2("Start!");
    form.show(player).then((res) => {
        if (res.canceled || res.selection === 0) return openAdminMain(player);
        const result = huntLib.startHunt(h);
        if (!result.ok) player.sendMessage("§c" + result.reason);
        openAdminMain(player);
    });
}

function confirmReset(player, h) {
    const form = new MessageFormData()
        .title("Reset Progress?")
        .body(`Reset all team progress and timers for "${h.name}"? Clues and teams are kept.`)
        .button1("Cancel")
        .button2("Reset");
    form.show(player).then((res) => {
        if (res.canceled || res.selection === 0) return openAdminMain(player);
        huntLib.resetProgress(h);
        player.sendMessage("§aProgress reset.");
        openAdminMain(player);
    });
}

function openSettings(player, h) {
    const form = new ActionFormData()
        .title("⚙ Hunt Settings")
        .body(
            h.settings.publicHints
                ? "Public hints: §aON§r — every clue hint is broadcast to all players."
                : "Public hints: §cOFF§r — each team only sees its own hints."
        );
    const buttons = [
        [h.settings.publicHints ? "Turn OFF public hints" : "Turn ON public hints", () => {
            h.settings.publicHints = !h.settings.publicHints;
            store.save();
            openSettings(player, h);
        }],
        ["← Back", () => openAdminMain(player)],
    ];
    for (const [label] of buttons) form.button(label);
    show(form, player, buttons);
}

// ---------------- Leaderboard (shared with player UI) ----------------

export function openLeaderboard(player, h, onBack) {
    const lines = huntLib.getLeaderboardLines(h);
    const header = `${h.name} — ${describeState(h)}`;
    const form = new ActionFormData().title("🏆 Leaderboard").body(header + "\n\n" + lines.join("\n"));
    form.button("← Back");
    form.show(player).then(() => {
        if (onBack) onBack();
    });
}
