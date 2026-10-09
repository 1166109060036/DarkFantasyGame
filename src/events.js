// World events: things that happen to the world on their own, rolled as the hours turn.
//   bloodmoon - some nights the moon comes up red: the Pale Ones grow bold and fast, more of
//               them crawl out, they drop twice the loot and blood amber; the score changes
//   merchant  - a wandering pedlar with a bell sets up by the road for a day, selling rare
//               wares and rumours of where a treasure chest lies
//   fog       - a thick fog rolls in: you can barely see, and neither can anything hunting you
//   star      - a falling star streaks down at night; find the shard before it fades
// Rolls happen when the clock crosses dusk / dawn / each night hour, so sleeping at the inn
// still triggers them. `?event=<name>` forces one (for testing).
import * as THREE from 'three';
import { part, mergeGeometries, clamp } from './util.js';
import { createPatron } from './characters.js';
import { ITEMS } from './items.js';
import { L } from './i18n.js';

const C = (r, g, b) => new THREE.Color(r, g, b);
const DUSK = 0.78, DAWN = 0.27;
const PALE = new Set(['gaunt', 'crawler', 'weeper', 'brute']);

export const EVENT_INFO = {
  bloodmoon: { name: L('คืนจันทร์เลือด', 'Night of the Blood Moon'), sub: L('ร่างซีดคลั่งและออกมามากกว่าเดิม · ของดรอปเพิ่มเป็นสองเท่า', 'The Pale Ones run mad and crawl forth in greater number · Twice the spoils') },
  merchant: { name: L('พ่อค้าเร่มาเยือน', 'A Wandering Pedlar'), sub: L('ได้ยินเสียงกระดิ่งแว่วมาตามทาง... อยู่ถึงรุ่งสางพรุ่งนี้', 'A small bell rings faintly down the road... He stays until tomorrow\'s dawn') },
  fog: { name: L('หมอกหนาลงจัด', 'A Heavy Fog Descends'), sub: L('มองไม่เห็นไกล — ศัตรูก็มองไม่เห็นเจ้าเช่นกัน', 'You cannot see far — nor can anything hunting you') },
  star: { name: L('ดาวตก!', 'A Falling Star!'), sub: L('เศษดาวตกลงมาไม่ไกล ไปเก็บก่อนแสงมันจะดับ', 'A shard has fallen not far off. Claim it before its light dies') },
};

// where the pedlar sets up: by the roads, the railway and the ruins
const MERCHANT_SPOTS = [
  [-60, 28, L('ทางแยกกลางป่า', 'the crossroads in the woods')], [-4, -95, L('ทางขึ้นหุบผา', 'the path up to Archway Gorge')], [104, 30, L('ข้างสถานีร้าง', 'the abandoned station')],
  [-150, 40, L('หน้าเห็ดยักษ์', 'the foot of the Giant Mushroom')], [0, 150, L('ริมรางรถไฟในบึง', 'the railway through the marsh')], [150, -60, L('เชิงเนินจันทร์', 'the foot of Moon Hill')],
];

// what the pedlar might carry: [item, price, max qty]
const WARES = [
  ['potion_big', 30, 2], ['oil', 22, 2], ['sight', 16, 2], ['tonic', 15, 2], ['leech_live', 5, 4],
  ['ore', 14, 2], ['claw', 8, 3], ['essence', 10, 3], ['fang', 6, 3], ['slime', 7, 2], ['knight_core', 120, 1],
];
const MAP_PRICE = 25;

// extra Pale Ones that only walk under a blood moon
const BLOOD_SPAWNS = [
  ['gaunt', 60, 40], ['gaunt', -90, 60], ['crawler', -40, 120], ['gaunt', 130, -20], ['crawler', -120, -40],
  ['gaunt', 20, -60], ['crawler', 90, 120], ['gaunt', -180, 0], ['gaunt', 40, 200], ['crawler', -60, 230],
];

// does the clock moving from a to b (forward, wrapping at 1) pass x?
function crossed(a, b, x) { return b >= a ? a < x && x <= b : x > a || x <= b; }

export class WorldEvents {
  constructor(game) {
    this.g = game;
    this.day = 0;
    this.bloodMoon = false;
    this.lastBlood = -9;
    this.fogUntil = -1;           // clock value (in days, counting `day`) when the fog lifts
    this.merchant = null;
    this.star = null;
    this.chestHint = null;
    this.blood = 0;               // smoothed 0..1 for visuals and sound
    this.fog = 0;
    this.prevT = game.dayNight.t;
    this.bloodSpawned = false;
    this.bellT = 0;
  }

