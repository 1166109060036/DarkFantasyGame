// Turns a textured kit of props (Sketchfab's "Fantasy Interior Items" by tediuminteractive,
// CC-BY-4.0) into the game's PS2-sized prop library: assets/props/interior.glb
//
//   node tools/import-props.mjs <fantasy_interior_items.glb> [notice_board_low-poly.glb]
//
// (the second is Sketchfab's "Notice board low-poly" by Viktor_, CC-BY-4.0: the bounty board,
// already in metres; it becomes the node "Notice Board" with its own 256 px texture)
//
// Every item becomes one node named as in the kit ("Barrel", "Table - Round", ...), scaled to
// metres (x3), standing on y = 0 and centred on x/z, with one mesh per material. The chest's lid
// is its own node ("Chest Lid", in the chest's space) so it can swing open. Heavy items are cut
// down to a PS2 budget with meshoptimizer's simplifier (attribute seams kept, so the UVs hold),
// and the 2K textures are shrunk to 128 px (python3 + Pillow).
//
// Needs (tool only, not the game): npm i meshoptimizer   and   pip install pillow
import { readGLB } from './glb.mjs';
import { writeFileSync, mkdirSync, readFileSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets/props/interior.glb');
const SCALE = 3;
const TEX = 128;
// triangle budgets (anything already under its budget is kept as it is)
const BUDGET = {
  Skull: 360, Goblet: 100, Bottle: 120, 'Bottle 2': 120, Bone: 140, Sword: 260, Knife: 60, Spoon: 60,
  'Candlestick Floor': 420, 'Candlestick Wall': 220, 'Candlestick Table': 160, Scroll: 160,
  Chair: 420, Stool: 300, 'Table - Round': 400, Barrel: 500, Chest: 600, Bucket: 260,
};

let MeshoptSimplifier;
try { ({ MeshoptSimplifier } = await import('meshoptimizer')); } catch {
  console.error('needs meshoptimizer:  npm i meshoptimizer'); process.exit(1);
}
await MeshoptSimplifier.ready;

const src = process.argv[2];
if (!src) { console.error('usage: node tools/import-props.mjs <fantasy_interior_items.glb>'); process.exit(1); }
const { json: j, meshes, image } = readGLB(src);
const parent = {};
j.nodes.forEach((n, i) => (n.children || []).forEach((c) => (parent[c] = i)));
const root = j.nodes.findIndex((n) => n.name === 'RootNode');
const nodeOf = (name) => j.nodes.findIndex((n) => n.name === name);
const topOf = (i) => { while (parent[i] !== root) i = parent[i]; return j.nodes[i].name; };
const under = (i, name) => { for (; i != null; i = parent[i]) if (j.nodes[i].name === name) return true; return false; };

// ---- gather each item's meshes, by material
const items = new Map();
for (const m of meshes) {
  const ni = nodeOf(m.name);
  let item = topOf(ni);
  if (item === 'Chest' && under(ni, 'Lid')) item = 'Chest Lid';
  const it = items.get(item) || items.set(item, { parts: [] }).get(item);
  it.parts.push(m);
}
// the chest's lid lives in the chest's space
const frame = (name) => {
  const ps = items.get(name === 'Chest Lid' ? 'Chest' : name).parts.concat(name === 'Chest' ? items.get('Chest Lid').parts : []);
  const min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (const m of ps) for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], m.positions[i + k]); max[k] = Math.max(max[k], m.positions[i + k]); }
  return [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2];
};

