/** Greeting line per NPC role. Values live in assets/data/npc_greetings.json (edit there; run npm test after balance changes). */
import data from '../../assets/data/npc_greetings.json' with { type: 'json' };

const NPC_GREETINGS = data;

export { NPC_GREETINGS };
