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
const ENCHANT_SAFE = {
  weapon: 6,
  armor: 4,
};

export {
  ACTION_TIMING,
  PLAYER_STEP,
  SWING_CANCEL_DELAY,
  DAY_LENGTH,
  ENCHANT_SAFE,
};
