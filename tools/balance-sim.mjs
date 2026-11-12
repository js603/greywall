// Headless balance report: the hunting driver farms each area at a few levels and gear sets.
//   node tools/balance-sim.mjs [minutes=20] [seeds=3]  > design/balance/sim-report.md
// Numbers are per in-game minute and averaged over seeds. "→ next lv" is the minutes the
// observed XP rate needs to reach the next level from the start of that level.
import { huntRun } from './sim/hunt.js';
import { XP_TABLE } from '../src/data/progression.js';

const minutes = Number(process.argv[2] ?? 20);
const seeds = Number(process.argv[3] ?? 3);
const STARTER = [];
const MID = ['iron_sword', 'leather_armor', 'leather_shield'];
const LATE = ['knight_sword', 'chain_mail', 'iron_shield'];
const ACT1_BEST = ['chief_axe', 'plate_armor', 'iron_shield', 'lord_ring'];
// Act 2 sets follow the obtainable path (design/gdd/equipment-economy.md): crafted pieces at the smith,
// boss-quest rewards (q_witch → witch_charm, q_captain → captain_sword, q_titan → glacier_blade).
const MARSH = ['mist_blade', 'bog_scale', 'iron_shield', 'lord_ring'];
const RUINS_IN = ['mist_blade', 'bog_scale', 'iron_shield', 'witch_charm'];
const RUINS = ['mist_blade', 'garrison_mail', 'tower_shield', 'witch_charm'];
const RUINS_END = ['captain_sword', 'garrison_mail', 'tower_shield', 'witch_charm'];
const PASS = ['captain_sword', 'yeti_armor', 'tower_shield', 'frost_ring'];
const AQUEDUCT = ['captain_sword', 'naga_scale_mail', 'tower_shield', 'frost_ring'];
const CLASSES3 = ['knight', 'berserker', 'paladin'];
const CASES = [
  ['forest', 1, STARTER], ['forest', 3, STARTER], ['forest', 5, MID],
  ['mine', 6, MID], ['mine', 8, MID],
  ['orc', 7, MID], ['orc', 9, LATE],
  ['mine2', 10, LATE], ['mine2', 12, LATE],
  ['marsh', 14, ACT1_BEST], ['marsh', 16, ACT1_BEST], ['marsh', 18, MARSH], ['marsh', 20, RUINS_IN],
  ['ruins', 20, RUINS_IN], ['ruins', 22, ACT1_BEST], ['ruins', 22, RUINS],
  ...CLASSES3.map((c) => ['ruins', 22, RUINS, c]),
  ...CLASSES3.map((c) => ['ruins', 24, RUINS_END, c]),
  ['pass', 24, RUINS], ...CLASSES3.map((c) => ['pass', 24, RUINS_END, c]),
  ...CLASSES3.map((c) => ['pass', 27, PASS, c]),
  ...CLASSES3.map((c) => ['aqueduct', 28, PASS, c]),
  ...CLASSES3.map((c) => ['aqueduct', 29, AQUEDUCT, c]),
];

const RED = 25; // potion_red price: the sim drinks red potions
const MANA = 60; // potion_mana price: class runs keep one going below half mana
const rows = [];
for (const [map, level, gear, cls] of CASES) {
  const acc = { xp: 0, coins: 0, loot: 0, kills: 0, deaths: 0, potions: 0, mana: 0 };
  for (let s = 1; s <= seeds; s++) {
    let potions = 0;
    const r = huntRun(1000 + s, minutes * 60 * 30, {
      map, level, gear, cls,
      onTick: (w, i) => { if (i === 0) potions = w.stats.potions; },
    });
    const w = r.world;
    acc.xp += w.player.xp - XP_TABLE[level];
    acc.coins += w.player.coins;
    // what the picked-up drops sell for at a shop (potions the sim bought are not loot)
    acc.loot += w.player.inv.filter((it) => it.item !== 'potion_red').reduce((v, it) => v + w.sellPrice(it) * it.count, 0);
    acc.kills += w.stats.kills;
    acc.deaths += w.stats.deaths;
    acc.mana += w.stats.manaPotions ?? 0;
    acc.potions += w.stats.potions - potions - (w.stats.manaPotions ?? 0);
  }
  const per = (v) => v / seeds / minutes;
  const need = XP_TABLE[level + 1] - XP_TABLE[level];
  rows.push([map, level, (cls ? `[${cls}] ` : '') + (gear.length ? gear.join(', ') : 'starter'), per(acc.kills).toFixed(1), per(acc.xp).toFixed(0),
    per(acc.coins).toFixed(0), per(acc.loot).toFixed(0), (acc.deaths / seeds).toFixed(1), per(acc.potions).toFixed(1), per(acc.mana).toFixed(1),
    (per(acc.coins) + per(acc.loot) - per(acc.potions) * RED - per(acc.mana) * MANA).toFixed(0),
    per(acc.xp) > 0 ? (need / per(acc.xp)).toFixed(1) : '∞']);
}

console.log(`# Balance simulation (${minutes} min × ${seeds} seeds, tools/balance-sim.mjs)\n`);
console.log('| Area | Lv | Gear | Kills/min | XP/min | Coins/min | Loot/min | Deaths/run | Potions/min | Mana pot/min | Net/min | → next lv (min) |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.join(' | ')} |`);
