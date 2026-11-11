#!/usr/bin/env python3
"""Adds a pixelfx render (fx_pixelfx.py render output) to assets/fx/raw/ for tools/pack-fx.mjs.

  python tools/fx/import_pixelfx.py <render-dir> <name>
  node tools/pack-fx.mjs <name>

Render first, e.g.:
  python vendor/agent-sprite-forge/skills/generate2dsprite/scripts/fx_pixelfx.py render \
    --pixelfx vendor/pixelfx --id ice/ice-shatter --output-dir build/fx-ice --fps 15
"""
import json
import os
import shutil
import sys

from PIL import Image

src, name = sys.argv[1:3]
RAW = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "fx", "raw")
fx = json.load(open(os.path.join(src, "fx.json")))
sheet = json.load(open(os.path.join(src, "sheet.json")))
eff = fx["effect"]
w, h = eff["frameSize"]
frames = sheet["frames"] if isinstance(sheet["frames"], list) else list(sheet["frames"].values())
img = Image.open(os.path.join(src, "sheet.png")).convert("RGBA")
x0 = y0 = 10**9; x1 = y1 = -1
for f in frames:
    r = f["frame"]
    b = img.crop((r["x"], r["y"], r["x"] + w, r["y"] + h)).getbbox()
    if b:
        x0, y0, x1, y1 = min(x0, b[0]), min(y0, b[1]), max(x1, b[2]), max(y1, b[3])
shutil.copyfile(os.path.join(src, "sheet.png"), os.path.join(RAW, f"{name}.png"))
shutil.copyfile(os.path.join(src, "CREDITS.txt"), os.path.join(RAW, f"{name}.CREDITS.txt"))
db_path = os.path.join(RAW, "fx.json")
db = json.load(open(db_path))
db[name] = {
    "id": eff["id"], "w": w, "h": h,
    "rects": [[f["frame"]["x"], f["frame"]["y"]] for f in frames],
    "durations": [f["duration"] for f in frames],
    "loop": eff["loop"], "pivot": eff["pivot"], "bbox": [x0, y0, x1, y1],
    "fps": eff["fps"], "body_drawn": False,
    "credits": "pixelfx (MIT) via fx_pixelfx.py, see CREDITS.txt",
}
json.dump(db, open(db_path, "w"), indent=1)
open(db_path, "a").write("\n")
print(json.dumps({"name": name, "frames": len(frames), "size": [w, h]}))
