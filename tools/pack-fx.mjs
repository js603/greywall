// Packs the raw pixelfx sheets in assets/fx/raw/ into tight atlases in assets/fx/.
//
//   node tools/pack-fx.mjs [name ...]     (no names: every effect in assets/fx/raw/fx.json)
//
// Input (what fx_pixelfx.py renders): raw/<name>.png, a grid of fixed-size frames, and its entry
// in raw/fx.json ({ w, h, rects, durations, pivot, loop, ... }).
// Output: <name>.png + <name>.json (Phaser/TexturePacker hash atlas, frames "0".."n-1" trimmed to
// their opaque pixels, identical frames stored once) and fx.json (the entry without `rects`).
// Trimmed frames keep their source size, so pivots and origins are unchanged in game.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const DIR = new URL('../assets/fx/', import.meta.url).pathname;
const raw = JSON.parse(readFileSync(DIR + 'raw/fx.json', 'utf8'));
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(raw);
const MAX = 2048;
const PAD = 1;

/** Tight opaque bounds of one frame, or null when it is empty. */
function trim(png, fx, fy, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (png.data[((fy + y) * png.width + fx + x) * 4 + 3]) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function copy(src, sx, sy, w, h, dst, dx, dy) {
  for (let y = 0; y < h; y++)
    src.data.copy(dst.data, ((dy + y) * dst.width + dx) * 4, ((sy + y) * src.width + sx) * 4, ((sy + y) * src.width + sx + w) * 4);
}

/** Shelf packing; returns positions and sheet size for a given sheet width. */
function shelf(boxes, width) {
  const order = boxes.map((b, i) => i).sort((a, b) => boxes[b].h - boxes[a].h || boxes[b].w - boxes[a].w);
  const pos = [];
  let x = 0, y = 0, rowH = 0, usedW = 0;
  for (const i of order) {
    const b = boxes[i];
    if (x + b.w > width) { x = 0; y += rowH + PAD; rowH = 0; }
    pos[i] = { x, y };
    x += b.w + PAD; rowH = Math.max(rowH, b.h); usedW = Math.max(usedW, x - PAD);
  }
  return { pos, w: usedW, h: y + rowH };
}

const out = {};
let before = 0, after = 0;
for (const [name, def] of Object.entries(raw)) {
  const { rects, ...meta } = def;
  out[name] = meta;
  if (!names.includes(name)) continue;
  const png = PNG.sync.read(readFileSync(DIR + `raw/${name}.png`));
  before += png.width * png.height * 4;

  // trim + dedupe frames
  const uniq = []; const byHash = new Map(); const frameOf = [];
  for (const [rx, ry] of rects) {
    const t = trim(png, rx, ry, def.w, def.h) ?? { x: 0, y: 0, w: 1, h: 1 };
    const px = new PNG({ width: t.w, height: t.h });
    copy(png, rx + t.x, ry + t.y, t.w, t.h, px, 0, 0);
    const key = createHash('sha1').update(px.data).update(`${t.x},${t.y}`).digest('hex');
    if (!byHash.has(key)) { byHash.set(key, uniq.length); uniq.push({ ...t, px }); }
    frameOf.push(byHash.get(key));
  }

  // pick the sheet width with the smallest area
  let best = null;
  const widest = Math.max(...uniq.map((u) => u.w));
  for (let w = widest; w <= MAX; w += 8) {
    const s = shelf(uniq, w);
    if (s.h > MAX) continue;
    if (!best || s.w * s.h < best.w * best.h) best = s;
  }
  if (!best) throw new Error(`${name}: frames do not fit in ${MAX}x${MAX}`);

  const sheet = new PNG({ width: best.w, height: best.h });
  uniq.forEach((u, i) => copy(u.px, 0, 0, u.w, u.h, sheet, best.pos[i].x, best.pos[i].y));
  writeFileSync(DIR + `${name}.png`, PNG.sync.write(sheet, { colorType: 6 }));
  after += best.w * best.h * 4;

  const frames = {};
  frameOf.forEach((u, i) => {
    const f = uniq[u]; const p = best.pos[u];
    frames[String(i)] = {
      frame: { x: p.x, y: p.y, w: f.w, h: f.h },
      rotated: false,
      trimmed: true,
      spriteSourceSize: { x: f.x, y: f.y, w: f.w, h: f.h },
      sourceSize: { w: def.w, h: def.h },
    };
  });
  writeFileSync(DIR + `${name}.json`, JSON.stringify({ frames, meta: { image: `${name}.png`, size: { w: best.w, h: best.h }, scale: 1, source: def.id, credits: def.credits } }) + '\n');
  console.log(`${name.padEnd(9)} ${png.width}x${png.height} -> ${best.w}x${best.h}  frames ${rects.length} -> ${uniq.length} unique`);
}
writeFileSync(DIR + 'fx.json', JSON.stringify(out, null, 1) + '\n');
if (before) console.log(`decoded RGBA: ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB`);
