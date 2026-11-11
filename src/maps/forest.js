import { createRng, randInt } from "../core/rng.js";
import {
  fillBlob,
  fillRect,
  isOpenTile,
  paintPath,
  placeProp,
  randomizeVariants,
} from "./helpers.js";
import { GameMap } from "../sim/GameMap.js";

function buildForest() {
  let e = createRng(22);
  let t = new GameMap(`forest`, `솔바람 숲길`, 64, 64, `forest`, `forest`);
  fillBlob(t, 15, 32, 8, 7, `grass`, e);
  fillBlob(t, 31, 20, 6, 5, `grass`, e);
  fillBlob(t, 33, 25, 4, 3, `grass`, e);
  fillBlob(t, 37, 37, 6, 5, `grass`, e);
  fillBlob(t, 49, 13, 6, 5, `dirt`, e, 0.15);
  fillBlob(t, 48, 47, 7, 6, `grave`, e, 0.1);
  paintPath(
    t,
    [
      [0, 32],
      [10, 32],
      [20, 31],
      [27, 28],
      [33, 26],
      [38, 22],
      [44, 16],
      [48, 13],
    ],
    `dirt`,
    2
  );
  paintPath(
    t,
    [
      [33, 26],
      [35, 33],
      [38, 39],
      [44, 44],
      [48, 47],
    ],
    `dirt`,
    2
  );
  paintPath(
    t,
    [
      [48, 47],
      [53, 43],
      [56, 41],
    ],
    `dirt`,
    2
  );
  paintPath(
    t,
    [
      [31, 20],
      [28, 14],
      [25, 7],
      [24, 0],
    ],
    `dirt`,
    2
  );
  for (let e = 31; e <= 39; e++) {
    for (let n = 52; n <= 62; n++) {
      t.elev[t.idx(n, e)] = 1;
      t.ground[t.idx(n, e)] = `grass`;
    }
  }
  t.elev[t.idx(57, 30)] = 1;
  t.ground[t.idx(57, 30)] = `dirt`;
  fillRect(t, 55, 32, 59, 39, `dirt`);
  t.stair[t.idx(57, 40)] = `NE`;
  t.ground[t.idx(57, 40)] = `dirt`;
  fillRect(t, 56, 41, 58, 42, `dirt`);

  placeProp(t, `stairs_NE`, 57, 40, {
    blocks: false,
    tall: false,
  });

  for (let n = 51; n <= 63; n++) {
    for (let r of [29, 30]) {
      if (n !== 57 || r !== 30) {
        placeProp(t, `rockwall_${randInt(e, 0, 2)}`, n, r);
      }
    }
  }

  placeProp(t, `beam_x`, 57, 30, {
    blocks: false,
    tall: true,
    front: true,
  });

  placeProp(t, `torch_post`, 55, 32, {
    fx: `torch`,
  });

  placeProp(t, `torch_post`, 59, 32, {
    fx: `torch`,
  });

  t.exits.push({
    x: 57,
    y: 30,
    to: `mine`,
    tx: 3,
    ty: 23,
    label: `버려진 은광`,
  });

  for (let [e, n] of [
    [46, 10],
    [52, 15],
    [47, 16],
  ]) {
    placeProp(t, `crates`, e, n);
  }

  placeProp(t, `torch_post`, 49, 12, {
    fx: `torch`,
  });

  placeProp(t, `torch_post`, 52, 10, {
    fx: `torch`,
  });

  for (let e = 44; e <= 48; e++) {
    placeProp(t, `fence_x`, e, 8);
  }
  for (let n = 44; n <= 51; n += 2) {
    for (let r = 44; r <= 53; r += 2) {
      if (e() < 0.75 && (r !== 48 || n !== 46)) {
        placeProp(t, e() < 0.5 ? `grave_slab` : `grave_cross`, r, n);
      }
    }
  }
  for (let e = 42; e <= 54; e++) {
    if (e !== 47 && e !== 48) {
      placeProp(t, `fence_x`, e, 41);
    }
  }
  let n = new Set();
  for (let e = 0; e < t.w * t.h; e++) {
    if (t.ground[e] !== `forest`) {
      n.add(e);
    }
  }
  for (let r = 0; r < t.h; r++) {
    for (let i = 0; i < t.w; i++) {
      let a = t.idx(i, r);
      if (n.has(a) || !isOpenTile(t, i, r) || t.elev[a]) {
        continue;
      }
      let o =
        i < 2 || r < 2 || i > t.w - 3 || r > t.h - 3
          ? 0.95
          : 0.36;

      if (e() < o) {
        placeProp(
          t,
          e() < 0.55
            ? `pine_${randInt(e, 0, 1)}`
            : `oak_${randInt(e, 0, 2)}`,
          i,
          r
        );
      } else if (e() < 0.08) {
        placeProp(
          t,
          e() < 0.5
            ? `bush_${randInt(e, 0, 1)}`
            : `rock_${randInt(e, 0, 1)}`,
          i,
          r
        );
      }
    }
  }
  for (let e = 31; e <= 39; e++) {
    placeProp(t, `pine_0`, 51, e);
  }
  for (let [e, n] of [
    [12, 28],
    [19, 36],
    [31, 21],
    [38, 35],
    [30, 30],
    [42, 20],
  ]) {
    if (isOpenTile(t, e, n)) {
      placeProp(t, e % 2 ? `rock_big` : `bush_0`, e, n);
    }
  }

  t.exits.push(
    {
      x: 24,
      y: 0,
      to: `orc`,
      tx: 24,
      ty: 46,
      label: `붉은엄니 오크 영지`,
    },
    {
      x: 25,
      y: 0,
      to: `orc`,
      tx: 25,
      ty: 46,
      label: `붉은엄니 오크 영지`,
    }
  );

  t.exits.push(
    {
      x: 0,
      y: 31,
      to: `town`,
      tx: 35,
      ty: 17,
      label: `그레이월`,
    },
    {
      x: 0,
      y: 32,
      to: `town`,
      tx: 35,
      ty: 17,
      label: `그레이월`,
    },
    {
      x: 0,
      y: 33,
      to: `town`,
      tx: 35,
      ty: 18,
      label: `그레이월`,
    }
  );

  for (let e of t.exits) {
    t.block[t.idx(e.x, e.y)] = 0;
    t.ground[t.idx(e.x, e.y)] = `dirt`;
  }

  t.objects = t.objects.filter((e) => {
    return (
      !t.exits.some((t) => {
        return t.x === e.x && t.y === e.y;
      }) || e.key.startsWith(`beam`)
    );
  });

  t.spawns.push(
    {
      kind: `slime`,
      x: 15,
      y: 32,
      r: 5,
      count: 7,
    },
    {
      kind: `wolf`,
      x: 30,
      y: 19,
      r: 3,
      count: 4,
    },
    {
      kind: `wolf`,
      x: 37,
      y: 38,
      r: 3,
      count: 4,
    },
    {
      kind: `bandit`,
      x: 47,
      y: 12,
      r: 2,
      count: 3,
    },
    {
      kind: `bandit`,
      x: 53,
      y: 17,
      r: 2,
      count: 2,
    },
    {
      kind: `skeleton`,
      x: 48,
      y: 47,
      r: 4,
      count: 4,
    },
    {
      kind: `zombie`,
      x: 48,
      y: 47,
      r: 4,
      count: 4,
      nightOnly: true,
    }
  );

  t.start = {
    x: 2,
    y: 32,
  };

  randomizeVariants(t, e);
  return t;
}

export { buildForest };
