#!/usr/bin/env bash
# Rebuilds the code-drawn monsters: generator -> PixelSpec -> codeart2d render (strict QA) -> game atlas.
#   bash tools/codeart/build.sh [name ...]      default: every creature in tools/codeart/monsters.py
set -euo pipefail
cd "$(dirname "$0")/../.."
SKILL=.claude/skills/codeart2d/scripts
names=("${@:-frost_golem yeti frost_wisp glacier_titan}")
for n in ${names[@]}; do
  spec=assets/source/codeart/$n.pixelspec.json
  out=build/codeart/$n-$(date +%s)
  python3 tools/codeart/monsters.py "$n" "$spec"
  # the titan's stubby legs repeat their silhouette at half cycle; the stride reads on the review sheet
  extra=(); [ "$n" = glacier_titan ] && extra=(--allow-duplicate-half-cycle)
  python3 "$SKILL/render_pixelspec.py" --spec "$spec" --output-dir "$out" --strict-qc "${extra[@]}"
  case $n in frost_golem) size=knight;; glacier_titan) size=orc_chief;; yeti) size=ghoul;; *) size=;; esac
  python3 tools/codeart/pack.py "$out" "$spec" "$n" $size
done
