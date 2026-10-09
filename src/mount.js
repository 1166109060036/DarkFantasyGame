// The giant cockroach you ride (Red Dead style). Whistle (H) and it skitters to you from wherever
// it is; H again beside it to climb on, and once more to get off. Riding is fast, climbs slopes no
// one else can, and Space unfolds the wings for a fluttering glide. Right mouse makes it bite
// what is in front. A heavy blow can throw you off.
//
// Model: "Giant cockroach" by Drillimpact (https://sketchfab.com/Drillimpact), CC-BY-4.0, with its
// own skeleton and animations (idle, walking, flying, Attack, death_start). Its unlit material is
// swapped for the game's lit, fogged, vertex-snapped one so it lives under the same moon.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from '../vendor/addons/utils/SkeletonUtils.js';
import { ps2ify } from './ps2.js';
import { clamp } from './util.js';
import { L } from './i18n.js';

export const MOUNT = {
  name: L('แมลงสาบยักษ์', 'Giant Cockroach'),
  scale: 1.7,
  seat: new THREE.Vector3(0, 1.0, 0.12),    // where the rider sits, in the mount's own space (forward is -z)
  eyeLift: 0.95,                            // rider's eye above the seat
  walk: 7.2, run: 12.5,                     // m/s
  climb: 2.6,                               // a cockroach walks up what stops a man
  flutter: 7.5, glide: 4.5, wings: 2.6,     // jump speed, slowest fall while gliding, seconds of wing
  biteDmg: 1.6, biteEvery: 1.4, biteRange: 3.4,
  throwOff: 24,                             // a blow this hard (after armour) knocks you down
};

let ASSET = null;
let loading = null;
export function loadMountAsset() {
  if (!loading) {
    loading = new GLTFLoader().loadAsync('assets/mounts/cockroach.glb').then((gltf) => {
      // lit and fogged like the rest of the world, nearest-filtered like a PS2 texture
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const map = o.material.map;
        if (map) { map.magFilter = THREE.NearestFilter; map.colorSpace = THREE.NoColorSpace; }
        o.material = ps2ify(new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide }));
        o.frustumCulled = false;
      });
      ASSET = gltf;
      return gltf;
    }).catch((e) => { console.warn('mount model failed to load', e); return null; });
  }
  return loading;
}

const clip = (name) => ASSET.animations.find((a) => a.name.endsWith(`|${name}`));

// one cockroach in the world: its model, animations and footing
export function createMountBody(scene) {
  if (!ASSET) return null;
  const obj = cloneSkinned(ASSET.scene);
  obj.scale.setScalar(MOUNT.scale);
  const root = new THREE.Group();
  root.add(obj);
  scene.add(root);
  const mixer = new THREE.AnimationMixer(obj);
  const acts = {};
  for (const n of ['idle', 'walking', 'flying_straight', 'Attack', 'death_start']) {
    const c = clip(n);
    if (!c) continue;
    acts[n] = mixer.clipAction(c);
  }
  acts.Attack?.setLoop(THREE.LoopOnce, 1);
  acts.Attack && (acts.Attack.clampWhenFinished = true);
  acts.idle?.play();
  return { root, obj, mixer, acts, cur: 'idle' };
}

// pick the loop for what the body is doing, cross-fading between them
export function animateMountBody(b, dt, speed, airborne) {
  const want = airborne ? 'flying_straight' : speed > 0.6 ? 'walking' : 'idle';
  if (want !== b.cur && b.acts[want]) {
    b.acts[want].reset().play();
    b.acts[b.cur]?.crossFadeTo(b.acts[want], 0.18, false);
    b.cur = want;
  }
  if (b.acts.walking) b.acts.walking.timeScale = clamp(speed / 4.5, 0.5, 3.2);
  b.mixer.update(dt);
}

export function biteAnim(b) {
  const a = b.acts.Attack;
  if (!a) return;
  a.reset().setEffectiveWeight(1).play();
  setTimeout(() => a.fadeOut(0.2), 450);
}

// ------------------------------------------------------------------------------------------------
// your own mount
export class Mount {
  constructor(game) {
    this.g = game;
    this.body = null;
    this.state = 'away';        // away | coming | waiting | ridden
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.wing = MOUNT.wings;
    this.biteT = 0;
    this.whistleT = 0;
    this.airborne = false;
    this.hinted = false;
    loadMountAsset().then(() => { this.ready = !!ASSET; });
  }

  get ridden() { return this.state === 'ridden'; }

  ensureBody() {
    if (!this.body && ASSET) { this.body = createMountBody(this.g.scene); this.body.root.visible = false; }
    return this.body;
  }

  ground(x, z, y = 1e3) { return this.g.player.groundAt(x, z, y); }

