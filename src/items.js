// Every item in the game: its footprint in the bag grid (w x h cells, Resident Evil 4 style),
// how many fit in one stack, what it sells for, and a procedurally painted pixel-art icon.

export const ITEMS = {
  // consumables (one per slot, like RE4 sprays)
  potion: { name: 'ยาฟื้นพลัง', desc: 'ฟื้นเลือด 50', w: 1, h: 2, stack: 1, kind: 'use', value: 4, heal: 50 },
  potion_big: { name: 'ยาฟื้นพลังใหญ่', desc: 'ฟื้นเลือดเต็มหลอด', w: 1, h: 2, stack: 1, kind: 'use', value: 10, heal: 999 },
  tonic: { name: 'ยาบำรุงแรง', desc: '90 วินาที: แรงฟื้นเร็ว ×2 ใช้แรงน้อยลงครึ่งหนึ่ง', w: 1, h: 2, stack: 1, kind: 'use', value: 8, buff: ['tonic', 90] },
  oil: { name: 'น้ำมันดาบเรืองแสง', desc: '90 วินาที: ดาบแรงขึ้น ×1.5', w: 1, h: 2, stack: 1, kind: 'use', value: 10, buff: ['oil', 90] },
  sight: { name: 'ยาตาแมว', desc: '180 วินาที: มองเห็นในความมืดชัดขึ้น', w: 1, h: 2, stack: 1, kind: 'use', value: 8, buff: ['sight', 180] },
  // materials
  moon_herb: { name: 'หญ้าจันทร์', desc: 'สมุนไพรใบเงินที่ขึ้นใต้แสงจันทร์ ใช้ปรุงยา', w: 1, h: 1, stack: 5, kind: 'mat', value: 2 },
  mushroom: { name: 'เห็ดเรืองแสง', desc: 'เห็ดสีฟ้าจากป่าและบึง ใช้ปรุงยาและอัปเกรดตะเกียง', w: 1, h: 1, stack: 5, kind: 'mat', value: 2 },
  straw: { name: 'ฟางสาป', desc: 'ฟางจากหุ่นฟางคลั่ง เหนียวผิดธรรมชาติ', w: 2, h: 1, stack: 5, kind: 'mat', value: 2 },
  fang: { name: 'เขี้ยวหมาป่าเงา', desc: 'เขี้ยวดำคม ช่างตีเหล็กใช้ชุบดาบ', w: 1, h: 1, stack: 10, kind: 'mat', value: 3 },
  slime: { name: 'เมือกปลิงยักษ์', desc: 'เมือกเหนียวกันน้ำ ใช้ปรุงยาและเคลือบผ้าคลุม', w: 1, h: 1, stack: 5, kind: 'mat', value: 3 },
  essence: { name: 'แก่นวิญญาณ', desc: 'ประกายจากวิญญาณบึง อุ่นเหมือนมีชีวิต', w: 1, h: 1, stack: 5, kind: 'mat', value: 4 },
  ore: { name: 'แร่เหล็กมืด', desc: 'แร่หนักจากหน้าผาทางเหนือ ใช้ตีอาวุธ', w: 2, h: 1, stack: 3, kind: 'mat', value: 6 },
  claw: { name: 'กรงเล็บซีด', desc: 'เล็บยาวจากร่างซูบ แข็งเหมือนกระดูก ช่างตีเหล็กใช้ทำคมดาบ', w: 1, h: 1, stack: 10, kind: 'mat', value: 3 },
  leech_live: { name: 'ปลิงดูดเลือด', desc: 'ปลิงหิวเลือดในขวดโหล หมอปลิงปาใส่ศัตรูได้ (กดค้างแล้วปล่อย)', w: 1, h: 1, stack: 6, kind: 'mat', value: 2 },
  knight_core: { name: 'แกนหินอัศวิน', desc: 'หัวใจหินที่ยังเต้นอยู่ ช่างตีเหล็กใช้ตีดาบขั้นสุดท้าย', w: 2, h: 2, stack: 1, kind: 'mat', value: 40 },
  // treasures: worthless to you, valuable to the innkeeper
  moonstone: { name: 'มูนสโตน', desc: 'สมบัติ · ขายได้ที่โรงเตี๊ยม (ช่างตีเหล็กใช้ทำตะเกียงได้)', w: 1, h: 1, stack: 1, kind: 'treasure', value: 22 },
  pearl: { name: 'ไข่มุกบึง', desc: 'สมบัติ · ไข่มุกสีดำจากท้องปลิง', w: 1, h: 1, stack: 1, kind: 'treasure', value: 25 },
  token: { name: 'เหรียญรถไฟเก่า', desc: 'สมบัติ · ตั๋วโลหะจากยุคที่รถไฟยังวิ่ง', w: 1, h: 1, stack: 3, kind: 'treasure', value: 12 },
  watch: { name: 'นาฬิกาพกพนักงานรถไฟ', desc: 'สมบัติ · เข็มหยุดเดินตอนเที่ยงคืน', w: 1, h: 1, stack: 1, kind: 'treasure', value: 35 },
  candlestick: { name: 'เชิงเทียนเงิน', desc: 'สมบัติ · เทียนหลอมจะชอบมันมาก', w: 1, h: 2, stack: 1, kind: 'treasure', value: 40 },
  locket: { name: 'จี้รูปถ่ายเก่า', desc: 'สมบัติ · ในจี้มีรูปผู้หญิงยิ้มอยู่ เธอเคยเป็นคนของหมู่บ้านนี้', w: 1, h: 1, stack: 1, kind: 'treasure', value: 45 },
  pale_heart: { name: 'หัวใจซีด', desc: 'สมบัติ · หัวใจของร่างซูบยักษ์ ยังอุ่นอยู่เลย ใครบางคนในโรงเตี๊ยมยอมจ่ายแพง', w: 1, h: 2, stack: 1, kind: 'treasure', value: 60 },
  star_shard: { name: 'เศษดาวตก', desc: 'สมบัติ · หินร้อนที่ยังเรืองแสงอยู่ พ่อค้าเร่ให้ราคาดีมาก', w: 1, h: 1, stack: 3, kind: 'treasure', value: 45 },
  blood_amber: { name: 'อำพันเลือด', desc: 'สมบัติ · เลือดของร่างซีดที่แข็งตัวใต้จันทร์เลือด อุ่นเหมือนยังเต้นอยู่', w: 1, h: 1, stack: 5, kind: 'treasure', value: 20 },
  idol: { name: 'รูปเคารพราชาหิน', desc: 'สมบัติ · รูปปั้นทองคำขนาดฝ่ามือ', w: 2, h: 2, stack: 1, kind: 'treasure', value: 85 },
};

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
  idol: (d) => {
    d.r(10, 4, 12, 10, '#d8a830'); d.r(8, 2, 16, 3, '#f0c850'); for (let i = 0; i < 5; i++) d.r(8 + i * 4, 0, 2, 3, '#f0c850');
    d.r(12, 7, 3, 2, '#7a5a10'); d.r(18, 7, 3, 2, '#7a5a10'); d.r(15, 9, 2, 3, '#a87a18'); d.r(13, 12, 6, 1, '#7a5a10');
    d.r(9, 14, 14, 12, '#c89820'); d.r(6, 26, 20, 4, '#a87a18'); d.r(11, 16, 2, 6, '#f0c850');
  },
};

// Icon canvas for an item; rotated items are drawn sideways by the caller (CSS rotate)
export function itemIcon(id) {
  if (cache.has(id)) return cache.get(id);
  const def = ITEMS[id];
  const c = document.createElement('canvas');
  c.width = def.w * P; c.height = def.h * P;
  const ctx = c.getContext('2d');
  (DRAW[id] || ((d) => d.r(2, 2, 12, 12, '#888')))(painter(ctx), c.width, c.height);
  cache.set(id, c);
  return c;
}

export function itemIconURL(id) {
  const key = id + ':url';
  if (!cache.has(key)) cache.set(key, itemIcon(id).toDataURL());
  return cache.get(key);
}
