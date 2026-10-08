// Turn an AI-generated hero mesh (.glb with bare geometry: no colours, UVs or skeleton) into a
// game-ready PS2-style asset:
//   1. centre it on the head, stand it on the ground, scale it to the hero's height
//   2. simplify it by vertex clustering to a PS2 polygon budget (faceted, like the rest of the game)
//   3. paint each triangle by body region (team cloth, leather, skin, boots, steel ...)
//   4. bind each triangle to one bone of a skeleton fitted to the model, so the game's
//      walk / swing / guard animations drive it
// and write assets/heroes/<kind>.json, which src/heroes.js loads.
//
//   node tools/import-hero.mjs wanderer path/to/model.glb
//
// A model that already has UVs and a texture (a 'textured' profile) keeps them instead: no
// simplifying or painting, its texture is written next to the JSON, and only the binding is done.
// Such a profile can also re-pose the arms (an A-pose brought down to hanging) before binding.
import { writeFileSync, mkdirSync } from 'fs';
import { readGLB } from './glb.mjs';

const [kind, src, targetArg] = process.argv.slice(2);
const PROFILES = {
  // regions are tested in order; first match wins. p = triangle centre (x right-of-viewer = the
  // hero's left, y up from the soles, z forward), n = face normal
  wanderer: {
    height: 1.85,
    bones: {
      hips: [0, 0.98, 0], spine: [0, 1.14, 0], chest: [0, 1.36, 0], neck: [0, 1.55, 0], head: [0, 1.65, 0],
      shL: [0.19, 1.44, 0], elL: [0.29, 1.15, 0], haL: [0.33, 0.88, 0.04],
      shR: [-0.19, 1.44, 0], elR: [-0.29, 1.15, -0.03], haR: [-0.37, 0.88, 0.05],
      hiL: [0.12, 0.94, 0], knL: [0.2, 0.52, 0], anL: [0.22, 0.1, -0.03],
      hiR: [-0.12, 0.94, 0], knR: [-0.2, 0.52, 0], anR: [-0.2, 0.1, -0.04],
    },
    regions: [
      // the longsword (forward of the body below the chest) and its hilt in the right hand
      { name: 'blade', test: (p) => p.z > 0.16 && p.y < 1.0 && p.y > 0.15, grp: 'metal', col: [0.74, 0.77, 0.82], bone: 'haR' },
      { name: 'hilt', test: (p) => p.z > 0.04 && p.y < 0.98 && p.y > 0.66 && p.x < -0.26, grp: 'plain', col: [0.32, 0.22, 0.15], bone: 'haR' },
      // the face in the shadow of the hood
      { name: 'face', test: (p, n) => p.y > 1.52 && p.y < 1.76 && p.z > 0.05 && Math.abs(p.x) < 0.09 && n.z > 0.2, grp: 'plain', col: [0.5, 0.38, 0.3], bone: 'head' },
      { name: 'hood', test: (p) => p.y > 1.5, grp: 'team', col: [0.9, 0.9, 0.9], follow: ['head', 'neck', 'chest'] },
      // the cloak hangs behind; the capelet covers the shoulders
      { name: 'cloak', test: (p) => p.z < -0.13 && p.y > 0.3, grp: 'team', col: [0.82, 0.82, 0.82], follow: ['chest', 'spine', 'hips', 'hiL', 'hiR'] },
      { name: 'capelet', test: (p) => p.y > 1.32 && (p.z < 0.02 || Math.abs(p.x) > 0.13) && Math.abs(p.x) < 0.3 && Math.hypot(p.x * 0.8, p.z) > 0.15, grp: 'team', col: [0.88, 0.88, 0.88], follow: ['chest', 'neck', 'spine'] },
      // hands, wrapped forearms (a team band on the left)
      { name: 'hands', test: (p) => p.y < 0.98 && p.y > 0.72 && Math.abs(p.x) > 0.27, grp: 'plain', col: [0.66, 0.5, 0.4] },
      { name: 'bandL', test: (p) => p.x > 0.22 && p.y > 1.0 && p.y < 1.12, grp: 'team', col: [0.95, 0.95, 0.95] },
      { name: 'wraps', test: (p) => Math.abs(p.x) > 0.22 && p.y > 0.95 && p.y < 1.15, grp: 'plain', col: [0.72, 0.69, 0.64] },
      { name: 'sleeves', test: (p) => Math.abs(p.x) > 0.19 && p.y > 1.12, grp: 'plain', col: [0.17, 0.16, 0.16] },
      // belt, pouch, jerkin
      { name: 'belt', test: (p) => p.y > 0.9 && p.y < 1.02, grp: 'plain', col: [0.2, 0.13, 0.09] },
      { name: 'jerkin', test: (p) => p.y >= 1.02, grp: 'plain', col: [0.38, 0.25, 0.16] },
      // boots to the calf, dark trousers above
      { name: 'boots', test: (p) => p.y < 0.42, grp: 'plain', col: [0.33, 0.21, 0.13] },
      { name: 'trousers', test: () => true, grp: 'plain', col: [0.21, 0.17, 0.14] },
    ],
    // the moon-lantern the model doesn't have is added in-game (src/heroes.js)
  },
  // "Low Poly Micolash" by ratmeaty (CC BY 4.0): a long dark coat and a cage over the head, already
  // textured. Bones are given in the model's own units (it is 2.25 tall, cage and candles included).
  coffin: {
    textured: true, raw: true, alphaTest: 0.65,
    // its arms are spread in an A-pose: swing them down to hang ~10° from the body
    arms: { pivot: [0.17, 1.46, -0.06], angle: 0.586, from: 0.19, to: 0.31, minY: 0.84 },
    bones: {
      hips: [0, 0.98, -0.04], spine: [0, 1.15, -0.05], chest: [0, 1.35, -0.05], neck: [0, 1.55, -0.05], head: [0, 1.66, -0.05],
      shL: [0.19, 1.44, -0.06], elL: [0.25, 1.06, -0.08], haL: [0.3, 0.84, -0.08],
      shR: [-0.19, 1.44, -0.06], elR: [-0.25, 1.06, -0.08], haR: [-0.3, 0.84, -0.08],
      hiL: [0.08, 0.95, -0.03], knL: [0.08, 0.5, -0.02], anL: [0.08, 0.1, -0.05],
      hiR: [-0.08, 0.95, -0.03], knR: [-0.08, 0.5, -0.02], anR: [-0.08, 0.1, -0.05],
    },
    // the cage, its candles and the head ride on the head; everything else follows its nearest bones
    regions: [
      { name: 'cage', mesh: /^(mensiscage|Plane|Cylinder|head)/, grp: 'tex', bone: 'head' },
      { name: 'coat', test: (p) => p.y < 1.0 && p.y > 0.3 && (Math.abs(p.x) > 0.13 || p.z < -0.1), grp: 'tex', follow: ['hips', 'hiL', 'hiR', 'spine'] },
      { name: 'body', test: () => true, grp: 'tex' },
    ],
  },
};

