// The five playable heroes as other players see them online, built from primitives after the
// concept sheets in docs/hero-concepts/. Each is a rigid skinned rig (the same 16-bone layout as the
// Pale Ones, so one draw call per material), with:
//   - cloth on a `team` material the game dyes in the base's colour,
//   - a glowing signature (lantern, jars, coffin crack, candle flame) that reads at night,
//   - the weapon held in the right hand, swung by the animation.
import * as THREE from 'three';
import { part, mergeGeometries, cylinderBetween, clamp } from './util.js';
import { rng } from './noise.js';
import { ps2ify } from './ps2.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = (r, g, b) => new THREE.Color(r, g, b);

const BONES = {
  hips: [null, 0, 0.98, 0], spine: ['hips', 0, 1.12, 0], chest: ['spine', 0, 1.38, 0], neck: ['chest', 0, 1.58, 0.02], head: ['neck', 0, 1.68, 0.04],
  shL: ['chest', 0.19, 1.52, 0], elL: ['shL', 0.21, 1.17, 0.01], haL: ['elL', 0.22, 0.85, 0.02],
  shR: ['chest', -0.19, 1.52, 0], elR: ['shR', -0.21, 1.17, 0.01], haR: ['elR', -0.22, 0.85, 0.02],
  hiL: ['hips', 0.1, 0.94, 0], knL: ['hiL', 0.11, 0.52, 0.03], anL: ['knL', 0.11, 0.08, 0],
  hiR: ['hips', -0.1, 0.94, 0], knR: ['hiR', -0.11, 0.52, 0.03], anR: ['knR', -0.11, 0.08, 0],
};
const NAMES = Object.keys(BONES);
const P = (n) => V(BONES[n][1], BONES[n][2], BONES[n][3]);

// ---------------------------------------------------------------- building blocks
// parts are collected per material and per bone, then merged into one skinned mesh per material
class Kit {
  constructor() { this.parts = { plain: [], metal: [], wood: [], gold: [], team: [], glow: [], tex: [] }; this.weapon = { plain: [], metal: [], wood: [], gold: [], team: [], glow: [] }; }
  add(mat, bone, g) { this.parts[mat].push([bone, g]); return this; }
  wpn(mat, g) { this.weapon[mat].push(g); return this; }
}
const seg = (a, b, r0, r1, col, sides = 7) => part(cylinderBetween(a, b, r0, r1, sides), col);
const blob = (x, y, z, r, col, scale = [1, 1, 1], w = 8, h = 6) => part(new THREE.SphereGeometry(r, w, h), col, { pos: [x, y, z], scale });
const box = (x, y, z, sx, sy, sz, col, rot = [0, 0, 0]) => part(new THREE.BoxGeometry(sx, sy, sz), col, { pos: [x, y, z], rot });
const cyl = (x, y, z, r0, r1, h, col, rot = [0, 0, 0], sides = 8) => part(new THREE.CylinderGeometry(r1, r0, h, sides), col, { pos: [x, y, z], rot });

// a hanging cloth skirt (coat tails, robe, cloak): an open cone, optionally only part of the way
// round, with a ragged hem
function skirt({ top, bottom, rTop, rBot, from = 0, arc = Math.PI * 2, ragged = 0.08, seed = 1, z = 0, sides = 12, col = 0xffffff }) {
  const h = top - bottom;
  const g = new THREE.CylinderGeometry(rTop, rBot, h, sides, 3, true, from, arc);
  const pos = g.attributes.position, r = rng(seed);
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) < -h / 2 + 0.01) pos.setY(i, pos.getY(i) - r() * ragged);
  return part(g, col, { pos: [0, bottom + h / 2, z] });
}

// legs, torso, arms and head of an ordinary body. o: { k bulk, trousers, boots, bootTop, skin,
// torso, torsoMat, sleeve, sleeveMat, fore, foreMat, hand, head: false to skip the head }
function human(kit, o) {
  const k = o.k ?? 1;
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R', hi = P(`hi${L}`), kn = P(`kn${L}`), an = P(`an${L}`);
    kit.add(o.trousersMat || 'plain', `hi${L}`, seg(hi, kn, 0.085 * k, 0.065 * k, o.trousers));
    kit.add(o.trousersMat || 'plain', `kn${L}`, seg(kn, V(an.x, an.y + 0.02, an.z), 0.062 * k, 0.05 * k, o.trousers));
    // boot shaft and foot
    kit.add('plain', `kn${L}`, seg(V(an.x, 0.07, an.z), V(kn.x, o.bootTop ?? 0.38, kn.z), 0.068 * k, 0.07 * k, o.boots));
    kit.add('plain', `an${L}`, box(an.x, 0.045, an.z + 0.05, 0.12 * k, 0.09, 0.27, o.boots));
    if (o.pointy) kit.add('plain', `an${L}`, part(new THREE.ConeGeometry(0.05, 0.16, 4), o.boots, { pos: [an.x, 0.04, an.z + 0.25], rot: [Math.PI / 2, 0, 0], scale: [1, 1, 0.5] }));
    const sh = P(`sh${L}`), el = P(`el${L}`), ha = P(`ha${L}`);
    kit.add(o.sleeveMat || 'plain', `sh${L}`, blob(sh.x, sh.y, sh.z, 0.07 * k, o.sleeve));
    kit.add(o.sleeveMat || 'plain', `sh${L}`, seg(sh, el, 0.062 * k, 0.05 * k, o.sleeve));
    kit.add(o.foreMat || 'plain', `el${L}`, seg(el, V(ha.x, ha.y + 0.02, ha.z), 0.05 * k, 0.042 * k, o.fore));
    // hands a little oversized, so a blow reads from afar
    kit.add('plain', `ha${L}`, box(ha.x, ha.y - 0.06, ha.z + 0.01, 0.075 * k, 0.12, 0.07 * k, o.hand));
    kit.add('plain', `ha${L}`, box(ha.x - s * 0.03 * k, ha.y - 0.04, ha.z + 0.045, 0.03, 0.07, 0.04, o.hand));
  }
  kit.add(o.torsoMat || 'plain', 'hips', seg(V(0, 0.86, 0), V(0, 1.1, 0), 0.15 * k, 0.15 * k, o.torso, 9));
  kit.add(o.torsoMat || 'plain', 'spine', seg(V(0, 1.08, 0), V(0, 1.32, 0), 0.15 * k, 0.165 * k, o.torso, 9));
  kit.add(o.torsoMat || 'plain', 'chest', seg(V(0, 1.3, 0), V(0, 1.55, 0), 0.17 * k, 0.2 * k, o.torso, 9));
  kit.add(o.torsoMat || 'plain', 'chest', blob(0, 1.55, 0, 0.2 * k, o.torso, [1.05, 0.32, 0.7]));
  kit.add('plain', 'neck', seg(V(0, 1.55, 0.01), V(0, 1.7, 0.03), 0.05 * k, 0.048 * k, o.skin));
  if (o.head !== false) kit.add('plain', 'head', blob(0, 1.79, 0.04, 0.115, o.skin, [0.9, 1.08, 1], 9, 7));
}

