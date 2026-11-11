const audio = new (class {
  constructor() {
    this.ctx = null;

    this.vol = {
      master: 0.8,
      music: 0.45,
      sfx: 0.8,
    };

    this.muted = false;
    this.track = null;
    this.timer = 0;
    this.nextNote = 0;
    this.step = 0;
    this.stepAlt = false;
  }
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === `suspended`) {
        this.ctx.resume();
      }

      return;
    }
    let e = window.AudioContext || window.webkitAudioContext;
    if (!e) {
      return;
    }
    this.ctx = new e();
    let t = this.ctx;
    this.master = t.createGain();
    this.sfx = t.createGain();
    this.music = t.createGain();
    this.sfx.connect(this.master);
    this.music.connect(this.master);
    this.master.connect(t.destination);
    this.noiseBuf = t.createBuffer(1, t.sampleRate, t.sampleRate);
    let n = this.noiseBuf.getChannelData(0);
    for (let e = 0; e < n.length; e++) {
      n[e] = Math.random() * 2 - 1;
    }
    this.applyVolume();
  }
  setVolume(e, t) {
    this.vol[e] = t;
    this.applyVolume();
  }
  setMuted(e) {
    this.muted = e;
    this.applyVolume();
  }
  applyVolume() {
    if (!this.ctx) {
      return;
    }
    let e = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(
      this.muted ? 0 : this.vol.master,
      e,
      0.02
    );
    this.music.gain.setTargetAtTime(
      this.vol.music * 0.5,
      e,
      0.05
    );
    this.sfx.gain.setTargetAtTime(this.vol.sfx, e, 0.02);
  }
  env(e, t, n, r, i) {
    e.gain.setValueAtTime(0.0001 /* 1e-4 */, t);
    e.gain.exponentialRampToValueAtTime(r, t + n);
    e.gain.exponentialRampToValueAtTime(0.0001 /* 1e-4 */, t + n + i);
  }
  tone(e, t, n, r, i = 0, a, o) {
    let s = this.ctx;
    let c = s.currentTime + i;
    let l = s.createOscillator();
    let u = s.createGain();
    l.type = n;
    l.frequency.setValueAtTime(e, c);

    if (o) {
      l.frequency.exponentialRampToValueAtTime(o, c + t);
    }

    this.env(u, c, 0.005, r, t);
    l.connect(u);
    u.connect(a ?? this.sfx);
    l.start(c);
    l.stop(c + t + 0.05);
  }
  noise(e, t, n, r, i, a = 0, o = `bandpass`, s = 0.004) {
    let c = this.ctx;
    let l = c.currentTime + a;
    let u = c.createBufferSource();
    u.buffer = this.noiseBuf;
    let d = c.createBiquadFilter();
    d.type = o;
    d.Q.value = r;
    d.frequency.setValueAtTime(t, l);
    d.frequency.exponentialRampToValueAtTime(n, l + e);
    let f = c.createGain();
    this.env(f, l, s, i, e);
    u.connect(d);
    d.connect(f);
    f.connect(this.sfx);
    u.start(l, Math.random() * 0.5);
    u.stop(l + e + s + 0.05);
  }
  play(e) {
    if (this.ctx && !this.muted) {
      switch (e) {
        case `step`: {
          this.stepAlt = !this.stepAlt;
          this.noise(
            0.07,
            this.stepAlt ? 420 : 360,
            200,
            1.2,
            0.18
          );
          break;
        }
        case `swing`: {
          this.noise(
            0.22,
            900,
            2600,
            2.5,
            0.22,
            0,
            `bandpass`,
            0.06
          );
          break;
        }
        case `whiff`: {
          this.noise(
            0.18,
            1400,
            3200,
            3,
            0.12,
            0,
            `bandpass`,
            0.05
          );
          break;
        }
        case `hit`: {
          this.tone(
            110,
            0.16,
            `sine`,
            0.7,
            0,
            undefined,
            55
          );
          this.noise(0.09, 1800, 500, 0.9, 0.45);
          this.tone(220, 0.05, `square`, 0.08);
          break;
        }
        case `strike`: {
          this.tone(80, 0.32, `sine`, 0.9, 0, undefined, 40);
          this.noise(0.22, 2400, 300, 0.8, 0.6);
          this.tone(
            330,
            0.12,
            `sawtooth`,
            0.12,
            0.01,
            undefined,
            160
          );
          break;
        }
        case `block`: {
          [1240, 1860, 2790].forEach((e, t) => {
            return this.tone(
              e,
              0.28 - t * 0.05,
              `triangle`,
              0.12
            );
          });

          this.noise(
            0.05,
            3000,
            2000,
            2,
            0.2
          );
          break;
        }
        case `miss`: {
          this.noise(0.12, 2200, 3800, 4, 0.08);
          break;
        }
        case `hurt`: {
          this.tone(
            150,
            0.14,
            `sawtooth`,
            0.18,
            0,
            undefined,
            90
          );
          this.noise(0.08, 900, 400, 1, 0.25);
          break;
        }
        case `mhurt`: {
          this.noise(0.08, 700, 300, 1, 0.18);
          break;
        }
        case `coin`: {
          this.tone(1568, 0.07, `square`, 0.08);
          this.tone(
            2093,
            0.12,
            `square`,
            0.08,
            0.06
          );
          break;
        }
        case `pickup`: {
          this.tone(880, 0.06, `triangle`, 0.12);
          this.tone(
            1320,
            0.1,
            `triangle`,
            0.12,
            0.05
          );
          break;
        }
        case `potion`: {
          for (let e = 0; e < 4; e++) {
            this.tone(
              420 + e * 90,
              0.06,
              `sine`,
              0.14,
              e * 0.06,
              undefined,
              700 + e * 120
            );
          }
          break;
        }
        case `heal`: {
          [523, 659, 784, 1046].forEach((e, t) => {
            return this.tone(
              e,
              0.5,
              `sine`,
              0.1,
              t * 0.08
            );
          });
          break;
        }
        case `bless`: {
          [392, 587, 784, 1175].forEach((e, t) => {
            return this.tone(
              e,
              0.7,
              `triangle`,
              0.08,
              t * 0.05
            );
          });

          this.noise(
            0.6,
            4000,
            8000,
            6,
            0.05,
            0.05
          );
          break;
        }
        case `skillready`: {
          this.tone(784, 0.08, `triangle`, 0.08);
          break;
        }
        case `levelup`: {
          [392, 494, 587, 784].forEach((e, t) => {
            return this.tone(
              e,
              0.35,
              `square`,
              0.07,
              t * 0.1
            );
          });
          break;
        }
        case `death`: {
          this.tone(
            220,
            0.9,
            `sawtooth`,
            0.15,
            0,
            undefined,
            55
          );
          break;
        }
        case `mdeath`: {
          this.noise(0.35, 600, 120, 0.8, 0.3);
          this.tone(120, 0.3, `sine`, 0.3, 0, undefined, 50);
          break;
        }
        case `alert`: {
          this.tone(660, 0.05, `square`, 0.05);
          break;
        }
        case `ui`: {
          this.tone(1000, 0.03, `square`, 0.05);
          break;
        }
        case `deny`: {
          this.tone(180, 0.12, `square`, 0.08);
          break;
        }
        case `learn`: {
          [523, 659, 784, 1046, 1318].forEach((e, t) => {
            return this.tone(
              e,
              0.6,
              `triangle`,
              0.08,
              t * 0.09
            );
          });
          break;
        }
        case `return`: {
          this.noise(
            1,
            400,
            4000,
            3,
            0.12,
            0,
            `bandpass`,
            0.4
          );
          break;
        }
        case `poison`: {
          this.tone(
            300,
            0.2,
            `sine`,
            0.08,
            0,
            undefined,
            200
          );
        }
      }
    }
  }
  setTrack(e) {
    if (e !== this.track) {
      this.track = e;

      this.ctx &&
        (clearInterval(this.timer),
        (this.step = 0),
        (this.nextNote = this.ctx.currentTime + 0.3),
        e &&
          (this.timer = setInterval(() => {
            return this.schedule();
          }, 120)));
    }
  }
  schedule() {
    let e = this.ctx;
    if (e && this.track && !document.hidden) {
      while (this.nextNote < e.currentTime + 0.5) {
        this.note(this.track, this.step++, this.nextNote);
        this.nextNote +=
          this.track === `town`
            ? 0.42
            : this.track === `forest`
            ? 0.6
            : 0.9;
      }
    }
  }
  voice(e, t, n, r, i, a = 0.01) {
    let o = this.ctx;
    let s = o.createOscillator();
    let c = o.createGain();
    let l = o.createBiquadFilter();
    l.type = `lowpass`;
    l.frequency.value = 1800;
    s.type = r;
    s.frequency.value = e;
    c.gain.setValueAtTime(0.0001 /* 1e-4 */, t);
    c.gain.exponentialRampToValueAtTime(i, t + a);
    c.gain.exponentialRampToValueAtTime(0.0001 /* 1e-4 */, t + n);
    s.connect(l);
    l.connect(c);
    c.connect(this.music);
    s.start(t);
    s.stop(t + n + 0.05);
  }
  note(e, t, n) {
    let r = (e) => {
      return 440 * 2 ** ((e - 69) / 12);
    };
    if (e === `town`) {
      let e = [
        [50, 57, 62, 65, 69, 65, 62, 57],
        [48, 55, 60, 64, 67, 64, 60, 55],
        [46, 53, 58, 62, 65, 62, 58, 53],
        [45, 52, 57, 60, 64, 61, 57, 52],
      ];
      let i = Math.floor(t / 8) % 4;
      let a = e[i][t % 8];
      this.voice(
        r(a),
        n,
        0.9,
        `triangle`,
        0.09,
        0.005
      );

      if (t % 8 == 0) {
        this.voice(
          r(e[i][0] - 12),
          n,
          3.2,
          `sine`,
          0.07,
          0.05
        );
      }

      if (t % 16 == 6 || t % 16 == 13) {
        this.voice(
          r(a + 12),
          n + 0.21,
          0.6,
          `sine`,
          0.04,
          0.005
        );
      }
    } else if (e === `forest`) {
      if (t % 8 == 0) {
        let e = [50, 48, 53, 45][Math.floor(t / 8) % 4];
        [0, 7, 12, 16].forEach((t) => {
          return this.voice(r(e + t), n, 5, `sine`, 0.035, 1.2);
        });
      }

      if (Math.random() < 0.35) {
        this.voice(
          r([74, 76, 72, 69, 71, 74, 67, 69][t % 8]),
          n,
          1.3,
          `triangle`,
          0.035,
          0.08
        );
      }
    } else {
      if (t % 6 == 0) {
        this.voice(r(38), n, 6, `sawtooth`, 0.025, 2);
        this.voice(r(45), n, 6, `sine`, 0.04, 2);
      }

      if (Math.random() < 0.3) {
        this.voice(
          r(84 + Math.floor(Math.random() * 8)),
          n,
          0.25,
          `sine`,
          0.03,
          0.002
        );
      }
    }
  }
})();

export { audio };
