/** Monster definitions keyed by id: stats, timing, aggro, drops. Values live in assets/data/monsters.json (edit there; run npm test after balance changes). */
import data from '../../assets/data/monsters.json' with { type: 'json' };

const MONSTERS = data;

export { MONSTERS };
