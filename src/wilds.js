// Landmarks of the wild beyond the valley (the 1600 m world): a bell tower you can climb on the
// northern highland, a ring of standing stones, an abandoned windmill and its farms in the east,
// a drowned city with a half-sunken causeway in the southern lake, and in the western forest
// the hanging tree and the camp of a hunter who never came back.
import * as THREE from 'three';
import { part, boxGeom, mergeGeometries } from './util.js';
import { block, slab, r } from './builder.js';
import { gable, cyl } from './giants.js';
import { BELLTOWER, STONES, WINDMILL, FARMS, DROWNED, PIER, HANGTREE, HUNTER, ROADS } from './layout.js';

const C = (r_, g, b) => new THREE.Color(r_, g, b);
const DARKWIN = C(0.03, 0.03, 0.05);
const GHOST = C(0.35, 0.95, 0.65);
const WARM = C(1.3, 0.72, 0.3);

// local -> world for a structure centred at (x, z) rotated by ry
const frame = (x, z, ry) => (lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];
const UP = new THREE.Vector3(0, 1, 0);

// a cylinder running from a to b (branches, beams, logs)
function limb(B, mat, a, b, r0, r1, color, seg = 7) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const g = cyl(r0, r1, len, seg, 3);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  B.add(mat, part(g, color, { pos: [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2] }));
}

function sprite(scene, mat, fx, x, y, z, size) {
  const s = new THREE.Sprite(mat);
  s.position.set(x, y, z);
  s.scale.setScalar(size);
  scene.add(s);
  fx.fires.push({ s, base: size, ph: r() * 6 });
  return s;
}

function lantern(B, scene, M, fx, x, y, z) {
  B.add('glow', part(new THREE.BoxGeometry(0.22, 0.3, 0.22), C(1.4, 0.8, 0.35), { pos: [x, y, z] }));
  sprite(scene, M.candleSprite, fx, x, y, z, 1.6);
}

// ---------------------------------------------------------------- north: the bell tower
// A hollow stone tower with a stair winding up its inside to an open belfry: the highest point
// you can stand on, with the whole world below you.
function bellTower(B, Cw, T, scene, M, fx) {
  const { x, z } = BELLTOWER;
  const g = T.getHeight(x, z), ry = 0.18;
  const W = frame(x, z, ry);
  const tint = () => C(0.74 + r() * 0.12, 0.76 + r() * 0.1, 0.82 + r() * 0.1);
  slab(B, Cw, 'stone', x, z, 13, 13, g - 1.5, g - 0.15, { ry, color: C(0.6, 0.6, 0.64) });   // two low steps up to the door
  slab(B, Cw, 'stone', x, z, 9.6, 9.6, g - 1.5, g + 0.25, { ry, color: C(0.66, 0.66, 0.7) });
  const y0 = g + 0.25, TOP = 18;
  const piece = (mat, lx, lz, w, d, bot, top, color = tint(), collide = true) => {
    const [wx, wz] = W(lx, lz);
    slab(B, Cw, mat, wx, wz, w, d, y0 + bot, y0 + top, { ry, color, collide });
  };
  // the shaft: 6 m square, 0.8 m walls, a door in the south face
  piece('giantStone', 0, -2.6, 6, 0.8, 0, TOP);
  piece('giantStone', 2.6, 0, 0.8, 4.4, 0, TOP);
  piece('giantStone', -2.6, 0, 0.8, 4.4, 0, TOP);
  piece('giantStone', -1.85, 2.6, 2.3, 0.8, 0, TOP);
  piece('giantStone', 1.85, 2.6, 2.3, 0.8, 0, TOP);
  piece('giantStone', 0, 2.6, 1.4, 0.8, 2.6, TOP);
  piece('stone', 0, 0, 1.6, 1.6, 0, TOP, C(0.6, 0.6, 0.64));               // the newel the stair winds round
  // slit windows
  for (const [lx, lz, h, rot] of [[0, -3.02, 7, 0], [3.02, 0, 11, Math.PI / 2], [-3.02, 0, 5, Math.PI / 2], [0, 3.02, 13, 0], [0, -3.02, 14, 0]]) {
    const [wx, wz] = W(lx, lz);
    B.add('glow', part(new THREE.BoxGeometry(0.35, 1.3, 0.1), DARKWIN, { pos: [wx, y0 + h, wz], rot: [0, ry + rot, 0] }));
  }
  // the stair: 40 steps of 0.45 m round a 1.5 m square lane, starting just inside the door
  const lane = (s) => {
    s = ((s % 12) + 12) % 12;
    if (s < 1.5) return [s, 1.5];
    if (s < 4.5) return [1.5, 1.5 - (s - 1.5)];
    if (s < 7.5) return [1.5 - (s - 4.5), -1.5];
    if (s < 10.5) return [-1.5, -1.5 + (s - 7.5)];
    return [-1.5 + (s - 10.5), 1.5];
  };
  const RISE = 0.45, N = Math.round(TOP / RISE);
  for (let i = 0; i < N; i++) {
    const [lx, lz] = lane(1 + i), top = (i + 1) * RISE;
    piece('stone', lx, lz, 1.4, 1.4, top - 0.35, top, C(0.7 + r() * 0.15, 0.7 + r() * 0.12, 0.72 + r() * 0.12));
  }
  // belfry floor, open over the last turn of the stair
  for (let k = 0; k < 12; k++) {
    const s = k + 0.5;
    if (s < 5 || s > 11) continue;
    const [lx, lz] = lane(s);
    piece('wood', lx, lz, 1.4, 1.4, TOP - 0.3, TOP, C(0.5, 0.42, 0.36));
  }
  // belfry: corner piers, a parapet, a ceiling and a slate spire
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) piece('giantStone', sx * 2.4, sz * 2.4, 1.2, 1.2, TOP, TOP + 4.2);
  piece('stone', 0, -2.75, 3.6, 0.5, TOP, TOP + 1.0);
  piece('stone', 0, 2.75, 3.6, 0.5, TOP, TOP + 1.0);
  piece('stone', 2.75, 0, 0.5, 3.6, TOP, TOP + 1.0);
  piece('stone', -2.75, 0, 0.5, 3.6, TOP, TOP + 1.0);
  piece('giantStone', 0, 0, 6.6, 6.6, TOP + 4.2, TOP + 4.7, tint(), false);
  B.add('giantWood', part(new THREE.ConeGeometry(4.9, 8, 4, 1), C(0.32, 0.3, 0.36), { pos: [x, y0 + TOP + 4.7 + 4, z], rot: [0, ry + Math.PI / 4, 0] }));
  // the bell, still hanging from its yoke
  const bell = new THREE.LatheGeometry([
    new THREE.Vector2(0.001, 1.5), new THREE.Vector2(0.45, 1.45), new THREE.Vector2(0.6, 1.2), new THREE.Vector2(0.65, 0.7),
    new THREE.Vector2(0.82, 0.25), new THREE.Vector2(1.02, 0.0), new THREE.Vector2(0.96, -0.05), new THREE.Vector2(0.55, 0.15),
  ], 12);
  B.add('metal', part(bell, C(0.85, 0.66, 0.42), { pos: [x, y0 + TOP + 2.45, z] }));
  {
    const [ax, az] = W(-2.4, 0), [bx, bz] = W(2.4, 0);
    limb(B, 'wood', new THREE.Vector3(ax, y0 + TOP + 3.95, az), new THREE.Vector3(bx, y0 + TOP + 3.95, bz), 0.18, 0.18, C(0.45, 0.36, 0.3), 5);
  }
  {
    const [lx, lz] = W(-1.75, -1.75);
    lantern(B, scene, M, fx, lx, y0 + TOP + 2.2, lz);
    const [dx, dz] = W(1.1, 3.25);
    lantern(B, scene, M, fx, dx, y0 + 2.4, dz);
  }
  // the chapel that stood beside it, and its graves
  const chapel = [[-9, -1, 0.4, 8, 6.5], [-13, 3, 1.57, 7, 3.2], [-9, 7, 0.4, 5, 2.2], [-5.2, 6.4, 1.57, 2, 4.5]];
  for (const [lx, lz, rot, len, h] of chapel) {
    const [wx, wz] = W(lx, lz), gg = T.getHeight(wx, wz);
    slab(B, Cw, 'stone', wx, wz, len, 0.8, gg - 0.8, gg + h, { ry: ry + rot, color: tint() });
  }
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI * 0.95 + r() * Math.PI * 0.9, d = 9 + r() * 9;
    const [wx, wz] = W(Math.cos(a) * d, Math.sin(a) * d);
    const gg = T.getHeight(wx, wz);
    block(B, Cw, 'stone', { x: wx, y: gg + 0.4, z: wz, w: 0.7, h: 1.1, d: 0.2, ry: ry + (r() - 0.5) * 0.4, rx: (r() - 0.5) * 0.35, rz: (r() - 0.5) * 0.3, collide: false });
  }
}

