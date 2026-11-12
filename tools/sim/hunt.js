// Headless hunting driver shared by tests and tools/balance-sim.mjs.
// Always attacks the nearest living monster, drinks a red potion below 40% HP, picks up loot,
// revives on death. Deterministic for a given seed.
import { World } from '../../src/sim/World.js';
import { MAP_BUILDERS } from '../../src/maps/index.js';
import { XP_TABLE } from '../../src/data/progression.js';
import { SKILLS } from '../../src/data/skills.js';
import { ITEMS } from '../../src/data/items.js';

export const fnv = (s) => {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; }
  return x.toString(16);
};

/**
 * @param {number} seed
 * @param {number} ticks  30 ticks = 1 s of game time
 * @param {{map?: string, level?: number, gear?: string[], cls?: string, onTick?: (w: World, i: number) => void}} [opt]
 *   cls: change class before hunting and use the class skills (attack skill on cooldown, buff below 70% HP)
 *   retarget: turn on the nearest monster that is attacking when the target is out of reach
 *   setup: called before every (re)load of the hunting map, e.g. to set the abyss floor
 */
export function huntRun(seed = 4242, ticks = 20000, opt = {}) {
  const map = opt.map ?? 'forest';
  const w = new World(MAP_BUILDERS, seed);
  if (opt.level > 1) w.gainXp(XP_TABLE[opt.level]);
  for (const g of opt.gear ?? []) { w.give(g, 1); w.equip(w.player.inv.findIndex((s) => s.item === g)); }
  // a geared hunter does not carry the starter kit around (weight slows regen from 30 %)
  if (opt.gear?.length) w.player.inv = w.player.inv.filter((s) => ITEMS[s.item].type !== 'equip');
  if (opt.cls) {
    w.quests.q_class.state = 'done';
    w.chooseClass(opt.cls);
  }
  opt.setup?.(w);
  w.loadMap(map);
  const skills = opt.cls ? w.player.skills.map((id) => SKILLS[id]) : [];
  const trace = [];
  for (let i = 0; i < ticks; i++) {
    if (w.map.id !== map) { opt.setup?.(w); w.loadMap(map); }
    // retarget: a player turns on whatever is hitting them instead of pushing on to an unreachable target
    if (opt.retarget && i % 40 === 20 && w.player.target !== null && !w.player.dead && !w.player.swing) {
      const t = w.monsters.find((m) => m.id === w.player.target);
      const near = (m) => Math.max(Math.abs(m.x - w.player.x), Math.abs(m.y - w.player.y));
      const hitter = w.monsters.filter((m) => !m.dead && m.state === 'attack').sort((a, b) => near(a) - near(b))[0];
      if (hitter && (!t || t.dead || near(t) > 1) && hitter !== t) w.commandAttack(hitter.id);
    }
    if (i % 40 === 0 && !w.player.target && !w.player.dead) {
      let best = null, bd = 1e9;
      for (const m of w.monsters) if (!m.dead) { const d = Math.hypot(m.x - w.player.x, m.y - w.player.y); if (d < bd) { bd = d; best = m; } }
      if (best) w.commandAttack(best.id);
    }
    if (w.player.hp < w.player.maxHp * 0.4 && i % 30 === 0) {
      const k = w.player.inv.findIndex((s) => s.item === 'potion_red');
      if (k >= 0) w.useItem(k); else w.give('potion_red', 5);
    }
    // class runs keep a mana potion going while mana is below half (design/gdd/status-effects.md)
    if (skills.length && i % 30 === 0 && !w.player.dead && w.player.mp < w.player.maxMp * 0.5 && w.time >= w.player.manaUntil) {
      let k = w.player.inv.findIndex((s) => s.item === 'potion_mana');
      if (k < 0) { w.give('potion_mana', 3); k = w.player.inv.findIndex((s) => s.item === 'potion_mana'); }
      w.useItem(k);
      w.stats.manaPotions = (w.stats.manaPotions ?? 0) + 1;
    }
    if (skills.length && i % 15 === 0 && !w.player.dead) {
      for (const sk of skills) {
        if (!w.skillState(sk.id).ok) continue;
        if (sk.attack && w.player.target !== null && !w.player.queuedSkill) w.useSkill(sk.id);
        else if (sk.buff && w.player.hp < w.player.maxHp * 0.7 && !w.player.cast) w.useSkill(sk.id);
      }
    }
    if (i % 300 === 0) {
      // drops at hand are picked up any time; between fights the hunter walks to the nearest one
      if (w.player.target === null) w.pickupNearby();
      else for (const d of [...w.drops]) if (Math.max(Math.abs(d.x - w.player.lx), Math.abs(d.y - w.player.ly)) <= 1) w.pickup(d);
    }
    // a trip to the camp or town merchant: sell the loot once the load passes 40 % (time not modelled)
    if (opt.gear?.length && i % 300 === 150 && w.weightPct() > 0.4) {
      for (let k = w.player.inv.length - 1; k >= 0; k--) {
        const s = w.player.inv[k];
        if (ITEMS[s.item].type !== 'potion') w.sell(k, s.count);
      }
    }
    if (w.player.dead) w.revive();
    w.update(1 / 30);
    w.events.length = 0;
    opt.onTick?.(w, i);
    if (i % 500 === 0) trace.push([w.map.id, w.player.x, w.player.y, w.player.hp, w.player.level, w.player.xp, w.player.coins, w.monsters.filter((m) => !m.dead).length, w.stats.kills, w.stats.deaths, w.player.inv.length]);
  }
  return { world: w, trace, hash: fnv(JSON.stringify(trace)) };
}

export { World, MAP_BUILDERS };
