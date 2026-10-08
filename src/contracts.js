// Bounty contracts, Witcher style. A notice board by the inn door posts up to three contracts a
// day. Take one, go to where it happened, read the signs (each clue tells you more: where the
// thing sleeps and what it fears), then hunt the named creature at its lair. Bring proof back to
// the board for the reward.
//
// Named creatures are tougher versions of the usual foes with one trait that changes the fight:
//   regen  - knits its wounds closed unless it is burning or bleeding
//   shroud - vanishes into the dark beyond a few steps (an echo or cat's-eye potion shows it)
//   brood  - keeps calling crawlers to its side
//   frenzy - goes berserk below half health
//   stone  - light blows glance off; only heavy ones bite
// The hand-written contracts come first; after that the board makes up new ones.
import * as THREE from 'three';
import { part, mergeGeometries } from './util.js';
import { ITEMS } from './items.js';
import { ENEMY_TYPES } from './combat.js';
import { TAVERN } from './layout.js';

const C = (r, g, b) => new THREE.Color(r, g, b);

export const AFFIXES = {
  regen: { name: 'ฟื้นตัว', hint: 'แผลของมันสมานเองต่อหน้าต่อตา เว้นแต่จะติดไฟหรือเลือดไหลไม่หยุด (ไฟ, ปลิง, น้ำมันดาบ)' },
  shroud: { name: 'เงาพราง', hint: 'มันหายไปในความมืดเมื่ออยู่ห่างเกินไม่กี่ก้าว เสียงสะท้อนหรือยาตาแมวจะเผยตัวมัน' },
  brood: { name: 'แม่รัง', hint: 'มันเรียกลูก ๆ ร่างคลานมาช่วยไม่หยุด ฆ่ามันให้เร็วที่สุด' },
  frenzy: { name: 'คลั่ง', hint: 'พอบาดเจ็บหนักมันจะคลั่ง เร็วและแรงขึ้นมาก เก็บยาไว้ให้พร้อม' },
  stone: { name: 'หนังหิน', hint: 'ผิวหนังแข็งเหมือนหิน ฟันเบาแทบไม่เข้า ต้องฟันหนักเท่านั้น' },
};