// a simple painted face: dark brows/eye band, a nose, a mouth line, optional beard
function face(kit, { skin, beard = null, eyes = C(0.08, 0.06, 0.05), closed = false }) {
  kit.add('plain', 'head', box(0, 1.81, 0.145, 0.15, closed ? 0.012 : 0.022, 0.02, eyes));
  kit.add('plain', 'head', box(0, 1.77, 0.155, 0.03, 0.05, 0.03, skin.clone().multiplyScalar(0.92)));
  kit.add('plain', 'head', box(0, 1.725, 0.142, 0.06, 0.012, 0.02, C(0.3, 0.16, 0.14)));
  if (beard) kit.add('plain', 'head', blob(0, 1.71, 0.09, 0.085, beard, [1, 0.8, 0.75], 7, 5));
}

// ---------------------------------------------------------------- the five heroes
// the coffin, held upright by its side handle (the primitive coffin-bearer and the imported one)
function coffinWeapon(kit) {
  const profile = new THREE.Shape([[0, -0.85], [0.17, -0.85], [0.29, 0.38], [0.2, 0.85], [-0.2, 0.85], [-0.29, 0.38], [-0.17, -0.85]].map(([x, y]) => new THREE.Vector2(x, y)));
  const coffin = new THREE.ExtrudeGeometry(profile, { depth: 0.32, bevelEnabled: false });
  coffin.translate(0, 0, -0.16);
  kit.wpn('wood', part(coffin, C(0.42, 0.3, 0.2)));
  for (const y of [-0.62, 0.05, 0.62]) kit.wpn('metal', box(0, y, 0, y > 0.3 ? 0.44 : y > 0 ? 0.52 : 0.38, 0.05, 0.34, C(0.28, 0.27, 0.28)));
  kit.wpn('team', box(0, -0.22, 0, 0.5, 0.26, 0.335, C(0.85, 0.82, 0.76)));
  kit.wpn('glow', box(0, 0.36, 0.165, 0.025, 0.42, 0.01, C(0.5, 1.4, 0.7), [0, 0, 0.08]));
  kit.wpn('metal', box(0.3, 0.05, 0, 0.04, 0.22, 0.05, C(0.3, 0.3, 0.32)));
}

