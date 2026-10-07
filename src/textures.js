// All textures are painted procedurally (64-256px, the sizes late PS2 games used for close-up
// surfaces) - no image assets needed. Light is baked into the paint the way PS2 artists did it:
// lit top edges, shadowed joints, stains running down.
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

// tileable cellular noise: distance to the nearest and second-nearest feature point, and the
// nearest cell's id (0..1) - stones, warts, pebbles, chips
function hash3(x, y, s) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function worley(u, v, n, seed = 0) {
  const x = u * n, y = v * n, cx = Math.floor(x), cy = Math.floor(y);
  let f1 = 9, f2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const gx = cx + i, gy = cy + j, wx = ((gx % n) + n) % n, wy = ((gy % n) + n) % n;
      const px = gx + hash3(wx, wy, seed), py = gy + hash3(wx, wy, seed + 7);
      const d = Math.hypot(px - x, py - y);
      if (d < f1) { f2 = f1; f1 = d; id = hash3(wx, wy, seed + 13); } else if (d < f2) f2 = d;
    }
  }
  return [f1, f2, id];
}
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// cut stone: courses of blocks of uneven length, each with its own tone, a lit top edge and a
// shadowed bottom one, chips and cracks; moss lives in the joints and creeps up from the bottom,
// rain stains run down
function stone() {
  const S = 256, rows = 6;
  const r = rng(301);
  // course heights and block breaks, fixed per course so the pattern tiles
  const courses = [], breaks = [];
  let acc = 0;
  for (let i = 0; i < rows; i++) { const h = 0.7 + r() * 0.6; courses.push(h); acc += h; }
  let y0 = 0;
  const rowStart = courses.map((h) => { const s0 = y0; y0 += h / acc * S; return s0; });
  for (let i = 0; i < rows; i++) {
    const b = [], off = r() * S;
    let x = 0;
    while (x < S - 30) { b.push((x + off) % S); x += 34 + r() * 46; }
    breaks.push(b.sort((a, c) => a - c));
  }
  return toTex(pixels(S, S, (u, v, x, y) => {
    let ri = rows - 1;
    while (ri > 0 && y < rowStart[ri]) ri--;
    const top = rowStart[ri], bot = ri + 1 < rows ? rowStart[ri + 1] : S, h = bot - top;
    const bs = breaks[ri];
    let left = bs[bs.length - 1] - S, right = bs[0], bi = 0;
    for (let k = 0; k < bs.length; k++) { if (x >= bs[k]) { left = bs[k]; right = k + 1 < bs.length ? bs[k + 1] : bs[0] + S; bi = k; } }
    const id = hash3(ri, bi, 5);
    const ex = Math.min(x - left, right - x), ey = Math.min(y - top, bot - y);
    const edge = Math.min(ex, ey);
    const n = tileFbm(u, v, 8, 8, 4, 3), n2 = tileFbm(u, v, 32, 32, 2, 9), grain = tileFbm(u, v, 64, 64, 1, 11);
    // the block's own stone: a little warm or cold, light or dark
    let c = mul(mix([0.44, 0.46, 0.5], [0.5, 0.46, 0.4], id), 0.74 + n * 0.5 + (id - 0.5) * 0.22 + (grain - 0.5) * 0.12);
    // baked light: the top lip catches it, the bottom sits in shadow, corners are rounded off
    const fy = (y - top) / h;
    c = mul(c, 1 + smoothstep(4, 0, y - top) * 0.28 - smoothstep(0.55, 1, fy) * 0.18 - smoothstep(4, 0, x - left) * 0.08 + smoothstep(4, 0, right - x) * 0.06);
    // chips and pits
    const [w1, w2] = worley(u, v, 24, 17);
    if (w2 - w1 < 0.05 && n2 > 0.55) c = mul(c, 0.7);
    if (w1 < 0.12 && n2 > 0.62) c = mul(c, 0.78 + w1 * 1.5);
    // hairline cracks
    const cr = Math.abs(tileFbm(u, v, 6, 6, 3, 23 + ri) - 0.5);
    if (cr < 0.012 && edge > 4) c = mul(c, 0.45);
    // rain stains running down from the joints
    c = mul(c, 1 - smoothstep(0.55, 0.8, tileFbm(u, v, 24, 3, 3, 29)) * 0.22);
    // moss: in the joints, at the foot of each block, in damp patches
    const damp = tileFbm(u, v, 4, 4, 4, 31);
    const moss = clamp01(smoothstep(0.56, 0.74, damp + fy * 0.22 + smoothstep(5, 1, edge) * 0.3) * (0.6 + n2 * 0.6));
    c = mix(c, mul([0.2, 0.4, 0.14], 0.7 + n2 * 0.8 + grain * 0.2), moss * 0.75);
    // the joints themselves
    c = mix([0.06, 0.07, 0.06], c, smoothstep(0.6, 2.6, edge));
    return c;
  }));
}

