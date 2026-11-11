function tileToScreen(e, t, n = 0) {
  return {
    x: ((e - t) * 64) / 2,
    y: ((e + t) * 32) / 2 - n,
  };
}
function screenToTile(e, t, n = 0) {
  let r = e / 32;
  let i = (t + n) / 16;
  return {
    x: (r + i) / 2,
    y: (i - r) / 2,
  };
}
function screenToTileRound(e, t, n = 0) {
  let r = screenToTile(e, t, n);
  return {
    x: Math.round(r.x),
    y: Math.round(r.y),
  };
}
const DIRECTIONS = [`S`, `SW`, `W`, `NW`, `N`, `NE`, `E`, `SE`];
const DIR_VECTORS = {
  E: [1, -1],
  SE: [1, 0],
  S: [1, 1],
  SW: [0, 1],
  W: [-1, 1],
  NW: [-1, 0],
  N: [-1, -1],
  NE: [0, -1],
};
function dirFromStep(e, t) {
  let n = Math.sign(e);
  let r = Math.sign(t);
  for (let e of DIRECTIONS) {
    if (DIR_VECTORS[e][0] === n && DIR_VECTORS[e][1] === r) {
      return e;
    }
  }
  return `S`;
}
function dirTowards(e, t, n, r) {
  let i = tileToScreen(e, t);
  let a = tileToScreen(n, r);
  let o = a.x - i.x;
  let s = (a.y - i.y) * 2;
  if (o === 0 && s === 0) {
    return `S`;
  }
  let c = Math.round(Math.atan2(s, o) / (Math.PI / 4));
  return {
    0: `E`,
    1: `SE`,
    2: `S`,
    3: `SW`,
    4: `W`,
    "-4": `W`,
    "-3": `NW`,
    "-2": `N`,
    "-1": `NE`,
  }[String(c)];
}
function stepCost(e, t) {
  return e !== 0 && t !== 0 ? Math.SQRT2 : 1;
}
const NEIGHBORS8 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

export {
  tileToScreen,
  screenToTile,
  screenToTileRound,
  DIRECTIONS,
  DIR_VECTORS,
  dirFromStep,
  dirTowards,
  stepCost,
  NEIGHBORS8,
};
