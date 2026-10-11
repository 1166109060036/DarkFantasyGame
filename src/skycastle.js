// Sky-Hung Castle, walkable (chapter 2). src/giants.js draws the floating island and its castle;
// this gives it a floor, walls you bump into, the throne terrace where the Handless Regent waits,
// the kneeling statue of the Crown-Bearer, and the one chain you can climb (the anchor nearest the
// village), with the path up it and the place you haul yourself over the edge.
//
// The island is an ellipse turned 0.3 rad (radius 43, squashed to 0.84 along its own z), its top
// a shallow dome a couple of metres above CASTLE.top. The floor is a grid of collision boxes whose
// tops follow that dome, so the player and anything that fights up there (combat.groundY) stand on it.
import * as THREE from 'three';
import { CASTLE } from './layout.js';
import { part, mergeGeometries } from './util.js';
import { L } from './i18n.js';

const A = 0.3, ZS = 0.84, RIM = 41.5;
const cA = Math.cos(A), sA = Math.sin(A);
const C = (r, g, b) => new THREE.Color(r, g, b);

// the chain you climb, and the one that snapped at the end of chapter 1 (angles about the island)
export const CLIMB_A = 3.8;
export const SNAP_A = 2.3;

// world -> island space (unturned, unsquashed): [x, z, r]
export function islandLocal(x, z) {
  const dx = x - CASTLE.x, dz = z - CASTLE.z;
  const lx = dx * cA - dz * sA, lz = (dx * sA + dz * cA) / ZS;
  return [lx, lz, Math.hypot(lx, lz)];
}
// island space -> world
export function islandWorld(lx, lz) {
  const z = lz * ZS;
  return [CASTLE.x + lx * cA + z * sA, CASTLE.z - lx * sA + z * cA];
}
// height of the island's top at distance r from its middle (the dome of the lathe in giants.js)
export function surfaceAt(r) {
  return CASTLE.top + (r < 30 ? 2.4 - 0.8 * (r / 30) : 1.6 - 1.1 * Math.min(1, (r - 30) / 13));
}
export function onIsland(x, z, y) {
  const [, , r] = islandLocal(x, z);
  return r < RIM + 1 && y > CASTLE.top - 6;
}

// the castle's own coordinates, as giants.js places its keep, towers and walls
export function castleL(lx, ly, lz) {
  const c = Math.cos(A), s = Math.sin(A);
  return new THREE.Vector3(CASTLE.x + lx * c + lz * s, CASTLE.top + 1 + ly, CASTLE.z + (-lx * s + lz * c) * 0.84);
}

// a point in castle coordinates standing on the island's floor (dy above it)
export function onFloor(lx, dy, lz) {
  const p = castleL(lx, 0, lz);
  p.y = surfaceAt(islandLocal(p.x, p.z)[2]) + dy;
  return p;
}

// the climbable chain: the same sagging curve giants.js hangs its links on
export function chainPoints(terrain, a = CLIMB_A) {
  const gx = CASTLE.x + Math.cos(a) * 105, gz = CASTLE.z + Math.sin(a) * 105;
  const gy = terrain.getHeight(gx, gz);
  const from = new THREE.Vector3(gx, gy + 8, gz);
  const to = new THREE.Vector3(CASTLE.x + Math.cos(a) * 33, CASTLE.top - 12, CASTLE.z + Math.sin(a) * 33 * 0.84);
  const point = (t) => new THREE.Vector3(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t - 16 * 4 * t * (1 - t), from.z + (to.z - from.z) * t);
  // where you stand to start the climb (beside the anchor stone), and where you come out on top
  const away = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
  const base = new THREE.Vector3(gx + away.x * 6.5, 0, gz + away.z * 6.5);
  base.y = terrain.getHeight(base.x, base.z);
  const [lx, lz, r] = islandLocal(to.x, to.z);
  const [tx, tz] = islandWorld(lx / r * 36, lz / r * 36);
  const top = new THREE.Vector3(tx, surfaceAt(36), tz);
  return { from, to, point, base, top, anchor: new THREE.Vector3(gx, gy, gz) };
}

