// Chapter 1 quest line: "The Moonmire" (Thai text).
// stage 0 find the shepherd -> 1 find 3 lost sheep -> 2 return -> 3 meet the toad
// -> 4 collect 5 wisp essences -> 5 return -> 6 pour the moon water at the temple altar -> 7 done
import { LOST_SHEEP } from './layout.js';

export const POTION_PRICE = 8;
export const ESSENCE_GOAL = 5;

export class Quests {
  constructor(game) {
    this.g = game;
    this.stage = 0;
    this.sheepFound = [false, false, false];
    this.essence = 0;
  }

  serialize() { return { stage: this.stage, sheepFound: this.sheepFound, essence: this.essence }; }
  load(d) { Object.assign(this, { stage: d.stage ?? 0, sheepFound: d.sheepFound ?? [false, false, false], essence: d.essence ?? 0 }); }

  get sheepCount() { return this.sheepFound.filter(Boolean).length; }

  objective() {
    switch (this.stage) {
      case 0: return { title: 'เสียงกาในทุ่ง', text: 'เดินตามรางรถไฟเก่าขึ้นไปทางเหนือ ตามหาผู้เลี้ยงแกะบนเนินจันทร์' };
      case 1: return { title: 'แกะดำที่หลงทาง', text: `ตามหาแกะดำที่หลงทาง (${this.sheepCount}/3)` };
      case 2: return { title: 'แกะดำที่หลงทาง', text: 'กลับไปหาโกวัก ผู้เลี้ยงแกะ' };
      case 3: return { title: 'ยายคางคกใต้เห็ดยักษ์', text: 'ไปพบยายคางคกใต้เห็ดยักษ์ในป่าทางตะวันตก' };
      case 4: return { title: 'ดวงไฟแห่งบึง', text: `ฟันวิญญาณบึงแล้วเก็บแก่นวิญญาณ (${this.essence}/${ESSENCE_GOAL})` + (this.g.dayNight.isNight ? '' : ' — วิญญาณออกมาเฉพาะกลางคืน (พักที่โรงเตี๊ยมได้)') };
      case 5: return { title: 'ดวงไฟแห่งบึง', text: 'นำแก่นวิญญาณกลับไปให้ยายคางคก' };
      case 6: return { title: 'วิหารจมน้ำ', text: 'ผ่านหุบผาซุ้มประตูหินทางเหนือ เทน้ำมนต์จันทราลงบนแท่นบูชา' };
      default: return { title: 'บทที่ 1 จบแล้ว', text: 'ท่องไปในบึงจันทราได้อย่างอิสระ' };
    }
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
      default: return [];
    }
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
        default: return {
          lines: [[C, this.stage >= 7 ? 'ดวงจันทร์ส่องสว่างอีกครั้ง... ฝูงแกะของข้าหลับสบายแล้ว ขอบใจเจ้า' : 'ขอให้แสงจันทร์นำทางเจ้า ผู้เดินทาง']],
          options: [close],
        };
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
        default: return {
          lines: [[T, this.stage >= 7 ? 'ฮึ่ม ฮึ่ม... ดวงจันทร์หายป่วยแล้ว เจ้าทำได้ดีนี่' : 'ฮึ่มม... ฝนตกดีนะคืนนี้ จะซื้ออะไรไหม?']],
          options: [brew, shop, close],
        };
      }
    }

    if (npc === 'smith') {
      const S = 'ลุงทั่ง ช่างตีเหล็ก';
      return {
        lines: [
          [S, 'อ้อ ผู้เดินทาง... ดาบเจ้าทื่อยังกับช้อนกินข้าว'],
          [S, 'เอาเขี้ยวหมาป่าเงา แร่เหล็กมืดจากหน้าผาทางเหนือ หรือของแปลก ๆ ที่เจ้าเจอมาให้ข้า แล้วข้าจะตีให้คมกริบ'],
        ],
        options: [{ label: 'อัปเกรดอุปกรณ์', fn: () => g.openMenu('smith') }, close],
      };
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
        options: [{ label: 'เทน้ำมนต์จันทรา', fn: () => g.finishChapter() }, { label: 'ยังก่อน', fn: () => {} }],
      };
      return {
        lines: [['', this.stage >= 7 ? 'น้ำมนต์จันทราเรืองแสงอยู่ในร่องของแท่นบูชา' : 'แท่นบูชาโบราณ มีร่องรูปพระจันทร์เสี้ยวที่แห้งเหือด... บางทีอาจต้องใช้อะไรบางอย่าง']],
        options: [close],
      };
    }
    return { lines: [], options: [close] };
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

