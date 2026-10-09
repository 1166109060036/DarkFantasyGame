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
import { pathWeapons } from './equipment.js';
import { ENEMY_TYPES } from './combat.js';
import { TAVERN } from './layout.js';
import { L } from './i18n.js';

const C = (r, g, b) => new THREE.Color(r, g, b);

export const AFFIXES = {
  regen: { name: L('ฟื้นตัว', 'Regrowth'), hint: L('แผลของมันสมานเองต่อหน้าต่อตา เว้นแต่จะติดไฟหรือเลือดไหลไม่หยุด (ไฟ, ปลิง, น้ำมันดาบ)', 'Its wounds close before your eyes, unless it burns or bleeds without end (fire, leeches, blade oil).') },
  shroud: { name: L('เงาพราง', 'Shroud'), hint: L('มันหายไปในความมืดเมื่ออยู่ห่างเกินไม่กี่ก้าว เสียงสะท้อนหรือยาตาแมวจะเผยตัวมัน', "It melts into the dark beyond a few paces. An echo or a Cat's-Eye Potion will lay it bare.") },
  brood: { name: L('แม่รัง', 'Brood'), hint: L('มันเรียกลูก ๆ ร่างคลานมาช่วยไม่หยุด ฆ่ามันให้เร็วที่สุด', 'It calls its Crawler young to its side without end. Kill it swiftly.') },
  frenzy: { name: L('คลั่ง', 'Frenzy'), hint: L('พอบาดเจ็บหนักมันจะคลั่ง เร็วและแรงขึ้นมาก เก็บยาไว้ให้พร้อม', 'Badly hurt, it goes berserk, far faster and stronger. Keep your draughts at hand.') },
  stone: { name: L('หนังหิน', 'Stoneskin'), hint: L('ผิวหนังแข็งเหมือนหิน ฟันเบาแทบไม่เข้า ต้องฟันหนักเท่านั้น', 'Its hide is hard as stone. Light attacks barely bite; only heavy attacks will do.') },
};

