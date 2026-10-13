// The Waiting Halls (ห้องโถงรอเฝ้า): a small door in the keep of Sky-Hung Castle opens onto
// rooms that should not fit inside it. Walls of mossy stone, a floor of wet brick, a ceiling of stained tiles
// and buzzing light panels, the same room over and over, and the hum that never stops. The court
// waited here three hundred years for the Crown-Bearer to come back; the hungriest of them still
// walk the halls (the wendigo, src/wendigo.js).
//
// It is a pocket of the world hung high above its far south-west corner, out of sight and sound
// of everything else: a maze of 14 x 14 rooms (a seeded backtracker, opened up with loops and a few
// pillared halls), lit by baked vertex light from its panels the way PS2 games lit their rooms.
// You go in by the keep's door and come out by the far door beside the courtiers' hoard.
import * as THREE from 'three';
import { ps2ify } from './ps2.js';
import { rng } from './noise.js';
import { L } from './i18n.js';
import { clamp, part, mergeGeometries } from './util.js';
import { castleL, islandLocal, surfaceAt, onIsland } from './skycastle.js';
import { pathWeapons } from './equipment.js';
import { preloadWendigo } from './wendigo.js';

export const ROOMS = { x: -700, z: -730, y: 600, n: 14, cell: 6, h: 3.2 };
const { x: X0, z: Z0, y: Y0, n: N, cell: CELL, h: H } = ROOMS;
const WT = 0.3;                          // wall thickness
const START = [0, 7], END = [N - 1, 1];  // the cell you come in at, and the hoard's
const KEEP_A = 0.3;
const N_ = '';
const cx = (i) => X0 + (i + 0.5) * CELL, cz = (j) => Z0 + (j + 0.5) * CELL;
const TMP = new THREE.Color(), TMP2 = new THREE.Color();

