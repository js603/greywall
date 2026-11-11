// Headless hunting driver shared by tests and tools/balance-sim.mjs.
// Always attacks the nearest living monster, drinks a red potion below 40% HP, picks up loot,
// revives on death. Deterministic for a given seed.
import { World } from '../../src/sim/World.js';
import { MAP_BUILDERS } from '../../src/maps/index.js';
import { XP_TABLE } from '../../src/data/progression.js';

export const fnv = (s) => {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; }
  return x.toString(16);
};

/**
 * @param {number} seed
 * @param {number} ticks  30 ticks = 1 s of game time
 * @param {{map?: string, level?: number, gear?: string[], onTick?: (w: World, i: number) => void}} [opt]
 */
export function huntRun(seed = 4242, ticks = 20000, opt = {}) {
  const map = opt.map ?? 'forest';
  const w = new World(MAP_BUILDERS, seed);
  if (opt.level > 1) w.gainXp(XP_TABLE[opt.level]);
  for (const g of opt.gear ?? []) { w.give(g, 1); w.equip(w.player.inv.findIndex((s) => s.item === g)); }
  w.loadMap(map);
  const trace = [];
  for (let i = 0; i < ticks; i++) {
    if (w.map.id !== map) w.loadMap(map);
    if (i % 40 === 0 && !w.player.target && !w.player.dead) {
      let best = null, bd = 1e9;
      for (const m of w.monsters) if (!m.dead) { const d = Math.hypot(m.x - w.player.x, m.y - w.player.y); if (d < bd) { bd = d; best = m; } }
      if (best) w.commandAttack(best.id);
    }
    if (w.player.hp < w.player.maxHp * 0.4 && i % 30 === 0) {
      const k = w.player.inv.findIndex((s) => s.item === 'potion_red');
      if (k >= 0) w.useItem(k); else w.give('potion_red', 5);
    }
    if (i % 300 === 0) w.pickupNearby();
    if (w.player.dead) w.revive();
    w.update(1 / 30);
    w.events.length = 0;
    opt.onTick?.(w, i);
    if (i % 500 === 0) trace.push([w.map.id, w.player.x, w.player.y, w.player.hp, w.player.level, w.player.xp, w.player.coins, w.monsters.filter((m) => !m.dead).length, w.stats.kills, w.stats.deaths, w.player.inv.length]);
  }
  return { world: w, trace, hash: fnv(JSON.stringify(trace)) };
}

export { World, MAP_BUILDERS };
