// Chapter 1: "The Hands That Hold the Moon" (Thai text). docs/STORY_CH1.md is the plan.
//
// Act 1 (the swamp), in order:
//   stage 0 find the shepherd -> 1 find 3 lost sheep -> 2 return -> 3 meet the toad
//   -> 4 collect 5 wisp essences -> 5 return -> 6 pour the moon water at the temple altar
// stage 7: the altar's vision. Three acts open at once, in any order, each worth one of the
// moon's fingers (the swamp's comes with the vision):
//   bell (north)  0 the bell-ringer's grave -> 1 ring the bell -> 2 the journal on the stones' altar
//                 -> 3 the armour wakes -> 4 done (finger of wind, the little bell)
//   farm (east)   0 meet Min (by day) -> 1 the sail in the barn -> 2 mend the mill -> 3 the fallen
//                 cocoon -> 4 back to Min -> 5 done (finger of grain)
//   lake (south)  0 the ferryman -> 1 the three murals -> 2 the last guard -> 3 done (finger of water)
// With three fingers the last act opens:
//   hunt (west)   0 the hunter's journal -> 1 Oren, who forgot his name -> 2 the King of a Hundred
//                 Hands (only now can he be woken) -> 3 done
// stage 8: the chapter is over.
import * as THREE from 'three';
import { LOST_SHEEP, HANGTREE, HUNTER } from './layout.js';
import { ENEMY_TYPES } from './combat.js';
import { createOren } from './oren.js';

export const POTION_PRICE = 8;
export const ESSENCE_GOAL = 5;

export class Quests {
  constructor(game) {
    this.g = game;
    this.stage = 0;
    this.sheepFound = [false, false, false];
    this.essence = 0;
    Object.assign(this, { bell: 0, farm: 0, lake: 0, hunt: 0, murals: [false, false, false], guardForged: false, bellReadyAt: 0 });
  }

  serialize() {
    const { stage, sheepFound, essence, bell, farm, lake, hunt, murals, guardForged } = this;
    return { v: 2, stage, sheepFound, essence, bell, farm, lake, hunt, murals, guardForged };
  }
  load(d) {
    Object.assign(this, {
      stage: d.stage ?? 0, sheepFound: d.sheepFound ?? [false, false, false], essence: d.essence ?? 0,
      bell: d.bell ?? 0, farm: d.farm ?? 0, lake: d.lake ?? 0, hunt: d.hunt ?? 0, murals: d.murals ?? [false, false, false], guardForged: !!d.guardForged,
    });
    // an old save that finished the first chapter's old ending picks up at the vision's end
    if (d.v !== 2 && this.stage >= 7) this.stage = 7;
  }

  get sheepCount() { return this.sheepFound.filter(Boolean).length; }
  get done() { return this.stage >= 8; }
  // the moon's fingers, pried loose
  get fingers() {
    const f = [];
    if (this.stage >= 7) f.push('swamp');
    if (this.bell >= 4) f.push('wind');
    if (this.farm >= 5) f.push('grain');
    if (this.lake >= 3) f.push('water');
    return f;
  }
  has(finger) { return this.fingers.includes(finger); }
  get huntOpen() { return this.stage >= 7 && this.fingers.length >= 3; }
  bossReady() { return this.stage >= 7 && this.hunt >= 2; }
  get spots() { return this.g.storySpots; }

  objective() {
    switch (this.stage) {
      case 0: return { title: 'เสียงกาในทุ่ง', text: 'เดินตามรางรถไฟเก่าขึ้นไปทางเหนือ ตามหาผู้เลี้ยงแกะบนเนินจันทร์' };
      case 1: return { title: 'แกะดำที่หลงทาง', text: `ตามหาแกะดำที่หลงทาง (${this.sheepCount}/3)` };
      case 2: return { title: 'แกะดำที่หลงทาง', text: 'กลับไปหาโกวัก ผู้เลี้ยงแกะ' };
      case 3: return { title: 'ยายคางคกใต้เห็ดยักษ์', text: 'ไปพบยายคางคกใต้เห็ดยักษ์ในป่าทางตะวันตก' };
      case 4: return { title: 'ดวงไฟแห่งบึง', text: `ฟันวิญญาณบึงแล้วเก็บแก่นวิญญาณ (${this.essence}/${ESSENCE_GOAL})` + (this.g.dayNight.isNight ? '' : ' — วิญญาณออกมาเฉพาะกลางคืน (พักที่โรงเตี๊ยมได้)') };
      case 5: return { title: 'ดวงไฟแห่งบึง', text: 'นำแก่นวิญญาณกลับไปให้ยายคางคก' };
      case 6: return { title: 'วิหารจมน้ำ', text: 'ผ่านหุบผาซุ้มประตูหินทางเหนือ เทน้ำมนต์จันทราลงบนแท่นบูชา' };
      case 7: return { title: `มือที่กอดดวงจันทร์ — ข้อนิ้ว ${this.fingers.length}/4`, text: this.steps().map((x) => x.text).join(' · ') };
      default: return { title: 'บทที่ 1 จบแล้ว', text: 'ดวงจันทร์ได้หายใจอีกครั้ง · ท่องไปในบึงจันทราได้อย่างอิสระ' };
    }
  }

