import { buildForest } from "./forest.js";
import { buildMine } from "./mine.js";
import { buildDeepMine } from "./mine2.js";
import { buildOrcLands } from "./orc.js";
import { buildTown } from "./town.js";
import { buildMarsh } from "./marsh.js";
import { buildRuins } from "./ruins.js";
import { buildPass } from "./pass.js";

const MAP_BUILDERS = {
  town: buildTown,
  forest: buildForest,
  mine: buildMine,
  orc: buildOrcLands,
  mine2: buildDeepMine,
  marsh: buildMarsh,
  ruins: buildRuins,
  pass: buildPass,
};

/** Display names for the start screen and save labels, without building the maps. */
const MAP_NAMES = {
  town: `그레이월`,
  forest: `솔바람 숲길`,
  mine: `버려진 은광`,
  orc: `붉은엄니 오크 영지`,
  mine2: `은광 심부`,
  marsh: `안개 늪`,
  ruins: `무너진 감시탑`,
  pass: `얼어붙은 고개`,
};

export { MAP_BUILDERS, MAP_NAMES };