// ---------------------------------------------------------------- north-west: the standing stones
function standingStones(B, Cw, T, scene, M, fx) {
  const { x, z } = STONES;
  const n = 13, R = 13, tops = [];
  const grey = () => C(0.68 + r() * 0.1, 0.72 + r() * 0.1, 0.8 + r() * 0.1);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.1;
    const px = x + Math.cos(a) * R, pz = z + Math.sin(a) * R, g = T.getHeight(px, pz);
    const ry = Math.atan2(-Math.cos(a), -Math.sin(a));
    if (i === 4 || i === 9) {
      // toppled, lying where it fell
      block(B, Cw, 'giantStone', { x: px + Math.cos(a) * 2.4, y: g + 0.35, z: pz + Math.sin(a) * 2.4, w: 1.7, h: 0.9, d: 5, ry, rz: 0.08, color: grey() });
      tops.push(null);
      continue;
    }
    const h = 4.2 + r() * 1.8;
    slab(B, Cw, 'giantStone', px, pz, 1.8, 0.95, g - 1, g + h, { ry, rz: (r() - 0.5) * 0.08, color: grey() });
    tops.push({ x: px, z: pz, y: g + h });
  }
  for (const [i, j] of [[0, 1], [6, 7], [10, 11]]) {
    const a = tops[i], b = tops[j];
    if (!a || !b) continue;
    const len = Math.hypot(b.x - a.x, b.z - a.z) + 1.6;
    block(B, Cw, 'giantStone', { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) + 0.4, z: (a.z + b.z) / 2, w: len, h: 0.8, d: 1.0, ry: Math.atan2(-(b.z - a.z), b.x - a.x), color: grey(), collide: false });
  }
  // the altar at the heart of the ring, its runes still faintly lit
  const g = T.getHeight(x, z);
  slab(B, Cw, 'stone', x, z, 3.2, 1.6, g - 0.6, g + 1.0, { ry: 0.3, color: C(0.6, 0.62, 0.68) });
  for (let k = 0; k < 4; k++) {
    B.add('glow', part(new THREE.BoxGeometry(0.4, 0.04, 0.22), C(0.45, 0.75, 1.15), { pos: [x + (k - 1.5) * 0.65 * Math.cos(0.3), g + 1.02, z - (k - 1.5) * 0.65 * Math.sin(0.3)], rot: [0, 0.3, 0] }));
  }
  const mist = new THREE.Sprite(M.mistSprite);
  mist.position.set(x, g + 1.6, z);
  mist.scale.setScalar(9);
  scene.add(mist);
  fx.mists.push({ s: mist, base: 9, ph: r() * 6 });
  // an outer ring of small stones
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2, px = x + Math.cos(a) * 21, pz = z + Math.sin(a) * 21, gg = T.getHeight(px, pz);
    block(B, Cw, 'stone', { x: px, y: gg + 0.3, z: pz, w: 0.7, h: 1.1, d: 0.6, ry: a, rz: (r() - 0.5) * 0.2, color: grey(), collide: false });
  }
}

