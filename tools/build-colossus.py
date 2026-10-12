#!/usr/bin/env python3
"""Builds the Stone King's Colossus (chapter 2's last boss) as a PS2-style model:
assets/enemies/colossus.glb + assets/enemies/colossus_stone.png

PS2 look, not complexity: a few hundred faceted faces per part with chunky readable silhouettes,
one small hand-painted stone texture (128 px, tiled), and the shading painted into vertex colours
(dark toward the ground and under overhangs, moss on what faces the sky, a little per-face
variation) the way games of that era lit their models.

Parts (each its own node, in metres, in the boss's local space: +z forward, +x its right):
  torso      waist-deep body, origin on the ground at its middle
  head       origin at the neck pivot (src/colossus.js HEAD_Y)
  arm_upper  shoulder at the origin, elbow at +y UPPER_LEN
  arm_fore   elbow at the origin, wrist at +y FORE_LEN
  hand_r / hand_l   wrist at the origin, fingers toward +z, palm facing -y
  joint      the elbow's ball
  glow       the gold cracks in the chest (drawn unlit in the game)

Run: python3 tools/build-colossus.py   (needs numpy and pillow)
"""
import math, os, random, sys
sys.path.insert(0, os.path.dirname(__file__))
from ps2model import *   # Part, lathe, box, rock, cone, transform, jitter, shade, paint_stone, write_glb

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT_GLB = os.path.join(ROOT, 'assets/enemies/colossus.glb')
OUT_TEX = os.path.join(ROOT, 'assets/enemies/colossus_stone.png')
UPPER_LEN, FORE_LEN = 10.0, 11.0
rnd = random.Random(7)


# ------------------------------------------------------------------ geometry helpers
# ------------------------------------------------------------------ the parts
def torso():
    p = Part()
    # the body: broad chest, narrow waist, sunk into the ground below y=0
    v, f = lathe([(4.4, -7), (4.7, 1.0), (5.6, 5.5), (6.6, 9.5), (6.0, 12.4), (3.4, 13.8)], 9, 1.18, 0.74)
    p.add(jitter(v, 0.1, 1), f)
    # the yoke across the shoulders, and the great pauldrons in three plates each
    v, f = box(16.5, 2.8, 5.8); p.add(jitter(transform(v, (0, 12.0, -0.2)), 0.08, 2), f)
    for s in (-1, 1):
        v, f = rock(2.9, 10 + s); p.add(transform(v, (s * 7.8, 13.0, 0), scale=(1.15, 0.8, 1.2)), f)
        for i in range(2):
            v, f = box(4.6 - i * 0.5, 0.8, 5.0 - i * 0.4)
            p.add(jitter(transform(v, (s * (8.7 + i * 0.3), 11.0 - i * 1.1, 0), (0, 0, s * (0.42 + i * 0.16))), 0.05, 20 + i), f, (0.92, 0.92, 0.95))
    # the neck
    v, f = lathe([(2.3, 13.0), (1.9, 15.8)], 7, cap_bottom=False); p.add(v, f)
    # the breastplate carved into the stone: a keel and two slabs, and a belt of blocks at the waist
    v, f = box(1.1, 6.5, 1.3); p.add(transform(v, (0, 7.6, 4.55), (-0.12, 0, 0)), f, (0.95, 0.95, 1))
    for s in (-1, 1):
        v, f = box(4.8, 3.4, 1.1); p.add(transform(v, (s * 2.7, 9.4, 4.25), (-0.1, -s * 0.28, 0)), f, (0.97, 0.97, 1))
    for i in range(7):
        a = i / 7 * math.tau
        v, f = box(4.0, 1.4, 1.8)
        p.add(transform(v, (math.cos(a) * 5.1, 1.6, math.sin(a) * 3.6), (0, -a + math.pi / 2, 0)), f, (0.85, 0.86, 0.9))
    # a slab of stone cloak hanging down the back
    v, f = box(11, 10, 1.1); p.add(transform(v, (0, 6.5, -4.1), (0.14, 0, 0)), f, (0.9, 0.9, 0.94))
    # rubble and moss heaped round the waist where it broke out of the earth
    for i in range(8):
        a = i / 8 * math.tau + rnd.uniform(-0.2, 0.2)
        r = rnd.uniform(1.0, 2.2)
        v, f = rock(r, 50 + i)
        p.add(transform(v, (math.cos(a) * rnd.uniform(5.2, 7.5), r * 0.25, math.sin(a) * rnd.uniform(3.8, 5.5))), f, (0.82, 0.85, 0.8))
    return p