  // H: whistle for it, climb on, or get off
  toggle() {
    const g = this.g, p = g.player;
    if (!this.ensureBody()) { g.ui.toast(L('แมลงสาบยักษ์ยังมาไม่ถึง...', 'The Giant Cockroach has not yet come...')); return; }
    if (this.ridden) { this.dismount(); return; }
    const d = this.state === 'away' ? Infinity : Math.hypot(this.pos.x - p.pos.x, this.pos.z - p.pos.z);
    if (d < 4.5 && this.state !== 'coming') { this.mount(); return; }
    this.whistle();
  }

  whistle() {
    const g = this.g, p = g.player;
    if (g.indoor > 0.5) { g.ui.toast(L('มันเข้ามาในนี้ไม่ได้', 'It cannot come in here')); return; }
    if (this.whistleT > 0) return;
    this.whistleT = 1.2;
    const a = g.audio;
    a.tone({ freq: 1500, dur: 0.18, type: 'sine', gain: 0.07, slide: 1.25 });
    a.tone({ freq: 1900, dur: 0.3, type: 'sine', gain: 0.07, slide: 0.85, delay: 0.22 });
    // from out of sight behind you, unless it is already close by
    const far = this.state === 'away' || Math.hypot(this.pos.x - p.pos.x, this.pos.z - p.pos.z) > 45;
    if (far) {
      for (let i = 0; i < 8; i++) {
        const ang = p.yaw + (i % 2 ? 1 : -1) * (0.3 + i * 0.15);
        const x = p.pos.x + Math.sin(ang) * 26, z = p.pos.z + Math.cos(ang) * 26;
        if (this.g.terrain.getHeight(x, z) > -0.4 || i === 7) { this.pos.set(x, this.ground(x, z), z); break; }
      }
    }
    this.state = 'coming';
    this.body.root.visible = true;
    g.ui.combatText(L('ฟี้ว~', 'Fweet~'), 'info');
  }

  mount() {
    const g = this.g, p = g.player;
    if (g.indoor > 0.5) return;
    this.state = 'ridden';
    p.pos.set(this.pos.x, this.pos.y, this.pos.z);
    p.vel.set(0, 0, 0);
    this.wing = MOUNT.wings;
    g.audio.thump({ freq: 120, dur: 0.2, gain: 0.25 });
    this.skitter(6, 0.6);
    if (!this.hinted) { this.hinted = true; g.ui.toast(L('ขี่อยู่ · Shift วิ่ง · Space กางปีก (ค้างเพื่อร่อน) · คลิกขวา ให้มันกัด · H ลง', 'Riding · Shift run · Space spread wings (hold to glide) · Right-click bite · H dismount')); }
  }

  dismount(thrown = false) {
    const g = this.g, p = g.player;
    if (!this.ridden) return;
    this.state = 'waiting';
    // step off to the side, onto open ground
    const sx = Math.cos(this.yaw) * 1.6, sz = -Math.sin(this.yaw) * 1.6;
    p.pos.x = this.pos.x + sx; p.pos.z = this.pos.z + sz;
    g.collision.resolve(p.pos, p.radius, p.height);
    p.pos.y = p.groundAt(p.pos.x, p.pos.z, p.pos.y + 2);
    p.camY = p.pos.y;
    p.vel.set(thrown ? sx * 3 : 0, thrown ? 3 : 0, thrown ? sz * 3 : 0);
    if (thrown) { g.combat.staggerT = 0.9; g.ui.combatText(L('ตกจากหลัง!', 'Thrown off!'), 'bad'); }
  }

  // what the rider's body is told (src/player.js reads this through combat.playerMods)
  mods() {
    return { speed: MOUNT.walk, run: MOUNT.run, eye: MOUNT.seat.y + MOUNT.eyeLift, climb: MOUNT.climb, radius: 0.9, mount: this };
  }

  // Space: a flap of the wings; held, a glide
  flap(p, input, dt) {
    if (input.consume('jump')) {
      if (p.onGround) { p.vel.y = MOUNT.flutter; p.onGround = false; this.g.audio.burst({ dur: 0.35, freq: 900, q: 0.6, gain: 0.12, sweep: 1.4 }); }
      else if (this.wing > 0.6) { p.vel.y = Math.max(p.vel.y, MOUNT.flutter * 0.7); this.wing -= 0.6; }
    }
    const holding = input.keys.has('Space') || input.held.jump || input.padJump;
    if (!p.onGround && holding && this.wing > 0 && p.vel.y < 0) {
      this.wing -= dt;
      p.vel.y = Math.max(p.vel.y, -MOUNT.glide * 0.35);
      this.gliding = true;
    } else this.gliding = false;
    if (p.onGround) this.wing = Math.min(MOUNT.wings, this.wing + dt * 1.5);
  }

