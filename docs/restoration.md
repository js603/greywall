# Restoration record

- **Input:** `greywall-webapp-dist_1.zip` (53 files, version `4482dc0b881d`). No source map, no source.
- **Engine found in the bundle:** Phaser 3.90.0 (`VERSION:"3.90.0"`), built with Vite.
- **Output:** `src/` (30 modules), `assets/sprites` (23 atlases + 19 animation tables),
  `assets/fx` (16 pixelfx sheets + `fx.json`), `assets/fonts` (Galmuri11), `public/` (PWA icons, manifest),
  `tools/gen_sw.mjs` (rewritten from the header of the shipped `sw.js`).

## How we know it is the same game

1. Every PNG rebuilt by Vite gets the **same content hash** as in the shipped build (e.g. `bandit-BpEY1w1f.png`).
2. `tests/parity.test.js`: all five generated maps and a seeded 20 000-tick hunting run (level 4, kills,
   deaths, drops, potions) hash to the values measured on the original build.
3. `tools/restore/parity-browser.cjs` ran the original and restored builds side by side in Chromium:
   identical results, no console errors. The title, town, forest and auto-play bot (`?bot=1`) were
   checked in screenshots.

## Module map

| Module | Was | Contents |
|---|---|---|
| `core/iso.js`, `core/pathfind.js`, `core/rng.js` | `u d f p m h g _ v y D O` | Isometric projection, 8 directions, A* pathfinding, seeded RNG |
| `data/*.js` | `b x S C w T E` | Items, skills, monsters, XP table, quests, shops, NPC greetings |
| `sim/World.js` | `R` | The whole game rule set: movement, combat, items, quests, day/night, enchanting |
| `sim/GameMap.js`, `sim/entities.js`, `sim/constants.js` | `z P F I L k A j M N` | Tile map, entity classes, timing constants |
| `maps/*.js` | `ee te ne re ie ae B V H U W G K q` | Seeded builders for the five areas |
| `save.js` | `J Y X oe se ce le` | Versioned, checksummed localStorage save with validation and migration |
| `audio.js` | `Z` | WebAudio synthesizer for music and sound effects |
| `render/WorldScene.js`, `render/assets.js` | `Jt Kt qt Ht Ut Wt Gt` | Phaser scene, asset registry |
| `ui/UI.js`, `ui/icons.js`, `ui/dom.js` | `ln rn an on sn cn en tn nn Q $t` | DOM HUD, panels, shops, dialogs |
| `bot/Bot.js` | `un dn` | Auto-play bot (`?bot=1`) used for playtesting |
| `pwa.js`, `main.js` | `Yt Xt Zt Qt` and the rest | Install/update flow, boot, input, autosave |