const prof = PROFILES[kind];
if (!prof || !src) { console.error('usage: node tools/import-hero.mjs <kind> <model.glb> [triangles]'); process.exit(1); }
const target = +(targetArg || 3600);
if (prof.textured) { importTextured(); process.exit(0); }

// ---------------------------------------------------------------- 1. load, centre, scale
const { meshes } = readGLB(src);
let pos = [], idx = [];
for (const m of meshes) {
  const base = pos.length / 3;
  pos.push(...m.positions);
  const ix = m.indices || Array.from({ length: m.count }, (_, i) => i);
  for (const i of ix) idx.push(i + base);
}
let minY = Infinity, maxY = -Infinity;
for (let i = 1; i < pos.length; i += 3) { minY = Math.min(minY, pos[i]); maxY = Math.max(maxY, pos[i]); }
const s = prof.height / (maxY - minY);
let hx = 0, hz = 0, hn = 0;
for (let i = 0; i < pos.length; i += 3) if ((pos[i + 1] - minY) * s > prof.height - 0.23) { hx += pos[i]; hz += pos[i + 2]; hn++; }
hx /= hn; hz /= hn;
for (let i = 0; i < pos.length; i += 3) { pos[i] = (pos[i] - hx) * s; pos[i + 1] = (pos[i + 1] - minY) * s; pos[i + 2] = (pos[i + 2] - hz) * s; }