// ---------------------------------------------------------------- painted textures
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function paint(w, h, fn) {
  const c = canvas(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = fn(x, y), o = (y * w + x) * 4;
    d[o] = clamp(p[0], 0, 1) * 255; d[o + 1] = clamp(p[1], 0, 1) * 255; d[o + 2] = clamp(p[2], 0, 1) * 255; d[o + 3] = (p[3] ?? 1) * 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
// tileable value noise, cheap
function noise2(seed, cells) {
  const r = rng(seed), g = Array.from({ length: cells * cells }, r);
  const at = (i, j) => g[((j % cells + cells) % cells) * cells + ((i % cells + cells) % cells)];
  return (u, v) => {
    const x = u * cells, y = v * cells, i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return (at(i, j) * (1 - sx) + at(i + 1, j) * sx) * (1 - sy) + (at(i, j + 1) * (1 - sx) + at(i + 1, j + 1) * sx) * sy;
  };
}

const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
const MOSS = [0.24, 0.36, 0.16], MOSS_DARK = [0.12, 0.2, 0.09];
const mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function stoneWallTex() {
  // grey castle stone in courses (one width of texture = 1.8 m, its height the whole wall): each
  // block its own shade, lit along its top, shadowed under; damp and moss climbing from the floor
  const W = 128, Hh = 256, ROW = 32, n1 = noise2(11, 8), n2 = noise2(12, 32), damp = noise2(13, 4), mossN = noise2(14, 12);
  const c = paint(W, Hh, (x, y) => {
    const u = x / W, v = y / Hh, up = 1 - v;                       // up: 0 at the floor
    const row = Math.floor(y / ROW), ly = y % ROW;
    const bw = W / 3, off = (row % 2) * bw / 2, bx = ((x + off) % W), blk = Math.floor(bx / bw), lx = bx - blk * bw;
    const h = hash(row, blk);
    let k = 0.82 + h * 0.22 + (n1(u, v) - 0.5) * 0.16 + (n2(u, v) - 0.5) * 0.14;
    if (hash(row * 7 + blk, 3) < 0.12) k *= 0.85;                    // a few darker, older stones
    let col = [0.52 * k, 0.52 * k, 0.5 * k];
    // mortar, and the light across each block's face
    const mortar = ly < 2 || lx < 2;
    if (mortar) col = [0.2, 0.2, 0.19];
    else if (ly < 4) col = col.map((c0) => c0 * 1.12);
    else if (ly > ROW - 4) col = col.map((c0) => c0 * 0.78);
    if (!mortar && n2(u * 2, v * 2) > 0.8) col = col.map((c0) => c0 * 0.7);   // chips and pits
    // water running down from the joints: darker streaks
    const streak = n1(u * 6, 0.1) > 0.72 ? clamp((0.8 - up) * 1.2, 0, 1) * 0.25 : 0;
    col = col.map((c0) => c0 * (1 - streak));
    // damp near the floor, then moss: thick in the low courses and the joints, thinning upward
    const wet = clamp((0.35 + damp(u, 0.5) * 0.25 - up) * 3, 0, 1);
    col = col.map((c0, i) => c0 * (1 - wet * 0.3) - [0.02, 0.0, 0.03][i] * wet);
    const m = clamp((0.3 + mossN(u, v) * 0.3 - up) * 3 + (mortar ? 0.3 : 0) + (mossN(u * 3, v * 3) - 0.65) * 1.5, 0, 1);
    if (m > 0.05) col = mixc(col, mixc(MOSS_DARK, MOSS, n2(u * 3, v * 3)), m * 0.8);
    return col;
  });
  return tex(c);
}

function brickFloorTex() {
  // old brick pavers (one texture = 2 m), worn and wet, moss in the joints and spreading in patches
  const S = 128, BW = 32, BH = 16, n1 = noise2(21, 6), n2 = noise2(22, 32), wetN = noise2(23, 3), mossN = noise2(24, 5);
  return tex(paint(S, S, (x, y) => {
    const u = x / S, v = y / S;
    const row = Math.floor(y / BH), ly = y % BH, off = (row % 2) * BW / 2, bx = (x + off) % S, blk = Math.floor(bx / BW), lx = bx - blk * BW;
    const h = hash(row, blk);
    let k = 0.78 + h * 0.3 + (n1(u, v) - 0.5) * 0.15 + (n2(u, v) - 0.5) * 0.2;
    let col = [0.46 * k, 0.31 * k, 0.24 * k];
    if (hash(blk, row * 3) < 0.15) col = [0.36 * k, 0.3 * k, 0.27 * k];   // a greyer brick here and there
    const joint = ly < 2 || lx < 2;
    if (joint) col = [0.15, 0.14, 0.12];
    else if (ly < 3 || lx < 3) col = col.map((c0) => c0 * 1.1);           // worn, rounded edges catch the light
    // wet: dark, glossy puddles
    const w = clamp((wetN(u, v) - 0.5) * 3.5, 0, 1);
    col = col.map((c0) => c0 * (1 - w * 0.4));
    // moss: in every joint, and creeping over the bricks where it is wettest
    const m = clamp((joint ? 0.4 : 0) + (mossN(u, v) - 0.6) * 2.4 + w * 0.25 + (n2(u * 2, v * 2) - 0.5) * 0.7, 0, 1);
    if (m > 0.05) col = mixc(col, mixc(MOSS_DARK, MOSS, n2(u * 4, v * 4) * 1.2), m * 0.75);
    return col;
  }));
}

function ceilingTex() {
  // a 3 x 3 grid of acoustic tiles in their metal frame, pocked, a couple of them stained
  const S = 128, n = noise2(31, 16), r = rng(32), pits = new Set();
  for (let i = 0; i < 700; i++) pits.add(Math.floor(r() * S) + Math.floor(r() * S) * S);
  const stained = [5];
  return tex(paint(S, S, (x, y) => {
    const tx = Math.floor(x / (S / 3)), ty = Math.floor(y / (S / 3)), lx = x % (S / 3), ly = y % (S / 3);
    if (lx < 2 || ly < 2) return [0.62, 0.6, 0.52];
    let k = 0.88 + (n(x / S, y / S) - 0.5) * 0.1;
    if (pits.has(x + y * S)) k *= 0.8;
    let col = [0.74 * k, 0.72 * k, 0.64 * k];
    if (stained.includes(tx + ty * 3)) {
      const d = Math.hypot(lx - 20, ly - 22) / 18;
      if (d < 1) col = col.map((c0, i) => c0 * (0.75 + d * 0.25) - [0.0, 0.03, 0.08][i] * (1 - d));
      if (Math.abs(d - 0.9) < 0.05) col = col.map((c0) => c0 * 0.8);
    }
    return col;
  }));
}

function panelTex() {
  const W = 64, Hh = 32;
  return tex(paint(W, Hh, (x, y) => {
    if (x < 2 || y < 2 || x > W - 3 || y > Hh - 3) return [0.55, 0.55, 0.5];
    const grid = (x % 6 === 0 || y % 6 === 0) ? 0.86 : 1;
    const tube = 0.86 + 0.14 * Math.cos(((y - Hh / 2) / Hh) * Math.PI * 2.2);
    return [grid * tube, grid * tube * 0.98, grid * tube * 0.84];
  }), false);
}

function tallyTex() {
  // days scratched into the stone: groups of four struck through
  const c = canvas(128, 64), x = c.getContext('2d'), r = rng(41);
  x.strokeStyle = 'rgba(60,40,20,0.85)'; x.lineWidth = 2;
  for (let row = 0; row < 3; row++) for (let gI = 0; gI < 5; gI++) {
    const ox = 6 + gI * 24 + r() * 2, oy = 6 + row * 20;
    for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(ox + k * 4, oy + r() * 2); x.lineTo(ox + k * 4 + r() * 2 - 1, oy + 14); x.stroke(); }
    x.beginPath(); x.moveTo(ox - 2, oy + 12); x.lineTo(ox + 16, oy + 2); x.stroke();
  }
  return tex(c, false);
}

function scrawlTex(text) {
  const c = canvas(256, 64), x = c.getContext('2d');
  x.fillStyle = 'rgba(70,30,15,0.9)';
  x.font = 'bold 30px serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.save(); x.translate(128, 32); x.rotate(-0.04); x.fillText(text, 0, 0); x.restore();
  return tex(c, false);
}

// ---------------------------------------------------------------- the maze
function makeMaze(seed) {
  const r = rng(seed);
  // wallE[i][j]: between (i,j) and (i+1,j); wallS[i][j]: between (i,j) and (i,j+1)
  const wallE = Array.from({ length: N }, () => Array(N).fill(true));
  const wallS = Array.from({ length: N }, () => Array(N).fill(true));
  const seen = Array.from({ length: N }, () => Array(N).fill(false));
  const stack = [[START[0], START[1]]];
  seen[START[0]][START[1]] = true;
  while (stack.length) {
    const [i, j] = stack[stack.length - 1];
    const next = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [i + a, j + b]).filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N && !seen[a][b]);
    if (!next.length) { stack.pop(); continue; }
    const [a, b] = next[Math.floor(r() * next.length)];
    if (a !== i) wallE[Math.min(a, i)][j] = false; else wallS[i][Math.min(b, j)] = false;
    seen[a][b] = true;
    stack.push([a, b]);
  }
  // loops, so there is always another way round (and another way for it to come)
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if (i < N - 1 && wallE[i][j] && r() < 0.16) wallE[i][j] = false;
    if (j < N - 1 && wallS[i][j] && r() < 0.16) wallS[i][j] = false;
  }
  // a few great empty halls held up by pillars
  const halls = [[3, 2, 3, 3], [8, 7, 4, 3], [2, 10, 3, 2], [9, 11, 2, 2]];
  const pillars = [];
  for (const [hi, hj, w, h] of halls) {
    for (let i = hi; i < hi + w; i++) for (let j = hj; j < hj + h; j++) {
      if (i < hi + w - 1) wallE[i][j] = false;
      if (j < hj + h - 1) wallS[i][j] = false;
    }
    for (let i = hi + 1; i < hi + w; i++) for (let j = hj + 1; j < hj + h; j++) pillars.push([X0 + i * CELL, Z0 + j * CELL]);
  }
  return { wallE, wallS, halls, pillars };
}

// a geometry builder: quads with uv and a baked light colour per vertex
class Build {
  constructor() { this.p = []; this.uv = []; this.c = []; }
  // a, b, c, d counter-clockwise seen from the front; uvs [[u,v] x4]; light(x,y,z) -> [r,g,b]
  quad(a, b, c, d, uvs, light) {
    for (const k of [0, 1, 2, 0, 2, 3]) {
      const v = [a, b, c, d][k];
      this.p.push(v[0], v[1], v[2]);
      this.uv.push(uvs[k][0], uvs[k][1]);
      this.c.push(...light(v[0], v[1], v[2]));
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeVertexNormals();
    return g;
  }
}

export class Backrooms {
  constructor(g, ch2) {
    this.g = g;
    this.ch2 = ch2;
    this.chest = false;
    this.read = [];
    this.inside = false;
    this.k = 0;                 // how far the halls' air has taken over (eases in and out)
    this.bright = 1;            // the lights: 1 lit, 0 out
    this.blackT = 0;            // a blackout's time left
    this.nextBlack = 50;
    this.flickT = 0;
    this.live = [];
    this.flow = new Map();
  }

