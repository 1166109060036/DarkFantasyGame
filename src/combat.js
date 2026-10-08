// Combat: player stamina, light/heavy attacks, block & parry, dodge with i-frames,
// and every enemy's AI (idle -> chase -> telegraphed windup -> strike -> recover).
import * as THREE from 'three';
import { createWisp, createStrawman, createWolf, createLeech, createStoneKnight, blobShadow } from './characters.js';
import {
  WISP_SPAWNS, STRAW_SPAWNS, WOLF_PACKS, LEECH_SPAWNS, KNIGHT_POS, GAUNT_SPAWNS, GAUNT_DAY_SPAWNS, CRAWLER_SPAWNS,
  WEEPER_SPAWNS, BRUTE_SPAWNS, EXTRA_WOLF_PACKS, EXTRA_STRAW_SPAWNS, EXTRA_LEECH_SPAWNS, WILD_SPAWNS, HOLLOW_SPAWNS, ARMOUR_SPAWNS,
} from './layout.js';
import { createGaunt, createCrawler, createWeeper, createBrute } from './gaunts.js';
import { createHollow } from './hollow.js';
import { createArmour } from './armour.js';
import { clamp, lerp, wrapAngle } from './util.js';
import { rng } from './noise.js';
import { SWORD_POSE } from './classes.js';
import { ARENA_CAMPS, ARENA_BASES } from './arena.js';

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
  // the Lost (src/hollow.js): people still, of a kind; they guard, combine blows and sidestep
  hollow: { name: 'ผู้หลงทาง', hp: 6, speed: 2.3, sprint: 7, range: 2.0, windup: 0.5, recover: 0.9, damage: 13, aggro: 18, leash: 50, radius: 0.4, height: 1.95, weight: 1, active: 'always', guard: true, combo: 2, coins: [4, 8], respawn: 180, cull: 95, freq: 1 },
  // empty plate armour (src/armour.js): light blows glance off; a parried swing leaves it open
  armour: { name: 'ชุดเกราะไร้ร่าง', hp: 12, speed: 1.6, range: 2.9, windup: 0.95, recover: 1.2, damage: 24, aggro: 16, leash: 40, radius: 0.5, height: 2.0, weight: 3, active: 'always', armour: true, slamEvery: 3, coins: [12, 20], respawn: 400, cull: 100, freq: 1, elite: true },
  knight: { name: 'อัศวินหินผู้เฝ้าสะพาน', hp: 32, speed: 2.5, range: 3.8, windup: 1.05, recover: 1.4, damage: 28, aggro: 22, leash: 40, radius: 1.1, height: 4.2, weight: 6, active: 'always', boss: true, slamEvery: 3, coins: [60, 60] },
};

const COST = { light: 10, heavy: 26, dodge: 22 };
const PALE_ONES = new Set(['gaunt', 'crawler', 'weeper', 'brute']);
const PARRY_WINDOW = 0.3;
const CULL = 115;
const V = new THREE.Vector3();

