// Hand-built landmarks. Static pieces are merged per material into a handful of draw calls.
import * as THREE from 'three';
import { rng } from './noise.js';
import { part, mergeGeometries, boxGeom, polylineXAtZ, wrapAngle, distToPolyline } from './util.js';
import { PASTURE, FENCE_R, TOAD, TEMPLE, RIVER, PATHS, CANYON_ARCH_Z, CANYON_STEPS_Z } from './layout.js';

class StaticBuilder {
  constructor() { this.parts = {}; }
  add(mat, geom) { (this.parts[mat] ||= []).push(geom); }
  build(scene, M) {
    for (const [k, list] of Object.entries(this.parts)) {
      const mesh = new THREE.Mesh(mergeGeometries(list), M[k]);
      mesh.name = 'static-' + k;
      scene.add(mesh);
    }
  }
}

const r = rng(777);
const stoneTint = () => new THREE.Color().setRGB(0.8 + r() * 0.35, 0.85 + r() * 0.3, 0.85 + r() * 0.3);

function block(B, C, mat, { x, y, z, w, h, d, ry = 0, rx = 0, rz = 0, color, collide = true, tex = 2 }) {
  B.add(mat, part(boxGeom(w, h, d, tex), color ?? stoneTint(), { pos: [x, y, z], rot: [rx, ry, rz] }));
  if (collide) C.addBox(x, y, z, w / 2, h / 2, d / 2, ry);
}

// Box resting on the ground with its top at `top` (bottom sunk to `bottom`).
function slab(B, C, mat, x, z, w, d, bottom, top, opts = {}) {
  block(B, C, mat, { x, y: (bottom + top) / 2, z, w, h: top - bottom, d, ...opts });
}

function hangingMoss(B, x, y, z, w, h, ry) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  B.add('hangingMoss', part(g, 0xd0e0d0, { pos: [x, y - h / 2, z], rot: [0, ry, 0] }));
}

function buildRailway(B, C, terrain) {
  const { curve, pts, ys } = terrain.rail;
  const n = pts.length;
  for (let k = 0; k < n; k++) {
    const t = Math.min(1, k / (n - 1));
    const tan = curve.getTangentAt(t);
    const ry = Math.atan2(tan.x, tan.z);
    if (r() > 0.07) {
      B.add('wood', part(boxGeom(2.5, 0.16, 0.34, 1.5), new THREE.Color().setRGB(0.7 + r() * 0.4, 0.8 + r() * 0.3, 0.7 + r() * 0.3), {
        pos: [pts[k].x + (r() - 0.5) * 0.1, ys[k] + (r() - 0.5) * 0.06, pts[k].z], rot: [(r() - 0.5) * 0.05, ry + (r() - 0.5) * 0.12, (r() - 0.5) * 0.06],
      }));
    }
    if (k < n - 1) {
      const a = pts[k], b = pts[k + 1];
      const len = a.distanceTo(b) + 0.02;
      const sy = Math.atan2(b.x - a.x, b.z - a.z);
      const pitch = -Math.atan2(ys[k + 1] - ys[k], len);
      const cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2, cy = (ys[k] + ys[k + 1]) / 2 + 0.15;
      for (const side of [-0.72, 0.72]) {
        const ox = Math.cos(sy) * side, oz = -Math.sin(sy) * side;
        B.add('metal', part(boxGeom(0.09, 0.13, len, 1), 0xffffff, { pos: [cx + ox, cy, cz + oz], rot: [pitch, sy, 0] }));
      }
    }
  }
  // station platform + collapsed shelter + buffer stop at the northern end
  const end = pts[n - 1], prev = pts[n - 8];
  const dir = new THREE.Vector3().subVectors(end, prev).normalize();
  const ry = Math.atan2(dir.x, dir.z);
  const side = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
  const g = terrain.getHeight(end.x, end.z);
  const pc = end.clone().addScaledVector(dir, -9).addScaledVector(side, 3.3);
  const pg = terrain.getHeight(pc.x, pc.z);
  slab(B, C, 'stone', pc.x, pc.z, 3, 16, pg - 1, ys[n - 1] + 0.75, { ry });
  for (const [fx, fz] of [[-1, -6], [1, -6], [-1, 2], [1, 2]]) {
    const p = pc.clone().addScaledVector(side, fx * 1.1).addScaledVector(dir, fz);
    block(B, C, 'wood', { x: p.x, y: ys[n - 1] + 0.75 + 1.4, z: p.z, w: 0.22, h: 2.8, d: 0.22, ry, rz: fz > 0 ? 0.1 : 0 });
  }
  const roof = pc.clone().addScaledVector(dir, -2);
  block(B, C, 'wood', { x: roof.x, y: ys[n - 1] + 3.8, z: roof.z, w: 3.2, h: 0.15, d: 10, ry, rx: 0.12, rz: 0.18, collide: false });
  const bs = end.clone().addScaledVector(dir, 1.0);
  block(B, C, 'wood', { x: bs.x, y: g + 0.6, z: bs.z, w: 2.4, h: 0.5, d: 0.5, ry });
  block(B, C, 'wood', { x: bs.x, y: g + 0.3, z: bs.z - 0.2, w: 0.3, h: 0.9, d: 0.3, ry, collide: false });
}