// time: when the creature is about ('night' | 'day' | 'always')
const CONTRACTS = [
  {
    id: 'brood_mother', type: 'crawler', affix: 'brood', name: L('แม่ร่างคลานใต้ซี่โครง', 'Brood-Mother Beneath the Ribs'), time: 'night',
    giver: L('ชาวประมงในบึง', 'A marsh fisherman'), title: L('ลูกชายข้าหายไปใต้ซี่โครงยักษ์', 'My son vanished beneath the great ribs'),
    text: L('ลูกชายข้าไปวางอวนแถวกระดูกยักษ์แล้วไม่กลับมา ได้ยินเสียงอะไรกุกกักใต้ซี่โครงทุกคืน ใครช่วยข้าได้ ข้ามีเงินเก็บอยู่บ้าง', 'My son went to set his nets by the giant bones and never came back. Every night something scrabbles beneath the ribs. Whoever can help me, I have a little coin put by.'),
    scene: [-14, 160], lair: [-38, 192], coins: 90, items: [['claw', 4]], gear: ['arm_leather'],
    clues: [L('อวนขาดเป็นริ้ว... รอยเล็บเล็ก ๆ นับสิบรอยมุ่งไปทางเดียวกัน ไม่ใช่ตัวเดียวแน่', 'A net torn to ribbons... dozens of small claw marks, all heading one way. This was no lone beast.'), L('เปลือกไข่สีซีดขนาดเท่ากำปั้น... มีอะไรวางไข่อยู่แถวนี้', 'Pale eggshells the size of a fist... something is laying eggs nearby.'), L('รอยลากยาวเข้าไปในพงหญ้าทางตะวันตกเฉียงเหนือ กลิ่นคาวคลุ้ง รังของมันอยู่ไม่ไกล', 'A long drag mark into the reeds to the north-west, reeking of rot. Its nest is not far.')],
  },
  {
    id: 'old_tusk', type: 'wolf', affix: 'frenzy', name: L('เขี้ยวเฒ่า จ่าฝูงเงา', 'Old Fang, Leader of the Shadow Pack'), time: 'always',
    giver: L('คนตัดฟืน', 'A woodcutter'), title: L('หมาป่าตาเดียวกินม้าข้า', 'A one-eyed wolf ate my horse'),
    text: L('มันตัวใหญ่กว่าหมาป่าตัวอื่นครึ่งเท่า ตาข้างหนึ่งบอด กัดม้าข้าตายต่อหน้า ข้าตั้งค่าหัวมัน', 'Half again the size of any other wolf, and blind in one eye. It tore my horse apart before me. I put a price on its head.'),
    scene: [-110, 0], lair: [-150, -95], coins: 70, items: [['fang', 4]], gear: ['path:1'],
    clues: [L('ซากม้า... รอยกัดที่คอกว้างกว่าฝ่ามือ ตัวนี้ไม่ใช่หมาป่าธรรมดา', "The horse's carcass... a bite at the throat wider than a palm. No common wolf did this."), L('ขนสีดำปนขาวติดกิ่งไม้ แก่มากแล้ว แต่ตัวที่แก่ที่สุดมักคลั่งที่สุดเวลาบาดเจ็บ', 'Black fur shot with white, caught on a branch. Very old. But the oldest ones rage the worst when wounded.'), L('รอยตีนมุ่งลงใต้ไปทางป่าทึบใกล้หัวราชาหิน มันคงกลับรัง', "Pawprints lead south into the thick woods near the Stone King's head. It has gone back to its den.")],
  },
  {
    id: 'hollow_man', type: 'straw', affix: 'stone', name: L('หุ่นไร้หน้าแห่งทุ่งเหนือ', 'Faceless Effigy of the North Field'), time: 'day',
    giver: L('โกวัก (ผู้เลี้ยงแกะ)', 'Kowak (the shepherd)'), title: L('หุ่นฟางที่ฟันไม่เข้า', 'A Strawman no blade can cut'),
    text: L('กาาา... มีหุ่นฟางตัวหนึ่งไม่มีหน้า ข้าเอาเคียวฟันมันแล้วเคียวบิ่น! มันยังเดินไล่แกะข้าอยู่ทุกวัน', 'Caaaw... there is a Strawman with no face. I struck it with my scythe and the scythe chipped! It still chases my sheep every day.'),
    scene: [205, -70], lair: [232, -100], coins: 60, items: [['moonstone', 1]],
    clues: [L('เคียวหักครึ่ง... ใบมีดบิ่นราวกับฟันโดนหิน', 'A scythe snapped in two... its edge chipped as if it had struck stone.'), L('ฟางที่ร่วงอยู่เคลือบด้วยดินเหนียวแข็ง ฟันเบา ๆ คงไม่เข้า ต้องทุ่มแรงทั้งตัว', 'The fallen straw is caked in hard clay. Light blows will not pierce it; put your whole weight behind each strike.'), L('รอยกระโดดเป็นจังหวะไปทางตะวันออกเฉียงเหนือ มันกลับไปยืนเฝ้าที่เดิม', 'Hopping tracks, evenly spaced, lead north-east. It has gone back to stand its old watch.')],
  },
  {
    id: 'bell_leech', type: 'leech', affix: 'regen', name: L('ปลิงใต้ระฆังจม', 'Leech Beneath the Sunken Bell'), time: 'night',
    giver: L('คนเฝ้าวิหาร', 'The temple keeper'), title: L('อะไรบางอย่างดูดเลือดคนข้ามบึง', 'Something drains those who cross the marsh'),
    text: L('คนข้ามบึงตอนกลางคืนกลับมาซีดเหมือนกระดาษ สองคนไม่กลับมาเลย ข้าว่ามันคือปลิงตัวที่โตเกินปลิง', 'Those who cross the marsh by night come back pale as paper. Two never came back at all. I say it is a leech grown beyond any leech.'),
    scene: [5, 200], lair: [20, 225], coins: 80, items: [['pearl', 1]],
    clues: [L('ผ้าคลุมเปื้อนเลือดลอยติดกก... เลือดเยอะเกินกว่าแผลธรรมดา', 'A bloodied cloak caught in the reeds... far too much blood for a common wound.'), L('รอยแผลบนตอไม้สมานตัวเองแล้วทั้งที่เพิ่งถูกกัด มันฟื้นตัวเร็วมาก ต้องทำให้มันเลือดไหลไม่หยุดหรือเผามัน', 'Fresh bites on a stump, yet already healed over. It mends fast. Make it bleed without end, or burn it.'), L('ฟองอากาศผุดขึ้นเป็นระยะทางใต้ น้ำตรงนั้นลึกที่สุดในบึง', 'Bubbles rise now and then to the south, where the marsh runs deepest.')],
  },
  {
    id: 'canyon_eater', type: 'gaunt', affix: 'regen', name: L('ผู้กินศพแห่งหุบผา', 'Corpse-Eater of the Gorge'), time: 'night',
    giver: L('นักขุดแร่', 'A miner'), title: L('หลุมศพที่หุบผาถูกขุด', 'The graves at the gorge are dug up'),
    text: L('หลุมศพคนงานเหมืองที่เชิงหุบผาถูกขุดคุ้ยทุกคืน กระดูกกระจายเต็มไปหมด ข้าไม่กล้าขึ้นไปขุดแร่อีกแล้ว', "Every night the miners' graves at the foot of the gorge are dug up, bones strewn everywhere. I dare not go up to mine any more."),
    scene: [-2, -140], lair: [14, -118], coins: 85, items: [['ore', 2]], gear: ['path:2'],
    clues: [L('ดินถูกขุดด้วยมือ... เล็บยาวมาก รอยเล็บซ้อนกันหลายชั้นเหมือนขุดทุกคืน', 'Earth dug by hand... very long nails, the scratches layered deep, as if it digs every night.'), L('กระดูกถูกแทะจนเกลี้ยง มันกินแล้วแผลสมาน เป็นร่างซูบที่ฟื้นตัวได้ — ไฟหรือแผลเลือดไหลเท่านั้นที่หยุดมันได้', 'Bones gnawed clean. It feeds, and its wounds close: a Gaunt that mends itself — only fire or bleeding wounds will stop it.'), L('รอยเท้าเปลือยมุ่งลงทางตะวันออกเฉียงใต้ ไปซ่อนในหลืบหิน', 'Bare footprints lead south-east, into a cleft in the rocks.')],
  },
  {
    id: 'bedside_shadow', type: 'gaunt', affix: 'shroud', name: L('เงาที่ยืนข้างเตียง', 'Shadow at the Bedside'), time: 'night',
    giver: L('แม่ม่ายในหมู่บ้าน', 'A village widow'), title: L('มีบางอย่างยืนมองข้าตอนหลับ', 'Something watches me as I sleep'),
    text: L('ทุกคืนข้าตื่นมาเห็นเงายาว ๆ ยืนอยู่ปลายเตียง พอจุดตะเกียงมันก็หายไป หมาของข้าหายไปแล้ว ข้ากลัวว่าคืนนี้จะเป็นข้า', 'Every night I wake to a long shadow standing at the foot of my bed. When I light the lamp, it is gone. My dog is gone too. I fear tonight it will be me.'),
    scene: [97, -18], lair: [118, -46], coins: 100, items: [['sight', 2]],
    clues: [L('รอยมือยาวผิดคนบนหน้าต่าง... สูงเกินกว่าคนจะเอื้อมถึง', "Handprints on the window, too long to be a man's... and higher than any man could reach."), L('ขนหมาและเลือดแห้งที่รั้ว พอมองไปไกล ๆ ก็ไม่เห็นอะไร ทั้งที่ได้ยินเสียงหายใจ — มันพรางตัวในความมืด เสียงสะท้อนหรือยาตาแมวน่าจะช่วยได้', "Dog hair and dried blood on the fence. Look further off and you see nothing, though you hear breathing — it hides in the dark. An echo or a Cat's-Eye Potion should help."), L('รอยเท้าบาง ๆ หายเข้าไปในทุ่งทางใต้ ข้างกองหินเก่า', 'Faint footprints vanish into the field to the south, beside an old cairn.')],
  },
  {
    id: 'shepherd_bane', type: 'brute', affix: 'stone', name: L('ยักษ์ผู้กินแกะ', 'Sheep-Devouring Brute'), time: 'always',
    giver: L('โกวัก (ผู้เลี้ยงแกะ)', 'Kowak (the shepherd)'), title: L('แกะหายไปทีละสามตัว', 'Sheep vanish three at a time'),
    text: L('กาาา! ทุกสามวันแกะข้าหายสามตัว เหลือแต่ขนกับรอยเท้าใหญ่เท่าเกวียน มันเดินมาจากทะเลสาบใต้ปราสาท', 'Caaaw! Every three days, three of my sheep vanish. Only wool is left, and footprints big as a cart. It comes up from the lake beneath the castle.'),
    scene: [150, 120], lair: [125, 188], coins: 150, items: [['pale_heart', 1]], gear: ['arm_briar'],
    clues: [L('รอยเท้าลึกครึ่งศอก... หนักเท่าวัวสามตัว', 'Footprints half a forearm deep... as heavy as three oxen.'), L('ก้อนหินที่มันพิงไว้แตกร้าว ผิวมันแข็งยิ่งกว่าหิน ฟันเบาไม่มีผล ต้องฟันหนักหรือทุบ', 'The rock it leaned on is cracked. Its hide is harder than stone; light attacks do nothing. Strike heavy, or crush it.'), L('ขนแกะติดอยู่ตามทางไปริมทะเลสาบใต้ปราสาทลอยฟ้า', 'Tufts of wool mark the way to the shore of the lake beneath Sky-Hung Castle.')],
  },
  {
    id: 'grey_widow', type: 'weeper', affix: 'frenzy', name: L('แม่ม่ายผมเทา', 'Grey-Haired Widow'), time: 'night',
    giver: L('เทียนหลอม (เจ้าของโรงเตี๊ยม)', 'Tallow (the innkeeper)'), title: L('เสียงร้องไห้ในซากโบสถ์ตะวันตก', 'Weeping in the western chapel ruins'),
    text: L('ลูกค้าข้าสามคนหายไปหลังได้ยินเสียงผู้หญิงร้องไห้ใกล้ซากโบสถ์ ข้ารู้จักเสียงนั้น... นางเคยเป็นคนของหมู่บ้านนี้ ช่วยให้นางได้พักเสียที', 'Three of my guests vanished after hearing a woman weeping near the chapel ruins. I know that voice... she was once of this village. Let her rest at last.'),
    scene: [-130, -88], lair: [-150, -112], coins: 130, items: [['locket', 1]], gear: ['path:3'],
    clues: [L('ผ้าคลุมไหล่ลายลูกไม้... เป็นของคนในหมู่บ้านเมื่อนานมาแล้ว', 'A lace shawl... it belonged to someone of the village, long ago.'), L('ผมสีเทายาวพันอยู่กับหนาม นางจะไม่ขยับถ้าเรามองนาง แต่ถ้าเจ็บหนักนางจะคลั่งจนไม่สนอะไร', 'Long grey hair tangled in the thorns. She will not move while you watch her, but badly hurt, she will rage past all heeding.'), L('เสียงสะอื้นแว่วมาจากซากกำแพงทางใต้ นางรออยู่ตรงนั้น', 'Sobbing drifts from the ruined walls to the south. She waits there.')],
  },
];

