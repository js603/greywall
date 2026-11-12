// Act 2 / Fog Marsh: design/gdd/act2-fog-marsh.md acceptance criteria 1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_BUILDERS, World, huntRun, mapHash } from './helpers.js';
import { MAX_LEVEL, XP_TABLE } from '../src/data/progression.js';
import { MONSTERS } from '../src/data/monsters.js';
import { fnv1a, parseSave, serializeSave } from '../src/save.js';
import { findPath } from '../src/core/pathfind.js';

// marsh was 'bd7063ba' before the north road to the ruins was added; ruins 'c8c78717' before the north postern to the pass
// re-pinned 2026-11-12: hunters' camps at the entrances, marsh entrance cleared, fence in the ruins camp (design/gdd/camps.md)
const PINNED = { marsh: '204f7087', ruins: 'f8ede561', pass: 'f5b3289f' };

test('act 2 maps are deterministic and pinned', () => {
  for (const [id, hash] of Object.entries(PINNED)) {
    assert.equal(mapHash(MAP_BUILDERS[id]()), mapHash(MAP_BUILDERS[id]()), id);
    assert.equal(mapHash(MAP_BUILDERS[id]()), hash, id);
  }
});

test('every exit of every map leads to a walkable tile of a built map, and back', () => {
  for (const [id, build] of Object.entries(MAP_BUILDERS)) {
    const m = build();
    for (const e of m.exits) {
      assert.ok(MAP_BUILDERS[e.to], `${id} -> ${e.to}`);
      const dst = MAP_BUILDERS[e.to]();
      assert.ok(dst.walkable(e.tx, e.ty), `${id} -> ${e.to} lands on ${e.tx},${e.ty}`);
      assert.ok(dst.exits.some((b) => b.to === id), `${e.to} has a way back to ${id}`);
    }
  }
});

test('marsh and orc lands link both ways onto walkable tiles', () => {
  const orc = MAP_BUILDERS.orc(), marsh = MAP_BUILDERS.marsh();
  const toMarsh = orc.exits.filter((e) => e.to === 'marsh');
  const toOrc = marsh.exits.filter((e) => e.to === 'orc');
  assert.equal(toMarsh.length, 2); assert.equal(toOrc.length, 2);
  for (const e of toMarsh) assert.ok(marsh.walkable(e.tx, e.ty), `marsh ${e.tx},${e.ty}`);
  for (const e of toOrc) assert.ok(orc.walkable(e.tx, e.ty), `orc ${e.tx},${e.ty}`);
});

for (const area of ['marsh', 'ruins', 'pass'])
test(`every ${area} spawn has its monster, fills up, and is reachable on foot from the entrance`, () => {
  const w = new World(MAP_BUILDERS, 9);
  w.loadMap(area);
  const kinds = new Set(w.map.spawns.map((s) => s.kind));
  for (const k of kinds) assert.ok(MONSTERS[k], k);
  const expected = w.map.spawns.reduce((n, s) => n + s.count, 0);
  assert.equal(w.monsters.length, expected);
  assert.ok(w.monsters.some((m) => m.def.named), 'a named monster');
  // every monster that spawned (named ones up stairs included) can be walked up to from the entrance
  for (const mo of w.monsters) {
    const path = findPath(w.map, w.map.start.x, w.map.start.y, mo.x, mo.y, { maxNodes: 40000, goalTest: (x, y) => Math.max(Math.abs(x - mo.x), Math.abs(y - mo.y)) <= 1 && w.map.canReach(x, y, mo.x, mo.y) });
    assert.ok(path, `${mo.def.id} at ${mo.x},${mo.y}`);
  }
});

test('level cap is 30 and comes from the XP table', () => {
  assert.equal(MAX_LEVEL, 30);
  const w = new World(MAP_BUILDERS, 1);
  w.loadMap('town');
  w.gainXp(XP_TABLE[MAX_LEVEL] * 2);
  assert.equal(w.player.level, 30);
});

test('saves at level 30 in the marsh load; old saves without act 2 quests still load', () => {
  const w = new World(MAP_BUILDERS, 2);
  w.loadMap('marsh');
  w.gainXp(XP_TABLE[30]);
  assert.equal(parseSave(JSON.stringify(serializeSave(w))).ok, true);
  const ow = new World(MAP_BUILDERS, 3);
  ow.loadMap('town');
  const old = serializeSave(ow);
  for (const id of ['q_marsh', 'q_venom', 'q_mist', 'q_troll', 'q_witch', 'q_ruins', 'q_insignia', 'q_plague', 'q_garrison', 'q_captain', 'q_class', 'q_pass', 'q_shards', 'q_yeti', 'q_golem', 'q_titan']) delete old.data.quests[id];
  old.checksum = fnv1a(JSON.stringify(old.data)); // signed like the act 1 build would have
  const r = parseSave(JSON.stringify(old));
  assert.equal(r.ok, true, r.error);
  assert.equal(r.data.quests.q_witch.state, 'locked');
});

