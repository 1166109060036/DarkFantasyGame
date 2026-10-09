// Weapons and armour.
//
// Every path has four weapons of its own kind: the one it starts with, a quick one, a heavy one and
// a rare one with a power of its own. Armour is one whole suit, worn by any path. Both are bag items
// (kind 'weapon' / 'armour'); equipping one puts the old one back in the bag. Smith upgrades (+1..+4)
// stay on the hand, not the item, so a new weapon never undoes them.
//
// A weapon bends the blows its path already throws: damage of light and heavy blows, how long a
// swing takes (for the crossbow: the reload), stamina per blow, reach, and one effect on a hit.
// Armour takes a share of every hit, and may cost speed or stamina, or carry a power.
import * as THREE from 'three';
import { L } from './i18n.js';

// effects a weapon can carry, applied on every blow that lands
export const EFFECTS = {
  bleed: { name: L('เลือดไหล', 'Bleed'), desc: L('ศัตรูเลือดไหล 4 วินาที', 'foes bleed for 4 seconds') },
  burn: { name: L('ไฟ', 'Fire'), desc: L('ศัตรูติดไฟ 3 วินาที', 'sets foes alight for 3 seconds') },
  frost: { name: L('เยือกแข็ง', 'Frost'), desc: L('ศัตรูช้าลง 40% นาน 2 วินาที', 'slows foes by 40% for 2 seconds') },
  drain: { name: L('ดูดเลือด', 'Drain'), desc: L('ทุกครั้งที่โดน ฟื้นเลือด 1.5', 'each hit restores 1.5 health') },
  stagger: { name: L('กระแทก', 'Concussion'), desc: L('ฟันหนักทำให้ศัตรูทั่วไปเซ 0.8 วินาที', 'heavy blows stagger common foes for 0.8 seconds') },
  crit: { name: L('จุดตาย', 'Precision'), desc: L('โอกาส 15% ตีแรง ×2', '15% chance to deal ×2 damage') },
  holy: { name: L('แสงจันทร์', 'Moonlight'), desc: L('แรง ×1.4 ใส่ร่างซีด วิญญาณ และผู้หลงทาง', '×1.4 damage to the Pale Ones, wisps and the Lost') },
};
const HOLY_PREY = new Set(['gaunt', 'crawler', 'weeper', 'brute', 'wisp', 'hollow']);

