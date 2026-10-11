// The Stone King's Colossus (ร่างศิลาของราชาหิน), chapter 2's last boss. The King's dream, with the
// crown gone and the stone in his mind, has raised a body of rock out of the earth east of the
// bridge: a torso as tall as a tower, waist-deep in the ground, two arms, a crowned head with no
// crown on it. Blades do nothing to it. Three seals glow in the stone and have to be broken:
//   one on the back of each hand    - reachable while that hand lies where it struck the ground
//   one on the brow                 - opens once both hands' seals are gone; run up an arm that lies
//                                     on the ground to the shoulders and strike it from there
// Its attacks:
//   slam     - a hand raised over a red circle, brought down; a wave rolls out; the hand stays down
//   sweep    - an arm dragged across the ground in front of it (jump or roll)
//   rocks    - stones fall on red circles around you
//   shrug    - stand on it too long and it throws you off
// Every seal broken makes it slower to lift its hands. With the last, it kneels (src/chapter2.js
// then lets you crown it).
//
// The arms are three points each (shoulder, elbow, hand) moved by hand here; the meshes are laid
// between them every frame, and while a hand lies on the ground the arm is a ramp the player can
// walk on (Player.surfaces).
import * as THREE from 'three';
import { part, mergeGeometries, clamp, lerp } from './util.js';
import { L } from './i18n.js';

const ROCK = new THREE.Color(0.66, 0.7, 0.86);
const MOSS = new THREE.Color(0.45, 0.55, 0.42);
const GOLD = new THREE.Color(1.6, 1.15, 0.45);
const C = (r, g, b) => new THREE.Color(r, g, b);
const ease = (x) => x * x * (3 - 2 * x);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

// local space: origin on the ground at its middle, facing +z, its right hand at +x
const SHOULDER = 7.6, SH_Y = 12.4, HEAD_Y = 17.2;
const REST = { e: V(10.5, 8.5, 4), h: V(9, 5.5, 9.5) };
const ARM_R = [1.5, 1.25];          // thickness of upper arm, forearm (the ramp is a little wider)

