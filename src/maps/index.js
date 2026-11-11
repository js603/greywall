import { buildForest } from "./forest.js";
import { buildMine } from "./mine.js";
import { buildDeepMine } from "./mine2.js";
import { buildOrcLands } from "./orc.js";
import { buildTown } from "./town.js";

const MAP_BUILDERS = {
  town: buildTown,
  forest: buildForest,
  mine: buildMine,
  orc: buildOrcLands,
  mine2: buildDeepMine,
};

export { MAP_BUILDERS };
