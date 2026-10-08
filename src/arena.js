// The arena for the online siege: a bowl of forest ringed by mountains, four bases in the
// corners, dirt roads lit by lanterns between neighbouring bases and from every base to a plaza in
// the middle, where a colossal kneeling stone king rests on his sword. Signposts at every fork
// name where each road goes, and the roads are drawn on the map, so the way to anyone is easy.
import * as THREE from 'three';
import { fbm } from './noise.js';
import { clamp, lerp, smoothstep, part, mergeGeometries } from './util.js';
// the arena keeps the old 640 m world's grid
const HALF = 320, SEG = 256, STEP = (HALF * 2) / SEG;

const N = SEG + 1;
const C = (r, g, b) => new THREE.Color(r, g, b);

// seat order matches moba.js SEATS: red, blue, green, gold
export const ARENA_BASES = [[-150, -150], [150, -150], [-150, 150], [150, 150]];
export const ARENA_NAMES = ['แดง', 'ฟ้า', 'เขียว', 'ทอง'];
export const PLAZA_R = 34;
export const STATUE_R = 8;

// roads: [from seat, to seat or 'c' for the plaza, polyline]
export const ARENA_ROADS = [
  [0, 1, [[-150, -150], [-60, -158], [60, -142], [150, -150]]],
  [1, 3, [[150, -150], [158, -60], [142, 60], [150, 150]]],
  [3, 2, [[150, 150], [60, 158], [-60, 142], [-150, 150]]],
  [2, 0, [[-150, 150], [-158, 60], [-142, -60], [-150, -150]]],
  [0, 'c', [[-150, -150], [-96, -86], [-46, -40], [0, 0]]],
  [1, 'c', [[150, -150], [96, -86], [46, -40], [0, 0]]],
  [2, 'c', [[-150, 150], [-86, 96], [-40, 46], [0, 0]]],
  [3, 'c', [[150, 150], [86, 96], [40, 46], [0, 0]]],
];

// wild camps between the roads: they pay out souls (and respawn)
export const ARENA_CAMPS = [
  { x: 0, z: -102, types: ['wolf', 'wolf', 'wolf'], name: 'ถ้ำหมาป่าเหนือ' },
  { x: 102, z: 0, types: ['gaunt', 'gaunt', 'crawler'], name: 'ซากโบสถ์ตะวันออก' },
  { x: 0, z: 102, types: ['wolf', 'wolf', 'wolf'], name: 'ถ้ำหมาป่าใต้' },
  { x: -102, z: 0, types: ['gaunt', 'gaunt', 'crawler'], name: 'ซากโบสถ์ตะวันตก' },
];

export const ARENA_LOCATIONS = [
  ...ARENA_BASES.map(([x, z], i) => ({ id: `base${i}`, name: `ฐาน${ARENA_NAMES[i]}`, x, z, r: 30 })),
  { id: 'plaza', name: 'ลานราชาคุกเข่า', x: 0, z: 0, r: PLAZA_R },
  ...ARENA_CAMPS.map((c, i) => ({ id: `camp${i}`, name: c.name, x: c.x, z: c.z, r: 14 })),
];

// a road's direction where it leaves a base (unit vector)
export function roadOut(seat, to) {
  const road = ARENA_ROADS.find(([a, b]) => (a === seat && b === to) || (b === seat && a === to));
  const pts = road[0] === seat ? road[2] : [...road[2]].reverse();
  const [x0, z0] = pts[0], [x1, z1] = pts[1], d = Math.hypot(x1 - x0, z1 - z0);
  return [(x1 - x0) / d, (z1 - z0) / d];
}
export const adjacent = (a, b) => ARENA_ROADS.some(([p, q]) => (p === a && q === b) || (p === b && q === a));

function plateau(h, x, z, cx, cz, r0, r1, target) {
  return lerp(target, h, smoothstep(r0, r1, Math.hypot(x - cx, z - cz)));
}

function arenaHeight(x, z) {
  let h = 3 + (fbm(x * 0.008 + 3.1, z * 0.008 - 7.4, 4, 17) - 0.45) * 15;
  h += (fbm(x * 0.04, z * 0.04, 2, 5) - 0.5) * 1.6;
  for (const [bx, bz] of ARENA_BASES) h = plateau(h, x, z, bx, bz, 36, 52, 4);
  h = plateau(h, x, z, 0, 0, PLAZA_R, PLAZA_R + 16, 3.2);
  for (const c of ARENA_CAMPS) h = plateau(h, x, z, c.x, c.z, 10, 20, Math.max(2, h));
  h = Math.max(h, 0.9);
  // the mountains that close the bowl
  const e = Math.max(Math.abs(x), Math.abs(z));
  if (e > 200) {
    const t = e - 200;
    h += t * t * 0.045 + t * 0.5 + (fbm(x * 0.05, z * 0.05, 3, 4) - 0.5) * t * 0.35;
  }
  return h;
}

