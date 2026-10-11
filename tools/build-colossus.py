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
import json, math, os, random, struct
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT_GLB = os.path.join(ROOT, 'assets/enemies/colossus.glb')
OUT_TEX = os.path.join(ROOT, 'assets/enemies/colossus_stone.png')
UPPER_LEN, FORE_LEN = 10.0, 11.0
rnd = random.Random(7)


# ------------------------------------------------------------------ geometry helpers
class Part:
    """faceted triangles: every face keeps its own three vertices"""
    def __init__(self):
        self.tris = []      # list of (3x3 positions)
        self.cols = []      # per-face colour multiplier (r, g, b)

    def add(self, verts, faces, tint=(1, 1, 1)):
        v = np.asarray(verts, float)
        for f in faces:
            self.tris.append(v[list(f)])
            self.cols.append(tint)
        return self

    def merge(self, other):
        self.tris += other.tris
        self.cols += other.cols
        return self


def jitter(v, amt, seed):
    """push each vertex a little along a hash of its position (same spot, same push)"""
    out = v.copy()
    for i, p in enumerate(v):
        h = math.sin(p[0] * 12.9898 + p[1] * 78.233 + p[2] * 37.719 + seed) * 43758.5453
        r = random.Random(int(abs(h)) % 100000 + seed)
        out[i] += np.array([r.uniform(-1, 1), r.uniform(-1, 1), r.uniform(-1, 1)]) * amt
    return out


