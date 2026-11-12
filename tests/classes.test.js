// design/gdd/class-change.md acceptance 1
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_BUILDERS, World } from './helpers.js';
import { XP_TABLE } from '../src/data/progression.js';
import { applySave, parseSave, serializeSave } from '../src/save.js';

function ready(level = 20, seed = 11) {
  const w = new World(MAP_BUILDERS, seed);
  w.loadMap('ruins');
  w.gainXp(XP_TABLE[level]);
  w.quests.q_class.state = 'done';
  return w;
}

test('class change needs Lv20 and the trial, happens once', () => {
  const w = new World(MAP_BUILDERS, 1);
  w.loadMap('town');
  assert.equal(w.chooseClass('knight'), false);
  const v = ready();
  assert.equal(v.chooseClass('nope'), false);
  assert.equal(v.chooseClass('knight'), true);
  assert.equal(v.chooseClass('paladin'), false);
  assert.equal(v.player.cls, 'knight');
  assert.equal(v.player.sprite, 'player_knight');
  assert.deepEqual(v.player.skills, ['shield_bash']);
  assert.equal(v.player.skillSlots[0], 'shield_bash');
});

test('passives: knight AC/block/HP, berserker interval/damage, paladin MP', () => {
  const base = ready();
  const ac = base.pAC(), block = base.pBlock(), hp = base.player.maxHp, iv = base.pInterval(), dmg = base.pDmgBonus(), mp = base.player.maxMp;
  const k = ready(); k.chooseClass('knight');
  assert.equal(k.pAC(), ac + 3); assert.equal(k.pBlock(), block + 0.05); assert.equal(k.player.maxHp, Math.round(hp * 1.15));
  const b = ready(); b.chooseClass('berserker');
  assert.equal(b.pInterval(), Math.round(iv * 0.92 * 100) / 100); assert.equal(b.pDmgBonus(), dmg + 3);
  const p = ready(); p.chooseClass('paladin');
  assert.equal(p.player.maxMp, Math.round(mp * 1.3));
});

test('the second class skill comes at Lv24, or at once when changing later', () => {
  const w = ready(22); w.chooseClass('berserker');
  assert.deepEqual(w.player.skills, ['whirlwind']);
  w.gainXp(XP_TABLE[24] - w.player.xp);
  assert.deepEqual(w.player.skills, ['whirlwind', 'bloodrage']);
  const late = ready(25); late.chooseClass('paladin');
  assert.deepEqual(late.player.skills, ['holy_smite', 'sacred_ward']);
});

function duel(cls, skill, monsterId) {
  const w = ready(24, 3); w.chooseClass(cls);
  const m = w.monsters.find((x) => x.def.id === monsterId && !x.dead);
  return { w, m, hit: () => { w.rng = () => 0.5; w.landHit(w.player, m, skill); } };
}

test('attack skills: shield bash stuns, smite hits undead harder, whirlwind hits neighbours, all ignore blocks', () => {
  const { w, m, hit } = duel('knight', 'shield_bash', 'garrison_skeleton');
  m.def = { ...m.def, block: 1 }; // would block every basic swing
  const before = m.hp; hit();
  assert.ok(m.hp < before, 'not blocked');
  assert.ok(m.stunUntil > w.time);
  const hp = m.hp, x = m.x, y = m.y;
  w.update(0.5);
  assert.deepEqual([m.x, m.y], [x, y]); // stunned monsters stay put

  const pal = duel('paladin', 'holy_smite', 'garrison_skeleton');
  const kn = duel('knight', 'shield_bash', 'garrison_skeleton');
  const h1 = pal.m.hp; pal.hit(); const h2 = kn.m.hp; kn.hit();
  assert.ok(h1 - pal.m.hp > h2 - kn.m.hp, 'smite on undead out-damages bash');

  const ber = duel('berserker', 'whirlwind', 'garrison_skeleton');
  const others = ber.w.monsters.filter((o) => o !== ber.m && !o.dead).slice(0, 2);
  for (const [k, o] of others.entries()) { o.x = ber.w.player.x + 1; o.y = ber.w.player.y + k; }
  const hps = others.map((o) => o.hp);
  ber.hit();
  others.forEach((o, k) => assert.ok(o.hp < hps[k], 'neighbour hit'));
  assert.equal(hp > 0, true);
});