  // what each open act asks for next: [{ act, text, at: {x,z}, label }]
  steps() {
    const S = this.spots, out = [], night = this.g.dayNight.isNight;
    if (this.huntOpen && this.hunt < 3) {
      out.push([
        { text: 'ตะวันตก: ไปเพิงนายพรานที่หายไป หาสมุดของเขา', at: S.journal, label: 'เพิงนายพราน' },
        { text: 'ตะวันตก: ล้มนายพรานโอเรนที่เฝ้าทางเข้าป่า', at: S.oren, label: 'โอเรน' },
        { text: 'ตะวันตก: ต้นไม้แขวนคอ — โค่นราชันร้อยกร', at: { x: HANGTREE.x + 13, z: HANGTREE.z + 7 }, label: 'ราชันร้อยกร' },
      ][this.hunt]);
    }
    if (this.bell < 4) {
      out.push([
        { text: 'เหนือ: หาหลุมศพคนตีระฆังข้างหอระฆัง', at: S.grave, label: 'หลุมศพ' },
        { text: 'เหนือ: ปีนหอระฆังแล้วตีระฆัง', at: S.bell, label: 'ระฆัง' },
        { text: 'เหนือ: วางสมุดบันทึกบนแท่นที่ลานหินตั้ง', at: S.stones, label: 'ลานหินตั้ง' },
        { text: 'เหนือ: ล้มชุดเกราะที่ตื่นขึ้นที่ลานหินตั้ง', at: S.stones, label: 'ชุดเกราะ' },
      ][this.bell]);
    }
    if (this.farm < 5) {
      out.push([
        { text: `ตะวันออก: ตามเสียงเพลงในไร่ข้าวโพด${night ? ' (มีแค่ตอนกลางวัน)' : ''}`, at: S.min, label: 'ไร่ข้าวโพด' },
        { text: 'ตะวันออก: หาใบพัดที่หายไปในโรงนา', at: S.sail, label: 'โรงนา' },
        { text: 'ตะวันออก: นำใบพัดไปติดคืนที่กังหันลม', at: S.millDoor, label: 'กังหันลม' },
        { text: 'ตะวันออก: หาตุ๊กตาของมิ้นในรังไหมใต้กังหัน', at: S.cocoon, label: 'รังไหม' },
        { text: `ตะวันออก: นำตุ๊กตาไปคืนมิ้น${night ? ' (กลางวัน)' : ''}`, at: S.min, label: 'มิ้น' },
      ][this.farm]);
    }
    if (this.lake < 3) {
      const left = this.murals.filter((m) => !m).length;
      out.push([
        { text: 'ใต้: ไปท่าเรือผุ คุยกับคนแจวเรือ', at: S.ferryman, label: 'คนแจวเรือ' },
        { text: `ใต้: ดูภาพบนผนังมหาวิหารจม (เหลือ ${left})`, at: S.murals[this.murals.findIndex((m) => !m)] || S.dais, label: 'ภาพผนัง' },
        { text: 'ใต้: ล้มองครักษ์คนสุดท้ายบนแท่นพิธี', at: S.dais, label: 'องครักษ์' },
      ][this.lake]);
    }
    if (!this.huntOpen) out.push({ text: `ได้ข้อนิ้ว 3 ชิ้นแล้วทางตะวันตกจะเปิด (${this.fingers.length}/3)` });
    return out.filter(Boolean);
  }

  markers() {
    const crow = this.g.npcs.crow.pos, toad = this.g.npcs.toad.pos, altar = this.g.altar;
    switch (this.stage) {
      case 0: case 2: return [{ x: crow.x, z: crow.z, label: 'โกวัก' }];
      case 1: return LOST_SHEEP.filter((_, i) => !this.sheepFound[i]).map(([x, z]) => ({ x, z, label: 'แกะ' }));
      case 3: case 5: return [{ x: toad.x, z: toad.z, label: 'ยายคางคก' }];
      case 4: {
        const w = this.g.combat.nearest('wisp', this.g.player.pos);
        return w ? [{ x: w.pos.x, z: w.pos.z, label: 'วิญญาณ' }] : [];
      }
      case 6: return [{ x: altar.x, z: altar.z, label: 'แท่นบูชา' }];
      case 7: return this.steps().filter((x) => x.at).map((x) => ({ x: x.at.x, z: x.at.z, label: x.label }));
      default: return [];
    }
  }

  // ---------------------------------------------------------------- the story's places
  // interactables that exist only while the story needs them
  spotsNow() {
    if (this.stage < 7 || !this.spots) return [];
    const S = this.spots, out = [], day = !this.g.dayNight.isNight;
    const add = (id, pos, label, r = 3) => out.push({ id, pos, r, label });
    if (this.bell === 0) add('story:grave', S.grave, 'อ่านหลุมศพคนตีระฆัง');
    if (this.bell === 1) add('story:bell', S.bell, 'ตีระฆัง', 3.5);
    if (this.bell === 2) add('story:stones', S.stones, 'วางสมุดบันทึกบนแท่นบูชา');
    if (this.farm === 0 || this.farm === 4) add(day ? 'min' : 'story:haystack', S.min, day ? 'คุยกับเด็กผู้หญิงบนกองฟาง' : 'ตรวจดูกองฟาง');
    if (this.farm === 1) add('story:sail', S.sail, 'หยิบใบพัดกังหัน');
    if (this.farm === 2) add('story:mill', S.millDoor, 'ติดใบพัดคืนให้กังหันลม', 4);
    if (this.farm === 3) add('story:cocoon', S.cocoon, 'แกะรังไหมที่ร่วงอยู่');
    if (this.farm >= 5 && day) add('min', S.min, 'คุยกับมิ้น');
    add('ferryman', S.ferryman, 'คุยกับคนแจวเรือ', 3.2);
    if (this.lake === 1) S.murals.forEach((m, i) => { if (!this.murals[i]) add(`story:mural${i}`, m, 'ดูภาพบนผนัง', 3.5); });
    if (this.huntOpen && this.hunt === 0) add('story:journal', S.journal, 'อ่านสมุดของนายพราน');
    return out;
  }

