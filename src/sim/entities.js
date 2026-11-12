import { PLAYER_STEP } from "./constants.js";

class Entity {
  constructor(id, kind, name, sprite, fx, fy, stepBase) {
    this.t = 1;
    this.stepDur = 0.4;
    this.moving = false;
    this.path = [];
    this.facing = `S`;
    this.hp = 1;
    this.maxHp = 1;
    this.dead = false;
    this.action = `idle`;
    this.actionStart = 0;
    this.swing = null;
    this.nextSwingAt = 0;
    this.lastHurtAt = -99;
    this.id = id;
    this.kind = kind;
    this.name = name;
    this.sprite = sprite;
    this.x = fx;
    this.fx = fx;
    this.y = fy;
    this.fy = fy;
    this.stepBase = stepBase;
  }
  get lx() {
    return this.t < 0.5 ? this.fx : this.x;
  }
  get ly() {
    return this.t < 0.5 ? this.fy : this.y;
  }
  get px() {
    return this.fx + (this.x - this.fx) * this.t;
  }
  get py() {
    return this.fy + (this.y - this.fy) * this.t;
  }
}
class Monster extends Entity {
  constructor(e, def, homeX, homeY, spawnIdx) {
    super(e, `monster`, def.name, def.sprite, homeX, homeY, def.step);
    this.state = `idle`;
    this.stateUntil = 0;
    this.nextThink = 0;
    this.nextRepath = 0;
    this.provoked = false;
    this.respawnAt = 0;
    this.removeAt = 0;
    this.gone = false;
    this.def = def;
    this.hp = this.maxHp = def.hp;
    this.homeX = homeX;
    this.homeY = homeY;
    this.spawnIdx = spawnIdx;
  }
}
class Npc extends Entity {
  constructor(e, npcId, n, r, i, a, facing, role) {
    super(e, `npc`, n, r, i, a, 1);
    this.facing = facing;
    this.role = role;
    this.npcId = npcId;
    this.hp = 1;
    this.maxHp = 1;
  }
}
class Player extends Entity {
  constructor() {
    super(0, `player`, `모험가`, `player`, 0, 0, PLAYER_STEP);
    this.level = 1;
    this.xp = 0;
    this.mp = 8;
    this.maxMp = 8;
    this.coins = 30;
    this.str = 12;
    this.dex = 10;
    this.con = 12;
    this.inv = [];

    this.equip = {
      weapon: `old_sword`,
      armor: `cloth_tunic`,
      shield: `wood_shield`,
      accessory: null,
    };

    this.skills = [];
    /** Skill ids in the four assignable skill quickslots (5-8), null = empty. */
    this.skillSlots = [null, null, null, null];
    /** Class id after the class change (design/gdd/class-change.md), null = adventurer. */
    this.cls = null;
    /** Timed buffs by id: { until, ...effect } (fortress, bloodrage, ward). */
    this.buffs = {};
    /** Damage the sacred ward can still absorb. */
    this.ward = 0;
    this.cooldowns = {};
    this.target = null;
    this.targetKind = null;
    this.queuedSkill = null;
    this.dirInput = null;
    this.cast = null;
    this.resting = false;

    this.equipPlus = {
      weapon: 0,
      armor: 0,
      shield: 0,
      accessory: 0,
    };

    this.hasteUntil = 0;
    this.braveUntil = 0;
    this.manaUntil = 0;
    this.lawful = 0;
    this.blessUntil = 0;
    this.poison = null;
    this.deadAt = 0;
    this.nextRegen = 0;
    this.nextMpRegen = 0;
    this.hp = 30;
    this.maxHp = 30;
  }
}

export { Entity, Monster, Npc, Player };
