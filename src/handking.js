// The King of a Hundred Hands (ราชันร้อยกร): a ten-metre thing in a rotted royal cloak, a human face
// under a crown of thorns, and a dozen long arms where a chest should be. It squats among the roots
// of the hanging tree; the cocoons in the branches are what is left of the people it caught.
//
// It does not fight like the others (its own brain runs here, not the shared enemy AI):
//   sweep  - every arm swung across the ground in front of it         (back off, or roll through)
//   slam   - all arms brought down at once; a shockwave rolls outwards (jump or roll as it passes)
//   grab   - one arm grows and reaches for a marked circle             (get out of the circle)
//   hands  - its hands burst out of the earth under red circles        (keep moving)
// Under half its strength it roars, the cocoons split and crawlers drop out, and it comes faster.
// After a slam, or a grab that misses, it is stuck a moment: that is when to hit it (×1.5).
//
// Model: "Psx hands monster (ps2 style)" by petya-petyavich (https://sketchfab.com/petya-petyavich),
// CC-BY-4.0. No animation in the file; every pose is set on its 85 bones here.
import * as THREE from 'three';
import { Rig, whenLoaded } from './rigpose.js';
import { ps2ify } from './ps2.js';
import { part, mergeGeometries, lerp, clamp, wrapAngle } from './util.js';
import { L } from './i18n.js';

const SCALE = 9;                       // the model is 1.1 units tall
// its arms, root bone first (bones are matched by the digits in their names)
const ARMS = [
  ['018_013', '019_014', '020_015'], ['047_016', '048_017', '049_018', '050_019'], ['053_020', '054_021'],
  ['025_023', '026_024', '027_025'], ['040_026', '041_027', '042_028'], ['051_010', '052_011'],
  ['021_030', '022_031', '023_032', '024_033'], ['032_034', '033_035', '034_036', '035_037'],
  ['036_038', '037_039', '038_00', '039_040'], ['043_041', '044_042', '045_043', '046_044'],
  ['028_055', '029_056', '030_057', '031_058'], ['059_059', '060_060', '061_061', '062_062'],
];
const GRAB_ARM = 0;                    // the long upper arm that reaches
const CLOAK = new Set([2, 5, 11]);     // these "arms" are the cloak's hanging folds: they only sway
const LEGS = [['001_047', '002_048', '003_049', '004_050'], ['005_051', '006_052', '007_053', '008_054']];
const B = { hips: '_01', spine: '009_02', chest: '010_03', head: '011_04' };
ARMS.forEach((a, i) => a.forEach((n, j) => { B[`a${i}_${j}`] = n; }));
LEGS.forEach((a, i) => a.forEach((n, j) => { B[`l${i}_${j}`] = n; }));
const RIG = new Rig('assets/enemies/hands.glb', B, { tint: new THREE.Color(1.25, 1.1, 1.05), ascii: true });
export const loadHandKingAsset = () => RIG.load();
const rot = (bone, x, y, z) => RIG.rot(bone, x, y, z);

const ease = (x) => x * x * (3 - 2 * x);
const C = (r, g, b) => new THREE.Color(r, g, b);

