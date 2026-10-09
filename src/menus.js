// Service screens: alchemy at the toad crone's, upgrades at the blacksmith, and the innkeeper's
// shop (buy supplies / a bigger case, sell treasures like the RE4 merchant).
import { ITEMS, itemIconURL } from './items.js';
import { BAG_SIZES } from './inventory.js';
import { AFFIXES } from './contracts.js';
import { BUILDINGS, CREEPS, SEATS, costText, canPay } from './moba.js';
import { L } from './i18n.js';
import { WEAPONS, ARMOURS, pathWeapons, statLine } from './equipment.js';

export const RECIPES = [
  { out: 'potion', n: 1, need: [['moon_herb', 2]] },
  { out: 'potion_big', n: 1, need: [['moon_herb', 2], ['mushroom', 1], ['slime', 1]] },
  { out: 'tonic', n: 1, need: [['fang', 1], ['mushroom', 1]] },
  { out: 'oil', n: 1, need: [['essence', 2], ['straw', 1]] },
  { out: 'sight', n: 1, need: [['mushroom', 2], ['essence', 1]] },
  { out: 'leech_live', n: 3, need: [['slime', 1], ['moon_herb', 1]] },
];

// level n costs UPGRADES[part].levels[n] to reach level n+1
export const UPGRADES = {
  sword: {
    name: L('ดาบ', 'Sword'), desc: (lv) => L(`พลังโจมตี +${lv * 20}%`, `Attack +${lv * 20}%`),
    levels: [
      { coins: 40, need: [['fang', 2]] },
      { coins: 80, need: [['fang', 3], ['ore', 1]] },
      { coins: 140, need: [['ore', 2], ['claw', 4]] },
      { coins: 220, need: [['ore', 2], ['knight_core', 1]] },
    ],
  },
  cloak: {
    name: L('ผ้าคลุม', 'Cloak'), desc: (lv) => L(`ลดดาเมจที่ได้รับ ${lv * 8}%`, `Damage taken −${lv * 8}%`),
    levels: [
      { coins: 30, need: [['straw', 3]] },
      { coins: 70, need: [['straw', 2], ['fang', 2]] },
      { coins: 120, need: [['slime', 3], ['claw', 2]] },
      { coins: 200, need: [['essence', 3], ['ore', 2]] },
    ],
  },
  lantern: {
    name: L('ตะเกียง', 'Lantern'), desc: (lv) => L(`แสงสว่างและระยะ +${lv * 35}%`, `Light and reach +${lv * 35}%`),
    levels: [
      { coins: 25, need: [['mushroom', 2]] },
      { coins: 60, need: [['essence', 2]] },
      { coins: 110, need: [['essence', 2], ['moonstone', 1]] },
    ],
  },
};

const BAG_PRICES = [60, 150];
// what the smith can make: the quick and the heavy weapon of your path, and four suits
const WEAPON_FORGE = [{ coins: 60, need: [['fang', 2], ['ore', 1]] }, { coins: 120, need: [['ore', 3], ['claw', 2]] }];
const ARMOUR_FORGE = [
  ['arm_leather', 40, [['fang', 3], ['straw', 2]]],
  ['arm_mail', 80, [['ore', 3]]],
  ['arm_robe', 70, [['straw', 3], ['essence', 2]]],
  ['arm_briar', 110, [['claw', 3], ['slime', 2]]],
];
const BOLT_FORGE = [{ n: 12, coins: 6, need: [['ore', 1]] }, { n: 4, coins: 2, need: [['claw', 1]] }];
// [item, price, how many for the price]
const BUY = [['potion', 12], ['tonic', 18], ['moon_herb', 5], ['leech_live', 6], ['bolt', 10, 6]];

const $ = (id) => document.getElementById(id);

