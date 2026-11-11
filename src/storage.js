/**
 * The browser's localStorage when the page may use it, else an in-memory stand-in with the same
 * methods. Sandboxed frames (private windows, embeds, hosted previews) can throw on any access;
 * the game then still runs, it just forgets progress when the tab closes.
 */
function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    persistent: false,
  };
}

function pickStorage() {
  try {
    const s = window.localStorage;
    s.setItem(`greywall.probe`, `1`);
    s.removeItem(`greywall.probe`);
    return s;
  } catch {
    return memoryStorage();
  }
}

/** The storage every save and setting goes through. */
const store = pickStorage();

export { store };