  get now() { return this.day + this.g.dayNight.t; }
  get fogActive() { return this.now < this.fogUntil; }

  // multipliers other systems read
  get enemyDamageMul() { return this.bloodMoon ? 1.3 : 1; }
  get enemySpeedMul() { return this.bloodMoon ? 1.2 : 1; }
  get aggroMul() { return (this.fogActive ? 0.5 : 1) * (this.bloodMoon ? 1.35 : 1); }
  get dropMul() { return this.bloodMoon ? 2 : 1; }
  get respawnMul() { return this.bloodMoon ? 6 : 1; }

  // ---------------------------------------------------------------- the clock
  update(dt) {
    const g = this.g, t = g.dayNight.t, prev = this.prevT;
    this.prevT = t;
    if (t < prev && prev - t > 0.5) this.day++;
    if (crossed(prev, t, DUSK)) this.onDusk();
    if (crossed(prev, t, DAWN)) this.onDawn();
    // each night hour there is a chance of a falling star
    for (let h = 0; h < 24; h++) {
      const x = h / 24;
      if (crossed(prev, t, x) && (x >= DUSK || x < DAWN - 0.02) && !this.star && g.state === 'play' && Math.random() < 0.12) this.fallingStar();
    }
    this.blood += ((this.bloodMoon && g.dayNight.isNight ? 1 : 0) - this.blood) * Math.min(1, dt * 0.4);
    this.fog += ((this.fogActive ? 1 : 0) - this.fog) * Math.min(1, dt * 0.25);
    if (this.merchant) this.updateMerchant(dt);
    if (this.star) this.updateStar(dt);
  }

  onDusk() {
    if (this.day >= 1 && this.now - this.lastBlood > 1.5 && Math.random() < 0.28) this.startBloodMoon();
    else if (!this.fogActive && Math.random() < 0.15) this.startFog();
  }

  onDawn() {
    if (this.bloodMoon) this.endBloodMoon();
    if (this.merchant && this.now >= this.merchant.until) this.merchantLeaves();
    if (!this.merchant && Math.random() < 0.4) this.merchantArrives();
    else if (!this.fogActive && Math.random() < 0.22) this.startFog();
  }

  announce(id) {
    const info = EVENT_INFO[id];
    this.g.ui.banner(info.name, info.sub);
  }

  force(id) {
    if ((id === 'merchant' && this.merchant) || (id === 'star' && this.star) || (id === 'bloodmoon' && this.bloodMoon)) return;
    if (id === 'bloodmoon') this.startBloodMoon();
    if (id === 'merchant') this.merchantArrives();
    if (id === 'fog') this.startFog();
    if (id === 'star') this.fallingStar();
  }

  // ---------------------------------------------------------------- blood moon
  startBloodMoon(quiet = false) {
    const g = this.g;
    this.bloodMoon = true;
    this.lastBlood = this.now;
    if (!this.bloodSpawned) {
      this.bloodSpawned = true;
      for (const [type, x0, z0] of BLOOD_SPAWNS) {
        // nudge onto dry land
        let x = x0, z = z0;
        for (let r = 0; r < 30 && g.terrain.getHeight(x, z) < 0.3; r += 2) {
          const a = r * 1.7;
          x = x0 + Math.cos(a) * r; z = z0 + Math.sin(a) * r;
        }
        g.combat.spawn(type, x, z).activeOverride = 'bloodmoon';
      }
    }
    if (quiet) return;
    this.announce('bloodmoon');
    g.audio.sting();
    g.audio.metal({ freq: 55, dur: 6, gain: 0.3, partials: [1, 2.02, 2.76, 4.1], verb: 0.9 });
  }

  endBloodMoon() {
    this.bloodMoon = false;
    this.g.ui.toast(L('รุ่งสางแล้ว... ดวงจันทร์กลับเป็นสีขาวซีด', 'Dawn breaks... the moon fades back to bone-white'));
  }

  // ---------------------------------------------------------------- fog
  startFog() {
    this.fogUntil = this.now + 0.2 + Math.random() * 0.15;
    this.announce('fog');
  }