// bark: deep vertical furrows between plated ridges, lichen in flecks
function bark() {
  return toTex(pixels(128, 256, (u, v) => {
    const warp = tileFbm(u, v, 4, 2, 3, 4) * 0.15;
    const ridge = Math.abs(Math.sin((u + warp) * Math.PI * 9 + tileFbm(u, v, 3, 6, 3, 6) * 4));
    const plates = tileFbm(u, v, 12, 6, 3, 5);
    let c = mul([0.27, 0.24, 0.21], 0.4 + ridge * 0.55 + plates * 0.45);
    c = mul(c, 1 - smoothstep(0.25, 0.05, ridge) * 0.55);           // furrow shadows
    const li = tileFbm(u, v, 16, 16, 3, 8);
    c = mix(c, [0.45, 0.52, 0.38], smoothstep(0.66, 0.74, li) * 0.7 * ridge);
    c = mix(c, [0.12, 0.26, 0.1], smoothstep(0.58, 0.7, tileFbm(u, v, 4, 4, 3, 9)) * 0.7);
    return c;
  }));
}

// planks: wavy grain, darker seams, knots, a nail at each end
function wood() {
  const S = 128, planks = 4, r = rng(12);
  const knots = Array.from({ length: 5 }, () => [r(), r(), 0.02 + r() * 0.03]);
  return toTex(pixels(S, S, (u, v, x) => {
    const pl = Math.floor(u * planks), pu = u * planks - pl, tone = hash3(pl, 0, 3);
    let gx = pu + tileFbm(u, v, 2, 4, 3, 13) * 0.25;
    for (const [kx, ky, kr] of knots) {
      const dx = (u - kx) * 3, dy = v - ky, d = Math.hypot(dx, dy);
      if (d < kr * 3) gx += (kr * 3 - d) * 3 * Math.sign(dx || 1);
    }
    const grain = 0.5 + 0.5 * Math.sin(gx * 46 + v * 2);
    const fine = tileFbm(u, v, 4, 32, 2, 14);
    let c = mul([0.42, 0.34, 0.25], (0.55 + tone * 0.25 + grain * 0.22 + fine * 0.3));
    for (const [kx, ky, kr] of knots) { const d = Math.hypot((u - kx) * 3, v - ky); if (d < kr) c = mul(c, 0.45 + d / kr * 0.4); }
    // weathered grey toward the ends, green where it stays wet
    c = mix(c, [0.36, 0.36, 0.34], smoothstep(0.55, 0.8, tileFbm(u, v, 3, 3, 3, 15)) * 0.5);
    c = mix(c, [0.16, 0.3, 0.14], smoothstep(0.64, 0.78, tileFbm(u, v, 4, 4, 3, 2)) * 0.6);
    // seams and nails
    if (pu < 0.025 || pu > 0.975) c = mul(c, 0.35);
    const ny = Math.min(Math.abs(v - 0.08), Math.abs(v - 0.92));
    if (Math.hypot((pu - 0.5) * S / planks, ny * S) < 2.2) c = [0.22, 0.2, 0.2];
    return c;
  }));
}

// iron: hammered, scratched, rusting from the rivets down
function metal() {
  return toTex(pixels(64, 64, (u, v, x, y) => {
    const [w1] = worley(u, v, 6, 41);
    const ham = 0.85 + w1 * 0.3;
    const n = tileFbm(u, v, 4, 4, 4, 41);
    let c = mul([0.36, 0.37, 0.4], ham * (0.75 + n * 0.4));
    const scratch = Math.abs(Math.sin(u * 40 + v * 9 + tileFbm(u, v, 2, 2, 2, 43) * 6));
    if (scratch > 0.985) c = mul(c, 1.35);
    // a little rust in patches (blades and buckles share this iron, so it stays mostly steel)
    const rust = smoothstep(0.62, 0.85, tileFbm(u, v, 4, 2, 4, 44) + v * 0.12);
    c = mix(c, mul([0.42, 0.24, 0.14], 0.7 + n * 0.5), rust * 0.4);
    const rx = x % 32, ry = y % 32;
    const rv = Math.hypot(rx - 4, ry - 4);
    if (rv < 2.6) c = mul([0.45, 0.45, 0.48], 1.2 - rv * 0.2);
    return c;
  }));
}

