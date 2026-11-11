/**
 * Corner minimap drawn on a canvas, rotated to match the isometric view (north = up-right).
 * Display only: it reads the world each frame and never changes game state.
 * The terrain layer is drawn once per map; dots (player, monsters, NPCs, exits) are redrawn
 * at most every 200 ms.
 */
const GROUND_COLORS = {
  grass: '#3f6b33',
  forest: '#2f5a2a',
  dirt: '#6b4a2b',
  road: '#6d665c',
  plaza: '#7a7369',
  grave: '#4a4a3f',
  mine: '#4a4440',
  bog: '#4a4a2c',
  water: '#23413f',
};
const BLOCK_COLOR = '#1b1917';
const SCALE = 3; // canvas pixels per tile before rotation

class Minimap {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.terrain = null;
    this.mapId = null;
    this.nextDraw = 0;
  }

  /** Pre-renders the terrain of `map` (ground colours, blocked tiles) in tile space. */
  buildTerrain(map) {
    const c = document.createElement('canvas');
    c.width = map.w * SCALE;
    c.height = map.h * SCALE;
    const g = c.getContext('2d');
    for (let y = 0; y < map.h; y++)
      for (let x = 0; x < map.w; x++) {
        const i = map.idx(x, y);
        g.fillStyle = map.block[i] ? BLOCK_COLOR : GROUND_COLORS[map.ground[i]] ?? '#555';
        g.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
      }
    this.terrain = c;
    this.mapId = map.id;
  }

  /** Redraws the minimap for the current world state. */
  draw(world, now = performance.now()) {
    if (now < this.nextDraw || this.canvas.hidden) return;
    this.nextDraw = now + 200;
    const map = world.map;
    if (!map) return;
    if (map.id !== this.mapId) this.buildTerrain(map);
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // tile (x, y) -> iso: screen x ∝ x - y, screen y ∝ (x + y) / 2; fit the whole map
    const span = map.w + map.h;
    const k = Math.min(W / (span * SCALE), (2 * H) / (span * SCALE)) * 0.98;
    ctx.setTransform(k, k / 2, -k, k / 2, W / 2 - ((map.w - map.h) * SCALE * k) / 2, (H - (span * SCALE * k) / 2) / 2);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.terrain, 0, 0);
    const dot = (x, y, color, r = 1) => {
      ctx.fillStyle = color;
      ctx.fillRect((x - r / 2 + 0.5) * SCALE - SCALE / 2, (y - r / 2 + 0.5) * SCALE - SCALE / 2, SCALE * r, SCALE * r);
    };
    for (const e of map.exits) dot(e.x, e.y, '#f4dc8a', 1.6);
    for (const n of world.npcs) dot(n.x, n.y, '#7290c0', 1.4);
    for (const m of world.monsters) if (!m.dead) dot(m.x, m.y, m.def.named ? '#ff8a3d' : '#d45a48', m.def.named ? 1.8 : 1.2);
    dot(world.player.x, world.player.y, '#ffffff', 2);
  }
}

export { Minimap };
