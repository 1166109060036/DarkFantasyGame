import * as THREE from 'three';
import { fbm } from './noise.js';
import { clamp, lerp, smoothstep, distToPolyline } from './util.js';
import { PASTURE, TOAD, TEMPLE, RIVER, RAIL, PATHS, CASTLE, HEAD, STREAM, TAVERN, HOUSES, SMITH } from './layout.js';

export const HALF = 320;
export const SEG = 256;
export const STEP = (HALF * 2) / SEG;
const N = SEG + 1;

function sdRoundBox(px, pz, bx, bz, r) {
  const qx = Math.abs(px) - bx + r, qz = Math.abs(pz) - bz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
}

function flatten(h, x, z, cx, cz, r, target) {
  const d2 = (x - cx) ** 2 + (z - cz) ** 2;
  return lerp(h, target, Math.exp(-d2 / (2 * r * r)));
}

function plateau(h, x, z, cx, cz, r0, r1, target) {
  return lerp(target, h, smoothstep(r0, r1, Math.hypot(x - cx, z - cz)));
}

let siteHeights = null;
function sites() {
  // flatten targets are the natural ground height at each site centre
  if (!siteHeights) {
    siteHeights = {
      // every building stands on dry ground, however low the land around it
      village: Math.max(baseHeight(TAVERN.x, TAVERN.z, false), 0.9),
      houses: HOUSES.map(([hx, hz]) => Math.max(baseHeight(hx, hz, false), 0.9)),
      smith: Math.max(baseHeight(SMITH.x, SMITH.z, false), 0.9),
    };
  }
  return siteHeights;
}

export function baseHeight(x, z, withSites = true) {
  // rolling hills
  let h = (fbm(x * 0.0065 + 11.3, z * 0.0065 - 4.2, 5) - 0.42) * 26;
  h += (fbm(x * 0.035, z * 0.035, 3, 7) - 0.5) * 2.5;

  // southern swamp: flat, half-drowned
  const sw = smoothstep(70, 140, z);
  const swampH = (fbm(x * 0.025 + 3, z * 0.025 + 9, 4, 3) - 0.5) * 4.2 + 0.25;
  h = lerp(h, swampH, sw);

  // pasture hill
  const dp2 = (x - PASTURE.x) ** 2 + (z - PASTURE.z) ** 2;
  h = lerp(h, 6, Math.exp(-dp2 / (2 * 70 * 70)));
  h += 10 * Math.exp(-dp2 / (2 * 38 * 38));

  // toad's clearing
  h = flatten(h, x, z, TOAD.x, TOAD.z, 14, 2.4);

  // northern cliffs
  const nm = smoothstep(-118, -150, z);
  const ridge = 30 + (fbm(x * 0.02 + 5, z * 0.02, 4, 9) - 0.5) * 18;
  h = lerp(h, ridge, nm);

  // sunken temple courtyard carved into the cliffs
  const sd = sdRoundBox(x - TEMPLE.x, z - TEMPLE.z, 40, 33, 8);
  h = lerp(h, -0.6, 1 - smoothstep(0, 7, sd));

  // river (a narrow canyon where it cuts through the cliffs)
  const dr = distToPolyline(x, z, RIVER);
  const inner = lerp(4.5, 7.5, nm), outer = lerp(15, 11, nm);
  h = lerp(h, -0.9, 1 - smoothstep(inner, outer, dr));

  // lake beneath the floating castle
  const dc = Math.hypot(x - CASTLE.x, z - CASTLE.z);
  h = lerp(h, -1.1, 1 - smoothstep(58, 90, dc));

  // the stone king's valley: flattened ground and a stream in front of his face
  h = flatten(h, x, z, HEAD.x, HEAD.z, 40, 4);
  const ds = distToPolyline(x, z, STREAM);
  h = lerp(h, -0.9, 1 - smoothstep(4, 11, ds));

  if (withSites) {
    const s = sites();
    // a low, dry mound under the whole village so it doesn't sit in the marsh
    h = Math.max(h, lerp(0.9, h, smoothstep(34, 52, Math.hypot(x - 66, z - 6))));
    h = plateau(h, x, z, TAVERN.x, TAVERN.z, 11, 22, s.village);
    HOUSES.forEach(([hx, hz], i) => { h = plateau(h, x, z, hx, hz, 5, 10, s.houses[i]); });
    h = plateau(h, x, z, SMITH.x - 0.7, SMITH.z, 5, 10, s.smith);
  }

  // world edge mountains
  const e = Math.max(Math.abs(x), Math.abs(z));
  if (e > 268) {
    const t = e - 268;
    h += t * t * 0.035 + t * 0.35 + (fbm(x * 0.04, z * 0.04, 3, 4) - 0.5) * t * 0.3;
  }
  return h;
}