// ---------------------------------------------------------------- 2. simplify (vertex clustering)
function cluster(cell) {
  const map = new Map(), sums = [], remap = new Int32Array(pos.length / 3);
  for (let v = 0; v < pos.length / 3; v++) {
    const k = `${Math.floor(pos[v * 3] / cell)},${Math.floor(pos[v * 3 + 1] / cell)},${Math.floor(pos[v * 3 + 2] / cell)}`;
    let id = map.get(k);
    if (id == null) { id = sums.length; map.set(k, id); sums.push([0, 0, 0, 0]); }
    const a = sums[id];
    a[0] += pos[v * 3]; a[1] += pos[v * 3 + 1]; a[2] += pos[v * 3 + 2]; a[3]++;
    remap[v] = id;
  }
  const verts = sums.map(([x, y, z, n]) => [x / n, y / n, z / n]);
  const seen = new Set(), tris = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = remap[idx[t]], b = remap[idx[t + 1]], c = remap[idx[t + 2]];
    if (a === b || b === c || a === c) continue;
    const key = [a, b, c].sort((p, q) => p - q).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    tris.push([a, b, c]);
  }
  return { verts, tris };
}
let lo = 0.002, hi = 0.2, best = null;
for (let it = 0; it < 22; it++) {
  const mid = Math.sqrt(lo * hi), r = cluster(mid);
  if (!best || Math.abs(r.tris.length - target) < Math.abs(best.r.tris.length - target)) best = { r, cell: mid };
  if (r.tris.length > target) lo = mid; else hi = mid;
}
const { verts, tris } = best.r;
console.log(`${idx.length / 3} → ${tris.length} triangles (cell ${(best.cell * 100).toFixed(1)} cm)`);

// ---------------------------------------------------------------- 3 + 4. paint and bind
const B = prof.bones;
const parent = { spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', shL: 'chest', elL: 'shL', haL: 'elL', shR: 'chest', elR: 'shR', haR: 'elR', hiL: 'hips', knL: 'hiL', anL: 'knL', hiR: 'hips', knR: 'hiR', anR: 'knR' };
const segs = Object.entries(parent).map(([child, par]) => ({ bone: par, a: B[par], b: B[child] }));
segs.push({ bone: 'haL', a: B.haL, b: [B.haL[0], B.haL[1] - 0.12, B.haL[2]] }, { bone: 'haR', a: B.haR, b: [B.haR[0], B.haR[1] - 0.12, B.haR[2]] });
segs.push({ bone: 'anL', a: B.anL, b: [B.anL[0], 0, B.anL[2] + 0.12] }, { bone: 'anR', a: B.anR, b: [B.anR[0], 0, B.anR[2] + 0.12] });
segs.push({ bone: 'head', a: B.head, b: [0, prof.height, 0] });
const distSeg = (p, a, b) => {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [p.x - a[0], p.y - a[1], p.z - a[2]];
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1)));
  return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t);
};
const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'shL', 'elL', 'haL', 'shR', 'elR', 'haR', 'hiL', 'knL', 'anL', 'hiR', 'knR', 'anR'];
const GROUPS = ['plain', 'team', 'metal', 'glow'];
const out = { pos: new Float32Array(tris.length * 9), col: new Uint8Array(tris.length * 3), grp: new Uint8Array(tris.length), bone: new Uint8Array(tris.length), skin: new Uint8Array(tris.length * 9) };
// joints that may blend with each other
const linked = (a, b) => parent[a] === b || parent[b] === a;
// each corner follows its two nearest bones, blended across the joint, so limbs bend instead of tearing
function cornerSkin(v, forced, follow = null) {
  const p = { x: v[0], y: v[1], z: v[2] };
  if (forced) return [BONES.indexOf(forced), BONES.indexOf(forced), 0];
  const ds = segs.filter((sg) => !follow || follow.includes(sg.bone)).map((sg) => [sg.bone, distSeg(p, sg.a, sg.b)]).sort((x, y) => x[1] - y[1]);
  const b1 = ds[0][0], next = ds.find(([b]) => b !== b1 && linked(b, b1));
  if (!next) return [BONES.indexOf(b1), BONES.indexOf(b1), 0];
  const w2 = Math.max(0, Math.min(0.5, 0.5 - (next[1] - ds[0][1]) / 0.1));
  return [BONES.indexOf(b1), BONES.indexOf(next[0]), Math.round(w2 * 255)];
}
const hash = (x) => { const v = Math.sin(x * 127.1) * 43758.5453; return v - Math.floor(v); };
const counts = {};
tris.forEach((t, i) => {
  const [a, b, c] = t.map((k) => verts[k]);
  const p = { x: (a[0] + b[0] + c[0]) / 3, y: (a[1] + b[1] + c[1]) / 3, z: (a[2] + b[2] + c[2]) / 3 };
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const nx = u[1] * w[2] - u[2] * w[1], ny = u[2] * w[0] - u[0] * w[2], nz = u[0] * w[1] - u[1] * w[0], nl = Math.hypot(nx, ny, nz) || 1;
  const n = { x: nx / nl, y: ny / nl, z: nz / nl };
  const reg = prof.regions.find((r) => r.test(p, n));
  counts[reg.name] = (counts[reg.name] || 0) + 1;
  let bone = typeof reg.bone === 'function' ? reg.bone(p) : reg.bone;
  if (!bone) { let bd = Infinity; for (const sg of segs) { if (reg.follow && !reg.follow.includes(sg.bone)) continue; const d = distSeg(p, sg.a, sg.b); if (d < bd) { bd = d; bone = sg.bone; } } }
  // hand-painted variation: a little light from above, a little grime toward the feet
  const shade = (0.88 + hash(i) * 0.16) * (0.9 + Math.max(0, n.y) * 0.15) * (0.82 + Math.min(1, p.y / prof.height) * 0.2);
  out.col.set(reg.col.map((v) => Math.round(Math.min(1, v * shade) * 255)), i * 3);
  out.pos.set([...a, ...b, ...c], i * 9);
  out.grp[i] = GROUPS.indexOf(reg.grp);
  out.bone[i] = BONES.indexOf(bone);
  const forced = reg.bone ? bone : null;
  [a, b, c].forEach((v, k) => out.skin.set(cornerSkin(v, forced, reg.follow), i * 9 + k * 3));
});
console.log('regions', counts);
const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
mkdirSync('assets/heroes', { recursive: true });
const file = `assets/heroes/${kind}.json`;
writeFileSync(file, JSON.stringify({
  kind, version: 2, height: prof.height, tris: tris.length, bones: B, boneOrder: BONES, groups: GROUPS,
  pos: b64(out.pos), col: b64(out.col), grp: b64(out.grp), bone: b64(out.bone), skin: b64(out.skin),
}));
console.log('wrote', file);

