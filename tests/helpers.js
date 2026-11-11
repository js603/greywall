// Shared helpers for headless tests: the simulation runs in Node without Phaser or the DOM.
import { World } from '../src/sim/World.js';
import { MAP_BUILDERS } from '../src/maps/index.js';

export const fnv = (s) => {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; }
  return x.toString(16);
};

export const mapHash = (m) =>
  fnv(JSON.stringify([m.w, m.h, Array.from(m.ground), Array.from(m.block), m.objects.length, m.spawns, m.exits, m.npcs ?? null]));

/** Seeded hunting run in the forest: always attack the nearest monster, drink potions, revive. */
export function huntRun(seed = 4242, ticks = 20000) {
  const w = new World(MAP_BUILDERS, seed);
  w.loadMap('forest');
  const trace = [];
  for (let i = 0; i < ticks; i++) {
    if (w.map.id !== 'forest') w.loadMap('forest');
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
    if (i % 500 === 0) trace.push([w.map.id, w.player.x, w.player.y, w.player.hp, w.player.level, w.player.xp, w.player.coins, w.monsters.filter((m) => !m.dead).length, w.stats.kills, w.stats.deaths, w.player.inv.length]);
  }
  return { world: w, trace, hash: fnv(JSON.stringify(trace)) };
}

export { World, MAP_BUILDERS };
