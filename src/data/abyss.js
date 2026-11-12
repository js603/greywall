/** Endgame dungeon tuning and achievements (design/gdd/endgame-abyss.md). Values live in assets/data/abyss.json and achievements.json. */
import abyss from '../../assets/data/abyss.json' with { type: 'json' };
import achievements from '../../assets/data/achievements.json' with { type: 'json' };

const ABYSS = abyss;
const ACHIEVEMENTS = achievements;

/** Week number counted from ABYSS.weekEpoch (a Monday, UTC). The UI passes Date.now(); rules never read the clock. */
function weekOf(ms) {
  return Math.max(0, Math.floor((ms - Date.parse(`${ABYSS.weekEpoch}T00:00:00Z`)) / 604800000));
}

export { ABYSS, ACHIEVEMENTS, weekOf };
