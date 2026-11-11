# Directory Structure

```text
/
├── CLAUDE.md                    # Master configuration
├── .claude/                     # Agents, skills, hooks, rules, docs (synced from vendor/, see tools/agent-kit.json)
├── src/                         # Game source
│   ├── core/                    #   iso projection, pathfinding, RNG
│   ├── data/                    #   data table loaders (values live in assets/data/)
│   ├── sim/                     #   headless game rules (World, GameMap, entities)
│   ├── maps/                    #   seeded map builders
│   ├── render/                  #   Phaser scene + asset registry
│   ├── ui/                      #   DOM HUD and panels
│   └── bot/                     #   auto-play bot (?bot=1)
├── assets/
│   ├── sprites/                 # codeart2d atlases (.png + .json + .anim.json)
│   ├── fx/                      # pixelfx sheets + fx.json
│   ├── data/                    # balance/content JSON (items, monsters, quests, …)
│   └── fonts/                   # Galmuri11 (OFL)
├── public/                      # PWA icons + manifest (copied as-is)
├── design/                      # Game design documents (gdd, narrative, levels, balance)
├── docs/                        # Technical documentation (architecture, restoration, analysis)
├── tests/                       # node:test suites (headless)
├── tools/                       # build/pipeline tools (gen_sw, sync-agent-kit, fx repack, restore)
├── vendor/                      # git submodules: agent-sprite-forge, pixelfx, awesome-gamedev-agent-skills,
│                                #   ponytail, Claude-Code-Game-Studios
└── production/                  # sprints, milestones, session state
```