// ---------------------------------------------------------------- the body
export function createHandKing(M) {
  const obj = new THREE.Group();
  obj.name = 'handking';
  const ud = obj.userData;
  const inner = new THREE.Group();     // the model faces +x; turn it to face +z like everything else
  inner.rotation.y = -Math.PI / 2;
  inner.scale.setScalar(SCALE);
  obj.add(inner);
  whenLoaded(RIG, () => {
    const { body, bones, mats } = RIG.instance();
    inner.add(body);
    Object.assign(ud, { bones, mats });
  });

  ud.animate = (e, dt, t, st) => {
    const bn = ud.bones;
    if (!bn) return;
    for (const m of ud.mats) m.emissive.setRGB(e.flash * 0.5, e.flash * 0.15, e.flash * 0.1);
    const ai = e.ai || { mode: 'dormant' }, atk = ai.atk;
    // the pose is a handful of numbers, eased toward whatever it is doing
    const want = { raise: 0.1, swing: 0, lean: 0.12, spread: 0, writhe: 0.12, reach: 1, reachRaise: 0, head: 0 };
    if (ai.mode === 'dormant') Object.assign(want, { raise: -0.55, lean: 0.5, writhe: 0.06, head: 0.3 });
    else if (ai.mode === 'roar') Object.assign(want, { raise: 0.7, lean: -0.3, spread: 0.9, writhe: 0.3, head: -0.5 });
    else if (ai.mode === 'reset') Object.assign(want, { raise: -0.2, lean: 0.3 });
    let snap = 6;
    if (atk) {
      const k = atk.t, W = atk.W;
      const w = ease(clamp(k / W, 0, 1)), after = k - W;
      if (atk.kind === 'sweep') {
        const s = clamp(after / 0.28, 0, 1);
        want.swing = atk.side * (0.95 * w - 2.1 * s);
        want.raise = 0.15 - 0.35 * s; want.lean = 0.15 + 0.25 * s;
        snap = after > 0 ? 30 : 6;
      } else if (atk.kind === 'slam') {
        if (after < 0) { want.raise = 1.35 * w; want.lean = -0.3 * w; want.head = -0.3 * w; }
        else { want.raise = -0.8; want.lean = 0.6; want.writhe = 0.04; snap = after < 0.25 ? 40 : 4; }
      } else if (atk.kind === 'grab') {
        want.reach = 1 + 1.6 * w;
        if (after < 0) { want.reachRaise = 0.9 * w; want.lean = -0.1 * w; }
        else { want.reach = 2.6; want.reachRaise = -0.75; want.lean = 0.4; snap = after < 0.2 ? 40 : 5; }
      } else if (atk.kind === 'hands') {
        want.raise = lerp(0.2, -1.15, w); want.lean = lerp(0.15, 0.65, w); want.writhe = 0.05;
      }
    }
    const p = ud.p ||= { ...want };
    const kf = Math.min(1, dt * snap);
    for (const key in want) p[key] += (want[key] - p[key]) * kf;

    // arms: every one writhes on its own; the attack moves them together
    ARMS.forEach((arm, i) => {
      const side = i % 2 ? 1 : -1;
      arm.forEach((_, j) => {
        const bone = bn[`a${i}_${j}`];
        const wr = p.writhe * (j === 0 ? 0.6 : 1);
        let x = Math.sin(t * 1.3 + i * 0.9 + j * 1.7) * wr * 0.6;
        let y = Math.cos(t * 1.1 + i * 1.3 + j * 0.8) * wr;
        let z = Math.sin(t * 1.7 + i * 1.9 + j * 0.6) * wr;
        if (CLOAK.has(i)) { rot(bone, x * 0.3, y * 0.3, z * 0.3 - p.lean * 0.3); return; }
        if (j === 0) {
          y += p.swing + p.spread * side;
          z += i === GRAB_ARM ? p.reachRaise + p.raise * 0.3 : p.raise;
        } else if (j === arm.length - 1) z -= 0.25 + Math.sin(t * 3 + i) * 0.15 * p.writhe;     // hands clutching
        rot(bone, x, y, z);
      });
    });
    const g0 = bn[`a${GRAB_ARM}_0`];
    if (g0) g0.scale.setScalar(p.reach);
    // body and head (forward is model +x, so leaning forward is a turn about -z)
    rot(bn.hips, 0, 0, 0);
    rot(bn.spine, 0, 0, -p.lean * 0.5 + Math.sin(t * 0.9) * 0.03);
    rot(bn.chest, 0, Math.sin(t * 0.6) * 0.05, -p.lean * 0.5);
    rot(bn.head, Math.sin(t * 0.7) * 0.08, 0, p.head + p.lean * 0.4);
    // legs: long, slow strides
    const spd = e.curSpeed || 0;
    ud.ph = (ud.ph || 0) + dt * spd * 0.9;
    const a = Math.min(1, spd / 2), sw = Math.sin(ud.ph);
    LEGS.forEach((leg, i) => {
      const s = (i ? -1 : 1) * sw * 0.32 * a;
      rot(bn[`l${i}_0`], 0, 0, s - p.lean * 0.3);
      rot(bn[`l${i}_1`], 0, 0, Math.max(0, (i ? 1 : -1) * Math.cos(ud.ph)) * -0.35 * a + p.lean * 0.4);
    });
    // it falls on its face
    if (st.dying != null) {
      const k = clamp(st.dying, 0, 1);
      inner.rotation.z = -ease(k) * 1.25;
    } else inner.rotation.z = 0;
    e.obj.position.y += Math.abs(sw) * 0.25 * a;
  };
  return obj;
}

