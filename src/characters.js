// Low-poly characters assembled from primitives (PS2 budget: a few hundred triangles each).
import * as THREE from 'three';
import { part, mergeGeometries } from './util.js';

const C = (r, g, b) => new THREE.Color(r, g, b);
const sphere = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);

function meshOf(parts, mat) {
  const m = new THREE.Mesh(mergeGeometries(parts), mat);
  return m;
}

export function blobShadow(M, size = 1.6) {
  const g = new THREE.PlaneGeometry(size, size);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, M.shadow);
  m.renderOrder = 1;
  return m;
}

// The toad crone: sits under the giant mushroom, cradling a pot of gold (image 2).
export function createToad(M) {
  const g = new THREE.Group();
  const skin = [
    part(sphere(0.75, 12, 10), 0xffffff, { pos: [0, 0.72, 0], scale: [1.05, 0.95, 0.9] }),
    part(sphere(0.55, 12, 8), 0xffffff, { pos: [0, 1.58, 0.08], scale: [1.18, 0.68, 1.0] }),
    part(sphere(0.16, 8, 6), 0xffffff, { pos: [-0.3, 1.78, 0.32] }),
    part(sphere(0.16, 8, 6), 0xffffff, { pos: [0.3, 1.78, 0.32] }),
    part(sphere(0.22, 8, 6), 0xd8d0c0, { pos: [-0.45, 0.12, 0.62], scale: [1, 0.45, 1.5] }),
    part(sphere(0.22, 8, 6), 0xd8d0c0, { pos: [0.45, 0.12, 0.62], scale: [1, 0.45, 1.5] }),
    part(sphere(0.13, 6, 5), 0xffffff, { pos: [-0.36, 1.0, 0.66], scale: [1.3, 0.8, 1] }),
    part(sphere(0.13, 6, 5), 0xffffff, { pos: [0.3, 1.02, 0.7], scale: [1.3, 0.8, 1] }),
  ];
  g.add(meshOf(skin, M.toadSkin));
  const cloth = [
    part(new THREE.LatheGeometry([
      new THREE.Vector2(1.0, 0.05), new THREE.Vector2(0.98, 0.4), new THREE.Vector2(0.85, 0.85),
      new THREE.Vector2(0.62, 1.2), new THREE.Vector2(0.45, 1.32),
    ], 12, Math.PI * 0.12, Math.PI * 1.76), 0xffffff, { pos: [0, 0, 0] }),
  ];
  g.add(meshOf(cloth, M.cloth));
  const plain = [
    part(new THREE.TorusGeometry(0.48, 0.17, 6, 12), C(0.42, 0.25, 0.16), { pos: [0, 1.3, 0.02], rot: [Math.PI / 2 + 0.15, 0, 0], scale: [1.1, 1, 1] }),
    part(new THREE.CylinderGeometry(0.4, 0.48, 0.24, 10), C(0.32, 0.22, 0.18), { pos: [0, 1.98, 0.02], rot: [-0.12, 0, 0.05] }),
    part(new THREE.CylinderGeometry(0.66, 0.66, 0.05, 12), C(0.28, 0.2, 0.16), { pos: [0, 1.87, 0.04], rot: [-0.12, 0, 0.05] }),
    part(sphere(0.07, 6, 4), C(0.05, 0.04, 0.02), { pos: [-0.31, 1.82, 0.46] }),
    part(sphere(0.07, 6, 4), C(0.05, 0.04, 0.02), { pos: [0.31, 1.82, 0.46] }),
    part(new THREE.BoxGeometry(0.5, 0.014, 0.04), C(0.12, 0.09, 0.06), { pos: [0, 1.48, 0.6] }),
    // clay pot + wooden spoon
    part(new THREE.LatheGeometry([
      new THREE.Vector2(0.01, 0), new THREE.Vector2(0.2, 0.02), new THREE.Vector2(0.3, 0.18),
      new THREE.Vector2(0.27, 0.36), new THREE.Vector2(0.2, 0.42), new THREE.Vector2(0.22, 0.46),
    ], 10), C(0.62, 0.3, 0.22), { pos: [0.18, 0.72, 0.78] }),
    part(new THREE.CylinderGeometry(0.03, 0.03, 0.95, 5), C(0.45, 0.32, 0.2), { pos: [-0.1, 1.08, 0.74], rot: [0, 0, 1.2] }),
  ];
  g.add(meshOf(plain, M.plain));
  const gold = [part(sphere(0.21, 8, 5), 0xffffff, { pos: [0.18, 1.2, 0.78], scale: [1, 0.45, 1] })];
  g.add(meshOf(gold, M.gold));
  return g;
}