// ---------------------------------------------------------------- the body
export function createColossus(M) {
  const obj = new THREE.Group();
  obj.name = 'colossus';
  const ud = obj.userData;
  const rock = M.giantRock;
  // torso, shoulders, neck, head: one merged rock
  const g = [];
  g.push(part(new THREE.CylinderGeometry(5.2, 6.4, 18, 9, 3), ROCK, { pos: [0, 4, 0] }));
  g.push(part(new THREE.BoxGeometry(17, 3.6, 6.4), ROCK, { pos: [0, SH_Y - 0.6, 0] }));
  g.push(part(new THREE.CylinderGeometry(1.8, 2.3, 3, 8), ROCK, { pos: [0, SH_Y + 1.6, 0.4] }));
  for (const s of [-1, 1]) g.push(part(new THREE.SphereGeometry(2.4, 8, 6), ROCK, { pos: [s * SHOULDER, SH_Y, 0] }));
  // moss and rubble down the chest, as if it had lain under the forest
  for (let i = 0; i < 7; i++) g.push(part(new THREE.DodecahedronGeometry(1.1 + (i % 3) * 0.4, 0), i % 2 ? MOSS : ROCK, { pos: [Math.sin(i * 2.3) * 4.5, 1 + i * 1.4, 3.2 + Math.cos(i) * 0.6] }));
  const torso = new THREE.Mesh(mergeGeometries(g), rock);
  obj.add(torso);
  // the head: brow, nose, a beard of stone, and an empty crown-ring
  const head = new THREE.Group();
  head.position.set(0, HEAD_Y, 0.4);
  const hg = [
    part(new THREE.SphereGeometry(3.1, 10, 8), ROCK, { scale: [1, 1.15, 1] }),
    part(new THREE.BoxGeometry(4.6, 0.9, 1.2), ROCK, { pos: [0, 0.9, 2.6] }),                 // brow
    part(new THREE.BoxGeometry(0.9, 2.0, 1.4), ROCK, { pos: [0, -0.2, 3.0], rot: [0.2, 0, 0] }), // nose
    part(new THREE.ConeGeometry(2.4, 3.6, 7), ROCK, { pos: [0, -3.2, 1.6], rot: [Math.PI + 0.35, 0, 0] }), // beard
    part(new THREE.CylinderGeometry(2.9, 3.1, 0.8, 12, 1, true), C(0.5, 0.55, 0.45), { pos: [0, 3.1, 0] }), // the crown's empty seat
  ];
  head.add(new THREE.Mesh(mergeGeometries(hg), rock));
  // eyes: the gold of the King's dream
  const eyeMat = new THREE.SpriteMaterial({ color: GOLD, map: M.sprite.map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  for (const s of [-1, 1]) {
    const eye = new THREE.Sprite(eyeMat);
    eye.position.set(s * 1.25, 0.35, 2.9);
    eye.scale.setScalar(1.6);
    head.add(eye);
  }
  obj.add(head);
  // the arms: an upper arm and a forearm per side (unit cylinders stretched each frame), a hand
  const seg = part(new THREE.CylinderGeometry(1, 1, 1, 8, 1), ROCK);
  const handG = mergeGeometries([
    part(new THREE.BoxGeometry(3.6, 1.4, 3.2), ROCK, { pos: [0, 0, 0.4] }),
    ...[-1.2, -0.4, 0.4, 1.2].map((x) => part(new THREE.BoxGeometry(0.7, 0.8, 2.2), ROCK, { pos: [x, -0.3, 2.6], rot: [0.35, 0, 0] })),
    part(new THREE.BoxGeometry(0.8, 0.8, 1.8), ROCK, { pos: [-2.0, -0.2, 0.8], rot: [0, 0.6, 0] }),
  ]);
  ud.arms = [-1, 1].map((side) => {
    const upper = new THREE.Mesh(seg, rock), fore = new THREE.Mesh(seg, rock), hand = new THREE.Mesh(handG, rock);
    obj.add(upper, fore, hand);
    return {
      side, upper, fore, hand,
      s: V(side * SHOULDER, SH_Y, 0), e: REST.e.clone().setX(side * REST.e.x), h: REST.h.clone().setX(side * REST.h.x),
    };
  });
  ud.torso = torso;
  ud.head = head;
  ud.eyeMat = eyeMat;
  ud.animate = (e) => {
    // lay the arm pieces between their points
    for (const a of ud.arms) {
      place(a.upper, a.s, a.e, ARM_R[0]);
      place(a.fore, a.e, a.h, ARM_R[1]);
      a.hand.position.copy(a.h);
      const d = V(a.h.x - a.e.x, 0, a.h.z - a.e.z);
      a.hand.rotation.set(0, Math.atan2(d.x, d.z), 0);
    }
    const ai = e.ai || {};
    obj.position.y = e.pos.y + (ai.sink || 0);
    obj.rotation.y = e.ry;
    head.rotation.x = ai.bow || 0;
    eyeMat.opacity = 0.5 + 0.5 * (ai.glow ?? 1);
  };
  return obj;
}

const _q = new THREE.Quaternion(), _d = new THREE.Vector3();
function place(mesh, a, b, r) {
  _d.subVectors(b, a);
  const len = _d.length();
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, _d.normalize());
  mesh.scale.set(r, len + r * 0.6, r);
}

// a seal: a gold stone set in the rock, its light pulsing
export function createSeal(M) {
  const obj = new THREE.Group();
  obj.name = 'seal';
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), new THREE.MeshBasicMaterial({ color: GOLD, fog: false }));
  gem.scale.set(1, 1.3, 1);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ color: GOLD, map: M.sprite.map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.scale.setScalar(3.4);
  obj.add(gem, halo);
  obj.userData.animate = (e, dt, t) => {
    const lit = !e.invuln;
    gem.rotation.y += dt * (lit ? 2 : 0.4);
    halo.material.opacity = lit ? 0.75 + Math.sin(t * 6) * 0.2 + e.flash * 0.5 : 0.18;
    gem.material.color.copy(GOLD).multiplyScalar(lit ? 1 + e.flash : 0.35);
  };
  return obj;
}

// ---------------------------------------------------------------- telegraphs
const markMat = new THREE.MeshBasicMaterial({
  color: new THREE.Color(1.4, 0.18, 0.08), transparent: true, opacity: 0.7, depthWrite: false, fog: false,
  blending: THREE.AdditiveBlending, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4,
});
let rockGeom = null;

