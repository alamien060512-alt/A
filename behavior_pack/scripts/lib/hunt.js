import { world } from "@minecraft/server";
import { save } from "./store.js";
import { listTeams } from "./teams.js";
import { formatClueMessage } from "./clues.js";
import { resetAndSync, syncTeam } from "./scoreboard.js";
import { fmtTime, colorCodeOf, broadcastChat, broadcastTitle } from "./util.js";

export function startHunt(hunt) {
    if (hunt.clues.length === 0) return { ok: false, reason: "This hunt has no clues yet." };
    if (Object.keys(hunt.teams).length === 0) return { ok: false, reason: "This hunt has no teams yet." };

    const now = Date.now();
    hunt.state = "running";
    hunt.startedAt = now;
    hunt.pauseStartedAt = null;
    hunt.pausedDuration = 0;
    for (const team of listTeams(hunt)) {
        team.progress = 0;
        team.lapTimes = [];
        team.lastAdvanceAt = now;
        team.finishTime = null;
    }
    save();
    resetAndSync(hunt);

    broadcastTitle("🏴‍☠ Treasure Hunt Started!", hunt.name);
    broadcastChat(`§6§l★ The treasure hunt "${hunt.name}" has begun! ${listTeams(hunt).length} teams are racing.`);
    for (const team of listTeams(hunt)) {
        sendClueToTeam(hunt, team);
    }
    return { ok: true };
}

export function pauseHunt(hunt) {
    if (hunt.state !== "running") return { ok: false, reason: "Hunt is not running." };
    hunt.state = "paused";
    hunt.pauseStartedAt = Date.now();
    save();
    broadcastChat(`§e⏸ The treasure hunt "${hunt.name}" has been paused by an admin.`);
    return { ok: true };
}

export function resumeHunt(hunt) {
    if (hunt.state !== "paused") return { ok: false, reason: "Hunt is not paused." };
    if (hunt.pauseStartedAt) {
        hunt.pausedDuration += Date.now() - hunt.pauseStartedAt;
        hunt.pauseStartedAt = null;
    }
    hunt.state = "running";
    save();
    broadcastChat(`§a▶ The treasure hunt "${hunt.name}" has resumed!`);
    return { ok: true };
}

export function resetProgress(hunt) {
    hunt.state = "setup";
    hunt.startedAt = null;
    hunt.pauseStartedAt = null;
    hunt.pausedDuration = 0;
    for (const team of listTeams(hunt)) {
        team.progress = 0;
        team.lapTimes = [];
        team.lastAdvanceAt = null;
        team.finishTime = null;
    }
    save();
    resetAndSync(hunt);
    return { ok: true };
}

export function getElapsed(hunt, atTime = Date.now()) {
    if (!hunt.startedAt) return 0;
    const end = hunt.state === "paused" && hunt.pauseStartedAt ? hunt.pauseStartedAt : atTime;
    return Math.max(0, end - hunt.startedAt - (hunt.pausedDuration ?? 0));
}

function sendClueToTeam(hunt, team) {
    const clue = hunt.clues[team.progress];
    if (!clue) return;
    const text = formatClueMessage(clue, team.progress + 1, hunt.clues.length);
    if (hunt.settings?.publicHints) {
        broadcastChat(`${colorCodeOf(team.color)}[${team.name}]§r\n${text}`);
    } else {
        sendToTeam(hunt, team, text);
    }
}

export function sendToTeam(hunt, team, text) {
    for (const p of world.getAllPlayers()) {
        if (team.members.includes(p.name)) {
            try {
                p.sendMessage(text);
            } catch (e) {
                /* player may be disconnecting */
            }
        }
    }
}

export function advanceTeam(hunt, team) {
    if (hunt.state !== "running") return;
    if (team.finishTime) return;

    const now = Date.now();
    const lap = now - (team.lastAdvanceAt ?? hunt.startedAt);
    team.lapTimes.push(lap);
    team.progress += 1;
    team.lastAdvanceAt = now;

    const code = colorCodeOf(team.color);
    const justFinished = team.progress >= hunt.clues.length;

    if (justFinished) {
        team.finishTime = now;
        save();
        syncTeam(team);
        const elapsed = getElapsed(hunt, now);
        broadcastTitle(`🏆 ${team.name} WINS!`, `Time: ${fmtTime(elapsed)}`);
        broadcastChat(`${code}§l★ Team ${team.name}§r${code} found the treasure! Final time: §f${fmtTime(elapsed)}`);
        if (listTeams(hunt).every((t) => t.finishTime)) {
            hunt.state = "finished";
            save();
            broadcastChat("§6§lAll teams have finished the hunt! Check the leaderboard for final standings.");
        }
    } else {
        save();
        syncTeam(team);
        broadcastChat(`${code}⚑ Team ${team.name}§r found clue #${team.progress}/${hunt.clues.length}!`);
        sendClueToTeam(hunt, team);
    }
}

export function getLeaderboardLines(hunt) {
    const teams = listTeams(hunt);
    if (teams.length === 0) return ["§7No teams have been created yet."];

    const finished = teams.filter((t) => t.finishTime).sort((a, b) => a.finishTime - b.finishTime);
    const unfinished = teams
        .filter((t) => !t.finishTime)
        .sort((a, b) => b.progress - a.progress || a.name.localeCompare(b.name));

    const medals = ["🥇", "🥈", "🥉"];
    const lines = [];
    let rank = 1;
    for (const team of finished) {
        const medal = medals[rank - 1] ?? `${rank}.`;
        const code = colorCodeOf(team.color);
        lines.push(`${medal} ${code}${team.name}§r — §aFinished§r in §f${fmtTime(team.finishTime - hunt.startedAt)}`);
        rank++;
    }
    for (const team of unfinished) {
        const medal = medals[rank - 1] ?? `${rank}.`;
        const code = colorCodeOf(team.color);
        const status = hunt.startedAt
            ? `Clue ${team.progress}/${hunt.clues.length} — §f${fmtTime(getElapsed(hunt))}§r elapsed`
            : "Not started";
        lines.push(`${medal} ${code}${team.name}§r — ${status}`);
        rank++;
    }
    return lines;
}
