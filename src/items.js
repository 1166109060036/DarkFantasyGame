// Every item in the game: its footprint in the bag grid (w x h cells, Resident Evil 4 style),
// how many fit in one stack, what it sells for, and a procedurally painted pixel-art icon.
import { L } from './i18n.js';
import { WEAPONS, ARMOURS } from './equipment.js';

export const ITEMS = {
  // consumables (one per slot, like RE4 sprays)
  potion: { name: L('ยาฟื้นพลัง', 'Healing Draught'), desc: L('ฟื้นเลือด 50', 'A bitter red draught. Restores 50 health.'), w: 1, h: 2, stack: 1, kind: 'use', value: 4, heal: 50 },
  potion_big: { name: L('ยาฟื้นพลังใหญ่', 'Great Healing Draught'), desc: L('ฟื้นเลือดเต็มหลอด', 'A thick draught, sealed in gold. Restores all health.'), w: 1, h: 2, stack: 1, kind: 'use', value: 10, heal: 999 },
  tonic: { name: L('ยาบำรุงแรง', 'Stamina Tonic'), desc: L('90 วินาที: แรงฟื้นเร็ว ×2 ใช้แรงน้อยลงครึ่งหนึ่ง', '90 seconds: stamina returns ×2 as fast, and every action costs half as much.'), w: 1, h: 2, stack: 1, kind: 'use', value: 8, buff: ['tonic', 90] },
  oil: { name: L('น้ำมันดาบเรืองแสง', 'Glowing Blade Oil'), desc: L('90 วินาที: ดาบแรงขึ้น ×1.5', '90 seconds: your blade strikes ×1.5 harder.'), w: 1, h: 2, stack: 1, kind: 'use', value: 10, buff: ['oil', 90] },
  sight: { name: L('ยาตาแมว', "Cat's-Eye Potion"), desc: L('180 วินาที: มองเห็นในความมืดชัดขึ้น', '180 seconds: you see clearer in the dark.'), w: 1, h: 2, stack: 1, kind: 'use', value: 8, buff: ['sight', 180] },
  // materials
  moon_herb: { name: L('หญ้าจันทร์', 'Moon Herb'), desc: L('สมุนไพรใบเงินที่ขึ้นใต้แสงจันทร์ ใช้ปรุงยา', 'A silver-leafed herb that grows under moonlight. Used in brewing.'), w: 1, h: 1, stack: 5, kind: 'mat', value: 2 },
  mushroom: { name: L('เห็ดเรืองแสง', 'Glowcap'), desc: L('เห็ดสีฟ้าจากป่าและบึง ใช้ปรุงยาและอัปเกรดตะเกียง', 'A blue mushroom of the woods and the marsh. Used in brewing and to improve the lantern.'), w: 1, h: 1, stack: 5, kind: 'mat', value: 2 },
  straw: { name: L('ฟางสาป', 'Cursed Straw'), desc: L('ฟางจากหุ่นฟางคลั่ง เหนียวผิดธรรมชาติ', 'Straw from a Mad Strawman. Unnaturally tough.'), w: 2, h: 1, stack: 5, kind: 'mat', value: 2 },
  fang: { name: L('เขี้ยวหมาป่าเงา', 'Shadow Wolf Fang'), desc: L('เขี้ยวดำคม ช่างตีเหล็กใช้ชุบดาบ', 'A keen black fang. The smith uses it to temper blades.'), w: 1, h: 1, stack: 10, kind: 'mat', value: 3 },
  slime: { name: L('เมือกปลิงยักษ์', 'Giant Leech Slime'), desc: L('เมือกเหนียวกันน้ำ ใช้ปรุงยาและเคลือบผ้าคลุม', 'Sticky slime that sheds water. Used in brewing and to proof cloaks.'), w: 1, h: 1, stack: 5, kind: 'mat', value: 3 },
  essence: { name: L('แก่นวิญญาณ', 'Wisp Essence'), desc: L('ประกายจากวิญญาณบึง อุ่นเหมือนมีชีวิต', 'A spark left by a Marsh Wisp. Warm, as if alive.'), w: 1, h: 1, stack: 5, kind: 'mat', value: 4 },
  ore: { name: L('แร่เหล็กมืด', 'Dark Iron Ore'), desc: L('แร่หนักจากหน้าผาทางเหนือ ใช้ตีอาวุธ', 'Heavy ore from the northern cliffs. Used to forge weapons.'), w: 2, h: 1, stack: 3, kind: 'mat', value: 6 },
  claw: { name: L('กรงเล็บซีด', 'Pale Claw'), desc: L('เล็บยาวจากร่างซูบ แข็งเหมือนกระดูก ช่างตีเหล็กใช้ทำคมดาบ', 'A long claw torn from a Gaunt, hard as bone. The smith uses it to hone blades.'), w: 1, h: 1, stack: 10, kind: 'mat', value: 3 },
  bolt: { name: L('ลูกดอกหน้าไม้', 'Crossbow Bolt'), desc: L('ลูกดอกหัวเหล็กหางขนนก นักล่าหน้าไม้ยิงได้ทีละดอก · ซื้อที่โรงเตี๊ยม ตีที่ช่างเหล็ก หรือเก็บคืนจากพื้นและศพ', 'Iron-headed, feather-fletched. The Crossbow Hunter looses them one at a time · Bought at the inn, forged by the smith, or pulled back from the ground and the dead.'), w: 2, h: 1, stack: 12, kind: 'mat', value: 1 },
  leech_live: { name: L('ปลิงดูดเลือด', 'Bloodsucking Leech'), desc: L('ปลิงหิวเลือดในขวดโหล หมอปลิงปาใส่ศัตรูได้ (กดค้างแล้วปล่อย)', 'A blood-hungry leech in a jar. The Leech-Doctor hurls it at foes (hold, then release).'), w: 1, h: 1, stack: 6, kind: 'mat', value: 2 },
  trophy: { name: L('หลักฐานการล่า', 'Proof of the Hunt'), desc: L('ซากของเป้าหมายค่าหัว ห่อผ้าไว้อย่างดี นำไปส่งที่บอร์ดประกาศหน้าโรงเตี๊ยม', 'Remains of a bounty, bound tight in cloth. Bring it to the bounty board by the inn door.'), w: 1, h: 2, stack: 3, kind: 'mat', value: 0 },
  knight_core: { name: L('แกนหินอัศวิน', "Stone Knight's Core"), desc: L('หัวใจหินที่ยังเต้นอยู่ ช่างตีเหล็กใช้ตีดาบขั้นสุดท้าย', 'A heart of stone that beats still. The smith needs it to forge the final blade.'), w: 2, h: 2, stack: 1, kind: 'mat', value: 40 },
  // treasures: worthless to you, valuable to the innkeeper
  moonstone: { name: L('มูนสโตน', 'Moonstone'), desc: L('สมบัติ · ขายได้ที่โรงเตี๊ยม (ช่างตีเหล็กใช้ทำตะเกียงได้)', 'Treasure · Sells at the inn (the smith can also work it into a lantern).'), w: 1, h: 1, stack: 1, kind: 'treasure', value: 22 },
  pearl: { name: L('ไข่มุกบึง', 'Marsh Pearl'), desc: L('สมบัติ · ไข่มุกสีดำจากท้องปลิง', "Treasure · A black pearl from a leech's belly."), w: 1, h: 1, stack: 1, kind: 'treasure', value: 25 },
  token: { name: L('เหรียญรถไฟเก่า', 'Old Rail Token'), desc: L('สมบัติ · ตั๋วโลหะจากยุคที่รถไฟยังวิ่ง', 'Treasure · A metal ticket from the days when the trains still ran.'), w: 1, h: 1, stack: 3, kind: 'treasure', value: 12 },
  watch: { name: L('นาฬิกาพกพนักงานรถไฟ', "Railwayman's Pocket Watch"), desc: L('สมบัติ · เข็มหยุดเดินตอนเที่ยงคืน', 'Treasure · Its hands stopped at midnight.'), w: 1, h: 1, stack: 1, kind: 'treasure', value: 35 },
  candlestick: { name: L('เชิงเทียนเงิน', 'Silver Candlestick'), desc: L('สมบัติ · เทียนหลอมจะชอบมันมาก', 'Treasure · Tallow will be fond of it.'), w: 1, h: 2, stack: 1, kind: 'treasure', value: 40 },
  locket: { name: L('จี้รูปถ่ายเก่า', 'Old Portrait Locket'), desc: L('สมบัติ · ในจี้มีรูปผู้หญิงยิ้มอยู่ เธอเคยเป็นคนของหมู่บ้านนี้', 'Treasure · Inside, a woman smiles. She was once of this village.'), w: 1, h: 1, stack: 1, kind: 'treasure', value: 45 },
  pale_heart: { name: L('หัวใจซีด', 'Pale Heart'), desc: L('สมบัติ · หัวใจของร่างซูบยักษ์ ยังอุ่นอยู่เลย ใครบางคนในโรงเตี๊ยมยอมจ่ายแพง', 'Treasure · The heart of a Gaunt Giant, still warm. Someone at the inn will pay dearly.'), w: 1, h: 2, stack: 1, kind: 'treasure', value: 60 },
  star_shard: { name: L('เศษดาวตก', 'Star Shard'), desc: L('สมบัติ · หินร้อนที่ยังเรืองแสงอยู่ พ่อค้าเร่ให้ราคาดีมาก', 'Treasure · A hot stone that glows still. The wandering pedlar pays well.'), w: 1, h: 1, stack: 3, kind: 'treasure', value: 45 },
  blood_amber: { name: L('อำพันเลือด', 'Blood Amber'), desc: L('สมบัติ · เลือดของร่างซีดที่แข็งตัวใต้จันทร์เลือด อุ่นเหมือนยังเต้นอยู่', 'Treasure · Blood of the Pale Ones, set hard under a blood moon. Warm, as if it beats still.'), w: 1, h: 1, stack: 5, kind: 'treasure', value: 20 },
  small_bell: { name: L('ลิ้นระฆังเล็ก', 'Little Bell'), desc: L('ของสำคัญ · ลิ้นระฆังจากหอบนเขา เขย่าแล้วผู้หลงทางรอบตัวหยุดนิ่ง 4 วินาที (ราชันร้อยกรก็ชะงัก) · ใช้ได้ทุก 90 วินาที', 'Key item · A clapper from the Bell Tower on the Peak. Shake it and the Lost around you stand still for 4 seconds (even the King of a Hundred Hands falters) · Usable every 90 seconds.'), w: 1, h: 1, stack: 1, kind: 'use', special: 'bell', value: 0 },
  hand_crown: { name: L('มงกุฎหนามราชันร้อยกร', 'Thorn Crown of the Hundred Hands'), desc: L('สมบัติ · มงกุฎหนามจากหัวของราชันร้อยกร ยังอุ่นและสั่นอยู่ในมือ ไม่มีใครในโรงเตี๊ยมกล้าแตะ แต่ก็ไม่มีใครกล้าไม่ซื้อ', 'Treasure · A crown of thorns from the brow of the King of a Hundred Hands, still warm and trembling in your grip. No one at the inn dares touch it; no one dares refuse it.'), w: 2, h: 1, stack: 1, kind: 'treasure', value: 160 },
  idol: { name: L('รูปเคารพราชาหิน', 'Idol of the Stone King'), desc: L('สมบัติ · รูปปั้นทองคำขนาดฝ่ามือ', 'Treasure · A golden statue the size of a palm.'), w: 2, h: 2, stack: 1, kind: 'treasure', value: 85 },
};

