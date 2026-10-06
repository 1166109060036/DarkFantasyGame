// Doom-style status bar: stone panel along the bottom with the weapon in hand, big red health
// digits, the hero's face (bloodier as health drops, glancing around, flinching toward whoever
// hit you, grinning after a kill, panting when exhausted) and stamina.
import { rng } from './noise.js';

// 5x7 glyphs, drawn bold (each lit pixel doubled to the right) like Doom's chunky status digits
const GLYPHS = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '%': ['11000', '11001', '00010', '00100', '01000', '10011', '00011'],
};
// per-row colours: bright top, deep bottom
const PALETTES = {
  red: ['#ff6a52', '#f2402e', '#e0301f', '#cc2414', '#b31a0c', '#991206', '#7a0a02'],
  gold: ['#fff09a', '#f6d860', '#ecc443', '#dcae2c', '#c8961c', '#ac7c10', '#8a6006'],
  ember: ['#ffb070', '#ff8a40', '#f26a24', '#e05214', '#c8400a', '#a83004', '#862202'],
};

function drawNumber(ctx, text, palette) {
  const W = ctx.canvas.width;
  ctx.clearRect(0, 0, W, ctx.canvas.height);
  let x = W - text.length * 7;                       // right-aligned
  for (const ch of text) {
    const g = GLYPHS[ch];
    if (g) {
      for (const pass of [0, 1]) {
        for (let y = 0; y < 7; y++) {
          for (let i = 0; i < 5; i++) {
            if (g[y][i] !== '1') continue;
            if (pass === 0) { ctx.fillStyle = '#140604'; ctx.fillRect(x + i + 1, y + 1, 2, 1); }
            else { ctx.fillStyle = palette[y]; ctx.fillRect(x + i, y, 2, 1); }
          }
        }
      }
    }
    x += 7;
  }
}

// ---------------------------------------------------------------- the face
const SKIN = [['#d9a27a', '#b47e5a', '#8a5a3e'], ['#c7a088', '#a07c66', '#76584a']];
const r0 = rng(31337);
const STUBBLE = Array.from({ length: 26 }, () => [9 + Math.floor(r0() * 14), 22 + Math.floor(r0() * 6)]);

