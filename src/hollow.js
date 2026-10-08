// The Lost (ผู้หลงทาง): travellers who came to the Moonmire before you and lost themselves in it.
// Stripped, scorched, silent, they still walk the roads and still fight like people: fists up in a
// guard that turns light blows from the front, two-blow combinations, a sidestep when you swing.
// Break the guard with a heavy blow, hit them from the side, or catch them as they recover.
//
// Model: "Lowpoly Male Base Mesh" by arsenios (https://sketchfab.com/arsenikos), Sketchfab
// Standard licence. It ships only an idle, so every pose here is set on its bones in code.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from '../vendor/addons/utils/SkeletonUtils.js';
import { ps2ify } from './ps2.js';
import { lerp } from './util.js';

// the bones we pose (model faces +z, +x is its left)
const B = {
  hips: 'spine_01', spine: 'spine001_02', chest: 'spine002_03', upper: 'spine003_04', neck: 'spine004_05', head: 'spine006_07',
  armL: 'upper_armL_09', foreL: 'forearmL_010', armR: 'upper_armR_012', foreR: 'forearmR_013',
  thighL: 'thighL_014', shinL: 'shinL_015', footL: 'footL_019', thighR: 'thighR_016', shinR: 'shinR_017', footR: 'footR_040',
};

let ASSET = null, loading = null;
const REST = {};          // per bone: rest quaternion and its parent's rest orientation in model space
export function loadHollowAsset() {
  if (!loading) {
    loading = new GLTFLoader().loadAsync('assets/enemies/husk.glb').then((gltf) => {
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const map = o.material.map;
        if (map) { map.magFilter = THREE.NearestFilter; map.colorSpace = THREE.NoColorSpace; }
        o.material = ps2ify(new THREE.MeshLambertMaterial({ map, color: new THREE.Color(0.72, 0.62, 0.58), side: THREE.DoubleSide }));
        o.frustumCulled = false;
      });
      gltf.scene.updateMatrixWorld(true);
      const root = new THREE.Quaternion();
      gltf.scene.getWorldQuaternion(root).invert();
      for (const name of Object.values(B)) {
        const b = gltf.scene.getObjectByName(name);
        if (!b) { console.warn('hollow: missing bone', name); continue; }
        const P = root.clone().multiply(b.parent.getWorldQuaternion(new THREE.Quaternion()));
        REST[name] = { rest: b.quaternion.clone(), P, Pi: P.clone().invert() };
      }
      ASSET = gltf;
      return gltf;
    }).catch((e) => { console.warn('hollow model failed to load', e); return null; });
  }
  return loading;
}

const _q = new THREE.Quaternion(), _e = new THREE.Euler();
// rotate a bone by (x pitch, y yaw, z roll) about the model's own axes, on top of its rest pose
function rot(bone, x = 0, y = 0, z = 0) {
  const r = bone && REST[bone.name];
  if (!r) return;
  _q.setFromEuler(_e.set(x, y, z, 'YXZ'));
  bone.quaternion.copy(r.Pi).multiply(_q).multiply(r.P).multiply(r.rest);
}

const glowEye = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 0.75, 0.35), fog: false });