  // a story place examined: [[speaker, text]...] and what happens
  inspect(id) {
    const g = this.g, N = '';
    const say = (lines, then) => g.ui.openDialogue({ lines, options: [{ label: 'ต่อไป', fn: then || (() => {}) }] }, () => g.updateHud());
    switch (id) {
      case 'story:grave': return say([
        [N, 'หลุมศพที่สูงกว่าหลุมอื่น ป้ายสลักว่า "ผู้ตีระฆังคนสุดท้าย"'],
        [N, 'เทียนเล่มหนึ่งยังลุกอยู่ ทั้งที่ไม่มีใครมาจุด... ใต้เทียนมีสมุดหนังเก่าห่อผ้าน้ำมันไว้'],
        [N, '"...ระฆังดังเพื่อไล่มือ มือกลัวเสียงระฆัง ตราบที่ข้ายังตีทุกคืน มือจะไม่ลงจากเขา..."'],
        [N, '"...ถ้าข้าไม่อยู่แล้ว จงนำบันทึกนี้ไปวางที่แท่นหินตั้ง ให้ลมจำเสียงระฆังไว้แทนข้า"'],
      ], () => this.step('bell', 1, 'ได้สมุดบันทึกคนตีระฆัง'));
      case 'story:bell': return this.ringBell();
      case 'story:stones': return say([
        [N, 'เจ้าวางสมุดบันทึกลงบนแท่นหิน อักษรบนแท่นสว่างขึ้นทีละตัว ลมหนาวหมุนวนรอบลานหิน'],
        [N, 'แล้วเสียงเหล็กกระทบกันก็ดังขึ้นจากเงาของหินตั้ง... เกราะสองชุดลุกขึ้นยืน'],
      ], () => { this.step('bell', 3); this.spawnStory('stones'); });
      case 'story:haystack': return say([[N, 'กองฟางเปียกน้ำค้าง... มีรอยคนนั่งอยู่ ตอนกลางวันอาจมีใครมานั่งร้องเพลงที่นี่']]);
      case 'story:sail': return say([
        [N, 'ใบพัดกังหันอันหนึ่งพิงอยู่ในโรงนา ผ้าใบยังดีอยู่ แค่หลุดออกจากแกน'],
      ], () => { this.step('farm', 2, 'ได้ใบพัดกังหัน'); g.fx.story?.sail && (g.fx.story.sail.visible = false); });
      case 'story:mill': return say([
        [N, 'เจ้าปีนขึ้นไปผูกใบพัดเข้ากับแกน... ลมพัดมาพอดี กังหันหมุนครบสามใบเป็นครั้งแรกในรอบหลายปี'],
        [N, 'ทั่วทั้งไร่ หุ่นฟางทุกตัวล้มลงเป็นกองฟางเงียบ ๆ'],
      ], () => { g.fx.windmill?.addSail(); this.strawFall(); this.step('farm', 3); });
      case 'story:cocoon': return say([
        [N, 'รังไหมที่ร่วงลงมาจากที่ไหนสักแห่ง เจ้ากรีดมันออก... ข้างในว่างเปล่า มีแค่ตุ๊กตาฟางตัวเล็ก ๆ ผูกริบบิ้นแดง'],
      ], () => { this.step('farm', 4, 'ได้ตุ๊กตาฟาง'); g.fx.story?.cocoon && (g.fx.story.cocoon.visible = false); });
      case 'story:journal': return say([
        [N, 'สมุดของนายพรานโอเรน ลายมือหวัดขึ้นเรื่อย ๆ ทุกหน้า'],
        [N, '"ทางเข้าลานต้นไม้อยู่ทางตะวันออกของมัน เดินตามถนนไปแล้วอย่าออกนอกทาง"'],
        [N, '"มันไม่ได้หลับ มันรอ อย่ายืนนิ่งตอนดินสั่น อย่ายืนในวงแดง"'],
        [N, '"ข้าจำชื่อลูกสาวไม่ได้แล้ว... ข้าจำชื่อตัวเองไม่ได้แล้ว..." (หน้าสุดท้ายว่างเปล่า)'],
      ], () => { this.step('hunt', 1); this.spawnStory('oren'); });
      default:
        if (id.startsWith('story:mural')) return this.mural(+id.slice(11));
    }
  }

  mural(i) {
    const g = this.g, N = '';
    const text = [
      [[N, 'ภาพแรก: ชายชราสวมมงกุฎหินนั่งบนบัลลังก์ แบมือทั้งสองข้างออกให้เด็กชายตัวเล็ก ๆ ดู'], [N, 'ใต้ภาพสลักว่า "กษัตริย์ต้องรู้จักแบมือ"']],
      [[N, 'ภาพที่สอง: เด็กชายคนเดิมโตขึ้น สวมมงกุฎหนามที่ทำจากกิ่งไม้ดำ กำมือแน่นจนเลือดไหล'], [N, 'ข้างหลังเขามีชายชรากลายเป็นหินทีละน้อย']],
      [[N, 'ภาพสุดท้าย: แขนนับสิบงอกออกจากอกของเจ้าชาย คว้าทุกสิ่งรอบตัว คน ม้า ดวงดาว และดวงจันทร์'], [N, 'ชื่อที่สลักไว้ใต้ภาพถูกขูดทิ้ง เหลือแค่คำว่า "อาวร"']],
    ][i];
    g.ui.openDialogue({ lines: text, options: [{ label: 'ต่อไป', fn: () => {
      this.murals[i] = true;
      g.gainXP(120);
      if (this.murals.every(Boolean)) {
        g.ui.combatText('เสียงเหล็กดังขึ้นจากแท่นพิธี...', 'bad');
        this.lake = 2; this.spawnStory('guard');
      }
      g.onQuestChanged();
    } }] }, () => g.updateHud());
  }

