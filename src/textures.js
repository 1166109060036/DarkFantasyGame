// All textures are painted procedurally at PS2-era resolutions (32-128px) - no image assets needed.
import * as THREE from 'three';
import { tileFbm, rng } from './noise.js';
import { smoothstep } from './util.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function toTex(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function pixels(w, h, fn) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const p = fn(x / w, y / h, x, y);
      d[o] = p[0] * 255; d[o + 1] = p[1] * 255; d[o + 2] = p[2] * 255;
      d[o + 3] = (p[3] ?? 1) * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];

function stone() {
  return toTex(pixels(128, 128, (u, v, x, y) => {
    const row = Math.floor(y / 32);
    const off = (row % 2) * 32;
    const bx = (x + off) % 64, by = y % 32;
    const edge = Math.min(bx, 63 - bx, by, 31 - by);
    const id = (Math.floor((x + off) / 64) % 2) + row * 2;
    const n = tileFbm(u, v, 8, 8, 4, 3);
    const n2 = tileFbm(u, v, 16, 16, 3, 9);
    const m = tileFbm(u, v, 4, 4, 4, 17 + id);
    let c = mul([0.42, 0.45, 0.47], 0.62 + n * 0.6 + (id % 3) * 0.05);
    const mossAmt = smoothstep(0.48, 0.62, m + (1 - by / 32) * 0.12);
    c = mix(c, mul([0.17, 0.36, 0.13], 0.7 + n2 * 0.7), mossAmt);
    c = mix([0.07, 0.09, 0.07], c, smoothstep(0, 2.5, edge));
    return c;
  }));
}

function bark() {
  return toTex(pixels(64, 128, (u, v) => {
    const n = tileFbm(u, v, 16, 2, 4, 5);
    const n2 = tileFbm(u, v, 4, 4, 3, 8);
    let c = mul([0.24, 0.22, 0.2], 0.55 + n * 0.8);
    c = mix(c, [0.12, 0.24, 0.1], smoothstep(0.55, 0.7, n2) * 0.8);
    return c;
  }));
}

function wood() {
  return toTex(pixels(64, 64, (u, v, x) => {
    const n = tileFbm(u, v, 2, 16, 4, 12);
    const plank = x % 32 < 1 ? 0.5 : 1;
    let c = mul([0.36, 0.36, 0.32], (0.55 + n * 0.75) * plank);
    c = mix(c, [0.16, 0.3, 0.14], smoothstep(0.62, 0.75, tileFbm(u, v, 4, 4, 3, 2)) * 0.7);
    return c;
  }));
}

function metal() {
  return toTex(pixels(32, 32, (u, v) => {
    const n = tileFbm(u, v, 4, 4, 4, 41);
    return mix([0.32, 0.33, 0.36], [0.3, 0.2, 0.14], smoothstep(0.4, 0.7, n));
  }));
}

function detail() {
  return toTex(pixels(128, 128, (u, v) => {
    const n = tileFbm(u, v, 8, 8, 5, 77);
    const n2 = tileFbm(u, v, 32, 32, 2, 78);
    const g = 0.55 + n * 0.5 + (n2 - 0.5) * 0.25;
    return [g * 0.95, g, g * 0.92];
  }));
}

function wool() {
  return toTex(pixels(64, 64, (u, v) => {
    const n = tileFbm(u, v, 16, 16, 3, 51);
    const g = 0.45 + Math.pow(n, 1.5) * 0.9;
    return [g, g, g * 1.05];
  }));
}

function cloth() {
  return toTex(pixels(64, 64, (u, v, x, y) => {
    const weave = ((x + y) % 2) * 0.08 + 0.92;
    const n = tileFbm(u, v, 8, 8, 3, 61);
    let c = mul([0.16, 0.19, 0.42], (0.7 + n * 0.5) * weave);
    const band = v > 0.72 && v < 0.94;
    if (band) c = mul(((y >> 2) % 2 ? [0.42, 0.12, 0.14] : [0.24, 0.12, 0.3]), (0.8 + n * 0.3) * weave);
    return c;
  }));
}