// ---------------------------------------------------------------- east: the windmill
function windmill(B, Cw, T, scene, M, fx) {
  const { x, z } = WINDMILL;
  const g = T.getHeight(x, z);
  B.add('giantStone', part(cyl(4.2, 3.0, 14.5, 12, 4), C(0.86, 0.82, 0.76), { pos: [x, g - 1 + 7.25, z] }));
  Cw.addCircle(x, z, 4.1);
  B.add('giantWood', part(gable(7, 3.4, 3.2), C(0.36, 0.3, 0.28), { pos: [x, g + 13.3, z] }));
  // door and windows on the side facing the valley
  B.add('plain', part(new THREE.BoxGeometry(0.1, 2.3, 1.3), C(0.1, 0.07, 0.05), { pos: [x - 4.05, g + 1.15, z] }));
  for (const [h, a] of [[5.5, Math.PI], [8.5, Math.PI * 0.5], [10.5, Math.PI * 1.3]]) {
    const rr = 4.2 - (h + 1) / 14.5 * 1.2 + 0.05;
    B.add('glow', part(new THREE.BoxGeometry(0.12, 1.0, 0.7), DARKWIN, { pos: [x + Math.cos(a) * rr, g + h, z + Math.sin(a) * rr], rot: [0, -a, 0] }));
  }
  // the sails turn in the wind on their own mesh (spun in main.js)
  const wood = [], cloth = [];
  wood.push(part(boxGeom(0.9, 0.9, 1.6, 1), C(0.4, 0.32, 0.27), { pos: [0, 0, 0.4] }));
  for (let k = 0; k < 4; k++) {
    const th = (k * Math.PI) / 2, dx = -Math.sin(th), dy = Math.cos(th), sx = Math.cos(th), sy = Math.sin(th);
    wood.push(part(boxGeom(0.3, 10.5, 0.28, 2), C(0.5, 0.4, 0.33), { pos: [dx * 5.4, dy * 5.4, 0], rot: [0, 0, th] }));
    for (let j = 0; j < 7; j++) wood.push(part(boxGeom(2.2, 0.1, 0.1, 2), C(0.45, 0.36, 0.3), { pos: [dx * (3 + j * 1.2) + sx * 1.0, dy * (3 + j * 1.2) + sy * 1.0, 0.05], rot: [0, 0, th] }));
    if (k === 2) continue;                                    // one sail torn clean away
    const len = k === 1 ? 4 : 7.5, at = 2.8 + len / 2;
    cloth.push(part(boxGeom(1.9, len, 0.04, 2), C(0.78, 0.72, 0.62), { pos: [dx * at + sx * 1.05, dy * at + sy * 1.05, 0.1], rot: [0, 0, th] }));
  }
  const rotor = new THREE.Group();
  rotor.add(new THREE.Mesh(mergeGeometries(wood), M.wood), new THREE.Mesh(mergeGeometries(cloth), M.plain));
  const hub = new THREE.Group();
  hub.position.set(x - 4.0, g + 14.2, z);
  hub.rotation.y = -Math.PI / 2;
  hub.add(rotor);
  scene.add(hub);
  (fx.spins ||= []).push({ o: rotor, v: 0.35 });
  // the torn-off sail, put back when the story mends the mill (src/quests.js)
  fx.windmill = {
    addSail() {
      if (this.done) return;
      this.done = true;
      const th = Math.PI, dx = -Math.sin(th), dy = Math.cos(th), sx = Math.cos(th), sy = Math.sin(th), at = 2.8 + 3.75;
      rotor.add(new THREE.Mesh(part(boxGeom(1.9, 7.5, 0.04, 2), C(0.86, 0.8, 0.68), { pos: [dx * at + sx * 1.05, dy * at + sy * 1.05, 0.1], rot: [0, 0, th] }), M.plain));
    },
  };
  // sacks and a broken cart at its foot
  for (let i = 0; i < 5; i++) {
    const sx = x - 6 + (r() - 0.5) * 3, sz = z + 3 + (r() - 0.5) * 3;
    B.add('plain', part(new THREE.SphereGeometry(0.45, 6, 4), C(0.7, 0.6, 0.45), { pos: [sx, T.getHeight(sx, sz) + 0.3, sz], scale: [1, 1.3, 0.9] }));
  }
  const cx = x - 9, cz = z - 5, cg = T.getHeight(cx, cz);
  block(B, Cw, 'wood', { x: cx, y: cg + 0.75, z: cz, w: 1.8, h: 0.2, d: 3.2, ry: 0.5, rz: 0.2, color: C(0.55, 0.44, 0.35) });
  B.add('wood', part(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 8), C(0.45, 0.36, 0.3), { pos: [cx + 0.9, cg + 0.55, cz - 0.4], rot: [0, 0.5, Math.PI / 2] }));
}

