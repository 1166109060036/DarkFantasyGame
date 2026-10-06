import * as THREE from 'three';
import { createSheep, createWisp, blobShadow } from './characters.js';
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
        if (pd < 40 && this.bleatTimer < 0) { this.audio.bleat(); this.bleatTimer = 4 + Math.random() * 4; }
      }
      // gently keep sheep off the player
      const px = s.x - player.pos.x, pz = s.z - player.pos.z, pd = Math.hypot(px, pz);
      if (pd < 1.0 && pd > 1e-3 && s.mode !== 'lost') { s.x += px / pd * (1.0 - pd); s.z += pz / pd * (1.0 - pd); }
      this.place(s, t);
    }
    if (this.bleatTimer < 0) {
      const near = this.sheep.some((s) => Math.hypot(player.pos.x - s.x, player.pos.z - s.z) < 25);
      if (near) this.audio.bleat();
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

export class Wisps {
  constructor(scene, M, terrain, audio, spawns) {
    this.scene = scene; this.terrain = terrain; this.audio = audio;
    this.list = spawns.map(([x, z], i) => {
      const group = createWisp(M);
      scene.add(group);
      const home = new THREE.Vector3(x, Math.max(0, terrain.getHeight(x, z)) + 1.6, z);
      return { group, home, pos: home.clone(), hp: 2, alive: true, cooldown: 0, respawn: 0, phase: i * 1.7, hitFlash: 0, chasing: false, humTimer: Math.random() * 5 };
    });
  }

  update(dt, t, player, onAttack) {
    const target = new THREE.Vector3(player.pos.x, player.pos.y + 1.25, player.pos.z);
    for (const w of this.list) {
      if (!w.alive) {
        w.respawn -= dt;
        if (w.respawn <= 0 && w.home.distanceTo(player.pos) > 35) {
          w.alive = true; w.hp = 2; w.pos.copy(w.home); w.group.visible = true;
        }
        continue;
      }
      const toP = target.clone().sub(w.pos);
      const dist = toP.length();
      const fromHome = w.pos.distanceTo(w.home);
      w.chasing = player.hp > 0 && (dist < 15 || (w.chasing && dist < 24)) && fromHome < 50;
      w.cooldown -= dt;
      if (w.chasing) {
        const speed = 3.1 + Math.sin(t * 2 + w.phase) * 0.6;
        if (dist > 0.9) w.pos.addScaledVector(toP.normalize(), Math.min(dist, speed * dt));
        w.pos.y += Math.sin(t * 5 + w.phase) * 0.01;
        if (dist < 1.15 && w.cooldown <= 0) {
          w.cooldown = 1.4;
          onAttack(w);
          w.pos.addScaledVector(toP.normalize(), -1.6);
        }
      } else {
        const goal = w.home.clone().add(new THREE.Vector3(Math.sin(t * 0.4 + w.phase) * 4, Math.sin(t * 1.3 + w.phase) * 0.4, Math.cos(t * 0.31 + w.phase) * 4));
        w.pos.lerp(goal, Math.min(1, dt * 0.8));
      }
      const floor = Math.max(this.terrain.getHeight(w.pos.x, w.pos.z), 0) + 0.6;
      if (w.pos.y < floor) w.pos.y = floor;
      w.hitFlash = Math.max(0, w.hitFlash - dt * 4);
      const pulse = 1 + Math.sin(t * 6 + w.phase) * 0.15 + w.hitFlash;
      w.group.position.copy(w.pos);
      w.group.userData.halo.scale.setScalar(1.8 * pulse);
      w.group.userData.tail.position.set(Math.sin(t * 3 + w.phase) * 0.35, -0.3, Math.cos(t * 2.5 + w.phase) * 0.35);
      w.humTimer -= dt;
      if (w.humTimer <= 0 && dist < 18) { this.audio.wispHum(); w.humTimer = 3 + Math.random() * 4; }
    }
  }

  // Sword arc test. Returns the wisps that were hit.
  hitTest(origin, dir, range = 2.9, cosLimit = 0.55) {
    const hits = [];
    for (const w of this.list) {
      if (!w.alive) continue;
      const to = w.pos.clone().sub(origin);
      const d = to.length();
      if (d < range && to.normalize().dot(dir) > cosLimit) hits.push(w);
    }
    return hits;
  }

  damage(w, dir) {
    w.hp -= 1;
    w.hitFlash = 1;
    w.pos.addScaledVector(dir, 2.2);
    if (w.hp <= 0) {
      w.alive = false;
      w.group.visible = false;
      w.respawn = 30;
      return true;
    }
    return false;
  }

  nearestAlive(p) {
    let best = null, bd = Infinity;
    for (const w of this.list) {
      if (!w.alive) continue;
      const d = w.pos.distanceTo(p);
      if (d < bd) { bd = d; best = w; }
    }
    return best;
  }
}