// w: [id, path, thai name, english name, thai desc, english desc, stats, tint, value]
//   stats: { light, heavy (damage ×), speed (swing / reload time ×), cost (stamina ×), reach (+m), fx }
const W = (id, cls, th, en, dth, den, s, tint, value) => ({ id, cls, name: L(th, en), desc: L(dth, den), ...s, tint, value });
export const WEAPONS = Object.fromEntries([
  // the Wanderer's swords
  W('wpn_w_old', 'wanderer', 'ดาบเก่า', 'Old Sword', 'ดาบที่ติดตัวมาจากแดนไกล สมดุลทุกด้าน', 'The sword you carried from far away. Balanced in all things.', {}, null, 10),
  W('wpn_w_rapier', 'wanderer', 'ดาบเรียวบึง', 'Marsh Rapier', 'ใบดาบบางเฉียบ แทงเร็ว ทิ้งแผลที่ไม่ยอมหยุดเลือด', 'A thin, quick blade that leaves wounds that will not close.', { light: 0.9, heavy: 0.85, speed: 0.82, cost: 0.8, fx: 'bleed' }, '#c8d8e0', 40),
  W('wpn_w_great', 'wanderer', 'ดาบใหญ่ศิลา', 'Stone Greatsword', 'ตีจากหินของสะพานเก่า ช้าและหนักจนกระดูกร้าว', 'Hewn from the old bridge\'s stone. Slow, and heavy enough to crack bone.', { light: 1.35, heavy: 1.5, speed: 1.28, cost: 1.3, reach: 0.5, fx: 'stagger' }, '#8a8478', 90),
  W('wpn_w_moon', 'wanderer', 'ดาบแสงจันทร์', 'Moonlight Blade', 'ใบดาบที่ส่องแสงเมื่อดวงจันทร์ขึ้น ร่างซีดหวาดกลัวมัน', 'The blade glows when the moon is up. The Pale Ones fear it.', { light: 1.15, heavy: 1.2, fx: 'holy' }, '#9ad8ff', 160),
  // the Bellwright's hammers
  W('wpn_b_old', 'bell', 'ค้อนระฆัง', 'Bell Hammer', 'ค้อนของผู้ดูแลระฆังแห่งวิหารจม', 'The keeper\'s hammer from the drowned temple.', {}, null, 10),
  W('wpn_b_chime', 'bell', 'ค้อนกระดิ่งเงิน', 'Silver Chime Mallet', 'ค้อนเล็กเสียงใสเย็นยะเยือก ศัตรูขยับช้าลงเมื่อได้ยิน', 'A small mallet with a cold, clear ring. Foes slow at the sound.', { light: 0.9, heavy: 0.9, speed: 0.85, cost: 0.8, fx: 'frost' }, '#d0e8f0', 40),
  W('wpn_b_tower', 'bell', 'ลิ้นระฆังหอคอย', 'Tower Clapper', 'ลิ้นระฆังเหล็กทั้งอันจากหอบนเขา หนักเกินกว่าจะเรียกว่าค้อน', 'A whole iron clapper from the peak\'s tower, too heavy to call a hammer.', { light: 1.35, heavy: 1.5, speed: 1.25, cost: 1.3, reach: 0.3, fx: 'stagger' }, '#6a6460', 90),
  W('wpn_b_funeral', 'bell', 'ระฆังงานศพ', 'Funeral Bell', 'ระฆังที่เคยตีส่งวิญญาณ ทุกครั้งที่ดัง มันคืนชีวิตให้คนตี', 'It once rang the dead away. Each toll gives a little life back to the ringer.', { light: 1.1, heavy: 1.15, fx: 'drain' }, '#b89a6a', 160),
  // the Leech-Doctor's blades
  W('wpn_l_old', 'leech', 'มีดกรีด', 'Lancet', 'มีดหมอเถื่อนที่ไม่เคยถูกล้างจริง ๆ', 'A quack\'s lancet, never truly washed.', {}, null, 10),
  W('wpn_l_scalpel', 'leech', 'มีดผ่าตัดกระดูก', 'Bone Scalpel', 'มีดคมจากกระดูกสัตว์ หาจุดตายได้เองเหมือนมีตา', 'A keen blade of beast-bone that finds the vital spot as if it had eyes.', { light: 1.0, heavy: 0.9, speed: 0.8, cost: 0.7, fx: 'crit' }, '#e8e0c8', 40),
  W('wpn_l_cleaver', 'leech', 'มีดสับคนขายเนื้อ', 'Butcher\'s Cleaver', 'มีดสับหนาจากโรงฆ่าสัตว์ ไม่ได้ออกแบบมาเพื่อการรักษา', 'A heavy cleaver from the slaughterhouse. Not made for healing.', { light: 1.4, heavy: 1.45, speed: 1.2, cost: 1.25, fx: 'bleed' }, '#a07060', 90),
  W('wpn_l_saw', 'leech', 'เลื่อยถ่ายเลือด', 'Bloodletter\'s Saw', 'เลื่อยฟันถี่ที่ดื่มทุกหยดที่มันตัดออกมา', 'A fine-toothed saw that drinks every drop it lets.', { light: 1.1, heavy: 1.1, fx: 'drain' }, '#b02020', 160),
  // the Coffin-Bearer's coffins
  W('wpn_c_old', 'coffin', 'โลงคนอนาถา', 'Pauper\'s Coffin', 'โลงไม้ธรรมดาสำหรับคนที่ไม่มีใครฝัง', 'A plain wooden box for those nobody buries.', {}, null, 10),
  W('wpn_c_child', 'coffin', 'โลงเด็ก', 'Child\'s Coffin', 'โลงเล็กเบาหวิว เหวี่ยงได้เร็วจนน่าใจหาย', 'A small, light coffin. It swings far too easily.', { light: 0.85, heavy: 0.85, speed: 0.78, cost: 0.75 }, '#c8b8a0', 40),
  W('wpn_c_iron', 'coffin', 'โลงเหล็กหุ้มศพ', 'Iron Sarcophagus', 'โลงเหล็กทั้งใบ มีอะไรบางอย่างยังเคาะอยู่ข้างใน', 'An iron coffin. Something inside is still knocking.', { light: 1.35, heavy: 1.5, speed: 1.22, cost: 1.3, fx: 'stagger' }, '#5a5a60', 90),
  W('wpn_c_drowned', 'coffin', 'โลงคนจมน้ำ', 'Coffin of the Drowned', 'โลงที่ลอยขึ้นมาจากเมืองใต้ทะเลสาบ ยังเย็นและเปียกอยู่เสมอ', 'It floated up from the sunken city, and is always cold and wet.', { light: 1.15, heavy: 1.2, fx: 'frost' }, '#5a8a9a', 160),
  // the Wick-Bearer's censers
  W('wpn_k_old', 'wick', 'กระถางไฟ', 'Censer', 'กระถางไฟติดโซ่ที่ไม่เคยดับ', 'A censer on a chain. It has never gone out.', {}, null, 10),
  W('wpn_k_ash', 'wick', 'กระถางเถ้า', 'Thurible of Ash', 'กระถางเบาที่ส่ายไปมาเร็ว ประกายไฟหาช่องโหว่เจอเสมอ', 'A light thurible that sways fast; its sparks always find the gap.', { light: 0.9, heavy: 0.9, speed: 0.85, cost: 0.8, fx: 'crit' }, '#a89888', 40),
  W('wpn_k_brazier', 'wick', 'เตาไฟทองเหลือง', 'Bronze Brazier', 'เตาไฟทั้งเตาบนโซ่ยาว ร้อนจนอากาศสั่น', 'A whole brazier on a long chain, hot enough to make the air shiver.', { light: 1.35, heavy: 1.45, speed: 1.22, cost: 1.3, reach: 0.4, fx: 'burn' }, '#c8903a', 90),
  W('wpn_k_black', 'wick', 'ตะเกียงไขดำ', 'Black Wax Lantern', 'ตะเกียงที่จุดด้วยไขเทียนดำ แสงของมันแผดเผาสิ่งที่ไม่ควรมีชีวิต', 'Lit with black wax. Its light burns what should not live.', { light: 1.15, heavy: 1.2, fx: 'holy' }, '#6a5aa0', 160),
  // the Hunter's crossbows (speed = reload time)
  W('wpn_h_old', 'hunter', 'หน้าไม้ล่าสัตว์', 'Hunting Crossbow', 'หน้าไม้ไม้โอ๊กของนายพรานที่ดูแลมาอย่างดี', 'A well-kept oak crossbow.', {}, null, 10),
  W('wpn_h_light', 'hunter', 'หน้าไม้เบา', 'Light Crossbow', 'หน้าไม้เล็ก ง้างสายได้ในพริบตา แต่ลูกไม่หนักนัก', 'A small crossbow, wound in a blink, though its bolts strike lighter.', { light: 0.85, heavy: 0.85, speed: 0.72, cost: 0.8 }, '#b89870', 40),
  W('wpn_h_arbalest', 'hunter', 'หน้าไม้ใหญ่', 'Arbalest', 'หน้าไม้เหล็กที่ต้องใช้เท้ายันตอนง้าง ลูกของมันหยุดหมีได้', 'A steel arbalest you brace with a foot to wind. Its bolts stop bears.', { light: 1.5, heavy: 1.5, speed: 1.4, cost: 1.2, fx: 'stagger' }, '#707880', 90),
  W('wpn_h_moon', 'hunter', 'หน้าไม้เงินจันทร์', 'Moonsilver Crossbow', 'หน้าไม้ของนายพรานโอเรน สายของมันเย็นเหมือนน้ำค้างตอนเที่ยงคืน', 'Oren\'s own crossbow. Its string is cold as midnight dew.', { light: 1.2, heavy: 1.2, fx: 'frost' }, '#c0d8f0', 160),
].map((w) => [w.id, w]));

