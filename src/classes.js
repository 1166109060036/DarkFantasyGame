// Classes ("paths"). Each one swaps the weapon in your hand and bends the combat rules:
//   wanderer  - the sword you started with, plus a second wind
//   bell      - the Bellwright: blows landed on the beat of the score hit harder and build
//               resonance; the great bell stuns everything around you; a small chime echoes
//               through the dark and shows where every creature is
//   leech     - the Leech-Doctor: no natural healing, blood is everything. Live leeches are
//               thrown at foes, drink from them and crawl back to feed you; the lower your
//               blood, the harder you cut
//   coffin    - the Coffin-Bearer: swings a coffin, raises it as a wall, packs the dead into it
//               and wears their strengths; buries them to make graves you wake up at
//   wick      - the Wick-Bearer: a candle-headed wanderer whose life is wax that melts away.
//               A burning censer on a chain, candles that the Pale Ones will not cross, and a
//               hand cupped over the flame to vanish into the dark
//
// Combat (src/combat.js) asks the current kit for swing specs and calls its hooks; the kit
// owns any extra things it puts in the world (thrown leeches, candles, graves, echo marks).
import * as THREE from 'three';
import { part, mergeGeometries, clamp } from './util.js';

const C = (r, g, b) => new THREE.Color(r, g, b);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const PALE = new Set(['gaunt', 'crawler', 'weeper', 'brute', 'wisp']);
const V = new THREE.Vector3();

export const CLASSES = {
  wanderer: {
    name: 'ผู้พเนจร', weapon: 'ดาบ', icon: '⚔',
    blurb: 'นักดาบผู้เดินทางมาจากแดนไกล สมดุลทุกด้าน ไม่มีจุดอ่อน ไม่มีของแปลก',
    lines: ['ฟันเบา / กดค้างฟันหนัก · ป้องกันและปัดได้', 'G: ตั้งหลัก — แรงกลับมาเต็มทันที (พัก 30 วินาที)', 'เลือดฟื้นเองตามปกติ'],
  },
  bell: {
    name: 'ผู้ตีระฆัง', weapon: 'ค้อนระฆัง', icon: '🔔',
    blurb: 'ผู้ดูแลระฆังของวิหารที่จมน้ำ ได้ยินจังหวะในทุกสิ่ง แม้แต่ในเสียงหัวใจของศัตรู',
    lines: ['ฟัน "ตรงจังหวะกลอง" ของเพลง = แรงขึ้นสูงสุด ×2.4 และสะสมพลังกังวาน', 'G (กังวานเต็ม): ตีระฆังใหญ่ ศัตรูรอบตัวมึนงงและกระเด็น', 'G (ยังไม่เต็ม): เคาะเบา ๆ — เสียงสะท้อนเผยตำแหน่งศัตรูทะลุความมืด'],
  },
  leech: {
    name: 'หมอปลิง', weapon: 'มีดกรีด', icon: '🩸',
    blurb: 'หมอเถื่อนจากบึงที่รักษาทุกโรคด้วยการเอาเลือดออก และไม่เคยให้ใครเอาเลือดตัวเองไปฟรี ๆ',
    lines: ['เลือดไม่ฟื้นเอง · ยิ่งเลือดน้อย ยิ่งตีแรง (สูงสุด ×2.4)', 'ฟันเบา: กรีดให้เลือดไหล · กดค้างแล้วปล่อย: ปาปลิง (ใช้เลือด 4)', 'ปลิงดูดเลือดศัตรูแล้วคลานกลับมาเติมเลือดให้ · G: เรียกปลิงกลับทันที'],
  },
  coffin: {
    name: 'สัปเหร่อแบกโลง', weapon: 'โลงศพ', icon: '⚰️',
    blurb: 'สัปเหร่อที่ไม่มีใครจ้าง เดินเก็บศพที่ไม่มีใครฝัง และยืมพลังจากพวกมันระหว่างทาง',
    lines: ['เหวี่ยงโลงช้าแต่หนัก · กดค้าง: ทุบพื้นวงกว้าง · ยกโลงเป็นกำแพงกันได้ทุกอย่าง (ปัดไม่ได้)', 'G ใกล้ศพ: เก็บศพเข้าโลง (4 ช่อง) ได้พลังของศพนั้นตราบที่ยังแบกอยู่', 'G ที่อื่น: ฝังศพ — กลายเป็นหลุมศพที่ใช้ฟื้นคืนชีพ และฟื้นเลือด'],
  },
  wick: {
    name: 'ผู้แบกไส้เทียน', weapon: 'กระถางไฟ', icon: '🕯️',
    blurb: 'ญาติห่าง ๆ ของเจ้าของโรงเตี๊ยม หัวเป็นเทียนที่ไม่เคยดับ... แต่ละลายลงทุกลมหายใจ',
    lines: ['เลือดคือไขเทียนที่ละลายลงเรื่อย ๆ · ยืนใกล้กองไฟเพื่อหล่อเทียนคืน', 'เหวี่ยงกระถางไฟระยะไกล ศัตรูติดไฟ · ยิ่งตีติดกันไฟยิ่งแรงแต่ละลายเร็ว · กดค้าง: หมุนรอบตัว', 'G: ปักเทียน (ร่างซีดเข้าไม่ได้) · คลิกขวาค้าง: ป้องไฟ — หายไปในความมืด'],
  },
};

// default first-person poses: [x, y, z, rx, ry, rz]
export const SWORD_POSE = {
  rest: [0.34, -0.4, -0.62, -1.05, -0.25, -0.3],
  guard: [0.08, -0.3, -0.52, -0.25, 0.15, 1.3],
  charge: [0.38, -0.3, -0.55, -0.35, -0.55, -0.95],
  up: [0.42, -0.16, -0.45, -0.25, -0.6, -1.25],
  end: [-0.28, -0.42, -0.55, -1.55, 0.55, 0.95],
  heavyEnd: [-0.36, -0.52, -0.5, -1.75, 0.75, 1.15],
};

// ------------------------------------------------------------------------------------------------
class Kit {
  constructor(game) {
    this.g = game;
    this.weapon = null;
    this.poses = SWORD_POSE;
    this.speedMul = 1;
    this.regenMul = 1;
    this.armorMul = 1;
    this.sprintCost = 1;
    this.climb = 1.25;
    this.blockMode = 'parry';     // 'parry' | 'wall' | 'none'
    this.hidden = false;          // enemies cannot notice you
    this.noAttack = false;
    this.darkness = 0;            // screen fade while hidden
    this.lightMul = 1;
    this.showLantern = true;
    this.world = [];              // meshes this kit added to the scene
  }
  get def() { return CLASSES[this.id]; }
  get combat() { return this.g.combat; }
  // path upgrades (src/upgrades.js): a step taken, and a deed done the path's way
  perk(id) { return !!this.g.progress?.has(this.id, id); }
  feat(n = 1) { this.g.progress?.feat(this.id, n); }
  get hpBonus() { return 0; }
  get parryBonus() { return 0; }
  targetMul() { return 1; }
  refresh() {}
  onParry() {}
  onWallBlock() {}

  addWeapon(group) {
    this.weapon = group;
    this.g.view.add(group);
  }

  // damage, reach and timing of a light or heavy blow; return null when the kit handles it
  swing(kind) {
    return kind === 'heavy'
      ? { dur: 0.62, cost: 26, hitAt: 0.42, range: 3.4, arc: 0.3, dmg: 3, heavy: true }
      : { dur: 0.36, cost: 10, hitAt: 0.35, range: 2.9, arc: 0.5, dmg: 1, heavy: false };
  }
  swingSound(kind) { this.g.audio.swing(kind === 'heavy'); }
  onStrike() {}
  onHit() {}
  onKill() {}
  onHurt(dmg) { return dmg; }
  skill() {}
  update() {}
  animateWeapon() {}
  label() {
    const g = this.g, lv = g.gear.sword, kingly = g.combat.swordMul > 1;
    return `${this.def.weapon}${kingly ? 'ราชาหิน' : ''}${lv ? ` +${lv}` : ''} ×${g.damageMul.toFixed(1)}`;
  }
  chips() { return []; }
  drawIcon(ctx, flash) { ctx.clearRect(0, 0, 48, 14); }
  serialize() { return {}; }
  load() {}
  dispose() {
    if (this.weapon) this.g.view.remove(this.weapon);
    for (const o of this.world) this.g.scene.remove(o);
    this.world = [];
  }
  addWorld(o) { this.g.scene.add(o); this.world.push(o); return o; }
  removeWorld(o) { this.g.scene.remove(o); this.world = this.world.filter((x) => x !== o); }
}