export function buildSkyCastle(scene, M, collision, terrain, fx) {
  const top = CASTLE.top;
  // ---- the floor: boxes in a grid over the dome
  const step = 3.5;
  for (let lx = -RIM; lx <= RIM; lx += step) {
    for (let lz = -RIM; lz <= RIM; lz += step) {
      const r = Math.hypot(lx, lz);
      if (r > RIM) continue;
      const [x, z] = islandWorld(lx, lz);
      const y = surfaceAt(r);
      collision.addBox(x, y - 0.6, z, step / 2 + 0.05, 0.6, (step / 2) * ZS + 0.05, A);
    }
  }
  // ---- what stands on it: keep, towers, curtain walls (only up here: yMin keeps the ground below free)
  const lo = top - 2, hi = top + 140;
  const k = castleL(0, 12, 2);
  collision.addBox(k.x, k.y, k.z, 13, 12, 10, A);
  for (const [lx, lz, r] of [[-15, -11, 5], [15, -11, 5], [-15, 14, 5], [15, 14, 5], [-3, -6, 7], [7, -2, 3]]) {
    const p = castleL(lx, 0, lz);
    collision.addCircle(p.x, p.z, r * 1.1, lo, hi);
  }
  for (const [ax, az, bx, bz] of [[-15, -11, 15, -11], [15, -11, 15, 14], [-15, -11, -15, 14]]) {
    const len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az) + A;
    const m = castleL((ax + bx) / 2, 8, (az + bz) / 2);
    collision.addBox(m.x, m.y, m.z, 1.3, 8, len / 2, ry);
  }

  // ---- the throne terrace before the keep's great windows
  const stone = C(0.7, 0.72, 0.86), dark = C(0.36, 0.36, 0.46), gold = C(0.9, 0.72, 0.36);
  const parts = { giantStone: [], giantGlow: [], giantMetal: [] };
  const put = (mat, geom, color, pos, ry = A, rx = 0) => parts[mat].push(part(geom, color, { pos: [pos.x, pos.y, pos.z], rot: [rx, ry, 0] }));
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  // two low steps up to the dais, the dais, the throne
  for (const [i, w, d] of [[0, 14, 7], [1, 11, 5.4]]) {
    const p = onFloor(0, 0.2 + 0.4 * i, 14.6 - i * 0.6);
    put('giantStone', box(w, 0.4, d), stone, p);
    collision.addBox(p.x, p.y, p.z, w / 2, 0.2, d / 2, A);
  }
  const seat = onFloor(0, 1.4, 13.4);
  put('giantStone', box(3.2, 1.2, 2.4), dark, seat);
  const back = onFloor(0, 4.0, 12.6);
  put('giantStone', box(3.4, 5.2, 0.8), dark, back);
  for (let i = 0; i < 5; i++) put('giantStone', box(0.5, 1.0 + (i % 2) * 0.6, 0.5), dark, onFloor(-1.4 + i * 0.7, 7.0 + (i % 2) * 0.3, 12.6));
  collision.addBox(seat.x, seat.y + 1, seat.z - 0.3, 1.7, 2.6, 1.6, A);
  // pillars round the terrace, each with a fire bowl
  for (const [lx, lz] of [[-13, 18], [13, 18], [-16, 30], [16, 30]]) {
    const p = onFloor(lx, 3.5, lz);
    put('giantStone', new THREE.CylinderGeometry(0.9, 1.1, 7, 8), stone, p);
    put('giantMetal', new THREE.CylinderGeometry(1.0, 0.5, 0.6, 8), dark, onFloor(lx, 7.3, lz));
    put('giantGlow', new THREE.OctahedronGeometry(0.5, 0), C(1.7, 0.8, 0.3), onFloor(lx, 7.9, lz));
    collision.addCircle(p.x, p.z, 1.15, lo, hi);
    const flame = new THREE.Sprite(M.fireSprite);
    flame.position.copy(onFloor(lx, 8.2, lz));
    flame.scale.setScalar(3.2);
    scene.add(flame);
    fx?.fires.push({ s: flame, base: 3.2, ph: lx * 0.7 + lz });
    const light = new THREE.PointLight(0xffa050, 10, 22, 1.4);
    light.position.copy(onFloor(lx, 8.5, lz));
    scene.add(light);
  }
  // the Crown-Bearer's statue: a boy kneeling, offering up a bundle, facing the throne
  const sp = onFloor(-21, 0, 24);
  const statue = [];
  const S = (geom, pos, rot = [0, 0, 0]) => statue.push(part(geom, stone, { pos, rot }));
  S(box(1.6, 0.6, 1.6), [0, 0.3, 0]);
  S(box(0.5, 0.5, 0.9), [0.2, 0.85, 0.15]);                 // the kneeling thigh
  S(box(0.4, 0.45, 0.4), [-0.2, 0.83, -0.25]);
  S(box(0.62, 0.8, 0.36), [0, 1.5, 0]);                     // body
  S(new THREE.SphereGeometry(0.22, 8, 6), [0, 2.1, 0.02]);  // bowed head
  S(box(0.16, 0.6, 0.16), [0.32, 1.65, 0.3], [-1.2, 0, 0]); // arms raised forward
  S(box(0.16, 0.6, 0.16), [-0.32, 1.65, 0.3], [-1.2, 0, 0]);
  S(new THREE.CylinderGeometry(0.28, 0.32, 0.22, 8), [0, 1.95, 0.6]);   // the bundle: a crown in cloth
  const sg = mergeGeometries(statue);
  const toThrone = Math.atan2(seat.x - sp.x, seat.z - sp.z);
  parts.giantStone.push(sg.applyMatrix4(new THREE.Matrix4().makeRotationY(toThrone).setPosition(sp.x, sp.y - 0.2, sp.z)));
  collision.addCircle(sp.x, sp.z, 1.0, lo, hi);
  for (const [mat, list] of Object.entries(parts)) if (list.length) scene.add(new THREE.Mesh(mergeGeometries(list), M[mat]));

  // ---- the chain up from the village side
  const chain = chainPoints(terrain);
  return {
    chain,
    arena: onFloor(0, 0, 25),
    throne: seat,
    statue: sp,
    regentAt: onFloor(0, 0, 21),
    guards: [[-24, 0], [24, -2], [-6, -26], [8, -28], [28, 18]].map(([lx, lz]) => onFloor(lx, 0, lz)),
    name: L('ปราสาทแขวนฟ้า', 'Sky-Hung Castle'),
  };
}