// the ground's detail map (multiplied over the painted terrain): soil, pebbles, cracks, little
// tufts and the odd puddle-dark patch
function detail() {
  return toTex(pixels(256, 256, (u, v) => {
    const n = tileFbm(u, v, 8, 8, 5, 77), n2 = tileFbm(u, v, 32, 32, 2, 78), n3 = tileFbm(u, v, 64, 64, 1, 79);
    let g = 0.6 + n * 0.42 + (n2 - 0.5) * 0.22 + (n3 - 0.5) * 0.14;
    const [p1, p2, pid] = worley(u, v, 22, 80);
    if (p1 < 0.26 && pid > 0.55) g *= p1 < 0.2 ? 1.12 + (0.2 - p1) : 0.72;            // pebbles with a shadow rim
    const cr = Math.abs(tileFbm(u, v, 5, 5, 3, 81) - 0.5);
    if (cr < 0.01) g *= 0.7;
    const tuft = smoothstep(0.62, 0.72, tileFbm(u, v, 12, 12, 3, 82)) * (n3 > 0.5 ? 1 : 0.6);
    g *= 1 + tuft * 0.18;
    g *= 1 - smoothstep(0.62, 0.78, tileFbm(u, v, 3, 3, 3, 83)) * 0.2;
    return [g * 0.96, g, g * 0.92];
  }));
}

// wool: tight curls
function wool() {
  return toTex(pixels(128, 128, (u, v) => {
    const [w1, w2] = worley(u, v, 18, 51);
    const curl = smoothstep(0, 0.5, w1) * 0.6 + smoothstep(0.02, 0.12, w2 - w1) * 0.4;
    const n = tileFbm(u, v, 16, 16, 3, 51);
    const g = 0.35 + curl * 0.55 + n * 0.35;
    return [g, g, g * 1.05];
  }));
}

// woven cloth: a twill weave, a hem band, a stitched seam, soft folds and old stains
function weave(x, y) { return (((x + (y >> 1)) >> 1) % 2) * 0.1 + 0.9; }
function cloth() {
  return toTex(pixels(128, 128, (u, v, x, y) => {
    const n = tileFbm(u, v, 8, 8, 3, 61);
    const fold = 0.88 + 0.12 * Math.sin(u * Math.PI * 6 + tileFbm(u, v, 2, 2, 3, 62) * 5);
    let c = mul([0.16, 0.19, 0.42], (0.7 + n * 0.5) * weave(x, y) * fold);
    if (v > 0.72 && v < 0.94) c = mul(((y >> 2) % 2 ? [0.42, 0.12, 0.14] : [0.24, 0.12, 0.3]), (0.8 + n * 0.3) * weave(x, y));
    if (Math.abs(v - 0.7) < 0.006 && x % 6 < 3) c = [0.6, 0.55, 0.4];
    c = mul(c, 1 - smoothstep(0.62, 0.78, tileFbm(u, v, 4, 4, 3, 64)) * 0.25);
    return c;
  }));
}

function plainCloth() {
  return toTex(pixels(128, 128, (u, v, x, y) => {
    const n = tileFbm(u, v, 8, 8, 3, 63);
    const fold = 0.9 + 0.1 * Math.sin(v * Math.PI * 5 + tileFbm(u, v, 2, 2, 3, 65) * 6);
    let g = (0.66 + n * 0.5) * weave(x, y) * fold;
    if (Math.abs(u - 0.5) < 0.008 && y % 6 < 3) g *= 0.6;                                  // a seam
    g *= 1 - smoothstep(0.64, 0.8, tileFbm(u, v, 4, 4, 3, 66)) * 0.22;                    // stains
    if (tileFbm(u, v, 16, 16, 2, 67) > 0.74) g *= 1.12;                                    // worn shiny spots
    return [g, g, g];
  }));
}

