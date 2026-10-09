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
import { L } from './i18n.js';

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
      case 0: return { title: L('เสียงกาในทุ่ง', 'A Crow\'s Cry in the Field'), text: L('เดินตามรางรถไฟเก่าขึ้นไปทางเหนือ ตามหาผู้เลี้ยงแกะบนเนินจันทร์', 'Follow the old railway north and find the shepherd on Moon Hill') };
      case 1: return { title: L('แกะดำที่หลงทาง', 'The Lost Black Sheep'), text: L(`ตามหาแกะดำที่หลงทาง (${this.sheepCount}/3)`, `Find the lost black sheep (${this.sheepCount}/3)`) };
      case 2: return { title: L('แกะดำที่หลงทาง', 'The Lost Black Sheep'), text: L('กลับไปหาโกวัก ผู้เลี้ยงแกะ', 'Return to Kowak the Shepherd') };
      case 3: return { title: L('ยายคางคกใต้เห็ดยักษ์', 'Granny Toad Beneath the Giant Mushroom'), text: L('ไปพบยายคางคกใต้เห็ดยักษ์ในป่าทางตะวันตก', 'Seek Granny Toad beneath the Giant Mushroom in the western woods') };
      case 4: return { title: L('ดวงไฟแห่งบึง', 'Lights of the Marsh'), text: L(`ฟันวิญญาณบึงแล้วเก็บแก่นวิญญาณ (${this.essence}/${ESSENCE_GOAL})`, `Cut down Marsh Wisps and gather their essence (${this.essence}/${ESSENCE_GOAL})`) + (this.g.dayNight.isNight ? '' : L(' — วิญญาณออกมาเฉพาะกลางคืน (พักที่โรงเตี๊ยมได้)', ' — wisps come out only at night (you can rest at the inn)')) };
      case 5: return { title: L('ดวงไฟแห่งบึง', 'Lights of the Marsh'), text: L('นำแก่นวิญญาณกลับไปให้ยายคางคก', 'Bring the wisp essence back to Granny Toad') };
      case 6: return { title: L('วิหารจมน้ำ', 'The Drowned Temple'), text: L('ผ่านหุบผาซุ้มประตูหินทางเหนือ เทน้ำมนต์จันทราลงบนแท่นบูชา', 'Pass through Archway Gorge to the north and pour the moon water on the altar') };
      case 7: return { title: L(`มือที่กอดดวงจันทร์ — ข้อนิ้ว ${this.fingers.length}/4`, `The Hands That Hold the Moon — Fingers ${this.fingers.length}/4`), text: this.steps().map((x) => x.text).join(' · ') };
      default: return { title: L('บทที่ 1 จบแล้ว', 'Chapter 1 Complete'), text: L('ดวงจันทร์ได้หายใจอีกครั้ง · ท่องไปในบึงจันทราได้อย่างอิสระ', 'The moon breathes again · Wander the Moonmire as you will') };
    }
  }

  // what each open act asks for next: [{ act, text, at: {x,z}, label }]
  steps() {
    const S = this.spots, out = [], night = this.g.dayNight.isNight;
    if (this.huntOpen && this.hunt < 3) {
      out.push([
        { text: L('ตะวันตก: ไปเพิงนายพรานที่หายไป หาสมุดของเขา', 'West: go to the Lost Hunter\'s Camp and find his journal'), at: S.journal, label: L('เพิงนายพราน', 'Hunter\'s Camp') },
        { text: L('ตะวันตก: ล้มนายพรานโอเรนที่เฝ้าทางเข้าป่า', 'West: defeat Oren the Hunter, who guards the way into the wood'), at: S.oren, label: L('โอเรน', 'Oren') },
        { text: L('ตะวันตก: ต้นไม้แขวนคอ — โค่นราชันร้อยกร', 'West: the Hanging Tree — fell the King of a Hundred Hands'), at: { x: HANGTREE.x + 13, z: HANGTREE.z + 7 }, label: L('ราชันร้อยกร', 'The King of a Hundred Hands') },
      ][this.hunt]);
    }
    if (this.bell < 4) {
      out.push([
        { text: L('เหนือ: หาหลุมศพคนตีระฆังข้างหอระฆัง', 'North: find the bell-ringer\'s grave by the bell tower'), at: S.grave, label: L('หลุมศพ', 'Grave') },
        { text: L('เหนือ: ปีนหอระฆังแล้วตีระฆัง', 'North: climb the bell tower and ring the bell'), at: S.bell, label: L('ระฆัง', 'Bell') },
        { text: L('เหนือ: วางสมุดบันทึกบนแท่นที่ลานหินตั้ง', 'North: lay the journal on the altar at the Standing Stones'), at: S.stones, label: L('ลานหินตั้ง', 'Standing Stones') },
        { text: L('เหนือ: ล้มชุดเกราะที่ตื่นขึ้นที่ลานหินตั้ง', 'North: defeat the armour that wakes at the Standing Stones'), at: S.stones, label: L('ชุดเกราะ', 'Empty Armour') },
      ][this.bell]);
    }
    if (this.farm < 5) {
      out.push([
        { text: L(`ตะวันออก: ตามเสียงเพลงในไร่ข้าวโพด${night ? ' (มีแค่ตอนกลางวัน)' : ''}`, `East: follow the singing in the cornfield${night ? ' (by day only)' : ''}`), at: S.min, label: L('ไร่ข้าวโพด', 'Cornfield') },
        { text: L('ตะวันออก: หาใบพัดที่หายไปในโรงนา', 'East: find the missing sail in the barn'), at: S.sail, label: L('โรงนา', 'Barn') },
        { text: L('ตะวันออก: นำใบพัดไปติดคืนที่กังหันลม', 'East: fix the sail back onto the windmill'), at: S.millDoor, label: L('กังหันลม', 'Windmill') },
        { text: L('ตะวันออก: หาตุ๊กตาของมิ้นในรังไหมใต้กังหัน', 'East: find Min\'s doll in the cocoon beneath the windmill'), at: S.cocoon, label: L('รังไหม', 'Cocoon') },
        { text: L(`ตะวันออก: นำตุ๊กตาไปคืนมิ้น${night ? ' (กลางวัน)' : ''}`, `East: bring the doll back to Min${night ? ' (by day)' : ''}`), at: S.min, label: L('มิ้น', 'Min') },
      ][this.farm]);
    }
    if (this.lake < 3) {
      const left = this.murals.filter((m) => !m).length;
      out.push([
        { text: L('ใต้: ไปท่าเรือผุ คุยกับคนแจวเรือ', 'South: go to the Rotting Pier and speak with the ferryman'), at: S.ferryman, label: L('คนแจวเรือ', 'Ferryman') },
        { text: L(`ใต้: ดูภาพบนผนังมหาวิหารจม (เหลือ ${left})`, `South: study the murals in the sunken cathedral (${left} left)`), at: S.murals[this.murals.findIndex((m) => !m)] || S.dais, label: L('ภาพผนัง', 'Mural') },
        { text: L('ใต้: ล้มองครักษ์คนสุดท้ายบนแท่นพิธี', 'South: defeat the Last Guard on the dais'), at: S.dais, label: L('องครักษ์', 'The Last Guard') },
      ][this.lake]);
    }
    if (!this.huntOpen) out.push({ text: L(`ได้ข้อนิ้ว 3 ชิ้นแล้วทางตะวันตกจะเปิด (${this.fingers.length}/3)`, `With 3 fingers, the way west will open (${this.fingers.length}/3)`) });
    return out.filter(Boolean);
  }

  markers() {
    const crow = this.g.npcs.crow.pos, toad = this.g.npcs.toad.pos, altar = this.g.altar;
    switch (this.stage) {
      case 0: case 2: return [{ x: crow.x, z: crow.z, label: L('โกวัก', 'Kowak') }];
      case 1: return LOST_SHEEP.filter((_, i) => !this.sheepFound[i]).map(([x, z]) => ({ x, z, label: L('แกะ', 'Sheep') }));
      case 3: case 5: return [{ x: toad.x, z: toad.z, label: L('ยายคางคก', 'Granny Toad') }];
      case 4: {
        const w = this.g.combat.nearest('wisp', this.g.player.pos);
        return w ? [{ x: w.pos.x, z: w.pos.z, label: L('วิญญาณ', 'Wisp') }] : [];
      }
      case 6: return [{ x: altar.x, z: altar.z, label: L('แท่นบูชา', 'Altar') }];
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
    if (this.bell === 0) add('story:grave', S.grave, L('อ่านหลุมศพคนตีระฆัง', 'Read the bell-ringer\'s grave'));
    if (this.bell === 1) add('story:bell', S.bell, L('ตีระฆัง', 'Ring the bell'), 3.5);
    if (this.bell === 2) add('story:stones', S.stones, L('วางสมุดบันทึกบนแท่นบูชา', 'Lay the journal on the altar'));
    if (this.farm === 0 || this.farm === 4) add(day ? 'min' : 'story:haystack', S.min, day ? L('คุยกับเด็กผู้หญิงบนกองฟาง', 'Talk to the girl on the haystack') : L('ตรวจดูกองฟาง', 'Examine the haystack'));
    if (this.farm === 1) add('story:sail', S.sail, L('หยิบใบพัดกังหัน', 'Take the windmill sail'));
    if (this.farm === 2) add('story:mill', S.millDoor, L('ติดใบพัดคืนให้กังหันลม', 'Fix the sail back onto the windmill'), 4);
    if (this.farm === 3) add('story:cocoon', S.cocoon, L('แกะรังไหมที่ร่วงอยู่', 'Open the fallen cocoon'));
    if (this.farm >= 5 && day) add('min', S.min, L('คุยกับมิ้น', 'Talk to Min'));
    add('ferryman', S.ferryman, L('คุยกับคนแจวเรือ', 'Talk to the ferryman'), 3.2);
    if (this.lake === 1) S.murals.forEach((m, i) => { if (!this.murals[i]) add(`story:mural${i}`, m, L('ดูภาพบนผนัง', 'Study the mural'), 3.5); });
    if (this.huntOpen && this.hunt === 0) add('story:journal', S.journal, L('อ่านสมุดของนายพราน', 'Read the hunter\'s journal'));
    return out;
  }

  // a story place examined: [[speaker, text]...] and what happens
  inspect(id) {
    const g = this.g, N = '';
    const say = (lines, then) => g.ui.openDialogue({ lines, options: [{ label: L('ต่อไป', 'Continue'), fn: then || (() => {}) }] }, () => g.updateHud());
    switch (id) {
      case 'story:grave': return say([
        [N, L('หลุมศพที่สูงกว่าหลุมอื่น ป้ายสลักว่า "ผู้ตีระฆังคนสุดท้าย"', 'A grave raised higher than the rest. The stone reads "The Last Bell-Ringer".')],
        [N, L('เทียนเล่มหนึ่งยังลุกอยู่ ทั้งที่ไม่มีใครมาจุด... ใต้เทียนมีสมุดหนังเก่าห่อผ้าน้ำมันไว้', 'A single candle still burns, though no one comes to light it... Beneath it lies an old leather journal, wrapped in oilcloth.')],
        [N, L('"...ระฆังดังเพื่อไล่มือ มือกลัวเสียงระฆัง ตราบที่ข้ายังตีทุกคืน มือจะไม่ลงจากเขา..."', '"...The bell rings to drive back the hands. The hands fear its voice. So long as I ring it every night, they will not come down from the mountain..."')],
        [N, L('"...ถ้าข้าไม่อยู่แล้ว จงนำบันทึกนี้ไปวางที่แท่นหินตั้ง ให้ลมจำเสียงระฆังไว้แทนข้า"', '"...When I am gone, lay this journal upon the altar of the standing stones, that the wind may remember the bell in my stead."')],
      ], () => this.step('bell', 1, L('ได้สมุดบันทึกคนตีระฆัง', 'Obtained the Bell-Ringer\'s Journal')));
      case 'story:bell': return this.ringBell();
      case 'story:stones': return say([
        [N, L('เจ้าวางสมุดบันทึกลงบนแท่นหิน อักษรบนแท่นสว่างขึ้นทีละตัว ลมหนาวหมุนวนรอบลานหิน', 'You lay the journal upon the stone. One by one, the letters carved there begin to glow, and the cold wind circles the stones.')],
        [N, L('แล้วเสียงเหล็กกระทบกันก็ดังขึ้นจากเงาของหินตั้ง... เกราะสองชุดลุกขึ้นยืน', 'Then iron grinds on iron in the shadow of the stones... Two suits of armour rise to their feet.')],
      ], () => { this.step('bell', 3); this.spawnStory('stones'); });
      case 'story:haystack': return say([[N, L('กองฟางเปียกน้ำค้าง... มีรอยคนนั่งอยู่ ตอนกลางวันอาจมีใครมานั่งร้องเพลงที่นี่', 'A haystack wet with dew... someone has sat here. Perhaps by day, someone comes to sing.')]]);
      case 'story:sail': return say([
        [N, L('ใบพัดกังหันอันหนึ่งพิงอยู่ในโรงนา ผ้าใบยังดีอยู่ แค่หลุดออกจากแกน', 'A windmill sail leans against the barn wall. The canvas is still sound; it only came loose from the hub.')],
      ], () => { this.step('farm', 2, L('ได้ใบพัดกังหัน', 'Obtained the Windmill Sail')); g.fx.story?.sail && (g.fx.story.sail.visible = false); });
      case 'story:mill': return say([
        [N, L('เจ้าปีนขึ้นไปผูกใบพัดเข้ากับแกน... ลมพัดมาพอดี กังหันหมุนครบสามใบเป็นครั้งแรกในรอบหลายปี', 'You climb up and lash the sail to the hub... The wind comes just then, and for the first time in years the mill turns on all three sails.')],
        [N, L('ทั่วทั้งไร่ หุ่นฟางทุกตัวล้มลงเป็นกองฟางเงียบ ๆ', 'Across the whole farm, every strawman slumps into a quiet heap of straw.')],
      ], () => { g.fx.windmill?.addSail(); this.strawFall(); this.step('farm', 3); });
      case 'story:cocoon': return say([
        [N, L('รังไหมที่ร่วงลงมาจากที่ไหนสักแห่ง เจ้ากรีดมันออก... ข้างในว่างเปล่า มีแค่ตุ๊กตาฟางตัวเล็ก ๆ ผูกริบบิ้นแดง', 'A cocoon, fallen from somewhere above. You cut it open... It is empty, save for a little straw doll tied with a red ribbon.')],
      ], () => { this.step('farm', 4, L('ได้ตุ๊กตาฟาง', 'Obtained the Straw Doll')); g.fx.story?.cocoon && (g.fx.story.cocoon.visible = false); });
      case 'story:journal': return say([
        [N, L('สมุดของนายพรานโอเรน ลายมือหวัดขึ้นเรื่อย ๆ ทุกหน้า', 'The journal of Oren the Hunter. With every page, the hand grows more ragged.')],
        [N, L('"ทางเข้าลานต้นไม้อยู่ทางตะวันออกของมัน เดินตามถนนไปแล้วอย่าออกนอกทาง"', '"The way into the tree\'s clearing lies on its east side. Keep to the road. Do not stray."')],
        [N, L('"มันไม่ได้หลับ มันรอ อย่ายืนนิ่งตอนดินสั่น อย่ายืนในวงแดง"', '"It does not sleep. It waits. Do not stand still when the earth shakes. Do not stand in the red circle."')],
        [N, L('"ข้าจำชื่อลูกสาวไม่ได้แล้ว... ข้าจำชื่อตัวเองไม่ได้แล้ว..." (หน้าสุดท้ายว่างเปล่า)', '"I can no longer remember my daughter\'s name... I can no longer remember my own..." (The last page is blank.)')],
      ], () => { this.step('hunt', 1); this.spawnStory('oren'); });
      default:
        if (id.startsWith('story:mural')) return this.mural(+id.slice(11));
    }
  }

  mural(i) {
    const g = this.g, N = '';
    const text = [
      [[N, L('ภาพแรก: ชายชราสวมมงกุฎหินนั่งบนบัลลังก์ แบมือทั้งสองข้างออกให้เด็กชายตัวเล็ก ๆ ดู', 'The first mural: an old man in a crown of stone sits upon a throne, opening both his hands to show a small boy.')], [N, L('ใต้ภาพสลักว่า "กษัตริย์ต้องรู้จักแบมือ"', 'Carved beneath: "A king must know how to open his hand."')]],
      [[N, L('ภาพที่สอง: เด็กชายคนเดิมโตขึ้น สวมมงกุฎหนามที่ทำจากกิ่งไม้ดำ กำมือแน่นจนเลือดไหล', 'The second mural: the same boy, grown, wearing a crown of thorns made from black branches, his fists clenched until they bleed.')], [N, L('ข้างหลังเขามีชายชรากลายเป็นหินทีละน้อย', 'Behind him, the old man is turning slowly to stone.')]],
      [[N, L('ภาพสุดท้าย: แขนนับสิบงอกออกจากอกของเจ้าชาย คว้าทุกสิ่งรอบตัว คน ม้า ดวงดาว และดวงจันทร์', 'The last mural: dozens of arms sprout from the prince\'s chest, seizing all around him — people, horses, stars, and the moon.')], [N, L('ชื่อที่สลักไว้ใต้ภาพถูกขูดทิ้ง เหลือแค่คำว่า "อาวร"', 'The name carved beneath has been scratched away. Only one word remains: "Avorn".')]],
    ][i];
    g.ui.openDialogue({ lines: text, options: [{ label: L('ต่อไป', 'Continue'), fn: () => {
      this.murals[i] = true;
      g.gainXP(120);
      if (this.murals.every(Boolean)) {
        g.ui.combatText(L('เสียงเหล็กดังขึ้นจากแท่นพิธี...', 'Iron stirs upon the dais...'), 'bad');
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
    const finger = { bell: L('นิ้วแห่งลม', 'The Finger of Wind'), farm: L('นิ้วแห่งรวงข้าว', 'The Finger of Grain'), lake: L('นิ้วแห่งน้ำ', 'The Finger of Water') }[act];
    g.gainXP(600);
    g.ui.banner(L(`ข้อนิ้วของดวงจันทร์ ${this.fingers.length}/4`, `Fingers of the Moon ${this.fingers.length}/4`), L(`${finger} คลายออกแล้ว`, `${finger} has loosened its grip`));
    g.audio.discover();
    const give = (id, n = 1) => { const left = g.bag.add(id, n); if (left) g.loot.dropNearPlayer(id, left); };
    if (act === 'bell') { give('small_bell'); setTimeout(() => g.ui.toast(L('ได้ลิ้นระฆังเล็ก — ใช้จากกระเป๋า ทำให้ผู้หลงทางหยุดนิ่ง', 'Obtained the Little Bell — use it from your bag to hold the Lost still')), 1500); }
    if (act === 'farm') {
      give('tonic', 2);
      if (g.gear.cloak < 4) { g.gear.cloak++; g.onGearChanged?.(); setTimeout(() => g.ui.toast(L('ฟางสาปเสริมผ้าคลุมให้หนาขึ้น 1 ขั้น', 'Cursed straw thickens your cloak by 1 tier')), 1500); }
    }
    if (act === 'lake') setTimeout(() => g.ui.toast(L('ได้ดาบขององครักษ์ — นำไปให้ลุงทั่งหลอมเข้ากับดาบของเจ้า', 'Obtained the Guard\'s Sword — take it to Old Anvil to forge into your own blade')), 1500);
    if (this.huntOpen && this.hunt === 0) setTimeout(() => g.ui.banner(L('ทางตะวันตกเปิดแล้ว', 'The Way West Opens'), L('ไปเพิงนายพรานที่หายไป', 'Go to the Lost Hunter\'s Camp')), 4200);
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
      ['', L('เสียงระฆังดังกังวานไปทั่วที่ราบสูง... นานจนเจ้าคิดว่ามันจะไม่มีวันหยุด', 'The bell\'s voice rolls out across the highlands... so long that you think it will never stop.')],
      ['', n ? L(`ไกลออกไป ร่างของผู้หลงทาง ${n} ร่างทรุดลงคุกเข่า หันหน้ามาทางหอระฆัง`, `Far off, ${n} of the Lost sink to their knees, faces turned toward the bell tower.`) : L('ลมหนาวหยุดพัดชั่วขณะ เหมือนทั้งโลกกำลังฟัง', 'For a moment the cold wind stills, as though the whole world is listening.')],
      ['', L('ในสมุดบันทึก มีหน้าหนึ่งเขียนว่า "ลานหินตั้งทางตะวันตก" — ที่ที่ลมจะจำเสียงระฆังไว้', 'One page of the journal reads "the standing stones to the west" — where the wind will remember the bell.')],
    ], options: [{ label: L('ต่อไป', 'Continue'), fn: () => this.step('bell', 2) }] }, () => g.updateHud());
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
    if (kind === 'guard') make('armour', S.dais, { name: L('องครักษ์คนสุดท้าย', 'The Last Guard'), hp: 20, damage: 28, coins: [40, 60], scale: 1.15 }, 'guard');
    if (kind === 'oren') {
      // one of the Lost in all but looks: he still wears his hunting coat, hat and mask
      const e = make('hollow', S.oren, { name: L('นายพรานโอเรน', 'Oren the Hunter'), hp: 14, damage: 18, speed: 2.8, coins: [30, 45] }, 'oren');
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
        [L('นายพรานโอเรน', 'Oren the Hunter'), L('...โอเรน... ชื่อข้า... โอเรน', '...Oren... my name... is Oren.')],
        [L('นายพรานโอเรน', 'Oren the Hunter'), L('ลูกข้าชื่อ... มิ้น... เธอรออยู่ที่ไร่... บอกเธอว่าพ่อขอโทษ', 'My girl\'s name... Min... she waits at the farm... Tell her... her father is sorry.')],
        ['', L('ร่างของเขาสลายเป็นฝุ่น เหลือเชือกเส้นหนึ่งที่ถักจากผมคนไว้ในมือ — เชือกตัดรังไหม', 'His body crumbles to dust, leaving in his hand a cord braided from human hair — the Cocoon-Cutting Cord.')],
      ], options: [{ label: L('ต่อไป', 'Continue'), fn: () => { this.step('hunt', 2, L('ได้เชือกตัดรังไหม', 'Obtained the Cocoon-Cutting Cord')); g.ui.banner(L('ราชันร้อยกร', 'The King of a Hundred Hands'), L('รอเจ้าอยู่ที่ต้นไม้แขวนคอ', 'awaits you at the Hanging Tree')); } }] }, () => g.updateHud());
    }
  }

  // the little bell from the north: the Lost freeze; the King flinches, once a fight
  useSpecial(kind) {
    const g = this.g, p = g.player;
    if (kind !== 'bell') return false;
    if (g.time < this.bellReadyAt) { g.ui.toast(L(`ลิ้นระฆังยังสั่นอยู่ (${Math.ceil(this.bellReadyAt - g.time)} วินาที)`, `The little bell still trembles (${Math.ceil(this.bellReadyAt - g.time)}s)`)); return false; }
    this.bellReadyAt = g.time + 90;
    g.audio.metal({ freq: 880, dur: 2.5, gain: 0.12, partials: [1, 2.0, 3.01], verb: 0.8 });
    let n = 0;
    for (const e of g.combat.enemies) {
      if (!e.alive || e.state === 'dying') continue;
      const d = e.pos.distanceTo(p.pos);
      if (e.type === 'hollow' && d < 25) { e.state = 'stagger'; e.t = Math.max(e.t, 4); n++; }
      if (e.type === 'handking' && d < 35 && e.ai && e.ai.mode === 'fight' && !e.ai.belled) {
        e.ai.belled = true; e.ai.atk = null; e.ai.cd = 2.5; e.weakT = 2.5; n++;
        g.ui.combatText(L('ราชันร้อยกรชะงัก!', 'The King of a Hundred Hands falters!'), 'parry');
      }
    }
    g.ui.toast(n ? L(`เสียงระฆังเล็ก — ${n} ร่างหยุดนิ่ง`, `The little bell rings — ${n} held still`) : L('เสียงระฆังเล็กดังกังวาน...', 'The little bell rings out...'));
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
    const close = { label: L('ลาก่อน', 'Farewell'), fn: () => {} };
    const brew = { label: L('ปรุงยา (หม้อต้มยา)', 'Brew (cauldron)'), fn: () => g.openMenu('alchemy') };
    const shop = {
      label: L(`ซื้อยาฟื้นพลัง (${POTION_PRICE} เหรียญ)`, `Buy a Healing Draught (${POTION_PRICE} coins)`),
      fn: () => {
        if (g.coins < POTION_PRICE) g.ui.toast(L('เหรียญไม่พอ...', 'Not enough coins...'));
        else if (!g.bag.canAdd('potion')) g.ui.toast(L('กระเป๋าเต็ม — จัดกระเป๋าก่อน [I]', 'Your bag is full — make room first [I]'));
        else { g.coins -= POTION_PRICE; g.bag.add('potion'); g.audio.coin(); g.ui.toast(L('ได้รับยาฟื้นพลัง ×1  [Q] เพื่อดื่ม', 'Received Healing Draught ×1  [Q] to drink')); }
        g.updateHud();
      },
      keepOpen: true,
    };

    if (npc === 'crow') {
      const C = L('โกวัก ผู้เลี้ยงแกะ', 'Kowak the Shepherd');
      switch (this.stage) {
        case 0: return {
          lines: [
            [C, L('กา... ผู้เดินทางที่เดินลุยบึงมาตามรางเหล็กเก่าสินะ', 'Caw... A traveller, wading the marsh along the old iron rails, eh.')],
            [C, L('ข้าคือโกวัก ผู้เลี้ยงแกะแห่งเนินจันทร์ ฝูงแกะดำของข้ากินหญ้าใต้แสงจันทร์มาเป็นร้อยปี', 'I am Kowak, shepherd of Moon Hill. My black flock has grazed beneath the moon these hundred years.')],
            [C, L('แต่คืนนี้หมอกจากบึงพาลูกแกะของข้าไปสามตัว... ดวงไฟผีมันล่อพวกมันไป', 'But tonight the marsh fog took three of my lambs... The ghost-lights lured them off.')],
            [C, L('ข้าออกจากรั้วนี้ไม่ได้ ไม่เช่นนั้นฝูงที่เหลือจะแตกกระเจิง เจ้าช่วยตามหาพวกมันได้ไหม?', 'I cannot leave this fence, or the rest will scatter. Will you find them for me?')],
          ],
          options: [{ label: L('ข้าจะช่วยตามหาให้', 'I will find them'), fn: advance(1) }, { label: L('ไว้ทีหลัง', 'Later'), fn: () => {} }],
        };
        case 1: return {
          lines: [[C, L(`ยังขาดอีก ${3 - this.sheepCount} ตัว... ลองฟังเสียงร้องของพวกมันดู ในบึงทางใต้ ในป่าทางตะวันตก และที่เชิงหุบผาทางเหนือ`, `Still ${3 - this.sheepCount} missing... Listen for their bleating. In the marsh to the south, the woods to the west, and at the foot of the gorge to the north.`)]],
          options: [close],
        };
        case 2: return {
          lines: [
            [C, L('กา! กา! พวกมันกลับมาครบแล้ว!', 'Caw! Caw! They\'re all back!')],
            [C, L('รับนี่ไป... เหรียญทองจากยุคที่รางเหล็กยังมีรถไฟวิ่งผ่าน', 'Take this... Gold from the days when trains still ran these rails.')],
            [C, L('และฟังข้าให้ดี ดวงจันทร์คืนนี้ป่วยไข้ แสงของมันจึงเป็นสีฟ้าเย็นเยียบเช่นนี้', 'And mark me well. The moon is sick tonight. That is why its light runs so cold and blue.')],
            [C, L('ไปหายายคางคกใต้เห็ดยักษ์ทางตะวันตก นางรู้วิธีปลุกวิหารจมน้ำ', 'Go to Granny Toad, beneath the Giant Mushroom to the west. She knows how to wake the Drowned Temple.')],
          ],
          options: [{ label: L('ขอบคุณ ข้าจะไปหานาง', 'Thank you. I will go to her'), fn: () => { g.addCoins(30); advance(3)(); } }],
        };
        default:
          if (this.done) return { lines: [[C, L('ดวงจันทร์หายใจได้อีกครั้ง... ฝูงแกะของข้าหลับสบายแล้ว ขอบใจเจ้า ผู้เดินทาง', 'The moon breathes again... My flock sleeps sound. My thanks, traveller.')]], options: [close] };
          if (this.stage >= 7 && this.farm < 5) return { lines: [
            [C, L('กา... เจ้าเห็นมือพวกนั้นแล้วสินะ ข้าเห็นมันในฝันทุกคืนที่จันทร์ซีด', 'Caw... So you\'ve seen the hands. I see them in my dreams, every night the moon runs pale.')],
            [C, L('ข้าวโพดทางตะวันออกไม่มีใครเก็บมาหลายปีแล้ว แต่ข้ายังได้ยินเสียงเด็กร้องเพลงอยู่ในไร่ทุกเช้า', 'No one has harvested the corn to the east in years. Yet every morning I still hear a child singing in that field.')],
            [C, L('ถ้าจะไปก็ไปตอนกลางวัน ตอนกลางคืนหุ่นฟางพวกนั้นไม่ใช่หุ่นฟางอีกแล้ว', 'If you go, go by day. At night those strawmen are strawmen no longer.')],
          ], options: [close] };
          return { lines: [[C, L('ขอให้แสงจันทร์นำทางเจ้า ผู้เดินทาง', 'May the moonlight guide you, traveller.')]], options: [close] };
      }
    }

    if (npc === 'toad') {
      const T = L('ยายคางคก', 'Granny Toad');
      switch (this.stage) {
        case 3: return {
          lines: [
            [T, L('ฮึ่มม... ฝนตกดีจริงคืนนี้ โกวักส่งเจ้ามาสินะ', 'Hrrm... Lovely rain tonight. Kowak sent you, did he? Heh heh.')],
            [T, L('วิหารจมน้ำหลับใหลมาตั้งแต่ดวงจันทร์ป่วย มีเพียงน้ำมนต์จันทราที่จะปลุกมันได้', 'The Drowned Temple has slept since the moon fell sick. Only moon water can wake it.')],
            [T, L('ข้าต้มให้ได้ แต่ต้องใช้แก่นวิญญาณบึงห้าดวง ไปฟันดวงไฟลอยในบึงมาให้ข้า', 'I can brew it, but I need five Marsh Wisp essences. Go cut down the floating lights in the marsh for me.')],
            [T, L('ระวังตัวด้วยล่ะ พวกมันกัดเจ็บนะ ไอ้หนู... ถ้าบาดเจ็บก็มาซื้อยาจากข้าได้', 'Mind yourself, dearie, they bite... Heh heh. If you get hurt, come buy a draught from me.')],
          ],
          options: [{ label: L('ข้าจะไปล่าดวงไฟ', 'I will hunt the lights'), fn: advance(4) }, brew, shop],
        };
        case 4: return {
          lines: [[T, L(`ยังได้แค่ ${this.essence} ดวง ต้องการห้าดวงนะ... ดวงไฟชอบลอยอยู่แถวบึงทางใต้`, `Only ${this.essence} so far. I need five, dearie... The lights like to drift about the marsh to the south.`)]],
          options: [brew, shop, close],
        };
        case 5: return {
          lines: [
            [T, L('ฮึ่ม... ครบห้าดวงแล้ว ส่งมานี่', 'Hrm... All five. Hand them here, heh heh.')],
            [T, L('(ยายคางคกโยนแก่นวิญญาณลงในหม้อ น้ำในหม้อเรืองแสงสีฟ้า)', '(Granny Toad tosses the essences into her pot. The brew glows blue.)')],
            [T, L('นี่ น้ำมนต์จันทรา นำไปเทลงบนแท่นบูชาในวิหารจมน้ำ ทางเหนือสุด ผ่านหุบผาที่มีซุ้มประตูหิน', 'There. Moon water. Pour it on the altar in the Drowned Temple, far to the north, past the gorge with the stone arch.')],
          ],
          options: [{ label: L('รับน้ำมนต์จันทรา', 'Take the moon water'), fn: () => { g.audio.chime(); advance(6)(); } }],
        };
        default:
          if (this.done) return { lines: [[T, L('ฮึ่ม ฮึ่ม... ดวงจันทร์หายใจได้แล้ว เจ้าทำได้ดีนี่ ไอ้หนู', 'Hrm hrm... The moon breathes again. Well done, dearie. Heh heh heh.')]], options: [brew, shop, close] };
          if (this.stage >= 7 && this.lake < 3) return { lines: [
            [T, L('ฮึ่มม... อยากรู้ว่ามือพวกนั้นเป็นของใคร ก็ไปถามน้ำ น้ำจำทุกอย่าง', 'Hrrm... Want to know whose hands those are? Ask the water. Water remembers everything, heh heh.')],
            [T, L('เมืองจมกลางทะเลสาบทางใต้นั่นเคยเป็นวังของมัน ภาพบนผนังวิหารยังอยู่ ถ้าเจ้ากล้าลุยน้ำไปดู', 'That Sunken City in the southern lake was once his palace. The murals in its temple are still there, if you dare wade out to see.')],
          ], options: [brew, shop, close] };
          return { lines: [[T, L('ฮึ่มม... ฝนตกดีนะคืนนี้ จะซื้ออะไรไหม?', 'Hrrm... Lovely rain tonight. Buying anything, dearie?')]], options: [brew, shop, close] };
      }
    }

    if (npc === 'smith') {
      const S = L('ลุงทั่ง ช่างตีเหล็ก', 'Old Anvil the Smith');
      return {
        lines: [
          [S, L('อ้อ ผู้เดินทาง... ดาบเจ้าทื่อยังกับช้อนกินข้าว', 'Hm. Traveller. Your blade\'s dull as a soup spoon.')],
          [S, L('เอาเขี้ยวหมาป่าเงา แร่เหล็กมืดจากหน้าผาทางเหนือ หรือของแปลก ๆ ที่เจ้าเจอมาให้ข้า แล้วข้าจะตีให้คมกริบ', 'Bring me Shadow Wolf fangs, dark iron ore from the northern cliffs, or any strange thing you find. I\'ll make it keen.')],
        ],
        options: [
          { label: L('อัปเกรดอุปกรณ์', 'Upgrade gear'), fn: () => g.openMenu('smith') },
          ...(this.lake >= 3 && !this.guardForged ? [{ label: L('หลอมดาบขององครักษ์เข้ากับดาบของข้า', 'Forge the Guard\'s Sword into my blade'), fn: () => {
            this.guardForged = true;
            g.audio.forge?.(); g.audio.chime();
            g.ui.openDialogue({ lines: [[S, L('เหล็กของราชาหิน... ไม่ได้เห็นมานานแล้ว', 'The Stone King\'s iron... Haven\'t seen that in a long while.')], [S, L('เอ้า เสร็จแล้ว อาวุธของเจ้าแรงขึ้นอีกหนึ่งในสี่ ใช้ให้สมกับเจ้าของเดิมมันล่ะ', 'There. Done. Your weapon strikes a quarter harder. Wield it worthy of its first owner.')]], options: [close] }, () => g.updateHud());
            g.save();
          } }] : []),
          close,
        ],
      };
    }

    // Min, the farm girl who sings in the corn (only by day); her father went to the big tree
    if (npc === 'min') {
      const M = L('มิ้น', 'Min');
      if (this.farm === 0) return {
        lines: [
          [M, L('♪ ข้าวโพดสูงเท่าพ่อ พ่อสูงเท่าฟ้า... ♪', '♪ The corn grows tall as Papa, Papa tall as the sky... ♪')],
          [M, L('อ้าว พี่! พี่มาจากรางรถไฟเหรอ พ่อหนูไปตัดข้าวที่ต้นไม้ใหญ่ทางตะวันตก แล้วมือก็กอดพ่อไว้ ไม่ยอมปล่อย', 'Oh! Hello! Did you come from the railway? My papa went to cut grain by the big tree in the west. Then the hands hugged him, and they wouldn\'t let go.')],
          [M, L('ตั้งแต่นั้นกังหันก็หมุนไม่ครบ ใบพัดหลุดไปอันนึง พ่อเก็บไว้ในโรงนา... พี่ช่วยติดคืนให้ได้ไหม', 'Since then the windmill doesn\'t turn right. One sail fell off. Papa put it in the barn... Can you put it back?')],
          [M, L('ถ้ากังหันหมุนครบ หุ่นฟางพวกนั้นจะหลับ พ่อเคยบอก', 'If the windmill turns all the way, the strawmen go to sleep. Papa said so.')],
        ],
        options: [{ label: L('พี่จะช่วยเอง', 'I\'ll help you'), fn: () => this.step('farm', 1) }, close],
      };
      if (this.farm === 4) return {
        lines: [
          [M, L('ตุ๊กตาหนู! พี่เจอที่ไหน... ในรังไหมเหรอ', 'My doll! Where did you find her... in a cocoon?')],
          [M, L('แสดงว่าพ่อเคยถือมันไว้ตอนที่... (มิ้นกอดตุ๊กตาแน่น)', 'Then Papa was holding her when... (Min hugs the doll tight.)')],
          [M, L('พี่ใส่หมวกเหมือนพ่อเลย... พี่ก็เคยโดนกอดใช่ไหม ถึงได้มาจากทางรถไฟ', 'You wear a hat like Papa\'s... Did the hands hug you too? Is that why you came from the railway?')],
          [M, L('เอานี่ไป พ่อบอกว่ามันคือนิ้วของดวงจันทร์ หล่นมาในไร่เราตอนที่มือคว้าพ่อไป', 'Here, take this. Papa said it\'s a finger of the moon. It fell in our field when the hands took him.')],
        ],
        options: [{ label: L('ขอบใจนะมิ้น', 'Thank you, Min'), fn: () => this.step('farm', 5) }],
      };
      return { lines: [[M, this.done ? (this.hunt >= 3 ? L('ลมพัดมาจากทางตะวันตก... หนูได้ยินพ่อเรียกชื่อหนู ขอบคุณนะพี่', 'The wind is blowing from the west... I heard Papa say my name. Thank you.') : L('♪ ข้าวโพดสูงเท่าพ่อ... ♪', '♪ The corn grows tall as Papa... ♪')) : L('กังหันหมุนครบแล้ว หุ่นฟางหลับหมดเลย พี่เก่งจัง', 'The windmill turns all the way now. The strawmen are all asleep. You\'re so clever!')]], options: [close] };
    }

    // the faceless ferryman at the end of the rotten pier
    if (npc === 'ferryman') {
      const F = L('คนแจวเรือไร้หน้า', 'The Faceless Ferryman');
      if (this.lake === 0 && this.stage >= 7) return {
        lines: [
          [F, '...'],
          [F, L('ข้ารอพาคนข้ามมาสามร้อยปี ไม่มีใครกล้าข้ามแล้ว ตั้งแต่วังจมลงไปพร้อมเจ้าของมัน', 'Three hundred years I have waited to ferry someone across. None dare cross, not since the palace sank with its master.')],
          [F, L('เรือข้าผุไปนานแล้ว เดินไปเองเถอะ ทางหินยังอยู่ ตรงปลายท่านี่', 'My boat rotted long ago. Walk, then. The stone path remains, at the pier\'s end.')],
          [F, L('ในวิหารใหญ่มีภาพสามภาพ ดูให้ครบ แล้วเจ้าจะรู้ว่ามือพวกนั้นเป็นของใคร... องครักษ์คนสุดท้ายยังเฝ้าอยู่ ระวังตัวด้วย', 'In the great temple are three pictures. See them all, and you will know whose hands those are... The Last Guard still keeps his watch. Take care.')],
        ],
        options: [{ label: L('ข้าจะไปดู', 'I will go and see'), fn: () => this.step('lake', 1) }, shop, close],
      };
      return { lines: [[F, this.done ? L('น้ำนิ่งแล้ว... เป็นครั้งแรกในสามร้อยปี', 'The water is still... for the first time in three hundred years.') : L('...ทางหินยังอยู่ ตรงปลายท่า', '...The stone path remains, at the pier\'s end.')]], options: [shop, close] };
    }

    if (npc === 'keeper') {
      const K = L('เทียนหลอม', 'Tallow');
      const dn = g.dayNight;
      const sub = (lines) => () => g.ui.openDialogue({ lines, options: menu() }, () => g.updateHud());
      const menu = () => [
        {
          label: L('ดื่มเบียร์แสงเทียน (3 เหรียญ) — ฟื้นพลังเต็ม', 'Drink a Candlelight Ale (3 coins) — restores full health'),
          fn: () => {
            if (g.coins < 3) { g.ui.toast(L('เหรียญไม่พอ...', 'Not enough coins...')); return; }
            g.coins -= 3; g.player.hp = g.player.maxHp; g.audio.drink(); g.ui.toast(L('ไขเทียนหยดลงในแก้ว... อุ่นไปทั้งตัว', 'A drip of tallow falls into the cup... warmth spreads through you.')); g.updateHud();
          },
          keepOpen: true,
        },
        {
          label: dn.isNight ? L('เช่าห้องนอนจนเช้า (5 เหรียญ)', 'Rent a room until morning (5 coins)') : L('เช่าห้องนอนจนค่ำ (5 เหรียญ)', 'Rent a room until nightfall (5 coins)'),
          fn: () => {
            if (g.coins < 5) { g.ui.toast(L('เหรียญไม่พอ...', 'Not enough coins...')); return; }
            g.coins -= 5; g.updateHud();
            g.sleepUntil(dn.isNight ? 0.36 : 0.8);
          },
        },
        { label: L('เปิดร้าน (ซื้อ / ขายสมบัติ / กระเป๋าใหญ่)', 'Trade (buy / sell treasure / larger bag)'), fn: () => g.openMenu('shop') },
        { label: L('เปลี่ยนวิถี (เปลี่ยนสายอาชีพ)', 'Change path (change class)'), fn: () => g.changeClassAtInn() },
        { label: L('ถามเรื่องปราสาทที่ลอยอยู่บนฟ้า', 'Ask about the castle in the sky'), keepOpen: true, fn: sub([
          [K, L('อา... ปราสาทแขวนฟ้า เมื่อก่อนมันตั้งอยู่บนพื้นดินเหมือนบ้านทั่วไป', 'Ah... Sky-Hung Castle. Once it stood on the ground like any other house.')],
          [K, L('จนคืนที่ดวงจันทร์ล้มป่วย แผ่นดินใต้ปราสาทก็ลอยขึ้นไปทั้งก้อน โซ่เหล็กพวกนั้นคือสิ่งเดียวที่ไม่ให้มันลอยหายไปในวังวนบนฟ้า', 'Then, the night the moon fell sick, the whole earth beneath it rose up. Those iron chains are all that keep it from drifting off into the whirl of the sky.')],
          [K, L('บางคืนยังเห็นไฟในหน้าต่าง... ทั้งที่ไม่มีใครขึ้นไปได้มาร้อยปีแล้ว', 'Some nights there\'s still a light in the windows... though no one has gone up there in a hundred years.')],
        ]) },
        { label: L('ถามเรื่องหัวหินยักษ์ทางตะวันตก', 'Ask about the giant stone head in the west'), keepOpen: true, fn: sub([
          [K, L('ราชาหินผู้หลับใหล... เขาว่ากันว่าร่างของพระองค์ทั้งร่างฝังอยู่ใต้ป่าตะวันตก', 'The Sleeping Stone King... They say his whole body lies buried beneath the western wood.')],
          [K, L('หัวที่เจ้าเห็นคือส่วนเดียวที่โผล่พ้นดิน มือข้างหนึ่งก็ยังตะกายออกมาไม่สำเร็จ', 'The head you saw is all that rises above the earth. One hand is still clawing its way out, and never quite making it.')],
          [K, L('อย่าปลุกพระองค์เชียวล่ะ ไอ้หนู... ไฟในกระถางที่หน้าพระพักตร์ต้องไม่มีวันดับ', 'Don\'t you wake him, love... The fire in the brazier before his face must never go out.')],
        ]) },
        ...(this.stage >= 7 ? [{ label: L('ถามเรื่องเสียงระฆังบนเขา', 'Ask about the bell on the mountain'), keepOpen: true, fn: sub([
          [K, L('ทุกคืนที่จันทร์ซีดลง ระฆังบนยอดเขาเหนือจะดังเอง... ทั้งที่คนตีระฆังตายไปสามสิบปีแล้ว', 'Every night the moon runs pale, the bell on the northern peak rings by itself... though the bell-ringer died thirty years ago.')],
          [K, L('เขาฝังอยู่ในสุสานข้างหอ ใครขึ้นไปบนหอก็ไม่ค่อยได้กลับลงมา... มีชุดเกราะเดินเวรอยู่แถวนั้น', 'He\'s buried in the graveyard beside the tower. Few who climb it come back down... There\'s armour walking the watch up there.')],
          [K, L('ถ้าเจ้าจะไป เดินถนนสายเหนือไปจนสุด แล้วอย่าลืมว่าเกราะพวกนั้นไม่กลัวดาบเบา ๆ', 'If you must go, follow the north road to its end. And remember, that armour doesn\'t fear a light blade.')],
        ]) }] : []),
        ...(this.done ? [{ label: L('ถามเรื่องรังไหมบนต้นไม้', 'Ask about the cocoons in the tree'), keepOpen: true, fn: sub([
          [K, L('เจ้ารู้ไหมว่ารังไหมบนต้นไม้นั่นมีกี่ใบ? ข้านับทุกคืน', 'Do you know how many cocoons hang in that tree? I count them every night.')],
          [K, L('คืนที่เจ้ามาถึงหมู่บ้านนี้ ข้านับได้น้อยกว่าเมื่อวานหนึ่งใบ...', 'The night you came to this village, I counted one fewer than the night before...')],
          [K, L('และเมื่อคืน ข้าเห็นโซ่เส้นหนึ่งของปราสาทแขวนฟ้าขาด ราชาหินกำลังจะตื่น ไอ้หนู', 'And last night I saw one of Sky-Hung Castle\'s chains snap. The Stone King is waking, love.')],
        ]) }] : []),
        { label: L('ถามเรื่องกระดูกยักษ์ในบึง', 'Ask about the giant bones in the marsh'), keepOpen: true, fn: sub([
          [K, L('ซี่โครงที่รางรถไฟลอดผ่านน่ะหรือ? คนสร้างทางรถไฟเจอมันตอนขุดดิน', 'The ribcage the railway runs through? The men who built the line found it while digging.')],
          [K, L('พวกเขาวางรางผ่านกลางอกมันไปดื้อ ๆ ... หลังจากนั้นไม่นาน รถไฟก็ไม่เคยวิ่งอีกเลย', 'They laid the track straight through its chest, stubborn as you like... Not long after, the trains never ran again.')],
        ]) },
        { label: L('ลาก่อน', 'Farewell'), fn: () => {} },
      ];
      return {
        lines: [
          [K, L('ยินดีต้อนรับสู่โรงเตี๊ยมเทียนหลอม ผู้เดินทาง... ระวังไขเทียนหยดใส่หน่อยนะ', 'Welcome to the Molten Candle Inn, traveller... Mind the dripping wax.')],
          [K, dn.isNight ? L('คืนนี้ข้างนอกมีแต่วิญญาณบึง นั่งพักให้อุ่นก่อนเถอะ', 'Nothing out there tonight but Marsh Wisps. Sit and get warm a while.') : L('กลางวันที่นี่ไม่เคยสว่างหรอก... ดวงอาทิตย์ลืมทางมาบึงนี้ไปนานแล้ว', 'Day never truly comes here... The sun forgot the way to this marsh long ago.')],
        ],
        options: menu(),
      };
    }

    if (npc === 'altar') {
      if (this.stage === 6) return {
        lines: [['', L('แท่นบูชาโบราณ มีร่องรูปพระจันทร์เสี้ยวที่แห้งเหือด...', 'An ancient altar, with a crescent-shaped channel run dry...')]],
        options: [{ label: L('เทน้ำมนต์จันทรา', 'Pour the moon water'), fn: () => this.vision() }, { label: L('ยังก่อน', 'Not yet'), fn: () => {} }],
      };
      return {
        lines: [['', this.stage >= 7 ? L('น้ำมนต์จันทราเรืองแสงอยู่ในร่องของแท่นบูชา ในแสงนั้นยังเห็นเงาของมือนับร้อยอยู่รำไร', 'The moon water glows in the altar\'s channel. In its light, the shadows of a hundred hands still faintly stir.') : L('แท่นบูชาโบราณ มีร่องรูปพระจันทร์เสี้ยวที่แห้งเหือด... บางทีอาจต้องใช้อะไรบางอย่าง', 'An ancient altar, with a crescent-shaped channel run dry... Perhaps it needs something.')]],
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
      [N, L('แสงจันทร์ไหลลงร่องแท่นบูชา... แล้วเจ้าก็เห็นมัน', 'Moonlight flows down the altar\'s channel... and then you see it.')],
      [N, L('มือนับร้อยโผล่จากเงาของต้นไม้ยักษ์ทางตะวันตก กำแสงของดวงจันทร์ไว้แน่นจนนิ้วซีด', 'A hundred hands reach from the shadow of a great tree in the west, clutching the moon\'s light so tightly their fingers have gone white.')],
      [N, L('สี่นิ้วที่กำแน่นที่สุดชี้ไปสี่ทาง: เหนือ ตะวันออก ใต้ และ... ตรงที่เจ้ายืนอยู่', 'The four fingers that grip the hardest point four ways: north, east, south, and... to where you stand.')],
      [N, L('เสียงหนึ่งกระซิบจากใต้น้ำ: "ไปหาข้อนิ้วของข้า... แล้วแบมือของมันออก"', 'A voice whispers from beneath the water: "Find my fingers... and open its hand."')],
      [N, L('นิ้วที่ชี้มาที่เจ้าคลายออกเอง ราวกับมันจำเจ้าได้', 'The finger pointing at you loosens of its own accord, as if it remembers you.')],
    ], options: [{ label: L('ต่อไป', 'Continue'), fn: () => {
      this.stage = 7;
      g.onQuestChanged();
      g.ui.banner(L('ข้อนิ้วของดวงจันทร์ 1/4', 'Fingers of the Moon 1/4'), L('นิ้วแห่งบึงคลายออก · เหนือ ตะวันออก ใต้ รอเจ้าอยู่', 'The Finger of the Marsh loosens · North, east and south await you'));
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
    this.g.ui.toast(L(`แก่นวิญญาณบึง ${this.essence}/${ESSENCE_GOAL}`, `Marsh Wisp Essence ${this.essence}/${ESSENCE_GOAL}`));
    if (this.essence >= ESSENCE_GOAL) this.stage = 5;
    this.g.onQuestChanged();
  }
}