// Hooded crow-headed shepherd with glowing eyes (image 4).
export function createCrow(M, { statue = false } = {}) {
  const g = new THREE.Group();
  const featherMat = statue ? M.stone : M.feather;
  const clothMat = statue ? M.stone : M.plain;
  const body = [
    part(new THREE.LatheGeometry([
      new THREE.Vector2(0.62, 0), new THREE.Vector2(0.55, 0.4), new THREE.Vector2(0.44, 1.0),
      new THREE.Vector2(0.4, 1.4), new THREE.Vector2(0.3, 1.62), new THREE.Vector2(0.12, 1.7),
    ], 10), C(0.17, 0.18, 0.25)),
    part(sphere(0.28, 10, 8), C(0.16, 0.17, 0.24), { pos: [0, 1.88, 0.06], scale: [1, 1.05, 1.1] }),
    part(new THREE.ConeGeometry(0.11, 0.62, 6), C(0.3, 0.32, 0.4), { pos: [0, 1.8, 0.44], rot: [Math.PI / 2 + 0.3, 0, 0] }),
    part(new THREE.CylinderGeometry(0.1, 0.12, 0.62, 6), C(0.17, 0.18, 0.25), { pos: [0.4, 1.35, 0.2], rot: [-0.9, 0, -0.35] }),
    part(new THREE.CylinderGeometry(0.1, 0.12, 0.62, 6), C(0.17, 0.18, 0.25), { pos: [-0.4, 1.35, 0.2], rot: [-0.9, 0, 0.35] }),
    part(sphere(0.1, 6, 5), C(0.35, 0.38, 0.45), { pos: [0.33, 1.15, 0.47] }),
    part(sphere(0.1, 6, 5), C(0.35, 0.38, 0.45), { pos: [-0.33, 1.15, 0.47] }),
  ];
  const hood = [
    part(sphere(0.48, 10, 8, 0), C(0.3, 0.36, 0.3), { pos: [0, 1.58, -0.02], scale: [1.25, 0.55, 1.05] }),
    part(new THREE.SphereGeometry(0.36, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), C(0.3, 0.36, 0.3), { pos: [0, 1.9, -0.04], rot: [-0.35, 0, 0], scale: [1.05, 1.2, 1.1] }),
    part(new THREE.TorusGeometry(0.42, 0.05, 4, 12), C(0.35, 0.28, 0.2), { pos: [0, 1.0, 0], rot: [Math.PI / 2, 0, 0] }),
  ];
  const bodyMesh = meshOf(body, featherMat);
  g.add(bodyMesh, meshOf(hood, clothMat));
  const eyes = new THREE.Group();
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(sphere(0.06, 6, 4), M.eyes);
    e.position.set(s * 0.15, 1.93, 0.26);
    eyes.add(e);
  }
  g.add(eyes);
  g.userData.head = [eyes];
  return g;
}

// Black sheep: wool body + dark face/legs, 2 meshes.
let sheepGeoms = null;
export function createSheep(M) {
  if (!sheepGeoms) {
    sheepGeoms = {
      wool: mergeGeometries([
        part(new THREE.IcosahedronGeometry(0.5, 1), C(0.42, 0.42, 0.5), { pos: [0, 0.78, 0], scale: [0.85, 0.78, 1.18] }),
        part(new THREE.IcosahedronGeometry(0.2, 1), C(0.42, 0.42, 0.5), { pos: [0, 1.05, 0.5] }),
      ]),
      skin: mergeGeometries([
        part(sphere(0.17, 7, 5), C(0.16, 0.16, 0.2), { pos: [0, 0.98, 0.7], scale: [0.8, 0.9, 1.35] }),
        part(new THREE.BoxGeometry(0.2, 0.05, 0.08), C(0.16, 0.16, 0.2), { pos: [0.16, 1.04, 0.62], rot: [0, 0.4, -0.5] }),
        part(new THREE.BoxGeometry(0.2, 0.05, 0.08), C(0.16, 0.16, 0.2), { pos: [-0.16, 1.04, 0.62], rot: [0, -0.4, 0.5] }),
        ...[[0.2, 0.32], [-0.2, 0.32], [0.2, -0.36], [-0.2, -0.36]].map(([x, z]) =>
          part(new THREE.CylinderGeometry(0.055, 0.045, 0.6, 5), C(0.12, 0.12, 0.15), { pos: [x, 0.3, z] })),
      ]),
    };
  }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(sheepGeoms.wool, M.wool), new THREE.Mesh(sheepGeoms.skin, M.plain));
  return g;
}

