// Combat: player stamina, light/heavy attacks, block & parry, dodge with i-frames,
// and every enemy's AI (idle -> chase -> telegraphed windup -> strike -> recover).
import * as THREE from 'three';
import { createWisp, createStrawman, createWolf, createLeech, createStoneKnight, blobShadow } from './characters.js';
import {
  WISP_SPAWNS, STRAW_SPAWNS, WOLF_PACKS, LEECH_SPAWNS, KNIGHT_POS, GAUNT_SPAWNS, GAUNT_DAY_SPAWNS, CRAWLER_SPAWNS,
  WEEPER_SPAWNS, BRUTE_SPAWNS, EXTRA_WOLF_PACKS, EXTRA_STRAW_SPAWNS, EXTRA_LEECH_SPAWNS,
} from './layout.js';
import { createGaunt, createCrawler, createWeeper, createBrute } from './gaunts.js';
import { clamp, lerp, wrapAngle } from './util.js';
import { rng } from './noise.js';

export const ENEMY_TYPES = {
  wisp: { name: 'วิญญาณบึง', hp: 2, speed: 3.2, range: 1.3, windup: 0.55, recover: 0.9, damage: 12, aggro: 15, leash: 50, radius: 0.4, height: 1.5, weight: 0.4, active: 'night', fly: true, coins: [2, 4], respawn: 30 },
  straw: { name: 'หุ่นฟางคลั่ง', hp: 4, speed: 2.4, range: 2.0, windup: 0.85, recover: 1.0, damage: 15, aggro: 14, leash: 40, radius: 0.45, height: 2.0, weight: 1, active: 'day', coins: [3, 6], respawn: 90 },
  wolf: { name: 'หมาป่าเงา', hp: 3, speed: 6.0, range: 2.4, windup: 0.6, recover: 1.0, damage: 13, aggro: 20, leash: 60, radius: 0.5, height: 1.1, weight: 0.7, active: 'always', lunge: 9, coins: [2, 5], respawn: 120 },
  leech: { name: 'ปลิงยักษ์', hp: 5, speed: 2.4, range: 2.7, windup: 0.75, recover: 1.2, damage: 18, aggro: 12, leash: 22, radius: 0.6, height: 1.6, weight: 1.4, active: 'night', water: true, coins: [4, 7], respawn: 90 },
  // the Pale Ones (src/gaunts.js)
  gaunt: { name: 'ร่างซูบ', hp: 4, speed: 1.9, sprint: 9, range: 1.9, windup: 0.6, recover: 1.0, damage: 16, aggro: 17, leash: 55, radius: 0.4, height: 1.8, weight: 0.8, active: 'night', coins: [2, 5], respawn: 120, cull: 85, freq: 5 },
  crawler: { name: 'ร่างคลาน', hp: 3, speed: 5.2, range: 1.8, windup: 0.45, recover: 1.1, damage: 12, aggro: 15, leash: 45, radius: 0.5, height: 0.9, weight: 0.6, active: 'night', lunge: 7, coins: [2, 4], respawn: 120, cull: 85, freq: 2.7 },
  weeper: { name: 'หญิงร่ำไห้', hp: 7, speed: 7.5, range: 1.7, windup: 0.3, recover: 1.3, damage: 30, aggro: 26, leash: 80, radius: 0.4, height: 2.1, weight: 1.2, active: 'night', stalker: true, coins: [8, 12], respawn: 300, cull: 95 },
  brute: { name: 'ร่างซูบยักษ์', hp: 16, speed: 1.8, range: 3.0, windup: 1.1, recover: 1.5, damage: 26, aggro: 18, leash: 35, radius: 0.9, height: 3.2, weight: 4, active: 'always', slamEvery: 2, coins: [20, 30], respawn: 600, cull: 110, freq: 2, elite: true },
  knight: { name: 'อัศวินหินผู้เฝ้าสะพาน', hp: 32, speed: 2.5, range: 3.8, windup: 1.05, recover: 1.4, damage: 28, aggro: 22, leash: 40, radius: 1.1, height: 4.2, weight: 6, active: 'always', boss: true, slamEvery: 3, coins: [60, 60] },
};

const COST = { light: 10, heavy: 26, dodge: 22 };
const PARRY_WINDOW = 0.3;
const CULL = 115;
const V = new THREE.Vector3();