  // ---------------------------------------------------------------- the wandering pedlar
  merchantArrives(spotIndex = null, quiet = false) {
    const g = this.g, M = g.M;
    const i = spotIndex ?? Math.floor(Math.random() * MERCHANT_SPOTS.length);
    const [x, z, where] = MERCHANT_SPOTS[i];
    const y = g.terrain.getHeight(x, z);
    const obj = new THREE.Group();
    const man = createPatron(M, C(0.3, 0.16, 0.34));
    obj.add(man);
    // a huge pack of wares, pots and a lantern on a pole
    obj.add(new THREE.Mesh(mergeGeometries([
      part(new THREE.BoxGeometry(0.75, 0.95, 0.45), C(0.45, 0.32, 0.2), { pos: [0, 1.15, -0.38] }),
      part(new THREE.BoxGeometry(0.85, 0.12, 0.5), C(0.35, 0.25, 0.16), { pos: [0, 1.66, -0.38] }),
      part(new THREE.CylinderGeometry(0.14, 0.12, 0.3, 7), C(0.55, 0.35, 0.25), { pos: [0.3, 1.86, -0.38] }),
      part(new THREE.CylinderGeometry(0.1, 0.1, 0.24, 7), C(0.35, 0.4, 0.5), { pos: [-0.22, 1.84, -0.38] }),
      part(new THREE.CylinderGeometry(0.02, 0.02, 2.4, 5), C(0.4, 0.3, 0.2), { pos: [0.46, 1.4, -0.2] }),
      part(new THREE.BoxGeometry(0.16, 0.2, 0.16), C(0.4, 0.38, 0.32), { pos: [0.46, 2.5, -0.05] }),
    ]), M.wood));
    const glow = new THREE.Sprite(M.candleSprite);
    glow.position.set(0.46, 2.48, -0.05);
    glow.scale.setScalar(1.3);
    obj.add(glow);
    // a little bell on the pole
    obj.add(new THREE.Mesh(part(new THREE.CylinderGeometry(0.03, 0.07, 0.1, 7), C(0.85, 0.66, 0.3), { pos: [0.46, 2.25, 0.05] }), M.metal));
    obj.position.set(x, y, z);
    obj.rotation.y = Math.random() * Math.PI * 2;
    g.scene.add(obj);
    const stock = WARES.slice().sort(() => Math.random() - 0.5).slice(0, 5)
      .map(([id, price, max]) => ({ id, price, left: 1 + Math.floor(Math.random() * max) }));
    stock.push({ id: 'map', price: MAP_PRICE, left: 1 });
    const pos = new THREE.Vector3(x, y, z);
    this.merchant = { spot: i, where, obj, pos, stock, until: this.now + 0.98 };
    g.interactables.push({ id: 'merchant', pos, r: 3.2, label: L('คุยกับพ่อค้าเร่', 'Speak with the pedlar'), checkpoint: { x: x + 2, z: z + 2 } });
    if (quiet) return;
    this.announce('merchant');
    setTimeout(() => g.ui.toast(L(`พ่อค้าเร่ตั้งแผงอยู่ที่${where} (ดูเข็มทิศ)`, `A pedlar has set out his wares at ${where} (see compass)`)), 1500);
  }

  merchantLeaves() {
    const g = this.g;
    g.scene.remove(this.merchant.obj);
    g.interactables = g.interactables.filter((it) => it.id !== 'merchant');
    this.merchant = null;
    g.ui.toast(L('พ่อค้าเร่เก็บแผงเดินทางต่อไปแล้ว', 'The pedlar has packed his wares and moved on'));
  }

  updateMerchant(dt) {
    const g = this.g, m = this.merchant, p = g.player.pos;
    // turn to face you as you come near; ring the bell now and then so you can find him
    const d = m.pos.distanceTo(p);
    if (d < 8) m.obj.rotation.y += (Math.atan2(p.x - m.pos.x, p.z - m.pos.z) - m.obj.rotation.y) * Math.min(1, dt * 2);
    m.obj.children[0].rotation.z = Math.sin(g.time * 1.3) * 0.03;
    this.bellT -= dt;
    if (this.bellT <= 0 && d < 90) {
      this.bellT = 5 + Math.random() * 4;
      for (let i = 0; i < 3; i++) g.audio.metal({ freq: 1760 + i * 220, dur: 0.6, gain: 0.05, delay: i * 0.14, partials: [1, 2.4], pos: { x: m.pos.x, y: m.pos.y + 1.5, z: m.pos.z } });
    }
  }

