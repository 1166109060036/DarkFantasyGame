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
import { L } from './i18n.js';

const C = (r, g, b) => new THREE.Color(r, g, b);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const PALE = new Set(['gaunt', 'crawler', 'weeper', 'brute', 'wisp']);
const V = new THREE.Vector3();

export const CLASSES = {
  wanderer: {
    name: L('ผู้พเนจร', 'Wanderer'), weapon: L('ดาบ', 'Sword'), icon: '⚔',
    blurb: L('นักดาบผู้เดินทางมาจากแดนไกล สมดุลทุกด้าน ไม่มีจุดอ่อน ไม่มีของแปลก', 'A swordsman come from far lands; balanced in all things, with no weakness and no strange gifts.'),
    lines: [L('ฟันเบา / กดค้างฟันหนัก · ป้องกันและปัดได้', 'Light attack / hold for heavy · can block and parry'), L('G: ตั้งหลัก — แรงกลับมาเต็มทันที (พัก 30 วินาที)', 'G: Steady — stamina refills at once (30 s cooldown)'), L('เลือดฟื้นเองตามปกติ', 'Health regenerates as normal')],
  },
  bell: {
    name: L('ผู้ตีระฆัง', 'Bellwright'), weapon: L('ค้อนระฆัง', 'Bell Hammer'), icon: '🔔',
    blurb: L('ผู้ดูแลระฆังของวิหารที่จมน้ำ ได้ยินจังหวะในทุกสิ่ง แม้แต่ในเสียงหัวใจของศัตรู', 'Keeper of the bells of the Drowned Temple, who hears rhythm in all things, even in the hearts of foes.'),
    lines: [L('ฟัน "ตรงจังหวะกลอง" ของเพลง = แรงขึ้นสูงสุด ×2.4 และสะสมพลังกังวาน', 'Strike "on the drumbeat" of the music = up to ×2.4 damage, and builds resonance'), L('G (กังวานเต็ม): ตีระฆังใหญ่ ศัตรูรอบตัวมึนงงและกระเด็น', 'G (full resonance): toll the great bell — foes around you are stunned and thrown back'), L('G (ยังไม่เต็ม): เคาะเบา ๆ — เสียงสะท้อนเผยตำแหน่งศัตรูทะลุความมืด', 'G (not full): a soft tap — the echo reveals foes through the dark')],
  },
  leech: {
    name: L('หมอปลิง', 'Leech-Doctor'), weapon: L('มีดกรีด', 'Lancet'), icon: '🩸',
    blurb: L('หมอเถื่อนจากบึงที่รักษาทุกโรคด้วยการเอาเลือดออก และไม่เคยให้ใครเอาเลือดตัวเองไปฟรี ๆ', 'A marsh quack who cures every ill by letting blood, and never lets their own go for free.'),
    lines: [L('เลือดไม่ฟื้นเอง · ยิ่งเลือดน้อย ยิ่งตีแรง (สูงสุด ×2.4)', 'Blood does not return on its own · the less blood, the harder you hit (up to ×2.4)'), L('ฟันเบา: กรีดให้เลือดไหล · กดค้างแล้วปล่อย: ปาปลิง (ใช้เลือด 4)', 'Light attack: cut to bleed · hold and release: throw a leech (costs 4 blood)'), L('ปลิงดูดเลือดศัตรูแล้วคลานกลับมาเติมเลือดให้ · G: เรียกปลิงกลับทันที', 'Leeches drink from foes and crawl back to feed you · G: call the leeches home')],
  },
  coffin: {
    name: L('สัปเหร่อแบกโลง', 'Coffin-Bearer'), weapon: L('โลงศพ', 'Coffin'), icon: '⚰️',
    blurb: L('สัปเหร่อที่ไม่มีใครจ้าง เดินเก็บศพที่ไม่มีใครฝัง และยืมพลังจากพวกมันระหว่างทาง', 'A gravedigger no one hired, gathering the dead no one buried, and borrowing their strength along the way.'),
    lines: [L('เหวี่ยงโลงช้าแต่หนัก · กดค้าง: ทุบพื้นวงกว้าง · ยกโลงเป็นกำแพงกันได้ทุกอย่าง (ปัดไม่ได้)', 'Slow, heavy coffin swings · hold: a wide ground slam · raise the coffin as a wall that blocks all (no parry)'), L('G ใกล้ศพ: เก็บศพเข้าโลง (4 ช่อง) ได้พลังของศพนั้นตราบที่ยังแบกอยู่', 'G near a corpse: take it into the coffin (4 slots) and wield its power while you carry it'), L('G ที่อื่น: ฝังศพ — กลายเป็นหลุมศพที่ใช้ฟื้นคืนชีพ และฟื้นเลือด', 'G elsewhere: bury a corpse — the grave becomes your respawn point and restores health')],
  },
  hunter: {
    name: L('นักล่าหน้าไม้', 'Crossbow Hunter'), weapon: L('หน้าไม้', 'Crossbow'), icon: '🏹',
    blurb: L('นายพรานจากป่ามืดตะวันตก ล่าสัตว์ที่ไม่ควรมีชีวิตมาตั้งแต่ก่อนดวงจันทร์จะป่วย ยิงจากที่ไกล ไม่เคยให้อะไรเข้ามาถึงตัว', 'A hunter of the Western Darkwood who has stalked things that should not live since before the moon fell sick; shoots from afar and lets nothing close.'),
    lines: [L('คลิก: ยิงหน้าไม้ (ใช้ลูกดอก 1 ดอก) แล้วบรรจุใหม่ 1.2 วินาที · ระหว่างบรรจุหรือลูกดอกหมด คลิก = แทงมีด', 'Click: fire the crossbow (1 bolt), then reload for 1.2 s · while reloading or out of bolts, click = knife stab'), L('กดค้าง: เล็งซูม แล้วปล่อยยิงแรง ×2 ทะลุหลายตัว · ยิงโดนหัวแรงขึ้นอีก', 'Hold: aim and zoom, release for a ×2 shot that pierces many · headshots hit harder still'), L('G: วางกับดักเหล็กหนีบ ศัตรูเหยียบแล้วติดอยู่กับที่ · ลูกดอกมีจำกัด ซื้อ/ตีที่ช่าง และเก็บคืนจากพื้นและศพ', 'G: set an iron jaw-trap that holds fast whatever steps in · bolts are few: buy or forge them at the smith, and gather them back from the ground and the dead')],
  },
  wick: {
    name: L('ผู้แบกไส้เทียน', 'Wick-Bearer'), weapon: L('กระถางไฟ', 'Censer'), icon: '🕯️',
    blurb: L('ญาติห่าง ๆ ของเจ้าของโรงเตี๊ยม หัวเป็นเทียนที่ไม่เคยดับ... แต่ละลายลงทุกลมหายใจ', 'A distant kin of the innkeeper, whose head is a candle that never goes out... yet melts with every breath.'),
    lines: [L('เลือดคือไขเทียนที่ละลายลงเรื่อย ๆ · ยืนใกล้กองไฟเพื่อหล่อเทียนคืน', 'Your health is wax, ever melting · stand by a fire to recast it'), L('เหวี่ยงกระถางไฟระยะไกล ศัตรูติดไฟ · ยิ่งตีติดกันไฟยิ่งแรงแต่ละลายเร็ว · กดค้าง: หมุนรอบตัว', 'Long censer swings set foes alight · chain hits to burn hotter, but melt faster · hold: spin'), L('G: ปักเทียน (ร่างซีดเข้าไม่ได้) · คลิกขวาค้าง: ป้องไฟ — หายไปในความมืด', 'G: plant a candle (the Pale Ones cannot pass) · hold right-click: shield the flame — vanish into the dark')],
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
    return `${kingly ? L(`${this.def.weapon}ราชาหิน`, `Stone King's ${this.def.weapon}`) : this.def.weapon}${lv ? ` +${lv}` : ''} ×${g.damageMul.toFixed(1)}`;
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
    this.lightHits = 0;
    this.dance = [];
    this.apply();
  }

  // the tree's standing effects
  apply() {
    this.sprintCost = this.perk('w_breath') ? 0.7 : 1;
    this.armorMul = this.perk('w_iron') ? 0.9 : 1;
    this.regenMul = this.perk('w_regen') ? 1.6 : 1;
    this.blockLeak = this.perk('w_guard') ? 0.5 : 1;
    this.blockRegen = this.perk('w_stance') ? 32 : 12;
    this.dodgeCostMul = this.perk('w_light') ? 0.6 : 1;
    this.allRound = this.perk('w_bulwark');
    this.g.player.regenMul = this.regenMul;
  }
  refresh() { this.apply(); }

  // hot blood: low on life, or fresh from a kill
  rage() {
    const p = this.g.player;
    return (this.perk('w_frenzy') && p.hp < p.maxHp * 0.35 ? 1.3 : 1) * (this.perk('w_momentum') && this.g.time < (this.momentumUntil || 0) ? 1.2 : 1);
  }

  swing(kind) {
    const s = super.swing(kind);
    if (kind === 'heavy') {
      if (this.perk('cleave')) { s.dmg *= 1.35; s.range += 0.5; }
      if (this.perk('w_whirl')) { s.radial = true; s.range = 3.8 + (this.perk('cleave') ? 0.5 : 0); s.dmg *= 1.1; }
    } else {
      if (this.perk('w_grip')) s.dmg *= 1.08;
      if (this.perk('keen')) s.dmg *= 1.2;
      if (this.perk('flurry')) { s.dur *= 0.85; s.cost *= 0.8; }
    }
    s.dmg *= this.rage();
    this.lastDmg = s.dmg;
    return s;
  }
  get hpBonus() { return (this.perk('tough') ? 20 : 0) + (this.perk('w_hide') ? 10 : 0); }
  get parryBonus() { return this.perk('deflect') ? 0.12 : 0; }
  // the finishing blow
  targetMul(e) { return this.perk('w_execute') && this.combat.swing?.kind === 'heavy' && e.hp < e.def.hp * 0.3 ? 2 : 1; }

  // the crescent: a heavy blow throws a wave of moonlight along the ground
  onStrike(kind) {
    if (kind !== 'heavy' || !this.perk('crescent')) return;
    const g = this.g, p = g.player, f = p.forwardVec;
    areaStrike(g, { range: 8, arc: 0.86, dmg: 2 * this.rage(), heavy: true });
    for (let i = 1; i <= 6; i++) g.particles.burst(new THREE.Vector3(p.pos.x + f.x * i * 1.3, p.pos.y + 0.9, p.pos.z + f.z * i * 1.3), 4, 2.5, 0.5);
    g.audio.burst({ dur: 0.5, freq: 2400, q: 1.5, gain: 0.16, sweep: 0.4 });
  }

  onHit(e, kind) {
    const g = this.g, c = this.combat;
    if (kind === 'heavy') {
      if (this.perk('w_sunder')) c.debuff(e, 'expose', 5, 1.2);
      if (this.perk('w_heavyhand') && e.alive && !e.def.boss && !e.moba) { e.state = 'stagger'; e.t = Math.max(e.t, 1); }
      return;
    }
    if (this.perk('w_edge')) c.stamina = Math.min(c.maxStamina, c.stamina + 3);
    const again = (mul, text) => {
      if (!e.alive || e.state === 'dying') return;
      V.set(e.pos.x - g.player.pos.x, 0, e.pos.z - g.player.pos.z).normalize();
      c.damageEnemy(e, false, V, this.lastDmg * mul);
      g.ui.combatText(text, 'parry');
    };
    // the dance: the third light blow landed within two seconds cuts deeper
    if (this.perk('w_dance')) {
      this.dance = this.dance.filter((t) => g.time - t < 2);
      this.dance.push(g.time);
      if (this.dance.length >= 3) { this.dance = []; again(0.6, L('ระบำดาบ!', 'Blade dance!')); }
    }
    // the shadow blade: every fourth light blow is struck twice
    if (this.perk('w_twin') && ++this.lightHits % 4 === 0) again(1, L('ดาบเงา!', 'Shadow blade!'));
  }

  onKill(e) {
    if (this.combat.swing?.kind === 'heavy') this.feat(1);
    const p = this.g.player;
    if (this.perk('w_thirst')) p.hp = Math.min(p.maxHp, p.hp + 5);
    if (this.perk('w_momentum')) this.momentumUntil = this.g.time + 6;
  }

  // riposte: a parried blow is answered at once
  onParry(e, by) {
    this.feat(1);
    const g = this.g, c = this.combat, p = g.player;
    if (this.perk('deflect')) c.stamina = Math.min(c.maxStamina, c.stamina + 10);
    if (this.perk('w_rally')) p.hp = Math.min(p.maxHp, p.hp + 6);
    if (e) {
      if (this.perk('w_perfect') && e.state === 'stagger') e.t += 1;
      if (this.perk('w_disarm')) c.debuff(e, 'expose', 3, 1.5);
    }
    if (!this.perk('riposte')) return;
    if (e && e.alive && e.state !== 'dying') { V.set(e.pos.x - p.pos.x, 0, e.pos.z - p.pos.z).normalize(); c.damageEnemy(e, true, V, 3 * this.rage()); }
    else if (by != null) g.moba?.riposte(by, 3);
    g.audio.swing(true);
    g.ui.combatText(L('สวนกลับ!', 'Riposte!'), 'parry');
  }

  // the last stand: once every two minutes, a killing blow leaves you standing
  onHurt(dmg) {
    const p = this.g.player;
    if (this.perk('w_last') && p.hp - dmg <= 0 && p.hp > 1 && this.g.time >= (this.lastStandAt || 0)) {
      this.lastStandAt = this.g.time + 120;
      this.g.ui.combatText(L('ไม่ยอมตาย!', 'Not yet!'), 'parry');
      return p.hp - 1;
    }
    return dmg;
  }

  skill() {
    if (this.cool > 0) { this.combat.say(L(`ยังตั้งหลักไม่ได้ (${Math.ceil(this.cool)})`, `Cannot steady yet (${Math.ceil(this.cool)})`)); return; }
    const sw = this.perk('secondwind');
    this.cool = 30 - (this.perk('w_focus') ? 6 : 0) - (sw ? 6 : 0);
    this.combat.stamina = this.combat.maxStamina;
    this.combat.exhausted = false;
    if (sw) { const p = this.g.player; p.hp = Math.min(p.maxHp, p.hp + 25); }
    this.g.audio.charge();
    this.g.ui.combatText(sw ? L('ตั้งหลัก! +25 เลือด', 'Steady! +25 health') : L('ตั้งหลัก!', 'Steady!'), 'parry');
  }
  update(dt) { this.cool = Math.max(0, this.cool - dt); }
  chips() { return [this.cool > 0 ? L(`ตั้งหลัก ${Math.ceil(this.cool)}s`, `Steady ${Math.ceil(this.cool)}s`) : L('ตั้งหลัก [G] ✓', 'Steady [G] ✓'), ...(this.rage() > 1 ? [L(`เลือดร้อน ×${this.rage().toFixed(2)}`, `Hot blood ×${this.rage().toFixed(2)}`)] : [])]; }
  drawIcon() {}   // the HUD keeps drawing the sword for the wanderer
  dispose() { this.weapon.visible = false; this.weapon = null; this.g.player.regenMul = 1; super.dispose(); }
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
    this.armorMul = this.perk('r_bronze') ? 0.88 : 1;
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
    const k = (this.perk('ear') ? 1.4 : 1) * (this.perk('r_metronome') ? 1.2 : 1);
    return off <= Math.min(0.13 * k, b.period * 0.22 * k);
  }

  get need() { return this.perk('tolling') ? 70 : this.perk('r_bigring') ? 80 : 100; }
  get cap() { return this.perk('scale') ? 9 : 6; }
  get hpBonus() { return this.perk('r_toughen') ? 10 : 0; }
  refresh() { this.armorMul = this.perk('r_bronze') ? 0.88 : 1; }
  targetMul(e) {
    if (!this.perk('echo') || !this.marks.some((m) => m.e === e && m.t > 0)) return 1;
    return this.perk('r_expose') ? 1.5 : 1.25;
  }

  // a light blow is judged when the button goes down (a click's release comes ~0.1 s later);
  // a heavy blow is judged when it is let go
  onPress() { this.pressOnBeat = this.onBeat(); this.pressAt = this.g.time; }

  swing(kind) {
    const heavy = kind === 'heavy';
    const on = !heavy && this.g.time - this.pressAt < 0.5 ? this.pressOnBeat : this.onBeat();
    const before = this.streak;
    if (on) { if (!this.streak) this.graced = false; this.streak = Math.min(this.cap, this.streak + 1); }
    else if (this.perk('r_grace') && this.streak && !this.graced) { this.graced = true; this.g.ui.combatText(L('จังหวะผ่อน', 'Grace beat'), 'info'); }
    else if (this.perk('sustain')) this.streak = Math.max(0, this.streak - 2);
    else { this.streak = 0; this.resonance = Math.max(0, this.resonance - 8); }
    this.hitOnBeat = on;
    this.reachedTop = on && before < this.cap && this.streak === this.cap;
    const mul = on ? (this.perk('r_pulse') ? 1.45 : 1.3) + 0.18 * Math.min(this.streak, this.cap) : 0.75;
    if (!this.graced || on) this.g.ui.combatText(on ? L(`♪ ตรงจังหวะ ×${mul.toFixed(1)}`, `♪ On the beat ×${mul.toFixed(1)}`) : L('หลุดจังหวะ', 'Off the beat'), on ? 'parry' : 'info');
    const s = heavy
      ? { dur: 0.6, cost: 24 * (this.perk('r_arm') ? 0.8 : 1), hitAt: 0.42, range: 3.3, arc: 0.3, dmg: 2.6 * mul * (this.perk('weight') ? 1.3 : 1), heavy: true }
      : { dur: 0.38 * (this.perk('r_tempo') ? 0.85 : 1), cost: 10, hitAt: 0.35, range: 2.9 + (this.perk('r_crescendo') && this.streak >= 6 ? 0.6 : 0), arc: 0.45, dmg: 1 * mul, heavy: false };
    // the shattering note: deep in a streak, a light blow lands like a heavy one
    if (!heavy && on && this.perk('r_shatter') && this.streak >= 4) s.heavy = true;
    this.lastDmg = s.dmg;
    return s;
  }

  onHit(e, kind) {
    const a = this.g.audio;
    // every blow rings; on the beat, the notes climb the scale with the streak
    const m = this.hitOnBeat ? BELL_NOTES[Math.min(this.streak, BELL_NOTES.length) - 1] : 57;
    a.metal({ freq: mtof(m), dur: 1.6, gain: 0.07, partials: [1, 2.0, 2.76, 4.1, 5.4], pos: e.pos, verb: 0.6 });
    const g = this.g, c = this.combat, p = g.player, plain = e.alive && !e.def.boss && !e.moba;
    if (kind === 'heavy' && this.perk('r_stagger') && plain) { e.state = 'stagger'; e.t = Math.max(e.t, 1); }
    if (!this.hitOnBeat) {
      if (kind === 'heavy' && this.perk('r_anvil')) this.resonance = Math.min(100, this.resonance + 15);
      return;
    }
    this.resonance = Math.min(100, this.resonance + (kind === 'heavy' ? 30 : 18) * (this.perk('sustain') ? 1.5 : 1) * (this.perk('r_tune') ? 1.15 : 1));
    this.feat(1);
    if (this.perk('r_ring') && plain) { e.state = 'stagger'; e.t = Math.max(e.t, 0.4); }
    if (this.perk('r_drum')) p.hp = Math.min(p.maxHp, p.hp + 1);
    if (this.perk('r_virtuoso') && this.streak >= 8) c.stamina = Math.min(c.maxStamina, c.stamina + 4);
    // the duet: the note comes back off the walls and strikes again
    if (this.perk('r_duet') && this.streak >= 3 && e.alive && e.state !== 'dying') {
      V.set(e.pos.x - p.pos.x, 0, e.pos.z - p.pos.z).normalize();
      c.damageEnemy(e, false, V, this.lastDmg * 0.4);
    }
    // the finale: the top of the scale rings out as a small great bell, and the run begins again
    if (this.perk('r_finale') && this.reachedTop && this.finaleSwing !== c.swingN) {
      this.finaleSwing = c.swingN;
      this.reachedTop = false;
      this.greatBell(0.6);
      this.streak = 0;
      a.metal({ freq: 110, dur: 4, gain: 0.25, partials: [1, 2.02, 2.76, 4.1, 5.4], verb: 0.9 });
      g.ui.combatText(L('ฟินาเล่!', 'Finale!'), 'parry');
    }
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
    power *= this.perk('r_quake') ? 1.5 : 1;
    for (const e of c.enemies) {
      if (!e.alive || e.state === 'dying' || !e.obj.visible) continue;
      const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
      if (d > R) continue;
      V.set(e.pos.x - p.pos.x, 0, e.pos.z - p.pos.z).normalize();
      c.damageEnemy(e, true, V, 2 * power);
      if (e.alive && e.state !== 'dying') { e.state = 'stagger'; e.t = (e.def.boss ? 1.0 : this.perk('wave') ? 3.5 : 2.6) * Math.max(0.5, power); e.vel.addScaledVector(V, 10 * power / e.def.weight); }
      // the death knell: whatever is already broken does not get up again
      if (this.perk('r_doom') && e.alive && e.state !== 'dying' && !e.def.boss && !e.def.named && !e.moba && e.hp < e.def.hp * 0.35) { c.kill(e); g.ui.combatText(L('ระฆังมรณะ', 'Death knell'), 'parry'); }
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
      if (this.perk('r_resound')) this.resonance = 30;
      if (this.perk('r_shield')) c.iframes = Math.max(c.iframes, 2.5);
      g.audio.metal({ freq: 73.4, dur: 6, gain: 0.35, partials: [1, 2.02, 2.76, 4.1, 5.4, 6.8], verb: 0.9 });
      g.audio.thump({ freq: 55, dur: 2.5, gain: 0.5, drop: 0.8 });
      p.shake = Math.max(p.shake, 0.5);
      c.hitStop = 0.12;
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2;
        g.particles.burst(new THREE.Vector3(p.pos.x + Math.cos(a) * 3, p.pos.y + 1, p.pos.z + Math.sin(a) * 3), 2, 7, 0.8);
      }
      g.ui.combatText(L('ระฆังใหญ่!', 'Great bell!'), 'parry');
      return;
    }
    if (this.pingCool > 0) { c.say(L('ระฆังยังสั่นอยู่...', 'The bell still trembles...')); return; }
    const hunt = this.perk('r_hunt');
    if (c.stamina < (hunt ? 6 : 12)) { c.say(L('เหนื่อยเกินไป', 'Too weary')); return; }
    c.spend(hunt ? 6 : 12);
    this.pingCool = hunt ? 1.5 : 3;
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
    g.ui.combatText(n ? L(`เสียงสะท้อน: ${n} ตัว`, `Echo: ${n} foes`) : L('เงียบสนิท...', 'Utter silence...'), 'info');
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
    return [`${L('กังวาน', 'Resonance')} ${bar}${this.resonance >= this.need ? L(' [G] ระฆังใหญ่!', ' [G] Great bell!') : ''}`, ...(this.streak > 1 ? [L(`จังหวะต่อเนื่อง ×${this.streak}`, `Beat streak ×${this.streak}`)] : [])];
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
  get maxOut() { return (this.perk('swarm') ? 5 : LEECH_MAX_OUT) - (this.perk('l_queen') ? 1 : 0); }
  get hpBonus() { return this.perk('l_tough') ? 10 : 0; }
  get attached() { return this.leeches.filter((L) => L.state === 'drink').length; }
  // the mark of blood: whatever is bleeding is easier to cut
  targetMul(e) { return this.perk('l_mark') && e.dots?.bleed ? 1.15 : 1; }
  onHurt(dmg) { const p = this.g.player; return this.perk('l_clot') && p.hp < p.maxHp * 0.2 ? dmg * 0.8 : dmg; }

  swing(kind) {
    if (kind === 'heavy') { this.throwLeech(); return null; }
    const p = this.g.player;
    const dur = 0.26 * (this.perk('l_adrenaline') && p.hp < p.maxHp * 0.4 ? 0.75 : 1) * (this.perk('l_flurry') ? 0.8 : 1);
    const dmg = 0.75 * this.frenzy * (this.perk('scalpel') ? 1.25 : 1) * (this.perk('l_feast') ? 1 + 0.1 * this.attached : 1)
      * (this.perk('l_precise') ? 1 + 0.1 * Math.min(5, this.chain || 0) : 1);
    return { dur, cost: 7 * (this.perk('l_steady') ? 0.7 : 1), hitAt: 0.45, range: 2.5 + (this.perk('l_edge') ? 0.6 : 0), arc: 0.6, dmg, heavy: false };
  }

  onHit(e) {
    const c = this.combat, p = this.g.player;
    e.dots = e.dots || {};
    // the same body cut again and again: the bleeding worsens, the hand grows surer
    this.chain = this.chainOn === e ? (this.chain || 0) + 1 : 0;
    this.chainOn = e;
    e.bleedStack = this.perk('l_hemo') ? Math.min(3, (e.dots.bleed ? e.bleedStack || 1 : 1) + 0.25) : 1;
    const base = this.perk('deepcut') ? { dps: 0.5, t: 5 } : { dps: 0.3, t: 3 };
    e.dots.bleed = { dps: base.dps * e.bleedStack, t: base.t };
    if (this.perk('l_artery')) c.debuff(e, 'slow', base.t, 0.75);
    if (this.perk('l_sip')) p.hp = Math.min(p.maxHp, p.hp + 0.5);
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
      this.g.ui.combatText(L('ผ่า! +6 เลือด', 'Lanced! +6 blood'), 'parry');
      this.g.particles.burst(e.pos.clone().setY(e.pos.y + e.def.height * 0.6), 18, 4, 0.6);
    }
  }

  onKill(e) {
    if (!e.dots?.bleed) return;
    const g = this.g, p = g.player;
    if (this.perk('l_transfuse')) p.hp = Math.min(p.maxHp, p.hp + 8);
    // exsanguination: it bursts, and everything near it starts to bleed
    if (this.perk('l_exsang')) {
      for (const o of this.combat.enemies) {
        if (o === e || !o.alive || o.state === 'dying' || o.pos.distanceTo(e.pos) > 4) continue;
        o.dots = o.dots || {}; o.dots.bleed = { dps: 0.8, t: 5 };
      }
      p.hp = Math.min(p.maxHp, p.hp + 10);
      g.particles.burst(e.pos.clone().setY(e.pos.y + e.def.height * 0.6), 26, 5, 0.8);
      g.audio.burst({ dur: 0.5, freq: 300, q: 1, gain: 0.25 });
      g.ui.combatText(L('สูบเลือด! +10', 'Bloodletting! +10'), 'parry');
    }
  }

  throwLeech() {
    const g = this.g, p = g.player, c = this.combat;
    if (this.leeches.length >= this.maxOut) { c.say(L('ปลิงออกไปหมดแล้ว', 'All your leeches are out')); return; }
    if (g.bag.count('leech_live') <= 0) { c.say(L('ไม่มีปลิงในกระเป๋า', 'No leeches in your bag')); return; }
    if (p.hp <= 6) { c.say(L('เลือดไม่พอจะเลี้ยงปลิง', 'Too little blood to feed a leech')); return; }
    // the tide: three at once, fanned out (one blood price for the lot)
    const n = this.perk('l_tide') ? Math.min(3, g.bag.count('leech_live'), Math.max(1, this.maxOut - this.leeches.length)) : 1;
    p.hp -= Math.max(1, (this.perk('homing') ? 2 : 4) - (this.perk('l_jar') ? 1 : 0));
    c.spend(8);
    const speed = 21 * (this.perk('l_quick') ? 1.4 : 1);
    for (let i = 0; i < n; i++) {
      g.bag.remove('leech_live', 1);
      const m = this.addWorld(new THREE.Mesh(this.leechGeo, this.leechMat));
      const dir = p.forwardVec.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (i - (n - 1) / 2) * 0.22);
      const pos = g.camera.position.clone().addScaledVector(dir, 0.6).add(new THREE.Vector3(0, -0.15, 0));
      this.leeches.push({ m, state: 'fly', pos, vel: dir.multiplyScalar(speed).add(new THREE.Vector3(0, 2.5, 0)), t: 0, blood: 0, e: null, off: null, big: this.perk('l_queen') });
      if (this.perk('l_queen')) m.scale.setScalar(1.6);
    }
    g.audio.swing(false);
    g.audio.burst({ dur: 0.25, freq: 500, q: 3, gain: 0.1, sweep: 1.8 });
    g.hud.grin();
  }

  // G: every leech lets go (tearing a little more out on the way) and comes home
  skill() {
    if (!this.leeches.length) { this.combat.say(L('ไม่มีปลิงอยู่ข้างนอก', 'No leeches are out')); return; }
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
        let e = L.e;
        if (!e.alive || e.state === 'dying' || !e.obj.visible) {
          // the plague: a leech whose host has died jumps to the next one near
          const next = this.perk('l_plague') && L.t < 14 && c.enemies.find((o) => o !== e && o.alive && o.state !== 'dying' && o.obj.visible && o.pos.distanceTo(e.pos) < 8);
          if (!next) { L.state = 'home'; continue; }
          L.e = e = next;
        }
        if (L.t > (this.perk('l_cling') ? 14 : 8)) { L.state = 'home'; continue; }
        L.pos.copy(e.pos).add(L.off);
        if (this.perk('l_venom')) c.debuff(e, 'slow', 0.3, 0.6);
        if (this.perk('l_numb')) c.debuff(e, 'sap', 0.3, 0.7);
        const d = Math.min(e.hp, LEECH_DRAIN * (this.perk('fat') ? 1.5 : 1) * (L.big ? 2 : 1) * dt);
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
      g.ui.combatText(L(`+${Math.round(heal)} เลือด`, `+${Math.round(heal)} blood`), 'parry');
      g.audio.drink();
      if (this.perk('l_rich')) this.combat.stamina = Math.min(this.combat.maxStamina, this.combat.stamina + 10);
    }
    const back = 1 + (this.perk('l_breed') && heal > 0.5 && Math.random() < 0.35 ? 1 : 0);
    if (back > 1) g.ui.combatText(L('ปลิงแพร่พันธุ์! +1', 'The leech breeds! +1'), 'parry');
    if (g.bag.add('leech_live', back) > 0) g.ui.toast(L('กระเป๋าเต็ม — ปลิงตัวนั้นคลานหนีไปแล้ว', 'Bag full — that leech has crawled away'));
  }

  chips() {
    const out = this.leeches.length, have = this.g.bag.count('leech_live');
    return [L(`ปลิง ${have} ในกระเป๋า · ${out}/${this.maxOut} ออกล่า`, `Leeches ${have} in bag · ${out}/${this.maxOut} hunting`), L(`เลือดคลั่ง ×${this.frenzy.toFixed(1)}`, `Blood frenzy ×${this.frenzy.toFixed(1)}`)];
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
  gaunt: { name: L('ร่างซูบ', 'Gaunt'), power: L('วิ่งไม่เปลืองแรง เร็วขึ้น', 'run faster, without tiring') },
  crawler: { name: L('ร่างคลาน', 'Crawler'), power: L('ปีนทางชันได้', 'climb steep slopes') },
  weeper: { name: L('หญิงร่ำไห้', 'Weeping Woman'), power: L('ศัตรูที่จ้องอยู่ขยับไม่ได้', 'foes you watch cannot move') },
  brute: { name: L('ร่างยักษ์', 'Brute'), power: L('ทุบพื้นกว้างและแรงขึ้น', 'wider, harder ground slams') },
  wolf: { name: L('หมาป่าเงา', 'Shadow Wolf'), power: L('เหวี่ยงโลงเร็วขึ้น', 'faster coffin swings') },
  straw: { name: L('หุ่นฟาง', 'Strawman'), power: L('รับดาเมจลดลง 15%', 'take 15% less damage') },
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
    this.blocks = 0;
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
  get maxSlots() { return this.perk('b_ossuary') ? 8 : this.perk('roomy') ? 6 : COFFIN_SLOTS; }
  get hpBonus() { return (this.perk('c_back') ? 10 : 0) + (this.perk('a_root') ? 10 : 0); }

  // carried corpses (and the skill tree) change the rules
  apply() {
    const p = this.g.player, n = this.slots.length;
    this.speedMul = ((this.has('gaunt') ? 1.0 : 0.88) - (this.perk('c_stride') ? 0 : n * 0.025))
      * (this.perk('c_stride') ? 1.05 : 1) * (this.ritesT > 0 ? 1.2 : 1);
    this.sprintCost = this.has('gaunt') ? 0 : 1;
    this.climb = this.has('crawler') ? 4 : 1.25;
    this.armorMul = (this.has('straw') ? 0.85 : 1) * (this.perk('plated') ? 0.88 : 1) * (this.perk('a_root') ? 0.95 : 1)
      * (this.perk('b_stack') ? 1 - 0.04 * n : 1);
    // the raised coffin: what it costs to take a blow, how it moves, whether it gives
    this.wallCostMul = (this.perk('c_thick') ? 0.8 : 1) * (this.perk('a_iron') ? 0.7 : 1);
    this.wallPush = this.perk('a_unmoved') ? 0 : 1;
    this.blockSpeed = this.perk('a_fortress') ? 0.8 : 0.45;
    p.climb = this.climb;
  }
  refresh() { this.apply(); }

  // unmoved: once every ten seconds, an empty arm still holds the coffin up
  holdFirm() {
    if (!this.perk('a_unmoved') || this.g.time < (this.firmAt || 0)) return false;
    this.firmAt = this.g.time + 10;
    this.g.ui.combatText(L('ไม่สะเทือน!', 'Unshaken!'), 'parry');
    return true;
  }

  onWallBlock(e, dmg, by) {
    this.feat(1);
    const g = this.g, p = g.player;
    if (this.perk('a_bastion')) p.hp = Math.min(p.maxHp, p.hp + 3);
    if (this.perk('a_vengeance') && ++this.blocks >= 3 && !this.venge) { this.venge = true; g.ui.combatText(L('แค้นโลง: ครั้งต่อไป ×2', 'Coffin\'s grudge: next blow ×2'), 'parry'); }
    if (!this.perk('reflect')) return;
    const back = this.perk('a_bash') ? 2.4 : 1.2;
    if (e && e.alive && e.state !== 'dying') {
      V.set(e.pos.x - p.pos.x, 0, e.pos.z - p.pos.z).normalize();
      this.combat.damageEnemy(e, false, V, back);
      if (this.perk('a_bash') && e.alive && !e.def.boss) { e.state = 'stagger'; e.t = Math.max(e.t, 0.8); }
    } else if (by != null) g.moba?.riposte(by, back);
  }

  // what the coffin is worth this swing: the dead it carries, and the tree
  power() {
    const n = this.slots.length;
    return (this.perk('strength') ? 1 + 0.06 * n : 1) * (this.perk('b_onesoul') && n <= 2 ? 1.25 : 1) * (this.venge ? 2 : 1);
  }

  swing(kind) {
    const quick = this.has('wolf') ? 0.75 : 1, dead = this.power();
    if (kind === 'heavy') {
      const big = this.has('brute'), quake = this.perk('quake'), sink = this.perk('a_sinkhole');
      const dur = 1.0 * quick * (sink ? 0.8 : 1), cost = 32 * (sink ? 0.7 : 1);
      const dmg = (big ? 6 : 4) * (quake ? 1.25 : 1) * dead;
      // the iron spin: the coffin swept all the way round you instead of brought down in front
      if (this.perk('a_spin')) return { dur, cost, hitAt: 0.55, aoe: { dist: 0, r: 4.5 + (quake ? 0.6 : 0) }, dmg: dmg * 1.2, heavy: true, spin: true };
      return { dur, cost, hitAt: 0.55, aoe: { dist: 2.2, r: (big ? 5.5 : 3.6) + (quake ? 1.2 : 0) }, dmg, heavy: true };
    }
    return { dur: 0.62 * quick, cost: 16, hitAt: 0.5, range: 3.5, arc: 0.12, dmg: 1.6 * dead * (this.perk('c_spade') ? 1.15 : 1), heavy: true };
  }

  swingSound(kind) {
    this.g.audio.swing(true);
    if (kind === 'heavy') this.g.audio.burst({ dur: 0.6, freq: 260, q: 1, gain: 0.2, sweep: 2, attack: 0.3 });
  }

  onStrike(kind) {
    if (this.venge) { this.venge = false; this.blocks = 0; }
    if (kind !== 'heavy') return;
    const g = this.g, p = g.player, f = p.forwardVec;
    const at = new THREE.Vector3(p.pos.x + f.x * 2.2, p.pos.y + 0.2, p.pos.z + f.z * 2.2);
    g.particles.burst(at, 22, 6, 1.1);
    g.audio.slam(at);
    p.shake = Math.max(p.shake, 0.3);
  }

  onHit(e, kind) {
    this.g.audio.thump({ freq: 90, dur: 0.25, gain: 0.3, pos: e.pos });
    if (kind !== 'heavy' || !e.alive || e.def.boss) return;
    // the ground split under it, or the dead in the coffin looked at it
    if (this.perk('a_fissure')) { e.state = 'stagger'; e.t = Math.max(e.t, 1.3); }
    if (this.perk('b_fear') && Math.random() < 0.3) { e.state = 'stagger'; e.t = Math.max(e.t, 1.5); this.g.ui.combatText(L('ขวัญเสีย!', 'Terrified!'), 'parry'); }
  }

  onKill(e) {
    const p = this.g.player;
    if (this.perk('b_drain') && this.slots.length) p.hp = Math.min(p.maxHp, p.hp + 4);
    if (!CORPSES[e.type]) return;
    e.corpseHold = this.perk('b_root') ? 60 : 30;    // the body stays put until it is taken or the time runs out
    if (!this.hinted) { this.hinted = true; setTimeout(() => this.g.ui.toast(L('กด G ใกล้ศพเพื่อเก็บเข้าโลง', 'Press G near a corpse to take it into the coffin')), 900); }
  }

  nearestCorpse() {
    const p = this.g.player;
    let best = null, bd = this.perk('b_root') ? 6 : 3.6;
    for (const e of this.combat.enemies) {
      if (e.state !== 'dying' || !(e.corpseHold > 0)) continue;
      const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  skill() {
    const g = this.g;
    // the legion: with the coffin raised, every corpse in it bursts out at once
    if (this.perk('b_legion') && this.combat.blocking && this.slots.length) { this.legion(); return; }
    const e = this.nearestCorpse();
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
      g.ui.combatText(L(`เก็บ${CORPSES[e.type].name}: ${CORPSES[e.type].power}`, `${CORPSES[e.type].name} taken: ${CORPSES[e.type].power}`), 'parry');
      g.hud.grin();
      if (this.perk('b_harvest')) { g.player.hp = Math.min(g.player.maxHp, g.player.hp + 8); this.combat.stamina = Math.min(this.combat.maxStamina, this.combat.stamina + 20); }
      return;
    }
    if (!this.slots.length) { this.combat.say(L('ไม่มีศพในโลง และไม่มีศพให้เก็บ', 'The coffin is empty, and no corpse lies near')); return; }
    this.bury();
  }

  // the oldest corpse goes into the ground at your feet: a grave to wake up at
  bury() {
    const g = this.g, p = g.player;
    if (p.inWater > 0.15) { this.combat.say(L('ฝังศพในน้ำไม่ได้', 'You cannot bury in water')); return false; }
    const type = this.slots.shift();
    this.apply();
    const f = p.forwardVec;
    const x = p.pos.x + f.x * 1.4, z = p.pos.z + f.z * 1.4;
    this.addGrave(x, z, type);
    g.checkpoint = { x, z };
    const heal = this.perk('hallowed') ? 70 : 40;
    p.hp = Math.min(p.maxHp, p.hp + heal);
    this.feat(3);
    if (this.perk('b_rites')) { this.combat.stamina = this.combat.maxStamina; this.ritesT = 10; this.apply(); }
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
    g.ui.combatText(L(`ฝัง${CORPSES[type].name} · จุดฟื้นคืนชีพใหม่ · +${heal} เลือด`, `${CORPSES[type].name} buried · new respawn point · +${heal} health`), 'parry');
    g.save();
    return true;
  }

  legion() {
    const g = this.g, p = g.player, n = this.slots.length;
    areaStrike(g, { range: 6, dmg: 2.5 * n, heavy: true, stagger: 1.5 });
    p.hp = Math.min(p.maxHp, p.hp + 5 * n);
    this.slots = [];
    this.apply();
    g.particles.burst(p.pos.clone().setY(p.pos.y + 0.8), 20 + n * 8, 7, 1.4);
    g.audio.slam(p.pos);
    g.audio.burst({ dur: 1.2, freq: 400, q: 0.7, gain: 0.25, sweep: 0.5 });
    p.shake = Math.max(p.shake, 0.4);
    g.ui.combatText(L(`กองทัพในโลง! ×${n}`, `An army in the coffin! ×${n}`), 'parry');
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
    if (this.ritesT > 0 && (this.ritesT -= dt) <= 0) this.apply();
    // a walking graveyard: your own graves knit you back together
    if (this.perk('b_cemetery') && p.hp > 0 && p.hp < p.maxHp && this.graves.some((gv) => Math.hypot(gv.x - p.pos.x, gv.z - p.pos.z) < 6)) {
      p.hp = Math.min(p.maxHp, p.hp + 3 * dt);
    }
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
    return list.length ? list : [L(`โลงว่าง (0/${this.maxSlots}) · ฆ่าแล้วกด G ใกล้ศพ`, `Coffin empty (0/${this.maxSlots}) · kill, then press G near the corpse`)];
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
  get hpBonus() { return this.perk('k_wax') ? 10 : 0; }
  nearCandle() { const p = this.g.player; return this.candles.some((cd) => Math.hypot(cd.x - p.pos.x, cd.z - p.pos.z) < this.candleR); }
  // the knife in the back
  targetMul(e) {
    if (!this.perk('k_knife')) return 1;
    const p = this.g.player, dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1;
    return (Math.sin(e.ry) * dx + Math.cos(e.ry) * dz) / d < -0.3 ? 1.4 : 1;
  }
  onHurt(dmg) { return this.phoenix(this.g.player.hp - dmg) ? this.g.player.hp - 1 : dmg; }
  // the phoenix: the wax that would have run out rises again
  phoenix(left) {
    if (!this.perk('k_phoenix') || left > 0.5 || this.g.time < (this.phoenixAt || 0)) return false;
    this.phoenixAt = this.g.time + 180;
    const g = this.g;
    setTimeout(() => { g.player.hp = Math.max(g.player.hp, 40); }, 0);
    g.particles.burst(g.player.pos.clone().setY(g.player.pos.y + 1), 30, 5, 1.0);
    g.ui.combatText(L('ฟีนิกซ์! ไขกลับคืน', 'Phoenix! The wax returns'), 'parry');
    return true;
  }

  swing(kind) {
    const g = this.g, h = this.heat * (this.perk('stoke') ? 1.3 : 1);
    // ambush: the first blow out of the dark burns three times as hot
    const amb = this.perk('ambush') && g.time - (this.unsnuffAt ?? -9) < 2 && !this.ambushUsed;
    if (amb) {
      this.ambushUsed = true; this.ambushing = true; this.feat(1); g.ui.combatText(L('ลอบเผา! ×3', 'Ambush burn! ×3'), 'parry');
      // dread: everything near reels from the sudden fire
      if (this.perk('k_dread')) for (const e of this.combat.enemies) {
        if (!e.alive || e.state === 'dying' || e.def.boss || e.moba || e.pos.distanceTo(g.player.pos) > 5) continue;
        e.state = 'stagger'; e.t = Math.max(e.t, 1.2);
      }
    } else this.ambushing = false;
    // eclipse: for three seconds out of the dark, every blow doubles
    const ecl = this.perk('k_eclipse') && g.time - (this.unsnuffAt ?? -9) < 3;
    const m = (amb ? 3 : 1) * (ecl ? 2 : 1) * (this.perk('k_inferno') && this.heat >= 0.9 ? 1.25 : 1) * (this.perk('k_beacon') && this.nearCandle() ? 1.2 : 1);
    const cost = this.perk('k_overheat') && this.heat > 0.5 ? 0.4 : 1, reach = this.perk('k_chain') ? 0.5 : 0;
    if (kind === 'heavy') {
      const p = g.player;
      if (p.hp > 8) p.hp -= 3;        // a spin flares the flame and costs wax
      return { dur: 0.85, cost: 20 * cost, hitAt: 0.5, radial: true, range: 4.4 + h + reach + (this.perk('k_censer') ? 1.2 : 0), dmg: 2.2 * (1 + h * 0.8) * m, heavy: true };
    }
    return { dur: 0.5, cost: 12 * cost, hitAt: 0.45, range: 4.0 + h * 1.2 + reach + (this.perk('k_flare') ? 1.5 : 0), arc: 0.0, dmg: 1 * (1 + h * 0.8) * m, heavy: false };
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
    if (this.perk('k_ash')) this.combat.debuff(e, 'sap', e.dots.burn.t, 0.8);
    if (this.perk('k_drip')) { const p = this.g.player; p.hp = Math.min(p.maxHp, p.hp + 0.5); }
    if (this.heat >= 0.5) this.feat(1);
    this.heat = Math.min(1, this.heat + (this.perk('stoke') ? 0.18 : 0.12));
    this.g.audio.burst({ dur: 0.35, freq: 1200, q: 0.6, gain: 0.18, sweep: 0.5, pos: e.pos });
    this.g.particles.burst(e.pos.clone().setY(e.pos.y + e.def.height * 0.5), 8, 3, 0.6);
  }

  onKill(e) {
    if (!e.dots?.burn) return;
    const g = this.g;
    if (this.perk('k_vanish')) this.vanishT = 2;
    // the fire spreads to the next one
    if (this.perk('k_spread')) {
      const next = this.combat.enemies.find((o) => o !== e && o.alive && o.state !== 'dying' && o.pos.distanceTo(e.pos) < 5);
      if (next) { next.dots = next.dots || {}; next.dots.burn = { dps: this.perk('blaze') ? 0.65 : 0.4, t: 3 }; }
    }
    // a pyre where it fell: a fire to re-form your wax by
    if (this.perk('k_pyre')) {
      const s = this.addWorld(new THREE.Sprite(this.M.fireSprite));
      s.position.set(e.pos.x, e.pos.y + 0.6, e.pos.z);
      s.scale.setScalar(1.8);
      const f = { s, base: 1.8, ph: Math.random() * 6 };
      g.fx.fires.push(f);
      (this.pyres = this.pyres || []).push({ f, t: 20 });
    }
  }

  // the dying sun: all the heat let out at once
  sunburst() {
    const g = this.g, p = g.player;
    areaStrike(g, { range: 7, dmg: 4, heavy: true, stagger: 1 });
    for (const e of this.combat.enemies) {
      if (!e.alive || e.state === 'dying' || e.pos.distanceTo(p.pos) > 7) continue;
      e.dots = e.dots || {}; e.dots.burn = { dps: 1.0, t: 5 };
    }
    this.heat = 0;
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; g.particles.burst(new THREE.Vector3(p.pos.x + Math.cos(a) * 4, p.pos.y + 1, p.pos.z + Math.sin(a) * 4), 2, 8, 1); }
    g.audio.burst({ dur: 1.4, freq: 400, q: 0.6, gain: 0.35, sweep: 0.5, attack: 0.05 });
    p.shake = Math.max(p.shake, 0.4);
    g.ui.combatText(L('ดวงอาทิตย์ดับ!', 'The sun goes out!'), 'parry');
  }

  skill() {
    const g = this.g, p = g.player;
    if (this.snuffed) return;
    if (this.perk('k_sun') && this.heat >= 0.95) { this.sunburst(); return; }
    if (p.hp <= 12) { this.combat.say(L('ไขเทียนเหลือน้อยเกินไป', 'Too little wax left')); return; }
    if (p.inWater > 0.15) { this.combat.say(L('ปักเทียนในน้ำไม่ได้', 'You cannot plant a candle in water')); return; }
    if (this.candles.length >= this.maxCandles) { const old = this.candles.shift(); this.removeWorld(old.obj); }
    p.hp -= this.perk('k_twin') ? 3 : 6;
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
    const want = input.blockHeld && !c.swing && !g.mount?.ridden;
    if (want !== this.snuffed) {
      this.snuffed = want;
      if (!want) { this.unsnuffAt = g.time; this.ambushUsed = false; if (this.perk('k_eclipse')) this.heat = 1; }
      // silence: whatever was hunting you loses the trail
      if (want && this.perk('k_silent')) for (const e of c.enemies) if (e.state === 'chase' && !e.def.boss && !e.moba) e.state = 'return';
      g.audio.burst({ dur: want ? 0.3 : 0.5, freq: want ? 400 : 700, q: 0.8, gain: 0.15, sweep: want ? 0.4 : 1.8 });
      if (!want) g.audio.tone({ freq: 220, dur: 0.4, type: 'triangle', gain: 0.03, slide: 1.8 });
    }
    this.vanishT = Math.max(0, (this.vanishT || 0) - dt);
    this.hidden = this.snuffed || this.vanishT > 0;
    this.noAttack = this.snuffed;
    this.darkness = this.snuffed ? (this.perk('k_cateye') ? 0.22 : 0.62) : 0;
    this.speedMul = this.snuffed && this.perk('stalk') ? 1.25 : 1;
    this.lightMul = this.snuffed ? 0 : 1.15 + this.heat * 0.9;
    this.flame.visible = !this.snuffed;
    this.flame.scale.setScalar((1 + this.heat * 0.8) * (1 + Math.sin(g.time * 17) * 0.12));

    // wax: melts while lit, re-forms by a fire or one of your candles
    this.heat = Math.max(0, this.heat - dt * 0.12 * (this.perk('k_ember') ? 0.6 : 1));
    let regen = 0;
    if (this.nearFire()) regen = 6 * (this.perk('k_hearth') ? 1.5 : 1);
    for (const cd of this.candles) if (Math.hypot(cd.x - p.pos.x, cd.z - p.pos.z) < 3.5) regen = Math.max(regen, this.perk('ward') ? 4 : 2.5);
    if (this.snuffed && this.perk('stalk')) regen = Math.max(regen, 0.6);
    if (this.snuffed && this.perk('k_shade')) regen = Math.max(regen, 1.6);
    if (p.hp > 0) {
      if (regen) p.hp = Math.min(p.maxHp, p.hp + regen * dt);
      else if (!this.snuffed && dt > 0) {
        const melt = 0.3 * (this.perk('tallow') ? 0.5 : 1) * (1 + this.heat * 3) * dt;
        p.hp = this.phoenix(p.hp - melt) ? Math.max(p.hp, 40) : Math.max(0, p.hp - melt);
      }
    }
    // pyres burn down
    if (this.pyres?.length) {
      for (const py of this.pyres) py.t -= dt;
      for (const py of this.pyres.filter((q) => q.t <= 0)) { this.removeWorld(py.f.s); g.fx.fires.splice(g.fx.fires.indexOf(py.f), 1); }
      this.pyres = this.pyres.filter((q) => q.t > 0);
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
    if (p.hp < 30 && !this.warned) { this.warned = true; g.ui.toast(L('เทียนใกล้หมด... หากองไฟแล้วยืนใกล้ ๆ เพื่อหล่อเทียนคืน', 'Your candle gutters... find a fire and stand close to recast it')); }
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
      // the branding light: what it throws back, it sets alight
      if (this.perk('k_brand')) { e.dots = e.dots || {}; e.dots.burn = { dps: 0.4, t: 2 }; }
    }
  }

  animateWeapon(w, dt) {
    // the censer swings on its chain while you walk
    if (!this.combat.swing) w.rotation.z += Math.sin(this.g.time * 2.2) * 0.08 + this.g.player.moving * Math.sin(this.g.player.bobT * 2) * 0.12;
    if (this.combat.swing?.kind === 'heavy') w.rotation.y += this.combat.swing.t * Math.PI * 4;
  }

  chips() {
    const lit = this.snuffed ? L('ป้องไฟอยู่ — มองไม่เห็นเจ้า', 'Flame shielded — none can see you') : `${L('ไฟ', 'Flame')} ${'▮'.repeat(Math.round(this.heat * 5))}${'▯'.repeat(5 - Math.round(this.heat * 5))}`;
    return [lit, L(`เทียนที่ปัก ${this.candles.length}/${this.maxCandles}`, `Candles planted ${this.candles.length}/${this.maxCandles}`), ...(this.nearFire() ? [L('กำลังหล่อเทียน ▲', 'Recasting ▲')] : [])];
  }

  drawIcon(ctx, flash) {
    const px = pix(ctx);
    for (let x = 2; x < 26; x += 3) { px(x, 6, 2, 2, '#8a8478'); px(x + 2, 7, 1, 1, '#5a564e'); }
    px(26, 3, 12, 9, '#7a6448'); px(26, 3, 12, 1, '#a88c64'); px(26, 11, 12, 1, '#4a3a28');
    for (let x = 28; x < 37; x += 3) px(x, 4, 1, 7, '#3a2a1c');
    px(30, 5, 4, 5, flash ? '#ffffff' : this.snuffed ? '#3a2a1c' : '#ffb040'); px(31, 6, 2, 3, this.snuffed ? '#2a1a10' : '#fff0a0');
    if (!this.snuffed) { px(31, 1, 2, 2, '#ff8a30'); px(32, 0, 1, 1, '#ffd070'); }
  }

  dispose() {
    for (const py of this.pyres || []) { const i = this.g.fx.fires.indexOf(py.f); if (i >= 0) this.g.fx.fires.splice(i, 1); }
    this.pyres = [];
    this.snuffed = false; this.candles = []; this.fires = []; super.dispose();
  }
}

// ------------------------------------------------------------------------------------------------
// The Crossbow Hunter: one bolt at a time, loaded by hand. A tap looses it, a held aim zooms in and
// drives it through a line of them; while it reloads (or the quiver is empty) the hand goes to the
// skinning knife. Bolts are counted: bought, forged, picked out of the mud and out of the dead.
const RELOAD = 1.2;
const BOLT_G = 4;               // gravity on a bolt in flight
const HUNTER_POSE = {
  rest: [0.2, -0.27, -0.42, 0.04, 0, 0],
  guard: [0.06, -0.24, -0.44, 0.1, 0.1, 0.9],
  charge: [0.0, -0.16, -0.36, 0, 0, 0],
  up: [0.32, -0.16, -0.4, 0.5, -0.2, -0.3],
  end: [-0.06, -0.32, -0.62, -0.3, 0.2, 0.25],
  heavyEnd: [-0.06, -0.32, -0.62, -0.3, 0.2, 0.25],
};

function crossbowGeometry() {
  const wood = C(0.42, 0.28, 0.17), dark = C(0.2, 0.14, 0.1), iron = C(0.45, 0.45, 0.48);
  return {
    wood: mergeGeometries([
      part(new THREE.BoxGeometry(0.06, 0.07, 0.62), wood, { pos: [0, 0, -0.12] }),             // the stock
      part(new THREE.BoxGeometry(0.07, 0.12, 0.16), dark, { pos: [0, -0.05, 0.16] }),           // the butt
      part(new THREE.BoxGeometry(0.03, 0.09, 0.05), dark, { pos: [0, -0.07, 0.0] }),            // the grip
    ]),
    metal: mergeGeometries([
      part(new THREE.BoxGeometry(0.62, 0.025, 0.035), iron, { pos: [0, 0.03, -0.4], rot: [0, 0, 0] }),  // the prod
      part(new THREE.BoxGeometry(0.04, 0.05, 0.05), iron, { pos: [0, 0.02, -0.42] }),
      part(new THREE.BoxGeometry(0.03, 0.03, 0.06), iron, { pos: [0, 0.05, -0.06] }),           // the latch
    ]),
    string: part(new THREE.BoxGeometry(1, 0.005, 0.005), C(0.55, 0.52, 0.45)),     // unit length, stretched per frame
    bolt: mergeGeometries([
      part(new THREE.BoxGeometry(0.014, 0.014, 0.42), C(0.55, 0.42, 0.28), { pos: [0, 0, 0] }),
      part(new THREE.ConeGeometry(0.018, 0.06, 4), C(0.75, 0.77, 0.8), { pos: [0, 0, -0.24], rot: [-Math.PI / 2, 0, 0] }),
      part(new THREE.BoxGeometry(0.002, 0.03, 0.06), C(0.85, 0.82, 0.76), { pos: [0, 0.012, 0.18] }),
      part(new THREE.BoxGeometry(0.03, 0.002, 0.06), C(0.85, 0.82, 0.76), { pos: [0, 0.012, 0.18] }),
    ]),
  };
}

class Hunter extends Kit {
  constructor(g, M) {
    super(g);
    this.id = 'hunter';
    this.poses = HUNTER_POSE;
    this.bolts = [];            // in flight and stuck in the ground
    this.traps = [];
    this.loaded = 2;            // shots before the next reload (1, or 2 with the twin string)
    this.reloadT = 0;
    this.cool = 0;
    this.still = 0;
    this.kick = 0;
    this.baseFov = g.camera.fov;
    const geo = crossbowGeometry();
    this.geo = geo;
    const w = new THREE.Group();
    w.add(new THREE.Mesh(geo.wood, M.wood), new THREE.Mesh(geo.metal, M.metal));
    // the string, in two halves from the tips of the prod to wherever it is held
    this.strings = [new THREE.Mesh(geo.string, M.plain), new THREE.Mesh(geo.string, M.plain)];
    this.nocked = new THREE.Mesh(geo.bolt, M.plain);
    this.nocked.position.set(0, 0.05, -0.28);
    w.add(...this.strings, this.nocked);
    // the skinning knife in the other hand, for anything that gets close
    this.knife = new THREE.Mesh(mergeGeometries([
      part(new THREE.BoxGeometry(0.03, 0.03, 0.1), C(0.3, 0.2, 0.13), { pos: [0, 0, 0.05] }),
      part(new THREE.BoxGeometry(0.008, 0.035, 0.2), C(0.75, 0.77, 0.8), { pos: [0, 0.005, -0.1] }),
    ]), M.metal);
    this.knife.position.set(-0.36, -0.12, 0.1);
    this.knife.rotation.set(-0.5, 0.2, 0);
    w.add(this.knife);
    this.addWeapon(w);
    this.boltMat = M.plain;
    this.trapMat = M.metal;
    this.apply();
  }

  apply() {
    this.dodgeCostMul = this.perk('h_feet') ? 0.6 : 1;
    this.speedMul = this.perk('h_feet') ? 1.05 : 1;
    this.loaded = Math.min(this.loaded, this.magazine);
  }
  refresh() { this.apply(); }

  get magazine() { return this.perk('h_twin') ? 2 : 1; }
  get reloadTime() { return RELOAD * (this.perk('h_load') ? 0.85 : 1) * (this.perk('h_quick') ? 0.75 : 1); }
  get maxTraps() { return this.perk('h_snare') ? 3 : 2; }
  get hpBonus() { return this.perk('h_hide') ? 10 : 0; }
  get quiver() { return this.g.bag.count('bolt'); }
  get canShoot() { return this.loaded > 0 && this.reloadT <= 0 && this.quiver > 0; }
  // snared or staggered prey bleeds easier
  targetMul(e) { return this.perk('h_prey') && (e.state === 'stagger' || e.trapped > 0) ? 1.3 : 1; }

  swing(kind) {
    if (this.canShoot) { this.fire(kind === 'heavy'); return null; }
    // the knife: quick, short, for when the crossbow is empty or still being wound
    if (!this.quiver && !this.warned) { this.warned = true; this.combat.say(L('ลูกดอกหมด! — ใช้มีด', 'Out of bolts — knife')); }
    const k = this.perk('h_knife');
    return { dur: 0.28 * (k ? 0.85 : 1), cost: 7, hitAt: 0.45, range: 2.3, arc: 0.6, dmg: (kind === 'heavy' ? 1.3 : 0.8) * (k ? 1.4 : 1), heavy: kind === 'heavy' };
  }

  fire(aimed) {
    const g = this.g, c = this.combat, p = g.player, cam = g.camera;
    const dir = cam.getWorldDirection(new THREE.Vector3());
    const at = cam.position.clone().addScaledVector(dir, 0.5).add(new THREE.Vector3(0, -0.08, 0));
    if (!(this.perk('h_thrift') && Math.random() < 0.3)) g.bag.remove('bolt', 1);
    this.warned = false;
    this.loaded--;
    if (this.loaded <= 0) this.reloadT = this.reloadTime;
    c.spend(aimed ? 10 : 5);
    let dmg = aimed ? 4 : 2;
    if (!aimed && this.perk('h_sure')) dmg *= 1.1;
    if (aimed && this.perk('h_eye')) dmg *= 1.2;
    if (this.perk('h_still') && this.still >= 1.5) { dmg *= 1.4; g.ui.combatText(L('นิ่ง...', 'Still...'), 'info'); }
    const moon = aimed && this.perk('h_moon');
    if (moon) dmg *= 1.5;
    const pierce = !aimed ? 1 : moon ? 99 : this.perk('h_pierce') ? 5 : 3;
    const speed = (aimed ? 95 : 70) * (moon ? 1.4 : 1);
    const fan = aimed && this.perk('h_volley') ? [-0.07, 0, 0.07] : [0];
    for (const a of fan) {
      const d = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
      const m = this.addWorld(new THREE.Mesh(this.geo.bolt, this.boltMat));
      this.bolts.push({ m, pos: at.clone(), vel: d.multiplyScalar(speed), from: p.pos.clone(), t: 0, dmg, aimed, pierce, hit: new Set(), life: moon ? 3 : 1.6, state: 'fly' });
    }
    this.still = 0;
    this.kick = 1;
    g.audio.burst({ dur: 0.12, freq: 900, q: 2.5, gain: 0.22, sweep: 0.5 });
    g.audio.burst({ dur: 0.08, freq: 220, q: 1, gain: 0.18 });
    g.hud.grin?.();
  }

  hitBolt(b, e, point) {
    const g = this.g, c = this.combat;
    b.hit.add(e);
    let dmg = b.dmg;
    const head = !e.def.fly && point.y > e.pos.y + e.def.height * 0.85;
    if (head) { dmg *= this.perk('h_head') ? 2 : 1.5; g.ui.combatText(L('หัว!', 'Headshot!'), 'parry'); this.feat(1); }
    if (this.perk('h_far')) dmg *= 1 + Math.min(0.32, Math.floor(b.from.distanceTo(e.pos) / 5) * 0.04);
    if (this.perk('h_unseen') && (e.state === 'idle' || e.state === 'return' || e.state === 'wander')) { dmg *= 1.6; g.ui.combatText(L('ไร้เงา!', 'Unseen!'), 'parry'); }
    V.copy(b.vel).setY(0).normalize();
    this.lastShotAimed = b.aimed;
    e.boltsIn = (e.boltsIn || 0) + 1;          // counted first: the bolt that kills comes out of the body too
    c.damageEnemy(e, b.aimed, V, dmg);
    if (this.perk('h_barb') && e.alive) { e.dots = e.dots || {}; e.dots.bleed = { dps: 0.3, t: 4 }; }
    if (this.perk('h_iron') && e.alive && e.state !== 'dying' && !e.def.boss && !e.moba && !e.storyBoss) { e.state = 'stagger'; e.t = Math.max(e.t, 0.6); }
    g.particles.burst(point.clone(), 4, 2, 0.3);
    g.audio.burst({ dur: 0.1, freq: 400, q: 1.5, gain: 0.2, pos: e.pos });
  }

  onKill(e) {
    const g = this.g, p = g.player;
    // bolts come out of the dead (not all of them come out whole)
    if (e.boltsIn) {
      let n = 0;
      for (let i = 0; i < e.boltsIn; i++) if (this.perk('h_salvage') || Math.random() < 0.6) n++;
      e.boltsIn = 0;
      if (n && g.bag.add('bolt', n) < n) g.ui.combatText(L(`+${n} ลูกดอก`, `+${n} bolts`), 'info');
    }
    if (this.lastShotAimed && this.combat.swing == null) this.feat(1);
    if (this.perk('h_chain')) { this.reloadT = 0; this.loaded = this.magazine; }
    if (e.trapped > 0) {
      if (this.perk('h_skin')) { g.coins += 4; g.ui.combatText(L('+4 เหรียญ', '+4 coins'), 'info'); }
      if (this.perk('h_feast')) { this.cool = 0; this.reloadT = 0; this.loaded = this.magazine; p.hp = Math.min(p.maxHp, p.hp + 10); g.ui.combatText(L('งานเลี้ยง! +10', 'Feast! +10'), 'parry'); }
    }
  }

  onDodge() { if (this.perk('h_kite')) { this.reloadT = 0; this.loaded = this.magazine; } }

  // G: a steel trap in front of you (or three, thrown in a fan)
  skill() {
    if (this.cool > 0) { this.combat.say(L(`กับดักยังไม่พร้อม (${Math.ceil(this.cool)})`, `Trap not ready (${Math.ceil(this.cool)})`)); return; }
    const g = this.g, p = g.player, f = p.forwardVec;
    const angles = this.perk('h_field') ? [-0.45, 0, 0.45] : [0];
    for (const a of angles) {
      const dist = this.perk('h_field') ? 4 : 1.8;
      const dx = f.x * Math.cos(a) - f.z * Math.sin(a), dz = f.x * Math.sin(a) + f.z * Math.cos(a);
      const x = p.pos.x + dx * dist, z = p.pos.z + dz * dist;
      this.placeTrap(x, z);
    }
    this.cool = this.perk('h_trapper') ? 14 : 18;
    g.audio.burst({ dur: 0.18, freq: 1500, q: 4, gain: 0.15 });
    g.audio.burst({ dur: 0.25, freq: 300, q: 2, gain: 0.15 });
  }

  placeTrap(x, z) {
    const g = this.g;
    for (const t of this.traps) if (t.spent) this.removeWorld(t.m);
    this.traps = this.traps.filter((t) => !t.spent);
    while (this.traps.length >= this.maxTraps) { const old = this.traps.shift(); this.removeWorld(old.m); }
    const y = Math.max(g.terrain.getHeight(x, z), g.collision.groundAt?.(x, z, g.player.pos.y + 1, 0.3) ?? -1e9);
    const m = new THREE.Group();
    const iron = C(0.4, 0.38, 0.36);
    m.add(new THREE.Mesh(mergeGeometries([
      part(new THREE.TorusGeometry(0.32, 0.025, 4, 12), iron, { rot: [Math.PI / 2, 0, 0] }),
      part(new THREE.BoxGeometry(0.64, 0.02, 0.04), iron),
      part(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 8), C(0.3, 0.28, 0.26)),
      ...Array.from({ length: 8 }, (_, i) => part(new THREE.ConeGeometry(0.025, 0.09, 4), iron, { pos: [Math.cos(i / 8 * Math.PI * 2) * 0.3, 0.04, Math.sin(i / 8 * Math.PI * 2) * 0.3] })),
    ]), this.trapMat));
    m.position.set(x, y + 0.02, z);
    this.addWorld(m);
    this.traps.push({ m, x, z, armed: true, rearm: this.perk('h_rearm') ? 1 : 0, t: 0 });
  }

  spring(T, e) {
    const g = this.g, c = this.combat;
    const hold = this.perk('h_jaws') ? 5 : 3, dmg = 1.5 * (this.perk('h_snare') ? 1.5 : 1);
    const victims = this.perk('h_net') ? c.enemies.filter((o) => o.alive && o.state !== 'dying' && !o.def.fly && Math.hypot(o.pos.x - T.x, o.pos.z - T.z) < 2.5) : [e];
    for (const v of victims) {
      V.set(v.pos.x - T.x, 0, v.pos.z - T.z).normalize();
      c.damageEnemy(v, true, V, dmg);
      if (!v.alive || v.state === 'dying') continue;
      if (v.def.boss || v.storyBoss || v.moba) c.debuff(v, 'slow', hold, 0.4);
      else { v.state = 'stagger'; v.t = Math.max(v.t, hold); }
      v.trapped = hold;
      if (this.perk('h_rust')) { v.dots = v.dots || {}; v.dots.bleed = { dps: 0.35, t: 6 }; }
    }
    if (this.perk('h_blast')) {
      areaStrike(g, { range: 3, dmg: 2, at: new THREE.Vector3(T.x, 0, T.z), heavy: true, skip: e });
      g.particles.burst(new THREE.Vector3(T.x, T.m.position.y + 0.4, T.z), 22, 5, 0.7);
      g.audio.burst({ dur: 0.5, freq: 160, q: 0.8, gain: 0.35 });
    }
    g.audio.burst({ dur: 0.15, freq: 1200, q: 3, gain: 0.3, pos: e.pos });
    g.ui.combatText(L('ติดกับ!', 'Trapped!'), 'parry');
    T.m.scale.set(1, 1, 0.35);           // the jaws snapped shut
    T.armed = false;
    if (T.rearm > 0) { T.rearm--; T.t = -2; }          // it winds itself back in two seconds
    else T.spent = true;                               // the snapped jaws lie there a while
  }

  update(dt) {
    const g = this.g, c = this.combat, T = g.terrain, p = g.player;
    this.cool = Math.max(0, this.cool - dt);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) { this.loaded = this.magazine; g.audio.burst({ dur: 0.1, freq: 1800, q: 5, gain: 0.12 }); }
    }
    // standing still steadies the next shot
    this.still = Math.hypot(p.vel?.x || 0, p.vel?.z || 0) < 0.3 ? this.still + dt : 0;
    // the aim: the view narrows while a held shot is drawn
    const aiming = c.charging && this.canShoot;
    const fov = this.baseFov * (aiming ? (c.heavyReady ? 0.55 : 0.8) : 1);
    if (Math.abs(g.camera.fov - fov) > 0.05) { g.camera.fov += (fov - g.camera.fov) * Math.min(1, dt * 10); g.camera.updateProjectionMatrix(); }
    // bolts in flight: swept against every body along the way
    const A = new THREE.Vector3(), B = new THREE.Vector3(), Q = new THREE.Vector3();
    for (const b of this.bolts) {
      b.t += dt;
      if (b.state === 'stuck') {
        if (p.pos.distanceTo(b.pos) < 1.6 && g.bag.add('bolt', 1) === 0) { b.done = true; g.ui.combatText(L('+1 ลูกดอก', '+1 bolt'), 'info'); g.audio.ui?.(); }
        else if (b.t > (this.perk('h_salvage') ? 120 : 45)) b.done = true;
        continue;
      }
      A.copy(b.pos);
      b.vel.y -= BOLT_G * dt;
      b.pos.addScaledVector(b.vel, dt);
      B.copy(b.pos);
      const seg = B.clone().sub(A), L2 = seg.lengthSq() || 1;
      for (const e of c.enemies) {
        if (!e.alive || e.state === 'dying' || !e.obj.visible || b.hit.has(e)) continue;
        const cy = e.pos.y + (e.def.fly ? 0 : e.def.height * 0.55);
        Q.set(e.pos.x, cy, e.pos.z);
        const k = clamp(Q.clone().sub(A).dot(seg) / L2, 0, 1), P = A.clone().addScaledVector(seg, k);
        // a body from its feet to the top of its head (a flier: a ball round its middle)
        const lo = e.def.fly ? cy - e.def.radius - 0.3 : e.pos.y - 0.1, hi = e.def.fly ? cy + e.def.radius + 0.3 : e.pos.y + e.def.height + 0.05;
        if (Math.hypot(P.x - Q.x, P.z - Q.z) < e.def.radius + 0.25 && P.y > lo && P.y < hi) {
          this.hitBolt(b, e, P);
          if (b.hit.size >= b.pierce) { b.done = true; break; }
        }
      }
      if (b.done) continue;
      const ground = T.getHeight(b.pos.x, b.pos.z);
      if (b.pos.y < ground + 0.05) {
        // it sticks in the mud, to be picked up again
        b.pos.y = ground + 0.12;
        b.state = 'stuck'; b.t = 0;
        b.m.position.copy(b.pos);
        b.m.lookAt(b.pos.clone().add(b.vel));
        b.m.rotateX(-0.5);
        continue;
      }
      if (b.t > b.life) { b.done = true; continue; }
      b.m.position.copy(b.pos);
      b.m.lookAt(b.pos.clone().sub(b.vel));
    }
    for (const b of this.bolts) if (b.done) this.removeWorld(b.m);
    this.bolts = this.bolts.filter((b) => !b.done);
    // traps
    for (const t of this.traps) {
      t.t += dt;
      if (t.spent) { if (t.t > 8) t.done = true; continue; }
      if (!t.armed) {
        if (t.t >= 0) { t.armed = true; t.m.scale.set(1, 1, 1); }
        continue;
      }
      if (t.t > 120) { t.done = true; continue; }
      for (const e of c.enemies) {
        if (!e.alive || e.state === 'dying' || e.def.fly || !e.obj.visible) continue;
        if (Math.hypot(e.pos.x - t.x, e.pos.z - t.z) < 0.55 + e.def.radius) { this.spring(t, e); break; }
      }
    }
    for (const e of c.enemies) if (e.trapped > 0) e.trapped -= dt;
    for (const t of this.traps) if (t.done) this.removeWorld(t.m);
    this.traps = this.traps.filter((t) => !t.done);
  }

  animateWeapon(w, dt) {
    this.kick = Math.max(0, this.kick - dt * 6);
    w.position.z += this.kick * 0.08;
    w.rotation.x += this.kick * 0.25;
    // winding the string back: the bow tips down, the string slides home
    const r = this.reloadT > 0 ? Math.sin(Math.min(1, 1 - this.reloadT / this.reloadTime) * Math.PI) : 0;
    w.rotation.x -= r * 0.55;
    w.position.y -= r * 0.06;
    const pull = this.loaded > 0 ? -0.07 : -0.39;
    this.strings.forEach((m, i) => {
      const tx = (i ? 1 : -1) * 0.3, tz = -0.4, dx = -tx, dz = pull - tz, len = Math.hypot(dx, dz);
      m.position.set(tx + dx / 2, 0.04, tz + dz / 2);
      m.rotation.set(0, -Math.atan2(dz, dx), 0);
      m.scale.set(len, 1, 1);
    });
    this.nocked.visible = this.loaded > 0 && this.quiver > 0;
    // the knife comes forward when it is the knife's turn
    const knifeUp = !this.canShoot && !!this.combat.swing;
    this.knife.position.z = knifeUp ? -0.35 : 0.1;
  }

  label() { return `${super.label()} · ${L(`${this.quiver} ดอก`, `${this.quiver} bolts`)}`; }

  chips() {
    const state = this.quiver <= 0 ? L('ลูกดอกหมด — ใช้มีด', 'Out of bolts — knife') : this.reloadT > 0 ? L(`กำลังบรรจุ ${this.reloadT.toFixed(1)}s`, `Reloading ${this.reloadT.toFixed(1)}s`) : `${L('พร้อมยิง', 'Loaded')}${this.loaded > 1 ? ` ×${this.loaded}` : ''}`;
    return [`${L('ลูกดอก', 'Bolts')} ${this.quiver} · ${state}`, this.cool > 0 ? `${L('กับดัก', 'Trap')} ${Math.ceil(this.cool)}s` : `${L('กับดัก', 'Trap')} [G] ✓ (${this.traps.filter((t) => t.armed).length}/${this.maxTraps})`];
  }

  drawIcon(ctx, flash) {
    const px = pix(ctx);
    px(10, 6, 30, 3, '#7a5434'); px(10, 6, 30, 1, '#9a7048'); px(4, 5, 7, 5, '#4a3020');
    px(34, 1, 3, 12, flash ? '#ffffff' : '#9aa0a8'); px(35, 1, 1, 12, '#c8ced4');
    px(24, 2, 1, 10, '#d8d0c0');
    px(12, 4, 30, 1, '#c8b090'); px(42, 3, 4, 3, '#c0c8d0');
  }

  dispose() {
    const cam = this.g.camera;
    cam.fov = this.baseFov; cam.updateProjectionMatrix();
    // bolts still lying about go back in the quiver
    const left = this.bolts.filter((b) => b.state === 'stuck').length;
    if (left) this.g.bag.add('bolt', left);
    this.bolts = []; this.traps = [];
    super.dispose();
  }
}

const KITS = { wanderer: Wanderer, bell: Bellwright, leech: LeechDoctor, coffin: CoffinBearer, wick: WickBearer, hunter: Hunter };

export function createKit(id, game) {
  const K = KITS[id] || Wanderer;
  return new K(game, game.M);
}

// one-time things a class gets when you first take up its path
export const STARTING_GEAR = { leech: [['leech_live', 5]], hunter: [['bolt', 24]] };

