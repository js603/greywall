#!/usr/bin/env python3
"""Code-drawn monsters for greywall: writes codeart2d PixelSpecs (codeart2d.pixelspec.v1).

No image model. Each creature is described as a few 3D primitives (ellipsoids, capsules,
oriented boxes) posed per animation frame; every frame is rasterised with a z-buffer at one
logical pixel, lit with a fixed key light and quantised to the creature's palette ramps, then
written as PixelSpec rows (run-length segments). codeart2d's render_pixelspec.py renders,
outlines and QA-checks the spec; tools/codeart/pack.py turns the frames into the game atlas.

  python tools/codeart/monsters.py <name> <out.pixelspec.json>      names: frost_golem yeti frost_wisp glacier_titan

Directions match the game: S SW W NW N NE E SE (S faces the camera). Clips per direction:
idle 3 frames (played 0 1 0 2), walk 8, attack 6, hurt 2, death 6 -> 200 frames.
"""
import json
import math
import sys

import numpy as np

DIRS = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"]
FWD = {  # screen-facing forward vector in world XY (Y points away from the camera)
    "S": (0, -1), "SW": (-1, -1), "W": (-1, 0), "NW": (-1, 1),
    "N": (0, 1), "NE": (1, 1), "E": (1, 0), "SE": (1, -1),
}
PITCH = math.radians(30)  # 2:1 isometric tiles
LIGHT = np.array([-0.45, -0.55, 0.70])
LIGHT = LIGHT / np.linalg.norm(LIGHT)
CLIPS = {  # name: (frame count, durations ms, loop, frame order)
    "idle": (3, [240, 240, 240, 240], True, [0, 1, 0, 2]),
    "walk": (8, [80] * 8, True, list(range(8))),
    "attack": (6, [140, 170, 190, 100, 170, 230], False, list(range(6))),
    "hurt": (2, [110, 170], False, [0, 1]),
    "death": (6, [130, 130, 140, 150, 170, 500], False, list(range(6))),
}


# ---------------------------------------------------------------- primitives (body space)
# body space: x right, y forward, z up, origin between the feet on the ground

def ellipsoid(c, r, mat, rot=None):
    c = np.array(c, float); r = np.array(r, float)
    n_u = max(12, int(2 * math.pi * r.max() * 2.2)); n_v = max(8, int(math.pi * r.max() * 2.2))
    u = np.linspace(0, 2 * math.pi, n_u, endpoint=False); v = np.linspace(-math.pi / 2, math.pi / 2, n_v)
    U, V = np.meshgrid(u, v)
    s = np.stack([np.cos(V) * np.cos(U), np.cos(V) * np.sin(U), np.sin(V)], -1).reshape(-1, 3)
    p = s * r
    n = s / r
    n /= np.linalg.norm(n, axis=1, keepdims=True)
    if rot is not None:
        p = p @ rot.T; n = n @ rot.T
    return p + c, n, mat


def capsule(a, b, rad, mat):
    a = np.array(a, float); b = np.array(b, float)
    ax = b - a; L = np.linalg.norm(ax) or 1e-6; d = ax / L
    t0 = np.array([1.0, 0, 0]) if abs(d[0]) < 0.9 else np.array([0, 1.0, 0])
    e1 = np.cross(d, t0); e1 /= np.linalg.norm(e1); e2 = np.cross(d, e1)
    n_t = max(2, int(L * 2.2)); n_a = max(10, int(2 * math.pi * rad * 2.2))
    T, A = np.meshgrid(np.linspace(0, L, n_t), np.linspace(0, 2 * math.pi, n_a, endpoint=False))
    radial = np.cos(A)[..., None] * e1 + np.sin(A)[..., None] * e2
    p = a + T[..., None] * d + rad * radial
    pts = [p.reshape(-1, 3)]; nrm = [radial.reshape(-1, 3)]
    for c in (a, b):
        sp, sn, _ = ellipsoid(c, (rad, rad, rad), mat)
        pts.append(sp); nrm.append(sn)
    return np.concatenate(pts), np.concatenate(nrm), mat