// a path's four weapons in order: starting, quick, heavy, rare
export const pathWeapons = (cls) => Object.values(WEAPONS).filter((w) => w.cls === cls);

export const STARTER = { wanderer: 'wpn_w_old', bell: 'wpn_b_old', leech: 'wpn_l_old', coffin: 'wpn_c_old', wick: 'wpn_k_old', hunter: 'wpn_h_old' };

// a: [id, thai, english, thai desc, english desc, stats, colour, value]
//   stats: { armour (share of every hit taken away), speed ×, dodge (stamina ×), stamina (regen ×), fx }
const A = (id, th, en, dth, den, s, col, value) => ({ id, name: L(th, en), desc: L(dth, den), ...s, col, value });
export const ARMOURS = Object.fromEntries([
  A('arm_rags', 'ผ้าคลุมผู้เดินทาง', 'Traveller\'s Rags', 'ผ้าคลุมเปียกฝนที่ใส่มาตลอดทาง ไม่กันอะไรเลยนอกจากลม', 'Rain-soaked rags you came in. They keep out nothing but the wind.', {}, '#6a5a48', 5),
  A('arm_leather', 'ชุดหนังนายพราน', 'Hunter\'s Leathers', 'หนังฟอกเบาและเงียบ กลิ้งหลบได้คล่อง', 'Light, quiet tanned hide. Easy to roll in.', { armour: 0.08, dodge: 0.85 }, '#7a5634', 35),
  A('arm_mail', 'เสื้อเกราะโซ่ขึ้นสนิม', 'Rusted Mail', 'เกราะโซ่เก่าจากยามสถานี หนักแต่กันคมได้ดี', 'Old mail from the station guards. Heavy, but it turns an edge.', { armour: 0.15, speed: 0.97, stamina: 0.9 }, '#7a7a80', 60),
  A('arm_robe', 'เสื้อคลุมผู้แสวงบุญ', 'Pilgrim\'s Robe', 'เสื้อคลุมที่ปักคำภาวนาไว้ทุกตะเข็บ แผลหายเร็วกว่าที่ควร', 'Prayers stitched into every seam. Wounds close faster than they should.', { armour: 0.05, fx: 'regen' }, '#c8c0a8', 50),
  A('arm_briar', 'เสื้อหนามกุหลาบป่า', 'Briar Coat', 'เสื้อหนังที่เย็บหนามไว้ด้านนอก ใครตีเจ้าก็เจ็บด้วย', 'Leather sewn with thorns. Whoever strikes you bleeds for it.', { armour: 0.1, fx: 'thorns' }, '#4a5a30', 80),
  A('arm_shroud', 'ผ้าห่อศพสัปเหร่อ', 'Gravedigger\'s Shroud', 'ผ้าห่อศพสีเทาที่กลิ่นเหมือนดิน ศัตรูสังเกตเห็นเจ้าได้ใกล้ลง', 'A grey shroud that smells of earth. Foes notice you from nearer.', { armour: 0.06, fx: 'silent' }, '#5a5a58', 90),
  A('arm_plate', 'เกราะองครักษ์', 'Guard\'s Plate', 'เกราะเหล็กของผู้เฝ้ามหาวิหารจม หนักมาก แต่การโจมตีไม่ทำให้เสียหลัก', 'The drowned cathedral\'s guard-plate. Very heavy, but blows never knock you off balance.', { armour: 0.28, speed: 0.9, dodge: 1.25, fx: 'poise' }, '#8a8c90', 150),
  A('arm_moon', 'อาภรณ์แสงจันทร์', 'Moonlit Raiment', 'ผ้าทอจากแสงที่หลุดจากมือนับร้อย แรงไม่เคยหมด', 'Woven of the light the hundred hands let go. Your strength never runs dry.', { armour: 0.18, stamina: 1.25, fx: 'regen' }, '#a8c8f0', 200),
].map((a) => [a.id, a]));

