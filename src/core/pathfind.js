import { NEIGHBORS8, stepCost } from "./iso.js";

function findPath(e, t, n, r, i, a = {}) {
  let o = e.w;
  let s = e.h;
  let c = o * s;

  let l =
    a.goalTest ??
    ((e, t) => {
      return e === r && t === i;
    });

  if (l(t, n)) {
    return [];
  }
  let u = new Float32Array(c).fill(Infinity);
  let d = new Int32Array(c).fill(-1);
  let f = new Uint8Array(c);
  let p = [];
  let m = [];

  let h = (e, t) => {
    let n = Math.abs(e - r);
    let a = Math.abs(t - i);
    return Math.max(n, a) - Math.min(n, a) + Math.min(n, a) * Math.SQRT2;
  };

  let g = (e, t) => {
    p.push(e);
    m.push(t);
    let n = p.length - 1;

    while (n > 0) {
      let e = (n - 1) >> 1;
      if (m[e] <= m[n]) {
        break;
      }
      [p[e], p[n]] = [p[n], p[e]];
      [m[e], m[n]] = [m[n], m[e]];
      n = e;
    }
  };

  let y = () => {
    let e = p[0];
    let t = p.pop();
    let n = m.pop();
    if (p.length) {
      p[0] = t;
      m[0] = n;
      let e = 0;

      while (true) {
        let t = 2 * e + 1;
        let n = t + 1;
        let r = e;

        if (t < p.length && m[t] < m[r]) {
          r = t;
        }

        if (n < p.length && m[n] < m[r]) {
          r = n;
        }

        if (r === e) {
          break;
        }

        [p[r], p[e]] = [p[e], p[r]];
        [m[r], m[e]] = [m[e], m[r]];
        e = r;
      }
    }
    return e;
  };

  let b = n * o + t;
  u[b] = 0;
  g(b, h(t, n));
  let x = 0;
  let S = a.maxNodes ?? 6000;

  while (p.length) {
    let t = y();
    if (f[t]) {
      continue;
    }
    f[t] = 1;
    let n = t % o;
    let r = (t / o) | 0;
    if (l(n, r)) {
      let e = [];
      let n = t;

      while (n !== b) {
        e.push([n % o, (n / o) | 0]);
        n = d[n];
      }

      return e.reverse();
    }
    if (++x > S) {
      break;
    }
    for (let [i, c] of NEIGHBORS8) {
      let p = n + i;
      let m = r + c;
      if (p < 0 || m < 0 || p >= o || m >= s) {
        continue;
      }
      let v = m * o + p;
      if (f[v] || !e.canStep(n, r, p, m)) {
        continue;
      }
      let y = stepCost(i, c);
      if (a.occupied && a.occupied(p, m)) {
        if (l(p, m)) {
          continue;
        }
        y += 8;
      }
      let b = u[t] + y;

      if (b < u[v]) {
        u[v] = b;
        d[v] = t;
        g(v, b + h(p, m));
      }
    }
  }

  return null;
}

export { findPath };
