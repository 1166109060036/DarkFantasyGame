// Chapter 2: "The Stone King Wakes" (ราชาหินตื่น). docs/STORY_CH2.md is the plan.
//
// It opens once chapter 1 is over (quests.stage >= 8). Stages:
//   0 speak with Tallow -> 1 examine the snapped chain -> 2 the Petrified that rise there
//   -> 3 relight the brazier before the Stone King's face (he speaks)
//   4 three errands, in any order, all needed to go up:
//       hook    0 Old Anvil -> 1 the Chainwarden at the anchor -> 2 back to the smith -> 3 the Chain Hook
//       skin    0 Granny Toad -> 1 three living stone scales from the Petrified at the ribcage -> 2 back -> 3 Stoneskin
//       feather 0 Kowak -> 1 guard the flock by night (two waves) -> 2 back -> 3 the Herald's Feather
//   5 Sky-Hung Castle: climb the chain, the Handless Regent on the throne terrace
//   6 the colossus by the bridge: break its three seals, then crown it
//   7 the chapter is over
import * as THREE from 'three';
import { HEAD, RIBCAGE, CASTLE } from './layout.js';
import { ENEMY_TYPES } from './combat.js';
import { buildSkyCastle, buildFallenChain, onIsland } from './skycastle.js';
import { Backrooms } from './backrooms.js';
import { wrapAngle } from './util.js';
import { L } from './i18n.js';

const N = '';
const KING = () => L('ราชาหิน', 'The Stone King');
const WAVES = [4, 5];

export class Chapter2 {
  constructor(game, quests) {
    this.g = game;
    this.q = quests;
    Object.assign(this, { stage: 0, hook: 0, skin: 0, feather: 0, scales: 0, announced: false, statue: false });
    this.climbing = null;
    this.wave = 0;
    this.live = {};          // enemies this session has raised: warden, camp, guards, regent, colossus
    this.rooms = new Backrooms(game, this);   // the Waiting Halls behind the small door in the keep
  }

  serialize() {
    const { stage, hook, skin, feather, scales, announced, statue } = this;
    return { stage, hook, skin, feather, scales, announced, statue, rooms: this.rooms.serialize() };
  }
  load(d = {}) {
    Object.assign(this, { stage: d.stage ?? 0, hook: d.hook ?? 0, skin: d.skin ?? 0, feather: d.feather ?? 0, scales: d.scales ?? 0, announced: !!d.announced, statue: !!d.statue });
    this.rooms.load(d.rooms);
  }

  get open() { return this.q.stage >= 8; }
  get done() { return this.stage >= 7; }
  get busy() { return !!this.climbing; }
  // the three things needed to go up
  has(what) { return this[what] >= 3; }
  get ready() { return this.has('hook') && this.has('skin') && this.has('feather'); }

  // ---------------------------------------------------------------- the world it needs
  // called once the story world is built (the island floor is there from the start; it is only
  // reachable up the chain)
  setup() {
    const g = this.g;
    this.sky = buildSkyCastle(g.scene, g.M, g.collision, g.terrain, g.fx);
    this.fallen = buildFallenChain(g.scene, g.M, g.terrain);
    this.rooms.setup();
    const T = (x, z) => g.terrain.getHeight(x, z);
    const at = (x, z) => new THREE.Vector3(x, T(x, z), z);
    this.spots = {
      brazier: at(HEAD.x + 22, HEAD.z),
      camp: at(RIBCAGE.x + 6, RIBCAGE.z - 4),
      pasture: g.npcs.crow.pos,
      colossus: at(HEAD.x, HEAD.z),          // the King rises where his head lay
    };
    // the colossus's arms are floors while they lie on the ground
    g.player.surfaces.push((x, z, feetY) => this.live.colossus?.ai?.surface?.(x, z, feetY) ?? -Infinity);
    // off the edge of the sky, with the herald's feather: a glide
    g.player.glide = () => this.has('feather') && g.player.pos.y > g.terrain.getHeight(g.player.pos.x, g.player.pos.z) + 2;
    this.applyWorld();
  }

  // the chain hangs until the first chapter ends, then lies where it fell
  applyWorld() {
    const done = this.open;
    if (this.g.fx.snapChain) this.g.fx.snapChain.visible = !done;
    if (this.fallen) this.fallen.mesh.visible = done;
  }

  // ---------------------------------------------------------------- what the HUD says
  objective() {
    const t = L('ราชาหินตื่น', 'The Stone King Wakes');
    switch (this.stage) {
      case 0: return { title: t, text: L('โซ่ของปราสาทแขวนฟ้าขาด · กลับไปคุยกับเทียนหลอมที่โรงเตี๊ยม', 'A chain of Sky-Hung Castle has snapped · Go back and speak with Tallow at the inn') };
      case 1: return { title: t, text: L('ไปดูโซ่ที่ขาดตกลงริมทะเลสาบใต้ปราสาท', 'Go and see the snapped chain on the shore beneath the castle') };
      case 2: return { title: t, text: L('ล้มร่างหินที่ลุกขึ้นข้างโซ่', 'Defeat the Petrified that rose beside the chain') };
      case 3: return { title: t, text: L('ไปที่หัวราชาหินทางตะวันตก จุดกระถางไฟหน้าพระพักตร์', 'Go to the Stone King\'s head in the west and relight the brazier before his face') };
      case 4: return { title: L(`เตรียมขึ้นฟ้า (${['hook', 'skin', 'feather'].filter((w) => this.has(w)).length}/3)`, `Preparing to Climb (${['hook', 'skin', 'feather'].filter((w) => this.has(w)).length}/3)`), text: this.steps().map((s) => s.text).join(' · ') };
      case 5: return { title: L('ปราสาทแขวนฟ้า', 'Sky-Hung Castle'), text: this.steps().map((s) => s.text).join(' · ') };
      case 6: return { title: L('ร่างศิลา', 'The Colossus'), text: L('ไปที่หัวราชาหินทางตะวันตก ทำลายตราหินทั้งสาม (ปีนนิ้วขึ้นหลังมือ · ปีนเคราตอนราชาก้มหัว) แล้วสวมมงกุฎให้ราชา', 'Go to the Stone King\'s head in the west and break the three seals (up the fingers onto the back of each hand · up the beard while he bows), then crown the King') };
      default: return { title: L('บทที่ 2 จบแล้ว', 'Chapter 2 Complete'), text: L('ราชาหินได้สติคืน · ปราสาทแขวนฟ้ายังขึ้นไปได้ทางโซ่ · บทที่ 3 ยังมาไม่ถึง', 'The Stone King\'s mind is his own again · Sky-Hung Castle can still be climbed by the chain · Chapter 3 is yet to come') };
    }
  }