  talk() {
    const g = this.g, m = this.merchant, P = L('พ่อค้าเร่', 'Pedlar');
    const lines = g.dayNight.isNight
      ? [[P, L('ชู่ว... เดินเบา ๆ หน่อยสหาย คืนนี้มีของดีแต่ไม่มีเวลาต่อราคานะ', 'Shh... tread softly, friend. Fine wares tonight, but no time for haggling.')]]
      : [[P, L('อ้า! ลูกค้าคนแรกของวัน ของจากทั่วสารทิศ ราคามิตรภาพ!', 'Ah! First customer of the day. Wares from every corner of the land, at a friend\'s price!')], [P, L('ข้าอยู่ถึงรุ่งสางพรุ่งนี้เท่านั้นนะ แล้วข้าก็จะไปที่อื่นต่อ', 'I stay only until tomorrow\'s dawn. Then I am off elsewhere.')]];
    return {
      lines,
      options: [
        { label: L('ดูสินค้า / ขายสมบัติ', 'Browse wares / Sell treasure'), fn: () => g.openMenu('merchant') },
        { label: L('มีข่าวลืออะไรบ้างไหม', 'Heard any rumours?'), keepOpen: true, fn: () => g.ui.openDialogue({ lines: [[P, this.rumour()]], options: [{ label: L('ขอบใจ', 'My thanks'), fn: () => {} }] }) },
        { label: L('ลาก่อน', 'Farewell'), fn: () => {} },
      ],
      where: m.where,
    };
  }

  rumour() {
    if (this.bloodMoon) return L('จันทร์แดงแบบนี้ พวกร่างซีดจะคลั่งไปทั้งคืน... แต่คนกล้าจะได้ของดีจากพวกมันเพียบ', 'Under a red moon like this, the Pale Ones rage all night... but the bold will strip fine things from their corpses.');
    return [
      L('ได้ยินว่าใต้ซี่โครงยักษ์มีบางอย่างร้องไห้ทุกคืน ถ้าได้ยินเสียงสะอื้นข้างหลัง... อย่าหันไปช้า ๆ ล่ะ', 'They say something weeps beneath the great ribcage every night. If you hear sobbing behind you... don\'t turn slowly.'),
      L('ดาวตกบนบึงนี่ไม่ใช่ดาวธรรมดานะ เศษของมันขายได้ราคาดีกับข้า', 'The stars that fall on this marsh are no common stars. I pay well for their shards.'),
      L('บางเช้าหมอกลงหนาจนพวกมันมองไม่เห็นเรา... เป็นเวลาดีสำหรับคนที่อยากเดินผ่านป่าตะวันตก', 'Some mornings the fog lies so thick they cannot see us... a good hour to slip through the western woods.'),
      L('ข้ามีแผนที่ขุมทรัพย์ที่ซื้อจากคนตายมา... สนใจไหมล่ะ', 'I have a treasure map, bought off a dead man... interested?'),
      L('เทียนหลอมที่โรงเตี๊ยมนั่นน่ะ เขาว่าไม่เคยนอนเลยมาร้อยปีแล้ว', 'Tallow, the one at the inn? They say he hasn\'t slept in a hundred years.'),
    ][Math.floor(Math.random() * 5)];
  }

  // a treasure map: points the compass at an unopened chest
  buyMap() {
    const g = this.g, p = g.player.pos;
    const closed = g.loot.chests.filter((ch) => !ch.open && (!this.chestHint || ch.id !== this.chestHint.id));
    if (!closed.length) return false;
    closed.sort((a, b) => a.pos.distanceTo(p) - b.pos.distanceTo(p));
    const ch = closed[Math.floor(Math.random() * Math.min(3, closed.length))];
    this.chestHint = { id: ch.id, x: ch.pos.x, z: ch.pos.z };
    g.ui.toast(L('แผนที่ขุมทรัพย์: มีหีบสมบัติที่ยังไม่มีใครเปิด (ดูเข็มทิศ)', 'Treasure map: a chest no one has yet opened (see compass)'));
    return true;
  }