// ---- weld (position + uv), simplify, compact, smooth normals
function build(m, origin, budgetShare, scale = SCALE, matOff = 0) {
  const idx = m.indices ? Array.from(m.indices) : Array.from({ length: m.count }, (_, i) => i);
  const key = new Map(), pos = [], uv = [], remap = [];
  for (let v = 0; v < m.count; v++) {
    const p = [(m.positions[v * 3] - origin[0]) * scale, (m.positions[v * 3 + 1] - origin[1]) * scale, (m.positions[v * 3 + 2] - origin[2]) * scale];
    const t = m.uvs ? [m.uvs[v * 2], m.uvs[v * 2 + 1]] : [0, 0];
    const k = p.map((x) => x.toFixed(5)).join(',') + '|' + t.map((x) => x.toFixed(5)).join(',');
    let id = key.get(k);
    if (id == null) { id = pos.length / 3; key.set(k, id); pos.push(...p); uv.push(...t); }
    remap[v] = id;
  }
  let ind = new Uint32Array(idx.map((i) => remap[i]));
  const P = new Float32Array(pos);
  if (budgetShare && ind.length / 3 > budgetShare) {
    const [out] = MeshoptSimplifier.simplify(ind, P, 3, Math.max(3, Math.floor(budgetShare) * 3), 0.05, []);
    ind = out;
  }
  // drop unused vertices
  const used = new Map(), np = [], nu = [];
  const ni = Array.from(ind, (i) => {
    let n = used.get(i);
    if (n == null) { n = np.length / 3; used.set(i, n); np.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); nu.push(uv[i * 2], uv[i * 2 + 1]); }
    return n;
  });
  // normals smoothed across uv seams (by position)
  const byPos = new Map(), acc = [];
  const pk = (i) => `${np[i * 3].toFixed(4)},${np[i * 3 + 1].toFixed(4)},${np[i * 3 + 2].toFixed(4)}`;
  for (let i = 0; i < np.length / 3; i++) { const k = pk(i); if (!byPos.has(k)) { byPos.set(k, acc.length); acc.push([0, 0, 0]); } }
  for (let t = 0; t < ni.length; t += 3) {
    const [a, b, c] = [ni[t], ni[t + 1], ni[t + 2]];
    const e1 = [0, 1, 2].map((k) => np[b * 3 + k] - np[a * 3 + k]), e2 = [0, 1, 2].map((k) => np[c * 3 + k] - np[a * 3 + k]);
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const v of [a, b, c]) { const s = acc[byPos.get(pk(v))]; s[0] += n[0]; s[1] += n[1]; s[2] += n[2]; }
  }
  const nn = [];
  for (let i = 0; i < np.length / 3; i++) { const s = acc[byPos.get(pk(i))], l = Math.hypot(...s) || 1; nn.push(s[0] / l, s[1] / l, s[2] / l); }
  return { pos: new Float32Array(np), nrm: new Float32Array(nn), uv: new Float32Array(nu), idx: np.length / 3 > 65535 ? new Uint32Array(ni) : new Uint16Array(ni), mat: m.material + matOff };
}

const outItems = [];
let before = 0, after = 0;
for (const [name, it] of items) {
  const origin = frame(name);
  const total = it.parts.reduce((s, m) => s + (m.indices ? m.indices.length : m.count) / 3, 0);
  const budget = BUDGET[name];
  const prims = it.parts.map((m) => build(m, origin, budget && total > budget ? budget * ((m.indices ? m.indices.length : m.count) / 3) / total : 0));
  const n = prims.reduce((s, p) => s + p.idx.length / 3, 0);
  before += total; after += n;
  outItems.push({ name, prims });
  console.log(`${name.padEnd(20)} ${String(total).padStart(5)} -> ${n}`);
}
console.log(`total ${before} -> ${after} triangles`);

// ---- the notice board, from its own file
const board = process.argv[3] ? readGLB(process.argv[3]) : null;
if (board) {
  const min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (const m of board.meshes) for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], m.positions[i + k]); max[k] = Math.max(max[k], m.positions[i + k]); }
  const origin = [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2];
  const prims = board.meshes.map((m) => build({ ...m, material: 0 }, origin, 0, 1, j.materials.length));
  outItems.push({ name: 'Notice Board', prims });
  console.log(`Notice Board ${prims.reduce((s, p) => s + p.idx.length / 3, 0)} triangles, ${(max[0] - min[0]).toFixed(2)} x ${(max[1] - min[1]).toFixed(2)} x ${(max[2] - min[2]).toFixed(2)} m`);
}

