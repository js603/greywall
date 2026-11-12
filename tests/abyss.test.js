// Endgame: design/gdd/endgame-abyss.md acceptance criteria 1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_BUILDERS, World, mapHash } from './helpers.js';
import { XP_TABLE } from '../src/data/progression.js';
import { ABYSS, ACHIEVEMENTS, weekOf } from '../src/data/abyss.js';
import { findPath } from '../src/core/pathfind.js';
import { parseSave, serializeSave, applySave } from '../src/save.js';

const ready = (seed = 5) => {
  const w = new World(MAP_BUILDERS, seed);
  w.gainXp(XP_TABLE[30]);
  w.quests.q_queen.state = 'done';
  w.week = 7;
  w.loadMap('aqueduct', 6, 27);
  return w;
};
const tick = (w, n = 3) => { for (let i = 0; i < n; i++) w.update(1 / 30); };

test('test_abyss_floors_same_week_same_layout_new_week_new_layout', () => {
  const a = MAP_BUILDERS.abyss({ week: 3, floor: 4 });
  assert.equal(mapHash(a), mapHash(MAP_BUILDERS.abyss({ week: 3, floor: 4 })));
  assert.notEqual(mapHash(a), mapHash(MAP_BUILDERS.abyss({ week: 4, floor: 4 })));
  assert.notEqual(mapHash(a), mapHash(MAP_BUILDERS.abyss({ week: 3, floor: 5 })));
});

test('test_abyss_every_floor_reachable_with_stairs_and_scaled_monsters', () => {
  for (const week of [0, 1, 2, 3, 50])
    for (let floor = 1; floor <= ABYSS.floors; floor++) {
      const m = MAP_BUILDERS.abyss({ week, floor });
      const down = m.exits.find((e) => e.locked);
      assert.ok(down, `w${week} f${floor} has stairs down`);
      assert.ok(findPath(m, m.start.x, m.start.y, down.x, down.y), `w${week} f${floor} stairs reachable`);
      for (const s of m.spawns) {
        assert.ok(m.walkable(s.x, s.y) && findPath(m, m.start.x, m.start.y, s.x, s.y), `w${week} f${floor} spawn reachable`);
        assert.ok(s.def.respawn >= 1e9, 'abyss monsters never respawn');
      }
      assert.equal(m.spawns.some((s) => s.def.named), Boolean(ABYSS.bossFloors[floor]), `w${week} f${floor} echo boss`);
    }
  const f1 = MAP_BUILDERS.abyss({ week: 0, floor: 1 }).spawns[0].def;
  const f9 = MAP_BUILDERS.abyss({ week: 0, floor: 9 }).spawns.map((s) => s.def);
  assert.ok(f9.every((d) => d.hp > 0) && f1.hp > 0);
});

test('test_abyss_gate_requires_queen_and_level', () => {
  const w = new World(MAP_BUILDERS, 1);
  assert.equal(w.enterAbyss(), false);
  const r = ready();
  assert.equal(r.abyssBlocker(), null);
  assert.equal(r.enterAbyss(), true);
  tick(r);
  assert.equal(r.map.id, 'abyss');
  assert.equal(r.map.abyss.floor, 1);
  assert.equal(r.map.abyss.week, 7);
});

test('test_abyss_stairs_locked_until_cleared_then_reward_and_next_floor', () => {
  const w = ready();
  w.enterAbyss(); tick(w);
  const down = w.map.exits.find((e) => e.locked);
  const p = w.player;
  const walkOn = () => {
    // stand beside the stairs, then step onto them
    const [nx, ny] = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [down.x + dx, down.y + dy]).find(([x, y]) => w.map.walkable(x, y) && !w.isOccupied(x, y, 0));
    w.occ.delete(w.tileIdx(p.x, p.y));
    Object.assign(p, { x: nx, y: ny, fx: nx, fy: ny, moving: false, path: [], target: null });
    w.occ.set(w.tileIdx(nx, ny), 0);
    for (const m of w.monsters) m.nextThink = 1e9;
    assert.ok(w.tryStep(p, down.x, down.y));
    tick(w, 30);
  };
  walkOn();
  assert.ok(w.abyssLeft() > 0);
  assert.equal(w.map.abyss.floor, 1, 'locked stairs do not move the player');
  const coins = p.coins;
  for (const m of [...w.monsters]) if (!m.dead) w.killMonster(m);
  assert.equal(w.abyssLeft(), 0);
  assert.equal(p.coins, coins + ABYSS.reward.coinsPerFloor);
  assert.equal(w.stats.abyss.best, 1);
  assert.equal(w.stats.abyss.week, 7);
  walkOn();
  assert.equal(w.map.abyss.floor, 2, 'cleared stairs lead one floor down');
  assert.equal(w.map.abyss.week, 7);
});

test('test_abyss_floor10_clear_weekly_bonus_once_and_achievements', () => {
  const w = ready();
  w.abyssRun = { week: 7, floor: 10 };
  w.loadMap('abyss');
  const boss = w.monsters.find((m) => m.def.named);
  assert.ok(boss.def.name.startsWith('메아리: '));
  const before = w.player.coins;
  for (const m of [...w.monsters]) w.killMonster(m);
  assert.equal(w.player.coins - before, ABYSS.reward.coinsPerFloor * 10 + ABYSS.reward.weeklyClearCoins + 0);
  assert.equal(w.stats.abyss.clears, 1);
  assert.ok(w.stats.ach.includes('abyss10') && w.stats.ach.includes('lv30'));
  // a second full run the same week pays the floor reward only
  w.loadMap('abyss');
  const again = w.player.coins;
  const scrolls = w.count('scroll_ench_w');
  for (const m of [...w.monsters]) w.killMonster(m);
  assert.equal(w.player.coins - again, ABYSS.reward.coinsPerFloor * 10);
  assert.equal(w.count('scroll_ench_w'), scrolls, 'item rewards once per floor per week');
  assert.equal(w.stats.abyss.clears, 2);
  assert.ok(ACHIEVEMENTS.every((a) => typeof a.id === 'string' && a.name && a.desc));
});

test('test_abyss_save_inside_wakes_by_gatekeeper_and_keeps_records', () => {
  const w = ready();
  w.enterAbyss(); tick(w);
  for (const m of [...w.monsters]) w.killMonster(m);
  const parsed = parseSave(JSON.stringify(serializeSave(w)));
  assert.ok(parsed.ok, parsed.error);
  const w2 = new World(MAP_BUILDERS, 2);
  applySave(w2, parsed.data);
  assert.equal(w2.map.id, 'aqueduct');
  assert.equal(w2.stats.abyss.best, 1);
  assert.deepEqual(w2.stats.ach, w.stats.ach);
});

test('test_abyss_week_counts_from_monday_epoch', () => {
  assert.equal(weekOf(Date.parse('2026-01-05T00:00:00Z')), 0);
  assert.equal(weekOf(Date.parse('2026-01-11T23:59:59Z')), 0);
  assert.equal(weekOf(Date.parse('2026-01-12T00:00:00Z')), 1);
  assert.equal(weekOf(0), 0);
});