const HEROES = {
  // the wanderer: pointed hood and long ragged cloak (team), leather jerkin, moon-lantern at the hip
  wanderer(kit) {
    const skin = C(0.66, 0.5, 0.4), leather = C(0.36, 0.24, 0.16), dark = C(0.16, 0.15, 0.15);
    human(kit, { trousers: dark, boots: C(0.32, 0.21, 0.14), bootTop: 0.46, skin, torso: leather, sleeve: dark, fore: C(0.75, 0.72, 0.68), hand: skin });
    face(kit, { skin, beard: C(0.22, 0.17, 0.13) });
    kit.add('team', 'elL', seg(V(0.21, 1.12, 0.01), V(0.215, 0.98, 0.015), 0.056, 0.05, 0xffffff));     // cloth band on the left arm
    // buckles down the jerkin, belt, pouch
    for (const y of [1.12, 1.27, 1.42]) kit.add('metal', y > 1.3 ? 'chest' : 'spine', box(0, y, 0.175, 0.07, 0.03, 0.02, C(0.6, 0.6, 0.62)));
    kit.add('plain', 'hips', cyl(0, 0.98, 0, 0.165, 0.165, 0.07, C(0.22, 0.14, 0.09), [0, 0, 0], 10));
    kit.add('plain', 'hips', box(-0.12, 0.93, 0.12, 0.1, 0.1, 0.06, leather));
    // hood: a cowl round the head drawn to a point at the back, the capelet over the shoulders
    // (the cowl is open at the front so the shadowed face shows)
    kit.add('team', 'head', part(new THREE.SphereGeometry(0.16, 10, 7, Math.PI / 2 + 0.75, Math.PI * 2 - 1.5), C(0.86, 0.86, 0.86), { pos: [0, 1.81, -0.01], scale: [1.02, 1.14, 1.12] }));
    kit.add('team', 'head', part(new THREE.ConeGeometry(0.13, 0.36, 7), C(0.86, 0.86, 0.86), { pos: [0, 2.02, -0.1], rot: [-0.75, 0, 0] }));
    kit.add('plain', 'head', box(0, 1.84, 0.13, 0.19, 0.09, 0.05, C(0.05, 0.05, 0.06)));     // the shadow under the hood
    kit.add('team', 'chest', skirt({ top: 1.6, bottom: 1.3, rTop: 0.14, rBot: 0.34, ragged: 0.04, seed: 3, col: C(0.92, 0.92, 0.92) }));
    // the long cloak, open at the front, ragged at the calves
    kit.add('team', 'chest', skirt({ top: 1.5, bottom: 0.32, rTop: 0.26, rBot: 0.42, from: Math.PI * 0.3, arc: Math.PI * 1.4, ragged: 0.22, seed: 7, z: -0.03, col: C(0.82, 0.82, 0.82) }));
    // moon-lantern on a chain at the left hip
    kit.add('metal', 'hips', box(0.24, 0.8, 0.06, 0.11, 0.02, 0.11, C(0.3, 0.3, 0.32)));
    kit.add('metal', 'hips', box(0.24, 0.66, 0.06, 0.11, 0.02, 0.11, C(0.3, 0.3, 0.32)));
    kit.add('metal', 'hips', seg(V(0.2, 0.95, 0.06), V(0.24, 0.81, 0.06), 0.008, 0.008, C(0.35, 0.35, 0.37), 4));
    kit.add('glow', 'hips', box(0.24, 0.73, 0.06, 0.085, 0.12, 0.085, C(0.6, 0.95, 1.6)));
    kit.glows = [['hips', [0.24, 0.73, 0.06], 'sprite', 1.1]];
    // the longsword, pointing forward and down from the hand
    kit.wpn('metal', box(0, 0, 0.5, 0.055, 0.012, 0.9, C(0.72, 0.75, 0.8)));
    kit.wpn('metal', part(new THREE.ConeGeometry(0.039, 0.12, 4), C(0.72, 0.75, 0.8), { pos: [0, 0, 1.0], rot: [Math.PI / 2, Math.PI / 4, 0], scale: [1, 1, 0.3] }));
    kit.wpn('metal', box(0, 0, 0.06, 0.22, 0.03, 0.04, C(0.45, 0.42, 0.38)));
    kit.wpn('plain', box(0, 0, -0.05, 0.035, 0.035, 0.18, C(0.2, 0.13, 0.09)));
    kit.wpn('metal', blob(0, 0, -0.15, 0.035, C(0.7, 0.55, 0.3)));
    kit.grip = { pos: [0, -0.06, 0.02], rot: [0.6, 0, 0] };
  },

  // the bellwright: wide reed hat, long robe and wide sleeves (team), rope of bells, bell hammer
  bell(kit) {
    const skin = C(0.7, 0.55, 0.43), straw = C(0.62, 0.5, 0.32);
    human(kit, { trousers: C(0.85, 0.83, 0.78), trousersMat: 'plain', boots: C(0.88, 0.86, 0.8), bootTop: 0.36, skin, torso: C(0.86, 0.86, 0.86), torsoMat: 'team', sleeve: C(0.86, 0.86, 0.86), sleeveMat: 'team', fore: skin, hand: skin });
    face(kit, { skin, beard: C(0.72, 0.72, 0.7), closed: true });
    // robe to the shins, dark and wet at the hem
    kit.add('team', 'spine', skirt({ top: 1.3, bottom: 0.62, rTop: 0.2, rBot: 0.36, ragged: 0.03, seed: 11, col: C(0.86, 0.86, 0.86) }));
    kit.add('team', 'hips', skirt({ top: 0.64, bottom: 0.3, rTop: 0.36, rBot: 0.38, ragged: 0.06, seed: 12, col: C(0.32, 0.32, 0.3) }));
    // wide hanging sleeves
    for (const s of [1, -1]) kit.add('team', `sh${s > 0 ? 'L' : 'R'}`, part(new THREE.CylinderGeometry(0.07, 0.17, 0.42, 8, 1, true), C(0.8, 0.8, 0.8), { pos: [s * 0.21, 1.27, 0] }));
    // sash and the rope of little bells
    kit.add('team', 'hips', cyl(0, 1.02, 0, 0.175, 0.175, 0.13, C(1, 1, 1), [0, 0, 0], 10));
    for (let i = 0; i < 7; i++) {
      const a = -0.9 + i * 0.3, x = Math.sin(a) * 0.19, z = Math.cos(a) * 0.19, y = 0.88 - (i % 3) * 0.06;
      kit.add('plain', 'hips', seg(V(x * 0.9, 0.98, z * 0.9), V(x, y + 0.05, z), 0.008, 0.008, C(0.45, 0.35, 0.22), 4));
      kit.add('metal', 'hips', part(new THREE.CylinderGeometry(0.012, 0.035, 0.06, 6), C(0.75, 0.56, 0.26), { pos: [x, y, z] }));
    }
    // coil of bell rope across the chest
    kit.add('plain', 'chest', part(new THREE.TorusGeometry(0.21, 0.025, 4, 12), C(0.5, 0.38, 0.24), { pos: [0, 1.36, 0.02], rot: [0.2, 0, 0.75], scale: [1, 1.15, 0.8] }));
    // straw sandals: soles under the wrapped feet
    for (const s of [1, -1]) kit.add('wood', `an${s > 0 ? 'L' : 'R'}`, box(s * 0.11, 0.008, 0.05, 0.13, 0.016, 0.28, straw));
    // the wide flat reed hat with dangling cords
    kit.add('wood', 'head', part(new THREE.ConeGeometry(0.42, 0.16, 12), straw, { pos: [0, 1.98, 0.02] }));
    kit.add('wood', 'head', cyl(0, 1.9, 0.02, 0.42, 0.42, 0.015, straw.clone().multiplyScalar(0.8), [0, 0, 0], 12));
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + 0.3;
      kit.add('plain', 'head', seg(V(Math.cos(a) * 0.38, 1.9, 0.02 + Math.sin(a) * 0.38), V(Math.cos(a) * 0.38, 1.8, 0.02 + Math.sin(a) * 0.38), 0.006, 0.006, C(0.5, 0.4, 0.25), 3));
      kit.add('metal', 'head', blob(Math.cos(a) * 0.38, 1.79, 0.02 + Math.sin(a) * 0.38, 0.012, C(0.75, 0.56, 0.26), [1, 1.6, 1], 4, 3));
    }
    // the bell hammer: up over the right shoulder, the bell behind it
    kit.wpn('wood', box(0, 0.5, 0, 0.055, 1.2, 0.055, C(0.3, 0.2, 0.13)));
    kit.wpn('plain', box(0, -0.02, 0, 0.065, 0.22, 0.065, C(0.6, 0.5, 0.36)));
    kit.wpn('metal', cyl(0, 1.1, 0, 0.05, 0.05, 0.12, C(0.3, 0.3, 0.32), [0, 0, 0], 6));
    // the bell, mounted sideways at the top, its mouth facing out
    kit.wpn('gold', part(new THREE.LatheGeometry([[0.02, 0.0], [0.12, 0.02], [0.14, 0.1], [0.16, 0.28], [0.21, 0.36], [0.2, 0.38]].map(([x, y]) => new THREE.Vector2(x, y)), 10), C(1.0, 0.8, 0.45), { pos: [0.02, 1.2, 0], rot: [0, 0, Math.PI / 2] }));
    kit.wpn('gold', part(new THREE.TorusGeometry(0.2, 0.02, 4, 10), C(0.8, 0.6, 0.3), { pos: [-0.35, 1.2, 0], rot: [0, Math.PI / 2, 0] }));
    kit.wpn('metal', blob(-0.32, 1.13, 0, 0.045, C(0.45, 0.35, 0.2)));
    kit.grip = { pos: [0, -0.07, 0.03], rot: [-0.25, 0, 0.18] };
  },

  // the leech-doctor: stitched beak mask, long leather coat, shirt and short cape (team),
  // red-glowing jars across the chest, leeches on the forearms, a curved lancet
  leech(kit) {
    const skin = C(0.78, 0.66, 0.6), leather = C(0.4, 0.27, 0.17), mask = C(0.78, 0.7, 0.55);
    human(kit, { k: 0.9, trousers: C(0.14, 0.13, 0.13), boots: C(0.3, 0.2, 0.14), bootTop: 0.44, skin, torso: C(0.9, 0.9, 0.9), torsoMat: 'team', sleeve: C(0.9, 0.9, 0.9), sleeveMat: 'team', fore: skin, hand: skin, head: false });
    // the coat: open at the front, to the shins
    kit.add('plain', 'chest', skirt({ top: 1.56, bottom: 1.05, rTop: 0.21, rBot: 0.22, from: Math.PI * 0.22, arc: Math.PI * 1.56, ragged: 0.0, seed: 21, col: leather }));
    kit.add('plain', 'hips', skirt({ top: 1.08, bottom: 0.28, rTop: 0.22, rBot: 0.36, from: Math.PI * 0.18, arc: Math.PI * 1.64, ragged: 0.12, seed: 22, col: leather }));
    // short shoulder cape
    kit.add('team', 'chest', skirt({ top: 1.62, bottom: 1.36, rTop: 0.14, rBot: 0.3, ragged: 0.05, seed: 23, col: C(0.8, 0.8, 0.8) }));
    // bandolier with jars of leeches
    kit.add('plain', 'chest', box(0, 1.38, 0.17, 0.08, 0.5, 0.025, C(0.28, 0.18, 0.12), [0, 0, 0.85]));
    for (let i = 0; i < 5; i++) {
      const t = (i - 2) * 0.08, x = -t * 1.33, y = 1.38 + t * 1.12;
      kit.add('glow', 'chest', cyl(x, y, 0.2, 0.03, 0.03, 0.07, C(1.15, 0.12, 0.1), [0, 0, 0], 6));
      kit.add('wood', 'chest', cyl(x, y + 0.045, 0.2, 0.025, 0.025, 0.02, C(0.55, 0.42, 0.28), [0, 0, 0], 6));
    }
    // belt of tools
    kit.add('plain', 'hips', cyl(0, 0.96, 0, 0.17, 0.17, 0.06, C(0.25, 0.16, 0.1), [0, 0, 0], 10));
    for (let i = 0; i < 4; i++) kit.add('metal', 'hips', box(0.06 + i * 0.035, 0.88, 0.16, 0.012, 0.14, 0.01, C(0.65, 0.65, 0.68)));
    // leeches clinging to the bare forearms
    for (const [bone, x, y] of [['elL', 0.215, 1.02], ['elR', -0.215, 0.95], ['elR', -0.212, 1.08]]) kit.add('plain', bone, blob(x + Math.sign(x) * 0.04, y, 0.02, 0.03, C(0.08, 0.05, 0.07), [0.8, 2.2, 0.8], 6, 4));
    // head under a hood, stitched beak mask, round dark glass eyes
    kit.add('plain', 'head', blob(0, 1.79, 0.03, 0.125, mask, [0.92, 1.12, 1.02], 9, 7));
    kit.add('plain', 'head', part(new THREE.ConeGeometry(0.06, 0.3, 6), mask, { pos: [0, 1.7, 0.27], rot: [Math.PI / 2 + 0.55, 0, 0] }));
    for (const s of [1, -1]) {
      kit.add('metal', 'head', part(new THREE.TorusGeometry(0.035, 0.01, 4, 8), C(0.55, 0.42, 0.25), { pos: [s * 0.05, 1.82, 0.13] }));
      kit.add('plain', 'head', cyl(s * 0.05, 1.82, 0.125, 0.032, 0.032, 0.02, C(0.04, 0.04, 0.05), [Math.PI / 2, 0, 0], 8));
    }
    kit.add('plain', 'head', box(0, 1.92, 0.1, 0.012, 0.08, 0.02, C(0.4, 0.32, 0.22)));        // the stitch over the crown
    // the curved lancet, blade forward
    kit.wpn('plain', box(0, 0, -0.04, 0.03, 0.03, 0.15, C(0.85, 0.8, 0.68)));
    kit.wpn('plain', blob(0, 0, -0.12, 0.025, C(0.8, 0.74, 0.6)));
    kit.wpn('metal', box(0, 0.01, 0.17, 0.008, 0.045, 0.26, C(0.72, 0.74, 0.78), [-0.15, 0, 0]));
    kit.wpn('metal', box(0, 0.025, 0.12, 0.009, 0.03, 0.14, C(0.5, 0.12, 0.1), [-0.15, 0, 0]));      // old blood
    kit.grip = { pos: [0, -0.07, 0.03], rot: [0.9, 0, 0] };
  },

  // the coffin-bearer: huge, top hat, sleeveless coat (team), bare arms, the coffin
  coffin(kit) {
    const skin = C(0.66, 0.48, 0.36), mud = C(0.28, 0.2, 0.14);
    human(kit, { k: 1.35, trousers: C(0.2, 0.16, 0.13), boots: mud, bootTop: 0.4, skin, torso: C(0.18, 0.15, 0.13), sleeve: skin, fore: skin, hand: C(0.24, 0.17, 0.12) });
    face(kit, { skin, beard: C(0.18, 0.14, 0.11) });
    // muscle on the bare arms
    for (const s of [1, -1]) {
      const L = s > 0 ? 'L' : 'R';
      kit.add('plain', `sh${L}`, blob(s * 0.22, 1.36, 0.01, 0.085, skin, [1, 1.5, 1]));
      kit.add('plain', `el${L}`, blob(s * 0.22, 1.02, 0.02, 0.07, skin, [1, 1.6, 1]));
    }
    // the long sleeveless coat, open at the front, to the knees, torn at the hem and armholes
    kit.add('team', 'chest', skirt({ top: 1.6, bottom: 1.05, rTop: 0.25, rBot: 0.26, from: Math.PI * 0.2, arc: Math.PI * 1.6, ragged: 0, seed: 31, col: C(0.8, 0.78, 0.74) }));
    kit.add('team', 'hips', skirt({ top: 1.08, bottom: 0.4, rTop: 0.26, rBot: 0.38, from: Math.PI * 0.16, arc: Math.PI * 1.68, ragged: 0.12, seed: 32, col: C(0.74, 0.72, 0.68) }));
    for (const s of [1, -1]) kit.add('team', 'chest', blob(s * 0.25, 1.56, 0, 0.1, C(0.8, 0.78, 0.74), [1.2, 0.6, 1.1], 7, 5));
    // belt, buckle, the little spade at the back
    kit.add('plain', 'hips', cyl(0, 0.98, 0, 0.215, 0.215, 0.08, C(0.24, 0.16, 0.1), [0, 0, 0], 10));
    kit.add('metal', 'hips', box(0, 0.98, 0.22, 0.08, 0.07, 0.02, C(0.55, 0.5, 0.42)));
    kit.add('wood', 'hips', box(0.1, 0.9, -0.24, 0.03, 0.4, 0.03, C(0.35, 0.24, 0.15), [0, 0, -0.2]));
    kit.add('metal', 'hips', box(0.15, 0.68, -0.25, 0.12, 0.14, 0.015, C(0.45, 0.35, 0.28), [0, 0, -0.2]));
    // the battered top hat
    kit.add('plain', 'head', cyl(0, 1.89, 0.03, 0.22, 0.22, 0.02, C(0.2, 0.15, 0.12), [0.06, 0, 0], 10));
    kit.add('plain', 'head', cyl(0, 2.01, 0.03, 0.13, 0.14, 0.24, C(0.22, 0.17, 0.13), [0.06, 0, 0.04], 9));
    kit.add('plain', 'head', cyl(0, 1.93, 0.03, 0.142, 0.142, 0.04, C(0.12, 0.09, 0.07), [0.06, 0, 0.04], 9));
    coffinWeapon(kit);
    kit.grip = { pos: [-0.33, 0.06, 0.0], rot: [0, 0, 0] };
    kit.scale = 1.12;
  },

  // the wick-bearer: a tall candle for a head, dark frock coat with team lining, sash and wraps,
  // spare candles at the belt, a burning censer on a chain
  wick(kit) {
    const coat = C(0.14, 0.13, 0.13), wax = C(0.9, 0.86, 0.74), glove = C(0.12, 0.1, 0.09);
    human(kit, { k: 0.88, trousers: C(0.1, 0.1, 0.1), boots: C(0.16, 0.12, 0.1), bootTop: 0.4, pointy: true, skin: wax, torso: coat, sleeve: coat, fore: coat, hand: glove, head: false });
    // the frock coat: dark outside, the lining (team) showing at the open front and the tails
    kit.add('plain', 'hips', skirt({ top: 1.1, bottom: 0.3, rTop: 0.19, rBot: 0.34, from: Math.PI * 0.16, arc: Math.PI * 1.68, ragged: 0.14, seed: 41, col: coat }));
    kit.add('team', 'hips', skirt({ top: 1.08, bottom: 0.34, rTop: 0.18, rBot: 0.325, from: Math.PI * 0.12, arc: Math.PI * 1.76, ragged: 0.12, seed: 41, col: C(0.7, 0.7, 0.7) }));
    kit.add('team', 'hips', cyl(0, 1.03, 0, 0.165, 0.165, 0.11, C(1, 1, 1), [0, 0, 0], 10));          // sash
    kit.add('team', 'hips', box(-0.12, 0.84, 0.15, 0.08, 0.32, 0.02, C(0.95, 0.95, 0.95), [0, 0, 0.1]));
    for (const s of [1, -1]) kit.add('team', `el${s > 0 ? 'L' : 'R'}`, seg(V(s * 0.215, 0.95, 0.015), V(s * 0.22, 0.87, 0.02), 0.05, 0.05, 0xffffff));
    for (const s of [1, -1]) {
      kit.add('team', 'chest', box(s * 0.09, 1.3, 0.175, 0.07, 0.56, 0.015, C(0.92, 0.92, 0.92), [0.08, 0, s * 0.05]));       // scarf ends down the front
      kit.add('team', 'hips', box(s * 0.06, 0.66, -0.2, 0.08, 0.66, 0.015, C(0.85, 0.85, 0.85), [-0.12, 0, s * 0.06]));        // sash tails down the back
    }
    // high collar and the candle head with its drips
    kit.add('plain', 'chest', part(new THREE.CylinderGeometry(0.15, 0.1, 0.18, 9, 1, true), coat, { pos: [0, 1.66, 0] }));
    kit.add('plain', 'head', cyl(0, 1.84, 0.03, 0.085, 0.095, 0.38, wax, [0, 0, 0], 9));
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9 + 0.4, r = 0.09;
      kit.add('plain', i < 4 ? 'head' : 'chest', blob(Math.cos(a) * r, (i < 4 ? 1.74 : 1.6) - (i % 3) * 0.04, 0.03 + Math.sin(a) * r, 0.025, C(0.93, 0.9, 0.8), [0.7, 2.6, 0.7], 5, 4));
    }
    kit.add('plain', 'head', cyl(0, 2.03, 0.03, 0.004, 0.004, 0.04, C(0.1, 0.08, 0.06), [0, 0, 0], 3));
    kit.add('glow', 'head', part(new THREE.ConeGeometry(0.05, 0.16, 6), C(1.9, 1.0, 0.4), { pos: [0, 2.13, 0.03] }));
    kit.add('glow', 'head', blob(0, 2.08, 0.03, 0.045, C(2, 1.5, 0.7), [1, 1.2, 1], 5, 4));
    kit.glows = [['head', [0, 2.1, 0.03], 'candleSprite', 1.4]];
    // spare candles at the belt
    for (let i = 0; i < 4; i++) kit.add('plain', 'hips', cyl(0.06 + i * 0.045, 0.9 - (i % 2) * 0.03, 0.15, 0.018, 0.018, 0.14, wax, [0, 0, 0], 6));
    // the censer on its chain, hanging from the right hand
    for (let i = 0; i < 6; i++) kit.wpn('metal', part(new THREE.TorusGeometry(0.022, 0.006, 3, 6), C(0.45, 0.43, 0.4), { pos: [0, -0.05 - i * 0.07, 0], rot: [0, i % 2 ? Math.PI / 2 : 0, 0] }));
    kit.wpn('metal', part(new THREE.LatheGeometry([[0.01, 0], [0.09, 0.03], [0.13, 0.12], [0.12, 0.2], [0.07, 0.25], [0.02, 0.3]].map(([x, y]) => new THREE.Vector2(x, y)), 9), C(0.72, 0.56, 0.3), { pos: [0, -0.78, 0] }));
    kit.wpn('metal', part(new THREE.ConeGeometry(0.03, 0.1, 6), C(0.6, 0.46, 0.25), { pos: [0, -0.82, 0], rot: [Math.PI, 0, 0] }));
    kit.wpn('glow', blob(0, -0.65, 0, 0.075, C(1.9, 0.8, 0.25), [1, 0.8, 1], 6, 4));
    kit.grip = { pos: [0, -0.08, 0.02], rot: [0, 0, 0] };
    kit.weaponGlow = [[0, -0.65, 0], 'fireSprite', 0.9];
    kit.scale = 1.08;
  },
};
export const HERO_KINDS = Object.keys(HEROES);