export class Menus {
  constructor(game) {
    this.g = game;
    this.el = $('svc');
    this.list = $('svc-list');
    this.kind = null;
    this.tab = 'buy';
    $('svc-close').addEventListener('click', () => this.close());
    this.el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { this.tab = b.dataset.tab; this.render(); }));
  }

  get open() { return !!this.kind; }

  show(kind) {
    this.kind = kind;
    this.tab = 'buy';
    this.el.classList.remove('hidden');
    this.render();
  }

  close() {
    this.kind = null;
    this.el.classList.add('hidden');
    this.g.onMenuClosed();
  }

  update(input) {
    if (input.consume('escape') || input.consume('interact') || input.consume('bag') || (this.kind === 'moba' && input.consume('build'))) this.close();
  }

  has(need) { return need.every(([id, n]) => this.g.bag.count(id) >= n); }

  costHTML(need, coins = 0) {
    const parts = need.map(([id, n]) => {
      const have = this.g.bag.count(id);
      return `<span class="cost ${have >= n ? 'ok' : 'no'}"><img src="${itemIconURL(id)}">${ITEMS[id].name} ${have}/${n}</span>`;
    });
    if (coins) parts.unshift(`<span class="cost ${this.g.coins >= coins ? 'ok' : 'no'}">● ${coins}</span>`);
    return parts.join('');
  }

  row({ icon, title, sub, cost, button, enabled, onClick, note }) {
    const r = document.createElement('div');
    r.className = 'svc-row';
    r.innerHTML = `<div class="svc-icon">${icon ? `<img src="${icon}">` : ''}</div>
      <div class="svc-main"><div class="svc-title">${title}</div><div class="svc-sub">${sub || ''}</div><div class="svc-costs">${cost || ''}</div></div>`;
    const b = document.createElement('button');
    b.textContent = button;
    b.disabled = !enabled;
    if (note) b.title = note;
    b.addEventListener('click', () => { onClick(); this.render(); });
    r.appendChild(b);
    this.list.appendChild(r);
  }

  render() {
    const g = this.g, k = this.kind;
    this.list.innerHTML = '';
    $('svc-coins').textContent = L(`● ${g.coins} เหรียญ`, `● ${g.coins} coins`);
    $('svc-tabs').classList.toggle('hidden', k !== 'shop' && k !== 'merchant');
    this.el.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === this.tab));
    if (k === 'alchemy') this.renderAlchemy();
    if (k === 'smith') this.renderSmith();
    if (k === 'shop') (this.tab === 'buy' ? this.renderBuy() : this.renderSell());
    if (k === 'merchant') (this.tab === 'buy' ? this.renderMerchant() : this.renderSell(1.3));
    if (k === 'board') this.renderBoard();
    if (k === 'moba') this.renderMoba();
  }

  renderAlchemy() {
    $('svc-title').textContent = L('หม้อต้มยาของยายคางคก', 'Granny Toad\'s Cauldron');
    $('svc-hint').textContent = L('ฮึ่มม... เอาของมาให้ครบ แล้วข้าจะต้มให้ ไม่คิดเงินหรอก', 'Hmm... bring me all that is needed and I shall brew it. No coin asked.');
    for (const rc of RECIPES) {
      const def = ITEMS[rc.out];
      const ok = this.has(rc.need);
      const room = this.g.bag.clone();
      rc.need.forEach(([id, n]) => room.remove(id, n));
      const fits = room.add(rc.out, rc.n) === 0;
      this.row({
        icon: itemIconURL(rc.out), title: rc.n > 1 ? `${def.name} ×${rc.n}` : def.name, sub: def.desc, cost: this.costHTML(rc.need),
        button: ok && !fits ? L('กระเป๋าเต็ม', 'Bag full') : L('ปรุง', 'Brew'), enabled: ok && fits,
        onClick: () => {
          rc.need.forEach(([id, n]) => this.g.bag.remove(id, n));
          this.g.bag.add(rc.out, rc.n);
          this.g.audio.brew();
          this.g.ui.toast(L(`ปรุง${def.name}สำเร็จ`, `${def.name} brewed`));
        },
      });
    }
  }

  renderSmith() {
    const g = this.g;
    $('svc-title').textContent = L('เตาหลอมของลุงทั่ง', 'Old Anvil\'s Forge');
    $('svc-hint').textContent = L('เหล็กดีต้องตีตอนร้อน เอาของมา แล้วจ่ายค่าแรงข้าด้วย', 'Strike the iron while it\'s hot. Bring the makings, and pay for my labour.');
    // bolts for the crossbow: a lump of ore makes a dozen, a pale claw a few
    for (const b of BOLT_FORGE) {
      const ok = this.has(b.need) && g.coins >= b.coins, fits = g.bag.canAdd('bolt', b.n);
      this.row({
        icon: itemIconURL('bolt'), title: L(`ตีลูกดอกหน้าไม้ ×${b.n}`, `Forge crossbow bolts ×${b.n}`), sub: ITEMS.bolt.desc, cost: this.costHTML(b.need, b.coins),
        button: ok && !fits ? L('กระเป๋าเต็ม', 'Bag full') : L('ตี', 'Forge'), enabled: ok && fits,
        onClick: () => { g.coins -= b.coins; b.need.forEach(([id, n]) => g.bag.remove(id, n)); g.bag.add('bolt', b.n); g.audio.anvil(); g.ui.toast(L(`ได้ลูกดอก ${b.n} ดอก`, `${b.n} bolts forged`)); },
      });
    }
    // new weapons for your path, and suits of armour
    const forged = pathWeapons(g.kit.id).slice(1, 3).map((w, i) => [w.id, WEAPON_FORGE[i].coins, WEAPON_FORGE[i].need]);
    for (const [id, coins, need] of [...forged, ...ARMOUR_FORGE]) {
      const def = WEAPONS[id] || ARMOURS[id];
      const owned = g.equipment.owns(id), ok = this.has(need) && g.coins >= coins, fits = g.bag.canAdd(id, 1);
      this.row({
        icon: itemIconURL(id), title: def.name, sub: `${def.desc}<br><i>${statLine(id)}</i>`, cost: owned ? '' : this.costHTML(need, coins),
        button: owned ? L('มีแล้ว', 'Owned') : ok && !fits ? L('กระเป๋าเต็ม', 'Bag full') : L('ตี', 'Forge'), enabled: !owned && ok && fits,
        onClick: () => {
          g.coins -= coins; need.forEach(([nid, n]) => g.bag.remove(nid, n)); g.bag.add(id, 1); g.audio.anvil();
          g.ui.toast(L(`ได้${def.name} — เปิดกระเป๋าแล้วกดสวมใส่`, `${def.name} forged — equip it from your bag`));
        },
      });
    }
    for (const [key, base] of Object.entries(UPGRADES)) {
      // the weapon line follows your path: sword, bell hammer, lancet, coffin or censer
      const up = key === 'sword' ? { ...base, name: g.kit.def.weapon } : base;
      const lv = g.gear[key], max = up.levels.length;
      const pips = '◆'.repeat(lv) + '◇'.repeat(max - lv);
      if (lv >= max) {
        this.row({ title: `${up.name} <span class="pips">${pips}</span>`, sub: L(`${up.desc(lv)} · ขั้นสูงสุดแล้ว`, `${up.desc(lv)} · fully honed`), button: L('สูงสุด', 'Max'), enabled: false, onClick: () => {} });
        continue;
      }
      const cost = up.levels[lv];
      const ok = this.has(cost.need) && g.coins >= cost.coins;
      this.row({
        title: `${up.name} <span class="pips">${pips}</span>`,
        sub: L(`ตอนนี้: ${up.desc(lv)} → ขั้นถัดไป: ${up.desc(lv + 1)}`, `Now: ${up.desc(lv)} → Next: ${up.desc(lv + 1)}`),
        cost: this.costHTML(cost.need, cost.coins),
        button: L('อัปเกรด', 'Upgrade'), enabled: ok,
        onClick: () => {
          g.coins -= cost.coins;
          cost.need.forEach(([id, n]) => g.bag.remove(id, n));
          g.gear[key]++;
          g.onGearChanged();
          g.audio.anvil();
          g.ui.toast(L(`อัปเกรด${up.name}เป็นขั้น ${g.gear[key]}`, `${up.name} upgraded to level ${g.gear[key]}`));
        },
      });
    }
  }

  renderBuy() {
    const g = this.g;
    $('svc-title').textContent = L('ร้านของเทียนหลอม', 'Tallow\'s Wares');
    $('svc-hint').textContent = L('ซื้ออะไรดีล่ะ ผู้เดินทาง... หรือมีของมีค่าจะขาย?', 'What\'ll it be, traveller... or have you something of worth to sell?');
    for (const [id, price, n = 1] of BUY) {
      const def = ITEMS[id];
      const fits = g.bag.canAdd(id, n);
      this.row({
        icon: itemIconURL(id), title: n > 1 ? `${def.name} ×${n}` : def.name, sub: def.desc, cost: `<span class="cost ${g.coins >= price ? 'ok' : 'no'}">● ${price}</span>`,
        button: fits ? L('ซื้อ', 'Buy') : L('กระเป๋าเต็ม', 'Bag full'), enabled: fits && g.coins >= price,
        onClick: () => { g.coins -= price; g.bag.add(id, n); g.audio.coin(); },
      });
    }
    const lvl = g.bag.level;
    if (lvl < BAG_SIZES.length - 1) {
      const [c, r] = BAG_SIZES[lvl + 1], price = BAG_PRICES[lvl];
      this.row({
        title: L(`กระเป๋าใบใหญ่ขึ้น (${c} × ${r})`, `A larger bag (${c} × ${r})`), sub: L('ของทั้งหมดย้ายไปใบใหม่ในตำแหน่งเดิม', 'Everything moves to the new bag, each in its place.'),
        cost: `<span class="cost ${g.coins >= price ? 'ok' : 'no'}">● ${price}</span>`,
        button: L('ซื้อ', 'Buy'), enabled: g.coins >= price,
        onClick: () => { g.coins -= price; g.bag.upgrade(); g.audio.coin(); g.ui.toast(L(`กระเป๋าใหม่ขนาด ${c} × ${r}`, `New bag: ${c} × ${r}`)); },
      });
    }
  }

  // online siege: raise buildings in your base, send packs of creatures at another king
  renderMoba() {
    const g = this.g, M = g.moba, w = M.wallet;
    $('svc-title').textContent = L('ค่ายของเจ้า', 'Your Camp');
    $('svc-coins').textContent = `🪵 ${Math.floor(w.wood)} · ⛏ ${Math.floor(w.ore)} · ✦ ${Math.floor(w.soul)}`;
    $('svc-hint').textContent = L('สร้างได้ในวงแหวนสีรอบฐานของเจ้า · ครีปจะเดินไปตีฐานที่เลือกเอง', 'Build within the coloured ring about your base · Creeps march on the base you choose');
    const head = (t) => { const d = document.createElement('div'); d.className = 'svc-empty'; d.textContent = t; this.list.appendChild(d); };
    head(L('— สิ่งปลูกสร้าง —', '— Structures —'));
    for (const [type, b] of Object.entries(BUILDINGS)) {
      this.row({
        title: b.name, sub: b.desc, cost: `<span class="cost ${canPay(w, b.cost) ? 'ok' : 'no'}">${costText(b.cost)}</span>`,
        button: L('วาง', 'Place'), enabled: canPay(w, b.cost),
        onClick: () => { this.close(); g.startPlacing(type); },
      });
    }
    head(L('— ซัมม่อนครีป —', '— Summon Creeps —'));
    const foes = M.aliveSlots().filter((s) => s !== M.me);
    for (const [type, c] of Object.entries(CREEPS)) {
      const locked = c.needs && ![...M.S.values()].some((s) => s.owner === M.me && s.type === c.needs && s.built >= 1);
      const r = document.createElement('div');
      r.className = 'svc-row summon-row';
      r.innerHTML = `<div class="svc-icon"></div><div class="svc-main"><div class="svc-title">${c.name}</div><div class="svc-sub">${c.desc}${locked ? L(' · 🔒 ต้องมีรังเพาะ', ' · 🔒 needs a Brood-Nest') : ''}</div>
        <div class="svc-costs"><span class="cost ${canPay(w, c.cost) ? 'ok' : 'no'}">${costText(c.cost)}</span></div></div><div class="svc-btns"></div>`;
      for (const t of foes) {
        const b = document.createElement('button');
        b.textContent = `→ ${SEATS[t].name}`;
        b.style.borderColor = SEATS[t].css;
        b.disabled = locked || !canPay(w, c.cost);
        b.addEventListener('click', () => { M.requestSummon(type, t); this.render(); });
        r.querySelector('.svc-btns').appendChild(b);
      }
      this.list.appendChild(r);
    }
  }

  // the bounty board: contracts you are on first (claim the reward here), then today's notices
  renderBoard() {
    const g = this.g, K = g.contracts;
    $('svc-title').textContent = L('บอร์ดประกาศล่าค่าหัว', 'Bounty Board');
    $('svc-hint').textContent = L('รับงานได้พร้อมกัน 2 งาน · ไปดูที่เกิดเหตุ ตามรอยให้ครบ 3 จุด แล้วจะรู้ว่ามันซ่อนที่ไหนและแพ้อะไร · ใบประกาศใหม่มาทุกเช้า', 'Take up to 2 bounties at once · Visit the scene and follow all 3 signs to learn where it lairs and what it fears · New notices each morning');
    const reward = (c) => `<span class="cost ok">● ${c.coins}</span>${c.items.map(([id, n]) => `<span class="cost ok"><img src="${itemIconURL(id)}">${ITEMS[id].name}${n > 1 ? ` ×${n}` : ''}</span>`).join('')}`;
    const when = { night: L('ออกกลางคืน', 'By night'), day: L('ออกกลางวัน', 'By day'), always: L('ออกทั้งวัน', 'Day and night') };
    for (const a of K.active) {
      const c = a.c, n = a.found.filter(Boolean).length;
      const status = a.state === 'scene' ? L(`กำลังตามรอย (${n}/3) — ไปที่เกิดเหตุตามเข็มทิศ`, `Tracking (${n}/3) — follow the compass to the scene`)
        : a.state === 'hunt' ? L(`ตามล่าที่รัง · จุดอ่อน: ${AFFIXES[c.affix].name} — ${AFFIXES[c.affix].hint}`, `Hunt it at its lair · Weakness: ${AFFIXES[c.affix].name} — ${AFFIXES[c.affix].hint}`) : L('ล่าสำเร็จแล้ว! ส่งหลักฐานเพื่อรับรางวัล', 'The hunt is done! Hand in the proof for your reward.');
      const claim = a.state === 'trophy';
      this.row({
        icon: itemIconURL('trophy'), title: `<span class="contract-tag">${L('กำลังทำ', 'Underway')}</span>${c.name}`, sub: `${c.title} · ${status}`, cost: reward(c),
        button: claim ? L('ส่งหลักฐาน', 'Hand in proof') : L('ยกเลิกงาน', 'Abandon'), enabled: !claim || g.bag.count('trophy') > 0,
        onClick: () => (claim ? K.claim(a) : K.abandon(a)),
      });
      this.list.lastChild.classList.add('contract');
    }
    for (const c of K.offers) {
      this.row({
        icon: itemIconURL('trophy'), title: `<span class="contract-tag">${when[c.time]}</span>${c.title}`, sub: `"${c.text}" — ${c.giver}`, cost: reward(c),
        button: L('รับงาน', 'Accept'), enabled: K.active.length < 2,
        onClick: () => K.take(c),
      });
      this.list.lastChild.classList.add('contract');
    }
    if (!K.active.length && !K.offers.length) this.list.innerHTML = `<div class="svc-empty">${L('ยังไม่มีใบประกาศใหม่... กลับมาพรุ่งนี้เช้า', 'No new notices... come back at dawn.')}</div>`;
  }

  // the wandering pedlar: a few rare wares, a treasure map, and he pays more for treasure
  renderMerchant() {
    const g = this.g, m = g.events.merchant;
    $('svc-title').textContent = L('แผงของพ่อค้าเร่', 'The Pedlar\'s Stall');
    $('svc-hint').textContent = L('ของหายากจากแดนไกล มีจำกัด หมดแล้วหมดเลย!', 'Rare wares from far lands. Few of each — once gone, gone for good!');
    if (!m) return;
    for (const w of m.stock) {
      if (w.id === 'map') {
        this.row({
          title: L('แผนที่ขุมทรัพย์', 'Treasure Map'), sub: L('ชี้ทางไปหีบสมบัติที่ยังไม่มีใครเปิด (แสดงบนเข็มทิศ)', 'Leads to a chest no one has opened (shown on the compass).'),
          cost: `<span class="cost ${g.coins >= w.price ? 'ok' : 'no'}">● ${w.price}</span>`,
          button: w.left > 0 ? L('ซื้อ', 'Buy') : L('ขายหมดแล้ว', 'Sold out'), enabled: w.left > 0 && g.coins >= w.price,
          onClick: () => { if (g.events.buyMap()) { g.coins -= w.price; w.left--; g.audio.coin(); } else g.ui.toast(L('ไม่มีหีบที่ยังไม่ได้เปิดเหลือแล้ว', 'No unopened chests remain.')); },
        });
        continue;
      }
      const def = ITEMS[w.id];
      const fits = g.bag.canAdd(w.id, 1);
      this.row({
        icon: itemIconURL(w.id), title: `${def.name} <span class="pips">${L(`เหลือ ${w.left}`, `${w.left} left`)}</span>`, sub: def.desc,
        cost: `<span class="cost ${g.coins >= w.price ? 'ok' : 'no'}">● ${w.price}</span>`,
        button: w.left <= 0 ? L('ขายหมดแล้ว', 'Sold out') : fits ? L('ซื้อ', 'Buy') : L('กระเป๋าเต็ม', 'Bag full'), enabled: w.left > 0 && fits && g.coins >= w.price,
        onClick: () => { g.coins -= w.price; w.left--; g.bag.add(w.id, 1); g.audio.coin(); },
      });
    }
  }

  renderSell(mult = 1) {
    const g = this.g;
    const price = (id) => Math.round(ITEMS[id].value * (ITEMS[id].kind === 'treasure' ? mult : 1));
    $('svc-title').textContent = mult > 1 ? L('ขายของให้พ่อค้าเร่', 'Sell to the Pedlar') : L('ขายของ', 'Sell');
    $('svc-hint').textContent = mult > 1 ? L('สมบัติข้าให้ราคาดีกว่าเจ้าเทียนหลอมนั่นอีก! (×1.3)', 'I pay better for treasure than that Tallow ever will! (×1.3)') : L('สมบัติขายได้ราคาดี วัตถุดิบข้ารับซื้อถูก ๆ', 'Treasure fetches a fair price. Materials, I buy cheap.');
    const ids = [...new Set(g.bag.items.map((it) => it.id))].sort((a, b) => (ITEMS[a].kind === 'treasure' ? -1 : 1) - (ITEMS[b].kind === 'treasure' ? -1 : 1) || ITEMS[b].value - ITEMS[a].value);
    const treasures = ids.filter((id) => ITEMS[id].kind === 'treasure');
    if (treasures.length) {
      const total = treasures.reduce((s, id) => s + price(id) * g.bag.count(id), 0);
      this.row({
        title: L('ขายสมบัติทั้งหมด', 'Sell all treasure'), sub: treasures.map((id) => `${ITEMS[id].name} ×${g.bag.count(id)}`).join(' · '),
        cost: `<span class="cost ok">+● ${total}</span>`, button: L('ขายหมด', 'Sell all'), enabled: true,
        onClick: () => { treasures.forEach((id) => g.bag.remove(id, g.bag.count(id))); g.coins += total; g.audio.coin(); g.ui.toast(L(`ขายสมบัติได้ ${total} เหรียญ`, `Treasure sold for ${total} coins`)); },
      });
    }
    if (!ids.length) { this.list.innerHTML = `<div class="svc-empty">${L('กระเป๋าว่างเปล่า', 'Your bag is empty.')}</div>`; return; }
    for (const id of ids) {
      const def = ITEMS[id], have = g.bag.count(id);
      this.row({
        icon: itemIconURL(id), title: `${def.name} ×${have}`, sub: def.kind === 'treasure' ? L('สมบัติ', 'Treasure') : def.kind === 'use' ? L('ยา', 'Remedy') : L('วัตถุดิบ', 'Material'),
        cost: `<span class="cost ok">+● ${price(id)}</span>`, button: L('ขาย 1', 'Sell 1'), enabled: def.value > 0,
        onClick: () => { g.bag.remove(id, 1); g.coins += price(id); g.audio.coin(); },
      });
    }
  }
}
