import { world } from "@minecraft/server";

export const COLORS = [
    { key: "red", code: "§c", label: "Red" },
    { key: "blue", code: "§9", label: "Blue" },
    { key: "green", code: "§a", label: "Green" },
    { key: "yellow", code: "§e", label: "Yellow" },
    { key: "aqua", code: "§b", label: "Aqua" },
    { key: "purple", code: "§d", label: "Purple" },
    { key: "gold", code: "§6", label: "Gold" },
    { key: "white", code: "§f", label: "White" },
];

export function colorCodeOf(key) {
    return COLORS.find((c) => c.key === key)?.code ?? "§f";
}

export function colorLabelOf(key) {
    return COLORS.find((c) => c.key === key)?.label ?? "White";
}

/** Strip characters that would break a quoted slash-command argument or corrupt sidebar display. */
export function sanitizeIdentifier(input, maxLen = 24) {
    let s = String(input ?? "")
        .replace(/[§"\\\n\r\t]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    if (s.length > maxLen) s = s.slice(0, maxLen).trim();
    return s.length > 0 ? s : "Unnamed";
}

/** Free text shown only via chat/forms (never concatenated into a slash command). */
export function cleanText(input, maxLen = 240) {
    let s = String(input ?? "").replace(/§/g, "").trim();
    if (s.length > maxLen) s = s.slice(0, maxLen).trim();
    return s;
}

export function fmtTime(ms) {
    if (!Number.isFinite(ms) || ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function dist3D(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

const COMPASS_LABELS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const COMPASS_ARROWS = ["⬆", "↗", "➡", "↘", "⬇", "↙", "⬅", "↖"];

/** Absolute compass bearing (map-style, not relative to player facing) from `from` toward `to`. */
export function bearingTo(from, to) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    if (Math.abs(dx) < 0.001 && Math.abs(dz) < 0.001) {
        return { label: "HERE", arrow: "●" };
    }
    let angle = (Math.atan2(dx, -dz) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    const idx = Math.round(angle / 45) % 8;
    return { label: COMPASS_LABELS[idx], arrow: COMPASS_ARROWS[idx] };
}

export function verticalHint(from, to) {
    const dy = to.y - from.y;
    if (dy > 2) return "▲";
    if (dy < -2) return "▼";
    return "";
}

/** Runs a slash command, swallowing failures (duplicate objective, missing scoreboard entry, etc). */
export async function runCmd(cmd) {
    try {
        return await world.getDimension("overworld").runCommandAsync(cmd);
    } catch (e) {
        return null;
    }
}

export function newId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function broadcastChat(text) {
    world.sendMessage(text);
}

export function broadcastTitle(title, subtitle) {
    for (const p of world.getAllPlayers()) {
        try {
            p.onScreenDisplay.setTitle(title, {
                subtitle: subtitle ?? "",
                fadeInDuration: 10,
                stayDuration: 60,
                fadeOutDuration: 20,
            });
        } catch (e) {
            // player may have just left; ignore
        }
    }
}