// ---------------------------------------------------------------- textured models
function importTextured() {
  const glb = readGLB(src);
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // gather triangles with their UVs and source mesh
  const T = [];
  for (const m of glb.meshes) {
    const ix = m.indices || Array.from({ length: m.count }, (_, i) => i);
    for (let t = 0; t < ix.length; t += 3) {
      const v = [ix[t], ix[t + 1], ix[t + 2]].map((k) => ({
        p: [m.positions[k * 3], m.positions[k * 3 + 1], m.positions[k * 3 + 2]],
        uv: m.uvs ? [m.uvs[k * 2], m.uvs[k * 2 + 1]] : [0, 0],
      }));
      T.push({ v, mesh: m.name });
    }
  }
  // arms down out of the A-pose: rotate about the shoulder, blended in across the armpit
  if (prof.arms) {
    const A = prof.arms;
    for (const tri of T) {
      if (/^(mensiscage|Plane|Cylinder|head)/.test(tri.mesh)) continue;
      for (const c of tri.v) {
        const [x, y, z] = c.p, side = Math.sign(x);
        if (y < A.minY) continue;
        const w = smooth(A.from, A.to, Math.abs(x));
        if (!w) continue;
        const px = side * A.pivot[0], py = A.pivot[1], phi = -side * A.angle * w;
        const dx = x - px, dy = y - py, cs = Math.cos(phi), sn = Math.sin(phi);
        c.p = [px + dx * cs - dy * sn, py + dx * sn + dy * cs, z];
      }
    }
  }
  // stand it on the ground, centred under its head
  let minY = Infinity, maxY = -Infinity;
  for (const tri of T) for (const c of tri.v) { minY = Math.min(minY, c.p[1]); maxY = Math.max(maxY, c.p[1]); }
  const height = maxY - minY;
  let hx = 0, hz = 0, hn = 0;
  for (const tri of T) for (const c of tri.v) if (c.p[1] - minY > height - 0.23) { hx += c.p[0]; hz += c.p[2]; hn++; }
  hx /= hn; hz /= hn;
  for (const tri of T) for (const c of tri.v) c.p = [c.p[0] - hx, c.p[1] - minY, c.p[2] - hz];
  const B = {};
  for (const [k, [x, y, z]] of Object.entries(prof.bones)) B[k] = [x - hx, y - minY, z - hz];
  console.log(`${T.length} triangles, ${height.toFixed(2)} tall, head at ${hx.toFixed(3)},${hz.toFixed(3)}`);

  const parent = { spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', shL: 'chest', elL: 'shL', haL: 'elL', shR: 'chest', elR: 'shR', haR: 'elR', hiL: 'hips', knL: 'hiL', anL: 'knL', hiR: 'hips', knR: 'hiR', anR: 'knR' };
  const segs = Object.entries(parent).map(([child, par]) => ({ bone: par, a: B[par], b: B[child] }));
  segs.push({ bone: 'haL', a: B.haL, b: [B.haL[0], B.haL[1] - 0.14, B.haL[2]] }, { bone: 'haR', a: B.haR, b: [B.haR[0], B.haR[1] - 0.14, B.haR[2]] });
  segs.push({ bone: 'anL', a: B.anL, b: [B.anL[0], 0, B.anL[2] + 0.14] }, { bone: 'anR', a: B.anR, b: [B.anR[0], 0, B.anR[2] + 0.14] });
  segs.push({ bone: 'head', a: B.head, b: [B.head[0], height, B.head[2]] });
  const distSeg = (p, a, b) => {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
    const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1)));
    return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t);
  };
  const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'shL', 'elL', 'haL', 'shR', 'elR', 'haR', 'hiL', 'knL', 'anL', 'hiR', 'knR', 'anR'];
  const GROUPS = ['plain', 'team', 'metal', 'glow', 'tex'];
  const linked = (a, b) => parent[a] === b || parent[b] === a;
  const skinOf = (p, forced, follow) => {
    if (forced) return [BONES.indexOf(forced), BONES.indexOf(forced), 0];
    const ds = segs.filter((sg) => !follow || follow.includes(sg.bone)).map((sg) => [sg.bone, distSeg(p, sg.a, sg.b)]).sort((x, y) => x[1] - y[1]);
    const b1 = ds[0][0], next = ds.find(([b]) => b !== b1 && linked(b, b1));
    if (!next) return [BONES.indexOf(b1), BONES.indexOf(b1), 0];
    const w2 = Math.max(0, Math.min(0.5, 0.5 - (next[1] - ds[0][1]) / 0.1));
    return [BONES.indexOf(b1), BONES.indexOf(next[0]), Math.round(w2 * 255)];
  };
  const n = T.length;
  const out = { pos: new Float32Array(n * 9), uv: new Float32Array(n * 6), col: new Uint8Array(n * 3).fill(255), grp: new Uint8Array(n), bone: new Uint8Array(n), skin: new Uint8Array(n * 9) };
  const counts = {};
  T.forEach((tri, i) => {
    const c = [0, 1, 2].map((k) => (tri.v[0].p[k] + tri.v[1].p[k] + tri.v[2].p[k]) / 3);
    const p = { x: c[0], y: c[1], z: c[2] };
    const reg = prof.regions.find((r) => (r.mesh ? r.mesh.test(tri.mesh) : r.test(p)));
    counts[reg.name] = (counts[reg.name] || 0) + 1;
    out.grp[i] = GROUPS.indexOf(reg.grp);
    out.bone[i] = BONES.indexOf(reg.bone || 'hips');
    tri.v.forEach((v, k) => {
      out.pos.set(v.p, i * 9 + k * 3);
      out.uv.set(v.uv, i * 6 + k * 2);
      out.skin.set(skinOf(v.p, reg.bone, reg.follow), i * 9 + k * 3);
    });
  });
  console.log('regions', counts);
  // the texture: the material's base colour image
  const mat = glb.json.materials?.[0], ti = mat?.pbrMetallicRoughness?.baseColorTexture?.index;
  const img = ti != null ? glb.image(glb.json.textures[ti].source) : null;
  mkdirSync('assets/heroes', { recursive: true });
  const tex = `${kind}.png`;
  if (img) writeFileSync(`assets/heroes/${tex}`, img.bytes);
  const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
  const file = `assets/heroes/${kind}.json`;
  writeFileSync(file, JSON.stringify({
    kind, version: 3, height, tris: n, bones: B, boneOrder: BONES, groups: GROUPS, tex: img ? tex : null, alphaTest: prof.alphaTest || 0,
    pos: b64(out.pos), uv: b64(out.uv), col: b64(out.col), grp: b64(out.grp), bone: b64(out.bone), skin: b64(out.skin),
  }));
  console.log('wrote', file, img ? `and assets/heroes/${tex}` : '(no texture)');
}