// ---------------------------------------------------------------- east: the farms
function farms(B, Cw, T, scene, M, fx) {
  const { x, z } = FARMS;
  const G = (px, pz) => T.getHeight(px, pz);
  // the farmhouse, roofless
  {
    const ry = 0.3, W = frame(x - 22, z - 18, ry), g = G(...W(0, 0));
    const wall = (lx, lz, w, d, h) => { const [wx, wz] = W(lx, lz); slab(B, Cw, 'stone', wx, wz, w, d, g - 1, g + h, { ry, color: C(0.82, 0.78, 0.72) }); };
    wall(0, -3, 8, 0.6, 3.4); wall(-3.7, 0, 0.6, 5.4, 3.0); wall(3.7, -1.2, 0.6, 3, 3.4);
    wall(-2.4, 3, 3.2, 0.6, 2.2); wall(2.6, 3, 2.2, 0.6, 1.2);
    const [chx, chz] = W(3.2, -2.4);
    block(B, Cw, 'stone', { x: chx, y: g + 3.5, z: chz, w: 1.0, h: 7, d: 1.0, ry });
    for (const [lx, lz, rz] of [[-1, -1, 0.5], [1.5, 1, -0.35]]) {
      const [wx, wz] = W(lx, lz);
      block(B, Cw, 'wood', { x: wx, y: g + 1.6, z: wz, w: 7.5, h: 0.25, d: 0.25, ry, rz, color: C(0.35, 0.28, 0.24), collide: false });
    }
    const [lx, lz] = W(-0.6, 3.5);
    lantern(B, scene, M, fx, lx, g + 2.3, lz);
  }
  // the barn, its roof slumped to one side
  {
    const ry = -0.2, W = frame(x + 18, z - 24, ry), g = G(...W(0, 0));
    const wall = (lx, lz, w, d, h) => { const [wx, wz] = W(lx, lz); slab(B, Cw, 'wood', wx, wz, w, d, g - 0.5, g + h, { ry, color: C(0.55, 0.36, 0.3) }); };
    wall(0, -4, 12, 0.4, 4.2); wall(-6, 0, 0.4, 8, 4.2); wall(6, 0, 0.4, 8, 3.0);
    wall(-3.8, 4, 4.4, 0.4, 4.2); wall(3.8, 4, 4.4, 0.4, 4.2);
    const [rx, rz] = W(-0.5, 0);
    B.add('wood', part(gable(12.8, 4.6, 3.4), C(0.32, 0.25, 0.22), { pos: [rx, g + 3.4, rz], rot: [0, ry, -0.12] }));
    for (let i = 0; i < 3; i++) {
      const [hx, hz] = W(-3 + i * 2.6, -1);
      B.add('plain', part(boxGeom(1.4, 0.9, 1.0, 1), C(0.85, 0.7, 0.4), { pos: [hx, g + 0.45, hz], rot: [0, ry + (r() - 0.5) * 0.4, 0] }));
    }
  }
  // fields of dead corn, fenced
  const corn = [];
  const plots = [[-12, 14, 24, 18], [20, 10, 20, 16], [4, 38, 30, 14]];
  for (const [px, pz, w, d] of plots) {
    const cx = x + px, cz = z + pz;
    for (let ix = -w / 2 + 0.8; ix < w / 2; ix += 1.6) {
      for (let iz = -d / 2 + 0.6; iz < d / 2; iz += 1.2) {
        if (r() < 0.16) continue;
        const sx = cx + ix + (r() - 0.5) * 0.4, sz = cz + iz + (r() - 0.5) * 0.4, g = G(sx, sz);
        const h = 1.7 + r() * 0.8, a = r() * 3, tint = C(0.95 + r() * 0.2, 0.78 + r() * 0.15, 0.42 + r() * 0.1);
        for (const q of [0, Math.PI / 2]) corn.push(part(new THREE.PlaneGeometry(0.7, h), tint, { pos: [sx, g + h / 2 - 0.05, sz], rot: [(r() - 0.5) * 0.15, a + q, 0] }));
      }
    }
    // the fence round each plot, broken in places
    const ring = [[-w / 2 - 1, -d / 2 - 1], [w / 2 + 1, -d / 2 - 1], [w / 2 + 1, d / 2 + 1], [-w / 2 - 1, d / 2 + 1]];
    for (let s = 0; s < 4; s++) {
      const [ax, az] = ring[s], [bx, bz] = ring[(s + 1) % 4];
      const len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 2.6);
      for (let k = 0; k <= n; k++) {
        if (r() < 0.14) continue;
        const t = k / n, fx_ = cx + ax + (bx - ax) * t, fz = cz + az + (bz - az) * t, g = G(fx_, fz);
        block(B, Cw, 'wood', { x: fx_, y: g + 0.55, z: fz, w: 0.14, h: 1.3, d: 0.14, rz: (r() - 0.5) * 0.2, collide: false });
        if (k < n && r() > 0.25) {
          const ry = Math.atan2(-(bz - az), bx - ax), mx = fx_ + (bx - ax) / n / 2, mz = fz + (bz - az) / n / 2;
          block(B, Cw, 'wood', { x: mx, y: G(mx, mz) + 0.8, z: mz, w: len / n, h: 0.1, d: 0.08, ry, rz: (r() - 0.5) * 0.12, collide: false });
        }
      }
    }
  }
  B.add('grass', mergeGeometries(corn));
  // haystacks and a well
  for (const [hx, hz] of [[x - 4, z - 6], [x + 4, z - 9], [x + 36, z + 26], [x - 30, z + 30]]) {
    const g = G(hx, hz);
    const hay = new THREE.LatheGeometry([new THREE.Vector2(1.9, 0), new THREE.Vector2(2.0, 0.8), new THREE.Vector2(1.6, 2.0), new THREE.Vector2(0.8, 2.9), new THREE.Vector2(0.001, 3.2)], 9);
    B.add('plain', part(hay, C(0.85, 0.7, 0.4), { pos: [hx, g - 0.1, hz], rot: [0, r() * 3, 0] }));
    Cw.addCircle(hx, hz, 1.9);
  }
  const wx = x + 2, wz = z - 2, wg = G(wx, wz);
  B.add('stone', part(cyl(1.2, 1.2, 1.0, 12, 1.5), C(0.82, 0.8, 0.78), { pos: [wx, wg + 0.5, wz] }));
  B.add('plain', part(new THREE.CircleGeometry(1.0, 12), C(0.02, 0.03, 0.05), { pos: [wx, wg + 0.9, wz], rot: [-Math.PI / 2, 0, 0] }));
  Cw.addCircle(wx, wz, 1.4);
}

