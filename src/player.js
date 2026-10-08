import * as THREE from 'three';
import { clamp } from './util.js';
import { WATER_LEVEL } from './layout.js';

const LIMIT = 785;

export class Player {
  constructor(camera, terrain, collision) {
    this.camera = camera;
    this.terrain = terrain;
    this.collision = collision;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.radius = 0.4;
    this.height = 1.8;
    this.eye = 1.62;
    this.onGround = false;
    this.camY = 0;
    this.bobT = 0;
    this.bob = 0;
    this.moving = 0;
    this.maxHp = 100;
    this.hp = 100;
    this.lastHurt = -99;
    this.inWater = 0;
    this.stepTimer = 0;
    this.onStep = null;
    this.sprinting = false;
    this.shake = 0;
    this.roll = 0;
    this.regenMul = 1;     // the leech-doctor and the wick-bearer do not heal on their own
    this.climb = 1.25;     // steepest slope you can walk up (a crawler in the coffin raises it)
  }

  place(x, z, yaw = 0) {
    this.pos.set(x, 0, z);
    this.pos.y = this.groundAt(x, z, this.terrain.getHeight(x, z) + 4);
    this.camY = this.pos.y;
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
  }

  groundAt(x, z, feetY) {
    return Math.max(this.terrain.getHeight(x, z), this.collision.groundAt(x, z, feetY, 0.65));
  }

  get forwardVec() {
    return new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  // mods (from combat): speedMul, sprintOk, dodgeVel (overrides movement), locked (staggered),
  // ride (on the giant cockroach: its speeds, climb, girth and eye height; src/mount.js)
  update(dt, input, time, frozen = false, mods = {}) {
    if (!frozen) {
      this.yaw -= input.lookDX;
      this.pitch = clamp(this.pitch - input.lookDY, -1.45, 1.45);
    }
    const still = frozen || mods.locked;
    let f = still ? 0 : input.forward, s = still ? 0 : input.strafe;
    const len = Math.hypot(f, s);
    if (len > 1) { f /= len; s /= len; }
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const wx = -sy * f + cy * s, wz = -cy * f - sy * s;

    const ground = this.terrain.getHeight(this.pos.x, this.pos.z);
    this.inWater = Math.max(0, WATER_LEVEL - Math.max(ground, this.collision.groundAt(this.pos.x, this.pos.z, this.pos.y)));
    const ride = mods.ride;
    const sprint = input.sprint && (ride || mods.sprintOk !== false) && Math.hypot(f, s) > 0.1 && !still;
    this.sprinting = sprint && this.onGround && !ride;      // the mount does the running, not your legs
    let speed = ride ? (sprint ? ride.run : ride.speed) : (sprint ? 8.2 : 4.4) * (mods.speedMul ?? 1);
    if (this.inWater > 0.3) speed *= 0.62;
    const accel = this.onGround ? 12 : 2.5;
    const k = Math.min(1, accel * dt);
    this.vel.x += (wx * speed - this.vel.x) * k;
    this.vel.z += (wz * speed - this.vel.z) * k;
    if (mods.dodgeVel) { this.vel.x = mods.dodgeVel.x; this.vel.z = mods.dodgeVel.z; }

    // horizontal move, refusing to climb cliffs
    const tryMove = (nx, nz) => {
      const gOld = this.terrain.getHeight(this.pos.x, this.pos.z);
      const gNew = this.terrain.getHeight(nx, nz);
      const dist = Math.hypot(nx - this.pos.x, nz - this.pos.z);
      if (dist > 1e-5 && gNew > this.pos.y + 0.5 && (gNew - gOld) / dist > (ride ? ride.climb : this.climb)) return false;
      this.pos.x = nx; this.pos.z = nz;
      return true;
    };
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    if (!tryMove(nx, nz)) {
      if (!tryMove(nx, this.pos.z)) this.vel.x = 0;
      if (!tryMove(this.pos.x, nz)) this.vel.z = 0;
    }
    this.collision.resolve(this.pos, ride ? ride.radius : this.radius, this.height);
    this.pos.x = clamp(this.pos.x, -LIMIT, LIMIT);
    this.pos.z = clamp(this.pos.z, -LIMIT, LIMIT);

    // vertical
    if (ride) ride.mount.flap(this, input, dt);
    else if (!still && input.consume('jump') && this.onGround) {
      this.vel.y = 6.4;
      this.onGround = false;
    }
    this.vel.y -= 21 * dt;
    this.pos.y += this.vel.y * dt;
    const g = this.groundAt(this.pos.x, this.pos.z, this.pos.y);
    if (this.pos.y <= g) {
      this.pos.y = g; this.vel.y = 0; this.onGround = true;
    } else if (this.onGround && this.vel.y <= 0 && this.pos.y - g < 0.55) {
      this.pos.y = g; this.vel.y = 0;
    } else {
      this.onGround = false;
    }

    // camera with smoothed step-ups and head bob
    this.camY = this.pos.y > this.camY ? this.camY + (this.pos.y - this.camY) * Math.min(1, dt * 14) : this.pos.y;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.moving = this.onGround ? Math.min(1, hs / 4) : 0;
    this.bobT += hs * dt * 1.25;
    this.bob = Math.sin(this.bobT * 2) * 0.045 * this.moving;
    if (this.moving > 0.3 && !ride) {
      this.stepTimer -= hs * dt;
      if (this.stepTimer <= 0) { this.stepTimer = 2.1; this.onStep?.(this.inWater > 0.15); }
    }
    this.shake = Math.max(0, this.shake - dt * 1.6);
    const sh = this.shake * this.shake * 0.6;
    this.camera.position.set(
      this.pos.x + (Math.random() - 0.5) * sh,
      this.camY + (ride ? ride.eye : this.eye) + this.bob * (ride ? 0.4 : 1) + (Math.random() - 0.5) * sh - (mods.dodgeVel ? 0.18 : 0),
      this.pos.z + (Math.random() - 0.5) * sh,
    );
    this.camera.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');

    // health regen
    if (time - this.lastHurt > 6 && this.hp > 0) this.hp = Math.min(this.maxHp, this.hp + 2.5 * this.regenMul * dt);
  }

  hurt(amount, time) {
    this.hp = Math.max(0, this.hp - amount);
    this.lastHurt = time;
  }
}
