// "Siege of the Moon Kings": the online free-for-all mode. Up to four players (empty seats are
// filled by bot lords) each hold a base in a corner of the arena (src/arena.js) with a king on a
// throne, a few towers at the road mouths, a healing fire and a mine to start with. Gather wood,
// ore and souls in the wilds, raise buildings inside your base, summon packs of creatures that
// march on another king, and fight in first person with your path's weapon. The last king alive
// wins.
//
// The host runs the match: creeps, buildings, kings and bots live on the host, which streams
// snapshots ten times a second. Every player moves their own hero and reports where it is; blows
// are judged by the attacker and sent to the host, which applies them. Gathering is local (each
// player has their own logs and rocks), so is the wild bestiary, which pays out souls.
import * as THREE from 'three';
import { part, mergeGeometries, clamp } from './util.js';
import { createPatron } from './characters.js';
import { createHero, animateHero } from './heroes.js';
import { createMountBody, animateMountBody, MOUNT } from './mount.js';
import { ENEMY_TYPES } from './combat.js';
import { CLASSES } from './classes.js';
import { rng } from './noise.js';
import { clearVegetation } from './vegetation.js';
import { ARENA_BASES, ARENA_ROADS, PLAZA_R, adjacent, roadOut } from './arena.js';
import { L } from './i18n.js';

const C = (r, g, b) => new THREE.Color(r, g, b);
const V = new THREE.Vector3();

export const SEATS = [
  { name: L('แดง', 'Red'), th: 'แดง', en: 'Red', color: [0.85, 0.22, 0.18], css: '#e0533f', base: ARENA_BASES[0] },
  { name: L('ฟ้า', 'Blue'), th: 'ฟ้า', en: 'Blue', color: [0.25, 0.48, 0.98], css: '#5a8cff', base: ARENA_BASES[1] },
  { name: L('เขียว', 'Green'), th: 'เขียว', en: 'Green', color: [0.3, 0.78, 0.32], css: '#56cc56', base: ARENA_BASES[2] },
  { name: L('ทอง', 'Gold'), th: 'ทอง', en: 'Gold', color: [0.98, 0.78, 0.22], css: '#f2c84a', base: ARENA_BASES[3] },
];
const HUB = [0, 0];
export const BASE_R = 30;
const PVP = 9;                 // a sword blow that takes 1 from a gaunt takes 9 from a player
const UNIT = 1 / 8;            // creature damage (tuned against players) scaled to creatures/buildings
const MAX_CREEPS = 14;

export const RES = { wood: L('ไม้', 'wood'), ore: L('แร่', 'ore'), soul: L('วิญญาณ', 'souls'), xp: 'XP' };
const START_WALLET = { wood: 80, ore: 30, soul: 6 };

export const BUILDINGS = {
  tower: { name: L('หอคอยธนู', 'Arrow Tower'), th: 'หอคอยธนู', en: 'Arrow Tower', cost: { wood: 40, ore: 15 }, hp: 30, r: 1.5, time: 8, desc: L('ยิงธนูใส่ศัตรูในระยะ 24 เมตร', 'Looses arrows at foes within 24 metres.') },
  camp: { name: L('แคมป์ไฟฮีล', 'Healing Campfire'), th: 'แคมป์ไฟฮีล', en: 'Healing Campfire', cost: { wood: 25 }, hp: 14, r: 1.3, time: 5, desc: L('ฟื้นเลือดเจ้าและครีปของเจ้าในรัศมี 9 เมตร', 'Mends you and your creeps within 9 metres.') },
  mine: { name: L('เหมืองและโรงเลื่อย', 'Mine and Sawmill'), th: 'เหมืองและโรงเลื่อย', en: 'Mine and Sawmill', cost: { wood: 30 }, hp: 18, r: 1.6, time: 6, desc: L('ได้ +4 ไม้ +2 แร่ ทุก 8 วินาที', '+4 wood and +2 ore every 8 seconds.') },
  wall: { name: L('กำแพงไม้', 'Wooden Wall'), th: 'กำแพงไม้', en: 'Wooden Wall', cost: { wood: 12 }, hp: 26, r: 1.4, time: 3, desc: L('ขวางทางครีปศัตรู มันต้องพังก่อนถึงจะผ่าน', 'Bars the path of enemy creeps. They must break it to pass.') },
  trap: { name: L('กับดักหนาม', 'Spike Trap'), th: 'กับดักหนาม', en: 'Spike Trap', cost: { wood: 8, ore: 6 }, hp: 6, r: 0.9, time: 2, desc: L('แทงศัตรูที่เหยียบ ใช้ได้ 4 ครั้ง', 'Pierces foes that tread on it. 4 uses.') },
  decoy: { name: L('หุ่นฟางล่อเป้า', 'Straw Decoy'), th: 'หุ่นฟางล่อเป้า', en: 'Straw Decoy', cost: { wood: 15 }, hp: 22, r: 0.8, time: 3, desc: L('ครีปศัตรูที่เห็นจะหันมาตีหุ่นก่อนทุกอย่าง', 'Enemy creeps that see it strike it before all else.') },
  bell: { name: L('หอระฆังเตือนภัย', 'Warning Bell Tower'), th: 'หอระฆังเตือนภัย', en: 'Warning Bell Tower', cost: { ore: 20 }, hp: 14, r: 1.1, time: 5, desc: L('ตีระฆังเตือนเมื่อศัตรูบุกเข้าฐาน', 'Tolls when foes breach your base.') },
  nest: { name: L('รังเพาะร่างยักษ์', 'Brute Brood-Nest'), th: 'รังเพาะร่างยักษ์', en: 'Brute Brood-Nest', cost: { wood: 40, soul: 12 }, hp: 24, r: 2.0, time: 10, desc: L('ปลดล็อกร่างยักษ์ และครีปทุกตัวเลือด +25%', 'Unlocks the Brute, and every creep gains +25% health.') },
};
const BTYPES = Object.keys(BUILDINGS);

export const CREEPS = {
  gaunt: { name: L('ร่างซูบ', 'Gaunt'), cost: { soul: 2, wood: 6 }, count: 3, desc: L('ทหารราบ 3 ตัว วิ่งเร็วเมื่อใกล้เป้า', '3 foot soldiers. They quicken near their mark.') },
  crawler: { name: L('ร่างคลาน', 'Crawler'), cost: { soul: 2, ore: 4 }, count: 3, desc: L('คลานเร็ว 3 ตัว ตีเบาแต่ถี่', '3 swift crawlers. Light blows, but many.') },
  wolf: { name: L('หมาป่าเงา', 'Shadow Wolf'), cost: { soul: 3, wood: 8 }, count: 2, desc: L('หมาป่า 2 ตัว เร็วที่สุด', '2 wolves. The swiftest of all.') },
  brute: { name: L('ร่างยักษ์', 'Brute'), cost: { soul: 8, ore: 10 }, count: 1, needs: 'nest', desc: L('ยักษ์ถึก 1 ตัว ทุบอาคารแรงมาก (ต้องมีรังเพาะ)', '1 hulking brute. Smashes buildings hard (needs a Brood-Nest).') },
};
const CTYPES = Object.keys(CREEPS);
const STATES = ['chase', 'windup', 'strike', 'recover', 'stagger', 'dying'];

const KING = { hp: 90, range: 4.2, dmg: 22, every: 2.2 };
// bot lords also walk the field as heroes: they guard their base, march behind their waves and
// fight whatever is in reach (run by the host like the creeps)
const BOT_HERO = { hp: 100, speed: 4.6, run: 5.6, reach: 2.4, every: 1.45, vsHero: 13, vsUnit: 1.3, respawn: 12, guard: 34 };

export const canPay = (w, cost) => Object.entries(cost).every(([k, n]) => (w[k] || 0) >= n);
export const pay = (w, cost) => { for (const [k, n] of Object.entries(cost)) w[k] -= n; };
export const costText = (cost) => Object.entries(cost).map(([k, n]) => `${n} ${RES[k]}`).join(' · ');

// where a hero (re)appears: just in front of the throne, facing the plaza
export function baseSpawn(slot) {
  const [bx, bz] = SEATS[slot].base, d = Math.hypot(bx, bz);
  return [bx - bx / d * 8, bz - bz / d * 8, Math.atan2(bx, bz)];
}

// the buildings every base starts with: two towers, a healing fire, a mine. Each tower stands
// between the road to the plaza and one ring road, so the pair covers all three ways in.
function startingBuildings(slot) {
  const [bx, bz] = SEATS[slot].base, list = [];
  const [cx, cz] = roadOut(slot, 'c');
  for (const [a, b] of ARENA_ROADS) {
    if ((a !== slot && b !== slot) || a === 'c' || b === 'c') continue;
    const [rx, rz] = roadOut(slot, a === slot ? b : a), l = Math.hypot(rx + cx, rz + cz), ux = (rx + cx) / l, uz = (rz + cz) / l;
    list.push(['tower', bx + ux * 19, bz + uz * 19, Math.atan2(ux, uz)]);
  }
  const d = Math.hypot(bx, bz), ix = -bx / d, iz = -bz / d;
  list.push(['camp', bx + ix * 12 + iz * 7, bz + iz * 12 - ix * 7, 0]);
  list.push(['mine', bx - ix * 12 + iz * 9, bz - iz * 12 - ix * 9, Math.atan2(ix, iz)]);
  return list;
}

// ------------------------------------------------------------------------------------------------
export class Moba {
  // roster: [{ slot, name, cls, bot, peer }], me: my slot
  constructor(game, net, roster, me) {
    this.g = game;
    this.net = net;
    this.host = !net || net.isHost;
    this.me = me;
    this.P = [];
    // bots hold their first wave for two minutes so players have time to build
    for (const r of roster) this.P[r.slot] = { ...r, x: 0, y: 0, z: 0, yaw: 0, hp: 100, dead: false, alive: true, sw: 0, sn: 0, wallet: { ...START_WALLET }, aiT: 2 + r.slot, waveT: 120 + r.slot * 12 };
    this.wallet = { ...START_WALLET };
    this.S = new Map();       // structures
    this.Cr = new Map();      // creeps (combat enemies with .moba)
    this.K = [];              // kings
    this.avatars = new Map();
    this.nextId = 1;
    this.snapT = 0;
    this.sendT = 0;
    this.shots = [];
    this.arrows = [];
    this.over = false;
    this.respawnT = 0;
    this.alarmT = 0;
    this.buildBases();
    this.buildNodes();
    // the host lays out every base's starting buildings; the snapshots carry them to the others
    if (this.host) {
      for (const p of this.P) {
        if (!p) continue;
        for (const [type, x, z, ry] of startingBuildings(p.slot)) this.placeBuilding(type, p.slot, x, z, ry).built = 1;
      }
    }
    if (net) net.on('message', (m, from) => this.onMessage(m, from)).on('leave', (peer) => this.onLeave(peer)).on('hostLeft', () => this.onHostLeft());
  }

