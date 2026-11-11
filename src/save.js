import { ITEMS } from "./data/items.js";
import { QUESTS } from "./data/quests.js";
import { SKILLS } from "./data/skills.js";

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
    skills: [...t.skills],
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
    if (n && !r.quests[e.id]) {
      r.quests[e.id] = {
        state: `locked`,
        progress: 0,
      };
    }
  }
  if (![`town`, `forest`, `mine`, `orc`, `mine2`].includes(r.map)) {
    return {
      ok: false,
      error: `알 수 없는 지역입니다.`,
    };
  }
  if (
    !i(r.level, 1, 16) ||
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
        (e.plus !== undefined && !i(e.plus, 0, 10))
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
    skills: [...t.skills],
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
  e.loadMap(t.map, t.x, t.y);

  if (!e.map.walkable(t.x, t.y)) {
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
