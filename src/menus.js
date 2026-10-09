// Service screens: alchemy at the toad crone's, upgrades at the blacksmith, and the innkeeper's
// shop (buy supplies / a bigger case, sell treasures like the RE4 merchant).
import { ITEMS, itemIconURL } from './items.js';
import { BAG_SIZES } from './inventory.js';
import { AFFIXES } from './contracts.js';
import { BUILDINGS, CREEPS, SEATS, costText, canPay } from './moba.js';

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
    name: 'ดาบ', desc: (lv) => `พลังโจมตี +${lv * 20}%`,
    levels: [
      { coins: 40, need: [['fang', 2]] },
      { coins: 80, need: [['fang', 3], ['ore', 1]] },
      { coins: 140, need: [['ore', 2], ['claw', 4]] },
      { coins: 220, need: [['ore', 2], ['knight_core', 1]] },
    ],
  },
  cloak: {
    name: 'ผ้าคลุม', desc: (lv) => `ลดดาเมจที่ได้รับ ${lv * 8}%`,
    levels: [
      { coins: 30, need: [['straw', 3]] },
      { coins: 70, need: [['straw', 2], ['fang', 2]] },
      { coins: 120, need: [['slime', 3], ['claw', 2]] },
      { coins: 200, need: [['essence', 3], ['ore', 2]] },
    ],
  },
  lantern: {
    name: 'ตะเกียง', desc: (lv) => `แสงสว่างและระยะ +${lv * 35}%`,
    levels: [
      { coins: 25, need: [['mushroom', 2]] },
      { coins: 60, need: [['essence', 2]] },
      { coins: 110, need: [['essence', 2], ['moonstone', 1]] },
    ],
  },
};