// weapons (one per path, 1×3 or 2×2 by kind) and suits of armour (2×2) are bag items too
const WEAPON_SIZE = { wanderer: [1, 3], bell: [1, 3], leech: [1, 2], coffin: [2, 3], wick: [1, 3], hunter: [2, 2] };
for (const w of Object.values(WEAPONS)) {
  const [ww, hh] = WEAPON_SIZE[w.cls];
  ITEMS[w.id] = { name: w.name, desc: w.desc, w: ww, h: hh, stack: 1, kind: 'weapon', cls: w.cls, value: w.value };
}
for (const a of Object.values(ARMOURS)) ITEMS[a.id] = { name: a.name, desc: a.desc, w: 2, h: 2, stack: 1, kind: 'armour', value: a.value };

export const itemName = (id) => ITEMS[id]?.name ?? id;

// ---------------------------------------------------------------- icons (16 px per cell)
const P = 16;
const cache = new Map();

function painter(ctx) {
  return {
    r: (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); },
    p: (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); },
  };
}

function bottle(d, w, h, liquid, glow, cork = '#8a6040') {
  const cx = Math.floor(w / 2);
  d.r(cx - 2, 2, 4, 3, cork); d.r(cx - 2, 2, 4, 1, '#b08060');
  d.r(cx - 2, 5, 4, 4, '#4a5a6a'); d.r(cx - 1, 5, 1, 4, '#8aa0b4');
  const top = 9, bot = h - 3;
  for (let y = top; y < bot; y++) {
    const half = y < top + 3 ? 3 + (y - top) : 6;
    d.r(cx - half, y, half * 2, 1, '#3a4656');
    if (y > top + 3) d.r(cx - half + 1, y, half * 2 - 2, 1, liquid);
  }
  d.r(cx - 6, bot, 12, 1, '#2a3440');
  d.r(cx - 4, top + 6, 2, 6, glow);
  d.r(cx - 3, top + 4, 1, 1, '#e8f4ff');
}

