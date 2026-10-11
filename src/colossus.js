// The Stone King's Colossus (ร่างศิลาของราชาหิน), chapter 2's last boss. With the crown gone and the
// stone in his mind, the King himself rises where his head lay sleeping: a body of rock as tall as
// the castle, waist-deep in the earth, the head as big as the one that slept there. Blades do
// nothing to the stone. Three seals glow in it and have to be broken:
//   one on the back of each hand  - a slammed hand stays on the ground a while; its fingers are
//                                   ramps: run up them onto the back of the hand and strike
//   one on the brow               - once both hands' seals are gone the King bows, his brow to the
//                                   earth; climb his beard and strike it before he rises again
// Its attacks:
//   slam     - a hand raised over a red circle and brought down; a wave rolls out; the hand stays
//   quake    - both fists pound the earth before it; rings roll out (jump them, or roll)
//   rocks    - stones fall on red circles around you
//   shrug    - stand on it too long and it throws you off
// Every seal broken makes it slower. With the last it bows and stays bowed (src/chapter2.js then
// lets you crown it).
//
// Everything here is in the model's own units (tools/build-colossus.py) and the whole body is shown
// SCALE times larger. The arms are three points each (shoulder, elbow, hand) solved every frame with
// bones of fixed length; while a hand lies on the ground, its fingers and the back of the hand are
// floors the player can walk on (Player.surfaces), and so is the beard while the King bows.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { part, mergeGeometries, clamp, lerp } from './util.js';
import { ps2ify } from './ps2.js';
import { L } from './i18n.js';

export const SCALE = 8;
const ROCK = new THREE.Color(0.66, 0.7, 0.86);
const GOLD = new THREE.Color(1.6, 1.15, 0.45);
const ease = (x) => x * x * (3 - 2 * x);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

// model space: origin on the ground at its middle, facing +z, its right hand at +x
const SHOULDER = 7.6, SH_Y = 12.4, HEAD_Y = 17.2;
const REST = { e: V(10.5, 8.5, 4), h: V(9, 5.5, 9.5) };
const UPPER = 10, FORE = 11;          // the arm's bones, as built by tools/build-colossus.py
const BOW = 1.25, NOD = -0.3;         // the bow: the body tipped forward, the beard on the ground, the brow ~30 m up

// ---------------------------------------------------------------- the model
let asset = null;
export function loadColossusAsset() {
  asset ||= new GLTFLoader().loadAsync('assets/enemies/colossus.glb').then((gltf) => {
    const parts = {};
    let stone = null, glow = null;
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      if (o.name === 'glow') {
        glow ||= new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
        parts.glow = { geometry: o.geometry, material: glow };
        return;
      }
      if (!stone) {
        const map = o.material.map;
        map.magFilter = THREE.NearestFilter; map.colorSpace = THREE.NoColorSpace;
        stone = ps2ify(new THREE.MeshLambertMaterial({ map, vertexColors: true, color: new THREE.Color(1.25, 1.22, 1.2) }), { fogScale: 0.35 });
      }
      parts[o.name] = { geometry: o.geometry, material: stone };
    });
    return parts;
  }).catch(() => null);
  return asset;
}

