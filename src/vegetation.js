import * as THREE from 'three';
import { rng, fbm } from './noise.js';
import { part, mergeGeometries, cylinderBetween, distToPolyline, colorize } from './util.js';
import { PASTURE, FENCE_R, TOAD, TEMPLE, RIVER, PATHS, TAVERN, HOUSES, HEAD, SMITH } from './layout.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Leaf "cards": crossed alpha planes, the classic PS2 tree trick. Normals point away from the clump
// centre so canopies shade like a volume.
function card(w, h, center, pos, ry, rx, color) {
  const g = new THREE.PlaneGeometry(w, h);
  const m = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0)), V(1, 1, 1));
  g.applyMatrix4(m);
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const v = V(p.getX(i) - center.x, p.getY(i) - center.y + 0.6, p.getZ(i) - center.z).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  return colorize(g, color);
}

function broadleafTree(seed) {
  const r = rng(seed);
  const trunk = [], leaves = [];
  let p = V(0, 0, 0);
  const segs = 4, height = 6 + r() * 2.5;
  let rad = 0.42;
  const pts = [p.clone()];
  for (let i = 0; i < segs; i++) {
    const np = p.clone().add(V((r() - 0.5) * 1.2, height / segs, (r() - 0.5) * 1.2));
    trunk.push(cylinderBetween(p, np, rad, rad * 0.78, 7));
    rad *= 0.78; p = np; pts.push(p.clone());
  }
  const clumps = [p.clone().add(V(0, 0.8, 0))];
  const branches = 4 + Math.floor(r() * 3);
  for (let b = 0; b < branches; b++) {
    const from = pts[2 + Math.floor(r() * (pts.length - 2))];
    const a = r() * Math.PI * 2, len = 2.2 + r() * 2.2;
    const to = from.clone().add(V(Math.cos(a) * len, 0.8 + r() * 1.6, Math.sin(a) * len));
    trunk.push(cylinderBetween(from, to, 0.16, 0.06, 5));
    clumps.push(to);
  }
  for (const c of clumps) {
    const s = 2.6 + r() * 1.6;
    const tint = new THREE.Color().setRGB(0.75 + r() * 0.3, 0.85 + r() * 0.25, 0.75 + r() * 0.3);
    for (let k = 0; k < 3; k++) {
      leaves.push(card(s * 1.4, s, c, c.clone().add(V((r() - 0.5) * 0.6, (r() - 0.3) * 0.6, (r() - 0.5) * 0.6)), r() * Math.PI, (r() - 0.5) * 0.6, tint));
    }
    leaves.push(card(s * 1.3, s * 1.3, c, c.clone().add(V(0, 0.5, 0)), r() * Math.PI, -Math.PI / 2 + (r() - 0.5) * 0.4, tint));
  }
  // flared roots
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + r();
    trunk.push(cylinderBetween(V(0, 0.9, 0), V(Math.cos(a) * 1.1, -0.2, Math.sin(a) * 1.1), 0.22, 0.08, 5));
  }
  return { trunk: mergeGeometries(trunk.map((g) => colorize(g, 0xffffff))), crown: mergeGeometries(leaves) };
}

function swampTree(seed) {
  const r = rng(seed);
  const trunk = [], moss = [];
  let p = V(0, 0, 0);
  let rad = 0.38;
  const pts = [p.clone()];
  for (let i = 0; i < 4; i++) {
    const np = p.clone().add(V((r() - 0.5) * 1.6, 1.3 + r() * 0.6, (r() - 0.5) * 1.6));
    trunk.push(cylinderBetween(p, np, rad, rad * 0.75, 6));
    rad *= 0.75; p = np; pts.push(p.clone());
  }
  for (let b = 0; b < 7; b++) {
    const from = pts[1 + Math.floor(r() * (pts.length - 1))];
    const a = r() * Math.PI * 2, len = 1.5 + r() * 2.5;
    const to = from.clone().add(V(Math.cos(a) * len, (r() - 0.2) * 1.5, Math.sin(a) * len));
    trunk.push(cylinderBetween(from, to, 0.1, 0.03, 4));
    const mh = 1.5 + r() * 2.2;
    const g = new THREE.PlaneGeometry(1.0 + r() * 0.8, mh);
    // flip v so the hanging tips (bottom) sway, not the attachment
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    g.translate(0, -mh / 2, 0);
    g.rotateY(r() * Math.PI);
    g.translate(to.x, to.y, to.z);
    moss.push(colorize(g, new THREE.Color().setRGB(0.8 + r() * 0.3, 0.9, 0.85)));
  }
  for (let k = 0; k < 5; k++) {
    const a = k * 1.25 + r();
    trunk.push(cylinderBetween(V(0, 1.0, 0), V(Math.cos(a) * 1.6, -0.4, Math.sin(a) * 1.6), 0.15, 0.05, 4));
  }
  return { trunk: mergeGeometries(trunk.map((g) => colorize(g, 0xb0b8b0))), crown: mergeGeometries(moss) };
}