// a blow that is not the weapon's own swing (a crescent wave, a ringing bell, a blast of grave dirt):
// hits the wild and, online, creeps, buildings, kings and other heroes alike
function areaStrike(g, { range, arc = null, dmg, heavy = true, at = null, stagger = 0, skip = null }) {
  const c = g.combat, p = g.player, cam = g.camera.position, dir = p.forwardVec;
  const ox = at ? at.x : p.pos.x, oz = at ? at.z : p.pos.z;
  let n = 0;
  for (const e of c.enemies) {
    if (!e.alive || e.state === 'dying' || !e.obj.visible || e === skip) continue;
    const dx = e.pos.x - ox, dz = e.pos.z - oz, d = Math.hypot(dx, dz);
    if (d > range + e.def.radius || Math.abs(e.pos.y - p.pos.y) > 4) continue;
    if (arc != null && d > 1 && (dx * dir.x + dz * dir.z) / d < arc) continue;
    V.set(dx, 0, dz).normalize();
    c.damageEnemy(e, heavy, V, dmg);
    if (stagger && e.alive && e.state !== 'dying' && !e.def.boss && !e.moba) { e.state = 'stagger'; e.t = Math.max(e.t, stagger); }
    n++;
  }
  g.moba?.strike(arc != null ? { range, arc, dmg, heavy } : { radial: !at, range, dmg, heavy, aoe: at ? { dist: Math.hypot(ox - p.pos.x, oz - p.pos.z), r: range } : null }, cam, dir);
  return n;
}