// toad skin: warts with a lit top and a dark ring, mottled blotches
function toadSkin() {
  return toTex(pixels(128, 128, (u, v) => {
    const n = tileFbm(u, v, 8, 8, 4, 71);
    let c = mul([0.36, 0.33, 0.24], 0.6 + n * 0.6);
    c = mix(c, [0.13, 0.12, 0.08], smoothstep(0.58, 0.68, n));
    const [w1, , wid] = worley(u, v, 14, 72);
    if (wid > 0.4) {
      const r0 = 0.22 + wid * 0.12;
      if (w1 < r0) c = mix(c, [0.62, 0.56, 0.42], (1 - w1 / r0) * 0.8);
      else if (w1 < r0 + 0.06) c = mul(c, 0.7);
    }
    return c;
  }));
}

// feathers: overlapping rows of vanes with a dark shaft
function feather() {
  return toTex(pixels(128, 128, (u, v) => {
    const row = Math.floor(v * 8), fu = (u * 6 + (row % 2) * 0.5) % 1, fv = (v * 8) % 1;
    const shaft = Math.abs(fu - 0.5);
    const barb = 0.5 + 0.5 * Math.sin((fv + shaft * 0.8) * 50);
    const edge = smoothstep(0.85, 0.6, fv + shaft * 0.6);
    const n = tileFbm(u, v, 4, 16, 4, 81);
    let g = (0.4 + n * 0.45 + barb * 0.18) * (0.65 + edge * 0.45);
    if (shaft < 0.025) g *= 0.6;
    return [g * 0.8, g * 0.86, g];
  }));
}

