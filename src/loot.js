// Things to find in the world: enemy drops, harvestable herbs / glowing mushrooms / ore veins
// (they regrow), and one-time treasure chests hidden at ruins and around the giants.
import * as THREE from 'three';
import { ITEMS, itemIcon } from './items.js';
import { part, mergeGeometries, polylineXAtZ, distToPolyline } from './util.js';
import { rng } from './noise.js';
import { regionWeights } from './terrain.js';
import { wildChests } from './wilds.js';
import { RIVER, TEMPLE, TOAD, HEAD, CASTLE, RIBCAGE, PATHS, PASTURE, FENCE_R, TAVERN, HOUSES, CANYON_ARCH_Z } from './layout.js';

const C = (r, g, b) => new THREE.Color(r, g, b);

export const DROPS = {
  wisp: [['essence', 1, 0.85]],
  straw: [['straw', 1, 1], ['straw', 1, 0.35], ['token', 1, 0.12], ['moonstone', 1, 0.05]],
  wolf: [['fang', 1, 0.9], ['fang', 1, 0.3], ['moonstone', 1, 0.05]],
  leech: [['slime', 1, 0.9], ['pearl', 1, 0.15], ['leech_live', 2, 0.8]],
  knight: [['knight_core', 1, 1], ['idol', 1, 1]],
  gaunt: [['claw', 1, 0.8], ['token', 1, 0.15], ['watch', 1, 0.04]],
  crawler: [['claw', 1, 1], ['claw', 1, 0.3], ['slime', 1, 0.2]],
  weeper: [['locket', 1, 1], ['essence', 2, 0.7]],
  hollow: [['token', 1, 0.4], ['moon_herb', 1, 0.3], ['potion', 1, 0.15], ['watch', 1, 0.05]],
  brute: [['pale_heart', 1, 1], ['claw', 3, 1], ['ore', 1, 0.7]],
};

const NODE_TYPES = {
  herb: { item: 'moon_herb', count: [1, 2], regrow: 360, label: 'เก็บหญ้าจันทร์' },
  mushroom: { item: 'mushroom', count: [1, 2], regrow: 360, label: 'เก็บเห็ดเรืองแสง' },
  ore: { item: 'ore', count: [1, 1], regrow: 600, label: 'ขุดแร่เหล็กมืด' },
};

const KIND_GLOW = { use: C(0.5, 0.18, 0.16), mat: C(0.22, 0.32, 0.5), treasure: C(0.55, 0.42, 0.14) };

function chestGeometry() {
  const wood = C(0.62, 0.45, 0.32), band = C(0.55, 0.55, 0.6);
  const body = mergeGeometries([
    part(new THREE.BoxGeometry(1.0, 0.55, 0.62), wood, { pos: [0, 0.275, 0] }),
    part(new THREE.BoxGeometry(1.04, 0.08, 0.66), band, { pos: [0, 0.08, 0] }),
    part(new THREE.BoxGeometry(0.08, 0.57, 0.66), band, { pos: [-0.36, 0.28, 0] }),
    part(new THREE.BoxGeometry(0.08, 0.57, 0.66), band, { pos: [0.36, 0.28, 0] }),
  ]);
  // lid pivots on its back edge (z = -0.31)
  const lid = mergeGeometries([
    part(new THREE.CylinderGeometry(0.31, 0.31, 1.0, 8, 1, false, 0, Math.PI), wood, { pos: [0, 0, 0.31], rot: [0, 0, Math.PI / 2] }),
    part(new THREE.BoxGeometry(0.08, 0.34, 0.66), band, { pos: [-0.36, 0.14, 0.31] }),
    part(new THREE.BoxGeometry(0.08, 0.34, 0.66), band, { pos: [0.36, 0.14, 0.31] }),
    part(new THREE.BoxGeometry(0.14, 0.18, 0.06), C(0.85, 0.7, 0.3), { pos: [0, -0.02, 0.64] }),
  ]);
  return { body, lid };
}

export class Loot {
  constructor(game) {
    this.g = game;
    this.pickups = [];
    this.nodes = [];
    this.chests = [];
    this.opened = new Set();
    this.texCache = new Map();
    if (!game.arena) {          // the online arena has no herbs, ore veins or chests
      this.placeNodes();
      this.placeChests();
    }
  }

