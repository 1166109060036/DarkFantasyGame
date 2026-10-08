// Imported humanoid models (.glb) posed from code. Many free models come with a skeleton but no
// usable animation, so enemies built on them (src/hollow.js, src/armour.js) set their bones
// directly: each pose is a rotation about the model's own axes (x = pitch forward, y = turn,
// z = roll sideways), applied on top of the bone's rest pose so the numbers read the same for
// any rig. The model faces +z; +x is its left.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from '../vendor/addons/utils/SkeletonUtils.js';
import { ps2ify } from './ps2.js';

const _q = new THREE.Quaternion(), _e = new THREE.Euler();

export class Rig {
  // bones: { key: 'boneName' }; tint: multiplies the texture
  constructor(path, bones, { tint = new THREE.Color(1, 1, 1) } = {}) {
    this.path = path; this.names = bones; this.tint = tint;
    this.asset = null; this.loading = null;
    this.rest = {};          // per bone: rest quaternion and its parent's rest orientation in model space
  }

  load() {
    if (!this.loading) {
      this.loading = new GLTFLoader().loadAsync(this.path).then((gltf) => {
        // lit, fogged and vertex-snapped like the rest of the world, nearest-filtered like a PS2
        const swapped = new Map();
        gltf.scene.traverse((o) => {
          if (!o.isMesh) return;
          if (!swapped.has(o.material)) {
            const map = o.material.map;
            if (map) { map.magFilter = THREE.NearestFilter; map.colorSpace = THREE.NoColorSpace; }
            swapped.set(o.material, ps2ify(new THREE.MeshLambertMaterial({ map, color: this.tint.clone(), side: THREE.DoubleSide })));
          }
          o.material = swapped.get(o.material);
          o.frustumCulled = false;
        });
        gltf.scene.updateMatrixWorld(true);
        const root = new THREE.Quaternion();
        gltf.scene.getWorldQuaternion(root).invert();
        for (const name of Object.values(this.names)) {
          const b = gltf.scene.getObjectByName(name);
          if (!b) { console.warn(this.path, 'missing bone', name); continue; }
          const P = root.clone().multiply(b.parent.getWorldQuaternion(new THREE.Quaternion()));
          this.rest[name] = { rest: b.quaternion.clone(), P, Pi: P.clone().invert() };
        }
        this.asset = gltf;
        return gltf;
      }).catch((e) => { console.warn(this.path, 'failed to load', e); return null; });
    }
    return this.loading;
  }

  // a fresh copy: its bones by key, and its own materials (so one can flash without the others)
  instance() {
    const body = cloneSkinned(this.asset.scene);
    const bones = {};
    for (const [k, n] of Object.entries(this.names)) bones[k] = body.getObjectByName(n);
    const mats = new Map();
    body.traverse((o) => {
      if (!o.isMesh) return;
      if (!mats.has(o.material)) mats.set(o.material, o.material.clone());
      o.material = mats.get(o.material);
    });
    body.updateMatrixWorld(true);
    return { body, bones, mats: [...mats.values()] };
  }

  // rotate a bone by (x, y, z) about the model's own axes, on top of its rest pose
  rot(bone, x = 0, y = 0, z = 0) {
    const r = bone && this.rest[bone.name];
    if (!r) return;
    _q.setFromEuler(_e.set(x, y, z, 'YXZ'));
    bone.quaternion.copy(r.Pi).multiply(_q).multiply(r.P).multiply(r.rest);
  }
}

// a body that arrives when its model has loaded (enemies are spawned before that)
export function whenLoaded(rig, attach) {
  if (rig.asset) attach();
  else rig.load().then(() => rig.asset && attach());
}
