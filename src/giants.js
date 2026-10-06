// Colossal structures meant to make the player feel tiny (megalophobia):
//  - a gothic castle on a floating rock island, chained to the ground, waterfalls pouring into a lake
//  - the head of a sleeping stone king, crowned and half buried, with a bridge and fire braziers
//  - the ribcage of some ancient beast that the railway runs straight through
import * as THREE from 'three';
import { fbm, rng } from './noise.js';
import { part, colorize, smoothstep } from './util.js';
import { block, slab } from './builder.js';
import { CASTLE, HEAD, RIBCAGE } from './layout.js';
import { ps2Uniforms, GLSL_NOISE, SNAP_GLSL } from './ps2.js';

const rnd = rng(4242);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = (r, g, b) => new THREE.Color(r, g, b);

// cylinder/cone with UVs scaled to world size so stone texture density stays constant
export function cyl(r0, r1, h, seg = 10, tex = 6) {
  const g = new THREE.CylinderGeometry(r1, r0, h, seg, 1);
  const uv = g.attributes.uv, circ = Math.PI * 2 * Math.max(r0, r1);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ / tex, uv.getY(i) * h / tex);
  return g;
}

// triangular prism lying along X with the ridge on top and its base at y = 0
export function gable(len, halfWidth, height) {
  const g = new THREE.CylinderGeometry(1, 1, len, 3, 1);
  g.rotateZ(Math.PI / 2);
  g.rotateX(-Math.PI / 2);
  g.scale(1, height / 1.5, halfWidth / 0.866);
  g.translate(0, height / 3, 0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * len / 4);
  return g;
}

function rockLathe(profile, seg, noiseAmp, seed, uvScale = [10, 6]) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < -1) {
      const n = fbm(x * 0.07 + seed, z * 0.07 + y * 0.05, 3, seed);
      const k = 1 + (n - 0.5) * noiseAmp;
      p.setXYZ(i, x * k, y + (fbm(x * 0.12, z * 0.12, 2, seed + 9) - 0.5) * noiseAmp * 14, z * k);
    }
  }
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale[0], uv.getY(i) * uvScale[1]);
  g.computeVertexNormals();
  // moss on top, cold stone on the flanks, near-black underbelly
  const cols = new Float32Array(p.count * 3);
  let minY = Infinity;
  for (let i = 0; i < p.count; i++) minY = Math.min(minY, p.getY(i));
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), n = fbm(p.getX(i) * 0.2, p.getZ(i) * 0.2 + y * 0.2, 2, seed);
    const top = smoothstep(-1.5, 0.5, y), under = smoothstep(minY * 0.3, minY, y);
    let c = [0.72 + n * 0.3, 0.78 + n * 0.25, 0.95 + n * 0.2];
    c = c.map((v, k) => v + ([0.42, 0.62, 0.36][k] - v) * top);
    c = c.map((v) => v * (1 - under * 0.65));
    cols.set(c, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}

function placeGeom(g, pos, rot = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Matrix4().compose(V(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), V(...scale));
  g.applyMatrix4(m);
  return g;
}

// Chain of torus links hanging along a sagging curve from a to b.
function chain(B, a, b, { link = 1.0, sag = 12, mat = 'giantMetal' } = {}) {
  const len = a.distanceTo(b);
  const spacing = link * 2.3;
  const n = Math.max(2, Math.floor(len / spacing));
  const point = (t) => V(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t), a.z + (b.z - a.z) * t);
  const up = V(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const p = point(t), tan = point(Math.min(1, t + 0.01)).sub(point(Math.max(0, t - 0.01))).normalize();
    const g = new THREE.TorusGeometry(link, link * 0.26, 4, 8);
    g.scale(1, 1.55, 1);
    g.rotateY((i % 2) * Math.PI / 2);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, tan));
    g.translate(p.x, p.y, p.z);
    B.add(mat, colorize(g, C(0.6, 0.62, 0.7)));
  }
}