function buildFence(B, C, terrain) {
  const R = FENCE_R, P = PASTURE;
  const posts = [];
  const step = 2.7 / R;
  for (let a = 0; a < Math.PI * 2 - step * 0.5; a += step) {
    if (Math.abs(wrapAngle(a - Math.PI)) < 0.075) { posts.push(null); continue; }
    const x = P.x + Math.cos(a) * R, z = P.z + Math.sin(a) * R;
    posts.push({ x, z, g: terrain.getHeight(x, z) });
  }
  posts.forEach((p, i) => {
    if (!p) return;
    const tint = new THREE.Color().setRGB(0.75 + r() * 0.3, 0.8 + r() * 0.3, 0.85 + r() * 0.3);
    B.add('wood', part(boxGeom(0.16, 1.5, 0.16, 1), tint, { pos: [p.x, p.g + 0.6, p.z], rot: [(r() - 0.5) * 0.15, r() * 3, (r() - 0.5) * 0.15] }));
    const q = posts[(i + 1) % posts.length];
    if (!q) return;
    const len = Math.hypot(q.x - p.x, q.z - p.z);
    const ry = Math.atan2(q.x - p.x, q.z - p.z);
    const cx = (p.x + q.x) / 2, cz = (p.z + q.z) / 2, cg = (p.g + q.g) / 2;
    const pitch = -Math.atan2(q.g - p.g, len);
    for (const hgt of [0.55, 1.05]) {
      if (r() < 0.12) continue; // broken rails
      B.add('wood', part(boxGeom(0.06, 0.14, len + 0.3, 1), tint, { pos: [cx, cg + hgt + (r() - 0.5) * 0.08, cz], rot: [pitch + (r() - 0.5) * 0.06, ry, (r() - 0.5) * 0.1] }));
    }
    C.addBox(cx, cg + 0.7, cz, 0.12, 0.9, len / 2 + 0.1, ry);
  });

  // moon stones on the hilltop
  const stones = 9;
  for (let i = 0; i < stones; i++) {
    const a = (i / stones) * Math.PI * 2 + 0.2;
    const x = P.x + Math.cos(a) * 9, z = P.z + Math.sin(a) * 9;
    const g = terrain.getHeight(x, z);
    const h = 2.6 + r() * 1.6;
    block(B, C, 'stone', { x, y: g + h / 2 - 0.3, z, w: 1.2, h, d: 0.7, ry: -a + Math.PI / 2, rz: (r() - 0.5) * 0.12, tex: 1.5 });
  }
  const g = terrain.getHeight(P.x, P.z);
  slab(B, C, 'stone', P.x, P.z, 2.6, 1.6, g - 0.5, g + 0.7, { ry: 0.4 });
}