// pixel helper for the 48x14 status-bar weapon icons
function pix(ctx) {
  ctx.clearRect(0, 0, 48, 14);
  return (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
}

// ------------------------------------------------------------------------------------------------
class Wanderer extends Kit {
  constructor(g) {
    super(g);
    this.id = 'wanderer';
    this.weapon = g.view.userData.sword;
    this.weapon.visible = true;
    this.cool = 0;
  }
  swing(kind) {
    const s = super.swing(kind);
    if (kind === 'heavy') { if (this.perk('cleave')) { s.dmg *= 1.35; s.range += 0.5; } }
    else {
      if (this.perk('keen')) s.dmg *= 1.2;
      if (this.perk('flurry')) { s.dur *= 0.85; s.cost *= 0.8; }
    }
    return s;
  }
  get hpBonus() { return this.perk('tough') ? 20 : 0; }
  get parryBonus() { return this.perk('deflect') ? 0.12 : 0; }

  // the crescent: a heavy blow throws a wave of moonlight along the ground
  onStrike(kind) {
    if (kind !== 'heavy' || !this.perk('crescent')) return;
    const g = this.g, p = g.player, f = p.forwardVec;
    areaStrike(g, { range: 8, arc: 0.86, dmg: 2, heavy: true });
    for (let i = 1; i <= 6; i++) g.particles.burst(new THREE.Vector3(p.pos.x + f.x * i * 1.3, p.pos.y + 0.9, p.pos.z + f.z * i * 1.3), 4, 2.5, 0.5);
    g.audio.burst({ dur: 0.5, freq: 2400, q: 1.5, gain: 0.16, sweep: 0.4 });
  }

  onKill() { if (this.combat.swing?.kind === 'heavy') this.feat(1); }

  // riposte: a parried blow is answered at once
  onParry(e, by) {
    this.feat(1);
    if (this.perk('deflect')) this.combat.stamina = Math.min(this.combat.maxStamina, this.combat.stamina + 10);
    if (!this.perk('riposte')) return;
    const g = this.g;
    if (e && e.alive && e.state !== 'dying') { V.set(e.pos.x - g.player.pos.x, 0, e.pos.z - g.player.pos.z).normalize(); this.combat.damageEnemy(e, true, V, 3); }
    else if (by != null) g.moba?.riposte(by, 3);
    g.audio.swing(true);
    g.ui.combatText('สวนกลับ!', 'parry');
  }

  skill() {
    if (this.cool > 0) { this.combat.say(`ยังตั้งหลักไม่ได้ (${Math.ceil(this.cool)})`); return; }
    const sw = this.perk('secondwind');
    this.cool = sw ? 18 : 30;
    this.combat.stamina = this.combat.maxStamina;
    this.combat.exhausted = false;
    if (sw) { const p = this.g.player; p.hp = Math.min(p.maxHp, p.hp + 25); }
    this.g.audio.charge();
    this.g.ui.combatText(sw ? 'ตั้งหลัก! +25 เลือด' : 'ตั้งหลัก!', 'parry');
  }
  update(dt) { this.cool = Math.max(0, this.cool - dt); }
  chips() { return [this.cool > 0 ? `ตั้งหลัก ${Math.ceil(this.cool)}s` : 'ตั้งหลัก [G] ✓']; }
  drawIcon() {}   // the HUD keeps drawing the sword for the wanderer
  dispose() { this.weapon.visible = false; this.weapon = null; super.dispose(); }
}

// ------------------------------------------------------------------------------------------------
// The Bellwright
const BELL_NOTES = [62, 65, 67, 69, 72, 74, 77, 79];   // D minor pentatonic, in key with the score

class Bellwright extends Kit {
  constructor(g, M) {
    super(g);
    this.id = 'bell';
    this.resonance = 0;
    this.streak = 0;
    this.pingCool = 0;
    this.marks = [];
    // a long-handled bell hammer
    const w = new THREE.Group();
    w.add(new THREE.Mesh(mergeGeometries([
      part(new THREE.CylinderGeometry(0.026, 0.03, 0.82, 6), C(0.45, 0.32, 0.22), { pos: [0, 0.3, 0] }),
      part(new THREE.CylinderGeometry(0.034, 0.034, 0.08, 6), C(0.25, 0.18, 0.12), { pos: [0, -0.08, 0] }),
    ]), M.wood));
    w.add(new THREE.Mesh(mergeGeometries([
      part(new THREE.CylinderGeometry(0.1, 0.1, 0.26, 8), C(0.72, 0.56, 0.3), { pos: [0, 0.76, 0], rot: [0, 0, Math.PI / 2] }),
      part(new THREE.CylinderGeometry(0.112, 0.112, 0.03, 8), C(0.5, 0.36, 0.2), { pos: [0.1, 0.76, 0], rot: [0, 0, Math.PI / 2] }),
      part(new THREE.CylinderGeometry(0.112, 0.112, 0.03, 8), C(0.5, 0.36, 0.2), { pos: [-0.1, 0.76, 0], rot: [0, 0, Math.PI / 2] }),
      // a little bell hanging from the head
      part(new THREE.CylinderGeometry(0.02, 0.05, 0.07, 7), C(0.85, 0.66, 0.32), { pos: [0, 0.6, 0.04] }),
    ]), M.metal));
    w.scale.setScalar(0.62);
    this.addWeapon(w);
    // markers left by the echo, visible through walls
    this.markMat = M.sprite.clone();
    this.markMat.color = new THREE.Color(1.6, 0.35, 0.25);
    this.markMat.depthTest = false;
    this.markMat.transparent = true;
  }

  // where we are in the beat of whatever is playing (compensating for output latency)
  beat() {
    const a = this.g.audio, lat = (a.ctx?.outputLatency || 0) + (a.ctx?.baseLatency || 0);
    const b = this.g.music?.beat(lat);
    if (b) return b;
    const period = 0.6;
    return { phase: (((a.ctx ? a.now : this.g.time) - lat) / period) % 1, period };
  }

  onBeat() {
    const b = this.beat();
    const off = Math.min(b.phase, 1 - b.phase) * b.period;
    const k = this.perk('ear') ? 1.4 : 1;
    return off <= Math.min(0.13 * k, b.period * 0.22 * k);
  }

  get need() { return this.perk('tolling') ? 70 : 100; }
  get cap() { return this.perk('scale') ? 9 : 6; }
  targetMul(e) { return this.perk('echo') && this.marks.some((m) => m.e === e && m.t > 0) ? 1.25 : 1; }

  // a light blow is judged when the button goes down (a click's release comes ~0.1 s later);
  // a heavy blow is judged when it is let go
  onPress() { this.pressOnBeat = this.onBeat(); this.pressAt = this.g.time; }

  swing(kind) {
    const heavy = kind === 'heavy';
    const on = !heavy && this.g.time - this.pressAt < 0.5 ? this.pressOnBeat : this.onBeat();
    if (on) this.streak = Math.min(this.cap, this.streak + 1);
    else if (this.perk('sustain')) this.streak = Math.max(0, this.streak - 2);
    else { this.streak = 0; this.resonance = Math.max(0, this.resonance - 8); }
    this.hitOnBeat = on;
    const mul = on ? 1.3 + 0.18 * Math.min(this.streak, this.cap) : 0.75;
    this.g.ui.combatText(on ? `♪ ตรงจังหวะ ×${mul.toFixed(1)}` : 'หลุดจังหวะ', on ? 'parry' : 'info');
    return heavy
      ? { dur: 0.6, cost: 24, hitAt: 0.42, range: 3.3, arc: 0.3, dmg: 2.6 * mul * (this.perk('weight') ? 1.3 : 1), heavy: true }
      : { dur: 0.38, cost: 10, hitAt: 0.35, range: 2.9, arc: 0.45, dmg: 1 * mul, heavy: false };
  }

  onHit(e, kind) {
    const a = this.g.audio;
    // every blow rings; on the beat, the notes climb the scale with the streak
    const m = this.hitOnBeat ? BELL_NOTES[Math.min(this.streak, BELL_NOTES.length) - 1] : 57;
    a.metal({ freq: mtof(m), dur: 1.6, gain: 0.07, partials: [1, 2.0, 2.76, 4.1, 5.4], pos: e.pos, verb: 0.6 });
    if (!this.hitOnBeat) return;
    this.resonance = Math.min(100, this.resonance + (kind === 'heavy' ? 30 : 18) * (this.perk('sustain') ? 1.5 : 1));
    this.feat(1);
    // the symphony: deep in a streak, every on-beat blow rings out around you (once per swing)
    const n = this.combat.swingN;
    if (this.perk('symphony') && this.streak >= 5 && this.ringSwing !== n) {
      this.ringSwing = n;
      areaStrike(this.g, { range: 4, dmg: 0.8, heavy: false, skip: e });
      const p = this.g.player;
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; this.g.particles.burst(new THREE.Vector3(p.pos.x + Math.cos(a) * 3, p.pos.y + 0.8, p.pos.z + Math.sin(a) * 3), 1, 4, 0.5); }
      a.metal({ freq: mtof(BELL_NOTES[Math.min(this.streak, BELL_NOTES.length) - 1] + 12), dur: 1.2, gain: 0.06, partials: [1, 2.0, 3.01], verb: 0.7 });
    }
  }

  // the great bell (and, with tolling, its echoes): everything in reach is thrown back and reeling
  greatBell(power = 1) {
    const g = this.g, c = this.combat, p = g.player, R = this.perk('wave') ? 14 : 10;
    for (const e of c.enemies) {
      if (!e.alive || e.state === 'dying' || !e.obj.visible) continue;
      const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
      if (d > R) continue;
      V.set(e.pos.x - p.pos.x, 0, e.pos.z - p.pos.z).normalize();
      c.damageEnemy(e, true, V, 2 * power);
      if (e.alive && e.state !== 'dying') { e.state = 'stagger'; e.t = (e.def.boss ? 1.0 : this.perk('wave') ? 3.5 : 2.6) * Math.max(0.5, power); e.vel.addScaledVector(V, 10 * power / e.def.weight); }
    }
    g.moba?.strike({ radial: true, range: R, dmg: 2 * power, heavy: true }, g.camera.position, p.forwardVec);
  }

  skill() {
    const g = this.g, c = this.combat, p = g.player;
    if (this.resonance >= this.need) {
      this.resonance = 0;
      this.streak = 0;
      this.greatBell(1);
      if (this.perk('tolling')) this.tolls = [1, 2, 3];
      g.audio.metal({ freq: 73.4, dur: 6, gain: 0.35, partials: [1, 2.02, 2.76, 4.1, 5.4, 6.8], verb: 0.9 });
      g.audio.thump({ freq: 55, dur: 2.5, gain: 0.5, drop: 0.8 });
      p.shake = Math.max(p.shake, 0.5);
      c.hitStop = 0.12;
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2;
        g.particles.burst(new THREE.Vector3(p.pos.x + Math.cos(a) * 3, p.pos.y + 1, p.pos.z + Math.sin(a) * 3), 2, 7, 0.8);
      }
      g.ui.combatText('ระฆังใหญ่!', 'parry');
      return;
    }
    if (this.pingCool > 0) { c.say('ระฆังยังสั่นอยู่...'); return; }
    if (c.stamina < 12) { c.say('เหนื่อยเกินไป'); return; }
    c.spend(12);
    this.pingCool = 3;
    // a soft chime that comes back from everything alive in the dark
    g.audio.metal({ freq: mtof(86), dur: 3.5, gain: 0.08, partials: [1, 2.0, 3.01], verb: 1 });
    g.audio.metal({ freq: mtof(81), dur: 3.5, gain: 0.05, delay: 0.25, partials: [1, 2.0, 3.01], verb: 1 });
    this.clearMarks();
    let n = 0;
    for (const e of c.enemies) {
      if (!e.alive || e.state === 'dying' || !c.isActive(e)) continue;
      if (e.pos.distanceTo(p.pos) > (this.perk('echo') ? 90 : 55)) continue;
      const s = this.addWorld(new THREE.Sprite(this.markMat));
      s.renderOrder = 999;
      this.marks.push({ s, e, t: this.perk('echo') ? 14 : 6 });
      n++;
    }
    g.ui.combatText(n ? `เสียงสะท้อน: ${n} ตัว` : 'เงียบสนิท...', 'info');
  }

  clearMarks() { for (const m of this.marks) this.removeWorld(m.s); this.marks = []; }

  update(dt) {
    this.pingCool = Math.max(0, this.pingCool - dt);
    // the bell keeps tolling after the great blow
    if (this.tolls?.length) {
      this.tolls = this.tolls.map((t) => t - dt);
      if (this.tolls[0] <= 0) {
        this.tolls.shift();
        this.greatBell(0.4);
        this.g.audio.metal({ freq: 73.4 * 2, dur: 3, gain: 0.18, partials: [1, 2.02, 2.76, 4.1], verb: 0.9 });
      }
    }
    for (const m of this.marks) {
      m.t -= dt;
      const e = m.e;
      m.s.position.set(e.pos.x, e.pos.y + (e.def.fly ? 0 : e.def.height + 0.4), e.pos.z);
      m.s.scale.setScalar(1.2 + Math.sin(this.g.time * 6) * 0.15);
      m.s.material.opacity = clamp(m.t / 2, 0, 1);
      if (!e.alive) m.t = Math.min(m.t, 0.3);
    }
    if (this.marks.some((m) => m.t <= 0)) {
      for (const m of this.marks) if (m.t <= 0) this.removeWorld(m.s);
      this.marks = this.marks.filter((m) => m.t > 0);
    }
    // the metronome ring at the crosshair
    const b = this.beat(), el = this.beatEl || (this.beatEl = document.getElementById('beat'));
    const k = Math.pow(1 - b.phase, 4);
    el.style.transform = `scale(${1 + k * 0.9})`;
    el.style.opacity = (0.35 + k * 0.6).toFixed(2);
    el.classList.toggle('full', this.resonance >= this.need);
  }

  animateWeapon(w) { if (this.resonance >= this.need) w.position.x += (Math.random() - 0.5) * 0.004; }

  chips() {
    const bar = '▮'.repeat(Math.floor(this.resonance / 10)) + '▯'.repeat(10 - Math.floor(this.resonance / 10));
    return [`กังวาน ${bar}${this.resonance >= this.need ? ' [G] ระฆังใหญ่!' : ''}`, ...(this.streak > 1 ? [`จังหวะต่อเนื่อง ×${this.streak}`] : [])];
  }

  drawIcon(ctx, flash) {
    const px = pix(ctx);
    px(2, 6, 30, 2, flash ? '#e8d8b8' : '#7a5838'); px(2, 6, 30, 1, '#a07850');
    px(32, 2, 9, 10, flash ? '#fff0c0' : '#c8963c'); px(32, 2, 9, 1, '#f0c870'); px(32, 11, 9, 1, '#7a5420');
    px(34, 2, 1, 10, '#8a6428'); px(38, 2, 1, 10, '#8a6428');
    px(42, 8, 3, 4, '#d8a848'); px(43, 12, 1, 1, '#6a4818');
  }

  dispose() { this.clearMarks(); const el = document.getElementById('beat'); el.style.opacity = 0; super.dispose(); }
}