// ---------------------------------------------------------------- south: the pier and the drowned city
function pier(B, Cw, T, scene, M, fx) {
  const { x, z } = PIER;
  const dx = DROWNED.x - x, dz = DROWNED.z - z, ry = Math.atan2(dx, dz);
  const W = frame(x, z, ry), DECK = 1.0, LEN = 34;
  // the deck is one walkable box; the planks on it are only for show
  const [mx, mz] = W(0, LEN / 2 - 2);
  block(B, Cw, 'wood', { x: mx, y: DECK - 0.15, z: mz, w: 2.8, h: 0.3, d: LEN + 4, ry, color: C(0.38, 0.3, 0.26) });
  for (let k = -2; k < LEN + 2; k += 0.5) {
    if (r() < 0.08) continue;
    const [px, pz] = W((r() - 0.5) * 0.2, k);
    B.add('wood', part(boxGeom(2.9, 0.06, 0.42, 1.5), C(0.55 + r() * 0.2, 0.45 + r() * 0.15, 0.38 + r() * 0.1), { pos: [px, DECK + 0.01, pz], rot: [0, ry + (r() - 0.5) * 0.06, (r() - 0.5) * 0.05] }));
  }
  for (let k = 0; k <= LEN; k += 3) {
    for (const s of [-1.5, 1.5]) {
      const [px, pz] = W(s, k);
      const g = T.getHeight(px, pz);
      block(B, Cw, 'wood', { x: px, y: (g + DECK + 0.6) / 2 - 0.4, z: pz, w: 0.3, h: DECK + 1.4 - g, d: 0.3, ry, rx: (r() - 0.5) * 0.08, collide: false });
    }
  }
  const [ex, ez] = W(1.5, LEN);
  block(B, Cw, 'wood', { x: ex, y: DECK + 1.1, z: ez, w: 0.2, h: 2.2, d: 0.2, ry });
  lantern(B, scene, M, fx, ex + Math.sin(ry) * 0.3, DECK + 2.0, ez + Math.cos(ry) * 0.3);
  // a sunken boat beside it, and the ferryman's shack on the shore
  const [bx, bz] = W(5, LEN - 6);
  B.add('wood', part(boxGeom(1.8, 0.7, 5, 1.5), C(0.4, 0.32, 0.28), { pos: [bx, -0.15, bz], rot: [0.12, ry + 0.4, 0.35] }));
  const sw = frame(...W(-6, -7), ry), sg = T.getHeight(...sw(0, 0));
  const [hx, hz] = sw(0, 0);
  slab(B, Cw, 'wood', hx, hz, 4, 3.6, sg - 0.5, sg + 2.6, { ry, color: C(0.5, 0.38, 0.32) });
  B.add('wood', part(gable(4.6, 2.3, 1.6), C(0.32, 0.26, 0.24), { pos: [hx, sg + 2.6, hz], rot: [0, ry + Math.PI / 2, 0] }));
  const [lx, lz] = sw(0, 1.9);
  B.add('glow', part(new THREE.BoxGeometry(0.7, 0.8, 0.1), WARM, { pos: [lx, sg + 1.5, lz], rot: [0, ry, 0] }));
  return W(0, LEN + 1.5);
}

function drownedCity(B, Cw, T, scene, M, fx, pierEnd) {
  const { x, z } = DROWNED;
  const sunk = () => C(0.56 + r() * 0.1, 0.66 + r() * 0.08, 0.62 + r() * 0.08);
  const towers = [
    [0, 0, 5.2, 30, 'cone'], [-34, -18, 3.5, 18, 'broken'], [30, -26, 3.2, 14, 'cone'], [-22, 32, 4, 22, 'broken'],
    [38, 22, 3, 11, 'broken'], [-52, 8, 2.6, 9, 'cone'], [10, 46, 3, 16, 'cone'], [-60, -36, 3.4, 13, 'broken'],
  ];
  for (const [lx, lz, rad, h, roof] of towers) {
    const tx = x + lx, tz = z + lz, g = T.getHeight(tx, tz);
    const tilt = [(r() - 0.5) * 0.12, 0, (r() - 0.5) * 0.12];
    B.add('giantStone', part(cyl(rad, rad * 0.88, h - g + 1, 10, 4), sunk(), { pos: [tx, (g - 1 + h) / 2, tz], rot: tilt }));
    Cw.addCircle(tx, tz, rad);
    if (roof === 'cone') {
      B.add('giantStone', part(cyl(rad * 1.12, rad * 1.12, 0.6, 10, 4), sunk(), { pos: [tx, h + 0.3, tz], rot: tilt }));
      B.add('giantWood', part(new THREE.ConeGeometry(rad * 1.25, rad * 2.4, 10), C(0.3, 0.34, 0.38), { pos: [tx, h + 0.6 + rad * 1.2, tz], rot: tilt }));
    } else {
      for (let k = 0; k < 6; k++) {
        if (r() < 0.3) continue;
        const a = (k / 6) * Math.PI * 2, bh = 0.8 + r() * 2.4;
        B.add('giantStone', part(boxGeom(rad * 0.9, bh, 0.7, 3), sunk(), { pos: [tx + Math.cos(a) * rad * 0.82, h + bh / 2, tz + Math.sin(a) * rad * 0.82], rot: [0, -a + Math.PI / 2, 0] }));
      }
    }
    // windows, a few lit by something that is not a candle
    for (let k = 0; k < 4; k++) {
      const a = r() * Math.PI * 2, wy = 2 + r() * (h - 4);
      B.add('glow', part(new THREE.BoxGeometry(0.15, 1.2, 0.7), r() < 0.25 ? GHOST : DARKWIN, { pos: [tx + Math.cos(a) * (rad * 0.94 + 0.04), wy, tz + Math.sin(a) * (rad * 0.94 + 0.04)], rot: [0, -a, 0] }));
    }
  }
  // the cathedral: a roofless nave of piers and arches with its spire at the west end
  {
    const ry = 0.15, W = frame(x + 34, z - 52, ry), g = T.getHeight(...W(0, 0));
    for (const side of [-6, 6]) {
      for (let k = -15; k <= 15; k += 5) {
        const [px, pz] = W(k, side);
        slab(B, Cw, 'giantStone', px, pz, 1.6, 1.4, g - 1, 9.5, { ry, color: sunk() });
        if (k < 15) {
          const [ax, az] = W(k + 2.5, side);
          slab(B, Cw, 'giantStone', ax, az, 3.6, 1.0, g - 1, 1.6, { ry, color: sunk() });
          block(B, Cw, 'giantStone', { x: ax, y: 8.3, z: az, w: 3.6, h: 2.4, d: 1.0, ry, color: sunk(), collide: false });
        }
      }
    }
    const [ex, ez] = W(16, 0);
    slab(B, Cw, 'giantStone', ex, ez, 1.4, 13, g - 1, 11, { ry, color: sunk() });
    B.add('glow', part(new THREE.CircleGeometry(2, 10), GHOST, { pos: [ex - Math.cos(ry) * 0.75, 7.5, ez + Math.sin(ry) * 0.75], rot: [0, ry - Math.PI / 2, 0] }));
    for (let k = -10; k <= 10; k += 6) {
      const [ax, az] = W(k, -6), [bx, bz] = W(k + 1.5, 6);
      limb(B, 'giantWood', new THREE.Vector3(ax, 9.6, az), new THREE.Vector3(bx, 8.4 + r() * 1.5, bz), 0.3, 0.3, C(0.3, 0.26, 0.24), 5);
    }
    const [dx, dz] = W(11, 0);
    slab(B, Cw, 'stone', dx, dz, 6, 8, g - 0.6, 0.45, { ry, color: sunk() });       // the altar dais, just above the flood
    const [sx, sz] = W(-19, 0), sg = T.getHeight(sx, sz);
    B.add('giantStone', part(cyl(3.8, 3.4, 26 - sg + 1, 8, 4), sunk(), { pos: [sx, (sg - 1 + 26) / 2, sz] }));
    B.add('giantWood', part(new THREE.ConeGeometry(4.2, 18, 8), C(0.28, 0.32, 0.36), { pos: [sx, 26 + 9, sz] }));
    Cw.addCircle(sx, sz, 3.8);
  }
  {
    const lx = x + 7.5, lz = z - 7.5, g = T.getHeight(lx, lz);
    slab(B, Cw, 'stone', lx, lz, 4, 4, g - 0.6, 0.35, { ry: 0.6, color: sunk() });  // a landing at the great tower's door
  }
  // a half-sunken causeway from the end of the pier to the great tower: some blocks still stand
  // proud of the water, the rest have slumped just beneath it (a step down, a step up)
  const [px, pz] = pierEnd, tx = x + 6, tz = z - 6;
  const len = Math.hypot(tx - px, tz - pz), n = Math.floor(len / 2), ry = Math.atan2(tx - px, tz - pz);
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n, bx = px + (tx - px) * t + Math.cos(ry) * Math.sin(k * 0.7) * 0.6, bz = pz + (tz - pz) * t - Math.sin(ry) * Math.sin(k * 0.7) * 0.6;
    const top = r() < 0.22 ? -0.32 : 0.28, g = T.getHeight(bx, bz);
    slab(B, Cw, 'stone', bx, bz, 2.4, 2.3, Math.min(g, top) - 0.6, top, { ry: ry + (r() - 0.5) * 0.12, color: sunk() });
  }
}