// time: when the creature is about ('night' | 'day' | 'always')
const CONTRACTS = [
  {
    id: 'brood_mother', type: 'crawler', affix: 'brood', name: 'แม่ร่างคลานใต้ซี่โครง', time: 'night',
    giver: 'ชาวประมงในบึง', title: 'ลูกชายข้าหายไปใต้ซี่โครงยักษ์',
    text: 'ลูกชายข้าไปวางอวนแถวกระดูกยักษ์แล้วไม่กลับมา ได้ยินเสียงอะไรกุกกักใต้ซี่โครงทุกคืน ใครช่วยข้าได้ ข้ามีเงินเก็บอยู่บ้าง',
    scene: [-14, 160], lair: [-38, 192], coins: 90, items: [['claw', 4]],
    clues: ['อวนขาดเป็นริ้ว... รอยเล็บเล็ก ๆ นับสิบรอยมุ่งไปทางเดียวกัน ไม่ใช่ตัวเดียวแน่', 'เปลือกไข่สีซีดขนาดเท่ากำปั้น... มีอะไรวางไข่อยู่แถวนี้', 'รอยลากยาวเข้าไปในพงหญ้าทางตะวันตกเฉียงเหนือ กลิ่นคาวคลุ้ง รังของมันอยู่ไม่ไกล'],
  },
  {
    id: 'old_tusk', type: 'wolf', affix: 'frenzy', name: 'เขี้ยวเฒ่า จ่าฝูงเงา', time: 'always',
    giver: 'คนตัดฟืน', title: 'หมาป่าตาเดียวกินม้าข้า',
    text: 'มันตัวใหญ่กว่าหมาป่าตัวอื่นครึ่งเท่า ตาข้างหนึ่งบอด กัดม้าข้าตายต่อหน้า ข้าตั้งค่าหัวมัน',
    scene: [-110, 0], lair: [-150, -95], coins: 70, items: [['fang', 4]],
    clues: ['ซากม้า... รอยกัดที่คอกว้างกว่าฝ่ามือ ตัวนี้ไม่ใช่หมาป่าธรรมดา', 'ขนสีดำปนขาวติดกิ่งไม้ แก่มากแล้ว แต่ตัวที่แก่ที่สุดมักคลั่งที่สุดเวลาบาดเจ็บ', 'รอยตีนมุ่งลงใต้ไปทางป่าทึบใกล้หัวราชาหิน มันคงกลับรัง'],
  },
  {
    id: 'hollow_man', type: 'straw', affix: 'stone', name: 'หุ่นไร้หน้าแห่งทุ่งเหนือ', time: 'day',
    giver: 'โกวัก (ผู้เลี้ยงแกะ)', title: 'หุ่นฟางที่ฟันไม่เข้า',
    text: 'กาาา... มีหุ่นฟางตัวหนึ่งไม่มีหน้า ข้าเอาเคียวฟันมันแล้วเคียวบิ่น! มันยังเดินไล่แกะข้าอยู่ทุกวัน',
    scene: [205, -70], lair: [232, -100], coins: 60, items: [['moonstone', 1]],
    clues: ['เคียวหักครึ่ง... ใบมีดบิ่นราวกับฟันโดนหิน', 'ฟางที่ร่วงอยู่เคลือบด้วยดินเหนียวแข็ง ฟันเบา ๆ คงไม่เข้า ต้องทุ่มแรงทั้งตัว', 'รอยกระโดดเป็นจังหวะไปทางตะวันออกเฉียงเหนือ มันกลับไปยืนเฝ้าที่เดิม'],
  },
  {
    id: 'bell_leech', type: 'leech', affix: 'regen', name: 'ปลิงใต้ระฆังจม', time: 'night',
    giver: 'คนเฝ้าวิหาร', title: 'อะไรบางอย่างดูดเลือดคนข้ามบึง',
    text: 'คนข้ามบึงตอนกลางคืนกลับมาซีดเหมือนกระดาษ สองคนไม่กลับมาเลย ข้าว่ามันคือปลิงตัวที่โตเกินปลิง',
    scene: [5, 200], lair: [20, 225], coins: 80, items: [['pearl', 1]],
    clues: ['ผ้าคลุมเปื้อนเลือดลอยติดกก... เลือดเยอะเกินกว่าแผลธรรมดา', 'รอยแผลบนตอไม้สมานตัวเองแล้วทั้งที่เพิ่งถูกกัด มันฟื้นตัวเร็วมาก ต้องทำให้มันเลือดไหลไม่หยุดหรือเผามัน', 'ฟองอากาศผุดขึ้นเป็นระยะทางใต้ น้ำตรงนั้นลึกที่สุดในบึง'],
  },
  {
    id: 'canyon_eater', type: 'gaunt', affix: 'regen', name: 'ผู้กินศพแห่งหุบผา', time: 'night',
    giver: 'นักขุดแร่', title: 'หลุมศพที่หุบผาถูกขุด',
    text: 'หลุมศพคนงานเหมืองที่เชิงหุบผาถูกขุดคุ้ยทุกคืน กระดูกกระจายเต็มไปหมด ข้าไม่กล้าขึ้นไปขุดแร่อีกแล้ว',
    scene: [-2, -140], lair: [14, -118], coins: 85, items: [['ore', 2]],
    clues: ['ดินถูกขุดด้วยมือ... เล็บยาวมาก รอยเล็บซ้อนกันหลายชั้นเหมือนขุดทุกคืน', 'กระดูกถูกแทะจนเกลี้ยง มันกินแล้วแผลสมาน เป็นร่างซูบที่ฟื้นตัวได้ — ไฟหรือแผลเลือดไหลเท่านั้นที่หยุดมันได้', 'รอยเท้าเปลือยมุ่งลงทางตะวันออกเฉียงใต้ ไปซ่อนในหลืบหิน'],
  },
  {
    id: 'bedside_shadow', type: 'gaunt', affix: 'shroud', name: 'เงาที่ยืนข้างเตียง', time: 'night',
    giver: 'แม่ม่ายในหมู่บ้าน', title: 'มีบางอย่างยืนมองข้าตอนหลับ',
    text: 'ทุกคืนข้าตื่นมาเห็นเงายาว ๆ ยืนอยู่ปลายเตียง พอจุดตะเกียงมันก็หายไป หมาของข้าหายไปแล้ว ข้ากลัวว่าคืนนี้จะเป็นข้า',
    scene: [97, -18], lair: [118, -46], coins: 100, items: [['sight', 2]],
    clues: ['รอยมือยาวผิดคนบนหน้าต่าง... สูงเกินกว่าคนจะเอื้อมถึง', 'ขนหมาและเลือดแห้งที่รั้ว พอมองไปไกล ๆ ก็ไม่เห็นอะไร ทั้งที่ได้ยินเสียงหายใจ — มันพรางตัวในความมืด เสียงสะท้อนหรือยาตาแมวน่าจะช่วยได้', 'รอยเท้าบาง ๆ หายเข้าไปในทุ่งทางใต้ ข้างกองหินเก่า'],
  },
  {
    id: 'shepherd_bane', type: 'brute', affix: 'stone', name: 'ยักษ์ผู้กินแกะ', time: 'always',
    giver: 'โกวัก (ผู้เลี้ยงแกะ)', title: 'แกะหายไปทีละสามตัว',
    text: 'กาาา! ทุกสามวันแกะข้าหายสามตัว เหลือแต่ขนกับรอยเท้าใหญ่เท่าเกวียน มันเดินมาจากทะเลสาบใต้ปราสาท',
    scene: [150, 120], lair: [125, 188], coins: 150, items: [['pale_heart', 1]],
    clues: ['รอยเท้าลึกครึ่งศอก... หนักเท่าวัวสามตัว', 'ก้อนหินที่มันพิงไว้แตกร้าว ผิวมันแข็งยิ่งกว่าหิน ฟันเบาไม่มีผล ต้องฟันหนักหรือทุบ', 'ขนแกะติดอยู่ตามทางไปริมทะเลสาบใต้ปราสาทลอยฟ้า'],
  },
  {
    id: 'grey_widow', type: 'weeper', affix: 'frenzy', name: 'แม่ม่ายผมเทา', time: 'night',
    giver: 'เทียนหลอม (เจ้าของโรงเตี๊ยม)', title: 'เสียงร้องไห้ในซากโบสถ์ตะวันตก',
    text: 'ลูกค้าข้าสามคนหายไปหลังได้ยินเสียงผู้หญิงร้องไห้ใกล้ซากโบสถ์ ข้ารู้จักเสียงนั้น... นางเคยเป็นคนของหมู่บ้านนี้ ช่วยให้นางได้พักเสียที',
    scene: [-130, -88], lair: [-150, -112], coins: 130, items: [['locket', 1]],
    clues: ['ผ้าคลุมไหล่ลายลูกไม้... เป็นของคนในหมู่บ้านเมื่อนานมาแล้ว', 'ผมสีเทายาวพันอยู่กับหนาม นางจะไม่ขยับถ้าเรามองนาง แต่ถ้าเจ็บหนักนางจะคลั่งจนไม่สนอะไร', 'เสียงสะอื้นแว่วมาจากซากกำแพงทางใต้ นางรออยู่ตรงนั้น'],
  },
];