const BAG_PRICES = [60, 150];
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
    $('svc-coins').textContent = `● ${g.coins} เหรียญ`;
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
    $('svc-title').textContent = 'หม้อต้มยาของยายคางคก';
    $('svc-hint').textContent = 'ฮึ่มม... เอาของมาให้ครบ แล้วข้าจะต้มให้ ไม่คิดเงินหรอก';
    for (const rc of RECIPES) {
      const def = ITEMS[rc.out];
      const ok = this.has(rc.need);
      const room = this.g.bag.clone();
      rc.need.forEach(([id, n]) => room.remove(id, n));
      const fits = room.add(rc.out, rc.n) === 0;
      this.row({
        icon: itemIconURL(rc.out), title: rc.n > 1 ? `${def.name} ×${rc.n}` : def.name, sub: def.desc, cost: this.costHTML(rc.need),
        button: ok && !fits ? 'กระเป๋าเต็ม' : 'ปรุง', enabled: ok && fits,
        onClick: () => {
          rc.need.forEach(([id, n]) => this.g.bag.remove(id, n));
          this.g.bag.add(rc.out, rc.n);
          this.g.audio.brew();
          this.g.ui.toast(`ปรุง${def.name}สำเร็จ`);
        },
      });
    }
  }

  renderSmith() {
    const g = this.g;
    $('svc-title').textContent = 'เตาหลอมของลุงทั่ง';
    $('svc-hint').textContent = 'เหล็กดีต้องตีตอนร้อน เอาของมา แล้วจ่ายค่าแรงข้าด้วย';
    // bolts for the crossbow: a lump of ore makes a dozen, a pale claw a few
    for (const b of BOLT_FORGE) {
      const ok = this.has(b.need) && g.coins >= b.coins, fits = g.bag.canAdd('bolt', b.n);
      this.row({
        icon: itemIconURL('bolt'), title: `ตีลูกดอกหน้าไม้ ×${b.n}`, sub: ITEMS.bolt.desc, cost: this.costHTML(b.need, b.coins),
        button: ok && !fits ? 'กระเป๋าเต็ม' : 'ตี', enabled: ok && fits,
        onClick: () => { g.coins -= b.coins; b.need.forEach(([id, n]) => g.bag.remove(id, n)); g.bag.add('bolt', b.n); g.audio.anvil(); g.ui.toast(`ได้ลูกดอก ${b.n} ดอก`); },
      });
    }
    for (const [key, base] of Object.entries(UPGRADES)) {
      // the weapon line follows your path: sword, bell hammer, lancet, coffin or censer
      const up = key === 'sword' ? { ...base, name: g.kit.def.weapon } : base;
      const lv = g.gear[key], max = up.levels.length;
      const pips = '◆'.repeat(lv) + '◇'.repeat(max - lv);
      if (lv >= max) {
        this.row({ title: `${up.name} <span class="pips">${pips}</span>`, sub: `${up.desc(lv)} · ขั้นสูงสุดแล้ว`, button: 'สูงสุด', enabled: false, onClick: () => {} });
        continue;
      }
      const cost = up.levels[lv];
      const ok = this.has(cost.need) && g.coins >= cost.coins;
      this.row({
        title: `${up.name} <span class="pips">${pips}</span>`,
        sub: `ตอนนี้: ${up.desc(lv)} → ขั้นถัดไป: ${up.desc(lv + 1)}`,
        cost: this.costHTML(cost.need, cost.coins),
        button: 'อัปเกรด', enabled: ok,
        onClick: () => {
          g.coins -= cost.coins;
          cost.need.forEach(([id, n]) => g.bag.remove(id, n));
          g.gear[key]++;
          g.onGearChanged();
          g.audio.anvil();
          g.ui.toast(`อัปเกรด${up.name}เป็นขั้น ${g.gear[key]}`);
        },
      });
    }
  }

  renderBuy() {
    const g = this.g;
    $('svc-title').textContent = 'ร้านของเทียนหลอม';
    $('svc-hint').textContent = 'ซื้ออะไรดีล่ะ ผู้เดินทาง... หรือมีของมีค่าจะขาย?';
    for (const [id, price, n = 1] of BUY) {
      const def = ITEMS[id];
      const fits = g.bag.canAdd(id, n);
      this.row({
        icon: itemIconURL(id), title: n > 1 ? `${def.name} ×${n}` : def.name, sub: def.desc, cost: `<span class="cost ${g.coins >= price ? 'ok' : 'no'}">● ${price}</span>`,
        button: fits ? 'ซื้อ' : 'กระเป๋าเต็ม', enabled: fits && g.coins >= price,
        onClick: () => { g.coins -= price; g.bag.add(id, n); g.audio.coin(); },
      });
    }
    const lvl = g.bag.level;
    if (lvl < BAG_SIZES.length - 1) {
      const [c, r] = BAG_SIZES[lvl + 1], price = BAG_PRICES[lvl];
      this.row({
        title: `กระเป๋าใบใหญ่ขึ้น (${c} × ${r})`, sub: 'ของทั้งหมดย้ายไปใบใหม่ในตำแหน่งเดิม',
        cost: `<span class="cost ${g.coins >= price ? 'ok' : 'no'}">● ${price}</span>`,
        button: 'ซื้อ', enabled: g.coins >= price,
        onClick: () => { g.coins -= price; g.bag.upgrade(); g.audio.coin(); g.ui.toast(`กระเป๋าใหม่ขนาด ${c} × ${r}`); },
      });
    }
  }

  // online siege: raise buildings in your base, send packs of creatures at another king
  renderMoba() {
    const g = this.g, M = g.moba, w = M.wallet;
    $('svc-title').textContent = 'ค่ายของเจ้า';
    $('svc-coins').textContent = `🪵 ${Math.floor(w.wood)} · ⛏ ${Math.floor(w.ore)} · ✦ ${Math.floor(w.soul)}`;
    $('svc-hint').textContent = 'สร้างได้ในวงแหวนสีรอบฐานของเจ้า · ครีปจะเดินไปตีฐานที่เลือกเอง';
    const head = (t) => { const d = document.createElement('div'); d.className = 'svc-empty'; d.textContent = t; this.list.appendChild(d); };
    head('— สิ่งปลูกสร้าง —');
    for (const [type, b] of Object.entries(BUILDINGS)) {
      this.row({
        title: b.name, sub: b.desc, cost: `<span class="cost ${canPay(w, b.cost) ? 'ok' : 'no'}">${costText(b.cost)}</span>`,
        button: 'วาง', enabled: canPay(w, b.cost),
        onClick: () => { this.close(); g.startPlacing(type); },
      });
    }
    head('— ซัมม่อนครีป —');
    const foes = M.aliveSlots().filter((s) => s !== M.me);
    for (const [type, c] of Object.entries(CREEPS)) {
      const locked = c.needs && ![...M.S.values()].some((s) => s.owner === M.me && s.type === c.needs && s.built >= 1);
      const r = document.createElement('div');
      r.className = 'svc-row summon-row';
      r.innerHTML = `<div class="svc-icon"></div><div class="svc-main"><div class="svc-title">${c.name}</div><div class="svc-sub">${c.desc}${locked ? ' · 🔒 ต้องมีรังเพาะ' : ''}</div>
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
    $('svc-title').textContent = 'บอร์ดประกาศล่าค่าหัว';
    $('svc-hint').textContent = 'รับงานได้พร้อมกัน 2 งาน · ไปดูที่เกิดเหตุ ตามรอยให้ครบ 3 จุด แล้วจะรู้ว่ามันซ่อนที่ไหนและแพ้อะไร · ใบประกาศใหม่มาทุกเช้า';
    const reward = (c) => `<span class="cost ok">● ${c.coins}</span>${c.items.map(([id, n]) => `<span class="cost ok"><img src="${itemIconURL(id)}">${ITEMS[id].name}${n > 1 ? ` ×${n}` : ''}</span>`).join('')}`;
    const when = { night: 'ออกกลางคืน', day: 'ออกกลางวัน', always: 'ออกทั้งวัน' };
    for (const a of K.active) {
      const c = a.c, n = a.found.filter(Boolean).length;
      const status = a.state === 'scene' ? `กำลังตามรอย (${n}/3) — ไปที่เกิดเหตุตามเข็มทิศ`
        : a.state === 'hunt' ? `ตามล่าที่รัง · จุดอ่อน: ${AFFIXES[c.affix].name} — ${AFFIXES[c.affix].hint}` : 'ล่าสำเร็จแล้ว! ส่งหลักฐานเพื่อรับรางวัล';
      const claim = a.state === 'trophy';
      this.row({
        icon: itemIconURL('trophy'), title: `<span class="contract-tag">กำลังทำ</span>${c.name}`, sub: `${c.title} · ${status}`, cost: reward(c),
        button: claim ? 'ส่งหลักฐาน' : 'ยกเลิกงาน', enabled: !claim || g.bag.count('trophy') > 0,
        onClick: () => (claim ? K.claim(a) : K.abandon(a)),
      });
      this.list.lastChild.classList.add('contract');
    }
    for (const c of K.offers) {
      this.row({
        icon: itemIconURL('trophy'), title: `<span class="contract-tag">${when[c.time]}</span>${c.title}`, sub: `"${c.text}" — ${c.giver}`, cost: reward(c),
        button: 'รับงาน', enabled: K.active.length < 2,
        onClick: () => K.take(c),
      });
      this.list.lastChild.classList.add('contract');
    }
    if (!K.active.length && !K.offers.length) this.list.innerHTML = '<div class="svc-empty">ยังไม่มีใบประกาศใหม่... กลับมาพรุ่งนี้เช้า</div>';
  }

  // the wandering pedlar: a few rare wares, a treasure map, and he pays more for treasure
  renderMerchant() {
    const g = this.g, m = g.events.merchant;
    $('svc-title').textContent = 'แผงของพ่อค้าเร่';
    $('svc-hint').textContent = 'ของหายากจากแดนไกล มีจำกัด หมดแล้วหมดเลย!';
    if (!m) return;
    for (const w of m.stock) {
      if (w.id === 'map') {
        this.row({
          title: 'แผนที่ขุมทรัพย์', sub: 'ชี้ทางไปหีบสมบัติที่ยังไม่มีใครเปิด (แสดงบนเข็มทิศ)',
          cost: `<span class="cost ${g.coins >= w.price ? 'ok' : 'no'}">● ${w.price}</span>`,
          button: w.left > 0 ? 'ซื้อ' : 'ขายหมดแล้ว', enabled: w.left > 0 && g.coins >= w.price,
          onClick: () => { if (g.events.buyMap()) { g.coins -= w.price; w.left--; g.audio.coin(); } else g.ui.toast('ไม่มีหีบที่ยังไม่ได้เปิดเหลือแล้ว'); },
        });
        continue;
      }
      const def = ITEMS[w.id];
      const fits = g.bag.canAdd(w.id, 1);
      this.row({
        icon: itemIconURL(w.id), title: `${def.name} <span class="pips">เหลือ ${w.left}</span>`, sub: def.desc,
        cost: `<span class="cost ${g.coins >= w.price ? 'ok' : 'no'}">● ${w.price}</span>`,
        button: w.left <= 0 ? 'ขายหมดแล้ว' : fits ? 'ซื้อ' : 'กระเป๋าเต็ม', enabled: w.left > 0 && fits && g.coins >= w.price,
        onClick: () => { g.coins -= w.price; w.left--; g.bag.add(w.id, 1); g.audio.coin(); },
      });
    }
  }

  renderSell(mult = 1) {
    const g = this.g;
    const price = (id) => Math.round(ITEMS[id].value * (ITEMS[id].kind === 'treasure' ? mult : 1));
    $('svc-title').textContent = mult > 1 ? 'ขายของให้พ่อค้าเร่' : 'ขายของ';
    $('svc-hint').textContent = mult > 1 ? 'สมบัติข้าให้ราคาดีกว่าเจ้าเทียนหลอมนั่นอีก! (×1.3)' : 'สมบัติขายได้ราคาดี วัตถุดิบข้ารับซื้อถูก ๆ';
    const ids = [...new Set(g.bag.items.map((it) => it.id))].sort((a, b) => (ITEMS[a].kind === 'treasure' ? -1 : 1) - (ITEMS[b].kind === 'treasure' ? -1 : 1) || ITEMS[b].value - ITEMS[a].value);
    const treasures = ids.filter((id) => ITEMS[id].kind === 'treasure');
    if (treasures.length) {
      const total = treasures.reduce((s, id) => s + price(id) * g.bag.count(id), 0);
      this.row({
        title: 'ขายสมบัติทั้งหมด', sub: treasures.map((id) => `${ITEMS[id].name} ×${g.bag.count(id)}`).join(' · '),
        cost: `<span class="cost ok">+● ${total}</span>`, button: 'ขายหมด', enabled: true,
        onClick: () => { treasures.forEach((id) => g.bag.remove(id, g.bag.count(id))); g.coins += total; g.audio.coin(); g.ui.toast(`ขายสมบัติได้ ${total} เหรียญ`); },
      });
    }
    if (!ids.length) { this.list.innerHTML = '<div class="svc-empty">กระเป๋าว่างเปล่า</div>'; return; }
    for (const id of ids) {
      const def = ITEMS[id], have = g.bag.count(id);
      this.row({
        icon: itemIconURL(id), title: `${def.name} ×${have}`, sub: def.kind === 'treasure' ? 'สมบัติ' : def.kind === 'use' ? 'ยา' : 'วัตถุดิบ',
        cost: `<span class="cost ok">+● ${price(id)}</span>`, button: 'ขาย 1', enabled: def.value > 0,
        onClick: () => { g.bag.remove(id, 1); g.coins += price(id); g.audio.coin(); },
      });
    }
  }
}