// ---------------------------------------------------------------- telegraphs and ground hands
const markMat = new THREE.MeshBasicMaterial({
  color: new THREE.Color(1.4, 0.18, 0.08), transparent: true, opacity: 0.7, depthWrite: false, fog: false,
  blending: THREE.AdditiveBlending, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4,
});
const waveMat = markMat.clone();
waveMat.color = new THREE.Color(1.2, 0.55, 0.25);
let handGeom = null, handMat = null;
function groundHand() {
  if (!handGeom) {
    const skin = C(0.42, 0.3, 0.26);
    const parts = [
      part(new THREE.CylinderGeometry(0.28, 0.4, 2.2, 6), skin, { pos: [0, 1.1, 0] }),
      part(new THREE.BoxGeometry(0.8, 0.75, 0.3), skin, { pos: [0, 2.5, 0] }),
      part(new THREE.BoxGeometry(0.16, 0.6, 0.16), skin, { pos: [0.45, 2.3, 0.1], rot: [0, 0, -0.7] }),
    ];
    for (let f = 0; f < 4; f++) parts.push(part(new THREE.BoxGeometry(0.15, 0.85, 0.15), skin, { pos: [-0.3 + f * 0.2, 3.2, 0.12], rot: [0.5, 0, (f - 1.5) * 0.12] }));
    handGeom = mergeGeometries(parts);
    handMat = ps2ify(new THREE.MeshLambertMaterial({ vertexColors: true }));
  }
  return new THREE.Mesh(handGeom, handMat);
}

function marker(scene, x, y, z, r) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.82, r, 28), markMat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y + 0.08, z);
  scene.add(m);
  return m;
}

// ---------------------------------------------------------------- the brain
const WAKE = 26, ARENA = 34;
const ATK = {
  sweep: { W: 1.15, dur: 2.3 },
  slam: { W: 1.5, dur: 3.7 },
  grab: { W: 1.35, dur: 3.0 },
  hands: { W: 0.9, dur: 0 },          // its length depends on how many hands come up
};

