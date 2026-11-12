const ACTION_TIMING = {
  attack: {
    total: 1,
    hit: 0.5,
  },
  skill: {
    total: 1.14,
    hit: 0.57,
  },
  cast: {
    total: 1.02,
    event: 0.32,
  },
  hurt: {
    total: 0.28,
  },
  death: {
    total: 1.22,
  },
};
const PLAYER_STEP = 0.42;
const SWING_CANCEL_DELAY = 0.3;
const DAY_LENGTH = 1200;
/** Defense: damage × K / (K + AC × (0.6–1.4)). Design: design/gdd/combat.md */
const DEFENSE_K = 20; // with monster ac ×0.6 and dmg ×0.8 (2026-11-12 retune, design/gdd/combat.md)
/** Hit chance slope per point of (accuracy − evasion). */
const HIT_SLOPE = 0.015;
/** Hit chance at equal accuracy and evasion. */
const HIT_BASE = 0.85;
const ENCHANT_SAFE = {
  weapon: 6,
  armor: 4,
};

export {
  ACTION_TIMING,
  PLAYER_STEP,
  SWING_CANCEL_DELAY,
  DAY_LENGTH,
  DEFENSE_K,
  HIT_SLOPE,
  HIT_BASE,
  ENCHANT_SAFE,
};
