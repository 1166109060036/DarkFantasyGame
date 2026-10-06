import * as THREE from 'three';
import { ps2ify } from './ps2.js';

export function createMaterials(T) {
  const L = (o, wind = 0) => ps2ify(new THREE.MeshLambertMaterial(o), { wind });
  const far = (o, fogScale) => ps2ify(new THREE.MeshLambertMaterial(o), { fogScale });
  const additive = (color, map = T.glow) => new THREE.SpriteMaterial({
    map, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const foliage = (map, wind, extra = {}) => L({
    map, alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true, ...extra,
  }, wind);

  return {
    terrain: L({ map: T.detail, vertexColors: true }),
    stone: L({ map: T.stone, vertexColors: true }),
    wood: L({ map: T.wood, vertexColors: true }),
    metal: L({ map: T.metal, vertexColors: true }),
    bark: L({ map: T.bark, vertexColors: true }),
    leaves: foliage(T.leaves, 0.18),
    hangingMoss: foliage(T.hangingMoss, 0.3),
    fern: foliage(T.fern, 0.1),
    grass: foliage(T.grass, 0.16),
    mushroomCap: L({ map: T.mushroomCap, vertexColors: true }),
    plain: L({ map: T.plainCloth, vertexColors: true }),
    wool: L({ map: T.wool, vertexColors: true }),
    cloth: L({ map: T.cloth, vertexColors: true }),
    toadSkin: L({ map: T.toadSkin, vertexColors: true }),
    feather: L({ map: T.feather, vertexColors: true }),
    gold: L({ map: T.gold, emissive: 0x7a5410, vertexColors: true }),
    // unlit, bloom-catching materials
    glow: ps2ify(new THREE.MeshBasicMaterial({ vertexColors: true })),
    eyes: ps2ify(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.85, 1.6) })),
    shadow: new THREE.MeshBasicMaterial({
      map: T.shadow, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
    // colossal structures: same textures, thinner fog so they loom from far away
    giantStone: far({ map: T.stone, vertexColors: true }, 0.3),
    giantRock: far({ map: T.rock, vertexColors: true }, 0.3),
    giantMetal: far({ map: T.metal, vertexColors: true }, 0.34),
    giantWood: far({ map: T.wood, vertexColors: true }, 0.34),
    bone: far({ map: T.plainCloth, vertexColors: true }, 0.5),
    giantGlow: ps2ify(new THREE.MeshBasicMaterial({ vertexColors: true }), { fogScale: 0.3 }),
    painting: ps2ify(new THREE.MeshBasicMaterial({ map: T.galaxy })),
    sign: ps2ify(new THREE.MeshLambertMaterial({ map: T.sign, side: THREE.DoubleSide })),
    fireSprite: additive(new THREE.Color(1.5, 0.75, 0.3)),
    candleSprite: additive(new THREE.Color(1.1, 0.7, 0.35)),
    mistSprite: new THREE.SpriteMaterial({
      map: T.glow, color: new THREE.Color(0.55, 0.65, 0.9), transparent: true, opacity: 0.45, depthWrite: false, fog: false,
    }),
    sprite: new THREE.SpriteMaterial({
      map: T.glow, color: new THREE.Color(0.45, 0.75, 1.3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  };
}
