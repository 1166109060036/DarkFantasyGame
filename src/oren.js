// Oren the hunter (นายพรานโอเรน): the man whose journal waits at the hunter's camp, who went into
// the dark wood after his daughter and came out one of the Lost. He still wears the long coat,
// the wide hat and the iron mask he hunted in, and still carries his skinning knife. He fights
// like the rest of the Lost (src/hollow.js), only harder.
//
// Model: "BOUNTY HUNTER" by EZ-GAZI (https://sketchfab.com/EZ-GAZI), CC-BY-4.0. Its only bones are for the cloth, so the
// skeleton here is built in code: joints placed on the model, every vertex weighted to them by
// where it sits (coat tails between the hips and the thighs, the cape between the chest and the
// shoulders), then the A-posed arms brought down to hang before any pose is set.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { ps2ify } from './ps2.js';
import { animateLost } from './hollow.js';
import { part, mergeGeometries } from './util.js';

const HEIGHT = 1.98, SRC_H = 3.1;           // the model is ~3.1 units tall
// joints in the model's own units (faces +z, +x is its left); parent first
const J = {
  hips: [[0, 1.45, 0]], spine: [[0, 1.68, 0], 'hips'], chest: [[0, 1.92, 0], 'spine'], upper: [[0, 2.18, 0], 'chest'],
  neck: [[0, 2.5, 0], 'upper'], head: [[0, 2.66, 0], 'neck'],
  armL: [[0.3, 2.42, -0.05], 'upper'], foreL: [[0.56, 2.12, -0.04], 'armL'], handL: [[0.76, 1.86, 0.05], 'foreL'],
  armR: [[-0.3, 2.42, -0.05], 'upper'], foreR: [[-0.56, 2.12, -0.04], 'armR'], handR: [[-0.76, 1.86, 0.05], 'foreR'],
  thighL: [[0.15, 1.42, 0], 'hips'], shinL: [[0.18, 0.82, 0], 'thighL'], footL: [[0.2, 0.28, 0], 'shinL'],
  thighR: [[-0.15, 1.42, 0], 'hips'], shinR: [[-0.18, 0.82, 0], 'thighR'], footR: [[-0.2, 0.28, 0], 'shinR'],
};
const KEYS = Object.keys(J), IDX = Object.fromEntries(KEYS.map((k, i) => [k, i]));
const ARM_DOWN = 0.6;                       // the A-pose's arms swung down to hang beside the body
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// which bones a vertex follows, by where it sits and what it is part of
function weigh(x, y, z, kind) {
  const s = x >= 0 ? 'L' : 'R', ax = Math.abs(x), w = {};
  const add = (k, v) => { if (v > 0) w[k] = (w[k] || 0) + v; };
  const torso = (k = 1) => {
    const T = [['hips', 1.45], ['spine', 1.68], ['chest', 1.92], ['upper', 2.18], ['neck', 2.5], ['head', 2.66]];
    if (y <= T[0][1]) return add('hips', k);
    for (let i = 0; i < T.length - 1; i++) {
      if (y <= T[i + 1][1]) { const f = (y - T[i][1]) / (T[i + 1][1] - T[i][1]); add(T[i][0], k * (1 - f)); add(T[i + 1][0], k * f); return; }
    }
    add('head', k);
  };
  if (kind === 'head') { add('head', 1); return w; }
  // along the arm: 0 at the shoulder, 1 at the wrist
  const sh = J['arm' + s][0], wr = J['hand' + s][0];
  const ux = Math.abs(wr[0]) - Math.abs(sh[0]), uy = wr[1] - sh[1], L2 = ux * ux + uy * uy;
  const t = ((ax - Math.abs(sh[0])) * ux + (y - sh[1]) * uy) / L2;
  if (kind === 'cape') {
    // the cape over the shoulders: the chest, and the arm for its outer edges
    const k = sstep(0.16, 0.5, ax);
    torso(1 - k); add('arm' + s, k);
    return w;
  }
  if (kind === 'gauntlet' || (y > 1.45 && ax > 0.27 && t > -0.05)) {
    const up = 1 - sstep(0.4, 0.6, t), hand = sstep(0.95, 1.05, t);
    const sh0 = sstep(-0.05, 0.12, t);           // where the sleeve meets the body
    torso(1 - sh0); add('arm' + s, sh0 * up); add('fore' + s, sh0 * (1 - up) * (1 - hand)); add('hand' + s, sh0 * hand);
    return w;
  }
  if (kind === 'coat' && y < 1.55) {
    // the coat's skirts: carried by the hips, swung by the thighs more the lower they hang
    const k = Math.min(1, Math.max(0, (1.5 - y) / 0.9)) * 0.8, l = sstep(-0.12, 0.12, x);
    add('hips', 1 - k); add('thighL', k * l); add('thighR', k * (1 - l));
    return w;
  }
  if (y < 1.45) {
    const knee = sstep(0.72, 0.92, y), ankle = sstep(0.24, 0.36, y), hip = sstep(1.3, 1.5, y);
    add('hips', hip); add('thigh' + s, (1 - hip) * knee); add('shin' + s, (1 - hip) * (1 - knee) * ankle); add('foot' + s, (1 - ankle));
    return w;
  }
  torso();
  return w;
}

const KIND = { BLACK: 'head', CLOTH_X: 'cape' };
function kindOf(mesh, matName) {
  const n = mesh.geometry.attributes.position.count;
  if (matName === 'ARMOR' && n === 458) return 'gauntlet';
  if (matName === 'ARMOR' && n === 238) return 'head';      // the iron mask
  if (matName === 'CLOTH' && (n === 218 || n === 96)) return 'head';  // the hat and the hood
  if (matName === 'CLOTH') return 'coat';
  return KIND[matName] || 'body';
}

