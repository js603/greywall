import { ITEMS } from "../data/items.js";
import { ICON_ATLAS } from "../render/assets.js";

const ICON_URLS = {};
async function loadIcons() {
  let e = new Image();
  e.src = ICON_ATLAS.png;
  await e.decode();
  for (let [t, n] of Object.entries(ICON_ATLAS.json.frames)) {
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