// ---------------------------------------------------------------- west: the hanging tree
function hangingTree(B, Cw, T, scene, M, fx) {
  const { x, z } = HANGTREE;
  const g = T.getHeight(x, z);
  const bark = C(0.42, 0.38, 0.36);
  const trunk = new THREE.LatheGeometry([
    new THREE.Vector2(3.2, -0.5), new THREE.Vector2(2.3, 0.6), new THREE.Vector2(1.8, 3), new THREE.Vector2(1.5, 7),
    new THREE.Vector2(1.25, 10), new THREE.Vector2(0.8, 13), new THREE.Vector2(0.2, 15),
  ], 9);
  const uv = trunk.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 5);
  B.add('bark', part(trunk, bark, { pos: [x, g, z] }));
  Cw.addCircle(x, z, 2.2);
  const V = (a, e, d, base) => new THREE.Vector3(base.x + Math.cos(a) * Math.cos(e) * d, base.y + Math.sin(e) * d, base.z + Math.sin(a) * Math.cos(e) * d);
  const hangs = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r() * 0.5, e = 0.15 + r() * 0.35, L = 7 + r() * 4;
    const base = new THREE.Vector3(x, g + 7 + i * 0.8, z), tip = V(a, e, L, base);
    limb(B, 'bark', base, tip, 0.75, 0.25, bark);
    const twig = V(a + 0.6, e + 0.3, 3.5, tip);
    limb(B, 'bark', tip, twig, 0.25, 0.08, bark, 5);
    for (const t of [0.55, 0.85]) if (r() < 0.8) hangs.push(new THREE.Vector3().lerpVectors(base, tip, t));
    // roots
    const ra = a + 0.3, rb = new THREE.Vector3(x + Math.cos(ra) * 1.5, g + 0.4, z + Math.sin(ra) * 1.5);
    limb(B, 'bark', rb, new THREE.Vector3(x + Math.cos(ra) * 6, g - 0.4, z + Math.sin(ra) * 6), 0.6, 0.15, bark, 5);
  }
  // the cocoons, wrapped tight, swinging a little on their ropes
  const cocoon = new THREE.LatheGeometry([
    new THREE.Vector2(0.001, -1.0), new THREE.Vector2(0.3, -0.75), new THREE.Vector2(0.45, -0.2),
    new THREE.Vector2(0.42, 0.4), new THREE.Vector2(0.25, 0.85), new THREE.Vector2(0.001, 1.0),
  ], 7);
  fx.cocoons = [];
  for (const p of hangs) {
    const rope = 1.5 + r() * 2.5;
    fx.cocoons.push(new THREE.Vector3(p.x, p.y - rope - 0.9, p.z));
    B.add('wood', part(boxGeom(0.05, rope, 0.05, 1), C(0.5, 0.45, 0.35), { pos: [p.x, p.y - rope / 2, p.z] }));
    B.add('plain', part(cocoon, C(0.74, 0.7, 0.6), { pos: [p.x, p.y - rope - 0.9, p.z], rot: [(r() - 0.5) * 0.2, r() * 3, (r() - 0.5) * 0.2] }));
  }
  // candles left at the roots by whoever still comes here
  for (let i = 0; i < 4; i++) {
    const a = r() * Math.PI * 2, cx = x + Math.cos(a) * 3.6, cz = z + Math.sin(a) * 3.6, cg = T.getHeight(cx, cz);
    B.add('plain', part(new THREE.CylinderGeometry(0.06, 0.07, 0.3, 5), C(0.9, 0.85, 0.7), { pos: [cx, cg + 0.15, cz] }));
    sprite(scene, M.candleSprite, fx, cx, cg + 0.42, cz, 0.7);
  }
  const mist = new THREE.Sprite(M.mistSprite);
  mist.position.set(x, g + 2, z);
  mist.scale.setScalar(14);
  scene.add(mist);
  fx.mists.push({ s: mist, base: 14, ph: r() * 6 });
}