let asset = null, loading = null;
export function loadOrenAsset() {
  if (!loading) loading = new GLTFLoader().loadAsync('assets/enemies/oren.glb').then((gltf) => {
    gltf.scene.updateMatrixWorld(true);
    const parts = [], v = new THREE.Vector3(), mats = new Map();
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const src = o.geometry, n = src.attributes.position.count, kind = kindOf(o, o.material.name);
      const pos = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld);        // as it stands in the file
        v.toArray(pos, i * 3);
        const ws = Object.entries(weigh(v.x, v.y, v.z, kind)).sort((a, b) => b[1] - a[1]).slice(0, 4);
        const sum = ws.reduce((a, [, x]) => a + x, 0) || 1;
        ws.forEach(([k, x], j) => { si[i * 4 + j] = IDX[k]; sw[i * 4 + j] = x / sum; });
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('uv', src.attributes.uv);
      geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
      geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
      if (src.index) geo.setIndex(src.index);
      geo.computeVertexNormals();
      if (!mats.has(o.material)) {
        const map = o.material.map;
        if (map) { map.magFilter = THREE.NearestFilter; map.colorSpace = THREE.NoColorSpace; }
        const cut = o.material.transparent || o.material.alphaTest > 0;
        mats.set(o.material, ps2ify(new THREE.MeshLambertMaterial({ map, color: new THREE.Color(0.62, 0.58, 0.56), side: THREE.DoubleSide, alphaTest: cut ? 0.5 : 0 })));
      }
      parts.push({ geo, mat: mats.get(o.material) });
    });
    asset = { parts };
    return asset;
  }).catch((e) => { console.warn('oren failed to load', e); return null; });
  return loading;
}

const glowEye = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.8, 0.3), fog: false });

// his skinning knife, along +z from the grip
function knife() {
  const C = (r, g, b) => new THREE.Color(r, g, b);
  const tip = new THREE.CylinderGeometry(0.001, 0.045, 0.12, 4, 1).rotateX(Math.PI / 2).translate(0, 0, 0.6);
  tip.scale(0.25, 1, 1);
  return mergeGeometries([
    part(new THREE.BoxGeometry(0.018, 0.08, 0.38), C(0.66, 0.67, 0.7), { pos: [0, 0.01, 0.35] }),
    part(tip, C(0.66, 0.67, 0.7)),
    part(new THREE.BoxGeometry(0.05, 0.16, 0.04), C(0.2, 0.18, 0.16), { pos: [0, 0, 0.15] }),
    part(new THREE.CylinderGeometry(0.03, 0.03, 0.24, 6).rotateX(Math.PI / 2), C(0.28, 0.18, 0.12), { pos: [0, 0, 0] }),
  ]);
}

export function createOren(M) {
  const obj = new THREE.Group();
  obj.name = 'oren';
  obj.rotation.order = 'YXZ';
  const ud = obj.userData;
  const attach = () => {
    // a fresh skeleton per body, sharing the geometry
    const root = new THREE.Group();
    root.scale.setScalar(HEIGHT / SRC_H);
    const bones = {};
    for (const k of KEYS) {
      const [p, parent] = J[k], b = new THREE.Bone();
      b.name = k;
      const pp = parent ? J[parent][0] : [0, 0, 0];
      b.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]);
      (parent ? bones[parent] : root).add(b);
      bones[k] = b;
    }
    root.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(KEYS.map((k) => bones[k]));
    const mats = new Map();
    for (const { geo, mat } of asset.parts) {
      if (!mats.has(mat)) mats.set(mat, mat.clone());
      const m = new THREE.SkinnedMesh(geo, mats.get(mat));
      m.frustumCulled = false;
      root.add(m);
      m.updateMatrixWorld(true);
      m.bind(skeleton);
    }
    // the rest pose the animations start from: arms hanging, not spread
    bones.armL.rotation.z = -ARM_DOWN;
    bones.armR.rotation.z = ARM_DOWN;
    const rest = {};
    for (const k of KEYS) {
      const P = new THREE.Quaternion();
      for (let b = bones[k].parent; b && b.isBone; b = b.parent) P.premultiply(b.quaternion);
      rest[k] = { rest: bones[k].quaternion.clone(), P, Pi: P.clone().invert() };
    }
    root.updateMatrixWorld(true);
    // the knife in his right fist, pointing forward; embers behind the mask's eye holes
    const k = new THREE.Mesh(knife(), M.metal);
    bones.handR.getWorldPosition(k.position);
    root.worldToLocal(k.position);
    k.position.y -= 0.12;
    k.scale.setScalar(SRC_H / HEIGHT);
    root.add(k);
    root.updateMatrixWorld(true);
    bones.handR.attach(k);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.022, 0.02), glowEye);
      eye.position.set(sx * 0.045, 2.86, 0.165);
      root.add(eye);
      bones.head.attach(eye);
    }
    obj.add(root);
    const _q = new THREE.Quaternion(), _e = new THREE.Euler();
    ud.rot = (bone, x = 0, y = 0, z = 0) => {
      const r = bone && rest[bone.name];
      if (!r) return;
      _q.setFromEuler(_e.set(x, y, z, 'YXZ'));
      bone.quaternion.copy(r.Pi).multiply(_q).multiply(r.P).multiply(r.rest);
    };
    Object.assign(ud, { body: root, bones, mats: [...mats.values()] });
  };
  if (asset) attach();
  else loadOrenAsset().then(() => asset && attach());
  ud.animate = (e, dt, t, st) => ud.rot && animateLost(ud, ud.rot, e, dt, t, st);
  return obj;
}
