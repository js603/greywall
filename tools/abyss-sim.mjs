// Abyss floor difficulty (design/gdd/endgame-abyss.md): a Lv30 class hunter with endgame gear clears each floor
// of a few weeks' corridors. Reports minutes to clear, red potions per minute and deaths.
// Usage: node tools/abyss-sim.mjs [weeks=3] [plus=0] [gear=base|echo]
import { huntRun } from './sim/hunt.js';
import { ABYSS } from '../src/data/abyss.js';

const weeks = Number(process.argv[2] ?? 3);
const plus = Number(process.argv[3] ?? 0);
const GEAR = process.argv[4] === 'echo' ? ['echo_blade', 'echo_mail', 'echo_shield', 'echo_ring'] : ['abyss_blade', 'naga_scale_mail', 'tower_shield', 'frost_ring'];
const CAP = 30 * 60 * 20; // give up after 20 minutes on one floor
console.log(`# Abyss simulation (${weeks} weeks, gear ${process.argv[4] ?? 'base'} +${plus}, tools/abyss-sim.mjs)\n`);
console.log('| Floor | Class | Clear (min) | Potions/min | Mana pot/min | Deaths | Cleared |');
console.log('|---|---|---|---|---|---|---|');
for (let floor = 1; floor <= ABYSS.floors; floor++)
  for (const cls of ['knight', 'berserker', 'paladin']) {
    let mins = 0, pots = 0, mana = 0, deaths = 0, cleared = 0;
    for (let week = 0; week < weeks; week++) {
      let at = null;
      const { world: w } = huntRun(1000 + week * 31 + floor, CAP, {
        map: 'abyss', level: 30, gear: GEAR, cls, retarget: true,
        setup: (w) => {
          w.abyssRun = { week, floor };
          for (const s of Object.keys(w.player.equipPlus)) w.player.equipPlus[s] = w.player.equip[s] ? plus : 0;
          w.recalc();
        },
        onTick: (w, i) => {
          if (at === null && w.map.abyss && w.abyssLeft() === 0) { at = i; w.stats.potionsAt = w.stats.potions; w.stats.manaAt = w.stats.manaPotions ?? 0; w.stats.deathsAt = w.stats.deaths; }
        },
      });
      const t = (at ?? CAP) / 30 / 60;
      mins += t;
      pots += (at === null ? w.stats.potions : w.stats.potionsAt) / t;
      mana += (at === null ? w.stats.manaPotions ?? 0 : w.stats.manaAt) / t;
      deaths += at === null ? w.stats.deaths : w.stats.deathsAt;
      if (at !== null) cleared++;
    }
    console.log(`| ${floor} | ${cls} | ${(mins / weeks).toFixed(1)} | ${(pots / weeks).toFixed(1)} | ${(mana / weeks).toFixed(1)} | ${(deaths / weeks).toFixed(1)} | ${cleared}/${weeks} |`);
  }