def head():
    p = Part()
    v, f = rock(1.0, 101, detail=2); p.add(transform(v, (0, 0.2, 0), scale=(2.9, 3.4, 3.0)), f)
    # heavy brow, nose, cheekbones, the line of the mouth hidden in beard
    v, f = box(5.2, 1.1, 1.5); p.add(jitter(transform(v, (0, 1.0, 2.55), (-0.18, 0, 0)), 0.08, 102), f)
    v, f = box(0.95, 2.3, 1.4); p.add(jitter(transform(v, (0, -0.25, 3.05), (0.28, 0, 0)), 0.06, 103), f)
    for s in (-1, 1):
        v, f = box(1.6, 0.9, 1.1); p.add(jitter(transform(v, (s * 1.65, -0.45, 2.45), (0, s * 0.35, 0)), 0.06, 104 + s), f)
        v, f = box(0.6, 1.8, 1.1); p.add(jitter(transform(v, (s * 3.05, 0.1, 0.2)), 0.06, 106 + s), f)     # ears
        v, f = box(1.3, 0.55, 0.5); p.add(transform(v, (s * 1.25, 0.32, 2.62)), f, (0.25, 0.24, 0.3))         # the dark of the eye sockets
    # the beard: a great wedge and three braids
    v, f = cone(2.6, 4.6, 7); p.add(jitter(transform(v, (0, -1.0, 1.7), (math.pi - 0.42, 0, 0)), 0.15, 108), f, (0.9, 0.9, 0.92))
    for i, x in enumerate((-1.1, 0, 1.1)):
        v, f = cone(0.45, 2.6, 5); p.add(transform(v, (x, -4.4, 2.9 - abs(x) * 0.3), (math.pi - 0.25, 0, x * 0.1)), f, (0.88, 0.88, 0.9))
    # the crown's seat: a broken stone ring with only some of its teeth left
    v, f = lathe([(2.75, 2.7), (2.85, 3.5)], 14, cap_top=False, cap_bottom=False); p.add(v, f, (0.8, 0.84, 0.78))
    for i in range(10):
        if i in (2, 3, 7):
            continue
        a = i / 10 * math.tau
        v, f = box(0.75, 0.9 if i % 3 else 0.5, 0.45)
        p.add(transform(v, (math.cos(a) * 2.8, 3.85, math.sin(a) * 2.8), (0, -a + math.pi / 2, 0)), f, (0.82, 0.86, 0.78))
    return p


def arm_upper():
    p = Part()
    v, f = lathe([(1.35, 0.0), (1.75, 4.2), (1.35, 9.0), (1.25, UPPER_LEN)], 7)
    p.add(jitter(v, 0.04, 201), f)
    v, f = lathe([(1.8, 5.5), (1.85, 6.4)], 7, cap_top=False, cap_bottom=False); p.add(v, f, (0.85, 0.85, 0.9))   # a carved band
    return p


def arm_fore():
    p = Part()
    v, f = lathe([(1.15, 0.0), (1.4, 4.0), (1.2, 8.0), (1.05, FORE_LEN)], 7)
    p.add(jitter(v, 0.04, 301), f)
    # a stone bracer on the forearm
    v, f = lathe([(1.5, 6.2), (1.45, 8.6)], 7, cap_top=False, cap_bottom=False); p.add(v, f, (0.9, 0.9, 0.95))
    return p


