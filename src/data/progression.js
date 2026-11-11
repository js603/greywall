/** Total XP needed for each level (index = level). Values live in assets/data/xp_table.json (edit there; run npm test after balance changes). */
import data from '../../assets/data/xp_table.json' with { type: 'json' };

const XP_TABLE = data;

export { XP_TABLE };
