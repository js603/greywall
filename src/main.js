import "./style.css";
import Phaser from "phaser";
import { audio } from "./audio.js";
import { createBotDriver } from "./bot/Bot.js";
import { ITEMS } from "./data/items.js";
import { MAP_BUILDERS, MAP_NAMES } from "./maps/index.js";
import { initPwa, pwa } from "./pwa.js";
import { WorldScene } from "./render/WorldScene.js";
import { applySave, exportSave, importSave, parseSave, saveFileName, saveKeys, writeSave } from "./save.js";
import { downloadText, pickTextFile } from "./ui/files.js";
import { World } from "./sim/World.js";
import { UI } from "./ui/UI.js";
import { store } from "./storage.js";
import { loadIcons } from "./ui/icons.js";

const params = new URLSearchParams(location.search);
const DEV = params.get(`dev`) === `1`;
const BOT = params.get(`bot`) === `1`;
let botDriver = null;
let world = new World(MAP_BUILDERS, Date.now() & 2147483647 || 1);
world.dev = DEV;
let scene = null;
let game = null;
let autosaveTimer = 0;
const ui = new UI({
  world: () => {
    return world;
  },
  save: () => {
    return saveGame();
  },
  newGame: () => {
    return startGame(null);
  },
  setZoom: (e) => {
    return scene?.setZoomPref(e);
  },
  pause: (e) => {
    if (scene) {
      scene.paused = e;
    }
  },
  exportSave: () => exportSaveFile(),
  importSave: () => importSaveFile(),
  revive: () => {
    world.revive();
    saveGame();
  },
});
let lastDir = null;
let pendingDir = null;
let pendingSince = 0;
function debounceDir(e) {
  let t = performance.now();

  let n = (e) => {
    return !!e && e.length === 2;
  };

  return e === lastDir
    ? ((pendingDir = null), e)
    : (n(lastDir) &&
        e &&
        !n(e) &&
        (pendingDir !== e && ((pendingDir = e), (pendingSince = t)),
        t - pendingSince < 90)) ||
      (!lastDir &&
        e &&
        !n(e) &&
        (pendingDir !== e && ((pendingDir = e), (pendingSince = t)),
        t - pendingSince < 70))
    ? null
    : ((lastDir = e), (pendingDir = null), e);
}
/** In-game yes/no box; the browser's own dialog is blocked in sandboxed frames. Resolves true on yes. */
function ask(message, yes) {
  return new Promise((resolve) => {
    ui.confirmBox(message, yes, () => resolve(true));
    const box = document.querySelector(`#confirm`);
    const closed = () => {
      if (box.style.display !== `none`) return; // a click inside the box that did not close it
      box.removeEventListener(`click`, closed);
      resolve(false); // no-op after a yes
    };
    box.addEventListener(`click`, closed);
  });
}
function saveGame() {
  return world.player.dead || !world.map
    ? false
    : writeSave(store, world);
}
/** Saves now and downloads the save as a file. Returns false when there is nothing to export. */
function exportSaveFile() {
  saveGame();
  const text = exportSave(store, DEV);
  if (!text) return false;
  downloadText(saveFileName(parseSave(text).data?.level ?? 1), text);
  return true;
}
/** In-game import: replaces the current progress with a save file. Resolves with a message, or null when cancelled. */
async function importSaveFile() {
  if (!(await ask(`저장 파일을 불러오면 지금 진행이 그 파일로 바뀝니다. (지금 진행은 이전 저장본으로 보관됩니다) 계속할까요?`, `불러오기`))) return null;
  saveGame();
  const text = await pickTextFile();
  if (text === null) return null;
  const r = importSave(store, DEV, text);
  if (!r.ok) return `불러오지 못했습니다: ${r.error}`;
  ui.close();
  startGame(`continue`);
  return `저장 파일을 불러왔습니다 (Lv ${r.data.level})`;
}
function continueLabel() {
  let e = parseSave(store.getItem(saveKeys(DEV).main));
  return e.ok
    ? `Lv ${e.data.level} · ${
MAP_NAMES[e.data.map]
      } · 동전 ${e.data.coins}`
    : null;
}
function showStartScreen(e) {
  let t = continueLabel();
  let n = !!store.getItem(saveKeys(DEV).main);
  let r = document.createElement(`div`);
  r.id = `start`;

  r.innerHTML = `<div class="box frame iron">
    <h1>회색성벽 연대기</h1><div class="sub">낡은 검 한 자루로 시작하는 느린 사냥</div>
    <div class="menu">
      <button class="btn gold" id="b-new">새 게임</button>
      <button class="btn" id="b-cont" ${t ? `` : `disabled`}>이어하기${
    t ? ` <span class="dim">(${t})</span>` : ``
  }</button>
      ${
        !t && n
          ? `<button class="btn" id="b-recover">저장 데이터 복구…</button>`
          : ``
      }
      <button class="btn" id="b-install" ${
        pwa.enabled && !pwa.isStandalone() ? `` : `hidden`
      }>앱으로 설치</button>
      <button class="btn" id="b-import">저장 파일 가져오기</button>
      <button class="btn" id="b-help">조작법</button></div>
    <div class="note" id="install-hint" hidden></div>
    ${e ? `<div class="bad">${e}</div>` : ``}
    <div class="note">${
      DEV ? `<b class='warn'>개발 모드(?dev=1): 별도 저장 칸 사용</b><br>` : ``
    }마우스·키보드 또는 터치로 플레이합니다. 소리는 첫 입력 후 켜집니다.<br>그래픽: agent-sprite-forge codeart2d(코드 드로잉) · 효과: pixelfx (MIT)</div></div>`;

  document.body.appendChild(r);
  let i = (e) => {
    return () => {
      audio.unlock();
      audio.play(`ui`);
      r.remove();
      e();
    };
  };

  r.querySelector(`#b-new`).addEventListener(`click`, async () => {
    if (!t || (await ask(`저장된 진행이 있습니다. 새 게임을 시작하면 덮어씁니다. 계속할까요?`, `새 게임`))) {
      i(() => {
        return startGame(null);
      })();
    }
  });

  r.querySelector(`#b-cont`).addEventListener(
    `click`,
    i(() => {
      return startGame(`continue`);
    })
  );

  r.querySelector(`#b-recover`)?.addEventListener(`click`, () => {
    return showRecovery(r);
  });

  r.querySelector(`#b-import`).addEventListener(`click`, async () => {
    const text = await pickTextFile();
    if (text === null) return;
    if (t && !(await ask(`저장된 진행(${t})을 이 파일로 바꿀까요? 지금 진행은 이전 저장본으로 보관됩니다.`, `바꾸기`))) return;
    const res = importSave(store, DEV, text);
    if (!res.ok) {
      r.remove();
      showStartScreen(`저장 파일을 불러오지 못했습니다: ${res.error}`);
      return;
    }
    i(() => startGame(`continue`))();
  });

  r.querySelector(`#b-help`).addEventListener(`click`, () => {
    r.querySelector(`.note`).innerHTML = ui.r_help();
  });

  r.querySelector(`#b-install`)?.addEventListener(`click`, async () => {
    let e = r.querySelector(`#install-hint`);

    if (pwa.canInstall()) {
      await pwa.install();
    } else {
      e.hidden = false;
      e.innerHTML = pwa.isIOS()
        ? `Safari 하단의 <b>공유</b> 버튼 → <b>홈 화면에 추가</b>를 누르면 앱처럼 전체 화면으로 실행됩니다.`
        : `브라우저 메뉴의 <b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 눌러 주세요. (HTTPS 주소에서만 설치할 수 있습니다)`;
    }
  });
}
function showRecovery(e) {
  let t = saveKeys(DEV);
  let n = parseSave(store.getItem(t.main));
  let r = parseSave(store.getItem(t.backup));
  let i = e.querySelector(`.note`);

  i.innerHTML = `<div class="bad">저장 데이터를 불러오지 못했습니다: ${
    n.ok ? `` : n.error
  }</div>
    ${
      r.ok
        ? `<p>이전 저장본(Lv ${r.data.level})이 남아 있습니다.</p><button class="btn gold" id="b-bak">이전 저장본으로 복구</button>`
        : `<p>복구할 수 있는 이전 저장본이 없습니다. 새 게임을 시작하세요.</p>`
    }`;

  i.querySelector(`#b-bak`)?.addEventListener(`click`, () => {
    store.setItem(t.main, store.getItem(t.backup));
    e.remove();
    startGame(`continue`);
  });
}
function startGame(e) {
  world = new World(MAP_BUILDERS, Date.now() & 2147483647 || 1);
  world.dev = DEV;

  if (e === `continue`) {
    let e = parseSave(store.getItem(saveKeys(DEV).main));
    if (!e.ok) {
      showStartScreen(e.error);
      return;
    }
    applySave(world, e.data);

    if (e.migrated) {
      world.msg(`이전 버전의 저장 데이터를 변환했습니다.`, `sys`);
    }

    world.msg(`저장한 곳에서 이어갑니다.`, `sys`);
  } else {
    world.loadMap(`town`);
    world.msg(
      `그레이월 동문 근처에서 눈을 떴다. 낡은 검과 나무 방패, 빨간 물약 세 병이 전부다.`,
      `sys`
    );
    saveGame();
  }

  if (game) {
    scene.world = world;
    scene.buildMap();
  } else {
    bootGame();
  }

  clearInterval(autosaveTimer);

  autosaveTimer = setInterval(() => {
    return saveGame();
  }, 60000);
}
function bootGame() {
  ui.mount();

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: `game`,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: `#0b0a0c`,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    fps: {
      target: 60,
      forceSetTimeOut: false,
    },
    disableContextMenu: true,
    banner: false,
    audio: {
      noAudio: true,
    },
  });

  game.scene.add(`world`, WorldScene, true, {
    world: world,
    hooks: {
      onEvent: (e) => {
        ui.onEvent(e);

        if (e.type === `mapchange` || e.type === `quest` || e.type === `enchant`) { // enchant: no reload to undo a failed attempt
          saveGame();
        }
      },
      onFrame: () => {
        if (scene) {
          world.setDirInput(debounceDir(scene.keyDir()));
          ui.update();

          BOT &&
            ((botDriver ??= createBotDriver(
              () => {
                return world;
              },
              () => {
                return scene;
              }
            )),
            botDriver.tick());
        }
      },
      viewShift: () => {
        return ui.computeViewShift();
      },
      onReady: () => {
        scene = game.scene.getScene(`world`);

        if (ui.settings.zoom) {
          scene.setZoomPref(ui.settings.zoom);
        }
      },
    },
  });
}

