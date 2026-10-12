#!/usr/bin/env python3
"""Builds Kowak the Shepherd (โกวัก ผู้เลี้ยงแกะ), the crow-headed shepherd on Moon Hill, as a
PS2-style model: assets/npcs/kowak.glb + assets/npcs/kowak_cloth.png

A tall, stooped figure in a long mossy robe with a ragged hem and a short shoulder cape, a ruff of
black feathers at the throat, a crow's head with a long bone-grey beak under a deep hood, bird
claws for hands folded on a shepherd's crook, talons peeping out under the hem, a rope belt with a
little bell. The silhouette is the crook, the hood and the beak.

Parts (metres, origin at his feet, facing +z): body (everything but the eyes), eyes (drawn unlit
in the game, so they glow). Run: python3 tools/build-kowak.py   (needs numpy and pillow)
"""
import math, os, random, sys
sys.path.insert(0, os.path.dirname(__file__))
from ps2model import *   # Part, lathe, box, rock, cone, transform, jitter, shade, write_glb

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT_GLB = os.path.join(ROOT, 'assets/npcs/kowak.glb')
OUT_TEX = os.path.join(ROOT, 'assets/npcs/kowak_cloth.png')
rnd = random.Random(3)

ROBE = (0.27, 0.33, 0.27)      # mossy grey-green
CAPE = (0.22, 0.27, 0.22)
FEATHER = (0.12, 0.13, 0.19)   # black with a blue sheen
BEAK = (0.6, 0.58, 0.52)
CLAW = (0.2, 0.19, 0.2)
WOOD = (0.42, 0.3, 0.2)
ROPE = (0.5, 0.4, 0.27)
BRASS = (0.75, 0.6, 0.3)


def between(a, b, r0, r1, sides=6):
    """a tapered tube from point a to point b"""
    a, b = np.asarray(a, float), np.asarray(b, float)
    d = b - a; L = np.linalg.norm(d); d /= L
    v, f = lathe([(r0, 0.0), (r1, L)], sides)
    # turn +y onto d
    y = np.array([0, 1.0, 0]); ax = np.cross(y, d); s = np.linalg.norm(ax); c = float(np.dot(y, d))
    if s < 1e-6:
        R = np.eye(3) if c > 0 else np.diag([1, -1, -1])
    else:
        ax /= s; K = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]])
        R = np.eye(3) + s * K + (1 - c) * K @ K
    return v @ R.T + a, f


def stoop(v, from_y=1.0, k=0.14):
    """lean everything above from_y forward, as an old man leans on his crook"""
    v = v.copy()
    up = np.clip(v[:, 1] - from_y, 0, None)
    v[:, 2] += up * k
    return v


def ragged(v, y_hem, amt, seed):
    """pull the hem ring up and down so the robe ends in tatters"""
    r = random.Random(seed); v = v.copy()
    for i, p in enumerate(v):
        if abs(p[1] - y_hem) < 1e-6:
            v[i, 1] += r.choice([-1, 1]) * r.uniform(0.3, 1.0) * amt
            v[i, 0] *= 1.04; v[i, 2] *= 1.04
    return v


