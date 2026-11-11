import { ITEMS } from "../data/items.js";
import { ICON_ATLAS } from "../render/assets.js";

const ICON_URLS = {};
/** Cuts every icon out of the icon atlas into a data URL for the DOM UI. */
async function loadIcons() {
  let e = new Image();
  e.src = ICON_ATLAS.png;
  const [atlas] = await Promise.all([fetch(ICON_ATLAS.json).then((r) => r.json()), e.decode()]);
  for (let [t, n] of Object.entries(atlas.frames)) {
    let r = document.createElement(`canvas`);
    r.width = n.sourceSize.w;
    r.height = n.sourceSize.h;
    r.getContext(`2d`).drawImage(
      e,
      n.frame.x,
      n.frame.y,
      n.frame.w,
      n.frame.h,
      n.spriteSourceSize.x,
      n.spriteSourceSize.y,
      n.frame.w,
      n.frame.h
    );
    ICON_URLS[t] = r.toDataURL();
  }
}
const iconHtml = (e, t = ``) => {
  return `<img class="icon ${t}" src="${
    ICON_URLS[ITEMS[e]?.icon ?? e] ?? ``
  }" alt="">`;
};

export { ICON_URLS, loadIcons, iconHtml };