def joint():
    p = Part()
    v, f = rock(1.6, 401); p.add(v, f)
    return p


def hand(mirror=False):
    p = Part()
    v, f = box(3.6, 1.35, 3.0); p.add(transform(v, (0, 0.05, 0.6)), f)          # palm
    v, f = box(3.2, 1.1, 1.0); p.add(transform(v, (0, 0.2, 2.25)), f)          # knuckles
    for i, x in enumerate((-1.2, -0.4, 0.4, 1.2)):
        ln = 1.25 - abs(x) * 0.15
        v, f = box(0.72, 0.8, ln); p.add(transform(v, (x, 0.1, 2.75 + ln / 2), (0.25, 0, 0)), f)
        v, f = box(0.66, 0.7, 1.15); p.add(transform(v, (x, -0.45, 3.75 + ln * 0.6), (0.85, 0, 0)), f)
    v, f = box(0.8, 0.8, 1.8); p.add(jitter(transform(v, (-2.05, -0.1, 1.0), (0.2, 0.7, 0)), 0.05, 530), f)    # thumb
    v, f = lathe([(1.15, -0.9), (1.25, 0.2)], 8); p.add(transform(v, (0, 0, -0.6), (math.pi / 2, 0, 0)), f)       # wrist
    if mirror:
        for i, t in enumerate(p.tris):
            t = t.copy(); t[:, 0] *= -1
            p.tris[i] = t[[0, 2, 1]]       # keep the faces turned outward
    return p


def glow():
    """gold light in the chest's cracks: thin zig-zag strips standing just proud of the stone"""
    p = Part()
    for x0, y0, n in [(-1.0, 2.8, 6), (2.3, 3.4, 5), (-3.6, 5.2, 4), (3.9, 6.2, 3)]:
        x, y = x0, y0
        for i in range(n):
            nx, ny = x + rnd.uniform(-0.9, 0.9), y + rnd.uniform(0.7, 1.2)
            r_at = 4.9 + (min(y, 10.6) - 2.5) / 8.1 * 1.8          # the lathe's radius there (see torso())
            z = max(0.2, (r_at * 0.74) * math.sqrt(max(0.0, 1 - (x / (r_at * 1.18)) ** 2))) + 0.12
            dx, dy = nx - x, ny - y; L = math.hypot(dx, dy); px, py = -dy / L * 0.11, dx / L * 0.11
            v = [(x - px, y - py, z), (x + px, y + py, z), (nx + px, ny + py, z), (nx - px, ny - py, z)]
            p.add(v, [(0, 1, 2), (0, 2, 3)], (1.6, 1.15, 0.45))
            x, y = nx, ny
    return p


# ------------------------------------------------------------------ shading painted into the vertices
if __name__ == '__main__':
    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    paint_stone(OUT_TEX)
    parts = [
        ('torso', shade(torso(), -1.0, 14.0), 0),
        ('head', shade(head(), -4.5, 4.0, ao_floor=0.62), 0),
        ('arm_upper', shade(arm_upper(), -2, UPPER_LEN + 6, ao_floor=0.75), 0),
        ('arm_fore', shade(arm_fore(), -2, FORE_LEN + 6, ao_floor=0.75, moss_on=False), 0),
        ('hand_r', shade(hand(), -1.2, 1.2, ao_floor=0.62), 0),
        ('hand_l', shade(hand(mirror=True), -1.2, 1.2, ao_floor=0.62), 0),
        ('joint', shade(joint(), -1.6, 1.6, ao_floor=0.7), 0),
        ('glow', shade(glow(), 0, 1, unlit=True), 1),
    ]
    write_glb(OUT_GLB, parts, [{'name': 'stone', 'tex': 0}, {'name': 'glow', 'emissiveFactor': [1, 0.75, 0.3]}], [OUT_TEX])
    n = sum(len(p[1][0]) // 3 for p in parts)
    print(f'{OUT_GLB}: {n} triangles, {os.path.getsize(OUT_GLB) // 1024} KB')
