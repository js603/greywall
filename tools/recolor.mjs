// Palette-variant pipeline for the code-drawn sprites (the original PixelSpecs were lost, so new
// monster variants are made by recolouring the existing codeart2d atlases in HSV, which keeps every
// frame, anchor and animation clip intact).
//
//   node tools/recolor.mjs sprite <src> <dst> <transform-json>
//       assets/sprites/<src>.{png,json,anim.json} -> assets/sprites/<dst>.{png,json,anim.json}
//   node tools/recolor.mjs frame <atlas>:<srcFrame> <dstFrame> <transform-json>
//       appends one recoloured frame (e.g. an item icon) to assets/sprites/<atlas>.{png,json}
//   node tools/recolor.mjs tiles <srcPrefix> <dstPrefix> <transform-json>
//       appends <dstPrefix>_0..3 and ov_<dstPrefix>_* frames, recoloured from <srcPrefix>, to the tile atlas
//
// transform-json: {"hue": deg (set) | "hueShift": deg, "sat": mult, "val": mult, "keepDark": 0..1}
//   keepDark leaves pixels darker than that value untouched (outlines stay black).
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const DIR = new URL('../assets/sprites/', import.meta.url).pathname;
const [mode, src, dst, tjson] = process.argv.slice(2);
if (!mode || !src || !dst || !tjson) {
  console.error('usage: node tools/recolor.mjs sprite|tiles <src> <dst> <transform-json>');
  process.exit(2);
}
const T = JSON.parse(tjson);

function rgb2hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, max ? d / max : 0, max];
}
function hsv2rgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
/** Recolours pixels in place inside the rectangle (all of the image when rect is omitted). */
function recolor(png, rect = { x: 0, y: 0, w: png.width, h: png.height }) {
  const cache = new Map();
  for (let y = rect.y; y < rect.y + rect.h; y++)
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      const i = (y * png.width + x) * 4;
      if (!png.data[i + 3]) continue;
      const key = (png.data[i] << 16) | (png.data[i + 1] << 8) | png.data[i + 2];
      let out = cache.get(key);
      if (!out) {
        let [h, s, v] = rgb2hsv(png.data[i], png.data[i + 1], png.data[i + 2]);
        if (v < (T.keepDark ?? 0)) out = [png.data[i], png.data[i + 1], png.data[i + 2]];
        else {
          h = T.hue !== undefined ? T.hue : (h + (T.hueShift ?? 0) + 360) % 360;
          s = Math.min(1, s * (T.sat ?? 1));
          v = Math.min(1, v * (T.val ?? 1));
          out = hsv2rgb(h, s, v);
        }
        cache.set(key, out);
      }
      png.data[i] = out[0]; png.data[i + 1] = out[1]; png.data[i + 2] = out[2];
    }
}

if (mode === 'sprite') {
  const png = PNG.sync.read(readFileSync(DIR + `${src}.png`));
  recolor(png);
  writeFileSync(DIR + `${dst}.png`, PNG.sync.write(png, { colorType: 6 }));
  const atlas = JSON.parse(readFileSync(DIR + `${src}.json`, 'utf8'));
  if (atlas.meta) atlas.meta.image = `${dst}.png`;
  writeFileSync(DIR + `${dst}.json`, JSON.stringify(atlas, null, 1) + '\n');
  const anim = JSON.parse(readFileSync(DIR + `${src}.anim.json`, 'utf8'));
  anim.name = dst;
  anim.artSource = `${anim.artSource ?? 'code'}; palette variant of ${src} via tools/recolor.mjs ${JSON.stringify(T)}`;
  writeFileSync(DIR + `${dst}.anim.json`, JSON.stringify(anim, null, 1) + '\n');
  console.log(`sprite ${src} -> ${dst}`);
} else if (mode === 'tiles' || mode === 'frame') {
  const sheet = mode === 'tiles' ? 'tiles' : src.split(':')[0];
  const png = PNG.sync.read(readFileSync(DIR + `${sheet}.png`));
  const atlas = JSON.parse(readFileSync(DIR + `${sheet}.json`, 'utf8'));
  const srcName = mode === 'tiles' ? src : src.split(':')[1];
  const names = mode === 'tiles'
    ? Object.keys(atlas.frames).filter((n) => n.startsWith(`${src}_`) || n.startsWith(`ov_${src}_`))
    : [srcName].filter((n) => atlas.frames[n]);
  if (!names.length) throw new Error(`no frames for ${src}`);
  if (Object.keys(atlas.frames).some((n) => n === dst || n.startsWith(`${dst}_`))) throw new Error(`${dst} already exists`);
  // new row below the atlas, frames laid out left to right
  const rowH = Math.max(...names.map((n) => atlas.frames[n].frame.h));
  const out = new PNG({ width: png.width, height: png.height + rowH + 2 });
  png.data.copy(out.data, 0);
  let x = 0;
  const y = png.height + 2;
  for (const n of names) {
    const f = atlas.frames[n];
    for (let r = 0; r < f.frame.h; r++)
      png.data.copy(out.data, ((y + r) * out.width + x) * 4, ((f.frame.y + r) * png.width + f.frame.x) * 4, ((f.frame.y + r) * png.width + f.frame.x + f.frame.w) * 4);
    recolor(out, { x, y, w: f.frame.w, h: f.frame.h });
    atlas.frames[mode === 'tiles' ? n.replace(src, dst) : dst] = { ...f, frame: { ...f.frame, x, y } };
    x += f.frame.w + 2;
    if (x > out.width) throw new Error('tile row overflow');
  }
  atlas.meta.size = { w: out.width, h: out.height };
  writeFileSync(DIR + `${sheet}.png`, PNG.sync.write(out, { colorType: 6 }));
  writeFileSync(DIR + `${sheet}.json`, JSON.stringify(atlas, null, 1) + '\n');
  console.log(`${sheet}: ${src} -> ${dst}: ${names.length} frames`);
}
