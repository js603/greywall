import { audio } from "../audio.js";
import { ITEMS } from "../data/items.js";
import { MONSTERS } from "../data/monsters.js";
import { NPC_GREETINGS } from "../data/npcLines.js";
import { MAX_LEVEL, XP_TABLE } from "../data/progression.js";
import { QUESTS } from "../data/quests.js";
import { SHOPS } from "../data/shops.js";
import { SKILLS } from "../data/skills.js";
import { CLASSES } from "../data/classes.js";
import { pwa } from "../pwa.js";
import { ENCHANT_SAFE } from "../sim/constants.js";
import { escapeHtml, qs } from "./dom.js";
import { iconHtml } from "./icons.js";
import { Minimap } from "./Minimap.js";

const DEFAULT_QUICKSLOTS = [
  {
    kind: `item`,
    id: `potion_red`,
  },
  {
    kind: `item`,
    id: `potion_clear`,
  },
  {
    kind: `item`,
    id: `antidote`,
  },
  {
    kind: `item`,
    id: `scroll_return`,
  },
  {
    kind: `skill`,
    id: `strike`,
  },
  {
    kind: `skill`,
    id: `heal`,
  },
  {
    kind: `skill`,
    id: `bless`,
  },
];
/** Quickslots 1-4 hold fixed consumables; 5-8 are the player's assignable skill slots. */
const QUICK_ITEMS = DEFAULT_QUICKSLOTS.filter((s) => s.kind === `item`);
/** Icon for a skill: its own `icon`, else its book's icon. */
const skillIcon = (id) => SKILLS[id]?.icon ?? SKILLS[id]?.book;
const SKILL_BOOKS = {
  strike: `book_strike`,
  heal: `book_heal`,
  bless: `book_bless`,
};
const SKILL_SOURCES = {
  strike: `확정: 검술 교관 하르덴의 의뢰 「검술 교관의 시험」 (늑대 가죽 6, 도적의 휘장 4, 100닢). 희귀: 숲길 도적·해골 전사가 드물게 떨어뜨림.`,
  heal: `새벽 신전(사제 엘린)에서 250닢에 판매. 레벨 5 이상 학습.`,
  bless: `폐광 깊은 곳의 녹슨 기사 오르덴을 쓰러뜨리면 얻는다. 사용 시 성수 1개 소모(신전 판매).`,
};
const NPC_NAMES = {
  guard: `경비병 브람`,
  smith: `대장장이 고른`,
  alchemist: `연금술사 미라`,
  trainer: `검술 교관 하르덴`,
  priest: `사제 엘린`,
};
const QUEST_STATE_LABELS = {
  locked: [`잠김`, `#8f866f`],
  available: [`받을 수 있음`, `#f4dc8a`],
  active: [`진행 중`, `#9fd0ff`],
  ready: [`완료 가능`, `#a8d870`],
  done: [`완료`, `#8f866f`],
};
class UI {
  constructor(host) {
    this.panel = null;
    this.sel = -1;
    this.shop = null;
    this.npc = null;
    this.shopTab = `buy`;
    this.tipShown = {};
    this.tipUntil = 0;

    this.settings = {
      master: 0.8,
      music: 0.45,
      sfx: 0.8,
      muted: false,
      zoom: 0,
      touch: `auto`,
      logMin: false,
    };

    this.lastHud = ``;
    this.deathTimer = 0;
    this.viewShift = 0;
    this.shiftAt = 0;
    this.host = host;
    try {
      Object.assign(
        this.settings,
        JSON.parse(localStorage.getItem(`greywall.settings`) ?? `{}`)
      );
    } catch {}
    audio.setVolume(`master`, this.settings.master);
    audio.setVolume(`music`, this.settings.music);
    audio.setVolume(`sfx`, this.settings.sfx);
    audio.setMuted(this.settings.muted);
  }
  get w() {
    return this.host.world();
  }
  saveSettings() {
    localStorage.setItem(`greywall.settings`, JSON.stringify(this.settings));
  }
  applyTouch() {
    let e = matchMedia(`(pointer: coarse)`).matches || `ontouchstart` in window;
    document.body.classList.toggle(
      `touch`,
      this.settings.touch === `on` || (this.settings.touch === `auto` && e)
    );
  }
  mount() {
    let e = qs(`#ui`);

    e.innerHTML = `
      <div id="top">
        <div id="info" class="frame"></div>
        <div id="menu" class="frame">
          <button class="btn m-main" data-open="bag" title="가방 (I)">가방<kbd>I</kbd></button><button class="btn m-main" data-open="quests" title="의뢰 (J)">의뢰<kbd>J</kbd></button>
          <button class="btn m-more" data-open="char" title="장비·캐릭터 (C)">장비<kbd>C</kbd></button><button class="btn m-more" data-open="skills" title="스킬 (K)">스킬<kbd>K</kbd></button>
          <button class="btn m-more" data-act="save" title="저장">저장</button><button class="btn m-more" data-open="settings" title="설정">설정</button><button class="btn m-more" data-open="help" title="도움말 (H)">?</button>
          <button class="btn m-toggle" data-act="more" aria-label="메뉴 더보기" aria-expanded="false">☰</button>
          <div id="more" class="frame iron"></div></div>
        <div id="notices"><div id="target" class="frame"></div><div id="tip" class="frame" role="status"></div></div>
        <div id="log" class="frame"><div class="hdr"><span>메시지</span><button data-act="log">접기</button></div><div class="lines"></div></div>
      </div>
      <div id="dock">
        <div id="acts">
          <div id="acts-l"><button class="btn" data-act="logm">기록</button><button class="btn" data-act="rest">휴식</button><button class="btn" data-act="pickup">줍기</button></div>
          <div id="acts-r"><button class="btn" data-act="strike">강타</button><button class="btn big" data-act="attack">공격</button></div>
        </div>
        <div id="bottom" class="frame iron"><div class="bars"><div class="bar hp"><i></i><span></span></div><div class="bar mp"><i></i><span></span></div><div class="bar xp"><i></i></div></div><div id="slots"></div></div>
      </div>
      <div id="win"></div><div id="death"></div><div id="toast" class="frame"></div>
      <canvas id="minimap" class="frame" width="176" height="100" title="미니맵 (N)"></canvas>`;
    this.minimap = new Minimap(qs(`#minimap`));
    this.applyMinimap();
    // a tutorial tip can be dismissed early by clicking it
    qs(`#tip`).addEventListener(`click`, () => {
      this.tipUntil = 0;
    });

    this.renderSlots();

    if (this.settings.logMin) {
      qs(`#log`).classList.add(`min`);
    }

    e.addEventListener(`click`, (e) => {
      return this.onClick(e);
    });

    e.addEventListener(`input`, (e) => {
      return this.onInput(e);
    });

    this.applyTouch();
  }
  releaseInputs() {}
  fitTouchLayout() {
    let e = document.body.style;
    let t = qs(`#info`).getBoundingClientRect();
    let n = qs(`#dock`).getBoundingClientRect();
    e.setProperty(`--top-h`, `${Math.round(t.bottom + 4)}px`);
    e.setProperty(`--dock-top`, `${Math.round(n.top)}px`);
    let r = qs(`#log .lines`);
    r.style.maxHeight = ``;
    let i = qs(`#tip`);
    i._fitHidden &&= ((i.style.display = i._fitHidden), null);

    let a = () => {
      return (
        Math.max(
          qs(`#top`).getBoundingClientRect().bottom,
          qs(`#log`).classList.contains(`force`)
            ? qs(`#log`).getBoundingClientRect().bottom
            : 0
        ) -
        (n.top - 6)
      );
    };

    let o = a();

    if (o > 0 && qs(`#log`).classList.contains(`force`)) {
      r.style.maxHeight = `${Math.max(
        34,
        r.getBoundingClientRect().height - o
      )}px`;
      o = a();
    }

    if (o > 0 && i.style.display !== `none`) {
      i._fitHidden = i.style.display;
      i.style.display = `none`;
    }
  }
  layoutChanged() {
    this.shiftAt = 0;
  }
  computeViewShift() {
    let e = performance.now();
    if (e - this.shiftAt < 400) {
      return this.viewShift;
    }
    this.shiftAt = e;
    let t = document.body.classList.contains(`touch`);

    if (t) {
      this.fitTouchLayout();
    }

    let n = innerHeight;
    let r = t
      ? qs(`#dock`).getBoundingClientRect()
      : qs(`#bottom`).getBoundingClientRect();
    let i = (
      t && innerWidth > innerHeight && qs(`#log`).classList.contains(`force`)
        ? qs(`#info`)
        : qs(`#top`)
    ).getBoundingClientRect().bottom;
    let a = r.top;
    if (a - i < 60) {
      let e = (i + a) / 2;
      i = e - 30;
      a = e + 30;
    }
    this.viewShift = Math.round(n / 2 - (i + a) / 2);
    return this.viewShift;
  }
  /** Quickslot contents: the fixed items, then the four skill slots (id null = empty). */
  slotList() {
    return [...QUICK_ITEMS, ...this.w.player.skillSlots.map((id) => ({ kind: `skill`, id }))];
  }
  /** Rebuilds the quickslot buttons when the skill slot assignment changed. */
  renderSlots() {
    const list = this.slotList();
    const sig = list.map((s) => s.id).join(`|`);
    if (sig === this.slotSig) return;
    this.slotSig = sig;
    qs(`#slots`).innerHTML = list
      .map(
        (e, t) =>
          `<button class="slot${e.kind === `skill` ? ` skill` : ``}" data-slot="${t}"><span class="k">${
            t + 1
          }</span>${e.id ? iconHtml(e.kind === `item` ? e.id : skillIcon(e.id)) : ``}<span class="n"></span><span class="cd"></span></button>`
      )
      .join(``);
  }
  /** Shows or hides the minimap according to the saved setting (default: shown). */
  applyMinimap() {
    qs(`#minimap`).hidden = this.settings.minimap === false;
  }
  update() {
    let e = this.w;
    this.minimap?.draw(e);
    let t = e.player;
    let n = XP_TABLE[Math.min(MAX_LEVEL, t.level + 1)] - XP_TABLE[t.level];
    let r = t.xp - XP_TABLE[t.level];
    let i = t.level >= MAX_LEVEL ? 100 : Math.max(0, Math.min(100, (r / n) * 100));
    let a = `${Math.ceil(t.hp)}|${t.maxHp}|${t.mp}|${t.maxMp}|${i.toFixed(1)}|${
      t.level
    }|${t.coins}|${e.map.id}|${!!t.poison}|${e.time < t.blessUntil}|${
      t.resting
    }|${e.isNight()}|${Math.ceil(t.hasteUntil - e.time)}|${Math.ceil(
      t.braveUntil - e.time
    )}|${e.burdened()}`;
    if (a !== this.lastHud) {
      this.lastHud = a;
      qs(`.bar.hp i`).style.width = `${Math.max(0, (t.hp / t.maxHp) * 100)}%`;
      qs(`.bar.hp span`).textContent = `체력 ${Math.max(
        0,
        Math.ceil(t.hp)
      )} / ${t.maxHp}`;
      qs(`.bar.mp i`).style.width = `${(t.mp / t.maxMp) * 100}%`;
      qs(`.bar.mp span`).textContent = `마나 ${t.mp} / ${t.maxMp}`;
      qs(`.bar.xp i`).style.width = `${i}%`;
      qs(`.bar.xp`).title = `경험치 ${r} / ${n}`;

      let o = (t) => {
        let n = Math.max(0, Math.ceil(t - e.time));
        return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, `0`)}`;
      };

      let s = [
        e.isNight() ? `<span class="chip night">밤</span>` : ``,
        t.poison ? `<span class="chip poison">독</span>` : ``,
        e.time < t.blessUntil
          ? `<span class="chip bless">무기 축복</span>`
          : ``,
        e.time < t.hasteUntil
          ? `<span class="chip haste">바람걸음 ${o(t.hasteUntil)}</span>`
          : ``,
        e.time < t.braveUntil
          ? `<span class="chip brave">투지 ${o(t.braveUntil)}</span>`
          : ``,
        e.burdened() ? `<span class="chip heavy">무거움</span>` : ``,
        t.resting ? `<span class="chip rest">휴식 중</span>` : ``,
      ].join(``);
      qs(`#info`).innerHTML = `<div class="area">${escapeHtml(
        e.map.name
      )}</div><div>Lv ${t.level} · <span class="gold-t">동전 ${
        t.coins
      }</span><span class="xpt"> · 경험 ${i.toFixed(
        1
      )}%</span></div><div id="status-icons">${s}</div>`;
    }
    this.renderSlots();
    this.slotList().forEach((n, r) => {
      let i = qs(`.slot[data-slot="${r}"]`);
      let a = i.querySelector(`.n`);
      let o = i.querySelector(`.cd`);
      if (n.kind === `skill` && !n.id) {
        i.classList.add(`empty`);
        i.title = `빈 스킬 슬롯 — 스킬 창(K)에서 등록`;
        a.textContent = ``;
        o.style.display = `none`;
      } else if (n.kind === `item`) {
        let r = e.count(n.id);
        a.textContent = r ? String(r) : ``;
        i.classList.toggle(`empty`, !r);
        i.title = `${ITEMS[n.id].name} (${r})`;
        let s = (t.cooldowns.potion ?? 0) - e.time;
        o.style.display =
          ITEMS[n.id].type === `potion` && s > 0 ? `flex` : `none`;
      } else {
        let r = SKILLS[n.id];
        let s = t.skills.includes(n.id);
        i.classList.toggle(`locked`, !s);
        let c = (t.cooldowns[n.id] ?? 0) - e.time;
        o.style.display = s && c > 0 ? `flex` : `none`;
        o.textContent = c > 0 ? String(Math.ceil(c)) : ``;
        a.textContent = s ? String(r.mp) : ``;
        i.classList.remove(`empty`);
        i.title = `${r.name} — 마나 ${r.mp}, 재사용 ${r.cooldown}초`;
      }
    });

    let o =
      t.target !== null && t.targetKind === `monster`
        ? e.monsters.find((e) => {
            return e.id === t.target && !e.dead;
          })
        : undefined;

    let s = qs(`#target`);

    if (!!o != (s.style.display === `block`)) {
      this.layoutChanged();
    }

    if (o) {
      s.style.display = `block`;
      s.innerHTML = `<span class="${o.def.named ? `gold-t` : ``}">${escapeHtml(
        o.def.name
      )}</span> <span class="dim">Lv ${
        o.def.level
      }</span><div class="bar"><i style="width:${Math.max(
        0,
        (o.hp / o.maxHp) * 100
      )}%"></i></div>`;
    } else {
      s.style.display = `none`;
    }

    this.tips();

    if (this.panel !== `skills`) {
      this.panel;
    }
  }
  tips() {
    let e = this.w;
    let t = e.player;
    let n = performance.now();

    let r = (e, t) => {
      if (this.tipShown[e]) {
        return;
      }
      this.tipShown[e] = true;
      let r = qs(`#tip`);
      r.innerHTML = t;
      r.style.display = `block`;
      this.tipUntil = n + 9000;
      this.log(`안내: ` + t.replace(/<[^>]+>/g, ``), `sys`);
      this.layoutChanged();
    };

    let i = document.body.classList.contains(`touch`);

    if (e.tutorial.moved) {
      if (e.map.id === `town` && e.quests.q_slime.state === `available`) {
        r(
          `quest`,
          `성문 옆 <b>경비병 브람</b>에게 말을 걸어 첫 의뢰를 받아 보세요.`
        );
      } else if (e.map.id === `forest` && !e.tutorial.attacked) {
        r(
          `attack`,
          i
            ? `몬스터를 탭하거나 <b>공격</b> 버튼을 누르면 다가가 평타를 휘두릅니다.`
            : `몬스터를 <b>클릭</b>하면 다가가 평타로 공격합니다. 다른 곳을 클릭하면 공격을 멈춥니다.`
        );
      } else if (
        e.tutorial.attacked &&
        t.hp < t.maxHp * 0.55 &&
        !e.tutorial.potion
      ) {
        r(
          `potion`,
          `체력이 줄었습니다. <b>1</b>번 퀵슬롯의 빨간 물약을 마시세요.`
        );
      } else if (
        e.map.id !== `town` &&
        (t.hp < t.maxHp * 0.35 ||
          e.count(`potion_red`) + e.count(`potion_clear`) === 0) &&
        !e.tutorial.returned
      ) {
        r(
          `return`,
          `위험하면 <b>4</b>번 귀환 주문서로 마을에 돌아갈 수 있습니다. 읽는 동안 움직이면 취소됩니다.`
        );
      } else if (e.count(`book_strike`) && !t.skills.includes(`strike`)) {
        r(
          `learn`,
          `<b>기술서: 강타</b>를 얻었습니다! 가방에서 사용하면 익힐 수 있습니다(레벨 4 이상).`
        );
      }
    } else {
      r(
        `move`,
        i
          ? `<b>이동</b>: 가고 싶은 바닥을 탭하세요. 누른 채 끌면 손가락을 따라 계속 걷습니다.`
          : `<b>이동</b>: 바닥을 클릭하거나 방향키/WASD를 누르세요.`
      );
    }

    if (n > this.tipUntil && qs(`#tip`).style.display !== `none`) {
      qs(`#tip`).style.display = `none`;
      qs(`#tip`)._fitHidden = null;
      this.layoutChanged();
    }
  }
  onEvent(e) {
    switch (e.type) {
      case `msg`: {
        this.log(e.text, e.kind);
        break;
      }
      case `talk`: {
        this.openDialog(e.npc);
        break;
      }
      case `pdeath`: {
        clearTimeout(this.deathTimer);

        this.deathTimer = setTimeout(() => {
          return this.showDeath();
        }, 1400);

        break;
      }
      case `revive`: {
        qs(`#death`).classList.remove(`open`);
        break;
      }
      case `levelup`: {
        this.toast(`레벨 ${e.level}!`);
        this.refresh();
        break;
      }
      case `learn`: {
        this.toast(`「${SKILLS[e.skill].name}」 습득`);
        this.refresh();
        break;
      }
      case `quest`:
      case `coin`:
      case `equip`:
      case `pickup`:
      case `potion`: {
        this.refresh();
        break;
      }
      case `mapchange`: {
        this.lastHud = ``;

        if (this.panel === `dialog` || this.panel === `shop`) {
          this.close();
        }
      }
    }
  }
  log(e, t = `info`) {
    let n = qs(`#log .lines`);
    let r = document.createElement(`div`);
    r.className = `l ` + t;
    r.textContent = e;
    n.appendChild(r);

    while (n.children.length > 80) {
      n.removeChild(n.firstChild);
    }

    n.scrollTop = n.scrollHeight;
  }
  toastActions(e, t = []) {
    let n = document.querySelector(`#atoast`);

    if (!n) {
      n = document.createElement(`div`);
      n.id = `atoast`;
      n.className = `frame iron`;
      document.body.appendChild(n);
    }

    n.innerHTML = `<span>${e}</span>${t
      .map((e, t) => {
        return `<button class="btn gold" data-i="${t}">${e.label}</button>`;
      })
      .join(``)}<button class="btn" data-x>닫기</button>`;

    n.style.display = `flex`;

    n.onclick = (e) => {
      let r = e.target.closest(`button`);

      if (r) {
        r.dataset.i && t[Number(r.dataset.i)].run();
        n.style.display = `none`;
      }
    };

    if (!t.length) {
      setTimeout(() => {
        if (n) {
          n.style.display = `none`;
        }
      }, 2600);
    }
  }
  confirmBox(e, t, n) {
    let r = document.querySelector(`#confirm`);

    if (!r) {
      r = document.createElement(`div`);
      r.id = `confirm`;
      document.body.appendChild(r);
    }

    r.innerHTML = `<div class="frame iron box"><div class="msg">${e}</div><div class="row"><button class="btn gold" data-y>${t}</button><button class="btn" data-n>그만두기</button></div></div>`;
    r.style.display = `flex`;

    r.onclick = (e) => {
      let t = e.target.closest(`button`);

      if (t || e.target === r) {
        r.style.display = `none`;
        t && t.hasAttribute(`data-y`) && n();
      }
    };
  }
  toast(e) {
    let t = qs(`#toast`);
    t.textContent = e;
    t.style.display = `block`;
    clearTimeout(t._h);

    t._h = setTimeout(() => {
      return (t.style.display = `none`);
    }, 1600);
  }
  showDeath() {
    let e = qs(`#death`);
    e.innerHTML = `<h2>쓰러졌습니다</h2><div class="dim">새벽 신전에서 다시 일어납니다. 현재 레벨 경험치의 일부를 잃습니다.</div><button class="btn gold" data-act="revive">새벽 신전에서 일어나기</button>`;
    e.classList.add(`open`);
  }
  hotkey(e) {
    let t = this.w;
    if (e === `Escape`) {
      return this.panel ? (this.close(), true) : false;
    }
    if (e.startsWith(`Digit`)) {
      let t = Number(e.slice(5)) - 1;
      if (t >= 0 && t < this.slotList().length) {
        this.useQuick(t);
        return true;
      }
    }
    let n = {
      KeyI: `bag`,
      KeyC: `char`,
      KeyK: `skills`,
      KeyJ: `quests`,
      KeyH: `help`,
    };
    return n[e]
      ? (this.toggle(n[e]), true)
      : e === `KeyR`
      ? (t.toggleRest(), true)
      : e === `KeyG` || e === `Space`
      ? (t.pickupNearby(), true)
      : e === `KeyF`
      ? (t.attackNearest(), true)
      : e === `KeyN`
      ? ((this.settings.minimap = this.settings.minimap === false),
        this.applyMinimap(),
        this.saveSettings(),
        true)
      : e === `KeyM`
      ? ((this.settings.muted = !this.settings.muted),
        audio.setMuted(this.settings.muted),
        this.saveSettings(),
        this.toast(this.settings.muted ? `음소거` : `소리 켜짐`),
        true)
      : e === `KeyL` && (qs(`#log`).classList.toggle(`min`), true);
  }
  useQuick(e) {
    let t = this.slotList()[e];
    let n = this.w;
    if (t.kind === `skill` && !t.id) {
      this.toggle(`skills`);
      return;
    }
    if (t.kind === `item`) {
      let e = n.player.inv.findIndex((e) => {
        return e.item === t.id;
      });
      if (e < 0) {
        n.msg(`${ITEMS[t.id].name}이(가) 없다.`, `warn`);
        audio.play(`deny`);
        return;
      }
      n.useItem(e);
    } else {
      if (t.id === `strike` && n.player.target === null) {
        n.attackNearest();
      }

      if (!n.useSkill(t.id)) {
        audio.play(`deny`);
      }
    }
    this.refresh();
  }
  onClick(e) {
    let t = e.target.closest(
      `[data-act],[data-open],[data-slot],[data-cell],[data-eq],[data-buy],[data-sell],[data-q],[data-tab],[data-skill],[data-zoom],[data-touch],[data-minimap],[data-assign],[data-cls]`
    );
    if (!t) {
      if (e.target.id === `win`) {
        this.close();
      }

      return;
    }
    audio.unlock();
    audio.play(`ui`);
    let n = this.w;
    let r = t.dataset;

    if (t.closest(`#more`) || (r.open && t.closest(`#menu`))) {
      qs(`#menu`).classList.remove(`more`);
    }

    if (r.open) {
      return this.toggle(r.open);
    }

    if (r.slot) {
      return this.useQuick(Number(r.slot));
    }
    if (r.cell !== undefined) {
      this.sel = Number(r.cell);
      return this.render();
    }
    if (r.eq) {
      n.unequip(r.eq);
      return this.render();
    }
    if (r.buy) {
      n.buy(this.shop, r.buy);
      return this.render();
    }
    if (r.sell !== undefined) {
      n.sell(Number(r.sell), 1);
      this.sel = -1;
      return this.render();
    }
    if (r.tab) {
      this.shopTab = r.tab;
      return this.render();
    }
    if (r.cls) {
      const c = CLASSES[r.cls];
      this.confirmBox(
        `<b class="gold-t">${c.name}</b>(으)로 전직할까요?<br><span class="dim">${escapeHtml(c.desc)}</span><br><span class="bad">전직은 되돌릴 수 없습니다.</span>`,
        `${c.name}(으)로 전직`,
        () => {
          if (n.chooseClass(r.cls)) {
            this.renderSlots();
            this.host.save();
          }
          this.render();
        }
      );
      return;
    }
    if (r.assign) {
      const [slot, id] = r.assign.split(`:`);
      n.assignSkillSlot(Number(slot), id === `-` ? null : id);
      this.renderSlots();
      return this.render();
    }
    if (r.skill) {
      this.close();

      if (r.skill === `strike` && n.player.target === null) {
        n.attackNearest();
      }

      n.useSkill(r.skill);
    } else {
      if (r.zoom !== undefined) {
        this.settings.zoom = Number(r.zoom);
        this.saveSettings();
        this.host.setZoom(this.settings.zoom);
        return this.render();
      }
      if (r.minimap !== undefined) {
        this.settings.minimap = r.minimap === `true`;
        this.saveSettings();
        this.applyMinimap();
        return this.render();
      }
      if (r.touch) {
        this.settings.touch = r.touch;
        this.saveSettings();
        this.applyTouch();
        return this.render();
      }
      if (r.q) {
        let [e, t] = r.q.split(`:`);

        if (e === `accept`) {
          n.acceptQuest(t);
        } else {
          n.completeQuest(t);
        }

        return this.render();
      }
      switch (r.act) {
        case `close`: {
          return this.close();
        }
        case `save`: {
          let e = this.host.save();
          this.toast(e ? `저장했습니다` : `저장에 실패했습니다`);
          return;
        }
        case `use`: {
          if (this.sel >= 0) {
            let e = n.player.inv[this.sel];
            let t = e && ITEMS[e.item].enchant ? n.enchantTarget(e.item) : null;
            let r = this.sel;

            let i = () => {
              n.useItem(r);

              if (!n.player.inv[this.sel]) {
                this.sel = -1;
              }

              this.render();
            };

            if (t && t.plus >= t.safe) {
              this.confirmBox(
                `<b>${escapeHtml(
                  n.itemName(n.player.equip[t.slot], t.plus)
                )}</b>은(는) 안전 강화 수치(+${
                  t.safe
                })에 도달했습니다.<br><span class="bad">실패하면 장비가 증발합니다 (성공 확률 1/3).</span>`,
                `그래도 읽는다`,
                i
              );
              return;
            }
            i();
            return;
          }
          return this.render();
        }
        case `sellsel`: {
          if (this.sel >= 0) {
            n.sell(this.sel);
            this.sel = -1;
          }

          return this.render();
        }
        case `log`: {
          let e = qs(`#log`);
          e.classList.toggle(`min`);
          this.settings.logMin = e.classList.contains(`min`);
          this.saveSettings();
          t.textContent = this.settings.logMin ? `펼치기` : `접기`;
          return;
        }
        case `logm`: {
          qs(`#log`).classList.toggle(`force`);
          this.layoutChanged();
          return;
        }
        case `more`: {
          let e = qs(`#menu`);
          let n = !e.classList.contains(`more`);
          e.classList.toggle(`more`, n);
          t.setAttribute(`aria-expanded`, String(n));

          if (n) {
            qs(`#more`).innerHTML = [...e.querySelectorAll(`.m-more`)]
              .map((e) => {
                return `<button class="btn" ${
                  e.getAttribute(`data-open`)
                    ? `data-open="${e.getAttribute(`data-open`)}"`
                    : `data-act="${e.getAttribute(`data-act`)}"`
                }>${e.textContent.replace(/[A-Z]$/, ``)}</button>`;
              })
              .join(``);
          }

          return;
        }
        case `attack`: {
          n.attackNearest();
          return;
        }
        case `strike`: {
          if (n.player.target === null) {
            n.attackNearest();
          }

          if (!n.useSkill(`strike`)) {
            audio.play(`deny`);
          }

          return;
        }
        case `pickup`: {
          n.pickupNearby();
          return;
        }
        case `rest`: {
          n.toggleRest();
          return;
        }
        case `revive`: {
          this.host.revive();
          return;
        }
        case `shop`: {
          this.shop = t.dataset.shop;
          this.shopTab = `buy`;
          this.panel = `shop`;
          this.sel = -1;
          return this.render();
        }
        case `heal`: {
          n.priestHeal();
          return this.render();
        }
        case `fullscreen`: {
          pwa.toggleFullscreen().then(() => {
            return setTimeout(() => {
              return this.render();
            }, 200);
          });
          return;
        }
        case `install`: {
          pwa.install().then(() => {
            return this.render();
          });
          return;
        }
        case `mute`: {
          this.settings.muted = !this.settings.muted;
          audio.setMuted(this.settings.muted);
          this.saveSettings();
          return this.render();
        }
        case `export`: {
          this.toast(this.host.exportSave() ? `저장 파일을 내보냈습니다` : `내보낼 저장 데이터가 없습니다`);
          return;
        }
        case `import`: {
          this.host.importSave().then((e) => {
            if (e) this.toast(e);
          });
          return;
        }
        case `newgame`: {
          this.confirmBox(
            `현재 진행을 버리고 새 게임을 시작할까요?<br><span class='bad'>저장 데이터가 덮어써집니다.</span>`,
            `새 게임 시작`,
            () => {
              this.close();
              this.host.newGame();
            }
          );
          return;
        }
      }
    }
  }
  onInput(e) {
    let t = e.target;
    let n = t.dataset.vol;
    if (!n) {
      return;
    }
    this.settings[n] = Number(t.value) / 100;
    audio.setVolume(n, this.settings[n]);
    this.saveSettings();
    let r = t.parentElement.querySelector(`output`);

    if (r) {
      r.textContent = t.value;
    }
  }
  toggle(e) {
    if (this.panel === e) {
      this.close();
    } else {
      this.panel = e;
      this.sel = -1;
      this.render();
    }
  }
  close() {
    this.panel = null;
    this.shop = null;
    qs(`#win`).classList.remove(`open`);
    qs(`#win`).innerHTML = ``;
    this.host.pause(false);
  }
  refresh() {
    if (this.panel) {
      this.render();
    }
  }
  openDialog(e) {
    this.npc = e;
    this.panel = `dialog`;
    this.render();
  }
  render() {
    if (!this.panel) {
      return;
    }
    let e = qs(`#win`);
    e.classList.add(`open`);

    let t = {
      bag: `가방`,
      char: `장비 · 캐릭터`,
      skills: `스킬`,
      quests: `의뢰`,
      settings: `설정`,
      help: `조작법 · 안내`,
      dialog: NPC_NAMES[this.npc ?? ``] ?? `대화`,
      shop: SHOPS[this.shop ?? ``]?.title ?? `상점`,
    };

    let n = this[`r_` + this.panel]?.() ?? ``;
    e.innerHTML = `<div class="panel frame iron"><div class="head"><span class="title">${
      t[this.panel]
    }</span><button class="x" data-act="close" aria-label="닫기">✕</button></div><div class="body">${n}</div></div>`;
  }
  itemInfo(e, t = 0) {
    let n = ITEMS[e];
    let r = this.w;
    let i = [];

    if (t) {
      i.push(
        `<span class="good">강화 +${t}: ${
          n.slot === `weapon`
            ? `피해 +${t}, 명중 +${Math.floor(t / 2)}`
            : `방어 +${t}`
        }</span>`
      );
    }

    if (n.slot === `weapon` || n.slot === `armor` || n.slot === `shield`) {
      i.push(
        `<span class="dim">안전 강화 +${
          n.slot === `weapon` ? ENCHANT_SAFE.weapon : ENCHANT_SAFE.armor
        }</span>`
      );
    }

    if (n.enchant) {
      let t = r.enchantTarget(e);
      i.push(
        t
          ? `대상: <b>${escapeHtml(
              r.itemName(r.player.equip[t.slot], t.plus)
            )}</b> → ${
              t.plus >= t.safe
                ? `<span class="bad">위험(성공 1/3, 실패 시 증발)</span>`
                : `<span class="good">안전</span>`
            }`
          : `<span class="warn">대상 장비를 착용하고 있지 않습니다.</span>`
      );
    }

    if (n.hit) {
      i.push(`명중 +${n.hit}`);
    }

    if (n.dmg) {
      i.push(
        `공격 ${n.dmg[0]}–${n.dmg[1]} · 공격 간격 ${n.interval}초 · 명중 +${
          n.acc ?? 0
        }`
      );
    }

    if (n.ac) {
      i.push(`방어 +${n.ac}`);
    }

    if (n.block) {
      i.push(`막기 ${Math.round(n.block * 100)}%`);
    }

    if (n.str) {
      i.push(`공격력 +${n.str}`);
    }

    if (n.hp) {
      i.push(`최대 체력 +${n.hp}`);
    }

    if (n.heal) {
      i.push(`체력 ${n.heal} 회복`);
    }

    if (n.reqLevel) {
      i.push(
        `<span class="${
          r.player.level >= n.reqLevel ? `good` : `bad`
        }">필요 레벨 ${n.reqLevel}</span>`
      );
    }

    if (n.slot) {
      let t = r.player.equip[n.slot];
      if (t && t !== e) {
        let e = ITEMS[t];
        if (n.dmg && e.dmg) {
          let t = (n.dmg[0] + n.dmg[1] - e.dmg[0] - e.dmg[1]) / 2;
          i.push(
            `현재 장비 대비 평균 공격 <span class="${
              t >= 0 ? `good` : `bad`
            }">${t >= 0 ? `+` : ``}${t}</span>`
          );
        }
        if (n.ac !== undefined && e.ac !== undefined) {
          let t = (n.ac ?? 0) - (e.ac ?? 0);
          i.push(
            `현재 장비 대비 방어 <span class="${t >= 0 ? `good` : `bad`}">${
              t >= 0 ? `+` : ``
            }${t}</span>`
          );
        }
      }
    }

    i.push(
      `<span class="dim">판매가 ${r.sellPrice({
        item: e,
        count: 1,
        plus: t,
      })}닢</span>`
    );

    return `<div><b class="${t ? `good` : ``}">${escapeHtml(
      r.itemName(e, t)
    )}</b></div><div class="dim">${escapeHtml(n.desc)}</div><div>${i.join(
      `<br>`
    )}</div>`;
  }
  r_bag() {
    let e = this.w;
    let t = e.player.inv;

    let n = Array.from(
      {
        length: 24,
      },
      (n, r) => {
        let i = t[r];
        return `<button class="cell ${
          r === this.sel ? `sel` : ``
        }" data-cell="${r}" ${
          i ? `title="${escapeHtml(e.itemName(i.item, i.plus))}"` : `disabled`
        }>${
          i
            ? iconHtml(i.item) +
              (i.count > 1 ? `<span class="n">${i.count}</span>` : ``) +
              (i.plus ? `<span class="pl">+${i.plus}</span>` : ``)
            : ``
        }</button>`;
      }
    ).join(``);

    let r = Math.round(e.weightPct() * 100);
    let i = `<div class="wbar ${
      r >= 100 ? `full` : r >= 50 ? `half` : ``
    }" title="50% 이상이면 체력·마나가 저절로 회복되지 않습니다"><i style="width:${Math.min(
      100,
      r
    )}%"></i><span>무게 ${r}% (${Math.round(e.weight())} / ${e.capacity()})${
      r >= 50 ? ` — 자연 회복 정지` : ``
    }</span></div>`;
    let a = `<div class="dim">아이템을 선택하세요. 동전 ${e.player.coins}닢 · 칸 ${t.length}/24</div>`;
    let o = t[this.sel];
    if (o) {
      let e = ITEMS[o.item];
      let t =
        e.type === `equip`
          ? `장착`
          : e.type === `book`
          ? `익히기`
          : e.type === `scroll`
          ? `읽기`
          : e.type === `potion`
          ? `마시기`
          : ``;
      a =
        this.itemInfo(o.item, o.plus ?? 0) +
        `<div class="row">${
          t ? `<button class="btn gold" data-act="use">${t}</button>` : ``
        }${
          this.shop
            ? `<button class="btn" data-act="sellsel">판매</button>`
            : ``
        }</div>`;
    }
    return `${i}<div class="grid">${n}</div><div class="detail">${a}</div>`;
  }
  r_char() {
    let e = this.w;
    let t = e.player;
    let n = e.weapon();

    let r = [
      [`weapon`, `무기`],
      [`armor`, `갑옷`],
      [`shield`, `방패`],
      [`accessory`, `장신구`],
    ]
      .map(([n, r]) => {
        let i = t.equip[n];
        return `<button class="cell" ${
          i ? `data-eq="${n}" title="클릭하여 해제"` : `disabled`
        }>${i ? iconHtml(i) : ``}<span>${r}</span><span class="${
          t.equipPlus[n] ? `good` : `dim`
        }">${
          i ? escapeHtml(e.itemName(i, t.equipPlus[n])) : `비어 있음`
        }</span></button>`;
      })
      .join(``);

    let i = e.pDmgBonus();
    let a = XP_TABLE[Math.min(MAX_LEVEL, t.level + 1)];
    return `<div class="equip">${r}</div><div class="kv">
      <span class="dim">직업</span><span>${t.cls ? `<b class="gold-t">${CLASSES[t.cls].name}</b> <span class="dim">${escapeHtml(CLASSES[t.cls].desc)}</span>` : `모험가 <span class="dim">(레벨 20에 검술 교관 하르덴에게서 전직)</span>`}</span>
      <span class="dim">레벨</span><span>${t.level} (경험치 ${
      t.xp
    } / ${a})</span>
      <span class="dim">체력 / 마나</span><span>${Math.ceil(t.hp)}/${
      t.maxHp
    } · ${t.mp}/${t.maxMp}</span>
      <span class="dim">힘 · 민첩 · 체력</span><span>${t.str} · ${t.dex} · ${
      t.con
    }</span>
      <span class="dim">평타 피해</span><span>${(n?.dmg?.[0] ?? 1) + i} – ${
      (n?.dmg?.[1] ?? 2) + i
    }${e.time < t.braveUntil ? ` <span class="warn">(투지)</span>` : ``}</span>
      <span class="dim">공격 간격</span><span>${e.pInterval()}초</span>
      <span class="dim">명중 보정 · 회피</span><span>+${e.pAcc()} · ${e.pEva()}</span>
      <span class="dim">방어 · 막기</span><span>${e.pAC()} · ${Math.round(
      e.pBlock() * 100
    )}%</span>
      <span class="dim">성향</span><span>${e.lawfulName()} (${t.lawful})${
      t.lawful >= 300
        ? ` <span class="good">상점 ${
            t.lawful >= 1000 ? 10 : 5
          }% 할인</span>`
        : ``
    }</span>
      <span class="dim">무게</span><span>${Math.round(e.weightPct() * 100)}%${
      e.burdened() ? ` <span class="warn">(자연 회복 정지)</span>` : ``
    }</span>
      <span class="dim">처치 · 사망</span><span>${e.stats.kills} · ${
      e.stats.deaths
    }</span></div>
      <p class="dim">장비 칸을 누르면 해제합니다. 레벨이 오르면 체력·마나와 힘/민첩이 오릅니다.</p>`;
  }
  /** Learned skills only, each with buttons to place it in skill slot 5-8. */
  r_skills() {
    const w = this.w;
    const p = w.player;
    const learned = p.skills.map((id) => SKILLS[id]).filter(Boolean);
    if (!learned.length)
      return `<p class="dim">아직 익힌 스킬이 없습니다. 기술서·마법서를 얻어 가방에서 사용하면 여기에 나타나고, 빈 스킬 슬롯(5~8)에 자동으로 등록됩니다.</p>`;
    return `<div class="list">${learned
      .map((sk) => {
        const st = w.skillState(sk.id);
        const at = p.skillSlots.indexOf(sk.id);
        const slots = p.skillSlots
          .map(
            (cur, k) =>
              `<button class="btn ${at === k ? `on` : ``}" data-assign="${k}:${at === k ? `-` : sk.id}" title="${
                at === k ? `슬롯에서 빼기` : cur ? `${SKILLS[cur].name} 대신 등록` : `빈 슬롯에 등록`
              }">${k + 5}</button>`
          )
          .join(``);
        return `<div class="item">${iconHtml(skillIcon(sk.id), `x2`)}<div class="grow"><b>${sk.name}</b>
        <div class="dim">${sk.desc}</div><div>마나 ${sk.mp} · 재사용 ${sk.cooldown}초${
          sk.consumes ? ` · ${ITEMS[sk.consumes].name} 1개 (보유 ${w.count(sk.consumes)})` : ``
        }</div><div class="row slots-assign"><span class="dim">슬롯</span>${slots}</div></div>
        <button class="btn" data-skill="${sk.id}" ${st.ok ? `` : `disabled`} title="${escapeHtml(st.reason)}">사용</button></div>`;
      })
      .join(``)}</div>
      <p class="dim">숫자 버튼으로 스킬 슬롯 5~8에 등록합니다. 같은 스킬은 한 슬롯에만 들어가고, 켜진 번호를 누르면 슬롯에서 뺍니다.</p>`;
  }
  questBlock(e, t) {
    let n = this.w;

    let r = QUESTS.find((t) => {
      return t.id === e;
    });

    let i = n.quests[e];
    let [a, o] = QUEST_STATE_LABELS[i.state];
    let s = ``;

    if (r.kill && (i.state === `active` || i.state === `ready`)) {
      s = `<div class="prog">${MONSTERS[r.kill.monster].name} ${Math.min(
        i.progress,
        r.kill.count
      )} / ${r.kill.count}</div>`;
    }

    if (r.bring && i.state !== `done`) {
      s = `<div>${r.bring
        .map((e) => {
          let t = n.count(e.item);
          return `<span class="need ${t >= e.count ? `ok` : `no`}">${
            ITEMS[e.item].name
          } ${Math.min(t, e.count)}/${e.count}</span>`;
        })
        .join(` · `)}${
        r.coins
          ? ` · <span class="need ${
              n.player.coins >= r.coins ? `ok` : `no`
            }">동전 ${r.coins}</span>`
          : ``
      }</div>`;
    }

    let c =
      i.state === `locked`
        ? `<div class="dim">조건: 레벨 ${r.minLevel}${
            r.after
              ? `, 「${
                  QUESTS.find((e) => {
                    return e.id === r.after;
                  }).name
                }」 완료`
              : ``
          }</div>`
        : ``;

    let l = [
      ...(r.rewardItems ?? []).map((e) => {
        return ITEMS[e.item].name + (e.count > 1 ? ` ×` + e.count : ``);
      }),
      r.rewardCoins ? `동전 ${r.rewardCoins}` : ``,
      r.rewardXp ? `경험치 ${r.rewardXp}` : ``,
    ]
      .filter(Boolean)
      .join(`, `);

    let u = t
      ? i.state === `available`
        ? `<button class="btn gold" data-q="accept:${e}">수락</button>`
        : i.state === `ready`
        ? `<button class="btn gold" data-q="done:${e}">완료 보고</button>`
        : ``
      : ``;
    return `<div class="q"><b>${
      r.name
    }</b><span class="st" style="color:${o};border-color:${o}">${a}</span> <span class="dim">— ${
      NPC_NAMES[r.giver]
    }</span>${r.skillQuest ? ` <span class="warn">[첫 스킬]</span>` : ``}
      <div>${r.summary}</div>${s}${c}<div class="dim">단서: ${
      r.hint
    }</div><div class="dim">보상: ${l}</div>${
      u ? `<div class="row">${u}</div>` : ``
    }</div>`;
  }
  /** Quests in progress only (ready to turn in first); new quests are found by the ! over NPCs. */
  r_quests() {
    this.w.refreshQuests();
    const order = [`ready`, `active`];
    const list = QUESTS.filter((q) => order.includes(this.w.quests[q.id].state)).sort(
      (a, b) => order.indexOf(this.w.quests[a.id].state) - order.indexOf(this.w.quests[b.id].state)
    );
    const done = QUESTS.filter((q) => this.w.quests[q.id].state === `done`).length;
    const head = `<div class="dim">진행 중 ${list.length} · 완료 ${done} / ${QUESTS.length}</div>`;
    return list.length
      ? head + list.map((q) => this.questBlock(q.id, false)).join(``)
      : head + `<p class="dim">진행 중인 의뢰가 없습니다. 머리 위에 <b class="gold-t">!</b> 표시가 있는 주민에게 말을 걸어 의뢰를 받으세요. <b class="gold-t">?</b>는 완료 보고를 기다리는 주민입니다.</p>`;
  }
  r_dialog() {
    let e = this.w;
    let t = this.npc;
    e.refreshQuests();

    let n = QUESTS.filter((n) => {
      return (
        n.giver === t &&
        e.quests[n.id].state !== `locked` &&
        e.quests[n.id].state !== `done`
      );
    });

    let r =
      t === `smith`
        ? `smith`
        : t === `alchemist`
        ? `alchemist`
        : t === `priest`
        ? `temple`
        : null;
    let i = ``;

    if (t === `trainer` && !e.classChangeBlocker()) {
      i = `<div class="classpick"><div class="say">하르덴: "시험을 통과했군. 이제 어떤 길을 걸을지 정하게. 한 번 정하면 되돌릴 수 없네."</div>${Object.values(
        CLASSES
      )
        .map(
          (c) =>
            `<div class="item"><div class="grow"><b class="gold-t">${c.name}</b><div class="dim">${escapeHtml(c.desc)}</div><div>${c.skills
              .map((k) => `Lv${k.level} ${SKILLS[k.id].name}`)
              .join(` · `)}</div></div><button class="btn gold" data-cls="${c.id}">${c.name}(으)로 전직</button></div>`
        )
        .join(``)}</div>`;
    } else if (t === `trainer` && e.quests.q_strike.state === `locked`) {
      i = `<div class="dim">하르덴: "숲의 늑대 정도는 상대해 보고(경비병 브람의 의뢰), 레벨 4는 되어서 오게."</div>`;
    }

    return `<div class="dialog"><div class="say">${escapeHtml(
      NPC_GREETINGS[t]
    )}</div>${i}${n
      .map((e) => {
        return this.questBlock(e.id, true);
      })
      .join(``)}
      <div class="row">${
        r
          ? `<button class="btn gold" data-act="shop" data-shop="${r}">거래하기</button>`
          : ``
      }${
      t === `priest`
        ? `<button class="btn" data-act="heal">치유 받기</button>`
        : ``
    }<button class="btn" data-act="close">작별</button></div></div>`;
  }
  r_shop() {
    let e = this.w;
    let t = SHOPS[this.shop];
    let n = `<div class="tabs"><button class="btn ${
      this.shopTab === `buy` ? `on` : ``
    }" data-tab="buy">사기</button><button class="btn ${
      this.shopTab === `sell` ? `on` : ``
    }" data-tab="sell">팔기</button><span class="gold-t" style="margin-left:auto">동전 ${
      e.player.coins
    }</span></div>`;
    return this.shopTab === `buy`
      ? n +
          `<div class="list">${t.items
            .map((t) => {
              ITEMS[t];
              let n = e.priceOf(t);
              let r = e.player.coins >= n;
              return `<div class="item">${iconHtml(
                t
              )}<div class="grow">${this.itemInfo(t).replace(
                /<span class="dim">판매가.*?<\/span>/,
                ``
              )}</div><button class="btn ${r ? `gold` : ``}" data-buy="${t}" ${
                r ? `` : `disabled`
              }>${n}닢</button></div>`;
            })
            .join(``)}</div>`
      : n +
          `<div class="list">${
            e.player.inv
              .map((t, n) => {
                let r = ITEMS[t.item];
                return `<div class="item">${iconHtml(
                  t.item
                )}<div class="grow">${escapeHtml(e.itemName(t.item, t.plus))}${
                  t.count > 1 ? ` ×` + t.count : ``
                }<div class="dim">${escapeHtml(
                  r.desc
                )}</div></div><button class="btn" data-sell="${n}">${e.sellPrice(
                  t
                )}닢</button></div>`;
              })
              .join(``) || `<div class="dim">팔 물건이 없습니다.</div>`
          }</div>`;
  }
  r_settings() {
    let e = this.settings;

    let t = (t, n) => {
      return `<label>${n}<input type="range" min="0" max="100" value="${Math.round(
        e[t] * 100
      )}" data-vol="${t}"><output>${Math.round(e[t] * 100)}</output></label>`;
    };

    return `<div class="sliders">${t(`master`, `전체 음량`)}${t(
      `music`,
      `배경음`
    )}${t(`sfx`, `효과음`)}</div>
      <div class="row"><button class="btn ${
        e.muted ? `on` : ``
      }" data-act="mute">${e.muted ? `음소거 해제` : `음소거`}</button></div>
      <p>화면 확대</p><div class="row">${[
        [0, `자동`],
        [1, `1배`],
        [2, `2배`],
        [3, `3배`],
      ]
        .map(([t, n]) => {
          return `<button class="btn ${
            e.zoom === t ? `on` : ``
          }" data-zoom="${t}">${n}</button>`;
        })
        .join(``)}</div>
      <p>미니맵</p><div class="row">${[
        [true, `보이기`],
        [false, `숨기기`],
      ]
        .map(([t, n]) => {
          return `<button class="btn ${
            (e.minimap !== false) === t ? `on` : ``
          }" data-minimap="${t}">${n}</button>`;
        })
        .join(``)}</div>
      <p>터치 화면 구성(행동 버튼)</p><div class="row">${[
        [`auto`, `자동`],
        [`on`, `켜기`],
        [`off`, `끄기`],
      ]
        .map(([t, n]) => {
          return `<button class="btn ${
            e.touch === t ? `on` : ``
          }" data-touch="${t}">${n}</button>`;
        })
        .join(``)}</div>
      ${
        pwa.fullscreenSupported()
          ? `<p>화면</p><div class="row"><button class="btn" data-act="fullscreen">${
              document.fullscreenElement ? `전체 화면 끝내기` : `전체 화면`
            }</button>${
              pwa.canInstall()
                ? `<button class="btn gold" data-act="install">앱으로 설치</button>`
                : ``
            }</div>`
          : ``
      }
      <p>진행</p><div class="row"><button class="btn" data-act="save">지금 저장</button><button class="btn" data-act="newgame">새 게임</button></div>
      <div class="row"><button class="btn" data-act="export">저장 파일 내보내기</button><button class="btn" data-act="import">저장 파일 가져오기</button></div>
      <p class="dim">자동 저장: 지역 이동·의뢰 완료 시와 60초마다. 저장은 이 브라우저에만 보관되니, 브라우저 데이터를 지우기 전이나 다른 기기로 옮길 때는 파일로 내보내 두세요.</p>`;
  }
  r_help() {
    return `<div class="kv"><b>PC</b><span></span>
      <span class="dim">이동</span><span>바닥 클릭 · 방향키/WASD (위=북, 위+오른쪽=북동 …)</span>
      <span class="dim">공격</span><span>몬스터 클릭 → 다가가 평타 반복. 바닥을 클릭하면 공격 취소</span>
      <span class="dim">퀵슬롯</span><span>1 빨간 물약 · 2 맑은 물약 · 3 해독제 · 4 귀환 주문서 · 5~8 스킬 슬롯(스킬 창 K에서 자유롭게 등록)</span>
      <span class="dim">기타</span><span>F 가까운 적 공격 · N 미니맵 · G/Space 줍기 · R 휴식 · I 가방 · C 장비 · K 스킬 · J 의뢰 · L 기록 · M 음소거 · Esc 닫기</span>
      <b>모바일</b><span></span>
      <span class="dim">이동</span><span>바닥을 탭하면 그 자리로 걷습니다. 누른 채 끌면 손가락을 따라 계속 이동하고, 손을 떼면 마지막 지점에서 멈춥니다</span>
      <span class="dim">행동</span><span>상태창 위(가로 화면은 양옆)의 기록·휴식·줍기·강타·공격 버튼, 화면의 적·NPC·아이템을 탭</span></div>
      <p><b>강화</b>: 칼날 벼림 주문서(무기)·갑옷 단련 주문서(갑옷)를 가방에서 읽으면 장비한 물건이 +1 됩니다. 무기 +6, 갑옷 +4까지는 안전하고, 그 이상은 1/3 확률로 성공하며 실패하면 증발합니다.
      <b>무게</b>: 짐이 50%를 넘으면 체력·마나가 저절로 회복되지 않고, 100%면 더 들 수 없습니다(가방 창의 무게 막대).
      <b>성향</b>: 몬스터를 잡으면 오르고 쓰러지면 조금 내려갑니다. 선량함(300)부터 상점이 5%, 정의로움(1000)부터 10% 깎아 줍니다.
      <b>밤</b>: 약 20분마다 하루가 돌고, 밤에는 어두워지며 묘지에 망자가 일어납니다. 횃불과 모닥불 곁은 밝습니다.</p>
      <p>평타는 느립니다(약 1.5초). 준비 동작 중 이동하면 그 공격은 취소됩니다. 적 두 마리가 붙으면 물약과 후퇴를 고민하세요.</p>
      <p class="dim">그래픽: agent-sprite-forge codeart2d로 코드 드로잉(이미지 모델 미사용). 효과: pixelfx (MIT, Patch / Hugo Duprez / rehan-remade). 글꼴: 갈무리11 (OFL). 음악·효과음: 실시간 합성.</p>`;
  }
}

export {
  DEFAULT_QUICKSLOTS,
  QUICK_ITEMS,
  skillIcon,
  SKILL_BOOKS,
  SKILL_SOURCES,
  NPC_NAMES,
  QUEST_STATE_LABELS,
  UI,
};