export const ARMOUR_FX = {
  regen: L('ฟื้นเลือดเร็วขึ้น', 'faster healing'),
  thorns: L('สะท้อนดาเมจ 30% ใส่ผู้โจมตี', 'returns 30% of melee damage'),
  silent: L('ศัตรูเห็นเจ้าจากระยะใกล้ลง 35%', 'foes notice you 35% closer'),
  poise: L('ไม่เซเมื่อโดนตี', 'never staggered by hits'),
};

// one line of what a piece does, for the bag and the shops
export function statLine(id) {
  const w = WEAPONS[id], a = ARMOURS[id];
  const pct = (x) => `${x > 1 ? '+' : ''}${Math.round((x - 1) * 100)}%`;
  if (w) {
    const out = [];
    if (w.light && w.light !== 1) out.push(L(`ฟันเบา ${pct(w.light)}`, `light ${pct(w.light)}`));
    if (w.heavy && w.heavy !== 1) out.push(L(`ฟันหนัก ${pct(w.heavy)}`, `heavy ${pct(w.heavy)}`));
    if (w.speed && w.speed !== 1) out.push(w.cls === 'hunter' ? L(`บรรจุ ${pct(w.speed)}`, `reload ${pct(w.speed)}`) : L(`ความเร็ว ${pct(1 / w.speed)}`, `speed ${pct(1 / w.speed)}`));
    if (w.cost && w.cost !== 1) out.push(L(`ใช้แรง ${pct(w.cost)}`, `stamina ${pct(w.cost)}`));
    if (w.reach) out.push(L(`ระยะ +${w.reach} ม.`, `reach +${w.reach} m`));
    if (w.fx) out.push(`${EFFECTS[w.fx].name}: ${EFFECTS[w.fx].desc}`);
    return out.join(' · ') || L('สมดุล', 'balanced');
  }
  if (a) {
    const out = [];
    if (a.armour) out.push(L(`ลดดาเมจ ${Math.round(a.armour * 100)}%`, `damage −${Math.round(a.armour * 100)}%`));
    if (a.speed && a.speed !== 1) out.push(L(`ความเร็ว ${pct(a.speed)}`, `speed ${pct(a.speed)}`));
    if (a.dodge && a.dodge !== 1) out.push(L(`หลบใช้แรง ${pct(a.dodge)}`, `dodge stamina ${pct(a.dodge)}`));
    if (a.stamina && a.stamina !== 1) out.push(L(`แรงฟื้น ${pct(a.stamina)}`, `stamina regen ${pct(a.stamina)}`));
    if (a.fx) out.push(ARMOUR_FX[a.fx]);
    return out.join(' · ') || L('ไม่มีการป้องกัน', 'no protection');
  }
  return '';
}

