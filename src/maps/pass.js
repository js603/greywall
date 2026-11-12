/**
 * 얼어붙은 고개 (Frozen Pass) — Act 2 area 3, Lv 24–28. Design: design/gdd/act2-frozen-pass.md
 * A snowy valley between rock walls north of the Ruined Watchtower: a frozen lake you slide across,
 * the yetis' rocks in the west, the golems' slope in the east, and the glacier at the top where
 * the titan Heim stands. Snow falls (map.weather) and the light is cold (map.ambient).
 */
import { createRng, randInt } from "../core/rng.js";
import { addCamp, fillBlob, isOpenTile, paintPath, placeProp, randomizeVariants } from "./helpers.js";
import { GameMap } from "../sim/GameMap.js";

const SPAWNS = [
  { kind: `snow_wolf`, x: 15, y: 47, r: 4, count: 4 },
  { kind: `snow_wolf`, x: 35, y: 46, r: 4, count: 4 },
  { kind: `frost_wisp`, x: 22, y: 32, r: 5, count: 5 },
  { kind: `yeti`, x: 10, y: 21, r: 4, count: 4 },
  { kind: `frost_golem`, x: 39, y: 23, r: 4, count: 4 },
  { kind: `glacier_titan`, x: 25, y: 5, r: 1, count: 1 },
];

/** Builds the pass deterministically (seed 88). */
function buildPass() {
  const rng = createRng(88);
  const m = new GameMap(`pass`, `얼어붙은 고개`, 50, 56, `snow`, `forest`);
  m.weather = `snow`;
  m.ambient = { color: 0xcfe6ff, alpha: 0.12, nightColor: 0x0b1424, night: 0.5 };

  fillBlob(m, 22, 32, 9, 6, `ice`, rng, 0.2);
  fillBlob(m, 39, 23, 5, 4, `dirt`, rng, 0.3);
  fillBlob(m, 10, 21, 5, 4, `dirt`, rng, 0.35);
  paintPath(m, [[24, 55], [24, 46], [30, 38], [31, 28], [24, 20], [25, 10]], `road`, 2);
  paintPath(m, [[31, 28], [37, 24]], `road`, 1);
  paintPath(m, [[24, 20], [13, 21]], `road`, 1);

  // the glacier: raised ice x 17..33, y 1..8, stair at (25, 9) going north
  for (let y = 1; y <= 8; y++)
    for (let x = 17; x <= 33; x++) {
      m.elev[m.idx(x, y)] = 1;
      m.ground[m.idx(x, y)] = `ice`;
    }
  m.stair[m.idx(25, 9)] = `NE`;
  m.ground[m.idx(25, 9)] = `road`;
  placeProp(m, `stairs_NE`, 25, 9, { blocks: false, tall: false });
  for (const [x, y] of [[19, 3], [31, 3]]) placeProp(m, `torch_post`, x, y, { fx: `torch` });

  // rock walls on both sides of the valley, ragged
  for (let y = 0; y < m.h; y++) {
    const left = 3 + Math.round(2 * Math.sin(y * 0.35) + rng() * 1.5);
    const right = m.w - 4 - Math.round(2 * Math.sin(y * 0.28 + 1) + rng() * 1.5);
    for (let x = 0; x < m.w; x++) {
      if ((x < left || x > right) && isOpenTile(m, x, y) && !m.elev[m.idx(x, y)]) placeProp(m, `rockwall_${randInt(rng, 0, 2)}`, x, y);
    }
  }
  // the yetis' rocks and the golems' boulders
  for (const [x, y] of [[7, 18], [13, 17], [6, 24], [14, 25], [36, 19], [43, 21], [36, 28], [42, 27]]) placeProp(m, `rock_big`, x, y);
  for (const [x, y] of [[27, 43], [20, 38], [29, 16], [18, 14]]) placeProp(m, `torch_post`, x, y, { fx: `campfire` });

  // pines on open snow, never inside a hunting area or on the road
  const huntingArea = (x, y) => SPAWNS.some((s) => Math.max(Math.abs(x - s.x), Math.abs(y - s.y)) <= s.r + 1);
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const i = m.idx(x, y);
      if (m.ground[i] !== `snow` || m.elev[i] || !isOpenTile(m, x, y) || huntingArea(x, y)) continue;
      const r = rng();
      if (r < 0.1) placeProp(m, `pine_${randInt(rng, 0, 1)}`, x, y);
      else if (r < 0.13) placeProp(m, rng() < 0.5 ? `rock_0` : `bush_1`, x, y);
    }

  // the broken sluice gate east of the golems' slope, down to the Ancient Aqueduct (act2-ancient-aqueduct.md)
  for (let x = 38; x < m.w; x++)
    for (const y of [22, 23]) {
      const i = m.idx(x, y);
      m.block[i] = 0;
      m.ground[i] = `road`;
    }
  m.objects = m.objects.filter((o) => !(o.x >= 38 && (o.y === 22 || o.y === 23)));
  m.exits.push(
    { x: 49, y: 22, to: `aqueduct`, tx: 1, ty: 25, label: `고대 수로` },
    { x: 49, y: 23, to: `aqueduct`, tx: 1, ty: 26, label: `고대 수로` },
    { x: 24, y: 55, to: `ruins`, tx: 39, ty: 1, label: `무너진 감시탑` },
    { x: 25, y: 55, to: `ruins`, tx: 40, ty: 1, label: `무너진 감시탑` },
  );
  for (const e of m.exits) {
    m.block[m.idx(e.x, e.y)] = 0;
    m.ground[m.idx(e.x, e.y)] = `road`;
  }
  m.objects = m.objects.filter((o) => !m.exits.some((e) => e.x === o.x && e.y === o.y));
  m.spawns.push(...SPAWNS);
  addCamp(m, { x: 27, y: 50, ground: `snow`, npc: { id: `camp_pass`, name: `고개 야영지 상인 오스크`, x: 28, y: 49 } });
  m.start = { x: 24, y: 52 };
  randomizeVariants(m, rng);
  return m;
}

export { buildPass };