// ------------------------------------------------------------------------------------------------
// The Leech-Doctor
const LEECH_MAX_OUT = 3;
const LEECH_DRAIN = 0.4;        // enemy hp per second
const BLOOD_TO_HP = 12;         // player hp per point of enemy blood brought back

class LeechDoctor extends Kit {
  constructor(g, M) {
    super(g);
    this.id = 'leech';
    this.regenMul = 0;
    this.leeches = [];
    const w = new THREE.Group();
    w.add(new THREE.Mesh(mergeGeometries([
      part(new THREE.CylinderGeometry(0.03, 0.026, 0.3, 6), C(0.85, 0.8, 0.68), { pos: [0, 0.02, 0] }),
      part(new THREE.SphereGeometry(0.04, 6, 4), C(0.8, 0.74, 0.6), { pos: [0, -0.14, 0] }),
    ]), M.plain));
    w.add(new THREE.Mesh(mergeGeometries([
      part(new THREE.BoxGeometry(0.045, 0.42, 0.01), C(0.78, 0.82, 0.86), { pos: [0, 0.38, 0] }),
      part(new THREE.ConeGeometry(0.032, 0.12, 4), C(0.78, 0.82, 0.86), { pos: [0, 0.65, 0], rot: [0, Math.PI / 4, 0], scale: [1, 1, 0.3] }),
      part(new THREE.BoxGeometry(0.03, 0.3, 0.012), C(0.55, 0.12, 0.1), { pos: [0.006, 0.36, 0] }),   // old blood
    ]), M.metal));
    // a leech coiled round the wrist
    w.add(new THREE.Mesh(part(new THREE.TorusGeometry(0.05, 0.022, 5, 9), C(0.22, 0.1, 0.16), { pos: [0, -0.06, 0], rot: [Math.PI / 2, 0, 0] }), M.plain));
    w.scale.setScalar(0.62);
    this.addWeapon(w);
    this.leechGeo = part(new THREE.SphereGeometry(0.09, 7, 5), C(0.2, 0.08, 0.14), { scale: [0.75, 0.75, 2.2] });
    this.leechMat = M.plain;
  }

  get frenzy() { const p = this.g.player; return 1 + (1 - p.hp / p.maxHp) * (this.perk('bloodlust') ? 2.0 : 1.4); }
  get maxOut() { return this.perk('swarm') ? 5 : LEECH_MAX_OUT; }

  swing(kind) {
    if (kind === 'heavy') { this.throwLeech(); return null; }
    return { dur: 0.26, cost: 7, hitAt: 0.45, range: 2.5, arc: 0.6, dmg: 0.75 * this.frenzy * (this.perk('scalpel') ? 1.25 : 1), heavy: false };
  }

  onHit(e) {
    e.dots = e.dots || {};
    e.dots.bleed = this.perk('deepcut') ? { dps: 0.5, t: 5 } : { dps: 0.3, t: 3 };
    this.g.particles.burst(e.pos.clone().setY(e.pos.y + e.def.height * 0.6), 5, 2.5, 0.4);
    // dissection: the fourth cut in a row on the same body opens it up
    if (!this.perk('dissect')) return;
    this.cuts = this.cutOn === e ? (this.cuts || 0) + 1 : 1;
    this.cutOn = e;
    if (this.cuts >= 4 && e.alive && e.state !== 'dying') {
      this.cuts = 0;
      V.set(e.pos.x - this.g.player.pos.x, 0, e.pos.z - this.g.player.pos.z).normalize();
      this.combat.damageEnemy(e, true, V, 1.5 * this.frenzy);
      const p = this.g.player;
      p.hp = Math.min(p.maxHp, p.hp + 6);
      this.g.ui.combatText('ผ่า! +6 เลือด', 'parry');
      this.g.particles.burst(e.pos.clone().setY(e.pos.y + e.def.height * 0.6), 18, 4, 0.6);
    }
  }

  throwLeech() {
    const g = this.g, p = g.player, c = this.combat;
    if (this.leeches.length >= this.maxOut) { c.say('ปลิงออกไปหมดแล้ว'); return; }
    if (g.bag.count('leech_live') <= 0) { c.say('ไม่มีปลิงในกระเป๋า'); return; }
    if (p.hp <= 6) { c.say('เลือดไม่พอจะเลี้ยงปลิง'); return; }
    g.bag.remove('leech_live', 1);
    p.hp -= this.perk('homing') ? 2 : 4;
    c.spend(8);
    const m = this.addWorld(new THREE.Mesh(this.leechGeo, this.leechMat));
    const dir = p.forwardVec;
    const pos = g.camera.position.clone().addScaledVector(dir, 0.6).add(new THREE.Vector3(0, -0.15, 0));
    this.leeches.push({ m, state: 'fly', pos, vel: dir.clone().multiplyScalar(21).add(new THREE.Vector3(0, 2.5, 0)), t: 0, blood: 0, e: null, off: null });
    g.audio.swing(false);
    g.audio.burst({ dur: 0.25, freq: 500, q: 3, gain: 0.1, sweep: 1.8 });
    g.hud.grin();
  }

  // G: every leech lets go (tearing a little more out on the way) and comes home
  skill() {
    if (!this.leeches.length) { this.combat.say('ไม่มีปลิงอยู่ข้างนอก'); return; }
    const burst = this.perk('burst');
    for (const L of this.leeches) {
      if (L.state === 'drink' && L.e?.alive && L.e.state !== 'dying') {
        V.set(L.e.pos.x - this.g.player.pos.x, 0, L.e.pos.z - this.g.player.pos.z).normalize();
        L.blood += burst ? 1.2 : 0.6;
        // the burst: the leech bursts on its host and sprays everyone around
        if (burst) {
          const host = L.e, at = host.pos.clone();
          this.combat.damageEnemy(host, true, V, 2);
          for (const o of this.combat.enemies) {
            if (!o.alive || o.state === 'dying' || o.pos.distanceTo(at) > 3) continue;
            o.dots = o.dots || {}; o.dots.bleed = { dps: 0.5, t: 5 };
          }
          this.g.particles.burst(at.setY(at.y + host.def.height * 0.6), 20, 4, 0.7);
        } else this.combat.damageEnemy(L.e, false, V, 0.6);
      }
      L.state = 'home';
    }
    if (burst) this.g.audio.burst({ dur: 0.4, freq: 300, q: 1, gain: 0.3 });
    this.g.audio.voice({ freq: 160, dur: 0.4, gain: 0.08, slide: 1.6, formant: 700, vibrato: 20, type: 'square' });
  }

