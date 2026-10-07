// Minimal reader for the plain triangle-mesh .glb files that AI model generators export
// (positions + indices, optional normals/colours), used by tools/import-hero.mjs.
import { readFileSync } from 'fs';

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
  const meshes = [];
  for (const m of j.meshes) for (const p of m.primitives) {
    const pa = j.accessors[p.attributes.POSITION];
    meshes.push({
      positions: view(p.attributes.POSITION, Float32Array),
      indices: p.indices != null ? view(p.indices, T[j.accessors[p.indices].componentType]) : null,
      count: pa.count,
    });
  }
  return { json: j, meshes };
}
