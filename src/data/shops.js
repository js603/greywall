/** Shop inventories keyed by shop id. Values live in assets/data/shops.json (edit there; run npm test after balance changes). */
import data from '../../assets/data/shops.json' with { type: 'json' };

const SHOPS = data;

export { SHOPS };