// the snapped chain lying where it fell: from its anchor, out across the shore toward the lake
export function buildFallenChain(scene, M, terrain) {
  const a = SNAP_A;
  const gx = CASTLE.x + Math.cos(a) * 105, gz = CASTLE.z + Math.sin(a) * 105;
  const geoms = [];
  const up = new THREE.Vector3(0, 1, 0);
  let x = gx, z = gz, dir = a + Math.PI + 0.5;
  const pts = [];
  for (let i = 0; i < 34; i++) {
    pts.push([x, z]);
    dir += Math.sin(i * 0.45) * 0.12;
    x += Math.cos(dir) * 2.4; z += Math.sin(dir) * 2.4;
  }
  pts.forEach(([px, pz], i) => {
    const [nx, nz] = pts[Math.min(pts.length - 1, i + 1)];
    const tan = new THREE.Vector3(nx - px, 0, nz - pz).normalize();
    const g = new THREE.TorusGeometry(1.15, 0.3, 4, 8);
    g.scale(1, 1.55, 1);
    g.rotateY((i % 2) * Math.PI / 2);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, tan));
    g.translate(px, terrain.getHeight(px, pz) + 0.5, pz);
    geoms.push(part(g, C(0.55, 0.56, 0.62)));
  });
  const mesh = new THREE.Mesh(mergeGeometries(geoms), M.giantMetal);
  scene.add(mesh);
  const end = pts[pts.length - 1];
  return { mesh, end: new THREE.Vector3(end[0], terrain.getHeight(end[0], end[1]), end[1]), mid: new THREE.Vector3(pts[12][0], terrain.getHeight(pts[12][0], pts[12][1]), pts[12][1]) };
}