function buildCanyon(B, C) {
  // the archway spanning the canyon mouth
  const cx = polylineXAtZ(RIVER, CANYON_ARCH_Z), z = CANYON_ARCH_Z;
  const floor = -0.9, R = 6.6, spring = 9.5;
  for (const s of [-1, 1]) {
    slab(B, C, 'stone', cx + s * R, z, 2.6, 2.8, floor - 0.5, spring);
    block(B, C, 'stone', { x: cx + s * R, y: spring + 0.3, z, w: 3.2, h: 0.6, d: 3.2 });
  }
  const blocks = 13;
  for (let i = 0; i < blocks; i++) {
    const a = Math.PI * (i + 0.5) / blocks;
    const x = cx + Math.cos(a) * R, y = spring + 0.6 + Math.sin(a) * R;
    block(B, C, 'stone', { x, y, z, w: 2 * R * Math.sin(Math.PI / blocks / 2) * 2.1, h: 1.9, d: 2.8, rz: a + Math.PI / 2, collide: false });
    if (i % 2 === 0) hangingMoss(B, x + (r() - 0.5), y - 0.6, z + 1.45, 1.4, 1.5 + r() * 2.5, 0);
  }
  for (let i = -5; i <= 5; i++) {
    if (r() < 0.2) continue;
    block(B, C, 'stone', { x: cx + i * 2.1, y: spring + R + 2.2, z, w: 2.1, h: 1.4, d: 3.0, collide: false });
  }

  // drowned stone stairway in the canyon
  const sx = polylineXAtZ(RIVER, CANYON_STEPS_Z);
  const tops = [0.2, 0.6, 1.0, 1.4, 1.8, 1.8, 1.8, 1.4, 1.0, 0.6, 0.2];
  let zz = CANYON_STEPS_Z + tops.length / 2;
  for (const t of tops) {
    slab(B, C, 'stone', sx, zz - 0.5, 19, 1.0, -1.2, t, { tex: 1.5 });
    zz -= 1.0;
  }
  // broken columns along the canyon walls
  for (let i = 0; i < 6; i++) {
    const pz = -168 - i * 9;
    const px = polylineXAtZ(RIVER, pz) + (i % 2 ? 6.5 : -6.5);
    const h = 2 + r() * 5;
    slab(B, C, 'stone', px, pz, 1.4, 1.4, -1.2, h, { tex: 1.5 });
  }
}

function buildTemple(B, C) {
  const { x: tx, z: tz } = TEMPLE;
  const base = 1.8, upper = 3.0;
  slab(B, C, 'stone', tx, tz - 6, 28, 22, -1.2, base, { tex: 2.5 });
  [1.45, 1.05, 0.65, 0.25].forEach((t, i) => slab(B, C, 'stone', tx, tz + 5.6 + i * 1.2, 12, 1.2, -1.2, t, { tex: 1.5 }));
  slab(B, C, 'stone', tx, tz - 9, 18, 14, base, upper, { tex: 2 });
  [2.6, 2.2].forEach((t, i) => slab(B, C, 'stone', tx, tz - 1.6 + i * 0.8, 8, 0.8, base, t, { tex: 1.5 }));

  const pillar = (px, pz, h) => {
    slab(B, C, 'stone', px, pz, 1.3, 1.3, upper, upper + h, { tex: 1.5 });
    if (h > 6) block(B, C, 'stone', { x: px, y: upper + h + 0.25, z: pz, w: 1.9, h: 0.5, d: 1.9 });
  };
  pillar(tx - 7, tz - 4, 7); pillar(tx - 3.5, tz - 4, 7); pillar(tx + 3.5, tz - 4, 3.2); pillar(tx + 7, tz - 4, 7);
  pillar(tx - 7, tz - 14, 7); pillar(tx + 7, tz - 14, 5);
  // toppled pillar drum lying on the base
  block(B, C, 'stone', { x: tx + 9.5, y: base + 0.65, z: tz + 1.5, w: 1.3, h: 1.3, d: 4.5, ry: 0.5, tex: 1.5 });
  // half-collapsed roof
  block(B, C, 'stone', { x: tx - 3.5, y: upper + 7.95, z: tz - 9, w: 10, h: 0.9, d: 12, rz: 0.04, rx: 0.03, collide: false });
  // back wall with the dark doorway
  slab(B, C, 'stone', tx - 5.5, tz - 16.5, 7, 1.2, upper, upper + 8);
  slab(B, C, 'stone', tx + 5.5, tz - 16.5, 7, 1.2, upper, upper + 8);
  block(B, C, 'stone', { x: tx, y: upper + 7.2, z: tz - 16.5, w: 4.4, h: 1.6, d: 1.2 });
  block(B, C, 'plain', { x: tx, y: upper + 3.2, z: tz - 17.4, w: 4.2, h: 6.4, d: 0.6, color: 0x020306 });
  for (let i = 0; i < 7; i++) hangingMoss(B, tx - 9 + i * 3 + r(), upper + 8, tz - 15.8, 1.4, 2 + r() * 3, 0);
  // altar
  const altar = new THREE.Vector3(tx, upper, tz - 11);
  block(B, C, 'stone', { x: altar.x, y: upper + 0.55, z: altar.z, w: 2.4, h: 1.1, d: 1.4, tex: 1 });
  // moon braziers: cold blue flames that the bloom pass turns into halos
  const braziers = [];
  for (const [bx, bz, by] of [[-12.5, 4, base], [12.5, 4, base], [-8, -2.8, upper], [8, -2.8, upper]]) {
    const p = new THREE.Vector3(tx + bx, by, tz + bz);
    block(B, C, 'stone', { x: p.x, y: by + 0.5, z: p.z, w: 0.7, h: 1.0, d: 0.7, tex: 1 });
    B.add('stone', part(new THREE.CylinderGeometry(0.55, 0.3, 0.35, 8), 0xb0b8c0, { pos: [p.x, by + 1.15, p.z] }));
    B.add('glow', part(new THREE.OctahedronGeometry(0.32, 0), new THREE.Color(0.55, 0.95, 1.6), { pos: [p.x, by + 1.6, p.z], scale: [1, 1.8, 1] }));
    braziers.push(new THREE.Vector3(p.x, by + 1.6, p.z));
  }
  return { altar, braziers };
}