// ---- textures: shrunk to TEX px
const tmp = join(tmpdir(), 'props-' + process.pid);
mkdirSync(tmp, { recursive: true });
const texIdx = j.materials.map((m) => m.pbrMetallicRoughness?.baseColorTexture?.index);
const pngs = j.materials.map((m, i) => {
  const img = image(j.textures[texIdx[i]].source);
  const a = join(tmp, `in${i}.png`), b = join(tmp, `out${i}.png`);
  writeFileSync(a, img.bytes);
  execFileSync('python3', ['-c', `from PIL import Image;import sys;Image.open(sys.argv[1]).convert('RGB').resize((${TEX},${TEX}),Image.LANCZOS).save(sys.argv[2],optimize=True)`, a, b]);
  return readFileSync(b);
});
if (board) {
  const bm = board.json.materials[0], img = board.image(board.json.textures[bm.pbrMetallicRoughness.baseColorTexture.index].source);
  const a = join(tmp, 'board.png'), o = join(tmp, 'board_out.png');
  writeFileSync(a, img.bytes);
  execFileSync('python3', ['-c', `from PIL import Image;import sys;Image.open(sys.argv[1]).convert('RGB').resize((256,256),Image.LANCZOS).save(sys.argv[2],optimize=True)`, a, o]);
  pngs.push(readFileSync(o));
}
rmSync(tmp, { recursive: true });

// ---- write the .glb
const chunks = [], views = [], accessors = [];
let off = 0;
const pushView = (buf, target) => {
  const pad = (4 - (buf.byteLength % 4)) % 4;
  views.push({ buffer: 0, byteOffset: off, byteLength: buf.byteLength, ...(target ? { target } : {}) });
  chunks.push(Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength), Buffer.alloc(pad));
  off += buf.byteLength + pad;
  return views.length - 1;
};
const acc = (arr, type, comp, target, minmax) => {
  const view = pushView(arr, target);
  const n = { VEC3: 3, VEC2: 2, SCALAR: 1 }[type];
  const a = { bufferView: view, componentType: comp, count: arr.length / n, type };
  if (minmax) {
    a.min = [0, 1, 2].map((k) => Math.min(...arr.filter((_, i) => i % 3 === k)));
    a.max = [0, 1, 2].map((k) => Math.max(...arr.filter((_, i) => i % 3 === k)));
  }
  accessors.push(a);
  return accessors.length - 1;
};
const images = pngs.map((b) => ({ bufferView: pushView(new Uint8Array(b)), mimeType: 'image/png' }));
const materials = [...j.materials.map((m) => m.name), ...(board ? ['Notice_Board'] : [])].map((name, i) => ({ name, pbrMetallicRoughness: { baseColorTexture: { index: i }, metallicFactor: 0, roughnessFactor: 1 } }));
const textures = images.map((_, i) => ({ source: i, sampler: 0 }));
const meshesOut = [], nodes = [];
for (const it of outItems) {
  const prims = it.prims.map((p) => ({
    attributes: { POSITION: acc(p.pos, 'VEC3', 5126, 34962, true), NORMAL: acc(p.nrm, 'VEC3', 5126, 34962), TEXCOORD_0: acc(p.uv, 'VEC2', 5126, 34962) },
    indices: acc(p.idx, 'SCALAR', p.idx instanceof Uint32Array ? 5125 : 5123, 34963), material: p.mat,
  }));
  meshesOut.push({ name: it.name, primitives: prims });
  nodes.push({ name: it.name, mesh: meshesOut.length - 1 });
}
const gltf = {
  asset: { version: '2.0', generator: 'tools/import-props.mjs', extras: { sources: [j.asset?.extras, board?.json.asset?.extras].filter(Boolean) } },
  scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes: meshesOut, materials, textures, images,
  samplers: [{ magFilter: 9728, minFilter: 9987 }], accessors, bufferViews: views, buffers: [{ byteLength: off }],
};
let js = Buffer.from(JSON.stringify(gltf));
js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
const bin = Buffer.concat(chunks);
const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, Buffer.concat([head, jh, js, bh, bin]));
console.log(`${OUT}: ${(Buffer.concat([head, jh, js, bh, bin]).length / 1024).toFixed(0)} KB`);
