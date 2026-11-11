/** Item definitions keyed by id (equipment, potions, scrolls, materials, books). Values live in assets/data/items.json (edit there; run npm test after balance changes). */
import data from '../../assets/data/items.json' with { type: 'json' };

const ITEMS = data;

export { ITEMS };
