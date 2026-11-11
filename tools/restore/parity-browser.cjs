// Compares the original dist and the restored build: map generation and a seeded headless sim run.
const { chromium } = require('playwright');
const probe = () => {
  const W = window.__gw.world.constructor, maps = window.__gw.world.maps;
  const h = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; } return x.toString(16); };
  const out = {};
  for (const [k, f] of Object.entries(maps)) { const m = f(); out['map_' + k] = h(JSON.stringify([m.w, m.h, Array.from(m.ground), Array.from(m.block), m.objects.length, m.spawns, m.exits, m.npcs ?? null])); }
  const w = new W(maps, 4242); w.loadMap('forest');
  const trace = [];
  for (let i = 0; i < 20000; i++) {
    if (w.map.id !== 'forest') w.loadMap('forest');
    if (i % 40 === 0 && !w.player.target && !w.player.dead) {
      let best = null, bd = 1e9;
      for (const m of w.monsters) if (!m.dead) { const d = Math.hypot(m.x - w.player.x, m.y - w.player.y); if (d < bd) { bd = d; best = m; } }
      if (best) w.commandAttack(best.id);
    }
    if (w.player.hp < w.player.maxHp * 0.4 && i % 30 === 0) { const k = w.player.inv.findIndex(s => s.item === 'potion_red'); if (k >= 0) w.useItem(k); else w.give('potion_red', 5); }
    if (i % 300 === 0) w.pickupNearby();
    if (w.player.dead) w.revive();
    w.update(1 / 30); w.events.length = 0;
    if (i % 500 === 0) trace.push([w.map.id, w.player.x, w.player.y, w.player.hp, w.player.level, w.player.xp, w.player.coins, w.monsters.filter(m=>!m.dead).length, w.stats.kills, w.stats.deaths, w.player.inv.length]);
  }
  out.sim = h(JSON.stringify(trace)); out.trace = trace.slice(-2); out.log = w.log.length;
  return out;
};
(async () => {
  const b = await chromium.launch(); const res = {};
  for (const [name, url] of [['orig', 'http://localhost:8765/'], ['restored', 'http://localhost:8766/']]) {
    const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(url); await p.waitForTimeout(1500);
    res[name] = await p.evaluate(probe); res[name].errs = errs; await p.close();
  }
  console.log(JSON.stringify(res, null, 1));
  const keys = Object.keys(res.orig).filter(k => k !== 'errs');
  console.log('PARITY', keys.every(k => JSON.stringify(res.orig[k]) === JSON.stringify(res.restored[k])) ? 'OK' : 'MISMATCH');
  await b.close();
})();
