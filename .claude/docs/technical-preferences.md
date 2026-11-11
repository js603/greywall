# Technical Preferences

## Engine & Language

- **Engine**: Phaser 3.90.0 (WebGL, `pixelArt: true`, `Scale.RESIZE`)
- **Language**: JavaScript (ES modules, no TypeScript), Vite 6 build
- **Rendering**: 2D isometric (tile 64×32, elevation 16 px per level), DOM overlay for UI
- **Physics**: none — tile-grid movement with A* pathfinding (`src/core/pathfind.js`)
- **Platform**: installable PWA (desktop + mobile touch), Korean UI

## Architecture Rules

- `src/sim/` is the game rule set. It must not import Phaser or touch the DOM, so it runs headless
  in `node --test`. Rendering (`src/render/`) and UI (`src/ui/`) read the world and react to the
  events it emits (`world.events`).
- Randomness goes through the seeded RNG (`src/core/rng.js`); maps are built from fixed seeds.
- Save format changes bump `version` in `src/save.js` and add a migration in `parseSave`.

## Naming Conventions

- **Classes**: PascalCase (`World`, `GameMap`, `WorldScene`)
- **Functions / variables**: camelCase
- **Constants & data tables**: UPPER_SNAKE_CASE (`ITEMS`, `DAY_LENGTH`)
- **Data ids**: snake_case strings (`potion_red`, `orc_chief`, `q_slime`)
- **Events**: lowercase strings on `world.emit({ type })` (`levelup`, `mapchange`)
- **Files**: camelCase `.js` for modules, PascalCase for files that export one class
- **Assets**: `assets/sprites/<name>.png` + `<name>.json` (atlas) + `<name>.anim.json` (clips); `assets/fx/<name>.png` + `fx.json`

## Performance Budgets

- **Target Framerate**: 60 fps desktop, 30+ fps mid-range phone
- **Frame Budget**: 16.6 ms
- **Texture memory**: ≤ 64 MB decoded RGBA for all atlases (was 115 MB in the restored build)
- **JS payload**: ≤ 500 KB gzip on first load

## Testing

- **Framework**: `node:test` (built in), run with `npm test`
- **Required Tests**: balance formulas, save parsing/migration, map generation, seeded simulation parity
- **Golden tests**: `tests/parity.test.js` pins behaviour to the original build; update only on purpose

## Forbidden Patterns

- Phaser or DOM access inside `src/sim/`
- `Math.random()` in game rules (use the world RNG)
- Image-model art mixed into the code-drawn style without an art-director decision

## Allowed Libraries / Addons

- `phaser` 3.90.0, `vite` (dev)

## Architecture Decisions Log

- [No ADRs yet — use /architecture-decision to create one]