// ---------------------------------------------------------------- the brain
// e.ai.awake is set by the story; e.ai.seals are the three seal enemies it carries
export function updateColossus(e, dt, c, { playerOk }) {
  const g = c.g, p = g.player, scene = g.scene, ud = e.obj.userData, def = e.def;
  const ai = e.ai ||= { mode: 'buried', t: 0, cd: 2, atk: null, last: null, fx: [], sink: -26, onBody: 0, broken: 0 };
  e.curSpeed = 0;
  e.state = ai.mode === 'fight' || ai.mode === 'rise' ? 'chase' : 'idle';
  e.hp = Math.max(0, def.hp - (ai.broken || 0));
  const T = (x, z) => g.terrain.getHeight(x, z);
  const hit = (dmg, from) => c.takeHit(dmg, from, e, { unblockable: true });
  // local <-> world
  const cs = Math.cos(e.ry), sn = Math.sin(e.ry);
  const toWorld = (v, out = new THREE.Vector3()) => out.set(e.pos.x + v.x * cs + v.z * sn, e.pos.y + v.y + (ai.sink || 0), e.pos.z - v.x * sn + v.z * cs);
  const toLocal = (x, z) => { const dx = x - e.pos.x, dz = z - e.pos.z; return V(dx * cs - dz * sn, 0, dx * sn + dz * cs); };

  for (const f of ai.fx) f.update(dt);
  ai.fx = ai.fx.filter((f) => !f.done);

  const arms = ud.arms;
  if (!arms) return;
  const seals = ai.seals || [];
  // seals broken since the last frame
  const broken = seals.filter((s) => !s.alive || s.state === 'dying').length;
  if (broken > ai.broken) {
    ai.broken = broken;
    e.hp = def.hp - broken;
    e.flash = 1;
    p.shake = Math.max(p.shake, 0.5);
    g.audio.enemyCue?.('handking', 'aggro', e.pos);
    if (broken === 2) g.ui.banner(L('ตราที่หน้าผากเปิดออก', 'The Seal on the Brow Opens'), L('วิ่งขึ้นแขนที่ทุบพื้นไปถึงไหล่ แล้วตีที่หน้าผาก', 'Run up an arm that lies on the ground to the shoulders, and strike the brow'));
    else if (broken < 3) g.ui.combatText(L('ตราหินแตก!', 'A seal shatters!'), 'parry');
    if (broken >= 3) { ai.mode = 'kneel'; ai.t = 0; ai.atk = null; for (const a of arms) a.down = false; }
  }

  // the player standing on its body
  const onBody = playerOk && p.onGround && p.pos.y > T(p.pos.x, p.pos.z) + 1.5 && Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z) < 26;
  ai.onBody = onBody ? ai.onBody + dt : 0;

  switch (ai.mode) {
    case 'buried':
      if (ai.awake) {
        ai.mode = 'rise'; ai.t = 0;
        g.ui.banner(def.name, L('ลุกขึ้นจากแผ่นดิน', 'rises out of the earth'));
        g.audio.enemyCue?.('handking', 'rumble', e.pos);
        // its waist in the ground: you cannot walk through it
        g.collision.addCircle(e.pos.x, e.pos.z, 6.2, -1e9, e.pos.y + SH_Y - 1.5);
      }
      break;
    case 'rise': {
      ai.t += dt;
      const k = Math.min(1, ai.t / 6);
      ai.sink = -26 * (1 - ease(k));
      p.shake = Math.max(p.shake, 0.35 * (1 - k) + 0.05);
      if (Math.random() < dt * 14) { const at = toWorld(V((Math.random() - 0.5) * 14, 0, (Math.random() - 0.3) * 10)); at.y = e.pos.y + 0.5; g.particles.burst(at, 10, 6, 1.4); }
      if (k >= 1) { ai.mode = 'fight'; ai.sink = 0; ai.cd = 1.5; }
      break;
    }
    case 'kneel': {
      ai.t += dt;
      const k = Math.min(1, ai.t / 3);
      ai.sink = -7 * ease(k);
      ai.bow = 0.5 * ease(k);
      ai.glow = 1 - k * 0.6;
      for (const a of arms) {
        a.e.lerp(V(a.side * 9.5, 4, 8), Math.min(1, dt * 2));
        a.h.lerp(V(a.side * 6, 7, 14), Math.min(1, dt * 2));
      }
      e.knelt = k >= 1;
      break;
    }
    case 'fight': {
      if (!playerOk) { relax(dt); break; }
      // too long on its body: it shakes you off
      if (ai.onBody > (ai.broken >= 2 ? 9 : 5) && !ai.atk && !arms.some((a) => a.down)) { ai.atk = start('shrug'); break; }
      if (!ai.atk) {
        relax(dt);
        ai.cd -= dt;
        if (ai.cd <= 0) {
          const local = toLocal(p.pos.x, p.pos.z), d = Math.hypot(local.x, local.z);
          const opts = [];
          if (d < 30 && local.z > 0) opts.push('slam', 'slam', 'slam');
          if (d < 20 && local.z > 0) opts.push('sweep');
          opts.push('rocks');
          if (ai.broken >= 2) opts.push('slam', 'rocks');
          const pick = opts.filter((o) => o !== ai.last || o === 'slam');
          const kind = pick[Math.floor(Math.random() * pick.length)];
          ai.last = kind;
          ai.atk = start(kind);
        }
      } else {
        ai.atk.t += dt;
        ai.atk.tick(dt);
        if (ai.atk.t >= ai.atk.dur) { ai.atk = null; ai.cd = 0.9 + Math.random() * 0.8; }
      }
      break;
    }
  }

  // ---- the ramps: while a hand lies on the ground its arm can be walked; the shoulders always
  // (only floors at or a step above feetY count, so the upper arm's top never hides the forearm's)
  ai.surface = (x, z, feetY = Infinity) => {
    let best = -Infinity;
    const W = new THREE.Vector3(), Wb = new THREE.Vector3();
    const tryCap = (a, b, r, lift) => {
      toWorld(a, W); toWorld(b, Wb);
      const vx = Wb.x - W.x, vz = Wb.z - W.z, l2 = vx * vx + vz * vz || 1e-6;
      const t = clamp(((x - W.x) * vx + (z - W.z) * vz) / l2, 0, 1);
      const px = W.x + vx * t, pz = W.z + vz * t;
      if (Math.hypot(x - px, z - pz) > r) return;
      const y = W.y + (Wb.y - W.y) * t + lift;
      if (y <= feetY + 0.65) best = Math.max(best, y);
    };
    if (ai.mode !== 'fight' && ai.mode !== 'kneel') return best;
    // across the shoulders and up the neck
    tryCap(arms[0].s, arms[1].s, 2.6, 1.6);
    for (const a of arms) {
      if (!a.down && ai.mode !== 'kneel') continue;
      tryCap(a.h, a.e, ARM_R[1] + 0.9, ARM_R[1] * 0.9);
      tryCap(a.e, a.s, ARM_R[0] + 0.9, ARM_R[0] * 0.9);
      tryCap(a.h.clone().add(V(0, 0, -1.2)), a.h.clone().add(V(0, 0, 1.8)), 2.0, 0.7);
    }
    return best;
  };

  // seals ride the hands and the brow; a seal is struck only when it is in reach
  const sealAt = [arms[0].h.clone().add(V(0, 0.75, -0.2)), arms[1].h.clone().add(V(0, 0.75, -0.2)), V(0, HEAD_Y + 0.2, 3.2)];
  seals.forEach((s, i) => {
    if (!s.alive || s.state === 'dying') return;
    toWorld(sealAt[i], s.pos);
    const handDown = i < 2 && arms[i].down;
    s.invuln = ai.mode === 'buried' || ai.mode === 'rise' || (i < 2 ? !handDown : ai.broken < 2);
  });

  // the arms ease back toward rest when nothing is asked of them
  function relax(dt) {
    for (const a of arms) {
      if (a.down) continue;
      a.e.lerp(V(a.side * REST.e.x, REST.e.y + Math.sin(g.time * 0.7 + a.side) * 0.4, REST.e.z), Math.min(1, dt * 1.5));
      a.h.lerp(V(a.side * REST.h.x, REST.h.y + Math.sin(g.time * 0.9 + a.side) * 0.6, REST.h.z), Math.min(1, dt * 1.5));
    }
  }

  function start(kind) {
    const slow = 1 + ai.broken * 0.18;       // every seal broken leaves it slower
    const atk = { kind, t: 0, dur: 1, done: {}, tick: () => {} };
    if (kind === 'slam') {
      // the arm on the player's side
      const local = toLocal(p.pos.x, p.pos.z);
      const a = arms[local.x >= 0 ? 1 : 0];
      const reach = Math.hypot(local.x, local.z), maxR = 20;
      const k = reach > maxR ? maxR / reach : 1;
      const target = V(clamp(local.x * k, a.side > 0 ? 2 : -16, a.side > 0 ? 16 : -2), 0, clamp(local.z * k, 7, maxR));
      const tw = toWorld(target);
      tw.y = T(tw.x, tw.z);
      const W = 1.7 * slow, hold = (ai.broken >= 2 ? 7 : 4.5) * (1 + ai.broken * 0.1), lift = 1.3;
      atk.dur = W + 0.25 + hold + lift;
      const mark = new THREE.Mesh(new THREE.RingGeometry(3.7, 4.5, 32), markMat);
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(tw.x, tw.y + 0.12, tw.z);
      scene.add(mark);
      ai.fx.push({ t: 0, done: false, update(dt) { this.t += dt; mark.scale.setScalar(0.6 + 0.4 * Math.min(1, this.t / W)); if (this.t > W + 0.3) { scene.remove(mark); mark.geometry.dispose(); this.done = true; } } });
      g.audio.enemyCue?.('handking', 'windup', e.pos);
      const raisedE = V(a.side * 9, 19, 6), raisedH = V(target.x * 0.6, 25, target.z * 0.55);
      const downH = V(target.x, 0.9, target.z);
      const downE = V(lerp(a.s.x, target.x, 0.5), (SH_Y + 0.9) * 0.5 + 1.5, target.z * 0.5);
      atk.tick = (dt) => {
        const t = atk.t;
        if (t < W) {
          const k = ease(Math.min(1, t / (W * 0.8)));
          a.e.lerp(raisedE, Math.min(1, dt * 4) * k + 0.01);
          a.h.lerp(raisedH, Math.min(1, dt * 4) * k + 0.01);
          return;
        }
        if (t < W + 0.25) {
          const k = (t - W) / 0.25;
          a.h.lerpVectors(raisedH, downH, ease(k));
          a.e.lerpVectors(raisedE, downE, ease(k));
          return;
        }
        if (!atk.done.hit) {
          atk.done.hit = true;
          a.h.copy(downH); a.e.copy(downE); a.down = true;
          g.audio.slam(tw);
          g.particles.burst(tw.clone().setY(tw.y + 0.6), 50, 10, 2.6);
          p.shake = Math.max(p.shake, 0.7);
          if (Math.hypot(p.pos.x - tw.x, p.pos.z - tw.z) < 4.5 && p.pos.y - tw.y < 3) hit(34, tw);
          else wave(tw);
          if (seals[a.side > 0 ? 1 : 0]?.alive) g.ui.combatText(L('มือค้างอยู่ — ตีตราหลังมือ!', 'The hand is down — strike the seal on its back!'), 'parry');
          else if (ai.broken >= 2) g.ui.combatText(L('วิ่งขึ้นแขนไปที่ไหล่!', 'Run up the arm to the shoulders!'), 'parry');
          return;
        }
        if (t < W + 0.25 + hold) return;
        // up it comes: anyone still on that arm is thrown off
        if (a.down) {
          a.down = false;
          if (ai.onBody > 0 && !onShoulders()) throwOff(10);
        }
        relax(dt * 1.5);
      };
    } else if (kind === 'sweep') {
      const local = toLocal(p.pos.x, p.pos.z);
      const a = arms[local.x >= 0 ? 1 : 0];
      const W = 1.4 * slow, swing = 0.7;
      atk.dur = W + swing + 1.0;
      g.audio.enemyCue?.('handking', 'windup', e.pos);
      const from = -a.side, to = a.side;      // across the front, from the far side to its own
      atk.tick = () => {
        const t = atk.t;
        const arc = (u) => { const ang = u * 1.25; return V(Math.sin(ang) * 17, 1.4, Math.cos(ang) * 17); };
        if (t < W) {
          const k = ease(t / W);
          a.h.lerp(V(from * 14, 6 + 4 * k, 10), 0.08);
          a.e.lerp(V(from * 6 + a.side * 4, 10, 6), 0.08);
          return;
        }
        const k = Math.min(1, (t - W) / swing);
        const u = lerp(from, to, ease(k));
        a.h.copy(arc(u));
        a.e.copy(V(lerp(a.s.x, a.h.x, 0.5), 8, a.h.z * 0.5));
        if (!atk.done.hit && k > 0.15) {
          // the arm passes through the whole front at ground height: jump it or roll
          const lp = toLocal(p.pos.x, p.pos.z), d = Math.hypot(lp.x, lp.z);
          const ang = Math.atan2(lp.x, lp.z) / 1.25;
          if (d < 21 && d > 5 && lp.z > -2 && Math.abs(ang - u) < 0.18) {
            atk.done.hit = true;
            const airborne = p.pos.y - T(p.pos.x, p.pos.z) > 0.7;
            if (!airborne && c.iframes <= 0 && !onBody) { hit(26, toWorld(a.h)); p.vel.x += (p.pos.x - e.pos.x) * 0.3; p.vel.z += (p.pos.z - e.pos.z) * 0.3; }
          }
        }
        if (k >= 1 && !atk.done.end) { atk.done.end = true; g.audio.slam(toWorld(a.h)); }
      };
    } else if (kind === 'rocks') {
      const n = ai.broken >= 2 ? 8 : 5;
      atk.dur = 1.3 + n * 0.25 + 1.0;
      g.audio.enemyCue?.('handking', 'rumble', e.pos);
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2, r = i === 0 ? 0 : 3 + Math.random() * 7;
        ai.fx.push(fall(1.3 + i * 0.25, p.pos.x + Math.cos(ang) * r, p.pos.z + Math.sin(ang) * r));
      }
    } else if (kind === 'shrug') {
      atk.dur = 2.2;
      g.ui.combatText(L('ร่างศิลาสะบัดตัว!', 'The colossus shudders!'), 'bad');
      atk.tick = () => {
        p.shake = Math.max(p.shake, 0.4);
        if (atk.t > 1.0 && !atk.done.throw) { atk.done.throw = true; if (ai.onBody > 0) throwOff(16); }
      };
    }
    return atk;
  }

  function onShoulders() {
    const l = toLocal(p.pos.x, p.pos.z);
    return Math.abs(l.z) < 3.5 && Math.abs(l.x) < SHOULDER + 2 && p.pos.y > e.pos.y + SH_Y;
  }

  function throwOff(dmg) {
    const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1;
    p.vel.set(dx / d * 9, 7, dz / d * 9);
    p.onGround = false;
    if (c.iframes <= 0) hit(dmg, e.pos);
    ai.onBody = 0;
  }

  // the slam's wave
  function wave(at) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), markMat.clone());
    m.rotation.x = -Math.PI / 2;
    m.position.set(at.x, at.y + 0.15, at.z);
    scene.add(m);
    ai.fx.push({ r: 1, done: false, hit: false, update(dt) {
      this.r += dt * 12;
      m.scale.setScalar(this.r);
      m.material.opacity = 0.75 * (1 - this.r / 16);
      const d = Math.hypot(p.pos.x - at.x, p.pos.z - at.z);
      const grounded = p.onGround && p.pos.y - T(p.pos.x, p.pos.z) < 0.5;
      if (!this.hit && Math.abs(d - this.r) < 1.0 && grounded) { this.hit = true; if (c.iframes <= 0) hit(18, at); }
      if (this.r > 16) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); this.done = true; }
    } });
  }

  // a stone falling on a marked spot
  function fall(delay, x, z) {
    let m = null, stone = null;
    const y = T(x, z);
    return { t: 0, done: false, update(dt) {
      this.t += dt;
      if (!m && this.t > delay - 1.0) {
        m = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.3, 24), markMat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(x, y + 0.12, z);
        scene.add(m);
      }
      if (!stone && this.t > delay - 0.5) {
        rockGeom ||= part(new THREE.DodecahedronGeometry(1.3, 0), ROCK);
        stone = new THREE.Mesh(rockGeom, g.M.giantRock);
        scene.add(stone);
      }
      if (stone) {
        const k = Math.min(1, (this.t - (delay - 0.5)) / 0.5);
        stone.position.set(x, y + 22 * (1 - k * k) + 1, z);
        stone.rotation.x += dt * 5;
        if (k >= 1 && !this.hit) {
          this.hit = true;
          g.audio.slam({ x, y, z });
          g.particles.burst(new THREE.Vector3(x, y + 0.5, z), 16, 5, 1.0);
          if (Math.hypot(p.pos.x - x, p.pos.z - z) < 2.3 && Math.abs(p.pos.y - y) < 3 && c.iframes <= 0) hit(20, { x, z });
        }
      }
      if (this.t > delay + 0.6) { if (m) { scene.remove(m); m.geometry.dispose(); } if (stone) scene.remove(stone); this.done = true; }
    } };
  }
}