  serialize() { return { chest: this.chest, read: this.read }; }
  load(d = {}) { this.chest = !!d.chest; this.read = Array.isArray(d.read) ? d.read : []; }

  // ---------------------------------------------------------------- building it
  setup() {
    const g = this.g, M = g.M, col = g.collision;
    this.maze = makeMaze(1717);
    const { wallE, wallS, pillars } = this.maze;
    const r = rng(77);
    this.group = new THREE.Group();
    this.group.visible = false;
    g.scene.add(this.group);

    // the lights: a panel in every room's ceiling; whole stretches of them dead
    const dead = new Set();
    for (const [i0, j0] of [[5, 5], [11, 3], [1, 2], [6, 11], [12, 10]]) {
      for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) if (r() < 0.8) dead.add(i + ',' + j);
    }
    this.panels = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const off = dead.has(i + ',' + j) || r() < 0.08;
      this.panels.push({ i, j, x: cx(i), z: cz(j), lit: !off, flicker: !off && r() < 0.12 });
    }
    this.panels.find((p) => p.i === START[0] && p.j === START[1]).lit = true;
    const lit = this.panels.filter((p) => p.lit);
    const light = (base = 1, floorAO = true) => (x, y, z) => {
      let s = 0;
      for (const p of lit) {
        const dx = x - p.x, dz = z - p.z;
        if (Math.abs(dx) > 13 || Math.abs(dz) > 13) continue;
        const dy = Y0 + H - y;
        s += 1 / (1 + (dx * dx + dz * dz + dy * dy * 0.6) * 0.075);
      }
      let k = clamp(0.08 + s * 0.62, 0, 0.88) * base;
      if (floorAO) k *= 0.72 + 0.28 * clamp((y - Y0) / 0.6, 0, 1);    // darker down at the skirting
      return [k, k * 0.98, k * 0.9];
    };