window.addEventListener(`keydown`, (e) => {
  if (scene && e.target.tagName !== `INPUT`) {
    audio.unlock();
    [
      `ArrowUp`,
      `ArrowDown`,
      `ArrowLeft`,
      `ArrowRight`,
      `KeyW`,
      `KeyA`,
      `KeyS`,
      `KeyD`,
    ].includes(e.code)
      ? (scene.keys.add(e.code), e.preventDefault())
      : !e.repeat && ui.hotkey(e.code) && e.preventDefault();
  }
});

window.addEventListener(`keyup`, (e) => {
  return scene?.keys.delete(e.code);
});

const releaseAllInputs = () => {
  scene?.keys.clear();
  ui.releaseInputs();
  world.setDirInput(null);
};
window.addEventListener(`blur`, releaseAllInputs);

document.addEventListener(`visibilitychange`, () => {
  releaseAllInputs();

  if (document.hidden) {
    saveGame();
  }
});

window.addEventListener(`pagehide`, () => {
  return saveGame();
});

window.__gw = {
  get world() {
    return world;
  },
  get scene() {
    return scene;
  },
  ui: ui,
  dev: DEV,
  get botPlan() {
    return botDriver?.plan;
  },
  ...(DEV
    ? {
        give: (e, t = 1) => {
          return ITEMS[e] && world.give(e, t);
        },
        xp: (e) => {
          return world.gainXp(e);
        },
        warp: (e, t, n) => {
          return world.loadMap(e, t, n);
        },
      }
    : {}),
};

initPwa(
  (e, t) => {
    return ui.toastActions(e, t);
  },
  () => {
    let e = document.querySelector(`#b-install`);

    if (e) {
      e.hidden = pwa.isStandalone();
    }
  }
);

loadIcons().then(() => {
  return showStartScreen();
});
