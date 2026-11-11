# Balance simulation (20 min × 3 seeds, tools/balance-sim.mjs)

| Area | Lv | Gear | Kills/min | XP/min | Coins/min | Deaths/run | Potions/min | → next lv (min) |
|---|---|---|---|---|---|---|---|---|
| forest | 1 | starter | 5.7 | 32 | 19 | 0.0 | 0.6 | 1.9 |
| forest | 3 | starter | 8.1 | 42 | 24 | 0.0 | 0.3 | 4.3 |
| forest | 5 | iron_sword, leather_armor, leather_shield | 6.8 | 35 | 22 | 0.0 | 0.2 | 10.9 |
| mine | 6 | iron_sword, leather_armor, leather_shield | 3.4 | 105 | 46 | 0.0 | 4.7 | 4.7 |
| mine | 8 | iron_sword, leather_armor, leather_shield | 3.5 | 114 | 49 | 0.0 | 4.2 | 7.4 |
| orc | 7 | iron_sword, leather_armor, leather_shield | 4.7 | 186 | 79 | 0.0 | 8.1 | 3.5 |
| orc | 9 | knight_sword, chain_mail, iron_shield | 5.4 | 208 | 93 | 0.0 | 4.6 | 5.3 |
| mine2 | 10 | knight_sword, chain_mail, iron_shield | 3.6 | 253 | 61 | 0.0 | 6.1 | 5.5 |
| mine2 | 12 | knight_sword, chain_mail, iron_shield | 4.4 | 273 | 78 | 0.0 | 6.2 | 8.0 |

Driver limits: it never runs away and gets 5 free red potions whenever it runs out, so
"Deaths" understates risk and "Potions/min" is the real cost signal (red potion price:
see `assets/data/items.json`). Use the numbers to compare areas, not as absolute times.