const PAL = {
  grassA: [0.17, 0.31, 0.16], grassB: [0.1, 0.21, 0.12], moss: [0.2, 0.37, 0.14],
  rock: [0.4, 0.43, 0.5], path: [0.36, 0.32, 0.24], flag: [0.36, 0.36, 0.4], worn: [0.27, 0.27, 0.2],
};
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export class ArenaTerrain {
  constructor() {
    this.h = new Float32Array(N * N);
    for (let j = 0; j < N; j++) {
      const z = -HALF + j * STEP;
      for (let i = 0; i < N; i++) this.h[j * N + i] = arenaHeight(-HALF + i * STEP, z);
    }
    this.roadMask = new Float32Array(N * N);
    this.buildRoads();
    // the title-screen flyover follows the ring road
    const loop = [[-150, -150], [0, -150], [150, -150], [150, 0], [150, 150], [0, 150], [-150, 150], [-150, 0]];
    const curve = new THREE.CatmullRomCurve3(loop.map(([x, z]) => new THREE.Vector3(x, 0, z)), true);
    this.rail = { curve, pts: [] };
  }

  getHeight(x, z) {
    const fx = clamp((x + HALF) / STEP, 0, SEG - 1e-4), fz = clamp((z + HALF) / STEP, 0, SEG - 1e-4);
    const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j;
    const h = this.h;
    const h00 = h[j * N + i], h10 = h[j * N + i + 1], h01 = h[(j + 1) * N + i], h11 = h[(j + 1) * N + i + 1];
    if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
    return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  }

  slope(x, z) {
    const e = 1.0;
    return Math.hypot(this.getHeight(x + e, z) - this.getHeight(x - e, z), this.getHeight(x, z + e) - this.getHeight(x, z - e)) / (2 * e);
  }

  // smooth, flattened dirt roads (like the railway bed in the main world)
  buildRoads() {
    const best = new Float32Array(N * N), target = new Float32Array(N * N);
    this.roads = [];
    for (const [, , poly] of ARENA_ROADS) {
      const curve = new THREE.CatmullRomCurve3(poly.map(([x, z]) => new THREE.Vector3(x, 0, z)));
      const n = Math.ceil(curve.getLength());
      const pts = curve.getSpacedPoints(n);
      const raw = pts.map((p) => this.getHeight(p.x, p.z));
      const ys = raw.map((_, k) => { let s = 0, c = 0; for (let o = -14; o <= 14; o++) { s += raw[clamp(k + o, 0, n)]; c++; } return s / c; });
      this.roads.push(pts);
      const R = 9;
      pts.forEach((p, k) => {
        const i0 = Math.max(0, Math.floor((p.x - R + HALF) / STEP)), i1 = Math.min(SEG, Math.ceil((p.x + R + HALF) / STEP));
        const j0 = Math.max(0, Math.floor((p.z - R + HALF) / STEP)), j1 = Math.min(SEG, Math.ceil((p.z + R + HALF) / STEP));
        for (let j = j0; j <= j1; j++) {
          for (let i = i0; i <= i1; i++) {
            const d = Math.hypot(-HALF + i * STEP - p.x, -HALF + j * STEP - p.z);
            const w = 1 - smoothstep(3.6, R, d);
            const idx = j * N + i;
            if (w > best[idx]) { best[idx] = w; target[idx] = ys[k] - 0.05; }
          }
        }
      });
    }
    for (let k = 0; k < N * N; k++) {
      if (best[k] > 0) this.h[k] = lerp(this.h[k], target[k], best[k]);
      this.roadMask[k] = best[k];
    }
  }

  // how much of a road is under (x, z): 1 on the dirt, fading to 0 nine metres out
  roadAt(x, z) {
    const i = Math.round(clamp((x + HALF) / STEP, 0, SEG)), j = Math.round(clamp((z + HALF) / STEP, 0, SEG));
    return this.roadMask[j * N + i];
  }

  distToRoad(x, z) {
    let d = Infinity;
    for (const pts of this.roads) for (let i = 0; i < pts.length; i += 3) d = Math.min(d, Math.abs(pts[i].x - x) + Math.abs(pts[i].z - z) < 40 ? Math.hypot(pts[i].x - x, pts[i].z - z) : d);
    return d;
  }

  buildMesh(material) {
    const g = new THREE.PlaneGeometry(HALF * 2, HALF * 2, SEG, SEG);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let k = 0; k < pos.count; k++) {
      pos.setY(k, this.h[k]);
      const y = this.h[k];
      uv.setXY(k, (pos.getX(k) + y * 0.7) / 5, (pos.getZ(k) - y) / 5);
    }
    g.computeVertexNormals();
    const nrm = g.attributes.normal;
    const cols = new Float32Array(pos.count * 3);
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), z = pos.getZ(k), h = pos.getY(k), ny = nrm.getY(k);
      const n1 = fbm(x * 0.05, z * 0.05, 3, 21), n2 = fbm(x * 0.21, z * 0.21, 2, 33);
      let c = mix3(PAL.grassB, PAL.grassA, n1);
      c = mix3(c, PAL.moss, smoothstep(0.55, 0.72, n2) * 0.7);
      const rock = Math.max(smoothstep(0.86, 0.62, ny), smoothstep(14, 24, h) * 0.7);
      c = mix3(c, PAL.rock.map((v) => v * (0.75 + n2 * 0.5)), rock);
      // trampled ground in the bases, flagstones on the plaza, dirt on the roads
      for (const [bx, bz] of ARENA_BASES) c = mix3(c, PAL.worn, (1 - smoothstep(26, 36, Math.hypot(x - bx, z - bz))) * 0.55);
      const dp = Math.hypot(x, z);
      if (dp < PLAZA_R + 2) {
        const tile = (Math.floor(x / 3) + Math.floor(z / 3)) % 2 ? 0.92 : 1.05;
        c = mix3(c, PAL.flag.map((v) => v * tile * (0.85 + n2 * 0.3)), 1 - smoothstep(PLAZA_R - 2, PLAZA_R + 2, dp));
      }
      c = mix3(c, PAL.path.map((v) => v * (0.85 + n2 * 0.3)), smoothstep(0.35, 0.75, this.roadMask[k]) * 0.95);
      cols[k * 3] = c[0] * 1.35; cols[k * 3 + 1] = c[1] * 1.35; cols[k * 3 + 2] = c[2] * 1.35;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const mesh = new THREE.Mesh(g, material);
    mesh.name = 'terrain';
    this.mesh = mesh;
    return mesh;
  }
}

