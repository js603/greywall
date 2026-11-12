// Smith crafting (design/gdd/equipment-economy.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/sim/World.js';
import { MAP_BUILDERS } from '../src/maps/index.js';
import { RECIPES } from '../src/data/recipes.js';
import { ITEMS } from '../src/data/items.js';
import { SHOPS } from '../src/data/shops.js';
import { XP_TABLE } from '../src/data/progression.js';

function world(level = 20) {
  const w = new World(MAP_BUILDERS, 7);
  w.gainXp(XP_TABLE[level]);
  w.loadMap('town');
  return w;
}

test('every recipe makes a real item from real materials and is sold by its shop', () => {
  for (const r of Object.values(RECIPES)) {
    assert.ok(ITEMS[r.item], r.id);
    for (const m of r.mats) assert.equal(ITEMS[m.item]?.type, 'material', `${r.id} uses ${m.item}`);
    assert.ok(SHOPS[r.shop].crafts.includes(r.id), `${r.shop} lists ${r.id}`);
  }
});

test('crafting takes materials and the fee and gives the item', () => {
  const w = world(20);
  const r = RECIPES.tower_shield;
  for (const m of r.mats) w.give(m.item, m.count + 2);
  w.player.coins = r.coins + 50;
  assert.equal(w.craftState('tower_shield').ok, true);
  assert.equal(w.craft('smith', 'tower_shield'), true);
  assert.equal(w.count('tower_shield'), 1);
  for (const m of r.mats) assert.equal(w.count(m.item), 2);
  assert.equal(w.player.coins, 50);
});

test('crafting refuses missing materials, coins, level, or the wrong shop', () => {
  const w = world(20);
  const r = RECIPES.yeti_armor; // reqLevel 25
  for (const m of r.mats) w.give(m.item, m.count);
  w.player.coins = 99999;
  assert.equal(w.craftState('yeti_armor').reason, 'level');
  assert.equal(w.craft('smith', 'yeti_armor'), false);
  const v = world(20);
  v.player.coins = 99999;
  assert.equal(v.craftState('bog_scale').reason, 'mats');
  for (const m of RECIPES.bog_scale.mats) v.give(m.item, m.count);
  v.player.coins = 10;
  assert.equal(v.craftState('bog_scale').reason, 'coins');
  v.player.coins = 99999;
  assert.equal(v.craft('alchemist', 'bog_scale'), false);
  assert.equal(v.count('bog_scale'), 0);
});