  // advance an act; rewards when an act closes
  step(act, to, toast) {
    const g = this.g;
    this[act] = to;
    if (toast) g.ui.toast(toast);
    g.gainXP(250);
    g.audio.chime();
    const doneAt = { bell: 4, farm: 5, lake: 3 };
    if (to === doneAt[act]) this.actDone(act);
    g.onQuestChanged();
  }

  actDone(act) {
    const g = this.g;
    const finger = { bell: 'นิ้วแห่งลม', farm: 'นิ้วแห่งรวงข้าว', lake: 'นิ้วแห่งน้ำ' }[act];
    g.gainXP(600);
    g.ui.banner(`ข้อนิ้วของดวงจันทร์ ${this.fingers.length}/4`, `${finger} คลายออกแล้ว`);
    g.audio.discover();
    const give = (id, n = 1) => { const left = g.bag.add(id, n); if (left) g.loot.dropNearPlayer(id, left); };
    if (act === 'bell') { give('small_bell'); setTimeout(() => g.ui.toast('ได้ลิ้นระฆังเล็ก — ใช้จากกระเป๋า ทำให้ผู้หลงทางหยุดนิ่ง'), 1500); }
    if (act === 'farm') {
      give('tonic', 2);
      if (g.gear.cloak < 4) { g.gear.cloak++; g.onGearChanged?.(); setTimeout(() => g.ui.toast('ฟางสาปเสริมผ้าคลุมให้หนาขึ้น 1 ขั้น'), 1500); }
    }
    if (act === 'lake') setTimeout(() => g.ui.toast('ได้ดาบขององครักษ์ — นำไปให้ลุงทั่งหลอมเข้ากับดาบของเจ้า'), 1500);
    if (this.huntOpen && this.hunt === 0) setTimeout(() => g.ui.banner('ทางตะวันตกเปิดแล้ว', 'ไปเพิงนายพรานที่หายไป'), 4200);
  }

  // the bell rings out over the whole north: every one of the Lost kneels a while
  ringBell() {
    const g = this.g, p = g.player;
    g.audio.metal({ freq: 73.4, dur: 7, gain: 0.4, partials: [1, 2.02, 2.76, 4.1, 5.4, 6.8], verb: 1 });
    g.audio.thump({ freq: 55, dur: 3, gain: 0.5, drop: 0.8 });
    p.shake = Math.max(p.shake, 0.5);
    let n = 0;
    for (const e of g.combat.enemies) {
      if (e.type !== 'hollow' || !e.alive || e.state === 'dying' || e.pos.distanceTo(p.pos) > 100) continue;
      e.state = 'stagger'; e.t = 10; n++;
    }
    g.ui.openDialogue({ lines: [
      ['', 'เสียงระฆังดังกังวานไปทั่วที่ราบสูง... นานจนเจ้าคิดว่ามันจะไม่มีวันหยุด'],
      ['', n ? `ไกลออกไป ร่างของผู้หลงทาง ${n} ร่างทรุดลงคุกเข่า หันหน้ามาทางหอระฆัง` : 'ลมหนาวหยุดพัดชั่วขณะ เหมือนทั้งโลกกำลังฟัง'],
      ['', 'ในสมุดบันทึก มีหน้าหนึ่งเขียนว่า "ลานหินตั้งทางตะวันตก" — ที่ที่ลมจะจำเสียงระฆังไว้'],
    ], options: [{ label: 'ต่อไป', fn: () => this.step('bell', 2) }] }, () => g.updateHud());
  }

  strawFall() {
    for (const e of this.g.combat.enemies) {
      if (e.type === 'straw' && e.alive && e.state !== 'dying' && e.home.distanceTo(this.spots.min) < 120) this.g.combat.kill(e);
    }
  }

  // ---------------------------------------------------------------- the story's fights
  spawnStory(kind) {
    const g = this.g, c = g.combat, S = this.spots;
    const make = (type, pos, def, tag) => {
      const e = c.spawn(type, pos.x, pos.z);
      Object.assign(e, { summoned: true, storyTag: tag, activeOverride: 'always', state: 'chase' });
      if (def) { e.def = { ...ENEMY_TYPES[type], ...def }; e.hp = e.def.hp; e.storyBoss = true; e.obj.scale.setScalar(def.scale ?? 1); }
      return e;
    };
    if (kind === 'stones') for (const dx of [-7, 7]) make('armour', { x: S.stones.x + dx, z: S.stones.z + 5 }, null, 'stones');
    if (kind === 'guard') make('armour', S.dais, { name: 'องครักษ์คนสุดท้าย', hp: 20, damage: 28, coins: [40, 60], scale: 1.15 }, 'guard');
    if (kind === 'oren') {
      // one of the Lost in all but looks: he still wears his hunting coat, hat and mask
      const e = make('hollow', S.oren, { name: 'นายพรานโอเรน', hp: 14, damage: 18, speed: 2.8, coins: [30, 45] }, 'oren');
      g.scene.remove(e.obj);
      e.obj = createOren(g.M);
      g.scene.add(e.obj);
    }
  }

  // after a load, a fight the story had started is still waiting
  restore() {
    if (this.bell === 3) this.spawnStory('stones');
    if (this.lake === 2) this.spawnStory('guard');
    if (this.hunt === 1) this.spawnStory('oren');
  }