  steps() {
    const g = this.g, S = this.spots, out = [], night = g.dayNight.isNight;
    if (this.stage === 4) {
      const smith = g.npcs.smith.pos, toad = g.npcs.toad.pos, crow = g.npcs.crow.pos;
      if (!this.has('hook')) out.push([
        { text: L('ลุงทั่ง: ถามเรื่องการปีนโซ่', 'Old Anvil: ask about climbing the chain'), at: smith, label: L('ลุงทั่ง', 'Old Anvil') },
        { text: L('ล้มผู้คุมโซ่ที่หมุดโซ่ข้างหมู่บ้าน', 'Defeat the Chainwarden at the anchor by the village'), at: this.sky.chain.base, label: L('ผู้คุมโซ่', 'Chainwarden') },
        { text: L('นำเหล็กของผู้คุมโซ่กลับไปให้ลุงทั่ง', 'Bring the Chainwarden\'s iron back to Old Anvil'), at: smith, label: L('ลุงทั่ง', 'Old Anvil') },
      ][this.hook]);
      if (!this.has('skin')) out.push([
        { text: L('ยายคางคก: ถามเรื่องลมบนปราสาท', 'Granny Toad: ask about the air up at the castle'), at: toad, label: L('ยายคางคก', 'Granny Toad') },
        { text: L(`เก็บเกล็ดหินจากร่างหินที่ซี่โครงยักษ์ (${this.scales}/3)`, `Gather stone scales from the Petrified at the giant ribcage (${this.scales}/3)`), at: S.camp, label: L('ซี่โครงยักษ์', 'Ribcage') },
        { text: L('นำเกล็ดหินไปให้ยายคางคก', 'Bring the stone scales to Granny Toad'), at: toad, label: L('ยายคางคก', 'Granny Toad') },
      ][this.skin]);
      if (!this.has('feather')) out.push([
        { text: L('โกวัก: ถามเรื่องขนนกของเขา', 'Kowak: ask about his feathers'), at: crow, label: L('โกวัก', 'Kowak') },
        { text: night ? L(`เฝ้าฝูงแกะของโกวักคืนนี้${this.wave ? ` (ระลอก ${this.wave}/2)` : ''}`, `Guard Kowak's flock tonight${this.wave ? ` (wave ${this.wave}/2)` : ''}`) : L('เฝ้าฝูงแกะของโกวัก — รอกลางคืน (พักที่โรงเตี๊ยมได้)', 'Guard Kowak\'s flock — wait for night (you can rest at the inn)'), at: S.pasture, label: L('ฝูงแกะ', 'The flock') },
        { text: L('กลับไปคุยกับโกวัก', 'Go back to Kowak'), at: crow, label: L('โกวัก', 'Kowak') },
      ][this.feather]);
    }
    if (this.stage === 5) {
      const up = onIsland(g.player.pos.x, g.player.pos.z, g.player.pos.y);
      if (this.rooms.inside) out.push({ text: L('หาทางออกจากห้องโถงรอเฝ้า — ประตูบานไกลสุดทางตะวันออก', 'Find the way out of the Waiting Halls — the farthest door, to the east'), at: this.rooms.exitAt, label: L('ทางออก', 'Way out') });
      else if (!up) out.push({ text: L('ปีนโซ่ที่หมุดข้างหมู่บ้านขึ้นไปบนปราสาท', 'Climb the chain from the anchor by the village up to the castle'), at: this.sky.chain.base, label: L('โซ่', 'The chain') });
      else out.push({ text: L('ไปที่ลานบัลลังก์หน้าหอกลาง', 'Go to the throne terrace before the keep'), at: this.sky.regentAt, label: L('บัลลังก์', 'Throne') });
    }
    return out.filter(Boolean);
  }

  markers() {
    if (this.stage === 0) return [{ x: this.g.npcs.keeper.pos.x, z: this.g.npcs.keeper.pos.z, label: L('เทียนหลอม', 'Tallow') }];
    if (this.stage === 1 || this.stage === 2) return [{ x: this.fallen.mid.x, z: this.fallen.mid.z, label: L('โซ่ที่ขาด', 'The snapped chain') }];
    if (this.stage === 3) return [{ x: this.spots.brazier.x, z: this.spots.brazier.z, label: L('ราชาหิน', 'The Stone King') }];
    if (this.stage === 6) return [{ x: HEAD.x, z: HEAD.z, label: L('ร่างศิลา', 'The Colossus') }];
    return this.steps().filter((s) => s.at).map((s) => ({ x: s.at.x, z: s.at.z, label: s.label }));
  }

  // places to press E
  spotsNow() {
    if (!this.open || !this.sky) return [];
    const out = [], S = this.spots, ch = this.sky.chain;
    const add = (id, pos, label, r = 3) => out.push({ id, pos, r, label });
    if (this.stage === 1) add('story:c2chain', this.fallen.mid, L('ตรวจดูโซ่ที่ขาด', 'Examine the snapped chain'), 4);
    if (this.stage === 3) add('story:c2brazier', S.brazier, L('จุดกระถางไฟหน้าพระพักตร์', 'Relight the brazier before his face'), 4);
    if (this.stage >= 4) add('story:c2climb', ch.base, L('ปีนโซ่ขึ้นปราสาทแขวนฟ้า', 'Climb the chain to Sky-Hung Castle'), 4.5);
    if (this.stage >= 5) {
      add('story:c2descend', ch.top, L('ปีนโซ่ลง', 'Climb down the chain'), 3.5);
      add('story:c2statue', this.sky.statue, L('ดูรูปปั้นเด็กหนุ่มคุกเข่า', 'Look at the statue of the kneeling boy'), 3.2);
    }
    if (this.stage === 4 && this.feather === 1 && !this.wave) add('story:c2flock', S.pasture, L('เฝ้าฝูงแกะ', 'Keep watch over the flock'), 6);
    out.push(...this.rooms.spots());
    const K = this.live.colossus;
    if (this.stage === 6 && K?.knelt && K.crownAt) add('story:c2crown', K.crownAt, L('สวมมงกุฎหินให้ราชา', 'Crown the King with the stone crown'), 16);
    return out;
  }

