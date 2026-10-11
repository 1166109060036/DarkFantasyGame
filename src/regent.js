// The Handless Regent (ผู้สำเร็จราชการไร้มือ), chapter 2's middle boss, on the throne terrace of
// Sky-Hung Castle. He cut off his own hands so the King of a Hundred Hands could never make them
// take the stone crown, bound a greatsword to the stumps with chain, and has kept the crown three
// hundred years, long past sense. He fights like a knight (src/heroes.js gives him a knight's body):
//   combo  - two or three cuts, stepping in with each   (block them, or parry one to stagger him)
//   leap   - a jump onto a marked circle, a small wave  (get out of the circle; after landing he is open)
//   spin   - the sword whirled all round him            (back off)
//   lash   - (half strength and under) the chain flung out along a red line (step off the line)
// At half strength he tears the chain loose, calls two of the Petrified and comes faster.
import * as THREE from 'three';
import { createHero, animateHero } from './heroes.js';
import { clamp, wrapAngle } from './util.js';
import { L } from './i18n.js';

const SCALE = 1.45;
const CLOAK = new THREE.Color(0.36, 0.08, 0.08);

export function createRegent(M) {
  const obj = new THREE.Group();
  obj.name = 'regent';
  const hero = createHero('wanderer', M, CLOAK);
  hero.scale.setScalar(SCALE);
  obj.add(hero);
  // the chain wound round his forearm and trailing from the hilt
  const link = new THREE.TorusGeometry(0.05, 0.016, 4, 6);
  const metal = M.metal;
  const chain = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(link, metal);
    m.position.set(0, -0.06 - i * 0.075, 0.02);
    m.rotation.y = (i % 2) * Math.PI / 2;
    chain.add(m);
  }
  hero.userData.weapon.add(chain);
  const ud = obj.userData;
  ud.hero = hero;
  ud.animate = (e, dt, t, st) => {
    const ai = e.ai || {};
    let action = 0;
    if (ai.cue) { action = ai.cue; ai.cue = 0; }
    else if (ai.guard) action = 3;
    hero.position.y = ai.air || 0;
    // he crumples onto his knees, then forward
    if (st.dying != null) {
      const k = clamp(st.dying, 0, 1);
      hero.rotation.x = k * 0.9;
      hero.position.y = -k * 0.6;
    } else hero.rotation.x = ai.mode === 'dormant' ? 0.25 : 0;
    // a whirl: the whole body turns
    hero.rotation.y = ai.spin || 0;
    animateHero(hero, dt, { speed: e.curSpeed || 0, action });
    // (no flash on the skin: the knight's materials are shared with the third-person hero)
  };
  return obj;
}

// ---------------------------------------------------------------- telegraphs
const markMat = new THREE.MeshBasicMaterial({
  color: new THREE.Color(1.4, 0.18, 0.08), transparent: true, opacity: 0.7, depthWrite: false, fog: false,
  blending: THREE.AdditiveBlending, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4,
});

function ring(scene, x, y, z, r) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.82, r, 28), markMat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y + 0.1, z);
  scene.add(m);
  return m;
}

function line(scene, x, y, z, ry, len, w) {
  const g = new THREE.PlaneGeometry(w, len);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, len / 2);
  const m = new THREE.Mesh(g, markMat);
  m.position.set(x, y + 0.1, z);
  m.rotation.y = ry;
  scene.add(m);
  return m;
}