// ---------------------------------------------------------------- assembly
function rig(groups, mats, layout = BONES) {
  const root = new THREE.Group(), bones = {};
  for (const name of NAMES) {
    const parent = BONES[name][0], [x, y, z] = layout === BONES ? BONES[name].slice(1) : layout[name], b = new THREE.Bone();
    b.name = name;
    if (parent) { const [px, py, pz] = layout === BONES ? BONES[parent].slice(1) : layout[parent]; b.position.set(x - px, y - py, z - pz); bones[parent].add(b); }
    else { b.position.set(x, y, z); root.add(b); }
    bones[name] = b;
  }
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(NAMES.map((n) => bones[n]));
  for (const [key, list] of Object.entries(groups)) {
    if (!list.length) continue;
    const geoms = list.map(([bone, g]) => {
      if (g.userData.skin) return [g, g.userData.skin.si, g.userData.skin.sw];      // an imported model: weights per vertex
      const n = g.attributes.position.count, bi = NAMES.indexOf(bone);
      const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
      return [g, si, sw];
    });
    const merged = mergeGeometries(geoms.map(([g]) => g));
    const total = merged.attributes.position.count, si = new Uint16Array(total * 4), sw = new Float32Array(total * 4);
    let o = 0;
    for (const [, a, b] of geoms) { si.set(a, o); sw.set(b, o); o += a.length; }
    merged.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    merged.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    const mesh = new THREE.SkinnedMesh(merged, mats[key]);
    mesh.bind(skeleton, new THREE.Matrix4());
    mesh.frustumCulled = false;
    root.add(mesh);
  }
  const rest = {};
  for (const n of NAMES) rest[n] = bones[n].position.clone();
  return { root, bones, rest };
}