// ------------------------------------------------------------------------------------------------
// what the player has on: a weapon per path (switching paths at the inn keeps each one's weapon)
// and one suit of armour
export class Equipment {
  constructor(game) {
    this.g = game;
    this.weapons = { ...STARTER };
    this.armour = 'arm_rags';
  }

  get weapon() { const k = this.g.kit?.id; return WEAPONS[this.weapons[k] || STARTER[k]] || WEAPONS.wpn_w_old; }
  get suit() { return ARMOURS[this.armour] || ARMOURS.arm_rags; }
  get armourMul() { return 1 - (this.suit.armour || 0); }
  get speedMul() { return this.suit.speed || 1; }
  get dodgeMul() { return this.suit.dodge || 1; }
  get staminaMul() { return this.suit.stamina || 1; }
  get aggroMul() { return this.suit.fx === 'silent' ? 0.65 : 1; }
  get regenMul() { return this.suit.fx === 'regen' ? 1.8 : 1; }
  get poise() { return this.suit.fx === 'poise'; }

  // worn (by any path) or carried
  owns(id) {
    return this.armour === id || Object.values(this.weapons).includes(id) || this.g.bag.count(id) > 0;
  }

  // a boss's or a bounty's prize: into the bag (or at your feet); a piece you already have is skipped
  reward(ids) {
    const g = this.g;
    for (const id of ids) {
      if (!id || this.owns(id)) continue;
      if (g.bag.add(id, 1) > 0) g.loot.dropNearPlayer(id, 1);
      const def = WEAPONS[id] || ARMOURS[id];
      g.ui.toast(L(`ได้รับ ${def.name} — สวมใส่ได้จากกระเป๋า`, `Received: ${def.name} — equip it from your bag`));
    }
  }

