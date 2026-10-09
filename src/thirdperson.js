// The over-the-shoulder view (V, or Back on a controller).
//
// The game itself always thinks in first person: aim, blows, bolts and sound all start from the eye
// camera that player.js moves. This view only changes what is drawn: a second camera on a boom behind
// the right shoulder, looking at a point far along the eye's line so the crosshair still marks what
// the eye is aiming at, and the hero of the path (src/heroes.js, the same model as the path picker)
// standing where the player stands, walking, striking and guarding as the player does.
import * as THREE from 'three';
import { createHero, animateHero } from './heroes.js';
import { MOUNT } from './mount.js';
import { SEATS } from './moba.js';

const CLOTH = new THREE.Color(0.42, 0.16, 0.12);
const V = new THREE.Vector3(), F = new THREE.Vector3(), R = new THREE.Vector3(), T = new THREE.Vector3();

export class ThirdPerson {
  constructor(game) {
    this.g = game;
    this.on = false;
    this.cam = new THREE.PerspectiveCamera(66, 1, 0.1, 1500);
    this.hero = null;
    this.boom = 3;          // how far back the camera sits right now (pulled in by walls)
    this.speed = 0;
    this.swing = null;
    this.shots = 0;
  }

  set(on) {
    this.on = !!on;
    if (this.hero) this.hero.visible = this.on;
  }

  // the hero for the current path; built again when the path changes
  ensureHero() {
    const g = this.g, kind = g.kit?.id || 'wanderer';
    // (built again, too, once the path's model files have loaded)
    if (this.hero && this.hero.userData.kind === kind && this.hero.userData.models === !!g.heroModels) return this.hero;
    if (this.hero) g.scene.remove(this.hero);
    const cloth = g.moba ? new THREE.Color(...SEATS[g.moba.me].color) : CLOTH;
    this.hero = createHero(kind, g.M, cloth);
    this.hero.userData.models = !!g.heroModels;
    this.hero.traverse((o) => { o.frustumCulled = false; });
    g.scene.add(this.hero);
    g.equipment?.tint(this.hero.userData.weapon);
    return this.hero;
  }

  // is this point inside something solid (a wall, a rock, a house)?
  solid(x, y, z) {
    const g = this.g;
    if (y < g.terrain.getHeight(x, z) + 0.25) return true;
    for (const o of g.collision.query(x, z)) {
      if (y < o.yMin - 0.1 || y > o.yMax + 0.1) continue;
      const dx = x - o.x, dz = z - o.z;
      if (o.type === 1) {
        const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
        if (Math.abs(lx) <= o.hx + 0.2 && Math.abs(lz) <= o.hz + 0.2) return true;
      } else if (o.r != null && dx * dx + dz * dz < (o.r + 0.2) ** 2) return true;
    }
    return false;
  }

  // dt: real seconds; play: the world is running (not a menu)
  update(dt, play) {
    const g = this.g, p = g.player, eye = g.camera, c = g.combat, kit = g.kit;
    const hero = this.ensureHero();
    hero.visible = this.on;
    if (!this.on) return;

    // the hero where the player stands, facing where the eye looks
    const riding = !!g.mount?.ridden;
    hero.position.set(p.pos.x, p.camY, p.pos.z);
    hero.rotation.y = p.yaw + Math.PI;
    if (riding) {
      const m = g.mount;
      V.set(MOUNT.seat.x, 0, MOUNT.seat.z).applyAxisAngle(THREE.Object3D.DEFAULT_UP, m.yaw);
      hero.position.set(m.pos.x + V.x, m.pos.y + MOUNT.seat.y - 0.95, m.pos.z + V.z);
      hero.rotation.y = m.yaw + Math.PI;
    }
    // what the body is doing: walking, a new blow, a shot, a guard
    const hs = Math.hypot(p.vel.x, p.vel.z);
    this.speed += (hs - this.speed) * Math.min(1, dt * 8);
    let action = c.blocking ? 3 : 0;
    if (c.swing && c.swing !== this.swing) action = c.swing.kind === 'heavy' ? 2 : 1;
    this.swing = c.swing;
    const shots = kit?.shots || 0;
    if (shots !== this.shots) { action = 1; this.shots = shots; }
    if (play && dt > 0) animateHero(hero, dt, { speed: riding ? 0 : this.speed, action, ride: riding });
    else if (!hero.userData.posed) animateHero(hero, 1 / 60, { speed: 0, action: 0 });
    hero.userData.posed = true;
    hero.visible = p.hp > 0 || g.state === 'dead';

    // the boom: back and over the right shoulder; closer while aiming a crossbow, further on the mount
    const aim = kit?.aiming ? 1 : 0;
    const want = riding ? 5.2 : aim ? 1.7 : 3.0;
    const side = riding ? 0.4 : aim ? 0.55 : 0.6;
    const lift = riding ? 0.6 : 0.3;
    F.set(-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch));
    R.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
    const base = T.copy(eye.position).addScaledVector(R, side).add(V.set(0, lift, 0));
    // walk the boom out until it meets something, and stop short of it
    let reach = want;
    for (let i = 1; i <= 12; i++) {
      const d = (want * i) / 12;
      if (this.solid(base.x - F.x * d, base.y - F.y * d, base.z - F.z * d)) { reach = Math.max(0.3, d - want / 12 - 0.15); break; }
    }
    // pull in at once, let out slowly
    this.boom = reach < this.boom ? reach : this.boom + (reach - this.boom) * Math.min(1, dt * 3 || 1);
    const cam = this.cam;
    cam.position.copy(base).addScaledVector(F, -this.boom);
    // the shake (in the eye's position) and fov (a crossbow's zoom) carry over
    cam.lookAt(V.copy(eye.position).addScaledVector(F, 30));
    cam.rotation.z += p.roll;
    if (cam.fov !== eye.fov || cam.aspect !== eye.aspect) { cam.fov = eye.fov; cam.aspect = eye.aspect; cam.updateProjectionMatrix(); }
    // too close to see past: fade the hero out of the way
    hero.visible = hero.visible && this.boom > 0.75;
  }
}