// for contracts the board invents once the hand-written ones are done
const PROC_TYPES = [['gaunt', 'night'], ['crawler', 'night'], ['wolf', 'always'], ['straw', 'day'], ['brute', 'always']];
const PROC_ADJ = ['ตาแดง', 'ไร้เงา', 'หิวโหย', 'แผลเป็น', 'เฒ่า', 'ผมขาว', 'เสียงกระซิบ', 'กระดูกดำ'];
const PROC_PLACES = [
  { name: 'ป่าตะวันตก', scene: [-120, 40], lair: [-150, 70] }, { name: 'ริมรางรถไฟ', scene: [40, 100], lair: [60, 125] },
  { name: 'บึงใต้', scene: [-90, 230], lair: [-60, 250] }, { name: 'ทุ่งตะวันออก', scene: [220, 10], lair: [240, 40] },
  { name: 'เชิงหุบผา', scene: [20, -110], lair: [-20, -125] }, { name: 'ชายป่าใกล้เห็ดยักษ์', scene: [-170, 60], lair: [-195, 85] },
];
const TYPE_NAMES = { gaunt: 'ร่างซูบ', crawler: 'ร่างคลาน', wolf: 'หมาป่า', straw: 'หุ่นฟาง', brute: 'ยักษ์ซูบ', hollow: 'ผู้หลงทาง' };

