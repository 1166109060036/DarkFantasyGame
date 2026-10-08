import * as THREE from 'three';
import { fbm } from './noise.js';
import { clamp, lerp, smoothstep, distToPolyline } from './util.js';
import {
  PASTURE, TOAD, TEMPLE, RIVER, RAIL, PATHS, CASTLE, HEAD, STREAM, TAVERN, HOUSES, SMITH,
  BELLTOWER, STONES, WINDMILL, FARMS, LAKE, PIER, HANGTREE, HUNTER, ROADS,
} from './layout.js';

// The world: 1600 m square at 2.5 m per height sample. The old valley keeps its exact shape in
// the middle; beyond it the land turns into four regions (outerHeight) and is closed by mountains.
export const HALF = 800;
export const SEG = 640;
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

function innerHeight(x, z, withSites = true) {
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

  return h;
}

const gauss = (x, z, cx, cz, r) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * r * r));

// the four regions beyond the valley, blended by direction
function outerHeight(x, z) {
  const n = fbm(x * 0.005 + 40, z * 0.005 - 13, 5, 61), n2 = fbm(x * 0.03, z * 0.03, 3, 62);
  // north: windy highland of rolling crests and tors; the bell tower stands on the highest hill
  let north = 24 + (n - 0.45) * 40 + Math.abs(n2 - 0.5) * 10;
  north += 26 * gauss(x, z, BELLTOWER.x, BELLTOWER.z, 70);
  north = flatten(north, x, z, BELLTOWER.x, BELLTOWER.z, 18, 50);
  north = flatten(north, x, z, STONES.x, STONES.z, 28, 26);
  // east: low open farmland, a knoll for the windmill
  let east = 3.2 + (n - 0.45) * 7 + (n2 - 0.5) * 1.2;
  east += 7 * gauss(x, z, WINDMILL.x, WINDMILL.z, 34);
  east = flatten(east, x, z, FARMS.x, FARMS.z, 55, 3.4);
  // south: the swamp sinks into a great lake; the drowned city lies in its middle
  const dl = Math.hypot(x - LAKE.x, (z - LAKE.z) * 1.15);
  let south = 0.6 + (n - 0.5) * 3.5 + (n2 - 0.5) * 0.8;
  // wading-deep, like the castle lake: deep enough to slow you, never over your head
  south = lerp(-1.15 + (n2 - 0.5) * 0.4, south, smoothstep(LAKE.r - 30, LAKE.r + 25, dl));
  south = flatten(south, x, z, PIER.x, PIER.z, 14, 1.1);
  // west: steep forested hills and hollows; a clearing round the hanging tree
  let west = 7 + (n - 0.42) * 30 + (n2 - 0.5) * 3;
  west = flatten(west, x, z, HANGTREE.x, HANGTREE.z, 26, 9);
  west = flatten(west, x, z, HUNTER.x, HUNTER.z, 16, Math.max(3, west));
  const wn = Math.max(0, -z) ** 2, ws = Math.max(0, z) ** 2, we = Math.max(0, x) ** 2, ww = Math.max(0, -x) ** 2;
  const sum = wn + ws + we + ww + 1e-6;
  return (north * wn + south * ws + east * we + west * ww) / sum;
}

// which region a point belongs to (0..1 each), for colours and plants
export function regionWeights(x, z) {
  const e = Math.max(Math.abs(x), Math.abs(z)), t = smoothstep(270, 380, e);
  const wn = Math.max(0, -z) ** 2, ws = Math.max(0, z) ** 2, we = Math.max(0, x) ** 2, ww = Math.max(0, -x) ** 2;
  const sum = wn + ws + we + ww + 1e-6;
  return { wild: t, north: t * wn / sum, south: t * ws / sum, east: t * we / sum, west: t * ww / sum };
}

export function baseHeight(x, z, withSites = true) {
  const e = Math.max(Math.abs(x), Math.abs(z));
  const t = smoothstep(260, 380, e);
  let h = t < 1 ? innerHeight(x, z, withSites) : 0;
  if (t > 0) h = lerp(h, outerHeight(x, z), t);
  // mountains close the world
  if (e > 735) {
    const k = e - 735;
    h += k * k * 0.03 + k * 0.4 + (fbm(x * 0.03, z * 0.03, 3, 4) - 0.5) * k * 0.35;
  }
  return h;
}