// kind: one of HERO_KINDS; team: THREE.Color (the base's colour)
// ---------------------------------------------------------------- imported models
// Heroes made from a real model (tools/import-hero.mjs → assets/heroes/<kind>.json) replace the
// primitive ones once loaded. Each triangle carries its colour, material group and bone.
const ASSETS = {};
export async function loadHeroAssets() {
  await Promise.all(HERO_KINDS.map(async (kind) => {
    try {
      const res = await fetch(`assets/heroes/${kind}.json`);
      if (res.ok) ASSETS[kind] = await res.json();
      // a textured model: have its texture in hand before anyone is built from it
      const a = ASSETS[kind];
      if (a?.tex) await texMat({ url: `assets/heroes/${a.tex}`, alphaTest: a.alphaTest }).map.loadPromise;
    } catch { /* no model for this path yet: the primitive hero stands in */ }
  }));
  return Object.keys(ASSETS);
}
const unb64 = (s, T) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new T(u.buffer); };

// things the model lacks that the game adds (the wanderer's moon-lantern, the coffin and a team sash)
const EXTRAS = {
  coffin(kit) {
    coffinWeapon(kit);
    kit.grip = { pos: [-0.33, 0.06, 0.0], rot: [0, 0, 0] };
    // the coat is near-black: a sash and armbands in the base's colour say whose side he is on
    kit.add('team', 'chest', box(0, 1.3, -0.04, 0.46, 0.09, 0.3, C(0.9, 0.9, 0.9), [0, 0, 0.55]));
    kit.add('team', 'hips', box(0, 0.98, -0.04, 0.4, 0.07, 0.3, C(0.85, 0.85, 0.85)));
    for (const [b, x] of [['elL', 0.24], ['elR', -0.24]]) kit.add('team', b, box(x, 1.12, -0.08, 0.13, 0.07, 0.13, C(0.9, 0.9, 0.9)));
    kit.glows = [['head', [0, 2.2, -0.05], 'candleSprite', 0.9]];          // the candles on his cage
    kit.scale = 0.95;
  },
  // the knight's plate is dark and worn: the longsword, the moon-lantern at the hip, and a sash and
  // armband in the base's colour so allies and enemies can be told apart
  wanderer(kit) {
    kit.add('metal', 'hips', box(0.27, 0.78, 0.07, 0.11, 0.02, 0.11, C(0.3, 0.3, 0.32)));
    kit.add('metal', 'hips', box(0.27, 0.64, 0.07, 0.11, 0.02, 0.11, C(0.3, 0.3, 0.32)));
    kit.add('metal', 'hips', seg(V(0.21, 0.92, 0.07), V(0.27, 0.79, 0.07), 0.008, 0.008, C(0.35, 0.35, 0.37), 4));
    kit.add('glow', 'hips', box(0.27, 0.71, 0.07, 0.085, 0.12, 0.085, C(0.6, 0.95, 1.6)));
    kit.glows = [['hips', [0.27, 0.71, 0.07], 'sprite', 1.1]];
    // a tabard over the breastplate and a band round the left arm
    kit.add('team', 'chest', box(0, 1.17, 0.165, 0.2, 0.34, 0.02, C(0.9, 0.9, 0.9)));
    kit.add('team', 'hips', box(0, 0.86, 0.17, 0.18, 0.2, 0.02, C(0.82, 0.82, 0.82)));
    kit.add('team', 'shL', box(0.222, 1.27, -0.03, 0.11, 0.06, 0.11, C(0.9, 0.9, 0.9), [0, 0, 0.2]));
    kit.wpn('metal', box(0, 0, 0.5, 0.055, 0.012, 0.9, C(0.72, 0.75, 0.8)));
    kit.wpn('metal', part(new THREE.ConeGeometry(0.039, 0.12, 4), C(0.72, 0.75, 0.8), { pos: [0, 0, 1.0], rot: [Math.PI / 2, Math.PI / 4, 0], scale: [1, 1, 0.3] }));
    kit.wpn('metal', box(0, 0, 0.06, 0.22, 0.03, 0.04, C(0.45, 0.42, 0.38)));
    kit.wpn('plain', box(0, 0, -0.05, 0.035, 0.035, 0.18, C(0.2, 0.13, 0.09)));
    kit.wpn('metal', blob(0, 0, -0.15, 0.035, C(0.7, 0.55, 0.3)));
    kit.grip = { pos: [0, -0.06, 0.02], rot: [0.6, 0, 0] };
    kit.scale = 1.08;
  },
};

