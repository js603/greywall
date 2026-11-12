/**
 * 고대 수로 (Ancient Aqueduct) — Act 2 area 4, Lv 28–30. Design: design/gdd/act2-ancient-aqueduct.md
 * The old kingdom's underground waterworks below the Frozen Pass: stone walkways between channels you cross
 * only by bridges, a drowned monastery in the north-west, crabs in the south, nagas across the east channel,
 * and the reservoir in the north whose raised island holds the naga queen.
 */
import { createRng, randInt } from "../core/rng.js";
import { addCamp, placeProp, randomizeVariants } from "./helpers.js";
import { GameMap } from "../sim/GameMap.js";

const SPAWNS = [
  { kind: `aqueduct_leech`, x: 11, y: 34, r: 4, count: 5 },
  { kind: `aqueduct_leech`, x: 26, y: 24, r: 4, count: 4 },
  { kind: `spine_crab`, x: 26, y: 40, r: 4, count: 5 },
  { kind: `drowned_monk`, x: 8, y: 6, r: 4, count: 5 },
  { kind: `naga`, x: 43, y: 30, r: 4, count: 4 },
  { kind: `naga`, x: 43, y: 6, r: 3, count: 3 },
  { kind: `naga_queen`, x: 26, y: 5, r: 1, count: 1 },
];

const W = 52;
const H = 50;

/** Builds the aqueduct deterministically (seed 99). */
function buildAqueduct() {
  const rng = createRng(99);
  const m = new GameMap(`aqueduct`, `고대 수로`, W, H, `plaza`, `mine`);
  m.ambient = { color: 0x0a1820, alpha: 0.42, nightColor: 0x050a10, night: 0.25 };
  const water = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m.inside(x, y)) m.ground[m.idx(x, y)] = `water`;
  };
  const bridge = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.ground[m.idx(x, y)] = `road`;
  };

  // channels: two running north-south, one east-west; the reservoir in the north
  water(16, 2, 17, H - 3);
  water(34, 2, 35, H - 3);
  water(2, 12, W - 3, 13);
  water(22, 2, 30, 8);
  // bridges
  for (const y of [8, 25, 40]) bridge(16, y, 17, y + 1);
  for (const y of [6, 25, 40]) bridge(34, y, 35, y + 1);
  for (const x of [8, 26, 43]) bridge(x, 12, x + 1, 13);

  // the island: raised, reached by the stair at (26, 8) from the walkway south of the reservoir
  for (let y = 3; y <= 7; y++)
    for (let x = 24; x <= 28; x++) {
      m.elev[m.idx(x, y)] = 1;
      m.ground[m.idx(x, y)] = `plaza`;
    }
  m.stair[m.idx(26, 8)] = `NE`;
  m.ground[m.idx(26, 8)] = `road`;
  placeProp(m, `stairs_NE`, 26, 8, { blocks: false, tall: false });
  for (const [x, y] of [[24, 3], [28, 3]]) placeProp(m, `torch_post`, x, y, { fx: `torch` });

  // outer rock: a two-tile rim with a gap for the west gate
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const rim = x < 2 || y < 2 || x > W - 3 || y > H - 3;
      if (!rim || (x < 2 && (y === 25 || y === 26))) continue;
      const i = m.idx(x, y);
      m.block[i] = 1;
      m.ground[i] = `mine`;
      const inner = x === 1 || y === 1 || x === W - 2 || y === H - 2;
      if (inner) m.addObject({ key: `rockwall_${randInt(rng, 0, 2)}`, atlas: `props_tall`, x, y, blocks: true, tall: true });
    }

  // pillars of the old halls and torches along the walkways (never on a bridge or in a hunting area)
  const huntingArea = (x, y) => SPAWNS.some((s) => Math.max(Math.abs(x - s.x), Math.abs(y - s.y)) <= s.r + 1);
  for (const [x, y] of [[6, 18], [12, 18], [6, 44], [21, 18], [31, 18], [21, 31], [31, 31], [40, 18], [47, 18], [40, 44], [47, 44]])
    if (!huntingArea(x, y)) placeProp(m, `rockwall_${randInt(rng, 0, 2)}`, x, y);
  for (const [x, y] of [[14, 22], [19, 22], [32, 22], [37, 22], [14, 44], [37, 44], [19, 10], [32, 10], [10, 15], [43, 15]])
    placeProp(m, `torch_post`, x, y, { fx: `torch` });

  m.exits.push(
    { x: 0, y: 25, to: `pass`, tx: 48, ty: 22, label: `얼어붙은 고개` },
    { x: 0, y: 26, to: `pass`, tx: 48, ty: 23, label: `얼어붙은 고개` },
  );
  for (const e of m.exits) {
    m.block[m.idx(e.x, e.y)] = 0;
    m.ground[m.idx(e.x, e.y)] = `road`;
    m.ground[m.idx(e.x + 1, e.y)] = `road`;
  }
  addCamp(m, { x: 5, y: 25, ground: `plaza`, npc: { id: `camp_aqueduct`, name: `수로 야영지 상인 네라`, x: 6, y: 24 } });
  // the gatekeeper of the endgame dungeon stands by the camp (design/gdd/endgame-abyss.md)
  m.npcs.push({ id: `abyss_gate`, name: `회랑 문지기 오르넬`, kind: `npc_priest`, x: 4, y: 28, facing: `SE`, role: `abyss` });
  m.spawns.push(...SPAWNS);
  m.start = { x: 2, y: 25 };
  randomizeVariants(m, rng);
  return m;
}

export { buildAqueduct };