test('buffs: fortress cuts damage taken, ward absorbs first, both expire', () => {
  const w = ready(24, 5); w.chooseClass('knight');
  const m = w.monsters.find((x) => !x.dead);
  m.def = { ...m.def, dmg: [20, 20], acc: 99 }; w.rng = () => 0.5;
  let hp = w.player.hp; w.landHit(m, w.player, 'basic'); const plain = hp - w.player.hp;
  w.player.buffs.fortress = { until: w.time + 12, dmgTaken: 0.6 };
  hp = w.player.hp; w.landHit(m, w.player, 'basic'); const reduced = hp - w.player.hp;
  assert.ok(reduced < plain);
  w.time += 13;
  hp = w.player.hp; w.landHit(m, w.player, 'basic'); assert.equal(hp - w.player.hp, plain);

  const p = ready(24, 6); p.chooseClass('paladin');
  p.player.buffs.ward = { until: p.time + 20 }; p.player.ward = 50;
  const pm = p.monsters.find((x) => !x.dead); pm.def = { ...pm.def, dmg: [20, 20], acc: 99 }; p.rng = () => 0.5;
  hp = p.player.hp; p.landHit(pm, p.player, 'basic');
  assert.equal(p.player.hp, hp); assert.ok(p.player.ward < 50);
});

test('class survives a save; saves from before classes load as adventurers', () => {
  const w = ready(); w.chooseClass('paladin');
  const s = serializeSave(w);
  const w2 = new World(MAP_BUILDERS, 1);
  applySave(w2, parseSave(JSON.stringify(s)).data);
  assert.equal(w2.player.cls, 'paladin'); assert.equal(w2.player.sprite, 'player_paladin');
  assert.equal(w2.player.maxMp, w.player.maxMp);
  delete s.data.cls;
  const w3 = new World(MAP_BUILDERS, 1);
  applySave(w3, s.data);
  assert.equal(w3.player.cls, null); assert.equal(w3.player.sprite, 'player');
});

test('paladin passive accuracy is added to hit chance', () => {
  const a = ready(); const before = a.pAcc();
  a.chooseClass('paladin');
  assert.equal(a.pAcc(), before + 2);
});

test('death ends chill, class buffs and the ward (status-effects.md)', async () => {
  const { World } = await import('../src/sim/World.js');
  const { MAP_BUILDERS } = await import('../src/maps/index.js');
  const w = new World(MAP_BUILDERS, 3);
  w.loadMap('town');
  w.player.buffs.chill = { until: w.time + 5, interval: 1.2 };
  w.player.buffs.fortress = { until: w.time + 12, dmgTaken: 0.6 };
  w.player.ward = 40;
  w.killPlayer();
  assert.deepEqual(w.player.buffs, {});
  assert.equal(w.player.ward, 0);
});

test('enhancement steps past the safe line count double, +10 adds 2 more (enhancement.md)', async () => {
  const { World } = await import('../src/sim/World.js');
  const { MAP_BUILDERS } = await import('../src/maps/index.js');
  const w = new World(MAP_BUILDERS, 3);
  for (const [plus, eff] of [[3, 3], [6, 6], [7, 8], [9, 12], [10, 16]]) {
    w.player.equipPlus.weapon = plus;
    assert.equal(w.effPlus('weapon'), eff, `weapon +${plus}`);
  }
  w.player.equipPlus.armor = 5; // armour safe line +4
  assert.equal(w.effPlus('armor'), 6);
});