    // the walls: runs merged along each grid line, both faces faced with stone
    const walls = new Build(), U = 1.8;              // one width of the stone texture every 1.8 m
    const wallRun = (ax, az, bx, bz) => {
      const along = ax === bx ? 'z' : 'x';
      const len = Math.hypot(bx - ax, bz - az);
      const half = WT / 2;
      const cxm = (ax + bx) / 2, czm = (az + bz) / 2;
      col.addBox(cxm, Y0 + H / 2, czm, along === 'x' ? len / 2 : half, H / 2, along === 'x' ? half : len / 2, 0);
      // both faces, split into ~1.5 m columns and a skirting row so the light reads along them
      const cols = Math.max(1, Math.round(len / 1.5));
      const rows = [0, 0.5, H];
      for (const side of [-1, 1]) {
        for (let c = 0; c < cols; c++) {
          const t0 = c / cols, t1 = (c + 1) / cols;
          for (let rr = 0; rr < rows.length - 1; rr++) {
            const y0 = Y0 + rows[rr], y1 = Y0 + rows[rr + 1], v0 = rows[rr] / H, v1 = rows[rr + 1] / H;
            const p0 = along === 'x' ? [ax + (bx - ax) * t0, az + side * half] : [ax + side * half, az + (bz - az) * t0];
            const p1 = along === 'x' ? [ax + (bx - ax) * t1, az + side * half] : [ax + side * half, az + (bz - az) * t1];
            const u0 = (t0 * len) / U, u1 = (t1 * len) / U;
            // the face must look away from the wall's middle
            const flip = along === 'x' ? side > 0 : side < 0;
            const A = [p0[0], y0, p0[1]], B = [p1[0], y0, p1[1]], C = [p1[0], y1, p1[1]], D = [p0[0], y1, p0[1]];
            if (flip) walls.quad(A, B, C, D, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], light());
            else walls.quad(B, A, D, C, [[u1, v0], [u0, v0], [u0, v1], [u1, v1]], light());
          }
        }
      }
      // the ends
      for (const [ex, ez, dir] of [[ax, az, -1], [bx, bz, 1]]) {
        const a = along === 'x' ? [ex, ez - half] : [ex - half, ez], b = along === 'x' ? [ex, ez + half] : [ex + half, ez];
        const A = [a[0], Y0, a[1]], B = [b[0], Y0, b[1]], C = [b[0], Y0 + H, b[1]], D = [a[0], Y0 + H, a[1]];
        const out = along === 'x' ? dir < 0 : dir > 0;
        if (out) walls.quad(A, B, C, D, [[0, 0], [0.17, 0], [0.17, 1], [0, 1]], light());
        else walls.quad(B, A, D, C, [[0, 0], [0.17, 0], [0.17, 1], [0, 1]], light());
      }
    };
    const ext = WT / 2;
    // walls lying along x (between rows), merged into runs
    for (let j = -1; j < N; j++) {
      let run = -1;
      for (let i = 0; i <= N; i++) {
        const on = i < N && (j === -1 || j === N - 1 || wallS[i][j]);
        if (on && run < 0) run = i;
        if (!on && run >= 0) { const z = Z0 + (j + 1) * CELL; wallRun(X0 + run * CELL - ext, z, X0 + i * CELL + ext, z); run = -1; }
      }
    }
    // walls lying along z (between columns)
    for (let i = -1; i < N; i++) {
      let run = -1;
      for (let j = 0; j <= N; j++) {
        const on = j < N && (i === -1 || i === N - 1 || wallE[i][j]);
        if (on && run < 0) run = j;
        if (!on && run >= 0) { const x = X0 + (i + 1) * CELL; wallRun(x, Z0 + run * CELL - ext, x, Z0 + j * CELL + ext); run = -1; }
      }
    }
    // square pillars in the great halls
    for (const [px, pz] of pillars) {
      const s = 0.45;
      col.addBox(px, Y0 + H / 2, pz, s, H / 2, s, 0);
      const c4 = [[px - s, pz - s], [px + s, pz - s], [px + s, pz + s], [px - s, pz + s]];
      for (let k = 0; k < 4; k++) {
        const a = c4[k], b = c4[(k + 1) % 4];
        walls.quad([b[0], Y0, b[1]], [a[0], Y0, a[1]], [a[0], Y0 + H, a[1]], [b[0], Y0 + H, b[1]], [[0, 0], [0.5, 0], [0.5, 1], [0, 1]], light());
      }
    }
    const stoneMat = ps2ify(new THREE.MeshBasicMaterial({ map: stoneWallTex(), vertexColors: true }));
    this.group.add(new THREE.Mesh(walls.geometry(), stoneMat));

    // floor and ceiling, three quads to a room so the light pools
    const floor = new Build(), ceil = new Build(), sub = 3, q = CELL / sub;
    for (let i = 0; i < N * sub; i++) for (let j = 0; j < N * sub; j++) {
      const x0 = X0 + i * q, z0 = Z0 + j * q, x1 = x0 + q, z1 = z0 + q;
      const fu = [[x0 / 2, z0 / 2], [x0 / 2, z1 / 2], [x1 / 2, z1 / 2], [x1 / 2, z0 / 2]];
      floor.quad([x0, Y0, z0], [x0, Y0, z1], [x1, Y0, z1], [x1, Y0, z0], fu, light(0.9, false));
      const cu = [[x0 / 2.4, z0 / 2.4], [x1 / 2.4, z0 / 2.4], [x1 / 2.4, z1 / 2.4], [x0 / 2.4, z1 / 2.4]];
      ceil.quad([x0, Y0 + H, z0], [x1, Y0 + H, z0], [x1, Y0 + H, z1], [x0, Y0 + H, z1], cu, light(1.05, false));
    }
    const brickMat = ps2ify(new THREE.MeshBasicMaterial({ map: brickFloorTex(), vertexColors: true }));
    const ceilMat = ps2ify(new THREE.MeshBasicMaterial({ map: ceilingTex(), vertexColors: true }));
    this.group.add(new THREE.Mesh(floor.geometry(), brickMat), new THREE.Mesh(ceil.geometry(), ceilMat));
    const half = (N * CELL) / 2;
    col.addBox(X0 + half, Y0 - 0.5, Z0 + half, half + 1, 0.5, half + 1, 0);        // the floor
    col.addBox(X0 + half, Y0 + H + 0.5, Z0 + half, half + 1, 0.5, half + 1, 0);    // (for the third-person camera)

    // the light panels themselves: steady, flickering and dead
    const pt = panelTex();
    const panelMat = ps2ify(new THREE.MeshBasicMaterial({ map: pt, color: new THREE.Color(1.35, 1.3, 1.1) }));
    const flickMat = ps2ify(new THREE.MeshBasicMaterial({ map: pt, color: new THREE.Color(1.35, 1.3, 1.1) }));
    const deadMat = ps2ify(new THREE.MeshBasicMaterial({ map: pt, color: new THREE.Color(0.22, 0.21, 0.19) }));
    const lists = { on: [], flick: [], off: [] };
    for (const p of this.panels) {
      const geo = new THREE.PlaneGeometry(1.2, 0.6);
      geo.rotateX(Math.PI / 2);
      geo.translate(p.x, Y0 + H - 0.01, p.z);
      lists[!p.lit ? 'off' : p.flicker ? 'flick' : 'on'].push(geo);
    }
    for (const [k, mat] of [['on', panelMat], ['flick', flickMat], ['off', deadMat]]) if (lists[k].length) this.group.add(new THREE.Mesh(mergeGeometries(lists[k]), mat));
    this.mats = { stoneMat, brickMat, ceilMat, panelMat, flickMat };

    // things left behind: chairs turned to face the wall, days scratched into the stone, notes
    const wood = [];
    const chairAt = (x, z, ry, fallen = false) => {
      const C = new THREE.Color(0.5, 0.36, 0.22), rot = fallen ? [Math.PI / 2, ry, 0] : [0, ry, 0];
      const parts = [part(new THREE.BoxGeometry(0.5, 0.06, 0.5), C, { pos: [0, 0.48, 0] }), part(new THREE.BoxGeometry(0.5, 0.6, 0.06), C, { pos: [0, 0.8, -0.22] })];
      for (const [lx, lz] of [[-0.21, -0.21], [0.21, -0.21], [-0.21, 0.21], [0.21, 0.21]]) parts.push(part(new THREE.BoxGeometry(0.05, 0.48, 0.05), C, { pos: [lx, 0.24, lz] }));
      const m = mergeGeometries(parts);
      m.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)).setPosition(x, Y0 + (fallen ? 0.25 : 0), z));
      wood.push(m);
    };
    const faceWall = (i, j) => {
      // a chair up against one of this room's walls, facing it
      const { wallE: E, wallS: S } = this.maze;
      const opts = [];
      if (i === N - 1 || E[i][j]) opts.push([cx(i) + CELL / 2 - 0.6, cz(j), Math.PI / 2]);
      if (i === 0 || E[i - 1]?.[j]) opts.push([cx(i) - CELL / 2 + 0.6, cz(j), -Math.PI / 2]);
      if (j === N - 1 || S[i][j]) opts.push([cx(i), cz(j) + CELL / 2 - 0.6, 0]);
      if (j === 0 || S[i][j - 1]) opts.push([cx(i), cz(j) - CELL / 2 + 0.6, Math.PI]);
      return opts[0];
    };
    for (const [i, j] of [[2, 7], [6, 4], [10, 9], [4, 12], [12, 6], [7, 1]]) {
      const f = faceWall(i, j);
      if (f) chairAt(f[0], f[1], f[2]);
    }
    chairAt(cx(9) + 1, cz(8), 0.7, true);
    chairAt(cx(3) - 1, cz(3) + 1, 2.1, true);
    this.group.add(new THREE.Mesh(mergeGeometries(wood), M.wood));
    const decal = (map, w, h, x, y, z, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), ps2ify(new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, color: new THREE.Color(0.85, 0.8, 0.7) })));
      m.position.set(x, y, z); m.rotation.y = ry;
      this.group.add(m);
      this.decals = [...(this.decals || []), m];
    };
    const tally = tallyTex();
    // on the west side of a wall facing +x, etc: a wall's face is WT/2 from its line
    decal(tally, 1.2, 0.6, X0 + WT / 2 + 0.01, Y0 + 1.4, cz(START[1]) + 1.6, Math.PI / 2);
    decal(tally, 1.2, 0.6, X0 + N * CELL - WT / 2 - 0.01, Y0 + 1.2, cz(6), -Math.PI / 2);
    decal(scrawlTex(L('อย่าหันหลังให้มัน', 'never turn thy back')), 1.6, 0.4, X0 + WT / 2 + 0.01, Y0 + 1.7, cz(10), Math.PI / 2);
    decal(scrawlTex(L('ห้องนี้เคยอยู่ตรงนี้ไหม', 'was this room here before')), 1.8, 0.45, cx(6), Y0 + 1.6, Z0 + WT / 2 + 0.01, 0);

    // ---- the doors: the one you came in by (it is not there when you look back), and the far one
    const doorGeo = (glow) => {
      const parts = [
        part(new THREE.BoxGeometry(1.5, 0.15, 0.12), new THREE.Color(0.28, 0.2, 0.12), { pos: [0, 2.3, 0] }),
        part(new THREE.BoxGeometry(0.12, 2.3, 0.12), new THREE.Color(0.28, 0.2, 0.12), { pos: [-0.7, 1.15, 0] }),
        part(new THREE.BoxGeometry(0.12, 2.3, 0.12), new THREE.Color(0.28, 0.2, 0.12), { pos: [0.7, 1.15, 0] }),
        part(new THREE.BoxGeometry(1.28, 2.22, 0.06), new THREE.Color(0.42, 0.3, 0.18), { pos: [0, 1.12, -0.02] }),
        part(new THREE.SphereGeometry(0.05, 6, 4), new THREE.Color(0.9, 0.75, 0.4), { pos: [0.45, 1.05, 0.05] }),
      ];
      const m = new THREE.Mesh(mergeGeometries(parts), M.wood);
      if (glow) {
        const slit = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.4, 0.9), fog: false }));
        slit.position.set(0, 0.02, 0.05);
        m.add(slit);
      }
      return m;
    };
    this.inDoor = doorGeo(false);
    this.inDoor.position.set(X0 + WT / 2, Y0, cz(START[1]));
    this.inDoor.rotation.y = Math.PI / 2;
    this.outDoor = doorGeo(true);
    this.outDoor.position.set(X0 + N * CELL - WT / 2, Y0, cz(END[1]));
    this.outDoor.rotation.y = -Math.PI / 2;
    this.group.add(this.inDoor, this.outDoor);
    this.startAt = new THREE.Vector3(cx(START[0]) - 1.2, Y0, cz(START[1]));
    this.exitAt = new THREE.Vector3(X0 + N * CELL - 1.0, Y0, cz(END[1]));

    // ---- the courtiers' hoard: a chest by the far door
    this.chestAt = new THREE.Vector3(cx(END[0]) - 0.4, Y0, cz(END[1]) + 1.9);
    const cb = new THREE.Color(0.4, 0.28, 0.16), band = new THREE.Color(0.45, 0.42, 0.4);
    const box = mergeGeometries([
      part(new THREE.BoxGeometry(1.0, 0.5, 0.6), cb, { pos: [0, 0.25, 0] }),
      part(new THREE.BoxGeometry(1.04, 0.08, 0.64), band, { pos: [0, 0.1, 0] }),
      part(new THREE.BoxGeometry(1.04, 0.08, 0.64), band, { pos: [0, 0.42, 0] }),
    ]);
    this.chestBox = new THREE.Mesh(box, M.wood);
    this.chestBox.position.copy(this.chestAt);
    this.chestBox.rotation.y = Math.PI;
    this.chestLid = new THREE.Mesh(mergeGeometries([part(new THREE.BoxGeometry(1.0, 0.18, 0.6), cb, { pos: [0, 0.09, 0.3] })]), M.wood);
    this.chestLid.position.set(0, 0.5, -0.3);
    this.chestBox.add(this.chestLid);
    this.group.add(this.chestBox);
    col.addBox(this.chestAt.x, Y0 + 0.3, this.chestAt.z, 0.5, 0.3, 0.3, 0);

    // ---- notes the court left on the floor
    const notes = [[2, 6], [5, 3], [9, 8], [4, 11], [11, 12], [12, 2]];
    const noteMat = ps2ify(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.88, 0.68) }));
    this.notes = notes.map(([i, j], n) => {
      const pos = new THREE.Vector3(cx(i) + (r() - 0.5) * 2, Y0, cz(j) + (r() - 0.5) * 2);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.42), noteMat);
      m.rotation.set(-Math.PI / 2, 0, r() * 6);
      m.position.set(pos.x, Y0 + 0.02, pos.z);
      this.group.add(m);
      return { n, pos, mesh: m };
    });

    // ---- the door in the keep, on the terrace beside the throne
    const k = castleL(0, 0, 2);
    const nx = Math.sin(KEEP_A), nz = Math.cos(KEEP_A);      // the keep's front faces +z, turned with the castle
    const sx = Math.cos(KEEP_A), sz = -Math.sin(KEEP_A);
    const fx = k.x + nx * 10.05 + sx * 8.4, fz = k.z + nz * 10.05 + sz * 8.4;     // (between the dais and the corner tower)
    const fy = surfaceAt(islandLocal(fx, fz)[2]);
    this.keepDoor = doorGeo(true);
    this.keepDoor.scale.setScalar(1.3);
    this.keepDoor.position.set(fx, fy, fz);
    this.keepDoor.rotation.y = KEEP_A;
    g.scene.add(this.keepDoor);
    this.keepDoorAt = new THREE.Vector3(fx + nx * 1.2, fy, fz + nz * 1.2);
    this.keepOut = new THREE.Vector3(fx + nx * 2.6, fy, fz + nz * 2.6);
    this.keepYaw = Math.atan2(-nx, -nz);       // facing away from the door (forward is -sin, -cos)
  }

  // ---------------------------------------------------------------- the places to press E
  spots() {
    const g = this.g, p = g.player.pos, out = [];
    if (!this.group || this.ch2.stage < 5) return out;
    const add = (id, pos, label, r = 2.4) => out.push({ id, pos, r, label });
    if (this.inside) {
      add('story:c2rooms_out', this.exitAt, L('เปิดประตูออกไป', 'Open the door and leave'), 2.6);
      if (this.inDoor.visible) add('story:c2rooms_back', this.startAt, L('กลับออกทางประตูเดิม', 'Go back out the way you came'), 2.6);
      if (!this.chest) add('story:c2rooms_chest', this.chestAt, L('เปิดหีบ', 'Open the chest'), 2.2);
      for (const n of this.notes) if (Math.hypot(n.pos.x - p.x, n.pos.z - p.z) < 3) add(`story:c2rooms_note${n.n}`, n.pos, L('อ่านกระดาษที่ตกอยู่', 'Read the paper on the floor'), 1.8);
    } else if (onIsland(p.x, p.z, p.y)) {
      preloadWendigo();               // (what waits inside, fetched while you are still outside)
      add('story:c2rooms_in', this.keepDoorAt, L('เปิดประตูเล็กในหอกลาง', 'Open the small door in the keep'), 2.8);
    }
    return out;
  }

  inspect(id) {
    const g = this.g, say = (lines, then) => this.ch2.say(lines, then);
    if (id === 'story:c2rooms_in') {
      return say([[N_, L('ประตูไม้เล็ก ๆ ในกำแพงหอกลาง ใต้ประตูมีแสงสีเหลืองซีดลอดออกมา และเสียงหึ่ง... เหมือนแมลงนับพันตัวอยู่ข้างใน', 'A small wooden door in the wall of the keep. A pale yellow light leaks under it, and a hum... like a thousand insects inside.')]], () => this.enter());
    }
    if (id === 'story:c2rooms_out') {
      return say([[N_, L('ลมเย็นของท้องฟ้าพัดเข้ามาทางช่องประตู... เจ้าก้าวออกไปโดยไม่หันหลังกลับ', 'The cold sky-wind blows in through the gap... you step out without looking back.')]], () => this.leave());
    }
    if (id === 'story:c2rooms_back') {
      return say([[N_, L('เจ้าเปิดประตูบานเดิม... หลังประตูไม่ใช่ลานบัลลังก์ แต่เป็นกำแพงหินชื้น ๆ เมื่อหันกลับมาอีกที ประตูก็หายไปแล้ว', 'You open the door you came in by... behind it is no throne terrace, only damp stone wall. When you look again, the door is gone.')]], () => { this.doorGone = true; this.inDoor.visible = false; g.audio.sting(); });
    }
    if (id === 'story:c2rooms_chest') return this.openChest();
    if (id.startsWith('story:c2rooms_note')) {
      const n = +id.slice('story:c2rooms_note'.length);
      if (!this.read.includes(n)) { this.read.push(n); g.gainXP(80); }
      return say([[N_, NOTES[n]()]]);
    }
  }

  // ---------------------------------------------------------------- in and out
  enter() {
    const g = this.g, p = g.player;
    if (g.mount?.ridden) g.mount.dismount();
    g.checkpoint = { x: this.keepOut.x, z: this.keepOut.z, y: this.keepOut.y };
    p.place(this.startAt.x, this.startAt.z, -Math.PI / 2, Y0);
    p.vel.set(0, 0, 0);
    this.inDoor.visible = true;
    this.doorGone = false;
    this.k = 1;
    this.group.visible = true;
    this.inside = true;
    g.audio.thump?.({ freq: 70, dur: 0.6, gain: 0.4 });
    g.ui.banner(L('ห้องโถงรอเฝ้า', 'The Waiting Halls'), L('ไฟไม่เคยดับ เสียงหึ่งไม่เคยหยุด', 'The lights never go out. The hum never stops.'));
    this.raise();
    g.save();
  }

  leave() {
    const g = this.g, p = g.player;
    this.clear();
    this.inside = false;
    p.place(this.keepOut.x, this.keepOut.z, this.keepYaw, this.keepOut.y);
    p.vel.set(0, 0, 0);
    this.k = 0;
    this.blackT = 0;
    this.bright = 1;
    g.audio.thump?.({ freq: 60, dur: 0.6, gain: 0.35 });
    g.ui.toast(L('ประตูปิดลงข้างหลัง... เสียงหึ่งเงียบไป', 'The door closes behind you... the hum falls silent'));
    g.save();
  }

  // the hungry ones, somewhere far off in the halls
  raise() {
    this.clear();
    const c = this.g.combat;
    const far = this.cellsFrom(START).filter((x) => x.d >= 7).sort(() => Math.random() - 0.5);
    const n = this.chest ? 4 : 3;
    for (let k = 0; k < n && k < far.length; k++) {
      const { i, j } = far[k];
      const e = c.spawn('wendigo', cx(i), cz(j), Y0);
      Object.assign(e, { summoned: true, storyTag: 'c2wendigo', state: 'idle', t: 2 + k * 3, route: (en, to) => this.route(en, to) });
      e.def = { ...e.def, aggro: 20 };
      e.wanderT = 0;
      this.live.push(e);
    }
  }

  clear() {
    const g = this.g;
    for (const e of this.live) {
      e.alive = false; e.respawn = 1e12; e.obj.visible = false;
      g.scene.remove(e.obj);
      if (e.shadow) { e.shadow.visible = false; g.scene.remove(e.shadow); }
    }
    if (this.live.length) g.combat.enemies = g.combat.enemies.filter((e) => !this.live.includes(e));
    this.live = [];
  }

  openChest() {
    const g = this.g;
    if (this.chest) return;
    this.chest = true;
    this.chestLid.rotation.x = -1.9;
    g.audio.chest?.();
    g.addCoins(260);
    if (g.bag.add('potion_big', 2) > 0) g.loot.dropNearPlayer('potion_big', 1);
    // the best of your path's weapons you do not have yet
    const want = pathWeapons(g.kit.id).filter((w) => !g.equipment.owns(w.id)).sort((a, b) => b.value - a.value)[0];
    if (want) g.equipment.reward([want.id]);
    else g.addCoins(240);
    g.gainXP(900);
    g.ui.toast(L('หีบของข้าราชสำนัก: เหรียญ 260 และยาฟื้นพลังใหญ่ 2 ขวด', 'The courtiers\' hoard: 260 coins and 2 Great Healing Draughts'));
    // and something has heard the lid
    setTimeout(() => {
      if (!this.inside) return;
      const c = g.combat, far = this.cellsFrom(END).filter((x) => x.d >= 5);
      const { i, j } = far[Math.floor(Math.random() * far.length)];
      const e = c.spawn('wendigo', cx(i), cz(j), Y0);
      Object.assign(e, { summoned: true, storyTag: 'c2wendigo', state: 'chase', route: (en, to) => this.route(en, to) });
      e.def = { ...e.def, aggro: 60 };
      this.live.push(e);
      g.audio.enemyCue('wendigo', 'aggro', e.pos);
    }, 2500);
    g.save();
  }

  // ---------------------------------------------------------------- finding the way in a maze
  cellOf(x, z) { return [clamp(Math.floor((x - X0) / CELL), 0, N - 1), clamp(Math.floor((z - Z0) / CELL), 0, N - 1)]; }
  open(i, j, a, b) {
    const { wallE, wallS } = this.maze;
    if (a < 0 || b < 0 || a >= N || b >= N) return false;
    if (a !== i) return !wallE[Math.min(a, i)][j];
    return !wallS[i][Math.min(b, j)];
  }
  // every room's distance (in rooms) from one
  cellsFrom([si, sj]) {
    const key = si + sj * N;
    if (this.flow.has(key)) return this.flow.get(key);
    const d = new Int16Array(N * N).fill(-1), q = [[si, sj]], out = [];
    d[key] = 0;
    while (q.length) {
      const [i, j] = q.shift(), dd = d[i + j * N];
      out.push({ i, j, d: dd });
      for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
        if (!this.open(i, j, a, b) || d[a + b * N] >= 0) continue;
        d[a + b * N] = dd + 1;
        q.push([a, b]);
      }
    }
    out.dist = d;
    this.flow.set(key, out);
    return out;
  }
  // which way to walk from where the enemy is to reach `to` (null: straight there)
  route(e, to) {
    if (!this.inside || !this.maze) return null;
    const [i, j] = this.cellOf(e.pos.x, e.pos.z), [ti, tj] = this.cellOf(to.x, to.z);
    if (i === ti && j === tj) return null;
    const d = this.cellsFrom([ti, tj]).dist, here = d[i + j * N];
    for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
      if (!this.open(i, j, a, b) || d[a + b * N] !== here - 1) continue;
      // keep to the middle of the doorway: aim at the shared edge's middle, then the next room
      const ex = (cx(i) + cx(a)) / 2, ez = (cz(j) + cz(b)) / 2;
      const along = a !== i ? Math.abs(e.pos.z - ez) : Math.abs(e.pos.x - ex);
      const tx = along > 1.2 ? ex : cx(a), tz = along > 1.2 ? ez : cz(b);
      return Math.atan2(tx - e.pos.x, tz - e.pos.z);
    }
    return null;
  }

  contains(pos) {
    return pos.x > X0 - 1 && pos.x < X0 + N * CELL + 1 && pos.z > Z0 - 1 && pos.z < Z0 + N * CELL + 1 && pos.y > Y0 - 3 && pos.y < Y0 + H + 3;
  }

  // ---------------------------------------------------------------- every frame
  update(dt) {
    if (!this.group) return;
    const g = this.g, p = g.player;
    const was = this.inside;
    this.inside = this.contains(p.pos);
    // loaded in here, or fallen out somehow
    if (this.inside && !was) { this.group.visible = true; this.k = 1; if (!this.live.length) this.raise(); }
    if (!this.inside && was) { this.clear(); this.group.visible = false; }
    this.k += ((this.inside ? 1 : 0) - this.k) * Math.min(1, dt * 3);
    this.group.visible = this.inside;
    this.updateHum(dt);
    if (!this.inside) return;

    // the door you came in by is not there when you look back
    if (!this.doorGone && Math.hypot(p.pos.x - this.startAt.x, p.pos.z - this.startAt.z) > 9) {
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), dx = this.inDoor.position.x - p.pos.x, dz = this.inDoor.position.z - p.pos.z;
      if ((fx * dx + fz * dz) / Math.hypot(dx, dz) < 0.3) { this.doorGone = true; this.inDoor.visible = false; }
    }
    // the wendigos wander from room to room when they have not found you
    for (const e of this.live) {
      if (!e.alive || e.state !== 'idle') continue;
      if ((e.wanderT -= dt) <= 0) {
        const near = this.cellsFrom(this.cellOf(e.pos.x, e.pos.z)).filter((c) => c.d >= 2 && c.d <= 5);
        const c = near[Math.floor(Math.random() * near.length)];
        if (c) e.home.set(cx(c.i), Y0, cz(c.j));
        e.wanderT = 7 + Math.random() * 8;
      }
    }
    // the lights: a buzz and a stutter now and then, worse when one of them is close; and blackouts
    let nearest = Infinity;
    for (const e of this.live) if (e.alive && e.state !== 'dying') nearest = Math.min(nearest, e.pos.distanceTo(p.pos));
    const dread = clamp(1 - (nearest - 4) / 14, 0, 1);
    if (this.blackT > 0) {
      this.blackT -= dt;
      this.bright = this.blackT > 0.15 ? 0.04 : 1;
      if (this.blackT <= 0) g.audio.thump?.({ freq: 110, dur: 0.15, gain: 0.25 });
    } else {
      this.nextBlack -= dt * (1 + dread * 2);
      if (this.nextBlack <= 0 && this.live.some((e) => e.alive)) {
        this.blackT = 2.2 + Math.random() * 2;
        this.nextBlack = 35 + Math.random() * 50;
        g.audio.thump?.({ freq: 50, dur: 0.5, gain: 0.45 });
        g.audio.burst?.({ dur: 0.08, freq: 3000, q: 1, gain: 0.2 });
      }
      this.flickT -= dt;
      if (this.flickT <= 0) { this.flickT = 0.05 + Math.random() * 0.12; this.flick = Math.random() < 0.04 + dread * 0.35 ? 0.35 + Math.random() * 0.4 : 1; }
      this.bright += ((this.flick ?? 1) - this.bright) * Math.min(1, dt * 30);
    }
    const b = this.bright, M = this.mats;
    for (const m of [M.stoneMat, M.brickMat, M.ceilMat]) m.color.setScalar(b);
    M.panelMat.color.setRGB(1.35, 1.3, 1.1).multiplyScalar(b);
    const fl = Math.random() < 0.15 ? 0.15 : 1;
    if (Math.random() < dt * 8) M.flickMat.color.setRGB(1.35, 1.3, 1.1).multiplyScalar(b * fl);
    this.ambient(dt);
  }

  // after the sky and the weather have had their say: the halls' own air and light
  atmosphere() {
    const k = this.k;
    if (k < 0.002) { if (this.dirty) { this.dirty = false; this.g.pipeline.uniforms.uGrain.value = 0.03; } return; }
    const g = this.g, fog = g.scene.fog, b = this.bright;
    TMP.setRGB(0.24, 0.26, 0.2).multiplyScalar(0.12 + 0.88 * b);
    fog.color.lerp(TMP, k);
    g.scene.background.copy(fog.color);
    fog.density += (0.05 + (1 - b) * 0.08 - fog.density) * k;
    g.hemi.color.lerp(TMP2.setRGB(1.0, 0.9, 0.6), k);
    g.hemi.groundColor.lerp(TMP2.setRGB(0.55, 0.45, 0.25), k);
    g.hemi.intensity += (1.5 * b + 0.05 - g.hemi.intensity) * k;
    g.moon.intensity *= 1 - k;
    const pu = g.pipeline.uniforms;
    this.dirty = true;
    pu.uDay.value += (0.85 - pu.uDay.value) * k;
    pu.uBloom.value += (1.25 - pu.uBloom.value) * k;
    pu.uGrain.value = 0.03 + 0.06 * k;
  }

  // the hum of the lights (and, faintly, through the keep's door)
  updateHum(dt) {
    const a = this.g.audio;
    if (!a.ctx) return;
    if (!this.hum) {
      const ctx = a.ctx, out = ctx.createGain();
      out.gain.value = 0;
      out.connect(a.ambBus);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.7;
      lp.connect(out);
      for (const [f, type, gn] of [[120, 'sawtooth', 0.05], [240, 'square', 0.012], [60, 'sine', 0.08], [180, 'triangle', 0.02]]) {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = f + Math.random() * 0.3;
        const gg = ctx.createGain(); gg.gain.value = gn;
        o.connect(gg).connect(lp); o.start();
      }
      // the buzz of a tube about to go
      const buzz = a.loopNoise(), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 6;
      const bg = ctx.createGain(); bg.gain.value = 0.02;
      buzz.connect(bp).connect(bg).connect(out);
      this.hum = out;
    }
    const p = this.g.player.pos, d = this.keepDoor ? p.distanceTo(this.keepDoor.position) : 1e9;
    const level = this.inside ? 0.9 * (this.blackT > 0.15 ? 0 : 0.6 + this.bright * 0.4) : clamp(1 - d / 12, 0, 1) * 0.25;
    this.hum.gain.setTargetAtTime(level, a.ctx.currentTime, this.blackT > 0 ? 0.02 : 0.25);
  }

  // things heard in the halls that are not the hum
  ambient(dt) {
    const a = this.g.audio, p = this.g.player.pos;
    if (!a.ctx) return;
    this.sndT = (this.sndT ?? 8) - dt;
    if (this.sndT > 0) return;
    this.sndT = 12 + Math.random() * 22;
    const ang = Math.random() * Math.PI * 2, r = 14 + Math.random() * 16;
    const at = { x: p.x + Math.cos(ang) * r, y: Y0 + 0.5, z: p.z + Math.sin(ang) * r };
    const pick = Math.floor(Math.random() * 5);
    if (pick === 0) for (let i = 0; i < 9; i++) a.thump({ freq: 95, dur: 0.12, gain: 0.18, delay: i * 0.22, pos: at, verb: 0.6 });           // someone running
    if (pick === 1) for (let i = 0; i < 3; i++) a.thump({ freq: 140, dur: 0.1, gain: 0.3, delay: i * 0.45, pos: at, verb: 0.5 });           // knocking in the wall
    if (pick === 2) a.burst({ dur: 0.9, freq: 700, q: 3, gain: 0.08, sweep: 1.6, pos: at, verb: 0.6 });                                       // a chair dragged
    if (pick === 3) a.voice({ freq: 520, dur: 2.4, gain: 0.06, slide: 0.5, formant: 1600, q: 6, vibrato: 8, pos: at, verb: 0.9 });          // far off, one of them
    if (pick === 4) { a.thump({ freq: 60, dur: 0.5, gain: 0.35, pos: at, verb: 0.8 }); a.burst({ dur: 0.3, freq: 500, q: 1, gain: 0.1, pos: at, verb: 0.8 }); }   // a door, slammed
  }

  // after a load
  restore() {
    if (!this.group) return;
    this.chestLid.rotation.x = this.chest ? -1.9 : 0;
    this.inside = false;
    this.clear();
  }
}

