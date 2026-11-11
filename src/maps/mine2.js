import { createRng, randInt } from "../core/rng.js";
import { placeProp, randomizeVariants } from "./helpers.js";
import { GameMap } from "../sim/GameMap.js";

function buildDeepMine() {
  let e = createRng(55);
  let t = new GameMap(`mine2`, `은광 심부`, 50, 44, `mine`, `mine`);
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
        let t = Math.round(n + ((a - n) * e) / s);
        let c = Math.round(i + ((o - i) * e) / s);
        r(t, c, t + 1, c + 1);
      }
    }
  };

  r(1, 18, 7, 25);
  r(11, 6, 21, 15);
  r(11, 27, 22, 37);
  r(26, 16, 34, 27);
  r(38, 12, 47, 31);
  i([
    [7, 21],
    [12, 14],
  ]);
  i([
    [7, 23],
    [12, 29],
  ]);
  i([
    [21, 11],
    [27, 17],
  ]);
  i([
    [22, 32],
    [27, 26],
  ]);
  i([
    [34, 21],
    [38, 21],
  ]);
  for (let [e, r] of [
    [28, 18],
    [32, 18],
    [28, 25],
    [32, 25],
    [30, 21],
    [41, 17],
    [41, 26],
    [44, 21],
  ]) {
    n[t.idx(e, r)] = 0;
  }
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
  for (let e = 14; e <= 22; e++) {
    for (let r = 43; r <= 47; r++) {
      if (n[t.idx(r, e)]) {
        t.elev[t.idx(r, e)] = 1;
        t.ground[t.idx(r, e)] = `plaza`;
      }
    }
  }
  t.stair[t.idx(45, 23)] = `NE`;

  placeProp(t, `stairs_NE`, 45, 23, {
    blocks: false,
    tall: false,
  });

  for (let [e, r] of [
    [43, 23],
    [44, 23],
    [46, 23],
    [47, 23],
  ]) {
    if (n[t.idx(e, r)]) {
      placeProp(t, `rock_big`, e, r);
    }
  }
  for (let [e, r, i] of [
    [9, 17, `y`],
    [9, 26, `y`],
    [24, 14, `x`],
    [24, 29, `x`],
    [36, 21, `y`],
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
    [2, 18],
    [7, 25],
    [11, 6],
    [21, 15],
    [11, 37],
    [22, 27],
    [26, 16],
    [34, 27],
    [38, 12],
    [38, 31],
    [47, 12],
    [43, 14],
    [47, 22],
  ]) {
    if (n[t.idx(e, r)] && !t.block[t.idx(e, r)]) {
      placeProp(t, `torch_post`, e, r, {
        fx: `torch`,
      });
    }
  }
  for (let [r, i] of [
    [14, 9],
    [19, 13],
    [13, 33],
    [20, 30],
  ]) {
    if (n[t.idx(r, i)] && !t.block[t.idx(r, i)]) {
      placeProp(t, e() < 0.5 ? `cart` : `crates`, r, i);
    }
  }

  t.exits.push(
    {
      x: 1,
      y: 21,
      to: `mine`,
      tx: 43,
      ty: 22,
      label: `버려진 은광`,
    },
    {
      x: 1,
      y: 22,
      to: `mine`,
      tx: 43,
      ty: 23,
      label: `버려진 은광`,
    }
  );

  t.spawns.push(
    {
      kind: `spider`,
      x: 16,
      y: 10,
      r: 4,
      count: 6,
    },
    {
      kind: `wraith`,
      x: 16,
      y: 32,
      r: 4,
      count: 5,
    },
    {
      kind: `spider`,
      x: 30,
      y: 22,
      r: 3,
      count: 2,
    },
    {
      kind: `wraith`,
      x: 31,
      y: 20,
      r: 3,
      count: 2,
    },
    {
      kind: `wraith`,
      x: 40,
      y: 27,
      r: 2,
      count: 2,
    },
    {
      kind: `lich`,
      x: 45,
      y: 17,
      r: 1,
      count: 1,
    }
  );

  t.start = {
    x: 3,
    y: 21,
  };

  randomizeVariants(t, e);
  return t;
}

export { buildDeepMine };