// where nothing may grow: roads, bases, the plaza and the camp clearings
export function arenaKeepOut(terrain) {
  return (x, z, pad = 0) => {
    if (terrain.roadAt(x, z) > (pad >= 2 ? 0.01 : pad >= 0 ? 0.3 : 0.75)) return true;
    if (Math.hypot(x, z) < PLAZA_R + 4 + pad) return true;
    if (ARENA_BASES.some(([bx, bz]) => Math.hypot(x - bx, z - bz) < 34 + pad)) return true;
    return ARENA_CAMPS.some((c) => Math.hypot(x - c.x, z - c.z) < 12 + pad);
  };
}

// a painted wooden sign: "→ ฐานฟ้า" in that base's colour
function signTexture(text, css) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#5a4430'; ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#3a2a1c'; for (let y = 6; y < 64; y += 14) ctx.fillRect(0, y, 256, 2);
  ctx.strokeStyle = '#2a1c10'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 250, 58);
  ctx.font = 'bold 34px Pridi, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1a120a'; ctx.fillText(text, 130, 35);
  ctx.fillStyle = css; ctx.fillText(text, 128, 33);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const SEAT_CSS = ['#e0533f', '#5a8cff', '#56cc56', '#f2c84a'];

// everything built in the arena: lanterns, signposts, the plaza and its colossus, camp ruins
export function buildArena(scene, terrain, M, collision) {
  const fx = { fires: [], mists: [], lights: [] };
  const H = (x, z) => terrain.getHeight(x, z);
  const wood = C(0.42, 0.31, 0.22), dark = C(0.28, 0.2, 0.14);

  // lantern posts along every road
  const posts = [], lampGlass = [];
  for (const pts of terrain.roads) {
    for (let k = 14; k < pts.length - 14; k += 26) {
      const p = pts[k], q = pts[Math.min(pts.length - 1, k + 1)];
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz) || 1;
      const side = (k / 26) % 2 ? 1 : -1, x = p.x - dz / d * 5 * side, z = p.z + dx / d * 5 * side, y = H(x, z);
      posts.push(part(new THREE.CylinderGeometry(0.09, 0.12, 3.2, 5), dark, { pos: [x, y + 1.6, z] }));
      posts.push(part(new THREE.BoxGeometry(0.7, 0.08, 0.08), dark, { pos: [x + dz / d * 0.3 * side, y + 3.1, z - dx / d * 0.3 * side] }));
      lampGlass.push(part(new THREE.BoxGeometry(0.28, 0.36, 0.28), C(1.6, 1.0, 0.5), { pos: [x + dz / d * 0.55 * side, y + 2.85, z - dx / d * 0.55 * side] }));
      const s = new THREE.Sprite(M.candleSprite);
      s.position.set(x + dz / d * 0.55 * side, y + 2.85, z - dx / d * 0.55 * side);
      s.scale.setScalar(1.4);
      scene.add(s);
      collision.addCircle(x, z, 0.2);
    }
  }
  scene.add(new THREE.Mesh(mergeGeometries(posts), M.wood));
  scene.add(new THREE.Mesh(mergeGeometries(lampGlass), M.glow));

  // signposts where each road leaves a base, and where the base roads meet the plaza
  const signPost = (x, z, ang, entries) => {
    const y = H(x, z), grp = new THREE.Group();
    grp.add(new THREE.Mesh(part(new THREE.CylinderGeometry(0.1, 0.12, 2.8, 6), dark, { pos: [0, 1.4, 0] }), M.wood));
    entries.forEach(([text, css], i) => {
      // painted face toward the reader, bare planks behind (so the words never read backwards)
      // a touch of glow so the words still read by lantern light and at night
      const tex = signTexture(text, css);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55 }));
      board.position.set(0, 2.5 - i * 0.7, 0.15);
      grp.add(board);
      grp.add(new THREE.Mesh(part(new THREE.BoxGeometry(2.44, 0.64, 0.06), wood, { pos: [0, 2.5 - i * 0.7, 0.11] }), M.wood));
    });
    grp.position.set(x, y, z);
    grp.rotation.y = ang;
    scene.add(grp);
    collision.addCircle(x, z, 0.25);
  };
  ARENA_BASES.forEach(([bx, bz], seat) => {
    for (const [a, b] of ARENA_ROADS) {
      if (a !== seat && b !== seat) continue;
      const to = a === seat ? b : a;
      const [ux, uz] = roadOut(seat, to);
      const x = bx + ux * 36 - uz * 5.5, z = bz + uz * 36 + ux * 5.5;
      // the board faces travellers leaving the base
      signPost(x, z, Math.atan2(-ux, -uz), to === 'c' ? [['ลานกลาง →', '#e8dcc0']] : [[`ฐาน${ARENA_NAMES[to]} →`, SEAT_CSS[to]]]);
    }
  });
  for (let seat = 0; seat < 4; seat++) {
    // u points from the plaza out along the road to this base
    const [px, pz] = ARENA_ROADS.find(([a, b]) => a === seat && b === 'c')[2][2], d = Math.hypot(px, pz), ux = px / d, uz = pz / d;
    const x = ux * (PLAZA_R + 4) + uz * 5.5, z = uz * (PLAZA_R + 4) - ux * 5.5;
    signPost(x, z, Math.atan2(-ux, -uz), [[`ฐาน${ARENA_NAMES[seat]} →`, SEAT_CSS[seat]]]);
  }

  // the plaza: a colossal king kneeling on his sword, a ring of broken pillars, braziers
  const stone = C(0.62, 0.63, 0.68), moss = C(0.45, 0.55, 0.42);
  const y0 = H(0, 0);
  const colossus = [
    part(new THREE.CylinderGeometry(STATUE_R, STATUE_R + 1, 3, 12), stone, { pos: [0, y0 + 1.5, 0] }),
    part(new THREE.CylinderGeometry(4.5, 7.5, 13, 10), stone, { pos: [0, y0 + 9.5, 1.5] }),                     // robe, kneeling
    part(new THREE.BoxGeometry(7.5, 9, 5), stone, { pos: [0, y0 + 20, 1.2], rot: [0.12, 0, 0] }),              // chest
    part(new THREE.SphereGeometry(2.8, 10, 8), stone, { pos: [0, y0 + 27.5, 0.4] }),                            // bowed head
    part(new THREE.CylinderGeometry(2.6, 2.9, 1.4, 10, 1, true), C(0.7, 0.66, 0.5), { pos: [0, y0 + 30, 0.2] }), // crown band
    ...[0, 1, 2, 3, 4, 5, 6].map((i) => part(new THREE.ConeGeometry(0.5, 2.2, 4), C(0.7, 0.66, 0.5), { pos: [Math.cos(i * 0.9) * 2.6, y0 + 31.6, 0.2 + Math.sin(i * 0.9) * 2.6] })),
    part(new THREE.BoxGeometry(2.2, 9, 2.2), stone, { pos: [-4.6, y0 + 17, -1.5], rot: [-0.6, 0, 0.15] }),     // arms reaching to the hilt
    part(new THREE.BoxGeometry(2.2, 9, 2.2), stone, { pos: [4.6, y0 + 17, -1.5], rot: [-0.6, 0, -0.15] }),
    part(new THREE.BoxGeometry(1.4, 26, 0.6), C(0.55, 0.58, 0.66), { pos: [0, y0 + 13, -5.5] }),              // the sword, point in the ground
    part(new THREE.BoxGeometry(7, 1.0, 1.2), C(0.55, 0.58, 0.66), { pos: [0, y0 + 24, -5.5] }),
    part(new THREE.SphereGeometry(4, 8, 5), moss, { pos: [3, y0 + 3.5, 4], scale: [1.2, 0.4, 1] }),
  ];
  scene.add(new THREE.Mesh(mergeGeometries(colossus), M.giantStone));
  collision.addCircle(0, 0, STATUE_R + 0.5);
  const pillars = [];
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2 + 0.31, r = PLAZA_R - 3, x = Math.cos(a) * r, z = Math.sin(a) * r;
    // leave the four road mouths open
    if (ARENA_ROADS.some(([, b, poly]) => { if (b !== 'c') return false; const da = Math.atan2(poly[2][1], poly[2][0]) - a; return Math.abs(Math.atan2(Math.sin(da), Math.cos(da))) < 0.4; })) continue;
    const hgt = 3 + ((i * 37) % 7);
    pillars.push(part(new THREE.CylinderGeometry(0.9, 1.1, hgt, 8), stone, { pos: [x, H(x, z) + hgt / 2, z], rot: [(i % 3 - 1) * 0.05, 0, 0] }));
    collision.addCircle(x, z, 1.1);
  }
  scene.add(new THREE.Mesh(mergeGeometries(pillars), M.stone));
  for (const [x, z] of [[19, 0], [-19, 0], [0, 19], [0, -19]]) {     // between the road mouths
    const y = H(x, z);
    scene.add(new THREE.Mesh(mergeGeometries([
      part(new THREE.CylinderGeometry(0.5, 0.7, 1.4, 8), C(0.4, 0.38, 0.36), { pos: [x, y + 0.7, z] }),
      part(new THREE.CylinderGeometry(0.9, 0.5, 0.5, 8), C(0.45, 0.4, 0.35), { pos: [x, y + 1.6, z] }),
    ]), M.metal));
    const f = new THREE.Sprite(M.fireSprite);
    f.position.set(x, y + 2.3, z);
    f.scale.setScalar(2.6);
    scene.add(f);
    fx.fires.push({ s: f, base: 2.6, ph: x * 0.1 + z });
    collision.addCircle(x, z, 0.8);
  }
  const plazaLight = new THREE.PointLight(0xff9a50, 14, 50, 1.4);
  plazaLight.position.set(0, y0 + 6, 0);
  scene.add(plazaLight);
  fx.lights.push({ l: plazaLight, base: 14 });

  // camp clearings: a broken chapel wall or a den of rocks, and a campfire left by someone unlucky
  for (const c of ARENA_CAMPS) {
    const y = H(c.x, c.z), parts = [];
    const ang = Math.atan2(c.z, c.x);
    for (let i = 0; i < 4; i++) {
      const a = ang + Math.PI / 2 + (i - 1.5) * 0.45, x = c.x + Math.cos(a) * 9, z = c.z + Math.sin(a) * 9, hgt = 2 + (i % 2) * 2.5;
      parts.push(part(new THREE.BoxGeometry(3.4, hgt, 0.9), stone, { pos: [x, H(x, z) + hgt / 2, z], rot: [0, -a, 0] }));
      collision.addBox(x, H(x, z) + hgt / 2, z, 1.7, hgt / 2, 0.45, -a);
    }
    scene.add(new THREE.Mesh(mergeGeometries(parts), M.stone));
    const f = new THREE.Sprite(M.fireSprite);
    f.position.set(c.x + 3, y + 0.7, c.z + 3);
    f.scale.setScalar(1.6);
    scene.add(f);
    fx.fires.push({ s: f, base: 1.6, ph: c.x });
  }
  return { fx };
}
