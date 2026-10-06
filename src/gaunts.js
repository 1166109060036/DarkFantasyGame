// The Pale Ones: emaciated, blood-streaked humanoids with stringy grey hair, PS2-horror style.
// Each is a real skinned rig (rigid one-bone-per-part binding) so the whole creature is only
// three draw calls (skin, hair, face) while still walking, crawling and lunging with bones.
//
//   gaunt   - hunched shambler with arms down to its knees; breaks into a sprint when close
//   crawler - skitters on all fours like a spider
//   weeper  - tall woman in a rotted gown, hair over her face; she only moves when you look away
//   brute   - a hulking three-metre giant of the same flesh; every other blow is a ground slam
import * as THREE from 'three';
import { ps2ify } from './ps2.js';
import { part, mergeGeometries, cylinderBetween } from './util.js';
import { rng, tileFbm } from './noise.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = (r, g, b) => new THREE.Color(r, g, b);

// ---------------------------------------------------------------- textures & materials
function canvasTex(w, h, paint, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  return t;
}

function skinTexture() {
  return canvasTex(64, 128, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        const n = tileFbm(u, v, 4, 8, 4, 811), m = tileFbm(u, v, 8, 16, 3, 812);
        let r = 0.74 + (n - 0.5) * 0.35, g = 0.7 + (n - 0.5) * 0.32, b = 0.62 + (n - 0.5) * 0.3;
        const bruise = Math.max(0, m - 0.62) * 2.5;              // grey-violet mottling
        r -= bruise * 0.25; g -= bruise * 0.3; b -= bruise * 0.12;
        const o = (y * w + x) * 4;
        img.data[o] = r * 255; img.data[o + 1] = g * 255; img.data[o + 2] = b * 255; img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // blood that ran down and dried in streaks
    const r = rng(813);
    for (let i = 0; i < 26; i++) {
      let x = r() * w, y = r() * h;
      const len = 10 + r() * 50, wid = 0.8 + r() * 2.2;
      for (let k = 0; k < len; k++) {
        const fade = 1 - k / len;
        ctx.fillStyle = `rgba(${120 + r() * 50 | 0},${10 + r() * 20 | 0},${14 + r() * 12 | 0},${0.35 + fade * 0.5})`;
        ctx.fillRect(x, y, wid * (0.6 + fade * 0.6), 1.4);
        x += (r() - 0.5) * 0.9; y += 1;
      }
    }
    // a few darker wounds
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = `rgba(70,8,10,${0.5 + r() * 0.4})`;
      ctx.beginPath(); ctx.ellipse(r() * w, r() * h, 1 + r() * 3, 0.8 + r() * 2, r() * 3, 0, Math.PI * 2); ctx.fill();
    }
    // faint rib / tendon lines
    ctx.strokeStyle = 'rgba(80,70,60,0.25)';
    for (let y = 10; y < 60; y += 7) { ctx.beginPath(); ctx.moveTo(4, y); ctx.quadraticCurveTo(32, y + 5, 60, y); ctx.stroke(); }
  });
}

