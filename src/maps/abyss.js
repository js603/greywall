/**
 * 심연 회랑 (Abyss Corridor) — the endgame dungeon. Design: design/gdd/endgame-abyss.md
 * Each floor is rooms and corridors generated from the week's seed and the floor number, so everyone
 * plays the same ten floors in a week. Monsters are Act 2 kinds scaled by depth and never respawn;
 * floors 5 and 10 hold an "echo" of a named boss. The stairs down open once the floor is cleared.
 */
import { createRng, randInt } from "../core/rng.js";
import { placeProp, randomizeVariants } from "./helpers.js";
import { GameMap } from "../sim/GameMap.js";
import { MONSTERS } from "../data/monsters.js";
import { ABYSS } from "../data/abyss.js";

const NO_RESPAWN = 1e12;

/** A copy of a monster scaled for a floor; ids stay the same so quests and achievements still count. */
function scaledDef(base, hpMult, dmgMult, coinMult, extra = {}) {
  return {
    ...base,
    hp: Math.round(base.hp * hpMult),
    dmg: base.dmg.map((d) => Math.round(d * dmgMult)),
    coins: base.coins.map((c) => Math.round(c * coinMult)),
    respawn: NO_RESPAWN,
    ...extra,
  };
}

/** Floor seed: the same week and floor always give the same layout. */
const floorSeed = (week, floor) => (Math.imul(week + 1, 2654435761) ^ Math.imul(floor, 40503)) >>> 0 || 1;

/** What a floor will hold, without building it (the gatekeeper shows this week's echoes). */
function echoOf(week, floor) {
  const b = ABYSS.bossFloors[floor];
  if (!b) return null;
  const rng = createRng(floorSeed(week, 0) + floor);
  return b.pick[randInt(rng, 0, b.pick.length - 1)];
}

/**
 * @param {{week?: number, floor?: number}} [run]
 */
function buildAbyss(run = {}) {
  const week = run.week ?? 0;
  const floor = Math.max(1, Math.min(ABYSS.floors, run.floor ?? 1));
  const rng = createRng(floorSeed(week, floor));
  const W = ABYSS.size;
  const H = ABYSS.size;
  const m = new GameMap(`abyss`, `심연 회랑 ${floor}층`, W, H, `mine`, `mine`);
  m.ambient = { color: 0x120a1c, alpha: 0.45, nightColor: 0x08040e, night: 0.25 };
  m.abyss = { week, floor };
  const open = new Uint8Array(W * H);
  const carve = (x0, y0, x1, y1, ground) => {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        if (x < 2 || y < 2 || x > W - 3 || y > H - 3) continue;
        open[m.idx(x, y)] = 1;
        if (ground) m.ground[m.idx(x, y)] = ground;
      }
  };

  // rooms: random rectangles that keep two tiles apart
  const rooms = [];
  for (let i = 0; i < 80 && rooms.length < ABYSS.rooms; i++) {
    const w = randInt(rng, 6, 9);
    const h = randInt(rng, 6, 9);
    const x = randInt(rng, 3, W - w - 4);
    const y = randInt(rng, 3, H - h - 4);
    if (rooms.some((r) => x < r.x + r.w + 2 && r.x < x + w + 2 && y < r.y + r.h + 2 && r.y < y + h + 2)) continue;
    rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
  }
  const roomGround = floor >= 6 ? `grave` : `plaza`;
  for (const r of rooms) carve(r.x, r.y, r.x + r.w - 1, r.y + r.h - 1, roomGround);

  // corridors: each room joins the nearest room already connected, with a two-wide L-shaped hall
  const linked = [rooms[0]];
  const dist = (a, b) => Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy);
  for (const r of rooms.slice(1)) {
    const to = linked.reduce((best, o) => (dist(r, o) < dist(r, best) ? o : best));
    if (rng() < 0.5) {
      carve(Math.min(r.cx, to.cx), r.cy, Math.max(r.cx, to.cx), r.cy + 1);
      carve(to.cx, Math.min(r.cy, to.cy), to.cx + 1, Math.max(r.cy, to.cy));
    } else {
      carve(r.cx, Math.min(r.cy, to.cy), r.cx + 1, Math.max(r.cy, to.cy));
      carve(Math.min(r.cx, to.cx), to.cy, Math.max(r.cx, to.cx), to.cy + 1);
    }
    linked.push(r);
  }

  // walls: rock faces on every closed tile that touches the open floor
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = m.idx(x, y);
      if (open[i]) continue;
      m.block[i] = 1;
      let face = false;
      for (let dy = -1; dy <= 1 && !face; dy++)
        for (let dx = -1; dx <= 1; dx++) if (m.inside(x + dx, y + dy) && open[m.idx(x + dx, y + dy)]) face = true;
      if (face) m.addObject({ key: `rockwall_${randInt(rng, 0, 2)}`, atlas: `props_tall`, x, y, blocks: true, tall: true });
    }

  // start in the room nearest the top-left corner, stairs down in the room farthest from it
  const start = rooms.reduce((a, b) => (a.cx + a.cy <= b.cx + b.cy ? a : b));
  const goal = rooms.reduce((a, b) => (dist(start, b) > dist(start, a) ? b : a));
  m.start = { x: start.cx, y: start.cy };
  m.exits.push({ x: start.x, y: start.y, to: `aqueduct`, tx: 7, ty: 27, label: `회랑 입구로` });
  const last = floor >= ABYSS.floors;
  m.exits.push({
    x: goal.cx,
    y: goal.cy,
    to: last ? `aqueduct` : `abyss`,
    tx: last ? 7 : undefined,
    ty: last ? 27 : undefined,
    floor: last ? null : floor + 1,
    locked: true,
    label: last ? `회랑을 빠져나간다` : `${floor + 1}층으로`,
  });
  for (const r of rooms) {
    for (const [x, y] of [[r.x, r.y + r.h - 1], [r.x + r.w - 1, r.y]])
      if (!m.exits.some((e) => e.x === x && e.y === y)) placeProp(m, `torch_post`, x, y, { fx: `torch` });
  }

  // monsters: a few kinds from the pool per floor, scaled by depth
  const s = ABYSS.scale;
  const d = floor - 1;
  const pool = [...ABYSS.pool];
  const kinds = [];
  for (let i = 0; i < ABYSS.kindsPerFloor; i++) kinds.push(pool.splice(randInt(rng, 0, pool.length - 1), 1)[0]);
  const defs = kinds.map((k) => scaledDef(MONSTERS[k], 1 + s.hp * d, 1 + s.dmg * d, 1 + s.coins * d));
  for (const r of rooms) {
    if (r === start) continue;
    const def = defs[randInt(rng, 0, defs.length - 1)];
    m.spawns.push({ kind: def.id, def, x: r.cx, y: r.cy, r: Math.min(r.w, r.h) / 2 - 1 | 0, count: r === goal ? 1 : 2 });
  }
  const boss = ABYSS.bossFloors[floor];
  if (boss) {
    const base = MONSTERS[echoOf(week, floor)];
    const def = scaledDef(base, boss.hp, boss.dmg, 1.5, { name: `메아리: ${base.name}`, level: base.level + 3, tint: 0xc49cff });
    m.spawns.push({ kind: def.id, def, x: goal.cx, y: goal.cy - 2, r: 1, count: 1 });
  }
  randomizeVariants(m, rng);
  return m;
}

export { buildAbyss, echoOf, floorSeed };