const DRAW = {
  bolt: (d) => {
    for (const y of [4, 8, 12]) {
      d.r(6, y, 20, 1, '#8a6a44'); d.r(6, y - 1, 20, 1, '#a88458');
      d.r(26, y - 1, 3, 3, '#b8c0c8'); d.p(29, y, '#e8f0f4');
      d.r(2, y - 2, 4, 1, '#c8c0b0'); d.r(2, y + 1, 4, 1, '#c8c0b0'); d.r(3, y - 1, 3, 2, '#e8e0d0');
    }
  },
  potion: (d, w, h) => bottle(d, w, h, '#b8202a', '#ff7a70'),
  potion_big: (d, w, h) => { bottle(d, w, h, '#d03040', '#ffb0a0', '#c8a040'); d.r(5, 22, 6, 1, '#f0d070'); },
  tonic: (d, w, h) => bottle(d, w, h, '#c8a020', '#fff090'),
  oil: (d, w, h) => bottle(d, w, h, '#e06a18', '#ffc070'),
  sight: (d, w, h) => bottle(d, w, h, '#2a8a6a', '#8affd0'),
  moon_herb: (d) => {
    d.r(7, 9, 2, 6, '#3a6a3a');
    for (const [x, y, c] of [[3, 5, '#a8c8c0'], [9, 3, '#c8e8e0'], [5, 8, '#88b0a8'], [10, 7, '#a8d0c8']]) { d.r(x, y, 4, 3, c); d.r(x + 1, y + 1, 2, 1, '#eaffff'); }
    d.p(8, 2, '#ffffff');
  },
  mushroom: (d) => {
    d.r(5, 9, 2, 5, '#c8d0e0'); d.r(10, 10, 2, 4, '#c8d0e0');
    d.r(2, 5, 8, 4, '#4aa0ff'); d.r(3, 4, 6, 1, '#8ad0ff'); d.r(4, 6, 1, 1, '#d8f4ff');
    d.r(8, 7, 6, 3, '#3a88e8'); d.r(9, 6, 4, 1, '#7ac0ff');
  },
  straw: (d) => {
    for (let i = 0; i < 9; i++) d.r(2 + i * 3, 4 + (i % 3), 2, 9 - (i % 2), i % 2 ? '#c8a050' : '#e0bc68');
    d.r(10, 6, 12, 2, '#7a3a20'); d.r(10, 6, 12, 1, '#a04a28');
  },
  fang: (d) => {
    for (let y = 2; y < 14; y++) { const w = Math.max(1, 6 - Math.floor(y / 2.4)); d.r(5 + (y > 8 ? 1 : 0), y, w, 1, y < 4 ? '#d8d0c0' : '#f0eadc'); }
    d.r(4, 2, 7, 2, '#5a4a40'); d.p(6, 6, '#ffffff');
  },
  slime: (d) => {
    d.r(3, 6, 10, 7, '#7a3a6a'); d.r(4, 5, 8, 1, '#9a4a88'); d.r(2, 9, 12, 3, '#6a2a5a');
    d.r(5, 7, 2, 2, '#e0a0d0'); d.r(9, 12, 2, 3, '#7a3a6a');
  },
  leech_live: (d) => {
    d.r(3, 3, 10, 12, '#3a4a56'); d.r(4, 2, 8, 2, '#8a6040'); d.r(4, 4, 1, 10, '#8aa0b4');
    d.r(5, 6, 6, 3, '#4a1a30'); d.r(6, 9, 5, 3, '#5a2238'); d.r(5, 12, 4, 2, '#4a1a30');
    d.p(9, 7, '#c86a88'); d.p(7, 10, '#c86a88');
  },
  trophy: (d) => {
    d.r(3, 6, 10, 20, '#6a5a44'); d.r(4, 5, 8, 1, '#8a7656'); d.r(3, 25, 10, 2, '#4a3e2e');
    d.r(3, 12, 10, 2, '#3a2a1c'); d.r(3, 19, 10, 2, '#3a2a1c');
    d.r(6, 8, 4, 3, '#7a1a12'); d.p(7, 9, '#c84a3a'); d.r(5, 2, 6, 3, '#d8d0b8'); d.p(6, 3, '#2a2a2a'); d.p(9, 3, '#2a2a2a');
  },
  star_shard: (d) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const r = Math.abs(x - 7.5) + Math.abs(y - 7.5) * 0.8;
      if (r < 7) d.p(x, y, r < 2 ? '#ffffff' : r < 4 ? '#e0d8ff' : r < 5.5 ? '#9a8ae0' : '#4a3a8a');
    }
    d.p(5, 4, '#ffffff'); d.p(11, 10, '#ffffff');
  },
  blood_amber: (d) => {
    d.r(4, 4, 8, 9, '#8a1a10'); d.r(3, 6, 10, 5, '#a8241a'); d.r(5, 3, 6, 1, '#c84a2a');
    d.r(5, 5, 2, 3, '#ff9a5a'); d.p(9, 9, '#ff6a3a'); d.r(6, 12, 4, 1, '#5a0a06');
  },
  essence: (d) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const r = Math.hypot(x - 7.5, y - 7.5);
      if (r < 6) d.p(x, y, r < 2.5 ? '#ffffff' : r < 4 ? '#a8e0ff' : '#4a90e0');
    }
  },
  ore: (d) => {
    d.r(3, 5, 26, 8, '#3a3a44'); d.r(5, 3, 18, 2, '#4a4a56'); d.r(2, 8, 2, 4, '#2a2a32');
    for (const [x, y] of [[8, 6], [15, 8], [22, 5], [19, 10], [11, 10]]) { d.r(x, y, 2, 2, '#9aa8c0'); d.p(x, y, '#e0e8ff'); }
  },
  knight_core: (d) => {
    d.r(6, 5, 20, 22, '#5a6070'); d.r(4, 9, 24, 14, '#5a6070'); d.r(8, 7, 16, 18, '#6a7488');
    d.r(12, 11, 8, 10, '#ff8a30'); d.r(14, 13, 4, 6, '#ffe0a0'); d.r(10, 9, 2, 2, '#8a96aa');
    d.r(6, 25, 4, 2, '#3a3e48'); d.r(22, 5, 4, 2, '#3a3e48');
  },
  claw: (d) => {
    for (let i = 0; i < 12; i++) { const x = 4 + Math.round(Math.sin(i / 11 * 2.2) * 6), w = Math.max(1, 4 - Math.floor(i / 3)); d.r(x, 2 + i, w, 1, i < 3 ? '#8a7a68' : '#e8dcc8'); }
    d.r(3, 1, 5, 2, '#a8483a'); d.p(5, 6, '#ffffff');
  },
  locket: (d) => {
    for (let i = 0; i < 6; i++) d.p(7 + (i % 2), i, '#b8a060');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const r = Math.hypot((x - 8) / 5.2, (y - 10) / 5);
      if (r < 1) d.p(x, y, r > 0.8 ? '#a88a40' : '#d8b860');
    }
    d.r(6, 8, 4, 4, '#3a2c20'); d.r(7, 9, 2, 2, '#c8b8a0');
  },
  pale_heart: (d) => {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) {
      const nx = (x - 8) / 6.5, ny = (y - 16) / 11;
      const inside = nx * nx + ny * ny < 1 || ((x - 5) ** 2 + (y - 8) ** 2 < 14) || ((x - 11) ** 2 + (y - 8) ** 2 < 12);
      if (inside) d.p(x, y, (x + y) % 7 === 0 ? '#7a2a30' : y > 22 ? '#a89890' : '#c8b8b0');
    }
    d.r(6, 2, 2, 5, '#8a6a70'); d.r(9, 1, 2, 5, '#8a6a70'); d.r(5, 14, 2, 8, '#8a2a30');
  },
  moonstone: (d) => {
    d.r(5, 3, 6, 10, '#9ab8e8'); d.r(3, 5, 10, 6, '#9ab8e8'); d.r(6, 4, 3, 3, '#e8f4ff'); d.r(9, 9, 3, 3, '#6a88c8');
  },
  pearl: (d) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const r = Math.hypot(x - 8, y - 8);
      if (r < 5.5) d.p(x, y, Math.hypot(x - 6, y - 6) < 2 ? '#b0a8c8' : '#3a3448');
    }
  },
  token: (d) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const r = Math.hypot(x - 7.5, y - 7.5);
      if (r < 6.5) d.p(x, y, r > 5 ? '#8a6a30' : '#c8a048');
    }
    d.r(5, 6, 6, 1, '#6a4a20'); d.r(5, 9, 6, 1, '#6a4a20'); d.r(7, 7, 2, 2, '#6a4a20');
  },
  watch: (d) => {
    d.r(7, 1, 2, 2, '#c8b070');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const r = Math.hypot(x - 8, y - 9);
      if (r < 6) d.p(x, y, r > 4.8 ? '#c8b070' : '#efe8d4');
    }
    d.r(8, 5, 1, 4, '#222'); d.r(8, 9, 3, 1, '#222');
  },
  candlestick: (d) => {
    d.r(7, 2, 2, 3, '#ffd070'); d.r(6, 5, 4, 8, '#ecead8');
    d.r(4, 13, 8, 2, '#b8c0cc'); d.r(7, 15, 2, 10, '#a8b0bc'); d.r(3, 25, 10, 3, '#b8c0cc'); d.r(3, 25, 10, 1, '#e0e6ee');
  },
  small_bell: (d) => {
    d.r(5, 3, 6, 2, '#a08040'); d.r(4, 5, 8, 6, '#c8a050'); d.r(3, 11, 10, 2, '#a07830'); d.r(7, 13, 2, 2, '#5a4020'); d.r(5, 6, 2, 4, '#f0d080');
  },
  hand_crown: (d) => {
    d.r(3, 9, 26, 5, '#3a2a22'); d.r(4, 10, 24, 2, '#5a4030');
    for (let i = 0; i < 7; i++) { const x = 4 + i * 4; d.r(x, 4 + (i % 2) * 2, 2, 5 - (i % 2) * 2, '#4a3426'); d.p(x, 2 + (i % 2) * 2, '#6a4a36'); }
    d.p(8, 11, '#a8241a'); d.p(16, 11, '#a8241a'); d.p(24, 11, '#a8241a');
  },
  idol: (d) => {
    d.r(10, 4, 12, 10, '#d8a830'); d.r(8, 2, 16, 3, '#f0c850'); for (let i = 0; i < 5; i++) d.r(8 + i * 4, 0, 2, 3, '#f0c850');
    d.r(12, 7, 3, 2, '#7a5a10'); d.r(18, 7, 3, 2, '#7a5a10'); d.r(15, 9, 2, 3, '#a87a18'); d.r(13, 12, 6, 1, '#7a5a10');
    d.r(9, 14, 14, 12, '#c89820'); d.r(6, 26, 20, 4, '#a87a18'); d.r(11, 16, 2, 6, '#f0c850');
  },
};

