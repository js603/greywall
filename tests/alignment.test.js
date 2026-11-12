// Alignment choices, black market, priest offering (design/gdd/alignment.md)
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_BUILDERS, World } from './helpers.js';
import { XP_TABLE } from '../src/data/progression.js';
import { QUESTS } from '../src/data/quests.js';

function ready(w, id) {
  const q = QUESTS.find((x) => x.id === id);
  for (const b of q.bring ?? []) w.give(b.item, b.count);
  w.quests[id].state = 'active';
  w.refreshQuests();
  assert.equal(w.quests[id].state, 'ready');
}

test('a choice quest needs a choice; the chaotic one drops alignment and pays coins instead of items', () => {
  const w = new World(MAP_BUILDERS, 4);
  w.gainXp(XP_TABLE[21]);
  w.loadMap('town');
  w.player.lawful = 2500;
  ready(w, 'q_insignia');
  w.completeQuest('q_insignia');
  assert.equal(w.quests.q_insignia.state, 'ready', 'no choice, no hand-in');
  const coins = w.player.coins;
  w.completeQuest('q_insignia', 'fence');
  assert.equal(w.quests.q_insignia.state, 'done');
  assert.equal(w.player.lawful, -600);
  assert.equal(w.player.coins, coins + 1800);
  assert.equal(w.count('potion_brave'), 2);
  assert.equal(w.priestFee(), 2 * 5 * w.player.level);
});

test('the lawful choice adds alignment; the righteous are healed for free; the fence refuses them', () => {
  const w = new World(MAP_BUILDERS, 4);
  w.gainXp(XP_TABLE[16]);
  w.loadMap('town');
  w.player.lawful = 800;
  ready(w, 'q_venom');
  w.completeQuest('q_venom', 'cure');
  assert.equal(w.player.lawful, 1100);
  assert.equal(w.priestFee(), 0);
  w.player.coins = 5000;
  w.buy('black', 'scroll_ench_w');
  assert.equal(w.count('scroll_ench_w'), 0);
  w.player.lawful = -200;
  w.buy('black', 'scroll_ench_w');
  assert.equal(w.count('scroll_ench_w'), 1);
  assert.equal(w.player.coins, 4000, 'black market charges double');
});
