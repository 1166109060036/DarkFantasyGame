// Tiny 2.5D collision world: vertical circles (trees, posts) and Y-rotated boxes (ruins, steps).
// Boxes low enough to step onto act as walkable ground.

export class CollisionWorld {
  constructor(cell = 16) {
    this.cell = cell;
    this.map = new Map();
    this.stamp = 0;
    this.out = [];
  }

  insert(obj, minX, maxX, minZ, maxZ) {
    const c = this.cell;
    for (let i = Math.floor(minX / c); i <= Math.floor(maxX / c); i++) {
      for (let j = Math.floor(minZ / c); j <= Math.floor(maxZ / c); j++) {
        const k = i + ',' + j;
        let arr = this.map.get(k);
        if (!arr) this.map.set(k, (arr = []));
        arr.push(obj);
      }
    }
    return obj;
  }

  addCircle(x, z, r, yMin = -1e9, yMax = 1e9) {
    return this.insert({ type: 0, x, z, r, yMin, yMax, q: 0 }, x - r, x + r, z - r, z + r);
  }

  // drop the round obstacles (trees, rocks) inside a circle, e.g. to clear ground for a base
  clearCircles(x, z, r) {
    const c = this.cell;
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++) {
      for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) {
        const arr = this.map.get(i + ',' + j);
        if (arr) this.map.set(i + ',' + j, arr.filter((o) => o.type !== 0 || Math.hypot(o.x - x, o.z - z) > r));
      }
    }
  }

  // centre (x,y,z), half extents, rotation around Y (same convention as Object3D.rotation.y)
  addBox(x, y, z, hx, hy, hz, ry = 0) {
    const R = Math.hypot(hx, hz);
    return this.insert({
      type: 1, x, z, hx, hz, c: Math.cos(ry), s: Math.sin(ry), yMin: y - hy, yMax: y + hy, q: 0,
    }, x - R, x + R, z - R, z + R);
  }

  query(x, z) {
    const c = this.cell, ci = Math.floor(x / c), cj = Math.floor(z / c);
    const out = this.out;
    out.length = 0;
    this.stamp++;
    for (let i = ci - 1; i <= ci + 1; i++) {
      for (let j = cj - 1; j <= cj + 1; j++) {
        const arr = this.map.get(i + ',' + j);
        if (!arr) continue;
        for (const o of arr) {
          if (o.q !== this.stamp) { o.q = this.stamp; out.push(o); }
        }
      }
    }
    return out;
  }

  groundAt(x, z, feetY, stepUp = 0.65) {
    let best = -Infinity;
    for (const o of this.query(x, z)) {
      if (o.type !== 1 || o.yMax > feetY + stepUp || o.yMax <= best) continue;
      const dx = x - o.x, dz = z - o.z;
      const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
      if (Math.abs(lx) <= o.hx + 0.05 && Math.abs(lz) <= o.hz + 0.05) best = o.yMax;
    }
    return best;
  }

  // Push a vertical capsule (feet position p, radius r, height h) out of blocking shapes.
  resolve(p, r, h, stepUp = 0.65) {
    let hit = false;
    for (let iter = 0; iter < 2; iter++) {
      for (const o of this.query(p.x, p.z)) {
        if (o.yMax <= p.y + stepUp || o.yMin >= p.y + h) continue;
        if (o.type === 0) {
          const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), m = o.r + r;
          if (d < m && d > 1e-6) { p.x += dx / d * (m - d); p.z += dz / d * (m - d); hit = true; }
        } else {
          const dx = p.x - o.x, dz = p.z - o.z;
          const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
          const qx = Math.max(-o.hx, Math.min(o.hx, lx)), qz = Math.max(-o.hz, Math.min(o.hz, lz));
          let ex = lx - qx, ez = lz - qz;
          const d = Math.hypot(ex, ez);
          let px = 0, pz = 0;
          if (d > 1e-6) {
            if (d >= r) continue;
            px = ex / d * (r - d); pz = ez / d * (r - d);
          } else {
            const penX = o.hx - Math.abs(lx) + r, penZ = o.hz - Math.abs(lz) + r;
            if (penX < penZ) px = Math.sign(lx || 1) * penX; else pz = Math.sign(lz || 1) * penZ;
          }
          p.x += px * o.c + pz * o.s;
          p.z += -px * o.s + pz * o.c;
          hit = true;
        }
      }
    }
    return hit;
  }
}