export function createHollow() {
  const obj = new THREE.Group();
  obj.name = 'hollow';
  obj.rotation.order = 'YXZ';            // so a fall tips it over backwards along its own facing
  const ud = obj.userData;
  const attach = () => {
    const body = cloneSkinned(ASSET.scene);
    const bones = {};
    for (const [k, n] of Object.entries(B)) bones[k] = body.getObjectByName(n);
    // the rig is built for IK: hands and feet hang off control bones, not off the forearms and
    // shins. Re-hang them on the limbs (keeping their rest placement) so they follow our poses.
    body.updateMatrixWorld(true);
    for (const [limb, end] of [['foreL', 'handL_024'], ['foreR', 'handR_045'], ['shinL', 'footL_019'], ['shinR', 'footR_040']]) {
      const b = body.getObjectByName(end);
      if (b && bones[limb]) bones[limb].attach(b);
    }
    // each one gets its own material so a hit can flash it
    let mat = null;
    body.traverse((o) => { if (o.isMesh) { o.material = mat ||= o.material.clone(); } });
    // embers where the eyes were (placed in model space, then parented to the head)
    body.updateMatrixWorld(true);
    if (bones.head) {
      const inv = bones.head.matrixWorld.clone().invert(), k = 1 / bones.head.getWorldScale(new THREE.Vector3()).x;
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.014, 0.012), glowEye);
        eye.position.set(s * 0.034, 1.855, 0.118).applyMatrix4(inv);
        eye.scale.setScalar(k);
        bones.head.add(eye);
      }
    }
    obj.add(body);
    Object.assign(ud, { body, bones, mat });
  };
  if (ASSET) attach(); else loadHollowAsset().then(() => ASSET && attach());

  // st: { windup, striking, stagger, moving, running, speed, dying }
  ud.animate = (e, dt, t, st) => {
    const bn = ud.bones;
    if (!bn) return;
    ud.mat.emissive.setRGB(e.flash * 0.6, e.flash * 0.25, e.flash * 0.1);
    const run = st.running ? 1 : 0;
    const spd = e.curSpeed || 0;
    ud.ph = (ud.ph || e.phase) + dt * spd * 2.4;
    const ph = ud.ph, a = Math.min(1, spd / 2.2);
    const sw = Math.sin(ph), cw = Math.cos(ph);
    const guard = e.guardT > 0 ? 1 : 0;
    ud.guard = lerp(ud.guard || 0, guard || e.guarding ? 1 : 0, Math.min(1, dt * 10));
    const gk = ud.guard;
    const wk = st.windup || 0, sk = st.striking || 0, stg = st.stagger || 0;
    const left = (e.comboN || 0) % 2 === 1;          // the second blow of a combination comes from the left
    const breathe = Math.sin(t * 1.6 + e.phase) * 0.03;

    // legs
    const stride = a * (0.55 + run * 0.25);
    rot(bn.thighL, -sw * stride - gk * 0.15, 0, 0);
    rot(bn.thighR, sw * stride - gk * 0.15, 0, 0);
    rot(bn.shinL, (0.1 + Math.max(0, cw) * 0.6 * a) + gk * 0.25);
    rot(bn.shinR, (0.1 + Math.max(0, -cw) * 0.6 * a) + gk * 0.25);
    rot(bn.footL, -0.1 * a);
    rot(bn.footR, -0.1 * a);
    // body: hunched, swaying, leaning into a run, twisting into a punch
    const twist = (left ? -1 : 1) * (wk * 0.5 - sk * 0.45);
    rot(bn.hips, 0, sw * 0.08 * a, 0);
    rot(bn.spine, 0.08 + run * 0.15 + gk * 0.1 + breathe - stg * 0.35 + sk * 0.12, twist * 0.5, 0);
    rot(bn.chest, 0.06 + breathe, twist * 0.5, 0);
    rot(bn.upper, 0.04, 0, 0);
    rot(bn.neck, 0.18 - gk * 0.1, 0, Math.sin(t * 0.7 + e.phase) * 0.06 * (1 - a));
    rot(bn.head, -0.12 - stg * 0.2, -twist * 0.5, 0);
    // arms: swinging when walking, fists up in a guard, a hook thrown from the shoulder
    const armSwing = sw * 0.45 * a;
    let aL = [armSwing - 0.15, 0, -0.1], fL = [-0.35], aR = [-armSwing - 0.15, 0, 0.1], fR = [-0.35];
    if (gk > 0.01) {
      aL = aL.map((v, i) => lerp(v, [-1.15, 0, 0.35][i], gk)); fL = [lerp(fL[0], -2.0, gk)];
      aR = aR.map((v, i) => lerp(v, [-1.15, 0, -0.35][i], gk)); fR = [lerp(fR[0], -2.0, gk)];
    }
    const hit = (w, s, side) => [lerp(lerp(-0.6, -1.9, w), -1.45, s), 0, side * 0.35 * s];   // cock back high, then drive through
    const hitFore = (w, s) => lerp(lerp(-1.4, -2.2, w), -0.15, s);
    if (wk || sk) {
      if (left) { aL = hit(wk, sk, -1); fL = [hitFore(wk, sk)]; } else { aR = hit(wk, sk, 1); fR = [hitFore(wk, sk)]; }
    }
    if (stg) { aL = [0.3, 0, -0.6]; aR = [0.3, 0, 0.6]; fL = [-0.3]; fR = [-0.3]; }
    rot(bn.armL, ...aL); rot(bn.foreL, fL[0]);
    rot(bn.armR, ...aR); rot(bn.foreR, fR[0]);
    // falling: over backwards from the feet, knees giving way
    if (st.dying != null) {
      const k = Math.min(1, Math.max(0, st.dying));
      e.obj.rotation.x = -k * k * 1.45;
      rot(bn.shinL, 0.9 * k); rot(bn.shinR, 0.7 * k);
      rot(bn.armL, -0.4 * k, 0, -0.9 * k); rot(bn.armR, -0.2 * k, 0, 1.0 * k);
    } else e.obj.rotation.x = 0;
    // a little bounce in the step
    e.obj.position.y += Math.abs(sw) * 0.04 * a;
  };
  return obj;
}
