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
// pass re-pinned for the sluice gate to the aqueduct; aqueduct pinned on creation (act2-ancient-aqueduct.md)
// aqueduct re-pinned for the abyss gatekeeper by the camp (endgame-abyss.md); it was 'daa9bcb2'
// marsh re-pinned for the drainage tunnel to the deep mine (act1-deep-mine.md); it was '204f7087'
const PINNED = { marsh: '60239eec', ruins: 'f8ede561', pass: 'cb035154', aqueduct: '4d4873db' };

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
      // the abyss is entered through its gatekeeper and goes floor to floor (tests/abyss.test.js)
      if (id === 'abyss') continue;
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

for (const area of ['marsh', 'ruins', 'pass', 'aqueduct'])
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
  for (const id of ['marsh', 'ruins', 'pass', 'aqueduct']) {
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


test('aqueduct_soak_naga_hit_slows_steps_until_it_wears_off', () => {
  // Arrange: a player next to a naga whose soak always lands
  const w = new World(MAP_BUILDERS, 11);
  w.gainXp(XP_TABLE[28]);
  w.loadMap('aqueduct');
  const naga = w.monsters.find((m) => m.def.id === 'naga');
  naga.def = { ...naga.def, soak: { chance: 1, dur: 4, step: 1.3 } };
  // Act
  w.landHit(naga, w.player, 'basic');
  // Assert: soaked now (unless the swing missed or was blocked), gone after 4 s
  if (w.buffActive('soak')) {
    assert.equal(w.player.buffs.soak.step, 1.3);
    w.time += 4.1;
    assert.equal(w.buffActive('soak'), false);
  }
  let soaked = false;
  for (let k = 0; k < 20 && !soaked; k++) { w.landHit(naga, w.player, 'basic'); soaked = w.buffActive('soak'); }
  assert.ok(soaked, 'twenty hits soak at least once');
});

test('aqueduct_drain_leech_hit_heals_the_leech_by_half_the_damage', () => {
  // Arrange: a wounded leech
  const w = new World(MAP_BUILDERS, 12);
  w.gainXp(XP_TABLE[28]);
  w.loadMap('aqueduct');
  const leech = w.monsters.find((m) => m.def.id === 'aqueduct_leech');
  leech.hp = 100;
  // Act: hit until one lands
  let before = w.player.hp, healed = 0;
  for (let k = 0; k < 20 && !healed; k++) {
    before = w.player.hp; const hp0 = leech.hp;
    w.landHit(leech, w.player, 'basic');
    healed = leech.hp - hp0;
    if (healed) assert.equal(healed, Math.round((before - w.player.hp + (w.player.ward ?? 0) * 0) * 0.5));
  }
  // Assert
  assert.ok(healed > 0, 'a landed bite heals the leech');
});

test('aqueduct_pass_gate_links_both_ways', () => {
  const pass = MAP_BUILDERS.pass();
  const aq = MAP_BUILDERS.aqueduct();
  const out = pass.exits.filter((e) => e.to === 'aqueduct');
  const back = aq.exits.filter((e) => e.to === 'pass');
  assert.equal(out.length, 2);
  assert.equal(back.length, 2);
  for (const e of out) assert.ok(aq.walkable(e.tx, e.ty), `arrive ${e.tx},${e.ty}`);
  for (const e of back) assert.ok(pass.walkable(e.tx, e.ty), `return ${e.tx},${e.ty}`);
});

test('test_tunnel_deep_mine_marsh_opens_after_lich_and_is_reachable', () => {
  const marsh = MAP_BUILDERS.marsh(), mine2 = MAP_BUILDERS.mine2();
  const down = marsh.exits.find((e) => e.to === 'mine2');
  const up = mine2.exits.find((e) => e.to === 'marsh');
  assert.ok(findPath(marsh, marsh.start.x, marsh.start.y, down.x, down.y), 'tunnel mouth reachable in the marsh');
  // on the deep mine side the tunnel is behind the lich, up the dais stair
  assert.ok(findPath(mine2, mine2.start.x, mine2.start.y, up.x, up.y), 'tunnel reachable from the deep mine entrance');
  const w = new World(MAP_BUILDERS, 21);
  assert.equal(w.exitOpen(up), false);
  w.quests.q_lich.state = 'done';
  assert.equal(w.exitOpen(up), true, 'open once the lich quest is done');
  const w2 = new World(MAP_BUILDERS, 22);
  w2.stats.bossKills.lich = 1;
  assert.equal(w2.exitOpen(down), true, 'or once the lich was killed');
  // a closed tunnel does not move the player
  const w3 = new World(MAP_BUILDERS, 23);
  w3.loadMap('marsh', 36, 48);
  for (const m of w3.monsters) m.nextThink = 1e9;
  assert.ok(w3.tryStep(w3.player, 36, 49));
  for (let i = 0; i < 40; i++) w3.update(1 / 30);
  assert.equal(w3.map.id, 'marsh');
  w3.quests.q_lich.state = 'done';
  assert.ok(w3.tryStep(w3.player, 36, 48));
  for (let i = 0; i < 40; i++) w3.update(1 / 30);
  assert.ok(w3.tryStep(w3.player, 36, 49));
  for (let i = 0; i < 40; i++) w3.update(1 / 30);
  assert.equal(w3.map.id, 'mine2');
  assert.deepEqual([w3.player.x, w3.player.y], [47, 18]);
});
