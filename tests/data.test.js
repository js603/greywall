// Cross-reference checks for the data tables in assets/data/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS } from '../src/data/items.js';
import { MONSTERS } from '../src/data/monsters.js';
import { QUESTS } from '../src/data/quests.js';
import { SHOPS } from '../src/data/shops.js';
import { SKILLS } from '../src/data/skills.js';
import { XP_TABLE } from '../src/data/progression.js';

test('every item id matches its key and has a weight', () => {
  for (const [k, it] of Object.entries(ITEMS)) {
    assert.equal(it.id, k);
    assert.equal(typeof it.weight, 'number', k);
  }
});

test('monster drops, shop stock, skill books and quest rewards point at real items', () => {
  for (const m of Object.values(MONSTERS)) for (const d of m.drops ?? []) assert.ok(ITEMS[d.item], `${m.id} drops ${d.item}`);
  for (const s of Object.values(SHOPS)) for (const i of s.items) assert.ok(ITEMS[i], `${s.id} sells ${i}`);
  for (const s of Object.values(SKILLS)) assert.ok(ITEMS[s.book], `${s.id} book`);
  for (const q of QUESTS) {
    for (const r of q.rewardItems ?? []) assert.ok(ITEMS[r.item], `${q.id} rewards ${r.item}`);
    for (const r of q.bring ?? []) assert.ok(ITEMS[r.item], `${q.id} asks for ${r.item}`);
    if (q.kill) assert.ok(MONSTERS[q.kill.monster], `${q.id} kills ${q.kill.monster}`);
    if (q.after) assert.ok(QUESTS.some((p) => p.id === q.after), `${q.id} after ${q.after}`);
  }
});

test('drop chances are probabilities and the XP table rises', () => {
  for (const m of Object.values(MONSTERS)) for (const d of m.drops ?? []) assert.ok(d.chance > 0 && d.chance <= 1, `${m.id} ${d.item}`);
  for (let i = 2; i < XP_TABLE.length; i++) assert.ok(XP_TABLE[i] > XP_TABLE[i - 1]);
});