function hairTexture() {
  return canvasTex(64, 128, (ctx, w, h) => {
    const r = rng(821);
    for (let i = 0; i < 70; i++) {
      let x = r() * w;
      const len = h * (0.55 + r() * 0.45), g = 150 + r() * 80;
      ctx.strokeStyle = `rgba(${g | 0},${g | 0},${(g * 1.02) | 0},${0.7 + r() * 0.3})`;
      ctx.lineWidth = 0.8 + r() * 1.6;
      ctx.beginPath(); ctx.moveTo(x, 0);
      for (let y = 0; y < len; y += 6) { x += (r() - 0.5) * 1.6; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }, false);
}

// gaunt face painted on a decal: sunken sockets, hollow cheeks, slack open mouth
function faceTexture() {
  return canvasTex(64, 80, (ctx, w, h) => {
    const g = ctx.createRadialGradient(32, 40, 6, 32, 40, 34);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const blob = (x, y, rx, ry, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); };
    // brow ridge and sockets
    blob(32, 27, 22, 6, 'rgba(70,55,50,0.35)');
    for (const s of [-1, 1]) {
      blob(32 + s * 11, 33, 8, 6.5, 'rgba(30,18,18,0.85)');
      blob(32 + s * 11, 34, 4.5, 3.5, 'rgba(10,4,4,0.95)');
      blob(32 + s * 10.5, 34, 1.4, 1.2, 'rgba(210,200,170,0.9)');      // a glint of a pupil
      blob(32 + s * 15, 50, 5, 9, 'rgba(60,40,36,0.4)');               // hollow cheeks
      ctx.strokeStyle = 'rgba(60,40,36,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(32 + s * 6, 44); ctx.lineTo(32 + s * 10, 62); ctx.stroke();   // nasolabial folds
    }
    // nose
    ctx.fillStyle = 'rgba(80,55,48,0.6)'; ctx.fillRect(30, 36, 2, 12);
    blob(29, 48, 2, 1.4, 'rgba(30,15,15,0.8)'); blob(35, 48, 2, 1.4, 'rgba(30,15,15,0.8)');
    // mouth hanging open, a few teeth
    blob(32, 59, 7, 5.5, 'rgba(20,4,6,0.95)');
    ctx.fillStyle = 'rgba(200,190,150,0.9)';
    for (const x of [27, 30, 34, 37]) ctx.fillRect(x, 54.5, 1.6, 2.4);
    ctx.fillStyle = 'rgba(120,20,20,0.7)'; ctx.fillRect(28, 64, 2, 9); ctx.fillRect(36, 63, 1.5, 6);  // blood from the mouth
    // wrinkles
    ctx.strokeStyle = 'rgba(70,55,50,0.45)';
    for (let y = 16; y < 24; y += 3) { ctx.beginPath(); ctx.moveTo(18, y); ctx.quadraticCurveTo(32, y - 2, 46, y); ctx.stroke(); }
  }, false);
}

function gownTexture() {
  return canvasTex(64, 64, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = tileFbm(x / w, y / h, 4, 4, 4, 831), d = Math.max(0, tileFbm(x / w, y / h, 8, 8, 2, 832) - 0.6) * 2;
      const v = 0.72 + (n - 0.5) * 0.4 - d * 0.4;
      const o = (y * w + x) * 4;
      img.data[o] = v * 235; img.data[o + 1] = v * 225; img.data[o + 2] = v * 205; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = 'rgba(110,15,15,0.55)';
    const r = rng(833);
    for (let i = 0; i < 9; i++) ctx.fillRect(r() * w, r() * h, 1 + r() * 3, 6 + r() * 20);
  });
}

let MATS = null;
function mats() {
  if (MATS) return MATS;
  const L = (o) => ps2ify(new THREE.MeshLambertMaterial(o));
  MATS = {
    skin: L({ map: skinTexture(), vertexColors: true }),
    hair: L({ map: hairTexture(), alphaTest: 0.35, side: THREE.DoubleSide, vertexColors: true }),
    face: L({ map: faceTexture(), transparent: true, alphaTest: 0.05, depthWrite: false, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2 }),
    gown: L({ map: gownTexture(), side: THREE.DoubleSide, vertexColors: true }),
  };
  return MATS;
}

// ---------------------------------------------------------------- rig builder
const BONES = {
  hips: [null, 0, 0.98, 0], spine: ['hips', 0, 1.12, 0], chest: ['spine', 0, 1.38, 0], neck: ['chest', 0, 1.58, 0.02], head: ['neck', 0, 1.68, 0.04],
  shL: ['chest', 0.19, 1.52, 0], elL: ['shL', 0.21, 1.17, 0.01], haL: ['elL', 0.22, 0.85, 0.02],
  shR: ['chest', -0.19, 1.52, 0], elR: ['shR', -0.21, 1.17, 0.01], haR: ['elR', -0.22, 0.85, 0.02],
  hiL: ['hips', 0.1, 0.94, 0], knL: ['hiL', 0.11, 0.52, 0.03], anL: ['knL', 0.11, 0.08, 0],
  hiR: ['hips', -0.1, 0.94, 0], knR: ['hiR', -0.11, 0.52, 0.03], anR: ['knR', -0.11, 0.08, 0],
};
const BONE_NAMES = Object.keys(BONES);
const P = (name) => V(BONES[name][1], BONES[name][2], BONES[name][3]);