// view-model poses come from the class kit (src/classes.js)
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
    this.pose = SWORD_POSE.rest.slice();
    this.swordMul = 1;
    this.bossDefeated = false;
    this.target = null;
    this.targetT = 0;
    this.hintShown = false;
    this.enemies = [];
    this.boss = null;
    if (game.arena) this.spawnArena();
    else this.spawnAll();
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
    HOLLOW_SPAWNS.valley.forEach(([x, z]) => this.spawn('hollow', x, z));
    ARMOUR_SPAWNS.valley.forEach(([x, z]) => this.spawn('armour', x, z));
    this.boss = this.spawn('knight', KNIGHT_POS.x, KNIGHT_POS.z);
    this.boss.ry = -Math.PI / 2;
    this.spawnWild(r);
  }

  // the wild beyond the valley (layout.js WILD_SPAWNS): same creatures, farther from home
  spawnWild(r) {
    const W = WILD_SPAWNS, T = this.g.terrain;
    W.wolf.forEach(([x, z, n]) => { for (let i = 0; i < n; i++) this.spawn('wolf', x + (r() - 0.5) * 10, z + (r() - 0.5) * 10); });
    W.gaunt.forEach(([x, z]) => this.spawn('gaunt', x, z));
    W.gauntDay.forEach(([x, z]) => { this.spawn('gaunt', x, z).activeOverride = 'always'; });
    for (const type of ['crawler', 'weeper', 'straw', 'brute', 'wisp']) W[type].forEach(([x, z]) => this.spawn(type, x, z));
    W.leech.forEach(([x, z]) => { if (T.getHeight(x, z) < -0.3) this.spawn('leech', x, z); });
    HOLLOW_SPAWNS.wild.forEach(([x, z]) => this.spawn('hollow', x, z));
    ARMOUR_SPAWNS.wild.forEach(([x, z]) => this.spawn('armour', x, z));
  }

  // the online arena: packs at the four camps, and a few strays in the woods. They hunt day and
  // night, come back sooner, and pay two souls apiece.
  spawnArena() {
    const T = this.g.terrain, r = rng(31);
    const wild = (type, x, z) => {
      const e = this.spawn(type, x, z);
      e.activeOverride = 'always';
      e.def = { ...e.def, respawn: 75 };
      e.soul = 2;
      return e;
    };
    for (const c of ARENA_CAMPS) c.types.forEach((type, i) => wild(type, c.x + Math.cos(i * 2.1) * 4, c.z + Math.sin(i * 2.1) * 4));
    for (let n = 0, tries = 0; n < 10 && tries < 400; tries++) {
      const a = r() * Math.PI * 2, d = 45 + r() * 120, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (T.roadAt(x, z) > 0.01 || ARENA_BASES.some(([bx, bz]) => Math.hypot(x - bx, z - bz) < 60) || ARENA_CAMPS.some((c) => Math.hypot(x - c.x, z - c.z) < 30)) continue;
      if (n % 2) wild('gaunt', x, z);
      else { wild('wolf', x, z); wild('wolf', x + 2, z + 1.5); }
      n++;
    }
  }

  spawn(type, x, z) {
    const def = ENEMY_TYPES[type], M = this.g.M;
    const obj = { wisp: createWisp, straw: createStrawman, wolf: createWolf, leech: createLeech, knight: createStoneKnight, gaunt: createGaunt, crawler: createCrawler, weeper: createWeeper, brute: createBrute, hollow: createHollow, armour: createArmour }[type](M);
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
    if (when === 'never') return false;
    if (when === 'bloodmoon') return !!this.g.events?.bloodMoon && this.g.dayNight.isNight;
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
    if (this.bossDefeated && this.boss) {
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
      e.dots = null;
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
      speedMul: (this.blocking && !this.g.kit.speedBoost ? 0.45 : this.charging ? 0.6 : 1) * this.g.kit.speedMul,
      sprintOk: !this.exhausted && !this.blocking,
      dodgeVel: this.dodgeT > 0 ? this.dodgeVel : null,
      locked: this.staggerT > 0,
      ride: this.g.mount?.ridden ? this.g.mount.mods() : null,
    };
  }

  updatePlayer(dt, input, frozen) {
    const g = this.g, p = g.player, t = g.time;
    this.iframes = Math.max(0, this.iframes - dt);
    this.dodgeT = Math.max(0, this.dodgeT - dt);
    this.staggerT = Math.max(0, this.staggerT - dt);
    this.targetT = Math.max(0, this.targetT - dt);

    if (p.sprinting && g.kit.sprintCost) this.spend(13 * dt * g.kit.sprintCost);
    if (t - this.lastUse > 0.9) this.stamina = Math.min(this.maxStamina, this.stamina + (this.blocking ? 12 : 32) * (g.buffs.tonic > 0 ? 2 : 1) * dt);
    if (this.exhausted && this.stamina > 35) this.exhausted = false;

    if (frozen) { this.blocking = false; this.charging = false; return; }
    const kit = g.kit;
    kit.update(dt, input);
    if (input.consume('skill')) kit.skill();

    // block (hold right mouse); the first PARRY_WINDOW seconds of a block parry
    const riding = !!g.mount?.ridden;     // in the saddle, right mouse is the cockroach's bite
    const wantBlock = !riding && kit.blockMode !== 'none' && input.blockHeld && !this.swing && this.dodgeT <= 0 && this.staggerT <= 0 && this.stamina > 0;
    if (wantBlock && !this.blocking) this.blockStart = t;
    this.blocking = wantBlock;

    // dodge
    if (input.consume('dodge') && !riding && this.dodgeT <= 0 && this.staggerT <= 0 && !this.swing) {
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
    if (input.consume('attack') && !this.swing && this.dodgeT <= 0 && this.staggerT <= 0 && !kit.noAttack) {
      this.charging = true;
      this.charge = 0;
      this.heavyReady = false;
      kit.onPress?.();
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

  // the kit decides what a blow is: timing, cost, reach, arc (or a spin / ground slam), damage
  startSwing(kind) {
    if (this.stamina <= 0) { this.say('เหนื่อย!'); return; }
    const spec = this.g.kit.swing(kind);
    if (!spec) return;                       // handled by the kit (e.g. a thrown leech)
    this.swing = { kind, t: 0, dur: spec.dur, hit: false, spec };
    this.swingN = (this.swingN || 0) + 1;       // online: other players see each new blow
    this.spend(spec.cost);
    this.g.kit.swingSound(kind);
  }

  advanceSwing(dt) {
    const s = this.swing;
    s.t += dt / s.dur;
    if (!s.hit && s.t > s.spec.hitAt) {
      s.hit = true;
      this.playerStrike(s.kind, s.spec);
    }
    if (s.t >= 1) this.swing = null;
  }

  playerStrike(kind, spec) {
    const g = this.g, cam = g.camera.position, p = g.player, dir = p.forwardVec;
    g.kit.onStrike(kind, spec);
    g.moba?.strike(spec, cam, dir);
    g.critters?.strike(spec, cam, dir);
    // a ground slam lands on a circle in front of you
    const ax = spec.aoe ? p.pos.x - Math.sin(p.yaw) * spec.aoe.dist : 0, az = spec.aoe ? p.pos.z - Math.cos(p.yaw) * spec.aoe.dist : 0;
    for (const e of this.enemies) {
      if (!e.alive || e.state === 'dying' || !e.obj.visible) continue;
      V.copy(e.pos);
      if (!e.def.fly) V.y += e.def.height * 0.5;
      V.sub(cam);
      const d = V.length();
      if (spec.aoe) {
        if (Math.hypot(e.pos.x - ax, e.pos.z - az) > spec.aoe.r + e.def.radius || Math.abs(V.y) > 3) continue;
      } else {
        if (d > spec.range + e.def.radius) continue;
        if (spec.radial) { if (Math.abs(V.y) > 2.5) continue; }
        else if (V.clone().normalize().dot(dir) < spec.arc && d > e.def.radius + 0.8) continue;
      }
      V.normalize();
      this.damageEnemy(e, spec.heavy, V, spec.dmg);
      if (e.alive) g.kit.onHit(e, kind);
    }
  }

  damageEnemy(e, heavy, dir, base = heavy ? 3 : 1) {
    const g = this.g, def = e.def;
    let dmg = base * g.damageMul * g.kit.targetMul(e);
    if (e.moba) {
      // an online creep: your own are safe, everyone else's hit goes to the host
      if (e.moba.owner === g.moba.me) return;
      g.moba.hit('c', e.moba.id, dmg);
      e.flash = 1;
      g.audio.hit(heavy, e.type, e.pos);
      g.particles.burst(e.pos.clone().setY(e.pos.y + def.height * 0.55), heavy ? 10 : 5, 3, 0.5);
      this.hitStop = Math.max(this.hitStop, heavy ? 0.06 : 0.025);
      this.target = e; this.targetT = 3;
      return;
    }
    // the Lost turn a light blow from the front with their guard, and answer it at once;
    // a heavy blow breaks the guard and staggers them
    if (def.guard && e.guarding) {
      const front = (Math.sin(e.ry) * -dir.x + Math.cos(e.ry) * -dir.z) / (Math.hypot(dir.x, dir.z) || 1) > 0.35;
      if (front && !heavy) {
        e.guardT = 0.5;
        e.state = 'windup'; e.t = def.windup * 0.6;
        g.audio.block();
        g.particles.burst(e.pos.clone().setY(e.pos.y + 1.4), 5, 2.5, 0.3);
        g.player.vel.x += dir.x * 2.5; g.player.vel.z += dir.z * 2.5;
        if ((this.guardHint = (this.guardHint || 0) + 1) <= 3) g.ui.combatText('มันปัดป้อง! ฟันหนักหรืออ้อมไปฟันด้านข้าง', 'bad');
        else g.ui.combatText('ปัดป้อง', 'bad');
        this.target = e; this.targetT = 3;
        return;
      }
      if (front && heavy) { e.state = 'stagger'; e.t = 1.0; e.guarding = false; e.comboN = 0; g.ui.combatText('ทำลายการ์ด!', 'parry'); }
    }
    // plate: light blows glance off (a third gets through), unless it has just been parried open
    if (def.armour) {
      if (e.exposedT > 0) { dmg *= 2; g.ui.combatText('ช่องโหว่! ×2', 'parry'); }
      else if (!heavy) {
        dmg *= 0.33;
        g.audio.metal?.({ freq: 900 + Math.random() * 300, dur: 0.5, gain: 0.08, partials: [1, 2.7, 5.1], pos: e.pos });
        if ((this.armourHint = (this.armourHint || 0) + 1) <= 3) g.ui.combatText('เกราะหนา! ฟันหนัก หรือปัดแล้วฟันตอนเซ', 'bad');
      }
    }
    // a stone-skinned bounty shrugs off light blows
    if (e.named?.affix === 'stone' && !heavy) { dmg *= 0.25; g.ui.combatText('ฟันไม่เข้า! ต้องฟันหนัก', 'info'); }
    // an oiled blade sets foes alight
    if (g.buffs.oil > 0) { e.dots = e.dots || {}; e.dots.burn = { dps: 0.25, t: 2.5 }; }
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
    // ordinary foes flinch (a light hit interrupts their windup); the knight only staggers to heavy blows briefly;
    // empty plate does not flinch at all, except to a heavy blow outside its swing
    if (def.armour) { if (heavy && e.state !== 'windup' && e.state !== 'strike') { e.state = 'stagger'; e.t = 0.5; } }
    else if (!def.boss && (!def.named || heavy)) { e.state = 'stagger'; e.t = heavy ? 0.65 : 0.3; }
    else if (heavy && e.state !== 'windup') { e.state = 'stagger'; e.t = 0.3; }
    if (e.state === 'idle' || e.state === 'return') e.state = 'chase';
  }

  kill(e) {
    const g = this.g, def = e.def;
    if (e.moba) { if (g.moba?.host) g.moba.killCreep(e, g.moba.me); return; }   // online creeps die on the host
    e.state = 'dying';
    e.t = e.obj.userData.animate ? 2.6 : 0.9;
    g.audio.enemyDie(e.type, e.pos);
    g.kit.onKill(e);
    g.contracts?.onKill(e);
    if (g.moba) g.moba.earn({ soul: e.soul ?? (def.elite || def.named ? 4 : 1), xp: 5 }, def.name);
    else g.gainXP(Math.round(def.hp * 3 + (def.elite ? 20 : 0) + (def.named ? 60 : 0) + (def.boss ? 120 : 0)));
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
    let dmg = def.damage * (slam ? 1.3 : 1) * (PALE_ONES.has(e.type) ? g.events?.enemyDamageMul ?? 1 : 1) * (e.dmgMul ?? 1);
    // the coffin is a wall: it stops anything from the front, even a ground slam, but cannot parry
    if (this.blocking && facingEnemy && g.kit.blockMode === 'wall') {
      this.spend(dmg * 0.6);
      g.audio.block();
      g.audio.thump({ freq: 80, dur: 0.3, gain: 0.3 });
      p.shake = Math.max(p.shake, 0.15);
      p.vel.x += dx / d * 2; p.vel.z += dz / d * 2;
      g.kit.onWallBlock(e, dmg);
      if (this.stamina > 0) return;
      dmg *= 0.5; this.staggerT = 0.8; this.blocking = false; g.ui.combatText('การ์ดแตก!', 'bad');
    } else if (this.blocking && facingEnemy && !slam) {
      if (g.time - this.blockStart < PARRY_WINDOW + g.kit.parryBonus) {
        e.state = 'stagger';
        e.t = def.boss ? 1.9 : 1.4;
        if (def.armour) e.exposedT = 1.6;
        e.vel.set(-dx, 0, -dz).normalize().multiplyScalar(4 / def.weight);
        this.stamina = Math.min(this.maxStamina, this.stamina + 15);
        this.hitStop = 0.14;
        p.shake = Math.max(p.shake, 0.22);
        g.audio.parry();
        g.particles.burst(g.camera.position.clone().addScaledVector(p.forwardVec, 0.9), 16, 4, 0.35);
        g.ui.combatText('ปัดสำเร็จ!', 'parry');
        g.hud.grin();
        g.kit.onParry(e);
        return;
      }
      this.spend(dmg * 1.2);
      g.audio.block();
      p.shake = Math.max(p.shake, 0.12);
      p.vel.x += dx / d * 3; p.vel.z += dz / d * 3;
      if (this.stamina > 0) dmg *= 0.12;
      else { dmg *= 0.6; this.staggerT = 0.7; this.blocking = false; g.ui.combatText('การ์ดแตก!', 'bad'); }
    }
    dmg = g.kit.onHurt(dmg * g.armorMul * g.kit.armorMul, e);
    p.hurt(dmg, g.time);
    g.mount?.onRiderHurt(dmg);
    // the status-bar face flinches toward whoever landed the blow
    const rightDot = (-dx * Math.cos(p.yaw) + dz * Math.sin(p.yaw)) / Math.max(d, 1e-3);
    g.hud.hurt(Math.abs(rightDot) < 0.35 ? 0 : Math.sign(rightDot), dmg);
    g.hurtFlash = 1;
    g.audio.hurt();
    p.shake = Math.max(p.shake, 0.25);
    if (d > 1e-3) { p.vel.x += dx / d * 5; p.vel.z += dz / d * 5; }
  }

  // a blow from something that is not a local enemy (online creeps, towers, kings, other heroes):
  // dodging, parrying and blocking work just as they do against the wild
  takeHit(dmg, from, by = null) {
    const g = this.g, p = g.player;
    if (p.hp <= 0 || g.state !== 'play') return;
    if (this.iframes > 0) { this.say('หลบ!'); return; }
    const dx = p.pos.x - from.x, dz = p.pos.z - from.z, d = Math.max(Math.hypot(dx, dz), 1e-3);
    const facing = (-dx * -Math.sin(p.yaw) - dz * -Math.cos(p.yaw)) / d > 0.3;
    if (this.blocking && facing) {
      if (g.kit.blockMode === 'wall') {
        this.spend(dmg * 0.6); g.audio.block();
        g.kit.onWallBlock(null, dmg, by);
        if (this.stamina > 0) return;
        dmg *= 0.5; this.staggerT = 0.8; this.blocking = false;
      } else if (g.time - this.blockStart < PARRY_WINDOW + g.kit.parryBonus) {
        this.stamina = Math.min(this.maxStamina, this.stamina + 15);
        g.audio.parry(); g.ui.combatText('ปัดสำเร็จ!', 'parry'); g.hud.grin();
        g.kit.onParry(null, by);
        return;
      } else {
        this.spend(dmg * 1.2); g.audio.block();
        if (this.stamina > 0) dmg *= 0.12;
        else { dmg *= 0.6; this.staggerT = 0.7; this.blocking = false; g.ui.combatText('การ์ดแตก!', 'bad'); }
      }
    }
    dmg = g.kit.onHurt(dmg * g.armorMul * g.kit.armorMul, null);
    p.hurt(dmg, g.time);
    g.mount?.onRiderHurt(dmg);
    this.lastHitBy = by;
    const rightDot = (-dx * Math.cos(p.yaw) + dz * Math.sin(p.yaw)) / d;
    g.hud.hurt(Math.abs(rightDot) < 0.35 ? 0 : Math.sign(rightDot), dmg);
    g.hurtFlash = 1;
    g.audio.hurt();
    p.shake = Math.max(p.shake, 0.25);
    p.vel.x += dx / d * 4; p.vel.z += dz / d * 4;
  }

  say(text) { this.g.ui.combatText(text, 'info'); }

  // ---------------------------------------------------------------- enemy AI
  updateEnemies(dt, inPlay) {
    const g = this.g, p = g.player, t = g.time;
    const playerOk = inPlay && p.hp > 0;
    let bossEngaged = false, engaged = 0, namedEngaged = null;

    for (const e of this.enemies) {
      const def = e.def;
      if (!e.alive) {
        e.respawn -= dt * (g.events?.respawnMul ?? 1);
        if (!def.boss && e.respawn <= 0 && e.home.distanceTo(p.pos) > 45) {
          Object.assign(e, { alive: true, hp: def.hp, state: 'idle', t: 2, dots: null, corpseHold: 0 });
          e.pos.copy(e.home);
          e.obj.scale.setScalar(def.scale ?? (def.boss ? 1.55 : 1));
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
      // online creeps keep marching out of sight; the match host drives them, not this loop
      if ((hidden || far) && !e.moba) {
        // out of sight: anything mid-death finishes dying now (otherwise it would never respawn)
        if (e.state === 'dying') { e.alive = false; e.respawn = def.respawn || 1e9; if (e.shadow) e.shadow.visible = false; }
        else e.state = 'idle';
        continue;
      }

      if (e.state === 'dying') {
        // the undertaker's corpses lie still until they are taken (or left too long)
        if (e.corpseHold > 0) {
          e.corpseHold -= dt;
          const hold = e.obj.userData.animate ? 1.0 : 0.9;
          if (e.t < hold) e.t = hold;
          if (!e.obj.userData.animate) e.obj.rotation.z = Math.min(1.4, (e.obj.rotation.z || 0) + dt * 4);
        }
        e.t -= dt;
        const k = Math.max(0, e.t / 0.9);
        if (e.obj.userData.animate) {
          // rigged bodies crumple, lie still a moment, then sink into the earth
          e.obj.userData.animate(e, dt, t, { dying: Math.min(1, (2.6 - e.t) / 1.0), moving: 0, speed: 0 });
          e.obj.position.y = e.pos.y - Math.max(0, 0.8 - e.t) * 1.6;
        } else {
          e.obj.scale.setScalar((def.scale ?? (def.boss ? 1.55 : 1)) * (0.2 + 0.8 * k));
          e.obj.position.y = e.pos.y - (1 - k) * (def.fly ? 0 : 0.8);
        }
        if (e.t <= 0) {
          e.alive = false;
          e.obj.visible = false;
          e.obj.rotation.z = 0;
          if (e.shadow) e.shadow.visible = false;
          e.respawn = def.respawn || 1e9;
        }
        continue;
      }

      if (e.moba) {
        if (e.obj.visible) this.animate(e, dt, t, true);
        else e.pos.y = this.groundY(e.pos.x, e.pos.z, def);
        if (e.moba.owner !== g.moba?.me && Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < 25) engaged++;
        // your bleeding and burning tick on the host
        if (e.dots && e.moba.owner !== g.moba?.me) {
          for (const k in e.dots) {
            const dot = e.dots[k];
            if ((dot.t -= dt) <= 0) { delete e.dots[k]; continue; }
            e.dotAcc = (e.dotAcc || 0) + dot.dps * dt;
          }
          if (e.dotAcc >= 0.25) { g.moba.hit('c', e.moba.id, e.dotAcc); e.dotAcc = 0; }
        }
        continue;
      }

      // burning, bleeding
      if (e.dots) {
        for (const k in e.dots) {
          const dot = e.dots[k];
          if ((dot.t -= dt) <= 0) { delete e.dots[k]; continue; }
          e.hp -= dot.dps * dt;
        }
        if (e.hp <= 0) { this.kill(e); continue; }
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
      if (e.named) g.contracts?.updateNamed(e, dt, dist);
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
          if (active && playerOk && dist < def.aggro * (g.events?.aggroMul ?? 1) && !g.kit.hidden) {
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
          if (!playerOk || !active || fromHome > def.leash || (g.kit.hidden && dist > 2.5)) { e.state = 'return'; break; }
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
          if (active && playerOk && dist < def.aggro * 0.6 && fromHome < def.leash * 0.7 && !g.kit.hidden) e.state = 'chase';
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
            // (or, for those that fight in combinations, throws the next blow straight away)
            if (e.state === 'strike' && def.combo && (e.comboN = (e.comboN || 0) + 1) % def.combo) { e.state = 'windup'; e.t = def.windup * 0.55; }
            else if (e.state === 'strike') { e.state = 'recover'; e.t = def.recover; }
          }
          break;
        case 'recover':
        case 'stagger':
          if (e.t <= 0) e.state = playerOk && active ? 'chase' : 'return';
          break;
      }
      if (def.armour) e.exposedT = (e.exposedT || 0) - dt;
      if (def.guard) {
        // fists up once you are close; a sidestep, now and then, when you start a swing
        e.guarding = e.state === 'chase' && dist < 4.5;
        e.guardT = (e.guardT || 0) - dt;
        e.sideT = (e.sideT || 0) - dt;
        if (this.swing && e.lastSwing !== this.swing) {
          e.lastSwing = this.swing;
          if (e.guarding && dist < 3.4 && e.sideT <= 0 && Math.random() < 0.3) {
            const side = Math.random() < 0.5 ? -1 : 1;
            e.vel.set(Math.cos(e.ry) * side * 6, 0, -Math.sin(e.ry) * side * 6);
            e.sideT = 2.5;
          }
        }
      }
      const fighting = e.state === 'chase' || e.state === 'windup' || e.state === 'strike' || e.state === 'recover' || e.state === 'stagger';
      if (fighting && def.boss) bossEngaged = true;
      if (fighting && e.named && dist < 30) namedEngaged = e;
      // a weeper creeping up unseen must not give herself away by starting the battle music
      if (fighting && dist < 35 && !(def.stalker && e.state === 'chase' && dist > 5)) engaged += def.weight > 2 ? 2 : 1;

      // facing (a watched stalker doesn't even turn)
      const goal = turn ? toPlayer : moveAngle;
      const rate = turn || 6;
      if (!e.frozen) e.ry += clamp(wrapAngle(goal - e.ry), -rate * dt, rate * dt);
      if (PALE_ONES.has(e.type)) moveSpeed *= g.events?.enemySpeedMul ?? 1;
      moveSpeed *= e.spdMul ?? 1;
      e.curSpeed = moveSpeed;
      // movement (aim may differ from facing for a frame or two; that's fine)
      if (moveSpeed > 0) this.moveEnemy(e, Math.sin(moveAngle) * moveSpeed * dt, Math.cos(moveAngle) * moveSpeed * dt);
      // keep out of the player
      const minD = def.radius + 0.45;
      if (dist < minD && dist > 1e-3) { e.pos.x -= dx / dist * (minD - dist); e.pos.z -= dz / dist * (minD - dist); }

      this.animate(e, dt, t, active);
    }
    // the boss bar also names a bounty target once it is on you
    g.ui.setBoss(bossEngaged && this.boss?.alive ? this.boss : namedEngaged);
    // the score follows the fight: how many things are on you, and whether it is the knight
    this.engaged = engaged;
    this.bossEngaged = bossEngaged && !!this.boss?.alive;
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
    this.g.kit.constrain?.(e);
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
    const s = (def.scale ?? (def.boss ? 1.55 : 1)) * (1 + e.flash * 0.08);
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
    const g = this.g, sw = g.kit.weapon, POSE = g.kit.poses;
    if (!sw) return;
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
      if (this.blocking || g.kit.snuffed) target = POSE.guard;
      else if (this.charging) target = mixPose(POSE.rest, POSE.charge, clamp(this.charge / 0.38, 0, 1));
      const k = Math.min(1, dt * 14);
      this.pose = this.pose.map((v, i) => lerp(v, target[i], k));
    }
    const p = this.pose, bob = g.player.bob * 0.5, dip = this.dodgeT > 0 ? -0.08 : 0;
    const tremble = this.heavyReady && this.charging ? (Math.random() - 0.5) * 0.006 : 0;
    sw.position.set(p[0] + tremble, p[1] + bob + dip, p[2]);
    sw.rotation.set(p[3], p[4], p[5]);
    g.kit.animateWeapon(sw, dt);
  }
}
