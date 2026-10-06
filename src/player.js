import * as THREE from 'three';
import { clamp } from './util.js';
import { WATER_LEVEL } from './layout.js';

const LIMIT = 296;

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
  }

  place(x, z, yaw = 0) {
    this.pos.set(x, 0, z);
    this.pos.y = this.groundAt(x, z, 999);
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

  update(dt, input, time, frozen = false) {
    if (!frozen) {
      this.yaw -= input.lookDX;
      this.pitch = clamp(this.pitch - input.lookDY, -1.45, 1.45);
    }
    let f = frozen ? 0 : input.forward, s = frozen ? 0 : input.strafe;
    const len = Math.hypot(f, s);
    if (len > 1) { f /= len; s /= len; }
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const wx = -sy * f + cy * s, wz = -cy * f - sy * s;

    const ground = this.terrain.getHeight(this.pos.x, this.pos.z);
    this.inWater = Math.max(0, WATER_LEVEL - Math.max(ground, this.collision.groundAt(this.pos.x, this.pos.z, this.pos.y)));
    let speed = input.sprint ? 8.2 : 4.4;
    if (this.inWater > 0.3) speed *= 0.62;
    const accel = this.onGround ? 12 : 2.5;
    const k = Math.min(1, accel * dt);
    this.vel.x += (wx * speed - this.vel.x) * k;
    this.vel.z += (wz * speed - this.vel.z) * k;

    // horizontal move, refusing to climb cliffs
    const tryMove = (nx, nz) => {
      const gOld = this.terrain.getHeight(this.pos.x, this.pos.z);
      const gNew = this.terrain.getHeight(nx, nz);
      const dist = Math.hypot(nx - this.pos.x, nz - this.pos.z);
      if (dist > 1e-5 && gNew > this.pos.y + 0.5 && (gNew - gOld) / dist > 1.25) return false;
      this.pos.x = nx; this.pos.z = nz;
      return true;
    };
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    if (!tryMove(nx, nz)) {
      if (!tryMove(nx, this.pos.z)) this.vel.x = 0;
      if (!tryMove(this.pos.x, nz)) this.vel.z = 0;
    }
    this.collision.resolve(this.pos, this.radius, this.height);
    this.pos.x = clamp(this.pos.x, -LIMIT, LIMIT);
    this.pos.z = clamp(this.pos.z, -LIMIT, LIMIT);

    // vertical
    if (!frozen && input.consume('jump') && this.onGround) {
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
    if (this.moving > 0.3) {
      this.stepTimer -= hs * dt;
      if (this.stepTimer <= 0) { this.stepTimer = 2.1; this.onStep?.(this.inWater > 0.15); }
    }
    this.camera.position.set(this.pos.x, this.camY + this.eye + this.bob, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    // health regen
    if (time - this.lastHurt > 6 && this.hp > 0) this.hp = Math.min(this.maxHp, this.hp + 2.5 * dt);
  }

  hurt(amount, time) {
    this.hp = Math.max(0, this.hp - amount);
    this.lastHurt = time;
  }
}