function buildRig(groups) {
  const root = new THREE.Group();
  const bones = {};
  for (const name of BONE_NAMES) {
    const [parent, x, y, z] = BONES[name];
    const b = new THREE.Bone();
    b.name = name;
    if (parent) { const [, px, py, pz] = BONES[parent]; b.position.set(x - px, y - py, z - pz); bones[parent].add(b); }
    else { b.position.set(x, y, z); root.add(b); }
    bones[name] = b;
  }
  root.updateMatrixWorld(true);
  const list = BONE_NAMES.map((n) => bones[n]);
  const skeleton = new THREE.Skeleton(list);
  for (const [matKey, parts] of Object.entries(groups)) {
    if (!parts.length) continue;
    const geoms = parts.map(([bone, g]) => {
      const n = g.attributes.position.count, bi = BONE_NAMES.indexOf(bone);
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).map((_, i) => (i % 4 === 0 ? bi : 0)), 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
      return g;
    });
    const merged = mergeGeometries(geoms);
    // mergeGeometries keeps the standard attributes only; carry the skin attributes over
    for (const key of ['skinIndex', 'skinWeight']) {
      const size = 4, total = geoms.reduce((s, g) => s + g.attributes.position.count, 0);
      const arr = key === 'skinIndex' ? new Uint16Array(total * size) : new Float32Array(total * size);
      let o = 0;
      for (const g of geoms) { arr.set(g.attributes[key].array, o); o += g.attributes[key].array.length; }
      merged.setAttribute(key, key === 'skinIndex' ? new THREE.Uint16BufferAttribute(arr, 4) : new THREE.Float32BufferAttribute(arr, 4));
    }
    const mesh = new THREE.SkinnedMesh(merged, mats()[matKey]);
    mesh.bind(skeleton, new THREE.Matrix4());
    mesh.frustumCulled = false;
    root.add(mesh);
  }
  const rest = {};
  for (const n of BONE_NAMES) rest[n] = bones[n].position.clone();
  return { root, bones, rest };
}

// limb segment (cylinder) between two bone positions, already non-indexed for merging
const seg = (a, b, r0, r1, color = 0xffffff, sides = 6) => part(cylinderBetween(a, b, r0, r1, sides), color);
const blob = (pos, r, scale, color = 0xffffff, w = 8, h = 6) => part(new THREE.SphereGeometry(r, w, h), color, { pos: [pos.x, pos.y, pos.z], scale });

