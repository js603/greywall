/**
 * 무너진 감시탑 (Ruined Watchtower) — Act 2 area 2, Lv 20–24. Design: design/gdd/act2-ruined-watchtower.md
 * A broken square fort on open grass north of the Fog Marsh: gaps and rubble in the walls, a
 * courtyard, and a raised keep (stair at its south face) where the fallen captain stands.
 */
import { createRng, randInt } from "../core/rng.js";
import { addCamp, fillBlob, fillRect, isOpenTile, paintPath, placeProp, randomizeVariants } from "./helpers.js";
import { GameMap } from "../sim/GameMap.js";

const WALL = { x0: 10, x1: 43, y0: 8, y1: 38 };
const GATE = [25, 26, 27, 28];
/** Act 2 area 3: a postern in the north wall towards the Frozen Pass (design/gdd/act2-frozen-pass.md). */
const NORTH_GATE = [39, 40];

/** Builds the ruins deterministically (seed 77). */
function buildRuins() {
  const rng = createRng(77);
  const m = new GameMap(`ruins`, `무너진 감시탑`, 54, 50, `grass`, `forest`);

  // courtyard ground and outside patches
  fillRect(m, WALL.x0 + 1, WALL.y0 + 1, WALL.x1 - 1, WALL.y1 - 1, `dirt`);
  for (const [x, y, rx, ry] of [[18, 28, 5, 4], [35, 28, 5, 4], [26, 31, 4, 3]]) fillBlob(m, x, y, rx, ry, `road`, rng, 0.3);
  for (const [x, y, rx, ry] of [[6, 44, 5, 4], [47, 44, 5, 4], [48, 12, 4, 5], [5, 15, 4, 5]]) fillBlob(m, x, y, rx, ry, `forest`, rng, 0.2);
  paintPath(m, [[26, 49], [26, 39], [26, 20]], `road`, 2);
  paintPath(m, [[37, 25], [39, 14], [39, 0]], `road`, 2);

  // the keep: raised plaza x 20..33, y 10..18, stair at (26, 19) going north
  for (let y = 10; y <= 18; y++)
    for (let x = 20; x <= 33; x++) {
      m.elev[m.idx(x, y)] = 1;
      m.ground[m.idx(x, y)] = `plaza`;
    }
  m.stair[m.idx(26, 19)] = `NE`;
  m.ground[m.idx(26, 19)] = `road`;
  placeProp(m, `stairs_NE`, 26, 19, { blocks: false, tall: false });
  for (const [x, y] of [[21, 11], [32, 11], [21, 17], [32, 17]]) placeProp(m, `torch_post`, x, y, { fx: `torch` });
  placeProp(m, `tower`, 20, 10);
  placeProp(m, `tower`, 33, 10);

  // the outer wall, broken: about a quarter of the segments are rubble
  for (let x = WALL.x0; x <= WALL.x1; x++)
    for (let y = WALL.y0; y <= WALL.y1; y++) {
      const onWall = x === WALL.x0 || x === WALL.x1 || y === WALL.y0 || y === WALL.y1;
      if (!onWall) continue;
      if (y === WALL.y1 && GATE.includes(x)) continue;
      if (y === WALL.y0 && NORTH_GATE.includes(x)) continue;
      const corner = (x === WALL.x0 || x === WALL.x1) && (y === WALL.y0 || y === WALL.y1);
      const r = rng();
      if (corner) placeProp(m, `tower`, x, y);
      else if (r < 0.18) {
        // a breach: rubble on one side, open ground on the wall line
        m.ground[m.idx(x, y)] = `dirt`;
      } else if (r < 0.26) placeProp(m, rng() < 0.5 ? `rock_big` : `rock_${randInt(rng, 0, 1)}`, x, y);
      else placeProp(m, `wall_${(x + y) % 2}`, x, y);
    }
  for (const [x, y] of [[24, 39], [29, 39], [18, 25], [35, 25]]) placeProp(m, `torch_post`, x, y, { fx: `campfire` });
  for (const [x, y] of [[14, 33], [39, 33], [13, 12], [40, 13], [16, 22], [37, 21]]) placeProp(m, rng() < 0.5 ? `crates` : `cart`, x, y);

  // trees outside the walls, thick at the map edge, never inside a hunting area
  const huntingArea = (x, y) => SPAWNS.some((s) => Math.max(Math.abs(x - s.x), Math.abs(y - s.y)) <= s.r + 1);
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const i = m.idx(x, y);
      const outside = x < WALL.x0 - 1 || x > WALL.x1 + 1 || y < WALL.y0 - 1 || y > WALL.y1 + 1;
      if (!outside || m.ground[i] === `road` || !isOpenTile(m, x, y) || huntingArea(x, y)) continue;
      const edge = x < 2 || y < 2 || x > m.w - 3 || y > m.h - 3;
      if (rng() < (edge ? 0.92 : m.ground[i] === `forest` ? 0.4 : 0.07))
        placeProp(m, rng() < 0.6 ? `pine_${randInt(rng, 0, 1)}` : `oak_${randInt(rng, 0, 2)}`, x, y);
    }

  m.exits.push(
    { x: 26, y: 49, to: `marsh`, tx: 31, ty: 1, label: `안개 늪` },
    { x: 27, y: 49, to: `marsh`, tx: 32, ty: 1, label: `안개 늪` },
    { x: 39, y: 0, to: `pass`, tx: 24, ty: 54, label: `얼어붙은 고개` },
    { x: 40, y: 0, to: `pass`, tx: 25, ty: 54, label: `얼어붙은 고개` },
  );
  for (const e of m.exits) {
    m.block[m.idx(e.x, e.y)] = 0;
    m.ground[m.idx(e.x, e.y)] = `road`;
  }
  m.objects = m.objects.filter((o) => !m.exits.some((e) => e.x === o.x && e.y === o.y));

  m.spawns.push(...SPAWNS);

  addCamp(m, { x: 23, y: 45, npc: { id: `camp_ruins`, name: `감시탑 야영지 상인 테사`, x: 22, y: 44 } });
  // the fence only trades with the chaotic (design/gdd/alignment.md)
  m.npcs.push({ id: `black_market`, kind: `npc_fence`, name: `암상인 그릭`, x: 21, y: 47, facing: `SE`, role: `black_market` });
  m.start = { x: 26, y: 46 };
  randomizeVariants(m, rng);
  return m;
}

const SPAWNS = [
    { kind: `ruin_wolf`, x: 8, y: 43, r: 4, count: 4 },
    { kind: `ruin_wolf`, x: 46, y: 43, r: 4, count: 4 },
    { kind: `ruin_wolf`, x: 47, y: 14, r: 3, count: 3 },
    { kind: `deserter`, x: 17, y: 31, r: 3, count: 3 },
    { kind: `deserter`, x: 36, y: 31, r: 3, count: 3 },
    { kind: `plague_guard`, x: 15, y: 18, r: 3, count: 4 },
    { kind: `plague_guard`, x: 38, y: 19, r: 3, count: 4 },
    { kind: `garrison_skeleton`, x: 26, y: 26, r: 4, count: 5 },
    { kind: `garrison_skeleton`, x: 24, y: 13, r: 2, count: 2 },
    { kind: `fallen_captain`, x: 28, y: 12, r: 1, count: 1 },
];

export { buildRuins };