def transform(v, pos=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    v = np.asarray(v, float) * np.asarray(scale, float)
    rx, ry, rz = rot
    Rx = np.array([[1, 0, 0], [0, math.cos(rx), -math.sin(rx)], [0, math.sin(rx), math.cos(rx)]])
    Ry = np.array([[math.cos(ry), 0, math.sin(ry)], [0, 1, 0], [-math.sin(ry), 0, math.cos(ry)]])
    Rz = np.array([[math.cos(rz), -math.sin(rz), 0], [math.sin(rz), math.cos(rz), 0], [0, 0, 1]])
    return v @ (Ry @ Rx @ Rz).T + np.asarray(pos, float)   # three.js 'XYZ' order on column vectors


def lathe(profile, sides, sx=1.0, sz=1.0, cap_top=True, cap_bottom=True, twist=0.0):
    """rings of (radius, y) around +y; sx/sz squash it into an oval"""
    verts, faces = [], []
    for j, (r, y) in enumerate(profile):
        for i in range(sides):
            a = (i + (j % 2) * twist) / sides * math.tau
            verts.append((math.cos(a) * r * sx, y, math.sin(a) * r * sz))
    for j in range(len(profile) - 1):
        for i in range(sides):
            a, b = j * sides + i, j * sides + (i + 1) % sides
            c, d = a + sides, b + sides
            faces += [(a, c, b), (b, c, d)]
    if cap_bottom:
        verts.append((0, profile[0][1], 0)); k = len(verts) - 1
        faces += [(k, i, (i + 1) % sides) for i in range(sides)]
    if cap_top:
        verts.append((0, profile[-1][1], 0)); k = len(verts) - 1; o = (len(profile) - 1) * sides
        faces += [(k, o + (i + 1) % sides, o + i) for i in range(sides)]
    return np.array(verts), faces


def box(w, h, d):
    x, y, z = w / 2, h / 2, d / 2
    v = [(-x, -y, -z), (x, -y, -z), (x, y, -z), (-x, y, -z), (-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)]
    f = [(0, 2, 1), (0, 3, 2), (4, 5, 6), (4, 6, 7), (0, 1, 5), (0, 5, 4), (3, 7, 6), (3, 6, 2), (0, 4, 7), (0, 7, 3), (1, 2, 6), (1, 6, 5)]
    return np.array(v, float), f


def rock(r, seed, detail=1):
    """a lumpy low-poly boulder: an icosahedron, pushed about"""
    t = (1 + 5 ** 0.5) / 2
    v = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    f = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8),
         (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    v = np.array(v, float)
    for _ in range(detail - 1):
        mid = {}
        def m(a, b):
            k = (min(a, b), max(a, b))
            if k not in mid:
                mid[k] = len(v_list); v_list.append((v_list[a] + v_list[b]) / 2)
            return mid[k]
        v_list = list(v); nf = []
        for a, b, c in f:
            ab, bc, ca = m(a, b), m(b, c), m(c, a)
            nf += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
        v, f = np.array(v_list), nf
    v = v / np.linalg.norm(v, axis=1, keepdims=True) * r
    return jitter(v, r * 0.07, seed), f


def cone(r, h, sides):
    v = [(math.cos(i / sides * math.tau) * r, 0, math.sin(i / sides * math.tau) * r) for i in range(sides)] + [(0, h, 0), (0, 0, 0)]
    f = [(i, sides, (i + 1) % sides) for i in range(sides)] + [(sides + 1, (i + 1) % sides, i) for i in range(sides)]
    return np.array(v, float), f


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
def shade(part, lo, hi, base=(0.86, 0.9, 1.0), moss=(0.62, 0.78, 0.52), ao_floor=0.55, moss_on=True, unlit=False, crease=50):
    """normals smoothed across gentle angles (hard edges kept past `crease` degrees), and the
    shading painted per vertex: dark toward the ground, darker underneath, moss where it faces up"""
    tris, tints, fn = [], [], []
    for tri, tint in zip(part.tris, part.cols):
        n = np.cross(tri[1] - tri[0], tri[2] - tri[0]); ln = np.linalg.norm(n)
        if ln < 1e-9:
            continue
        tris.append(tri); tints.append(tint); fn.append(n / ln)
    share = {}
    key = lambda v: (round(float(v[0]), 3), round(float(v[1]), 3), round(float(v[2]), 3))
    for i, tri in enumerate(tris):
        for v in tri:
            share.setdefault(key(v), []).append(i)
    cos_lim = math.cos(math.radians(crease))
    pos, nor, col = [], [], []
    for i, tri in enumerate(tris):
        for v in tri:
            n = np.zeros(3)
            for j in share[key(v)]:
                if np.dot(fn[j], fn[i]) >= cos_lim:
                    n += fn[j]
            n /= max(np.linalg.norm(n), 1e-9)
            if unlit:
                c = np.array(tints[i])
            else:
                ao = ao_floor + (1 - ao_floor) * min(1, max(0, (v[1] - lo) / (hi - lo)))
                under = 0.75 + 0.25 * min(1, max(0, n[1] + 1))
                c = np.array(base) * ao * under * np.array(tints[i])
                if moss_on and n[1] > 0.45:
                    k = min(1, (n[1] - 0.45) / 0.4) * 0.55
                    c = c * (1 - k) + np.array(moss) * ao * k
            pos.append(v); nor.append(n); col.append(c)
    pos, nor, col = np.array(pos, np.float32), np.array(nor, np.float32), np.clip(np.array(col, np.float32), 0, 2)
    # box-projected UVs: the stone keeps the same size everywhere (the model is shown 8x larger)
    uv = []
    for i, tri in enumerate(tris):
        ax = int(np.argmax(np.abs(fn[i])))
        a, b = [(1, 2), (0, 2), (0, 1)][ax]
        for v in tri:
            uv.append((v[a] * 0.7, v[b] * 0.7))
    return pos, nor, np.array(uv, np.float32), col


# ------------------------------------------------------------------ the painted stone (128 px, tiles)
def paint_stone(path, size=128):
    r = random.Random(11)
    img = Image.new('RGB', (size, size), (138, 146, 166))
    d = ImageDraw.Draw(img, 'RGBA')
    wrap = [(-size, 0), (size, 0), (0, -size), (0, size), (0, 0), (-size, -size), (size, size), (-size, size), (size, -size)]
    # broad blotches of lighter and darker stone
    for _ in range(70):
        x, y, rr = r.uniform(0, size), r.uniform(0, size), r.uniform(6, 22)
        c = r.choice([(176, 180, 196, 70), (100, 106, 128, 75), (152, 150, 136, 60), (128, 140, 122, 55)])
        for ox, oy in wrap:
            d.ellipse((x - rr + ox, y - rr * 0.7 + oy, x + rr + ox, y + rr * 0.7 + oy), fill=c)
    img = img.filter(ImageFilter.GaussianBlur(2))
    d = ImageDraw.Draw(img, 'RGBA')
    # block seams, as if the body were laid in courses of dressed stone
    for row in range(4):
        y = row * size // 4 + 2
        for ox, oy in wrap:
            d.line((0 + ox, y + oy, size + ox, y + oy), fill=(70, 74, 92, 150), width=1)
            d.line((0 + ox, y + 1 + oy, size + ox, y + 1 + oy), fill=(196, 200, 214, 70), width=1)
        off = (row % 2) * size // 4
        for k in range(2):
            x = off + k * size // 2
            for ox, oy in wrap:
                d.line((x + ox, y + oy, x + ox, y + size // 4 + oy), fill=(72, 76, 94, 140), width=1)
    # cracks: wandering dark lines with a lit edge
    for _ in range(9):
        x, y = r.uniform(0, size), r.uniform(0, size)
        a = r.uniform(0, math.tau)
        for _ in range(r.randint(8, 18)):
            a += r.uniform(-0.7, 0.7)
            nx, ny = x + math.cos(a) * 3, y + math.sin(a) * 3
            for ox, oy in wrap:
                d.line((x + ox, y + oy, nx + ox, ny + oy), fill=(52, 54, 68, 210), width=1)
                d.line((x + ox + 1, y + oy + 1, nx + ox + 1, ny + oy + 1), fill=(200, 204, 218, 90), width=1)
            x, y = nx, ny
    # chips and pits, and moss specks
    for _ in range(140):
        x, y = r.randrange(size), r.randrange(size)
        d.point((x, y), fill=r.choice([(214, 218, 228, 160), (60, 62, 76, 170), (96, 128, 84, 150)]))
    img.save(path)


# ------------------------------------------------------------------ a small glTF writer
def write_glb(path, parts, tex_path):
    bin_ = bytearray(); views, accs, meshes, nodes = [], [], [], []

    def push(arr, target=None):
        data = arr.tobytes()
        while len(bin_) % 4:
            bin_.append(0)
        views.append({'buffer': 0, 'byteOffset': len(bin_), 'byteLength': len(data), **({'target': target} if target else {})})
        bin_.extend(data)
        return len(views) - 1

    for name, (pos, nor, uv, col), mat in parts:
        prim = {'attributes': {}, 'material': mat}
        for key, arr, typ in [('POSITION', pos, 'VEC3'), ('NORMAL', nor, 'VEC3'), ('TEXCOORD_0', uv, 'VEC2'), ('COLOR_0', col, 'VEC3')]:
            acc = {'bufferView': push(arr, 34962), 'componentType': 5126, 'count': len(arr), 'type': typ}
            if key == 'POSITION':
                acc['min'] = pos.min(0).tolist(); acc['max'] = pos.max(0).tolist()
            accs.append(acc); prim['attributes'][key] = len(accs) - 1
        meshes.append({'name': name, 'primitives': [prim]})
        nodes.append({'name': name, 'mesh': len(meshes) - 1})
    png = open(tex_path, 'rb').read()
    img_view = push(np.frombuffer(png, np.uint8))
    gltf = {
        'asset': {'version': '2.0', 'generator': 'Moonmire tools/build-colossus.py'},
        'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': meshes,
        'materials': [
            {'name': 'stone', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 1}},
            {'name': 'glow', 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0}, 'emissiveFactor': [1, 0.75, 0.3]},
        ],
        'textures': [{'source': 0, 'sampler': 0}], 'images': [{'bufferView': img_view, 'mimeType': 'image/png'}],
        'samplers': [{'magFilter': 9728, 'minFilter': 9984, 'wrapS': 10497, 'wrapT': 10497}],
        'buffers': [{'byteLength': 0}], 'bufferViews': views, 'accessors': accs,
    }
    while len(bin_) % 4:
        bin_.append(0)
    gltf['buffers'][0]['byteLength'] = len(bin_)
    js = json.dumps(gltf, separators=(',', ':')).encode()
    while len(js) % 4:
        js += b' '
    with open(path, 'wb') as fh:
        fh.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_)))
        fh.write(struct.pack('<II', len(js), 0x4E4F534A)); fh.write(js)
        fh.write(struct.pack('<II', len(bin_), 0x004E4942)); fh.write(bin_)


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
    write_glb(OUT_GLB, parts, OUT_TEX)
    n = sum(len(p[1][0]) // 3 for p in parts)
    print(f'{OUT_GLB}: {n} triangles, {os.path.getsize(OUT_GLB) // 1024} KB')