function body(opts = {}) {
  const k = opts.thick ?? 1, tint = opts.tint ?? C(1, 1, 1), skin = [], hair = [], face = [], gown = [];
  const S = (bone, g) => skin.push([bone, g]);
  // torso: jutting pelvis, swollen belly, narrow ribcage
  S('hips', blob(V(0, 0.98, 0), 0.14 * k, [1.1, 0.75, 0.85], tint));
  S('spine', blob(V(0, 1.12, 0.035), 0.15 * k, [0.95, 1.05, 0.85], tint));
  S('chest', seg(V(0, 1.2, 0), V(0, 1.52, 0), 0.13 * k, 0.17 * k, tint, 8));
  S('chest', blob(V(0, 1.52, 0), 0.17 * k, [1.15, 0.35, 0.72], tint));
  S('neck', seg(P('neck'), V(0, 1.71, 0.05), 0.045 * k, 0.04 * k, tint));
  // head: long, narrow skull with a dangling jaw
  S('head', blob(V(0, 1.79, 0.04), 0.115, [0.88, 1.18, 1.0], tint, 9, 7));
  S('head', part(new THREE.BoxGeometry(0.13, 0.07, 0.11), tint, { pos: [0, 1.66, 0.08], rot: [0.3, 0, 0] }));
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R', sh = P(`sh${L}`), el = P(`el${L}`), ha = P(`ha${L}`);
    S(`sh${L}`, blob(sh, 0.055 * k, [1, 1, 1], tint, 6, 5));
    S(`sh${L}`, seg(sh, el, 0.042 * k, 0.03 * k, tint));
    S(`el${L}`, blob(el, 0.035 * k, [1, 1, 1], tint, 6, 4));
    S(`el${L}`, seg(el, ha, 0.032 * k, 0.024 * k, tint));
    // long hands with claw-like fingers
    S(`ha${L}`, part(new THREE.BoxGeometry(0.05 * k, 0.1, 0.035 * k), tint, { pos: [ha.x, ha.y - 0.05, ha.z] }));
    for (let f = 0; f < 4; f++) {
      const fx = ha.x + (f - 1.5) * 0.013 * k;
      S(`ha${L}`, seg(V(fx, ha.y - 0.1, ha.z), V(fx + s * 0.005, ha.y - 0.25 - (f === 1 || f === 2 ? 0.03 : 0), ha.z + 0.025), 0.009, 0.004, C(0.6, 0.56, 0.5), 4));
    }
    const hi = P(`hi${L}`), kn = P(`kn${L}`), an = P(`an${L}`);
    S(`hi${L}`, seg(hi, kn, 0.06 * k, 0.04 * k, tint));
    S(`kn${L}`, blob(kn, 0.045 * k, [1, 1, 1], tint, 6, 4));
    S(`kn${L}`, seg(kn, an, 0.042 * k, 0.03 * k, tint));
    S(`an${L}`, part(new THREE.BoxGeometry(0.07 * k, 0.045, 0.2), tint, { pos: [an.x, an.y - 0.04, an.z + 0.05] }));
  }
  // face decal
  if (opts.face !== false) face.push(['head', part(new THREE.PlaneGeometry(0.21, 0.27), 0xffffff, { pos: [0, 1.755, 0.172], rot: [-0.06, 0, 0] })]);
  // stringy hair hanging from the crown
  if (opts.hair) {
    const len = opts.hair, r = rng(opts.seed || 5);
    // thinning grey scalp under the strands
    skin.push(['head', part(new THREE.SphereGeometry(0.124, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), C(0.62, 0.62, 0.64), { pos: [0, 1.8, 0.03], scale: [0.9, 1.15, 1.02] })]);
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * (0.15 + (i / 10) * 1.7) + Math.PI / 2;         // around the back and sides
      const l = len * (0.75 + r() * 0.4);
      const g = new THREE.PlaneGeometry(0.1 + r() * 0.05, l);
      g.translate(0, -l / 2, 0);
      g.rotateX(-0.12 - r() * 0.12);                                   // strands fall away from the skull
      g.rotateY(Math.PI / 2 - a);                                   // card faces outward from the skull
      g.translate(Math.cos(a) * 0.11, 1.87 + r() * 0.03, 0.04 + Math.sin(a) * 0.11);
      hair.push(['head', part(g, C(0.9 + r() * 0.1, 0.9, 0.92))]);
    }
    for (const s of [-1, 1]) {                                       // strands framing the face
      const g = new THREE.PlaneGeometry(0.06, len * (opts.veil ? 1.0 : 0.65));
      g.translate(0, -len * (opts.veil ? 0.5 : 0.32), 0);
      g.translate(s * 0.075, 1.9, 0.14);
      hair.push(['head', part(g, C(0.85, 0.85, 0.88))]);
    }
    if (opts.veil) {                                                  // a curtain right over the face
      const g = new THREE.PlaneGeometry(0.2, len);
      g.translate(0, 1.9 - len / 2, 0.165);
      hair.push(['head', part(g, C(0.8, 0.8, 0.83))]);
    }
  }
  if (opts.gown) {
    const g = new THREE.CylinderGeometry(0.17, 0.42, 0.95, 9, 3, true);
    const pos = g.attributes.position;
    const r = rng(77);
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) < -0.4) pos.setY(i, pos.getY(i) - r() * 0.18);   // ragged hem
    gown.push(['spine', part(g, 0xffffff, { pos: [0, 1.0, 0.01] })]);
    gown.push(['chest', part(new THREE.CylinderGeometry(0.17, 0.17, 0.38, 9, 1, true), 0xffffff, { pos: [0, 1.36, 0] })]);
  }
  return { skin, hair, face, gown };
}

