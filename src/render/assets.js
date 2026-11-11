/**
 * Asset registry. Every sprite atlas in `assets/sprites/` is a PNG + TexturePacker-style JSON pair
 * drawn with agent-sprite-forge codeart2d; `*.anim.json` holds the 8-direction animation clips.
 * FX sheets in `assets/fx/` were rendered from pixelfx (MIT) via fx_pixelfx.py; `fx.json` holds
 * each effect's frame rects, pivot and timing.
 */
import FX_JSON from '../../assets/fx/fx.json';

const spritePngs = import.meta.glob('../../assets/sprites/*.png', { eager: true, query: '?url', import: 'default' });
const spriteJsons = import.meta.glob('../../assets/sprites/*.json', { eager: true, import: 'default' });
const fxPngs = import.meta.glob('../../assets/fx/*.png', { eager: true, query: '?url', import: 'default' });

const baseName = (p) => p.split('/').pop().replace(/\.(png|json)$/, '');

/** @type {{atlases: Record<string, {png: string, json: object}>, fx: Record<string, string>}} */
const ASSETS = { atlases: {}, fx: {} };
/** Animation clip tables keyed by sprite name. */
const ANIMS = {};

for (const [file, png] of Object.entries(spritePngs)) {
  const json = spriteJsons[file.replace('.png', '.json')];
  if (json) ASSETS.atlases[baseName(file)] = { png, json };
}
for (const [file, json] of Object.entries(spriteJsons)) {
  if (file.endsWith('.anim.json')) ANIMS[baseName(file).replace('.anim', '')] = json;
}
for (const [file, png] of Object.entries(fxPngs)) ASSETS.fx[baseName(file)] = png;

/** FX definitions (frame rects, pivot, fps, loop) keyed by effect name. */
const FX_DEFS = FX_JSON;
/** The item/skill icon atlas, also used by the DOM UI. */
const ICON_ATLAS = ASSETS.atlases.icons;

export { ASSETS, ANIMS, FX_DEFS, ICON_ATLAS };