test('a Lv16 hunter levels in the marsh', () => {
  const r = huntRun(77, 30 * 60 * 10, { map: 'marsh', level: 16, gear: ['knight_sword', 'plate_armor', 'iron_shield'] });
  assert.ok(r.world.stats.kills > 10, `kills ${r.world.stats.kills}`);
  assert.ok(r.world.player.xp > XP_TABLE[16]);
});

test('a Lv20 hunter in marsh gear levels at the ruins', () => {
  const r = huntRun(78, 30 * 60 * 10, { map: 'ruins', level: 20, gear: ['mist_blade', 'bog_scale', 'iron_shield', 'witch_charm'] });
  assert.ok(r.world.stats.kills > 10, `kills ${r.world.stats.kills}`);
  assert.ok(r.world.player.xp > XP_TABLE[20]);
});

test('NPC quest markers: ! for a quest to accept, ? for one to turn in, none otherwise', () => {
  const w = new World(MAP_BUILDERS, 4);
  w.loadMap('town');
  w.refreshQuests();
  assert.equal(w.npcQuestMarker('guard'), '!'); // q_slime is available at level 1
  assert.equal(w.npcQuestMarker('smith'), null);
  w.quests.q_slime.state = 'ready';
  assert.equal(w.npcQuestMarker('guard'), '?');
  w.quests.q_slime.state = 'done';
  w.refreshQuests();
  assert.equal(w.npcQuestMarker('guard'), null); // q_wolf needs level 2
});

test('ice: stepping onto ice is 30% quicker', () => {
  const w = new World(MAP_BUILDERS, 12);
  w.loadMap('pass');
  const m = w.map, p = w.player;
  const at = (g) => { for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) if (m.ground[m.idx(x, y)] === g && m.walkable(x, y) && !w.isOccupied(x, y) && m.walkable(x + 1, y) && !w.isOccupied(x + 1, y) && m.ground[m.idx(x + 1, y)] === g && !m.elev[m.idx(x, y)] && !m.elev[m.idx(x + 1, y)]) return [x, y]; };
  const step = (g) => { const [x, y] = at(g); p.x = p.fx = x; p.y = p.fy = y; p.moving = false; w.tryStep(p, x + 1, y); return p.stepDur; };
  assert.ok(Math.abs(step('ice') - step('snow') * 0.7) < 1e-9);
});

test('frost: a wisp hit can chill the player, slowing swings until it wears off', () => {
  const w = new World(MAP_BUILDERS, 13);
  w.loadMap('pass');
  const wisp = w.monsters.find((m) => m.def.id === 'frost_wisp');
  const before = w.pInterval();
  w.rng = () => 0.1; // hit, no block, chill roll succeeds
  w.landHit(wisp, w.player, 'basic');
  assert.ok(w.buffActive('chill'));
  assert.equal(w.pInterval(), Math.round(before * 1.2 * 100) / 100);
  w.time += 5;
  assert.equal(w.pInterval(), before);
});

test('camps: safe ring at each Act 2 entrance, merchant inside, no spawn within 8 tiles of the marsh gate', () => {
  for (const id of ['marsh', 'ruins', 'pass']) {
    const m = MAP_BUILDERS[id]();
    assert.equal(m.camps?.length, 1, id);
    const c = m.camps[0];
    const npc = m.npcs.find((n) => n.role === 'camp');
    assert.ok(npc && Math.max(Math.abs(npc.x - c.x), Math.abs(npc.y - c.y)) <= c.r, `${id} merchant in camp`);
    const w = new World(MAP_BUILDERS, 9);
    w.loadMap(id, c.x + 1, c.y + 1);
    assert.equal(w.safeHere(), true, `${id} camp is safe`);
  }
  const marsh = MAP_BUILDERS.marsh();
  for (const s of marsh.spawns) assert.ok(Math.max(Math.abs(s.x - 55), Math.abs(s.y - 26)) - s.r >= 8, `${s.kind} too close to the gate`);
});