function assetKit(a) {
  const kit = new Kit(), pos = unb64(a.pos, Float32Array), col = unb64(a.col, Uint8Array), grp = unb64(a.grp, Uint8Array), bone = unb64(a.bone, Uint8Array);
  const uvs = a.uv ? unb64(a.uv, Float32Array) : null;      // a textured model keeps its own UVs
  const skin = a.skin ? unb64(a.skin, Uint8Array) : null;
  // one geometry per material group (per bone for old files), box-projected UVs so the cloth/iron textures show
  const buckets = {};
  for (let t = 0; t < a.tris; t++) {
    const key = `${a.groups[grp[t]]}|${skin ? 'hips' : a.boneOrder[bone[t]]}`;
    (buckets[key] = buckets[key] || []).push(t);
  }
  for (const [key, list] of Object.entries(buckets)) {
    const [g, b] = key.split('|');
    const P = new Float32Array(list.length * 9), Cc = new Float32Array(list.length * 9), U = new Float32Array(list.length * 6);
    list.forEach((t, i) => {
      P.set(pos.subarray(t * 9, t * 9 + 9), i * 9);
      for (let v = 0; v < 3; v++) Cc.set([col[t * 3] / 255, col[t * 3 + 1] / 255, col[t * 3 + 2] / 255], i * 9 + v * 3);
      const ax = P[i * 9 + 3] - P[i * 9], ay = P[i * 9 + 4] - P[i * 9 + 1], az = P[i * 9 + 5] - P[i * 9 + 2];
      const bx = P[i * 9 + 6] - P[i * 9], by = P[i * 9 + 7] - P[i * 9 + 1], bz = P[i * 9 + 8] - P[i * 9 + 2];
      const nx = Math.abs(ay * bz - az * by), ny = Math.abs(az * bx - ax * bz), nz = Math.abs(ax * by - ay * bx);
      for (let v = 0; v < 3; v++) {
        const x = P[i * 9 + v * 3], y = P[i * 9 + v * 3 + 1], z = P[i * 9 + v * 3 + 2];
        const [u0, u1] = nx >= ny && nx >= nz ? [z, y] : ny >= nz ? [x, z] : [x, y];
        U[i * 6 + v * 2] = u0 * 2.5; U[i * 6 + v * 2 + 1] = u1 * 2.5;
      }
      if (uvs && g === 'tex') U.set(uvs.subarray(t * 6, t * 6 + 6), i * 6);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(Cc, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    geo.computeVertexNormals();          // flat faces: the faceted PS2 look
    if (skin) {
      const si = new Uint16Array(list.length * 12), sw = new Float32Array(list.length * 12);
      list.forEach((t, i) => {
        for (let v = 0; v < 3; v++) {
          const [b1, b2, w] = skin.subarray(t * 9 + v * 3, t * 9 + v * 3 + 3), o = (i * 3 + v) * 4;
          si[o] = NAMES.indexOf(a.boneOrder[b1]); si[o + 1] = NAMES.indexOf(a.boneOrder[b2]);
          sw[o] = 1 - w / 255; sw[o + 1] = w / 255;
        }
      });
      geo.userData.skin = { si, sw };
    }
    kit.add(g, b, geo);
  }
  kit.rest = a.bones;
  kit.grip = { pos: [0, 0, 0], rot: [0, 0, 0] };   // the weapon is part of the model
  if (a.tex) kit.texture = { url: `assets/heroes/${a.tex}`, alphaTest: a.alphaTest };
  EXTRAS[a.kind]?.(kit);
  return kit;
}

// a model's own texture, lit, fogged and vertex-snapped like everything else (one per file)
const TEXMATS = {};
function texMat({ url, alphaTest }) {
  if (!TEXMATS[url]) {
    let done;
    const map = new THREE.TextureLoader().load(url, () => done(), undefined, () => done());
    map.loadPromise = new Promise((r) => { done = r; });
    map.magFilter = THREE.NearestFilter; map.colorSpace = THREE.NoColorSpace;
    TEXMATS[url] = ps2ify(new THREE.MeshLambertMaterial({ map, alphaTest, side: THREE.DoubleSide, color: new THREE.Color(1.35, 1.3, 1.3) }));
  }
  return TEXMATS[url];
}

export function createHero(kind, M, team) {
  let kit;
  if (ASSETS[kind]) kit = assetKit(ASSETS[kind]);
  else { kit = new Kit(); (HEROES[kind] || HEROES.wanderer)(kit); }
  // the team cloth: plain weave dyed in the base's colour, kept light so it reads in the dark
  const teamMat = M.plain.clone();
  teamMat.color.copy(team).multiplyScalar(0.9).lerp(new THREE.Color(0.5, 0.5, 0.5), 0.18);
  teamMat.side = THREE.DoubleSide;
  // coats and robes are open shells: show their insides too
  if (!M.plainTwoSided) { M.plainTwoSided = M.plain.clone(); M.plainTwoSided.side = THREE.DoubleSide; }
  const mats = { plain: M.plainTwoSided, metal: M.metal, wood: M.wood, gold: M.gold, team: teamMat, glow: M.glow, tex: kit.texture ? texMat(kit.texture) : M.plain };
  const r = rig(kit.parts, mats, kit.rest || BONES);
  const obj = new THREE.Group();
  obj.add(r.root);
  // the weapon rides on the right hand
  const weapon = new THREE.Group();
  for (const [key, list] of Object.entries(kit.weapon)) if (list.length) weapon.add(new THREE.Mesh(mergeGeometries(list), mats[key]));
  const gr = kit.grip || { pos: [0, -0.06, 0], rot: [0, 0, 0] };
  weapon.position.set(...gr.pos);
  weapon.rotation.set(...gr.rot);
  if (kit.weaponGlow) {
    const [p, mat, s] = kit.weaponGlow, sp = new THREE.Sprite(M[mat]);
    sp.position.set(...p); sp.scale.setScalar(s); weapon.add(sp);
  }
  r.bones.haR.add(weapon);
  for (const [bone, p, mat, s] of kit.glows || []) {
    const sp = new THREE.Sprite(M[mat]), b = kit.rest ? V(...kit.rest[bone]) : P(bone);
    sp.position.set(p[0] - b.x, p[1] - b.y, p[2] - b.z);
    sp.scale.setScalar(s);
    r.bones[bone].add(sp);
  }
  r.root.scale.setScalar(kit.scale || 1);
  obj.userData = { kind, rig: r, weapon, grip: gr, teamMat, gait: Math.random() * 6, swing: 0, heavy: false, block: 0, t: Math.random() * 10 };
  return obj;
}

// ---------------------------------------------------------------- animation
const ease = (x) => x * x * (3 - 2 * x);

// s: { speed m/s, action 0 none | 1 light | 2 heavy | 3 block }
export function animateHero(obj, dt, s) {
  const u = obj.userData, r = u.rig, b = r.bones, kind = u.kind;
  for (const n of NAMES) { b[n].rotation.set(0, 0, 0); b[n].position.copy(r.rest[n]); }
  u.t += dt;
  const m = clamp(s.speed / 3.2, 0, 1.6), run = clamp((s.speed - 3.5) / 2.5, 0, 1);
  u.gait += dt * (2 + s.speed * 2.1);
  const ph = u.gait, sw = Math.sin(ph), mm = Math.min(1, m);
  // legs and the counter-swing of the arms
  b.hiL.rotation.x = -sw * 0.55 * mm; b.hiR.rotation.x = sw * 0.55 * mm;
  b.knL.rotation.x = Math.max(0, Math.cos(ph)) * 0.95 * mm; b.knR.rotation.x = Math.max(0, -Math.cos(ph)) * 0.95 * mm;
  b.hips.position.y += Math.abs(Math.cos(ph)) * 0.035 * mm - 0.02 * run;
  b.spine.rotation.x = 0.06 * mm + 0.14 * run;
  b.shL.rotation.x = sw * 0.45 * mm; b.shL.rotation.z = 0.08;
  b.elL.rotation.x = -0.25 - 0.4 * run;
  b.shR.rotation.x = -sw * 0.25 * mm - 0.1; b.shR.rotation.z = -0.1;
  b.elR.rotation.x = -0.35;
  // breathing at rest
  b.chest.rotation.x = Math.sin(u.t * 1.7) * 0.025 * (1 - mm);
  b.head.rotation.x = -0.05;
  // astride a mount: thighs forward and apart, shins hanging down its flanks
  if (s.ride) {
    b.hiL.rotation.set(-1.35, 0, 0.6); b.hiR.rotation.set(-1.35, 0, -0.6);
    b.knL.rotation.x = 1.25; b.knR.rotation.x = 1.25;
    b.spine.rotation.x = 0.12;
  }
  if (kind === 'coffin') { b.shR.rotation.z = -0.22; b.elR.rotation.x = -0.1; }
  if (kind === 'wick') { b.shR.rotation.x -= 0.15; b.elR.rotation.x = -0.9; }      // the censer held out in front
  if (kind === 'leech') { b.spine.rotation.x += 0.12; b.neck.rotation.x = 0.15; }   // the stoop

  // a blow: wind up, then cut through
  if (s.action === 1 || s.action === 2) { if (u.swing <= 0) { u.swing = 1; u.heavy = s.action === 2; } }
  if (u.swing > 0) {
    u.swing = Math.max(0, u.swing - dt * (u.heavy ? 1.6 : 2.6));
    const p = 1 - u.swing, big = u.heavy ? 1.25 : 1;
    const up = p < 0.35 ? ease(p / 0.35) : 1 - ease(Math.min(1, (p - 0.35) / 0.35));
    const cut = p < 0.35 ? 0 : ease(Math.min(1, (p - 0.35) / 0.4));
    if (kind === 'wick') {
      // the censer whirls round on its chain
      b.shR.rotation.x = -1.5; b.shR.rotation.z = -0.3; b.elR.rotation.x = -0.1;
      b.chest.rotation.y = -p * Math.PI * 2 * (u.heavy ? 2 : 1);
    } else if (kind === 'coffin') {
      b.shR.rotation.x = -0.4 - up * 1.4 * big; b.shR.rotation.z = -0.2 - cut * 0.4;
      b.shL.rotation.x = -0.6 - up * 1.2; b.elL.rotation.x = -0.6;
      b.chest.rotation.y = up * 0.6 - cut * 1.2 * big;
    } else {
      b.shR.rotation.x = -0.3 - up * 2.4 * big + cut * 0.6; b.shR.rotation.z = -0.3 * up + cut * 0.9;
      b.elR.rotation.x = -0.2 - up * 0.6;
      b.chest.rotation.y = up * 0.35 - cut * 0.7 * big;
      b.spine.rotation.x += cut * 0.2;
    }
  }
  // guard
  u.block += ((s.action === 3 ? 1 : 0) - u.block) * Math.min(1, dt * 12);
  const g = u.block, w = u.weapon;
  w.rotation.set(...u.grip.rot);
  if (g > 0.01) {
    if (kind === 'coffin') {          // the coffin raised upright in front as a wall
      b.shR.rotation.x += (-1.25 - b.shR.rotation.x) * g; b.shR.rotation.z += (0.45 - b.shR.rotation.z) * g; b.elR.rotation.x += (-0.25 - b.elR.rotation.x) * g;
      b.shL.rotation.x += (-1.1 - b.shL.rotation.x) * g; b.elL.rotation.x += (-0.5 - b.elL.rotation.x) * g;
      w.rotation.x += 1.5 * g; w.rotation.y += -1.2 * g;
    } else if (kind === 'bell') {     // the hammer's haft held across the body
      b.shR.rotation.x += (-0.9 - b.shR.rotation.x) * g; b.shR.rotation.z += (0.3 - b.shR.rotation.z) * g; b.elR.rotation.x += (-1.0 - b.elR.rotation.x) * g;
      w.rotation.z += 1.3 * g;
    } else if (kind === 'wick') {     // a hand cupped over the flame
      b.shL.rotation.x += (-2.7 - b.shL.rotation.x) * g; b.shL.rotation.z += (-0.5 - b.shL.rotation.z) * g; b.elL.rotation.x += (-1.4 - b.elL.rotation.x) * g;
    } else {                          // the weapon held across the body
      b.shR.rotation.x += (-1.2 - b.shR.rotation.x) * g; b.shR.rotation.z += (0.5 - b.shR.rotation.z) * g; b.elR.rotation.x += (-0.9 - b.elR.rotation.x) * g;
    }
  }
}