// Will-o'-wisp: unlit core + additive halo sprite; bloom does the rest.
export function createWisp(M) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 1.2, 1.8) }));
  const halo = new THREE.Sprite(M.sprite);
  halo.scale.setScalar(1.8);
  const tail = new THREE.Sprite(M.sprite);
  tail.scale.setScalar(0.9);
  g.add(core, halo, tail);
  g.userData = { core, halo, tail };
  return g;
}

// First-person view model: a worn sword and a moon-lantern.
export function createViewModel(M) {
  const root = new THREE.Group();
  const sword = new THREE.Group();
  const blade = mergeGeometries([
    part(new THREE.BoxGeometry(0.06, 0.82, 0.014), C(0.75, 0.8, 0.9), { pos: [0, 0.53, 0] }),
    part(new THREE.ConeGeometry(0.043, 0.14, 4), C(0.75, 0.8, 0.9), { pos: [0, 1.0, 0], rot: [0, Math.PI / 4, 0], scale: [1, 1, 0.33] }),
    part(new THREE.BoxGeometry(0.012, 0.7, 0.016), C(0.45, 0.5, 0.6), { pos: [0, 0.5, 0] }),
  ]);
  sword.add(new THREE.Mesh(blade, M.metal));
  const hilt = mergeGeometries([
    part(new THREE.BoxGeometry(0.18, 0.035, 0.04), C(0.5, 0.42, 0.3), { pos: [0, 0.11, 0] }),
    part(new THREE.CylinderGeometry(0.022, 0.024, 0.2, 6), C(0.3, 0.22, 0.16), { pos: [0, 0, 0] }),
    part(sphere(0.035, 6, 4), C(0.55, 0.45, 0.3), { pos: [0, -0.11, 0] }),
  ]);
  sword.add(new THREE.Mesh(hilt, M.plain));
  sword.scale.setScalar(0.62);
  sword.position.set(0.34, -0.4, -0.62);
  sword.rotation.set(-1.05, -0.25, -0.3);
  root.add(sword);

  const lantern = new THREE.Group();
  const frame = mergeGeometries([
    part(new THREE.BoxGeometry(0.15, 0.02, 0.15), C(0.35, 0.33, 0.3), { pos: [0, 0.11, 0] }),
    part(new THREE.BoxGeometry(0.15, 0.02, 0.15), C(0.35, 0.33, 0.3), { pos: [0, -0.11, 0] }),
    ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([x, z]) => part(new THREE.BoxGeometry(0.015, 0.22, 0.015), C(0.3, 0.28, 0.26), { pos: [x * 0.065, 0, z * 0.065] })),
    part(new THREE.TorusGeometry(0.05, 0.008, 4, 10), C(0.35, 0.33, 0.3), { pos: [0, 0.16, 0] }),
  ]);
  lantern.add(new THREE.Mesh(frame, M.metal));
  const flame = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 1.0, 1.6) }));
  lantern.add(flame);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.35, 0.6), transparent: true, opacity: 0.35, depthWrite: false }));
  lantern.add(glass);
  lantern.scale.setScalar(0.5);
  lantern.position.set(-0.3, -0.36, -0.5);
  root.add(lantern);

  root.userData = { sword, lantern, flame };
  return root;
}

