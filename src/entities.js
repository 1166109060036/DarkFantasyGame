import * as THREE from 'three';
import { createSheep, blobShadow } from './characters.js';
import { PASTURE, FENCE_R } from './layout.js';
import { wrapAngle } from './util.js';

const turnTo = (cur, target, maxStep) => {
  const d = wrapAngle(target - cur);
  return cur + Math.max(-maxStep, Math.min(maxStep, d));
};

export class Flock {
  constructor(scene, M, terrain, audio) {
    this.scene = scene; this.M = M; this.terrain = terrain; this.audio = audio;
    this.sheep = [];
    this.bleatTimer = 3;
  }

  add(x, z, { lost = false, id = null } = {}) {
    const group = createSheep(this.M);
    const shadow = blobShadow(this.M, 1.5);
    shadow.scale.set(0.8, 1, 1.2);
    this.scene.add(group, shadow);
    const s = {
      group, shadow, x, z, ry: Math.random() * 6.28, mode: lost ? 'lost' : 'graze',
      timer: Math.random() * 5, tx: x, tz: z, speed: 0.9, phase: Math.random() * 10, id, waypoints: [],
    };
    this.sheep.push(s);
    this.place(s, 0);
    return s;
  }

  place(s, t) {
    const g = this.terrain.getHeight(s.x, s.z);
    const moving = s.mode === 'walk' || s.mode === 'return';
    s.group.position.set(s.x, g + (moving ? Math.abs(Math.sin(t * 9 + s.phase)) * 0.06 : 0), s.z);
    s.group.rotation.y = s.ry;
    s.group.rotation.x = moving ? 0 : Math.sin(t * 0.8 + s.phase) * 0.05 + 0.05;
    s.shadow.position.set(s.x, g + 0.04, s.z);
    s.shadow.rotation.y = s.ry;
  }

  sendHome(s) {
    const gateOut = { x: PASTURE.x - FENCE_R - 6, z: PASTURE.z };
    const gateIn = { x: PASTURE.x - FENCE_R + 10, z: PASTURE.z };
    s.waypoints = [gateOut, gateIn];
    s.mode = 'return';
    s.speed = 3.2;
  }

  update(dt, t, player) {
    this.bleatTimer -= dt;
    for (const s of this.sheep) {
      if (s.mode === 'graze') {
        s.timer -= dt;
        if (s.timer <= 0) {
          const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * (FENCE_R - 8);
          s.tx = PASTURE.x + Math.cos(a) * d; s.tz = PASTURE.z + Math.sin(a) * d;
          s.mode = 'walk'; s.speed = 0.7 + Math.random() * 0.5;
        }
      } else if (s.mode === 'walk' || s.mode === 'return') {
        if (s.mode === 'return' && s.waypoints.length) { s.tx = s.waypoints[0].x; s.tz = s.waypoints[0].z; }
        const dx = s.tx - s.x, dz = s.tz - s.z, d = Math.hypot(dx, dz);
        if (d < 0.6) {
          if (s.mode === 'return' && s.waypoints.length) { s.waypoints.shift(); if (!s.waypoints.length) { s.mode = 'graze'; s.timer = 2; } }
          else { s.mode = 'graze'; s.timer = 3 + Math.random() * 8; }
        } else {
          s.ry = turnTo(s.ry, Math.atan2(dx, dz), dt * 3);
          const step = Math.min(d, s.speed * dt);
          s.x += Math.sin(s.ry) * step; s.z += Math.cos(s.ry) * step;
        }
      } else if (s.mode === 'lost') {
        const pd = Math.hypot(player.pos.x - s.x, player.pos.z - s.z);
        if (pd < 30) s.ry = turnTo(s.ry, Math.atan2(player.pos.x - s.x, player.pos.z - s.z), dt * 1.5);
        if (pd < 40 && this.bleatTimer < 0) { this.audio.bleat({ x: s.x, y: this.terrain.getHeight(s.x, s.z), z: s.z }); this.bleatTimer = 4 + Math.random() * 4; }
      }
      // gently keep sheep off the player
      const px = s.x - player.pos.x, pz = s.z - player.pos.z, pd = Math.hypot(px, pz);
      if (pd < 1.0 && pd > 1e-3 && s.mode !== 'lost') { s.x += px / pd * (1.0 - pd); s.z += pz / pd * (1.0 - pd); }
      this.place(s, t);
    }
    if (this.bleatTimer < 0) {
      const near = this.sheep.find((s) => Math.hypot(player.pos.x - s.x, player.pos.z - s.z) < 25);
      if (near) this.audio.bleat({ x: near.x, y: this.terrain.getHeight(near.x, near.z), z: near.z });
      this.bleatTimer = 5 + Math.random() * 8;
    }
  }
}

export class Particles {
  constructor(scene, M, max = 80) {
    this.items = [];
    for (let i = 0; i < max; i++) {
      const sp = new THREE.Sprite(M.sprite);
      sp.visible = false;
      scene.add(sp);
      this.items.push({ sp, vel: new THREE.Vector3(), life: 0, max: 1, size: 1 });
    }
  }

  burst(pos, n = 14, speed = 4, size = 0.7) {
    let c = 0;
    for (const p of this.items) {
      if (p.life > 0) continue;
      p.sp.position.copy(pos);
      p.vel.set(Math.random() - 0.5, Math.random() * 0.8 - 0.1, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random()));
      p.life = p.max = 0.5 + Math.random() * 0.7;
      p.size = size * (0.5 + Math.random());
      p.sp.visible = true;
      if (++c >= n) break;
    }
  }

  update(dt) {
    for (const p of this.items) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vel.y += dt * 1.5;
      p.vel.multiplyScalar(1 - dt * 2);
      p.sp.position.addScaledVector(p.vel, dt);
      p.sp.scale.setScalar(p.size * Math.max(0, p.life / p.max));
      if (p.life <= 0) p.sp.visible = false;
    }
  }
}
