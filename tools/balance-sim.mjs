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
const CASES = [
  ['forest', 1, STARTER], ['forest', 3, STARTER], ['forest', 5, MID],
  ['mine', 6, MID], ['mine', 8, MID],
  ['orc', 7, MID], ['orc', 9, LATE],
  ['mine2', 10, LATE], ['mine2', 12, LATE],
];

const rows = [];
for (const [map, level, gear] of CASES) {
  const acc = { xp: 0, coins: 0, kills: 0, deaths: 0, potions: 0 };
  for (let s = 1; s <= seeds; s++) {
    let potions = 0;
    const r = huntRun(1000 + s, minutes * 60 * 30, {
      map, level, gear,
      onTick: (w, i) => { if (i === 0) potions = w.stats.potions; },
    });
    const w = r.world;
    acc.xp += w.player.xp - XP_TABLE[level];
    acc.coins += w.player.coins;
    acc.kills += w.stats.kills;
    acc.deaths += w.stats.deaths;
    acc.potions += w.stats.potions - potions;
  }
  const per = (v) => v / seeds / minutes;
  const need = XP_TABLE[level + 1] - XP_TABLE[level];
  rows.push([map, level, gear.length ? gear.join(', ') : 'starter', per(acc.kills).toFixed(1), per(acc.xp).toFixed(0),
    per(acc.coins).toFixed(0), (acc.deaths / seeds).toFixed(1), per(acc.potions).toFixed(1),
    per(acc.xp) > 0 ? (need / per(acc.xp)).toFixed(1) : '∞']);
}

console.log(`# Balance simulation (${minutes} min × ${seeds} seeds, tools/balance-sim.mjs)\n`);
console.log('| Area | Lv | Gear | Kills/min | XP/min | Coins/min | Deaths/run | Potions/min | → next lv (min) |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.join(' | ')} |`);