// The barkeep of the Melting Candle: a gentleman in black whose head is a cluster of guttering candles.
export function createCandleHead(M) {
  const g = new THREE.Group();
  const coat = [
    part(new THREE.LatheGeometry([
      new THREE.Vector2(0.42, 0), new THREE.Vector2(0.4, 0.5), new THREE.Vector2(0.36, 1.1),
      new THREE.Vector2(0.42, 1.45), new THREE.Vector2(0.2, 1.62), new THREE.Vector2(0.08, 1.66),
    ], 10), C(0.09, 0.09, 0.11)),
    part(new THREE.CylinderGeometry(0.09, 0.11, 0.62, 6), C(0.09, 0.09, 0.11), { pos: [0.42, 1.2, 0.18], rot: [-1.0, 0, -0.3] }),
    part(new THREE.CylinderGeometry(0.09, 0.11, 0.62, 6), C(0.09, 0.09, 0.11), { pos: [-0.42, 1.2, 0.18], rot: [-1.0, 0, 0.3] }),
    part(sphere(0.09, 6, 5), C(0.55, 0.5, 0.45), { pos: [0.36, 1.0, 0.45] }),
    part(sphere(0.09, 6, 5), C(0.55, 0.5, 0.45), { pos: [-0.36, 1.0, 0.45] }),
    part(new THREE.BoxGeometry(0.2, 0.5, 0.02), C(0.55, 0.5, 0.48), { pos: [0, 1.35, 0.36], rot: [-0.15, 0, 0] }),
  ];
  g.add(meshOf(coat, M.plain));
  const wax = [part(sphere(0.3, 10, 6), C(0.86, 0.83, 0.74), { pos: [0, 1.74, 0], scale: [1, 0.55, 1] })];
  const flames = [];
  const candle = (x, y, z, h, r) => {
    wax.push(part(new THREE.CylinderGeometry(r, r * 1.1, h, 7), C(0.85 + Math.random() * 0.1, 0.82, 0.72), { pos: [x, y + h / 2, z], rot: [(Math.random() - 0.5) * 0.25, 0, (Math.random() - 0.5) * 0.25] }));
    wax.push(part(sphere(r * 0.6, 5, 4), C(0.9, 0.88, 0.78), { pos: [x + r * 0.8, y + h * 0.55, z], scale: [0.7, 2.4, 0.7] }));
    flames.push(part(new THREE.ConeGeometry(r * 0.55, r * 2.2, 5), C(1.7, 0.95, 0.45), { pos: [x, y + h + r * 1.1, z] }));
  };
  candle(0, 1.82, 0, 0.42, 0.06);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; candle(Math.cos(a) * 0.15, 1.8, Math.sin(a) * 0.15, 0.26 + Math.random() * 0.1, 0.05); }
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + 0.3; candle(Math.cos(a) * 0.28, 1.72, Math.sin(a) * 0.28, 0.14 + Math.random() * 0.1, 0.045); }
  g.add(meshOf(wax, M.plain), meshOf(flames, M.glow));
  const halo = new THREE.Sprite(M.candleSprite);
  halo.position.set(0, 2.2, 0);
  halo.scale.setScalar(1.6);
  g.add(halo);
  g.userData.halo = halo;
  return g;
}

// Seated tavern patron. Faces +z, sitting with hips at y = 0.48.
export function createPatron(M, color, { hood = true, skin = C(0.5, 0.42, 0.36) } = {}) {
  const g = new THREE.Group();
  const body = [
    part(new THREE.CylinderGeometry(0.2, 0.27, 0.7, 7), color, { pos: [0, 0.85, 0], rot: [0.12, 0, 0] }),
    part(new THREE.BoxGeometry(0.42, 0.16, 0.5), color.clone().multiplyScalar(0.7), { pos: [0, 0.5, 0.18] }),
    part(new THREE.BoxGeometry(0.4, 0.45, 0.14), color.clone().multiplyScalar(0.7), { pos: [0, 0.25, 0.42] }),
    part(new THREE.CylinderGeometry(0.065, 0.075, 0.5, 5), color, { pos: [0.24, 0.98, 0.2], rot: [-1.2, 0, -0.2] }),
    part(new THREE.CylinderGeometry(0.065, 0.075, 0.5, 5), color, { pos: [-0.24, 0.98, 0.2], rot: [-1.2, 0, 0.2] }),
  ];
  if (hood) body.push(part(new THREE.SphereGeometry(0.21, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), color.clone().multiplyScalar(0.8), { pos: [0, 1.36, -0.02], rot: [-0.3, 0, 0], scale: [1, 1.15, 1.05] }));
  g.add(meshOf(body, M.plain));
  const head = [
    part(sphere(0.15, 8, 6), skin, { pos: [0, 1.34, 0.04] }),
    part(sphere(0.06, 5, 4), skin, { pos: [0.24, 1.08, 0.42] }),
    part(sphere(0.06, 5, 4), skin, { pos: [-0.24, 1.08, 0.42] }),
    part(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 7), C(0.5, 0.36, 0.22), { pos: [0.24, 1.15, 0.45] }),
  ];
  g.add(meshOf(head, M.plain));
  return g;
}

