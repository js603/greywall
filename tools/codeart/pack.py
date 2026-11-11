#!/usr/bin/env python3
"""Packs a rendered codeart2d PixelSpec into the game's sprite format.

  python tools/codeart/pack.py <render-dir> <spec.json> <name> [size-as-sprite]

<render-dir> is render_pixelspec.py's published output (codeart-meta.json, base/frames/*.png).
Writes assets/sprites/<name>.png + <name>.json (TexturePacker hash, frames f0..fN trimmed to
their pixels, identical frames stored once) and <name>.anim.json (frameSize, anchor, clips
<action>_<dir> with frame indices and durations), the same shape as the original atlases.
"""
import hashlib
import json
import os
import sys

from PIL import Image

render_dir, spec_path, name = sys.argv[1:4]
size_as = sys.argv[4] if len(sys.argv) > 4 else None  # existing body whose shadow/label size to use
ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "assets", "sprites")
meta = json.load(open(os.path.join(render_dir, "codeart-meta.json")))
spec = json.load(open(spec_path))
W, H = spec["canvas"]
ax, ay = spec["anchor_px"]

files = {f["name"]: f["file"] for f in meta["pixelspec"]["frames"]}
index = {f["name"]: k for k, f in enumerate(spec["frames"])}

# trim every frame, keep one copy of identical pixels
cells, uniq, by_hash = [], [], {}
for f in spec["frames"]:
    im = Image.open(os.path.join(render_dir, "base", files[f["name"]])).convert("RGBA")
    box = im.getbbox() or (0, 0, 1, 1)
    crop = im.crop(box)
    h = hashlib.sha1(crop.tobytes() + repr(box).encode()).hexdigest()
    if h not in by_hash:
        by_hash[h] = len(uniq)
        uniq.append((crop, box))
    cells.append(by_hash[h])

# shelf pack into a 2048-wide sheet (like the original atlases)
SHEET_W, PAD = 2048, 1
order = sorted(range(len(uniq)), key=lambda k: -uniq[k][0].height)
pos, x, y, row_h = {}, 0, 0, 0
for k in order:
    w, h = uniq[k][0].size
    if x + w > SHEET_W:
        x, y, row_h = 0, y + row_h + PAD, 0
    pos[k] = (x, y)
    x += w + PAD
    row_h = max(row_h, h)
sheet = Image.new("RGBA", (SHEET_W, y + row_h), (0, 0, 0, 0))
for k, (crop, _) in enumerate(uniq):
    sheet.paste(crop, pos[k])
sheet.save(os.path.join(OUT, f"{name}.png"), optimize=True)

frames = {}
for i, k in enumerate(cells):
    crop, box = uniq[k]
    px, py = pos[k]
    frames[f"f{i}"] = {
        "frame": {"x": px, "y": py, "w": crop.width, "h": crop.height},
        "rotated": False,
        "trimmed": True,
        "spriteSourceSize": {"x": box[0], "y": box[1], "w": crop.width, "h": crop.height},
        "sourceSize": {"w": W, "h": H},
        "pivot": {"x": ax / W, "y": ay / H},
    }
json.dump({"frames": frames, "meta": {"image": f"{name}.png", "size": {"w": SHEET_W, "h": sheet.height}, "scale": "1",
           "app": "greywall tools/codeart/pack.py"}}, open(os.path.join(OUT, f"{name}.json"), "w"), indent=1)

clips = {}
for cname, c in spec["clips"].items():
    d = c["duration_ms"]
    durs = d if isinstance(d, list) else [d] * len(c["frames"])
    clips[cname] = {"frames": [index[n] for n in c["frames"]], "durations": durs, "loop": c["loop"], "events": []}
anim = {"name": name, "frameSize": [W, H], "anchor": [ax, ay],
        "artSource": f"code (agent-sprite-forge codeart2d PixelSpec via tools/codeart/monsters.py; no image model; spec sha256 {meta['spec_sha256']})",
        "clips": clips}
if size_as:
    anim["sizeAs"] = size_as
json.dump(anim, open(os.path.join(OUT, f"{name}.anim.json"), "w"), indent=1)
print(json.dumps({"name": name, "frames": len(cells), "unique": len(uniq), "sheet": [SHEET_W, sheet.height]}))