  update(dt) {
    const g = this.g, c = this.combat, cam = g.camera.position, T = g.terrain;
    for (const L of this.leeches) {
      L.t += dt;
      if (L.state === 'fly') {
        L.vel.y -= 9 * dt;
        L.pos.addScaledVector(L.vel, dt);
        for (const e of c.enemies) {
          if (!e.alive || e.state === 'dying' || !e.obj.visible) continue;
          const cy = e.pos.y + (e.def.fly ? 0 : e.def.height * 0.6);
          if (Math.hypot(L.pos.x - e.pos.x, L.pos.y - cy, L.pos.z - e.pos.z) < e.def.radius + 0.55) {
            L.state = 'drink'; L.e = e; L.t = 0;
            const a = Math.random() * Math.PI * 2;
            L.off = new THREE.Vector3(Math.cos(a) * e.def.radius * 0.9, cy - e.pos.y + (Math.random() - 0.3) * 0.3, Math.sin(a) * e.def.radius * 0.9);
            g.audio.burst({ dur: 0.2, freq: 700, q: 2, gain: 0.18, pos: e.pos });
            if (e.state === 'idle' || e.state === 'return') e.state = 'chase';
            break;
          }
        }
        if (L.state === 'fly' && (L.pos.y < T.getHeight(L.pos.x, L.pos.z) || L.t > 2)) { L.state = 'home'; L.t = 0; }
      } else if (L.state === 'drink') {
        const e = L.e;
        if (!e.alive || e.state === 'dying' || !e.obj.visible || L.t > 8) { L.state = 'home'; continue; }
        L.pos.copy(e.pos).add(L.off);
        const d = Math.min(e.hp, LEECH_DRAIN * (this.perk('fat') ? 1.5 : 1) * dt);
        e.hp -= d;
        L.blood += d;
        if (e.hp <= 0.001) c.kill(e);
      } else if (L.state === 'home') {
        V.copy(cam).sub(L.pos);
        const d = V.length();
        L.pos.addScaledVector(V.normalize(), Math.min(d, 16 * dt));
        if (d < 0.9) this.collect(L);
      }
      L.m.position.copy(L.pos);
      L.m.lookAt(L.state === 'home' ? cam : L.state === 'fly' ? V.copy(L.pos).add(L.vel) : L.e.pos);
      const fat = 1 + L.blood * 0.45;
      L.m.scale.set(fat, fat, 1 + Math.sin(g.time * 9 + L.t) * 0.15);
    }
    this.leeches = this.leeches.filter((L) => !L.done);
  }

  collect(L) {
    const g = this.g, p = g.player;
    L.done = true;
    this.removeWorld(L.m);
    const heal = L.blood * BLOOD_TO_HP * (this.perk('homing') ? 1.5 : 1);
    if (heal > 0.5) this.feat(Math.round(heal));
    if (heal > 0.5) {
      p.hp = Math.min(p.maxHp, p.hp + heal);
      g.ui.combatText(`+${Math.round(heal)} เลือด`, 'parry');
      g.audio.drink();
    }
    if (g.bag.add('leech_live', 1) > 0) g.ui.toast('กระเป๋าเต็ม — ปลิงตัวนั้นคลานหนีไปแล้ว');
  }

  chips() {
    const out = this.leeches.length, have = this.g.bag.count('leech_live');
    return [`ปลิง ${have} ในกระเป๋า · ${out}/${this.maxOut} ออกล่า`, `เลือดคลั่ง ×${this.frenzy.toFixed(1)}`];
  }

  drawIcon(ctx, flash) {
    const px = pix(ctx);
    px(2, 5, 12, 4, '#d8cfb4'); px(2, 5, 12, 1, '#f0e8d0');
    px(14, 6, 22, 2, flash ? '#ffffff' : '#c8d0d8'); px(14, 6, 18, 1, '#e8eef4'); px(36, 7, 4, 1, '#a8b0b8');
    px(18, 7, 10, 1, '#8a1a12');
    px(38, 3, 8, 4, '#3a1a2a'); px(39, 2, 6, 1, '#5a2a40'); px(44, 7, 3, 3, '#3a1a2a');
  }

  dispose() {
    // leeches out in the world come home to the bag
    for (const L of this.leeches) if (!L.done) this.g.bag.add('leech_live', 1);
    this.leeches = [];
    super.dispose();
  }
}

// ------------------------------------------------------------------------------------------------
// The Coffin-Bearer
export const CORPSES = {
  gaunt: { name: 'ร่างซูบ', power: 'วิ่งไม่เปลืองแรง เร็วขึ้น' },
  crawler: { name: 'ร่างคลาน', power: 'ปีนทางชันได้' },
  weeper: { name: 'หญิงร่ำไห้', power: 'ศัตรูที่จ้องอยู่ขยับไม่ได้' },
  brute: { name: 'ร่างยักษ์', power: 'ทุบพื้นกว้างและแรงขึ้น' },
  wolf: { name: 'หมาป่าเงา', power: 'เหวี่ยงโลงเร็วขึ้น' },
  straw: { name: 'หุ่นฟาง', power: 'รับดาเมจลดลง 15%' },
};
const COFFIN_SLOTS = 4;
const COFFIN_POSE = {
  rest: [0.62, -0.62, -1.0, 0.12, -0.55, 0.2],
  guard: [0.04, -0.42, -0.82, 0.02, 0, 0],
  charge: [0.4, 0.12, -0.9, -0.45, -0.25, 0.1],
  up: [0.85, -0.38, -0.85, 0.05, -1.15, 0.55],
  end: [-0.6, -0.62, -1.0, 0.0, 0.95, -0.5],
  heavyEnd: [0.05, -1.05, -1.25, -1.35, 0, 0],
};

function coffinGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.22, -0.95); s.lineTo(0.22, -0.95); s.lineTo(0.36, 0.42); s.lineTo(0.24, 0.95);
  s.lineTo(-0.24, 0.95); s.lineTo(-0.36, 0.42); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.36, bevelEnabled: false });
  g.translate(0, 0, -0.18);
  return g.toNonIndexed();
}

class CoffinBearer extends Kit {
  constructor(g, M) {
    super(g);
    this.id = 'coffin';
    this.poses = COFFIN_POSE;
    this.blockMode = 'wall';
    this.slots = [];
    this.graves = [];
    this.M = M;
    const w = new THREE.Group();
    w.add(new THREE.Mesh(part(coffinGeometry(), C(0.42, 0.3, 0.24)), M.wood));
    w.add(new THREE.Mesh(mergeGeometries([
      part(new THREE.BoxGeometry(0.06, 0.62, 0.02), C(0.7, 0.66, 0.6), { pos: [0, 0.3, 0.19] }),
      part(new THREE.BoxGeometry(0.36, 0.06, 0.02), C(0.7, 0.66, 0.6), { pos: [0, 0.46, 0.19] }),
      part(new THREE.BoxGeometry(0.62, 0.05, 0.38), C(0.3, 0.3, 0.32), { pos: [0, 0.1, 0] }),
      part(new THREE.BoxGeometry(0.5, 0.05, 0.38), C(0.3, 0.3, 0.32), { pos: [0, -0.6, 0] }),
    ]), M.metal));
    w.scale.setScalar(0.62);
    this.addWeapon(w);
    this.apply();
  }

  // a corpse's power: carried in the coffin, or still lingering after its burial
  has(type) { return this.slots.includes(type) || !!this.lingering?.some((l) => l.type === type); }
  get maxSlots() { return this.perk('roomy') ? 6 : COFFIN_SLOTS; }

  // carried corpses change the rules
  apply() {
    const p = this.g.player;
    this.speedMul = (this.has('gaunt') ? 1.0 : 0.88) - this.slots.length * 0.025;
    this.sprintCost = this.has('gaunt') ? 0 : 1;
    this.climb = this.has('crawler') ? 4 : 1.25;
    this.armorMul = (this.has('straw') ? 0.85 : 1) * (this.perk('plated') ? 0.88 : 1);
    p.climb = this.climb;
  }
  refresh() { this.apply(); }

  onWallBlock(e, dmg, by) {
    this.feat(1);
    if (!this.perk('reflect')) return;
    const g = this.g;
    if (e && e.alive && e.state !== 'dying') { V.set(e.pos.x - g.player.pos.x, 0, e.pos.z - g.player.pos.z).normalize(); this.combat.damageEnemy(e, false, V, 1.2); }
    else if (by != null) g.moba?.riposte(by, 1.2);
  }

