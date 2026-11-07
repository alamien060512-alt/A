# Treasure Hunt — Bedrock Addon

An admin-run treasure hunt system for Minecraft Bedrock. Set up one or more
hunts, each with an ordered list of clues and any number of teams. Teams race
each other through the same clues; a live scoreboard shows everyone's
progress, and a leaderboard shows who's winning and who finished fastest.

Built against the current stable Scripting API
(`@minecraft/server` 2.9.0, `@minecraft/server-ui` 2.1.0) per
[wiki.bedrock.dev](https://wiki.bedrock.dev/). These are **stable** modules —
you do **not** need to enable the "Beta APIs" experiment for this addon.

## Features

- **Admin panel** (chest-style menu) to create hunts, add clues, create
  teams, assign players, and start/pause/reset the race.
- **Two clue types**:
  - *Location clues* — walk within a configurable radius of a spot to solve
    it (works across the Overworld, Nether and End).
  - *Riddle clues* — type the answer in chat to solve it.
- **Teams** with names, colors, and member lists. Players can also
  self-serve: join an existing team or create their own from the in-game
  menu.
- **Live sidebar scoreboard** ("Treasure Hunt") showing every team's clue
  count in real time — a real vanilla scoreboard, visible to everyone.
- **On-screen compass guidance**: team members get an action-bar hint with
  direction + distance to their next location clue, or a reminder to answer
  the current riddle in chat.
- **Leaderboard** ranking teams by who finished fastest, with live clue
  progress for teams still racing. Available to admins and players alike.
- **Scattered starts, shared treasure**: any clue can be marked "Shared"
  (everyone sees it) or assigned to one specific team. Give each team its
  own early clue(s) scattered around the map, then end every team's path
  on the same shared final clue — all teams converge on one treasure, but
  nobody starts in the same place.
- **Lap timing** per clue, finish-time tracking, and a "🏆 X WINS!" title
  broadcast the moment a team finds the treasure.
- Optional **public hints** setting if you'd rather everyone see every
  team's clue text (off by default — hints are private per team).
- Multiple saved hunt configurations — build several hunts ahead of time and
  switch which one is active.
- Everything is saved in the world, so progress survives restarts.

## Installing

This addon ships as **two packs** (Bedrock always keeps behavior and
resource content separate) plus a combined file:

- `TreasureHunt_BP.mcpack` — the behavior pack (game logic).
- `TreasureHunt_RP.mcpack` — the resource pack (item icons/text).
- `TreasureHunt.mcaddon` — both packs in one file, for a single import.

Double-click **`TreasureHunt.mcaddon`** (simplest — imports both packs at
once), or double-click the two `.mcpack` files one at a time. Either way,
Minecraft will import them into your global resources.

Then, in your world's settings:

1. **Behavior Packs** → activate "Treasure Hunt".
2. **Resource Packs** → activate "Treasure Hunt".

This addon targets Minecraft **1.20.0 or newer** and requires no experiment
toggles. If real slash commands (`/th:admin` etc., see below) aren't
available on your game version, the addon automatically falls back to
chat-based shortcuts (`!thadmin` etc.) — either way nothing breaks. If
items still show a missing-texture icon or scripts don't seem to run,
double-check both packs are activated (not just imported) under the
world's Behavior Packs **and** Resource Packs tabs.

## Setup (do this once per world)

1. Give yourself the admin tag and the admin item (run as an operator):
   ```
   /tag @s add th_admin
   /give @s th:admin_baton
   ```
2. Right-click the **Treasure Hunt Admin Baton** to open the admin panel.
   (You can also run `/th:admin`, or type `!thadmin` in chat if your game
   version doesn't support custom slash commands yet.)
3. **Manage Hunts → Create New Hunt** — give it a name. It becomes active
   automatically.
4. **Manage Clues** — stand where you want a clue and choose
   **Add Location Clue**, or add a **Riddle Clue** for a chat-answer
   puzzle. Add as many as you like, in the order teams should solve them.
5. **Manage Teams → Create Team** — name it and pick a color.
6. Still in Manage Teams, open a team and **Add / Move Player Here** to
   assign online players (or let players join themselves — see below).
7. Back on the main admin panel, hit **Start / Restart Hunt**. This resets
   timers, lights up the sidebar scoreboard, and sends each team their
   first clue.

## Playing

- Give players a **Team Compass** (`/give <player> th:team_compass`), or let
  them run `/th:team` or type `!team` in chat.
- If they're not on a team yet, they'll see a list of teams to join (or can
  create their own team on the spot).
- Once on a team, the menu shows their current clue/riddle, and the
  action bar shows a live compass bearing + distance to it (or a reminder
  to answer in chat, for riddles).
- Finding a location clue (walking into its radius) or typing the correct
  answer to a riddle automatically advances that team to the next clue,
  announces it to the server, and updates the scoreboard.
- Anyone can check standings with `/th:board` (or `!board`) or the
  Leaderboard button.

## Scattering teams with a shared final treasure

Every clue you add has a **"Who is this clue for?"** dropdown: `Shared (all
teams)` or one specific team. A team's path through the hunt is: its own
clues, plus every shared clue, in the order you created them. This means:

1. Create your teams first (**Manage Teams → Create Team**) — you need at
   least one team to assign clues to.
2. For each team, stand somewhere different on the map and
   **Manage Clues → Add Location/Riddle Clue**, picking that team in the
   dropdown. This is each team's unique starting clue (or a short private
   chain of several clues — add as many as you want for that team).
3. Add one or more **Shared** clues afterward for everyone to solve once
   they've worked through their own leg.
4. Add a final **Shared** clue at the treasure's location — that's the
   clue every team finishes on, no matter which path they took to reach it.
5. **Start Hunt.** Each team is immediately sent *their own* first clue
   (not anyone else's), and the sidebar scoreboard, leaderboard and
   action-bar guidance all automatically follow each team's own path length
   — a team with 4 clues (2 private + 2 shared) and a team with 3 are
   compared fairly by percentage complete, not raw clue count.

You can mix and match freely: some teams can have several private clues
before joining the shared path, others can jump straight to a shared clue
— whatever suits your map. Clue order inside **Manage Clues** is the
authoring order for the whole hunt; each team simply skips any clue that
belongs to a different team.

## Commands

The addon registers real slash commands when your game version supports them
(autocomplete, work with cheats off), and always also accepts the matching
chat shortcut as a guaranteed fallback — so it works everywhere, old game
versions included.

| Slash command | Chat fallback | Who | Does |
|---|---|---|---|
| `/th:admin` | `!thadmin` | players with the `th_admin` tag | Open the admin panel |
| `/th:team` | `!team` | everyone | Open "join a team" / "my team" menu |
| `/th:board` | `!board` | everyone | Show the leaderboard |

## Notes & tips

- Only one hunt can be **active** (and shown on the scoreboard) at a time,
  but you can prepare several hunts ahead of time under **Manage Hunts** and
  switch which is active whenever you like.
- Editing clues (add/delete/reorder) while a hunt is running can shift what
  "clue #3" means for teams mid-race — the admin panel warns you when this
  might happen. Safest to finish editing before pressing Start.
- Team names and hunt names are sanitized for safe use in the scoreboard;
  very long names are shortened.
- Deleting a hunt, team, or clue is permanent — there's a confirmation
  prompt first.

## Project layout

```
behavior_pack/     game logic: manifest, custom items, scripts/
resource_pack/     item textures/icons, language files
```

Scripts live under `behavior_pack/scripts/`:

- `main.js` — event wiring (item use, chat commands, the 1-second tick loop).
- `lib/store.js` — persistence (world dynamic property, JSON).
- `lib/teams.js`, `lib/clues.js`, `lib/hunt.js` — core game logic.
- `lib/scoreboard.js` — syncs the vanilla sidebar scoreboard.
- `lib/ui_admin.js`, `lib/ui_player.js` — the in-game menus.
- `lib/actionbar.js` — the live compass/distance HUD.
- `lib/util.js` — formatting, color, distance/bearing helpers.
