let deferredPrompt = null;
let notifyPwa = () => {};
const pwa = {
  enabled: true,
  installed: false,
  updateReady: false,
  canInstall: () => {
    return !!deferredPrompt;
  },
  isStandalone: () => {
    return (
      matchMedia(`(display-mode: standalone)`).matches ||
      matchMedia(`(display-mode: fullscreen)`).matches ||
      navigator.standalone === true
    );
  },
  isIOS: () => {
    return (
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === `MacIntel` && navigator.maxTouchPoints > 1)
    );
  },
  async install() {
    if (!deferredPrompt) {
      return false;
    }
    deferredPrompt.prompt();
    let e = await deferredPrompt.userChoice;
    deferredPrompt = null;
    return e.outcome === `accepted`;
  },
  async toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen({
          navigationUI: `hide`,
        });
      }
    } catch {}
  },
  fullscreenSupported: () => {
    return !!document.documentElement.requestFullscreen;
  },
};
function initPwa(e, t) {
  notifyPwa = e;
  let n = document.head;

  let r = (e, t) => {
    let r = document.createElement(e);
    for (let [e, n] of Object.entries(t)) {
      r.setAttribute(e, n);
    }
    n.appendChild(r);
  };

  r(`link`, {
    rel: `manifest`,
    href: `manifest.webmanifest`,
  });

  r(`link`, {
    rel: `apple-touch-icon`,
    href: `icons/apple-touch-icon.png`,
  });

  r(`link`, {
    rel: `icon`,
    type: `image/png`,
    sizes: `32x32`,
    href: `icons/favicon-32.png`,
  });

  window.addEventListener(`beforeinstallprompt`, (e) => {
    e.preventDefault();
    deferredPrompt = e;
    t();
  });

  window.addEventListener(`appinstalled`, () => {
    deferredPrompt = null;
    pwa.installed = true;
    t();
    notifyPwa(`홈 화면에 설치되었습니다.`);
  });

  navigator.storage?.persist?.().catch(() => {});

  if (
    !(`serviceWorker` in navigator) ||
    (location.protocol !== `https:` &&
      location.hostname !== `localhost` &&
      location.hostname !== `127.0.0.1`)
  ) {
    return;
  }

  navigator.serviceWorker
    .register(`sw.js`)
    .then((e) => {
      let t = (e) => {
        pwa.updateReady = true;

        notifyPwa(`새 버전이 준비되었습니다.`, [
          {
            label: `지금 새로고침`,
            run: () => {
              return e.postMessage(`skipWaiting`);
            },
          },
        ]);
      };

      if (e.waiting && navigator.serviceWorker.controller) {
        t(e.waiting);
      }

      e.addEventListener(`updatefound`, () => {
        let n = e.installing;

        if (n) {
          n.addEventListener(`statechange`, () => {
            if (n.state === `installed` && navigator.serviceWorker.controller) {
              t(n);
            }
          });
        }
      });

      setInterval(() => {
        return e.update().catch(() => {});
      }, 1800000);
    })
    .catch(() => {});
  let i = false;
  let a = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener(`controllerchange`, () => {
    if (!i && a && pwa.updateReady) {
      i = true;
      location.reload();
    }
  });
}

export { deferredPrompt, notifyPwa, pwa, initPwa };
