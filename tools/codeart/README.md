# Code-drawn monsters (agent-sprite-forge codeart2d)

Unique creatures drawn in code, no image model. `monsters.py` describes each creature as 3D
primitives (ellipsoids, capsules, oriented boxes) posed per frame, rasterises every frame of
8 directions × idle/walk/attack/hurt/death with a z-buffer and a fixed key light, quantises to the
creature's palette ramps, cleans the silhouette so the outline has no stair-steps, and writes a
codeart2d PixelSpec (`assets/source/codeart/<name>.pixelspec.json`). codeart2d's
`render_pixelspec.py --strict-qc` renders, outlines and checks it (partial alpha, off-palette,
outline gaps, L-corners, half-cycle duplicates); `pack.py` turns the frames into the game atlas.

```bash
bash tools/codeart/build.sh              # all creatures
bash tools/codeart/build.sh yeti         # one
```

| Creature | Canvas | Look |
|---|---|---|
| frost_golem | 120×120 | blocky ice body, rock core, glowing eyes and chest, heavy fists |
| glacier_titan | 140×140 | larger, darker golem with an ice crown and shoulder spikes |
| yeti | 104×104 | hunched white fur, dark face, horns, long arms with bone claws |
| frost_wisp | 96×96 | floating crystal with a glowing core and four orbiting shards |
| aqueduct_leech | 120×110 (×1.4) | seven-segment leech with a lateral slither, rears its toothed mouth to bite |
| spine_crab | 112×104 | spiny shell on six legs, two pincers that open and snap; sways sideways while walking |
| naga | 160×160 (×1.3) | coiled serpent tail, upright torso, finned head, golden spear |
| naga_queen | 200×200 (×1.5) | the naga in abyssal violet with a golden crown |

`scale` multiplies a creature before projection; `death="squash"` makes low bodies slump flat instead of tipping
backwards.

Visible height stays at or under 64 px, the codeart2d limit for final pixel art. The titan passes
`--allow-duplicate-half-cycle`: its stubby legs keep the same silhouette half a stride apart.
