import { createRng, randInt } from "../core/rng.js";
import {
  BUILDING_SIZES,
  fillBlob,
  isOpenTile,
  paintPath,
  placeProp,
  randomizeVariants,
} from "./helpers.js";
import { GameMap } from "../sim/GameMap.js";

function buildOrcLands() {
  let e = createRng(44);
  let t = new GameMap(`orc`, `붉은엄니 오크 영지`, 52, 50, `forest`, `forest`);
  fillBlob(t, 25, 26, 17, 15, `dirt`, e, 0.12);
  fillBlob(t, 25, 38, 9, 6, `grass`, e);
  fillBlob(t, 12, 22, 6, 5, `grass`, e);
  fillBlob(t, 38, 22, 6, 5, `grass`, e);
  paintPath(
    t,
    [
      [24, 49],
      [24, 40],
      [25, 30],
      [25, 12],
    ],
    `dirt`,
    2
  );
  for (let e = 10; e <= 40; e++) {
    for (let n of [13, 33]) {
      if (e < 23 || e > 26) {
        placeProp(t, `fence_x`, e, n);
      }
    }
  }
  for (let e = 14; e <= 32; e++) {
    for (let n of [10, 40]) {
      if (e < 21 || e > 23) {
        placeProp(t, `fence_y`, n, e);
      }
    }
  }
  for (let [e, n, r] of [
    [13, 15, `home_a`],
    [34, 15, `home_b`],
    [13, 27, `home_b`],
    [35, 28, `home_a`],
  ]) {
    let [i, a] = BUILDING_SIZES[r];
    for (let o = 0; o < i; o++) {
      for (let i = 0; i < a; i++) {
        placeProp(t, `house_${r}_${o}_${i}`, e + o, n + i);
      }
    }
  }
  for (let [e, n] of [
    [20, 20],
    [30, 25],
    [22, 29],
    [26, 38],
  ]) {
    placeProp(t, `torch_post`, e, n, {
      fx: `campfire`,
    });
  }
  for (let [n, r] of [
    [17, 18],
    [31, 18],
    [18, 30],
    [32, 31],
    [29, 16],
  ]) {
    placeProp(t, e() < 0.5 ? `crates` : `cart`, n, r);
  }
  for (let [n, r] of [
    [21, 24],
    [28, 21],
    [24, 17],
    [33, 24],
    [16, 23],
  ]) {
    placeProp(t, e() < 0.5 ? `rock_big` : `rock_0`, n, r);
  }
  for (let e = 3; e <= 10; e++) {
    for (let n = 19; n <= 31; n++) {
      t.elev[t.idx(n, e)] = 1;
      t.ground[t.idx(n, e)] = `dirt`;
    }
  }
  t.stair[t.idx(25, 11)] = `NE`;
  t.ground[t.idx(25, 11)] = `dirt`;

  placeProp(t, `stairs_NE`, 25, 11, {
    blocks: false,
    tall: false,
  });

  for (let n = 18; n <= 32; n++) {
    placeProp(t, `rockwall_${randInt(e, 0, 2)}`, n, 2);
  }
  for (let [e, n] of [
    [21, 5],
    [29, 5],
  ]) {
    placeProp(t, `torch_post`, e, n, {
      fx: `torch`,
    });
  }
  for (let n = 0; n < t.h; n++) {
    for (let r = 0; r < t.w; r++) {
      let i = t.idx(r, n);
      if (t.ground[i] !== `forest` || !isOpenTile(t, r, n) || t.elev[i]) {
        continue;
      }
      let a = r < 2 || n < 2 || r > t.w - 3 || n > t.h - 3;

      if (e() < (a ? 0.95 : 0.42)) {
        placeProp(
          t,
          e() < 0.6
            ? `pine_${randInt(e, 0, 1)}`
            : `oak_${randInt(e, 0, 2)}`,
          r,
          n
        );
      }
    }
  }
  t.exits.push(
    {
      x: 24,
      y: 49,
      to: `forest`,
      tx: 24,
      ty: 2,
      label: `솔바람 숲길`,
    },
    {
      x: 25,
      y: 49,
      to: `forest`,
      tx: 25,
      ty: 2,
      label: `솔바람 숲길`,
    }
  );
  for (let e of t.exits) {
    t.block[t.idx(e.x, e.y)] = 0;
    t.ground[t.idx(e.x, e.y)] = `dirt`;
  }

  t.objects = t.objects.filter((e) => {
    return !t.exits.some((t) => {
      return t.x === e.x && t.y === e.y;
    });
  });

  t.spawns.push(
    {
      kind: `orc`,
      x: 16,
      y: 21,
      r: 3,
      count: 4,
    },
    {
      kind: `orc`,
      x: 33,
      y: 21,
      r: 3,
      count: 4,
    },
    {
      kind: `orc`,
      x: 25,
      y: 37,
      r: 4,
      count: 4,
    },
    {
      kind: `orc_chief`,
      x: 25,
      y: 6,
      r: 1,
      count: 1,
    },
    {
      kind: `orc_archer`,
      x: 25,
      y: 15,
      r: 2,
      count: 2,
    },
    {
      kind: `orc_archer`,
      x: 36,
      y: 27,
      r: 2,
      count: 1,
    },
    {
      kind: `orc_archer`,
      x: 14,
      y: 26,
      r: 2,
      count: 1,
    }
  );

  t.start = {
    x: 24,
    y: 46,
  };

  randomizeVariants(t, e);
  return t;
}

export { buildOrcLands };
