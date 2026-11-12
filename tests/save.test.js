import test from 'node:test';
import assert from 'node:assert/strict';
import { applySave, exportSave, importSave, parseSave, saveKeys, serializeSave, writeSave } from '../src/save.js';
import { World, MAP_BUILDERS, huntRun } from './helpers.js';

const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

test('a save round-trips through write, export and import into a fresh world', () => {
  const { world } = huntRun(7, 4000);
  const store = memoryStorage();
  assert.equal(writeSave(store, world), true);
  const text = exportSave(store, false);
  const other = memoryStorage();
  const r = importSave(other, false, text);
  assert.equal(r.ok, true);
  const w2 = new World(MAP_BUILDERS, 1);
  applySave(w2, parseSave(other.getItem(saveKeys(false).main)).data);
  for (const k of ['level', 'xp', 'coins', 'str', 'dex', 'con']) assert.equal(w2.player[k], world.player[k], k);
  assert.deepEqual(w2.player.inv, world.player.inv);
});

test('import rejects tampered and foreign files and keeps the current save', () => {
  const store = memoryStorage();
  const w = new World(MAP_BUILDERS, 3);
  w.loadMap('town');
  writeSave(store, w);
  const before = store.getItem(saveKeys(false).main);
  const tampered = JSON.parse(before);
  tampered.data.coins = 999999;
  assert.equal(importSave(store, false, JSON.stringify(tampered)).ok, false);
  assert.equal(importSave(store, false, '{"game":"other"}').ok, false);
  assert.equal(importSave(store, false, 'not json').ok, false);
  assert.equal(store.getItem(saveKeys(false).main), before);
});

test('importing keeps the replaced save as the backup', () => {
  const store = memoryStorage();
  const a = new World(MAP_BUILDERS, 3); a.loadMap('town'); writeSave(store, a);
  const first = store.getItem(saveKeys(false).main);
  const b = new World(MAP_BUILDERS, 4); b.loadMap('town'); b.gainXp(500);
  const text = JSON.stringify(serializeSave(b));
  assert.equal(importSave(store, false, text).ok, true);
  assert.equal(store.getItem(saveKeys(false).backup), first);
  assert.equal(parseSave(store.getItem(saveKeys(false).main)).data.level, b.player.level);
});

test('version 1 and 2 saves migrate', () => {
  const w = new World(MAP_BUILDERS, 5); w.loadMap('town');
  const v3 = serializeSave(w);
  const v1 = { ...v3, version: 1, data: { ...v3.data } };
  delete v1.data.tutorial; delete v1.data.stats;
  const r = parseSave(JSON.stringify(v1));
  assert.equal(r.ok, true); assert.equal(r.migrated, true);
});

test('effects and cooldowns survive a save round trip (status-effects.md)', async () => {
  const { World, MAP_BUILDERS } = await import('./helpers.js');
  const { serializeSave, parseSave, applySave } = await import('../src/save.js');
  const w = new World(MAP_BUILDERS, 5);
  w.loadMap('forest');
  w.update(1 / 30);
  w.player.buffs.chill = { until: w.time + 4, interval: 1.2 };
  w.player.cooldowns.strike = w.time + 6;
  w.applyPoison();
  const r = parseSave(JSON.stringify(serializeSave(w)));
  assert.ok(r.ok, r.error);
  const v = new World(MAP_BUILDERS, 6);
  applySave(v, r.data);
  assert.ok(Math.abs(v.player.buffs.chill.until - v.time - 4) < 0.2);
  assert.ok(Math.abs(v.player.cooldowns.strike - v.time - 6) < 0.2);
  assert.ok(v.player.poison && v.player.poison.until > v.time + 9);
});

test('death costs XP and 5 % of coins; the priest asks an offering from Lv6', async () => {
  const { World, MAP_BUILDERS } = await import('./helpers.js');
  const { XP_TABLE } = await import('../src/data/progression.js');
  const w = new World(MAP_BUILDERS, 5);
  w.gainXp(XP_TABLE[10] + 500);
  w.loadMap('forest');
  w.player.coins = 1000;
  assert.deepEqual(w.deathCost(), { xp: 112, coins: 50 });
  w.killPlayer();
  w.revive();
  assert.equal(w.player.coins, 950);
  assert.equal(w.priestFee(), 50);
  w.player.coins = 10;
  assert.equal(w.priestHeal(), false);
});
