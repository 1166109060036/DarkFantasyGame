// Minimal reader for the plain triangle-mesh .glb files that model generators and Sketchfab export
// (positions + indices, optional UVs), used by tools/import-hero.mjs. Positions come back in the
// model's own space (every node's transform applied), so multi-part models line up.
import { readFileSync } from 'fs';

const mul = (a, b) => {                     // column-major 4x4
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
function local(n) {
  if (n.matrix) return n.matrix;
  const [tx, ty, tz] = n.translation || [0, 0, 0], [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

export function readGLB(path) {
  const b = readFileSync(path);
  const jl = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + jl).toString());
  const bin = b.slice(20 + jl + 8);
  const view = (ai, Type) => {
    const a = j.accessors[ai], bv = j.bufferViews[a.bufferView], off = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    const src = bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + a.count * comps * Type.BYTES_PER_ELEMENT);
    return new Type(src);
  };
  const T = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  // world matrix of every node that holds a mesh
  const world = new Map();
  const walk = (ni, parent) => {
    const n = j.nodes[ni], m = mul(parent, local(n));
    if (n.mesh != null) world.set(ni, m);
    for (const c of n.children || []) walk(c, m);
  };
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const ni of j.scenes?.[j.scene || 0]?.nodes || j.nodes.map((_, i) => i)) walk(ni, I);
  if (!world.size) j.nodes.forEach((n, i) => { if (n.mesh != null) world.set(i, I); });
  const meshes = [];
  for (const [ni, m] of world) {
    for (const p of j.meshes[j.nodes[ni].mesh].primitives) {
      const pa = j.accessors[p.attributes.POSITION], raw = view(p.attributes.POSITION, Float32Array);
      const positions = new Float32Array(raw.length);
      for (let i = 0; i < raw.length; i += 3) {
        const x = raw[i], y = raw[i + 1], z = raw[i + 2];
        positions[i] = m[0] * x + m[4] * y + m[8] * z + m[12];
        positions[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
        positions[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      }
      meshes.push({
        name: j.nodes[ni].name,
        positions,
        uvs: p.attributes.TEXCOORD_0 != null ? view(p.attributes.TEXCOORD_0, Float32Array) : null,
        indices: p.indices != null ? view(p.indices, T[j.accessors[p.indices].componentType]) : null,
        count: pa.count,
        material: p.material,
      });
    }
  }
  // embedded images, as raw bytes
  const image = (i) => {
    const im = j.images?.[i];
    if (!im || im.bufferView == null) return null;
    const bv = j.bufferViews[im.bufferView];
    return { mime: im.mimeType, bytes: bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength) };
  };
  return { json: j, meshes, image };
}
