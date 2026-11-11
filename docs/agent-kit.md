# Agent kit

Five agent repositories are pinned as git submodules under `vendor/` and installed into `.claude/`
by `tools/sync-agent-kit.mjs` according to `tools/agent-kit.json`.

| Submodule | Installed as | Used for |
|---|---|---|
| `Claude-Code-Game-Studios` | `.claude/agents` (34, engine-specific Godot/Unity/Unreal agents left out), `.claude/skills` (37), `.claude/hooks`, `.claude/rules`, `.claude/docs`, `docs/*.md` | Studio roles, GDD/ADR/sprint workflows, review gates |
| `agent-sprite-forge` | skills `codeart2d`, `generate2dsprite`, `generate2dmap`, `generate2dmedia`, `video2dsprite` | All sprites in this game (code-drawn PixelSpec); `fx_pixelfx.py` bridge to pixelfx |
| `pixelfx` | skill `pixelfx`; the checkout itself is the FX renderer (`--pixelfx vendor/pixelfx`) | Effects |
| `awesome-gamedev-agent-skills` | 14 skills (`phaser-core`, `rpg`, `game-feel`, `save-systems`, …) | Engine and genre knowledge |
| `ponytail` | skills `ponytail`, `ponytail-audit`, `ponytail-review`, `ponytail-debt`, `ponytail-gain`, `ponytail-help` | Lean code, audits, reviews |

```bash
git submodule update --init            # after cloning
git submodule update --remote          # pull newer agent repos
node tools/sync-agent-kit.mjs          # reinstall into .claude/, rewrite .claude/agent-kit.lock.json
node tools/sync-agent-kit.mjs --check  # report drift (missing / edited / outdated files)
```

Files listed under `studio.local` in `tools/agent-kit.json` belong to this project and are never
overwritten: `.claude/docs/technical-preferences.md`, `.claude/docs/directory-structure.md`, and
`.claude/settings.json`.

## `.claude/settings.json`

Added by hand through the GitHub web editor (commit `d26a859`), identical to the Studio's
settings. Claude cannot write this file itself: the session's permission classifier blocks it as
self-modification. It wires the status line and the Studio hooks (session start/stop, gap
detection, commit/push/asset validation, pre-compact, subagent log); every hook was pipe-tested in
this repository and exits 0.

Hooks load only in a Claude Code session whose project root is this repository. Optional extra
allow rules for this project: `"Bash(npm test*)"`, `"Bash(npm run build*)"`, `"Bash(npm run sim*)"`.

## Art provenance

The original PixelSpec sources of the existing sprites were lost with the game source; only the
rendered atlases survived. New sprites need new PixelSpecs. To keep the look consistent, build the
spec palettes from the existing atlases (agent-sprite-forge `forge_palette`) and keep the frame
sizes and anchors recorded in `assets/sprites/*.anim.json`.