// ---------------------------------------------------------------- creatures
function make(kind, opts, scale) {
  const g = new THREE.Group();
  const rig = buildRig(body(opts));
  g.add(rig.root);
  rig.root.scale.setScalar(scale);
  g.userData = { kind, rig, phase: Math.random() * 10, gait: 0, look: 0, animate: (e, dt, t, s) => ANIM[kind](rig, e, dt, t, s) };
  return g;
}

export const createGaunt = () => make('gaunt', { hair: 0.62, seed: 3 }, 1.02);
export const createCrawler = () => make('crawler', { hair: 0.35, seed: 9, tint: C(0.86, 0.84, 0.8), thick: 0.85 }, 1.0);
export const createWeeper = () => make('weeper', { hair: 1.05, veil: true, gown: true, face: false, seed: 13, tint: C(0.92, 0.9, 0.88) }, 1.18);
export const createBrute = () => make('brute', { hair: 0.4, seed: 21, thick: 2.1, tint: C(0.9, 0.82, 0.78) }, 1.75);

// ---------------------------------------------------------------- animation
const ease = (x) => x * x * (3 - 2 * x);

function reset(rig) {
  for (const n of BONE_NAMES) { rig.bones[n].rotation.set(0, 0, 0); rig.bones[n].position.copy(rig.rest[n]); }
}

// s: { windup 0..1, striking 0|1, stagger 0|1, moving 0..1, speed, dying 0..1, frozen }
// s.speed is already radians-per-second of gait (ground speed x stride frequency)
function gaitPhase(o, e, dt, s) {
  o.userData.gait += dt * s.speed;
  return o.userData.gait;
}