  swing(kind) {
    const quick = this.has('wolf') ? 0.75 : 1, dead = this.perk('strength') ? 1 + 0.06 * this.slots.length : 1;
    if (kind === 'heavy') {
      const big = this.has('brute'), quake = this.perk('quake');
      return { dur: 1.0 * quick, cost: 32, hitAt: 0.55, aoe: { dist: 2.2, r: (big ? 5.5 : 3.6) + (quake ? 1.2 : 0) }, dmg: (big ? 6 : 4) * (quake ? 1.25 : 1) * dead, heavy: true };
    }
    return { dur: 0.62 * quick, cost: 16, hitAt: 0.5, range: 3.5, arc: 0.12, dmg: 1.6 * dead, heavy: true };
  }

  swingSound(kind) {
    this.g.audio.swing(true);
    if (kind === 'heavy') this.g.audio.burst({ dur: 0.6, freq: 260, q: 1, gain: 0.2, sweep: 2, attack: 0.3 });
  }

  onStrike(kind) {
    if (kind !== 'heavy') return;
    const g = this.g, p = g.player, f = p.forwardVec;
    const at = new THREE.Vector3(p.pos.x + f.x * 2.2, p.pos.y + 0.2, p.pos.z + f.z * 2.2);
    g.particles.burst(at, 22, 6, 1.1);
    g.audio.slam(at);
    p.shake = Math.max(p.shake, 0.3);
  }

  onHit(e) { this.g.audio.thump({ freq: 90, dur: 0.25, gain: 0.3, pos: e.pos }); }

  onKill(e) {
    if (!CORPSES[e.type]) return;
    e.corpseHold = 30;          // the body stays put until it is taken or the time runs out
    if (!this.hinted) { this.hinted = true; setTimeout(() => this.g.ui.toast('กด G ใกล้ศพเพื่อเก็บเข้าโลง'), 900); }
  }

  nearestCorpse() {
    const p = this.g.player;
    let best = null, bd = 3.6;
    for (const e of this.combat.enemies) {
      if (e.state !== 'dying' || !(e.corpseHold > 0)) continue;
      const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  skill() {
    const g = this.g, e = this.nearestCorpse();
    if (e) {
      if (this.slots.length >= this.maxSlots && !this.bury()) return;   // make room: the oldest goes in the ground
      this.feat(2);
      e.corpseHold = 0;
      e.t = Math.min(e.t, 0.05);
      this.slots.push(e.type);
      this.apply();
      g.audio.thump({ freq: 110, dur: 0.3, gain: 0.35 });
      g.audio.burst({ dur: 0.4, freq: 600, q: 1, gain: 0.12, delay: 0.15 });
      g.particles.burst(e.pos.clone().setY(e.pos.y + 0.5), 10, 2, 0.6);
      g.ui.combatText(`เก็บ${CORPSES[e.type].name}: ${CORPSES[e.type].power}`, 'parry');
      g.hud.grin();
      return;
    }
    if (!this.slots.length) { this.combat.say('ไม่มีศพในโลง และไม่มีศพให้เก็บ'); return; }
    this.bury();
  }

  // the oldest corpse goes into the ground at your feet: a grave to wake up at
  bury() {
    const g = this.g, p = g.player;
    if (p.inWater > 0.15) { this.combat.say('ฝังศพในน้ำไม่ได้'); return false; }
    const type = this.slots.shift();
    this.apply();
    const f = p.forwardVec;
    const x = p.pos.x + f.x * 1.4, z = p.pos.z + f.z * 1.4;
    this.addGrave(x, z, type);
    g.checkpoint = { x, z };
    const heal = this.perk('hallowed') ? 70 : 40;
    p.hp = Math.min(p.maxHp, p.hp + heal);
    this.feat(3);
    // lingering: the grave bursts open around you, and the dead one's strength stays a while
    if (this.perk('lingering')) {
      areaStrike(g, { range: 5, dmg: 3, heavy: true, stagger: 1.2 });
      g.particles.burst(new THREE.Vector3(x, p.pos.y + 0.3, z), 30, 6, 1.2);
      g.audio.slam({ x, y: p.pos.y, z });
      (this.lingering = this.lingering || []).push({ type, t: 45 });
      this.apply();
    }
    g.audio.thump({ freq: 70, dur: 0.6, gain: 0.4 });
    g.audio.burst({ dur: 0.8, freq: 300, q: 0.8, gain: 0.2 });
    g.audio.chime();
    g.ui.combatText(`ฝัง${CORPSES[type].name} · จุดฟื้นคืนชีพใหม่ · +${heal} เลือด`, 'parry');
    g.save();
    return true;
  }

  addGrave(x, z, type) {
    const g = this.g, M = this.M, y = Math.max(g.terrain.getHeight(x, z), g.collision.groundAt(x, z, g.terrain.getHeight(x, z) + 2, 0.65));
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(part(new THREE.SphereGeometry(0.7, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), C(0.28, 0.22, 0.17), { scale: [1, 0.35, 1.6] }), M.plain));
    grp.add(new THREE.Mesh(mergeGeometries([
      part(new THREE.BoxGeometry(0.1, 1.0, 0.08), C(0.5, 0.4, 0.3), { pos: [0, 0.5, -1.0] }),
      part(new THREE.BoxGeometry(0.55, 0.09, 0.08), C(0.5, 0.4, 0.3), { pos: [0, 0.72, -1.0] }),
    ]), M.wood));
    const flame = new THREE.Sprite(M.candleSprite);
    flame.position.set(0.25, 0.25, -0.85);
    flame.scale.setScalar(0.6);
    grp.add(flame);
    grp.position.set(x, y, z);
    grp.rotation.y = g.player.yaw;
    this.addWorld(grp);
    this.graves.push({ x, z, type, obj: grp });
    if (this.graves.length > 6) { const old = this.graves.shift(); this.removeWorld(old.obj); }
  }

  update(dt) {
    const p = this.g.player, fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    // lingering powers fade
    if (this.lingering?.length) {
      for (const l of this.lingering) l.t -= dt;
      if (this.lingering.some((l) => l.t <= 0)) { this.lingering = this.lingering.filter((l) => l.t > 0); this.apply(); }
    }
    // bulldoze: the raised coffin is a battering ram, carried at full speed
    this.speedBoost = this.perk('bulldoze') && this.combat.blocking;
    if (this.speedBoost) {
      for (const e of this.combat.enemies) {
        if (!e.alive || e.state === 'dying' || !e.obj.visible || e.def.boss || e.moba) continue;
        const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz);
        if (d > 2.4 + e.def.radius || d < 1e-3 || (dx * fx + dz * fz) / d < 0.5) continue;
        e.vel.addScaledVector(V.set(dx / d, 0, dz / d), 9 * dt * 10 / e.def.weight);
        if (e.state !== 'stagger') { e.state = 'stagger'; e.t = 0.4; }
      }
    }
    // a weeper in the coffin lends you her curse: whatever you stare at cannot move
    if (!this.has('weeper')) return;
    for (const e of this.combat.enemies) {
      if (!e.alive || e.state === 'dying' || !e.obj.visible || e.def.boss) continue;
      const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d > 18 || d < 1e-3) continue;
      if ((dx * fx + dz * fz) / d > 0.93 && (e.state === 'chase' || e.state === 'windup' || e.state === 'idle' || e.state === 'return' || e.state === 'stagger')) {
        e.state = 'stagger';
        e.t = Math.max(e.t, 0.15);
      }
    }
  }

  chips() {
    const list = this.slots.map((t) => `⚰ ${CORPSES[t].name} — ${CORPSES[t].power}`);
    for (const l of this.lingering || []) list.push(`👻 ${CORPSES[l.type].name} ${Math.ceil(l.t)}s`);
    return list.length ? list : [`โลงว่าง (0/${this.maxSlots}) · ฆ่าแล้วกด G ใกล้ศพ`];
  }

  label() { return `${super.label()} · ${this.slots.length}/${this.maxSlots}`; }

  drawIcon(ctx, flash) {
    const px = pix(ctx);
    const wood = flash ? '#c8a080' : '#6a4a34';
    for (let x = 4; x < 44; x++) {
      const t = (x - 4) / 40, half = t < 0.7 ? 2 + t * 6 : 6.2 - (t - 0.7) * 10;
      px(x, Math.round(7 - half), 1, Math.round(half * 2), wood);
    }
    px(4, 5, 40, 1, '#8a6448');
    px(26, 3, 2, 8, '#b8b0a0'); px(23, 5, 8, 2, '#b8b0a0');
    for (let i = 0; i < this.slots.length; i++) px(8 + i * 4, 9, 2, 2, '#d8d0c8');
  }

  serialize() { return { slots: this.slots, graves: this.graves.map(({ x, z, type }) => ({ x, z, type })) }; }
  load(d = {}) {
    this.slots = (d.slots || []).filter((t) => CORPSES[t]).slice(0, this.maxSlots);
    for (const gv of d.graves || []) this.addGrave(gv.x, gv.z, gv.type);
    this.apply();
  }
  dispose() { this.g.player.climb = 1.25; super.dispose(); }
}

