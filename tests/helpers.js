// Shared helpers for headless tests: the simulation runs in Node without Phaser or the DOM.
import { fnv, huntRun, World, MAP_BUILDERS } from '../tools/sim/hunt.js';

export const mapHash = (m) =>
  fnv(JSON.stringify([m.w, m.h, Array.from(m.ground), Array.from(m.block), m.objects.length, m.spawns, m.exits, m.npcs ?? null]));

export { fnv, huntRun, World, MAP_BUILDERS };