  // terrain, or the top of a low platform / step (never the top of a pillar or wall)
  ground(x, z, reach = 1.2) {
    const h = this.g.terrain.getHeight(x, z);
    return Math.max(h, this.g.collision.groundAt(x, z, h + reach, 0.01));
  }

  // nearest spot around (x, z) that is dry, flat enough and not inside any wall
  freeSpot(x, z, radius = 0.7, allowWet = false, reach = 1.2) {
    const p = new THREE.Vector3();
    for (let ring = 0; ring < 10; ring++) {
      const steps = ring === 0 ? 1 : ring * 8;
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2, d = ring * 1.2;
        p.set(x + Math.cos(a) * d, 0, z + Math.sin(a) * d);
        p.y = this.ground(p.x, p.z, reach);
        if (!allowWet && p.y < 0.05) continue;
        const before = p.clone();
        this.g.collision.resolve(p, radius, 1.0, 0.3);
        if (p.distanceToSquared(before) < 1e-4) return p;
      }
    }
    return new THREE.Vector3(x, this.ground(x, z, reach), z);
  }

  // ---------------------------------------------------------------- pickups
  iconTexture(id) {
    if (!this.texCache.has(id)) {
      const t = new THREE.CanvasTexture(itemIcon(id));
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      this.texCache.set(id, t);
    }
    return this.texCache.get(id);
  }

  spawnPickup(id, count, pos, { fromEnemy = false } = {}) {
    const def = ITEMS[id];
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.iconTexture(id), transparent: true, alphaTest: 0.3, depthWrite: true }));
    const s = 0.42;
    sprite.scale.set(def.w * s, def.h * s, 1);
    const glow = new THREE.Sprite(this.g.M.sprite.clone());
    glow.material.color = KIND_GLOW[def.kind];
    glow.scale.setScalar(0.9);
    const group = new THREE.Group();
    group.add(glow, sprite);
    const y = pos.y ?? this.ground(pos.x, pos.z);
    const pk = { id, count, pos: new THREE.Vector3(pos.x, Math.max(y, 0), pos.z), group, glow, phase: Math.random() * 6, fromEnemy, born: this.g.time };
    group.position.copy(pk.pos);
    this.g.scene.add(group);
    this.pickups.push(pk);
    // don't let respawning enemies litter the world forever
    const drops = this.pickups.filter((p) => p.fromEnemy);
    if (drops.length > 50) this.removePickup(drops[0]);
    return pk;
  }

  removePickup(pk) {
    this.g.scene.remove(pk.group);
    pk.group.children.forEach((c) => c.material.dispose());
    this.pickups = this.pickups.filter((p) => p !== pk);
  }

  dropFrom(enemy) {
    const table = DROPS[enemy.type] || [];
    const got = new Map();
    // under a blood moon everything drops twice as often, and the Pale Ones bleed amber
    const mul = this.g.events?.dropMul ?? 1;
    for (const [id, n, chance] of table) {
      const pr = chance * mul, k = Math.floor(pr) + (Math.random() < pr % 1 ? 1 : 0);
      if (k) got.set(id, (got.get(id) || 0) + n * k);
    }
    for (const [id, n] of this.g.events?.extraDrops(enemy) || []) got.set(id, (got.get(id) || 0) + n);
    let i = 0;
    for (const [id, n] of got) {
      const a = i++ * 2.1 + Math.random();
      this.spawnPickup(id, n, { x: enemy.pos.x + Math.cos(a) * 0.9, z: enemy.pos.z + Math.sin(a) * 0.9 }, { fromEnemy: !enemy.def.boss });
    }
  }

  dropNearPlayer(id, count) {
    const p = this.g.player;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    const spot = this.freeSpot(p.pos.x + fx * 1.2, p.pos.z + fz * 1.2, 0.3, true);
    this.spawnPickup(id, count, spot);
  }

  // Try to put a pickup in the bag. When it doesn't fit, open the case with the item waiting
  // in the tray, Resident Evil style.
  take(pk, { openBagIfFull = true } = {}) {
    const g = this.g, def = ITEMS[pk.id];
    const left = g.bag.add(pk.id, pk.count);
    const taken = pk.count - left;
    if (taken > 0) {
      g.ui.toast(`+ ${def.name}${taken > 1 ? ` ×${taken}` : ''}`);
      g.audio.pickup(def.kind);
    }
    if (left === 0) { this.removePickup(pk); return true; }
    pk.count = left;
    if (!openBagIfFull) return false;
    g.ui.toast('กระเป๋าเต็ม — จัดกระเป๋าเพื่อหาที่ว่าง');
    g.openBag({
      id: pk.id,
      count: left,
      onTaken: (n) => { pk.count -= n; if (pk.count <= 0) this.removePickup(pk); },
      onLeft: () => {},
    });
    return false;
  }

  // ---------------------------------------------------------------- harvest nodes
  placeNodes() {
    const g = this.g, T = g.terrain, r = rng(4711);
    const built = (x, z) => Math.abs(x - TAVERN.x) < 14 && Math.abs(z - TAVERN.z) < 12
      || HOUSES.some(([hx, hz]) => Math.hypot(x - hx, z - hz) < 8)
      || Math.hypot(x - PASTURE.x, z - PASTURE.z) < FENCE_R + 2
      || Math.hypot(x - HEAD.x, z - HEAD.z) < 30;
    const tryPlace = (type, n, pickXZ, tries = 400) => {
      let placed = 0;
      for (let i = 0; i < tries && placed < n; i++) {
        const [x, z] = pickXZ();
        const h = T.getHeight(x, z);
        if (h < 0.3 || T.slope(x, z) > 0.6 || built(x, z)) continue;
        if (PATHS.some((p) => distToPolyline(x, z, p) < 2)) continue;
        if (this.nodes.some((nd) => Math.hypot(nd.pos.x - x, nd.pos.z - z) < 12)) continue;
        const spot = this.freeSpot(x, z, 0.5);
        if (Math.hypot(spot.x - x, spot.z - z) > 2) continue;
        this.addNode(type, spot);
        placed++;
      }
    };
    // moon herbs: open grassland and hillsides
    tryPlace('herb', 30, () => [(r() - 0.5) * 500, (r() - 0.5) * 420 - 20]);
    // glowing mushrooms: western forest and swamp edges
    tryPlace('mushroom', 22, () => (r() < 0.6 ? [-260 + r() * 200, -120 + r() * 240] : [-180 + r() * 260, 120 + r() * 150]));
    // ore: canyon walls and the foot of the northern cliffs
    // at the foot of each canyon wall, where you can wade up to them
    for (let i = 0; i < 10; i++) {
      let z = -140 - i * 8 - r() * 4;
      if (Math.abs(z - CANYON_ARCH_Z) < 4) z -= 5;   // keep clear of the archway's pillars
      const side = i % 2 ? 1 : -1, cx = polylineXAtZ(RIVER, z);
      for (let off = 5; off < 12; off += 0.25) {
        const x = cx + side * off, y = T.getHeight(x, z);
        if (y > -0.5) { this.addNode('ore', new THREE.Vector3(x, Math.min(y, 0.6), z)); break; }
      }
    }
    for (const [x, z] of [[-60, -128], [60, -130], [110, -126], [-120, -124], [-205, -120]]) {
      this.addNode('ore', this.freeSpot(x, z, 0.8));
    }

    // the wild beyond the valley: herbs on the highland and the farmland, mushrooms in the dark
    // forest and round the lake, ore veins among the northern tors
    const w = rng(4712);
    const wild = (pick) => () => {
      for (;;) {
        const x = (w() - 0.5) * 1440, z = (w() - 0.5) * 1440;
        if (Math.max(Math.abs(x), Math.abs(z)) > 300 && w() < pick(regionWeights(x, z))) return [x, z];
      }
    };
    tryPlace('herb', 26, wild((k) => k.north + k.east));
    tryPlace('mushroom', 24, wild((k) => k.west + k.south * 0.8));
    tryPlace('ore', 12, wild((k) => (k.north > 0.6 ? k.north : 0)));
  }

  addNode(type, pos) {
    const M = this.g.M, group = new THREE.Group();
    if (type === 'herb') {
      const leaves = [];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        leaves.push(part(new THREE.ConeGeometry(0.06, 0.55, 4), C(0.75, 0.95, 1.0), { pos: [Math.cos(a) * 0.12, 0.25, Math.sin(a) * 0.12], rot: [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5] }));
      }
      leaves.push(part(new THREE.SphereGeometry(0.05, 5, 4), C(1.0, 1.05, 1.1), { pos: [0, 0.55, 0] }));
      group.add(new THREE.Mesh(mergeGeometries(leaves), M.glow));
    } else if (type === 'mushroom') {
      const parts = [];
      for (const [x, z, s] of [[0, 0, 1], [0.28, 0.12, 0.7], [-0.2, 0.22, 0.6]]) {
        parts.push(part(new THREE.CylinderGeometry(0.05 * s, 0.07 * s, 0.4 * s, 5), C(0.55, 0.65, 0.85), { pos: [x, 0.2 * s, z] }));
        parts.push(part(new THREE.SphereGeometry(0.22 * s, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), C(0.25, 0.75, 1.15), { pos: [x, 0.38 * s, z] }));
      }
      group.add(new THREE.Mesh(mergeGeometries(parts), M.glow));
    } else {
      const rock = part(new THREE.DodecahedronGeometry(0.7, 0), C(0.35, 0.35, 0.42), { pos: [0, 0.35, 0], scale: [1.2, 0.8, 1] });
      group.add(new THREE.Mesh(mergeGeometries([rock]), M.stone));
      const specks = [];
      for (let i = 0; i < 6; i++) {
        const a = i * 1.1;
        specks.push(part(new THREE.OctahedronGeometry(0.07, 0), C(0.7, 0.9, 1.2), { pos: [Math.cos(a) * 0.6, 0.3 + (i % 3) * 0.15, Math.sin(a) * 0.5] }));
      }
      group.add(new THREE.Mesh(mergeGeometries(specks), M.glow));
      this.g.collision.addCircle(pos.x, pos.z, 0.6, pos.y - 1, pos.y + 0.5);
    }
    // a faint halo so herbs and mushrooms can be spotted at night (ore shows by its glinting flecks)
    if (type !== 'ore') {
      const glow = new THREE.Sprite(M.sprite.clone());
      glow.material.color.setRGB(0.18, 0.3, 0.42);
      glow.position.y = 0.35;
      glow.scale.setScalar(1.1);
      group.add(glow);
    }
    group.position.copy(pos);
    group.rotation.y = Math.random() * 6;
    this.g.scene.add(group);
    this.nodes.push({ type, def: NODE_TYPES[type], pos: pos.clone(), group, regrowAt: 0, harvested: false });
  }

  harvest(node) {
    const def = node.def;
    const n = def.count[0] + Math.floor(Math.random() * (def.count[1] - def.count[0] + 1));
    node.harvested = true;
    node.group.visible = false;
    node.regrowAt = this.g.time + def.regrow;
    this.g.audio.harvest(node.type);
    const pk = this.spawnPickup(def.item, n, node.pos);
    this.take(pk);
  }

  // ---------------------------------------------------------------- chests
  placeChests() {
    const T = this.g.terrain;
    const canyonX = (z) => polylineXAtZ(RIVER, z);
    const rail = T.rail.pts;
    const end = rail[rail.length - 1];
    const list = [
      ['ruin-west', -112, -14, [['token', 2], ['moon_herb', 2]]],
      ['ruin-swamp', -54, 260, [['pearl', 1], ['potion', 1]]],
      ['ribcage', RIBCAGE.x - 16, RIBCAGE.z - 30, [['watch', 1], ['ore', 1]]],
      ['castle-shore', CASTLE.x - 92, CASTLE.z - 10, [['candlestick', 1], ['essence', 2]]],
      ['king-hand', HEAD.x + 4, HEAD.z + 46, [['idol', 1]]],
      ['canyon', canyonX(-185) + 5, -185, [['ore', 2], ['moonstone', 1]], 3],
      ['temple', TEMPLE.x + 9, TEMPLE.z - 11, [['moonstone', 1], ['potion_big', 1]], 4.5],
      ['station', end.x - 6, end.z + 6, [['token', 3], ['tonic', 1]]],
      ['toad', TOAD.x - 5, TOAD.z - 3, [['sight', 1], ['mushroom', 2]]],
      ['ruin-east', 76, 136, [['candlestick', 1]]],
      ['ruin-far-west', -204, 126, [['ore', 1], ['fang', 3]]],
      ['ruin-north', -144, -106, [['moonstone', 1], ['oil', 1]]],
      ['ruin-south', 66, -70, [['token', 2], ['potion', 1]]],
      ['ruin-far-east', 244, 46, [['watch', 1]]],
      ...wildChests(),
    ];
    const geo = chestGeometry();
    for (const [id, x, z, contents, reach = 1.2] of list) {
      const p = this.freeSpot(x, z, 0.8, false, reach);
      const group = new THREE.Group();
      const body = new THREE.Mesh(geo.body, this.g.M.wood);
      const lidPivot = new THREE.Group();
      lidPivot.position.set(0, 0.55, -0.31);
      const lid = new THREE.Mesh(geo.lid, this.g.M.wood);
      lid.position.set(0, 0, -0.31);
      lidPivot.add(lid);
      group.add(body, lidPivot);
      group.rotation.y = (id.length % 4) * (Math.PI / 2);
      group.position.copy(p);
      this.g.scene.add(group);
      this.g.collision.addBox(p.x, p.y + 0.3, p.z, 0.5, 0.3, 0.31, group.rotation.y);
      this.chests.push({ id, pos: p, group, lidPivot, contents, open: false, openT: 0 });
    }
  }

  openChest(ch) {
    ch.open = true;
    this.opened.add(ch.id);
    this.g.audio.chest();
    const fwd = new THREE.Vector3(Math.sin(ch.group.rotation.y), 0, Math.cos(ch.group.rotation.y));
    let left = false;
    ch.contents.forEach(([id, n], i) => {
      const side = (i - (ch.contents.length - 1) / 2) * 0.8;
      const at = ch.pos.clone().addScaledVector(fwd, 1.0).add(new THREE.Vector3(fwd.z * side, 0, -fwd.x * side));
      const pk = this.spawnPickup(id, n, at);
      if (this.g.bag.canAdd(id, n)) this.take(pk, { openBagIfFull: false });
      else left = true;
    });
    if (left) this.g.ui.toast('กระเป๋าเต็ม — ของบางชิ้นยังวางอยู่หน้าหีบ');
  }

  // ---------------------------------------------------------------- per-frame
  // nearest thing the player can pick / harvest / open, in front of them
  nearest(p, fx, fz) {
    let best = null;
    const consider = (pos, r, label, act) => {
      const dx = pos.x - p.x, dz = pos.z - p.z, d = Math.hypot(dx, dz);
      if (d > r || Math.abs(pos.y - p.y) > 2.5) return;
      if (d > 0.9 && (dx * fx + dz * fz) / d < 0.3) return;
      if (!best || d < best.d) best = { d, label, act };
    };
    for (const pk of this.pickups) consider(pk.pos, 2.0, `เก็บ ${ITEMS[pk.id].name}${pk.count > 1 ? ` ×${pk.count}` : ''}`, () => this.take(pk));
    for (const n of this.nodes) if (!n.harvested) consider(n.pos, 2.2, n.def.label, () => this.harvest(n));
    for (const ch of this.chests) if (!ch.open) consider(ch.pos, 2.4, 'เปิดหีบ', () => this.openChest(ch));
    return best;
  }

  update(dt, t) {
    for (const pk of this.pickups) {
      pk.group.position.y = pk.pos.y + 0.45 + Math.sin(t * 2.5 + pk.phase) * 0.08;
      pk.glow.scale.setScalar(0.85 + Math.sin(t * 4 + pk.phase) * 0.12);
    }
    // only draw what is near enough to see through the fog (saves ~100 draw calls)
    this.cullT = (this.cullT || 0) - dt;
    const cam = this.g.camera.position;
    const cull = this.cullT <= 0;
    if (cull) this.cullT = 0.5;
    for (const n of this.nodes) {
      if (n.harvested && t >= n.regrowAt) n.harvested = false;
      if (cull || n.harvested) n.group.visible = !n.harvested && n.pos.distanceToSquared(cam) < 95 * 95;
    }
    if (cull) for (const ch of this.chests) ch.group.visible = ch.pos.distanceToSquared(cam) < 110 * 110;
    for (const ch of this.chests) {
      if (ch.open && ch.openT < 1) ch.openT = Math.min(1, ch.openT + dt * 2.5);
      ch.lidPivot.rotation.x = -ch.openT * 1.9 * (ch.open ? 1 : 0);
    }
  }

  serialize() {
    return {
      opened: [...this.opened],
      ground: this.pickups.filter((p) => !p.fromEnemy || ITEMS[p.id].kind !== 'mat').map((p) => [p.id, p.count, +p.pos.x.toFixed(2), +p.pos.z.toFixed(2)]),
    };
  }

  load(d = {}) {
    this.opened = new Set(d.opened || []);
    for (const ch of this.chests) if (this.opened.has(ch.id)) { ch.open = true; ch.openT = 1; }
    for (const [id, count, x, z] of d.ground || []) if (ITEMS[id]) this.spawnPickup(id, count, { x, z });
  }
}