  get seat() { return SEATS[this.me]; }
  alive(slot) { return !!this.P[slot]?.alive; }
  aliveSlots() { return this.P.filter((p) => p && p.alive).map((p) => p.slot); }

  // ---------------------------------------------------------------- roads
  // points along a road from seat a to b (a seat or 'c', the plaza), every ~16 m
  roadPts(a, b) {
    const i = ARENA_ROADS.findIndex(([p, q]) => (p === a && q === b) || (p === b && q === a));
    const pts = this.g.terrain.roads?.[i];
    if (!pts) return [ARENA_ROADS[i][2].at(-1)];
    const list = ARENA_ROADS[i][0] === a ? pts : [...pts].reverse(), out = [];
    for (let k = 16; k < list.length; k += 16) out.push([list[k].x, list[k].z]);
    out.push([list.at(-1).x, list.at(-1).z]);
    return out;
  }

  // the way a creep marches: the ring road to a neighbour; to the far corner, through the plaza,
  // round the colossus on one side or the other
  route(owner, target, id = 0) {
    const end = SEATS[target].base;
    if (adjacent(owner, target)) return [...this.roadPts(owner, target), end];
    const R = 16, away = ([x, z]) => Math.hypot(x, z) > R + 4;
    const inn = this.roadPts(owner, 'c').filter(away), out = this.roadPts('c', target).filter(away);
    const a0 = Math.atan2(SEATS[owner].base[1], SEATS[owner].base[0]), side = id % 2 ? 1 : -1;
    const ring = [0, 1, 2, 3].map((q) => [Math.cos(a0 + side * q * Math.PI / 4) * R, Math.sin(a0 + side * q * Math.PI / 4) * R]);
    return [...inn, ...ring, ...out, end];
  }

  // compass and map pins: every base in its colour (yours is "home")
  markers() {
    return this.P.filter(Boolean).map((p) => {
      const [x, z] = SEATS[p.slot].base, mine = p.slot === this.me;
      return { x, z, label: mine ? L('ฐานเจ้า', 'Your Base') : L(`ฐาน${SEATS[p.slot].name}`, `${SEATS[p.slot].name} Base`) + (p.alive ? '' : ' ✝'), color: SEATS[p.slot].css, home: mine, dead: !p.alive };
    });
  }