function drawFace(ctx, s) {
  const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
  const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const dead = s.mode === 'dead';
  const [skin, shade, deep] = SKIN[dead ? 1 : 0];
  const lx = s.look;                                      // -1 left, 0 centre, 1 right
  ctx.clearRect(0, 0, 32, 32);
  rect(0, 0, 32, 32, '#0b0c12');

  // hood
  for (let y = 0; y < 32; y++) {
    const half = Math.min(14, 6 + Math.sqrt(Math.max(0, y * 22)));
    rect(16 - half, y, half * 2, 1, y < 3 ? '#2a3456' : '#1d2542');
  }
  rect(5, 3, 1, 29, '#323c62'); rect(26, 3, 1, 29, '#121830');

  // face (an ellipse, lit from the upper left)
  const cx = 16 + lx * 0.6;
  for (let y = 6; y < 30; y++) {
    const dy = (y - 17.5) / 11.5, w = 7.6 * Math.sqrt(Math.max(0, 1 - dy * dy));
    for (let x = Math.round(cx - w); x < Math.round(cx + w); x++) {
      const k = (x - cx) / w;
      px(x, y, k > 0.55 || y > 27 ? deep : k > 0.15 ? shade : skin);
    }
  }
  // hair fringe under the hood
  for (let x = 9; x < 24; x++) px(x + (lx > 0 ? 1 : 0), 7 + (x % 3 === 0 ? 1 : 0), '#2a1a12');
  rect(9, 6, 15, 1, '#2a1a12');

  const ex = (side) => (side < 0 ? 10 : 19) + lx;        // left edge of each eye
  // brows: angry when fighting or hurt, raised when shocked
  const angry = s.mode === 'attack' || s.mode === 'hurt' || s.mode === 'grin';
  for (const side of [-1, 1]) {
    const x0 = ex(side);
    for (let i = 0; i < 4; i++) {
      const tilt = angry ? (side < 0 ? i : 3 - i) * 0.5 : s.mode === 'ouch' ? -1 : 0;
      px(x0 - 1 + i, 12 + Math.round(tilt * (angry ? 0.7 : 1)), '#2a1a12');
    }
  }
  // eyes
  for (const side of [-1, 1]) {
    const x0 = ex(side);
    if (dead) {
      px(x0, 14, '#3a1010'); px(x0 + 2, 14, '#3a1010'); px(x0 + 1, 15, '#3a1010'); px(x0, 16, '#3a1010'); px(x0 + 2, 16, '#3a1010');
      continue;
    }
    const tall = s.mode === 'ouch' ? 3 : s.tier >= 4 || s.mode === 'pant' ? 1 : 2;
    const y0 = 14 + (tall === 1 ? 1 : 0);
    rect(x0, y0, 3, tall, '#e8e4dc');
    const pupil = s.mode === 'ouch' ? 1 : 1 + lx;
    rect(x0 + pupil, y0, 1, tall, '#2c4a7a');
    if (s.tier >= 3 && side < 0) { px(x0 - 1, 13, '#5a2a46'); px(x0 + 3, 16, '#5a2a46'); rect(x0, 17, 3, 1, '#5a2a46'); }
  }
  // nose
  for (let y = 15; y < 20; y++) px(15 + lx + (y > 18 ? 1 : 0), y, deep);
  px(14 + lx, 20, deep); px(17 + lx, 20, deep);

  // stubble
  for (const [x, y] of STUBBLE) if (y > 23 || x < 11 || x > 21) px(x + lx, y, dead ? '#5e5048' : '#6e4a36');

  // mouth
  const mx = 13 + lx;
  switch (s.mode) {
    case 'grin':
      rect(mx, 22, 7, 2, '#2a0a08'); rect(mx + 1, 22, 5, 1, '#efe8da');
      px(mx - 1, 21, '#2a0a08'); px(mx + 7, 21, '#2a0a08');
      break;
    case 'attack':
      rect(mx, 22, 7, 2, '#efe8da'); rect(mx, 22, 7, 1, '#d8d0c0'); for (let i = 1; i < 7; i += 2) px(mx + i, 23, '#6a5a50');
      break;
    case 'ouch':
      rect(mx + 1, 21, 5, 4, '#2a0a08'); rect(mx + 2, 21, 3, 1, '#efe8da');
      break;
    case 'pant':
      rect(mx + 2, 22, 3, 2 + (s.blink ? 1 : 0), '#2a0a08');
      break;
    case 'dead':
      rect(mx + 1, 23, 5, 2, '#2a0a08');
      break;
    default:
      rect(mx, 23, 7, 1, '#5a2e22');
      if (s.tier >= 2) px(mx + 6, 22, '#5a2e22');
  }
  // sweat when exhausted
  if (s.mode === 'pant' || s.tired) { px(8, 11 + (s.blink ? 1 : 0), '#9fd0ff'); px(8, 12 + (s.blink ? 1 : 0), '#6fa8e0'); px(24, 13, '#9fd0ff'); }

  // wounds accumulate with damage
  const blood = '#a8120c', dark = '#6a0804';
  if (s.tier >= 1 || dead) { px(21 + lx, 18, blood); px(22 + lx, 19, blood); }
  if (s.tier >= 2 || dead) { for (let y = 8; y < 14; y++) px(12 + (y > 11 ? 1 : 0), y, y > 11 ? dark : blood); px(11, 9, blood); }
  if (s.tier >= 3 || dead) { rect(19, 9, 3, 1, blood); for (let y = 20; y < 26; y++) px(9 + (y > 23 ? 1 : 0), y, dark); }
  if (s.tier >= 4 || dead) { rect(14, 8, 2, 2, blood); for (let y = 24; y < 29; y++) px(18, y, dark); px(20, 22, blood); px(11, 18, blood); }
}

// ---------------------------------------------------------------- weapon icon
function drawSword(ctx, kingly, flash) {
  ctx.clearRect(0, 0, 48, 14);
  const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const steel = flash ? ['#ffffff', '#e8eef8', '#c0c8d8'] : kingly ? ['#d8f0ff', '#8cc8f0', '#4a7ab8'] : ['#e0e4ea', '#a8b0bc', '#6a7280'];
  // blade with a tapered tip
  px(14, 5, 28, 1, steel[0]); px(14, 6, 29, 2, steel[1]); px(14, 8, 28, 1, steel[2]);
  px(42, 6, 2, 2, steel[1]); px(44, 7, 1, 1, steel[2]);
  px(16, 7, 22, 1, kingly ? '#5aa0e0' : '#7a828e');   // fuller
  // crossguard, grip, pommel
  px(11, 2, 3, 10, '#c49a4a'); px(11, 2, 3, 1, '#ecc870'); px(11, 11, 3, 1, '#7a5a24');
  px(4, 5, 7, 4, '#5a3a24'); for (let x = 5; x < 11; x += 2) px(x, 5, 1, 4, '#3a2416');
  px(1, 4, 3, 6, '#c49a4a'); px(1, 4, 3, 1, '#ecc870');
  if (kingly) for (const [x, y] of [[20, 4], [29, 9], [37, 4]]) px(x, y, 1, 1, '#c8f0ff');
}

function stoneTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 32;
  const ctx = c.getContext('2d');
  const r = rng(777);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 128; x++) {
      const n = r();
      const v = 48 + n * 22 + (Math.sin(x * 0.21 + y * 0.13) + Math.sin(x * 0.05 - y * 0.4)) * 5;
      ctx.fillStyle = `rgb(${v | 0},${(v * 0.96) | 0},${(v * 1.02) | 0})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  for (let i = 0; i < 9; i++) {
    let x = r() * 128, y = r() * 32;
    for (let k = 0; k < 14; k++) { ctx.fillRect(x | 0, y | 0, 1, 1); x += r() * 2 - 0.5; y += r() * 2 - 1; }
  }
  ctx.fillStyle = 'rgba(70,110,60,0.35)';
  for (let i = 0; i < 40; i++) ctx.fillRect((r() * 128) | 0, (r() * 6) | 0, 1 + ((r() * 2) | 0), 1);
  return c.toDataURL();
}

// ---------------------------------------------------------------- the bar
export class DoomHud {
  constructor() {
    const ctx = (id) => { const c = document.getElementById(id).getContext('2d'); c.imageSmoothingEnabled = false; return c; };
    this.face = ctx('d-face');
    this.hp = ctx('d-hp');
    this.st = ctx('d-st');
    this.wpn = ctx('d-wpn');
    this.wpnName = document.getElementById('d-wpn-name');
    this.potions = document.getElementById('d-potions');
    this.coins = document.getElementById('d-coins');
    document.getElementById('dbar').style.backgroundImage = `url(${stoneTexture()})`;
    this.look = 0;
    this.lookT = 0;
    this.ouchT = 0;
    this.hurtT = 0;
    this.hurtSide = 0;
    this.grinT = 0;
    this.keys = {};
  }

  // side: -1 = hit from the left, 1 = from the right, 0 = head-on
  hurt(side, amount) {
    if (amount >= 16) this.ouchT = 0.7;
    this.hurtT = 1.0;
    this.hurtSide = side;
  }

  grin() { this.grinT = 1.6; }

  paint(key, value, fn) {
    if (this.keys[key] === value) return;
    this.keys[key] = value;
    fn();
  }

  update(dt, s) {
    this.ouchT -= dt; this.hurtT -= dt; this.grinT -= dt; this.lookT -= dt;
    const frac = s.hp / s.maxHp;
    const tier = frac >= 0.8 ? 0 : frac >= 0.6 ? 1 : frac >= 0.4 ? 2 : frac >= 0.2 ? 3 : 4;
    if (this.lookT <= 0) {
      // idle glancing, like the marine in the status bar
      this.look = [-1, 0, 0, 1][Math.floor(Math.random() * 4)];
      this.lookT = 0.6 + Math.random() * 1.2;
    }
    let mode = 'idle', look = this.look;
    if (s.dead) { mode = 'dead'; look = 0; }
    else if (this.ouchT > 0) { mode = 'ouch'; look = 0; }
    else if (this.hurtT > 0) { mode = 'hurt'; look = this.hurtSide; }
    else if (this.grinT > 0) { mode = 'grin'; look = 0; }
    else if (s.attacking) { mode = 'attack'; look = 0; }
    else if (s.exhausted) { mode = 'pant'; }
    const blink = s.exhausted && Math.floor(s.time * 4) % 2 === 0;
    const face = { mode, look, tier, blink, tired: s.stamina < 25 };
    this.paint('face', JSON.stringify(face), () => drawFace(this.face, face));

    const hp = Math.max(0, Math.ceil(frac * 100));
    this.paint('hp', hp, () => drawNumber(this.hp, `${hp}%`, PALETTES.red));
    const st = Math.max(0, Math.round(s.stamina));
    const stPal = s.exhausted ? (Math.floor(s.time * 3) % 2 ? 'ember' : 'red') : st < 30 ? 'ember' : 'gold';
    this.paint('st', `${st}|${stPal}`, () => drawNumber(this.st, `${st}%`, PALETTES[stPal]));

    const kingly = s.swordMul > 1;
    this.paint('wpn', `${kingly}|${s.attacking}`, () => drawSword(this.wpn, kingly, s.attacking));
    const wname = `${kingly ? 'ดาบแห่งราชาหิน' : 'ดาบเก่า'}${s.swordLv ? ` +${s.swordLv}` : ''} ×${(s.damageMul ?? s.swordMul).toFixed(1)}`;
    this.paint('wname', wname, () => { this.wpnName.textContent = wname; });
    this.paint('items', `${s.potions}|${s.coins}`, () => { this.potions.textContent = s.potions; this.coins.textContent = s.coins; });
  }
}