  // ---------------------------------------------------------------- examining things
  say(lines, then, label = L('ต่อไป', 'Continue')) {
    this.g.ui.openDialogue({ lines, options: [{ label, fn: then || (() => {}) }] }, () => this.g.updateHud());
  }

  inspect(id) {
    const g = this.g;
    if (id.startsWith('story:c2rooms')) return this.rooms.inspect(id);
    switch (id) {
      case 'story:c2chain': return this.say([
        [N, L('โซ่ทั้งเส้นนอนขดอยู่บนฝั่ง ข้อแต่ละข้อใหญ่กว่าตัวคน เหล็กยังเย็นเฉียบทั้งที่ตกลงมาทั้งคืน', 'The whole chain lies coiled on the shore, each link bigger than a man. The iron is still ice-cold, though it has lain here all night.')],
        [N, L('พอมือแตะเหล็ก ภาพหนึ่งก็วาบขึ้นมา... เด็กหนุ่มคนหนึ่งปีนโซ่เส้นเดียวกันนี้ขึ้นไปในเมฆ บนหลังผูกห่อผ้าไว้แน่น', 'As your hand touches the iron, a picture flashes before you... a youth climbing this same chain into the clouds, a cloth bundle bound tight to his back.')],
        [N, L('มือนับร้อยโผล่ออกมาจากเมฆ... แล้วทุกอย่างก็มืดลง', 'A hundred hands reach out of the cloud... and everything goes dark.')],
        [N, L('เจ้าหักข้อโซ่ที่แตกออกมาได้ข้อหนึ่ง แล้วก็ได้ยินเสียงหินขูดกันอยู่รอบตัว', 'You wrench loose one cracked link — and hear stone grinding on stone all around you.')],
      ], () => {
        g.ui.toast(L('ได้ข้อโซ่ที่ขาด', 'Obtained the Snapped Link'));
        this.set('stage', 2);
        this.raise('chain');
      });
      case 'story:c2brazier': return this.say([
        [N, L('กระถางไฟหน้าพระพักตร์ดับสนิท เถ้ายังอุ่นอยู่ เจ้าจุดมันขึ้นใหม่...', 'The brazier before the great face has gone out; the ashes are still warm. You light it again...')],
        [N, L('ดวงตาหินขนาดเท่าประตูบ้านเลื่อนมามองเจ้า แผ่นดินใต้เท้าสั่นเมื่อพระองค์ตรัส', 'An eye of stone, as wide as a door, turns to look at you. The ground shakes when he speaks.')],
        [KING(), L('...ผู้ถือมงกุฎ... เจ้ากลับมาแล้ว', '...Crown-Bearer... thou hast come back.')],
        [KING(), L('สามร้อยปี ข้าส่งเจ้าไปหาลูกข้า พร้อมมงกุฎ และคำสุดท้ายของข้า... แต่มือของเขาคว้าเจ้าไว้กลางทาง', 'Three hundred years ago I sent thee to my son, with my crown and my last word... but his hands caught thee on the way.')],
        [KING(), L('ตอนนี้มือคลายแล้ว ข้าจึงตื่น แต่หินกินใจข้าไปครึ่งหนึ่ง ความฝันของข้าเดินออกไปเอง และหินก็ลามไปเกาะผู้คน', 'Now the hands have opened, and so I wake. But the stone has eaten half my mind. My dream walks off without me, and the stone creeps over the people.')],
        [KING(), L('มงกุฎ... ยังอยู่ในวังของข้าบนฟ้า เอามันคืนมา ผู้ถือมงกุฎ ก่อนที่ข้าจะลืมว่าข้าเป็นใคร', 'The crown... is still in my house in the sky. Bring it back to me, Crown-Bearer, before I forget who I am.')],
        [N, L('ดวงตาปิดลงอีกครั้ง... ถ้าจะขึ้นไปบนปราสาทแขวนฟ้า ต้องมีวิธีปีนโซ่ วิธีทนลมหินบนนั้น และวิธีลงมาให้รอด', 'The eye closes again... To go up to Sky-Hung Castle you will need a way to climb the chain, a way to bear the stone wind up there, and a way to come down alive.')],
      ], () => {
        this.set('stage', 4);
        g.ui.banner(L('เตรียมขึ้นฟ้า', 'Preparing to Climb'), L('ลุงทั่ง · ยายคางคก · โกวัก', 'Old Anvil · Granny Toad · Kowak'));
        g.audio.discover();
      });
      case 'story:c2climb':
        if (this.stage < 5 || !this.has('hook')) {
          return this.say([[N, this.has('hook') ? L('ตะขออยู่ในมือแล้ว... แต่ลมบนนั้นจะเปลี่ยนเนื้อเป็นหิน และถ้าพลาดตกลงมาก็ไม่รอด เตรียมให้ครบก่อน', 'The hook is in your hand... but the wind up there turns flesh to stone, and a fall from there is death. Be ready first.') : L('โซ่ใหญ่เกินกว่าจะกอดปีนได้ ข้อโซ่แต่ละข้อลื่นด้วยตะไคร่ ต้องมีอะไรเกี่ยวไว้', 'The chain is too great to climb by hugging it, every link slick with moss. You need something to hook onto it.')]]);
        }
        return this.climb(true);
      case 'story:c2descend': return this.climb(false);
      case 'story:c2statue': return this.say([
        [N, L('รูปปั้นเด็กหนุ่มคุกเข่า ยื่นห่อผ้าขึ้นไปทางบัลลังก์ ห่อผ้านั้นมีรูปมงกุฎ', 'A statue of a youth on one knee, holding a cloth bundle up toward the throne. The bundle is the shape of a crown.')],
        [N, L('ป้ายที่ฐานสลักว่า "ผู้ถือมงกุฎ ผู้ไม่เคยกลับมา"', 'The plinth reads: "The Crown-Bearer, who never returned."')],
        [N, L('ใบหน้าของรูปปั้น... เหมือนหน้าที่เจ้าเห็นในน้ำทุกเช้า', 'The statue\'s face... is the face you see in the water every morning.')],
      ], () => { if (!this.statue) { this.statue = true; g.gainXP(300); g.save(); } });
      case 'story:c2flock': {
        if (!g.dayNight.isNight) return this.say([[N, L('ฝูงแกะเล็มหญ้าอย่างสงบ... ร่างหินจะมาตอนกลางคืน', 'The flock grazes peacefully... the Petrified will come by night.')]]);
        return this.say([[N, L('เจ้ายืนเฝ้าที่รั้ว ลมพัดเย็น... แล้วก็ได้ยินเสียงหินลากกับพื้นมาจากความมืด', 'You take your place at the fence. The wind is cold... then, out of the dark, comes the sound of stone dragging over the ground.')]], () => this.startWave(1));
      }
      case 'story:c2crown': return this.crown();
    }
  }