const C = {
  grassA: [0.17, 0.31, 0.16], grassB: [0.1, 0.21, 0.12], moss: [0.2, 0.37, 0.14],
  rock: [0.4, 0.43, 0.5], mud: [0.12, 0.14, 0.11], bed: [0.06, 0.1, 0.12],
  path: [0.33, 0.31, 0.25], ballast: [0.24, 0.24, 0.26], pasture: [0.22, 0.34, 0.2],
};
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export class Terrain {
  constructor() {
    this.h = new Float32Array(N * N);
    for (let j = 0; j < N; j++) {
      const z = -HALF + j * STEP;
      for (let i = 0; i < N; i++) this.h[j * N + i] = baseHeight(-HALF + i * STEP, z);
    }
    this.railMask = new Float32Array(N * N);
    this.buildRail();
  }

  // Exact height of the rendered triangle mesh (matches PlaneGeometry's triangulation).
  getHeight(x, z) {
    const fx = clamp((x + HALF) / STEP, 0, SEG - 1e-4), fz = clamp((z + HALF) / STEP, 0, SEG - 1e-4);
    const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j;
    const h = this.h;
    const h00 = h[j * N + i], h10 = h[j * N + i + 1], h01 = h[(j + 1) * N + i], h11 = h[(j + 1) * N + i + 1];
    if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
    return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  }

  slope(x, z) {
    const e = 1.0;
    const dx = this.getHeight(x + e, z) - this.getHeight(x - e, z);
    const dz = this.getHeight(x, z + e) - this.getHeight(x, z - e);
    return Math.hypot(dx, dz) / (2 * e);
  }

  buildRail() {
    const curve = new THREE.CatmullRomCurve3(RAIL.map((p) => new THREE.Vector3(p[0], 0, p[1])));
    const len = curve.getLength();
    const n = Math.ceil(len / 1.0);
    const pts = curve.getSpacedPoints(n);
    const raw = pts.map((p) => Math.max(this.getHeight(p.x, p.z), 0));
    const ys = raw.map((_, k) => {
      let s = 0, c = 0;
      for (let o = -16; o <= 16; o++) { s += raw[clamp(k + o, 0, n)]; c++; }
      return Math.max(s / c, 0.06);
    });
    const best = new Float32Array(N * N), target = new Float32Array(N * N);
    const R = 7;
    pts.forEach((p, k) => {
      const i0 = Math.max(0, Math.floor((p.x - R + HALF) / STEP)), i1 = Math.min(SEG, Math.ceil((p.x + R + HALF) / STEP));
      const j0 = Math.max(0, Math.floor((p.z - R + HALF) / STEP)), j1 = Math.min(SEG, Math.ceil((p.z + R + HALF) / STEP));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const d = Math.hypot(-HALF + i * STEP - p.x, -HALF + j * STEP - p.z);
          const w = 1 - smoothstep(2.6, R, d);
          const idx = j * N + i;
          if (w > best[idx]) { best[idx] = w; target[idx] = ys[k] - 0.32; }
        }
      }
    });
    for (let k = 0; k < N * N; k++) {
      if (best[k] > 0) this.h[k] = lerp(this.h[k], target[k], best[k]);
      this.railMask[k] = best[k];
    }
    this.rail = { curve, pts, ys, len };
  }

  railHeightAt(k) { return this.rail.ys[clamp(k, 0, this.rail.ys.length - 1)]; }

  buildMesh(material) {
    const g = new THREE.PlaneGeometry(HALF * 2, HALF * 2, SEG, SEG);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let k = 0; k < pos.count; k++) {
      pos.setY(k, this.h[k]);
      const y = this.h[k];
      uv.setXY(k, (pos.getX(k) + y * 0.7) / 5, (pos.getZ(k) - y) / 5);
    }
    g.computeVertexNormals();
    const nrm = g.attributes.normal;
    const cols = new Float32Array(pos.count * 3);
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), z = pos.getZ(k), h = pos.getY(k), ny = nrm.getY(k);
      const n1 = fbm(x * 0.05, z * 0.05, 3, 21), n2 = fbm(x * 0.21, z * 0.21, 2, 33);
      let c = mix3(C.grassB, C.grassA, n1);
      const dp = Math.hypot(x - PASTURE.x, z - PASTURE.z);
      c = mix3(c, C.pasture, (1 - smoothstep(40, 70, dp)) * 0.7);
      c = mix3(c, C.moss, smoothstep(0.55, 0.72, n2) * 0.7);
      const rock = Math.max(smoothstep(0.86, 0.62, ny), smoothstep(16, 26, h) * 0.6);
      c = mix3(c, mix3(C.rock.map((v) => v * (0.75 + n2 * 0.5)), C.moss, smoothstep(0.45, 0.7, n1) * 0.55), rock);
      c = mix3(c, C.mud, smoothstep(0.9, 0.15, h) * 0.8);
      if (h < -0.15) c = mix3(c, C.bed, smoothstep(-0.15, -0.5, h));
      let dpath = Infinity;
      for (const p of PATHS) dpath = Math.min(dpath, distToPolyline(x, z, p));
      c = mix3(c, C.path, (1 - smoothstep(1.2, 2.8, dpath)) * 0.85 * (h > 0.1 ? 1 : 0));
      c = mix3(c, C.ballast, this.railMask[k] * (h > -0.1 ? 1 : 0.3));
      cols[k * 3] = c[0] * 1.35; cols[k * 3 + 1] = c[1] * 1.35; cols[k * 3 + 2] = c[2] * 1.35;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const mesh = new THREE.Mesh(g, material);
    mesh.name = 'terrain';
    this.mesh = mesh;
    return mesh;
  }
}
