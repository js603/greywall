import { DIR_VECTORS } from "../core/iso.js";

class GameMap {
  constructor(id, name, w, h, i, music) {
    this.objects = [];
    this.exits = [];
    this.spawns = [];
    this.npcs = [];

    this.start = {
      x: 1,
      y: 1,
    };

    this.safe = false;
    this.id = id;
    this.name = name;
    this.w = w;
    this.h = h;
    this.music = music;
    let o = w * h;
    this.ground = Array(o).fill(i);
    this.variant = Array(o).fill(0);
    this.elev = Array(o).fill(0);
    this.stair = Array(o).fill(null);
    this.block = new Uint8Array(o);
  }
  idx(e, t) {
    return t * this.w + e;
  }
  inside(e, t) {
    return e >= 0 && t >= 0 && e < this.w && t < this.h;
  }
  walkable(e, t) {
    return this.inside(e, t) && !this.block[this.idx(e, t)];
  }
  elevAt(e, t) {
    return this.inside(e, t) ? this.elev[this.idx(e, t)] : 0;
  }
  stairAt(e, t) {
    return this.inside(e, t) ? this.stair[this.idx(e, t)] : null;
  }
  floorLevel(e, t) {
    return this.stairAt(e, t) ? 0.5 : this.elevAt(e, t);
  }
  canStep(e, t, n, r) {
    if (!this.walkable(n, r) || !this.walkable(e, t)) {
      return false;
    }
    let i = n - e;
    let a = r - t;
    if (Math.abs(i) > 1 || Math.abs(a) > 1 || (i === 0 && a === 0)) {
      return false;
    }
    let o = this.stairAt(e, t);
    let s = this.stairAt(n, r);
    if (i !== 0 && a !== 0) {
      if (o || s || !this.walkable(e + i, t) || !this.walkable(e, t + a)) {
        return false;
      }
      let c = this.elevAt(e, t);
      return !(
        this.elevAt(n, r) !== c ||
        this.elevAt(e + i, t) !== c ||
        this.elevAt(e, t + a) !== c ||
        this.stairAt(e + i, t) ||
        this.stairAt(e, t + a)
      );
    }
    if (o || s) {
      let i = o
        ? {
            x: e,
            y: t,
            d: o,
            ox: n,
            oy: r,
          }
        : {
            x: n,
            y: r,
            d: s,
            ox: e,
            oy: t,
          };

      let a = DIR_VECTORS[i.d];
      let c = i.ox === i.x + a[0] && i.oy === i.y + a[1];
      let l = i.ox === i.x - a[0] && i.oy === i.y - a[1];
      return o && s
        ? false
        : c
        ? this.elevAt(i.ox, i.oy) === this.elevAt(i.x, i.y) + 1
        : l
        ? this.elevAt(i.ox, i.oy) === this.elevAt(i.x, i.y)
        : false;
    }
    return this.elevAt(e, t) === this.elevAt(n, r);
  }
  canReach(e, t, n, r) {
    let i = n - e;
    let a = r - t;
    return Math.max(Math.abs(i), Math.abs(a)) !== 1 ||
      (i !== 0 &&
        a !== 0 &&
        (!this.walkable(e + i, t) || !this.walkable(e, t + a)))
      ? false
      : this.stairAt(e, t) || this.stairAt(n, r)
      ? this.canStep(e, t, n, r)
      : this.elevAt(e, t) === this.elevAt(n, r);
  }
  lineOfSight(e, t, n, r) {
    let i = e;
    let a = t;
    let o = Math.abs(n - e);
    let s = Math.abs(r - t);
    let c = e < n ? 1 : -1;
    let l = t < r ? 1 : -1;
    let u = o - s;
    let d = this.elevAt(e, t);

    while (i !== n || a !== r) {
      let e = 2 * u;

      if (e > -s) {
        u -= s;
        i += c;
      }

      if (e < o) {
        u += o;
        a += l;
      }

      if (i === n && a === r) {
        break;
      }

      if (
        !this.inside(i, a) ||
        this.block[this.idx(i, a)] ||
        this.elevAt(i, a) !== d
      ) {
        return false;
      }
    }

    return this.elevAt(n, r) === d;
  }
  addObject(e) {
    this.objects.push(e);

    if (e.blocks && this.inside(e.x, e.y)) {
      this.block[this.idx(e.x, e.y)] = 1;
    }
  }
  objectAt(e, t) {
    return this.objects.find((n) => {
      return n.x === e && n.y === t;
    });
  }
}

export { GameMap };