  // ---------------------------------------------------------------- the people
  // a dialogue for this chapter, or null to let chapter 1's take it
  talk(npc) {
    const g = this.g;
    if (!this.open) return null;
    const close = { label: L('ลาก่อน', 'Farewell'), fn: () => {} };
    if (npc === 'keeper' && this.stage === 0) {
      const K = L('เทียนหลอม', 'Tallow');
      return {
        lines: [
          [K, L('เจ้ากลับมาแล้ว! เมื่อคืนเจ้าได้ยินไหม เสียงเหมือนฟ้าผ่าลงกลางทะเลสาบ', 'You\'re back! Did you hear it last night? Like lightning striking the middle of the lake.')],
          [K, L('โซ่เส้นหนึ่งของปราสาทแขวนฟ้าขาด ตกลงริมทะเลสาบใต้ปราสาท... คนตัดฟืนสองคนที่อยู่แถวนั้น เช้านี้กลายเป็นหินไปแล้ว ทั้งที่ยังเดินได้', 'One of Sky-Hung Castle\'s chains snapped and came down on the shore beneath it... Two woodcutters who were out there turned to stone by morning — and they still walk.')],
          [K, L('แล้วดวงตาของราชาหินทางตะวันตกก็เปิดค้างไว้ทั้งคืน ข้าไม่ชอบเลย ไอ้หนู ไปดูหน่อยเถอะ', 'And the Stone King\'s eyes in the west stayed open all night. I don\'t like it, love. Go and take a look.')],
        ],
        options: [{ label: L('ข้าจะไปดูโซ่', 'I will go and see the chain'), fn: () => this.set('stage', 1) }, close],
      };
    }
    if (npc === 'smith' && this.stage === 4 && this.hook !== 1 && this.hook < 3) {
      const S = L('ลุงทั่ง ช่างตีเหล็ก', 'Old Anvil the Smith');
      if (this.hook === 0) return {
        lines: [
          [S, L('ปีนโซ่ปราสาท? เจ้าบ้าไปแล้ว... แต่ข้อโซ่ที่เจ้าถือมานั่น เหล็กของราชาหินแท้ ๆ', 'Climb the castle chain? You\'re mad... but that link you\'re holding — that\'s the Stone King\'s own iron.')],
          [S, L('ข้าตีตะขอที่เกี่ยวโซ่นั่นได้ แต่ต้องใช้เหล็กแบบเดียวกันอีกก้อน ก้อนที่ยังมีชีวิต', 'I can forge a hook that will bite that chain, but I need another piece of the same iron. A piece that\'s still alive.')],
          [S, L('ที่หมุดโซ่ข้างหมู่บ้านมีชุดเกราะยักษ์ยืนเฝ้าอยู่ตั้งแต่โซ่ขาด ถือโซ่ฟาดใครเข้าใกล้ — ผู้คุมโซ่ ล้มมันแล้วเอาแกนเหล็กของมันมา', 'At the chain anchor by the village a giant suit of armour has stood guard since the chain snapped, lashing a chain at anyone who comes near — the Chainwarden. Bring it down and fetch me its iron heart.')],
        ],
        options: [{ label: L('ข้าจะไปเอามา', 'I will fetch it'), fn: () => this.set('hook', 1) }, { label: L('อัปเกรดอุปกรณ์', 'Upgrade gear'), fn: () => g.openMenu('smith') }, close],
      };
      if (this.hook === 2) return {
        lines: [
          [S, L('นี่แหละ... ยังอุ่นอยู่เลย เหมือนหัวใจ', 'That\'s it... still warm. Like a heart.')],
          [S, L('(ลุงทั่งตีเหล็กอยู่นาน ประกายไฟสีทองกระเด็นทุกครั้งที่ค้อนลง)', '(Old Anvil hammers a long while; gold sparks leap at every blow.)')],
          [S, L('เอ้า ตะขอเกี่ยวโซ่ มันจะกัดข้อโซ่ไม่ปล่อย แค่เจ้าอย่าปล่อยมันก่อนก็แล้วกัน', 'There. A Chain Hook. It\'ll bite a link and not let go — just don\'t you let go of it first.')],
        ],
        options: [{ label: L('ขอบคุณ ลุงทั่ง', 'Thank you, Old Anvil'), fn: () => { g.audio.anvil?.(); this.set('hook', 3, L('ได้ตะขอเกี่ยวโซ่', 'Obtained the Chain Hook')); } }],
      };
    }
    if (npc === 'toad' && this.stage === 4 && this.skin !== 1 && this.skin < 3) {
      const T = L('ยายคางคก', 'Granny Toad');
      const brew = { label: L('ปรุงยา (หม้อต้มยา)', 'Brew (cauldron)'), fn: () => g.openMenu('alchemy') };
      if (this.skin === 0) return {
        lines: [
          [T, L('ฮึ่มม... จะขึ้นไปบนวังลอยฟ้าเรอะ ลมบนนั้นมีฝุ่นหินของราชาปนอยู่ หายใจเข้าไปเนื้อก็แข็ง', 'Hrrm... Going up to the floating palace, are we? The wind up there carries the King\'s stone dust. Breathe it and your flesh goes hard.')],
          [T, L('ข้าต้มยาผิวหินให้ได้ ให้หินคิดว่าเจ้าเป็นพวกเดียวกัน แต่ต้องใช้เกล็ดหินที่ยังเต้นอยู่ สามชิ้น', 'I can brew a Stoneskin Draught — makes the stone think you\'re one of its own. But I need three stone scales that still have a pulse.')],
          [T, L('ร่างหินพวกนั้นไปรวมกันที่ซี่โครงยักษ์ในบึง ไปเอามาจากพวกมันสิ ไอ้หนู', 'The Petrified have gathered at the giant ribcage in the marsh. Take them from those, dearie.')],
        ],
        options: [{ label: L('ข้าจะไปเอามา', 'I will fetch them'), fn: () => this.set('skin', 1) }, brew, close],
      };
      if (this.skin === 2) return {
        lines: [
          [T, L('ฮึ่ม ครบสามชิ้น ยังเต้นตุบ ๆ อยู่เลย น่ารักจัง', 'Hrm, all three. Still thumping away. How sweet.')],
          [T, L('(ยายคางคกบดเกล็ดหินลงหม้อ น้ำยาเปลี่ยนเป็นสีเทาเหมือนตะกั่ว)', '(Granny Toad grinds the scales into the pot. The brew turns grey as lead.)')],
          [T, L('ดื่มเลย... อย่าทำหน้าแบบนั้น หินบนฟ้าจะไม่เกาะเจ้าอีก ร่างหินตีเจ้าก็ไม่ทำให้ตัวแข็ง', 'Drink up... don\'t make that face. The sky\'s stone won\'t take to you now, and a Petrified\'s blow won\'t stiffen you.')],
        ],
        options: [{ label: L('ดื่มยาผิวหิน', 'Drink the Stoneskin Draught'), fn: () => { g.audio.drink?.(); this.set('skin', 3, L('ผิวของเจ้าเย็นและแข็งเหมือนหิน — หินจะไม่เกาะเจ้าอีก', 'Your skin goes cool and hard as stone — the stone will not take you now')); } }],
      };
    }
    if (npc === 'crow' && this.open) {
      const C = L('โกวัก ผู้เลี้ยงแกะ', 'Kowak the Shepherd');
      if (this.stage === 4 && this.feather === 0) return {
        lines: [
          [C, L('กา... เจ้าจะขึ้นไปบนวังของพระองค์สินะ ข้ารู้ ข้าได้กลิ่นหินติดตัวเจ้า', 'Caw... You\'re going up to His Majesty\'s house, aren\'t you. I know. I can smell the stone on you.')],
          [C, L('ข้าเคยเป็นอีกาส่งสาส์นของราชาหิน ก่อนพระองค์จะหลับ ข้าบินขึ้นลงวังนั้นวันละร้อยเที่ยว', 'I was the Stone King\'s herald crow, before he slept. I flew up and down to that house a hundred times a day.')],
          [C, L('ขนของข้าจะพาเจ้าร่อนลงมาได้ แต่ร่างหินมาเอาแกะข้าทุกคืน ช่วยข้าเฝ้าฝูงสักคืน แล้วข้าจะถอนขนให้', 'A feather of mine will carry you gently down. But the Petrified come for my sheep every night. Guard the flock for me one night, and I\'ll pluck you one.')],
        ],
        options: [{ label: L('ข้าจะเฝ้าให้คืนนี้', 'I will keep watch tonight'), fn: () => this.set('feather', 1) }, close],
      };
      if (this.stage === 4 && this.feather === 2) return {
        lines: [
          [C, L('กา! ฝูงข้าครบทุกตัว ขอบใจเจ้า', 'Caw! My flock is whole, every one. My thanks.')],
          [C, L('(โกวักถอนขนสีดำยาวเส้นหนึ่งออกจากปีก ขนนั้นอุ่นเหมือนมีชีวิต)', '(Kowak plucks a long black feather from his wing. It is warm, as if alive.)')],
          [C, L('ถ้าตกจากที่สูง กำมันไว้ ลมจะอุ้มเจ้าเอง... อย่าทำหายล่ะ มันเป็นขนเส้นสุดท้ายที่ยังจำทางไปวังได้', 'If you fall from a height, hold it tight and the wind will carry you... Don\'t lose it. It\'s the last feather that still remembers the way to the palace.')],
        ],
        options: [{ label: L('ขอบคุณ โกวัก', 'Thank you, Kowak'), fn: () => this.set('feather', 3, L('ได้ขนนกราชสาส์น — ตกจากที่สูงแล้วร่อนลงช้า ๆ', 'Obtained the Herald\'s Feather — long falls become a slow glide')) }],
      };
      if (this.done) return {
        lines: [
          [C, L('กา... พระองค์ได้สติคืนแล้วสินะ ดีแล้ว ดีแล้ว', 'Caw... His Majesty has his mind back, then. Good. Good.')],
          [C, L('...พระองค์ไม่ได้พูดถึงนกตัวอื่นใช่ไหม? ไม่หรอก ไม่มีอะไร ไปเถอะ ผู้เดินทาง', '...He didn\'t mention any other bird, did he? No. No matter. Go on, traveller.')],
        ],
        options: [close],
      };
    }
    return null;
  }

