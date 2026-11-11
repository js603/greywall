import { tileToScreen } from "../core/iso.js";
import { findPath } from "../core/pathfind.js";
import { ITEMS } from "../data/items.js";

class Bot {
  constructor(w, t) {
    this.nextAct = 0;
    this.plan = ``;
    this.lastLog = ``;
    this.stuck = 0;
    this.lastPos = ``;
    this.talked = ``;
    this.w = w;
    this.a = t;
  }
  log(e) {
    if (e !== this.lastLog) {
      this.lastLog = e;
      this.plan = e;
    }
  }
  potions() {
    return this.w.count(`potion_red`) + this.w.count(`potion_clear`);
  }
  wantKinds() {
    let e = this.w;
    let t = e.player;
    let n = e.quests;

    if (t.level <= 2) {
      return [`slime`];
    }

    if (n.q_slime.state === `active`) {
      return [`slime`, `wolf`];
    }

    if (e.count(`wolf_pelt`) < 6 || n.q_wolf.state === `active`) {
      return [`wolf`];
    }

    if (
      (e.count(`bandit_badge`) < 4 &&
        n.q_strike.state !== `done` &&
        t.level >= 4) ||
      t.level >= 5
    ) {
      return [`bandit`, `wolf`];
    }

    return [`wolf`];
  }
  needTown() {
    let e = this.w;
    let t = e.player;
    let n = e.quests;
    return n.q_slime.state === `ready` ||
      n.q_wolf.state === `ready` ||
      n.q_bandit.state === `ready` ||
      n.q_orc.state === `ready` ||
      (n.q_orc.state === `available` && e.map.id !== `orc`) ||
      n.q_strike.state === `available` ||
      ((n.q_strike.state === `active` || n.q_strike.state === `ready`) &&
        e.questItemsOk(`q_strike`)) ||
      (this.potions() === 0 &&
        t.hp < t.maxHp * 0.35 &&
        e.time - t.lastHurtAt < 3)
      ? true
      : e.count(`book_strike`) && t.level >= 4 && !t.skills.includes(`strike`)
      ? false
      : t.inv.length >= 22;
  }
  walkTo(e, t, n) {
    let r = this.w;
    let i = r.player;

    let a = findPath(r.map, i.x, i.y, e, t, {
      goalTest: n,
      maxNodes: 20000,
    });

    if (!a || !a.length) {
      return false;
    }
    let o = Math.min(a.length - 1, this.a.reach - 1);

    while (o > 0 && this.a.canClick && !this.a.canClick(a[o][0], a[o][1])) {
      o--;
    }

    this.a.move(a[o][0], a[o][1]);
    return true;
  }
  tick() {
    let e = this.w;
    let t = e.player;
    if (
      e.time < this.nextAct ||
      ((this.nextAct = e.time + 0.25), t.dead)
    ) {
      return;
    }

    t.inv.forEach((n, r) => {
      let i = ITEMS[n.item];

      if (
        i.type === `book` &&
        t.level >= (i.reqLevel ?? 1) &&
        !t.skills.includes(i.skill)
      ) {
        this.a.useInv(r);
      }

      if (i.enchant) {
        let t = e.enchantTarget(n.item);

        if (t && t.plus < t.safe) {
          this.a.useInv(r);
        }
      }

      if (i.type === `equip` && (!i.reqLevel || t.level >= i.reqLevel)) {
        let e = t.equip[i.slot] ? ITEMS[t.equip[i.slot]] : null;

        let n = (e) => {
          return e
            ? (e.dmg ? (e.dmg[0] + e.dmg[1]) / e.interval : 0) +
                (e.ac ?? 0) * 2 +
                (e.str ?? 0) * 2 +
                (e.block ?? 0) * 10
            : -1;
        };

        if (n(i) > n(e)) {
          this.a.useInv(r);
        }
      }
    });

    if (t.poison && e.count(`antidote`) && t.hp < t.maxHp * 0.7) {
      this.a.slot(2);
    }

    if (
      t.hp < t.maxHp * 0.45 &&
      t.skills.includes(`heal`) &&
      e.skillState(`heal`).ok &&
      !t.swing
    ) {
      this.a.slot(5);
      return;
    }

    if (
      t.hp < t.maxHp * 0.42 &&
      (t.cooldowns.potion ?? 0) <= e.time
    ) {
      if (e.count(`potion_clear`) && t.hp < t.maxHp * 0.3) {
        this.a.slot(1);
        return;
      }
      if (e.count(`potion_red`)) {
        this.a.slot(0);
        return;
      }
      if (e.count(`potion_clear`)) {
        this.a.slot(1);
        return;
      }
    }
    if (t.cast) {
      return;
    }
    if (
      e.map.id !== `town` &&
      t.hp < t.maxHp * 0.25 &&
      this.potions() === 0 &&
      e.count(`scroll_return`)
    ) {
      this.a.slot(3);
      this.log(`귀환 주문서`);
      return;
    }
    if (e.map.id === `town`) {
      return this.town();
    }
    if (e.map.id === `mine`) {
      this.walkTo(e.map.exits[0].x, e.map.exits[0].y);
      return;
    }
    let n = t.level >= 7;
    if (t.target !== null && t.targetKind === `monster`) {
      let n = e.monsters.find((e) => {
        return e.id === t.target;
      });

      if (
        n &&
        !n.dead &&
        t.skills.includes(`strike`) &&
        e.skillState(`strike`).ok &&
        n.hp > 14 &&
        !t.queuedSkill &&
        t.mp >= 9
      ) {
        this.a.slot(4);
      }

      return;
    }
    let r = e.monsters.find((e) => {
      return (
        !e.dead &&
        (e.state === `attack` || e.state === `chase`) &&
        Math.max(Math.abs(e.x - t.x), Math.abs(e.y - t.y)) <= 3
      );
    });
    if (r) {
      this.a.attack(r.id);
      this.log(`반격: ${r.def.name}`);
      return;
    }
    let i = e.drops
      .filter((e) => {
        return Math.max(Math.abs(e.x - t.x), Math.abs(e.y - t.y)) <= 5;
      })
      .sort((e, n) => {
        return (
          Math.hypot(e.x - t.x, e.y - t.y) - Math.hypot(n.x - t.x, n.y - t.y)
        );
      })[0];
    if (i && t.inv.length < 23) {
      if (t.targetKind !== `drop` || !t.path.length) {
        this.a.pickup(i.id);
      }

      this.log(`줍기`);
      return;
    }
    if (t.path.length || t.moving) {
      return;
    }
    if (this.needTown()) {
      this.log(`마을로`);

      if (e.map.id === `orc`) {
        this.walkTo(24, 49);
      } else {
        this.walkTo(0, 32);
      }

      return;
    }
    if (e.map.id === `forest` && n) {
      this.log(`오크 영지로`);
      this.walkTo(24, 0);
      return;
    }
    if (t.hp < t.maxHp * 0.55) {
      if (!t.resting && e.time - t.lastHurtAt > 4) {
        e.toggleRest();
      }

      this.log(`휴식`);
      return;
    }
    if (t.resting && t.hp < t.maxHp * 0.9) {
      return;
    }
    let a =
      e.map.id === `orc`
        ? t.level >= 10 && this.potions() >= 6
          ? [`orc`, `orc_chief`]
          : [`orc`]
        : this.wantKinds();

    let o = e.monsters
      .filter((e) => {
        return (
          !e.dead &&
          a.includes(e.def.id) &&
          e.state !== `return` &&
          !(e.def.named && !a.includes(e.def.id))
        );
      })
      .map((e) => {
        return {
          m: e,
          d: Math.hypot(e.x - t.x, e.y - t.y),
        };
      })
      .sort((e, t) => {
        return e.d - t.d;
      });

    let s = (t) => {
      return e.monsters.filter((e) => {
        return (
          e !== t &&
          !e.dead &&
          e.def.id === t.def.id &&
          Math.max(Math.abs(e.x - t.x), Math.abs(e.y - t.y)) <= 3
        );
      }).length;
    };

    let c = o
      .filter((e) => {
        return e.m.def.id === a[0];
      })
      .sort((e, t) => {
        return (s(e.m) - s(t.m)) * 4 + (e.d - t.d) / 3;
      });

    let l =
      c.find((e) => {
        return e.d <= 9;
      }) ??
      (c.length && c[0].d < 25
        ? null
        : o.find((e) => {
            return e.d <= 9;
          })) ??
      null;

    if (!l && c.length) {
      let e = c[0].m;

      this.walkTo(e.x, e.y, (t, n) => {
        return Math.max(Math.abs(t - e.x), Math.abs(n - e.y)) <= 3;
      });

      this.log(`이동: ${e.def.name} 쪽`);
      return;
    }
    if (l) {
      this.a.attack(l.m.id);
      this.log(`사냥: ${l.m.def.name}`);
      return;
    }
    if (o.length) {
      let e = o[0].m;

      this.walkTo(e.x, e.y, (t, n) => {
        return Math.max(Math.abs(t - e.x), Math.abs(n - e.y)) <= 3;
      });

      this.log(`이동: ${e.def.name} 쪽`);
      return;
    }
    let u = e.map.spawns.find((e) => {
      return e.kind === a[0];
    });

    if (u) {
      this.walkTo(u.x, u.y, (e, t) => {
        return Math.hypot(e - u.x, t - u.y) <= 3;
      });
    }
  }
  town() {
    let e = this.w;
    let t = e.player;
    let n = e.quests;
    if (t.path.length || t.moving || t.target !== null) {
      return;
    }

    let r = (t) => {
      return e.npcs.find((e) => {
        return e.npcId === t;
      });
    };

    let i = (e) => {
      let n = r(e);
      return Math.max(Math.abs(n.x - t.x), Math.abs(n.y - t.y)) <= 1;
    };

    let a = (e, t) => {
      if (i(e)) {
        t();
        this.a.closeUi();
        this.talked = e;
      } else {
        this.a.talk(r(e).id);
        this.log(`대화: ${e}`);
      }
    };

    e.refreshQuests();

    if (
      [`q_slime`, `q_wolf`, `q_bandit`, `q_orc`].some((e) => {
        return n[e].state === `ready` || n[e].state === `available`;
      }) &&
      this.talked !== `guard`
    ) {
      return a(`guard`, () => {
        for (let e of [`q_slime`, `q_wolf`, `q_bandit`, `q_orc`]) {
          if (n[e].state === `ready`) {
            this.a.complete(e);
          }

          if (n[e].state === `available`) {
            this.a.accept(e);
          }
        }
      });
    }

    if (
      (n.q_strike.state === `available` || n.q_strike.state === `ready`) &&
      this.talked !== `trainer`
    ) {
      return a(`trainer`, () => {
        if (n.q_strike.state === `ready`) {
          this.a.complete(`q_strike`);
        }

        if (n.q_strike.state === `available`) {
          this.a.accept(`q_strike`);
        }
      });
    }
    let o =
      (n.q_strike.state === `active` || n.q_strike.state === `ready`) &&
      e.count(`wolf_pelt`) >= 6 &&
      e.count(`bandit_badge`) >= 3
        ? 100
        : 0;

    let s = t.inv
      .map((e, t) => {
        return {
          s: e,
          i: t,
        };
      })
      .filter(({ s: e }) => {
        return (
          [`jelly`, `bone_dust`, `ghoul_fang`].includes(e.item) ||
          ITEMS[e.item].type === `equip` ||
          (e.item === `wolf_pelt` && n.q_strike.state === `done`) ||
          (e.item === `bandit_badge` && n.q_strike.state === `done`) ||
          [`orc_tusk`, `rot_cloth`].includes(e.item)
        );
      });

    let c = Math.max(0, 6 - e.count(`potion_red`));
    let l = Math.max(0, 3 - e.count(`potion_red`));
    if (
      (s.length ||
        (c > 0 && t.coins - o >= 25) ||
        (!e.count(`scroll_return`) && t.coins - o >= 40)) &&
      this.talked !== `alchemist`
    ) {
      return a(`alchemist`, () => {
        for (let { i: e } of s.reverse()) {
          this.a.sell(e);
        }
        let n = t.coins;
        for (let e = 0; e < c && (n - o >= 25 || (e < l && n >= 25)); e++) {
          this.a.buy(`alchemist`, `potion_red`);
          n -= 25;
        }

        if (!e.count(`scroll_return`) && n - o >= 40) {
          this.a.buy(`alchemist`, `scroll_return`);
        }
      });
    }
    let u = [
      [`leather_shield`, 120],
      [`iron_sword`, 220],
      [`leather_armor`, 150],
    ]
      .filter(([n]) => {
        return (
          !t.equip.weapon?.startsWith(String(n)) &&
          t.equip.shield !== n &&
          t.equip.armor !== n &&
          e.count(String(n)) === 0 &&
          (n !== `leather_armor` ||
            (t.equip.armor !== `chain_mail` &&
              t.equip.armor !== `leather_armor`))
        );
      })
      .find(([, e]) => {
        return t.coins - o - 75 >= Number(e);
      });
    if (u && this.talked !== `smith`) {
      return a(`smith`, () => {
        return this.a.buy(`smith`, String(u[0]));
      });
    }
    this.talked = ``;
    this.log(`숲으로`);
    this.walkTo(37, 17);
  }
}
function createBotDriver(e, t) {
  let n = (e) => {
    let t = document.querySelector(e);
    return t && !t.disabled ? (t.click(), true) : false;
  };

  let r = (e, n) => {
    let r = t().cameras.main;
    let i = r.worldView;
    return {
      x: (e - i.x) * r.zoom,
      y: (n - i.y) * r.zoom,
      inside:
        e > i.x + 4 &&
        e < i.right - 4 &&
        n > i.y + 4 &&
        n < i.bottom - 60 / r.zoom,
    };
  };

  let i = (e, n) => {
    let i = r(e, n);
    return i.inside
      ? (t().onPointer({
          x: i.x,
          y: i.y,
        }),
        true)
      : false;
  };

  let a = (n) => {
    let r = e().entity(n);
    if (!r) {
      return null;
    }
    let i = t().entScreen(r);
    return {
      x: i.x,
      y: i.y - 16,
    };
  };

  let o = {
    reach: 7,
    canClick: (t, n) => {
      let i = tileToScreen(t, n, e().map.floorLevel(t, n) * 16);
      return r(i.x, i.y).inside;
    },
    move: (t, n) => {
      let r = tileToScreen(t, n, e().map.floorLevel(t, n) * 16);
      i(r.x, r.y);
    },
    attack: (t) => {
      let n = a(t);
      if (n && !i(n.x, n.y)) {
        let n = e().entity(t);
        s.walkTo(n.x, n.y, (e, t) => {
          return Math.max(Math.abs(e - n.x), Math.abs(t - n.y)) <= 2;
        });
      }
    },
    talk: (t) => {
      let n = a(t);
      if (n && !i(n.x, n.y - 6)) {
        let n = e().entity(t);
        s.walkTo(n.x, n.y, (e, t) => {
          return Math.max(Math.abs(e - n.x), Math.abs(t - n.y)) <= 1;
        });
      }
    },
    pickup: (n) => {
      let r = e().drops.find((e) => {
        return e.id === n;
      });

      let a = t()?.dropImgs.get(n);

      if (r && a) {
        i(a.x, a.y);
      }
    },
    slot: (e) => {
      n(`.slot[data-slot="${e}"]`);
    },
    accept: (e) => {
      n(`[data-q="accept:${e}"]`);
    },
    complete: (e) => {
      n(`[data-q="done:${e}"]`);
    },
    buy: (e, t) => {
      if (!document.querySelector(`[data-buy]`)) {
        n(`[data-act="shop"]`);
      }

      n(`[data-tab="buy"]`);
      n(`[data-buy="${t}"]`);
    },
    sell: (e) => {
      if (!document.querySelector(`[data-tab]`)) {
        n(`[data-act="shop"]`);
      }

      n(`[data-tab="sell"]`);
      n(`[data-sell="${e}"]`);
    },
    useInv: (e) => {
      if (!document.querySelector(`[data-cell]`)) {
        n(`[data-open="bag"]`);
      }

      n(`[data-cell="${e}"]`);
      n(`[data-act="use"]`);
      n(`[data-act="close"]`);
    },
    closeUi: () => {
      n(`[data-act="close"]`);
    },
  };

  let s = new Bot(e(), o);
  return {
    tick: () => {
      if (s.w !== e()) {
        s = new Bot(e(), o);
      }

      if (t()) {
        if (e().player.dead) {
          n(`[data-act="revive"]`);
        } else {
          s.tick();
        }
      }
    },
    get plan() {
      return s.plan;
    },
  };
}

export { Bot, createBotDriver };
