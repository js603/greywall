import { CLASSES } from "./data/classes.js";
import { MAP_BUILDERS } from "./maps/index.js";
import { MAX_LEVEL } from "./data/progression.js";
import { ITEMS } from "./data/items.js";
import { QUESTS } from "./data/quests.js";
import { SKILLS } from "./data/skills.js";
import { AFFIXES } from "./data/gear.js";

function fnv1a(e) {
  let t = 2166136261;
  for (let n = 0; n < e.length; n++) {
    t ^= e.charCodeAt(n);
    t = Math.imul(t, 16777619) >>> 0;
  }
  return t.toString(16).padStart(8, `0`);
}
function snapshotWorld(e) {
  let t = e.player;
  return {
    map: e.map.id,
    x: t.lx,
    y: t.ly,
    level: t.level,
    xp: t.xp,
    hp: Math.max(1, Math.round(t.hp)),
    mp: Math.round(t.mp),
    coins: t.coins,
    str: t.str,
    dex: t.dex,
    con: t.con,
    lawful: t.lawful,
    inv: t.inv.map((e) => {
      return {
        ...e,
      };
    }),
    equip: {
      ...t.equip,
    },
    equipPlus: {
      ...t.equipPlus,
    },
    equipAffix: {
      ...t.equipAffix,
    },
    skills: [...t.skills],
    skillSlots: [...t.skillSlots],
    cls: t.cls,
    timed: timedState(e),
    quests: JSON.parse(JSON.stringify(e.quests)),
    stats: {
      ...e.stats,
      swingLog: e.stats.swingLog.slice(-400),
    },
    tutorial: {
      ...e.tutorial,
    },
  };
}
/**
 * Running effects and cooldowns as seconds left, so a reload does not clear poison, frost or
 * cooldowns (design/gdd/status-effects.md). Optional in save version 3.
 */