// view-model poses: [x, y, z, rx, ry, rz]
const POSE = {
  rest: [0.34, -0.4, -0.62, -1.05, -0.25, -0.3],
  guard: [0.08, -0.3, -0.52, -0.25, 0.15, 1.3],
  charge: [0.38, -0.3, -0.55, -0.35, -0.55, -0.95],
  up: [0.42, -0.16, -0.45, -0.25, -0.6, -1.25],
  end: [-0.28, -0.42, -0.55, -1.55, 0.55, 0.95],
  heavyEnd: [-0.36, -0.52, -0.5, -1.75, 0.75, 1.15],
};
const ease = (x) => x * x * (3 - 2 * x);
const mixPose = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));

export class Combat {
  constructor(game) {
    this.g = game;
    this.stamina = 100;
    this.maxStamina = 100;
    this.lastUse = -9;
    this.exhausted = false;
    this.blocking = false;
    this.blockStart = -9;
    this.charging = false;
    this.charge = 0;
    this.swing = null;
    this.dodgeT = 0;
    this.dodgeVel = new THREE.Vector3();
    this.iframes = 0;
    this.staggerT = 0;
    this.hitStop = 0;
    this.pose = POSE.rest.slice();
    this.swordMul = 1;
    this.bossDefeated = false;
    this.target = null;
    this.targetT = 0;
    this.hintShown = false;
    this.enemies = [];
    this.spawnAll();
  }

  // ---------------------------------------------------------------- spawning
  spawnAll() {
    const T = this.g.terrain, r = rng(99);
    WISP_SPAWNS.forEach(([x, z]) => this.spawn('wisp', x, z));
    [...STRAW_SPAWNS, ...EXTRA_STRAW_SPAWNS].forEach(([x, z]) => this.spawn('straw', x, z));
    [...WOLF_PACKS, ...EXTRA_WOLF_PACKS].forEach(([x, z, n]) => { for (let i = 0; i < n; i++) this.spawn('wolf', x + (r() - 0.5) * 10, z + (r() - 0.5) * 10); });
    GAUNT_SPAWNS.forEach(([x, z]) => this.spawn('gaunt', x, z));
    GAUNT_DAY_SPAWNS.forEach(([x, z]) => { this.spawn('gaunt', x, z).activeOverride = 'always'; });
    CRAWLER_SPAWNS.forEach(([x, z]) => this.spawn('crawler', x, z));
    WEEPER_SPAWNS.forEach(([x, z]) => this.spawn('weeper', x, z));
    BRUTE_SPAWNS.forEach(([x, z]) => this.spawn('brute', x, z));
    [...LEECH_SPAWNS, ...EXTRA_LEECH_SPAWNS].forEach(([x, z]) => {
      // snap to the nearest properly deep water
      let best = null, bd = Infinity;
      for (let dz = -24; dz <= 24; dz += 2) {
        for (let dx = -24; dx <= 24; dx += 2) {
          if (T.getHeight(x + dx, z + dz) < -0.3 && dx * dx + dz * dz < bd) { bd = dx * dx + dz * dz; best = [x + dx, z + dz]; }
        }
      }
      if (best) this.spawn('leech', best[0], best[1]);
    });
    this.boss = this.spawn('knight', KNIGHT_POS.x, KNIGHT_POS.z);
    this.boss.ry = -Math.PI / 2;
  }

  spawn(type, x, z) {
    const def = ENEMY_TYPES[type], M = this.g.M;
    const obj = { wisp: createWisp, straw: createStrawman, wolf: createWolf, leech: createLeech, knight: createStoneKnight, gaunt: createGaunt, crawler: createCrawler, weeper: createWeeper, brute: createBrute }[type](M);
    this.g.scene.add(obj);
    let shadow = null;
    if (!def.fly && !def.water) {
      shadow = blobShadow(M, def.radius * 3);
      this.g.scene.add(shadow);
    }
    const home = new THREE.Vector3(x, this.groundY(x, z, def), z);
    const e = {
      type, def, obj, shadow, home, pos: home.clone(), vel: new THREE.Vector3(), ry: Math.random() * 6.28,
      hp: def.hp, state: 'idle', t: Math.random() * 3, alive: true, respawn: 0, phase: Math.random() * 10,
      wander: home.clone(), hits: 0, struck: false, anim: 0, flash: 0,
    };
    this.enemies.push(e);
    return e;
  }

  groundY(x, z, def) {
    const h = this.g.terrain.getHeight(x, z);
    if (def.fly) return Math.max(h, 0) + 1.5;
    if (def.water) return 0;
    return Math.max(h, this.g.collision.groundAt(x, z, h + 2, 0.65));
  }