// for contracts the board invents once the hand-written ones are done
const PROC_TYPES = [['gaunt', 'night'], ['crawler', 'night'], ['wolf', 'always'], ['straw', 'day'], ['brute', 'always']];
const PROC_ADJ = [L('ตาแดง', 'Red-Eyed'), L('ไร้เงา', 'Shadowless'), L('หิวโหย', 'Starving'), L('แผลเป็น', 'Scarred'), L('เฒ่า', 'Old'), L('ผมขาว', 'White-Haired'), L('เสียงกระซิบ', 'Whispering'), L('กระดูกดำ', 'Black-Boned')];
const PROC_PLACES = [
  { name: L('ป่าตะวันตก', 'the Western Woods'), scene: [-120, 40], lair: [-150, 70] }, { name: L('ริมรางรถไฟ', 'the Railway'), scene: [40, 100], lair: [60, 125] },
  { name: L('บึงใต้', 'the Southern Marsh'), scene: [-90, 230], lair: [-60, 250] }, { name: L('ทุ่งตะวันออก', 'the Eastern Fields'), scene: [220, 10], lair: [240, 40] },
  { name: L('เชิงหุบผา', 'the Lower Gorge'), scene: [20, -110], lair: [-20, -125] }, { name: L('ชายป่าใกล้เห็ดยักษ์', 'the Mushroom Wood'), scene: [-170, 60], lair: [-195, 85] },
];
const TYPE_NAMES = { gaunt: L('ร่างซูบ', 'Gaunt'), crawler: L('ร่างคลาน', 'Crawler'), wolf: L('หมาป่า', 'Wolf'), straw: L('หุ่นฟาง', 'Strawman'), brute: L('ยักษ์ซูบ', 'Brute'), hollow: L('ผู้หลงทาง', 'Lost One') };

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
    const name = L(`${TYPE_NAMES[type]}${adj}แห่ง${place.name}`, `${adj} ${TYPE_NAMES[type]} of ${place.name}`);
    const coins = 50 + Math.round(ENEMY_TYPES[type].hp * 6 + r(5) * 30);
    return {
      id: `proc_${n}`, proc: n, type, affix, name, time,
      giver: L('ประกาศของหมู่บ้าน', 'Village notice'), title: L(`ค่าหัว: ${name}`, `Bounty: ${name}`),
      text: L(`มีคนเห็น${TYPE_NAMES[type]}ตัวหนึ่งแปลกกว่าตัวอื่นแถว${place.name} ทำร้ายคนไปแล้วหลายราย หมู่บ้านตั้งค่าหัวไว้`, `A ${TYPE_NAMES[type]} stranger than the rest has been seen around ${place.name}. It has hurt many already. The village has set a bounty.`),
      scene: place.scene, lair: place.lair, coins, items: [['potion', 1]],
      clues: [L('รอยเลือดและรอยลากยังใหม่อยู่... มันผ่านมาไม่นาน', 'The blood and drag marks are fresh... it passed not long ago.'), L(`ร่องรอยบอกนิสัยของมัน: ${AFFIXES[affix].hint}`, `The signs speak of its nature: ${AFFIXES[affix].hint}`), L('รอยเท้ามุ่งออกไปทางรังของมัน ไม่ไกลจากที่นี่', 'The tracks lead off toward its lair, not far from here.')],
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
    if (this.active.length >= 2) { g.ui.toast(L('รับงานพร้อมกันได้แค่ 2 งาน', 'You may hold only 2 contracts at once')); return false; }
    this.offers = this.offers.filter((o) => o !== c);
    const a = this.track(c, 'scene', [false, false, false]);
    this.active.push(a);
    this.placeClues(a);
    g.ui.toast(L(`รับงาน: ${c.title} — ไปดูที่เกิดเหตุ (ดูเข็มทิศ)`, `Contract taken: ${c.title} — go to the scene (see compass)`));
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
    this.g.ui.toast(L(`ยกเลิกงาน: ${a.c.title}`, `Contract abandoned: ${a.c.title}`));
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
      if (!a.found[i]) g.interactables.push({ id, pos: new THREE.Vector3(x, y, z), r: 2.4, label: L('ตรวจดูร่องรอย', 'Examine the signs'), checkpoint: { x, z } });
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
    g.ui.openDialogue({ lines: [[L('เบาะแส', 'Clue'), a.c.clues[i]], ['', L(`(เบาะแส ${n}/3)`, `(Clue ${n}/3)`)]], options: [{ label: L('ตามรอยต่อ', 'Follow the trail'), fn: () => {} }] }, after);
  }

  // all the signs read: the lair is known, the creature waits there
  reveal(a) {
    const g = this.g, aff = AFFIXES[a.c.affix];
    a.state = 'hunt';
    this.spawn(a);
    g.ui.banner(a.c.name, L(`จุดอ่อน: ${aff.name} — ${aff.hint}`, `Weakness: ${aff.name} — ${aff.hint}`));
    g.audio.discover();
    const when = { night: L('มันออกมาเฉพาะกลางคืน', 'It comes out only at night.'), day: L('มันออกมาเฉพาะกลางวัน', 'It comes out only by day.'), always: '' }[a.c.time];
    setTimeout(() => g.ui.toast(L(`รังของ${a.c.name}อยู่บนเข็มทิศแล้ว ${when}`, `The lair of ${a.c.name} is marked on your compass. ${when}`)), 1600);
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
      if (mad && !e.named.mad) { e.named.mad = true; g.ui.combatText(L(`${e.def.name} คลั่ง!`, `${e.def.name} goes berserk!`), 'bad'); g.audio.enemyCue(e.type, 'aggro', e.pos); }
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
        if (n) { g.ui.combatText(L('มันเรียกลูก ๆ มาช่วย!', 'It calls its young!'), 'bad'); g.audio.enemyCue('crawler', 'aggro', e.pos); }
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
    g.ui.banner(L('ล่าสำเร็จ', 'Hunt Complete'), L(`${a.c.name} — นำหลักฐานไปส่งที่บอร์ดประกาศหน้าโรงเตี๊ยม`, `${a.c.name} — bring the proof to the bounty board by the inn door`));
    g.audio.chime();
  }

  claim(a) {
    const g = this.g, c = a.c;
    if (g.bag.count('trophy') < 1) { g.ui.toast(L('ไม่มีหลักฐานการล่าในกระเป๋า', 'No Proof of the Hunt in your bag')); return false; }
    g.bag.remove('trophy', 1);
    g.coins += c.coins;
    for (const [id, n] of c.items) { const left = g.bag.add(id, n); if (left) g.loot.dropNearPlayer(id, left); }
    // a piece of gear for the harder hunts ('path:n' is your path's n-th weapon)
    if (c.gear) g.equipment.reward(c.gear.map((id) => (id.startsWith('path:') ? pathWeapons(g.kit.id)[+id.slice(5)]?.id : id)));
    this.done.add(c.id);
    this.clearClues(a);
    this.active = this.active.filter((x) => x !== a);
    g.audio.coin(); g.audio.chime();
    g.gainXP(300);
    g.ui.banner(L('รับค่าหัว', 'Bounty Claimed'), `+${c.coins} ${L('เหรียญ', 'coins')} · ${c.items.map(([id, n]) => `${ITEMS[id].name}${n > 1 ? ` ×${n}` : ''}`).join(' · ')}`);
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
        if (Math.hypot(p.x - x, p.z - z) > 30) out.push({ x, z, label: L('ที่เกิดเหตุ', 'Scene'), kind: 'bounty' });
        else a.clues.forEach((cl, i) => { if (!a.found[i]) out.push({ x: cl.pos.x, z: cl.pos.z, label: L('เบาะแส', 'Clue'), kind: 'bounty' }); });
      } else if (a.state === 'hunt') out.push({ x: a.lair[0], z: a.lair[1], label: L('รัง', 'Lair'), kind: 'bounty' });
      else if (a.state === 'trophy') out.push({ x: BOARD.x, z: BOARD.z, label: L('บอร์ด', 'Board'), kind: 'bounty' });
    }
    return out;
  }

  chips() {
    return this.active.map((a) => {
      const st = a.state === 'scene' ? L(`ตามรอย ${a.found.filter(Boolean).length}/3`, `Tracking ${a.found.filter(Boolean).length}/3`)
        : a.state === 'hunt' ? L(`ล่า · จุดอ่อน: ${AFFIXES[a.c.affix].name}`, `Hunt · Weakness: ${AFFIXES[a.c.affix].name}`) : L('นำหลักฐานไปส่งที่บอร์ด', 'Bring the proof to the board');
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

