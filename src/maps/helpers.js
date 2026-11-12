import { randInt } from "../core/rng.js";

const BUILDING_SIZES = {
  weapon: [3, 2],
  potion: [2, 2],
  temple: [3, 3],
  hall: [3, 2],
  home_a: [2, 2],
  home_b: [2, 3],
};
function fillRect(e, t, n, r, i, a) {
  for (let o = n; o <= i; o++) {
    for (let n = t; n <= r; n++) {
      if (e.inside(n, o)) {
        e.ground[e.idx(n, o)] = a;
      }
    }
  }
}
function fillBlob(e, t, n, r, i, a, o, s = 0.25) {
  for (let c = n - i - 1; c <= n + i + 1; c++) {
    for (let l = t - r - 1; l <= t + r + 1; l++) {
      if (
        e.inside(l, c) &&
        ((l - t) / r) ** 2 + ((c - n) / i) ** 2 < 1 - s * o()
      ) {
        e.ground[e.idx(l, c)] = a;
      }
    }
  }
}
function paintPath(e, t, n, r = 1) {
  for (let i = 0; i < t.length - 1; i++) {
    let [a, o] = t[i];
    let [s, c] = t[i + 1];
    let l = Math.max(Math.abs(s - a), Math.abs(c - o));
    for (let t = 0; t <= l; t++) {
      let i = Math.round(a + ((s - a) * t) / l);
      let u = Math.round(o + ((c - o) * t) / l);
      for (let t = 0; t < r; t++) {
        for (let a = 0; a < r; a++) {
          if (e.inside(i + t, u + a)) {
            e.ground[e.idx(i + t, u + a)] = n;
          }
        }
      }
    }
  }
}
function placeProp(e, t, n, r, i = {}) {
  if (!e.inside(n, r)) {
    return;
  }
  let a =
    /^(bush|rock_|fence|torch_post|grave|well|crates|cart|stall|stairs|cliff)/.test(
      t
    );
  e.addObject({
    key: t,
    atlas: a ? `props_small` : `props_tall`,
    x: n,
    y: r,
    blocks: true,
    tall: !a,
    ...i,
  });
}
function placeBuilding(e, t, n, r) {
  let [i, a] = BUILDING_SIZES[t];
  for (let o = 0; o < i; o++) {
    for (let i = 0; i < a; i++) {
      placeProp(e, `house_${t}_${o}_${i}`, n + o, r + i);
    }
  }
}
function isOpenTile(e, t, n) {
  return e.inside(t, n) && !e.block[e.idx(t, n)] && !e.stair[e.idx(t, n)];
}
function randomizeVariants(e, t) {
  for (let n = 0; n < e.variant.length; n++) {
    e.variant[n] = randInt(t, 0, 3);
  }
}

/**
 * A small hunters' camp (design/gdd/camps.md): clears a ring of `r` tiles around (x, y) to the map's
 * ground, lights a campfire in the middle and puts a merchant beside it. The ring is a safe zone
 * (World.safeHere): regen ×2 and monsters do not follow the player in.
 */
function addCamp(m, { x, y, r = 3, ground = `dirt`, npc }) {
  const inRing = (o) => Math.max(Math.abs(o.x - x), Math.abs(o.y - y)) <= r;
  m.objects = m.objects.filter((o) => !inRing(o));
  for (let yy = y - r; yy <= y + r; yy++)
    for (let xx = x - r; xx <= x + r; xx++) {
      if (!m.inside(xx, yy) || m.elev[m.idx(xx, yy)] || m.stair[m.idx(xx, yy)]) continue;
      m.block[m.idx(xx, yy)] = 0;
      if (m.ground[m.idx(xx, yy)] === `water`) m.ground[m.idx(xx, yy)] = ground;
    }
  placeProp(m, `torch_post`, x, y, { fx: `campfire` });
  m.camps = [...(m.camps ?? []), { x, y, r }];
  m.npcs.push({ kind: `npc_merchant`, facing: `SW`, role: `camp`, ...npc });
}

export {
  addCamp,
  BUILDING_SIZES,
  fillRect,
  fillBlob,
  paintPath,
  placeProp,
  placeBuilding,
  isOpenTile,
  randomizeVariants,
};