// ---------------------------------------------------------------- enemies
// Each enemy merges its static parts per material and keeps only the animated pieces separate.

// Scarecrow that wakes in daylight and hops after you, ember eyes glowing.
export function createStrawman(M) {
  const g = new THREE.Group();
  const straw = C(0.66, 0.53, 0.28), sack = C(0.55, 0.45, 0.32), coat = C(0.32, 0.26, 0.24);
  const body = [
    part(new THREE.LatheGeometry([
      new THREE.Vector2(0.26, 0.55), new THREE.Vector2(0.36, 0.85), new THREE.Vector2(0.34, 1.3), new THREE.Vector2(0.22, 1.56),
    ], 8), coat),
    part(sphere(0.24, 8, 6), sack, { pos: [0, 1.82, 0], scale: [1, 1.1, 0.95] }),
    part(new THREE.BoxGeometry(0.2, 0.02, 0.02), C(0.08, 0.05, 0.04), { pos: [0, 1.72, 0.22], rot: [0, 0, 0.15] }),
    part(new THREE.CylinderGeometry(0.46, 0.46, 0.03, 10), C(0.25, 0.18, 0.13), { pos: [0, 2.0, 0], rot: [0.12, 0, 0.1] }),
    part(new THREE.ConeGeometry(0.22, 0.42, 8), C(0.25, 0.18, 0.13), { pos: [0, 2.2, -0.02], rot: [0.1, 0, 0.18] }),
  ];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    body.push(part(new THREE.ConeGeometry(0.05, 0.4, 4), straw, { pos: [Math.cos(a) * 0.26, 0.42, Math.sin(a) * 0.26], rot: [Math.PI + Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3] }));
  }
  g.add(meshOf(body, M.plain));
  g.add(meshOf([part(new THREE.CylinderGeometry(0.05, 0.06, 2.0, 5), C(0.5, 0.42, 0.35), { pos: [0, 0.6, 0] })], M.wood));
  const arms = new THREE.Group();
  arms.position.set(0, 1.42, 0);
  const armParts = [part(new THREE.CylinderGeometry(0.1, 0.12, 1.5, 6), coat, { rot: [0, 0, Math.PI / 2] })];
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) armParts.push(part(new THREE.ConeGeometry(0.04, 0.32, 4), straw, { pos: [s * 0.8, -0.05, (k - 1.5) * 0.05], rot: [0, 0, s * (Math.PI / 2 + 0.3) - (k - 1.5) * 0.25 * s] }));
  }
  arms.add(meshOf(armParts, M.plain));
  g.add(arms);
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 0.55, 0.12) });
  const eyes = new THREE.Group();
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(sphere(0.04, 5, 4), eyeMat);
    e.position.set(s * 0.09, 1.88, 0.21);
    eyes.add(e);
  }
  g.add(eyes);
  g.userData = { arms, eyes };
  return g;
}

// Shadow wolf: dark fur, glowing eyes, animated legs.
export function createWolf(M) {
  const g = new THREE.Group();
  const fur = C(0.2, 0.2, 0.26);
  g.add(meshOf([
    part(sphere(0.5, 9, 7), fur, { pos: [0, 0.78, -0.05], scale: [0.5, 0.44, 1.05] }),
    part(sphere(0.36, 8, 6), fur, { pos: [0, 0.86, 0.42], scale: [0.85, 0.95, 0.9] }),
    part(sphere(0.22, 7, 5), fur, { pos: [0, 0.98, 0.62], scale: [0.8, 0.9, 1] }),
    part(new THREE.ConeGeometry(0.09, 0.6, 5), fur, { pos: [0, 0.8, -0.82], rot: [-2.1, 0, 0] }),
  ], M.wool));
  const head = new THREE.Group();
  head.position.set(0, 1.02, 0.78);
  head.add(meshOf([
    part(sphere(0.22, 8, 6), fur, { scale: [0.95, 0.85, 1.1] }),
    part(new THREE.CylinderGeometry(0.085, 0.12, 0.28, 6), C(0.16, 0.16, 0.2), { pos: [0, -0.06, 0.25], rot: [Math.PI / 2, 0, 0] }),
    part(sphere(0.045, 5, 4), C(0.03, 0.03, 0.04), { pos: [0, -0.04, 0.41] }),
    part(new THREE.ConeGeometry(0.06, 0.18, 4), fur, { pos: [0.11, 0.2, -0.04] }),
    part(new THREE.ConeGeometry(0.06, 0.18, 4), fur, { pos: [-0.11, 0.2, -0.04] }),
  ], M.wool));
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(sphere(0.035, 5, 4), M.eyes);
    e.position.set(s * 0.09, 0.06, 0.18);
    head.add(e);
  }
  g.add(head);
  const legGeom = mergeGeometries([
    part(new THREE.CylinderGeometry(0.08, 0.055, 0.62, 5), C(0.16, 0.16, 0.2), { pos: [0, -0.31, 0] }),
    part(sphere(0.07, 5, 4), C(0.14, 0.14, 0.17), { pos: [0, -0.62, 0.04], scale: [1, 0.6, 1.4] }),
  ]);
  const legs = [[0.17, 0.42], [-0.17, 0.42], [0.17, -0.5], [-0.17, -0.5]].map(([x, z]) => {
    const l = new THREE.Mesh(legGeom, M.plain);
    l.position.set(x, 0.66, z);
    g.add(l);
    return l;
  });
  g.userData = { head, legs };
  return g;
}

