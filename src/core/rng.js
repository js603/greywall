function createRng(e) {
  let t = e >>> 0;
  return function () {
    t = (t + 1831565813) >>> 0;
    let e = t;
    e = Math.imul(e ^ (e >>> 15), e | 1);
    e ^= e + Math.imul(e ^ (e >>> 7), e | 61);
    return ((e ^ (e >>> 14)) >>> 0) / 4294967296;
  };
}
const randInt = (e, t, n) => {
  return t + Math.floor(e() * (n - t + 1));
};

export { createRng, randInt };