function timedState(w) {
  const p = w.player;
  const left = (until) => Math.max(0, Math.round(((until ?? 0) - w.time) * 10) / 10);
  const buffs = {};
  for (const [id, b] of Object.entries(p.buffs)) if (b.until > w.time) buffs[id] = { ...b, until: left(b.until) };
  const cooldowns = {};
  for (const [id, until] of Object.entries(p.cooldowns)) if (until > w.time) cooldowns[id] = left(until);
  return {
    buffs,
    cooldowns,
    ward: p.ward,
    poison: p.poison ? left(p.poison.until) : 0,
    bless: left(p.blessUntil),
    haste: left(p.hasteUntil),
    brave: left(p.braveUntil),
    mana: left(p.manaUntil),
  };
}
/** Restores `timedState` onto a freshly loaded world. */
function applyTimed(w, t) {
  if (!t || typeof t !== `object`) return;
  const p = w.player;
  const at = (s) => (typeof s === `number` && s > 0 ? w.time + Math.min(s, 3600) : 0);
  for (const [id, b] of Object.entries(t.buffs ?? {})) if (b && typeof b.until === `number`) p.buffs[id] = { ...b, until: at(b.until) };
  for (const [id, s] of Object.entries(t.cooldowns ?? {})) p.cooldowns[id] = at(s);
  p.ward = typeof t.ward === `number` ? Math.max(0, t.ward) : 0;
  if (t.poison > 0) p.poison = { until: at(t.poison), nextTick: w.time + 2 };
  p.blessUntil = at(t.bless);
  p.hasteUntil = at(t.haste);
  p.braveUntil = at(t.brave);
  p.manaUntil = at(t.mana);
}
function serializeSave(e) {
  let t = snapshotWorld(e);
  return {
    game: `greywall`,
    version: 3,
    savedAt: new Date().toISOString(),
    checksum: fnv1a(JSON.stringify(t)),
    data: t,
  };
}
function parseSave(e) {
  if (!e) {
    return {
      ok: false,
      error: `저장 데이터가 없습니다.`,
    };
  }
  let t;
  try {
    t = JSON.parse(e);
  } catch {
    return {
      ok: false,
      error: `저장 파일을 읽을 수 없습니다(손상된 JSON).`,
    };
  }
  if (!t || t.game !== `greywall` || typeof t.version != `number` || !t.data) {
    return {
      ok: false,
      error: `회색성벽 연대기 저장 파일이 아닙니다.`,
    };
  }
  if (t.version > 3) {
    return {
      ok: false,
      error: `더 새로운 버전(v${t.version})의 저장 파일입니다.`,
    };
  }
  let n = false;
  if (t.version === 2) {
    if (fnv1a(JSON.stringify(t.data)) !== t.checksum) {
      return {
        ok: false,
        error: `저장 데이터의 검증값이 맞지 않습니다(손상 또는 수정됨).`,
      };
    }

    t.data.equipPlus = {
      weapon: 0,
      armor: 0,
      shield: 0,
      accessory: 0,
    };

    t.data.quests = t.data.quests ?? {};
    n = true;
  } else if (t.version === 1) {
    t.data.tutorial = t.data.tutorial ?? {};

    t.data.stats = {
      swingLog: [],
      ...(t.data.stats ?? {}),
    };

    n = true;
  } else if (fnv1a(JSON.stringify(t.data)) !== t.checksum) {
    return {
      ok: false,
      error: `저장 데이터의 검증값이 맞지 않습니다(손상 또는 수정됨).`,
    };
  }
  let r = t.data;

  let i = (e, t, n) => {
    return typeof e == `number` && isFinite(e) && e >= t && e <= n;
  };

  for (let e of QUESTS) {
    // quests added in later releases start locked in older saves
    if (r.quests && !r.quests[e.id]) {
      r.quests[e.id] = {
        state: `locked`,
        progress: 0,
      };
    }
  }
  if (!(r.map in MAP_BUILDERS)) {
    return {
      ok: false,
      error: `알 수 없는 지역입니다.`,
    };
  }
  if (
    !i(r.level, 1, MAX_LEVEL) ||
    !i(r.xp, 0, 10000000) ||
    !i(r.coins, 0, 10000000) ||
    !i(r.hp, 0, 10000) ||
    !i(r.mp, 0, 10000)
  ) {
    return {
      ok: false,
      error: `능력치 값이 올바르지 않습니다.`,
    };
  }
  if (
    !Array.isArray(r.inv) ||
    r.inv.length > 24 ||
    r.inv.some((e) => {
      return (
        !ITEMS[e?.item] ||
        e.item === `coin` ||
        !i(e.count, 1, 9999) ||
        (e.plus !== undefined && !i(e.plus, 0, 10)) ||
        // prefixes arrived after save version 3 shipped: optional, and only on a slot they fit
        (e.affix !== undefined && !AFFIXES[e.affix]?.slots.includes(ITEMS[e.item].slot))
      );
    })
  ) {
    return {
      ok: false,
      error: `가방 데이터가 올바르지 않습니다.`,
    };
  }
  for (let [e, t] of Object.entries(r.equip ?? {})) {
    if (t !== null && (!ITEMS[t] || ITEMS[t].slot !== e)) {
      return {
        ok: false,
        error: `장비 데이터가 올바르지 않습니다.`,
      };
    }
  }
  if (
    !r.equipPlus ||
    Object.values(r.equipPlus).some((e) => {
      return !i(e, 0, 10);
    })
  ) {
    return {
      ok: false,
      error: `강화 데이터가 올바르지 않습니다.`,
    };
  }
  if (
    r.equipAffix !== undefined &&
    Object.entries(r.equipAffix ?? {}).some(([slot, a]) => a !== null && (!AFFIXES[a]?.slots.includes(slot) || !r.equip?.[slot]))
  ) {
    return {
      ok: false,
      error: `장비 접두사 데이터가 올바르지 않습니다.`,
    };
  }
  if (
    !Array.isArray(r.skills) ||
    r.skills.some((e) => {
      return !SKILLS[e];
    })
  ) {
    return {
      ok: false,
      error: `스킬 데이터가 올바르지 않습니다.`,
    };
  }
  if (r.cls !== undefined && r.cls !== null && !CLASSES[r.cls]) {
    return {
      ok: false,
      error: `직업 데이터가 올바르지 않습니다.`,
    };
  }
  // skill slots arrived after save version 3 shipped: optional, four entries of null or a learned skill
  if (
    r.skillSlots !== undefined &&
    (!Array.isArray(r.skillSlots) ||
      r.skillSlots.length !== 4 ||
      r.skillSlots.some((e) => e !== null && !r.skills.includes(e)))
  ) {
    return {
      ok: false,
      error: `스킬 슬롯 데이터가 올바르지 않습니다.`,
    };
  }
  for (let e of QUESTS) {
    if (!r.quests?.[e.id]) {
      return {
        ok: false,
        error: `의뢰 데이터가 올바르지 않습니다.`,
      };
    }
  }
  return {
    ok: true,
    data: r,
    migrated: n,
  };
}
function applySave(e, t) {
  let n = e.player;

  Object.assign(n, {
    level: t.level,
    xp: t.xp,
    coins: t.coins,
    str: t.str,
    dex: t.dex,
    con: t.con,
    lawful:
      typeof t.lawful == `number`
        ? Math.max(-32768, Math.min(32767, t.lawful))
        : 0,
    inv: t.inv.map((e) => {
      return {
        ...e,
      };
    }),
    equip: {
      weapon: null,
      armor: null,
      shield: null,
      accessory: null,
      ...t.equip,
    },
    equipPlus: {
      weapon: 0,
      armor: 0,
      shield: 0,
      accessory: 0,
      ...t.equipPlus,
    },
    equipAffix: {
      weapon: null,
      armor: null,
      shield: null,
      accessory: null,
      ...t.equipAffix,
    },
    skills: [...t.skills],
    // older saves: fill the skill slots with the learned skills in learning order
    skillSlots: t.skillSlots
      ? [...t.skillSlots]
      : [0, 1, 2, 3].map((i) => t.skills[i] ?? null),
    cls: t.cls ?? null,
    sprite: CLASSES[t.cls]?.sprite ?? `player`,
    buffs: {},
    ward: 0,
    dead: false,
    poison: null,
    blessUntil: 0,
  });

  e.quests = JSON.parse(JSON.stringify(t.quests));

  e.stats = {
    ...e.stats,
    ...t.stats,
  };

  e.tutorial = {
    ...t.tutorial,
  };

  e.recalc();
  n.hp = Math.min(n.maxHp, Math.max(1, t.hp));
  n.mp = Math.min(n.maxMp, t.mp);
  // a run in the abyss is not resumed: the player wakes by the gatekeeper (design/gdd/endgame-abyss.md)
  if (t.map === `abyss`) e.loadMap(`aqueduct`, 6, 27);
  else e.loadMap(t.map, t.x, t.y);
  applyTimed(e, t.timed);

  if (t.map !== `abyss` && !e.map.walkable(t.x, t.y)) {
    e.loadMap(t.map);
  }

  e.setAction(n, `idle`);
}
function saveKeys(e) {
  let t = e ? `greywall.dev` : `greywall`;
  return {
    main: t + `.save`,
    backup: t + `.save.bak`,
  };
}
function writeSave(e, t) {
  let n = saveKeys(t.dev);
  try {
    let r = e.getItem(n.main);

    if (r && parseSave(r).ok) {
      e.setItem(n.backup, r);
    }

    e.setItem(n.main, JSON.stringify(serializeSave(t)));
    return true;
  } catch {
    return false;
  }
}

export {
  fnv1a,
  snapshotWorld,
  serializeSave,
  parseSave,
  applySave,
  saveKeys,
  writeSave,
};

/**
 * Returns the current save as a JSON string for a file download, or null when there is none.
 * @param {Storage} storage
 * @param {boolean} dev
 */
function exportSave(storage, dev) {
  return storage.getItem(saveKeys(dev).main);
}

/**
 * Validates a save file's text and, when it is valid, makes it the current save.
 * The save it replaces is kept as the backup slot.
 * @param {Storage} storage
 * @param {boolean} dev
 * @param {string} text
 * @returns {{ok: true, data: object} | {ok: false, error: string}}
 */
function importSave(storage, dev, text) {
  const parsed = parseSave(text);
  if (!parsed.ok) return parsed;
  const keys = saveKeys(dev);
  const current = storage.getItem(keys.main);
  if (current && parseSave(current).ok) storage.setItem(keys.backup, current);
  storage.setItem(keys.main, text);
  return parsed;
}

/** File name for an exported save, e.g. `greywall-lv7-2026-11-11.json`. */
function saveFileName(level, date = new Date()) {
  return `greywall-lv${level}-${date.toISOString().slice(0, 10)}.json`;
}

export { exportSave, importSave, saveFileName };