export const BOARD = { x: TAVERN.x + 5, z: TAVERN.z - 9 };

export class Contracts {
  constructor(game) {
    this.g = game;
    this.offers = [];       // contract objects on the board
    this.active = [];       // accepted: { c, state: 'scene'|'hunt'|'trophy', found: [], clues: [], target }
    this.done = new Set();
    this.lastDay = -1;
    this.procN = 0;
    this.buildBoard();
  }

  // ---------------------------------------------------------------- the notice board
  buildBoard() {
    const g = this.g, M = g.M, { x, z } = BOARD;
    const y = g.terrain.getHeight(x, z);
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(mergeGeometries([
      part(new THREE.BoxGeometry(0.14, 2.6, 0.14), C(0.4, 0.3, 0.22), { pos: [-0.9, 1.3, 0] }),
      part(new THREE.BoxGeometry(0.14, 2.6, 0.14), C(0.4, 0.3, 0.22), { pos: [0.9, 1.3, 0] }),
      part(new THREE.BoxGeometry(1.9, 1.15, 0.08), C(0.48, 0.36, 0.26), { pos: [0, 1.55, 0] }),
      part(new THREE.BoxGeometry(2.3, 0.08, 0.6), C(0.32, 0.24, 0.18), { pos: [0, 2.6, 0.05], rot: [0.25, 0, 0] }),
    ]), M.wood));
    // pinned notices
    this.papers = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(part(new THREE.PlaneGeometry(0.44, 0.58), C(0.62, 0.56, 0.42)), M.plain);
      m.position.set(-0.58 + i * 0.58, 1.56 + (i % 2) * 0.05, 0.05);
      m.rotation.z = (i - 1) * 0.06;
      grp.add(m);
      this.papers.push(m);
    }
    const lamp = new THREE.Sprite(M.candleSprite);
    lamp.position.set(1.05, 2.25, 0.25);
    lamp.scale.setScalar(0.9);
    grp.add(lamp);
    grp.position.set(x, y, z);
    grp.rotation.y = Math.PI * 0.9;
    g.scene.add(grp);
    g.collision.addCircle(x - 0.9, z, 0.2);
    g.collision.addCircle(x + 0.9, z, 0.2);
    this.board = grp;
    this.boardPos = new THREE.Vector3(x, y, z);
  }

  // ---------------------------------------------------------------- offers
  refresh() {
    const takenIds = new Set(this.active.map((a) => a.c.id));
    const pool = CONTRACTS.filter((c) => !this.done.has(c.id) && !takenIds.has(c.id));
    this.offers = pool.slice(0, 3);
    while (this.offers.length < 3) this.offers.push(this.invent());
    this.papers.forEach((m, i) => { m.visible = i < this.offers.length; });
  }

  invent() {
    const n = this.procN++;
    const r = (k) => Math.abs(Math.sin(n * 91.7 + k * 13.3)) % 1;
    const [type, time] = PROC_TYPES[Math.floor(r(1) * PROC_TYPES.length)];
    const affixes = Object.keys(AFFIXES).filter((a) => a !== 'brood' || type === 'crawler');
    const affix = affixes[Math.floor(r(2) * affixes.length)];
    const place = PROC_PLACES[Math.floor(r(3) * PROC_PLACES.length)];
    const adj = PROC_ADJ[Math.floor(r(4) * PROC_ADJ.length)];
    const name = `${TYPE_NAMES[type]}${adj}แห่ง${place.name}`;
    const coins = 50 + Math.round(ENEMY_TYPES[type].hp * 6 + r(5) * 30);
    return {
      id: `proc_${n}`, proc: n, type, affix, name, time,
      giver: 'ประกาศของหมู่บ้าน', title: `ค่าหัว: ${name}`,
      text: `มีคนเห็น${TYPE_NAMES[type]}ตัวหนึ่งแปลกกว่าตัวอื่นแถว${place.name} ทำร้ายคนไปแล้วหลายราย หมู่บ้านตั้งค่าหัวไว้`,
      scene: place.scene, lair: place.lair, coins, items: [['potion', 1]],
      clues: ['รอยเลือดและรอยลากยังใหม่อยู่... มันผ่านมาไม่นาน', `ร่องรอยบอกนิสัยของมัน: ${AFFIXES[affix].hint}`, 'รอยเท้ามุ่งออกไปทางรังของมัน ไม่ไกลจากที่นี่'],
    };
  }

  // nudge a point onto dry land (or into the water, for a leech)
  spot([x0, z0], water = false) {
    const T = this.g.terrain, good = (x, z) => (water ? T.getHeight(x, z) < -0.3 : T.getHeight(x, z) > 0.4);
    for (let r = 0; r < 60; r += 1.5) {
      for (let k = 0; k < 12; k++) {
        const a = k / 12 * Math.PI * 2 + r, x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
        if (good(x, z)) return [x, z];
      }
    }
    return [x0, z0];
  }

  take(c) {
    const g = this.g;
    if (this.active.length >= 2) { g.ui.toast('รับงานพร้อมกันได้แค่ 2 งาน'); return false; }
    this.offers = this.offers.filter((o) => o !== c);
    const a = this.track(c, 'scene', [false, false, false]);
    this.active.push(a);
    this.placeClues(a);
    g.ui.toast(`รับงาน: ${c.title} — ไปดูที่เกิดเหตุ (ดูเข็มทิศ)`);
    g.audio.ui();
    this.papers.forEach((m, i) => { m.visible = i < this.offers.length; });
    return true;
  }

  track(c, state, found) {
    return { c, state, found, clues: [], target: null, scene: this.spot(c.scene), lair: this.spot(c.lair, c.type === 'leech') };
  }

  abandon(a) {
    this.clearClues(a);
    this.despawn(a);
    this.active = this.active.filter((x) => x !== a);
    this.g.ui.toast(`ยกเลิกงาน: ${a.c.title}`);
  }

  // ---------------------------------------------------------------- clues at the scene
  placeClues(a) {
    const g = this.g, M = g.M, [sx, sz] = a.scene;
    const kinds = [
      { col: C(0.35, 0.03, 0.03), geo: new THREE.CircleGeometry(0.7, 9) },        // blood
      { col: C(0.12, 0.1, 0.08), geo: new THREE.CircleGeometry(0.35, 6) },         // tracks
      { col: C(0.6, 0.55, 0.45), geo: new THREE.PlaneGeometry(0.6, 0.4) },         // torn cloth / bone
    ];
    for (let i = 0; i < 3; i++) {
      let x = sx, z = sz;
      for (let t = 0; t < 12; t++) {
        const ang = i * 2.1 + t * 0.7 + (a.c.proc ?? 0), r = 5 + i * 4 + t;
        x = sx + Math.cos(ang) * r; z = sz + Math.sin(ang) * r;
        if (g.terrain.getHeight(x, z) > 0.15) break;
      }
      const y = Math.max(g.terrain.getHeight(x, z), g.collision.groundAt(x, z, g.terrain.getHeight(x, z) + 2, 0.65));
      const grp = new THREE.Group();
      const k = kinds[i];
      const decal = new THREE.Mesh(k.geo.clone().rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: k.col, transparent: true, opacity: 0.85, depthWrite: false }));
      decal.position.y = 0.05;
      decal.renderOrder = 1;
      grp.add(decal);
      if (i === 1) for (let s = 1; s < 4; s++) { const d2 = decal.clone(); d2.position.set(s * 0.7, 0.05, s * 0.45); grp.add(d2); }
      const glint = new THREE.Sprite(M.candleSprite);
      glint.position.y = 0.5;
      glint.scale.setScalar(0.7);
      grp.add(glint);
      grp.position.set(x, y, z);
      g.scene.add(grp);
      const id = `clue:${a.c.id}:${i}`;
      a.clues.push({ obj: grp, glint, pos: new THREE.Vector3(x, y, z), id });
      if (!a.found[i]) g.interactables.push({ id, pos: new THREE.Vector3(x, y, z), r: 2.4, label: 'ตรวจดูร่องรอย', checkpoint: { x, z } });
      else grp.visible = false;
    }
  }

  clearClues(a) {
    for (const cl of a.clues) this.g.scene.remove(cl.obj);
    this.g.interactables = this.g.interactables.filter((it) => !it.id.startsWith(`clue:${a.c.id}:`));
    a.clues = [];
  }

  inspect(id) {
    const g = this.g, [, cid, si] = id.split(':'), i = +si;
    const a = this.active.find((x) => x.c.id === cid);
    if (!a || a.found[i]) return;
    a.found[i] = true;
    const cl = a.clues[i];
    cl.obj.visible = false;
    g.interactables = g.interactables.filter((it) => it.id !== id);
    const n = a.found.filter(Boolean).length;
    g.audio.pickup('mat');
    const after = () => {
      if (n === 3 && a.state === 'scene') this.reveal(a);
      g.updateHud();
    };
    g.ui.openDialogue({ lines: [['เบาะแส', a.c.clues[i]], ['', `(เบาะแส ${n}/3)`]], options: [{ label: 'ตามรอยต่อ', fn: () => {} }] }, after);
  }

  // all the signs read: the lair is known, the creature waits there
  reveal(a) {
    const g = this.g, aff = AFFIXES[a.c.affix];
    a.state = 'hunt';
    this.spawn(a);
    g.ui.banner(a.c.name, `จุดอ่อน: ${aff.name} — ${aff.hint}`);
    g.audio.discover();
    const when = { night: 'มันออกมาเฉพาะกลางคืน', day: 'มันออกมาเฉพาะกลางวัน', always: '' }[a.c.time];
    setTimeout(() => g.ui.toast(`รังของ${a.c.name}อยู่บนเข็มทิศแล้ว ${when}`), 1600);
  }

  // ---------------------------------------------------------------- the named creature
  spawn(a) {
    const g = this.g, c = a.c, base = ENEMY_TYPES[c.type];
    const e = g.combat.spawn(c.type, a.lair[0], a.lair[1]);
    e.def = {
      ...base, name: c.name, hp: base.hp * 4 + 6, damage: Math.round(base.damage * 1.35), aggro: Math.max(base.aggro, 20),
      leash: 70, respawn: 1e9, coins: [base.coins[1] * 3, base.coins[1] * 4], active: c.time, scale: 1.3, named: true,
    };
    e.hp = e.def.hp;
    e.named = { contract: c.id, affix: c.affix, minions: [] };
    e.obj.scale.setScalar(1.3);
    a.target = e;
    if (c.affix === 'brood') {
      for (let i = 0; i < 3; i++) {
        const m = g.combat.spawn('crawler', a.lair[0] + i, a.lair[1] + 1);
        Object.assign(m, { alive: false, respawn: 1e9, activeOverride: 'never' });
        m.obj.visible = false;
        e.named.minions.push(m);
      }
    }
  }

  despawn(a) {
    const e = a.target;
    if (!e) return;
    for (const m of [e, ...e.named.minions]) {
      m.alive = false; m.respawn = 1e9; m.obj.visible = false;
      if (m.shadow) m.shadow.visible = false;
      this.g.scene.remove(m.obj);
      if (m.shadow) this.g.scene.remove(m.shadow);
    }
    this.g.combat.enemies = this.g.combat.enemies.filter((x) => x !== e && !e.named.minions.includes(x));
    a.target = null;
  }

  // called by combat every frame for each named creature that is awake and close
  updateNamed(e, dt, dist) {
    const g = this.g, af = e.named.affix;
    if (af === 'regen' && !(e.dots && Object.keys(e.dots).length) && e.hp < e.def.hp) {
      e.hp = Math.min(e.def.hp, e.hp + 0.5 * dt);
      if (Math.random() < dt * 2) g.particles.burst(e.pos.clone().setY(e.pos.y + e.def.height * 0.6), 2, 1, 0.3);
    }
    if (af === 'shroud') {
      const seen = dist < 6.5 || g.buffs.sight > 0 || (g.kit.marks || []).some((m) => m.e === e);
      e.obj.visible = seen;
      if (e.shadow) e.shadow.visible = seen;
    }
    if (af === 'frenzy') {
      const mad = e.hp < e.def.hp * 0.5;
      if (mad && !e.named.mad) { e.named.mad = true; g.ui.combatText(`${e.def.name} คลั่ง!`, 'bad'); g.audio.enemyCue(e.type, 'aggro', e.pos); }
      e.spdMul = mad ? 1.5 : 1;
      e.dmgMul = mad ? 1.3 : 1;
    }
    if (af === 'brood' && (e.state === 'chase' || e.state === 'windup')) {
      e.named.callT = (e.named.callT ?? 4) - dt;
      if (e.named.callT <= 0) {
        e.named.callT = 12;
        let n = 0;
        for (const m of e.named.minions) {
          if (m.alive && m.state !== 'dying') continue;
          const ang = Math.random() * Math.PI * 2;
          m.pos.set(e.pos.x + Math.cos(ang) * 2.5, e.pos.y, e.pos.z + Math.sin(ang) * 2.5);
          Object.assign(m, { alive: true, hp: m.def.hp, state: 'chase', t: 0, activeOverride: 'always', dots: null });
          m.obj.position.copy(m.pos);
          if (++n >= 2) break;
        }
        if (n) { g.ui.combatText('มันเรียกลูก ๆ มาช่วย!', 'bad'); g.audio.enemyCue('crawler', 'aggro', e.pos); }
      }
    }
  }

  onKill(e) {
    if (!e.named) return;
    const g = this.g, a = this.active.find((x) => x.target === e);
    for (const m of e.named.minions) if (m.alive && m.state !== 'dying') g.combat.kill(m);
    if (!a) return;
    a.state = 'trophy';
    const left = g.bag.add('trophy', 1);
    if (left) g.loot.dropNearPlayer('trophy', left);
    g.ui.banner('ล่าสำเร็จ', `${a.c.name} — นำหลักฐานไปส่งที่บอร์ดประกาศหน้าโรงเตี๊ยม`);
    g.audio.chime();
  }

  claim(a) {
    const g = this.g, c = a.c;
    if (g.bag.count('trophy') < 1) { g.ui.toast('ไม่มีหลักฐานการล่าในกระเป๋า'); return false; }
    g.bag.remove('trophy', 1);
    g.coins += c.coins;
    for (const [id, n] of c.items) { const left = g.bag.add(id, n); if (left) g.loot.dropNearPlayer(id, left); }
    this.done.add(c.id);
    this.clearClues(a);
    this.active = this.active.filter((x) => x !== a);
    g.audio.coin(); g.audio.chime();
    g.gainXP(100);
    g.ui.banner('รับค่าหัว', `+${c.coins} เหรียญ · ${c.items.map(([id, n]) => `${ITEMS[id].name}${n > 1 ? ` ×${n}` : ''}`).join(' · ')}`);
    g.save();
    return true;
  }

  // ---------------------------------------------------------------- frame
  update(dt) {
    const g = this.g, ev = g.events;
    if (ev.day !== this.lastDay) { this.lastDay = ev.day; this.refresh(); }
    for (const a of this.active) for (const cl of a.clues) if (cl.obj.visible) cl.glint.scale.setScalar(0.6 + Math.sin(g.time * 4 + cl.pos.x) * 0.15);
  }

  markers() {
    const out = [], p = this.g.player.pos;
    for (const a of this.active) {
      if (a.state === 'scene') {
        const [x, z] = a.scene;
        if (Math.hypot(p.x - x, p.z - z) > 30) out.push({ x, z, label: 'ที่เกิดเหตุ', kind: 'bounty' });
        else a.clues.forEach((cl, i) => { if (!a.found[i]) out.push({ x: cl.pos.x, z: cl.pos.z, label: 'เบาะแส', kind: 'bounty' }); });
      } else if (a.state === 'hunt') out.push({ x: a.lair[0], z: a.lair[1], label: 'รัง', kind: 'bounty' });
      else if (a.state === 'trophy') out.push({ x: BOARD.x, z: BOARD.z, label: 'บอร์ด', kind: 'bounty' });
    }
    return out;
  }

  chips() {
    return this.active.map((a) => {
      const st = a.state === 'scene' ? `ตามรอย ${a.found.filter(Boolean).length}/3`
        : a.state === 'hunt' ? `ล่า · จุดอ่อน: ${AFFIXES[a.c.affix].name}` : 'นำหลักฐานไปส่งที่บอร์ด';
      return `📜 ${a.c.name} — ${st}`;
    });
  }

  // ---------------------------------------------------------------- save
  serialize() {
    const pack = (c) => (c.proc != null ? { proc: c.proc } : { id: c.id });
    return {
      done: [...this.done], lastDay: this.lastDay, procN: this.procN,
      offers: this.offers.map(pack),
      active: this.active.map((a) => ({ ...pack(a.c), state: a.state, found: a.found, hp: a.target?.alive ? a.target.hp : null })),
    };
  }

  load(d = {}) {
    for (const a of this.active) { this.clearClues(a); this.despawn(a); }
    this.active = [];
    this.done = new Set(d.done || []);
    this.procN = d.procN ?? 0;
    const unpack = (o) => {
      if (o.proc == null) return CONTRACTS.find((c) => c.id === o.id);
      const n = this.procN; this.procN = o.proc;
      const c = this.invent();
      this.procN = n;
      return c;
    };
    for (const o of d.active || []) {
      const c = unpack(o);
      if (!c) continue;
      const a = this.track(c, o.state, o.found || [false, false, false]);
      this.active.push(a);
      this.placeClues(a);
      if (a.state === 'hunt') { this.spawn(a); if (o.hp) a.target.hp = o.hp; }
    }
    this.offers = (d.offers || []).map(unpack).filter(Boolean);
    this.lastDay = d.lastDay ?? this.g.events.day;
    if (!this.offers.length) this.refresh();
    this.papers.forEach((m, i) => { m.visible = i < this.offers.length; });
  }
}

