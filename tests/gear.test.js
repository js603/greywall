// Prefixes and sets: design/gdd/gear-affixes.md acceptance criteria 1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_BUILDERS, World } from './helpers.js';
import { XP_TABLE } from '../src/data/progression.js';
import { AFFIXES, SETS } from '../src/data/gear.js';
import { ITEMS } from '../src/data/items.js';
import { ABYSS } from '../src/data/abyss.js';
import { parseSave, serializeSave, applySave } from '../src/save.js';

const lv30 = (seed = 3) => {
  const w = new World(MAP_BUILDERS, seed);
  w.gainXp(XP_TABLE[30]);
  w.loadMap('town');
  for (const slot of Object.keys(w.player.equip)) w.player.equip[slot] = null;
  w.player.inv = [];
  w.recalc();
  return w;
};
const equipNew = (w, item, affix = null) => {
  w.give(item, 1, 0, affix);
  w.equip(w.player.inv.length - 1);
};

test('test_gear_data_affixes_fit_slots_and_set_items_exist', () => {
  for (const a of Object.values(AFFIXES)) assert.ok(a.slots.length && a.name, a.id);
  for (const s of Object.values(SETS)) for (const id of s.items) assert.equal(ITEMS[id]?.set, s.id, id);
  for (const id of ABYSS.reward.prefixGear.items) assert.ok(Object.values(AFFIXES).some((a) => a.slots.includes(ITEMS[id].slot)), id);
});

test('test_gear_prefix_adds_stats_and_follows_the_piece', () => {
  const w = lv30();
  equipNew(w, 'abyss_blade');
  const [acc, dmg, iv] = [w.pAcc(), w.pDmgBonus(), w.pInterval()];
  w.unequip('weapon');
  equipNew(w, 'abyss_blade', 'keen');
  assert.equal(w.pAcc(), acc + 2);
  equipNew(w, 'abyss_blade', 'heavy');
  assert.equal(w.pDmgBonus(), dmg + 2);
  // the keen blade went back to the bag with its prefix
  assert.ok(w.player.inv.some((s) => s.item === 'abyss_blade' && s.affix === 'keen'));
  equipNew(w, 'abyss_blade', 'swift');
  assert.ok(w.pInterval() < iv);
  assert.equal(w.itemName('abyss_blade', 3, 'swift'), '+3 날랜 심연의 검');
  const hp = w.player.maxHp;
  equipNew(w, 'naga_scale_mail', 'vital');
  assert.equal(w.player.maxHp, hp + 25);
  w.unequip('armor');
  assert.equal(w.player.maxHp, hp);
});

test('test_gear_set_bonus_counts_pieces', () => {
  const w = lv30();
  const base = { hp: w.player.maxHp, ac: w.pAC(), hit: w.pAcc(), mult: w.dmgTakenMult() };
  equipNew(w, 'echo_mail');
  assert.equal(w.activeSetBonuses().length, 0);
  equipNew(w, 'echo_shield');
  assert.equal(w.player.maxHp, base.hp + 15 + 30, '2 pieces: +30 hp');
  equipNew(w, 'echo_ring');
  assert.equal(w.pAC(), base.ac + 15 + 5 + 1 + 2, '3 pieces: +2 ac');
  assert.equal(w.dmgTakenMult(), base.mult);
  equipNew(w, 'echo_blade');
  assert.equal(w.activeSetBonuses().length, 3);
  assert.equal(w.dmgTakenMult(), 0.92, '4 pieces: damage taken -8%');
  w.unequip('shield');
  assert.equal(w.activeSetBonuses().length, 2);
});

test('test_gear_sell_sells_the_chosen_piece', () => {
  const w = lv30();
  w.give('abyss_blade', 1, 0, 'keen');
  w.give('abyss_blade', 1, 0);
  const plain = w.sellPrice({ item: 'abyss_blade', count: 1 });
  const coins = w.player.coins;
  w.sell(0);
  assert.equal(w.player.coins - coins, Math.floor(plain * 1.5));
  assert.equal(w.player.inv.length, 1);
  assert.equal(w.player.inv[0].affix, undefined, 'the plain blade is still in the bag');
});

test('test_gear_failed_enchant_clears_prefix', () => {
  const w = lv30();
  equipNew(w, 'abyss_blade', 'keen');
  w.player.equipPlus.weapon = 9;
  w.rng = () => 0.99; // fail the 1/3 roll
  w.give('scroll_ench_w', 1);
  w.enchant(w.player.inv.findIndex((s) => s.item === 'scroll_ench_w'));
  assert.equal(w.player.equip.weapon, null);
  assert.equal(w.player.equipAffix.weapon, null);
});

test('test_gear_prefix_and_set_survive_save', () => {
  const w = lv30();
  equipNew(w, 'echo_blade', 'keen');
  w.give('naga_scale_mail', 1, 2, 'sturdy');
  const parsed = parseSave(JSON.stringify(serializeSave(w)));
  assert.ok(parsed.ok, parsed.error);
  const w2 = new World(MAP_BUILDERS, 1);
  applySave(w2, parsed.data);
  assert.equal(w2.player.equipAffix.weapon, 'keen');
  assert.deepEqual(w2.player.inv.at(-1), { item: 'naga_scale_mail', count: 1, plus: 2, affix: 'sturdy' });
  // a prefix on a slot it does not fit is rejected
  const bad = JSON.parse(JSON.stringify(serializeSave(w)));
  const data = bad.data ?? bad;
  data.equipAffix.weapon = 'sturdy';
  if (bad.checksum) delete bad.checksum;
  assert.equal(parseSave(JSON.stringify(bad)).ok, false);
});

test('test_gear_abyss_echo_floor_gives_missing_set_piece_once_a_week', () => {
  const w = lv30();
  w.quests.q_queen.state = 'done';
  w.week = 2;
  w.abyssRun = { week: 2, floor: 5 };
  w.loadMap('abyss');
  equipNew(w, 'echo_blade');
  for (const m of [...w.monsters]) w.killMonster(m);
  const pieces = w.player.inv.filter((s) => ITEMS[s.item].set === 'echo');
  assert.equal(pieces.length, 1);
  assert.notEqual(pieces[0].item, 'echo_blade', 'a missing piece first');
  w.loadMap('abyss');
  for (const m of [...w.monsters]) w.killMonster(m);
  assert.equal(w.player.inv.filter((s) => ITEMS[s.item].set === 'echo').length, 1, 'once per week');
});
