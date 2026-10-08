// Empty Armour (ชุดเกราะไร้ร่าง): a suit of plate with nobody inside, still walking the rounds
// it walked in life, a greatsword in its gauntlets and a cold light where a face should be.
// Light blows glance off the plate; heavy blows land; a parried swing leaves it wide open.
// Every third swing is brought down two-handed into the ground.
//
// Model: "PS1/PSX style low poly plate armor" by annaumurn (https://sketchfab.com/annaumurn),
// CC-BY-4.0. Mixamo skeleton with no animation; the greatsword and every pose are made here.
import * as THREE from 'three';
import { Rig, whenLoaded } from './rigpose.js';
import { part, mergeGeometries, lerp } from './util.js';

const M_ = (n) => `mixamorig${n}`;
const B = {
  hips: M_('Hips_01'), spine: M_('Spine_02'), chest: M_('Spine1_03'), upper: M_('Spine2_04'), neck: M_('Neck_05'), head: M_('Head_00'),
  armL: M_('LeftArm_09'), foreL: M_('LeftForeArm_010'), handL: M_('LeftHand_011'),
  armR: M_('RightArm_018'), foreR: M_('RightForeArm_019'), handR: M_('RightHand_020'),
  thighL: M_('LeftUpLeg_026'), shinL: M_('LeftLeg_027'), footL: M_('LeftFoot_028'),
  thighR: M_('RightUpLeg_032'), shinR: M_('RightLeg_033'), footR: M_('RightFoot_034'),
};
// old, dark, rain-streaked steel
const RIG = new Rig('assets/enemies/armour.glb', B, { tint: new THREE.Color(0.5, 0.5, 0.56) });
export const loadArmourAsset = () => RIG.load();
const rot = (bone, x, y, z) => RIG.rot(bone, x, y, z);

const C = (r, g, b) => new THREE.Color(r, g, b);
const coldLight = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.9, 1.5), fog: false });

// a long two-handed sword, built along +y from the middle of its grip
function greatsword() {
  const steel = C(0.72, 0.74, 0.8), dark = C(0.25, 0.22, 0.2);
  const blade = new THREE.CylinderGeometry(0.001, 0.055, 0.14, 4, 1).translate(0, 1.17, 0);    // the point
  blade.scale(1, 1, 0.25);
  return mergeGeometries([
    part(new THREE.BoxGeometry(0.11, 1.0, 0.03), steel, { pos: [0, 0.6, 0] }),
    part(blade, steel),
    part(new THREE.BoxGeometry(0.4, 0.05, 0.07), dark, { pos: [0, 0.1, 0] }),
    part(new THREE.CylinderGeometry(0.025, 0.025, 0.32, 6), C(0.3, 0.2, 0.14), { pos: [0, -0.06, 0] }),
    part(new THREE.SphereGeometry(0.045, 6, 4), dark, { pos: [0, -0.24, 0] }),
  ]);
}

