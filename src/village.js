// The village by the dead station: a few timber houses, a well, lamp posts, and the
// "Melting Candle" inn whose barkeep has a head of candles (walk-in interior).
import * as THREE from 'three';
import { part } from './util.js';
import { block, slab, r } from './builder.js';
import { gable, cyl } from './giants.js';
import { TAVERN, HOUSES, SMITH } from './layout.js';
import { createCandleHead, createPatron, createSmith } from './characters.js';

const C = (r_, g, b) => new THREE.Color(r_, g, b);
const WARM = C(1.25, 0.62, 0.24);
const DARKWIN = C(0.03, 0.03, 0.05);

// local -> world for a structure centred at (x, z) rotated by ry
const frame = (x, z, ry) => (lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];

function house(B, Cw, terrain, hx, hz, ry) {
  const g = terrain.getHeight(hx, hz);
  const W = frame(hx, hz, ry);
  const [cx, cz] = W(0, 0);
  slab(B, Cw, 'stone', cx, cz, 7, 6, g - 1, g + 3.4, { ry });
  block(B, Cw, 'wood', { x: cx, y: g + 4.7, z: cz, w: 7.6, h: 2.6, d: 6.6, ry, color: C(0.62, 0.55, 0.5) });
  B.add('wood', part(gable(8.4, 4.0, 3.6), C(0.38, 0.3, 0.3), { pos: [cx, g + 6, cz], rot: [0, ry, 0] }));
  const [chx, chz] = W(2.2, -1.2);
  block(B, Cw, 'stone', { x: chx, y: g + 8, z: chz, w: 0.9, h: 3, d: 0.9, ry, collide: false });
  const [dx, dz] = W(0, 3.02);
  block(B, Cw, 'plain', { x: dx, y: g + 1.1, z: dz, w: 1.2, h: 2.2, d: 0.1, ry, color: C(0.12, 0.08, 0.06), collide: false });
  for (const [lx, ly, lz, rot] of [[-2.2, 1.9, 3.02, 0], [2.2, 1.9, 3.02, 0], [-1.8, 4.7, 3.32, 0], [1.8, 4.7, 3.32, 0], [3.52, 1.9, 0, Math.PI / 2], [-3.82, 4.7, 0, Math.PI / 2]]) {
    const [wx, wz] = W(lx, lz);
    B.add('glow', part(new THREE.BoxGeometry(0.8, 1.0, 0.12), r() < 0.55 ? WARM : DARKWIN, { pos: [wx, g + ly, wz], rot: [0, ry + rot, 0] }));
  }
}

function lampPost(B, Cw, terrain, scene, M, x, z, fx) {
  const g = terrain.getHeight(x, z);
  block(B, Cw, 'wood', { x, y: g + 1.6, z, w: 0.16, h: 3.2, d: 0.16 });
  block(B, Cw, 'wood', { x: x + 0.3, y: g + 3.15, z, w: 0.7, h: 0.08, d: 0.08, collide: false });
  B.add('glow', part(new THREE.BoxGeometry(0.22, 0.3, 0.22), C(1.4, 0.8, 0.35), { pos: [x + 0.6, g + 2.85, z] }));
  const s = new THREE.Sprite(M.candleSprite);
  s.position.set(x + 0.6, g + 2.85, z);
  s.scale.setScalar(1.6);
  scene.add(s);
  fx.fires.push({ s, base: 1.6, ph: r() * 6 });
}