const ANIM = {
  gaunt(rig, e, dt, t, s) {
    const b = rig.bones, ph = gaitPhase(e.obj, e, dt, s), m = s.moving, run = s.running ? 1 : 0;
    reset(rig);
    const twitch = Math.sin(t * 13 + e.obj.userData.phase) * Math.max(0, Math.sin(t * 0.9 + e.obj.userData.phase) - 0.6) * 1.5;
    b.spine.rotation.x = 0.5 + run * 0.25 + Math.sin(ph * 2) * 0.03 * m;
    b.chest.rotation.x = 0.38 + run * 0.1;
    b.neck.rotation.x = -0.72 - run * 0.2;
    const torso = b.spine.rotation.x + b.chest.rotation.x;
    b.head.rotation.z = 0.22 + twitch * 0.25 + Math.sin(t * 0.7) * 0.05;
    b.head.rotation.x = -0.1;
    b.hips.position.y = rig.rest.hips.y - 0.09 + Math.abs(Math.sin(ph)) * 0.03 * m;
    const sw = 0.55 * m * (1 + run * 0.5);
    for (const [L, sgn] of [['L', 1], ['R', -1]]) {
      const p = ph + (sgn > 0 ? 0 : Math.PI);
      b[`hi${L}`].rotation.x = -Math.sin(p) * sw - 0.35;
      b[`kn${L}`].rotation.x = Math.max(0, Math.sin(p + 1.4)) * (0.9 + run * 0.6) * m + 0.5;
      b[`an${L}`].rotation.x = -0.15;
      // arms dangle straight down in front, clawed hands hanging by the knees
      b[`sh${L}`].rotation.x = -torso - 0.12 + Math.sin(p) * 0.3 * m - run * 0.4;
      b[`sh${L}`].rotation.z = sgn * 0.12;
      b[`el${L}`].rotation.x = -0.25 - run * 0.5;
      b[`ha${L}`].rotation.x = -0.2;
    }
    if (s.windup) {                                // rears up, arms flung high and wide
      const w = ease(s.windup);
      b.spine.rotation.x -= 0.5 * w; b.neck.rotation.x -= 0.4 * w;
      for (const [L, sgn] of [['L', 1], ['R', -1]]) { b[`sh${L}`].rotation.x = -torso - 0.12 - 2.0 * w; b[`sh${L}`].rotation.z = sgn * (0.12 + 0.6 * w); b[`el${L}`].rotation.x = -0.6 * w; }
    }
    if (s.striking) {                              // both claws rake down
      b.spine.rotation.x += 0.45;
      for (const L of ['L', 'R']) { b[`sh${L}`].rotation.x = -torso - 0.9; b[`sh${L}`].rotation.z = 0; b[`el${L}`].rotation.x = -0.2; }
    }
    if (s.stagger) { b.spine.rotation.x -= 0.5; b.neck.rotation.x += 0.5; b.shL.rotation.z = 0.8; b.shR.rotation.z = -0.8; }
    if (s.dying) collapse(rig, s.dying);
  },

  crawler(rig, e, dt, t, s) {
    const b = rig.bones, ph = gaitPhase(e.obj, e, dt, s), m = s.moving;
    reset(rig);
    b.hips.position.y = 0.6 + Math.abs(Math.sin(ph * 2)) * 0.03 * m;
    b.hips.position.z = -0.25;
    b.spine.rotation.x = 1.2;
    b.chest.rotation.x = 0.25;
    b.neck.rotation.x = -1.0;
    b.head.rotation.x = -0.45;
    b.head.rotation.z = Math.sin(t * 9 + e.obj.userData.phase) * 0.12;
    const torso = b.spine.rotation.x + b.chest.rotation.x;
    for (const [L, sgn] of [['L', 1], ['R', -1]]) {
      const p = ph + (sgn > 0 ? 0 : Math.PI);
      // arms are front legs: cancel the torso pitch so they reach the ground, then step
      b[`sh${L}`].rotation.x = -torso + 0.15 - Math.sin(p) * 0.45 * m;
      b[`sh${L}`].rotation.z = sgn * 0.35;
      b[`el${L}`].rotation.x = -0.35 + Math.max(0, Math.sin(p + 1.2)) * 0.6 * m;
      b[`ha${L}`].rotation.x = 0.9;
      // hind legs splay out like a spider's
      b[`hi${L}`].rotation.x = -1.25 + Math.sin(p + Math.PI) * 0.4 * m;
      b[`hi${L}`].rotation.z = sgn * 0.45;
      b[`kn${L}`].rotation.x = 1.9 - Math.max(0, Math.sin(p + 2.2)) * 0.5 * m;
      b[`an${L}`].rotation.x = -0.5;
    }
    if (s.windup) { const w = ease(s.windup); b.spine.rotation.x -= 0.6 * w; b.neck.rotation.x += 0.3 * w; b.hips.position.y -= 0.12 * w; }
    if (s.striking) { b.spine.rotation.x += 0.2; b.shL.rotation.x -= 0.9; b.shR.rotation.x -= 0.9; }
    if (s.stagger) { b.spine.rotation.x -= 0.4; b.hips.position.y += 0.1; }
    if (s.dying) { b.hips.position.y = 0.6 - 0.45 * s.dying; b.spine.rotation.x = 1.2 + 0.35 * s.dying; b.shL.rotation.z = 1.2 * s.dying; b.shR.rotation.z = -1.2 * s.dying; }
  },

  weeper(rig, e, dt, t, s) {
    const b = rig.bones;
    reset(rig);
    // perfectly still while watched; a faint shiver when unwatched
    const shiver = s.frozen ? 0 : Math.sin(t * 31) * 0.02;
    b.neck.rotation.x = 0.55 + shiver;
    b.head.rotation.x = 0.25;
    b.head.rotation.z = -0.12 + shiver;
    b.spine.rotation.x = 0.06;
    for (const [L, sgn] of [['L', 1], ['R', -1]]) {
      b[`sh${L}`].rotation.x = -0.08;
      b[`sh${L}`].rotation.z = sgn * 0.06;
      b[`el${L}`].rotation.x = -0.12;
      b[`hi${L}`].rotation.x = 0.02;
      b[`kn${L}`].rotation.x = 0.05;
    }
    if (s.windup) {                                // the head snaps up and the arms reach out
      const w = ease(s.windup);
      b.neck.rotation.x = 0.55 - 1.0 * w; b.head.rotation.x = 0.25 - 0.5 * w;
      for (const L of ['L', 'R']) { b[`sh${L}`].rotation.x = -1.5 * w; b[`el${L}`].rotation.x = -0.3 * w; }
    }
    if (s.striking) for (const L of ['L', 'R']) { b[`sh${L}`].rotation.x = -1.35; b[`el${L}`].rotation.x = -0.9; }
    if (s.stagger) { b.spine.rotation.x = -0.3; b.neck.rotation.x = -0.3; }
    if (s.dying) collapse(rig, s.dying);
  },

  brute(rig, e, dt, t, s) {
    const b = rig.bones, ph = gaitPhase(e.obj, e, dt, s), m = s.moving;
    reset(rig);
    b.spine.rotation.x = 0.45; b.chest.rotation.x = 0.2; b.neck.rotation.x = -0.75;
    b.hips.position.y = rig.rest.hips.y - 0.1 + Math.abs(Math.sin(ph)) * 0.05 * m;
    b.hips.rotation.z = Math.sin(ph) * 0.08 * m;                // heavy side-to-side lurch
    for (const [L, sgn] of [['L', 1], ['R', -1]]) {
      const p = ph + (sgn > 0 ? 0 : Math.PI);
      b[`hi${L}`].rotation.x = -Math.sin(p) * 0.4 * m - 0.2;
      b[`hi${L}`].rotation.z = sgn * 0.12;
      b[`kn${L}`].rotation.x = Math.max(0, Math.sin(p + 1.4)) * 0.6 * m + 0.35;
      // knuckles drag along the ground
      b[`sh${L}`].rotation.x = -0.9 + Math.sin(p) * 0.2 * m;
      b[`sh${L}`].rotation.z = sgn * 0.3;
      b[`el${L}`].rotation.x = -0.2;
    }
    if (s.windup) {                                // both fists raised high overhead
      const w = ease(s.windup);
      b.spine.rotation.x -= 0.7 * w; b.neck.rotation.x += 0.2 * w;
      for (const [L, sgn] of [['L', 1], ['R', -1]]) { b[`sh${L}`].rotation.x = -0.9 - 2.0 * w; b[`sh${L}`].rotation.z = sgn * (0.3 - 0.2 * w); b[`el${L}`].rotation.x = -1.3 * w; }
    }
    if (s.striking) {                              // and brought down on the ground
      b.spine.rotation.x += 0.75;
      for (const L of ['L', 'R']) { b[`sh${L}`].rotation.x = -1.2; b[`sh${L}`].rotation.z = 0; b[`el${L}`].rotation.x = 0; }
    }
    if (s.stagger) { b.spine.rotation.x -= 0.4; b.hips.position.y += 0.05; }
    if (s.dying) collapse(rig, s.dying);
  },
};

// fold at the knees and topple forward
function collapse(rig, k) {
  const b = rig.bones, d = ease(Math.min(1, k * 1.3));
  b.hips.position.y = rig.rest.hips.y - 0.75 * d;
  b.knL.rotation.x = 1.7 * d; b.knR.rotation.x = 1.6 * d;
  b.hiL.rotation.x = -1.1 * d; b.hiR.rotation.x = -1.0 * d;
  b.spine.rotation.x = 0.4 + 0.9 * d;
  b.neck.rotation.x = 0.4 * d;
  b.shL.rotation.z = 0.6 * d; b.shR.rotation.z = -0.5 * d;
}