def body():
    p = Part()
    # the robe: wide at the hem, ragged, stooped forward
    v, f = lathe([(0.6, 0.0), (0.55, 0.35), (0.46, 0.9), (0.41, 1.3), (0.33, 1.56)], 11, 1.0, 0.92, cap_bottom=False)
    p.add(stoop(ragged(v, 0.0, 0.08, 1)), f, ROBE)
    # the shoulder cape, also ragged
    v, f = lathe([(0.52, 1.18), (0.42, 1.45), (0.2, 1.66)], 10, 1.05, 0.95, cap_bottom=False, cap_top=False)
    p.add(stoop(ragged(v, 1.18, 0.07, 2)), f, CAPE)
    # tatters hanging down the back
    for i in range(4):
        x = -0.24 + i * 0.16
        v, f = box(0.09, 0.42 + rnd.uniform(0, 0.2), 0.03)
        p.add(stoop(transform(v, (x, 0.26, -0.5), (0.08, 0, 0))), f, CAPE)
    # the rope belt and its little bell
    v, f = lathe([(0.44, 0.96), (0.45, 1.02)], 11, 1.0, 0.92, cap_top=False, cap_bottom=False)
    p.add(stoop(v), f, ROPE)
    v, f = cone(0.06, 0.1, 6); p.add(stoop(transform(v, (0.2, 0.86, 0.42), (math.pi, 0, 0))), f, BRASS)
    # the ruff of black feathers at the throat
    for i in range(14):
        a = i / 14 * math.tau + 0.2
        tip = (math.cos(a) * 0.42, 1.38, math.sin(a) * 0.36 + 0.12)
        base = (math.cos(a) * 0.18, 1.66, math.sin(a) * 0.16 + 0.12)
        v, f = between(base, tip, 0.06, 0.005, 3)
        p.add(v, f, FEATHER)
    # the head: a crow's skull, a long beak, under a deep hood
    v, f = rock(0.24, 7, detail=2); p.add(transform(v, (0, 1.9, 0.18), scale=(0.88, 1.0, 1.15)), f, FEATHER)
    v, f = between((0, 1.89, 0.38), (0, 1.8, 0.92), 0.08, 0.008, 5); p.add(v, f, BEAK)          # upper beak, drooping
    v, f = between((0, 1.83, 0.38), (0, 1.8, 0.72), 0.05, 0.006, 5); p.add(v, f, BEAK)          # lower beak
    v, f = lathe([(0.36, 1.66), (0.38, 1.88), (0.32, 2.06), (0.18, 2.17), (0.01, 2.2)], 10, 1.0, 1.05, cap_bottom=False)
    v = transform(v, (0, 0, 0.02), (-0.18, 0, 0))
    # open the hood's face: push the front ring back so the beak and eyes show
    for i, q in enumerate(v):
        if q[2] > 0.15 and q[1] < 2.08:
            v[i, 2] = 0.15 + (q[2] - 0.15) * 0.25
    p.add(v, f, CAPE)
    # sleeves to the hands, both folded over the crook
    hands = {1: (0.3, 1.28, 0.55), -1: (0.25, 1.12, 0.55)}
    for s, hpos in hands.items():
        sh = (s * 0.33, 1.48, 0.12)
        el = (s * 0.36 + (0.12 if s < 0 else 0), 1.2, 0.36)
        v, f = between(sh, el, 0.12, 0.11, 7); p.add(v, f, ROBE)
        v, f = between(el, hpos, 0.11, 0.14, 7); p.add(v, f, ROBE)
        # a claw: three long fingers wrapped round the staff and a thumb
        for k in range(3):
            v, f = between(hpos, (hpos[0] + 0.08 - k * 0.02, hpos[1] - 0.04 - k * 0.05, hpos[2] + 0.12), 0.025, 0.008, 4)
            p.add(v, f, CLAW)
        v, f = between(hpos, (hpos[0] - 0.08, hpos[1] + 0.03, hpos[2] + 0.05), 0.025, 0.008, 4); p.add(v, f, CLAW)
    # the shepherd's crook: a staff with a hook curling forward at the top
    v, f = between((0.32, 0.0, 0.6), (0.3, 2.15, 0.56), 0.035, 0.03, 6); p.add(v, f, WOOD)
    prev = (0.3, 2.15, 0.56)
    for k in range(1, 7):
        a = k / 6 * math.pi * 1.1
        nxt = (0.3, 2.15 + math.sin(a) * 0.16, 0.56 + (1 - math.cos(a)) * 0.16)
        v, f = between(prev, nxt, 0.032, 0.03, 5); p.add(v, f, WOOD)
        prev = nxt
    # talons under the hem
    for s in (-1, 1):
        for k in (-1, 0, 1):
            v, f = between((s * 0.16, 0.05, 0.38), (s * 0.16 + k * 0.08, 0.01, 0.58), 0.035, 0.008, 4)
            p.add(v, f, CLAW)
    return p


def eyes():
    p = Part()
    for s in (-1, 1):
        v, f = rock(0.045, 20 + s); p.add(transform(v, (s * 0.12, 1.96, 0.36)), f, (1.6, 0.95, 0.4))
    return p


def paint_cloth(path, size=128):
    """a neutral weave with feather barbs: the vertex colours give the colour, this gives the grain"""
    r = random.Random(5)
    img = Image.new('RGB', (size, size), (176, 176, 176))
    d = ImageDraw.Draw(img, 'RGBA')
    for _ in range(60):
        x, y, rr = r.uniform(0, size), r.uniform(0, size), r.uniform(5, 18)
        c = r.choice([(205, 205, 200, 50), (130, 130, 136, 60)])
        for ox in (-size, 0, size):
            for oy in (-size, 0, size):
                d.ellipse((x - rr + ox, y - rr + oy, x + rr + ox, y + rr + oy), fill=c)
    img = img.filter(ImageFilter.GaussianBlur(2))
    d = ImageDraw.Draw(img, 'RGBA')
    for y in range(0, size, 3):                     # the weave
        d.line((0, y, size, y), fill=(120, 120, 124, 60))
    for x in range(0, size, 4):
        d.line((x, 0, x, size), fill=(220, 220, 214, 35))
    for _ in range(40):                             # barbs and frayed threads
        x, y = r.uniform(0, size), r.uniform(0, size); a = r.uniform(-0.6, 0.6) + math.pi / 2
        d.line((x, y, x + math.cos(a) * 8, y + math.sin(a) * 8), fill=(90, 90, 98, 120))
    img.save(path)


if __name__ == '__main__':
    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    paint_cloth(OUT_TEX)
    parts = [
        ('body', shade(body(), 0.0, 2.2, base=(1, 1, 1), ao_floor=0.45, moss_on=False, crease=55, uv_scale=3.0), 0),
        ('eyes', shade(eyes(), 0, 1, unlit=True), 1),
    ]
    write_glb(OUT_GLB, parts, [{'name': 'cloth', 'tex': 0}, {'name': 'eyes', 'emissiveFactor': [1, 0.6, 0.25]}], [OUT_TEX])
    n = sum(len(p[1][0]) // 3 for p in parts)
    print(f'{OUT_GLB}: {n} triangles, {os.path.getsize(OUT_GLB) // 1024} KB')
