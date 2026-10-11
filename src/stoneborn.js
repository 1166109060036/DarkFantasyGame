// The Petrified (ร่างหิน): people the creeping stone has taken (chapter 2). They are the Lost
// underneath, the same body and the same way of moving (src/hollow.js), but grey and cracked, with
// shards of rock grown out of the shoulders and back, and a faint gold light in the cracks: the
// Stone King's dream, walking.
import * as THREE from 'three';
import { createHollow } from './hollow.js';

const STONE = new THREE.Color(0.5, 0.58, 0.82);   // cool grey over the warm skin texture
const CRACK = new THREE.Color(0.55, 0.38, 0.12);

let shardGeom = null;
function shard() {
  if (!shardGeom) shardGeom = new THREE.OctahedronGeometry(0.12, 0).scale(1, 2.2, 1);
  return shardGeom;
}

export function createPetrified(M) {
  const obj = createHollow(M);
  obj.name = 'petrified';
  const ud = obj.userData, base = ud.animate;
  ud.animate = (e, dt, t, st) => {
    // once the body has loaded: its own stone-grey copy of the skin, and the shards
    if (ud.body && !ud.stoned) {
      ud.stoned = true;
      const mats = [];
      ud.body.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        if (o.material.isMeshBasicMaterial) return;          // the ember eyes stay as they are
        const m = o.material.clone();
        m.color = STONE.clone();
        if (m.emissive) m.emissive = CRACK.clone().multiplyScalar(0.25);
        o.material = m;
        mats.push(m);
      });
      if (mats.length) ud.mats = mats;
      const rockMat = M?.rock || new THREE.MeshLambertMaterial({ color: STONE });
      const bones = ud.bones || {};
      const grow = (bone, list) => {
        if (!bone) return;
        const k = 1 / bone.getWorldScale(new THREE.Vector3()).x;
        for (const [x, y, z, rx, rz] of list) {
          const s = new THREE.Mesh(shard(), rockMat);
          s.position.set(x * k, y * k, z * k);
          s.rotation.set(rx, 0, rz);
          s.scale.setScalar(k);
          bone.add(s);
        }
      };
      obj.updateMatrixWorld(true);
      grow(bones.chest || bones.spine, [[0.12, 0.12, -0.1, -0.5, -0.6], [-0.1, 0.16, -0.12, -0.6, 0.5], [0, 0.05, -0.16, -1.1, 0]]);
      grow(bones.head, [[0.05, 0.12, -0.04, -0.3, -0.3]]);
    }
    base(e, dt, t, st);
    // the cracks glow as it winds up a blow
    for (const m of ud.mats || []) if (m.emissive) m.emissive.copy(CRACK).multiplyScalar(0.25 + (st.windup || 0) * 0.9 + e.flash * 0.6);
  };
  return obj;
}