function buildBridge(B, C, terrain) {
  // where the western path crosses the river
  const path = PATHS[0];
  let best = { d: Infinity };
  for (let s = 0; s < path.length - 1; s++) {
    const [ax, az] = path[s], [bx, bz] = path[s + 1];
    for (let t = 0; t <= 1; t += 0.005) {
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      const d = distToPolyline(x, z, RIVER);
      if (d < best.d) best = { d, x, z, ry: Math.atan2(bx - ax, bz - az) };
    }
  }
  const dir = new THREE.Vector3(Math.sin(best.ry), 0, Math.cos(best.ry));
  const side = new THREE.Vector3(Math.cos(best.ry), 0, -Math.sin(best.ry));
  const planks = 11;
  for (let i = 0; i < planks; i++) {
    const t = (i + 0.5) / planks - 0.5;
    const p = new THREE.Vector3(best.x, 0, best.z).addScaledVector(dir, t * 22);
    const top = 0.5 + Math.sin(Math.PI * (i + 0.5) / planks) * 0.9;
    block(B, C, 'wood', { x: p.x, y: top - 0.12, z: p.z, w: 2.6, h: 0.24, d: 2.02, ry: best.ry, tex: 1.5 });
    for (const s of [-1.2, 1.2]) {
      const q = p.clone().addScaledVector(side, s);
      if (i % 2 === 0) block(B, C, 'wood', { x: q.x, y: (top - 1.2) / 2 + 0.4, z: q.z, w: 0.18, h: top + 1.4, d: 0.18, ry: best.ry, collide: false });
      block(B, C, 'wood', { x: q.x, y: top + 0.85, z: q.z, w: 0.08, h: 0.1, d: 2.1, ry: best.ry, collide: false });
    }
  }
}