function plainCloth() {
  return toTex(pixels(64, 64, (u, v, x, y) => {
    const weave = ((x + y) % 2) * 0.08 + 0.92;
    const n = tileFbm(u, v, 8, 8, 3, 63);
    const g = (0.65 + n * 0.55) * weave;
    return [g, g, g];
  }));
}

function toadSkin() {
  return toTex(pixels(64, 64, (u, v) => {
    const n = tileFbm(u, v, 8, 8, 4, 71);
    const w = tileFbm(u, v, 16, 16, 2, 72);
    let c = mul([0.36, 0.33, 0.24], 0.6 + n * 0.6);
    c = mix(c, [0.13, 0.12, 0.08], smoothstep(0.58, 0.68, n));
    c = mix(c, [0.55, 0.5, 0.38], smoothstep(0.66, 0.74, w));
    return c;
  }));
}

function feather() {
  return toTex(pixels(64, 64, (u, v, x, y) => {
    const n = tileFbm(u, v, 4, 16, 4, 81);
    const scale = Math.abs(Math.sin((x * 0.4 + ((y >> 3) % 2) * 2) )) * 0.25;
    const g = 0.45 + n * 0.6 + scale;
    return [g * 0.8, g * 0.85, g];
  }));
}

function mushroomCap() {
  const c = pixels(128, 64, (u, v) => {
    const n = tileFbm(u, v, 8, 4, 4, 91);
    let col = mul([0.5, 0.14, 0.1], 0.6 + n * 0.6);
    col = mix(col, [0.2, 0.08, 0.06], smoothstep(0.7, 1.0, v));
    return col;
  });
  const ctx = c.getContext('2d');
  const r = rng(91);
  for (let i = 0; i < 70; i++) {
    const x = r() * 128, y = 4 + r() * 50, s = 1 + r() * 3.5;
    ctx.fillStyle = `rgba(${200 + r() * 40 | 0},${190 + r() * 40 | 0},${200 + r() * 40 | 0},${0.6 + r() * 0.4})`;
    ctx.beginPath(); ctx.ellipse(x, y, s * 1.3, s, 0, 0, Math.PI * 2); ctx.fill();
  }
  return toTex(c);
}

