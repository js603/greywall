import { createRng, randInt } from "../core/rng.js";
import { placeProp, randomizeVariants } from "./helpers.js";
import { GameMap } from "../sim/GameMap.js";

function buildMine() {
  let e = createRng(33);
  let t = new GameMap(`mine`, `버려진 은광`, 48, 44, `mine`, `mine`);
  let n = new Uint8Array(t.w * t.h);

  let r = (e, r, i, a) => {
    for (let o = r; o <= a; o++) {
      for (let r = e; r <= i; r++) {
        if (t.inside(r, o)) {
          n[t.idx(r, o)] = 1;
        }
      }
    }
  };

  let i = (e) => {
    for (let t = 0; t < e.length - 1; t++) {
      let [n, i] = e[t];
      let [a, o] = e[t + 1];
      let s = Math.max(Math.abs(a - n), Math.abs(o - i));
      for (let e = 0; e <= s; e++) {
        r(
          Math.round(n + ((a - n) * e) / s),
          Math.round(i + ((o - i) * e) / s),
          Math.round(n + ((a - n) * e) / s) + 1,
          Math.round(i + ((o - i) * e) / s) + 1
        );
      }
    }
  };

  r(1, 20, 7, 26);
  r(12, 15, 20, 28);
  r(24, 7, 33, 16);
  r(24, 28, 34, 37);
  r(38, 17, 45, 28);
  i([
    [7, 22],
    [12, 21],
  ]);
  i([
    [20, 18],
    [24, 12],
  ]);
  i([
    [20, 25],
    [25, 30],
  ]);
  i([
    [33, 11],
    [36, 16],
    [39, 19],
  ]);
  i([
    [34, 32],
    [37, 27],
    [39, 25],
  ]);
  for (let r = 0; r < t.h; r++) {
    for (let i = 0; i < t.w; i++) {
      let a = t.idx(i, r);
      if (n[a]) {
        continue;
      }
      t.block[a] = 1;
      let o = false;
      for (let e = -1; e <= 1; e++) {
        for (let a = -1; a <= 1; a++) {
          if (t.inside(i + a, r + e) && n[t.idx(i + a, r + e)]) {
            o = true;
          }
        }
      }

      if (o) {
        t.addObject({
          key: `rockwall_${randInt(e, 0, 2)}`,
          atlas: `props_tall`,
          x: i,
          y: r,
          blocks: true,
          tall: true,
        });
      }
    }
  }
  for (let [e, r, i] of [
    [9, 22, `y`],
    [21, 18, `x`],
    [22, 26, `y`],
    [35, 14, `x`],
    [37, 28, `y`],
    [37, 21, `x`],
  ]) {
    if (n[t.idx(e, r)]) {
      placeProp(t, `beam_${i}`, e, r, {
        blocks: false,
        tall: true,
        front: true,
      });
    }
  }
  for (let [e, r] of [
    [3, 20],
    [6, 26],
    [13, 15],
    [19, 28],
    [25, 7],
    [33, 16],
    [24, 37],
    [34, 28],
    [38, 17],
    [45, 28],
    [38, 28],
    [45, 17],
  ]) {
    if (n[t.idx(e, r)]) {
      placeProp(t, `torch_post`, e, r, {
        fx: `torch`,
      });
    }
  }
  for (let [r, i] of [
    [5, 21],
    [14, 27],
    [31, 8],
    [27, 36],
  ]) {
    if (n[t.idx(r, i)] && !t.block[t.idx(r, i)]) {
      placeProp(t, e() < 0.5 ? `cart` : `crates`, r, i);
    }
  }

  t.exits.push({
    x: 1,
    y: 23,
    to: `forest`,
    tx: 57,
    ty: 31,
    label: `솔바람 숲길`,
  });

  t.exits.push(
    {
      x: 45,
      y: 22,
      to: `mine2`,
      tx: 3,
      ty: 21,
      label: `은광 심부`,
    },
    {
      x: 45,
      y: 23,
      to: `mine2`,
      tx: 3,
      ty: 22,
      label: `은광 심부`,
    }
  );

  t.spawns.push(
    {
      kind: `skeleton`,
      x: 16,
      y: 21,
      r: 4,
      count: 5,
    },
    {
      kind: `ghoul`,
      x: 28,
      y: 11,
      r: 3,
      count: 4,
    },
    {
      kind: `skeleton`,
      x: 29,
      y: 33,
      r: 3,
      count: 3,
    },
    {
      kind: `ghoul`,
      x: 30,
      y: 32,
      r: 2,
      count: 1,
    },
    {
      kind: `knight`,
      x: 42,
      y: 22,
      r: 1,
      count: 1,
    }
  );

  t.start = {
    x: 3,
    y: 23,
  };

  randomizeVariants(t, e);
  return t;
}

export { buildMine };