const C = {
  grassA: [0.17, 0.31, 0.16], grassB: [0.1, 0.21, 0.12], moss: [0.2, 0.37, 0.14],
  rock: [0.4, 0.43, 0.5], mud: [0.12, 0.14, 0.11], bed: [0.06, 0.1, 0.12],
  path: [0.33, 0.31, 0.25], ballast: [0.24, 0.24, 0.26], pasture: [0.22, 0.34, 0.2],
  highland: [0.22, 0.27, 0.18], heather: [0.25, 0.19, 0.22],
  dryGrass: [0.3, 0.29, 0.15], stubble: [0.36, 0.32, 0.18], furrow: [0.2, 0.15, 0.1],
  deepMoss: [0.06, 0.15, 0.08],
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
    this.roadMask = new Float32Array(N * N);
    this.buildRail();
    this.roads = ROADS.map((poly) => this.gradeRoad(poly));
  }

  // a dirt road out of the valley: smoothed to a walkable grade, kept above water, marked for paint
  gradeRoad(poly) {
    const curve = new THREE.CatmullRomCurve3(poly.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const n = Math.ceil(curve.getLength() / 1.5), pts = curve.getSpacedPoints(n);
    const raw = pts.map((p) => this.getHeight(p.x, p.z));
    const ys = raw.map((_, k) => { let sum = 0, c = 0; for (let o = -10; o <= 10; o++) { sum += raw[clamp(k + o, 0, n)]; c++; } return Math.max(sum / c, 0.4); });
    const best = new Float32Array(N * N), target = new Float32Array(N * N), R = 7;
    pts.forEach((p, k) => {
      const i0 = Math.max(0, Math.floor((p.x - R + HALF) / STEP)), i1 = Math.min(SEG, Math.ceil((p.x + R + HALF) / STEP));
      const j0 = Math.max(0, Math.floor((p.z - R + HALF) / STEP)), j1 = Math.min(SEG, Math.ceil((p.z + R + HALF) / STEP));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const d = Math.hypot(-HALF + i * STEP - p.x, -HALF + j * STEP - p.z), w = 1 - smoothstep(2.4, R, d), idx = j * N + i;
          if (w > best[idx]) { best[idx] = w; target[idx] = ys[k] - 0.05; }
        }
      }
    });
    for (let k = 0; k < N * N; k++) {
      if (best[k] <= 0 || this.railMask[k] > best[k]) continue;
      this.h[k] = lerp(this.h[k], target[k], best[k]);
      this.roadMask[k] = Math.max(this.roadMask[k], best[k]);
    }
    return pts;
  }

  // how much road is under (x, z): 1 on the dirt, 0 a few metres off it
  roadAt(x, z) {
    const i = Math.round(clamp((x + HALF) / STEP, 0, SEG)), j = Math.round(clamp((z + HALF) / STEP, 0, SEG));
    return this.roadMask[j * N + i];
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

  // The ground is drawn in chunks so only the ones near the camera (and inside the fog) are sent
  // to the GPU. Normals come straight from the height grid, so the chunks meet without seams.
  buildMesh(material) {
    const group = new THREE.Group();
    group.name = 'terrain';
    const CH = 64, CHUNKS = SEG / CH;
    const H = this.h, sx = 1 / (2 * STEP);
    const at = (i, j) => H[clamp(j, 0, SEG) * N + clamp(i, 0, SEG)];
    this.chunks = [];
    for (let cj = 0; cj < CHUNKS; cj++) {
      for (let ci = 0; ci < CHUNKS; ci++) {
        const V = (CH + 1) * (CH + 1), pos = new Float32Array(V * 3), nor = new Float32Array(V * 3), uv = new Float32Array(V * 2), col = new Float32Array(V * 3);
        let v = 0;
        for (let jj = 0; jj <= CH; jj++) {
          for (let ii = 0; ii <= CH; ii++, v++) {
            const i = ci * CH + ii, j = cj * CH + jj, x = -HALF + i * STEP, z = -HALF + j * STEP, y = H[j * N + i];
            pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
            const nx = (at(i - 1, j) - at(i + 1, j)) * sx, nz = (at(i, j - 1) - at(i, j + 1)) * sx, nl = Math.hypot(nx, 1, nz);
            nor[v * 3] = nx / nl; nor[v * 3 + 1] = 1 / nl; nor[v * 3 + 2] = nz / nl;
            uv[v * 2] = (x + y * 0.7) / 5; uv[v * 2 + 1] = (z - y) / 5;
            const c = this.groundColour(x, z, y, 1 / nl, j * N + i);
            col[v * 3] = c[0] * 1.35; col[v * 3 + 1] = c[1] * 1.35; col[v * 3 + 2] = c[2] * 1.35;
          }
        }
        const idx = new Uint32Array(CH * CH * 6);
        let o = 0;
        for (let jj = 0; jj < CH; jj++) {
          for (let ii = 0; ii < CH; ii++) {
            const a = jj * (CH + 1) + ii, b = a + 1, c = a + CH + 1, d = c + 1;
            idx[o++] = a; idx[o++] = c; idx[o++] = b; idx[o++] = b; idx[o++] = c; idx[o++] = d;
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        g.setIndex(new THREE.BufferAttribute(idx, 1));
        g.computeBoundingSphere();
        const mesh = new THREE.Mesh(g, material);
        mesh.name = 'terrain';
        const half = CH * STEP / 2;
        mesh.userData.cx = -HALF + ci * CH * STEP + half;
        mesh.userData.cz = -HALF + cj * CH * STEP + half;
        group.add(mesh);
        this.chunks.push(mesh);
      }
    }
    this.mesh = group;
    return group;
  }

  // chunks beyond the fog are skipped altogether
  updateVisibility(cam, far = 430) {
    const r = 64 * STEP * 0.71;
    for (const m of this.chunks || []) m.visible = Math.hypot(m.userData.cx - cam.x, m.userData.cz - cam.z) - r < far;
  }

  groundColour(x, z, h, ny, k) {
    const n1 = fbm(x * 0.05, z * 0.05, 3, 21), n2 = fbm(x * 0.21, z * 0.21, 2, 33);
    const rw = regionWeights(x, z);
    let c = mix3(C.grassB, C.grassA, n1);
    if (rw.wild < 1) {
      const dp = Math.hypot(x - PASTURE.x, z - PASTURE.z);
      c = mix3(c, C.pasture, (1 - smoothstep(40, 70, dp)) * 0.7);
    }
    // the regions' own ground
    if (rw.north > 0.01) c = mix3(c, mix3(C.highland, C.heather, smoothstep(0.55, 0.7, n2)), rw.north);
    if (rw.east > 0.01) {
      let f = mix3(C.dryGrass, C.stubble, n1);
      const df = Math.hypot(x - FARMS.x, z - FARMS.z);
      if (df < 110) f = mix3(f, Math.sin(x * 0.55 + z * 0.12) > 0.2 ? C.furrow : C.stubble, (1 - smoothstep(70, 110, df)) * 0.8);    // ploughed rows
      c = mix3(c, f, rw.east);
    }
    if (rw.south > 0.01) c = mix3(c, C.mud.map((v) => v * 1.4), rw.south * 0.6);
    if (rw.west > 0.01) c = mix3(c, C.deepMoss, rw.west * 0.8);
    c = mix3(c, C.moss, smoothstep(0.55, 0.72, n2) * 0.7 * (1 - rw.east));
    const rock = Math.max(smoothstep(0.86, 0.62, ny), smoothstep(16, 26, h) * 0.6 * (1 - rw.north * 0.6));
    c = mix3(c, mix3(C.rock.map((v) => v * (0.75 + n2 * 0.5)), C.moss, smoothstep(0.45, 0.7, n1) * 0.55), rock);
    c = mix3(c, C.mud, smoothstep(0.9, 0.15, h) * 0.8);
    if (h < -0.15) c = mix3(c, C.bed, smoothstep(-0.15, -0.5, h));
    if (Math.abs(x) < 330 && Math.abs(z) < 330) {
      let dpath = Infinity;
      for (const p of PATHS) dpath = Math.min(dpath, distToPolyline(x, z, p));
      c = mix3(c, C.path, (1 - smoothstep(1.2, 2.8, dpath)) * 0.85 * (h > 0.1 ? 1 : 0));
    }
    c = mix3(c, C.path, smoothstep(0.35, 0.8, this.roadMask[k]) * 0.9);
    c = mix3(c, C.ballast, this.railMask[k] * (h > -0.1 ? 1 : 0.3));
    return c;
  }
}