  // equip a piece from the bag; the old one goes back into the bag in its place
  equip(item) {
    const g = this.g, w = WEAPONS[item.id], a = ARMOURS[item.id];
    if (w && w.cls !== g.kit.id) { g.ui.toast(L(`ต้องเป็น${g.pathName(w.cls)}จึงจะใช้ได้`, `Only a ${g.pathName(w.cls)} can wield this`)); return false; }
    if (!w && !a) return false;
    const old = w ? this.weapons[w.cls] : this.armour;
    g.bag.removeItem(item);
    if (w) this.weapons[w.cls] = w.id; else this.armour = a.id;
    if (old && g.bag.add(old, 1) > 0) g.loot.dropNearPlayer(old, 1);
    this.apply();
    g.audio.anvil?.();
    g.ui.toast(L(`สวม${(w || a).name}`, `Equipped: ${(w || a).name}`));
    g.save?.();
    return true;
  }

  // standing effects and the look of the weapon in hand
  apply() {
    const g = this.g;
    g.applyKitStats?.();
    const w = this.weapon, held = g.kit?.weapon;
    if (!held) return;
    // tint the weapon in hand: its own colour, and a glow for the rare ones
    held.traverse((o) => {
      if (!o.isMesh) return;
      if (!o.userData.baseMat) o.userData.baseMat = o.material;
      if (!w.tint) { o.material = o.userData.baseMat; return; }
      const m = o.userData.baseMat.clone();
      const c = new THREE.Color(w.tint);
      m.color = (m.color || new THREE.Color(1, 1, 1)).clone().lerp(c, 0.45);
      if (w.value >= 160 && m.emissive) m.emissive = c.clone().multiplyScalar(0.25);
      o.material = m;
    });
  }

  // a swing spec from the path, bent by the weapon
  shape(spec, kind) {
    if (!spec) return spec;
    const w = this.weapon;
    spec.dmg *= (kind === 'heavy' ? w.heavy : w.light) || 1;
    spec.dur *= w.speed || 1;
    spec.cost *= w.cost || 1;
    if (w.reach) spec.range += w.reach;
    return spec;
  }

  // a blow (or a bolt) landed: the weapon's power, and how much more it hurts
  hitMul(e) {
    const w = this.weapon;
    let k = 1;
    if (w.fx === 'crit' && Math.random() < 0.15) { k *= 2; this.g.ui.combatText(L('จุดตาย!', 'Critical!'), 'parry'); }
    if (w.fx === 'holy' && HOLY_PREY.has(e.type)) k *= 1.4;
    return k;
  }

  onHit(e, heavy) {
    const g = this.g, c = g.combat, fx = this.weapon.fx;
    if (!fx || !e.alive || e.state === 'dying') return;
    e.dots = e.dots || {};
    if (fx === 'bleed') e.dots.bleed = { dps: 0.3, t: 4 };
    if (fx === 'burn') e.dots.burn = { dps: 0.35, t: 3 };
    if (fx === 'frost') c.debuff(e, 'slow', 2, 0.6);
    if (fx === 'drain') { const p = g.player; p.hp = Math.min(p.maxHp, p.hp + 1.5); }
    if (fx === 'stagger' && heavy && !e.def.boss && !e.storyBoss && !e.moba) { e.state = 'stagger'; e.t = Math.max(e.t, 0.8); }
  }

  // armour: thorns answer a blow
  onHurt(dmg, e) {
    if (this.suit.fx === 'thorns' && e && e.alive && e.state !== 'dying' && !e.moba) {
      e.hp -= dmg * 0.3; e.flash = 1;
      if (e.hp <= 0) this.g.combat.kill(e);
    }
  }

  serialize() { return { weapons: this.weapons, armour: this.armour }; }
  load(d = {}) {
    this.weapons = { ...STARTER, ...(d.weapons || {}) };
    for (const [cls, id] of Object.entries(this.weapons)) if (!WEAPONS[id] || WEAPONS[id].cls !== cls) this.weapons[cls] = STARTER[cls];
    this.armour = ARMOURS[d.armour] ? d.armour : 'arm_rags';
  }
}
