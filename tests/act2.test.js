// Act 2 / Fog Marsh: design/gdd/act2-fog-marsh.md acceptance criteria 1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_BUILDERS, World, huntRun, mapHash } from './helpers.js';
import { MAX_LEVEL, XP_TABLE } from '../src/data/progression.js';
import { MONSTERS } from '../src/data/monsters.js';
import { fnv1a, parseSave, serializeSave } from '../src/save.js';
import { findPath } from '../src/core/pathfind.js';

test('marsh generation is deterministic and pinned', () => {
  assert.equal(mapHash(MAP_BUILDERS.marsh()), mapHash(MAP_BUILDERS.marsh()));
  assert.equal(mapHash(MAP_BUILDERS.marsh()), 'bd7063ba');
});

test('marsh and orc lands link both ways onto walkable tiles', () => {
  const orc = MAP_BUILDERS.orc(), marsh = MAP_BUILDERS.marsh();
  const toMarsh = orc.exits.filter((e) => e.to === 'marsh');
  const toOrc = marsh.exits.filter((e) => e.to === 'orc');
  assert.equal(toMarsh.length, 2); assert.equal(toOrc.length, 2);
  for (const e of toMarsh) assert.ok(marsh.walkable(e.tx, e.ty), `marsh ${e.tx},${e.ty}`);
  for (const e of toOrc) assert.ok(orc.walkable(e.tx, e.ty), `orc ${e.tx},${e.ty}`);
});

test('every marsh spawn has its monster and room to spawn, and the start can reach the witch', () => {
  const w = new World(MAP_BUILDERS, 9);
  w.loadMap('marsh');
  const kinds = new Set(w.map.spawns.map((s) => s.kind));
  for (const k of kinds) assert.ok(MONSTERS[k], k);
  const expected = w.map.spawns.reduce((n, s) => n + s.count, 0);
  assert.equal(w.monsters.length, expected);
  const witch = w.monsters.find((m) => m.def.id === 'fog_witch');
  assert.ok(witch);
  // every spawn area (and the witch's island via its stair) is reachable on foot from the entrance
  for (const s of w.map.spawns) {
    const path = findPath(w.map, w.map.start.x, w.map.start.y, s.x, s.y, { maxNodes: 20000, goalTest: (x, y) => Math.max(Math.abs(x - s.x), Math.abs(y - s.y)) <= s.r });
    assert.ok(path, `${s.kind} at ${s.x},${s.y}`);
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
  for (const id of ['q_marsh', 'q_venom', 'q_mist', 'q_troll', 'q_witch']) delete old.data.quests[id];
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