export function createColossus(M) {
  const obj = new THREE.Group();
  obj.name = 'colossus';
  obj.scale.setScalar(SCALE);
  const ud = obj.userData;
  const rock = M.giantRock;
  // the body tips forward about its waist (where it meets the earth) to bow
  const body = new THREE.Group();
  obj.add(body);
  // a rough stand-in until the model has loaded
  const torso = new THREE.Mesh(mergeGeometries([
    part(new THREE.CylinderGeometry(5.2, 6.4, 18, 8, 2), ROCK, { pos: [0, 4, 0] }),
    part(new THREE.BoxGeometry(17, 3.6, 6.4), ROCK, { pos: [0, SH_Y - 0.6, 0] }),
  ]), rock);
  body.add(torso);
  const head = new THREE.Group();
  head.position.set(0, HEAD_Y, 0.4);
  const headMesh = new THREE.Mesh(part(new THREE.SphereGeometry(3.1, 8, 6), ROCK), rock);
  head.add(headMesh);
  const eyeMat = new THREE.SpriteMaterial({ color: GOLD, map: M.sprite.map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  for (const s of [-1, 1]) {
    const eye = new THREE.Sprite(eyeMat);
    eye.position.set(s * 1.25, 0.35, 2.85);
    eye.scale.setScalar(1.5);
    head.add(eye);
  }
  body.add(head);
  const seg = part(new THREE.CylinderGeometry(1, 1, 1, 7, 1).translate(0, 0.5, 0), ROCK);
  ud.arms = [-1, 1].map((side) => {
    const anchor = new THREE.Object3D();
    anchor.position.set(side * SHOULDER, SH_Y, 0);
    body.add(anchor);
    const upper = new THREE.Mesh(seg, rock), fore = new THREE.Mesh(seg, rock), joint = new THREE.Mesh(part(new THREE.SphereGeometry(1.6, 7, 5), ROCK), rock);
    const hand = new THREE.Mesh(part(new THREE.BoxGeometry(3.6, 1.4, 3.6).translate(0, 0, 1), ROCK), rock);
    obj.add(upper, fore, joint, hand);
    return { side, anchor, upper, fore, joint, hand, s: anchor.position.clone(), e: REST.e.clone().setX(side * REST.e.x), h: REST.h.clone().setX(side * REST.h.x), yaw: 0 };
  });
  Object.assign(ud, { body, head, torso, eyeMat });
  loadColossusAsset().then((parts) => {
    if (!parts) return;
    const swap = (mesh, p) => { mesh.geometry = p.geometry; mesh.material = p.material; mesh.scale.setScalar(1); };
    swap(torso, parts.torso);
    swap(headMesh, parts.head);
    for (const a of ud.arms) {
      swap(a.upper, parts.arm_upper);
      swap(a.fore, parts.arm_fore);
      swap(a.joint, parts.joint);
      swap(a.hand, a.side > 0 ? parts.hand_r : parts.hand_l);
    }
    body.add(new THREE.Mesh(parts.glow.geometry, parts.glow.material));
    ud.modeled = true;
  });
  ud.animate = (e) => {
    const ai = e.ai || {};
    obj.position.y = e.pos.y + (ai.sink || 0) * SCALE;
    obj.rotation.y = e.ry;
    for (const a of ud.arms) {
      bone(a.upper, a.s, a.e, ud.modeled ? 1 : 1.5, UPPER);
      bone(a.fore, a.e, a.h, ud.modeled ? 1 : 1.25, FORE);
      a.joint.position.copy(a.e);
      a.hand.position.copy(a.h);
      a.hand.rotation.set(0, a.yaw, 0);
    }
    eyeMat.opacity = 0.5 + 0.5 * (ai.glow ?? 1);
  };
  return obj;
}

const _d = new THREE.Vector3();
// an arm piece: its root at a, its length along +y pointing at b (the stand-in is stretched to fit)
function bone(mesh, a, b, r, len) {
  mesh.position.copy(a);
  _d.subVectors(b, a);
  const l = _d.length();
  mesh.quaternion.setFromUnitVectors(UP, _d.normalize());
  if (r !== 1) mesh.scale.set(r, l, r);
  else mesh.scale.setScalar(1);
  void len;
}

// two-bone reach: keep the hand within the arm's length of the shoulder and put the elbow where the
// bones meet, bent toward where the pose wanted it (a.e on the way in)
const _t = new THREE.Vector3(), _p = new THREE.Vector3();
export function solveArm(a) {
  _d.subVectors(a.h, a.s);
  let dist = _d.length();
  const max = UPPER + FORE - 0.05, min = Math.abs(UPPER - FORE) + 0.5;
  if (dist > max) { a.h.copy(a.s).addScaledVector(_d, max / dist); dist = max; }
  if (dist < min) { a.h.copy(a.s).addScaledVector(_d, min / Math.max(dist, 1e-3)); dist = min; }
  _d.subVectors(a.h, a.s).normalize();
  const along = (UPPER * UPPER - FORE * FORE + dist * dist) / (2 * dist);
  const out = Math.sqrt(Math.max(0, UPPER * UPPER - along * along));
  _p.subVectors(a.e, a.s);
  _p.addScaledVector(_d, -_p.dot(_d));
  if (_p.lengthSq() < 1e-4) { _t.set(a.side, -0.5, 0); _p.copy(_t).addScaledVector(_d, -_d.dot(_t)); }
  _p.normalize();
  a.e.copy(a.s).addScaledVector(_d, along).addScaledVector(_p, out);
}

// a seal: a gold stone set in the rock, its light pulsing (it is not scaled with the body)
export function createSeal(M) {
  const obj = new THREE.Group();
  obj.name = 'seal';
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), new THREE.MeshBasicMaterial({ color: GOLD, fog: false }));
  gem.scale.set(1, 1.3, 1);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ color: GOLD, map: M.sprite.map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.scale.setScalar(5);
  obj.add(gem, halo);
  obj.userData.animate = (e, dt, t) => {
    const lit = !e.invuln;
    gem.rotation.y += dt * (lit ? 2 : 0.4);
    halo.material.opacity = lit ? 0.4 + Math.sin(t * 6) * 0.12 + e.flash * 0.4 : 0.12;
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
  const g = c.g, p = g.player, scene = g.scene, obj = e.obj, ud = obj.userData, def = e.def;
  const ai = e.ai ||= { mode: 'buried', t: 0, cd: 2, atk: null, last: null, fx: [], sink: -22, onBody: 0, broken: 0, lean: 0, nod: 0 };
  ai.lean ??= 0; ai.nod ??= 0;
  e.curSpeed = 0;
  e.state = ai.mode === 'fight' || ai.mode === 'rise' || ai.mode === 'bow' ? 'chase' : 'idle';
  e.hp = Math.max(0, def.hp - (ai.broken || 0));
  const T = (x, z) => g.terrain.getHeight(x, z);
  const hit = (dmg, from) => c.takeHit(dmg, from, e, { unblockable: true });
  const arms = ud.arms;
  if (!arms) return;

  // the pose of the body this frame, so world <-> model works
  obj.position.set(e.pos.x, e.pos.y + (ai.sink || 0) * SCALE, e.pos.z);
  obj.rotation.y = e.ry;
  ud.body.rotation.x = ai.lean;
  ud.head.rotation.x = ai.nod;
  obj.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
  const toWorld = (v, out = new THREE.Vector3()) => out.copy(v).applyMatrix4(obj.matrixWorld);
  const toLocal = (x, z) => V(x, e.pos.y, z).applyMatrix4(inv);
  const headPt = (x, y, z) => ud.head.localToWorld(V(x, y, z));
  for (const a of arms) a.s.copy(a.anchor.position).applyMatrix4(ud.body.matrix);

  for (const f of ai.fx) f.update(dt);
  ai.fx = ai.fx.filter((f) => !f.done);

  const seals = ai.seals || [];
  const broken = seals.filter((s) => !s.alive || s.state === 'dying').length;
  if (broken > ai.broken) {
    ai.broken = broken;
    e.flash = 1;
    p.shake = Math.max(p.shake, 0.6);
    g.audio.enemyCue?.('handking', 'aggro', e.pos);
    if (broken === 2) g.ui.banner(L('ราชาก้มศีรษะลงแนบดิน', 'The King Bows to the Earth'), L('ปีนเคราขึ้นไปตีตราที่หน้าผาก ก่อนพระองค์จะลุกขึ้น', 'Climb his beard and strike the seal on his brow before he rises'));
    else if (broken < 3) g.ui.combatText(L('ตราหินแตก!', 'A seal shatters!'), 'parry');
    if (broken === 2 && ai.mode === 'fight') { ai.atk = null; ai.mode = 'bow'; ai.t = 0; for (const a of arms) a.down = false; }
    if (broken >= 3) { ai.mode = 'kneel'; ai.t = 0; ai.atk = null; for (const a of arms) a.down = false; }
  }

  // the player standing on its body
  const onBody = playerOk && p.onGround && p.pos.y > T(p.pos.x, p.pos.z) + 1.5 && Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z) < 30 * SCALE;
  ai.onBody = onBody ? ai.onBody + dt : 0;

  switch (ai.mode) {
    case 'buried':
      if (ai.awake) {
        ai.mode = 'rise'; ai.t = 0;
        g.ui.banner(def.name, L('ลุกขึ้นจากแผ่นดิน', 'rises out of the earth'));
        g.audio.enemyCue?.('handking', 'rumble', e.pos);
        g.collision.addCircle(e.pos.x, e.pos.z, 5.2 * SCALE, -1e9, e.pos.y + (SH_Y - 2) * SCALE);
      }
      break;
    case 'rise': {
      ai.t += dt;
      const k = Math.min(1, ai.t / 8);
      ai.sink = -22 * (1 - ease(k));
      p.shake = Math.max(p.shake, 0.45 * (1 - k) + 0.08);
      if (Math.random() < dt * 16) { const at = toWorld(V((Math.random() - 0.5) * 16, 0, (Math.random() - 0.2) * 10)); at.y = T(at.x, at.z) + 1; g.particles.burst(at, 18, 14, 4); }
      relax(dt, 3);
      if (k >= 1) { ai.mode = 'fight'; ai.sink = 0; ai.cd = 2; }
      break;
    }
    case 'bow': {
      // both hands' seals gone: it bows, brow to the earth, for a while; then rises and fights on
      ai.t += dt;
      const down = Math.min(1, ai.t / 4), up = ai.t > 22 ? Math.min(1, (ai.t - 22) / 4) : 0;
      const k = ease(down) * (1 - ease(up));
      ai.lean = BOW * k; ai.nod = NOD * k;
      for (const a of arms) {
        // the hands go down flat on either side of the head, holding it up
        a.e.lerp(V(a.side * 12, 4, 10), Math.min(1, dt * 1.5));
        a.h.lerp(V(a.side * 8.5, 0.75, 17.5), Math.min(1, dt * 1.5));
      }
      ai.bowed = down >= 1 && up <= 0;
      if (ai.t > 26) { ai.mode = 'fight'; ai.cd = 1.5; ai.bowed = false; ai.lean = 0; ai.nod = 0; ai.nextBow = 14; }
      break;
    }
    case 'kneel': {
      ai.t += dt;
      const k = ease(Math.min(1, ai.t / 4));
      ai.lean = Math.max(ai.lean, BOW * k); ai.nod = NOD * k;
      ai.glow = 1 - k * 0.6;
      for (const a of arms) {
        a.e.lerp(V(a.side * 12, 4, 10), Math.min(1, dt * 1.5));
        a.h.lerp(V(a.side * 8.5, 0.75, 17.5), Math.min(1, dt * 1.5));
      }
      ai.bowed = true;
      e.knelt = k >= 1;
      break;
    }
    case 'fight': {
      if (!playerOk) { relax(dt); break; }
      // with both hands' seals gone it bows again every so often
      if (ai.broken >= 2 && !ai.atk && (ai.nextBow = (ai.nextBow ?? 0) - dt) <= 0) { ai.mode = 'bow'; ai.t = 0; for (const a of arms) a.down = false; break; }
      // too long on its body: it shakes you off
      if (ai.onBody > (ai.broken >= 2 ? 10 : 14) && !ai.atk && !arms.some((a) => a.down)) { ai.atk = start('shrug'); break; }
      if (!ai.atk) {
        relax(dt);
        ai.cd -= dt;
        if (ai.cd <= 0) {
          const local = toLocal(p.pos.x, p.pos.z), d = Math.hypot(local.x, local.z);
          const opts = [];
          if (d < 24 && local.z > 0) opts.push('slam', 'slam', 'slam');
          if (d < 14 && local.z > -4) opts.push('quake');
          opts.push('rocks');
          const pick = opts.filter((o) => o !== ai.last || o === 'slam');
          const kind = pick[Math.floor(Math.random() * pick.length)];
          ai.last = kind;
          ai.atk = start(kind);
        }
      } else {
        ai.atk.t += dt;
        ai.atk.tick(dt);
        if (ai.atk.t >= ai.atk.dur) { ai.atk = null; ai.cd = 1.4 + Math.random() * 1.2; }
      }
      break;
    }
  }

  // the arms' bones keep their length; the hand lies along the forearm
  for (const a of arms) {
    solveArm(a);
    a.yaw = Math.atan2(a.h.x - a.e.x, a.h.z - a.e.z);
  }

  // seals: on the back of each hand, and on the brow
  const handPt = (a, x, y, z) => {
    const cs = Math.cos(a.yaw), sn = Math.sin(a.yaw);
    return V(a.h.x + x * cs + z * sn, a.h.y + y, a.h.z - x * sn + z * cs);
  };
  seals.forEach((s, i) => {
    if (!s.alive || s.state === 'dying') return;
    if (i < 2) toWorld(handPt(arms[i], 0, 1.05, 0.6), s.pos);
    else s.pos.copy(headPt(0, 1.3, 2.95));
    s.invuln = ai.mode === 'buried' || ai.mode === 'rise' || (i < 2 ? !arms[i].down : !ai.bowed || ai.broken < 2);
  });
  // where to stand to set the crown, once it has bowed for the last time
  e.crownAt = ai.bowed ? toWorld(handPt(arms[1], -6, 0, 2)).setY(0) : null;
  if (e.crownAt) e.crownAt.y = T(e.crownAt.x, e.crownAt.z);

  // ---- floors: the fingers and back of a hand on the ground; the beard while it bows
  ai.surface = (x, z, feetY = Infinity) => {
    let best = -Infinity;
    const W = new THREE.Vector3(), Wb = new THREE.Vector3();
    const cap = (A, B, r, lift = 0, groundA = false) => {
      W.copy(A); Wb.copy(B);
      if (groundA) W.y = T(W.x, W.z);
      const vx = Wb.x - W.x, vz = Wb.z - W.z, l2 = vx * vx + vz * vz || 1e-6;
      const t = clamp(((x - W.x) * vx + (z - W.z) * vz) / l2, 0, 1);
      if (Math.hypot(x - (W.x + vx * t), z - (W.z + vz * t)) > r) return;
      const y = W.y + (Wb.y - W.y) * t + lift;
      if (y <= feetY + 0.65) best = Math.max(best, y);
    };
    if (ai.mode !== 'fight' && ai.mode !== 'bow' && ai.mode !== 'kneel') return best;
    for (const a of arms) {
      if (!a.down && !ai.bowed) continue;
      const top = 0.75 * SCALE;
      // the back of the hand
      cap(toWorld(handPt(a, 0, 0.73, -0.6)), toWorld(handPt(a, 0, 0.73, 2.2)), 1.7 * SCALE);
      // four fingers, each a ramp from its tip on the ground up to the knuckles
      for (const fx of [-1.2, -0.4, 0.4, 1.2]) cap(toWorld(handPt(a, fx, -a.h.y, 4.9)), toWorld(handPt(a, fx, 0.73, 2.0)), 0.45 * SCALE, 0, true);
      void top;
    }
    if (ai.bowed) {
      // up the beard from the ground, over the chin, onto the bridge of the nose below the seal
      const tip = headPt(0, -5.1, 3.4), chin = headPt(0, -2.6, 2.9);
      const seal = headPt(0, 1.3, 2.95), stand = seal.clone();
      stand.y -= 4.5;
      stand.lerp(V(chin.x, stand.y, chin.z), 0.25);
      cap(tip, chin, 2.2 * SCALE, 0, true);
      cap(chin, stand, 1.4 * SCALE);
    }
    return best;
  };

  // the arms ease back toward rest when nothing is asked of them
  function relax(dt, k = 1.5) {
    for (const a of arms) {
      if (a.down) continue;
      a.e.lerp(V(a.side * REST.e.x, REST.e.y + Math.sin(g.time * 0.5 + a.side) * 0.4, REST.e.z), Math.min(1, dt * k));
      a.h.lerp(V(a.side * REST.h.x, REST.h.y + Math.sin(g.time * 0.6 + a.side) * 0.6, REST.h.z), Math.min(1, dt * k));
    }
    if (ai.mode === 'fight') { ai.lean += (0.06 - ai.lean) * Math.min(1, dt * 2); ai.nod += (0 - ai.nod) * Math.min(1, dt * 2); }
  }

  function start(kind) {
    const slow = 1 + ai.broken * 0.15;       // every seal broken leaves it slower
    const atk = { kind, t: 0, dur: 1, done: {}, tick: () => {} };
    if (kind === 'slam') {
      // the arm on the player's side, onto where the player stands
      const local = toLocal(p.pos.x, p.pos.z);
      const a = arms[local.x >= 0 ? 1 : 0];
      const reach = Math.hypot(local.x, local.z), maxR = 17;
      const k = reach > maxR ? maxR / reach : 1;
      const target = V(clamp(local.x * k, a.side > 0 ? 2 : -16, a.side > 0 ? 16 : -2), 0, clamp(local.z * k, 9, maxR));
      const tw = toWorld(target);
      tw.y = T(tw.x, tw.z);
      const R = 2.6 * SCALE;
      const W = 3.0 * slow, hold = 11 * (1 + ai.broken * 0.1), lift = 2.0;
      atk.dur = W + 0.4 + hold + lift;
      const mark = new THREE.Mesh(new THREE.RingGeometry(R * 0.85, R, 40), markMat);
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(tw.x, tw.y + 0.3, tw.z);
      scene.add(mark);
      ai.fx.push({ t: 0, done: false, update(dt) { this.t += dt; mark.scale.setScalar(0.6 + 0.4 * Math.min(1, this.t / W)); if (this.t > W + 0.5) { scene.remove(mark); mark.geometry.dispose(); this.done = true; } } });
      g.audio.enemyCue?.('handking', 'windup', e.pos);
      const raisedE = V(a.side * 10, 20, 6), raisedH = V(target.x * 0.6, 26, target.z * 0.55);
      const downH = V(target.x, 0.75, target.z);
      const downE = V(lerp(a.s.x, target.x, 0.5) + a.side * 2, 9, target.z * 0.5);
      atk.tick = (dt) => {
        const t = atk.t;
        if (t < W) {
          const k = ease(Math.min(1, t / (W * 0.8)));
          a.e.lerp(raisedE, Math.min(1, dt * 3) * k + 0.01);
          a.h.lerp(raisedH, Math.min(1, dt * 3) * k + 0.01);
          return;
        }
        if (t < W + 0.4) {
          const k = (t - W) / 0.4;
          a.h.lerpVectors(raisedH, downH, ease(k));
          a.e.lerpVectors(raisedE, downE, ease(k));
          return;
        }
        if (!atk.done.hit) {
          atk.done.hit = true;
          a.h.copy(downH); a.e.copy(downE); a.down = true;
          g.audio.slam(tw);
          g.particles.burst(tw.clone().setY(tw.y + 2), 70, 26, 7);
          p.shake = Math.max(p.shake, 0.9);
          if (Math.hypot(p.pos.x - tw.x, p.pos.z - tw.z) < R && p.pos.y - tw.y < 12) hit(40, tw);
          else wave(tw, R, 4.5 * SCALE);
          if (seals[a.side > 0 ? 1 : 0]?.alive) g.ui.combatText(L('มือค้างอยู่ — วิ่งขึ้นนิ้วไปตีตราบนหลังมือ!', 'The hand is down — run up its fingers and strike the seal on its back!'), 'parry');
          return;
        }
        if (t < W + 0.4 + hold) return;
        // up it comes: anyone still on the hand is thrown off
        if (a.down) {
          a.down = false;
          if (ai.onBody > 0) throwOff(12);
        }
        relax(dt, 2);
      };
    } else if (kind === 'quake') {
      // both fists into the earth just before it: two rings roll out
      const W = 2.2 * slow;
      atk.dur = W + 3.5;
      g.audio.enemyCue?.('handking', 'windup', e.pos);
      atk.tick = (dt) => {
        const t = atk.t;
        for (const a of arms) {
          if (t < W) { a.h.lerp(V(a.side * 5, 14, 9), Math.min(1, dt * 3)); a.e.lerp(V(a.side * 12, 12, 4), Math.min(1, dt * 3)); }
          else if (t < W + 0.35) { a.h.lerp(V(a.side * 4, 0.9, 10), Math.min(1, dt * 14)); }
        }
        for (const [i, at] of [[0, W + 0.35], [1, W + 1.6]].map(([i, at]) => [i, at])) {
          if (t >= at && !atk.done[i]) {
            atk.done[i] = true;
            const o = toWorld(V(0, 0, 10)); o.y = T(o.x, o.z);
            g.audio.slam(o);
            p.shake = Math.max(p.shake, 0.7);
            g.particles.burst(o.clone().setY(o.y + 2), 50, 22, 6);
            wave(o, 2, 22 * SCALE);
            if (i === 1) for (const a of arms) a.h.y = 3;
          }
        }
      };
    } else if (kind === 'rocks') {
      const n = ai.broken >= 2 ? 9 : 6;
      atk.dur = 1.6 + n * 0.3 + 1.2;
      g.audio.enemyCue?.('handking', 'rumble', e.pos);
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2, r = i === 0 ? 0 : 4 + Math.random() * 12;
        ai.fx.push(fall(1.6 + i * 0.3, p.pos.x + Math.cos(ang) * r, p.pos.z + Math.sin(ang) * r));
      }
    } else if (kind === 'shrug') {
      atk.dur = 2.4;
      g.ui.combatText(L('ร่างศิลาสะบัดตัว!', 'The colossus shudders!'), 'bad');
      atk.tick = () => {
        p.shake = Math.max(p.shake, 0.5);
        if (atk.t > 1.2 && !atk.done.throw) { atk.done.throw = true; if (ai.onBody > 0) throwOff(16); }
      };
    }
    return atk;
  }

  function throwOff(dmg) {
    const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1;
    p.vel.set(dx / d * 10, 8, dz / d * 10);
    p.onGround = false;
    if (c.iframes <= 0) hit(dmg, e.pos);
    ai.onBody = 0;
  }

  // a ring rolling out from where something struck; touch it on the ground and it hits
  function wave(at, from, to) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 56), markMat.clone());
    m.rotation.x = -Math.PI / 2;
    m.position.set(at.x, at.y + 0.3, at.z);
    scene.add(m);
    ai.fx.push({ r: from, done: false, hit: false, update(dt) {
      this.r += dt * 26;
      m.scale.setScalar(this.r);
      m.material.opacity = 0.8 * (1 - this.r / to);
      const d = Math.hypot(p.pos.x - at.x, p.pos.z - at.z);
      const grounded = p.onGround && p.pos.y - T(p.pos.x, p.pos.z) < 0.5;
      if (!this.hit && Math.abs(d - this.r) < 1.6 && grounded) { this.hit = true; if (c.iframes <= 0) hit(20, at); }
      if (this.r > to) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); this.done = true; }
    } });
  }

  // a stone falling on a marked spot
  function fall(delay, x, z) {
    let m = null, stone = null, hitDone = false;
    const y = T(x, z), R = 3.6;
    return { t: 0, done: false, update(dt) {
      this.t += dt;
      if (!m && this.t > delay - 1.2) {
        m = new THREE.Mesh(new THREE.RingGeometry(R * 0.82, R, 24), markMat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(x, y + 0.2, z);
        scene.add(m);
      }
      if (!stone && this.t > delay - 0.6) {
        rockGeom ||= part(new THREE.DodecahedronGeometry(2.6, 0), ROCK);
        stone = new THREE.Mesh(rockGeom, g.M.giantRock);
        scene.add(stone);
      }
      if (stone) {
        const k = Math.min(1, (this.t - (delay - 0.6)) / 0.6);
        stone.position.set(x, y + 60 * (1 - k * k) + 2, z);
        stone.rotation.x += dt * 4;
        if (k >= 1 && !hitDone) {
          hitDone = true;
          g.audio.slam({ x, y, z });
          g.particles.burst(new THREE.Vector3(x, y + 1, z), 20, 8, 2);
          if (Math.hypot(p.pos.x - x, p.pos.z - z) < R && Math.abs(p.pos.y - y) < 4 && c.iframes <= 0) hit(22, { x, z });
        }
      }
      if (this.t > delay + 0.8) { if (m) { scene.remove(m); m.geometry.dispose(); } if (stone) scene.remove(stone); this.done = true; }
    } };
  }
}
