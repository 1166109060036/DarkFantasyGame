// Farm animals that make the world feel lived in. For now: pigs, rooting about in the village pen,
// round the abandoned farms in the east and by the ferryman's shack. They graze, trot about, grunt,
// and bolt squealing from anyone who charges at them, rides at them or swings a blade their way.
//
// Model: "PS1 Pig" by joann5632 (https://sketchfab.com/ioann5632), CC-BY-4.0. It is skinned
// (four two-bone legs and a head) but carries no walk, so the legs and head are posed in code.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from '../vendor/addons/utils/SkeletonUtils.js';
import { ps2ify } from './ps2.js';
import { blobShadow } from './characters.js';
import { wrapAngle } from './util.js';
import { PIGPEN, FARMS, PIER } from './layout.js';

const PIG_SCALE = 0.23;               // the model is 6.5 units nose to tail; a pig is ~1.5 m
const LIMBS = {                        // bone names in the model -> [leg, gait phase]
  fr: ['Bone_1', 0], fl: ['Bone002_9', Math.PI], br: ['Bone004_3', Math.PI], bl: ['Bone006_11', 0],
};
const LOWER = { fr: 'Bone001_0', fl: 'Bone003_8', br: 'Bone005_2', bl: 'Bone007_10' };
const HEAD = 'Bone008_4';

// where they live: centre, how far they roam, how many
export const PIG_HOMES = [
  { x: PIGPEN.x, z: PIGPEN.z, r: 5, n: 4 },
  { x: FARMS.x - 4, z: FARMS.z - 4, r: 24, n: 7 },
  { x: PIER.x - 9, z: PIER.z - 9, r: 7, n: 2 },
];

let ASSET = null, loading = null;
const AXES = {};                       // per bone: rest pose and the pig's left-right axis in its parent's space
export function loadPigAsset() {
  if (!loading) {
    loading = new GLTFLoader().loadAsync('assets/animals/pig.glb').then((gltf) => {
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const map = o.material.map;
        if (map) { map.magFilter = THREE.NearestFilter; map.colorSpace = THREE.NoColorSpace; }
        // the texture is a clean studio pink; these pigs live in mud and rain
        o.material = ps2ify(new THREE.MeshLambertMaterial({ map, color: new THREE.Color(0.6, 0.48, 0.45), side: THREE.DoubleSide }));
        o.frustumCulled = false;
      });
      gltf.scene.updateMatrixWorld(true);
      const q = new THREE.Quaternion();
      for (const name of [...Object.values(LIMBS).map((l) => l[0]), ...Object.values(LOWER), HEAD]) {
        const b = gltf.scene.getObjectByName(name);
        if (!b) continue;
        b.parent.getWorldQuaternion(q).invert();
        AXES[name] = { rest: b.quaternion.clone(), axis: new THREE.Vector3(1, 0, 0).applyQuaternion(q).normalize() };
      }
      ASSET = gltf;
      return gltf;
    }).catch((e) => { console.warn('pig model failed to load', e); return null; });
  }
  return loading;
}

const _q = new THREE.Quaternion();
// tip a bone forward/back about the pig's own left-right axis, on top of its rest pose
function pose(bone, angle) {
  const a = AXES[bone.name];
  if (!a) return;
  bone.quaternion.copy(_q.setFromAxisAngle(a.axis, angle)).multiply(a.rest);
}

const turnTo = (cur, target, maxStep) => cur + Math.max(-maxStep, Math.min(maxStep, wrapAngle(target - cur)));

export class Critters {
  constructor(game) {
    this.g = game;
    this.pigs = [];
    this.gruntT = 3;
    this.squealT = 0;
    this.tmp = new THREE.Vector3();
    loadPigAsset().then(() => { if (ASSET) this.spawnPigs(); });
  }

