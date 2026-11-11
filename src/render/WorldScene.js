import Phaser from "phaser";
import { audio } from "../audio.js";
import { screenToTileRound, tileToScreen } from "../core/iso.js";
import { ITEMS } from "../data/items.js";
import { ANIMS, ASSETS, FX_DEFS } from "./assets.js";
import { Monster, Npc } from "../sim/entities.js";

const GROUND_ROWS = {
  water: -2,
  bog: -1,
  mine: 0,
  forest: 1,
  grave: 2,
  grass: 3,
  dirt: 4,
  road: 5,
  plaza: 6,
};
const elevPx = (e) => {
  return e * 16;
};
class WorldScene extends Phaser.Scene {
  constructor() {
    super(`world`);
    this.ground = [];
    this.objs = [];
    this.statics = [];
    this.cullables = [];
    this.fxCull = 0;
    this.lastNow = 0;
    this.alphaMasks = {};
    this.fadeKey = ``;
    this.ents = new Map();
    this.dropImgs = new Map();
    this.fx = [];
    this.floaters = [];
    this.destMark = null;
    this.keys = new Set();
    this.paused = false;
    this.zoomPref = 0;
    this.hover = null;
    this.blessFx = null;
    this.poisonFx = null;
    this.camX = 0;
    this.camY = 0;
    this.fires = [];
    this.shots = [];
    this.auraW = null;
    this.labels = new Map();
    this.bubble = null;
    this.nextBubble = 0;
    this.hold = null;
  }
  init(e) {
    this.world = e.world;
    this.hooks = e.hooks;
  }
  preload() {
    for (let [e, t] of Object.entries(ASSETS.atlases)) {
      this.load.atlas(e, t.png, t.json);
    }
    for (let [e, t] of Object.entries(ASSETS.fx)) {
      this.load.atlas(`fx_` + e, t.png, t.json);
    }
  }
  create() {
    for (let e of [`props_tall`, `props_small`]) {
      let t = this.textures.get(e).getSourceImage();
      let n = document.createElement(`canvas`);
      n.width = t.width;
      n.height = t.height;
      let r = n.getContext(`2d`);
      r.drawImage(t, 0, 0);
      let i = r.getImageData(0, 0, t.width, t.height).data;
      let a = new Uint8Array(t.width * t.height);
      for (let e = 0; e < a.length; e++) {
        a[e] = i[e * 4 + 3];
      }
      this.alphaMasks[e] = {
        w: t.width,
        a,
      };
    }
    if (!this.textures.exists(`light`)) {
      let e = this.textures.createCanvas(`light`, 128, 128);
      let t = e.getContext();
      let n = t.createRadialGradient(64, 64, 0, 64, 64, 64);
      n.addColorStop(0, `rgba(255,255,255,1)`);
      n.addColorStop(0.45, `rgba(255,255,255,0.75)`);
      n.addColorStop(1, `rgba(255,255,255,0)`);
      t.fillStyle = n;
      t.fillRect(0, 0, 128, 128);
      e.refresh();
    }

    this.lightImg = this.make
      .image({
        key: `light`,
        add: false,
      })
      .setOrigin(0.5);

    this.dark = this.add
      .renderTexture(0, 0, 64, 64)
      .setOrigin(0)
      .setDepth(9500000)
      .setVisible(false);
    this.marker = this.add.graphics().setDepth(-500000);
    this.bars = this.add.graphics().setDepth(10000000);
    this.cameras.main.setBackgroundColor(`#0b0a0c`).setRoundPixels(true);

    this.input.on(`pointerdown`, (e) => {
      return this.onPointer(e);
    });

    this.input.on(`pointermove`, (e) => {
      return this.onHover(e);
    });

    let e = (e) => {
      if (this.hold && this.hold.p === e) {
        this.hold = null;
      }
    };
    this.input.on(`pointerup`, e);
    this.input.on(`pointerupoutside`, e);

    this.input.on(`gameout`, () => {
      return (this.hold = null);
    });

    this.game.events.on(`blur`, () => {
      return (this.hold = null);
    });

    this.game.events.on(`hidden`, () => {
      return (this.hold = null);
    });

    this.scale.on(`resize`, () => {
      return this.fitZoom();
    });

    this.buildMap();
    this.fitZoom();
    this.hooks.onReady();
  }
  fitZoom() {
    let e = this.scale.width;
    let t = this.scale.height;
    let n =
      this.zoomPref ||
      Math.max(1, Math.min(3, Math.floor(Math.min(e / 440, t / 300))));

    if (!this.zoomPref && Math.min(e, t) < 500 && Math.max(e, t) >= 640) {
      n = Math.max(n, 1.5);
    }

    this.cameras.main.setZoom(n);
  }
  setZoomPref(e) {
    this.zoomPref = e;
    this.fitZoom();
  }
  clearMap() {
    for (let e of this.ground) {
      e.destroy();
    }
    this.ground = [];
    this.fires = [];
    for (let e of this.labels.values()) {
      e.destroy();
    }
    this.labels.clear();
    this.bubble?.t.destroy();
    this.bubble = null;
    for (let e of this.objs) {
      e.img.destroy();
    }
    this.objs = [];
    for (let e of this.statics) {
      e.destroy();
    }
    this.statics = [];
    this.cullables = [];
    for (let e of this.shots) {
      e.spr.destroy();
    }
    this.shots = [];
    for (let e of this.ents.values()) {
      e.spr.destroy();
      e.shadow.destroy();
      e.label?.destroy();
    }
    this.ents.clear();
    for (let e of this.dropImgs.values()) {
      e.destroy();
    }
    this.dropImgs.clear();
    for (let e of this.fx) {
      e.spr.destroy();
    }
    this.fx = [];
    this.blessFx = null;
    this.poisonFx = null;
    this.auraW?.destroy();
    this.auraW = null;
    for (let e of this.floaters) {
      e.t.destroy();
    }
    this.floaters = [];
  }
  buildMap() {
    this.clearMap();
    let e = this.world.map;
    let t = -e.h * 32 - 64;
    let n = e.w * 32 + 64;
    let r = -160;
    let i = (e.w + e.h) * 16 + 64;
    this.cameras.main.setBounds(t - 200, -360, n - t + 400, i - r + 400);
    let a = 1024;
    for (let o = r; o < i; o += a) {
      for (let r = t; r < n; r += a) {
        let t = this.add
          .renderTexture(r, o, a, a)
          .setOrigin(0)
          .setDepth(-1000000);
        t.beginDraw();
        let n = false;
        for (let i = 0; i < e.h; i++) {
          for (let s = 0; s < e.w; s++) {
            let c = tileToScreen(s, i);
            if (
              c.x + 32 < r ||
              c.x - 32 > r + a ||
              c.y + 16 < o ||
              c.y - 16 > o + a
            ) {
              continue;
            }
            let l = e.idx(s, i);
            if (
              e.elev[l] > 0 ||
              (e.id === `mine` && e.block[l] && !e.objectAt(s, i))
            ) {
              continue;
            }
            let d = e.ground[l];
            t.batchDrawFrame(
              `tiles`,
              `${d}_${e.variant[l]}`,
              c.x - 32 - r,
              c.y - 16 - o
            );
            n = true;
            for (let [n, a, l] of [
              [-1, 0, `NW`],
              [0, -1, `NE`],
              [1, 0, `SE`],
              [0, 1, `SW`],
            ]) {
              if (!e.inside(s + n, i + a)) {
                continue;
              }
              let u = e.idx(s + n, i + a);
              if (e.elev[u] > 0) {
                continue;
              }
              let f = e.ground[u];

              if (GROUND_ROWS[f] > GROUND_ROWS[d]) {
                t.batchDrawFrame(
                  `tiles`,
                  `ov_${f}_${l}`,
                  c.x - 32 - r,
                  c.y - 16 - o
                );
              }
            }
          }
        }
        t.endDraw();

        if (n) {
          this.ground.push(t);
        } else {
          t.destroy();
        }
      }
    }
    for (let t = 0; t < e.h; t++) {
      for (let n = 0; n < e.w; n++) {
        let r = e.idx(n, t);
        if (!e.elev[r]) {
          continue;
        }
        let i = tileToScreen(n, t);
        let a = this.add
          .image(
            i.x,
            i.y,
            `props_small`,
            e.id === `town` ? `cliff_stone` : `cliff_rock`
          )
          .setDepth(elevPx(n + t) + 0.2);
        let o = this.add
          .image(
            i.x,
            i.y - 16 * e.elev[r],
            `tiles`,
            `${e.ground[r]}_${e.variant[r]}`
          )
          .setDepth(elevPx(n + t) + 0.3);
        this.statics.push(a, o);

        this.cullables.push(
          {
            o: a,
            b: a.getBounds(),
          },
          {
            o,
            b: o.getBounds(),
          }
        );
      }
    }
    for (let t of e.objects) {
      let n = tileToScreen(t.x, t.y, e.elevAt(t.x, t.y) * 16);
      let r = this.add.image(n.x, n.y, t.atlas, t.key);
      let i = !t.tall && !t.blocks;
      let a = elevPx(t.x + t.y) + (i ? 0.4 : t.front ? 12 : 1);
      r.setDepth(a);
      let o = {
        img: r,
        o: t,
        depth: a,
        b: r.getBounds(),
        alpha: 1,
      };
      this.objs.push(o);

      if (t.fx !== `torch` && t.fx !== `campfire`) {
        this.cullables.push({
          o: r,
          b: o.b,
        });
      }

      if (t.fx === `torch` || t.fx === `campfire`) {
        r.setVisible(false);

        this.playFx(t.fx, n.x, n.y + 2, a + 0.5, {
          loop: true,
          scale: 0.5,
        });

        let e = n.y - (t.fx === `torch` ? 30 : 8);
        let i = t.fx === `torch` ? 120 : 150;
        let o = this.add
          .image(n.x, e, `light`)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(16751164)
          .setDepth(9600000)
          .setScale((i / 64) * 0.9)
          .setAlpha(0);
        this.statics.push(o);

        this.fires.push({
          x: n.x,
          y: e,
          r: i,
          flicker: Math.random() * 10,
          glow: o,
        });
      }
    }
    for (let t of e.exits) {
      let n = tileToScreen(t.x, t.y, e.elevAt(t.x, t.y) * 16);
      let r = this.add.graphics().setDepth(elevPx(t.x + t.y) + 0.45);
      r.fillStyle(16047242, 0.18).fillPoints(
        [
          new Phaser.Geom.Point(n.x, n.y - 14),
          new Phaser.Geom.Point(n.x + 28, n.y),
          new Phaser.Geom.Point(n.x, n.y + 14),
          new Phaser.Geom.Point(n.x - 28, n.y),
        ],
        true
      );
      this.statics.push(r);

      if (
        t ===
        e.exits.find((e) => {
          return e.to === t.to;
        })
      ) {
        let e = this.add
          .text(n.x, n.y - 52, `▶ ${t.label}`, {
            fontFamily: `Galmuri11`,
            fontSize: `11px`,
            color: `#f4dc8a`,
            stroke: `#1a1316`,
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(10000000 - 1);
        this.statics.push(e);
      }
    }
    for (let e of this.world.npcs) {
      this.ensureEnt(e);
    }
    this.ensureEnt(this.world.player);
    for (let e of this.world.monsters) {
      this.ensureEnt(e);
    }
    let o = this.entScreen(this.world.player);
    this.camX = o.x;
    this.camY = o.y;
    this.cameras.main.centerOn(o.x, o.y - 20);
    this.cameras.main.fadeIn(250, 11, 10, 12);
    audio.setTrack(e.music);
  }
  ensureEnt(e) {
    let t = this.ents.get(e.id);
    if (t) {
      return t;
    }
    let n = this.add.sprite(0, 0, e.sprite, `f0`);
    let r = [`knight`, `lich`, `orc_chief`].includes(e.sprite)
      ? 1.35
      : e.sprite === `ghoul`
      ? 1.15
      : e.sprite === `slime`
      ? 0.85
      : e.sprite === `wolf`
      ? 1.2
      : e.sprite === `spider`
      ? 1.5
      : 1;

    t = {
      spr: n,
      shadow: this.add.ellipse(0, 0, 22 * r, 9 * r, 0, 0.32),
      phase: 0,
      flashUntil: 0,
    };

    if (e.kind === `npc`) {
      t.label = this.add
        .text(0, 0, e.name, {
          fontFamily: `Galmuri11`,
          fontSize: `11px`,
          color: `#f6efe0`,
          stroke: `#1a1316`,
          strokeThickness: 3,
        })
        .setOrigin(0.5, 1)
        .setDepth(10000000 - 2);
    }

    this.ents.set(e.id, t);
    return t;
  }
  entScreen(e) {
    let t = this.world.map;
    let n =
      t.floorLevel(e.fx, e.fy) +
      (t.floorLevel(e.x, e.y) - t.floorLevel(e.fx, e.fy)) * e.t;
    return tileToScreen(e.px, e.py, n * 16);
  }
  frameFor(e, t, n) {
    let r = ANIMS[e.sprite];
    let i = e.action;

    if (e.kind === `npc`) {
      i = `idle`;
    }

    let a = r.clips[`${i}_${e.facing}`] ?? r.clips[`idle_${e.facing}`];

    let o = a.durations.reduce((e, t) => {
      return e + t;
    }, 0);

    let s;

    if (i === `walk`) {
      t.phase +=
        n *
        1000 *
        (0.42 / Math.max(0.25, e.stepBase));
      s = t.phase % o;
    } else {
      s = (this.world.time - e.actionStart) * 1000;
      a.loop
        ? (s %= o)
        : s >= o &&
          (i === `death`
            ? (s = o - 1)
            : ((a = r.clips[`idle_${e.facing}`]), (s = 0)));
    }

    if (e.kind === `npc`) {
      s = (this.world.time * 1000 + e.id * 333) % o;
    }

    let c = 0;
    for (let e = 0; e < a.frames.length; e++) {
      c += a.durations[e];

      if (s < c) {
        return `f` + a.frames[e];
      }
    }
    return `f` + a.frames[a.frames.length - 1];
  }
  syncEnt(e, t) {
    let n = this.ensureEnt(e);
    let r = this.entScreen(e);
    let i = e instanceof Monster && e.gone;
    n.spr.setVisible(!i);
    n.shadow.setVisible(!i && !(e.dead && e.kind !== `player`));

    if (i) {
      return;
    }

    n.spr.setFrame(this.frameFor(e, n, t));
    n.spr.setPosition(Math.round(r.x), Math.round(r.y));
    let a = elevPx(e.px + e.py) + 8;
    n.spr.setDepth(a);
    n.shadow.setPosition(Math.round(r.x), Math.round(r.y)).setDepth(a - 6);

    if (e instanceof Monster && e.dead) {
      n.spr.setAlpha(
        Math.max(0, Math.min(1, (e.removeAt - this.world.time) / 1.2))
      );
    } else {
      n.spr.setAlpha(1);
    }

    if (this.world.time < n.flashUntil) {
      n.spr.setTintFill(16777215);
    } else if (this.hover === e.id && e.kind !== `player`) {
      n.spr.setTint(16770736);
    } else {
      n.spr.clearTint();
    }

    if (e === this.world.player && this.world.player.resting) {
      n.spr.setTint(12109055);
    }

    if (n.label) {
      n.label.setPosition(Math.round(r.x), Math.round(r.y) - 50);
    }
  }
  playFx(e, t, n, r, i = {}) {
    let a = FX_DEFS[e];
    if (!a) {
      return null;
    }
    let o = this.add.sprite(t, n, `fx_` + e, 0).setDepth(r);
    let s = a.pivot ?? [a.w / 2, a.h / 2];
    o.setOrigin(s[0] / a.w, s[1] / a.h)
      .setScale(i.scale ?? 1)
      .setFlipX(!!i.flip);
    let c = {
      spr: o,
      key: e,
      t: 0,
      loop: i.loop ?? a.loop,
      follow: i.follow,
      dy: i.dy ?? 0,
      front: true,
      until: i.until,
    };
    this.fx.push(c);
    return c;
  }
  updateFx(e) {
    for (let t of this.fx) {
      t.t += e * 1000;
      let n = FX_DEFS[t.key];

      let r = n.durations.reduce((e, t) => {
        return e + t;
      }, 0);

      let i = t.t;

      if (t.loop) {
        i %= r;
      }

      if (
        (!t.loop && i >= r) ||
        (t.until !== undefined && this.world.time > t.until)
      ) {
        t.spr.destroy();
        t.dead = true;
        continue;
      }

      let a = 0;
      let o = 0;
      for (let e = 0; e < n.durations.length; e++) {
        a += n.durations[e];

        if (i < a) {
          o = e;
          break;
        }

        o = e;
      }
      t.spr.setFrame(o);

      if (t.follow !== undefined) {
        let e = this.world.entity(t.follow);
        if (!e || e.gone) {
          t.spr.destroy();
          t.dead = true;
          continue;
        }
        let n = this.entScreen(e);
        t.spr
          .setPosition(Math.round(n.x), Math.round(n.y + t.dy))
          .setDepth(elevPx(e.px + e.py) + 9);
      }
    }

    this.fx = this.fx.filter((e) => {
      return !e.dead;
    });

    if (this.blessFx && this.blessFx.dead) {
      this.blessFx = null;
    }

    if (this.poisonFx && this.poisonFx.dead) {
      this.poisonFx = null;
    }
  }
  floatText(e, t, n, r, i = 12) {
    let a = this.add
      .text(Math.round(e), Math.round(t), n, {
        fontFamily: `Galmuri11`,
        fontSize: i + `px`,
        color: r,
        stroke: `#140e10`,
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(10000000 + 1);
    this.floaters.push({
      t: a,
      vy: -22,
      life: 0.9,
    });
  }
  handleEvents() {
    let e = this.world;
    let t = e.events;
    e.events = [];
    for (let e of t) {
      try {
        this.handleEvent(e);
      } catch (t) {
        console.error(`event`, e.type, t);
      }
    }
  }
  handleEvent(e) {
    let t = this.world;
    {
      this.hooks.onEvent(e);
      let n = e.id === undefined ? undefined : t.entity(e.id);
      let r = e.target === undefined ? undefined : t.entity(e.target);

      let i = (e) => {
        let t = this.entScreen(e);
        let n = [`knight`, `lich`, `orc_chief`].includes(e.sprite)
          ? 1.25
          : [`wolf`, `slime`, `spider`].includes(e.sprite)
          ? 0.5
          : 1;
        return {
          x: t.x,
          y: t.y - 24 * n,
          s: t,
        };
      };

      switch (e.type) {
        case `mapchange`: {
          this.buildMap();
          break;
        }
        case `swing`: {
          audio.play(`swing`);
          break;
        }
        case `whiff`: {
          if (n === t.player) {
            let e = i(t.player);
            this.floatText(e.x, e.y - 20, `허공`, `#9a979c`, 10);
            audio.play(`whiff`);
          }
          break;
        }
        case `hit`: {
          if (r && n) {
            let a = i(r);
            let o = this.entScreen(n).x > a.s.x;
            let s = e.kind === `strike`;

            this.playFx(
              s ? `strike` : `hit`,
              a.x,
              a.y,
              elevPx(r.px + r.py) + 9,
              {
                flip: o,
                scale: 1,
              }
            );

            audio.play(s ? `strike` : r === t.player ? `hurt` : `hit`);
            this.floatText(
              a.x,
              a.y - 18,
              String(e.dmg),
              r === t.player ? `#ff6a52` : s ? `#f4dc8a` : `#f6efe0`,
              s ? 16 : 12
            );
            let c = this.ents.get(r.id);

            if (c) {
              c.flashUntil = t.time + 0.07;
            }
          }
          break;
        }
        case `miss`: {
          if (r) {
            let e = i(r);
            this.floatText(e.x, e.y - 18, `빗나감`, `#9a979c`, 10);
            audio.play(`miss`);
          }
          break;
        }
        case `block`: {
          if (r) {
            let e = i(r);

            this.playFx(`block`, e.x, e.y, elevPx(r.px + r.py) + 9, {
              scale: 0.5,
            });

            this.floatText(e.x, e.y - 18, `막음`, `#7290c0`, 10);
            audio.play(`block`);
          }
          break;
        }
        case `death`: {
          if (n && e.silent) {
            let e = i(n);
            this.playFx(`poof`, e.s.x, e.s.y - 4, elevPx(n.px + n.py) + 9, {
              scale: 0.5,
            });
            break;
          }
          if (n) {
            let e = i(n);

            this.playFx(
              n.sprite === `skeleton` || n.sprite === `knight`
                ? `soul`
                : `poof`,
              e.s.x,
              e.s.y - 4,
              elevPx(n.px + n.py) + 9,
              {
                scale: 0.5,
              }
            );

            audio.play(`mdeath`);
          }
          break;
        }
        case `pdeath`: {
          audio.play(`death`);
          break;
        }
        case `drop`:
          {
            let n = t.drops.find((t) => {
              return t.id === e.id;
            });

            if (n) {
              this.addDrop(n);
            }
          }
          break;
        case `pickup`:
          {
            let t = this.dropImgs.get(e.id);

            if (t) {
              this.playFx(`pickup`, t.x, t.y - 6, t.depth + 1, {
                scale: 0.3,
              });

              t.destroy();
              this.dropImgs.delete(e.id);
            }

            this.labels.get(e.id)?.destroy();
            this.labels.delete(e.id);
            audio.play(e.item === `coin` ? `coin` : `pickup`);
          }
          break;
        case `levelup`:
          {
            let e = i(t.player);

            this.playFx(`heal`, e.s.x, e.s.y, 0, {
              follow: 0,
              scale: 0.5,
              dy: 2,
            });

            this.floatText(e.x, e.y - 30, `LEVEL UP`, `#f4dc8a`, 14);
            audio.play(`levelup`);
          }
          break;
        case `heal`: {
          this.playFx(`heal`, 0, 0, 0, {
            follow: 0,
            scale: 0.5,
            dy: 2,
          });

          audio.play(`heal`);

          if (e.amount) {
            let n = i(t.player);
            this.floatText(n.x, n.y - 18, `+` + e.amount, `#97cd68`, 12);
          }

          break;
        }
        case `bless`: {
          this.blessFx?.spr.destroy();

          this.blessFx = this.playFx(`bless`, 0, 0, 0, {
            follow: 0,
            scale: 0.5,
            loop: true,
            until: t.player.blessUntil,
            dy: 2,
          });

          audio.play(`bless`);
          break;
        }
        case `potion`:
          {
            let n = i(t.player);

            if (e.heal) {
              this.floatText(n.x, n.y - 18, `+` + e.heal, `#97cd68`, 12);
            }

            audio.play(`potion`);
          }
          break;
        case `status`: {
          if (e.status === `poison`) {
            e.on &&
              !this.poisonFx &&
              ((this.poisonFx = this.playFx(`poison`, 0, 0, 0, {
                follow: 0,
                scale: 0.34,
                loop: true,
                dy: 3,
              })),
              audio.play(`poison`));

            !e.on &&
              this.poisonFx &&
              (this.poisonFx.spr.destroy(),
              (this.poisonFx.dead = true),
              (this.poisonFx = null));
          }

          break;
        }
        case `dot`:
          {
            let n = i(t.player);
            this.floatText(n.x, n.y - 18, `-` + e.dmg, `#a8d870`, 10);
          }
          break;
        case `step`: {
          audio.play(`step`);
          break;
        }
        case `alert`: {
          if (n) {
            let e = i(n);
            this.floatText(e.x, e.y - 26, `!`, `#ffd34a`, 14);
            audio.play(`alert`);
          }
          break;
        }
        case `blocked`: {
          this.destMark = {
            x: e.x,
            y: e.y,
            t: 0,
            bad: true,
          };

          audio.play(`deny`);
          break;
        }
        case `dest`: {
          this.destMark = {
            x: e.x,
            y: e.y,
            t: 0,
            bad: false,
          };
          break;
        }
        case `learn`: {
          audio.play(`learn`);
          break;
        }
        case `return`: {
          audio.play(`return`);
          break;
        }
        case `spawn`:
          {
            let n = t.entity(e.id);

            if (n) {
              this.ensureEnt(n);
            }
          }
          break;
        case `enchant`:
          {
            let n = i(t.player);

            if (e.ok) {
              this.playFx(
                `enchant`,
                n.s.x,
                n.s.y,
                elevPx(t.player.px + t.player.py) + 9,
                {
                  scale: 0.5,
                }
              );

              audio.play(`learn`);
              this.floatText(n.x, n.y - 30, `+${e.plus}`, `#9fd0ff`, 16);
            } else {
              this.playFx(
                `poof`,
                n.s.x,
                n.y,
                elevPx(t.player.px + t.player.py) + 9,
                {
                  scale: 0.5,
                }
              );

              audio.play(`death`);
              this.floatText(n.x, n.y - 30, `증발`, `#ff7a62`, 14);
            }
          }
          break;
        case `buff`:
          {
            let n = i(t.player);

            this.playFx(e.buff === `haste` ? `haste` : `enchant`, 0, 0, 0, {
              follow: 0,
              scale: 0.5,
              dy: 2,
            });

            this.floatText(
              n.x,
              n.y - 30,
              e.buff === `haste` ? `신속` : `투지`,
              e.buff === `haste` ? `#97cd68` : `#f4dc8a`,
              12
            );
            audio.play(`bless`);
          }
          break;
        case `teleport`:
          {
            let e = this.entScreen(t.player);
            this.camX = e.x;
            this.camY = e.y - 20;

            this.playFx(
              `teleport`,
              e.x,
              e.y - 18,
              elevPx(t.player.px + t.player.py) + 9,
              {
                scale: 0.5,
              }
            );

            audio.play(`return`);
          }
          break;
        case `shot`: {
          if (n && r) {
            let t = i(n);
            let r = e.kind === `bolt` ? `bolt` : `arrow`;
            if (FX_DEFS[r]) {
              let n = this.add
                .sprite(t.x, t.y, `fx_` + r, 0)
                .setOrigin(0.5)
                .setScale(e.kind === `bolt` ? 0.5 : 0.4)
                .setDepth(10000000 - 5);
              this.shots.push({
                spr: n,
                from: e.id,
                to: e.target,
                t: 0,
                dur: e.dur,
                key: r,
                sx: t.x,
                sy: t.y,
              });
            }
            audio.play(e.kind === `bolt` ? `bless` : `whiff`);
          }
        }
      }
    }
  }
  addDrop(e) {
    let t = this.world.map;
    let n = tileToScreen(e.x, e.y, t.elevAt(e.x, e.y) * 16);
    let r = this.dropImgs.size % 3;
    let i = (r - 1) * 6;
    let a = (r - 1) * 2;
    let o = this.add
      .image(n.x + i, n.y + a - 2, `icons`, ITEMS[e.item].icon)
      .setDepth(elevPx(e.x + e.y) + 2)
      .setScale(0.75);

    this.tweens.add({
      targets: o,
      y: o.y - 8,
      duration: 140,
      yoyo: true,
      ease: `Quad.easeOut`,
    });

    this.dropImgs.set(e.id, o);
    let s = ITEMS[e.item];
    let c =
      e.item === `coin`
        ? `동전 ${e.count}`
        : (e.plus ? `+${e.plus} ` : ``) +
          s.name +
          (e.count > 1 ? ` ×${e.count}` : ``);
    let l =
      e.item === `coin`
        ? `#f4dc8a`
        : s.type === `book`
        ? `#ffc35a`
        : s.enchant || e.item === `scroll_teleport`
        ? `#9fd0ff`
        : e.plus
        ? `#a8d870`
        : s.type === `equip`
        ? `#e6dcc8`
        : `#c8c0b0`;

    let d = this.world.drops.filter((t) => {
      return (
        t.x === e.x && t.y === e.y && t.id !== e.id && this.labels.has(t.id)
      );
    }).length;

    let f = this.add
      .text(Math.round(o.x), Math.round(o.y) - 13 - d * 11, c, {
        fontFamily: `Galmuri11`,
        fontSize: `10px`,
        color: l,
        stroke: `#140e10`,
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(10000000 - 3);

    this.labels.set(e.id, f);
  }
  pickEntity(e, t) {
    let n = this.world;
    let r = null;
    let i = -1000000000;

    let a = (n, a, o) => {
      let s = this.entScreen(n);
      if (e < s.x - a / 2 || e > s.x + a / 2 || t < s.y - o || t > s.y + 4) {
        return;
      }
      let c = elevPx(n.px + n.py);

      if (c > i) {
        i = c;
        r = n;
      }
    };

    for (let e of n.monsters) {
      if (!e.dead) {
        a(
          e,
          [`wolf`, `spider`].includes(e.sprite)
            ? 36
            : e.sprite === `slime`
            ? 26
            : [`knight`, `lich`, `orc_chief`].includes(e.sprite)
            ? 34
            : 26,
          e.sprite === `wolf`
            ? 30
            : e.sprite === `spider`
            ? 24
            : e.sprite === `slime`
            ? 22
            : [`knight`, `lich`, `orc_chief`].includes(e.sprite)
            ? 62
            : 48
        );
      }
    }
    for (let e of n.npcs) {
      a(e, 26, 50);
    }
    if (r) {
      return r;
    }
    for (let r of n.drops) {
      let n = this.dropImgs.get(r.id);
      if (n && Math.abs(e - n.x) < 11 && Math.abs(t - n.y) < 11) {
        return r;
      }
    }
    return null;
  }
  pickTile(e, t) {
    let n = this.world.map;
    let r = screenToTileRound(e, t, 16);
    if (n.inside(r.x, r.y) && n.elevAt(r.x, r.y) === 1) {
      return r;
    }
    let i = screenToTileRound(e, t, 8);
    return n.inside(i.x, i.y) && n.stairAt(i.x, i.y)
      ? i
      : screenToTileRound(e, t, 0);
  }
  onPointer(e) {
    if (this.paused || this.world.player.dead) {
      return;
    }
    audio.unlock();
    let t = this.cameras.main.getWorldPoint(e.x, e.y);
    let n = this.pickEntity(t.x, t.y);
    if (n instanceof Monster) {
      this.world.commandAttack(n.id);
      return;
    }
    if (n instanceof Npc) {
      this.world.commandTalk(n.id);
      return;
    }
    if (n && n.item) {
      this.world.commandPickup(n.id);
      return;
    }
    let r = this.pickTile(t.x, t.y);
    this.world.commandMove(r.x, r.y);

    if (e && e.isDown !== undefined) {
      this.hold = {
        p: e,
        next: performance.now() + 280,
        tx: r.x,
        ty: r.y,
      };
    }
  }
  updateHold() {
    let e = this.hold;
    if (!e) {
      return;
    }
    if (!e.p.isDown || this.paused || this.world.player.dead) {
      this.hold = null;
      return;
    }
    let t = performance.now();
    if (t < e.next) {
      return;
    }
    e.next = t + 220;
    let n = this.cameras.main.getWorldPoint(e.p.x, e.p.y);
    let r = this.pickTile(n.x, n.y);
    let i = this.world.player;

    if (
      (r.x !== e.tx || r.y !== e.ty || (!i.path.length && !i.moving)) &&
      (r.x !== i.x || r.y !== i.y)
    ) {
      e.tx = r.x;
      e.ty = r.y;
      this.world.commandMove(r.x, r.y);
    }
  }
  onHover(e) {
    if (e.wasTouch) {
      return;
    }
    let t = this.cameras.main.getWorldPoint(e.x, e.y);
    let n = this.pickEntity(t.x, t.y);
    this.hover = n && n.kind ? n.id : null;
    this.game.canvas.style.cursor =
      n instanceof Monster ? `crosshair` : n ? `pointer` : `default`;
  }
  keyDir() {
    let e = this.keys;
    let t = e.has(`ArrowUp`) || e.has(`KeyW`);
    let n = e.has(`ArrowDown`) || e.has(`KeyS`);
    let r = e.has(`ArrowLeft`) || e.has(`KeyA`);
    let i = e.has(`ArrowRight`) || e.has(`KeyD`);
    return (
      {
        "-1,0": `N`,
        "1,0": `S`,
        "0,1": `E`,
        "0,-1": `W`,
        "-1,1": `NE`,
        "-1,-1": `NW`,
        "1,1": `SE`,
        "1,-1": `SW`,
      }[`${!!n - +!!t},${!!i - +!!r}`] ?? null
    );
  }
  update(e, t) {
    let n = this.world;
    let r = performance.now();
    let i = this.lastNow
      ? Math.min(0.25, (r - this.lastNow) / 1000)
      : Math.min(0.1, t / 1000);
    this.lastNow = r;

    if (this.paused || document.hidden) {
      i = 0;
    }

    this.updateHold();
    for (let e = i; e > 0.000001 /* 1e-6 */; e -= 0.05) {
      n.update(Math.min(0.05, e));
    }
    this.handleEvents();
    let a = [n.player, ...n.monsters, ...n.npcs];
    for (let e of a) {
      this.syncEnt(e, i);
    }
    for (let e of [...this.ents.keys()]) {
      if (
        !a.some((t) => {
          return t.id === e;
        })
      ) {
        let t = this.ents.get(e);
        t.spr.destroy();
        t.shadow.destroy();
        t.label?.destroy();
        this.ents.delete(e);
      }
    }
    for (let [e, t] of this.dropImgs) {
      if (
        !n.drops.some((t) => {
          return t.id === e;
        })
      ) {
        t.destroy();
        this.dropImgs.delete(e);
        this.labels.get(e)?.destroy();
        this.labels.delete(e);
      }
    }
    for (let e of n.drops) {
      let t = this.labels.get(e.id);

      if (t) {
        t.setVisible(
          Math.max(Math.abs(e.x - n.player.px), Math.abs(e.y - n.player.py)) <=
            7
        );
      }
    }
    this.updateShots(i);
    this.updateAura();
    this.updateBubbles();
    this.updateLighting();
    this.updateFx(i);
    let o = this.entScreen(n.player);
    let s = 1 - 0.0015 ** (i || 0.016);
    this.camX += (o.x - this.camX) * s;
    this.camY += (o.y - 20 - this.camY) * s;
    let c = this.hooks.viewShift?.() ?? 0;
    this.cameras.main.centerOn(
      Math.round(this.camX),
      Math.round(this.camY + c / this.cameras.main.zoom)
    );
    this.updateFade(o);
    this.cull();
    this.drawMarkers(i);
    for (let e of this.floaters) {
      e.life -= i;
      e.t.y += e.vy * i;
      e.t.setAlpha(Math.max(0, e.life / 0.5));

      if (e.life <= 0) {
        e.t.destroy();
      }
    }

    this.floaters = this.floaters.filter((e) => {
      return e.life > 0;
    });

    this.hooks.onFrame();
  }
  cull() {
    let e = this.cameras.main.worldView;
    let t = new Phaser.Geom.Rectangle(
      e.x - 96,
      e.y - 96,
      e.width + 192,
      e.height + 240
    );
    for (let e of this.cullables) {
      e.o.setVisible(Phaser.Geom.Intersects.RectangleToRectangle(e.b, t));
    }
    for (let e of this.ground) {
      e.setVisible(
        Phaser.Geom.Intersects.RectangleToRectangle(
          new Phaser.Geom.Rectangle(e.x, e.y, e.width, e.height),
          t
        )
      );
    }
    for (let e of this.fx) {
      e.spr.setVisible(t.contains(e.spr.x, e.spr.y));
    }
    for (let e of this.ents.values()) {
      let n = t.contains(e.spr.x, e.spr.y);

      if (!n) {
        e.spr.setVisible(false);
        e.shadow.setVisible(false);
      }

      e.label?.setVisible(n);
    }
  }
  updateLighting() {
    let e = this.world;
    let t = this.cameras.main.worldView;
    let n = 1 - e.daylight();
    let r = e.map.id.startsWith(`mine`);
    let amb = e.map.ambient;
    let i = r
      ? 0.5 + n * 0.06
      : amb
      ? Math.min(0.85, amb.alpha + n * amb.night)
      : n * (e.map.safe ? 0.62 : 0.74);
    for (let t of this.fires) {
      t.glow.setAlpha(
        Math.min(0.42, i * 0.5) *
          (0.85 + 0.15 * Math.sin(e.time * 7 + t.flicker))
      );
    }
    if (i < 0.02) {
      this.dark.setVisible(false);
      return;
    }
    let a = Math.ceil(t.width) + 2;
    let o = Math.ceil(t.height) + 2;

    if (this.dark.width !== a || this.dark.height !== o) {
      this.dark.resize(a, o);
    }

    this.dark.setVisible(true).setPosition(Math.floor(t.x), Math.floor(t.y));
    let s = amb
      ? n > 0.5
        ? amb.nightColor
        : amb.color
      : !r && n > 0 && n < 0.7
      ? 2758192
      : 461596;
    this.dark.clear();
    this.dark.fill(s, i);
    let c = e.time;
    let l = Math.floor(t.x);
    let u = Math.floor(t.y);

    let d = (e, n, r) => {
      if (
        e + r >= t.x &&
        e - r <= t.right &&
        n + r >= t.y &&
        n - r <= t.bottom
      ) {
        this.lightImg.setScale(r / 64);
        this.dark.erase(this.lightImg, e - l, n - u);
      }
    };

    for (let e of this.fires) {
      d(
        e.x,
        e.y,
        e.r * (0.94 + 0.06 * Math.sin(c * 9 + e.flicker))
      );
    }
    let f = this.entScreen(e.player);
    d(f.x, f.y - 20, r ? 110 : 96);
    d(f.x, f.y - 20, r ? 70 : 60);
    for (let e of this.fx) {
      if (
        e.key === `heal` ||
        e.key === `bless` ||
        e.key === `enchant` ||
        e.key === `teleport`
      ) {
        d(e.spr.x, e.spr.y - 10, 70);
      }
    }
  }
  updateShots(e) {
    for (let t of this.shots) {
      t.t += e;
      let n = Math.min(1, t.t / t.dur);
      let r = this.world.entity(t.to);
      let i = FX_DEFS[t.key];

      let a = i.durations.reduce((e, t) => {
        return e + t;
      }, 0);

      let o = (t.t * 1000) % a;
      let s = 0;
      let c = 0;
      for (let e = 0; e < i.durations.length; e++) {
        c += i.durations[e];

        if (o < c) {
          s = e;
          break;
        }
      }
      if (!r || n >= 1) {
        t.spr.destroy();
        t.dead = true;
        continue;
      }
      let l = this.entScreen(r);
      let u = l.x;
      let d = l.y - 22;
      let f = t.sx + (u - t.sx) * n;
      let p =
        t.sy +
        (d - t.sy) * n -
        Math.sin(n * Math.PI) * (t.key === `arrow` ? 10 : 0);
      t.spr
        .setFrame(s)
        .setPosition(Math.round(f), Math.round(p))
        .setRotation(Math.atan2(d - t.sy, u - t.sx));
    }
    this.shots = this.shots.filter((e) => {
      return !e.dead;
    });
  }
  updateAura() {
    let e = this.world.player;
    let t = e.equipPlus.weapon >= 7;
    let n = Math.max(e.equipPlus.armor, e.equipPlus.shield) >= 5;
    if (!t && !n) {
      this.auraW?.setVisible(false);
      return;
    }
    this.auraW ||= this.add
      .image(0, 0, `light`)
      .setBlendMode(Phaser.BlendModes.ADD);
    let r = this.entScreen(e);
    let i = 0.75 + 0.25 * Math.sin(this.world.time * 3);
    this.auraW
      .setVisible(!e.dead)
      .setPosition(Math.round(r.x), Math.round(r.y) - 22)
      .setDepth(elevPx(e.px + e.py) + 7.5)
      .setTint(t ? 5939455 : 14214911)
      .setScale(t ? 0.5 : 0.42)
      .setAlpha((t ? 0.42 : 0.26) * i);
  }
  updateBubbles() {
    let e = this.world;
    let t = e.time;

    if (this.bubble && t > this.bubble.until) {
      this.bubble.t.destroy();
      this.bubble = null;
    }

    if (this.bubble) {
      let t = e.entity(this.bubble.id);
      if (t) {
        let e = this.entScreen(t);
        this.bubble.t.setPosition(Math.round(e.x), Math.round(e.y) - 64);
      }
    }

    if (!e.map.safe || t < this.nextBubble || this.bubble) {
      return;
    }
    this.nextBubble = t + 14 + Math.random() * 16;

    let n = {
      alchemist: [
        `빨간 물약 있어요~ 한 병에 25닢!`,
        `바람걸음 물약 들어왔습니다!`,
        `해독제 챙기셨어요? 폐광엔 구울이 있어요.`,
      ],
      smith: [
        `검 손질해 드립니다!`,
        `판금 갑옷, 오늘 막 식었다네.`,
        `오크 엄니 가져오면 값 쳐 주지.`,
      ],
      guard: [
        `북쪽 숲길에 오크가 늘었다는군.`,
        `밤에는 묘지 근처에 가지 마시오.`,
        `성문 밖은 조심하시오!`,
      ],
      priest: [
        `쓰러진 자에게도 새벽은 옵니다.`,
        `성수는 신전에서 구하실 수 있어요.`,
      ],
      trainer: [
        `기술은 거저 주지 않는다!`,
        `족장 가르막을 꺾는 자, 내 칼을 빌려주지.`,
      ],
    };

    let r = e.npcs[Math.floor(Math.random() * e.npcs.length)];
    let i = n[r?.role ?? ``];
    if (!r || !i) {
      return;
    }
    let a = this.entScreen(r);

    let o = this.add
      .text(
        Math.round(a.x),
        Math.round(a.y) - 64,
        i[Math.floor(Math.random() * i.length)],
        {
          fontFamily: `Galmuri11`,
          fontSize: `10px`,
          color: `#f6efe0`,
          backgroundColor: `#1d1917dd`,
          padding: {
            x: 5,
            y: 3,
          },
          wordWrap: {
            width: 150,
          },
        }
      )
      .setOrigin(0.5, 1)
      .setDepth(10000000 - 2);

    this.bubble = {
      t: o,
      id: r.id,
      until: t + 4.5,
    };
  }
  updateFade(e) {
    let t = this.world.player;
    let n = elevPx(t.px + t.py) + 8;
    let r = `${Math.round(e.x)},${Math.round(e.y)}`;

    let i = this.objs.some((e) => {
      return e.alpha !== 1 && e.alpha !== 0.42;
    });

    if (r === this.fadeKey && !i) {
      return;
    }
    this.fadeKey = r;
    let a = new Phaser.Geom.Rectangle(e.x - 10, e.y - 46, 20, 44);
    for (let e of this.objs) {
      if (!e.o.tall) {
        continue;
      }
      if (Math.abs(e.o.x - t.px) > 5 || Math.abs(e.o.y - t.py) > 5) {
        if (e.alpha !== 1) {
          e.alpha = 1;
          e.img.setAlpha(1);
        }

        continue;
      }
      let r =
        e.depth > n &&
        Phaser.Geom.Intersects.RectangleToRectangle(e.b, a) &&
        this.coversPixel(e, a)
          ? 0.42
          : 1;
      e.alpha += (r - e.alpha) * 0.25;

      if (Math.abs(e.alpha - r) < 0.02) {
        e.alpha = r;
      }

      e.img.setAlpha(e.alpha);
    }
  }
  coversPixel(e, t) {
    for (let n = t.y + 4; n < t.bottom; n += 6) {
      for (let r = t.x + 2; r < t.right; r += 6) {
        let t = e.img.frame;

        let i = t.data?.spriteSourceSize ?? {
          x: 0,
          y: 0,
        };

        let a =
          Math.floor(r - e.img.x + e.img.displayOriginX) -
          (t.data?.trim ? i.x : 0);
        let o =
          Math.floor(n - e.img.y + e.img.displayOriginY) -
          (t.data?.trim ? i.y : 0);
        if (a < 0 || o < 0 || a >= t.cutWidth || o >= t.cutHeight) {
          continue;
        }
        let s = this.alphaMasks[e.img.texture.key];
        if (!s || s.a[(t.cutY + o) * s.w + t.cutX + a] > 0) {
          return true;
        }
      }
    }
    return false;
  }
  drawMarkers(e) {
    let t = this.marker;
    t.clear();
    let n = this.world;
    let r = n.map;

    let i = (e, n, i, a, o = 1) => {
      let s = tileToScreen(e, n, r.floorLevel(e, n) * 16);
      t.lineStyle(1, i, a).strokePoints(
        [
          new Phaser.Geom.Point(s.x, s.y - 14 * o),
          new Phaser.Geom.Point(s.x + 28 * o, s.y),
          new Phaser.Geom.Point(s.x, s.y + 14 * o),
          new Phaser.Geom.Point(s.x - 28 * o, s.y),
        ],
        true
      );
    };

    let a = n.player;
    if (a.target !== null && a.targetKind === `monster`) {
      let e = n.monsters.find((e) => {
        return e.id === a.target;
      });

      if (e && !e.dead) {
        i(
          Math.round(e.px),
          Math.round(e.py),
          13916744,
          0.95,
          0.9
        );
        i(
          Math.round(e.px),
          Math.round(e.py),
          13916744,
          0.5,
          0.7
        );
      }
    }
    if (this.destMark) {
      this.destMark.t += e;
      let t = 1 - this.destMark.t / 0.6;

      if (t <= 0) {
        this.destMark = null;
      } else {
        i(
          this.destMark.x,
          this.destMark.y,
          this.destMark.bad ? 13916744 : 16047242,
          t,
          0.8 + this.destMark.t * 0.3
        );
      }
    }
    let o = this.bars;
    o.clear();
    for (let e of n.monsters) {
      if (
        e.dead ||
        (e.hp >= e.maxHp && a.target !== e.id && this.hover !== e.id)
      ) {
        continue;
      }
      let t = this.entScreen(e);
      let n = [`knight`, `lich`, `orc_chief`].includes(e.sprite)
        ? 76
        : e.sprite === `wolf`
        ? 38
        : e.sprite === `spider`
        ? 30
        : e.sprite === `slime`
        ? 28
        : e.sprite === `ghoul`
        ? 60
        : 54;
      let r = Math.round(t.x - 13);
      let i = Math.round(t.y - n);
      o.fillStyle(1314320, 0.9).fillRect(r - 1, i - 1, 28, 5);
      o.fillStyle(7216162).fillRect(r, i, 26, 3);
      o.fillStyle(e.def.named ? 14200910 : 13916744).fillRect(
        r,
        i,
        Math.max(0, Math.round((26 * e.hp) / e.maxHp)),
        3
      );
    }
  }
}

export { GROUND_ROWS, elevPx, WorldScene };