  // ---------------------------------------------------------------- moving the story on
  set(key, value, toast) {
    const g = this.g;
    this[key] = value;
    if (toast) g.ui.toast(toast);
    g.gainXP(300);
    g.audio.chime();
    if (key !== 'stage' && this.stage === 4 && this.ready) {
      this.stage = 5;
      setTimeout(() => g.ui.banner(L('พร้อมขึ้นฟ้าแล้ว', 'Ready to Climb'), L('ปีนโซ่ที่หมุดข้างหมู่บ้านขึ้นไปบนปราสาทแขวนฟ้า', 'Climb the chain from the anchor by the village up to Sky-Hung Castle')), 1600);
    }
    g.onQuestChanged();
  }

  // a fight the story raises: [type, x, z, def overrides, tag, y]
  make(type, x, z, tag, over = null, y) {
    const c = this.g.combat;
    const e = c.spawn(type, x, z, y);
    Object.assign(e, { summoned: true, storyTag: tag, activeOverride: 'always', state: 'chase' });
    if (over) { e.def = { ...ENEMY_TYPES[type], ...over }; e.hp = e.def.hp; e.storyBoss = !!over.name; if (over.scale) e.obj.scale.setScalar(over.scale); }
    return e;
  }

  raise(what) {
    const g = this.g, S = this.spots;
    if (what === 'chain') {
      const m = this.fallen.mid;
      for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.4; this.make('petrified', m.x + Math.cos(a) * 9, m.z + Math.sin(a) * 9, 'c2chain'); }
    }
    if (what === 'warden') {
      const b = this.sky.chain.anchor;
      this.live.warden = this.make('armour', b.x + 7, b.z + 7, 'c2warden', { name: L('ผู้คุมโซ่', 'the Chainwarden'), hp: 26, damage: 30, range: 3.6, coins: [50, 70], scale: 1.4 });
    }
    if (what === 'camp') {
      this.live.camp = [];
      for (let i = 0; i < 5; i++) { const a = i * 1.25; this.live.camp.push(this.make('petrified', S.camp.x + Math.cos(a) * 8, S.camp.z + Math.sin(a) * 8, 'c2camp')); }
    }
    if (what === 'guards') {
      this.live.guards = this.sky.guards.map((p, i) => this.make(i === 4 ? 'armour' : 'petrified', p.x, p.z, 'c2guard', null, p.y));
    }
    if (what === 'regent') {
      const p = this.sky.regentAt;
      const e = this.make('regent', p.x, p.z, 'c2regent', null, p.y);
      e.state = 'idle';
      e.ry = Math.atan2(this.sky.arena.x - p.x, this.sky.arena.z - p.z);
      this.live.regent = e;
    }
    if (what === 'colossus') {
      const c = g.combat, at = S.colossus;
      const e = c.spawn('colossus', at.x, at.z);
      e.pos.y = e.home.y = at.y;
      e.ry = Math.PI / 2;                       // facing east, toward the village road
      Object.assign(e, { summoned: true, storyTag: 'c2colossus' });
      e.ai = { mode: 'buried', t: 0, cd: 2, atk: null, last: null, fx: [], sink: -26, onBody: 0, broken: 0 };
      e.ai.seals = [0, 1, 2].map(() => {
        const s = c.spawn('seal', at.x, at.z);
        Object.assign(s, { summoned: true, storyTag: 'c2seal', invuln: true });
        s.pos.y = at.y - 30;
        return s;
      });
      this.live.colossus = e;
    }
  }

  startWave(n) {
    const P = this.spots.pasture;
    this.wave = n;
    this.live.wave = [];
    for (let i = 0; i < WAVES[n - 1]; i++) {
      const a = i * (Math.PI * 2 / WAVES[n - 1]) + n;
      this.live.wave.push(this.make('petrified', P.x + Math.cos(a) * 34, P.z + Math.sin(a) * 34, 'c2wave'));
    }
    this.g.ui.banner(L(`ระลอกที่ ${n}`, `Wave ${n}`), L('ร่างหินมาเอาฝูงแกะ', 'The Petrified come for the flock'));
    this.g.onQuestChanged(false);
  }

  onEnemyKilled(e) {
    const g = this.g, tag = e.storyTag;
    if (!tag?.startsWith('c2')) return;
    const left = g.combat.enemies.some((o) => o !== e && o.storyTag === tag && o.alive && o.state !== 'dying');
    if (tag === 'c2chain' && !left && this.stage === 2) {
      this.set('stage', 3);
      g.ui.banner(L('ดวงตาทางตะวันตก', 'The Eyes in the West'), L('ไปหาราชาหิน', 'Go to the Stone King'));
    }
    if (tag === 'c2warden' && this.hook === 1) this.set('hook', 2, L('ได้แกนเหล็กของผู้คุมโซ่ — นำไปให้ลุงทั่ง', 'Obtained the Chainwarden\'s Iron Heart — take it to Old Anvil'));
    if (tag === 'c2camp' && this.skin === 1) {
      this.scales = Math.min(3, this.scales + 1);
      g.ui.toast(L(`เกล็ดหินที่ยังเต้น ${this.scales}/3`, `Living stone scale ${this.scales}/3`));
      if (this.scales >= 3) this.set('skin', 2, L('ได้เกล็ดหินครบ — นำไปให้ยายคางคก', 'All three scales — take them to Granny Toad'));
      else g.onQuestChanged(false);
    }
    if (tag === 'c2wave' && !left && this.feather === 1) {
      if (this.wave === 1) setTimeout(() => this.startWave(2), 2500);
      else { this.wave = 0; this.set('feather', 2, L('ฝูงแกะปลอดภัย — กลับไปคุยกับโกวัก', 'The flock is safe — go back to Kowak')); }
    }
    if (tag === 'c2regent') this.regentFalls();
  }

  // ---------------------------------------------------------------- the castle
  regentFalls() {
    const g = this.g, R = L('ผู้สำเร็จราชการไร้มือ', 'The Handless Regent');
    g.equipment.reward(['arm_regent']);
    g.gainXP(1200);
    setTimeout(() => this.say([
      [R, L('...มือ... ไม่มีมือไหนแย่งมันไปได้... ข้าไม่มีมือให้มันบังคับ...', '...hands... no hand shall take it... I have no hands for them to make take it...')],
      [R, L('เจ้า... ข้าจำหน้าเจ้าได้ ผู้ถือมงกุฎ เจ้าปีนขึ้นมาไม่ถึง... มือพวกนั้นคว้าเจ้าไปต่อหน้าข้า', 'Thou... I know thy face. Crown-Bearer. Thou didst never reach us... the hands took thee before mine eyes.')],
      [R, L('ข้าจึงเก็บมันไว้แทนเจ้า สามร้อยปี... รับไปเถอะ แล้วเอามันกลับไปให้เจ้าของ', 'So I kept it for thee. Three hundred years... Take it. Take it back to its master.')],
      [N, L('ห่อผ้าที่ผูกไว้กับตอแขนของเขาหลุดออก ข้างในคือมงกุฎหิน หนักกว่าที่คิด และอุ่นอย่างประหลาด', 'The bundle bound to his stump falls loose. Inside is the stone crown — heavier than you thought, and strangely warm.')],
      [N, L('ทันทีที่มือแตะมงกุฎ เจ้าก็จำได้ทั้งหมด: ราชาที่ส่งเจ้ามา คำสั่งสุดท้าย "จงบอกลูกข้าว่ากษัตริย์ต้องรู้จักแบมือ" โซ่ เมฆ และมือนับร้อย', 'The moment your hand touches it, you remember everything: the King who sent you, his last command — "Tell my son a king must know how to open his hand" — the chain, the cloud, the hundred hands.')],
      [N, L('เกาะทั้งเกาะสั่นสะเทือน ทางตะวันตก ฝุ่นพวยพุ่งขึ้นจากแผ่นดินหน้าสะพานหิน... ความฝันของราชากำลังลุกขึ้นยืน', 'The whole island shudders. In the west, dust bursts from the earth before the stone bridge... the King\'s dream is getting to its feet.')],
    ], () => {
      this.set('stage', 6, L('ได้มงกุฎหิน', 'Obtained the Stone Crown'));
      g.ui.banner(L('ร่างศิลาลุกขึ้นแล้ว', 'The Colossus Rises'), L('ลงจากเกาะ แล้วไปที่หัวราชาหินทางตะวันตก', 'Get down from the island and go to the Stone King\'s head in the west'));
    }), 1800);
  }

  // up or down the chain: a ride that takes you there
  climb(up) {
    const g = this.g, p = g.player;
    if (g.mount?.ridden) g.mount.dismount();
    this.climbing = { t: 0, up, dur: 12 };
    g.ui.toast(up ? L('เจ้าเกี่ยวตะขอกับข้อโซ่แล้วเริ่มปีน...', 'You set the hook in a link and begin to climb...') : L('เจ้าเกี่ยวตะขอแล้วไต่โซ่ลงไป...', 'You set the hook and lower yourself down the chain...'));
    p.vel.set(0, 0, 0);
  }

  updateClimb(dt) {
    const g = this.g, p = g.player, cl = this.climbing, ch = this.sky.chain;
    cl.t += dt;
    let k = Math.min(1, cl.t / cl.dur);
    if (!cl.up) k = 1 - k;
    // walk to the anchor, up the chain, over the edge
    const pos = new THREE.Vector3();
    if (k < 0.06) pos.lerpVectors(ch.base, ch.from, k / 0.06);
    else if (k < 0.9) pos.copy(ch.point((k - 0.06) / 0.84)).add(new THREE.Vector3(0, 0.5, 0));
    else {
      const u = (k - 0.9) / 0.1;
      pos.lerpVectors(ch.to, ch.top, u);
      pos.y += Math.sin(Math.PI * u) * 4 + (1 - u) * 0.5;
    }
    p.pos.copy(pos);
    p.vel.set(0, 0, 0);
    p.camY = p.pos.y;
    // face along the chain
    const ahead = cl.up ? ch.point(Math.min(1, (k - 0.06) / 0.84 + 0.02)) : ch.point(Math.max(0, (k - 0.06) / 0.84 - 0.02));
    if (k > 0.06 && k < 0.9) p.yaw += wrapAngle(Math.atan2(-(ahead.x - pos.x), -(ahead.z - pos.z)) - p.yaw) * Math.min(1, dt * 2);
    g.camera.position.set(p.pos.x, p.pos.y + p.eye, p.pos.z);
    if (Math.random() < dt * 2) g.audio.metal?.({ freq: 160 + Math.random() * 60, dur: 0.5, gain: 0.05, partials: [1, 2.6] });
    if (cl.t >= cl.dur) {
      this.climbing = null;
      p.onGround = true;
      if (cl.up) {
        g.checkpoint = { x: ch.top.x, z: ch.top.z, y: ch.top.y };
        g.ui.banner(L('ปราสาทแขวนฟ้า', 'Sky-Hung Castle'), L('สามร้อยปีที่ไม่มีใครขึ้นมาถึง', 'Three hundred years since anyone came up'));
      } else g.checkpoint = { x: ch.base.x, z: ch.base.z };
      g.onQuestChanged(false);
    }
  }

  // ---------------------------------------------------------------- the end of the chapter
  crown() {
    const g = this.g;
    this.say([
      [N, L('ร่างศิลาคุกเข่าอยู่ตรงหน้า หัวหินก้มลงจนเกือบแตะพื้น ที่ว่างบนศีรษะรอมงกุฎมาสามร้อยปี', 'The colossus kneels before you, its stone head bowed almost to the ground. The empty seat upon its brow has waited three hundred years for the crown.')],
      [N, L('เจ้าปีนขึ้นไปวางมงกุฎหินลง...', 'You climb up and set the stone crown in its place...')],
      [KING(), L('...อา ผู้ถือมงกุฎ ในที่สุดเจ้าก็มาถึง', '...Ah. Crown-Bearer. At last thou hast arrived.')],
      [KING(), L('เจ้านำคำของข้าไปถึงลูกข้าแล้ว — ไม่ใช่ด้วยปาก แต่ด้วยการแบมือเขาออก ทีละนิ้ว', 'Thou didst carry my word to my son after all — not with thy mouth, but by opening his hand, one finger at a time.')],
      [KING(), L('ข้าจะกลับไปหลับให้ดี คราวนี้ด้วยใจของข้าเอง หินจะไม่ลามอีก คนที่กลายเป็นหินจะค่อย ๆ อ่อนลงเป็นเนื้อ', 'I shall go back to my sleep, and this time with my own mind. The stone will creep no more. Those it took will soften back into flesh, slowly.')],
      [KING(), L('แต่จงฟัง... ลูกข้าไม่ได้ป่วยเพราะตัวเอง มีนกสีดำตัวหนึ่งร้องเพลงกล่อมข้างหูเขาทุกคืน ร้องว่าจงคว้าไว้ อย่าปล่อย', 'But hear me... my son did not sicken of himself. A black bird sang beside his ear every night. It sang: grasp it, and never let go.')],
      [KING(), L('ดวงจันทร์ยังไม่หายดีหรอก ผู้ถือมงกุฎ ตามหานกตัวนั้นให้พบ', 'The moon is not yet well, Crown-Bearer. Find that bird.')],
      [N, L('ร่างศิลาค่อย ๆ จมกลับลงไปในแผ่นดิน เหลือเพียงมงกุฎหินที่ยังเรืองแสงอยู่บนพื้นหญ้า', 'The colossus sinks slowly back into the earth, leaving only the stone crown, still glowing, upon the grass.')],
    ], () => {
      this.stage = 7;
      g.equipment.reward(['arm_crown']);
      g.gainXP(2500);
      g.addCoins?.(300);
      const e = this.live.colossus;
      if (e) { e.ai.mode = 'gone'; e.ai.t = 0; }
      g.onQuestChanged();
      g.endChapter2?.();
    }, L('สวมมงกุฎ', 'Crown him'));
  }

  // ---------------------------------------------------------------- every frame
  update(dt) {
    if (!this.open || !this.sky) return;
    const g = this.g, p = g.player;
    if (!this.announced && g.state === 'play') {
      this.announced = true;
      setTimeout(() => g.ui.banner(L('บทที่ 2', 'Chapter 2'), L('ราชาหินตื่น', 'The Stone King Wakes')), 1200);
      g.onQuestChanged();
    }
    if (this.climbing) this.updateClimb(dt);
    this.rooms.update(dt);
    if (!this.ambient) this.spawnAmbient();
    const near = (v, r) => Math.hypot(p.pos.x - v.x, p.pos.z - v.z) < r;
    // raised as you come near, so a reload never loses them
    if (this.stage === 2 && !g.combat.enemies.some((e) => e.storyTag === 'c2chain' && e.alive)) this.raise('chain');
    if (this.stage === 4 && this.hook === 1 && !this.live.warden?.alive && near(this.sky.chain.anchor, 90)) this.raise('warden');
    if (this.stage === 4 && this.skin === 1 && !this.live.camp && near(this.spots.camp, 110)) this.raise('camp');
    if (this.stage >= 5 && !this.live.guards && onIsland(p.pos.x, p.pos.z, p.pos.y)) this.raise('guards');
    if (this.stage === 5 && !this.live.regent && near(CASTLE, 140) && p.pos.y > CASTLE.top - 20) this.raise('regent');
    if (this.stage === 6 && !this.live.colossus && near(this.spots.colossus, 420)) this.raise('colossus');
    // the regent rises when you come onto the terrace
    const R = this.live.regent;
    if (R?.alive && R.ai?.mode === 'dormant' && !R.ai.awake && !R.ai.talking && near(this.sky.regentAt, 15) && Math.abs(p.pos.y - this.sky.regentAt.y) < 5 && !g.ui.dialogueOpen) {
      if (R.ai.talked) R.ai.awake = true;
      else this.regentSpeaks(R);
    }
    // the colossus wakes when you come near the sleeping head, and the head is gone: it is the colossus
    const K = this.live.colossus;
    if (K && this.stage === 6 && K.ai.mode === 'buried' && near(this.spots.colossus, 170)) { K.ai.awake = true; this.headAsleep(false); }
    if (K && K.ai.mode === 'gone') {
      K.ai.t += dt;
      K.ai.sink = -K.ai.t * 3;
      if (K.ai.t > 8) { K.obj.visible = false; K.alive = false; K.ai.mode = 'away'; for (const s of K.ai.seals) { s.alive = false; s.obj.visible = false; } this.headAsleep(true); }
    }
  }

  // the sleeping head (src/giants.js) and its lit eyes, shown or not
  headAsleep(on) {
    const g = this.g;
    if (g.fx.kingHead) g.fx.kingHead.visible = on;
    for (const s of g.kingEyes || []) s.visible = on;
  }

  regentSpeaks(R) {
    const RN = L('ผู้สำเร็จราชการไร้มือ', 'The Handless Regent');
    R.ai.talking = true;
    this.say([
      [N, L('ร่างในเกราะคุกเข่าอยู่หน้าบัลลังก์ว่าง แขนทั้งสองข้างจบที่ข้อมือ ดาบใหญ่ถูกโซ่มัดติดตอแขนไว้', 'A figure in armour kneels before the empty throne. Both its arms end at the wrist; a greatsword is chained to the stumps.')],
      [RN, L('...อีกมือหนึ่ง... มาเอามงกุฎอีกแล้วรึ', '...another hand... come for the crown again?')],
      [RN, L('ไม่มีมือไหนจะได้มันไป! ข้าตัดมือของข้าเองทิ้งแล้ว ข้าจะตัดมือของเจ้าด้วย!', 'No hand shall have it! I cut off mine own — and I shall cut off thine!')],
    ], () => { R.ai.talking = false; R.ai.talked = true; R.ai.awake = true; }, L('สู้', 'Fight'));
  }

  // a few of the Petrified wander the valley once the stone creeps (they come back, like any foe)
  spawnAmbient() {
    const c = this.g.combat;
    this.ambient = true;
    if (this.done) return;
    const m = this.fallen.mid;
    for (const [x, z] of [[m.x + 30, m.z - 20], [m.x - 25, m.z + 30], [120, 40], [-60, -20], [HEAD.x + 120, HEAD.z + 40], [HEAD.x + 125, HEAD.z - 40]]) {
      const e = c.spawn('petrified', x, z);
      e.def = { ...e.def, respawn: 600 };
    }
  }

  // after a load: anything mid-fight starts over (the update raises them again as you come near)
  restore() {
    this.applyWorld();
    this.rooms.restore();
    this.headAsleep(true);
    if (this.wave) this.wave = 0;
  }
}