  onEnemyKilled(e) {
    if (!e.storyTag) return;
    const g = this.g, left = g.combat.enemies.some((o) => o !== e && o.storyTag === e.storyTag && o.alive && o.state !== 'dying');
    if (e.storyTag === 'stones' && !left && this.bell === 3) this.step('bell', 4);
    if (e.storyTag === 'guard' && this.lake === 2) this.step('lake', 3);
    if (e.storyTag === 'oren' && this.hunt === 1) {
      g.ui.openDialogue({ lines: [
        ['นายพรานโอเรน', '...โอเรน... ชื่อข้า... โอเรน'],
        ['นายพรานโอเรน', 'ลูกข้าชื่อ... มิ้น... เธอรออยู่ที่ไร่... บอกเธอว่าพ่อขอโทษ'],
        ['', 'ร่างของเขาสลายเป็นฝุ่น เหลือเชือกเส้นหนึ่งที่ถักจากผมคนไว้ในมือ — เชือกตัดรังไหม'],
      ], options: [{ label: 'ต่อไป', fn: () => { this.step('hunt', 2, 'ได้เชือกตัดรังไหม'); g.ui.banner('ราชันร้อยกร', 'รอเจ้าอยู่ที่ต้นไม้แขวนคอ'); } }] }, () => g.updateHud());
    }
  }

  // the little bell from the north: the Lost freeze; the King flinches, once a fight
  useSpecial(kind) {
    const g = this.g, p = g.player;
    if (kind !== 'bell') return false;
    if (g.time < this.bellReadyAt) { g.ui.toast(`ลิ้นระฆังยังสั่นอยู่ (${Math.ceil(this.bellReadyAt - g.time)} วินาที)`); return false; }
    this.bellReadyAt = g.time + 90;
    g.audio.metal({ freq: 880, dur: 2.5, gain: 0.12, partials: [1, 2.0, 3.01], verb: 0.8 });
    let n = 0;
    for (const e of g.combat.enemies) {
      if (!e.alive || e.state === 'dying') continue;
      const d = e.pos.distanceTo(p.pos);
      if (e.type === 'hollow' && d < 25) { e.state = 'stagger'; e.t = Math.max(e.t, 4); n++; }
      if (e.type === 'handking' && d < 35 && e.ai && e.ai.mode === 'fight' && !e.ai.belled) {
        e.ai.belled = true; e.ai.atk = null; e.ai.cd = 2.5; e.weakT = 2.5; n++;
        g.ui.combatText('ราชันร้อยกรชะงัก!', 'parry');
      }
    }
    g.ui.toast(n ? `เสียงระฆังเล็ก — ${n} ร่างหยุดนิ่ง` : 'เสียงระฆังเล็กดังกังวาน...');
    return false;
  }

  // the King has fallen: the chapter ends
  onBossDefeated() {
    if (this.done) return;
    this.hunt = 3;
    this.stage = 8;
    this.g.gainXP(1500);
    this.g.endChapter();
  }

