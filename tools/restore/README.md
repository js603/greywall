# Source restoration tools

The original source of 회색성벽 연대기 was lost; only the shipped build (`dist`, cache
`greywall-4482dc0b881d`) survived. These scripts rebuilt `src/` and `assets/` from that build.
They are kept for provenance and are not part of the game build.

| Step | Script | What it does |
|---|---|---|
| 1 | (manual) | Cut the game code out of `assets/index-*.js`: everything after the Phaser 3.90 IIFE. |
| 2 | `restore.mjs` | Parses it with Babel, renames every top-level binding (`R` → `World`, `b` → `ITEMS`, …), names constructor parameters after the fields they set, splits the code into 30 ES modules with computed imports/exports, turns `l.default` into `import Phaser`, and writes the inlined sprite atlases, animation clips and FX metadata back out as JSON under `assets/`. |
| 3 | `unmin.cjs` | Runs a safe subset of `@wakaru/unminify` (`!0` → `true`, sequence expressions → statements, `a && b()` → `if`, …) and Prettier. Unsafe rules (`un-esm`, `un-type-constructor`, …) are left out. |
| 4 | `parity-browser.cjs` | Loads the original build and the restored build side by side in Chromium and compares map generation and a seeded 20 000-tick hunting run. |

Local variables inside functions keep their minified names (`e`, `t`, `n`, …) unless a later
refactor renamed them; the bundle has no source map, so their names are gone.

Tool dependencies (install in a scratch folder, not in this project):
`npm i @babel/parser @babel/traverse @babel/generator @babel/types @wakaru/unminify`.

The golden values in `tests/parity.test.js` came from step 4 on the original build.
