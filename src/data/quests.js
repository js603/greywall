/** Quest chain in display order. Values live in assets/data/quests.json (edit there; run npm test after balance changes). */
import data from '../../assets/data/quests.json' with { type: 'json' };

const QUESTS = data;

export { QUESTS };
