/** Learnable skills keyed by id. Values live in assets/data/skills.json (edit there; run npm test after balance changes). */
import data from '../../assets/data/skills.json' with { type: 'json' };

const SKILLS = data;

export { SKILLS };