function ruinSite(B, C, terrain, cx, cz, size = 1) {
  const n = 3 + Math.floor(r() * 4);
  const g0 = terrain.getHeight(cx, cz);
  for (let i = 0; i < n; i++) {
    const x = cx + (r() - 0.5) * 14 * size, z = cz + (r() - 0.5) * 14 * size;
    const g = terrain.getHeight(x, z);
    const h = 1.5 + r() * 5;
    slab(B, C, 'stone', x, z, 1.2, 1.2, g - 0.6, g + h, { ry: r() * 3, tex: 1.5 });
  }
  // wall fragment with a window
  const ry = r() * 3;
  const w = 7 * size;
  const dir = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Vector3(cx, 0, cz).addScaledVector(dir, (i - 1.5) * w / 4);
    const g = terrain.getHeight(p.x, p.z);
    const h = i === 1 || i === 2 ? 1.4 : 3 + r() * 2.5;
    slab(B, C, 'stone', p.x, p.z, w / 4, 0.9, g - 0.8, g + h, { ry });
  }
  const p = new THREE.Vector3(cx, 0, cz);
  block(B, C, 'stone', { x: p.x, y: g0 + 3.5, z: p.z, w: w / 2, h: 0.8, d: 0.9, ry, collide: false });
  // fallen blocks
  for (let i = 0; i < 4; i++) {
    const x = cx + (r() - 0.5) * 10, z = cz + (r() - 0.5) * 10;
    const g = terrain.getHeight(x, z);
    block(B, C, 'stone', { x, y: g + 0.2, z, w: 0.9 + r(), h: 0.7, d: 0.8 + r(), ry: r() * 3, rx: (r() - 0.5) * 0.4, rz: (r() - 0.5) * 0.4, tex: 1.5 });
  }
}

function buildGiantMushroom(B, C, terrain, x, z, scale = 1, collide = true) {
  const g = terrain.getHeight(x, z);
  const stem = new THREE.LatheGeometry([
    new THREE.Vector2(1.25, 0), new THREE.Vector2(0.95, 0.6), new THREE.Vector2(0.8, 2.5),
    new THREE.Vector2(0.75, 4.5), new THREE.Vector2(0.9, 5.6),
  ], 10);
  B.add('plain', part(stem, new THREE.Color(0.55, 0.52, 0.46), { pos: [x, g - 0.2, z], scale }));
  const cap = new THREE.LatheGeometry([
    new THREE.Vector2(0.001, 7.3), new THREE.Vector2(1.6, 7.15), new THREE.Vector2(3.0, 6.7),
    new THREE.Vector2(4.1, 5.9), new THREE.Vector2(4.6, 5.2), new THREE.Vector2(4.3, 5.1),
    new THREE.Vector2(1.0, 5.6),
  ], 14);
  B.add('mushroomCap', part(cap, 0xffffff, { pos: [x, g - 0.2, z], rot: [0.05 * scale, 0, 0.06], scale }));
  if (collide) C.addCircle(x, z, 1.1 * scale);
}

export function buildStructures(scene, terrain, M, C) {
  const B = new StaticBuilder();
  buildRailway(B, C, terrain);
  buildFence(B, C, terrain);
  buildCanyon(B, C);
  const { altar, braziers } = buildTemple(B, C);
  buildBridge(B, C, terrain);
  [[-120, -20], [-60, 255], [70, 140], [-210, 120], [-205, -90], [60, -75], [210, 120]].forEach(([x, z], i) => ruinSite(B, C, terrain, x, z, i === 0 ? 1.3 : 1));
  buildGiantMushroom(B, C, terrain, TOAD.x, TOAD.z, 1);
  [[-171, 20, 0.45], [-150, 45, 0.35], [-176, 42, 0.3], [-95, -30, 0.5], [-200, 60, 0.6], [-130, 90, 0.4]].forEach(([x, z, s]) => buildGiantMushroom(B, C, terrain, x, z, s));

  // the toad's lantern post
  const lx = TOAD.x + 3.2, lz = TOAD.z + 2.6;
  const lg = terrain.getHeight(lx, lz);
  block(B, C, 'wood', { x: lx, y: lg + 1.2, z: lz, w: 0.15, h: 2.4, d: 0.15, collide: true });
  block(B, C, 'wood', { x: lx + 0.35, y: lg + 2.35, z: lz, w: 0.8, h: 0.1, d: 0.1, collide: false });
  B.add('glow', part(new THREE.BoxGeometry(0.18, 0.26, 0.18), new THREE.Color(1.15, 0.7, 0.32), { pos: [lx + 0.65, lg + 2.05, lz] }));

  B.build(scene, M);
  return { altar, braziers, lantern: new THREE.Vector3(lx + 0.65, lg + 2.05, lz) };
}