  isActive(e) {
    const when = e.activeOverride || e.def.active;
    if (when === 'always') return true;
    return (when === 'night') === this.g.dayNight.isNight;
  }

  nearest(type, p) {
    let best = null, bd = Infinity;
    for (const e of this.enemies) {
      if (e.type !== type || !e.alive || e.state === 'dying' || !this.isActive(e)) continue;
      const d = e.pos.distanceTo(p);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  serialize() { return { bossDefeated: this.bossDefeated, swordMul: this.swordMul }; }

  load(d = {}) {
    this.bossDefeated = !!d.bossDefeated;
    this.swordMul = d.swordMul || 1;
    if (this.bossDefeated) {
      this.boss.alive = false;
      this.boss.obj.visible = false;
      this.boss.shadow.visible = false;
    }
  }

  // everything forgets you when you die or rest
  resetAggro() {
    for (const e of this.enemies) {
      if (!e.alive || e.state === 'dying') continue;
      e.state = 'idle';
      e.pos.copy(e.home);
      e.hp = e.def.hp;
    }
  }

  // ---------------------------------------------------------------- player side
  get busy() { return !!this.swing || this.dodgeT > 0 || this.staggerT > 0; }

  spend(n) {
    if (this.g.buffs.tonic > 0) n *= 0.5;
    this.stamina = Math.max(0, this.stamina - n);
    this.lastUse = this.g.time;
    if (this.stamina <= 0) this.exhausted = true;
  }

  playerMods() {
    return {
      speedMul: this.blocking ? 0.45 : this.charging ? 0.6 : 1,
      sprintOk: !this.exhausted && !this.blocking,
      dodgeVel: this.dodgeT > 0 ? this.dodgeVel : null,
      locked: this.staggerT > 0,
    };
  }

  updatePlayer(dt, input, frozen) {
    const g = this.g, p = g.player, t = g.time;
    this.iframes = Math.max(0, this.iframes - dt);
    this.dodgeT = Math.max(0, this.dodgeT - dt);
    this.staggerT = Math.max(0, this.staggerT - dt);
    this.targetT = Math.max(0, this.targetT - dt);

    if (p.sprinting) this.spend(13 * dt);
    if (t - this.lastUse > 0.9) this.stamina = Math.min(this.maxStamina, this.stamina + (this.blocking ? 12 : 32) * (g.buffs.tonic > 0 ? 2 : 1) * dt);
    if (this.exhausted && this.stamina > 35) this.exhausted = false;

    if (frozen) { this.blocking = false; this.charging = false; return; }

    // block (hold right mouse); the first PARRY_WINDOW seconds of a block parry
    const wantBlock = input.blockHeld && !this.swing && this.dodgeT <= 0 && this.staggerT <= 0 && this.stamina > 0;
    if (wantBlock && !this.blocking) this.blockStart = t;
    this.blocking = wantBlock;

    // dodge
    if (input.consume('dodge') && this.dodgeT <= 0 && this.staggerT <= 0 && !this.swing) {
      if (this.stamina < 8) this.say('เหนื่อยเกินกว่าจะหลบ...');
      else {
        let f = input.forward, s = input.strafe;
        if (Math.hypot(f, s) < 0.2) { f = -1; s = 0; }
        const len = Math.hypot(f, s);
        f /= len; s /= len;
        const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
        this.dodgeVel.set((-sy * f + cy * s) * 10.5, 0, (-cy * f - sy * s) * 10.5);
        this.dodgeT = 0.34;
        this.iframes = 0.3;
        this.blocking = false;
        this.charging = false;
        this.spend(COST.dodge);
        p.roll = -s * 0.12;
        g.audio.dodge();
      }
    }

    // attack: tap = light, hold then release = heavy
    if (input.consume('attack') && !this.swing && this.dodgeT <= 0 && this.staggerT <= 0) {
      this.charging = true;
      this.charge = 0;
      this.heavyReady = false;
    }
    if (this.charging) {
      if (input.attackHeld && !this.blocking) {
        this.charge += dt;
        if (this.charge > 0.38 && !this.heavyReady) { this.heavyReady = true; g.audio.charge(); }
      } else {
        this.charging = false;
        if (!this.blocking) this.startSwing(this.heavyReady ? 'heavy' : 'light');
      }
    }
    if (this.swing) this.advanceSwing(dt);
    if (this.dodgeT <= 0) p.roll *= Math.max(0, 1 - dt * 8);
  }

  startSwing(kind) {
    if (this.stamina <= 0) { this.say('เหนื่อย!'); return; }
    this.swing = { kind, t: 0, dur: kind === 'heavy' ? 0.62 : 0.36, hit: false };
    this.spend(COST[kind]);
    this.g.audio.swing(kind === 'heavy');
  }

  advanceSwing(dt) {
    const s = this.swing;
    s.t += dt / s.dur;
    if (!s.hit && s.t > (s.kind === 'heavy' ? 0.42 : 0.35)) {
      s.hit = true;
      this.playerStrike(s.kind);
    }
    if (s.t >= 1) this.swing = null;
  }

  playerStrike(kind) {
    const g = this.g, cam = g.camera.position, dir = g.player.forwardVec;
    const heavy = kind === 'heavy';
    for (const e of this.enemies) {
      if (!e.alive || e.state === 'dying' || !e.obj.visible) continue;
      V.copy(e.pos);
      if (!e.def.fly) V.y += e.def.height * 0.5;
      V.sub(cam);
      const d = V.length();
      if (d > (heavy ? 3.4 : 2.9) + e.def.radius) continue;
      if (V.normalize().dot(dir) < (heavy ? 0.3 : 0.5) && d > e.def.radius + 0.8) continue;
      this.damageEnemy(e, heavy, V);
    }
  }

  damageEnemy(e, heavy, dir) {
    const g = this.g, def = e.def;
    const dmg = (heavy ? 3 : 1) * g.damageMul;
    e.hp -= dmg;
    e.flash = 1;
    e.vel.addScaledVector(V.set(dir.x, 0, dir.z).normalize(), (heavy ? 7 : 3) / def.weight);
    g.audio.hit(heavy, e.type, e.pos);
    g.particles.burst(e.pos.clone().setY(e.pos.y + def.height * 0.55), heavy ? 14 : 7, heavy ? 4 : 3, 0.5);
    this.hitStop = Math.max(this.hitStop, heavy ? 0.09 : 0.035);
    g.player.shake = Math.max(g.player.shake, heavy ? 0.12 : 0.05);
    this.target = e;
    this.targetT = 3;
    if (e.hp <= 0) { this.kill(e); return; }
    // ordinary foes flinch (a light hit interrupts their windup); the knight only staggers to heavy blows briefly
    if (!def.boss) { e.state = 'stagger'; e.t = heavy ? 0.65 : 0.3; }
    else if (heavy && e.state !== 'windup') { e.state = 'stagger'; e.t = 0.3; }
    if (e.state === 'idle' || e.state === 'return') e.state = 'chase';
  }

  kill(e) {
    const g = this.g, def = e.def;
    e.state = 'dying';
    e.t = e.obj.userData.animate ? 2.6 : 0.9;
    g.audio.enemyDie(e.type, e.pos);
    g.particles.burst(e.pos.clone().setY(e.pos.y + def.height * 0.5), 22, 5, 0.9);
    const [a, b] = def.coins;
    g.addCoins(a + Math.floor(Math.random() * (b - a + 1)));
    g.hud.grin();
    if (e.type === 'wisp') g.quests.onWispKilled();
    g.loot.dropFrom(e);
    if (def.boss) {
      this.bossDefeated = true;
      this.swordMul = 1.6;
      g.ui.banner('ชนะ', `${def.name} พ่ายแพ้`);
      setTimeout(() => g.ui.toast('ได้รับ ดาบแห่งราชาหิน — พลังโจมตี ×1.6'), 1800);
      g.music?.sting('victory');
      g.save();
    }
  }

  // An enemy's blow lands: dodge > parry > block > hit.
  enemyStrike(e) {
    const g = this.g, p = g.player, def = e.def;
    const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, d = Math.hypot(dx, dz);
    const slam = def.slamEvery && e.hits % def.slamEvery === def.slamEvery - 1;
    e.hits++;
    if (slam) {
      g.particles.burst(e.pos.clone().add(new THREE.Vector3(Math.sin(e.ry) * 3, 0.3, Math.cos(e.ry) * 3)), 26, 6, 1.2);
      p.shake = Math.max(p.shake, 0.35);
      g.audio.slam(e.pos);
      if (d > 5.2) return;
    } else {
      if (d > def.range + 0.7) return;
      const facing = (Math.sin(e.ry) * dx + Math.cos(e.ry) * dz) / Math.max(d, 1e-3);
      if (facing < 0.45 && d > 1.2) return;
    }
    if (p.hp <= 0) return;
    if (this.iframes > 0) { this.say('หลบ!'); return; }
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    const facingEnemy = (-dx * fx - dz * fz) / Math.max(d, 1e-3) > 0.3;
    let dmg = def.damage * (slam ? 1.3 : 1);
    if (this.blocking && facingEnemy && !slam) {
      if (g.time - this.blockStart < PARRY_WINDOW) {
        e.state = 'stagger';
        e.t = def.boss ? 1.9 : 1.4;
        e.vel.set(-dx, 0, -dz).normalize().multiplyScalar(4 / def.weight);
        this.stamina = Math.min(this.maxStamina, this.stamina + 15);
        this.hitStop = 0.14;
        p.shake = Math.max(p.shake, 0.22);
        g.audio.parry();
        g.particles.burst(g.camera.position.clone().addScaledVector(p.forwardVec, 0.9), 16, 4, 0.35);
        g.ui.combatText('ปัดสำเร็จ!', 'parry');
        g.hud.grin();
        return;
      }
      this.spend(dmg * 1.2);
      g.audio.block();
      p.shake = Math.max(p.shake, 0.12);
      p.vel.x += dx / d * 3; p.vel.z += dz / d * 3;
      if (this.stamina > 0) dmg *= 0.12;
      else { dmg *= 0.6; this.staggerT = 0.7; this.blocking = false; g.ui.combatText('การ์ดแตก!', 'bad'); }
    }
    dmg *= g.armorMul;
    p.hurt(dmg, g.time);
    // the status-bar face flinches toward whoever landed the blow
    const rightDot = (-dx * Math.cos(p.yaw) + dz * Math.sin(p.yaw)) / Math.max(d, 1e-3);
    g.hud.hurt(Math.abs(rightDot) < 0.35 ? 0 : Math.sign(rightDot), dmg);
    g.hurtFlash = 1;
    g.audio.hurt();
    p.shake = Math.max(p.shake, 0.25);
    if (d > 1e-3) { p.vel.x += dx / d * 5; p.vel.z += dz / d * 5; }
  }

  say(text) { this.g.ui.combatText(text, 'info'); }

  // ---------------------------------------------------------------- enemy AI
  updateEnemies(dt, inPlay) {
    const g = this.g, p = g.player, t = g.time;
    const playerOk = inPlay && p.hp > 0;
    let bossEngaged = false, engaged = 0;

    for (const e of this.enemies) {
      const def = e.def;
      if (!e.alive) {
        e.respawn -= dt;
        if (!def.boss && e.respawn <= 0 && e.home.distanceTo(p.pos) > 45) {
          Object.assign(e, { alive: true, hp: def.hp, state: 'idle', t: 2 });
          e.pos.copy(e.home);
          e.obj.scale.setScalar(def.boss ? 1.55 : 1);
          e.obj.position.copy(e.pos);
        }
        continue;
      }
      const active = this.isActive(e);
      const far = e.pos.distanceTo(p.pos) > (def.cull || CULL);
      // wisps, leeches and the Pale Ones simply aren't there outside their hours
      const hidden = !active && (def.fly || def.water || !!e.obj.userData.animate);
      e.obj.visible = !hidden && !far;
      if (e.shadow) e.shadow.visible = e.obj.visible;
      if (hidden || far) {
        // out of sight: anything mid-death finishes dying now (otherwise it would never respawn)
        if (e.state === 'dying') { e.alive = false; e.respawn = def.respawn || 1e9; if (e.shadow) e.shadow.visible = false; }
        else e.state = 'idle';
        continue;
      }

      if (e.state === 'dying') {
        e.t -= dt;
        const k = Math.max(0, e.t / 0.9);
        if (e.obj.userData.animate) {
          // rigged bodies crumple, lie still a moment, then sink into the earth
          e.obj.userData.animate(e, dt, t, { dying: Math.min(1, (2.6 - e.t) / 1.0), moving: 0, speed: 0 });
          e.obj.position.y = e.pos.y - Math.max(0, 0.8 - e.t) * 1.6;
        } else {
          e.obj.scale.setScalar((def.boss ? 1.55 : 1) * (0.2 + 0.8 * k));
          e.obj.position.y = e.pos.y - (1 - k) * (def.fly ? 0 : 0.8);
        }
        if (e.t <= 0) {
          e.alive = false;
          e.obj.visible = false;
          if (e.shadow) e.shadow.visible = false;
          e.respawn = def.respawn || 1e9;
        }
        continue;
      }

      // knockback
      e.pos.addScaledVector(e.vel, dt);
      e.vel.multiplyScalar(Math.max(0, 1 - dt * 6));

      const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, dist = Math.hypot(dx, dz);
      const toPlayer = Math.atan2(dx, dz);
      const fromHome = Math.hypot(e.pos.x - e.home.x, e.pos.z - e.home.z);
      let moveSpeed = 0, moveAngle = e.ry, turn = 0;
      e.t -= dt;
      // stalkers: is the player looking at this one right now?
      let seen = false;
      if (def.stalker && playerOk && dist < 70 && dist > 1e-3) {
        const look = (-Math.sin(p.yaw) * -dx - Math.cos(p.yaw) * -dz) / dist;
        seen = look > 0.74;
        if (seen && !e.wasSeen && e.state === 'chase' && dist < 8) { g.audio.sting(); g.player.shake = Math.max(g.player.shake, 0.15); }
        if (!seen && e.state === 'chase' && dist < 24 && (e.sobT = (e.sobT || 0) - dt) <= 0) { g.audio.sob(e.pos); e.sobT = 3 + Math.random() * 3; }
      }
      e.wasSeen = seen;
      e.frozen = seen && (e.state === 'chase' || e.state === 'idle' || e.state === 'return');

      switch (e.state) {
        case 'idle':
          if (e.t <= 0) {
            const a = Math.random() * Math.PI * 2, r = Math.random() * (def.boss ? 2 : 7);
            e.wander.set(e.home.x + Math.cos(a) * r, 0, e.home.z + Math.sin(a) * r);
            e.t = 3 + Math.random() * 5;
          }
          if (active && !def.stalker) {   // dormant scarecrows stand on their poles; she just waits
            const wd = Math.hypot(e.wander.x - e.pos.x, e.wander.z - e.pos.z);
            if (wd > 0.6) { moveSpeed = def.speed * 0.3; moveAngle = Math.atan2(e.wander.x - e.pos.x, e.wander.z - e.pos.z); }
          }
          if (active && playerOk && dist < def.aggro) {
            e.state = 'chase';
            g.audio.enemyCue(e.type, 'aggro', e.pos);
            if (!this.hintShown) {
              this.hintShown = true;
              g.ui.toast(g.input.touch ? '⚔ แตะ = ฟันเบา · กดค้าง = ฟันหนัก · 🛡 ป้องกัน (จังหวะพอดี = ปัด) · ↯ หลบ'
                : 'คลิกซ้าย ฟันเบา · กดค้าง ฟันหนัก · คลิกขวาค้าง ป้องกัน (กดตอนศัตรูจะโจมตี = ปัด) · C / Ctrl หลบ');
            }
          }
          break;
        case 'chase':
          if (!playerOk || !active || fromHome > def.leash) { e.state = 'return'; break; }
          moveSpeed = def.speed;
          moveAngle = toPlayer;
          // gaunts shamble, then break into a sprint once they are close
          e.running = !!def.sprint && dist < def.sprint;
          if (e.running) moveSpeed *= 2.2;
          // the weeper cannot move, turn or begin an attack while you are looking at her
          if (seen) { moveSpeed = 0; break; }
          if (dist < def.range) {
            e.state = 'windup';
            e.t = def.windup;
            g.audio.enemyCue(e.type, 'windup', e.pos);
          }
          break;
        case 'return': {
          moveSpeed = def.speed * 0.8;
          moveAngle = Math.atan2(e.home.x - e.pos.x, e.home.z - e.pos.z);
          if (fromHome < 1) { e.state = 'idle'; e.hp = def.hp; e.t = 2; }
          if (active && playerOk && dist < def.aggro * 0.6 && fromHome < def.leash * 0.7) e.state = 'chase';
          break;
        }
        case 'windup':
          turn = def.boss ? 1.3 : 2.5;
          if (e.t <= 0) {
            e.state = 'strike';
            e.t = 0.16;
            if (def.lunge) e.vel.set(Math.sin(e.ry), 0, Math.cos(e.ry)).multiplyScalar(def.lunge);
          }
          break;
        case 'strike':
          if (e.t <= 0) {
            this.enemyStrike(e);
            // a parry has already put it into a long stagger; otherwise it recovers normally
            if (e.state === 'strike') { e.state = 'recover'; e.t = def.recover; }
          }
          break;
        case 'recover':
        case 'stagger':
          if (e.t <= 0) e.state = playerOk && active ? 'chase' : 'return';
          break;
      }
      const fighting = e.state === 'chase' || e.state === 'windup' || e.state === 'strike' || e.state === 'recover' || e.state === 'stagger';
      if (fighting && def.boss) bossEngaged = true;
      // a weeper creeping up unseen must not give herself away by starting the battle music
      if (fighting && dist < 35 && !(def.stalker && e.state === 'chase' && dist > 5)) engaged += def.weight > 2 ? 2 : 1;

      // facing (a watched stalker doesn't even turn)
      const goal = turn ? toPlayer : moveAngle;
      const rate = turn || 6;
      if (!e.frozen) e.ry += clamp(wrapAngle(goal - e.ry), -rate * dt, rate * dt);
      e.curSpeed = moveSpeed;
      // movement (aim may differ from facing for a frame or two; that's fine)
      if (moveSpeed > 0) this.moveEnemy(e, Math.sin(moveAngle) * moveSpeed * dt, Math.cos(moveAngle) * moveSpeed * dt);
      // keep out of the player
      const minD = def.radius + 0.45;
      if (dist < minD && dist > 1e-3) { e.pos.x -= dx / dist * (minD - dist); e.pos.z -= dz / dist * (minD - dist); }

      this.animate(e, dt, t, active);
    }
    g.ui.setBoss(bossEngaged && this.boss.alive ? this.boss : null);
    // the score follows the fight: how many things are on you, and whether it is the knight
    this.engaged = engaged;
    this.bossEngaged = bossEngaged && this.boss.alive;
    const tgt = this.target;
    g.ui.setTarget(tgt && this.targetT > 0 && tgt.alive && tgt.state !== 'dying' && !tgt.def.boss ? tgt : null);
  }

  moveEnemy(e, mx, mz) {
    const def = e.def, T = this.g.terrain;
    const nx = e.pos.x + mx, nz = e.pos.z + mz;
    if (def.water && T.getHeight(nx, nz) > 0.1) return;          // leeches never leave the water
    if (!def.fly && !def.water) {
      const h0 = T.getHeight(e.pos.x, e.pos.z), h1 = T.getHeight(nx, nz);
      if (h1 - h0 > Math.hypot(mx, mz) * 1.3 + 0.05) return;      // no cliff climbing
    }
    e.pos.x = nx;
    e.pos.z = nz;
    if (!def.fly) this.g.collision.resolve(e.pos, def.radius, def.height);
  }

  animate(e, dt, t, active) {
    const def = e.def, o = e.obj, ud = o.userData;
    const windup = e.state === 'windup' ? 1 - Math.max(0, e.t) / def.windup : 0;
    const striking = e.state === 'strike' ? 1 : 0;
    const stag = e.state === 'stagger' ? 1 : 0;
    const moving = e.state === 'chase' || e.state === 'return' ? 1 : (e.state === 'idle' ? 0.3 : 0);
    e.flash = Math.max(0, e.flash - dt * 5);

    if (ud.animate) {
      e.pos.y = this.groundY(e.pos.x, e.pos.z, def);
      o.position.copy(e.pos);
      o.rotation.y = e.ry;
      if (e.shadow) e.shadow.position.set(e.pos.x, e.pos.y + 0.04, e.pos.z);
      const mv = e.frozen ? 0 : moving * (e.curSpeed > 0 ? 1 : 0.15);
      ud.animate(e, dt, t, { windup, striking, stagger: stag, moving: mv, running: e.running, speed: e.frozen ? 0 : e.curSpeed * (def.freq || 3), frozen: e.frozen });
      return;
    }

    if (def.fly) {
      const bob = Math.sin(t * 2 + e.phase) * 0.2;
      const targetY = e.state === 'chase' || e.state === 'windup' ? this.g.player.pos.y + 1.3 : this.groundY(e.pos.x, e.pos.z, def);
      e.pos.y += (targetY - e.pos.y) * Math.min(1, dt * 2);
      o.position.set(e.pos.x, e.pos.y + bob, e.pos.z);
      const pulse = 1 + Math.sin(t * 6 + e.phase) * 0.15 + windup * 0.9 + e.flash;
      ud.halo.scale.setScalar(1.8 * pulse);
      ud.tail.position.set(Math.sin(t * 3 + e.phase) * 0.35, -0.3, Math.cos(t * 2.5 + e.phase) * 0.35);
      return;
    }

    e.pos.y = this.groundY(e.pos.x, e.pos.z, def);
    o.position.copy(e.pos);
    o.rotation.y = e.ry;
    if (e.shadow) { e.shadow.position.set(e.pos.x, e.pos.y + 0.04, e.pos.z); }
    const s = (def.boss ? 1.55 : 1) * (1 + e.flash * 0.08);
    o.scale.setScalar(s);

    if (e.type === 'straw') {
      ud.eyes.visible = active;
      // scarecrows hop instead of walking
      const hop = moving > 0.5 ? Math.abs(Math.sin(t * 7 + e.phase)) * 0.35 : 0;
      o.position.y += hop;
      ud.arms.rotation.z = Math.sin(t * 7 + e.phase) * 0.15 * moving;
      ud.arms.rotation.x = -windup * 1.6 + striking * 0.9;
      o.rotation.x = -stag * 0.25;
    } else if (e.type === 'wolf') {
      const run = moving * (e.state === 'chase' ? 1 : 0.4);
      ud.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 14 + (i % 2 ? Math.PI : 0) + (i > 1 ? 0.6 : 0)) * 0.5 * run; });
      ud.head.rotation.x = windup * 0.35 - striking * 0.3;
      o.rotation.x = windup * 0.18 - striking * 0.2;
      o.position.y += striking * 0.4 - windup * 0.15;
    } else if (e.type === 'leech') {
      // rear back during windup, snap forward on the strike, sway otherwise
      const rear = windup - striking * 1.2 - stag * 0.4;
      const active01 = active ? 1 : 0;
      ud.segs.forEach((m, i) => {
        const k = i / (ud.segs.length - 1);
        const up = (1 - k) * (1.1 + rear * 0.7) * active01 - 0.25;
        const forward = (1 - k) * (0.4 - rear * 0.9) - k * 2.2;
        m.position.set(Math.sin(t * 2 + i * 0.8 + e.phase) * 0.15 * (1 - k), up + Math.sin(t * 2.4 + i) * 0.06, forward);
        m.rotation.x = -0.6 * (1 - k) * active01;
      });
    } else if (e.type === 'knight') {
      const sweep = striking ? -1.25 : e.state === 'recover' ? lerp(-1.25, -0.9, 1 - Math.max(0, e.t) / def.recover) : -0.9;
      ud.arm.rotation.x = e.state === 'windup' ? lerp(-0.9, 2.6, ease(windup)) : (striking ? sweep : e.state === 'recover' ? sweep : -0.9 + Math.sin(t * 1.5) * 0.04);
      ud.eye.scale.set(1, 1 + windup * 2, 1);
      o.rotation.x = stag * 0.15;
      o.position.y += moving * Math.abs(Math.sin(t * 4)) * 0.08;
    }
  }

  // ---------------------------------------------------------------- view model
  updateViewModel(dt) {
    const g = this.g, sw = g.view.userData.sword;
    let target = POSE.rest;
    if (this.swing) {
      const s = this.swing, k = s.t;
      if (s.kind === 'light') {
        if (k < 0.25) target = mixPose(POSE.rest, POSE.up, ease(k / 0.25));
        else if (k < 0.6) target = mixPose(POSE.up, POSE.end, ease((k - 0.25) / 0.35));
        else target = mixPose(POSE.end, POSE.rest, ease((k - 0.6) / 0.4));
      } else {
        if (k < 0.5) target = mixPose(POSE.charge, POSE.heavyEnd, ease(k / 0.5));
        else target = mixPose(POSE.heavyEnd, POSE.rest, ease((k - 0.5) / 0.5));
      }
      this.pose = target.slice();
    } else {
      if (this.blocking) target = POSE.guard;
      else if (this.charging) target = mixPose(POSE.rest, POSE.charge, clamp(this.charge / 0.38, 0, 1));
      const k = Math.min(1, dt * 14);
      this.pose = this.pose.map((v, i) => lerp(v, target[i], k));
    }
    const p = this.pose, bob = g.player.bob * 0.5, dip = this.dodgeT > 0 ? -0.08 : 0;
    const tremble = this.heavyReady && this.charging ? (Math.random() - 0.5) * 0.006 : 0;
    sw.position.set(p[0] + tremble, p[1] + bob + dip, p[2]);
    sw.rotation.set(p[3], p[4], p[5]);
  }
}