export function createArmour(M) {
  const obj = new THREE.Group();
  obj.name = 'armour';
  obj.rotation.order = 'YXZ';
  const ud = obj.userData;
  whenLoaded(RIG, () => {
    const { body, bones, mats } = RIG.instance();
    // the sword, placed in the right gauntlet in model space (blade forward and a little down)
    const sword = new THREE.Mesh(greatsword(), M.metal);
    sword.position.set(-0.22, 0.99, 0.08);
    sword.rotation.set(1.95, 0, 0);
    body.add(sword);
    sword.updateMatrixWorld(true);
    bones.handR?.attach(sword);
    // a cold light behind the visor
    if (bones.head) {
      const slit = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.018, 0.02), coldLight);
      slit.position.set(0, 1.745, 0.06);
      body.add(slit);
      slit.updateMatrixWorld(true);
      bones.head.attach(slit);
    }
    obj.add(body);
    Object.assign(ud, { body, bones, mats });
  });

  ud.animate = (e, dt, t, st) => {
    const bn = ud.bones;
    if (!bn) return;
    for (const m of ud.mats) m.emissive.setRGB(e.flash * 0.5, e.flash * 0.5, e.flash * 0.6);
    const spd = e.curSpeed || 0;
    ud.ph = (ud.ph || e.phase) + dt * spd * 2.6;
    const ph = ud.ph, a = Math.min(1, spd / 1.6), sw = Math.sin(ph), cw = Math.cos(ph);
    const wk = st.windup || 0, stg = st.stagger || 0;
    // after the blow the sword stays low a moment before it comes back up
    const sk = st.striking ? 1 : e.state === 'recover' ? Math.max(0, e.t / e.def.recover) : 0;
    const slam = e.def.slamEvery && e.hits % e.def.slamEvery === e.def.slamEvery - 1 && (wk || st.striking);

    // a heavy, lumbering stride
    rot(bn.thighL, -sw * 0.42 * a - wk * 0.1, 0, 0);
    rot(bn.thighR, sw * 0.42 * a + wk * 0.25, 0, 0);
    rot(bn.shinL, 0.08 + Math.max(0, cw) * 0.5 * a + sk * 0.3);
    rot(bn.shinR, 0.08 + Math.max(0, -cw) * 0.5 * a);
    rot(bn.footL, 0);
    rot(bn.footR, 0);
    rot(bn.hips, 0, sw * 0.06 * a, sw * 0.05 * a);
    // lean back to raise the sword, fold forward to bring it down
    const lean = 0.04 - wk * (slam ? 0.3 : 0.2) + sk * (slam ? 0.55 : 0.35) - stg * 0.3;
    rot(bn.spine, lean * 0.5, 0, 0);
    rot(bn.chest, lean * 0.5, 0, -sw * 0.04 * a);
    rot(bn.upper, 0, 0, 0);
    rot(bn.neck, 0.05 - lean * 0.3);
    rot(bn.head, -0.05 + Math.sin(t * 0.5 + e.phase) * 0.05 * (1 - a), Math.sin(t * 0.37 + e.phase) * 0.2 * (1 - a));
    // arms: sword held low and forward; both hands overhead in the windup; brought down through
    let aR = [-0.45 + sw * 0.08 * a, 0, 0.1], fR = -0.7;
    let aL = [sw * 0.3 * a - 0.1, 0, -0.1], fL = -0.3;
    if (wk) {
      aR = [lerp(aR[0], -2.75, wk), 0, lerp(0.1, -0.15, wk)]; fR = lerp(fR, -0.45, wk);
      aL = [lerp(aL[0], -2.6, wk), 0, lerp(-0.1, 0.25, wk)]; fL = lerp(fL, -0.6, wk);
    }
    if (sk) {
      aR = [lerp(aR[0], -0.75, sk), 0, lerp(aR[2], -0.25, sk)]; fR = lerp(fR, -0.15, sk);
      aL = [lerp(aL[0], -0.8, sk), 0, lerp(aL[2], 0.45, sk)]; fL = lerp(fL, -0.4, sk);
    }
    if (stg) { aR = [-0.2, 0, 0.5]; fR = -0.4; aL = [0.2, 0, -0.6]; fL = -0.3; }
    rot(bn.armR, ...aR); rot(bn.foreR, fR); rot(bn.handR, 0);
    rot(bn.armL, ...aL); rot(bn.foreL, fL); rot(bn.handL, 0);
    // it goes down to its knees, then face-first
    if (st.dying != null) {
      const k = Math.min(1, Math.max(0, st.dying));
      rot(bn.thighL, -1.2 * Math.min(1, k * 2)); rot(bn.thighR, -1.0 * Math.min(1, k * 2));
      rot(bn.shinL, 2.0 * Math.min(1, k * 2)); rot(bn.shinR, 1.9 * Math.min(1, k * 2));
      e.obj.rotation.x = Math.max(0, k - 0.5) * 2 * 1.3;
      e.obj.position.y -= Math.min(1, k * 2) * 0.55;
    } else e.obj.rotation.x = 0;
    // every footfall lands heavy
    e.obj.position.y += Math.abs(sw) * 0.025 * a;
  };
  return obj;
}
