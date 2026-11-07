import { world } from "@minecraft/server";
import { newId } from "./util.js";

const DATA_KEY = "th:data";
const SAVE_VERSION = 1;

function defaultData() {
    return {
        v: SAVE_VERSION,
        activeHuntId: null,
        hunts: {},
    };
}

function defaultSettings() {
    return {
        publicHints: false,
    };
}

let cache = null;

function load() {
    if (cache) return cache;
    const raw = world.getDynamicProperty(DATA_KEY);
    if (typeof raw === "string" && raw.length > 0) {
        try {
            const parsed = JSON.parse(raw);
            cache = parsed && typeof parsed === "object" && parsed.hunts ? parsed : defaultData();
        } catch (e) {
            console.warn("[TreasureHunt] Saved data was corrupt, starting fresh: " + e);
            cache = defaultData();
        }
    } else {
        cache = defaultData();
    }
    return cache;
}

export function save() {
    if (!cache) return;
    world.setDynamicProperty(DATA_KEY, JSON.stringify(cache));
}

export function getData() {
    return load();
}

export function getActiveHunt() {
    const data = load();
    if (!data.activeHuntId) return null;
    return data.hunts[data.activeHuntId] ?? null;
}

export function getActiveHuntId() {
    return load().activeHuntId;
}

export function getHunt(id) {
    return load().hunts[id] ?? null;
}

export function listHunts() {
    return Object.values(load().hunts).sort((a, b) => a.createdAt - b.createdAt);
}

export function createHunt(name) {
    const data = load();
    const id = newId("hunt");
    const hunt = {
        id,
        name,
        createdAt: Date.now(),
        state: "setup", // setup | running | paused | finished
        startedAt: null,
        pauseStartedAt: null,
        pausedDuration: 0,
        clues: [],
        teams: {},
        settings: defaultSettings(),
    };
    data.hunts[id] = hunt;
    data.activeHuntId = id;
    save();
    return hunt;
}

export function deleteHunt(id) {
    const data = load();
    if (!data.hunts[id]) return false;
    delete data.hunts[id];
    if (data.activeHuntId === id) data.activeHuntId = null;
    save();
    return true;
}

export function setActiveHunt(id) {
    const data = load();
    if (!data.hunts[id]) return false;
    data.activeHuntId = id;
    save();
    return true;
}

export function renameHunt(hunt, name) {
    hunt.name = name;
    save();
}