function crossedPlanes(w, h, n = 2, color = 0xffffff) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const g = new THREE.PlaneGeometry(w, h);
    g.translate(0, h / 2, 0);
    g.rotateY((i / n) * Math.PI);
    const nr = g.attributes.normal;
    for (let k = 0; k < nr.count; k++) nr.setXYZ(k, 0, 1, 0);
    parts.push(colorize(g, color));
  }
  return mergeGeometries(parts);
}

function fernGeom() {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.PlaneGeometry(2.2, 1.6);
    g.translate(0, 0.8, 0);
    g.rotateX(-0.35);
    g.rotateY((i / 3) * Math.PI * 2);
    const nr = g.attributes.normal;
    for (let k = 0; k < nr.count; k++) nr.setXYZ(k, 0, 1, 0);
    parts.push(colorize(g, 0xffffff));
  }
  return mergeGeometries(parts);
}

function glowMushroomGeom() {
  const cap = new THREE.SphereGeometry(0.16, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  return mergeGeometries([
    part(new THREE.CylinderGeometry(0.03, 0.04, 0.22, 5), new THREE.Color(0.25, 0.4, 0.6), { pos: [0, 0.11, 0] }),
    part(cap, new THREE.Color(0.35, 0.8, 1.4), { pos: [0, 0.2, 0], scale: [1, 0.7, 1] }),
  ]);
}

// hide every tree, fern, rock and mushroom inside a circle (grass stays), e.g. to clear a base
export function clearVegetation(veg, M, x, z, r) {
  const mat = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (const m of veg.meshes) {
    if (m.material === M.grass) continue;
    let hit = false;
    for (let i = 0; i < m.count; i++) {
      m.getMatrixAt(i, mat);
      if (Math.hypot(mat.elements[12] - x, mat.elements[14] - z) > r) continue;
      m.setMatrixAt(i, zero);
      hit = true;
    }
    if (hit) m.instanceMatrix.needsUpdate = true;
  }
}

export function buildVegetation(scene, terrain, M, collision, quality) {
  const r = rng(2024);
  const H = (x, z) => terrain.getHeight(x, z);
  const tmp = new THREE.Object3D();
  const col = new THREE.Color();

  const nearRail = (x, z, d) => {
    const pts = terrain.rail.pts;
    for (let i = 0; i < pts.length; i += 6) if (Math.abs(pts[i].x - x) < d + 4 && Math.abs(pts[i].z - z) < d + 4 && Math.hypot(pts[i].x - x, pts[i].z - z) < d) return true;
    return false;
  };
  // keep plants out of buildings and giant structures
  const built = (x, z, pad = 0) => (Math.abs(x - TAVERN.x) < 9 + pad && Math.abs(z - TAVERN.z) < 7 + pad)
    || HOUSES.some(([hx, hz]) => Math.hypot(x - hx, z - hz) < 5.5 + pad)
    || Math.hypot(x - HEAD.x - 12, z - HEAD.z) < 38 + pad
    || Math.hypot(x - 62, z - 8) < 2.5
    || Math.hypot(x - SMITH.x, z - SMITH.z) < 6 + pad;
  const inTempleYard = (x, z) => Math.abs(x - TEMPLE.x) < 48 && Math.abs(z - TEMPLE.z) < 42;
  const nearPath = (x, z, d) => PATHS.some((p) => distToPolyline(x, z, p) < d);
  const dPasture = (x, z) => Math.hypot(x - PASTURE.x, z - PASTURE.z);
  const dToad = (x, z) => Math.hypot(x - TOAD.x, z - TOAD.z);

  // ---------- trees ----------
  const variants = [broadleafTree(1), broadleafTree(2), broadleafTree(3)];
  const swampVariants = [swampTree(11), swampTree(12)];
  const placements = variants.map(() => []);
  const swampPlacements = swampVariants.map(() => []);
  const maxTrees = quality.trees;
  let tries = 0, placed = 0;
  while (placed < maxTrees && tries < maxTrees * 12) {
    tries++;
    const x = (r() - 0.5) * 560, z = (r() - 0.5) * 560;
    const h = H(x, z);
    if (h < 0.15 || h > 34 || terrain.slope(x, z) > 0.75) continue;
    if (nearRail(x, z, 6) || nearPath(x, z, 4) || inTempleYard(x, z)) continue;
    if (distToPolyline(x, z, RIVER) < 7) continue;
    const dp = dPasture(x, z);
    if (dp < FENCE_R + 8) continue;
    if (dToad(x, z) < 13 || built(x, z, 8)) continue;
    let density = 0.25 + fbm(x * 0.012, z * 0.012, 3, 55) * 0.6;
    if (x < -60) density += 0.55;
    if (dp < 90) density *= 0.3;
    if (z < -130) density *= 0.45;
    if (r() > density) continue;
    const swamp = z > 120 && r() < 0.65;
    const s = 0.75 + r() * 0.6;
    const list = swamp ? swampPlacements[Math.floor(r() * swampPlacements.length)] : placements[Math.floor(r() * placements.length)];
    list.push({ x, y: h - 0.2, z, s, ry: r() * Math.PI * 2, tint: 0.75 + r() * 0.4 });
    collision.addCircle(x, z, (swamp ? 0.3 : 0.4) * s + 0.1);
    placed++;
  }
  // a few drowned swamp trees standing in the water
  for (let i = 0; i < 60; i++) {
    const x = -200 + r() * 330, z = 140 + r() * 140;
    const h = H(x, z);
    if (h > 0.2 || h < -1.2 || nearRail(x, z, 5)) continue;
    const s = 0.8 + r() * 0.5;
    swampPlacements[i % 2].push({ x, y: h - 0.2, z, s, ry: r() * 6.28, tint: 0.7 + r() * 0.3 });
    collision.addCircle(x, z, 0.3 * s + 0.1);
  }

  const meshes = [];
  const addInstanced = (geom, mat, list, shadowY = 0) => {
    if (!list.length) return null;
    const m = new THREE.InstancedMesh(geom, mat, list.length);
    list.forEach((p, i) => {
      tmp.position.set(p.x, p.y + shadowY, p.z);
      tmp.rotation.set(p.rx || 0, p.ry, 0);
      tmp.scale.setScalar(p.s);
      if (p.sy) tmp.scale.y = p.sy;
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
      const t = p.tint ?? 1;
      m.setColorAt(i, col.setRGB(t * (p.tr ?? 1), t, t * (p.tb ?? 1)));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    scene.add(m);
    meshes.push(m);
    return m;
  };

  variants.forEach((v, i) => { addInstanced(v.trunk, M.bark, placements[i]); addInstanced(v.crown, M.leaves, placements[i]); });
  swampVariants.forEach((v, i) => { addInstanced(v.trunk, M.bark, swampPlacements[i]); addInstanced(v.crown, M.hangingMoss, swampPlacements[i]); });

  // ---------- ferns ----------
  const ferns = [];
  for (let i = 0; i < quality.ferns * 6 && ferns.length < quality.ferns; i++) {
    const x = (r() - 0.5) * 560, z = (r() - 0.5) * 560;
    const h = H(x, z);
    if (h < 0.1 || terrain.slope(x, z) > 0.9 || nearRail(x, z, 3) || nearPath(x, z, 2) || built(x, z, 1)) continue;
    let d = 0.15;
    if (x < -50) d += 0.5;
    if (distToPolyline(x, z, RIVER) < 22) d += 0.6;
    if (z < -140) d += 0.5;
    if (dPasture(x, z) < FENCE_R + 4) d = 0;
    if (r() > d) continue;
    ferns.push({ x, y: h - 0.05, z, s: 0.6 + r() * 0.9, ry: r() * 6.28, tint: 0.7 + r() * 0.45 });
  }
  // ferns hugging the canyon walls and the temple yard
  for (let i = 0; i < 260; i++) {
    const z = -150 - r() * 120, x = TEMPLE.x + (r() - 0.5) * 100;
    const h = H(x, z);
    if (h < 0.3 || h > 22) continue;
    ferns.push({ x, y: h - 0.05, z, s: 0.8 + r() * 1.1, ry: r() * 6.28, tint: 0.8 + r() * 0.4 });
  }
  for (let i = 0; i < 420; i++) {
    const z = -135 - r() * 85;
    const side = r() < 0.5 ? -1 : 1;
    const seg = RIVER.findIndex((p, k) => k < RIVER.length - 1 && (z - p[1]) * (z - RIVER[k + 1][1]) <= 0);
    const [ax, az] = RIVER[seg], [bx, bz] = RIVER[seg + 1];
    const cx = ax + (bx - ax) * (z - az) / (bz - az);
    const x = cx + side * (7.8 + r() * 5);
    const h = H(x, z);
    if (h < 0.2) continue;
    ferns.push({ x, y: h - 0.1, z, s: 0.7 + r() * 1.0, ry: r() * 6.28, rx: side * 0.5, tint: 0.75 + r() * 0.45 });
  }
  addInstanced(fernGeom(), M.fern, ferns);

  // ---------- grass & reeds ----------
  const grass = [];
  for (let i = 0; i < quality.grass * 5 && grass.length < quality.grass; i++) {
    const x = (r() - 0.5) * 560, z = (r() - 0.5) * 560;
    const h = H(x, z);
    if (h < -0.4 || h > 28 || nearRail(x, z, 2.4) || built(x, z, 0.5)) continue;
    const dp = dPasture(x, z);
    let d = 0.25 + fbm(x * 0.03, z * 0.03, 2, 66) * 0.5;
    if (dp < 75) d += 0.5;
    if (z > 110) d += 0.35;
    if (h < 0.4) d += 0.3;
    if (r() > d) continue;
    const reed = h < 0.5;
    grass.push({
      x, y: h - 0.05, z, s: reed ? 1.1 + r() * 0.6 : 0.6 + r() * 0.6, sy: reed ? 1.8 + r() * 1.2 : undefined,
      ry: r() * 6.28, tint: 0.95 + r() * 0.6, tb: dp < 75 ? 1.2 : 1.05,
    });
  }
  addInstanced(crossedPlanes(1.0, 0.62, 2), M.grass, grass);

  // ---------- rocks ----------
  const rocks = [];
  for (let i = 0; i < quality.rocks * 6 && rocks.length < quality.rocks; i++) {
    const x = (r() - 0.5) * 560, z = (r() - 0.5) * 560;
    const h = H(x, z);
    if (h < -0.6 || nearRail(x, z, 4) || nearPath(x, z, 3) || inTempleYard(x, z) || dPasture(x, z) < FENCE_R + 3 || built(x, z, 2)) continue;
    if (r() > 0.25 + terrain.slope(x, z) * 0.8) continue;
    const s = 0.5 + Math.pow(r(), 2) * 1.8;
    rocks.push({ x, y: h - s * 0.25, z, s, sy: s * (0.5 + r() * 0.4), ry: r() * 6.28, rx: (r() - 0.5) * 0.3, tint: 0.7 + r() * 0.4 });
    if (s > 1) collision.addCircle(x, z, s * 0.8, h - 1, h + s * 0.6);
  }
  const rockGeom = colorize(new THREE.DodecahedronGeometry(1, 0), 0xffffff);
  const ruv = rockGeom.attributes.uv;
  const rpos = rockGeom.attributes.position;
  for (let i = 0; i < ruv.count; i++) ruv.setXY(i, rpos.getX(i) * 0.6 + rpos.getZ(i) * 0.4, rpos.getY(i) * 0.6);
  addInstanced(rockGeom, M.stone, rocks);

  // ---------- glowing mushrooms ----------
  const glow = [];
  for (let i = 0; i < quality.mushrooms * 8 && glow.length < quality.mushrooms; i++) {
    const cx = (r() - 0.5) * 540, cz = (r() - 0.5) * 540;
    let d = 0.1;
    if (cx < -60) d += 0.5;
    if (cz < -140) d += 0.5;
    if (cz > 120) d += 0.3;
    if (r() > d) continue;
    const cluster = 3 + Math.floor(r() * 6);
    for (let k = 0; k < cluster; k++) {
      const x = cx + (r() - 0.5) * 2.5, z = cz + (r() - 0.5) * 2.5;
      const h = H(x, z);
      if (h < 0.05 || built(x, z, 1)) continue;
      glow.push({ x, y: h - 0.02, z, s: 0.6 + r() * 1.4, ry: r() * 6.28, tint: 0.6 + r() * 0.6 });
    }
  }
  addInstanced(glowMushroomGeom(), M.glow, glow);

  return { treeCount: placed, meshes };
}