  // Each talk returns { lines: [[speaker, text]...], options: [{label, fn}] }
  talk(npc) {
    const g = this.g;
    const advance = (s) => () => { this.stage = s; g.onQuestChanged(); };
    const close = { label: 'ลาก่อน', fn: () => {} };
    const brew = { label: 'ปรุงยา (หม้อต้มยา)', fn: () => g.openMenu('alchemy') };
    const shop = {
      label: `ซื้อยาฟื้นพลัง (${POTION_PRICE} เหรียญ)`,
      fn: () => {
        if (g.coins < POTION_PRICE) g.ui.toast('เหรียญไม่พอ...');
        else if (!g.bag.canAdd('potion')) g.ui.toast('กระเป๋าเต็ม — จัดกระเป๋าก่อน [I]');
        else { g.coins -= POTION_PRICE; g.bag.add('potion'); g.audio.coin(); g.ui.toast('ได้รับยาฟื้นพลัง ×1  [Q] เพื่อดื่ม'); }
        g.updateHud();
      },
      keepOpen: true,
    };

    if (npc === 'crow') {
      const C = 'โกวัก ผู้เลี้ยงแกะ';
      switch (this.stage) {
        case 0: return {
          lines: [
            [C, 'กา... ผู้เดินทางที่เดินลุยบึงมาตามรางเหล็กเก่าสินะ'],
            [C, 'ข้าคือโกวัก ผู้เลี้ยงแกะแห่งเนินจันทร์ ฝูงแกะดำของข้ากินหญ้าใต้แสงจันทร์มาเป็นร้อยปี'],
            [C, 'แต่คืนนี้หมอกจากบึงพาลูกแกะของข้าไปสามตัว... ดวงไฟผีมันล่อพวกมันไป'],
            [C, 'ข้าออกจากรั้วนี้ไม่ได้ ไม่เช่นนั้นฝูงที่เหลือจะแตกกระเจิง เจ้าช่วยตามหาพวกมันได้ไหม?'],
          ],
          options: [{ label: 'ข้าจะช่วยตามหาให้', fn: advance(1) }, { label: 'ไว้ทีหลัง', fn: () => {} }],
        };
        case 1: return {
          lines: [[C, `ยังขาดอีก ${3 - this.sheepCount} ตัว... ลองฟังเสียงร้องของพวกมันดู ในบึงทางใต้ ในป่าทางตะวันตก และที่เชิงหุบผาทางเหนือ`]],
          options: [close],
        };
        case 2: return {
          lines: [
            [C, 'กา! กา! พวกมันกลับมาครบแล้ว!'],
            [C, 'รับนี่ไป... เหรียญทองจากยุคที่รางเหล็กยังมีรถไฟวิ่งผ่าน'],
            [C, 'และฟังข้าให้ดี ดวงจันทร์คืนนี้ป่วยไข้ แสงของมันจึงเป็นสีฟ้าเย็นเยียบเช่นนี้'],
            [C, 'ไปหายายคางคกใต้เห็ดยักษ์ทางตะวันตก นางรู้วิธีปลุกวิหารจมน้ำ'],
          ],
          options: [{ label: 'ขอบคุณ ข้าจะไปหานาง', fn: () => { g.addCoins(30); advance(3)(); } }],
        };
        default:
          if (this.done) return { lines: [[C, 'ดวงจันทร์หายใจได้อีกครั้ง... ฝูงแกะของข้าหลับสบายแล้ว ขอบใจเจ้า ผู้เดินทาง']], options: [close] };
          if (this.stage >= 7 && this.farm < 5) return { lines: [
            [C, 'กา... เจ้าเห็นมือพวกนั้นแล้วสินะ ข้าเห็นมันในฝันทุกคืนที่จันทร์ซีด'],
            [C, 'ข้าวโพดทางตะวันออกไม่มีใครเก็บมาหลายปีแล้ว แต่ข้ายังได้ยินเสียงเด็กร้องเพลงอยู่ในไร่ทุกเช้า'],
            [C, 'ถ้าจะไปก็ไปตอนกลางวัน ตอนกลางคืนหุ่นฟางพวกนั้นไม่ใช่หุ่นฟางอีกแล้ว'],
          ], options: [close] };
          return { lines: [[C, 'ขอให้แสงจันทร์นำทางเจ้า ผู้เดินทาง']], options: [close] };
      }
    }

    if (npc === 'toad') {
      const T = 'ยายคางคก';
      switch (this.stage) {
        case 3: return {
          lines: [
            [T, 'ฮึ่มม... ฝนตกดีจริงคืนนี้ โกวักส่งเจ้ามาสินะ'],
            [T, 'วิหารจมน้ำหลับใหลมาตั้งแต่ดวงจันทร์ป่วย มีเพียงน้ำมนต์จันทราที่จะปลุกมันได้'],
            [T, 'ข้าต้มให้ได้ แต่ต้องใช้แก่นวิญญาณบึงห้าดวง ไปฟันดวงไฟลอยในบึงมาให้ข้า'],
            [T, 'ระวังตัวด้วยล่ะ พวกมันกัดเจ็บนะ ไอ้หนู... ถ้าบาดเจ็บก็มาซื้อยาจากข้าได้'],
          ],
          options: [{ label: 'ข้าจะไปล่าดวงไฟ', fn: advance(4) }, brew, shop],
        };
        case 4: return {
          lines: [[T, `ยังได้แค่ ${this.essence} ดวง ต้องการห้าดวงนะ... ดวงไฟชอบลอยอยู่แถวบึงทางใต้`]],
          options: [brew, shop, close],
        };
        case 5: return {
          lines: [
            [T, 'ฮึ่ม... ครบห้าดวงแล้ว ส่งมานี่'],
            [T, '(ยายคางคกโยนแก่นวิญญาณลงในหม้อ น้ำในหม้อเรืองแสงสีฟ้า)'],
            [T, 'นี่ น้ำมนต์จันทรา นำไปเทลงบนแท่นบูชาในวิหารจมน้ำ ทางเหนือสุด ผ่านหุบผาที่มีซุ้มประตูหิน'],
          ],
          options: [{ label: 'รับน้ำมนต์จันทรา', fn: () => { g.audio.chime(); advance(6)(); } }],
        };
        default:
          if (this.done) return { lines: [[T, 'ฮึ่ม ฮึ่ม... ดวงจันทร์หายใจได้แล้ว เจ้าทำได้ดีนี่ ไอ้หนู']], options: [brew, shop, close] };
          if (this.stage >= 7 && this.lake < 3) return { lines: [
            [T, 'ฮึ่มม... อยากรู้ว่ามือพวกนั้นเป็นของใคร ก็ไปถามน้ำ น้ำจำทุกอย่าง'],
            [T, 'เมืองจมกลางทะเลสาบทางใต้นั่นเคยเป็นวังของมัน ภาพบนผนังวิหารยังอยู่ ถ้าเจ้ากล้าลุยน้ำไปดู'],
          ], options: [brew, shop, close] };
          return { lines: [[T, 'ฮึ่มม... ฝนตกดีนะคืนนี้ จะซื้ออะไรไหม?']], options: [brew, shop, close] };
      }
    }

    if (npc === 'smith') {
      const S = 'ลุงทั่ง ช่างตีเหล็ก';
      return {
        lines: [
          [S, 'อ้อ ผู้เดินทาง... ดาบเจ้าทื่อยังกับช้อนกินข้าว'],
          [S, 'เอาเขี้ยวหมาป่าเงา แร่เหล็กมืดจากหน้าผาทางเหนือ หรือของแปลก ๆ ที่เจ้าเจอมาให้ข้า แล้วข้าจะตีให้คมกริบ'],
        ],
        options: [
          { label: 'อัปเกรดอุปกรณ์', fn: () => g.openMenu('smith') },
          ...(this.lake >= 3 && !this.guardForged ? [{ label: 'หลอมดาบขององครักษ์เข้ากับดาบของข้า', fn: () => {
            this.guardForged = true;
            g.audio.forge?.(); g.audio.chime();
            g.ui.openDialogue({ lines: [[S, 'เหล็กของราชาหิน... ไม่ได้เห็นมานานแล้ว'], [S, 'เอ้า เสร็จแล้ว อาวุธของเจ้าแรงขึ้นอีกหนึ่งในสี่ ใช้ให้สมกับเจ้าของเดิมมันล่ะ']], options: [close] }, () => g.updateHud());
            g.save();
          } }] : []),
          close,
        ],
      };
    }

    // Min, the farm girl who sings in the corn (only by day); her father went to the big tree
    if (npc === 'min') {
      const M = 'มิ้น';
      if (this.farm === 0) return {
        lines: [
          [M, '♪ ข้าวโพดสูงเท่าพ่อ พ่อสูงเท่าฟ้า... ♪'],
          [M, 'อ้าว พี่! พี่มาจากรางรถไฟเหรอ พ่อหนูไปตัดข้าวที่ต้นไม้ใหญ่ทางตะวันตก แล้วมือก็กอดพ่อไว้ ไม่ยอมปล่อย'],
          [M, 'ตั้งแต่นั้นกังหันก็หมุนไม่ครบ ใบพัดหลุดไปอันนึง พ่อเก็บไว้ในโรงนา... พี่ช่วยติดคืนให้ได้ไหม'],
          [M, 'ถ้ากังหันหมุนครบ หุ่นฟางพวกนั้นจะหลับ พ่อเคยบอก'],
        ],
        options: [{ label: 'พี่จะช่วยเอง', fn: () => this.step('farm', 1) }, close],
      };
      if (this.farm === 4) return {
        lines: [
          [M, 'ตุ๊กตาหนู! พี่เจอที่ไหน... ในรังไหมเหรอ'],
          [M, 'แสดงว่าพ่อเคยถือมันไว้ตอนที่... (มิ้นกอดตุ๊กตาแน่น)'],
          [M, 'พี่ใส่หมวกเหมือนพ่อเลย... พี่ก็เคยโดนกอดใช่ไหม ถึงได้มาจากทางรถไฟ'],
          [M, 'เอานี่ไป พ่อบอกว่ามันคือนิ้วของดวงจันทร์ หล่นมาในไร่เราตอนที่มือคว้าพ่อไป'],
        ],
        options: [{ label: 'ขอบใจนะมิ้น', fn: () => this.step('farm', 5) }],
      };
      return { lines: [[M, this.done ? (this.hunt >= 3 ? 'ลมพัดมาจากทางตะวันตก... หนูได้ยินพ่อเรียกชื่อหนู ขอบคุณนะพี่' : '♪ ข้าวโพดสูงเท่าพ่อ... ♪') : 'กังหันหมุนครบแล้ว หุ่นฟางหลับหมดเลย พี่เก่งจัง']], options: [close] };
    }

    // the faceless ferryman at the end of the rotten pier
    if (npc === 'ferryman') {
      const F = 'คนแจวเรือไร้หน้า';
      if (this.lake === 0 && this.stage >= 7) return {
        lines: [
          [F, '...'],
          [F, 'ข้ารอพาคนข้ามมาสามร้อยปี ไม่มีใครกล้าข้ามแล้ว ตั้งแต่วังจมลงไปพร้อมเจ้าของมัน'],
          [F, 'เรือข้าผุไปนานแล้ว เดินไปเองเถอะ ทางหินยังอยู่ ตรงปลายท่านี่'],
          [F, 'ในวิหารใหญ่มีภาพสามภาพ ดูให้ครบ แล้วเจ้าจะรู้ว่ามือพวกนั้นเป็นของใคร... องครักษ์คนสุดท้ายยังเฝ้าอยู่ ระวังตัวด้วย'],
        ],
        options: [{ label: 'ข้าจะไปดู', fn: () => this.step('lake', 1) }, shop, close],
      };
      return { lines: [[F, this.done ? 'น้ำนิ่งแล้ว... เป็นครั้งแรกในสามร้อยปี' : '...ทางหินยังอยู่ ตรงปลายท่า']], options: [shop, close] };
    }

    if (npc === 'keeper') {
      const K = 'เทียนหลอม';
      const dn = g.dayNight;
      const sub = (lines) => () => g.ui.openDialogue({ lines, options: menu() }, () => g.updateHud());
      const menu = () => [
        {
          label: 'ดื่มเบียร์แสงเทียน (3 เหรียญ) — ฟื้นพลังเต็ม',
          fn: () => {
            if (g.coins < 3) { g.ui.toast('เหรียญไม่พอ...'); return; }
            g.coins -= 3; g.player.hp = g.player.maxHp; g.audio.drink(); g.ui.toast('ไขเทียนหยดลงในแก้ว... อุ่นไปทั้งตัว'); g.updateHud();
          },
          keepOpen: true,
        },
        {
          label: dn.isNight ? 'เช่าห้องนอนจนเช้า (5 เหรียญ)' : 'เช่าห้องนอนจนค่ำ (5 เหรียญ)',
          fn: () => {
            if (g.coins < 5) { g.ui.toast('เหรียญไม่พอ...'); return; }
            g.coins -= 5; g.updateHud();
            g.sleepUntil(dn.isNight ? 0.36 : 0.8);
          },
        },
        { label: 'เปิดร้าน (ซื้อ / ขายสมบัติ / กระเป๋าใหญ่)', fn: () => g.openMenu('shop') },
        { label: 'เปลี่ยนวิถี (เปลี่ยนสายอาชีพ)', fn: () => g.changeClassAtInn() },
        { label: 'ถามเรื่องปราสาทที่ลอยอยู่บนฟ้า', keepOpen: true, fn: sub([
          [K, 'อา... ปราสาทแขวนฟ้า เมื่อก่อนมันตั้งอยู่บนพื้นดินเหมือนบ้านทั่วไป'],
          [K, 'จนคืนที่ดวงจันทร์ล้มป่วย แผ่นดินใต้ปราสาทก็ลอยขึ้นไปทั้งก้อน โซ่เหล็กพวกนั้นคือสิ่งเดียวที่ไม่ให้มันลอยหายไปในวังวนบนฟ้า'],
          [K, 'บางคืนยังเห็นไฟในหน้าต่าง... ทั้งที่ไม่มีใครขึ้นไปได้มาร้อยปีแล้ว'],
        ]) },
        { label: 'ถามเรื่องหัวหินยักษ์ทางตะวันตก', keepOpen: true, fn: sub([
          [K, 'ราชาหินผู้หลับใหล... เขาว่ากันว่าร่างของพระองค์ทั้งร่างฝังอยู่ใต้ป่าตะวันตก'],
          [K, 'หัวที่เจ้าเห็นคือส่วนเดียวที่โผล่พ้นดิน มือข้างหนึ่งก็ยังตะกายออกมาไม่สำเร็จ'],
          [K, 'อย่าปลุกพระองค์เชียวล่ะ ไอ้หนู... ไฟในกระถางที่หน้าพระพักตร์ต้องไม่มีวันดับ'],
        ]) },
        ...(this.stage >= 7 ? [{ label: 'ถามเรื่องเสียงระฆังบนเขา', keepOpen: true, fn: sub([
          [K, 'ทุกคืนที่จันทร์ซีดลง ระฆังบนยอดเขาเหนือจะดังเอง... ทั้งที่คนตีระฆังตายไปสามสิบปีแล้ว'],
          [K, 'เขาฝังอยู่ในสุสานข้างหอ ใครขึ้นไปบนหอก็ไม่ค่อยได้กลับลงมา... มีชุดเกราะเดินเวรอยู่แถวนั้น'],
          [K, 'ถ้าเจ้าจะไป เดินถนนสายเหนือไปจนสุด แล้วอย่าลืมว่าเกราะพวกนั้นไม่กลัวดาบเบา ๆ'],
        ]) }] : []),
        ...(this.done ? [{ label: 'ถามเรื่องรังไหมบนต้นไม้', keepOpen: true, fn: sub([
          [K, 'เจ้ารู้ไหมว่ารังไหมบนต้นไม้นั่นมีกี่ใบ? ข้านับทุกคืน'],
          [K, 'คืนที่เจ้ามาถึงหมู่บ้านนี้ ข้านับได้น้อยกว่าเมื่อวานหนึ่งใบ...'],
          [K, 'และเมื่อคืน ข้าเห็นโซ่เส้นหนึ่งของปราสาทแขวนฟ้าขาด ราชาหินกำลังจะตื่น ไอ้หนู'],
        ]) }] : []),
        { label: 'ถามเรื่องกระดูกยักษ์ในบึง', keepOpen: true, fn: sub([
          [K, 'ซี่โครงที่รางรถไฟลอดผ่านน่ะหรือ? คนสร้างทางรถไฟเจอมันตอนขุดดิน'],
          [K, 'พวกเขาวางรางผ่านกลางอกมันไปดื้อ ๆ ... หลังจากนั้นไม่นาน รถไฟก็ไม่เคยวิ่งอีกเลย'],
        ]) },
        { label: 'ลาก่อน', fn: () => {} },
      ];
      return {
        lines: [
          [K, 'ยินดีต้อนรับสู่โรงเตี๊ยมเทียนหลอม ผู้เดินทาง... ระวังไขเทียนหยดใส่หน่อยนะ'],
          [K, dn.isNight ? 'คืนนี้ข้างนอกมีแต่วิญญาณบึง นั่งพักให้อุ่นก่อนเถอะ' : 'กลางวันที่นี่ไม่เคยสว่างหรอก... ดวงอาทิตย์ลืมทางมาบึงนี้ไปนานแล้ว'],
        ],
        options: menu(),
      };
    }

    if (npc === 'altar') {
      if (this.stage === 6) return {
        lines: [['', 'แท่นบูชาโบราณ มีร่องรูปพระจันทร์เสี้ยวที่แห้งเหือด...']],
        options: [{ label: 'เทน้ำมนต์จันทรา', fn: () => this.vision() }, { label: 'ยังก่อน', fn: () => {} }],
      };
      return {
        lines: [['', this.stage >= 7 ? 'น้ำมนต์จันทราเรืองแสงอยู่ในร่องของแท่นบูชา ในแสงนั้นยังเห็นเงาของมือนับร้อยอยู่รำไร' : 'แท่นบูชาโบราณ มีร่องรูปพระจันทร์เสี้ยวที่แห้งเหือด... บางทีอาจต้องใช้อะไรบางอย่าง']],
        options: [close],
      };
    }
    return { lines: [], options: [close] };
  }

