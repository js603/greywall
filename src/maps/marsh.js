/**
 * 안개 늪 (Fog Marsh) — Act 2 area 1, Lv 14–20. Design: design/gdd/act2-fog-marsh.md
 * Bog ground cut by ponds (water blocks movement), a dirt causeway from the east entrance to the
 * witch's raised island in the west, and a light fog layer (`ambient`) drawn by WorldScene.
 */
import { createRng, randInt } from "../core/rng.js";
import { fillBlob, isOpenTile, paintPath, placeProp, randomizeVariants } from "./helpers.js";
import { GameMap } from "../sim/GameMap.js";

/** Builds the marsh deterministically (seed 66). */
function buildMarsh() {
  const rng = createRng(66);
  const m = new GameMap(`marsh`, `안개 늪`, 56, 52, `bog`, `forest`);
  m.ambient = { color: 0xb4beb0, alpha: 0.34, nightColor: 0x0f1a16, night: 0.4 };

  // ponds
  for (const [x, y, rx, ry] of [
    [38, 12, 6, 4], [44, 40, 5, 4], [30, 25, 4, 3], [22, 16, 4, 3],
    [24, 44, 5, 3], [36, 33, 3, 3], [8, 12, 3, 4], [6, 42, 3, 4], [13, 26, 2, 5],
  ]) fillBlob(m, x, y, rx, ry, `water`, rng, 0.25);

  // dry ground around every hunting area
  const SPAWNS = [
    [`bog_slime`, 47, 20, 4, 5], [`bog_slime`, 46, 32, 3, 4],
    [`marsh_spider`, 32, 31, 4, 5],
    [`mist_wraith`, 29, 15, 4, 4], [`mist_wraith`, 24, 36, 3, 3],
    [`bog_ghoul`, 15, 9, 4, 5],
    [`bog_troll`, 15, 43, 4, 4],
  ];
  for (const [, x, y, r] of SPAWNS) fillBlob(m, x, y, r + 1, r + 1, `bog`, rng, 0.1);

  // causeway: east gate -> centre -> island stair, with branches north-west and south-west
  paintPath(m, [[55, 26], [44, 26], [36, 22], [26, 24], [17, 26], [11, 26]], `dirt`, 2);
  paintPath(m, [[26, 24], [20, 15], [15, 10]], `dirt`, 1);
  paintPath(m, [[26, 25], [20, 36], [15, 42]], `dirt`, 1);
  paintPath(m, [[44, 26], [46, 33]], `dirt`, 1);

  // the witch's island: raised plateau x 2..9, y 21..31, reached by a stair at (10, 26)
  for (let y = 21; y <= 31; y++)
    for (let x = 2; x <= 9; x++) {
      m.elev[m.idx(x, y)] = 1;
      m.ground[m.idx(x, y)] = `grave`;
    }
  m.stair[m.idx(10, 26)] = `NW`;
  m.ground[m.idx(10, 26)] = `dirt`;
  placeProp(m, `stairs_NW`, 10, 26, { blocks: false, tall: false });
  for (const [x, y] of [[4, 22], [4, 30]]) placeProp(m, `torch_post`, x, y, { fx: `torch` });
  for (const [x, y] of [[3, 24], [7, 23], [3, 28], [7, 29]]) placeProp(m, rng() < 0.5 ? `grave_cross` : `grave_slab`, x, y);

  // causeway torches: the only lights in the fog
  for (const [x, y] of [[50, 24], [38, 21], [27, 22], [18, 28]]) placeProp(m, `torch_post`, x, y, { fx: `torch` });

  // water blocks movement
  for (let i = 0; i < m.ground.length; i++) if (m.ground[i] === `water`) m.block[i] = 1;

  // dead-looking trees, bushes and rocks on open bog; thick at the edges
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const i = m.idx(x, y);
      if (m.ground[i] !== `bog` || !isOpenTile(m, x, y) || m.elev[i]) continue;
      const edge = x < 2 || y < 2 || x > m.w - 3 || y > m.h - 3;
      const r = rng();
      if (r < (edge ? 0.9 : 0.1)) placeProp(m, rng() < 0.7 ? `pine_${randInt(rng, 0, 1)}` : `oak_${randInt(rng, 0, 2)}`, x, y);
      else if (!edge && r < 0.16) placeProp(m, rng() < 0.6 ? `bush_${randInt(rng, 0, 1)}` : `rock_${randInt(rng, 0, 1)}`, x, y);
    }

  m.exits.push(
    { x: 55, y: 26, to: `orc`, tx: 1, ty: 37, label: `붉은엄니 오크 영지` },
    { x: 55, y: 27, to: `orc`, tx: 1, ty: 38, label: `붉은엄니 오크 영지` },
  );
  for (const e of m.exits) {
    m.block[m.idx(e.x, e.y)] = 0;
    m.ground[m.idx(e.x, e.y)] = `dirt`;
  }
  m.objects = m.objects.filter((o) => !m.exits.some((e) => e.x === o.x && e.y === o.y));

  for (const [kind, x, y, r, count] of SPAWNS) m.spawns.push({ kind, x, y, r, count });
  m.spawns.push({ kind: `fog_witch`, x: 5, y: 26, r: 1, count: 1 });

  m.start = { x: 53, y: 26 };
  randomizeVariants(m, rng);
  return m;
}

export { buildMarsh };