export function updateHandKing(e, dt, c, { dist, toPlayer, playerOk }) {
  const g = c.g, p = g.player, def = e.def, scene = g.scene;
  const ai = e.ai ||= { mode: 'dormant', t: 0, cd: 1.5, phase: 1, atk: null, last: null, away: 0, fx: [] };
  const T = (x, z) => g.terrain.getHeight(x, z);
  const hit = (dmg, from, unblockable = false) => c.takeHit(dmg, from, null, { unblockable });
  e.weakT = Math.max(0, (e.weakT || 0) - dt);
  e.curSpeed = 0;
  const homeD = Math.hypot(p.pos.x - e.home.x, p.pos.z - e.home.z);
  const turn = (rate) => { e.ry += clamp(wrapAngle(toPlayer - e.ry), -rate * dt, rate * dt); };

  // telegraphs, waves and hands out of the ground keep running whatever it is doing
  for (const f of ai.fx) f.update(dt);
  ai.fx = ai.fx.filter((f) => !f.done);

  switch (ai.mode) {
    case 'dormant':
      e.state = 'idle';
      // sealed in roots until the story comes for him (src/quests.js)
      if (g.quests && !g.quests.bossReady()) {
        if (playerOk && dist < WAKE && g.time > (ai.warnAt || 0)) {
          ai.warnAt = g.time + 25;
          g.ui.toast(g.quests.huntOpen ? L('รากไม้หนาพันรอบร่างนั้นไว้... ต้องหาทางตัดรังไหมก่อน', 'Thick roots coil about the thing... the cocoon must be cut first') : L('บางสิ่งหมอบอยู่ใต้รากไม้... ยังไม่ถึงเวลาของมัน', 'Something crouches beneath the roots... its hour has not yet come'));
        }
        break;
      }
      if (playerOk && (dist < WAKE || e.hp < def.hp)) {
        ai.mode = 'roar'; ai.t = 2.6;
        g.audio.enemyCue('handking', 'aggro', e.pos);
        g.ui.banner(def.name, L('ตื่นขึ้นแล้ว', 'has awoken'));
      }
      break;
    case 'roar':
      e.state = 'chase';
      ai.t -= dt;
      p.shake = Math.max(p.shake, 0.25);
      turn(0.8);
      if (ai.t <= 0) { ai.mode = 'fight'; ai.cd = 0.8; }
      break;
    case 'reset': {
      e.state = 'return';
      const hx = e.home.x - e.pos.x, hz = e.home.z - e.pos.z, hd = Math.hypot(hx, hz);
      e.ry += clamp(wrapAngle(Math.atan2(hx, hz) - e.ry), -dt, dt);
      if (hd > 1.5) { e.curSpeed = 2.4; c.moveEnemy(e, hx / hd * 2.4 * dt, hz / hd * 2.4 * dt); }
      else { e.hp = def.hp; ai.mode = 'dormant'; ai.phase = 1; }
      if (playerOk && dist < WAKE * 0.6) { ai.mode = 'fight'; ai.cd = 1; }
      break;
    }
    case 'fight': {
      e.state = 'chase';
      // you left its clearing (or fell): it goes back to its roots and mends
      ai.away = homeD > ARENA + 22 || !playerOk ? ai.away + dt : 0;
      if (ai.away > 6) { ai.mode = 'reset'; ai.atk = null; break; }
      // second wind
      if (ai.phase === 1 && e.hp < def.hp * 0.5) {
        ai.phase = 2; ai.atk = null; ai.mode = 'roar'; ai.t = 2.4;
        g.audio.enemyCue('handking', 'aggro', e.pos);
        g.ui.combatText(L('รังไหมแตกออก!', 'The cocoon splits!'), 'bad');
        // the finger of grain: the cocoons are mostly empty now
        for (let i = 0; i < (g.quests?.has('grain') ? 1 : 3); i++) {
          const a = i * 2.1, x = e.home.x + Math.cos(a) * 9, z = e.home.z + Math.sin(a) * 9;
          const m = c.spawn('crawler', x, z);
          Object.assign(m, { summoned: true, activeOverride: 'always', state: 'chase' });
        }
        break;
      }
      const fast = ai.phase === 2 ? 0.8 : 1;
      if (!ai.atk) {
        turn(1.3);
        if (dist > 7.5) {
          const sp = ai.phase === 2 ? 3.3 : 2.5;
          e.curSpeed = sp;
          c.moveEnemy(e, Math.sin(e.ry) * sp * dt, Math.cos(e.ry) * sp * dt);
        }
        ai.cd -= dt;
        if (ai.cd <= 0) {
          const opts = [];
          if (dist < 12.5) opts.push('sweep', 'sweep', 'slam');
          if (dist > 6 && dist < 24) opts.push('grab', 'grab');
          if (ai.phase === 2 || dist > 13) opts.push('hands');
          if (ai.phase === 2 && dist < 12.5) opts.push('slam');
          const pick = opts.filter((o) => o !== ai.last);
          const kind = (pick.length ? pick : opts.length ? opts : ['hands'])[Math.floor(Math.random() * (pick.length || opts.length || 1))];
          ai.last = kind;
          ai.atk = startAttack(kind, e, c, fast);
        }
      } else {
        const atk = ai.atk;
        atk.t += dt;
        if (atk.t < atk.W) turn(atk.kind === 'sweep' ? 0.9 : 0.5);
        atk.tick?.(dt);
        if (atk.t >= atk.dur) { ai.atk = null; ai.cd = (ai.phase === 2 ? 0.7 : 1.4) * (0.8 + Math.random() * 0.4); }
      }
      // it never leaves its clearing
      const ox = e.pos.x - e.home.x, oz = e.pos.z - e.home.z, od = Math.hypot(ox, oz);
      if (od > ARENA) { e.pos.x = e.home.x + ox / od * ARENA; e.pos.z = e.home.z + oz / od * ARENA; }
      break;
    }
  }

  function startAttack(kind, e, c, fast) {
    // the finger of wind: its grabbing hand is slower to come down
    const base = ATK[kind], W = base.W * fast + (kind === 'grab' && g.quests?.has('wind') ? 0.4 : 0);
    const fwd = () => new THREE.Vector3(Math.sin(e.ry), 0, Math.cos(e.ry));
    const atk = { kind, t: 0, W, dur: base.dur * fast, side: Math.random() < 0.5 ? -1 : 1, done: {} };
    g.audio.enemyCue('handking', 'windup', e.pos);
    if (kind === 'sweep') {
      atk.tick = () => {
        if (atk.t >= W && !atk.done.hit) {
          atk.done.hit = true;
          g.audio.whoosh?.(true);
          const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, d = Math.hypot(dx, dz);
          const off = Math.abs(wrapAngle(Math.atan2(dx, dz) - e.ry));
          if (d < 13 && off < 1.45 && p.pos.y - e.pos.y < 4) hit(30, e.pos);
        }
      };
    } else if (kind === 'slam') {
      atk.tick = () => {
        if (atk.t >= W && !atk.done.hit) {
          atk.done.hit = true;
          const at = e.pos.clone().addScaledVector(fwd(), 6.5);
          at.y = T(at.x, at.z);
          g.audio.slam(at);
          g.particles.burst(at.clone().setY(at.y + 0.5), 40, 9, 2.2);
          p.shake = Math.max(p.shake, 0.6);
          const direct = Math.hypot(p.pos.x - at.x, p.pos.z - at.z) < 4.5;
          if (direct) hit(42, at, true);
          ai.fx.push(shockwave(at, direct));                // the wave does not hit you twice
          e.weakT = 2.0;                                   // its arms are in the earth: now
          g.ui.combatText(L('จังหวะโจมตี!', 'Strike now!'), 'parry');
        }
      };
    } else if (kind === 'grab') {
      // aim where you will be, and mark it
      const tx = p.pos.x + p.vel.x * 0.6, tz = p.pos.z + p.vel.z * 0.6;
      const mk = telegraph(tx, tz, 3.2, W);
      ai.fx.push(mk);
      atk.tick = () => {
        if (atk.t >= W && !atk.done.hit) {
          atk.done.hit = true;
          g.audio.slam({ x: tx, y: T(tx, tz), z: tz });
          g.particles.burst(new THREE.Vector3(tx, T(tx, tz) + 0.5, tz), 24, 6, 1.4);
          if (Math.hypot(p.pos.x - tx, p.pos.z - tz) < 3.2 && c.iframes <= 0) {
            hit(44, { x: tx, z: tz }, true);
            g.ui.combatText(L('ถูกคว้า!', 'Seized!'), 'bad');
            c.staggerT = Math.max(c.staggerT, 1.0);
            p.vel.y = 7; p.onGround = false;
          } else { e.weakT = 1.6; g.ui.combatText(L('จังหวะโจมตี!', 'Strike now!'), 'parry'); }
        }
      };
    } else if (kind === 'hands') {
      const n = ai.phase === 2 ? 7 : 4;
      atk.dur = W + n * 0.3 + 1.6;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, r = i === 0 ? 0 : 2.5 + Math.random() * 5;
        ai.fx.push(eruption(W + i * 0.3, () => [p.pos.x + Math.cos(a) * r, p.pos.z + Math.sin(a) * r]));
      }
    }
    return atk;
  }

  // a red ring on the ground that fills in, then goes
  function telegraph(x, z, r, life) {
    const m = marker(scene, x, T(x, z), z, r);
    const f = { t: 0, done: false, update(dt) {
      f.t += dt;
      m.material = markMat;
      m.scale.setScalar(0.6 + 0.4 * Math.min(1, f.t / life));
      if (f.t > life + 0.3) { scene.remove(m); m.geometry.dispose(); f.done = true; }
    } };
    return f;
  }

  // the slam's wave: a ring rolling outwards; touch it on the ground and it throws you
  function shockwave(at, already = false) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), waveMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(at.x, at.y + 0.15, at.z);
    scene.add(m);
    const f = { r: 1, done: false, hit: already, update(dt) {
      f.r += dt * (g.quests?.has('water') ? 9 : 13);      // the finger of water: the wave rolls slower
      m.scale.setScalar(f.r);
      waveMat.opacity = 0.8 * (1 - f.r / 20);
      const d = Math.hypot(p.pos.x - at.x, p.pos.z - at.z);
      const grounded = p.pos.y - T(p.pos.x, p.pos.z) < 0.35;
      if (!f.hit && Math.abs(d - f.r) < 1.1 && grounded) { f.hit = true; if (c.iframes <= 0) hit(22, at, true); }
      if (f.r > 20) { scene.remove(m); m.geometry.dispose(); f.done = true; }
    } };
    return f;
  }

  // a marked spot, then a hand bursting out of it
  function eruption(delay, where) {
    let m = null, hand = null, x = 0, z = 0, y = 0;
    const f = { t: 0, done: false, update(dt) {
      f.t += dt;
      if (!m && f.t >= delay) { [x, z] = where(); y = T(x, z); m = marker(scene, x, y, z, 2.3); g.audio.enemyCue('handking', 'rumble', { x, y, z }); }
      const since = f.t - delay - 1.0;
      if (m && since >= 0 && !hand) {
        hand = groundHand();
        hand.position.set(x, y - 3.6, z);
        hand.rotation.y = Math.random() * 6;
        scene.add(hand);
        g.audio.slam({ x, y, z });
        g.particles.burst(new THREE.Vector3(x, y + 0.3, z), 14, 5, 0.9);
        if (Math.hypot(p.pos.x - x, p.pos.z - z) < 2.3 && c.iframes <= 0) hit(24, { x, z }, true);
      }
      if (hand) {
        const rise = since < 0.15 ? since / 0.15 : since < 1.0 ? 1 : 1 - (since - 1.0) / 0.5;
        hand.position.y = y - 3.6 + 3.6 * clamp(rise, 0, 1);
        if (since > 1.5) { scene.remove(hand); scene.remove(m); m.geometry.dispose(); f.done = true; }
      }
    } };
    return f;
  }
}
