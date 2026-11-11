import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_BUILDERS, World } from './helpers.js';
import { applySave, parseSave, serializeSave } from '../src/save.js';

const fresh = () => { const w = new World(MAP_BUILDERS, 5); w.loadMap('town'); return w; };

test('learning a skill puts it in the first empty skill slot', () => {
  const w = fresh();
  w.grantSkill('heal');
  w.grantSkill('strike');
  assert.deepEqual(w.player.skillSlots, ['heal', 'strike', null, null]);
});

test('a skill can sit in one slot only; unlearned skills cannot be assigned', () => {
  const w = fresh();
  w.grantSkill('strike');
  assert.equal(w.assignSkillSlot(3, 'strike'), true);
  assert.deepEqual(w.player.skillSlots, [null, null, null, 'strike']);
  assert.equal(w.assignSkillSlot(1, 'bless'), false);
  assert.equal(w.assignSkillSlot(4, 'strike'), false);
  assert.equal(w.assignSkillSlot(3, null), true);
  assert.deepEqual(w.player.skillSlots, [null, null, null, null]);
});

test('skill slots survive a save; old saves get slots filled from their skills', () => {
  const w = fresh();
  w.grantSkill('bless');
  w.assignSkillSlot(2, 'bless');
  const s = serializeSave(w);
  const w2 = fresh();
  applySave(w2, parseSave(JSON.stringify(s)).data);
  assert.deepEqual(w2.player.skillSlots, [null, null, 'bless', null]);
  delete s.data.skillSlots;
  const w3 = fresh();
  applySave(w3, s.data);
  assert.deepEqual(w3.player.skillSlots, ['bless', null, null, null]);
});