def box(c, half, mat, rot=None):
    """Oriented box: centre, half sizes (x, y, z), optional 3x3 rotation."""
    c = np.array(c, float); h = np.array(half, float)
    pts, nrm = [], []
    for axis in range(3):
        o1, o2 = [k for k in range(3) if k != axis]
        g1 = np.linspace(-h[o1], h[o1], max(2, int(h[o1] * 4.4)))
        g2 = np.linspace(-h[o2], h[o2], max(2, int(h[o2] * 4.4)))
        G1, G2 = np.meshgrid(g1, g2)
        for sgn in (-1, 1):
            p = np.zeros(G1.shape + (3,)); p[..., axis] = sgn * h[axis]; p[..., o1] = G1; p[..., o2] = G2
            n = np.zeros(3); n[axis] = sgn
            pts.append(p.reshape(-1, 3)); nrm.append(np.tile(n, (p.size // 3, 1)))
    p = np.concatenate(pts); n = np.concatenate(nrm)
    if rot is not None:
        p = p @ rot.T; n = n @ rot.T
    return p + c, n, mat


def rot_x(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def rot_y(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def rot_z(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


# ---------------------------------------------------------------- pose helpers

def phase(clip, i, n):
    return i / n


def common(clip, i):
    """Shared motion values: bob, lean (pitch forward +), lunge (forward offset), fall (0..1)."""
    n = CLIPS[clip][0]
    t = i / n
    out = dict(swing=0.0, bob=0.0, lean=0.0, lunge=0.0, fall=0.0, raise_=0.0, recoil=0.0, breath=0.0)
    if clip == "idle":
        out["breath"] = [0, 1, -0.5][i]
    elif clip == "walk":
        # quarter-step phase offset: frame i and i+4 are mirror strides, never the same pose
        out["swing"] = math.sin(2 * math.pi * (t + 1 / 16))
        out["bob"] = abs(math.sin(2 * math.pi * (t + 1 / 16)))
    elif clip == "attack":
        # wind up (0-2), strike (3), follow through (4), recover (5)
        out["raise_"] = [0.4, 0.9, 1.0, -0.6, -0.4, 0.1][i]
        out["lean"] = [-0.05, -0.12, -0.15, 0.22, 0.18, 0.05][i]
        out["lunge"] = [0, -1, -1, 3, 2, 0.5][i]
    elif clip == "hurt":
        out["recoil"] = [1.0, 0.5][i]
        out["lean"] = [-0.18, -0.08][i]
    elif clip == "death":
        out["fall"] = [0.0, 0.15, 0.35, 0.6, 0.85, 1.0][i]
    return out


# ---------------------------------------------------------------- creatures

def frost_golem(clip, i, titan=False):
    m = common(clip, i)
    S = 1.32 if titan else 1.18
    prims = []
    sw = m["swing"]; up = m["raise_"]; br = m["breath"]
    hip = 15 * S + m["bob"] * 1.0
    # legs: stubby pillars
    for side in (-1, 1):
        step = sw * 4 * side
        prims.append(box((side * 5.5 * S, step, 6 * S), (3.4 * S, 3.6 * S, 6.5 * S), "rock", rot_x(-sw * 0.25 * side)))
        prims.append(box((side * 5.5 * S, step + 0.8, 1.6 * S), (3.8 * S, 4.4 * S, 1.8 * S), "ice"))
    # torso: wide ice block with a rock core showing in front
    tz = hip + 10 * S + br * 0.5
    prims.append(box((0, 0, tz), (10 * S, 6.5 * S, 10 * S), "ice", rot_x(-0.08)))
    prims.append(box((0, 4.2 * S, tz + 1), (5.5 * S, 3 * S, 5.5 * S), "rock"))
    prims.append(ellipsoid((0, 6.6 * S, tz + 2), (2.2, 1.2, 2.2), "glow"))
    # shoulders
    for side in (-1, 1):
        prims.append(box((side * 12.5 * S, 0, tz + 7 * S), (4.5 * S, 5 * S, 4 * S), "ice", rot_y(side * 0.25)))
    # head: small, sunk between the shoulders, glowing eyes
    hz = tz + 13 * S + br * 0.5
    prims.append(box((0, 1.5, hz), (4.4 * S, 4 * S, 3.6 * S), "rock"))
    for side in (-1, 1):
        prims.append(ellipsoid((side * 1.8 * S, 5.4 * S, hz + 0.5), (0.9, 0.5, 0.8), "glow"))
    if titan:  # crown of ice spikes and shoulder spikes
        for k, x in enumerate((-3.0, 0, 3.0)):
            prims.append(capsule((x * S, 1, hz + 3), (x * S, 1, hz + 7 + (3 if k == 1 else 0)), 1.9, "ice"))
        for side in (-1, 1):
            prims.append(capsule((side * 13 * S, 0, tz + 10 * S), (side * 13.5 * S, 0, tz + 16 * S), 2.2, "ice"))
    # arms: long heavy, fists of ice; attack raises both overhead then slams
    for side in (-1, 1):
        sh = np.array((side * 14.5 * S, 0, tz + 5 * S))
        arm_swing = -sw * 0.35 * side
        ang = arm_swing + up * 1.9  # rotation forward/up about x
        elbow = sh + rot_x(ang) @ np.array((side * 1.5, 0, -9 * S))
        hand = elbow + rot_x(ang * 1.15) @ np.array((side * 0.5, 2, -8 * S))
        prims.append(capsule(sh, elbow, 3.0 * S, "rock"))
        prims.append(capsule(elbow, hand, 2.8 * S, "ice"))
        prims.append(box(hand, (3.8 * S, 3.8 * S, 3.6 * S), "ice", rot_x(ang)))
    return prims, m


def yeti(clip, i):
    m = common(clip, i)
    prims = []
    sw = m["swing"]; up = m["raise_"]; br = m["breath"]
    hip = 13 + m["bob"] * 1.2
    for side in (-1, 1):
        step = sw * 5 * side
        knee = (side * 4.5, step * 0.6 + 1, 7)
        prims.append(capsule((side * 4.5, 0, hip), knee, 3.6, "fur"))
        prims.append(capsule(knee, (side * 4.8, step, 2.2), 3.0, "fur"))
        prims.append(ellipsoid((side * 4.8, step + 2.2, 1.6), (3.0, 4.2, 1.8), "skin"))
    # big round fur body, hunched forward
    bz = hip + 11 + br * 0.6
    prims.append(ellipsoid((0, 1.5, bz), (10, 8, 12), "fur", rot_x(-0.25)))
    prims.append(ellipsoid((0, 6.5, bz - 1), (6, 3, 7), "fur2"))
    # head pushed forward with a dark face and two horns
    hz = bz + 10 + br * 0.6
    prims.append(ellipsoid((0, 5.5, hz), (5.6, 5.2, 5.2), "fur"))
    prims.append(ellipsoid((0, 9.4, hz - 0.6), (3.6, 1.6, 3.4), "skin"))
    for side in (-1, 1):
        prims.append(ellipsoid((side * 1.4, 10.6, hz + 0.6), (0.7, 0.4, 0.7), "eye"))
        prims.append(capsule((side * 4, 5, hz + 3.5), (side * 7.5, 4, hz + 7.5), 1.2, "horn"))
    # long arms reaching the ground; claws
    for side in (-1, 1):
        sh = np.array((side * 9.5, 3, bz + 5))
        ang = -sw * 0.45 * side + up * 2.1
        elbow = sh + rot_x(ang) @ np.array((side * 2.5, 1, -10))
        hand = elbow + rot_x(ang * 1.2) @ np.array((side * 0.5, 3, -9))
        prims.append(capsule(sh, elbow, 3.4, "fur"))
        prims.append(capsule(elbow, hand, 3.0, "fur"))
        prims.append(ellipsoid(hand, (3.0, 3.2, 2.6), "skin"))
        for k in (-1, 0, 1):
            tip = hand + rot_x(ang * 1.2) @ np.array((k * 1.4, 2.5, -3.5))
            prims.append(capsule(hand + np.array((k * 1.2, 1.5, -1.5)), tip, 0.7, "horn"))
    return prims, m


def frost_wisp(clip, i):
    m = common(clip, i)
    prims = []
    n = CLIPS[clip][0]
    t = i / n
    hover = 12 + (math.sin(2 * math.pi * t) * 1.5 if clip in ("idle", "walk") else 0) + m["breath"] * 0.8
    spin = 2 * math.pi * t * (0.5 if clip == "walk" else 0.25)
    if clip == "attack":
        spin = [0, 0.4, 0.9, 1.6, 2.2, 2.5][i]
        hover += [0, 1, 2, -1, -0.5, 0][i]
    # elongated diamond core: two cones made of stacked ellipsoid slices
    core_h = 22
    for k in range(9):
        z = -core_h / 2 + k * core_h / 8
        w = 9.0 * (1 - abs(z) / (core_h / 2 + 0.8))
        prims.append(ellipsoid((0, 0, hover + core_h / 2 + z), (w, w, 2.6), "crystal", rot_z(spin)))
    prims.append(ellipsoid((0, 2.5, hover + core_h / 2), (3.6, 2.6, 4.2), "glow"))
    # four orbiting shards
    orbit = 15 + (5 if clip == "attack" and i in (3, 4) else 0)
    for k in range(4):
        a = spin * 1.5 + k * math.pi / 2
        c = (math.cos(a) * orbit, math.sin(a) * orbit, hover + core_h / 2 + math.sin(a * 2) * 2)
        prims.append(ellipsoid(c, (2.4, 2.4, 5.0), "crystal", rot_z(a)))
    return prims, m


CREATURES = {
    "frost_golem": dict(fn=frost_golem, canvas=(120, 120), anchor=(60, 94), palette={
        "k": "#121826",
        "a": "#2b4f7c", "b": "#4c86ba", "c": "#8cc2e6", "d": "#e2f5ff",   # ice
        "e": "#262833", "f": "#3d4050", "g": "#5b5f73", "h": "#7c8197",   # rock
        "y": "#9ff7ff",                                                    # glow
    }, mats={"ice": "abcd", "rock": "efgh", "glow": "yyyy"}),
    "glacier_titan": dict(fn=lambda c, i: frost_golem(c, i, titan=True), canvas=(140, 140), anchor=(70, 110), palette={
        "k": "#0d1220",
        "a": "#1e3766", "b": "#3563a3", "c": "#6fa6db", "d": "#cfeaff",
        "e": "#1f2230", "f": "#323648", "g": "#4c5168", "h": "#6a7090",
        "y": "#c9f2ff",
    }, mats={"ice": "abcd", "rock": "efgh", "glow": "yyyy"}),
    "yeti": dict(fn=yeti, canvas=(104, 104), anchor=(52, 82), palette={
        "k": "#161822",
        "a": "#6f7c94", "b": "#aab6c8", "c": "#d9e1ee", "d": "#ffffff",   # fur
        "m": "#8a97ad", "n": "#c3cddc",                                   # fur2 (belly) uses mnc d
        "e": "#2b3042", "f": "#454d66", "g": "#646d8c", "h": "#8890b0",   # skin
        "i": "#7d6b4f", "j": "#a8936c", "l": "#d3c19a", "o": "#efe5c8",   # horn/claw
        "y": "#ff5a48",
    }, mats={"fur": "abcd", "fur2": "mncd", "skin": "efgh", "horn": "ijlo", "eye": "yyyy"}),
    "frost_wisp": dict(fn=frost_wisp, canvas=(96, 96), anchor=(48, 74), palette={
        "k": "#0f1a2a",
        "a": "#1a5486", "b": "#349dd2", "c": "#86defc", "d": "#ffffff",
        "y": "#e8fdff",
    }, mats={"crystal": "abcd", "glow": "yyyy"}),
}


# ---------------------------------------------------------------- raster

def render(prims, m, facing, canvas, anchor, mats, flying=False):
    W, H = canvas
    fx, fy = FWD[facing]
    yaw = math.atan2(fx, fy)  # rotate body +y (forward) onto the facing vector
    R = rot_z(-yaw)
    pts, nrms, keys = [], [], []
    for p, n, mat in prims:
        pts.append(p); nrms.append(n); keys.append(np.full(len(p), mat, dtype=object))
    P = np.concatenate(pts); N = np.concatenate(nrms); K = np.concatenate(keys)
    # pose-level motion in body space: lean / recoil (pitch about the feet), lunge, fall over backwards
    P = P.copy()
    P[:, 1] += m["lunge"] - m["recoil"] * 2.0
    pitch = m["lean"] + (-m["fall"] * 1.45 if not flying else 0)
    if pitch:
        Rx = rot_x(-pitch)  # positive lean tips the head forward (+y)
        P = P @ Rx.T; N = N @ Rx.T
    if flying and m["fall"]:
        f = m["fall"]
        P[:, 2] = P[:, 2] * (1 - f * 0.55) - f * 6
        P[:, :2] *= 1 + f * 0.35  # shards scatter
    P = P @ R.T; N = N @ R.T
    sp, cp = math.sin(PITCH), math.cos(PITCH)
    sx = np.rint(anchor[0] + P[:, 0]).astype(int)
    sy = np.rint(anchor[1] - (P[:, 1] * sp + P[:, 2] * cp)).astype(int)
    depth = P[:, 1] * cp - P[:, 2] * sp
    inside = (sx >= 2) & (sx < W - 2) & (sy >= 2) & (sy < H - 2)
    if not inside.all():
        raise ValueError(f"pixels outside the canvas ({(~inside).sum()}), enlarge the canvas")
    order = np.argsort(-depth)  # far first, near overwrite
    lum = np.clip(N @ LIGHT, -1, 1)
    grid = np.full((H, W), ".", dtype="<U1")
    for k in order:
        ramp = mats[K[k]]
        l = lum[k]
        band = 0 if l < -0.15 else 1 if l < 0.35 else 2 if l < 0.82 else 3
        grid[sy[k], sx[k]] = ramp[band]
    return tidy(grid)


def tidy(grid, passes=2):
    """Fills one-pixel notches and drops lone pixels so the outline stays clean (few L-corners)."""
    g = grid.copy()
    for _ in range(passes):
        filled = g != "."
        pad = np.pad(filled, 1)
        nb = pad[:-2, 1:-1].astype(int) + pad[2:, 1:-1] + pad[1:-1, :-2] + pad[1:-1, 2:]
        # notch: an empty pixel boxed in on three or four sides takes its upper or left neighbour's colour
        for y, x in zip(*np.where(~filled & (nb >= 3))):
            for dy, dx in ((-1, 0), (0, -1), (1, 0), (0, 1)):
                if g[y + dy, x + dx] != ".":
                    g[y, x] = g[y + dy, x + dx]
                    break
        filled = g != "."
        pad = np.pad(filled, 1)
        nb = pad[:-2, 1:-1].astype(int) + pad[2:, 1:-1] + pad[1:-1, :-2] + pad[1:-1, 2:]
        g[filled & (nb <= 1)] = "."
    # the outline ring (4-neighbour) must not stair-step: where a ring pixel would be an L-corner,
    # grow the silhouette into it (same test as codeart2d's QA l_corners)
    for _ in range(4):
        filled = g != "."
        p = np.pad(filled, 1)
        ring = ~filled & (p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:])
        q = np.pad(ring, 1)
        up, down, left, right = q[:-2, 1:-1], q[2:, 1:-1], q[1:-1, :-2], q[1:-1, 2:]
        ul, ur, dl, dr = q[:-2, :-2], q[:-2, 2:], q[2:, :-2], q[2:, 2:]
        n4 = up.astype(int) + down + left + right
        corner = ring & (n4 == 2) & ((up & left & ~ul) | (up & right & ~ur) | (down & left & ~dl) | (down & right & ~dr))
        if not corner.any():
            break
        for y, x in zip(*np.where(corner)):
            for dy, dx in ((-1, 0), (0, -1), (1, 0), (0, 1)):
                if 0 <= y + dy < g.shape[0] and 0 <= x + dx < g.shape[1] and g[y + dy, x + dx] != ".":
                    g[y, x] = g[y + dy, x + dx]
                    break
    return g


def segments(grid):
    rows = []
    for r in grid:
        out, prev, cnt = [], r[0], 0
        for ch in r:
            if ch == prev:
                cnt += 1
            else:
                out.append(f"{cnt}{prev}" if cnt > 1 else prev); prev, cnt = ch, 1
        out.append(f"{cnt}{prev}" if cnt > 1 else prev)
        rows.append("".join(out))
    return rows


def build(name):
    c = CREATURES[name]
    flying = name == "frost_wisp"
    frames, clips = [], {}
    for clip, (n, durs, loop, order) in CLIPS.items():
        for d in DIRS:
            names = []
            for i in range(n):
                prims, m = c["fn"](clip, i)
                g = render(prims, m, d, c["canvas"], c["anchor"], c["mats"], flying)
                fname = f"{clip}_{d}_{i}"
                frames.append({"name": fname, "layers": {"body": {"segments": segments(g)}}})
                names.append(fname)
            clips[f"{clip}_{d}"] = {"frames": [names[k] for k in order], "duration_ms": durs, "loop": loop}
    W, H = c["canvas"]
    return {
        "schema": "codeart2d.pixelspec.v1",
        "name": name,
        "canvas": [W, H],
        "anchor_px": list(c["anchor"]),
        "palette": c["palette"],
        "outline": {"mode": "solid", "color": "k"},
        "layers": [{"name": "body", "origin": [0, 0], "segments": [f"{W}." for _ in range(H)]}],
        "frames": frames,
        "clips": clips,
    }


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in CREATURES:
        print(__doc__); sys.exit(2)
    spec = build(sys.argv[1])
    with open(sys.argv[2], "w", encoding="utf-8") as fh:
        json.dump(spec, fh, ensure_ascii=False, separators=(",", ":"))
    print(json.dumps({"spec": sys.argv[2], "frames": len(spec["frames"])}))
