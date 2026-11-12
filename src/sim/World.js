import { DIR_VECTORS, dirFromStep, dirTowards, stepCost } from "../core/iso.js";
import { findPath } from "../core/pathfind.js";
import { createRng, randInt } from "../core/rng.js";
import { ITEMS } from "../data/items.js";
import { MONSTERS } from "../data/monsters.js";
import { MAX_LEVEL, XP_TABLE } from "../data/progression.js";
import { QUESTS } from "../data/quests.js";
import { SHOPS } from "../data/shops.js";
import { RECIPES } from "../data/recipes.js";
import { SKILLS } from "../data/skills.js";
import { CLASSES } from "../data/classes.js";
import {
  ACTION_TIMING,
  DAY_LENGTH,
  ENCHANT_SAFE,
  DEFENSE_K,
  HIT_SLOPE,
  HIT_BASE,
  SWING_CANCEL_DELAY,
} from "./constants.js";
import { Monster, Npc, Player } from "./entities.js";

class World {
  constructor(maps, t = 12345) {
    this.time = 0;
    this.nextId = 1;
    this.player = new Player();
    this.monsters = [];
    this.npcs = [];
    this.drops = [];
    this.projectiles = [];
    this.occ = new Map();
    this.events = [];
    this.log = [];
    this.quests = {};

    this.stats = {
      basicSwings: 0,
      strikeUses: 0,
      healUses: 0,
      blessUses: 0,
      kills: 0,
      deaths: 0,
      potions: 0,
      play: 0,
      firstSkillAt: null,
      firstSkillUseAt: null,
      firstStrikeBookAt: null,
      firstStrikeSource: null,
      swingLog: [],
    };

    this.tutorial = {};
    this.pendingExit = null;
    this.dev = false;
    this.wasNight = null;
    this.wasHeavy = false;
    this.maps = maps;
    this.rng = createRng(t);
    for (let e of QUESTS) {
      this.quests[e.id] = {
        state: `locked`,
        progress: 0,
      };
    }

    this.player.inv = [
      {
        item: `potion_red`,
        count: 3,
      },
      {
        item: `scroll_return`,
        count: 1,
      },
    ];

    this.refreshQuests();
    this.recalc();
  }
  emit(e) {
    this.events.push(e);
  }
  msg(e, t = `info`) {
    this.log.push({
      t: this.time,
      text: e,
      kind: t,
    });

    if (this.log.length > 200) {
      this.log.shift();
    }

    this.emit({
      type: `msg`,
      text: e,
      kind: t,
    });
  }
  tileIdx(e, t) {
    return t * this.map.w + e;
  }
  occupant(e, t) {
    return this.occ.get(this.tileIdx(e, t));
  }
  isOccupied(e, t, n) {
    let r = this.occupant(e, t);
    return r !== undefined && r !== n;
  }
  entity(e) {
    if (e === 0) {
      return this.player;
    }

    return (
      this.monsters.find((t) => {
        return t.id === e;
      }) ??
      this.npcs.find((t) => {
        return t.id === e;
      })
    );
  }
  setAction(e, t) {
    if (e.action !== t) {
      e.action = t;
      e.actionStart = this.time;
    }
  }
  restartAction(e, t) {
    e.action = t;
    e.actionStart = this.time;
  }
  item(e) {
    return ITEMS[e];
  }
  weapon() {
    return ITEMS[this.player.equip.weapon ?? ``] ?? null;
  }
  pAcc() {
    let e = this.weapon();
    return (
      (this.player.equip.accessory
        ? ITEMS[this.player.equip.accessory].hit ?? 0
        : 0) +
      (e?.acc ?? 0) +
      Math.floor(this.effPlus(`weapon`) / 2) +
      Math.floor((this.player.dex - 10) / 2) +
      Math.floor(this.player.level / 2) +
      (this.time < this.player.blessUntil ? 3 : 0) +
      this.passive(`acc`)
    );
  }
  pDmgBonus() {
    let e = this.player;
    let t = Math.floor((e.str - 10) / 2) + Math.floor(e.level / 3) + this.passive(`dmg`);
    for (let n of Object.values(e.equip)) {
      if (n && ITEMS[n].str) {
        t += ITEMS[n].str;
      }
    }

    if (this.time < e.blessUntil) {
      t += 2;
    }

    return t + this.effPlus(`weapon`);
  }
  /** A passive value of the player's class, or `fallback` for an adventurer. */
  passive(key, fallback = 0) {
    return CLASSES[this.player.cls]?.passive?.[key] ?? fallback;
  }
  /** True while the timed buff `id` is running. */
  buffActive(id) {
    return (this.player.buffs[id]?.until ?? 0) > this.time;
  }
  /** Product of the damage-taken multipliers of the running buffs. */
  dmgTakenMult() {
    let m = 1;
    for (const b of Object.values(this.player.buffs)) if (b.until > this.time && b.dmgTaken) m *= b.dmgTaken;
    return m;
  }
  pAC() {
    let e = this.player;
    let t = this.effPlus(`armor`) + this.effPlus(`shield`) + this.passive(`ac`);
    for (let n of Object.values(e.equip)) {
      if (n) {
        t += ITEMS[n].ac ?? 0;
      }
    }
    return t;
  }
  pBlock() {
    let e = this.player.equip.shield;
    return (e ? ITEMS[e].block ?? 0 : 0) + this.passive(`block`);
  }
  pInterval() {
    let e = this.weapon()?.interval ?? 1.8;
    let t = this.time < this.player.braveUntil
      ? Math.round(e * 0.85 * 100) / 100
      : e;
    let m = this.passive(`intervalMult`, 1);
    for (const b of Object.values(this.player.buffs)) if (b.until > this.time && b.interval) m *= b.interval;
    return m === 1 ? t : Math.round(t * m * 100) / 100;
  }
  isNight() {
    return this.daylight() < 0.35;
  }
  daylight() {
    let e =
      ((this.stats.play + DAY_LENGTH * 0.08) % DAY_LENGTH) /
      DAY_LENGTH;
    return e < 0.55
      ? 1
      : e < 0.65
      ? 1 - (e - 0.55) / 0.1
      : e < 0.88
      ? 0
      : (e - 0.88) / 0.12;
  }
  weight() {
    let e = this.player;
    let t = 0;
    for (let n of e.inv) {
      t += (ITEMS[n.item].weight ?? 2) * n.count;
    }
    for (let n of Object.values(e.equip)) {
      if (n) {
        t += ITEMS[n].weight ?? 2;
      }
    }
    return t;
  }
  capacity() {
    let e = this.player;
    return 300 + e.str * 15 + e.con * 10;
  }
  weightPct() {
    return this.weight() / this.capacity();
  }
  /** Natural regen share from the load (design/gdd/progression.md): 1 up to 30 %, falling to 0 at 50 %. */
  /**
   * Bonus points an enhanced slot gives (design/gdd/enhancement.md): +1 per step up to the safe line,
   * +2 per step past it, and +2 more at +10.
   */
  effPlus(slot) {
    const plus = this.player.equipPlus[slot] ?? 0;
    const safe = slot === `weapon` ? ENCHANT_SAFE.weapon : ENCHANT_SAFE.armor;
    return plus + Math.max(0, plus - safe) + (plus >= 10 ? 2 : 0);
  }
  /** True where the player is safe: a town map, or inside a camp's safe radius. */
  safeHere() {
    const m = this.map;
    if (!m) return false;
    if (m.safe) return true;
    const p = this.player;
    return (m.camps ?? []).some((c) => Math.max(Math.abs(p.x - c.x), Math.abs(p.y - c.y)) <= c.r);
  }
  regenFactor() {
    return Math.max(0, Math.min(1, (0.5 - this.weightPct()) / 0.2));
  }
  /** True when the load slows natural regen (30 % or more). */
  burdened() {
    return this.weightPct() >= 0.3;
  }
  lawfulName() {
    let e = this.player.lawful;
    return e >= 1000
      ? `정의로움`
      : e >= 300
      ? `선량함`
      : e > -100
      ? `중립`
      : `혼돈`;
  }
  /** Buying price of item `e` (at shop `shopId`, whose `markup` applies; alignment discount otherwise). */
  priceOf(e, shopId) {
    let t = this.player.lawful;
    let n = t >= 1000 ? 0.9 : t >= 300 ? 0.95 : 1;
    const markup = SHOPS[shopId]?.markup;
    return Math.max(1, Math.round(ITEMS[e].price * (markup ?? n)));
  }
  itemName(e, t = 0) {
    return (t > 0 ? `+${t} ` : ``) + ITEMS[e].name;
  }
  pEva() {
    return Math.floor((this.player.dex - 10) / 2);
  }
  recalc() {
    let e = this.player;
    let t = 0;
    for (let n of Object.values(e.equip)) {
      if (n) {
        t += ITEMS[n].hp ?? 0;
      }
    }
    e.maxHp = 30 + 8 * (e.level - 1) + (e.con - 12) * 2 + t;
    e.maxMp = 8 + 3 * (e.level - 1);
    if (e.cls) {
      e.maxHp = Math.round(e.maxHp * this.passive(`hpMult`, 1));
      e.maxMp = Math.round(e.maxMp * this.passive(`mpMult`, 1));
    }
    e.hp = Math.min(e.hp, e.maxHp);
    e.mp = Math.min(e.mp, e.maxMp);
  }
  loadMap(e, t, n) {
    this.map = this.maps[e]();
    this.occ.clear();
    this.monsters = [];
    this.npcs = [];
    this.drops = [];
    this.projectiles = [];
    let r = this.player;
    let i = t ?? this.map.start.x;
    let a = n ?? this.map.start.y;
    r.x = i;
    r.fx = i;
    r.y = a;
    r.fy = a;
    r.t = 1;
    r.moving = false;
    r.path = [];
    r.swing = null;
    r.cast = null;
    r.target = null;
    r.queuedSkill = null;
    r.resting = false;
    this.occ.set(this.tileIdx(i, a), 0);

    this.map.spawns.forEach((e, t) => {
      for (let n = 0; n < e.count; n++) {
        this.spawnMonster(t, true);
      }
    });

    for (let e of this.map.npcs) {
      let t = new Npc(
        this.nextId++,
        e.id,
        e.name,
        e.kind,
        e.x,
        e.y,
        e.facing,
        e.role
      );
      this.npcs.push(t);
      this.occ.set(this.tileIdx(e.x, e.y), t.id);
    }
    this.pendingExit = null;
    this.wasNight = this.isNight();

    this.emit({
      type: `mapchange`,
      map: e,
    });

    this.msg(`${this.map.name}에 들어섰다.`, `sys`);
  }
  spawnMonster(e, t = false) {
    let n = this.map.spawns[e];
    let r = MONSTERS[n.kind];
    if (n.nightOnly && !this.isNight()) {
      return null;
    }
    for (let i = 0; i < 30; i++) {
      let i = n.x + randInt(this.rng, -n.r, n.r);
      let a = n.y + randInt(this.rng, -n.r, n.r);
      if (
        !this.map.walkable(i, a) ||
        this.isOccupied(i, a) ||
        this.map.stairAt(i, a) ||
        (!t &&
          Math.max(Math.abs(i - this.player.x), Math.abs(a - this.player.y)) <
            7)
      ) {
        continue;
      }
      let o = new Monster(this.nextId++, r, i, a, e);
      o.facing = [`S`, `SW`, `SE`, `E`, `W`][randInt(this.rng, 0, 4)];
      o.homeX = n.x;
      o.homeY = n.y;
      o.nextThink = this.time + this.rng() * 3;
      this.monsters.push(o);
      this.occ.set(this.tileIdx(i, a), o.id);

      if (!t) {
        this.emit({
          type: `spawn`,
          id: o.id,
        });
      }

      return o;
    }
    return null;
  }
  tryStep(e, t, n) {
    return !this.map.canStep(e.x, e.y, t, n) || this.isOccupied(t, n, e.id)
      ? false
      : ((e.fx = e.x),
        (e.fy = e.y),
        (e.x = t),
        (e.y = n),
        (e.t = 0),
        (e.moving = true),
        (e.stepDur =
          e.stepBase *
          stepCost(t - e.fx, n - e.fy) *
          // ice: everyone slides across it faster
          (this.map.ground[this.map.idx(t, n)] === `ice` ? 0.7 : 1) *
          (e === this.player && this.time < this.player.hasteUntil
            ? 0.75
            : 1) *
          // soaked (nagas in the aqueduct): heavier steps (design/gdd/status-effects.md)
          (e === this.player && this.buffActive(`soak`) ? this.player.buffs.soak.step : 1)),
        (e.facing = dirFromStep(t - e.fx, n - e.fy)),
        this.occ.set(this.tileIdx(t, n), e.id),
        this.setAction(e, `walk`),
        e === this.player &&
          (e.fx !== e.x || e.fy !== e.y) &&
          this.emit({
            type: `step`,
            id: e.id,
          }),
        true);
  }
  advanceMovers(e) {
    let t = [this.player, ...this.monsters];
    for (let n of t) {
      if (n.moving && ((n.t = Math.min(1, n.t + e / n.stepDur)), n.t >= 1)) {
        n.moving = false;
        let e = this.tileIdx(n.fx, n.fy);

        if (this.occ.get(e) === n.id) {
          this.occ.delete(e);
        }

        n.fx = n.x;
        n.fy = n.y;

        if (n === this.player) {
          this.onPlayerArrive();
        }
      }
    }
  }
  onPlayerArrive() {
    let e = this.player;
    for (let t of [...this.drops]) {
      if (t.x === e.x && t.y === e.y) {
        this.pickup(t);
      }
    }
    let t = this.map.exits.find((t) => {
      return t.x === e.x && t.y === e.y;
    });

    if (t) {
      this.pendingExit = {
        to: t.to,
        tx: t.tx,
        ty: t.ty,
      };

      e.path = [];
      e.dirInput = null;
    }

    if (e.targetKind === `drop` && e.path.length === 0) {
      e.target = null;
      e.targetKind = null;
    }
  }
  cancelSwingForMove() {
    let e = this.player;

    if (e.swing) {
      if (this.time < e.swing.hitAt) {
        e.swing = null;
        e.nextSwingAt = Math.max(
          e.nextSwingAt - 0,
          this.time + SWING_CANCEL_DELAY
        );

        this.emit({
          type: `swingcancel`,
        });
      } else {
        e.swing = null;
      }
    }

    if (e.cast && !e.cast.applied) {
      e.cast = null;
      this.msg(`시전이 취소되었다.`, `warn`);
    } else {
      e.cast &&= null;
    }
  }
  commandMove(e, t) {
    let n = this.player;
    if (n.dead || !this.map.inside(e, t)) {
      return false;
    }
    this.cancelSwingForMove();
    n.target = null;
    n.targetKind = null;
    n.queuedSkill = null;
    n.resting = false;
    let r = e;
    let i = t;
    if (!this.map.walkable(e, t) || this.isOccupied(e, t, 0)) {
      let n = this.nearestFree(e, t, 3);
      if (!n) {
        this.emit({
          type: `blocked`,
          x: e,
          y: t,
        });

        return false;
      }
      r = n[0];
      i = n[1];
    }
    let a = n.x;
    let o = n.y;

    let s = findPath(this.map, a, o, r, i, {
      occupied: (e, t) => {
        return this.isOccupied(e, t, 0);
      },
    });

    return s
      ? ((n.path = s),
        (this.tutorial.moved = true),
        this.emit({
          type: `dest`,
          x: r,
          y: i,
        }),
        true)
      : (this.emit({
          type: `blocked`,
          x: e,
          y: t,
        }),
        (n.path = []),
        false);
  }
  nearestFree(e, t, n) {
    let r = null;
    let i = 1000000000;
    for (let a = -n; a <= n; a++) {
      for (let o = -n; o <= n; o++) {
        let n = e + o;
        let s = t + a;
        if (!this.map.walkable(n, s) || this.isOccupied(n, s, 0)) {
          continue;
        }
        let c = Math.hypot(o, a);

        if (c < i) {
          i = c;
          r = [n, s];
        }
      }
    }
    return r;
  }
  commandAttack(e) {
    let t = this.player;

    if (!t.dead) {
      if (
        this.monsters.find((t) => {
          return t.id === e && !t.dead;
        })
      ) {
        t.cast && !t.cast.applied && (t.cast = null);
        t.resting = false;
        t.target = e;
        t.targetKind = `monster`;
        t.path = [];
        t.dirInput = null;

        this.emit({
          type: `target`,
          id: e,
        });
      }
    }
  }
  commandTalk(e) {
    let t = this.player;

    if (!t.dead) {
      this.cancelSwingForMove();
      t.target = e;
      t.targetKind = `npc`;
      t.path = [];
      t.resting = false;
    }
  }
  commandPickup(e) {
    let t = this.player;

    let n = this.drops.find((t) => {
      return t.id === e;
    });

    if (n && !t.dead) {
      if (
        Math.max(Math.abs(n.x - t.x), Math.abs(n.y - t.y)) <= 1 &&
        !t.moving
      ) {
        this.pickup(n);
      } else {
        this.commandMove(n.x, n.y);
        t.targetKind = `drop`;
      }
    }
  }
  pickupNearby() {
    let e = this.player;
    let t = 0;
    for (let n of [...this.drops]) {
      if (Math.max(Math.abs(n.x - e.lx), Math.abs(n.y - e.ly)) <= 1) {
        this.pickup(n);
        t++;
      }
    }

    if (!t) {
      // nothing at hand: walk to the nearest drop in sight and pick it up (decision 2026-11-12)
      let best = null;
      let bd = 13;
      for (const n of this.drops) {
        const d = Math.max(Math.abs(n.x - e.x), Math.abs(n.y - e.y));
        if (d < bd && this.map.elevAt(n.x, n.y) === this.map.elevAt(e.x, e.y)) {
          bd = d;
          best = n;
        }
      }
      if (best) this.commandPickup(best.id);
      else this.msg(`주변에 주울 것이 없다.`, `dim`);
    }
  }
  setDirInput(e) {
    let t = this.player;

    if (e && t.dirInput !== e) {
      t.target = null;
      t.targetKind = null;
      t.queuedSkill = null;
      t.path = [];
      t.resting = false;
      t.swing && this.time < t.swing.hitAt && this.cancelSwingForMove();
    }

    t.dirInput = e;
  }
  attackNearest() {
    let e = this.player;
    if (
      e.target !== null &&
      e.targetKind === `monster` &&
      this.monsters.some((t) => {
        return t.id === e.target && !t.dead;
      })
    ) {
      return true;
    }
    let t = null;
    let n = 1000000000;
    for (let r of this.monsters) {
      if (r.dead) {
        continue;
      }
      let i = Math.max(Math.abs(r.x - e.x), Math.abs(r.y - e.y));

      if (i <= 7 && i < n) {
        n = i;
        t = r;
      }
    }
    return t
      ? (this.commandAttack(t.id), true)
      : (this.msg(`가까운 곳에 공격할 대상이 없다.`, `dim`), false);
  }
  startSwing(e, t, n) {
    let r = n === `basic` ? ACTION_TIMING.attack : ACTION_TIMING.skill;

    e.swing = {
      kind: n,
      start: this.time,
      hitAt: this.time + r.hit,
      end: this.time + r.total,
      target: t.id,
      resolved: false,
    };

    e.facing = dirTowards(e.lx, e.ly, t.lx, t.ly);
    this.restartAction(e, n === `basic` ? `attack` : `skill`);
    let i = e === this.player ? this.pInterval() : e.def.interval;
    e.nextSwingAt = this.time + Math.max(i, n !== `basic` ? 1.4 : i);

    this.emit({
      type: `swing`,
      id: e.id,
      kind: n,
    });
  }
  resolveSwing(e) {
    let t = e.swing;
    t.resolved = true;
    let n = this.entity(t.target);
    let r = e === this.player;

    if (r) {
      if (t.kind === `basic`) {
        this.stats.basicSwings++;
        this.stats.swingLog.push([Math.round(this.stats.play), `basic`]);
      } else {
        this.stats.swingLog.push([Math.round(this.stats.play), t.kind]);
      }
    }

    let i = r ? null : e.def;
    if (i?.range) {
      if (!n || n.dead || !this.inRange(e, n)) {
        this.emit({
          type: `whiff`,
          id: e.id,
        });
        return;
      }
      let t =
        0.12 +
        Math.hypot(n.px - e.px, n.py - e.py) * 0.075;

      let r = {
        id: this.nextId++,
        from: e.id,
        to: n.id,
        kind: i.projectile ?? `arrow`,
        at: this.time + t,
      };

      this.projectiles.push(r);

      this.emit({
        type: `shot`,
        pid: r.id,
        id: e.id,
        target: n.id,
        kind: r.kind,
        dur: t,
      });
    } else {
      if (!n || n.dead || !this.map.canReach(e.lx, e.ly, n.lx, n.ly)) {
        this.emit({
          type: `whiff`,
          id: e.id,
        });
      } else {
        this.landHit(e, n, t.kind);
      }
    }
  }
  landHit(e, t, n, splash = false) {
    let r = e === this.player;
    let i = n !== `basic`;
    let sk = r && i ? SKILLS[n]?.attack : null;
    let a = r ? this.pAcc() + (sk?.acc ?? 0) : e.def.acc;
    let o = t === this.player ? this.pEva() : t.def.eva;
    let s = Math.max(
      0.3,
      Math.min(0.95, (this.hitBase ?? HIT_BASE) + (a - o) * (this.hitSlope ?? HIT_SLOPE))
    );
    if (this.rng() > s) {
      this.emit({
        type: `miss`,
        id: e.id,
        target: t.id,
      });

      this.onDamaged(t, e, 0);
      return;
    }
    let c = t === this.player ? this.pBlock() : t.def.block ?? 0;
    if (!i && this.rng() < c) {
      this.emit({
        type: `block`,
        id: e.id,
        target: t.id,
      });

      this.onDamaged(t, e, 0);
      return;
    }
    let l = t === this.player ? this.pAC() : t.def.ac;
    // ratio defense (design/gdd/combat.md): armour shaves a share of every hit, never all of it
    const K = this.defenseK ?? DEFENSE_K;
    const keep = K / (K + l * (0.6 + 0.8 * this.rng()));
    let d;
    if (r) {
      let e = this.weapon();
      let t = randInt(this.rng, e?.dmg?.[0] ?? 1, e?.dmg?.[1] ?? 2);
      d = Math.round((sk ? Math.round(t * sk.mult) + sk.add + this.pDmgBonus() : t + this.pDmgBonus()) * keep);
    } else {
      let t = e.def;
      d = Math.round(randInt(this.rng, t.dmg[0], t.dmg[1]) * keep);
    }
    d = Math.max(1, d);
    if (r && t.def?.undead) {
      if (sk?.undeadMult) d = Math.round(d * sk.undeadMult);
      const ud = this.passive(`undeadDmg`, 1);
      if (ud !== 1) d = Math.round(d * ud);
    }
    if (t === this.player) {
      const m = this.dmgTakenMult();
      if (m !== 1) d = Math.max(1, Math.round(d * m));
      if (this.player.ward > 0 && this.buffActive(`ward`)) {
        const absorbed = Math.min(this.player.ward, d);
        this.player.ward -= absorbed;
        d -= absorbed;
        if (absorbed) this.emit({ type: `absorb`, amount: absorbed });
      }
    }
    t.hp -= d;
    if (sk?.stun && !t.dead) {
      t.stunUntil = this.time + sk.stun;
      t.swing = null;
      t.path = [];
      this.emit({ type: `stun`, id: t.id });
    }

    this.emit({
      type: `hit`,
      id: e.id,
      target: t.id,
      dmg: d,
      kind: n,
      blessed: r && this.time < this.player.blessUntil,
    });

    if (!r && e.def.poison && this.rng() < e.def.poison) {
      this.applyPoison();
    }
    // soak (nagas): the player's steps slow down for a few seconds
    if (!r && t === this.player && e.def.soak && this.rng() < e.def.soak.chance) {
      const c = e.def.soak;
      this.player.buffs.soak = { until: this.time + c.dur, step: c.step };
      this.emit({ type: `soak`, until: this.time + c.dur });
    }
    // drain (leeches): the monster heals by part of the damage it dealt
    if (!r && e.def.drain && d > 0 && !e.dead) {
      const heal = Math.min(e.maxHp - e.hp, Math.round(d * e.def.drain));
      if (heal > 0) {
        e.hp += heal;
        this.emit({ type: `drain`, id: e.id, amount: heal });
      }
    }
    // frost (wisps, the titan): the player's swings slow down for a few seconds
    if (!r && t === this.player && e.def.chill && this.rng() < e.def.chill.chance) {
      const c = e.def.chill;
      this.player.buffs.chill = { until: this.time + c.dur, interval: c.interval };
      this.emit({ type: `chill`, until: this.time + c.dur });
    }

    this.onDamaged(t, e, d);

    // area attacks (whirlwind): the same swing hits every other monster next to the player
    if (sk?.area && !splash) {
      for (const m of this.monsters) {
        if (m === t || m.dead) continue;
        if (Math.max(Math.abs(m.x - this.player.x), Math.abs(m.y - this.player.y)) <= sk.area && this.map.canReach(this.player.x, this.player.y, m.x, m.y))
          this.landHit(e, m, n, true);
      }
    }
  }
  inRange(e, t) {
    let n = e.def.range;
    return n
      ? Math.max(Math.abs(t.lx - e.x), Math.abs(t.ly - e.y)) <= n &&
          this.map.lineOfSight(e.x, e.y, t.lx, t.ly)
      : this.map.canReach(e.x, e.y, t.lx, t.ly);
  }
  updateProjectiles() {
    if (this.projectiles.length) {
      for (let e of this.projectiles) {
        if (this.time >= e.at) {
          e.done = true;
          let t = this.entity(e.from);
          let n = this.entity(e.to);

          if (t && n && !n.dead) {
            this.landHit(t, n, `basic`);
          }
        }
      }
      this.projectiles = this.projectiles.filter((e) => {
        return !e.done;
      });
    }
  }
  onDamaged(e, t, n) {
    if (e === this.player) {
      let e = this.player;
      e.lastHurtAt = this.time;
      e.resting = false;

      if (n > 0 && !e.swing && !e.cast && !e.moving) {
        this.restartAction(e, `hurt`);
      }

      if (e.hp <= 0) {
        this.killPlayer();
      }

      return;
    }
    let r = e;
    r.lastHurtAt = this.time;

    if (r.state !== `chase` && r.state !== `attack` && !r.dead) {
      r.state = `chase`;
      r.provoked = true;
      this.assist(r);
    }

    if (n > 0 && !r.swing && !r.moving) {
      this.restartAction(r, `hurt`);
    }

    if (r.hp <= 0) {
      this.killMonster(r);
    }
  }
  assist(e) {
    if ([`bandit`, `skeleton`, `orc`].includes(e.def.id)) {
      for (let t of this.monsters) {
        if (
          t !== e &&
          !t.dead &&
          t.def.id === e.def.id &&
          (t.state === `idle` || t.state === `wander`) &&
          Math.max(Math.abs(t.x - e.x), Math.abs(t.y - e.y)) <= 3 &&
          this.rng() < 0.6
        ) {
          t.state = `alert`;
          t.stateUntil = this.time + 0.4 + this.rng() * 0.4;
          t.path = [];
        }
      }
    }
  }
  applyPoison() {
    let e = this.player;

    if (!e.poison) {
      this.msg(`독이 퍼졌다! 해독제로 씻어낼 수 있다.`, `warn`);
    }

    e.poison = {
      until: this.time + 10,
      nextTick: this.time + 2,
    };

    this.emit({
      type: `status`,
      status: `poison`,
      on: true,
    });
  }
  killMonster(e) {
    e.dead = true;
    e.swing = null;
    e.path = [];
    e.state = `dead`;
    this.restartAction(e, `death`);
    e.removeAt = this.time + 4;
    e.respawnAt = this.time + e.def.respawn;
    let t = this.tileIdx(e.fx, e.fy);

    if (this.occ.get(t) === e.id) {
      this.occ.delete(t);
    }

    let n = this.tileIdx(e.x, e.y);

    if (this.occ.get(n) === e.id) {
      this.occ.delete(n);
    }

    let r = this.player;

    if (r.target === e.id) {
      r.target = null;
      r.targetKind = null;
      r.queuedSkill = null;
    }

    this.stats.kills++;
    r.lawful = Math.min(32767, r.lawful + (e.def.lawful ?? 1));
    let i = e.def.xp;

    if (r.level >= e.def.level + 5) {
      i = Math.ceil(i / 2);
    }

    this.emit({
      type: `death`,
      id: e.id,
      sprite: e.sprite,
    });

    this.msg(`${e.def.name}을(를) 쓰러뜨렸다. 경험치 +${i}`, `good`);
    this.gainXp(i);
    for (let t of QUESTS) {
      let n = this.quests[t.id];

      if (n.state === `active` && t.kill && t.kill.monster === e.def.id) {
        n.progress++;
        this.msg(
          `[${t.name}] ${Math.min(n.progress, t.kill.count)}/${t.kill.count}`,
          `quest`
        );
        n.progress >= t.kill.count &&
          ((n.state = `ready`),
          this.msg(`[${t.name}] 목표 달성! 의뢰인에게 돌아가자.`, `quest`));
      }
    }
    let a = randInt(this.rng, e.def.coins[0], e.def.coins[1]);
    let o = this.dropSpots(e.x, e.y);
    let s = 0;

    if (a > 0) {
      this.addDrop(`coin`, a, o[s++ % o.length]);
    }

    for (let t of e.def.drops) {
      if (this.rng() < t.chance) {
        let e =
          ITEMS[t.item].type === `equip` &&
          ITEMS[t.item].slot !== `accessory` &&
          this.rng() < 0.15
            ? this.rng() < 0.75
              ? 1
              : 2
            : 0;
        this.addDrop(
          t.item,
          randInt(this.rng, t.min ?? 1, t.max ?? 1),
          o[s++ % o.length],
          e
        );
      }
    }
  }
  dropSpots(e, t) {
    let n = [[e, t]];
    for (let [r, i] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
    ]) {
      if (
        this.map.walkable(e + r, t + i) &&
        this.map.elevAt(e + r, t + i) === this.map.elevAt(e, t)
      ) {
        n.push([e + r, t + i]);
      }
    }
    return n;
  }
  addDrop(e, t, n, r = 0) {
    let i = {
      id: this.nextId++,
      item: e,
      count: t,
      x: n[0],
      y: n[1],
      expire: this.time + 180,
      plus: r,
    };
    this.drops.push(i);

    this.emit({
      type: `drop`,
      id: i.id,
    });
  }
  killPlayer() {
    let e = this.player;
    if (!e.dead) {
      e.lawful = Math.max(-32768, e.lawful - 30);
      e.dead = true;
      e.hp = 0;
      e.swing = null;
      e.cast = null;
      e.path = [];
      e.target = null;
      e.poison = null;
      e.buffs = {}; // chill and class buffs end with death, like poison (design/gdd/status-effects.md)
      e.ward = 0;
      e.deadAt = this.time;
      e.resting = false;
      e.dirInput = null;
      this.restartAction(e, `death`);
      this.stats.deaths++;

      this.emit({
        type: `pdeath`,
      });

      this.msg(`쓰러졌다… 새벽 신전에서 다시 일어날 수 있다.`, `bad`);
      for (let e of this.monsters) {
        if (
          !e.dead &&
          (e.state === `chase` || e.state === `attack` || e.state === `alert`)
        ) {
          e.state = `return`;
          e.path = [];
          e.swing = null;
        }
      }
    }
  }
  revive() {
    let e = this.player;
    if (!e.dead) {
      return;
    }
    const cost = this.deathCost();
    let n = cost.xp;
    const lost = cost.coins;
    e.xp -= n;
    e.coins -= lost;
    e.dead = false;
    e.hp = Math.ceil(e.maxHp * 0.5);
    e.mp = Math.ceil(e.maxMp * 0.5);
    e.blessUntil = 0;
    e.hasteUntil = 0;
    e.braveUntil = 0;
    e.manaUntil = 0;
    this.loadMap(`town`, 18, 13);
    this.setAction(e, `idle`);
    this.msg(`새벽 신전에서 눈을 떴다. 경험치 -${Math.max(0, n)}${lost ? `, 동전 -${lost}` : ``}`, `sys`);

    this.emit({
      type: `revive`,
    });
  }
  /** Class skills the player's class grants up to their level; new ones go into free skill slots. */
  grantClassSkills() {
    const c = CLASSES[this.player.cls];
    if (!c) return;
    for (const k of c.skills) {
      if (this.player.level >= k.level && !this.player.skills.includes(k.id)) {
        this.grantSkill(k.id);
        this.emit({ type: `learn`, skill: k.id });
        this.msg(`${c.name}의 기술 「${SKILLS[k.id].name}」을(를) 익혔다!`, `level`);
      }
    }
  }
  /** Why the player cannot change class right now, or null when they can. */
  classChangeBlocker() {
    const p = this.player;
    if (p.cls) return `이미 ${CLASSES[p.cls].name}(으)로 전직했다.`;
    if (p.level < 20) return `레벨 20 이상이어야 한다.`;
    if (this.quests.q_class?.state !== `done`) return `「전직의 시험」을 마쳐야 한다.`;
    return null;
  }
  /**
   * Changes the adventurer into class `id` (once, permanently): passives apply, the sprite changes,
   * class skills up to the current level are learned. design/gdd/class-change.md
   * @returns {boolean}
   */
  chooseClass(id) {
    const c = CLASSES[id];
    const why = this.classChangeBlocker();
    if (!c || why) {
      if (why) this.msg(why, `warn`);
      return false;
    }
    const p = this.player;
    p.cls = id;
    p.sprite = c.sprite;
    this.recalc();
    p.hp = p.maxHp;
    p.mp = p.maxMp;
    this.emit({ type: `classchange`, cls: id });
    this.msg(`${c.name}(으)로 전직했다! ${c.desc}`, `level`);
    this.grantClassSkills();
    return true;
  }
  gainXp(e) {
    let t = this.player;
    for (t.xp += e; t.level < MAX_LEVEL && t.xp >= XP_TABLE[t.level + 1]; ) {
      t.level++;
      let e = {
        hp: t.maxHp,
        mp: t.maxMp,
      };

      if (t.level % 2 == 0) {
        t.str++;
      } else {
        t.dex++;
      }

      if (t.level % 3 == 0) {
        t.con++;
      }

      this.recalc();
      t.hp = t.maxHp;
      t.mp = t.maxMp;

      this.emit({
        type: `levelup`,
        level: t.level,
      });

      this.msg(
        `레벨 ${t.level}! 최대 체력 ${e.hp}→${t.maxHp}, 최대 마나 ${e.mp}→${
          t.maxMp
        }, ${t.level % 2 == 0 ? `힘` : `민첩`} +1`,
        `level`
      );
      this.refreshQuests();
      this.grantClassSkills();
    }
  }
  count(e) {
    return e === `coin`
      ? this.player.coins
      : this.player.inv
          .filter((t) => {
            return t.item === e;
          })
          .reduce((e, t) => {
            return e + t.count;
          }, 0);
  }
  give(e, t = 1, n = 0) {
    let r = this.player;
    if (e === `coin`) {
      r.coins += t;
      return true;
    }
    let i = ITEMS[e];
    if (this.weight() + (i.weight ?? 2) * t > this.capacity()) {
      this.msg(`짐이 너무 무거워 더 들 수 없다.`, `warn`);
      return false;
    }
    if (i.stack) {
      let n = r.inv.find((t) => {
        return t.item === e;
      });
      if (n) {
        n.count += t;
        return true;
      }
    }
    if (r.inv.length >= 24) {
      this.msg(`가방이 가득 찼다.`, `warn`);
      return false;
    }
    if (i.stack) {
      r.inv.push({
        item: e,
        count: t,
      });
    } else {
      for (let i = 0; i < t; i++) {
        r.inv.push(
          n
            ? {
                item: e,
                count: 1,
                plus: n,
              }
            : {
                item: e,
                count: 1,
              }
        );
      }
    }

    if (e === `book_strike` && this.stats.firstStrikeBookAt === null) {
      this.stats.firstStrikeBookAt = this.stats.play;
    }

    return true;
  }
  take(e, t = 1) {
    let n = this.player;
    if (e === `coin`) {
      return n.coins < t ? false : ((n.coins -= t), true);
    }
    if (this.count(e) < t) {
      return false;
    }
    for (let r = n.inv.length - 1; r >= 0 && t > 0; r--) {
      let i = n.inv[r];
      if (i.item !== e) {
        continue;
      }
      let a = Math.min(t, i.count);
      i.count -= a;
      t -= a;

      if (i.count <= 0) {
        n.inv.splice(r, 1);
      }
    }
    return true;
  }
  pickup(e) {
    let t = this.player;

    if (Math.max(Math.abs(e.x - t.lx), Math.abs(e.y - t.ly)) <= 1) {
      if (this.give(e.item, e.count, e.plus ?? 0)) {
        e.item === `book_strike` &&
          !this.stats.firstStrikeSource &&
          (this.stats.firstStrikeSource = `drop`);

        this.drops = this.drops.filter((t) => {
          return t !== e;
        });

        this.emit({
          type: `pickup`,
          id: e.id,
          item: e.item,
          x: e.x,
          y: e.y,
        });

        this.msg(
          e.item === `coin`
            ? `동전 ${e.count}닢을 주웠다.`
            : `${this.itemName(e.item, e.plus)}${
                e.count > 1 ? ` ×` + e.count : ``
              }을(를) 주웠다.`,
          e.item.startsWith(`book`) ? `level` : `loot`
        );
        this.tutorial.picked = true;
      }
    }
  }
  useItem(e) {
    let t = this.player;
    let n = t.inv[e];
    if (!n || t.dead) {
      return;
    }
    let r = ITEMS[n.item];
    if (r.type === `equip`) {
      return this.equip(e);
    }
    if (r.type === `potion`) {
      if ((t.cooldowns.potion ?? 0) > this.time) {
        return;
      }
      if (r.heal) {
        if (t.hp >= t.maxHp) {
          this.msg(`이미 체력이 가득하다.`, `dim`);
          return;
        }
        t.hp = Math.min(t.maxHp, t.hp + r.heal);

        this.emit({
          type: `potion`,
          heal: r.heal,
        });

        this.msg(`${r.name}을(를) 마셨다. 체력 +${r.heal}`, `good`);
      }
      if (r.buff) {
        let e = this.time + (r.duration ?? 300);

        if (r.buff === `haste`) {
          t.hasteUntil = e;
        } else if (r.buff === `mana`) {
          t.manaUntil = e;
        } else {
          t.braveUntil = e;
        }

        this.emit({
          type: `buff`,
          buff: r.buff,
        });

        this.msg(
          `${r.name}을(를) 마셨다. ${
            r.buff === `haste` ? `발걸음이 가벼워졌다` : `투지가 솟는다`
          } (${Math.round((r.duration ?? 300) / 60)}분)`,
          `good`
        );
      }
      if (r.cures === `poison`) {
        if (!t.poison) {
          this.msg(`독에 걸려 있지 않다.`, `dim`);
          return;
        }
        t.poison = null;

        this.emit({
          type: `status`,
          status: `poison`,
          on: false,
        });

        this.emit({
          type: `potion`,
          heal: 0,
        });

        this.msg(`독이 씻겨 나갔다.`, `good`);
      }
      t.cooldowns.potion = this.time + 0.8;
      this.take(n.item, 1);
      this.stats.potions++;
      this.tutorial.potion = true;
    } else {
      if (r.enchant) {
        return this.enchant(e);
      }
      if (n.item === `scroll_teleport`) {
        if (this.map.safe) {
          this.msg(`마을 안에서는 순간이동할 곳이 없다.`, `dim`);
          return;
        }

        if (this.teleportRandom()) {
          this.take(n.item, 1);
          this.msg(`주문서가 타오르며 몸이 다른 곳으로 옮겨졌다.`, `sys`);
        }
      } else if (r.type === `scroll`) {
        if (this.map.id === `town`) {
          this.msg(`이미 마을 안이다.`, `dim`);
          return;
        }
        this.cancelSwingForMove();
        t.target = null;
        t.path = [];

        t.cast = {
          skill: `return`,
          start: this.time,
          at: this.time + 1.2,
          end: this.time + 1.3,
          applied: false,
        };

        this.restartAction(t, `cast`);
        this.msg(`귀환 주문서를 읽는다… (움직이면 취소)`, `sys`);
      } else {
        if (r.type === `book`) {
          return this.learn(e);
        }
        this.msg(`${r.name}: ${r.desc}`, `dim`);
      }
    }
  }
  learn(e) {
    let t = this.player;
    let n = t.inv[e];
    let r = ITEMS[n.item];
    let i = r.skill;

    if (t.skills.includes(i)) {
      this.msg(`이미 익힌 기술이다.`, `dim`);
    } else if (t.level < (r.reqLevel ?? 1)) {
      this.msg(
        `레벨 ${r.reqLevel} 이상이어야 익힐 수 있다. (현재 ${t.level})`,
        `warn`
      );
    } else {
      this.take(n.item, 1);
      this.grantSkill(i);
      this.stats.firstSkillAt === null &&
        (this.stats.firstSkillAt = this.stats.play);

      this.emit({
        type: `learn`,
        skill: i,
      });

      this.msg(
        `「${SKILLS[i].name}」을(를) 익혔다! 스킬 창과 퀵슬롯에서 사용할 수 있다.`,
        `level`
      );
    }
  }
  /** Adds a skill to the player and puts it in the first empty skill slot. */
  grantSkill(id) {
    const p = this.player;
    if (!p.skills.includes(id)) p.skills.push(id);
    if (!p.skillSlots.includes(id)) {
      const free = p.skillSlots.indexOf(null);
      if (free >= 0) p.skillSlots[free] = id;
    }
  }
  /**
   * Puts a learned skill in skill slot `slot` (0-3), or clears it with null. A skill sits in at
   * most one slot: assigning it elsewhere moves it.
   * @returns {boolean} false when the skill is not learned or the slot is out of range
   */
  assignSkillSlot(slot, id) {
    const p = this.player;
    if (slot < 0 || slot >= p.skillSlots.length) return false;
    if (id !== null && !p.skills.includes(id)) return false;
    if (id !== null) p.skillSlots = p.skillSlots.map((s) => (s === id ? null : s));
    p.skillSlots[slot] = id;
    return true;
  }
  equip(e) {
    let t = this.player;
    let n = t.inv[e];
    let r = ITEMS[n.item];
    if (r.reqLevel && t.level < r.reqLevel) {
      this.msg(`레벨 ${r.reqLevel} 이상 장비할 수 있다.`, `warn`);
      return;
    }
    let i = r.slot;
    let a = t.equip[i];
    let o = t.equipPlus[i];
    t.inv.splice(e, 1);
    t.equip[i] = n.item;
    t.equipPlus[i] = n.plus ?? 0;

    if (a) {
      t.inv.push(
        o
          ? {
              item: a,
              count: 1,
              plus: o,
            }
          : {
              item: a,
              count: 1,
            }
      );
    }

    this.recalc();

    this.emit({
      type: `equip`,
      slot: i,
    });

    this.msg(`${this.itemName(n.item, n.plus)}을(를) 장비했다.`, `info`);
  }
  unequip(e) {
    let t = this.player;
    let n = t.equip[e];
    if (!n) {
      return;
    }
    if (t.inv.length >= 24) {
      this.msg(`가방이 가득 찼다.`, `warn`);
      return;
    }
    let r = t.equipPlus[e];
    t.equip[e] = null;
    t.equipPlus[e] = 0;

    t.inv.push(
      r
        ? {
            item: n,
            count: 1,
            plus: r,
          }
        : {
            item: n,
            count: 1,
          }
    );

    this.recalc();

    this.emit({
      type: `equip`,
      slot: e,
    });

    this.msg(`${this.itemName(n, r)}을(를) 벗었다.`, `info`);
  }
  sell(e, t = 1) {
    let n = this.player;
    let r = n.inv[e];
    if (!r) {
      return;
    }
    let i = ITEMS[r.item];
    let a = Math.min(t, r.count);
    let o = this.sellPrice(r) * a;
    this.take(r.item, a);
    n.coins += o;

    this.emit({
      type: `coin`,
    });

    this.msg(`${i.name}${a > 1 ? ` ×` + a : ``}을(를) 팔았다. +${o}닢`, `loot`);
  }
  sellPrice(e) {
    let t = ITEMS[e.item];
    return Math.max(
      1,
      Math.floor(t.price * 0.4 * (1 + (e.plus ?? 0) * 0.5))
    );
  }
  enchantTarget(e) {
    let t = this.player;
    let n = ITEMS[e]?.enchant;
    if (!n) {
      return null;
    }
    let r =
      n === `weapon`
        ? t.equip.weapon
          ? `weapon`
          : null
        : t.equip.armor
        ? `armor`
        : t.equip.shield
        ? `shield`
        : null;
    return r
      ? {
          slot: r,
          plus: t.equipPlus[r],
          safe: n === `weapon` ? ENCHANT_SAFE.weapon : ENCHANT_SAFE.armor,
        }
      : null;
  }
  enchant(e) {
    let t = this.player;
    let n = t.inv[e];
    let r = this.enchantTarget(n.item);
    if (!r) {
      this.msg(
        ITEMS[n.item].enchant === `weapon`
          ? `강화할 무기를 장비하고 있지 않다.`
          : `강화할 갑옷이나 방패를 장비하고 있지 않다.`,
        `warn`
      );
      return;
    }
    let i = t.equip[r.slot];

    if (r.plus >= 10) {
      this.msg(
        `${this.itemName(i, r.plus)}은(는) 더 이상 강화할 수 없다.`,
        `dim`
      );
    } else {
      this.take(n.item, 1);

      !(r.plus >= r.safe) || this.rng() < 1 / 3
        ? ((t.equipPlus[r.slot] = r.plus + 1),
          this.recalc(),
          this.emit({
            type: `enchant`,
            ok: true,
            plus: r.plus + 1,
            slot: r.slot,
          }),
          this.msg(
            `${ITEMS[i].name}이(가) 한순간 ${
              r.slot === `weapon` ? `푸르게` : `은은하게`
            } 빛난다. → ${this.itemName(i, r.plus + 1)}`,
            `level`
          ))
        : ((t.equip[r.slot] = null),
          (t.equipPlus[r.slot] = 0),
          this.recalc(),
          this.emit({
            type: `enchant`,
            ok: false,
            slot: r.slot,
          }),
          this.emit({
            type: `equip`,
            slot: r.slot,
          }),
          this.msg(
            `${this.itemName(
              i,
              r.plus
            )}이(가) 강렬하게 빛나더니 증발해 버렸다…`,
            `bad`
          ));
    }
  }
  teleportRandom() {
    let e = this.map;
    let t = this.player;
    for (let n = 0; n < 400; n++) {
      let n = randInt(this.rng, 1, e.w - 2);
      let r = randInt(this.rng, 1, e.h - 2);
      if (
        !(
          !e.walkable(n, r) ||
          e.stairAt(n, r) ||
          this.isOccupied(n, r) ||
          e.exits.some((e) => {
            return e.x === n && e.y === r;
          })
        ) &&
        !this.monsters.some((e) => {
          return !e.dead && Math.max(Math.abs(e.x - n), Math.abs(e.y - r)) <= 2;
        }) &&
        findPath(e, n, r, e.start.x, e.start.y, {
          maxNodes: 40000,
        })
      ) {
        this.cancelSwingForMove();
        t.target = null;
        t.targetKind = null;
        t.path = [];
        this.occ.delete(this.tileIdx(t.x, t.y));
        this.occ.delete(this.tileIdx(t.fx, t.fy));
        t.x = n;
        t.fx = n;
        t.y = r;
        t.fy = r;
        t.t = 1;
        t.moving = false;
        this.occ.set(this.tileIdx(n, r), 0);
        for (let e of this.monsters) {
          if (!e.dead && (e.state === `chase` || e.state === `attack`)) {
            e.state = `return`;
            e.path = [];
          }
        }

        this.emit({
          type: `teleport`,
        });

        return true;
      }
    }
    return false;
  }
  buy(e, t) {
    let n = ITEMS[t];
    if (!SHOPS[e].items.includes(t)) {
      return;
    }
    if (SHOPS[e].chaoticOnly && this.player.lawful > -100) {
      this.msg(`암상인이 고개를 젓는다.`, `warn`);
      return;
    }
    let r = this.priceOf(t, e);

    if (this.player.coins < r) {
      this.msg(`동전이 부족하다.`, `warn`);
    } else if (this.give(t, 1)) {
      this.player.coins -= r;

      this.emit({
        type: `coin`,
      });

      this.msg(`${n.name}을(를) 샀다. -${r}닢`, `loot`);
    }
  }
  /**
   * Whether recipe `id` can be crafted now: { ok, reason } (reason: unknown, level, mats, coins).
   * Design: design/gdd/equipment-economy.md
   */
  craftState(id) {
    const r = RECIPES[id];
    if (!r) return { ok: false, reason: `unknown` };
    const item = ITEMS[r.item];
    if ((item.reqLevel ?? 0) > this.player.level) return { ok: false, reason: `level` };
    if (r.mats.some((m) => this.count(m.item) < m.count)) return { ok: false, reason: `mats` };
    if (this.player.coins < r.coins) return { ok: false, reason: `coins` };
    return { ok: true };
  }
  /** Crafts recipe `id` at shop `shopId`: takes the materials and fee, gives the item. Returns true on success. */
  craft(shopId, id) {
    const r = RECIPES[id];
    if (!r || !SHOPS[shopId]?.crafts?.includes(id)) return false;
    const st = this.craftState(id);
    if (!st.ok) {
      this.msg(st.reason === `level` ? `아직 다룰 수 없는 물건이다.` : st.reason === `coins` ? `동전이 부족하다.` : `재료가 모자라다.`, `warn`);
      return false;
    }
    for (const m of r.mats) this.take(m.item, m.count);
    if (!this.give(r.item, 1)) {
      for (const m of r.mats) this.give(m.item, m.count); // bag full: undo
      return false;
    }
    this.player.coins -= r.coins;
    this.emit({ type: `coin` });
    this.msg(`${ITEMS[r.item].name}을(를) 만들었다. -${r.coins}닢`, `loot`);
    return true;
  }
  skillState(e) {
    let t = this.player;
    let n = SKILLS[e];

    if (t.skills.includes(e)) {
      if (t.dead) {
        return {
          ok: false,
          reason: `사망 상태`,
        };
      }

      if ((t.cooldowns[e] ?? 0) > this.time) {
        return {
          ok: false,
          reason: `재사용 대기 ${Math.ceil(t.cooldowns[e] - this.time)}초`,
        };
      }

      if (t.mp < n.mp) {
        return {
          ok: false,
          reason: `마나 부족 (${n.mp} 필요)`,
        };
      }

      if (n.consumes && this.count(n.consumes) < 1) {
        return {
          ok: false,
          reason: `${ITEMS[n.consumes].name} 필요`,
        };
      }

      return {
        ok: true,
        reason: ``,
      };
    }

    return {
      ok: false,
      reason: n.book ? `미습득 — ${ITEMS[n.book].name} 필요` : `미습득 — ${CLASSES[n.cls]?.name ?? ``} 전용`,
    };
  }
  useSkill(e) {
    let t = this.player;
    let n = this.skillState(e);

    if (n.ok) {
      if (SKILLS[e].attack) {
        if (
          t.target !== null &&
          this.monsters.find((e) => {
            return e.id === t.target && !e.dead;
          })
        ) {
          t.queuedSkill = e;
          return true;
        }

        this.msg(`${SKILLS[e].name}: 먼저 공격할 대상을 지정하세요.`, `warn`);
        return false;
      }

      if (t.swing && this.time < t.swing.end) {
        this.msg(`공격 동작 중에는 시전할 수 없다.`, `dim`);
        return false;
      }

      this.cancelSwingForMove();
      t.path = [];

      t.cast = {
        skill: e,
        start: this.time,
        at: this.time + ACTION_TIMING.cast.event,
        end: this.time + ACTION_TIMING.cast.total,
        applied: false,
      };

      this.restartAction(t, `cast`);
      return true;
    }

    this.msg(`${SKILLS[e].name}: ${n.reason}`, `warn`);
    return false;
  }
  applyCast(e) {
    let t = this.player;
    e.applied = true;

    if (e.skill === `return`) {
      this.player.cast = null;

      this.emit({
        type: `return`,
      });

      this.tutorial.returned = true;

      this.pendingExit = {
        to: `town`,
        tx: 18,
        ty: 13,
      };

      return;
    }

    let n = SKILLS[e.skill];
    t.mp -= n.mp;
    t.cooldowns[e.skill] = this.time + n.cooldown;

    if (n.consumes) {
      this.take(n.consumes, 1);
    }

    if (this.stats.firstSkillUseAt === null) {
      this.stats.firstSkillUseAt = this.stats.play;
    }

    if (e.skill === `heal`) {
      let e = Math.round(t.maxHp * 0.3) + 10;
      t.hp = Math.min(t.maxHp, t.hp + e);
      this.stats.healUses++;

      this.emit({
        type: `heal`,
        amount: e,
      });

      this.msg(`응급 치료: 체력 +${e}`, `good`);
    }

    if (n.buff) {
      const b = n.buff;
      t.buffs[b.id] = { until: this.time + b.dur, dmgTaken: b.dmgTaken, interval: b.interval };
      if (b.absorbPct) t.ward = Math.round(t.maxHp * b.absorbPct);
      this.emit({ type: `buff`, skill: e.skill, fx: n.fx, until: this.time + b.dur });
      this.msg(`${n.name}! (${b.dur}초)`, `good`);
    }

    if (e.skill === `bless`) {
      t.blessUntil = this.time + 25;
      this.stats.blessUses++;

      this.emit({
        type: `bless`,
      });

      this.msg(`칼날에 희미한 빛이 깃들었다. (25초)`, `good`);
    }
  }
  refreshQuests() {
    for (let e of QUESTS) {
      let t = this.quests[e.id];

      if (
        t.state === `locked` &&
        this.player.level >= e.minLevel &&
        (!e.after || this.quests[e.after].state === `done`)
      ) {
        t.state = `available`;
      }
    }
    for (let e of QUESTS) {
      let t = this.quests[e.id];

      if (e.bring && (t.state === `active` || t.state === `ready`)) {
        t.state = this.questItemsOk(e.id) ? `ready` : `active`;
      }
    }
  }
  /**
   * Quest marker for an NPC: `?` when one of its quests can be turned in, `!` when one can be
   * accepted, otherwise null.
   * @param {string} npcId
   */
  npcQuestMarker(npcId) {
    let marker = null;
    for (const q of QUESTS) {
      if (q.giver !== npcId) continue;
      const state = this.quests[q.id].state;
      if (state === `ready`) return `?`;
      if (state === `available`) marker = `!`;
    }
    return marker;
  }
  questItemsOk(e) {
    let t = QUESTS.find((t) => {
      return t.id === e;
    });
    return (
      (t.bring ?? []).every((e) => {
        return this.count(e.item) >= e.count;
      }) && this.player.coins >= (t.coins ?? 0)
    );
  }
  acceptQuest(e) {
    let t = this.quests[e];
    if (t.state !== `available`) {
      return;
    }
    t.state = `active`;
    t.progress = 0;
    let n = QUESTS.find((t) => {
      return t.id === e;
    });
    this.msg(`의뢰 수락: ${n.name}`, `quest`);
    this.refreshQuests();

    this.emit({
      type: `quest`,
    });
  }
  /**
   * Hands in quest `e`. Quests with `choices` need `choiceId` (design/gdd/alignment.md): the choice moves the
   * alignment (a chaotic choice drops it to min(lawful, 0) − 600) and may replace the item/coin rewards.
   */
  completeQuest(e, choiceId) {
    this.refreshQuests();
    let t = this.quests[e];

    let n = QUESTS.find((t) => {
      return t.id === e;
    });
    const ch = n?.choices ? n.choices.find((c) => c.id === choiceId) : null;
    if (n?.choices && !ch) return;
    if (ch?.replaceRewards) n = { ...n, rewardItems: ch.rewardItems ?? [], rewardCoins: ch.rewardCoins ?? 0 };

    if (t.state === `ready`) {
      if (ch) {
        const p = this.player;
        p.lawful = ch.chaos ? Math.max(-32768, Math.min(p.lawful, 0) + ch.lawful) : Math.min(32767, p.lawful + ch.lawful);
        t.choice = ch.id;
        this.msg(`${ch.label}. 성향: ${this.lawfulName()} (${p.lawful})`, ch.chaos ? `warn` : `good`);
      }
      for (let e of n.bring ?? []) {
        this.take(e.item, e.count);
      }

      if (n.coins) {
        this.take(`coin`, n.coins);
      }

      for (let e of n.rewardItems ?? []) {
        this.give(e.item, e.count);
      }

      if (n.rewardCoins) {
        this.player.coins += n.rewardCoins;
      }

      t.state = `done`;
      this.msg(`의뢰 완료: ${n.name}`, `quest`);

      if (n.id === `q_strike` && !this.stats.firstStrikeSource) {
        this.stats.firstStrikeSource = `quest`;
      }

      if (n.rewardXp) {
        this.gainXp(n.rewardXp);
      }

      this.refreshQuests();

      this.emit({
        type: `quest`,
      });

      this.emit({
        type: `coin`,
      });
    }
  }
  /**
   * What reviving costs now (design/gdd/progression.md): 8 % of the current level's XP span (never below the
   * level) and 5 % of carried coins, 10 % at the level cap where no XP can be lost.
   */
  deathCost() {
    const e = this.player;
    const span = XP_TABLE[Math.min(MAX_LEVEL, e.level + 1)] - XP_TABLE[e.level];
    const xp = Math.max(0, Math.min(e.xp - XP_TABLE[e.level], Math.floor(span * 0.08)));
    const coins = Math.floor(e.coins * (e.level >= MAX_LEVEL ? 0.1 : 0.05));
    return { xp, coins };
  }
  /** Priest's offering for a full heal (design/gdd/alignment.md): free to Lv5 and for the righteous (1000+), else 5 × level, doubled for the chaotic (−100 or less). */
  priestFee() {
    const p = this.player;
    if (p.level <= 5 || p.lawful >= 1000) return 0;
    return p.level * 5 * (p.lawful <= -100 ? 2 : 1);
  }
  priestHeal() {
    let e = this.player;
    const fee = this.priestFee();
    if (e.coins < fee) {
      this.msg(`헌금(${fee}닢)이 모자라다.`, `warn`);
      return false;
    }
    e.coins -= fee;
    e.hp = e.maxHp;
    e.mp = e.maxMp;

    if (e.poison) {
      e.poison = null;

      this.emit({
        type: `status`,
        status: `poison`,
        on: false,
      });
    }

    this.emit({
      type: `heal`,
      amount: 0,
    });

    this.msg(`사제 엘린의 기도로 상처가 아물었다.${fee ? ` (헌금 ${fee}닢)` : ``}`, `good`);
    return true;
  }
  update(e) {
    let t = Math.min(0.1, Math.max(0, e));
    this.dt = t;
    this.time += t;
    this.stats.play += t;
    this.updatePlayer(t);
    for (let e of this.monsters) {
      this.updateMonster(e);
    }
    this.advanceMovers(t);
    this.updateProjectiles();
    this.updateStatus();
    this.updateNight();
    this.updateRespawn();

    if (this.drops.length) {
      this.drops = this.drops.filter((e) => {
        return e.expire > this.time;
      });
    }

    if (this.pendingExit && !this.player.moving) {
      let e = this.pendingExit;
      this.pendingExit = null;
      this.loadMap(e.to, e.tx, e.ty);
    }
  }
  updatePlayer(e) {
    let t = this.player;
    if (
      t.dead ||
      (t.cast &&
        (!t.cast.applied && this.time >= t.cast.at && this.applyCast(t.cast),
        t.cast && this.time >= t.cast.end && (t.cast = null)),
      t.swing &&
        (!t.swing.resolved &&
          this.time >= t.swing.hitAt &&
          this.resolveSwing(t),
        t.swing && this.time >= t.swing.end && (t.swing = null)),
      t.moving) ||
      t.cast
    ) {
      return;
    }
    let n = !!t.swing;
    if (t.dirInput && !n) {
      let [e, n] = DIR_VECTORS[t.dirInput];

      if (!this.tryStep(t, t.x + e, t.y + n)) {
        t.facing = t.dirInput;
        t.action === `walk` && this.setAction(t, `idle`);
      }
    } else if (t.target !== null && t.targetKind === `monster`) {
      let e = this.monsters.find((e) => {
        return e.id === t.target;
      });
      if (!e || e.dead) {
        t.target = null;
        t.targetKind = null;
        t.queuedSkill = null;
      } else if (this.map.canReach(t.x, t.y, e.lx, e.ly)) {
        t.path = [];

        if (!n && this.time >= t.nextSwingAt) {
          let q = t.queuedSkill;
          if (q && this.skillState(q).ok) {
            let n = SKILLS[q];
            t.mp -= n.mp;
            t.cooldowns[q] = this.time + n.cooldown;
            t.queuedSkill = null;
            if (q === `strike`) this.stats.strikeUses++;

            if (this.stats.firstSkillUseAt === null) {
              this.stats.firstSkillUseAt = this.stats.play;
            }

            this.startSwing(t, e, q);
          } else {
            if (q && !this.skillState(q).ok) {
              t.queuedSkill = null;
            }

            this.startSwing(t, e, `basic`);
            this.tutorial.attacked = true;
          }
        } else {
          if (!n) {
            t.facing = dirTowards(t.x, t.y, e.lx, e.ly);
            this.setAction(t, `idle`);
          }
        }

        return;
      } else if (!n) {
        let n = findPath(this.map, t.x, t.y, e.x, e.y, {
          occupied: (e, t) => {
            return this.isOccupied(e, t, 0);
          },
          goalTest: (t, n) => {
            return this.map.canReach(t, n, e.x, e.y);
          },
          maxNodes: 3000,
        });
        if (!n || !n.length) {
          this.msg(`${e.def.name}에게 다가갈 길이 없다.`, `dim`);
          t.target = null;
          t.targetKind = null;
          this.setAction(t, `idle`);
          return;
        }

        if (!this.tryStep(t, n[0][0], n[0][1])) {
          this.setAction(t, `idle`);
        }

        return;
      }
    } else if (t.target !== null && t.targetKind === `npc`) {
      let e = this.npcs.find((e) => {
        return e.id === t.target;
      });
      if (!e) {
        t.target = null;
        return;
      }
      if (
        Math.max(Math.abs(e.x - t.x), Math.abs(e.y - t.y)) <= 1 &&
        this.map.elevAt(e.x, e.y) === this.map.elevAt(t.x, t.y)
      ) {
        t.target = null;
        t.targetKind = null;
        t.facing = dirTowards(t.x, t.y, e.x, e.y);
        e.facing = dirTowards(e.x, e.y, t.x, t.y);
        this.setAction(t, `idle`);

        this.emit({
          type: `talk`,
          npc: e.npcId,
          role: e.role,
        });

        return;
      }
      let n = findPath(this.map, t.x, t.y, e.x, e.y, {
        occupied: (e, t) => {
          return this.isOccupied(e, t, 0);
        },
        goalTest: (t, n) => {
          return (
            Math.max(Math.abs(e.x - t), Math.abs(e.y - n)) <= 1 &&
            this.map.elevAt(t, n) === this.map.elevAt(e.x, e.y) &&
            !this.isOccupied(t, n, 0)
          );
        },
      });

      if (!n || !n.length || !this.tryStep(t, n[0][0], n[0][1])) {
        t.target = null;
        this.setAction(t, `idle`);
      }
    } else {
      if (t.path.length && !n) {
        let [e, n] = t.path[0];
        if (this.tryStep(t, e, n)) {
          t.path.shift();
          return;
        }
        let r = t.path[t.path.length - 1];

        let i = findPath(this.map, t.x, t.y, r[0], r[1], {
          occupied: (e, t) => {
            return this.isOccupied(e, t, 0);
          },
        });

        if (i && i.length && this.tryStep(t, i[0][0], i[0][1])) {
          t.path = i.slice(1);
          return;
        }
        t.path = [];
      }

      if (
        !t.swing &&
        (t.action === `walk` ||
          (t.action === `hurt` &&
            this.time - t.actionStart > ACTION_TIMING.hurt.total) ||
          ((t.action === `attack` ||
            t.action === `skill` ||
            t.action === `cast`) &&
            !t.cast))
      ) {
        this.setAction(t, `idle`);
      }
    }
  }
  updateMonster(e) {
    let t = this.player;
    if (e.dead) {
      if (!e.gone && this.time >= e.removeAt) {
        e.gone = true;
      }

      return;
    }
    // stunned (shield bash): no moving, no swinging
    if (e.stunUntil > this.time) return;

    if (e.swing) {
      !e.swing.resolved && this.time >= e.swing.hitAt && this.resolveSwing(e);
      e.swing &&
        this.time >= e.swing.end &&
        ((e.swing = null), this.setAction(e, `idle`));
    }

    if (
      e.moving ||
      e.swing ||
      (e.action === `hurt` &&
        this.time - e.actionStart < ACTION_TIMING.hurt.total)
    ) {
      return;
    }

    let n = Math.max(Math.abs(t.lx - e.x), Math.abs(t.ly - e.y));
    let r = Math.max(Math.abs(e.homeX - e.x), Math.abs(e.homeY - e.y));
    let i = !e.def.passive || e.provoked;
    switch (e.state) {
      case `idle`:
      case `wander`: {
        if (
          !t.dead &&
          i &&
          e.def.aggro > 0 &&
          n <= e.def.aggro &&
          this.map.elevAt(t.x, t.y) === this.map.elevAt(e.x, e.y) &&
          this.map.id !== `town` &&
          !this.safeHere()
        ) {
          e.state = `alert`;
          e.stateUntil = this.time + 0.6;
          e.path = [];
          e.facing = dirTowards(e.x, e.y, t.lx, t.ly);

          this.emit({
            type: `alert`,
            id: e.id,
          });

          this.assist(e);
          break;
        }
        if (e.path.length) {
          let [t, n] = e.path[0];

          if (this.tryStep(e, t, n)) {
            e.path.shift();
          } else {
            e.path = [];
          }

          break;
        }
        this.setAction(e, `idle`);

        if (
          this.time >= e.nextThink &&
          ((e.nextThink = this.time + 2 + this.rng() * 4),
          this.rng() < 0.55)
        ) {
          let t = this.map.spawns[e.spawnIdx];
          let n = t.x + randInt(this.rng, -t.r, t.r);
          let r = t.y + randInt(this.rng, -t.r, t.r);
          if (this.map.walkable(n, r)) {
            let t = findPath(this.map, e.x, e.y, n, r, {
              occupied: (t, n) => {
                return this.isOccupied(t, n, e.id);
              },
              maxNodes: 600,
            });

            if (t && t.length <= 8) {
              e.path = t;
              e.state = `wander`;
            }
          }
        }

        break;
      }
      case `alert`: {
        if (this.time >= e.stateUntil) {
          e.state = `chase`;
        }

        break;
      }
      case `chase`:
      case `attack`: {
        if (
          t.dead ||
          r > 13 ||
          this.safeHere() || // the player reached a camp: monsters give up

          (this.time - Math.max(e.lastHurtAt, 0) > 10 && n > e.def.aggro + 3)
        ) {
          e.state = `return`;
          e.path = [];
          e.provoked = false;
          break;
        }
        if (this.inRange(e, t)) {
          e.state = `attack`;
          e.path = [];

          if (this.time >= e.nextSwingAt) {
            this.startSwing(e, t, `basic`);
          } else {
            e.facing = dirTowards(e.x, e.y, t.lx, t.ly);
            this.setAction(e, `idle`);
          }

          break;
        }
        e.state = `chase`;

        if (this.time >= e.nextRepath || !e.path.length) {
          e.nextRepath = this.time + 0.5;
          let r = findPath(this.map, e.x, e.y, t.x, t.y, {
            occupied: (t, n) => {
              return this.isOccupied(t, n, e.id);
            },
            goalTest: (n, r) => {
              return (
                (e.def.range
                  ? Math.max(Math.abs(t.x - n), Math.abs(t.y - r)) <=
                      e.def.range && this.map.lineOfSight(n, r, t.x, t.y)
                  : this.map.canReach(n, r, t.x, t.y)) &&
                !this.isOccupied(n, r, e.id)
              );
            },
            maxNodes: 1500,
          });
          e.path = r ?? [];

          if (!r) {
            this.setAction(e, `idle`);

            if (n > e.def.aggro + 2) {
              e.state = `return`;
            }

            break;
          }
        }

        if (e.path.length) {
          let [t, n] = e.path[0];

          if (this.tryStep(e, t, n)) {
            e.path.shift();
          } else {
            e.path = [];
            this.setAction(e, `idle`);
          }
        }
        break;
      }
      case `return`: {
        if (r <= 1) {
          e.state = `idle`;
          e.hp = e.maxHp;
          e.path = [];
          this.setAction(e, `idle`);
          break;
        }
        if (!e.path.length) {
          let t = findPath(this.map, e.x, e.y, e.homeX, e.homeY, {
            occupied: (t, n) => {
              return this.isOccupied(t, n, e.id);
            },
            goalTest: (t, n) => {
              return (
                Math.max(Math.abs(t - e.homeX), Math.abs(n - e.homeY)) <= 1
              );
            },
            maxNodes: 2500,
          });
          if (!t) {
            e.state = `idle`;
            e.hp = e.maxHp;
            break;
          }
          e.path = t;
        }
        let [t, n] = e.path[0];

        if (this.tryStep(e, t, n)) {
          e.path.shift();
        } else {
          e.path = [];
        }

        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.04 * this.dt); // 4%/s while walking home
        break;
      }
    }
  }
  updateStatus() {
    let e = this.player;
    if (e.dead) {
      return;
    }
    if (e.poison) {
      if (
        this.time >= e.poison.nextTick &&
        ((e.poison.nextTick += 2),
        (e.hp -= 2),
        this.emit({
          type: `dot`,
          dmg: 2,
        }),
        (e.lastHurtAt = this.time),
        e.hp <= 0)
      ) {
        this.killPlayer();
        return;
      }

      if (this.time >= e.poison.until) {
        e.poison = null;

        this.emit({
          type: `status`,
          status: `poison`,
          on: false,
        });

        this.msg(`독이 가라앉았다.`, `dim`);
      }
    }
    let t = this.burdened();

    if (t !== this.wasHeavy) {
      this.wasHeavy = t;

      this.emit({
        type: `burden`,
        on: t,
      });

      t &&
        this.msg(
          `짐이 무겁다(30% 이상). 체력과 마나가 덜 회복되고, 50%면 멈춘다.`,
          `warn`
        );
    }

    const f = this.regenFactor();
    let n = this.time - e.lastHurtAt > 6 && !e.swing && f > 0;
    let r = (e.resting ? 3 : 1) * (this.safeHere() ? 2 : 1) * f;

    if (n && this.time >= e.nextRegen) {
      e.nextRegen = this.time + 4 / r;
      e.hp < e.maxHp &&
        (e.hp = Math.min(e.maxHp, e.hp + 1 + Math.floor(e.con / 8)));
    }

    if (f > 0 && this.time >= e.nextMpRegen) {
      // mana potion: ×3 mana regen while it lasts (design/gdd/status-effects.md)
      e.nextMpRegen = this.time + 5 / (r * (this.time < (e.manaUntil ?? 0) ? 3 : 1));
      e.mp < e.maxMp && (e.mp += 1);
    } else if (f === 0) {
      e.nextMpRegen = this.time + 1;
    }
  }
  updateNight() {
    let e = this.isNight();

    if (e !== this.wasNight) {
      this.wasNight = e;

      this.emit({
        type: `daynight`,
        night: e,
      });

      this.msg(
        e
          ? `해가 졌다. 묘지 쪽에서 낮은 신음이 들려온다…`
          : `날이 밝았다. 망자들이 흙으로 돌아간다.`,
        `sys`
      );

      this.map.spawns.forEach((t, n) => {
        if (t.nightOnly) {
          if (e) {
            let e = this.monsters.filter((e) => {
              return e.spawnIdx === n && !e.gone;
            }).length;
            for (let r = e; r < t.count; r++) {
              this.spawnMonster(n);
            }
          } else {
            for (let e of this.monsters) {
              if (
                e.spawnIdx === n &&
                !e.dead &&
                e.state !== `chase` &&
                e.state !== `attack`
              ) {
                e.dead = true;
                e.gone = true;
                e.respawnAt = 1000000000000 /* 0xe8d4a51000 */;

                this.emit({
                  type: `death`,
                  id: e.id,
                  sprite: e.sprite,
                  silent: true,
                });

                let t = this.tileIdx(e.x, e.y);

                if (this.occ.get(t) === e.id) {
                  this.occ.delete(t);
                }
              }
            }
          }
        }
      });
    }
  }
  updateRespawn() {
    for (let e of this.monsters) {
      if (e.dead && e.gone && this.time >= e.respawnAt) {
        this.monsters = this.monsters.filter((t) => {
          return t !== e;
        });

        if (this.map.spawns[e.spawnIdx]?.nightOnly && !this.isNight()) {
          e.respawnAt = 1000000000000 /* 0xe8d4a51000 */;
          this.monsters.push(e);
          continue;
        }

        if (!this.spawnMonster(e.spawnIdx)) {
          e.respawnAt = this.time + 5;
          this.monsters.push(e);
        }
      }
    }
  }
  toggleRest() {
    let e = this.player;

    if (!e.dead) {
      if (e.resting) {
        e.resting = false;
        this.msg(`휴식을 멈췄다.`, `dim`);
      } else if (
        this.time - e.lastHurtAt < 4 ||
        this.monsters.some((e) => {
          return !e.dead && (e.state === `chase` || e.state === `attack`);
        })
      ) {
        this.msg(`적이 가까이 있어 쉴 수 없다.`, `warn`);
      } else {
        this.cancelSwingForMove();
        e.path = [];
        e.target = null;
        e.resting = true;
        this.setAction(e, `idle`);
        this.msg(`자리에 앉아 숨을 고른다. (회복 3배)`, `info`);
      }
    }
  }
}

export { World };
