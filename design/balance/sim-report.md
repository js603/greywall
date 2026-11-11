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
| marsh | 14 | chief_axe, plate_armor, iron_shield, lord_ring | 3.5 | 283 | 75 | 0.0 | 7.5 | 11.7 |
| marsh | 16 | chief_axe, plate_armor, iron_shield, lord_ring | 3.9 | 309 | 85 | 0.0 | 10.7 | 16.2 |
| marsh | 18 | chief_axe, plate_armor, iron_shield, lord_ring | 4.0 | 321 | 91 | 0.0 | 9.5 | 22.4 |
| marsh | 18 | mist_blade, bog_scale, iron_shield, witch_charm | 4.5 | 363 | 93 | 0.0 | 5.0 | 19.8 |
| marsh | 20 | mist_blade, bog_scale, iron_shield, witch_charm | 4.8 | 190 | 99 | 0.0 | 6.6 | 53.7 |
| ruins | 20 | mist_blade, bog_scale, iron_shield, witch_charm | 2.4 | 493 | 109 | 0.0 | 11.4 | 20.7 |
| ruins | 22 | mist_blade, bog_scale, iron_shield, witch_charm | 2.5 | 521 | 112 | 0.0 | 8.9 | 27.1 |
| ruins | 22 | captain_sword, garrison_mail, tower_shield, witch_charm | 2.5 | 528 | 112 | 0.0 | 5.6 | 26.7 |
| ruins | 24 | captain_sword, garrison_mail, tower_shield, witch_charm | 2.8 | 577 | 125 | 0.0 | 6.8 | 32.9 |
| ruins | 22 | [knight] captain_sword, garrison_mail, tower_shield, witch_charm | 2.6 | 543 | 120 | 0.0 | 4.1 | 26.0 |
| ruins | 22 | [berserker] captain_sword, garrison_mail, tower_shield, witch_charm | 3.3 | 666 | 140 | 0.0 | 6.8 | 21.2 |
| ruins | 22 | [paladin] captain_sword, garrison_mail, tower_shield, witch_charm | 3.2 | 665 | 139 | 0.0 | 6.9 | 21.2 |
| ruins | 24 | [knight] captain_sword, garrison_mail, tower_shield, witch_charm | 2.8 | 642 | 127 | 0.0 | 3.9 | 29.6 |
| ruins | 24 | [berserker] captain_sword, garrison_mail, tower_shield, witch_charm | 3.5 | 777 | 163 | 0.0 | 6.6 | 24.4 |
| ruins | 24 | [paladin] captain_sword, garrison_mail, tower_shield, witch_charm | 3.5 | 708 | 154 | 0.0 | 8.1 | 26.9 |

Driver limits: it never runs away, drinks only red potions (30 HP, 25 coins) and gets 5 free ones
whenever it runs out, so "Deaths" understates risk and "Potions/min" reads as red-potion
equivalents of HP lost. Use the numbers to compare areas, not as absolute times.

Act 2 targets (design/gdd/act2-*.md): entering an area with the previous area's gear costs about
10–11 potions/min; with the area's own gear 5–7. Level time 16–27 min per level in Lv 16–24.
At Lv20 the marsh's Lv14–15 monsters give half XP (player ≥ monster + 5), pushing players on to
the ruins.

Classes (design/gdd/class-change.md, acceptance 2): at Lv22 in the ruins every class beats the
adventurer (knight 543, berserker 666, paladin 665 vs 528 XP/min) and the classes sit within ±10%
of their mean. The knight trades speed for safety (4.1 potions/min against 6.8–6.9). In class
runs the driver also uses the class attack skill on cooldown and the buff below 70% HP.