export function buildVillage(B, Cw, terrain, scene, M, fx) {
  HOUSES.forEach(([x, z, ry]) => house(B, Cw, terrain, x, z, ry));

  // well
  const wx = 62, wz = 8, wg = terrain.getHeight(wx, wz);
  B.add('stone', part(cyl(1.3, 1.3, 1.0, 12, 1.5), C(0.85, 0.85, 0.9), { pos: [wx, wg + 0.5, wz] }));
  B.add('plain', part(new THREE.CircleGeometry(1.1, 12), C(0.02, 0.03, 0.05), { pos: [wx, wg + 0.9, wz], rot: [-Math.PI / 2, 0, 0] }));
  for (const s of [-1, 1]) block(B, Cw, 'wood', { x: wx + s * 1.2, y: wg + 1.5, z: wz, w: 0.15, h: 2.2, d: 0.15, collide: false });
  B.add('wood', part(gable(3, 1.4, 1.0), C(0.45, 0.35, 0.3), { pos: [wx, wg + 2.55, wz], rot: [0, Math.PI / 2, 0] }));
  Cw.addCircle(wx, wz, 1.5);
  for (const [lx, lz] of [[84, 2], [55, -2], [100, 4], [72, 4]]) lampPost(B, Cw, terrain, scene, M, lx, lz, fx);

  // ---------------- the inn ----------------
  const { x: tx, z: tz } = TAVERN;
  const g = terrain.getHeight(tx, tz);
  const y0 = g + 0.35, H = 5.6;
  const wall = { color: C(0.8, 0.8, 0.85), tex: 2 };
  slab(B, Cw, 'wood', tx, tz, 15.2, 11.2, g - 1, y0, { color: C(0.7, 0.55, 0.42) });
  slab(B, Cw, 'stone', tx, tz + 5.3, 15.2, 0.6, y0, y0 + H, wall);
  slab(B, Cw, 'stone', tx + 7.3, tz, 0.6, 11.2, y0, y0 + H, wall);
  slab(B, Cw, 'stone', tx - 7.3, tz, 0.6, 11.2, y0, y0 + H, wall);
  slab(B, Cw, 'stone', tx - 4.4, tz - 5.3, 6.4, 0.6, y0, y0 + H, wall);
  slab(B, Cw, 'stone', tx + 4.4, tz - 5.3, 6.4, 0.6, y0, y0 + H, wall);
  block(B, Cw, 'stone', { x: tx, y: y0 + H - 0.8, z: tz - 5.3, w: 2.4, h: 1.6, d: 0.6, ...wall });
  block(B, Cw, 'wood', { x: tx, y: y0 + H + 0.15, z: tz, w: 15.2, h: 0.3, d: 11.2, color: C(0.45, 0.35, 0.3), collide: false });
  B.add('wood', part(gable(16.6, 6.6, 4.6), C(0.36, 0.28, 0.28), { pos: [tx, y0 + H + 0.3, tz] }));
  // timber beams on the facade
  for (const bx of [-7.3, -3.6, -1.3, 1.3, 3.6, 7.3]) block(B, Cw, 'wood', { x: tx + bx, y: y0 + H / 2, z: tz - 5.62, w: 0.3, h: H, d: 0.1, color: C(0.4, 0.3, 0.25), collide: false });
  block(B, Cw, 'wood', { x: tx, y: y0 + 2.9, z: tz - 5.62, w: 15.2, h: 0.3, d: 0.1, color: C(0.4, 0.3, 0.25), collide: false });
  // windows go through the wall so they glow inside and out
  for (const [lx, lz, ry] of [[-5, -5.3, 0], [5, -5.3, 0], [-4, 5.3, 0], [4, 5.3, 0], [-7.3, -2.5, Math.PI / 2], [-7.3, 2.5, Math.PI / 2]]) {
    B.add('glow', part(new THREE.BoxGeometry(1.0, 1.3, 0.75), WARM, { pos: [tx + lx, y0 + 2.2, tz + lz], rot: [0, ry, 0] }));
  }
  // chimney + fireplace on the east wall
  block(B, Cw, 'stone', { x: tx + 6.5, y: y0 + 1.6, z: tz, w: 1.2, h: 3.2, d: 3.2, color: C(0.7, 0.7, 0.75) });
  block(B, Cw, 'plain', { x: tx + 5.88, y: y0 + 0.8, z: tz, w: 0.1, h: 1.5, d: 1.9, color: C(0.03, 0.02, 0.02), collide: false });
  block(B, Cw, 'stone', { x: tx + 7.4, y: y0 + H + 3, z: tz, w: 1.4, h: 6, d: 1.6, collide: false });
  for (let i = 0; i < 3; i++) B.add('glow', part(new THREE.OctahedronGeometry(0.28, 0), C(1.8, 0.75 + i * 0.1, 0.25), { pos: [tx + 5.7, y0 + 0.4, tz - 0.5 + i * 0.5], scale: [1, 1.8, 1] }));
  const fire = new THREE.Sprite(M.fireSprite);
  fire.position.set(tx + 5.6, y0 + 0.6, tz);
  fire.scale.setScalar(2.2);
  scene.add(fire);
  fx.fires.push({ s: fire, base: 2.2, ph: 0 });

  // bar counter, shelves, bottles, barrels
  slab(B, Cw, 'wood', tx - 1, tz + 3.0, 7, 0.9, y0, y0 + 1.15, { color: C(0.55, 0.42, 0.35) });
  block(B, Cw, 'wood', { x: tx - 1, y: y0 + 1.2, z: tz + 3.0, w: 7.3, h: 0.1, d: 1.1, color: C(0.35, 0.25, 0.2), collide: false });
  block(B, Cw, 'wood', { x: tx - 1, y: y0 + 1.6, z: tz + 4.75, w: 6, h: 3.2, d: 0.4, color: C(0.45, 0.35, 0.3) });
  for (let i = 0; i < 14; i++) {
    const col = [C(0.2, 0.45, 0.25), C(0.55, 0.35, 0.12), C(0.35, 0.2, 0.45)][i % 3];
    B.add('plain', part(new THREE.CylinderGeometry(0.07, 0.09, 0.32, 6), col, { pos: [tx - 3.6 + (i % 7) * 0.85, y0 + 1.45 + Math.floor(i / 7) * 0.95, tz + 4.45] }));
  }
  for (const [bx, bz, lying] of [[-6.3, 4.3, 0], [-6.3, 3.0, 0], [-5.1, 4.4, 0], [-6.2, 3.6, 1]]) {
    const y = lying ? y0 + 1.65 : y0 + 0.55;
    B.add('wood', part(cyl(0.55, 0.55, 1.1, 10, 1.5), C(0.6, 0.45, 0.35), { pos: [tx + bx, y, tz + bz], rot: [lying ? Math.PI / 2 : 0, 0, 0] }));
    if (!lying) Cw.addCircle(tx + bx, tz + bz, 0.6);
  }
  // tables, benches and mugs
  const tables = [[-3.6, -2.0], [3.0, -2.2], [3.2, 1.1], [-3.4, 1.0]];
  for (const [lx, lz] of tables) {
    B.add('wood', part(cyl(0.85, 0.85, 0.09, 12, 1), C(0.55, 0.42, 0.32), { pos: [tx + lx, y0 + 0.8, tz + lz] }));
    B.add('wood', part(cyl(0.1, 0.12, 0.8, 6, 1), C(0.4, 0.3, 0.25), { pos: [tx + lx, y0 + 0.4, tz + lz] }));
    for (const s of [-1, 1]) block(B, Cw, 'wood', { x: tx + lx, y: y0 + 0.22, z: tz + lz + s * 1.15, w: 1.7, h: 0.44, d: 0.4, color: C(0.5, 0.38, 0.3), collide: false });
    for (let m = 0; m < 2; m++) B.add('wood', part(cyl(0.07, 0.07, 0.17, 7, 1), C(0.55, 0.4, 0.25), { pos: [tx + lx + (m - 0.5) * 0.7, y0 + 0.93, tz + lz + (m - 0.5) * 0.3] }));
    Cw.addCircle(tx + lx, tz + lz, 0.95);
  }
  // candle chandeliers
  for (const lx of [-2.6, 2.8]) {
    const cy = y0 + 4.3;
    B.add('metal', part(new THREE.TorusGeometry(0.95, 0.05, 4, 16), C(0.35, 0.33, 0.32), { pos: [tx + lx, cy, tz - 0.5], rot: [Math.PI / 2, 0, 0] }));
    B.add('metal', part(cyl(0.02, 0.02, H - 4.3, 4, 1), C(0.3, 0.3, 0.3), { pos: [tx + lx, cy + (H - 4.3) / 2, tz - 0.5] }));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, px = tx + lx + Math.cos(a) * 0.95, pz = tz - 0.5 + Math.sin(a) * 0.95;
      B.add('plain', part(new THREE.CylinderGeometry(0.045, 0.05, 0.24, 6), C(0.88, 0.85, 0.75), { pos: [px, cy + 0.15, pz] }));
      B.add('glow', part(new THREE.ConeGeometry(0.035, 0.1, 5), C(1.7, 0.95, 0.45), { pos: [px, cy + 0.33, pz] }));
    }
    const s = new THREE.Sprite(M.candleSprite);
    s.position.set(tx + lx, cy + 0.3, tz - 0.5);
    s.scale.setScalar(2.6);
    scene.add(s);
    fx.fires.push({ s, base: 2.6, ph: lx });
    const light = new THREE.PointLight(0xffa060, 9, 12, 1.6);
    light.position.set(tx + lx, cy - 0.3, tz - 0.5);
    scene.add(light);
    fx.lights.push({ l: light, base: 9 });
  }
  const hearth = new THREE.PointLight(0xff7a30, 8, 10, 1.6);
  hearth.position.set(tx + 5.2, y0 + 1.0, tz);
  scene.add(hearth);
  fx.lights.push({ l: hearth, base: 8 });

  // the galaxy painting from the reference, in a dark frame
  block(B, Cw, 'wood', { x: tx - 6.93, y: y0 + 2.7, z: tz - 1.6, w: 0.12, h: 1.5, d: 1.9, color: C(0.25, 0.18, 0.14), collide: false });
  const painting = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 1.25), M.painting);
  painting.position.set(tx - 6.86, y0 + 2.7, tz - 1.6);
  painting.rotation.y = Math.PI / 2;
  scene.add(painting);

  // hanging sign by the door
  block(B, Cw, 'wood', { x: tx + 1.9, y: y0 + 3.6, z: tz - 6.2, w: 0.1, h: 0.1, d: 1.4, collide: false });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), M.sign);
  sign.position.set(tx + 1.9, y0 + 3.1, tz - 6.6);
  sign.rotation.y = Math.PI / 2;
  scene.add(sign);
  const sign2 = sign.clone();
  sign2.rotation.y = -Math.PI / 2;
  scene.add(sign2);

  // inhabitants
  const keeper = createCandleHead(M);
  keeper.position.set(tx - 1, y0, tz + 3.95);
  keeper.rotation.y = Math.PI;
  scene.add(keeper);
  Cw.addCircle(tx - 1, tz + 3.95, 0.45);
  const patronColors = [C(0.35, 0.22, 0.18), C(0.2, 0.28, 0.45), C(0.3, 0.35, 0.25), C(0.45, 0.4, 0.38), C(0.25, 0.2, 0.3)];
  const seats = [[-3.6, -3.15, 0], [-3.6, -0.85, Math.PI], [3.0, -3.35, 0], [3.2, 2.25, Math.PI], [-3.4, 2.15, Math.PI]];
  const patrons = seats.map(([lx, lz, ry], i) => {
    const p = createPatron(M, patronColors[i], { hood: i % 2 === 0 });
    p.position.set(tx + lx, y0, tz + lz);
    p.rotation.y = ry;
    scene.add(p);
    return p;
  });

  // ---------------- the blacksmith's forge
  const sx = SMITH.x, sz = SMITH.z, sg = terrain.getHeight(sx, sz);
  const fx0 = sx - 3, fz0 = sz;
  slab(B, Cw, 'stone', fx0, fz0, 1.8, 1.8, sg - 0.5, sg + 1.1, { color: C(0.62, 0.6, 0.64) });
  block(B, Cw, 'plain', { x: fx0 + 0.92, y: sg + 0.65, z: fz0, w: 0.06, h: 0.6, d: 0.9, color: C(0.03, 0.02, 0.02), collide: false });
  block(B, Cw, 'stone', { x: fx0, y: sg + 2.6, z: fz0, w: 0.9, h: 3, d: 0.9, collide: false });
  for (let i = 0; i < 4; i++) B.add('glow', part(new THREE.OctahedronGeometry(0.22, 0), C(1.9, 0.6 + i * 0.1, 0.15), { pos: [fx0 + 0.6, sg + 0.6, fz0 - 0.3 + i * 0.2], scale: [1, 1.6, 1] }));
  // anvil on a stump
  B.add('wood', part(cyl(0.38, 0.42, 0.6, 8, 1), C(0.55, 0.42, 0.32), { pos: [sx + 1.6, sg + 0.3, sz + 1.2] }));
  B.add('metal', part(new THREE.BoxGeometry(0.75, 0.22, 0.32), C(0.32, 0.33, 0.38), { pos: [sx + 1.6, sg + 0.72, sz + 1.2] }));
  B.add('metal', part(new THREE.ConeGeometry(0.14, 0.4, 4), C(0.32, 0.33, 0.38), { pos: [sx + 2.15, sg + 0.74, sz + 1.2], rot: [0, 0, -Math.PI / 2] }));
  Cw.addCircle(sx + 1.6, sz + 1.2, 0.5);
  // lean-to roof and a rack of blades
  for (const [px, pz] of [[-4, -1.6], [-4, 1.6], [2.6, -1.6], [2.6, 1.6]]) block(B, Cw, 'wood', { x: sx + px, y: sg + 1.5, z: sz + pz, w: 0.18, h: 3, d: 0.18 });
  block(B, Cw, 'wood', { x: sx - 0.7, y: sg + 3.1, z: sz, w: 7.2, h: 0.12, d: 4.0, rz: 0.08, color: C(0.4, 0.32, 0.3), collide: false });
  for (let i = 0; i < 4; i++) B.add('metal', part(new THREE.BoxGeometry(0.06, 1.1, 0.02), C(0.6, 0.62, 0.68), { pos: [sx - 1.2 + i * 0.3, sg + 0.9, sz - 1.75], rot: [0, 0, 0.1] }));
  const forgeFire = new THREE.Sprite(M.fireSprite);
  forgeFire.position.set(fx0 + 0.8, sg + 0.7, fz0);
  forgeFire.scale.setScalar(1.8);
  scene.add(forgeFire);
  fx.fires.push({ s: forgeFire, base: 1.8, ph: 2 });
  const forgeLight = new THREE.PointLight(0xff6a20, 8, 12, 1.6);
  forgeLight.position.set(fx0 + 1.2, sg + 1.2, fz0);
  scene.add(forgeLight);
  fx.lights.push({ l: forgeLight, base: 8 });
  const smith = createSmith(M);
  smith.position.set(sx, sg, sz);
  smith.rotation.y = Math.PI / 2;
  scene.add(smith);
  Cw.addCircle(sx, sz, 0.55);

  return {
    smith: { obj: smith, pos: new THREE.Vector3(sx, sg, sz) },
    keeper: { obj: keeper, pos: new THREE.Vector3(tx - 1, y0, tz + 2.2) },
    patrons,
    indoor: { minX: tx - 7, maxX: tx + 7, minZ: tz - 5, maxZ: tz + 5, maxY: y0 + H },
    floorY: y0,
  };
}