// ---------------------------------------------------------------- west: the hunter's camp
function hunterCamp(B, Cw, T, scene, M, fx) {
  const { x, z } = HUNTER;
  const G = (px, pz) => T.getHeight(px, pz);
  // the tent
  {
    const tx = x - 4, tz = z - 3, g = G(tx, tz);
    B.add('cloth', part(gable(4.4, 1.9, 2.2), C(0.6, 0.5, 0.38), { pos: [tx, g, tz], rot: [0, 0.4, 0] }));
    Cw.addBox(tx, g + 1.1, tz, 2.2, 1.1, 1.2, 0.4);
  }
  // the fire, long cold but someone has lit it again
  {
    const g = G(x, z);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      B.add('stone', part(new THREE.DodecahedronGeometry(0.3, 0), C(0.6, 0.6, 0.62), { pos: [x + Math.cos(a) * 0.9, g + 0.1, z + Math.sin(a) * 0.9] }));
    }
    for (let k = 0; k < 3; k++) limb(B, 'wood', new THREE.Vector3(x - 0.5, g + 0.1, z + (k - 1) * 0.3), new THREE.Vector3(x + 0.5, g + 0.25, z - (k - 1) * 0.3), 0.08, 0.08, C(0.3, 0.22, 0.18), 5);
    B.add('glow', part(new THREE.CircleGeometry(0.6, 8), C(0.9, 0.35, 0.1), { pos: [x, g + 0.06, z], rot: [-Math.PI / 2, 0, 0] }));
    sprite(scene, M.fireSprite, fx, x, g + 0.7, z, 2.2);
    Cw.addCircle(x, z, 0.9, g - 1, g + 0.5);
    for (const [lx, lz, a] of [[2.6, 0.5, 1.3], [-0.5, 2.6, 0.2]]) {
      const lg = G(x + lx, z + lz);
      limb(B, 'bark', new THREE.Vector3(x + lx - Math.cos(a) * 1.1, lg + 0.25, z + lz + Math.sin(a) * 1.1), new THREE.Vector3(x + lx + Math.cos(a) * 1.1, lg + 0.25, z + lz - Math.sin(a) * 1.1), 0.25, 0.25, C(0.45, 0.38, 0.32), 6);
    }
  }
  // drying rack with pelts, a lean-to of branches
  {
    const rx = x + 4, rz = z - 3, g = G(rx, rz);
    for (const s of [-1.4, 1.4]) block(B, Cw, 'wood', { x: rx + s, y: g + 1.1, z: rz, w: 0.14, h: 2.2, d: 0.14, collide: false });
    block(B, Cw, 'wood', { x: rx, y: g + 2.1, z: rz, w: 3.2, h: 0.1, d: 0.1, collide: false });
    for (let k = 0; k < 3; k++) B.add('wool', part(boxGeom(0.7, 1.1, 0.04, 1), C(0.55, 0.42, 0.3), { pos: [rx - 0.9 + k * 0.9, g + 1.5, rz], rot: [0, 0, (r() - 0.5) * 0.15] }));
    const lx = x + 1, lz = z + 5, lg = G(lx, lz);
    block(B, Cw, 'wood', { x: lx, y: lg + 0.8, z: lz, w: 2.6, h: 0.12, d: 2.0, rx: 0.8, color: C(0.4, 0.32, 0.26), collide: false });
    lantern(B, scene, M, fx, lx + 1.6, lg + 1.6, lz - 0.6);
  }
}

// ---------------------------------------------------------------- wayside shrines along the roads
function shrines(B, Cw, T, scene, M, fx) {
  const spots = [];
  for (const road of ROADS) {
    for (let i = 1; i < road.length; i += 2) {
      const [ax, az] = road[i - 1], [bx, bz] = road[i];
      const len = Math.hypot(bx - ax, bz - az) || 1;
      spots.push([bx - (bz - az) / len * 4, bz + (bx - ax) / len * 4]);
    }
  }
  for (const [x, z] of spots) {
    if (Math.max(Math.abs(x), Math.abs(z)) < 300) continue;
    const g = T.getHeight(x, z);
    block(B, Cw, 'stone', { x, y: g + 0.8, z, w: 0.7, h: 1.9, d: 0.6, color: C(0.7, 0.7, 0.74) });
    B.add('stone', part(gable(0.9, 0.5, 0.4), C(0.5, 0.48, 0.5), { pos: [x, g + 1.75, z] }));
    B.add('glow', part(new THREE.BoxGeometry(0.3, 0.35, 0.05), WARM, { pos: [x, g + 1.25, z + 0.31] }));
    sprite(scene, M.candleSprite, fx, x, g + 1.25, z + 0.4, 0.9);
  }
}

// where the wild's treasure chests stand (placed by loot.js): [id, x, z, contents, reach]
export function wildChests() {
  const nave = frame(DROWNED.x + 34, DROWNED.z - 52, 0.15);
  return [
    ['belfry', BELLTOWER.x, BELLTOWER.z, [['star_shard', 1], ['potion_big', 1], ['wpn_b_funeral', 1]], 19],
    ['stones', STONES.x + 3, STONES.z + 2.5, [['moonstone', 1], ['essence', 3], ['wpn_k_black', 1]]],
    ['windmill', WINDMILL.x - 7, WINDMILL.z + 6, [['token', 2], ['tonic', 1]]],
    ['farmhouse', FARMS.x - 22, FARMS.z - 18, [['watch', 1], ['potion', 1]]],
    ['barn', FARMS.x + 18, FARMS.z - 26, [['straw', 3], ['oil', 1]]],
    ['pier', PIER.x - 3, PIER.z - 7, [['pearl', 1], ['slime', 2]]],
    ['drowned-tower', DROWNED.x + 7.5, DROWNED.z - 7.5, [['locket', 1], ['candlestick', 1]], 2],
    ['cathedral', ...nave(12, 0), [['idol', 1], ['potion_big', 1], ['wpn_c_drowned', 1]], 2],
    ['hangtree', HANGTREE.x + 4.5, HANGTREE.z - 5, [['blood_amber', 2], ['potion', 1]]],
    ['hunter', HUNTER.x + 2, HUNTER.z - 6.5, [['fang', 4], ['tonic', 1], ['sight', 1], ['wpn_h_light', 1]]],
  ];
}