function leaves() {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  const r = rng(5);
  for (let i = 0; i < 320; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 58;
    const x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d * 0.85;
    const g = 0.25 + r() * 0.6;
    ctx.fillStyle = `rgb(${18 + g * 35 | 0},${50 + g * 95 | 0},${30 + g * 45 | 0})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 3 + r() * 5, 2 + r() * 3, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTex(c, false);
}

function fern() {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  const r = rng(7);
  const fronds = 9;
  for (let f = 0; f < fronds; f++) {
    const ang = -1.25 + (2.5 * f) / (fronds - 1) + (r() - 0.5) * 0.15;
    const len = 52 + r() * 12;
    const g = 0.6 + r() * 0.4;
    ctx.strokeStyle = `rgb(${30 * g | 0},${95 * g | 0},${40 * g | 0})`;
    ctx.fillStyle = ctx.strokeStyle;
    let x = 64, y = 127, a = ang;
    const steps = 22;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const nx = x + Math.sin(a) * len / steps, ny = y - Math.cos(a) * len / steps;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke();
      const leaf = (1 - t) * 9 + 1.5;
      for (const side of [-1, 1]) {
        const la = a + side * 1.2;
        ctx.beginPath();
        ctx.moveTo(nx, ny);
        ctx.lineTo(nx + Math.sin(la) * leaf, ny - Math.cos(la) * leaf);
        ctx.lineTo(nx + Math.sin(a) * 2, ny - Math.cos(a) * 2);
        ctx.fill();
      }
      x = nx; y = ny;
      a += Math.sign(ang || 1) * 0.035 + (r() - 0.5) * 0.05;
    }
  }
  return toTex(c, false);
}

function grass() {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d');
  const r = rng(11);
  for (let i = 0; i < 26; i++) {
    const x = 4 + r() * 56, h = 28 + r() * 35, lean = (r() - 0.5) * 18, w = 1.5 + r() * 2;
    const grad = ctx.createLinearGradient(0, 64, 0, 64 - h);
    const g = 0.6 + r() * 0.5;
    grad.addColorStop(0, `rgb(${12 * g | 0},${40 * g | 0},${22 * g | 0})`);
    grad.addColorStop(1, `rgb(${70 * g | 0},${130 * g | 0},${80 * g | 0})`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x - w, 64); ctx.lineTo(x + w, 64); ctx.lineTo(x + lean, 64 - h);
    ctx.fill();
  }
  return toTex(c, false);
}

function hangingMoss() {
  const c = makeCanvas(64, 128);
  const ctx = c.getContext('2d');
  const r = rng(13);
  for (let i = 0; i < 40; i++) {
    const x0 = r() * 64, len = 40 + r() * 86;
    const g = 0.5 + r() * 0.5;
    ctx.strokeStyle = `rgba(${70 * g | 0},${95 * g | 0},${80 * g | 0},1)`;
    ctx.lineWidth = 1 + r() * 2;
    ctx.beginPath(); ctx.moveTo(x0, 0);
    for (let y = 0; y < len; y += 8) ctx.lineTo(x0 + Math.sin(y * 0.15 + i) * 3, y);
    ctx.stroke();
  }
  return toTex(c, false);
}

function radial(size, stops) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTex(c, false);
}

function gold() {
  return toTex(pixels(32, 32, (u, v) => {
    const n = tileFbm(u, v, 8, 8, 2, 99);
    return mul([1.0, 0.75, 0.2], 0.6 + n * 0.6);
  }));
}

function rock() {
  return toTex(pixels(128, 128, (u, v) => {
    const n = tileFbm(u, v, 4, 4, 5, 201);
    const n2 = tileFbm(u, v, 16, 16, 3, 202);
    const crack = Math.abs(tileFbm(u, v, 6, 6, 3, 203) - 0.5) < 0.018 ? 0.35 : 1;
    let c = mul([0.5, 0.53, 0.6], (0.5 + n * 0.75) * crack);
    c = mix(c, [0.2, 0.38, 0.16], smoothstep(0.58, 0.72, n2) * 0.55);
    return c;
  }));
}

function galaxy() {
  return toTex(pixels(64, 48, (u, v) => {
    const x = u - 0.5, y = (v - 0.5) * 0.75;
    const r = Math.hypot(x, y), a = Math.atan2(y, x);
    const arm = 0.5 + 0.5 * Math.sin(a * 2 + Math.log(r + 0.02) * 6);
    const n = tileFbm(u, v, 8, 6, 3, 123);
    const k = Math.max(0, 1 - r * 2.2) * (0.35 + arm * 0.65) * (0.6 + n * 0.8);
    return [0.05 + k * 0.75, 0.03 + k * 0.35, 0.12 + k * 1.1];
  }), false);
}

function sign() {
  const c = makeCanvas(64, 32);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3a2c20'; ctx.fillRect(0, 0, 64, 32);
  ctx.strokeStyle = '#1a120c'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, 62, 30);
  ctx.fillStyle = '#d8cfb8'; ctx.fillRect(28, 12, 8, 15);
  ctx.fillStyle = '#ffb040'; ctx.beginPath(); ctx.ellipse(32, 8, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d8cfb8'; ctx.fillRect(16, 16, 6, 11); ctx.fillRect(42, 16, 6, 11);
  ctx.fillStyle = '#ffb040';
  for (const x of [19, 45]) { ctx.beginPath(); ctx.ellipse(x, 13, 2, 3.5, 0, 0, Math.PI * 2); ctx.fill(); }
  return toTex(c, false);
}

export function createTextures() {
  return {
    stone: stone(),
    bark: bark(),
    wood: wood(),
    metal: metal(),
    detail: detail(),
    wool: wool(),
    cloth: cloth(),
    plainCloth: plainCloth(),
    toadSkin: toadSkin(),
    feather: feather(),
    mushroomCap: mushroomCap(),
    leaves: leaves(),
    fern: fern(),
    grass: grass(),
    hangingMoss: hangingMoss(),
    gold: gold(),
    galaxy: galaxy(),
    rock: rock(),
    sign: sign(),
    shadow: radial(64, [[0, 'rgba(0,0,0,0.75)'], [0.6, 'rgba(0,0,0,0.35)'], [1, 'rgba(0,0,0,0)']]),
    glow: radial(64, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]),
  };
}

