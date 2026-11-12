# Balance simulation (20 min × 3 seeds, tools/balance-sim.mjs)

| Area | Lv | Gear | Kills/min | XP/min | Coins/min | Loot/min | Deaths/run | Potions/min | Mana pot/min | Net/min | → next lv (min) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| forest | 1 | starter | 7.9 | 41 | 23 | 4 | 0.0 | 0.3 | 0.0 | 19 | 1.5 |
| forest | 3 | starter | 7.7 | 55 | 28 | 5 | 0.0 | 1.7 | 0.0 | -9 | 3.3 |
| forest | 5 | iron_sword, leather_armor, leather_shield | 5.3 | 69 | 35 | 7 | 0.0 | 1.6 | 0.0 | 2 | 5.5 |
| mine | 6 | iron_sword, leather_armor, leather_shield | 3.3 | 104 | 49 | 14 | 0.0 | 5.0 | 0.0 | -63 | 4.8 |
| mine | 8 | iron_sword, leather_armor, leather_shield | 3.6 | 112 | 52 | 16 | 0.0 | 4.8 | 0.0 | -51 | 7.6 |
| orc | 7 | iron_sword, leather_armor, leather_shield | 4.8 | 181 | 116 | 26 | 0.0 | 6.6 | 0.0 | -23 | 3.6 |
| orc | 9 | knight_sword, chain_mail, iron_shield | 5.4 | 215 | 131 | 5 | 0.0 | 5.4 | 0.0 | 1 | 5.1 |
| mine2 | 10 | knight_sword, chain_mail, iron_shield | 4.2 | 245 | 101 | 15 | 0.0 | 6.1 | 0.0 | -37 | 5.7 |
| mine2 | 12 | knight_sword, chain_mail, iron_shield | 4.2 | 264 | 95 | 14 | 0.0 | 6.2 | 0.0 | -46 | 8.3 |
| marsh | 14 | chief_axe, plate_armor, iron_shield, lord_ring | 4.0 | 360 | 165 | 4 | 0.0 | 10.0 | 0.0 | -80 | 9.2 |
| marsh | 16 | chief_axe, plate_armor, iron_shield, lord_ring | 4.0 | 362 | 150 | 6 | 0.0 | 7.9 | 0.0 | -42 | 13.8 |
| marsh | 18 | mist_blade, bog_scale, iron_shield, lord_ring | 4.7 | 449 | 190 | 13 | 0.0 | 7.2 | 0.0 | 24 | 16.0 |
| marsh | 20 | mist_blade, bog_scale, iron_shield, witch_charm | 4.8 | 303 | 198 | 11 | 0.0 | 7.2 | 0.0 | 31 | 33.7 |
| ruins | 20 | mist_blade, bog_scale, iron_shield, witch_charm | 2.3 | 469 | 151 | 6 | 0.0 | 9.1 | 0.0 | -69 | 21.7 |
| ruins | 22 | chief_axe, plate_armor, iron_shield, lord_ring | 2.1 | 433 | 141 | 6 | 0.0 | 11.0 | 0.0 | -128 | 32.6 |
| ruins | 22 | mist_blade, garrison_mail, tower_shield, witch_charm | 2.6 | 496 | 172 | 5 | 0.0 | 7.4 | 0.0 | -7 | 28.4 |
| ruins | 22 | [knight] mist_blade, garrison_mail, tower_shield, witch_charm | 2.7 | 556 | 206 | 8 | 0.0 | 7.5 | 0.4 | 3 | 25.4 |
| ruins | 22 | [berserker] mist_blade, garrison_mail, tower_shield, witch_charm | 3.2 | 659 | 264 | 11 | 0.0 | 7.0 | 0.4 | 77 | 21.4 |
| ruins | 22 | [paladin] mist_blade, garrison_mail, tower_shield, witch_charm | 3.1 | 651 | 213 | 9 | 0.0 | 7.4 | 0.4 | 13 | 21.7 |
| ruins | 24 | [knight] captain_sword, garrison_mail, tower_shield, witch_charm | 2.9 | 598 | 270 | 9 | 0.0 | 6.9 | 0.4 | 85 | 31.8 |
| ruins | 24 | [berserker] captain_sword, garrison_mail, tower_shield, witch_charm | 3.6 | 733 | 251 | 10 | 0.0 | 8.7 | 0.4 | 21 | 25.9 |
| ruins | 24 | [paladin] captain_sword, garrison_mail, tower_shield, witch_charm | 3.4 | 698 | 263 | 14 | 0.0 | 7.8 | 0.4 | 55 | 27.2 |
| pass | 24 | mist_blade, garrison_mail, tower_shield, witch_charm | 3.1 | 714 | 179 | 13 | 0.0 | 7.1 | 0.0 | 15 | 26.6 |
| pass | 24 | [knight] captain_sword, garrison_mail, tower_shield, witch_charm | 2.7 | 719 | 180 | 8 | 0.0 | 10.6 | 0.4 | -101 | 26.4 |
| pass | 24 | [berserker] captain_sword, garrison_mail, tower_shield, witch_charm | 4.0 | 1015 | 200 | 15 | 0.0 | 6.3 | 0.4 | 36 | 18.7 |
| pass | 24 | [paladin] captain_sword, garrison_mail, tower_shield, witch_charm | 3.2 | 787 | 175 | 13 | 0.0 | 7.3 | 0.4 | -16 | 24.2 |
| pass | 27 | [knight] captain_sword, yeti_armor, tower_shield, frost_ring | 3.3 | 857 | 188 | 16 | 0.0 | 7.5 | 0.4 | -7 | 34.4 |
| pass | 27 | [berserker] captain_sword, yeti_armor, tower_shield, frost_ring | 4.1 | 1050 | 239 | 32 | 0.0 | 6.8 | 0.3 | 79 | 28.1 |
| pass | 27 | [paladin] captain_sword, yeti_armor, tower_shield, frost_ring | 3.4 | 810 | 172 | 19 | 0.0 | 7.0 | 0.5 | -10 | 36.4 |