// Giant marsh leech: segments that rear out of the water.
export function createLeech(M) {
  const g = new THREE.Group();
  const segs = [];
  for (let i = 0; i < 6; i++) {
    const r = 0.42 - i * 0.03;
    const parts = [part(sphere(r, 9, 7), C(0.55 - i * 0.03, 0.34, 0.46), { scale: [1, 1, 1.25] })];
    if (i === 0) {
      parts.push(part(new THREE.TorusGeometry(0.24, 0.07, 5, 10), C(0.95, 0.45, 0.55), { pos: [0, 0, r * 1.05] }));
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        parts.push(part(new THREE.ConeGeometry(0.035, 0.14, 4), C(0.9, 0.85, 0.75), { pos: [Math.cos(a) * 0.2, Math.sin(a) * 0.2, r * 1.05], rot: [Math.PI / 2, 0, 0] }));
      }
      parts.push(part(sphere(0.16, 6, 5), C(0.05, 0.0, 0.02), { pos: [0, 0, r * 0.95] }));
    }
    const m = meshOf(parts, M.toadSkin);
    g.add(m);
    segs.push(m);
  }
  g.userData = { segs };
  return g;
}

// The bridge guardian: a crowned knight of mossy stone with a huge stone greatsword.
export function createStoneKnight(M) {
  const g = new THREE.Group();
  const stone = C(0.7, 0.75, 0.9), moss = C(0.45, 0.6, 0.4);
  g.add(meshOf([
    part(new THREE.BoxGeometry(0.36, 1.05, 0.42), stone, { pos: [0.26, 0.52, 0] }),
    part(new THREE.BoxGeometry(0.36, 1.05, 0.42), stone, { pos: [-0.26, 0.52, 0] }),
    part(new THREE.BoxGeometry(1.0, 1.05, 0.62), stone, { pos: [0, 1.55, 0] }),
    part(new THREE.BoxGeometry(1.1, 0.18, 0.7), moss, { pos: [0, 1.06, 0] }),
    part(sphere(0.32, 8, 6), moss, { pos: [0.64, 2.0, 0] }),
    part(sphere(0.32, 8, 6), moss, { pos: [-0.64, 2.0, 0] }),
    part(new THREE.BoxGeometry(0.52, 0.58, 0.58), stone, { pos: [0, 2.4, 0.02] }),
    ...[0, 1, 2, 3].map((i) => part(new THREE.BoxGeometry(0.12, 0.2, 0.12), moss, { pos: [Math.cos(i * Math.PI / 2) * 0.2, 2.78, Math.sin(i * Math.PI / 2) * 0.2] })),
    part(new THREE.BoxGeometry(0.26, 0.95, 0.26), stone, { pos: [-0.66, 1.5, 0.05], rot: [0.15, 0, 0.12] }),
  ], M.giantRock));
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 0.6, 0.15) });
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.03), eyeMat);
  eye.position.set(0, 2.42, 0.31);
  g.add(eye);
  const arm = new THREE.Group();
  arm.position.set(0.66, 2.0, 0);
  arm.add(meshOf([
    part(new THREE.BoxGeometry(0.28, 0.95, 0.28), stone, { pos: [0, -0.45, 0] }),
    // greatsword continues down from the fist: rest leans it forward, windup lifts it overhead
    part(new THREE.BoxGeometry(0.12, 0.45, 0.12), C(0.4, 0.32, 0.25), { pos: [0, -0.85, 0] }),
    part(new THREE.BoxGeometry(0.6, 0.1, 0.16), stone, { pos: [0, -1.1, 0] }),
    part(new THREE.BoxGeometry(0.22, 2.2, 0.06), C(0.62, 0.66, 0.75), { pos: [0, -2.2, 0] }),
  ], M.giantRock));
  g.add(arm);
  g.scale.setScalar(1.55);
  g.userData = { arm, eye };
  return g;
}