// weapon icons: the path's weapon shape, in the weapon's own colour
function drawWeapon(w) {
  const tint = w.tint || '#b8bcc4', glow = w.value >= 160;
  return (d, W, H) => {
    if (glow) { d.r(1, 1, W - 2, H - 2, 'rgba(160,200,255,0.12)'); }
    const cx = Math.floor(W / 2);
    if (w.cls === 'wanderer') { d.r(cx - 1, 2, 3, H - 16, tint); d.r(cx, 3, 1, H - 18, '#ffffff'); d.r(cx - 5, H - 14, 11, 2, '#8a6a3a'); d.r(cx - 1, H - 12, 3, 8, '#4a3020'); d.r(cx - 2, H - 4, 5, 3, '#c8a050'); }
    if (w.cls === 'bell') { d.r(cx - 1, 14, 3, H - 16, '#5a3a22'); d.r(cx - 6, 4, 13, 10, tint); d.r(cx - 5, 5, 4, 8, '#ffffff40'); d.r(cx - 7, 13, 15, 2, '#3a3a3a'); }
    if (w.cls === 'leech') { d.r(cx - 1, 2, 3, H - 12, tint); d.p(cx, 3, '#ffffff'); d.r(cx - 2, H - 10, 5, 8, '#c8bca0'); d.r(cx - 1, 6, 1, 6, '#8a1a12'); }
    if (w.cls === 'coffin') { d.r(6, 3, W - 12, H - 6, tint); d.r(8, 5, W - 16, H - 10, '#3a2a1a'); d.r(cx - 1, 8, 3, 14, tint); d.r(cx - 5, 12, 11, 3, tint); }
    if (w.cls === 'wick') { d.r(cx, 2, 1, 14, '#6a6a6a'); d.r(cx - 6, 16, 13, 12, tint); d.r(cx - 4, 18, 9, 6, '#ff9a3a'); d.r(cx - 2, 19, 5, 3, '#ffe0a0'); d.r(cx - 7, 28, 15, 2, '#3a3020'); }
    if (w.cls === 'hunter') { d.r(4, 14, W - 8, 3, '#6a4a2a'); d.r(W - 8, 4, 3, 24, tint); d.r(W - 9, 15, 1, 1, '#ffffff'); d.r(6, 15, W - 14, 1, '#d8d0c0'); d.r(2, 12, 6, 7, '#4a3020'); }
  };
}
// armour icons: a tunic or a breastplate in the suit's colour
function drawArmour(a) {
  return (d) => {
    const c = a.col;
    d.r(9, 3, 14, 4, c); d.r(5, 6, 22, 6, c); d.r(8, 12, 16, 16, c); d.r(4, 6, 4, 12, c); d.r(24, 6, 4, 12, c);
    d.r(14, 3, 4, 5, '#1a1410'); d.r(9, 12, 14, 1, '#00000040'); d.r(10, 20, 12, 2, '#3a2a1a');
    if (a.armour >= 0.15) { d.r(10, 8, 12, 9, '#c8ccd0'); d.r(11, 9, 3, 7, '#ffffff'); }
    if (a.value >= 200) { d.r(15, 14, 2, 2, '#e0f0ff'); d.p(16, 13, '#ffffff'); }
  };
}

// Icon canvas for an item; rotated items are drawn sideways by the caller (CSS rotate)
export function itemIcon(id) {
  if (cache.has(id)) return cache.get(id);
  const def = ITEMS[id];
  const c = document.createElement('canvas');
  c.width = def.w * P; c.height = def.h * P;
  const ctx = c.getContext('2d');
  (DRAW[id] || (def.kind === 'weapon' ? drawWeapon(WEAPONS[id]) : def.kind === 'armour' ? drawArmour(ARMOURS[id]) : null) || ((d) => d.r(2, 2, 12, 12, '#888')))(painter(ctx), c.width, c.height);
  cache.set(id, c);
  return c;
}

export function itemIconURL(id) {
  const key = id + ':url';
  if (!cache.has(key)) cache.set(key, itemIcon(id).toDataURL());
  return cache.get(key);
}