// ---------------------------------------------------------------- the story's places (src/quests.js)
// Where the chapter's things are: the bell-ringer's grave, the bell, the stones' altar, the sail in
// the barn, the mill door, the fallen cocoon, Min's haystack, the ferryman, the three murals, the
// cathedral dais, the hunter's journal, where Oren waits.
export function storySpots(T) {
  const at = (x, z, dy = 0) => new THREE.Vector3(x, T.getHeight(x, z) + dy, z);
  const bt = frame(BELLTOWER.x, BELLTOWER.z, 0.18), gB = T.getHeight(BELLTOWER.x, BELLTOWER.z);
  const pr = frame(PIER.x, PIER.z, Math.atan2(DROWNED.x - PIER.x, DROWNED.z - PIER.z));
  const nave = frame(DROWNED.x + 34, DROWNED.z - 52, 0.15);
  const v = (xz, y) => new THREE.Vector3(xz[0], y, xz[1]);
  return {
    grave: at(...bt(-3, -9)),
    bell: new THREE.Vector3(BELLTOWER.x, gB + 0.25 + 18, BELLTOWER.z),
    stones: at(STONES.x, STONES.z),
    sail: at(FARMS.x + 18 + 3, FARMS.z - 24 - 2),
    millDoor: at(WINDMILL.x - 4.4, WINDMILL.z),
    cocoon: at(WINDMILL.x - 7, WINDMILL.z + 9),
    min: at(FARMS.x - 1.5, FARMS.z - 4.5),
    ferryman: v(pr(0.3, 32.5), 1.0),
    murals: [v(nave(-7.5, -5.0), 0.5), v(nave(2.5, 5.0), 0.5), v(nave(14.4, 0), 0.5)],
    dais: v(nave(11, 0), 0.45),
    journal: at(HUNTER.x + 1.6, HUNTER.z + 1.8),
    oren: at(-500, 19),
    cocoons: [],
  };
}

// things the story picks up or changes, kept out of the merged meshes so they can go
function storyProps(B, Cw, T, scene, M, fx) {
  const S = storySpots(T), props = {};
  // the bell-ringer's grave: a taller stone, with a candle still burning
  const gv = S.grave;
  block(B, Cw, 'stone', { x: gv.x, y: gv.y + 0.6, z: gv.z, w: 0.9, h: 1.5, d: 0.25, color: C(0.82, 0.8, 0.76), collide: false });
  lantern(B, scene, M, fx, gv.x + 0.6, gv.y + 0.3, gv.z + 0.4);
  // the torn sail, leaning inside the barn
  const sail = new THREE.Group();
  sail.add(new THREE.Mesh(part(boxGeom(0.3, 4.2, 0.28, 2), C(0.5, 0.4, 0.33), { pos: [0, 2.1, 0] }), M.wood));
  sail.add(new THREE.Mesh(part(boxGeom(1.6, 3.6, 0.04, 2), C(0.82, 0.76, 0.64), { pos: [0.9, 2.2, 0.05] }), M.plain));
  sail.position.copy(S.sail); sail.rotation.set(0, 0.4, 0.25);
  scene.add(sail); props.sail = sail;
  // the cocoon that fell from the sky under the mill
  const coc = new THREE.Mesh(part(new THREE.LatheGeometry([
    new THREE.Vector2(0.001, -1.0), new THREE.Vector2(0.3, -0.75), new THREE.Vector2(0.45, -0.2),
    new THREE.Vector2(0.42, 0.4), new THREE.Vector2(0.25, 0.85), new THREE.Vector2(0.001, 1.0),
  ], 7), C(0.74, 0.7, 0.6)), M.plain);
  coc.position.copy(S.cocoon).add(new THREE.Vector3(0, 0.4, 0)); coc.rotation.set(Math.PI / 2, 0.6, 0);
  scene.add(coc); props.cocoon = coc;
  // three murals in the nave
  const muralCol = [C(0.8, 0.72, 0.55), C(0.72, 0.62, 0.58), C(0.66, 0.6, 0.66)];
  S.murals.forEach((m, i) => {
    const ry = 0.15 + (i === 2 ? Math.PI / 2 : 0);
    block(B, Cw, 'stone', { x: m.x, y: 2.6, z: m.z, w: 3.2, h: 2.2, d: 0.12, ry, color: muralCol[i], collide: false });
    B.add('glow', part(new THREE.BoxGeometry(2.6, 0.06, 0.13), C(0.3, 0.7, 0.5), { pos: [m.x, 3.75, m.z], rot: [0, ry, 0] }));
  });
  // the hunter's journal on a log by the fire
  B.add('plain', part(new THREE.BoxGeometry(0.32, 0.06, 0.24), C(0.42, 0.28, 0.18), { pos: [S.journal.x, S.journal.y + 0.5, S.journal.z] }));
  fx.story = props;
}

export function buildWilds(B, Cw, terrain, scene, M, fx) {
  storyProps(B, Cw, terrain, scene, M, fx);
  bellTower(B, Cw, terrain, scene, M, fx);
  standingStones(B, Cw, terrain, scene, M, fx);
  windmill(B, Cw, terrain, scene, M, fx);
  farms(B, Cw, terrain, scene, M, fx);
  const end = pier(B, Cw, terrain, scene, M, fx);
  drownedCity(B, Cw, terrain, scene, M, fx, end);
  hangingTree(B, Cw, terrain, scene, M, fx);
  hunterCamp(B, Cw, terrain, scene, M, fx);
  shrines(B, Cw, terrain, scene, M, fx);
}
