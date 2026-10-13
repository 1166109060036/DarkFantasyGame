// Furniture and clutter from assets/props/interior.glb (tools/import-props.mjs): Sketchfab's
// "Fantasy Interior Items" by tediuminteractive and "Notice board low-poly" by Viktor_, both
// CC-BY-4.0, cut down to PS2 budgets with 128 px textures.
//
// The library loads once, in the background. Static props go into a PropBatch, which merges them
// per material into a handful of meshes once the library is in (a tavern full of tables, stools
// and bottles is a few draw calls); a prop that has to move (a chest's lid) is a propObject, a
// group that fills itself when the model arrives. Names are the kit's, with spaces as underscores
// ("Table_-_Round", "Candlestick_Table").
//
// Facing: most items face +z (the chest's lock, the shield, the tapestry, the skull); a chair's
// sitter faces -z; the notice board's front faces +x.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { ps2ify } from './ps2.js';
import { mergeGeometries } from './util.js';

let lib = null;
const TINTED = new Map();
export function loadProps() {
  lib ||= new GLTFLoader().loadAsync('assets/props/interior.glb').then((gltf) => {
    const mats = new Map(), out = {};
    for (const node of gltf.scene.children) {
      node.updateMatrixWorld(true);
      node.traverse((o) => {
        if (!o.isMesh) return;
        const src = o.material;
        let m = mats.get(src.name);
        if (!m) {
          const map = src.map;
          map.magFilter = THREE.NearestFilter;
          map.colorSpace = THREE.NoColorSpace;
          m = ps2ify(new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide }));
          m.name = src.name;
          // (the batches' copy takes a colour per vertex: the tint)
          TINTED.set(m, ps2ify(new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide, vertexColors: true })));
          mats.set(src.name, m);
        }
        o.material = m;
        o.castShadow = o.receiveShadow = false;
      });
      out[node.name] = node;
    }
    return out;
  }).catch((e) => { console.warn('props', e); return null; });
  return lib;
}

const TMP = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), P = new THREE.Vector3();

// every mesh of an item, with its matrix inside the item
function meshesOf(node) {
  const list = [];
  node.traverse((o) => { if (o.isMesh) list.push(o); });
  return list;
}

// static props, merged per material when the library arrives
export class PropBatch {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.meshes = [];
    this.ready = loadProps().then((L) => { if (L) this.build(L); return this; });
  }

  // name: the kit's item; rot: y turn or [x, y, z]; scale: number or [x, y, z]; tint: [r, g, b] multiplies the texture
  add(name, x, y, z, rot = 0, scale = 1, tint = null) {
    this.items.push({ name, x, y, z, rot, scale, tint });
    return this;
  }

  build(L) {
    const byMat = new Map();
    for (const it of this.items) {
      const node = L[it.name];
      if (!node) { console.warn('no prop', it.name); continue; }
      E.set(...(Array.isArray(it.rot) ? it.rot : [0, it.rot, 0]));
      S.set(...(Array.isArray(it.scale) ? it.scale : [it.scale, it.scale, it.scale]));
      TMP.compose(P.set(it.x, it.y, it.z), Q.setFromEuler(E), S);
      for (const m of meshesOf(node)) {
        const g = m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(TMP, m.matrixWorld));
        const n = g.attributes.position.count, col = new Float32Array(n * 3);
        const [r, gg, b] = it.tint || [1, 1, 1];
        for (let i = 0; i < n; i++) { col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b; }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const vm = TINTED.get(m.material);
        (byMat.get(vm) || byMat.set(vm, []).get(vm)).push(g);
      }
    }
    for (const [mat, list] of byMat) {
      const mesh = new THREE.Mesh(mergeGeometries(list), mat);
      mesh.matrixAutoUpdate = false;
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  set visible(v) { for (const m of this.meshes) m.visible = v; this._vis = v; }
}

// one prop as its own object (it moves, or is shown and hidden): fills itself when the model is in
export function propObject(name, tint = null) {
  const grp = new THREE.Group();
  grp.name = name;
  grp.userData.ready = loadProps().then((L) => {
    const node = L?.[name];
    if (!node) return null;
    const c = node.clone(true);
    c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1);
    if (tint) c.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.setRGB(...tint); } });
    grp.add(c);
    return c;
  });
  return grp;
}

// the size of an item once loaded (for pivots and collision)
export async function propBox(name) {
  const L = await loadProps();
  const node = L?.[name];
  return node ? new THREE.Box3().setFromObject(node) : null;
}
