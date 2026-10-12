"""Shared pieces for Moonmire's PS2-style models (tools/build-*.py).

The look: a few hundred faceted faces per part with chunky readable silhouettes, one small
hand-painted texture, and the shading painted into vertex colours the way games of that era lit
their models. Geometry is built from primitives (lathes, boxes, lumpy rocks, cones), placed with
transform(), shaded with shade() and written with write_glb() (positions, normals, UVs, colours).
"""
import json, math, random, struct
import numpy as np
from PIL import Image, ImageDraw, ImageFilter


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


def shade(part, lo, hi, base=(0.86, 0.9, 1.0), moss=(0.62, 0.78, 0.52), ao_floor=0.55, moss_on=True, unlit=False, crease=50, uv_scale=0.7):
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
            uv.append((v[a] * uv_scale, v[b] * uv_scale))
    return pos, nor, np.array(uv, np.float32), col


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


def write_glb(path, parts, materials, textures):
    """parts: [(name, (pos, nor, uv, col), material index)]; materials: glTF material dicts that may
    name a texture as {'tex': i}; textures: png paths (sampled nearest, repeating)"""
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
    images = [{'bufferView': push(np.frombuffer(open(t, 'rb').read(), np.uint8)), 'mimeType': 'image/png'} for t in textures]
    mats = []
    for m in materials:
        m = dict(m); pbr = {'metallicFactor': 0, 'roughnessFactor': 1}
        if 'tex' in m:
            pbr['baseColorTexture'] = {'index': m.pop('tex')}
        mats.append({**m, 'pbrMetallicRoughness': pbr})
    gltf = {
        'asset': {'version': '2.0', 'generator': 'Moonmire tools/ps2model.py'},
        'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': meshes, 'materials': mats,
        'buffers': [{'byteLength': 0}], 'bufferViews': views, 'accessors': accs,
    }
    if textures:
        gltf['textures'] = [{'source': i, 'sampler': 0} for i in range(len(textures))]
        gltf['images'] = images
        gltf['samplers'] = [{'magFilter': 9728, 'minFilter': 9984, 'wrapS': 10497, 'wrapT': 10497}]
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