// Uncle Thang the blacksmith: broad, bald, bearded, leather apron, hammer over his shoulder.
export function createSmith(M) {
  const g = new THREE.Group();
  const skin = C(0.62, 0.46, 0.36), apron = C(0.36, 0.24, 0.16), shirt = C(0.42, 0.4, 0.38);
  g.add(meshOf([
    part(new THREE.CylinderGeometry(0.17, 0.15, 0.85, 6), C(0.2, 0.18, 0.18), { pos: [0.17, 0.42, 0] }),
    part(new THREE.CylinderGeometry(0.17, 0.15, 0.85, 6), C(0.2, 0.18, 0.18), { pos: [-0.17, 0.42, 0] }),
    part(new THREE.CylinderGeometry(0.52, 0.42, 0.95, 8), shirt, { pos: [0, 1.3, 0], scale: [1, 1, 0.75] }),
    part(new THREE.SphereGeometry(0.48, 8, 6), shirt, { pos: [0, 1.72, 0], scale: [1.15, 0.5, 0.8] }),
    part(new THREE.CylinderGeometry(0.13, 0.11, 0.85, 6), skin, { pos: [0.58, 1.35, 0.05], rot: [0, 0, 0.25] }),
    part(new THREE.CylinderGeometry(0.13, 0.11, 0.85, 6), skin, { pos: [-0.58, 1.3, 0.1], rot: [-0.3, 0, -0.2] }),
    part(sphere(0.12, 6, 5), skin, { pos: [0.68, 0.92, 0.08] }),
    part(sphere(0.12, 6, 5), skin, { pos: [-0.66, 0.92, 0.3] }),
  ], M.plain));
  g.add(meshOf([
    part(new THREE.BoxGeometry(0.72, 1.15, 0.06), apron, { pos: [0, 1.05, 0.34], rot: [-0.06, 0, 0] }),
    part(new THREE.BoxGeometry(0.06, 0.06, 0.6), apron, { pos: [0.3, 1.75, 0.05] }),
    part(new THREE.BoxGeometry(0.06, 0.06, 0.6), apron, { pos: [-0.3, 1.75, 0.05] }),
  ], M.wood));
  g.add(meshOf([
    part(sphere(0.25, 9, 7), skin, { pos: [0, 2.05, 0.05], scale: [1, 1.05, 1] }),
    part(sphere(0.07, 5, 4), skin, { pos: [0, 2.03, 0.3] }),
    part(sphere(0.2, 7, 5), C(0.62, 0.6, 0.58), { pos: [0, 1.86, 0.15], scale: [1.05, 1.1, 0.8] }),
    part(sphere(0.035, 4, 3), C(0.05, 0.04, 0.03), { pos: [0.09, 2.1, 0.26] }),
    part(sphere(0.035, 4, 3), C(0.05, 0.04, 0.03), { pos: [-0.09, 2.1, 0.26] }),
    part(new THREE.BoxGeometry(0.24, 0.04, 0.04), C(0.55, 0.53, 0.5), { pos: [0, 2.18, 0.24] }),
  ], M.plain));
  // hammer resting on the shoulder
  g.add(meshOf([
    part(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 5), C(0.45, 0.32, 0.2), { pos: [0.55, 1.95, -0.05], rot: [0.2, 0, -0.9] }),
    part(new THREE.BoxGeometry(0.16, 0.26, 0.16), C(0.4, 0.42, 0.48), { pos: [0.2, 2.2, -0.12], rot: [0.2, 0, -0.9] }),
  ], M.metal));
  return g;
}
