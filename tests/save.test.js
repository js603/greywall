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