  // ---------------------------------------------------------------- falling star
  fallingStar() {
    const g = this.g, p = g.player.pos;
    let x = 0, z = 0;
    for (let tries = 0; tries < 30; tries++) {
      const a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 100;
      x = clamp(p.x + Math.cos(a) * r, -720, 720); z = clamp(p.z + Math.sin(a) * r, -720, 720);
      if (g.terrain.getHeight(x, z) > 0.4) break;
    }
    const y = g.terrain.getHeight(x, z);
    const land = new THREE.Vector3(x, y, z);
    const from = land.clone().add(new THREE.Vector3((Math.random() - 0.5) * 300, 220, (Math.random() - 0.5) * 300));
    const mat = g.M.sprite.clone();
    mat.color = new THREE.Color(1.6, 1.5, 1.2);
    mat.fog = false;
    const trail = [];
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(mat);
      s.scale.setScalar(9 - i * 0.7);
      g.scene.add(s);
      trail.push(s);
    }
    this.star = { land, from, t: 0, dur: 2.6, trail, mat, landed: false, until: this.now + 0.3 };
    this.announce('star');
    g.audio.tone({ freq: 2400, dur: 2.6, type: 'sine', gain: 0.04, slide: 0.35, verb: 0.8 });
  }

  updateStar(dt) {
    const g = this.g, s = this.star;
    s.t += dt;
    if (!s.landed) {
      const k = Math.min(1, s.t / s.dur);
      s.trail.forEach((sp, i) => {
        const kk = Math.max(0, k - i * 0.012);
        sp.position.lerpVectors(s.from, s.land, kk * kk);
        sp.visible = kk > 0;
      });
      if (k >= 1) this.starLands();
      return;
    }
    // the crater glows; the column of light fades as the shard cools
    const pulse = 0.5 + Math.sin(g.time * 3) * 0.12;
    s.beam.material.opacity = pulse * clamp((s.until - this.now) / 0.1, 0, 1);
    const gone = !g.loot.pickups.includes(s.pk);
    if (gone || this.now >= s.until) {
      if (!gone) g.loot.removePickup(s.pk);
      g.scene.remove(s.beam);
      this.star = null;
      if (!gone) g.ui.toast(L('แสงของเศษดาวดับลงแล้ว...', 'The star shard\'s light has died...'));
    }
  }

  starLands() {
    const g = this.g, s = this.star;
    s.landed = true;
    for (const sp of s.trail) g.scene.remove(sp);
    const geo = new THREE.CylinderGeometry(0.5, 1.4, 90, 10, 1, true);
    geo.translate(0, 45, 0);
    s.beam = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.9, 0.85, 1.4), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
    }));
    s.beam.position.copy(s.land);
    g.scene.add(s.beam);
    s.pk = g.loot.spawnPickup('star_shard', 1, { x: s.land.x, z: s.land.z });
    g.particles.burst(s.land.clone().setY(s.land.y + 1), 30, 8, 1.4);
    const d = s.land.distanceTo(g.player.pos);
    g.audio.thunder(d / 343);
    g.player.shake = Math.max(g.player.shake, clamp(0.5 - d / 300, 0, 0.4));
  }

  // ---------------------------------------------------------------- HUD & compass
  markers() {
    const out = [];
    if (this.merchant) out.push({ x: this.merchant.pos.x, z: this.merchant.pos.z, label: L('พ่อค้า', 'Pedlar'), kind: 'event' });
    if (this.star?.landed) out.push({ x: this.star.land.x, z: this.star.land.z, label: L('ดาว', 'Star'), kind: 'event' });
    if (this.chestHint) {
      const ch = this.g.loot.chests.find((c) => c.id === this.chestHint.id);
      if (ch && !ch.open) out.push({ x: ch.pos.x, z: ch.pos.z, label: L('หีบ', 'Chest'), kind: 'event' });
      else this.chestHint = null;
    }
    return out;
  }

  chips() {
    const out = [];
    if (this.bloodMoon) out.push(L('🌑 จันทร์เลือด — ร่างซีดคลั่ง · ดรอป ×2', '🌑 Blood Moon — the Pale Ones rage · Drops ×2'));
    if (this.fogActive) out.push(L('🌫 หมอกหนา — ศัตรูเห็นเจ้าได้ใกล้ลง', '🌫 Heavy fog — foes see you only up close'));
    if (this.merchant) out.push(L(`🔔 พ่อค้าเร่ที่${this.merchant.where}`, `🔔 Pedlar at ${this.merchant.where}`));
    return out;
  }

  // blood moon loot: Pale Ones drop blood amber
  extraDrops(enemy) {
    return this.bloodMoon && PALE.has(enemy.type) && Math.random() < 0.4 ? [['blood_amber', 1]] : [];
  }

  serialize() {
    const m = this.merchant;
    return {
      day: this.day, bloodMoon: this.bloodMoon, lastBlood: this.lastBlood, fogUntil: this.fogUntil, chestHint: this.chestHint,
      merchant: m ? { spot: m.spot, until: m.until, stock: m.stock } : null,
    };
  }

  load(d = {}) {
    this.day = d.day ?? 0;
    this.lastBlood = d.lastBlood ?? -9;
    this.fogUntil = d.fogUntil ?? -1;
    this.chestHint = d.chestHint || null;
    this.prevT = this.g.dayNight.t;
    if (d.bloodMoon && this.g.dayNight.isNight) this.startBloodMoon(true);
    if (d.merchant && this.now < d.merchant.until) {
      this.merchantArrives(d.merchant.spot, true);
      this.merchant.until = d.merchant.until;
      this.merchant.stock = d.merchant.stock.filter((w) => w.id === 'map' || ITEMS[w.id]);
    }
  }
}