  // the altar's vision: the moon is not sick, it is held
  vision() {
    const g = this.g, N = '';
    g.audio.chime();
    g.ui.openDialogue({ lines: [
      [N, 'แสงจันทร์ไหลลงร่องแท่นบูชา... แล้วเจ้าก็เห็นมัน'],
      [N, 'มือนับร้อยโผล่จากเงาของต้นไม้ยักษ์ทางตะวันตก กำแสงของดวงจันทร์ไว้แน่นจนนิ้วซีด'],
      [N, 'สี่นิ้วที่กำแน่นที่สุดชี้ไปสี่ทาง: เหนือ ตะวันออก ใต้ และ... ตรงที่เจ้ายืนอยู่'],
      [N, 'เสียงหนึ่งกระซิบจากใต้น้ำ: "ไปหาข้อนิ้วของข้า... แล้วแบมือของมันออก"'],
      [N, 'นิ้วที่ชี้มาที่เจ้าคลายออกเอง ราวกับมันจำเจ้าได้'],
    ], options: [{ label: 'ต่อไป', fn: () => {
      this.stage = 7;
      g.onQuestChanged();
      g.ui.banner('ข้อนิ้วของดวงจันทร์ 1/4', 'นิ้วแห่งบึงคลายออก · เหนือ ตะวันออก ใต้ รอเจ้าอยู่');
      g.audio.discover();
    } }] }, () => g.updateHud());
  }

  onSheepFound(i) {
    if (this.stage !== 1 || this.sheepFound[i]) return false;
    this.sheepFound[i] = true;
    if (this.sheepCount >= 3) this.stage = 2;
    this.g.onQuestChanged();
    return true;
  }

  onWispKilled() {
    if (this.stage !== 4) return;
    this.essence++;
    this.g.ui.toast(`แก่นวิญญาณบึง ${this.essence}/${ESSENCE_GOAL}`);
    if (this.essence >= ESSENCE_GOAL) this.stage = 5;
    this.g.onQuestChanged();
  }
}