  // right mouse: the cockroach bites what is in front
  bite() {
    if (this.biteT > 0) return;
    const g = this.g, c = g.combat, p = g.player;
    this.biteT = MOUNT.biteEvery;
    biteAnim(this.body);
    g.audio.burst({ dur: 0.18, freq: 2200, q: 2, gain: 0.25 });
    g.audio.thump({ freq: 160, dur: 0.12, gain: 0.2, delay: 0.12 });
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const hx = this.pos.x + fx * 2.2, hz = this.pos.z + fz * 2.2;
    for (const e of c.enemies) {
      if (!e.alive || e.state === 'dying' || !e.obj.visible) continue;
      if (Math.hypot(e.pos.x - hx, e.pos.z - hz) > MOUNT.biteRange * 0.6 + e.def.radius) continue;
      c.damageEnemy(e, true, new THREE.Vector3(fx, 0, fz), MOUNT.biteDmg);
    }
    g.moba?.strike({ aoe: { dist: 2.2, r: MOUNT.biteRange * 0.6 }, dmg: MOUNT.biteDmg, heavy: true }, g.camera.position, p.forwardVec);
  }

  // a hard blow while riding throws you to the ground
  onRiderHurt(dmg) {
    if (this.ridden && dmg >= MOUNT.throwOff) this.dismount(true);
  }

  // footsteps: a dry rattle of six legs
  skitter(n = 3, gain = 0.3) {
    const a = this.g.audio;
    for (let i = 0; i < n; i++) a.burst({ dur: 0.03, freq: 3000 + Math.random() * 2500, q: 4, gain: 0.06 * gain, delay: i * 0.035, pos: this.pos });
  }

  update(dt, input) {
    const g = this.g, p = g.player;
    this.whistleT = Math.max(0, this.whistleT - dt);
    this.biteT = Math.max(0, this.biteT - dt);
    if (!this.body) return;
    let speed = 0;
    if (this.ridden) {
      // the body follows the rider; it turns toward where it is going
      this.pos.copy(p.pos);
      const hs = Math.hypot(p.vel.x, p.vel.z);
      speed = hs;
      const head = hs > 1 ? Math.atan2(-p.vel.x, -p.vel.z) : p.yaw;
      this.yaw += Math.atan2(Math.sin(head - this.yaw), Math.cos(head - this.yaw)) * Math.min(1, dt * 6);
      this.airborne = !p.onGround;
      if (input && input.blockHeld && !this.prevBlock) this.bite();
      this.prevBlock = !!input?.blockHeld;
      if (g.indoor > 0.5 || p.hp <= 0) this.dismount();
    } else if (this.state === 'coming' || this.state === 'waiting') {
      const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      const goal = this.state === 'coming' ? 3 : 1e9;
      if (d > goal + 0.25) {
        speed = d > 12 ? MOUNT.run * 1.15 : MOUNT.walk;
        const step = Math.min(d - goal, speed * dt);
        this.pos.x += dx / d * step; this.pos.z += dz / d * step;
        g.collision.resolve(this.pos, 0.9, 1.2);
        this.yaw += Math.atan2(Math.sin(Math.atan2(-dx, -dz) - this.yaw), Math.cos(Math.atan2(-dx, -dz) - this.yaw)) * Math.min(1, dt * 5);
      } else if (this.state === 'coming') { this.state = 'waiting'; g.ui.combatText(L('[H] ขึ้นขี่', '[H] Mount'), 'info'); }
      this.pos.y = this.ground(this.pos.x, this.pos.z, this.pos.y + 2);
      this.airborne = false;
      // left far behind: it wanders off home until whistled for
      if (this.state === 'waiting' && d > 160) { this.state = 'away'; this.body.root.visible = false; }
    }
    this.stepT = (this.stepT || 0) - speed * dt;
    if (speed > 1 && this.stepT <= 0 && !this.airborne) { this.stepT = 1.1; this.skitter(3, Math.min(1, speed / 8)); }
    const b = this.body;
    b.root.position.set(this.pos.x, this.pos.y, this.pos.z);
    b.root.rotation.y = this.yaw;
    animateMountBody(b, dt, speed, this.airborne);
  }

  // the moba avatar of other riders reads where the saddle is
  static seatWorld(root, out) { return out.copy(MOUNT.seat).applyMatrix4(root.matrixWorld); }

  chips() {
    if (this.ridden) return [`🪳 ${MOUNT.name} · ${L('ปีก', 'Wings')} ${'▮'.repeat(Math.round(this.wing / MOUNT.wings * 5))}${'▯'.repeat(5 - Math.round(this.wing / MOUNT.wings * 5))}`];
    if (this.state === 'waiting') return [L(`🪳 ${MOUNT.name} รออยู่ [H]`, `🪳 ${MOUNT.name} waits [H]`)];
    return [];
  }
}
