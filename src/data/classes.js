/** Classes a Lv20 adventurer can change into, keyed by id. Values live in assets/data/classes.json (design/gdd/class-change.md). */
import data from '../../assets/data/classes.json' with { type: 'json' };

const CLASSES = data;

export { CLASSES };
