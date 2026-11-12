/** Equipment prefixes and sets (design/gdd/gear-affixes.md). Values live in assets/data/affixes.json and sets.json. */
import affixes from '../../assets/data/affixes.json' with { type: 'json' };
import sets from '../../assets/data/sets.json' with { type: 'json' };

const AFFIXES = affixes;
const SETS = sets;

export { AFFIXES, SETS };