function waterfallMaterial() {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]);
  uniforms.uTime = ps2Uniforms.uTime;
  uniforms.uSnapRes = ps2Uniforms.uSnapRes;
  return new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      uniform vec2 uSnapRes;
      varying vec2 vUv;
      #include <fog_pars_vertex>
      void main(){
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        ${SNAP_GLSL}
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime;
      varying vec2 vUv;
      #include <fog_pars_fragment>
      ${GLSL_NOISE}
      void main(){
        float s = fbm(vec2(vUv.x * 9.0, vUv.y * 5.0 + uTime * 1.6));
        float s2 = vnoise(vec2(vUv.x * 30.0, vUv.y * 12.0 + uTime * 3.0));
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        float a = smoothstep(0.3, 0.7, s * 0.8 + s2 * 0.35) * edge * (0.55 + 0.45 * smoothstep(0.0, 0.25, vUv.y));
        vec3 col = mix(vec3(0.15, 0.3, 0.75), vec3(0.75, 0.88, 1.0), s2);
        float f = 0.0;
        #ifdef USE_FOG
          f = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth * 0.12);
        #endif
        col = mix(col, fogColor, f);
        gl_FragColor = vec4(col, a * 0.85);
      }`,
  });
}

function buildFloatingCastle(B, C2, terrain, scene, M, fx) {
  const { x: cx, z: cz, top } = CASTLE;
  const island = rockLathe([
    [0.01, -82], [8, -70], [17, -56], [26, -40], [34, -26], [41, -13], [45, -4], [43, 0.5], [30, 1.6], [0.01, 2.4],
  ], 30, 0.38, 3);
  placeGeom(island, [cx, top, cz], [0, 0.3, 0], [1, 1, 0.84]);
  B.add('giantRock', island);

  // castle (local coordinates on the island top)
  const L = (lx, ly, lz) => {
    const a = 0.3, c = Math.cos(a), s = Math.sin(a);
    return [cx + lx * c + lz * s, top + 1 + ly, cz + (-lx * s + lz * c) * 0.84];
  };
  const stone = C(0.62, 0.66, 0.85), slate = C(0.32, 0.34, 0.5);
  const windows = [];
  const tower = (lx, lz, r, h, spire) => {
    B.add('giantStone', part(cyl(r * 1.08, r, h, 12), stone, { pos: L(lx, h / 2, lz) }));
    B.add('giantStone', part(cyl(r * 1.25, r * 1.25, 2.4, 12), stone, { pos: L(lx, h + 1.2, lz) }));
    B.add('giantStone', part(new THREE.ConeGeometry(r * 1.3, spire, 10), slate, { pos: L(lx, h + 2.4 + spire / 2, lz) }));
    const nWin = Math.floor(h / 9);
    for (let k = 0; k < nWin; k++) {
      const a = rnd() * Math.PI * 2, y = 6 + k * 8 + rnd() * 2;
      windows.push({ pos: L(lx + Math.cos(a) * r, y, lz + Math.sin(a) * r), ry: -a + 0.3 + Math.PI / 2 });
    }
  };
  // keep and great hall
  B.add('giantStone', part(new THREE.BoxGeometry(26, 24, 20), stone, { pos: L(0, 12, 2), rot: [0, 0.3, 0] }));
  B.add('giantStone', part(gable(27, 11, 12), slate, { pos: L(0, 24, 2), rot: [0, 0.3, 0] }));
  for (let i = 0; i < 6; i++) windows.push({ pos: L(-10 + i * 4, 10 + (i % 2) * 7, 12.1), ry: 0.3, big: true });
  // corner towers + the great tower
  tower(-15, -11, 5, 48, 30); tower(15, -11, 5, 40, 26); tower(-15, 14, 5, 56, 34); tower(15, 14, 5, 44, 28);
  tower(-3, -6, 7, 82, 44);
  tower(7, -2, 3, 96, 20);
  tower(6, 21, 4, 30, 18);
  // curtain walls with crenellations
  const wall = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az) + 0.3;
    B.add('giantStone', part(new THREE.BoxGeometry(2.6, 16, len), stone, { pos: L((ax + bx) / 2, 8, (az + bz) / 2), rot: [0, ry, 0] }));
    for (let t = 0.05; t < 1; t += 0.12) {
      B.add('giantStone', part(new THREE.BoxGeometry(2.8, 2, 1.6), stone, { pos: L(ax + (bx - ax) * t, 17, az + (bz - az) * t), rot: [0, ry, 0] }));
    }
  };
  wall(-15, -11, 15, -11); wall(15, -11, 15, 14); wall(-15, -11, -15, 14);
  // glowing windows: some warm, some dead
  for (const w of windows) {
    const lit = rnd() < 0.6;
    const col = lit ? C(1.5, 0.7, 0.28) : C(0.03, 0.03, 0.06);
    B.add('giantGlow', part(new THREE.BoxGeometry(w.big ? 2.2 : 1.3, w.big ? 5 : 3.2, 0.8), col, { pos: w.pos, rot: [0, w.ry, 0] }));
  }
  // a broken wooden walkway jutting into the void
  for (let i = 0; i < 9; i++) {
    if (i === 6) continue;
    B.add('giantWood', part(new THREE.BoxGeometry(5, 0.5, 2.6), C(0.7, 0.6, 0.55), { pos: L(44 + i * 2.7, -1 - i * 0.35, 4), rot: [0, 0.3, (rnd() - 0.5) * 0.12] }));
  }

  // waterfalls spilling off the rim into the lake
  const wfMat = waterfallMaterial();
  for (const [a, w] of [[2.4, 9], [3.3, 6], [4.2, 11], [0.9, 7]]) {
    const r = 41;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r * 0.84;
    const h = top + 1;
    const g = new THREE.PlaneGeometry(w, h, 1, 8);
    g.translate(0, h / 2, 0);
    const mesh = new THREE.Mesh(g, wfMat);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = -a + Math.PI / 2;
    mesh.renderOrder = 2;
    scene.add(mesh);
    for (let k = 0; k < 4; k++) {
      const mist = new THREE.Sprite(M.mistSprite);
      mist.position.set(x + (rnd() - 0.5) * 8, 3 + rnd() * 6, z + (rnd() - 0.5) * 8);
      mist.scale.setScalar(16 + rnd() * 14);
      scene.add(mist);
      fx.mists.push({ s: mist, base: mist.scale.x, ph: rnd() * 6 });
    }
  }

  // giant chains anchoring the island to the earth
  for (const a of [2.3, 3.0, 3.8, 4.6, 5.4]) {
    const gx = cx + Math.cos(a) * 105, gz = cz + Math.sin(a) * 105;
    const gy = terrain.getHeight(gx, gz);
    slab(B, C2, 'giantStone', gx, gz, 9, 9, gy - 2, gy + 5, { ry: -a });
    B.add('giantMetal', part(new THREE.TorusGeometry(2.4, 0.6, 5, 12), C(0.6, 0.62, 0.7), { pos: [gx, gy + 7, gz], rot: [0, -a + Math.PI / 2, 0] }));
    const from = V(gx, gy + 8, gz);
    const to = V(cx + Math.cos(a) * 33, top - 12, cz + Math.sin(a) * 33 * 0.84);
    chain(B, from, to, { link: 1.15, sag: 16 });
  }

  // little floating islets with lanterns, chained to the big one
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05 + 0.4, d = 58 + rnd() * 16, y = 18 + rnd() * 45;
    const ix = cx + Math.cos(a) * d, iz = cz + Math.sin(a) * d;
    const islet = rockLathe([[0.01, -13], [4, -9], [7, -3], [8, 0], [5, 0.6], [0.01, 0.9]], 12, 0.45, 20 + i, [4, 3]);
    placeGeom(islet, [ix, y, iz], [0, rnd() * 3, 0]);
    B.add('giantRock', islet);
    B.add('giantWood', part(new THREE.BoxGeometry(0.4, 3, 0.4), C(0.6, 0.55, 0.5), { pos: [ix, y + 2, iz] }));
    B.add('giantGlow', part(new THREE.BoxGeometry(0.7, 1, 0.7), C(1.6, 0.85, 0.35), { pos: [ix, y + 3.9, iz] }));
    const flame = new THREE.Sprite(M.fireSprite);
    flame.position.set(ix, y + 3.9, iz);
    flame.scale.setScalar(4);
    scene.add(flame);
    fx.fires.push({ s: flame, base: 4, ph: rnd() * 6 });
    chain(B, V(ix, y + 0.5, iz), V(cx + Math.cos(a) * 36, top - 6, cz + Math.sin(a) * 30), { link: 0.5, sag: 6 });
  }
}

// The stone king: a displaced sphere sculpted into a sleeping face, crowned, lying on its cheek.
function kingHeadGeometry() {
  const g = new THREE.SphereGeometry(1, 56, 40);
  const p = g.attributes.position;
  const cols = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ax = Math.abs(x), fz = smoothstep(0.15, 0.75, z);
    let r = 1;
    r += 0.34 * Math.exp(-(x * x) / 0.01 - ((y + 0.06) ** 2) / 0.045) * fz;               // nose bridge
    r += 0.12 * Math.exp(-(x * x) / 0.035 - ((y + 0.27) ** 2) / 0.005) * fz;              // nose tip & nostrils
    r -= 0.2 * Math.exp(-((ax - 0.31) ** 2) / 0.014 - ((y - 0.12) ** 2) / 0.009) * fz;    // eye sockets
    r += 0.05 * Math.exp(-((ax - 0.31) ** 2) / 0.008 - ((y - 0.11) ** 2) / 0.002) * fz;   // closed eyelids
    r -= 0.06 * Math.exp(-((ax - 0.31) ** 2) / 0.008 - ((y - 0.095) ** 2) / 0.0002) * fz; // lid crease
    r += 0.13 * Math.exp(-((y - 0.27) ** 2) / 0.004) * smoothstep(0.62, 0.2, ax) * fz;    // heavy brow
    r -= 0.09 * Math.exp(-((y + 0.46) ** 2) / 0.0012) * smoothstep(0.42, 0.12, ax) * fz;  // mouth line
    r += 0.06 * Math.exp(-((y + 0.4) ** 2) / 0.002) * smoothstep(0.38, 0.1, ax) * fz;     // upper lip
    r += 0.06 * Math.exp(-((y + 0.53) ** 2) / 0.002) * smoothstep(0.36, 0.1, ax) * fz;    // lower lip
    r += 0.14 * Math.exp(-((y + 0.7) ** 2) / 0.02) * smoothstep(0.5, 0.1, ax) * fz;       // chin
    r += 0.08 * Math.exp(-((y + 0.25) ** 2) / 0.03) * smoothstep(0.2, 0.55, ax) * fz;     // cheekbones
    r += 0.13 * Math.exp(-((ax - 0.97) ** 2) / 0.004 - (y * y) / 0.03 - (z * z) / 0.02); // ears
    const n = fbm(x * 5 + 3, y * 5 + z * 5, 3, 17);
    r += (n - 0.5) * 0.07;
    const crack = Math.abs(fbm(x * 3 + 9, y * 7 - z * 2, 2, 31) - 0.5) < 0.018 ? -0.025 : 0;
    r += crack;
    p.setXYZ(i, x * r * 0.86, y * r * 1.14, z * r * 0.96);
    const moss = smoothstep(0.35, 0.8, y + (n - 0.5) * 0.6) + smoothstep(0.62, 0.4, n) * 0.25;
    let c = [0.62 + n * 0.3, 0.68 + n * 0.28, 0.92 + n * 0.25];
    // baked shading, PS2 style: recesses painted dark and ridges light so the face reads in any light
    const socket = Math.exp(-((ax - 0.31) ** 2) / 0.01 - ((y - 0.12) ** 2) / 0.006) * fz;
    const lineDark = (Math.exp(-((ax - 0.31) ** 2) / 0.008 - ((y - 0.095) ** 2) / 0.0003)
      + Math.exp(-((y + 0.46) ** 2) / 0.0008) * smoothstep(0.42, 0.12, ax)
      + Math.exp(-(((ax - 0.08) ** 2) / 0.002) - ((y + 0.3) ** 2) / 0.002)) * fz;
    const ridge = (Math.exp(-(x * x) / 0.006 - ((y + 0.05) ** 2) / 0.04) + Math.exp(-((y - 0.28) ** 2) / 0.003) * smoothstep(0.6, 0.2, ax)) * fz;
    const ao = (crack ? 0.4 : 1) * Math.min(1.35, Math.max(0.12, 0.62 + (r - 0.95) * 3 - socket * 0.55 - lineDark * 0.6 + ridge * 0.45));
    c = c.map((v, k) => (v + ([0.36, 0.55, 0.3][k] - v) * Math.min(1, moss)) * ao);
    cols.set(c, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 14, uv.getY(i) * 8);
  return g;
}

function buildStoneKing(B, C2, terrain, scene, M, fx) {
  const { x: hx, z: hz } = HEAD;
  // turned three-quarters toward the bridge so the nose reads in silhouette
  const S = 26, rot = [0, Math.PI / 2 + 0.55, 0.28];
  const center = [hx, 16, hz];
  B.add('giantRock', placeGeom(kingHeadGeometry(), center, rot, [S, S, S]));
  // crown: a crenellated band like a tower top
  const crown = [];
  crown.push(part(cyl(0.72, 0.82, 0.38, 20, 0.5), C(0.55, 0.66, 0.5), { pos: [0, 0.98, -0.02] }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const h = i === 4 ? 0.12 : 0.34;
    crown.push(part(new THREE.BoxGeometry(0.32, h, 0.16), C(0.5, 0.62, 0.46), { pos: [Math.sin(a) * 0.78, 1.17 + h / 2, Math.cos(a) * 0.78], rot: [0, a, 0] }));
  }
  for (const g of crown) B.add('giantStone', placeGeom(g, center, rot, [S, S, S]));
  C2.addCircle(hx, hz, 22);
  C2.addCircle(hx - 6, hz - 14, 16);

  // a giant hand breaking out of the earth nearby
  const handX = hx - 6, handZ = hz + 40, hg = terrain.getHeight(handX, handZ);
  B.add('giantRock', part(cyl(3.4, 4.2, 9, 10, 4), C(0.66, 0.72, 0.9), { pos: [handX, hg + 3, handZ], rot: [0.25, 0, 0.1] }));
  for (let f = 0; f < 4; f++) {
    const fx0 = handX - 3 + f * 2, fz0 = handZ - 1.5;
    B.add('giantRock', part(cyl(0.9, 0.7, 9 - Math.abs(f - 1.5) * 1.5, 7, 3), C(0.62, 0.7, 0.85), { pos: [fx0, hg + 10 - Math.abs(f - 1.5), fz0], rot: [-0.3 - f * 0.08, 0, (f - 1.5) * 0.12] }));
  }
  B.add('giantRock', part(cyl(1.0, 0.8, 7, 7, 3), C(0.62, 0.7, 0.85), { pos: [handX + 4.5, hg + 6, handZ + 1.5], rot: [0.3, 0, -0.7] }));
  C2.addCircle(handX, handZ, 5.5);

  // arched stone bridge over the stream, leading to his face
  const by = (t) => 1.0 + Math.sin(Math.PI * t) * 1.6;
  const n = 12, x0 = hx + 47, x1 = hx + 24;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t;
    const top = by(t);
    block(B, C2, 'stone', { x, y: top - 0.3, z: hz, w: (x0 - x1) / n + 0.05, h: 0.6, d: 4.4, tex: 1.5 });
    for (const s of [-1, 1]) {
      block(B, C2, 'stone', { x, y: top + 0.45, z: hz + s * 2.0, w: (x0 - x1) / n + 0.05, h: 0.9, d: 0.4, tex: 1.5 });
    }
  }
  for (const t of [0.3, 0.7]) slab(B, C2, 'stone', x0 + (x1 - x0) * t, hz, 1.6, 3.6, -1.2, by(t) - 0.6);
  // fire braziers
  const braziers = [[x0 + 1, hz - 3], [x0 + 1, hz + 3], [x1 - 1, hz - 3.2], [x1 - 1, hz + 3.2], [hx + 29, hz - 15], [hx + 29, hz + 15]];
  for (const [bx, bz] of braziers) {
    const g = terrain.getHeight(bx, bz);
    slab(B, C2, 'stone', bx, bz, 0.8, 0.8, g - 0.5, g + 1.2, { tex: 1 });
    B.add('metal', part(new THREE.CylinderGeometry(0.6, 0.35, 0.45, 8), C(0.5, 0.45, 0.4), { pos: [bx, g + 1.4, bz] }));
    B.add('glow', part(new THREE.OctahedronGeometry(0.35, 0), C(1.7, 0.75, 0.25), { pos: [bx, g + 1.85, bz], scale: [1, 1.7, 1] }));
    const s = new THREE.Sprite(M.fireSprite);
    s.position.set(bx, g + 2.0, bz);
    s.scale.setScalar(2.4);
    scene.add(s);
    fx.fires.push({ s, base: 2.4, ph: rnd() * 6 });
  }
  const light = new THREE.PointLight(0xff8a40, 10, 30, 1.5);
  light.position.set((x0 + x1) / 2, 4, hz);
  scene.add(light);
  fx.lights.push({ l: light, base: 10 });
}

function buildRibcage(B, C2, terrain) {
  const pts = terrain.rail.pts;
  let k = 0, bd = Infinity;
  pts.forEach((p, i) => { const d = Math.hypot(p.x - RIBCAGE.x, p.z - RIBCAGE.z); if (d < bd) { bd = d; k = i; } });
  const tan = pts[Math.min(pts.length - 1, k + 3)].clone().sub(pts[Math.max(0, k - 3)]).normalize();
  const ry = Math.atan2(tan.x, tan.z);
  const side = V(Math.cos(ry), 0, -Math.sin(ry));
  const bone = C(0.86, 0.83, 0.72), dirty = C(0.6, 0.6, 0.52);
  const ribs = 9;
  let spineTop = 0;
  for (let i = 0; i < ribs; i++) {
    const s = (i - (ribs - 1) / 2) * 6.5;
    const c = pts[k].clone().addScaledVector(tan, s);
    const g = Math.max(terrain.getHeight(c.x, c.z), 0);
    const R = 17 * (1 - ((i - 4) / 5.5) ** 2 * 0.65);
    const arc = i === 2 || i === 7 ? Math.PI * 0.78 : Math.PI;
    const rib = new THREE.TorusGeometry(R, 0.75 + R * 0.025, 6, 22, arc);
    const y = g + R * 0.08 - 1;
    B.add('bone', part(rib, i % 3 ? bone : dirty, { pos: [c.x, y, c.z], rot: [0, ry, 0.12] }));
    spineTop = Math.max(spineTop, y + R);
    for (const sgn of [-1, 1]) {
      const fp = c.clone().addScaledVector(side, sgn * R);
      C2.addCircle(fp.x, fp.z, 1.3);
    }
  }
  // vertebrae along the top
  for (let i = -1; i <= ribs; i++) {
    const s = (i - (ribs - 1) / 2) * 6.5;
    const c = pts[k].clone().addScaledVector(tan, s);
    const R = 17 * (1 - ((Math.min(Math.max(i, 0), ribs - 1) - 4) / 5.5) ** 2 * 0.65);
    const g = Math.max(terrain.getHeight(c.x, c.z), 0);
    const top = g + R * 0.08 - 1 + R * Math.cos(0.12) + 0.4;
    const off = -Math.sin(0.12) * R;
    const pos = c.clone().addScaledVector(side, off);
    B.add('bone', part(cyl(1.6, 1.6, 3.6, 8, 3), bone, { pos: [pos.x, top, pos.z], rot: [Math.PI / 2, ry, 0] }));
    B.add('bone', part(new THREE.BoxGeometry(0.8, 4.5, 1.6), bone, { pos: [pos.x, top + 2.6, pos.z], rot: [0, ry, 0.12] }));
  }
  // the skull, fallen beside the track
  const head = pts[k].clone().addScaledVector(tan, -(ribs / 2) * 6.5 - 14).addScaledVector(side, 9);
  const hg = terrain.getHeight(head.x, head.z);
  B.add('bone', part(new THREE.SphereGeometry(1, 14, 10), bone, { pos: [head.x, hg + 4, head.z], rot: [0.1, ry, 0.3], scale: [6, 5, 10] }));
  B.add('bone', part(new THREE.BoxGeometry(7, 2, 12), dirty, { pos: [head.x + 1, hg + 0.8, head.z], rot: [0.15, ry + 0.2, 0.1] }));
  for (const sgn of [-1, 1]) {
    const eye = head.clone().addScaledVector(side, sgn * 3.6).addScaledVector(tan, -4);
    B.add('plain', part(new THREE.SphereGeometry(1.5, 8, 6), C(0.02, 0.02, 0.03), { pos: [eye.x, hg + 5.2, eye.z] }));
    const hornBase = head.clone().addScaledVector(side, sgn * 4).addScaledVector(tan, 3);
    B.add('bone', part(new THREE.ConeGeometry(1.4, 14, 7), dirty, { pos: [hornBase.x, hg + 10, hornBase.z], rot: [0.5, ry, sgn * 0.5] }));
  }
  C2.addCircle(head.x, head.z, 7);
  return spineTop;
}

export function buildGiants(B, C2, terrain, scene, M) {
  const fx = { fires: [], mists: [], lights: [] };
  buildFloatingCastle(B, C2, terrain, scene, M, fx);
  buildStoneKing(B, C2, terrain, scene, M, fx);
  buildRibcage(B, C2, terrain);
  return fx;
}