function mushroomCap() {
  const c = pixels(256, 128, (u, v) => {
    const n = tileFbm(u, v, 8, 4, 4, 91), streak = tileFbm(u, v, 32, 2, 2, 92);
    let col = mul([0.5, 0.14, 0.1], 0.6 + n * 0.5 + streak * 0.2);
    col = mix(col, [0.2, 0.08, 0.06], smoothstep(0.7, 1.0, v));
    return col;
  });
  const ctx = c.getContext('2d');
  const r = rng(91);
  for (let i = 0; i < 120; i++) {
    const x = r() * 256, y = 8 + r() * 100, s = 2 + r() * 6;
    ctx.fillStyle = 'rgba(40,10,8,0.35)';
    ctx.beginPath(); ctx.ellipse(x + 1, y + 1.5, s * 1.3, s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(${200 + r() * 40 | 0},${190 + r() * 40 | 0},${200 + r() * 40 | 0},${0.6 + r() * 0.4})`;
    ctx.beginPath(); ctx.ellipse(x, y, s * 1.3, s, 0, 0, Math.PI * 2); ctx.fill();
  }
  return toTex(c);
}

// a clump of leaves: each one a pointed oval with a lit side, a dark side and a midrib
function leaves() {
  const S = 256, c = makeCanvas(S, S), ctx = c.getContext('2d'), r = rng(5);
  for (let i = 0; i < 520; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 116;
    const x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d * 0.85;
    const lit = 0.25 + r() * 0.5 + (1 - (y / S)) * 0.25, len = 7 + r() * 9, wid = 3 + r() * 3, rot = r() * Math.PI;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = `rgb(${14 + lit * 30 | 0},${40 + lit * 95 | 0},${24 + lit * 40 | 0})`;
    ctx.beginPath(); ctx.moveTo(-len, 0); ctx.quadraticCurveTo(0, -wid * 1.6, len, 0); ctx.quadraticCurveTo(0, wid * 1.6, -len, 0); ctx.fill();
    ctx.fillStyle = `rgba(${40 + lit * 50 | 0},${90 + lit * 110 | 0},${50 + lit * 50 | 0},0.7)`;
    ctx.beginPath(); ctx.moveTo(-len, 0); ctx.quadraticCurveTo(0, -wid * 1.6, len, 0); ctx.quadraticCurveTo(0, -wid * 0.3, -len, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(10,30,14,0.6)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-len * 0.9, 0); ctx.lineTo(len * 0.9, 0); ctx.stroke();
    ctx.restore();
  }
  return toTex(c, false);
}

function fern() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);
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
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke();
      const leaf = (1 - t) * 9 + 1.5;
      for (const side of [-1, 1]) {
        const la = a + side * 1.2;
        ctx.beginPath();
        ctx.moveTo(nx, ny);
        ctx.lineTo(nx + Math.sin(la) * leaf, ny - Math.cos(la) * leaf);
        ctx.lineTo(nx + Math.sin(a) * 2, ny - Math.cos(a) * 2);
        ctx.fill();
        // a paler tip on each leaflet
        ctx.fillStyle = `rgba(${70 * g | 0},${150 * g | 0},${80 * g | 0},0.5)`;
        ctx.beginPath(); ctx.arc(nx + Math.sin(la) * leaf * 0.8, ny - Math.cos(la) * leaf * 0.8, 0.9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = ctx.strokeStyle;
      }
      x = nx; y = ny;
      a += Math.sign(ang || 1) * 0.035 + (r() - 0.5) * 0.05;
    }
  }
  return toTex(c, false);
}

// grass: a tuft of blades, dark at the root, pale at the tip, a few seed heads
function grass() {
  const S = 128, c = makeCanvas(S, S), ctx = c.getContext('2d'), r = rng(11);
  for (let i = 0; i < 46; i++) {
    const x = 8 + r() * 112, h = 56 + r() * 70, lean = (r() - 0.5) * 40, w = 2 + r() * 3.5;
    const grad = ctx.createLinearGradient(0, S, 0, S - h);
    const g = 0.55 + r() * 0.55;
    grad.addColorStop(0, `rgb(${10 * g | 0},${34 * g | 0},${18 * g | 0})`);
    grad.addColorStop(0.6, `rgb(${50 * g | 0},${110 * g | 0},${60 * g | 0})`);
    grad.addColorStop(1, `rgb(${110 * g | 0},${150 * g | 0},${90 * g | 0})`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x - w, S); ctx.quadraticCurveTo(x + lean * 0.3, S - h * 0.5, x + lean, S - h); ctx.quadraticCurveTo(x + lean * 0.3 + w * 0.5, S - h * 0.5, x + w, S);
    ctx.fill();
    if (r() < 0.12) { ctx.fillStyle = `rgb(${120 * g | 0},${115 * g | 0},${70 * g | 0})`; ctx.beginPath(); ctx.ellipse(x + lean, S - h, 2, 6, lean * 0.02, 0, Math.PI * 2); ctx.fill(); }
  }
  return toTex(c, false);
}

// hanging moss: tangled strands with little side wisps
function hangingMoss() {
  const c = makeCanvas(128, 256), ctx = c.getContext('2d'), r = rng(13);
  for (let i = 0; i < 70; i++) {
    const x0 = r() * 128, len = 80 + r() * 172, g = 0.5 + r() * 0.5;
    ctx.strokeStyle = `rgba(${70 * g | 0},${95 * g | 0},${80 * g | 0},1)`;
    ctx.lineWidth = 1 + r() * 2.5;
    ctx.beginPath(); ctx.moveTo(x0, 0);
    let x = x0;
    for (let y = 0; y < len; y += 8) {
      x = x0 + Math.sin(y * 0.08 + i) * 5;
      ctx.lineTo(x, y);
      if (r() < 0.25) { ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 14, y + 6 + r() * 10); ctx.moveTo(x, y); }
    }
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

// gold: a heap of coins, each with a bright rim
function gold() {
  return toTex(pixels(64, 64, (u, v) => {
    const [w1, w2, id] = worley(u, v, 6, 99);
    const coin = smoothstep(0.02, 0.1, w2 - w1);
    const n = tileFbm(u, v, 8, 8, 2, 99);
    let c = mul([1.0, 0.75, 0.2], (0.45 + n * 0.4 + id * 0.25) * (0.55 + coin * 0.55));
    if (w2 - w1 < 0.06 && w2 - w1 > 0.03) c = mul(c, 1.35);
    return c;
  }));
}

// rock: tilted strata, deep cracks with a lit lip, lichen rosettes and moss on top
function rock() {
  return toTex(pixels(256, 256, (u, v) => {
    const n = tileFbm(u, v, 4, 4, 5, 201), n2 = tileFbm(u, v, 16, 16, 3, 202), n3 = tileFbm(u, v, 48, 48, 1, 205);
    const strata = 0.85 + 0.15 * Math.sin((v + u * 0.15 + tileFbm(u, v, 2, 2, 3, 204) * 0.2) * Math.PI * 14);
    let c = mul([0.5, 0.53, 0.6], (0.5 + n * 0.75) * strata * (0.9 + n3 * 0.2));
    const cr = Math.abs(tileFbm(u, v, 6, 6, 3, 203) - 0.5);
    if (cr < 0.014) c = mul(c, 0.3);
    else if (cr < 0.022) c = mul(c, 1.15);
    const [w1, , id] = worley(u, v, 12, 206);
    if (id > 0.82 && w1 < 0.3) c = mix(c, [0.62, 0.62, 0.42], (1 - w1 / 0.3) * 0.6);   // lichen
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