  spawnPigs() {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const home of PIG_HOMES) {
      for (let i = 0; i < home.n; i++) {
        const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * home.r * 0.8;
        this.addPig(home.x + Math.cos(a) * d, home.z + Math.sin(a) * d, home, 0.85 + rnd() * 0.3);
      }
    }
  }

  addPig(x, z, home, size = 1) {
    const g = this.g, body = cloneSkinned(ASSET.scene);
    body.scale.setScalar(PIG_SCALE * size);
    const root = new THREE.Group();
    root.add(body);
    const shadow = blobShadow(g.M, 1.3 * size);
    shadow.scale.set(0.75, 1, 1.5);
    g.scene.add(root, shadow);
    const bones = {};
    for (const [k, [name]] of Object.entries(LIMBS)) bones[k] = body.getObjectByName(name);
    for (const [k, name] of Object.entries(LOWER)) bones[k + 'L'] = body.getObjectByName(name);
    bones.head = body.getObjectByName(HEAD);
    const pig = {
      root, shadow, bones, home, size, x, z, y: 0, ry: Math.random() * 6.28, mode: 'graze', timer: Math.random() * 4,
      tx: x, tz: z, speed: 0, want: 0, gait: Math.random() * 6, head: 0.4, nod: Math.random() * 6, push: new THREE.Vector2(),
    };
    this.pigs.push(pig);
    this.place(pig);
    return pig;
  }

  ground(x, z, y) {
    const p = this.g.player;
    return p.groundAt(x, z, y + 0.6);
  }

  place(pig) {
    pig.y = this.ground(pig.x, pig.z, pig.y || 1e3);
    const bob = Math.abs(Math.sin(pig.gait)) * Math.min(0.05, pig.speed * 0.012);
    pig.root.position.set(pig.x, pig.y + bob, pig.z);
    pig.root.rotation.y = pig.ry;
    pig.shadow.position.set(pig.x, pig.y + 0.04, pig.z);
    pig.shadow.rotation.y = pig.ry;
  }

  // run from (fx, fz) for a few seconds
  scare(pig, fx, fz, t = 3) {
    if (pig.mode !== 'flee' && this.squealT <= 0) {
      this.g.audio.squeal?.({ x: pig.x, y: pig.y + 0.5, z: pig.z });
      this.squealT = 0.6;
    }
    const a = Math.atan2(pig.x - fx, pig.z - fz) + (Math.random() - 0.5) * 0.8;
    pig.tx = pig.x + Math.sin(a) * 12; pig.tz = pig.z + Math.cos(a) * 12;
    pig.mode = 'flee'; pig.timer = t; pig.want = 4.6;
  }

  // a sword swing (combat.playerStrike): pigs in the arc squeal, get shoved and run
  strike(spec, cam, dir) {
    for (const pig of this.pigs) {
      if (!pig.root.visible) continue;
      const dx = pig.x - cam.x, dz = pig.z - cam.z, d = Math.hypot(dx, dz);
      const reach = spec.aoe ? spec.aoe.dist + spec.aoe.r : spec.range + 0.6;
      if (d > reach) continue;
      if (!spec.radial && !spec.aoe && d > 1.2 && (dx * dir.x + dz * dir.z) / d < (spec.arc ?? 0.5)) continue;
      pig.push.set(dx / (d || 1), dz / (d || 1)).multiplyScalar(spec.heavy ? 5 : 3);
      this.squealT = 0;
      this.scare(pig, cam.x, cam.z, 5);
    }
  }

  update(dt) {
    const g = this.g, p = g.player;
    if (!this.pigs.length) return;
    this.gruntT -= dt;
    this.squealT -= dt;
    const riding = g.mount?.ridden, charging = riding || p.sprinting;
    const scareR = riding ? 10 : 6.5;
    let grunter = null;
    for (const pig of this.pigs) {
      const d = Math.hypot(pig.x - p.pos.x, pig.z - p.pos.z);
      pig.root.visible = pig.shadow.visible = d < 190;
      if (d > 140) continue;                                  // too far to see them move
      if (d < 18 && (!grunter || Math.random() < 0.3)) grunter = pig;
      // what to do
      if (charging && d < scareR && pig.mode !== 'flee') this.scare(pig, p.pos.x, p.pos.z);
      pig.timer -= dt;
      if (pig.mode === 'flee') {
        if (pig.timer <= 0) { pig.mode = 'graze'; pig.timer = 2 + Math.random() * 3; }
      } else if (pig.mode === 'walk') {
        if (Math.hypot(pig.tx - pig.x, pig.tz - pig.z) < 0.5 || pig.timer <= 0) { pig.mode = Math.random() < 0.7 ? 'graze' : 'idle'; pig.timer = 3 + Math.random() * 7; }
      } else if (pig.timer <= 0) {
        // wander somewhere else in its home
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * pig.home.r;
        pig.tx = pig.home.x + Math.cos(a) * r; pig.tz = pig.home.z + Math.sin(a) * r;
        pig.mode = 'walk'; pig.timer = 12; pig.want = 0.7 + Math.random() * 0.5;
      }
      // step aside from someone walking right into it
      if (d < 1.6 && pig.mode !== 'flee') {
        const a = Math.atan2(pig.x - p.pos.x, pig.z - p.pos.z);
        pig.tx = pig.x + Math.sin(a) * 3; pig.tz = pig.z + Math.cos(a) * 3;
        pig.mode = 'walk'; pig.timer = 2; pig.want = 1.6;
      }
      const moving = pig.mode === 'walk' || pig.mode === 'flee';
      pig.speed += ((moving ? pig.want : 0) - pig.speed) * Math.min(1, dt * 4);
      if (moving) pig.ry = turnTo(pig.ry, Math.atan2(pig.tx - pig.x, pig.tz - pig.z), dt * (pig.mode === 'flee' ? 6 : 2.5));
      let nx = pig.x + Math.sin(pig.ry) * pig.speed * dt + pig.push.x * dt;
      let nz = pig.z + Math.cos(pig.ry) * pig.speed * dt + pig.push.y * dt;
      pig.push.multiplyScalar(Math.max(0, 1 - dt * 5));
      // stay home (the pen's fence, the farmyard), and out of walls and the player
      const hx = nx - pig.home.x, hz = nz - pig.home.z, hd = Math.hypot(hx, hz), lim = pig.home.r + 1.5;
      if (hd > lim) { nx = pig.home.x + hx / hd * lim; nz = pig.home.z + hz / hd * lim; if (pig.mode === 'flee') pig.timer = Math.min(pig.timer, 0.3); }
      const v = this.tmp.set(nx, pig.y, nz);
      g.collision.resolve(v, 0.45 * pig.size, 0.7);
      const px = v.x - p.pos.x, pz = v.z - p.pos.z, pd = Math.hypot(px, pz);
      if (pd < 0.9 && pd > 1e-3) { v.x += px / pd * (0.9 - pd); v.z += pz / pd * (0.9 - pd); }
      pig.x = v.x; pig.z = v.z;
      // legs, head and a waggle of the body
      pig.gait += pig.speed * dt * (pig.mode === 'flee' ? 3.4 : 5);
      const amp = Math.min(0.55, pig.speed * 0.32);
      for (const [k, [, off]] of Object.entries(LIMBS)) {
        const s = Math.sin(pig.gait + off);
        pose(pig.bones[k], s * amp);
        pose(pig.bones[k + 'L'], Math.max(0, Math.cos(pig.gait + off)) * amp * (k[0] === 'f' ? 1.1 : -0.9));
      }
      pig.nod += dt * (pig.mode === 'graze' ? 3 : 1);
      const headWant = pig.mode === 'graze' ? 0.5 + Math.sin(pig.nod) * 0.12 : pig.mode === 'flee' ? -0.2 : Math.sin(pig.nod * 0.5) * 0.1;
      pig.head += (headWant - pig.head) * Math.min(1, dt * 4);
      pose(pig.bones.head, pig.head);
      this.place(pig);
    }
    if (grunter && this.gruntT <= 0) {
      g.audio.oink?.({ x: grunter.x, y: grunter.y + 0.5, z: grunter.z });
      this.gruntT = 2.5 + Math.random() * 5;
    }
  }
}
