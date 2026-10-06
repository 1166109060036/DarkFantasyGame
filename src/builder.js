// Shared helpers for static architecture: everything added to a StaticBuilder is merged into
// one mesh per material, and solid pieces also register collision boxes.
import * as THREE from 'three';
import { rng } from './noise.js';
import { part, mergeGeometries, boxGeom } from './util.js';

export class StaticBuilder {
  constructor() { this.parts = {}; }
  add(mat, geom) { (this.parts[mat] ||= []).push(geom); }
  build(scene, M) {
    for (const [k, list] of Object.entries(this.parts)) {
      const mesh = new THREE.Mesh(mergeGeometries(list), M[k]);
      mesh.name = 'static-' + k;
      scene.add(mesh);
    }
  }
}

export const r = rng(777);

export const stoneTint = () => new THREE.Color().setRGB(0.8 + r() * 0.35, 0.85 + r() * 0.3, 0.85 + r() * 0.3);

export function block(B, C, mat, { x, y, z, w, h, d, ry = 0, rx = 0, rz = 0, color, collide = true, tex = 2 }) {
  B.add(mat, part(boxGeom(w, h, d, tex), color ?? stoneTint(), { pos: [x, y, z], rot: [rx, ry, rz] }));
  if (collide) C.addBox(x, y, z, w / 2, h / 2, d / 2, ry);
}

// Box resting on the ground with its top at `top` (bottom sunk to `bottom`).
export function slab(B, C, mat, x, z, w, d, bottom, top, opts = {}) {
  block(B, C, mat, { x, y: (bottom + top) / 2, z, w, h: top - bottom, d, ...opts });
}

export function hangingMoss(B, x, y, z, w, h, ry) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  B.add('hangingMoss', part(g, 0xd0e0d0, { pos: [x, y - h / 2, z], rot: [0, ry, 0] }));
}