  // ---------------------------------------------------------------- the world
  buildBases() {
    const g = this.g, M = g.M;
    for (const p of this.P) {
      if (!p) continue;
      const s = SEATS[p.slot], [x, z] = s.base, y = g.terrain.getHeight(x, z), col = C(...s.color);
      const grp = new THREE.Group();
      // dais and throne
      grp.add(new THREE.Mesh(mergeGeometries([
        part(new THREE.CylinderGeometry(4.2, 4.6, 0.6, 12), C(0.55, 0.55, 0.6), { pos: [0, 0.3, 0] }),
        part(new THREE.BoxGeometry(2.2, 0.5, 1.6), C(0.5, 0.48, 0.5), { pos: [0, 0.85, -0.4] }),
        part(new THREE.BoxGeometry(2.2, 3.2, 0.4), C(0.45, 0.42, 0.45), { pos: [0, 2.2, -1.1] }),
      ]), M.stone));
      grp.add(new THREE.Mesh(mergeGeometries([
        part(new THREE.BoxGeometry(1.6, 1.6, 0.08), col, { pos: [0, 2.5, -0.88] }),
        ...[-5.5, 5.5].map((bx) => part(new THREE.BoxGeometry(0.1, 1.6, 1.1), col, { pos: [bx, 4.3, 0] })),
      ]), M.cloth));
      grp.add(new THREE.Mesh(mergeGeometries([-5.5, 5.5].map((bx) => part(new THREE.CylinderGeometry(0.1, 0.12, 5.6, 6), C(0.4, 0.3, 0.2), { pos: [bx, 2.8, 0.55] }))), M.wood));
      for (const bx of [-2.6, 2.6]) {
        const f = new THREE.Sprite(M.fireSprite);
        f.position.set(bx, 1.6, 1.4);
        f.scale.setScalar(1.6);
        grp.add(f);
        grp.add(new THREE.Mesh(part(new THREE.CylinderGeometry(0.4, 0.25, 0.9, 7), C(0.4, 0.38, 0.36), { pos: [bx, 1.0, 1.4] }), M.metal));
      }
      // the king himself, crowned, in your colour
      const king = createPatron(M, col.clone().multiplyScalar(0.8), { hood: false, skin: C(0.62, 0.52, 0.45) });
      king.add(new THREE.Mesh(mergeGeometries([
        part(new THREE.CylinderGeometry(0.17, 0.15, 0.12, 8, 1, true), C(1, 0.8, 0.3), { pos: [0, 1.5, 0.04] }),
        ...[0, 1, 2, 3, 4].map((i) => part(new THREE.ConeGeometry(0.035, 0.12, 4), C(1, 0.85, 0.35), { pos: [Math.cos(i * 1.256) * 0.16, 1.6, 0.04 + Math.sin(i * 1.256) * 0.16] })),
      ]), M.gold));
      king.scale.setScalar(1.7);
      king.position.set(0, 1.1, -0.5);
      grp.add(king);
      // a ring of stones marking how far you may build
      const ring = new THREE.Mesh(new THREE.RingGeometry(BASE_R - 0.4, BASE_R, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.15;
      grp.add(ring);
      grp.position.set(x, y, z);
      grp.rotation.y = Math.atan2(HUB[0] - x, HUB[1] - z);
      g.scene.add(grp);
      // clear the woods for the base
      if (g.veg) clearVegetation(g.veg, M, x, z, BASE_R + 2);
      g.collision.clearCircles(x, z, BASE_R + 2);
      this.K[p.slot] = { hp: KING.hp, max: KING.hp, x, z, y, grp, king, cool: 0 };
    }
    // the wild near the bases (the stone knight too) is cleared so nobody starts under attack
    for (const e of g.combat.enemies) {
      if (e.moba) continue;
      if (this.K.some((k) => k && Math.hypot(e.home.x - k.x, e.home.z - k.z) < 60)) { e.alive = false; e.respawn = 1e9; e.obj.visible = false; if (e.shadow) e.shadow.visible = false; }
    }
  }

  // fallen logs and rocks: gathering is local to each player
  buildNodes() {
    const g = this.g, M = g.M, r = rng(4242);
    this.nodes = [];
    const logGeo = mergeGeometries([
      part(new THREE.CylinderGeometry(0.32, 0.36, 2.6, 7), C(0.45, 0.33, 0.22), { rot: [0, 0, Math.PI / 2] }),
      part(new THREE.CylinderGeometry(0.26, 0.3, 1.8, 6), C(0.4, 0.3, 0.2), { pos: [0.2, 0.42, 0.3], rot: [0.3, 0.6, Math.PI / 2] }),
    ]);
    const rockGeo = mergeGeometries([
      part(new THREE.DodecahedronGeometry(0.8, 0), C(0.45, 0.45, 0.5), { scale: [1.2, 0.8, 1] }),
      part(new THREE.DodecahedronGeometry(0.45, 0), C(0.6, 0.62, 0.72), { pos: [0.6, 0.3, 0.2] }),
    ]);
    const spots = [];
    for (const k of this.K) {
      if (!k) continue;
      for (let i = 0; i < 16; i++) spots.push([k.x, k.z, 36 + r() * 50]);
    }
    for (let i = 0; i < 30; i++) spots.push([HUB[0], HUB[1], 40 + r() * 110]);
    let n = 0;
    for (const [cx, cz, rad] of spots) {
      for (let t = 0; t < 8; t++) {
        const a = r() * Math.PI * 2, x = cx + Math.cos(a) * rad, z = cz + Math.sin(a) * rad;
        const h = g.terrain.getHeight(x, z);
        if (h < 0.5 || Math.abs(x) > 195 || Math.abs(z) > 195 || g.terrain.roadAt?.(x, z) > 0.2 || Math.hypot(x, z) < PLAZA_R + 4) continue;
        if (this.K.some((k) => k && Math.hypot(x - k.x, z - k.z) < BASE_R + 3)) continue;
        const kind = n++ % 3 === 2 ? 'rock' : 'log';
        const mesh = new THREE.Mesh(kind === 'log' ? logGeo : rockGeo, kind === 'log' ? M.wood : M.stone);
        mesh.position.set(x, h + (kind === 'log' ? 0.3 : 0.4), z);
        mesh.rotation.y = r() * 6;
        g.scene.add(mesh);
        const node = { kind, mesh, pos: new THREE.Vector3(x, h, z), ready: true, t: 0, id: `node:${this.nodes.length}` };
        this.nodes.push(node);
        g.interactables.push({ id: node.id, pos: node.pos, r: 2.6, label: kind === 'log' ? L('ตัดไม้ (+8 ไม้)', 'Fell timber (+8 wood)') : L('ทุบหิน (+5 แร่)', 'Break stone (+5 ore)'), checkpoint: false });
        break;
      }
    }
  }

  gather(id) {
    const g = this.g, node = this.nodes.find((n) => n.id === id);
    if (!node?.ready) return;
    node.ready = false;
    node.t = 45;
    node.mesh.visible = false;
    g.interactables = g.interactables.filter((it) => it.id !== id);
    if (node.kind === 'log') { this.earn({ wood: 8 }); g.audio.thump({ freq: 140, dur: 0.2, gain: 0.3 }); g.audio.burst({ dur: 0.3, freq: 1200, q: 1, gain: 0.15, delay: 0.1 }); }
    else { this.earn({ ore: 5 }); g.audio.harvest('ore'); }
  }

  earn(res, why = '') {
    if (res.xp) this.g.gainXP(res.xp);
    for (const [k, n] of Object.entries(res)) if (k !== 'xp') this.wallet[k] = (this.wallet[k] || 0) + n;
    const txt = Object.entries(res).filter(([, n]) => n).map(([k, n]) => `+${n} ${RES[k]}`).join(' ');
    if (txt) this.g.ui.combatText(`${txt}${why ? ` (${why})` : ''}`, 'parry');
  }

  // a resource gain for any seat, wherever that player is
  // (why: the reason in Thai, as the message has always carried it; whyEn: the same in English)
  reward(slot, res, why, whyEn) {
    const p = this.P[slot];
    if (!p) return;
    if (slot === this.me) this.earn(res, L(why, whyEn));
    else if (p.bot) for (const [k, n] of Object.entries(res)) if (k !== 'xp') p.wallet[k] += n;
    else this.net?.sendTo(p.peer, { t: 'res', res, why, whyEn });
  }

  // ---------------------------------------------------------------- buildings
  buildingMesh(type, slot) {
    const M = this.g.M, col = C(...SEATS[slot].color), grp = new THREE.Group();
    const wood = C(0.48, 0.36, 0.25), dark = C(0.3, 0.22, 0.16), stone = C(0.55, 0.55, 0.6);
    const add = (parts, mat) => grp.add(new THREE.Mesh(mergeGeometries(parts), mat));
    if (type === 'tower') {
      add([part(new THREE.CylinderGeometry(1.2, 1.5, 3.2, 8), stone, { pos: [0, 1.6, 0] })], M.stone);
      add([
        part(new THREE.BoxGeometry(2.6, 0.25, 2.6), wood, { pos: [0, 3.3, 0] }),
        ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => part(new THREE.BoxGeometry(0.15, 1.6, 0.15), dark, { pos: [a * 1.15, 4.1, b * 1.15] })),
        part(new THREE.ConeGeometry(2.0, 1.4, 4), dark, { pos: [0, 5.6, 0], rot: [0, Math.PI / 4, 0] }),
      ], M.wood);
      add([part(new THREE.BoxGeometry(0.06, 0.9, 0.7), col, { pos: [1.3, 4.0, 0] })], M.cloth);
    } else if (type === 'camp') {
      add([...[0, 1, 2, 3, 4].map((i) => part(new THREE.CylinderGeometry(0.1, 0.12, 1.3, 5), dark, { pos: [Math.cos(i * 1.26) * 0.35, 0.25, Math.sin(i * 1.26) * 0.35], rot: [Math.sin(i * 1.26) * 1.2, 0, -Math.cos(i * 1.26) * 1.2] }))], M.wood);
      add([...Array.from({ length: 8 }, (_, i) => part(new THREE.DodecahedronGeometry(0.2, 0), stone, { pos: [Math.cos(i * 0.785) * 0.9, 0.1, Math.sin(i * 0.785) * 0.9] }))], M.stone);
      add([part(new THREE.ConeGeometry(1.0, 1.6, 4), col.clone().multiplyScalar(0.6), { pos: [2.0, 0.8, 0], rot: [0, Math.PI / 4, 0] })], M.cloth);
      const f = new THREE.Sprite(M.fireSprite); f.position.y = 0.7; f.scale.setScalar(1.8); grp.add(f);
    } else if (type === 'mine') {
      add([part(new THREE.BoxGeometry(1.4, 0.7, 0.9), wood, { pos: [0, 0.6, 0] }), ...[-0.5, 0.5].map((x) => part(new THREE.CylinderGeometry(0.25, 0.25, 0.1, 8), dark, { pos: [x, 0.25, 0.5], rot: [Math.PI / 2, 0, 0] })), part(new THREE.BoxGeometry(2.4, 1.6, 0.15), dark, { pos: [0, 0.8, -1.4] })], M.wood);
      add([part(new THREE.DodecahedronGeometry(0.5, 0), C(0.5, 0.5, 0.58), { pos: [0, 1.05, 0], scale: [1.2, 0.6, 0.8] }), part(new THREE.DodecahedronGeometry(0.6, 0), C(0.45, 0.45, 0.5), { pos: [1.4, 0.4, 0.3] })], M.stone);
      add([part(new THREE.BoxGeometry(0.06, 0.5, 0.5), col, { pos: [0.72, 1.0, 0] })], M.cloth);
    } else if (type === 'wall') {
      add([...Array.from({ length: 6 }, (_, i) => part(new THREE.CylinderGeometry(0.2, 0.24, 2.4 + (i % 2) * 0.3, 6), wood, { pos: [-1.25 + i * 0.5, 1.2, 0] })), part(new THREE.BoxGeometry(3.0, 0.15, 0.12), dark, { pos: [0, 1.6, 0.22] })], M.wood);
      add([part(new THREE.BoxGeometry(0.4, 0.3, 0.05), col, { pos: [0, 1.9, 0.27] })], M.cloth);
    } else if (type === 'trap') {
      add([part(new THREE.BoxGeometry(1.6, 0.1, 1.6), dark, { pos: [0, 0.05, 0] }), ...Array.from({ length: 9 }, (_, i) => part(new THREE.ConeGeometry(0.07, 0.45, 4), C(0.7, 0.68, 0.65), { pos: [(i % 3 - 1) * 0.5, 0.3, (Math.floor(i / 3) - 1) * 0.5] }))], M.wood);
    } else if (type === 'decoy') {
      add([part(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 5), dark, { pos: [0, 1.2, 0] }), part(new THREE.BoxGeometry(1.6, 0.1, 0.1), dark, { pos: [0, 1.7, 0] })], M.wood);
      add([part(new THREE.CylinderGeometry(0.3, 0.45, 0.9, 7), C(0.8, 0.65, 0.35), { pos: [0, 1.4, 0] }), part(new THREE.SphereGeometry(0.25, 7, 5), C(0.85, 0.7, 0.4), { pos: [0, 2.15, 0] })], M.plain);
      add([part(new THREE.BoxGeometry(1.5, 0.4, 0.14), col, { pos: [0, 1.62, 0.05] })], M.cloth);
    } else if (type === 'bell') {
      add([...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => part(new THREE.BoxGeometry(0.16, 3.4, 0.16), wood, { pos: [a * 0.7, 1.7, b * 0.7] })), part(new THREE.ConeGeometry(1.2, 1.0, 4), dark, { pos: [0, 3.9, 0], rot: [0, Math.PI / 4, 0] })], M.wood);
      add([part(new THREE.CylinderGeometry(0.15, 0.4, 0.55, 8), C(0.85, 0.66, 0.3), { pos: [0, 3.0, 0] })], M.metal);
    } else if (type === 'nest') {
      add([part(new THREE.SphereGeometry(2.0, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), C(0.32, 0.26, 0.22), { scale: [1, 0.6, 1] })], M.plain);
      add([...Array.from({ length: 5 }, (_, i) => part(new THREE.SphereGeometry(0.32, 7, 5), C(0.85, 0.82, 0.72), { pos: [Math.cos(i * 1.26) * 0.9, 1.1, Math.sin(i * 1.26) * 0.9], scale: [1, 1.3, 1] }))], M.plain);
      add([part(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5), dark, { pos: [1.8, 1.2, 0] }), part(new THREE.BoxGeometry(0.05, 0.6, 0.7), col, { pos: [1.8, 2.1, 0.35] })], M.cloth);
    }
    return grp;
  }

  // host: place a building (already paid for)
  placeBuilding(type, slot, x, z, ry) {
    const def = BUILDINGS[type];
    const id = this.nextId++;
    const s = { id, type, owner: slot, x, z, ry, hp: def.hp, max: def.hp, built: 0, cool: 1, uses: 4 };
    this.addStructMesh(s);
    this.S.set(id, s);
    return s;
  }

  addStructMesh(s) {
    const g = this.g, y = g.terrain.getHeight(s.x, s.z);
    s.mesh = this.buildingMesh(s.type, s.owner);
    s.mesh.position.set(s.x, y, s.z);
    s.mesh.rotation.y = s.ry;
    s.y = y;
    g.scene.add(s.mesh);
  }

  removeStruct(s) {
    this.g.scene.remove(s.mesh);
    this.S.delete(s.id);
  }

  // why a building can't go here, as [thai, english] (null if it can)
  placeError(type, slot, x, z) {
    const k = this.K[slot], def = BUILDINGS[type];
    if (!k || !this.alive(slot)) return ['ฐานของเจ้าล่มสลายแล้ว', 'Your base has fallen.'];
    if (Math.hypot(x - k.x, z - k.z) > BASE_R) return ['ต้องสร้างในเขตฐานของเจ้า (วงแหวนสี)', 'You must build within your base (the coloured ring).'];
    if (Math.hypot(x - k.x, z - k.z) < 6) return ['ใกล้บัลลังก์เกินไป', 'Too near the throne.'];
    if (this.g.terrain.getHeight(x, z) < 0.3) return ['สร้างในน้ำไม่ได้', 'You cannot build on water.'];
    for (const s of this.S.values()) if (Math.hypot(x - s.x, z - s.z) < def.r + BUILDINGS[s.type].r + 0.6) return ['ทับกับสิ่งก่อสร้างอื่น', 'Another structure stands in the way.'];
    return null;
  }

  canPlace(type, slot, x, z) {
    const e = this.placeError(type, slot, x, z);
    return e && L(e[0], e[1]);
  }

  // ---------------------------------------------------------------- creeps
  spawnCreep(type, owner, target, x, z, id = null) {
    const g = this.g, e = g.combat.spawn(type, x, z);
    const base = ENEMY_TYPES[type], nest = [...this.S.values()].some((s) => s.owner === owner && s.type === 'nest' && s.built >= 1);
    e.def = { ...base, name: `${CREEPS[type].name} (${SEATS[owner].name})`, hp: base.hp * (nest ? 1.25 : 1), respawn: 1e9, active: 'always', cull: 160 };
    e.hp = e.def.hp;
    e.activeOverride = 'always';
    e.state = 'chase';
    e.curSpeed = 0;          // the rig's walk cycle reads this; undefined would turn every bone to NaN
    e.moba = { id: id ?? this.nextId++, owner, target, wi: 0, wp: null, cool: 0, retarget: 0, atk: null, net: !this.host, last: new THREE.Vector3(x, 0, z), stuckT: 0, side: 0 };
    e.moba.wp = this.route(owner, target, e.moba.id);
    // a band of colour so you can tell whose they are
    const band = new THREE.Mesh(new THREE.TorusGeometry(e.def.radius * 1.4, 0.05, 4, 12), new THREE.MeshBasicMaterial({ color: C(...SEATS[owner].color) }));
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.12;
    e.obj.add(band);
    this.Cr.set(e.moba.id, e);
    return e;
  }

  summon(type, owner, target) {
    const k = this.K[owner];
    if (!k || !this.alive(owner) || !this.alive(target) || owner === target) return 0;
    const mine = [...this.Cr.values()].filter((e) => e.moba.owner === owner && e.state !== 'dying').length;
    const n = Math.min(CREEPS[type].count, MAX_CREEPS - mine);
    // they gather at the mouth of the road they will take
    const [ux, uz] = roadOut(owner, adjacent(owner, target) ? target : 'c');
    for (let i = 0; i < n; i++) this.spawnCreep(type, owner, target, k.x + ux * 9 + (i - 1) * 1.6, k.z + uz * 9 + (i % 2) * 1.6);
    return n;
  }

  // what a creep should hit: a decoy if one is in sight, else the nearest foe, the king last
  findTarget(e) {
    const m = e.moba, me = e.pos;
    let best = null, bd = 11;
    for (const s of this.S.values()) {
      if (s.owner === m.owner || s.type !== 'decoy' || s.built < 1) continue;
      const d = Math.hypot(s.x - me.x, s.z - me.z);
      if (d < 16 && d - 6 < bd) { bd = d - 6; best = { kind: 's', s }; }
    }
    if (best) return best;
    for (const o of this.Cr.values()) {
      if (o.moba.owner === m.owner || o.state === 'dying' || !o.alive) continue;
      const d = o.pos.distanceTo(me);
      if (d < bd) { bd = d; best = { kind: 'c', e: o }; }
    }
    for (const p of this.P) {
      if (!p || p.slot === m.owner || p.dead || !p.alive) continue;
      const d = Math.hypot(p.x - me.x, p.z - me.z);
      if (d < bd) { bd = d; best = { kind: 'p', slot: p.slot }; }
    }
    for (const s of this.S.values()) {
      if (s.owner === m.owner || s.type === 'trap') continue;
      const d = Math.hypot(s.x - me.x, s.z - me.z) - BUILDINGS[s.type].r;
      if (d < bd) { bd = d; best = { kind: 's', s }; }
    }
    for (const p of this.P) {
      if (!p || p.slot === m.owner || !p.alive) continue;
      const k = this.K[p.slot], d = Math.hypot(k.x - me.x, k.z - me.z) - 3;
      if (d < bd + 4) { bd = d; best = { kind: 'k', slot: p.slot }; }
    }
    return best;
  }

  targetInfo(t) {
    if (!t) return null;
    if (t.kind === 'c') return t.e.alive && t.e.state !== 'dying' && this.Cr.has(t.e.moba.id) ? { x: t.e.pos.x, z: t.e.pos.z, r: t.e.def.radius } : null;
    if (t.kind === 's') return this.S.has(t.s.id) ? { x: t.s.x, z: t.s.z, r: BUILDINGS[t.s.type].r } : null;
    if (t.kind === 'p') { const p = this.P[t.slot]; return p && !p.dead && p.alive ? { x: p.x, z: p.z, r: 0.4 } : null; }
    if (t.kind === 'k') { const k = this.K[t.slot]; return this.alive(t.slot) ? { x: k.x, z: k.z, r: 2.5 } : null; }
    return null;
  }

  hitTarget(t, dmg, from) {
    if (t.kind === 'c') this.damageCreep(t.e, dmg * UNIT, from);
    else if (t.kind === 's') this.damageStruct(t.s, dmg * UNIT * (from?.def?.slamEvery ? 1.6 : 1), from?.moba?.owner);
    else if (t.kind === 'k') this.damageKing(t.slot, dmg * UNIT, from?.moba?.owner);
    else if (t.kind === 'p') this.damagePlayer(t.slot, dmg, from.pos, from.moba.owner);
  }

  updateCreepAI(e, dt) {
    const g = this.g, m = e.moba, def = e.def;
    e.t -= dt;
    if (e.state === 'windup') {
      if (e.t <= 0) {
        e.state = 'strike'; e.t = 0.15;
        const ti = this.targetInfo(m.atk);
        if (ti && Math.hypot(ti.x - e.pos.x, ti.z - e.pos.z) <= def.range + ti.r + 1) this.hitTarget(m.atk, def.damage, e);
      }
      this.face(e, m.atk, dt);
      return;
    }
    if (e.state === 'strike') { if (e.t <= 0) { e.state = 'recover'; e.t = def.recover * 0.7; } return; }
    if (e.state === 'recover' || e.state === 'stagger') { if (e.t <= 0) e.state = 'chase'; return; }
    m.retarget -= dt;
    if (m.retarget <= 0 || !this.targetInfo(m.atk)) { m.retarget = 0.5; m.atk = this.findTarget(e); }
    // the king we were sent against has fallen: pick another
    if (!this.alive(m.target)) {
      const others = this.aliveSlots().filter((s) => s !== m.owner);
      if (others.length) {
        m.target = others[Math.floor(Math.random() * others.length)];
        m.wp = this.route(m.owner, m.target, m.id);
        // pick the route up wherever it passes closest
        let bi = 0, bd = Infinity;
        m.wp.forEach(([wx, wz], i) => { const d = Math.hypot(wx - e.pos.x, wz - e.pos.z); if (d < bd) { bd = d; bi = i; } });
        m.wi = bi;
      }
    }
    let gx, gz, near = false;
    const ti = this.targetInfo(m.atk);
    if (ti) {
      const d = Math.hypot(ti.x - e.pos.x, ti.z - e.pos.z);
      if (d <= def.range + ti.r + 0.2) { e.state = 'windup'; e.t = def.windup; e.curSpeed = 0; return; }
      gx = ti.x; gz = ti.z; near = d < (def.sprint || 0);
    } else {
      const [wx, wz] = m.wp[Math.min(m.wi, m.wp.length - 1)];
      if (Math.hypot(wx - e.pos.x, wz - e.pos.z) < 6 && m.wi < m.wp.length - 1) m.wi++;
      gx = wx; gz = wz;
    }
    let ang = Math.atan2(gx - e.pos.x, gz - e.pos.z) + m.side;
    // on the march they jog (a crossing takes about a minute); near a foe they move at their own pace
    const speed = ti ? def.speed * (near ? 2 : 1) * 1.15 : Math.max(def.speed * 1.6, 5.5);
    e.running = near;
    e.pos.x += Math.sin(ang) * speed * dt;
    e.pos.z += Math.cos(ang) * speed * dt;
    e.ry += clamp(Math.atan2(Math.sin(ang - e.ry), Math.cos(ang - e.ry)), -4 * dt, 4 * dt);
    g.collision.resolve(e.pos, def.radius, def.height);
    this.pushOut(e.pos, def.radius, m.owner);
    e.curSpeed = speed;
    // unstick: if we barely moved, slip sideways; if that fails too, detour well around it
    m.stuckT += dt;
    if (m.stuckT > 2) {
      const stuck = e.pos.distanceTo(m.last) < 2.5;
      m.stuckN = stuck ? (m.stuckN || 0) + 1 : 0;
      m.side = stuck ? (m.stuckN % 2 ? 1 : -1) * 1.2 : 0;
      if (m.stuckN >= 2 && !ti) {
        const sgn = m.stuckN % 4 < 2 ? 1 : -1, r = 18 + m.stuckN * 4;
        m.wp.splice(m.wi, 0, [e.pos.x + Math.cos(ang) * r * sgn, e.pos.z - Math.sin(ang) * r * sgn]);
        m.side = 0;
      }
      m.last.copy(e.pos); m.stuckT = 0;
    }
  }

  face(e, t, dt) {
    const ti = this.targetInfo(t);
    if (!ti) return;
    const ang = Math.atan2(ti.x - e.pos.x, ti.z - e.pos.z);
    e.ry += clamp(Math.atan2(Math.sin(ang - e.ry), Math.cos(ang - e.ry)), -5 * dt, 5 * dt);
  }

  // keep walkers out of buildings (yours you can pass through, like a gate)
  pushOut(pos, r, owner = -1) {
    for (const s of this.S.values()) {
      if (s.owner === owner || s.type === 'trap') continue;
      const R = BUILDINGS[s.type].r + r, dx = pos.x - s.x, dz = pos.z - s.z, d = Math.hypot(dx, dz);
      if (d < R && d > 1e-3) { pos.x = s.x + dx / d * R; pos.z = s.z + dz / d * R; }
    }
    for (const k of this.K) {
      if (!k) continue;
      const dx = pos.x - k.x, dz = pos.z - k.z, d = Math.hypot(dx, dz), R = 2.4 + r;
      if (d < R && d > 1e-3) { pos.x = k.x + dx / d * R; pos.z = k.z + dz / d * R; }
    }
  }

  // ---------------------------------------------------------------- damage (host)
  damageCreep(e, dmg, from = null) {
    if (!e.alive || e.state === 'dying') return;
    e.hp -= dmg;
    e.flash = 1;
    if (e.hp <= 0) this.killCreep(e, typeof from === 'number' ? from : from?.moba?.owner);
  }

  killCreep(e, killer) {
    e.state = 'dying';
    e.t = e.obj.userData.animate ? 2.6 : 0.9;
    e.hp = 0;
    this.g.audio.enemyDie(e.type, e.pos);
    if (killer != null && killer !== e.moba.owner) this.reward(killer, { soul: 1, wood: 2, xp: 6 }, 'ฆ่าครีป', 'creep slain');
  }

  damageStruct(s, dmg, by = null) {
    if (!this.S.has(s.id)) return;
    s.hp -= dmg;
    s.hitT = 0.3;
    if (by != null && by !== s.owner) this.alarm(s.owner, s.x, s.z);
    if (s.hp <= 0) {
      this.g.particles.burst(new THREE.Vector3(s.x, s.y + 1, s.z), 20, 5, 1);
      this.g.audio.slam({ x: s.x, y: s.y, z: s.z });
      this.removeStruct(s);
      if (by != null && by !== s.owner) this.reward(by, { xp: 20 }, `ทำลาย${BUILDINGS[s.type].th}`, `${BUILDINGS[s.type].en} destroyed`);
      this.broadcast({ t: 'msg', text: `${BUILDINGS[s.type].th}ของ${SEATS[s.owner].th}ถูกทำลาย`, en: `The ${SEATS[s.owner].en} ${BUILDINGS[s.type].en} is destroyed.` });
    }
  }

  damageKing(slot, dmg, by = null) {
    const k = this.K[slot];
    if (!this.alive(slot)) return;
    k.hp -= dmg;
    k.hitT = 0.3;
    if (by != null && by !== slot) this.alarm(slot, k.x, k.z, true);
    if (k.hp <= 0) this.eliminate(slot, by);
  }

  damagePlayer(slot, dmg, from, by) {
    const p = this.P[slot];
    if (!p || p.dead) return;
    if (p.bot) { this.hurtBot(p, dmg, by); return; }
    if (slot === this.me) this.g.combat.takeHit(dmg, from, by);
    else this.net?.sendTo(p.peer, { t: 'hurt', d: dmg, x: from.x, z: from.z, by });
  }

  // tell a defender their base is under attack (at most every few seconds)
  alarm(slot, x, z, king = false) {
    const p = this.P[slot];
    if (!p || p.bot) return;
    p.alarmT = p.alarmT || 0;
    if (this.g.time < p.alarmT) return;
    p.alarmT = this.g.time + 8;
    const bell = [...this.S.values()].some((s) => s.owner === slot && s.type === 'bell' && s.built >= 1);
    const [text, en] = king ? ['ราชาของเจ้าถูกโจมตี!', 'Your king is under attack!'] : bell ? ['ระฆังดัง! ศัตรูบุกเข้าฐาน', 'The bell tolls! Foes have breached your base.'] : ['สิ่งก่อสร้างของเจ้าถูกโจมตี', 'Your structures are under attack.'];
    if (slot === this.me) this.onAlarm(L(text, en), bell || king);
    else this.net?.sendTo(p.peer, { t: 'alarm', text, en, loud: bell || king });
  }

  onAlarm(text, loud) {
    this.g.ui.toast(text);
    if (loud) for (let i = 0; i < 4; i++) this.g.audio.metal({ freq: 880, dur: 0.8, gain: 0.08, delay: i * 0.35, partials: [1, 2.4, 3.9] });
  }

  eliminate(slot, by) {
    const p = this.P[slot];
    p.alive = false;
    this.K[slot].hp = 0;
    for (const s of [...this.S.values()]) if (s.owner === slot) this.removeStruct(s);
    for (const e of this.Cr.values()) if (e.moba.owner === slot && e.state !== 'dying') this.killCreep(e, null);
    const msg = { t: 'elim', slot, by };
    this.broadcast(msg);
    this.onElim(msg);
    const left = this.aliveSlots();
    if (left.length === 1) { const o = { t: 'over', winner: left[0] }; this.broadcast(o); this.onOver(o); }
  }

  onElim({ slot, by }) {
    const k = this.K[slot];
    k.hp = 0;
    if (this.P[slot]) this.P[slot].alive = false;
    k.king.rotation.x = -1.4;
    k.king.position.y = 0.6;
    this.g.audio.death();
    const who = by != null && SEATS[by] ? L(` โดย${SEATS[by].name}`, ` by ${SEATS[by].name}`) : '';
    if (slot === this.me) this.g.ui.banner(L('ราชาของเจ้าสิ้นพระชนม์', 'Your King Has Fallen'), L(`เจ้าพ่ายแพ้${who} — ดูต่อได้จนจบเกม`, `You are defeated${who} — you may watch until the end.`));
    else this.g.ui.banner(L(`ราชา${SEATS[slot].name}สิ้นพระชนม์`, `The ${SEATS[slot].name} King Has Fallen`), L(`${this.P[slot]?.name || ''} ตกรอบ${who}`, `${this.P[slot]?.name || ''} is out${who}`));
  }

  onOver({ winner }) {
    if (this.over) return;
    this.over = true;
    const win = winner === this.me;
    setTimeout(() => this.g.mobaOver(win, SEATS[winner].name, this.P[winner]?.name), 2500);
  }

  // ---------------------------------------------------------------- host: structures, kings, bots
  updateStructures(dt) {
    const g = this.g;
    for (const s of [...this.S.values()]) {
      const def = BUILDINGS[s.type];
      if (s.built < 1) {
        s.built = Math.min(1, s.built + dt / def.time);
        continue;
      }
      s.cool -= dt;
      if (s.type === 'tower' && s.cool <= 0) {
        const t = this.nearestFoe(s.owner, s.x, s.z, 24);
        if (t) {
          s.cool = 1.3;
          this.shots.push([+s.x.toFixed(1), +(s.y + 4.2).toFixed(1), +s.z.toFixed(1), +t.x.toFixed(1), +(t.y + 1).toFixed(1), +t.z.toFixed(1)]);
          if (t.kind === 'c') this.damageCreep(t.e, 1.0, s.owner);
          else this.damagePlayer(t.slot, 10, { x: s.x, z: s.z }, s.owner);
        }
      }
      if (s.type === 'camp' && s.cool <= 0) {
        s.cool = 0.5;
        for (const e of this.Cr.values()) if (e.moba.owner === s.owner && e.state !== 'dying' && Math.hypot(e.pos.x - s.x, e.pos.z - s.z) < 9) e.hp = Math.min(e.def.hp, e.hp + 0.25);
        const p = this.P[s.owner];
        if (p && !p.dead && Math.hypot(p.x - s.x, p.z - s.z) < 9) {
          if (p.bot) p.hp = Math.min(BOT_HERO.hp, p.hp + 4);
          else if (s.owner === this.me) g.player.hp = Math.min(g.player.maxHp, g.player.hp + 4);
          else this.net?.sendTo(p.peer, { t: 'heal', n: 4 });
        }
      }
      if (s.type === 'mine' && s.cool <= 0) { s.cool = 8; this.reward(s.owner, { wood: 4, ore: 2 }, 'เหมือง', 'mine'); }
      if (s.type === 'trap' && s.cool <= 0) {
        for (const e of this.Cr.values()) {
          if (e.moba.owner === s.owner || e.state === 'dying' || Math.hypot(e.pos.x - s.x, e.pos.z - s.z) > 1.3) continue;
          this.damageCreep(e, 2.5, s.owner);
          s.cool = 1; s.uses--;
          g.audio.burst({ dur: 0.2, freq: 2000, q: 3, gain: 0.3, pos: e.pos });
          break;
        }
        for (const p of this.P) {
          if (!p || p.dead || p.slot === s.owner || s.cool > 0 || Math.hypot(p.x - s.x, p.z - s.z) > 1.2) continue;
          this.damagePlayer(p.slot, 18, { x: s.x, z: s.z }, s.owner);
          s.cool = 1; s.uses--;
        }
        if (s.uses <= 0) this.removeStruct(s);
      }
      if (s.type === 'bell' && s.cool <= 0) {
        s.cool = 1;
        if (this.nearestFoe(s.owner, s.x, s.z, BASE_R)) this.alarm(s.owner, s.x, s.z);
      }
    }
  }

  nearestFoe(owner, x, z, range) {
    let best = null, bd = range;
    for (const e of this.Cr.values()) {
      if (e.moba.owner === owner || e.state === 'dying' || !e.alive) continue;
      const d = Math.hypot(e.pos.x - x, e.pos.z - z);
      if (d < bd) { bd = d; best = { kind: 'c', e, x: e.pos.x, y: e.pos.y, z: e.pos.z }; }
    }
    for (const p of this.P) {
      if (!p || p.dead || !p.alive || p.slot === owner) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = { kind: 'p', slot: p.slot, x: p.x, y: p.y, z: p.z }; }
    }
    return best;
  }

  updateKings(dt) {
    for (const p of this.P) {
      if (!p || !p.alive) continue;
      const k = this.K[p.slot];
      k.hp = Math.min(k.max, k.hp + 0.25 * dt);
      k.cool -= dt;
      if (k.cool > 0) continue;
      const t = this.nearestFoe(p.slot, k.x, k.z, KING.range + 1.5);
      if (!t) continue;
      k.cool = KING.every;
      k.swingT = 0.5;
      this.g.audio.slam({ x: k.x, y: k.y, z: k.z });
      if (t.kind === 'c') this.damageCreep(t.e, 3, p.slot);
      else this.damagePlayer(t.slot, KING.dmg, { x: k.x, z: k.z }, p.slot);
    }
  }

  // bot lords: a little income, a few buildings, and waves sent at whoever looks weakest
  updateBots(dt) {
    for (const p of this.P) {
      if (!p || !p.bot || !p.alive) continue;
      const w = p.wallet;
      w.wood += 1.1 * dt; w.ore += 0.5 * dt; w.soul += 0.22 * dt;
      p.aiT -= dt;
      p.waveT -= dt;
      if (p.aiT <= 0) {
        p.aiT = 6;
        const mine = [...this.S.values()].filter((s) => s.owner === p.slot);
        const has = (t) => mine.filter((s) => s.type === t).length;
        const want = has('mine') < 1 ? 'mine' : has('tower') < 2 ? 'tower' : has('camp') < 1 ? 'camp' : has('nest') < 1 && w.soul > 20 ? 'nest' : has('tower') < 4 ? 'tower' : has('wall') < 4 ? 'wall' : has('decoy') < 1 ? 'decoy' : null;
        if (want && canPay(w, BUILDINGS[want].cost)) {
          const k = this.K[p.slot];
          for (let i = 0; i < 12; i++) {
            const a = Math.random() * Math.PI * 2, r = want === 'wall' ? 18 + Math.random() * 6 : 9 + Math.random() * 14;
            const x = k.x + Math.cos(a) * r, z = k.z + Math.sin(a) * r;
            if (!this.canPlace(want, p.slot, x, z)) { pay(w, BUILDINGS[want].cost); this.placeBuilding(want, p.slot, x, z, a); break; }
          }
        }
      }
      if (p.waveT <= 0) {
        const foes = this.aliveSlots().filter((s) => s !== p.slot);
        if (!foes.length) continue;
        const weak = foes.map((s) => [s, this.K[s].hp + Math.random() * 40]).sort((a, b) => a[1] - b[1]);
        const target = Math.random() < 0.5 ? weak[0][0] : foes[Math.floor(Math.random() * foes.length)];
        const order = ['brute', 'wolf', 'gaunt', 'crawler'];
        let sent = 0;
        for (const type of order) {
          const c = CREEPS[type];
          if (c.needs && ![...this.S.values()].some((s) => s.owner === p.slot && s.type === c.needs && s.built >= 1)) continue;
          while (canPay(w, c.cost) && sent < 3) { pay(w, c.cost); this.summon(type, p.slot, target); sent++; }
        }
        p.waveT = sent ? 38 + Math.random() * 14 : 8;
        if (sent) this.botPush(p, target);
      }
    }
  }

  // ---------------------------------------------------------------- host: bot heroes
  botAI(p) {
    if (!p.ai) {
      const [x, z, yaw] = p.x || p.z ? [p.x, p.z, p.yaw] : baseSpawn(p.slot);
      p.ai = { pos: new THREE.Vector3(x, this.g.terrain.getHeight(x, z), z), cool: 1, hitT: 0, hit: null, swT: 0, respawn: 0, push: null, wp: null, wi: 0, n: 0, idleT: 0, goal: null };
      Object.assign(p, { x, y: p.ai.pos.y, z, yaw, hp: p.dead ? 0 : Math.min(p.hp || BOT_HERO.hp, BOT_HERO.hp) });
    }
    return p.ai;
  }

  // after a bot sends a wave, its hero follows the creeps for a while
  botPush(p, target) {
    const ai = this.botAI(p);
    ai.push = { target, until: this.g.time + 80 };
    ai.wp = this.route(p.slot, target, p.slot);
    ai.wi = 0;
  }

  hurtBot(p, dmg, by) {
    if (p.dead || !p.alive) return;
    p.hp -= dmg * 0.8;
    const ai = this.botAI(p);
    if (by != null && by !== p.slot) ai.lastBy = by;
    if (p.hp > 0) return;
    p.hp = 0; p.dead = true;
    ai.respawn = BOT_HERO.respawn; ai.push = null; ai.hit = null;
    this.g.audio.hit(true, 'flesh', { x: p.x, y: p.y + 1, z: p.z });
    if (by != null && by !== p.slot) this.reward(by, { soul: 3, xp: 40 }, `ฆ่า ${p.name}`, `slew ${p.name}`);
  }

  // the nearest thing of another seat around (x, z): creeps and heroes; buildings and the king only
  // when `siege` (a bot on the march)
  botFoe(p, x, z, range, siege) {
    let best = null, bd = range;
    for (const e of this.Cr.values()) {
      if (e.moba.owner === p.slot || e.state === 'dying' || !e.alive) continue;
      const d = Math.hypot(e.pos.x - x, e.pos.z - z);
      if (d < bd) { bd = d; best = { kind: 'c', e }; }
    }
    for (const o of this.P) {
      if (!o || o.slot === p.slot || o.dead || !o.alive) continue;
      const d = Math.hypot(o.x - x, o.z - z);
      if (d < bd) { bd = d; best = { kind: 'p', slot: o.slot }; }
    }
    if (siege) {
      for (const st of this.S.values()) {
        if (st.owner === p.slot || st.type === 'trap') continue;
        const d = Math.hypot(st.x - x, st.z - z) - BUILDINGS[st.type].r;
        if (d < bd) { bd = d; best = { kind: 's', s: st }; }
      }
      for (const o of this.P) {
        if (!o || o.slot === p.slot || !o.alive) continue;
        const k = this.K[o.slot], d = Math.hypot(k.x - x, k.z - z) - 2.5;
        if (d < bd) { bd = d; best = { kind: 'k', slot: o.slot }; }
      }
    }
    return best;
  }

  updateBotHeroes(dt) {
    const g = this.g, t = g.time;
    for (const p of this.P) {
      if (!p || !p.bot) continue;
      const ai = this.botAI(p);
      if (!p.alive) { p.dead = true; continue; }
      if (p.dead) {
        ai.respawn -= dt;
        if (ai.respawn <= 0) {
          const [x, z, yaw] = baseSpawn(p.slot);
          ai.pos.set(x, g.terrain.getHeight(x, z), z);
          Object.assign(p, { x, y: ai.pos.y, z, yaw, hp: BOT_HERO.hp, dead: false });
        }
        continue;
      }
      const k = this.K[p.slot], home = Math.hypot(ai.pos.x - k.x, ai.pos.z - k.z);
      if (home < BASE_R) p.hp = Math.min(BOT_HERO.hp, p.hp + 1.5 * dt);
      // what to do: drive off anything near the king; else march with the wave; else stand guard
      const threat = this.botFoe(p, k.x, k.z, BOT_HERO.guard, false);
      if (ai.push && (t > ai.push.until || !this.alive(ai.push.target) || p.hp < BOT_HERO.hp * 0.35)) ai.push = null;
      let foe = null, goal = null;
      if (threat) foe = threat;
      else if (ai.push) {
        const atBase = Math.hypot(ai.pos.x - this.K[ai.push.target].x, ai.pos.z - this.K[ai.push.target].z) < BASE_R + 6;
        foe = this.botFoe(p, ai.pos.x, ai.pos.z, atBase ? 30 : 12, atBase);
        if (!foe) {
          const [wx, wz] = ai.wp[Math.min(ai.wi, ai.wp.length - 1)];
          if (Math.hypot(wx - ai.pos.x, wz - ai.pos.z) < 5 && ai.wi < ai.wp.length - 1) ai.wi++;
          goal = [wx, wz];
        }
      } else {
        foe = this.botFoe(p, ai.pos.x, ai.pos.z, 8, false);
        if (!foe) {
          // stand guard a little in front of the throne, shifting about now and then
          ai.idleT -= dt;
          if (ai.idleT <= 0 || !ai.goal) {
            ai.idleT = 4 + Math.random() * 5;
            const [sx, sz] = baseSpawn(p.slot), a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 6;
            ai.goal = [sx + Math.cos(a) * r, sz + Math.sin(a) * r];
          }
          goal = ai.goal;
        }
      }
      // fight
      const ti = foe && this.targetInfo(foe);
      let speed = 0;
      if (ti) {
        const d = Math.hypot(ti.x - ai.pos.x, ti.z - ai.pos.z);
        if (d > BOT_HERO.reach + ti.r) goal = [ti.x, ti.z];
        else {
          p.yaw = Math.atan2(-(ti.x - ai.pos.x), -(ti.z - ai.pos.z));
          if (ai.cool <= 0 && !ai.hit) {
            ai.n++;
            const heavy = ai.n % 3 === 0;
            ai.cool = BOT_HERO.every * (heavy ? 1.4 : 1);
            ai.hit = { foe, heavy };
            ai.hitT = heavy ? 0.55 : 0.32;
            ai.swT = heavy ? 0.7 : 0.45;
            p.sn = (p.sn || 0) + 1;
            p.sw = heavy ? 2 : 1;
          }
        }
      }
      ai.cool -= dt;
      if (ai.hit) {
        ai.hitT -= dt;
        if (ai.hitT <= 0) {
          const h = ai.hit, info = this.targetInfo(h.foe);
          ai.hit = null;
          if (info && Math.hypot(info.x - ai.pos.x, info.z - ai.pos.z) < BOT_HERO.reach + info.r + 0.8) {
            const mul = h.heavy ? 1.7 : 1;
            if (h.foe.kind === 'p') this.damagePlayer(h.foe.slot, BOT_HERO.vsHero * mul, { x: ai.pos.x, z: ai.pos.z }, p.slot);
            else if (h.foe.kind === 'c') this.damageCreep(h.foe.e, BOT_HERO.vsUnit * mul, p.slot);
            else if (h.foe.kind === 's') this.damageStruct(h.foe.s, BOT_HERO.vsUnit * mul, p.slot);
            else if (h.foe.kind === 'k') this.damageKing(h.foe.slot, BOT_HERO.vsUnit * mul, p.slot);
            g.audio.hit(h.heavy, h.foe.kind === 's' ? 'knight' : 'flesh', { x: info.x, y: ai.pos.y + 1, z: info.z });
          }
        }
      }
      ai.swT -= dt;
      if (ai.swT <= 0 && p.sw) p.sw = 0;
      // walk
      if (goal && !ai.hit) {
        const dx = goal[0] - ai.pos.x, dz = goal[1] - ai.pos.z, d = Math.hypot(dx, dz);
        if (d > 0.6) {
          speed = foe || ai.push ? BOT_HERO.run : BOT_HERO.speed * 0.5;
          const step = Math.min(d, speed * dt);
          ai.pos.x += dx / d * step; ai.pos.z += dz / d * step;
          p.yaw = Math.atan2(-dx, -dz);
          g.collision.resolve(ai.pos, 0.4, 1.8);
          this.pushOut(ai.pos, 0.4, p.slot);
        }
      }
      ai.pos.y = g.terrain.getHeight(ai.pos.x, ai.pos.z);
      p.x = ai.pos.x; p.y = ai.pos.y; p.z = ai.pos.z;
    }
  }

  // ---------------------------------------------------------------- messages
  broadcast(msg) { if (this.host) this.net?.broadcast(msg); }

  slotOf(peer) { return this.P.find((p) => p && p.peer === peer)?.slot; }

  onMessage(m, from) {
    if (this.host) {
      const slot = this.slotOf(from);
      if (slot == null) return;
      const p = this.P[slot];
      if (m.t === 'st') Object.assign(p, { x: m.x, y: m.y, z: m.z, yaw: m.yaw, hp: m.hp, dead: !!m.dead, sw: m.sw | 0, sn: m.sn | 0, rd: m.rd | 0 });
      if (m.t === 'hit') this.applyHit(m, slot);
      if (m.t === 'build') {
        const why = this.placeError(m.type, slot, m.x, m.z);
        if (why) this.net.sendTo(from, { t: 'refund', cost: BUILDINGS[m.type].cost, why: why[0], whyEn: why[1] });
        else this.placeBuilding(m.type, slot, m.x, m.z, m.ry);
      }
      if (m.t === 'summon') {
        const n = this.summon(m.type, slot, m.target);
        if (!n) this.net.sendTo(from, { t: 'refund', cost: CREEPS[m.type].cost, why: 'ซัมม่อนไม่ได้ (ครีปเต็มหรือเป้าหมายตกรอบแล้ว)', whyEn: 'Cannot summon (too many creeps, or the target has fallen).' });
      }
      if (m.t === 'died' && m.by != null && m.by !== slot) this.reward(m.by, { soul: 3, xp: 40 }, `ฆ่า ${p.name}`, `slew ${p.name}`);
      return;
    }
    // client side
    if (m.t === 'snap') this.applySnapshot(m);
    if (m.t === 'hurt') this.g.combat.takeHit(m.d, { x: m.x, z: m.z }, m.by);
    if (m.t === 'heal') this.g.player.hp = Math.min(this.g.player.maxHp, this.g.player.hp + m.n);
    if (m.t === 'res') this.earn(m.res, L(m.why, m.whyEn));
    if (m.t === 'refund') { this.earn(m.cost); this.g.ui.toast(L(m.why, m.whyEn)); }
    if (m.t === 'msg') this.g.ui.toast(L(m.text, m.en));
    if (m.t === 'alarm') this.onAlarm(L(m.text, m.en), m.loud);
    if (m.t === 'elim') this.onElim(m);
    if (m.t === 'over') this.onOver(m);
  }

  // host: apply a blow someone landed
  applyHit(m, by) {
    if (m.k === 'c') { const e = this.Cr.get(m.id); if (e && e.moba.owner !== by) this.damageCreep(e, m.d, by); }
    if (m.k === 's') { const s = this.S.get(m.id); if (s && s.owner !== by) this.damageStruct(s, m.d, by); }
    if (m.k === 'k' && m.id !== by) this.damageKing(m.id, m.d, by);
    if (m.k === 'p' && m.id !== by) this.damagePlayer(m.id, m.d, { x: this.P[by].x, z: this.P[by].z }, by);
  }

  // a blow from this player: the host applies it, a client sends it
  // a riposte or a reflected blow aimed at another hero (path upgrades)
  riposte(slot, dmg) { if (this.P[slot] && slot !== this.me) this.hit('p', slot, dmg * PVP * this.g.damageMul); }

  hit(k, id, d) {
    if (this.host) this.applyHit({ k, id, d }, this.me);
    else this.net.send({ t: 'hit', k, id, d });
  }

  onLeave(peer) {
    const slot = this.slotOf(peer);
    if (slot == null) return;
    const p = this.P[slot];
    p.bot = true; p.peer = null; p.wallet = { wood: 60, ore: 30, soul: 10 };
    this.removeAvatar(slot);
    this.broadcast({ t: 'msg', text: `${p.name} ออกจากเกม — บอทรับช่วงฐาน${SEATS[slot].th}ต่อ`, en: `${p.name} has left — a bot holds the ${SEATS[slot].en} Base.` });
    this.g.ui.toast(L(`${p.name} ออกจากเกม — บอทรับช่วงต่อ`, `${p.name} has left — a bot takes their place.`));
  }

  onHostLeft() {
    if (this.over) return;
    this.over = true;
    this.g.ui.banner(L('โฮสต์ออกจากเกม', 'The Host Has Left'), L('การเชื่อมต่อขาด กำลังกลับหน้าหลัก...', 'The bond is severed. Returning to the title...'));
    setTimeout(() => this.g.mobaOver(null), 3500);
  }

  // ---------------------------------------------------------------- snapshots
  snapshot() {
    const r1 = (v) => Math.round(v * 10) / 10;
    return {
      t: 'snap',
      p: this.P.filter(Boolean).map((p) => [p.slot, r1(p.x), r1(p.y), r1(p.z), r1(p.yaw), Math.round(p.hp), p.dead ? 1 : 0, p.sw | 0, p.bot ? 1 : 0, p.alive ? 1 : 0, p.sn | 0, p.rd | 0]),
      c: [...this.Cr.values()].map((e) => [e.moba.id, CTYPES.indexOf(e.type), e.moba.owner, r1(e.pos.x), r1(e.pos.z), r1(e.ry), r1(Math.max(0, e.hp)), Math.max(0, STATES.indexOf(e.state))]),
      s: [...this.S.values()].map((s) => [s.id, BTYPES.indexOf(s.type), s.owner, r1(s.x), r1(s.z), r1(s.ry), r1(s.hp), Math.round(s.built * 100) / 100]),
      k: this.K.map((k) => (k ? r1(k.hp) : 0)),
      sh: this.shots,
    };
  }

  applySnapshot(m) {
    // heroes
    for (const [slot, x, y, z, yaw, hp, dead, sw, bot, alive, sn, rd] of m.p) {
      const p = this.P[slot];
      if (!p) continue;
      p.alive = !!alive; p.bot = !!bot;
      if (slot === this.me) continue;
      Object.assign(p, { x, y, z, yaw, hp, dead: !!dead, sw: sw | 0, sn: sn | 0, rd: rd | 0 });
    }
    // creeps
    const seen = new Set();
    for (const [id, ti, owner, x, z, ry, hp, st] of m.c) {
      seen.add(id);
      let e = this.Cr.get(id);
      if (!e) e = this.spawnCreep(CTYPES[ti], owner, owner, x, z, id);
      e.moba.nx = x; e.moba.nz = z; e.moba.nry = ry;
      const state = STATES[st];
      if (hp < e.hp) e.flash = 1;
      e.hp = hp;
      if (state === 'dying' && e.state !== 'dying') { e.state = 'dying'; e.t = e.obj.userData.animate ? 2.6 : 0.9; this.g.audio.enemyDie(e.type, e.pos); }
      else if (state !== 'dying') e.state = state;
    }
    for (const [id, e] of this.Cr) if (!seen.has(id) && e.state !== 'dying') { e.state = 'dying'; e.t = 0.6; }
    // structures
    const sseen = new Set();
    for (const [id, ti, owner, x, z, ry, hp, built] of m.s) {
      sseen.add(id);
      let s = this.S.get(id);
      if (!s) { s = { id, type: BTYPES[ti], owner, x, z, ry, hp, max: BUILDINGS[BTYPES[ti]].hp, built }; this.addStructMesh(s); this.S.set(id, s); }
      if (hp < s.hp) s.hitT = 0.3;
      s.hp = hp; s.built = built;
    }
    for (const s of [...this.S.values()]) if (!sseen.has(s.id)) { this.g.particles.burst(new THREE.Vector3(s.x, s.y + 1, s.z), 16, 4, 1); this.removeStruct(s); }
    m.k.forEach((hp, i) => { if (this.K[i]) { if (hp < this.K[i].hp) this.K[i].hitT = 0.3; this.K[i].hp = hp; } });
    for (const sh of m.sh) this.arrow(sh);
  }

  arrow([x0, y0, z0, x1, y1, z1]) {
    const g = this.g;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.9), new THREE.MeshBasicMaterial({ color: C(1.2, 1.1, 0.8) }));
    g.scene.add(m);
    this.arrows.push({ m, a: new THREE.Vector3(x0, y0, z0), b: new THREE.Vector3(x1, y1, z1), t: 0 });
    g.audio.burst({ dur: 0.15, freq: 2600, q: 2, gain: 0.08, pos: { x: x0, y: y0 - 1, z: z0 } });
  }

  // ---------------------------------------------------------------- avatars of the other players
  avatar(slot) {
    let a = this.avatars.get(slot);
    if (a) return a;
    const g = this.g, p = this.P[slot], s = SEATS[slot];
    // the hero of their path (src/heroes.js), wearing their base's colour
    const obj = createHero(p.cls, g.M, C(...s.color));
    // a name tag
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 48;
    const ctx = cv.getContext('2d');
    ctx.font = 'bold 28px Pridi, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 4, 256, 40);
    ctx.fillStyle = s.css;
    ctx.fillText(`${p.name} · ${CLASSES[p.cls]?.name || ''}`, 128, 34);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    tag.scale.set(2.6, 0.5, 1);
    tag.position.y = 2.55;
    obj.add(tag);
    g.scene.add(obj);
    a = { obj, pos: new THREE.Vector3(p.x, p.y, p.z), yaw: p.yaw, sn: p.sn, speed: 0 };
    this.avatars.set(slot, a);
    return a;
  }

  removeAvatar(slot) {
    const a = this.avatars.get(slot);
    if (a) { this.g.scene.remove(a.obj); if (a.ride) this.g.scene.remove(a.ride.root); this.avatars.delete(slot); }
  }

  updateAvatars(dt) {
    for (const p of this.P) {
      if (!p || p.slot === this.me) continue;
      const a = this.avatar(p.slot);
      a.obj.visible = !p.dead && p.alive;
      const k = Math.min(1, dt * 10);
      const moved = Math.hypot(p.x - a.pos.x, p.z - a.pos.z);
      a.pos.lerp(V.set(p.x, p.y, p.z), k);
      a.yaw += Math.atan2(Math.sin(p.yaw - a.yaw), Math.cos(p.yaw - a.yaw)) * k;
      a.obj.position.copy(a.pos);
      a.obj.rotation.y = a.yaw + Math.PI;
      // riding: the cockroach under them, turned the way it is going, the hero astride its back
      const riding = !!p.rd && a.obj.visible;
      if (riding && !a.ride) a.ride = createMountBody(this.g.scene);
      if (a.ride) {
        a.ride.root.visible = riding;
        if (riding) {
          const mx = a.pos.x - (a.lastX ?? a.pos.x), mz = a.pos.z - (a.lastZ ?? a.pos.z);
          const head = Math.hypot(mx, mz) > 0.01 ? Math.atan2(-mx, -mz) : a.rideYaw ?? a.yaw;
          a.rideYaw = (a.rideYaw ?? head) + Math.atan2(Math.sin(head - (a.rideYaw ?? head)), Math.cos(head - (a.rideYaw ?? head))) * Math.min(1, dt * 6);
          a.ride.root.position.copy(a.pos);
          a.ride.root.rotation.y = a.rideYaw;
          V.set(MOUNT.seat.x, 0, MOUNT.seat.z).applyAxisAngle(THREE.Object3D.DEFAULT_UP, a.rideYaw);
          a.obj.position.set(a.pos.x + V.x, a.pos.y + MOUNT.seat.y - 0.95, a.pos.z + V.z);
          a.obj.rotation.y = a.rideYaw + Math.PI;
          animateMountBody(a.ride, dt, a.speed, p.y - this.g.terrain.getHeight(p.x, p.z) > 0.5);
        }
      }
      a.lastX = a.pos.x; a.lastZ = a.pos.z;
      // walk/run from how fast they are really moving; a new blow when their count goes up
      a.speed += ((dt > 0 ? moved * k / dt : 0) - a.speed) * Math.min(1, dt * 6);
      const blow = p.sn !== a.sn;
      a.sn = p.sn;
      if (a.obj.visible) animateHero(a.obj, dt, { speed: riding ? 0 : a.speed, action: blow ? (p.sw === 2 ? 2 : 1) : p.sw === 3 ? 3 : 0, ride: riding });
    }
  }

  // ---------------------------------------------------------------- the local player's blows
  // called by combat.playerStrike: buildings, kings and other heroes in reach
  strike(spec, cam, dir) {
    const g = this.g, pos = g.player.pos, dmg = spec.dmg * g.damageMul;
    const inReach = (x, y, z, r) => {
      V.set(x - cam.x, y - cam.y, z - cam.z);
      const d = V.length();
      if (spec.aoe) return Math.hypot(x - (pos.x - Math.sin(g.player.yaw) * spec.aoe.dist), z - (pos.z - Math.cos(g.player.yaw) * spec.aoe.dist)) < spec.aoe.r + r;
      if (d > spec.range + r) return false;
      return spec.radial || V.normalize().dot(dir) > Math.min(spec.arc, 0.3) || d < r + 0.8;
    };
    for (const s of this.S.values()) {
      if (s.owner === this.me) continue;
      if (inReach(s.x, s.y + 1.2, s.z, BUILDINGS[s.type].r)) { this.hit('s', s.id, dmg); s.hitT = 0.3; g.audio.hit(spec.heavy, 'knight', { x: s.x, y: s.y, z: s.z }); }
    }
    for (const p of this.P) {
      if (!p || p.slot === this.me) continue;
      const k = this.K[p.slot];
      if (p.alive && inReach(k.x, k.y + 2, k.z, 2.2)) { this.hit('k', p.slot, dmg); k.hitT = 0.3; g.audio.hit(spec.heavy, 'flesh', { x: k.x, y: k.y + 1, z: k.z }); }
      if (!p.dead && p.alive && inReach(p.x, p.y + 1, p.z, 0.5)) { this.hit('p', p.slot, dmg * PVP); g.audio.hit(spec.heavy, 'flesh', { x: p.x, y: p.y, z: p.z }); g.particles.burst(new THREE.Vector3(p.x, p.y + 1.2, p.z), 8, 3, 0.5); }
    }
  }

  // ---------------------------------------------------------------- build & summon (local player)
  requestBuild(type, x, z, ry) {
    const def = BUILDINGS[type];
    const why = this.canPlace(type, this.me, x, z);
    if (why) { this.g.ui.toast(why); return false; }
    if (!canPay(this.wallet, def.cost)) { this.g.ui.toast(L(`ทรัพยากรไม่พอ: ${costText(def.cost)}`, `Not enough: ${costText(def.cost)}`)); return false; }
    pay(this.wallet, def.cost);
    if (this.host) this.placeBuilding(type, this.me, x, z, ry);
    else this.net.send({ t: 'build', type, x, z, ry });
    this.g.audio.anvil();
    this.g.ui.toast(L(`เริ่มสร้าง${def.name}`, `Raising the ${def.name}`));
    return true;
  }

  requestSummon(type, target) {
    const c = CREEPS[type];
    if (c.needs && ![...this.S.values()].some((s) => s.owner === this.me && s.type === c.needs && s.built >= 1)) { this.g.ui.toast(L(`ต้องมี${BUILDINGS[c.needs].name}ก่อน`, `You need a ${BUILDINGS[c.needs].name} first.`)); return false; }
    if (!canPay(this.wallet, c.cost)) { this.g.ui.toast(L(`ทรัพยากรไม่พอ: ${costText(c.cost)}`, `Not enough: ${costText(c.cost)}`)); return false; }
    pay(this.wallet, c.cost);
    if (this.host) { if (!this.summon(type, this.me, target)) { this.earn(c.cost); this.g.ui.toast(L('ซัมม่อนไม่ได้ (ครีปเต็ม)', 'Cannot summon (too many creeps).')); return false; } }
    else this.net.send({ t: 'summon', type, target });
    this.g.audio.enemyCue(type, 'aggro');
    this.g.ui.toast(L(`ส่ง${c.name}ไปตีฐาน${SEATS[target].name}`, `${c.name} sent against the ${SEATS[target].name} Base`));
    return true;
  }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    const g = this.g, p = g.player;
    // my hero
    const me = this.P[this.me];
    // sw: what the hero is doing (1 light blow, 2 heavy, 3 guarding); sn counts blows so each one is seen once
    const c = g.combat, act = c.swing ? (c.swing.kind === 'heavy' ? 2 : 1) : c.blocking ? 3 : 0;
    Object.assign(me, { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, hp: p.hp, dead: g.state === 'dead', sw: act, sn: c.swingN || 0, rd: g.mount?.ridden ? 1 : 0 });
    this.pushOut(p.pos, 0.4, this.me);
    if (!this.host) {
      this.sendT -= dt;
      if (this.sendT <= 0) { this.sendT = 1 / 12; this.net.send({ t: 'st', x: +me.x.toFixed(2), y: +me.y.toFixed(2), z: +me.z.toFixed(2), yaw: +me.yaw.toFixed(3), hp: Math.round(me.hp), dead: me.dead ? 1 : 0, sw: me.sw, sn: me.sn, rd: me.rd }); }
    }
    if (this.host && !this.over) {
      for (const e of this.Cr.values()) if (e.alive && e.state !== 'dying') this.updateCreepAI(e, dt);
      this.updateStructures(dt);
      this.updateKings(dt);
      this.updateBots(dt);
      this.updateBotHeroes(dt);
      this.snapT -= dt;
      if (this.snapT <= 0) { this.snapT = 0.1; this.broadcast(this.snapshot()); for (const sh of this.shots) this.arrow(sh); this.shots = []; }
    }
    // clients glide creeps to where the host says they are
    if (!this.host) {
      const k = Math.min(1, dt * 8);
      for (const e of this.Cr.values()) {
        if (e.moba.nx == null) continue;
        e.pos.x += (e.moba.nx - e.pos.x) * k;
        e.pos.z += (e.moba.nz - e.pos.z) * k;
        e.ry += Math.atan2(Math.sin(e.moba.nry - e.ry), Math.cos(e.moba.nry - e.ry)) * k;
        e.curSpeed = e.state === 'chase' ? e.def.speed : 0;
      }
    }
    // tidy up the dead
    for (const [id, e] of this.Cr) {
      if (e.alive) continue;
      g.scene.remove(e.obj);
      if (e.shadow) g.scene.remove(e.shadow);
      g.combat.enemies = g.combat.enemies.filter((x) => x !== e);
      this.Cr.delete(id);
    }
    // gathering nodes regrow
    for (const n of this.nodes) {
      if (n.ready) continue;
      n.t -= dt;
      if (n.t <= 0) { n.ready = true; n.mesh.visible = true; g.interactables.push({ id: n.id, pos: n.pos, r: 2.6, label: n.kind === 'log' ? L('ตัดไม้ (+8 ไม้)', 'Fell timber (+8 wood)') : L('ทุบหิน (+5 แร่)', 'Break stone (+5 ore)'), checkpoint: false }); }
    }
    // buildings rise as they are built, shake when hit; kings swing
    for (const s of this.S.values()) {
      s.mesh.scale.set(1, 0.15 + 0.85 * s.built, 1);
      s.hitT = Math.max(0, (s.hitT || 0) - dt);
      s.mesh.position.x = s.x + (s.hitT ? (Math.random() - 0.5) * 0.12 : 0);
    }
    for (const k of this.K) {
      if (!k || k.hp <= 0) continue;
      k.swingT = Math.max(0, (k.swingT || 0) - dt);
      k.king.rotation.x = -k.swingT * 0.6;
    }
    // arrows in flight
    for (const a of this.arrows) {
      a.t += dt / 0.25;
      a.m.position.lerpVectors(a.a, a.b, Math.min(1, a.t));
      a.m.lookAt(a.b);
      if (a.t >= 1) { g.scene.remove(a.m); a.done = true; }
    }
    this.arrows = this.arrows.filter((a) => !a.done);
    this.updateAvatars(dt);
    this.updateHud();
  }

  // the structure / king the crosshair is on, for the target bar
  lookedAt() {
    const g = this.g, cam = g.camera.position, dir = g.player.forwardVec;
    let best = null, bd = 18;
    const test = (x, y, z, r, label, hp, max) => {
      V.set(x - cam.x, y - cam.y, z - cam.z);
      const d = V.length();
      if (d < bd && V.normalize().dot(dir) > 0.96 - r / Math.max(d, 1) * 0.5) { bd = d; best = { def: { name: label, hp: max }, hp }; }
    };
    for (const s of this.S.values()) test(s.x, s.y + 1.5, s.z, BUILDINGS[s.type].r, `${BUILDINGS[s.type].name} (${SEATS[s.owner].name})${s.built < 1 ? L(` — กำลังสร้าง ${Math.round(s.built * 100)}%`, ` — raising ${Math.round(s.built * 100)}%`) : ''}`, s.hp, s.max);
    for (const p of this.P) {
      if (!p) continue;
      const k = this.K[p.slot];
      if (p.alive) test(k.x, k.y + 2.5, k.z, 2.5, L(`ราชา${SEATS[p.slot].name} (${p.name})`, `${SEATS[p.slot].name} King (${p.name})`), k.hp, k.max);
    }
    return best;
  }

  updateHud() {
    const el = this.hudEl || (this.hudEl = document.getElementById('mobahud'));
    const w = this.wallet, k = this.K[this.me];
    const kings = this.P.filter(Boolean).map((p) => `<span class="mk ${p.alive ? '' : 'dead'}" style="color:${SEATS[p.slot].css}">♛ ${Math.max(0, Math.round(this.K[p.slot].hp))}</span>`).join('');
    const html = `<div class="mw"><span>🪵 ${Math.floor(w.wood)}</span><span>⛏ ${Math.floor(w.ore)}</span><span>✦ ${Math.floor(w.soul)}</span></div>
      <div class="mk-row">${kings}</div><div class="mhint">${L('[B] สร้าง / ซัมม่อน · ราชาของเจ้า', '[B] Build / Summon · Your king')}: ${Math.max(0, Math.round(k.hp))}/${k.max}</div>`;
    if (html !== this._hud) { this._hud = html; el.innerHTML = html; }
    const t = this.lookedAt();
    if (t) this.g.ui.setTarget(t);
  }

  dispose() {
    this.net?.close();
  }
}
