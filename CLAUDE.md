# 회색성벽 연대기 (Greywall Chronicle) — Game Studio Agent Setup

Isometric medieval fantasy RPG with slow, deliberate melee. Web (Phaser 3) PWA, Korean UI.
Work is organised with the Claude Code Game Studios agent architecture (`vendor/Claude-Code-Game-Studios`).

## Technology Stack

- **Engine**: Phaser 3.90.0
- **Language**: JavaScript (ES modules)
- **Version Control**: Git with trunk-based development
- **Build System**: Vite (`npm run build` → `dist/` + `tools/gen_sw.mjs` service worker)
- **Asset Pipeline**: agent-sprite-forge `codeart2d` (sprites) + pixelfx via `fx_pixelfx.py` (FX) → `assets/`
- **Tests**: `npm test` (`node:test`, headless simulation)

## Agent Toolchain (vendored as submodules in `vendor/`)

| Need | Use |
|---|---|
| Roles, reviews, sprints, GDDs | Studio agents and skills in `.claude/` (from Claude-Code-Game-Studios) |
| Phaser / RPG / save / game-feel know-how | awesome-gamedev-agent-skills: `phaser-core`, `rpg`, `save-systems`, `game-feel`, … |
| New characters, monsters, props, tiles | `codeart2d` (agent-sprite-forge). **This project's art source is code**: every sprite is a codeart2d PixelSpec, so a sprite request here counts as an explicit code-art request. Match the existing 8-direction clip set (idle/walk/attack/hurt/death) and disclose results as code-drawn. |
| New effects | `pixelfx` skill + `vendor/agent-sprite-forge/skills/generate2dsprite/scripts/fx_pixelfx.py --pixelfx vendor/pixelfx`, then `node tools/pack-fx.mjs` |
| Lean code, audits, reviews | `ponytail`, `ponytail-review`, `ponytail-audit` |

Update the kit with `git submodule update --remote` then `node tools/sync-agent-kit.mjs`;
`node tools/sync-agent-kit.mjs --check` reports drift.

## Project Structure

@.claude/docs/directory-structure.md

## Technical Preferences

@.claude/docs/technical-preferences.md

## Coordination Rules

@.claude/docs/coordination-rules.md

## Collaboration Protocol

**User-driven collaboration, not autonomous execution.**
Every task follows: **Question -> Options -> Decision -> Draft -> Approval**

- Agents MUST ask "May I write this to [filepath]?" before using Write/Edit tools
- Agents MUST show drafts or summaries before requesting approval
- Multi-file changes require explicit approval for the full changeset
- No commits without user instruction

See `docs/COLLABORATIVE-DESIGN-PRINCIPLE.md` for full protocol and examples.

## Coding Standards

@.claude/docs/coding-standards.md

## Context Management

@.claude/docs/context-management.md

## Project History

The original source was lost and restored from the shipped build — see `docs/restoration.md`.
Local variables in restored modules still carry minified names; rename them when you touch a function.
