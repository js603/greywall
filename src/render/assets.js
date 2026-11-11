/**
 * Asset registry. Every sprite atlas in `assets/sprites/` is a PNG + TexturePacker-style JSON pair
 * drawn with agent-sprite-forge codeart2d; `*.anim.json` holds the 8-direction animation clips.
 * FX in `assets/fx/` were rendered from pixelfx (MIT) via fx_pixelfx.py into `assets/fx/raw/` and packed
 * into trimmed atlases by tools/pack-fx.mjs; `fx.json` holds each effect's frame size, pivot and timing.
 */
import FX_JSON from '../../assets/fx/fx.json';


const spritePngs = import.meta.glob('../../assets/sprites/*.png', { eager: true, query: '?url', import: 'default' });
// Atlas frame tables are fetched by the Phaser loader (URLs keep them out of the JS bundle);
// animation clips are small and needed synchronously, so they are bundled.
const spriteAtlases = import.meta.glob(['../../assets/sprites/*.json', '!**/*.anim.json'], { eager: true, query: '?url', import: 'default' });
const spriteAnims = import.meta.glob('../../assets/sprites/*.anim.json', { eager: true, import: 'default' });
const fxPngs = import.meta.glob('../../assets/fx/*.png', { eager: true, query: '?url', import: 'default' });
const fxAtlases = import.meta.glob(['../../assets/fx/*.json', '!**/fx.json'], { eager: true, query: '?url', import: 'default' });

const baseName = (p) => p.split('/').pop().replace(/\.(png|json)$/, '');

/** URLs of every texture: `{ png, json }` pairs for sprite atlases and packed FX atlases. */
const ASSETS = { atlases: {}, fx: {} };
/** Animation clip tables keyed by sprite name. */
const ANIMS = {};

for (const [file, png] of Object.entries(spritePngs)) {
  const json = spriteAtlases[file.replace('.png', '.json')];
  if (json) ASSETS.atlases[baseName(file)] = { png, json };
}
for (const [file, json] of Object.entries(spriteAnims)) ANIMS[baseName(file).replace('.anim', '')] = json;
for (const [file, png] of Object.entries(fxPngs)) {
  const json = fxAtlases[file.replace('.png', '.json')];
  if (json) ASSETS.fx[baseName(file)] = { png, json };
}

/** FX definitions (frame rects, pivot, fps, loop) keyed by effect name. */
const FX_DEFS = FX_JSON;
/** The item/skill icon atlas, also used by the DOM UI. */
const ICON_ATLAS = ASSETS.atlases.icons;

export { ASSETS, ANIMS, FX_DEFS, ICON_ATLAS };