// ---------------------------------------------------------------- the brain
const ARENA = 19;
export function updateRegent(e, dt, c, { dist, toPlayer, playerOk }) {
  const g = c.g, p = g.player, def = e.def, scene = g.scene;
  const ai = e.ai ||= { mode: 'dormant', t: 0, cd: 1.2, phase: 1, atk: null, last: null, away: 0, fx: [] };
  e.weakT = Math.max(0, (e.weakT || 0) - dt);
  e.curSpeed = 0;
  const turn = (rate) => { e.ry += clamp(wrapAngle(toPlayer - e.ry), -rate * dt, rate * dt); };
  const fwd = () => new THREE.Vector3(Math.sin(e.ry), 0, Math.cos(e.ry));
  const hit = (dmg, unblockable = false) => c.takeHit(dmg, e.pos, e, { unblockable });
  const floorY = (x, z) => c.groundY(x, z, def, e.pos.y);

  for (const f of ai.fx) f.update(dt);
  ai.fx = ai.fx.filter((f) => !f.done);

  switch (ai.mode) {
    case 'dormant':
      // kneeling before the throne until the story wakes him (src/chapter2.js)
      e.state = 'idle';
      if (ai.awake && playerOk) { ai.mode = 'roar'; ai.t = 2.2; ai.cue = 2; g.audio.enemyCue?.('armour', 'aggro', e.pos); g.ui.banner(def.name, L('ลุกขึ้นจากหน้าบัลลังก์', 'rises before the throne')); }
      break;
    case 'roar':
      e.state = 'chase';
      ai.t -= dt;
      turn(1.5);
      if (ai.t <= 0) { ai.mode = 'fight'; ai.cd = 0.6; }
      break;
    case 'reset': {
      e.state = 'return';
      const hx = e.home.x - e.pos.x, hz = e.home.z - e.pos.z, hd = Math.hypot(hx, hz);
      if (hd > 1) { e.ry = Math.atan2(hx, hz); e.curSpeed = 2.5; c.moveEnemy(e, hx / hd * 2.5 * dt, hz / hd * 2.5 * dt); }
      else { e.hp = def.hp; ai.mode = 'dormant'; ai.phase = 1; ai.awake = false; }
      break;
    }
    case 'fight': {
      e.state = 'chase';
      // you left the island (or fell): he goes back to kneel and mends
      const homeD = Math.hypot(p.pos.x - e.home.x, p.pos.z - e.home.z);
      ai.away = homeD > ARENA + 25 || !playerOk || p.pos.y < e.home.y - 8 ? ai.away + dt : 0;
      if (ai.away > 5) { ai.mode = 'reset'; ai.atk = null; ai.air = 0; ai.spin = 0; break; }
      if (ai.phase === 1 && e.hp < def.hp * 0.5) {
        ai.phase = 2; ai.atk = null; ai.mode = 'roar'; ai.t = 2.0; ai.cue = 2; ai.air = 0; ai.spin = 0;
        g.ui.combatText(L('เขากระชากโซ่ออกจากแขน!', 'He tears the chain loose!'), 'bad');
        g.audio.metal?.({ freq: 220, dur: 1.2, gain: 0.2, partials: [1, 2.7, 4.1], pos: e.pos });
        for (const k of [-1, 1]) {
          const a = e.ry + k * 1.6, x = e.home.x + Math.sin(a) * 9, z = e.home.z + Math.cos(a) * 9;
          const m = c.spawn('petrified', x, z, e.home.y);
          Object.assign(m, { summoned: true, activeOverride: 'always', state: 'chase', storyTag: 'regentguard' });
        }
        break;
      }
      const fast = ai.phase === 2 ? 0.8 : 1;
      if (e.state === 'stagger' || ai.stun > 0) {
        ai.stun -= dt;
        if (ai.stun > 0) break;
      }
      if (!ai.atk) {
        turn(3);
        ai.guard = dist < 5 && dist > 2.6;
        if (dist > 3.2) {
          const sp = ai.phase === 2 ? 4.2 : 3.2;
          e.curSpeed = sp;
          c.moveEnemy(e, Math.sin(e.ry) * sp * dt, Math.cos(e.ry) * sp * dt);
        }
        ai.cd -= dt;
        if (ai.cd <= 0) {
          const opts = [];
          if (dist < 4.5) opts.push('combo', 'combo', 'spin');
          if (dist > 5 && dist < 16) opts.push('leap', 'leap');
          if (ai.phase === 2 && dist > 4 && dist < 15) opts.push('lash', 'lash');
          if (dist >= 4.5 && dist <= 5) opts.push('combo');
          if (!opts.length) opts.push(dist < 4.5 ? 'combo' : 'leap');
          const pick = opts.filter((o) => o !== ai.last);
          const list = pick.length ? pick : opts;
          const kind = list[Math.floor(Math.random() * list.length)];
          ai.last = kind;
          ai.guard = false;
          ai.atk = start(kind, fast);
        }
      } else {
        const atk = ai.atk;
        atk.t += dt;
        atk.tick(dt);
        if (atk.t >= atk.dur) { ai.atk = null; ai.spin = 0; ai.air = 0; ai.cd = (ai.phase === 2 ? 0.55 : 1.0) * (0.8 + Math.random() * 0.4); }
      }
      const ox = e.pos.x - e.home.x, oz = e.pos.z - e.home.z, od = Math.hypot(ox, oz);
      if (od > ARENA) { e.pos.x = e.home.x + ox / od * ARENA; e.pos.z = e.home.z + oz / od * ARENA; }
      break;
    }
  }

  // a parried cut: he reels, open
  function parried() {
    ai.atk = null; ai.stun = 1.5; e.weakT = 1.5; ai.spin = 0;
    e.state = 'stagger';
    g.ui.combatText(L('เขาเสียหลัก! ตีเลย', 'He reels! Strike now'), 'parry');
  }

  function start(kind, fast) {
    const atk = { kind, t: 0, dur: 1, done: {}, tick: () => {} };
    if (kind === 'combo') {
      const n = ai.phase === 2 ? 3 : 2, W = 0.6 * fast, gap = 0.75 * fast;
      atk.dur = W + (n - 1) * gap + 0.9;
      atk.tick = (dt) => {
        for (let i = 0; i < n; i++) {
          const at = W + i * gap;
          if (atk.t >= at - 0.32 && !atk.done[`c${i}`]) { atk.done[`c${i}`] = true; ai.cue = i === n - 1 ? 2 : 1; g.audio.whoosh?.(i === n - 1); }
          if (atk.t < at) { if (atk.t > at - 0.4) turn(4); continue; }
          if (atk.done[`h${i}`]) continue;
          atk.done[`h${i}`] = true;
          // a step in with each cut
          c.moveEnemy(e, Math.sin(e.ry) * 1.2, Math.cos(e.ry) * 1.2);
          const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, d = Math.hypot(dx, dz);
          const off = Math.abs(wrapAngle(Math.atan2(dx, dz) - e.ry));
          if (d < 4.4 && off < 1.1 && Math.abs(p.pos.y - e.pos.y) < 2.5) {
            const r = hit(i === n - 1 ? 24 : 18);
            if (r === 'parried') { parried(); return; }
          }
        }
      };
    } else if (kind === 'leap') {
      const crouch = 0.55 * fast, fly = 0.85;
      const from = e.pos.clone();
      const to = new THREE.Vector3(p.pos.x + p.vel.x * 0.4, 0, p.pos.z + p.vel.z * 0.4);
      // never off the edge of the terrace
      const tx = to.x - e.home.x, tz = to.z - e.home.z, td = Math.hypot(tx, tz);
      if (td > ARENA - 1) { to.x = e.home.x + tx / td * (ARENA - 1); to.z = e.home.z + tz / td * (ARENA - 1); }
      to.y = floorY(to.x, to.z);
      let mark = null;
      atk.dur = crouch + fly + 1.7;
      atk.tick = () => {
        if (!mark && atk.t > 0.05) {
          mark = ring(scene, to.x, to.y, to.z, 3.4);
          ai.fx.push({ done: false, t: 0, update(dt) { this.t += dt; mark.scale.setScalar(0.6 + 0.4 * Math.min(1, this.t / (crouch + fly))); if (this.t > crouch + fly + 0.2) { scene.remove(mark); mark.geometry.dispose(); this.done = true; } } });
        }
        if (atk.t < crouch) { turn(5); return; }
        const k = Math.min(1, (atk.t - crouch) / fly);
        if (k < 1) {
          e.pos.x = from.x + (to.x - from.x) * k; e.pos.z = from.z + (to.z - from.z) * k;
          ai.air = Math.sin(Math.PI * k) * 5.5;
          if (k > 0.55 && !atk.done.cue) { atk.done.cue = true; ai.cue = 2; }
          return;
        }
        ai.air = 0;
        if (atk.done.land) return;
        atk.done.land = true;
        g.audio.slam(to);
        g.particles.burst(to.clone().setY(to.y + 0.4), 30, 7, 1.6);
        p.shake = Math.max(p.shake, 0.45);
        const d = Math.hypot(p.pos.x - to.x, p.pos.z - to.z);
        if (d < 3.4) hit(28, true);
        else wave(to);
        e.weakT = 1.6;
        g.ui.combatText(L('จังหวะโจมตี!', 'Strike now!'), 'parry');
      };
    } else if (kind === 'spin') {
      const W = 0.85 * fast;
      atk.dur = W + 0.75 + 0.8;
      atk.tick = () => {
        if (atk.t < W) { ai.guard = true; if (atk.t > W - 0.3 && !atk.done.cue) { atk.done.cue = true; g.audio.enemyCue?.('armour', 'windup', e.pos); } return; }
        ai.guard = false;
        const k = (atk.t - W) / 0.75;
        if (k <= 1) {
          ai.spin = k * Math.PI * 4;
          if (!atk.done.hit && k > 0.3) {
            atk.done.hit = true;
            g.audio.whoosh?.(true);
            const d = Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
            if (d < 4.9 && Math.abs(p.pos.y - e.pos.y) < 2.5) hit(24, true);
          }
        } else ai.spin = 0;
      };
    } else if (kind === 'lash') {
      const W = 1.0 * fast, len = 15, w = 1.8;
      let mark = null, ry = 0;
      atk.dur = W + 1.0;
      atk.tick = () => {
        if (!mark) {
          ry = toPlayer; e.ry = ry;
          mark = line(scene, e.pos.x, floorY(e.pos.x, e.pos.z), e.pos.z, ry, len, w);
          ai.fx.push({ done: false, t: 0, update(dt) { this.t += dt; if (this.t > W + 0.25) { scene.remove(mark); mark.geometry.dispose(); this.done = true; } } });
          g.audio.metal?.({ freq: 520, dur: 0.6, gain: 0.08, partials: [1, 2.3], pos: e.pos });
        }
        if (atk.t > W - 0.3 && !atk.done.cue) { atk.done.cue = true; ai.cue = 2; }
        if (atk.t >= W && !atk.done.hit) {
          atk.done.hit = true;
          g.audio.whoosh?.(true);
          const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z;
          const along = dx * Math.sin(ry) + dz * Math.cos(ry), across = Math.abs(dx * Math.cos(ry) - dz * Math.sin(ry));
          if (along > 0 && along < len && across < w / 2 + 0.4 && Math.abs(p.pos.y - e.pos.y) < 2.5) { hit(26, true); c.staggerT = Math.max(c.staggerT, 0.5); }
        }
      };
    }
    return atk;
  }

  // the landing's wave: a ring rolling out; touch it on the ground and it knocks you
  function wave(at) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 36), markMat.clone());
    m.rotation.x = -Math.PI / 2;
    m.position.set(at.x, at.y + 0.15, at.z);
    scene.add(m);
    ai.fx.push({ r: 1, done: false, hit: false, update(dt) {
      this.r += dt * 11;
      m.scale.setScalar(this.r);
      m.material.opacity = 0.7 * (1 - this.r / 9);
      const d = Math.hypot(p.pos.x - at.x, p.pos.z - at.z);
      const grounded = p.onGround;
      if (!this.hit && Math.abs(d - this.r) < 0.9 && grounded) { this.hit = true; if (c.iframes <= 0) hit(14, true); }
      if (this.r > 9) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); this.done = true; }
    } });
  }
}