// what the court wrote while it waited
const NOTES = [
  () => L('"วันที่สี่สิบ ผู้ถือมงกุฎยังไม่มา ท่านผู้สำเร็จราชการสั่งให้พวกเรารอที่นี่ รอจนกว่าเขาจะกลับมา"', '"The fortieth day. The Crown-Bearer has not come. The Lord Regent bids us wait here. Wait until he returns."'),
  () => L('"ทางเดินยาวขึ้นทุกคืน ห้องเดิม แต่ไม่ใช่ห้องเดิม ไฟไม่เคยดับ เสียงหึ่งไม่เคยหยุด ข้าเริ่มได้ยินมันในฝัน"', '"The halls grow longer every night. The same room, and not the same room. The lights never go out. The hum never stops. I have begun to hear it in my sleep."'),
  () => L('"ครัวอยู่ห่างไปแค่สามห้อง ข้าเดินมาสองวันยังไม่ถึง ท้องร้องจนเจ็บ ข้ามองท่านเสนาบดีแล้วคิดอะไรบางอย่างที่ไม่ควรคิด"', '"The kitchens are three rooms away. I have walked two days and not reached them. My belly aches. I looked at the Chancellor and thought a thing no man should think."'),
  () => L('"มันเคยเป็นท่านเสนาบดี ตอนนี้มันสูงขึ้น ผอมลง หัวเหมือนกะโหลกกวาง มันไม่ชอบให้ใครมอง ถ้าจ้องมันไว้ มันจะเดินช้าลง... อย่าหันหลังให้มัน"', '"It was the Chancellor once. Now it is taller, and thinner, with a head like a stag\'s skull. It does not like to be looked at. Keep thine eyes on it and it slows... never turn thy back."'),
  () => L('"ไฟดับอีกแล้ว ในความมืดมีแต่ดวงตาสองดวง ข้านับได้สามคู่"', '"The lights went out again. In the dark there was nothing but two eyes. I counted three pairs."'),
  () => L('"ข้าซ่อนของมีค่าของราชสำนักไว้ในหีบข้างประตูบานไกลสุด ถ้าผู้ถือมงกุฎกลับมา ของพวกนี้เป็นของเขา ส่วนข้า... ข้าหิวเหลือเกิน"', '"I have hidden the court\'s treasures in the chest beside the farthest door. If the Crown-Bearer ever returns, they are his. As for me... I am so very hungry."'),
];
