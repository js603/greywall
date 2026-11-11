import { createRng, randInt } from "../core/rng.js";
import {
  fillRect,
  isOpenTile,
  paintPath,
  placeBuilding,
  placeProp,
  randomizeVariants,
} from "./helpers.js";
import { GameMap } from "../sim/GameMap.js";

function buildTown() {
  let e = createRng(11);
  let t = new GameMap(
    `town`,
    `회색성벽 마을 그레이월`,
    38,
    36,
    `grass`,
    `town`
  );
  t.safe = true;
  fillRect(t, 5, 5, 30, 30, `grass`);
  fillRect(t, 14, 14, 21, 21, `plaza`);
  paintPath(
    t,
    [
      [22, 17],
      [37, 17],
    ],
    `road`,
    2
  );
  paintPath(
    t,
    [
      [17, 5],
      [17, 30],
    ],
    `road`,
    2
  );
  paintPath(
    t,
    [
      [5, 17],
      [14, 17],
    ],
    `road`,
    2
  );
  paintPath(
    t,
    [
      [15, 10],
      [17, 10],
    ],
    `road`,
    1
  );
  paintPath(
    t,
    [
      [10, 23],
      [14, 21],
    ],
    `dirt`,
    1
  );
  paintPath(
    t,
    [
      [22, 25],
      [21, 21],
    ],
    `dirt`,
    1
  );
  paintPath(
    t,
    [
      [22, 10],
      [21, 14],
    ],
    `dirt`,
    1
  );
  for (let e = 4; e <= 31; e++) {
    for (let [n, r] of [
      [e, 4],
      [e, 31],
      [4, e],
      [31, e],
    ]) {
      if (n !== 31 || (r !== 17 && r !== 18)) {
        placeProp(
          t,
          ((n === 4 || n === 31) && (r === 4 || r === 31)) ||
            (n === 31 && (r === 16 || r === 19))
            ? `tower`
            : `wall_${(n + r) % 2}`,
          n,
          r
        );
      }
    }
  }
  for (let n = 0; n < t.h; n++) {
    for (let r = 0; r < t.w; r++) {
      if (
        (r < 4 || n < 4 || r > 31 || n > 31) &&
        t.ground[t.idx(r, n)] !== `road` &&
        isOpenTile(t, r, n)
      ) {
        if (r < 32 || n < 14 || n > 21) {
          if (e() < 0.55) {
            placeProp(
              t,
              e() < 0.7
                ? `oak_${randInt(e, 0, 2)}`
                : `pine_${randInt(e, 0, 1)}`,
              r,
              n
            );
          }
        }
      }
    }
  }
  for (let e = 7; e <= 12; e++) {
    for (let n = 7; n <= 13; n++) {
      t.elev[t.idx(n, e)] = 1;
    }
  }
  fillRect(t, 7, 7, 13, 12, `plaza`);
  t.stair[t.idx(14, 10)] = `NW`;
  t.ground[t.idx(14, 10)] = `road`;

  placeProp(t, `stairs_NW`, 14, 10, {
    blocks: false,
    tall: false,
  });

  placeBuilding(t, `temple`, 8, 7);

  placeProp(t, `torch_post`, 12, 8, {
    fx: `torch`,
  });

  placeProp(t, `torch_post`, 13, 12, {
    fx: `torch`,
  });

  placeBuilding(t, `weapon`, 21, 7);
  placeBuilding(t, `potion`, 8, 20);
  placeBuilding(t, `hall`, 21, 23);
  placeBuilding(t, `home_a`, 25, 12);
  placeBuilding(t, `home_b`, 6, 25);
  placeBuilding(t, `home_a`, 26, 26);
  placeProp(t, `well`, 17, 17);
  t.ground[t.idx(17, 17)] = `plaza`;
  placeProp(t, `stall`, 15, 15);
  placeProp(t, `stall`, 20, 20);
  for (let [e, n] of [
    [14, 14],
    [21, 14],
    [14, 21],
    [21, 21],
    [30, 15],
    [30, 20],
  ]) {
    placeProp(t, `torch_post`, e, n, {
      fx: `torch`,
    });
  }
  placeProp(t, `crates`, 24, 9);
  placeProp(t, `crates`, 10, 22);
  placeProp(t, `cart`, 28, 21);
  for (let e = 24; e <= 29; e++) {
    placeProp(t, `fence_x`, e, 29);
  }
  for (let [n, r] of [
    [6, 6],
    [29, 6],
    [6, 12],
    [28, 29],
    [12, 28],
    [24, 19],
  ]) {
    placeProp(t, `oak_${randInt(e, 0, 2)}`, n, r);
  }
  placeProp(t, `bush_0`, 19, 6);
  placeProp(t, `bush_1`, 27, 15);
  placeProp(t, `rock_0`, 6, 19);

  t.exits.push(
    {
      x: 37,
      y: 17,
      to: `forest`,
      tx: 2,
      ty: 32,
      label: `솔바람 숲길`,
    },
    {
      x: 37,
      y: 18,
      to: `forest`,
      tx: 2,
      ty: 33,
      label: `솔바람 숲길`,
    }
  );

  t.npcs.push(
    {
      id: `guard`,
      kind: `npc_guard`,
      name: `경비병 브람`,
      x: 29,
      y: 18,
      facing: `SW`,
      role: `guard`,
    },
    {
      id: `smith`,
      kind: `npc_merchant`,
      name: `대장장이 고른`,
      x: 22,
      y: 10,
      facing: `SW`,
      role: `smith`,
    },
    {
      id: `alchemist`,
      kind: `npc_alchemist`,
      name: `연금술사 미라`,
      x: 9,
      y: 23,
      facing: `SE`,
      role: `alchemist`,
    },
    {
      id: `trainer`,
      kind: `npc_trainer`,
      name: `검술 교관 하르덴`,
      x: 22,
      y: 26,
      facing: `SW`,
      role: `trainer`,
    },
    {
      id: `priest`,
      kind: `npc_priest`,
      name: `사제 엘린`,
      x: 11,
      y: 11,
      facing: `SE`,
      role: `priest`,
    }
  );

  t.start = {
    x: 19,
    y: 18,
  };

  randomizeVariants(t, e);
  return t;
}

export { buildTown };
