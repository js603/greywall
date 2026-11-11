# Balance simulation (20 min × 3 seeds, tools/balance-sim.mjs)

| Area | Lv | Gear | Kills/min | XP/min | Coins/min | Deaths/run | Potions/min | → next lv (min) |
|---|---|---|---|---|---|---|---|---|
| forest | 1 | starter | 5.7 | 32 | 19 | 0.0 | 0.6 | 1.9 |
| forest | 3 | starter | 8.1 | 42 | 24 | 0.0 | 0.3 | 4.3 |
| forest | 5 | iron_sword, leather_armor, leather_shield | 6.8 | 35 | 22 | 0.0 | 0.2 | 10.9 |
| mine | 6 | iron_sword, leather_armor, leather_shield | 3.4 | 105 | 46 | 0.0 | 4.7 | 4.7 |
| mine | 8 | iron_sword, leather_armor, leather_shield | 3.5 | 114 | 49 | 0.0 | 4.2 | 7.4 |
| orc | 7 | iron_sword, leather_armor, leather_shield | 4.8 | 187 | 81 | 0.0 | 8.2 | 3.5 |
| orc | 9 | knight_sword, chain_mail, iron_shield | 5.5 | 203 | 98 | 0.0 | 4.8 | 5.4 |
| mine2 | 10 | knight_sword, chain_mail, iron_shield | 3.6 | 253 | 61 | 0.0 | 6.1 | 5.5 |
| mine2 | 12 | knight_sword, chain_mail, iron_shield | 4.4 | 273 | 78 | 0.0 | 6.2 | 8.0 |
| marsh | 14 | chief_axe, plate_armor, iron_shield, lord_ring | 3.6 | 288 | 81 | 0.0 | 10.3 | 11.5 |
| marsh | 16 | chief_axe, plate_armor, iron_shield, lord_ring | 3.9 | 311 | 84 | 0.0 | 8.8 | 16.1 |
| marsh | 18 | chief_axe, plate_armor, iron_shield, lord_ring | 4.1 | 330 | 86 | 0.0 | 9.6 | 21.8 |
| marsh | 18 | mist_blade, bog_scale, iron_shield, witch_charm | 4.6 | 363 | 99 | 0.0 | 5.5 | 19.8 |
| marsh | 20 | mist_blade, bog_scale, iron_shield, witch_charm | 4.7 | 189 | 101 | 0.0 | 7.2 | 54.1 |

Driver limits: it never runs away and gets 5 free red potions whenever it runs out, so
"Deaths" understates risk and "Potions/min" is the real cost signal (red potion price:
see `assets/data/items.json`). Use the numbers to compare areas, not as absolute times.

Fog Marsh (design/gdd/act2-fog-marsh.md, acceptance 2): at Lv16 the marsh gives more XP/min
than the orc lands at Lv9 and the next level comes in under 20 minutes. At Lv20 the slimes and
spiders (Lv14–15) give half XP (existing rule: player ≥ monster + 5), which is the intended push
toward act 2 area 2.