// ------------------------------------------------------------------------------------------------
// The Wick-Bearer
const WICK_POSE = {
  rest: [0.36, 0.22, -0.74, Math.PI, 0.25, 0.08],
  guard: [0.16, -0.02, -0.5, Math.PI, 0, -0.1],
  charge: [0.55, 0.05, -0.55, -0.4, -0.7, -1.3],
  up: [0.55, 0.05, -0.55, -0.4, -0.7, -1.4],
  end: [-0.45, -0.35, -0.6, -1.7, 0.7, 1.1],
  heavyEnd: [0.0, -0.2, -0.7, -1.5, 0, 1.5],
};
const CANDLE_R = 5.5;
const MAX_CANDLES = 3;

class WickBearer extends Kit {
  constructor(g, M) {
    super(g);
    this.id = 'wick';
    this.poses = WICK_POSE;
    this.regenMul = 0;
    this.blockMode = 'none';
    this.showLantern = false;
    this.heat = 0;
    this.snuffed = false;
    this.candles = [];
    this.M = M;
    // a censer on a short chain: the cage hangs at the far end (+Y), the flame inside it
    const w = new THREE.Group();
    w.add(new THREE.Mesh(mergeGeometries([
      ...[0.12, 0.24, 0.36, 0.48].map((y, i) => part(new THREE.TorusGeometry(0.03, 0.009, 4, 6), C(0.5, 0.48, 0.45), { pos: [0, y, 0], rot: [0, i % 2 ? Math.PI / 2 : 0, 0] })),
      part(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 5), C(0.35, 0.25, 0.18), { pos: [0, -0.02, 0] }),
      part(new THREE.CylinderGeometry(0.1, 0.13, 0.05, 8), C(0.55, 0.45, 0.32), { pos: [0, 0.6, 0] }),
      part(new THREE.CylinderGeometry(0.13, 0.08, 0.07, 8), C(0.55, 0.45, 0.32), { pos: [0, 0.82, 0] }),
      ...[0, 1, 2, 3, 4, 5].map((i) => part(new THREE.BoxGeometry(0.012, 0.2, 0.012), C(0.5, 0.42, 0.3), { pos: [Math.cos(i * 1.05) * 0.115, 0.71, Math.sin(i * 1.05) * 0.115] })),
    ]), M.metal));
    this.flame = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 0.95, 0.35) }));
    this.flame.position.y = 0.72;
    w.add(this.flame);
    w.scale.setScalar(0.62);
    this.addWeapon(w);
    this.candleGeo = mergeGeometries([
      part(new THREE.CylinderGeometry(0.07, 0.09, 0.42, 7), C(0.9, 0.86, 0.74), { pos: [0, 0.21, 0] }),
      part(new THREE.CylinderGeometry(0.16, 0.2, 0.05, 8), C(0.8, 0.74, 0.6), { pos: [0, 0.02, 0] }),
      part(new THREE.SphereGeometry(0.05, 5, 4), C(0.92, 0.88, 0.76), { pos: [0.06, 0.25, 0], scale: [0.7, 2.2, 0.7] }),
    ]);
  }

  nearFire() {
    const cam = this.g.camera.position;
    for (const f of this.g.fx.fires) {
      const q = f.s.position;
      if (Math.hypot(q.x - cam.x, q.z - cam.z) < 5 && Math.abs(q.y - cam.y) < 5) return true;
    }
    return false;
  }

  get maxCandles() { return this.perk('longwick') ? 4 : MAX_CANDLES; }
  get candleR() { return this.perk('ward') ? 7.5 : CANDLE_R; }

  swing(kind) {
    const h = this.heat * (this.perk('stoke') ? 1.3 : 1);
    // ambush: the first blow out of the dark burns three times as hot
    const amb = this.perk('ambush') && this.g.time - (this.unsnuffAt ?? -9) < 2 && !this.ambushUsed;
    if (amb) { this.ambushUsed = true; this.ambushing = true; this.feat(1); this.g.ui.combatText('ลอบเผา! ×3', 'parry'); }
    else this.ambushing = false;
    const m = amb ? 3 : 1;
    if (kind === 'heavy') {
      const p = this.g.player;
      if (p.hp > 8) p.hp -= 3;        // a spin flares the flame and costs wax
      return { dur: 0.85, cost: 20, hitAt: 0.5, radial: true, range: 4.4 + h, dmg: 2.2 * (1 + h * 0.8) * m, heavy: true };
    }
    return { dur: 0.5, cost: 12, hitAt: 0.45, range: 4.0 + h * 1.2, arc: 0.0, dmg: 1 * (1 + h * 0.8) * m, heavy: false };
  }

  // firestorm: the spin leaves a ring of fire burning on the ground
  onStrike(kind) {
    if (kind !== 'heavy' || !this.perk('firestorm')) return;
    const g = this.g, p = g.player, grp = new THREE.Group();
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, f = new THREE.Sprite(this.M.fireSprite);
      f.position.set(Math.cos(a) * 3.6, 0.5, Math.sin(a) * 3.6);
      f.scale.setScalar(1.3);
      grp.add(f);
    }
    grp.position.set(p.pos.x, p.pos.y, p.pos.z);
    this.addWorld(grp);
    (this.fires = this.fires || []).push({ obj: grp, x: p.pos.x, z: p.pos.z, t: 4, tick: 0 });
    g.audio.burst({ dur: 1.2, freq: 400, q: 0.6, gain: 0.25, sweep: 0.6, attack: 0.1 });
  }

  swingSound(kind) {
    const a = this.g.audio;
    a.swing(kind === 'heavy');
    a.burst({ dur: 0.5, freq: 500, q: 0.7, gain: 0.14, sweep: 1.6, attack: 0.1, verb: 0.1 });   // the flame roars
    for (let i = 0; i < 3; i++) a.metal({ freq: 2400 + i * 300, dur: 0.12, gain: 0.02, delay: i * 0.05, partials: [1, 2.3] });   // chain
  }

  onHit(e) {
    e.dots = e.dots || {};
    e.dots.burn = this.ambushing ? { dps: 1.0, t: 5 } : { dps: this.perk('blaze') ? 0.65 : 0.4, t: 3 };
    if (this.heat >= 0.5) this.feat(1);
    this.heat = Math.min(1, this.heat + (this.perk('stoke') ? 0.18 : 0.12));
    this.g.audio.burst({ dur: 0.35, freq: 1200, q: 0.6, gain: 0.18, sweep: 0.5, pos: e.pos });
    this.g.particles.burst(e.pos.clone().setY(e.pos.y + e.def.height * 0.5), 8, 3, 0.6);
  }

  skill() {
    const g = this.g, p = g.player;
    if (this.snuffed) return;
    if (p.hp <= 12) { this.combat.say('ไขเทียนเหลือน้อยเกินไป'); return; }
    if (p.inWater > 0.15) { this.combat.say('ปักเทียนในน้ำไม่ได้'); return; }
    if (this.candles.length >= this.maxCandles) { const old = this.candles.shift(); this.removeWorld(old.obj); }
    p.hp -= 6;
    const f = p.forwardVec, x = p.pos.x + f.x * 1.2, z = p.pos.z + f.z * 1.2;
    const y = Math.max(g.terrain.getHeight(x, z), g.collision.groundAt(x, z, p.pos.y + 1, 0.65));
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(this.candleGeo, this.M.plain));
    const flame = new THREE.Sprite(this.M.fireSprite);
    flame.position.y = 0.55;
    flame.scale.setScalar(1.1);
    grp.add(flame);
    // a faint ring of light marking how far the Pale Ones keep away
    const R = this.candleR;
    const ring = new THREE.Mesh(new THREE.RingGeometry(R - 0.15, R, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.55, 0.2), transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    grp.add(ring);
    grp.position.set(x, y, z);
    this.addWorld(grp);
    const life = this.perk('longwick') ? 150 : 90;
    this.candles.push({ obj: grp, flame, ring, x, z, y, t: life, life });
    g.audio.burst({ dur: 0.4, freq: 900, q: 1, gain: 0.12, sweep: 1.5 });
    g.audio.tone({ freq: 660, dur: 1.2, type: 'triangle', gain: 0.04, verb: 0.6 });
  }

  update(dt, input) {
    const g = this.g, p = g.player, c = this.combat;
    // cup the flame (hold right mouse): the dark swallows you
    const want = input.blockHeld && !c.swing;
    if (want !== this.snuffed) {
      this.snuffed = want;
      if (!want) { this.unsnuffAt = g.time; this.ambushUsed = false; }
      g.audio.burst({ dur: want ? 0.3 : 0.5, freq: want ? 400 : 700, q: 0.8, gain: 0.15, sweep: want ? 0.4 : 1.8 });
      if (!want) g.audio.tone({ freq: 220, dur: 0.4, type: 'triangle', gain: 0.03, slide: 1.8 });
    }
    this.hidden = this.snuffed;
    this.noAttack = this.snuffed;
    this.darkness = this.snuffed ? 0.62 : 0;
    this.speedMul = this.snuffed && this.perk('stalk') ? 1.25 : 1;
    this.lightMul = this.snuffed ? 0 : 1.15 + this.heat * 0.9;
    this.flame.visible = !this.snuffed;
    this.flame.scale.setScalar((1 + this.heat * 0.8) * (1 + Math.sin(g.time * 17) * 0.12));

    // wax: melts while lit, re-forms by a fire or one of your candles
    this.heat = Math.max(0, this.heat - dt * 0.12);
    let regen = 0;
    if (this.nearFire()) regen = 6;
    for (const cd of this.candles) if (Math.hypot(cd.x - p.pos.x, cd.z - p.pos.z) < 3.5) regen = Math.max(regen, this.perk('ward') ? 4 : 2.5);
    if (this.snuffed && this.perk('stalk')) regen = Math.max(regen, 0.6);
    if (p.hp > 0) {
      if (regen) p.hp = Math.min(p.maxHp, p.hp + regen * dt);
      else if (!this.snuffed && dt > 0) p.hp = Math.max(0, p.hp - 0.3 * (this.perk('tallow') ? 0.5 : 1) * (1 + this.heat * 3) * dt);
    }
    // rings of fire left by the spin
    if (this.fires?.length) {
      for (const f of this.fires) {
        f.t -= dt; f.tick -= dt;
        f.obj.children.forEach((s, i) => s.scale.setScalar(1.3 * Math.min(1, f.t) * (1 + Math.sin(g.time * 12 + i) * 0.15)));
        if (f.tick > 0) continue;
        f.tick = 0.5;
        for (const e of c.enemies) {
          if (!e.alive || e.state === 'dying' || Math.hypot(e.pos.x - f.x, e.pos.z - f.z) > 4.4 + e.def.radius) continue;
          e.dots = e.dots || {}; e.dots.burn = { dps: this.perk('blaze') ? 0.65 : 0.45, t: 1.5 };
        }
      }
      for (const f of this.fires) if (f.t <= 0) this.removeWorld(f.obj);
      this.fires = this.fires.filter((f) => f.t > 0);
    }
    if (p.hp < 30 && !this.warned) { this.warned = true; g.ui.toast('เทียนใกล้หมด... หากองไฟแล้วยืนใกล้ ๆ เพื่อหล่อเทียนคืน'); }
    if (p.hp > 50) this.warned = false;

    // candles burn down; the Pale Ones and the wisps will not step into their light
    for (const cd of this.candles) {
      cd.t -= dt;
      const k = clamp(cd.t / (cd.life || 90), 0.25, 1);
      cd.obj.children[0].scale.set(1, k, 1);
      cd.flame.position.y = 0.13 + 0.42 * k;
      cd.flame.scale.setScalar(1.1 * (1 + Math.sin(g.time * 11 + cd.x) * 0.1));
      cd.ring.material.opacity = 0.18 + Math.sin(g.time * 2 + cd.z) * 0.06;
      for (const e of c.enemies) {
        if (!e.alive || e.state === 'dying' || !PALE.has(e.type)) continue;
        if (Math.hypot(e.pos.x - cd.x, e.pos.z - cd.z) < this.candleR && (e.state === 'windup' || e.state === 'strike')) { e.state = 'stagger'; e.t = 0.6; }
        this.constrain(e);
      }
    }
    if (this.candles.some((cd) => cd.t <= 0)) {
      for (const cd of this.candles) if (cd.t <= 0) this.removeWorld(cd.obj);
      this.candles = this.candles.filter((cd) => cd.t > 0);
    }
  }

  // called by combat after every enemy move: the Pale Ones and wisps stay out of candle light
  constrain(e) {
    if (!PALE.has(e.type)) return;
    for (const cd of this.candles) {
      const dx = e.pos.x - cd.x, dz = e.pos.z - cd.z, d = Math.hypot(dx, dz);
      const R = this.candleR;
      if (d >= R || d < 1e-3) continue;
      e.pos.x = cd.x + dx / d * R;
      e.pos.z = cd.z + dz / d * R;
    }
  }

  animateWeapon(w, dt) {
    // the censer swings on its chain while you walk
    if (!this.combat.swing) w.rotation.z += Math.sin(this.g.time * 2.2) * 0.08 + this.g.player.moving * Math.sin(this.g.player.bobT * 2) * 0.12;
    if (this.combat.swing?.kind === 'heavy') w.rotation.y += this.combat.swing.t * Math.PI * 4;
  }

  chips() {
    const lit = this.snuffed ? 'ป้องไฟอยู่ — มองไม่เห็นเจ้า' : `ไฟ ${'▮'.repeat(Math.round(this.heat * 5))}${'▯'.repeat(5 - Math.round(this.heat * 5))}`;
    return [lit, `เทียนที่ปัก ${this.candles.length}/${this.maxCandles}`, ...(this.nearFire() ? ['กำลังหล่อเทียน ▲'] : [])];
  }

  drawIcon(ctx, flash) {
    const px = pix(ctx);
    for (let x = 2; x < 26; x += 3) { px(x, 6, 2, 2, '#8a8478'); px(x + 2, 7, 1, 1, '#5a564e'); }
    px(26, 3, 12, 9, '#7a6448'); px(26, 3, 12, 1, '#a88c64'); px(26, 11, 12, 1, '#4a3a28');
    for (let x = 28; x < 37; x += 3) px(x, 4, 1, 7, '#3a2a1c');
    px(30, 5, 4, 5, flash ? '#ffffff' : this.snuffed ? '#3a2a1c' : '#ffb040'); px(31, 6, 2, 3, this.snuffed ? '#2a1a10' : '#fff0a0');
    if (!this.snuffed) { px(31, 1, 2, 2, '#ff8a30'); px(32, 0, 1, 1, '#ffd070'); }
  }

  dispose() { this.snuffed = false; this.candles = []; this.fires = []; super.dispose(); }
}

const KITS = { wanderer: Wanderer, bell: Bellwright, leech: LeechDoctor, coffin: CoffinBearer, wick: WickBearer };

export function createKit(id, game) {
  const K = KITS[id] || Wanderer;
  return new K(game, game.M);
}

// one-time things a class gets when you first take up its path
export const STARTING_GEAR = { leech: [['leech_live', 5]] };

