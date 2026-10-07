// Path upgrades: every path (class) has two lines of four steps. Experience levels you up and
// each level is a point; the deeper steps also ask for the path's own keepsake, which you only
// earn by playing the path its way (parrying, ringing on the beat, feeding leeches, burying
// the dead, burning things). Steps of both lines can be mixed, but only one line can be taken to
// its last step, which changes how the path plays.
//
// The story keeps one Progress in the save; an online match starts a fresh one at level 1 that
// levels much faster (src/moba.js gives the experience).
import { CLASSES } from './classes.js';

// what each step costs: points, keepsakes
export const STEP_COST = [[1, 0], [1, 1], [2, 2], [2, 3]];

export const TREES = {
  wanderer: {
    token: { name: 'ตราดาบบิ่น', icon: '🗡', feat: 'ปัดสำเร็จ หรือฆ่าด้วยฟันหนัก', every: [5, 3] },
    lines: [
      { id: 'blade', name: 'ดาบพเนจร', blurb: 'เน้นบุก ฟันไวและแรง', steps: [
        { id: 'keen', name: 'คมดาบ', desc: 'ฟันเบาแรงขึ้น 20%' },
        { id: 'flurry', name: 'ฟันต่อเนื่อง', desc: 'ฟันเบาเร็วขึ้น 15% และเปลืองแรงน้อยลง 20%' },
        { id: 'cleave', name: 'ฟันทะลวง', desc: 'ฟันหนักแรงขึ้น 35% และไกลขึ้นครึ่งเมตร' },
        { id: 'crescent', name: 'ดาบจันทร์เสี้ยว', desc: 'ท่าใหม่: ฟันหนักปล่อยคลื่นดาบรูปจันทร์เสี้ยวพุ่งไปข้างหน้า 8 เมตร ตัดทุกอย่างในแนว' },
      ] },
      { id: 'survivor', name: 'ผู้รอด', blurb: 'เน้นตั้งรับ ปัดแล้วสวน', steps: [
        { id: 'tough', name: 'หนังเหนียว', desc: 'เลือดสูงสุด +20' },
        { id: 'deflect', name: 'ปัดแม่น', desc: 'ช่วงเวลาปัดยาวขึ้น 40% · ปัดสำเร็จได้แรงคืนเพิ่ม' },
        { id: 'secondwind', name: 'ลมหายใจที่สอง', desc: 'ตั้งหลัก [G] พักแค่ 18 วินาที และฟื้นเลือด 25' },
        { id: 'riposte', name: 'สวนกลับ', desc: 'ท่าใหม่: ปัดสำเร็จแล้วสวนกลับอัตโนมัติ ฟันหนักใส่ผู้โจมตีทันที (ใช้กับผู้เล่นได้)' },
      ] },
    ],
  },
  bell: {
    token: { name: 'เศษระฆังร้าว', icon: '🔔', feat: 'ฟันโดนตรงจังหวะ', every: [20, 12] },
    lines: [
      { id: 'rhythm', name: 'จังหวะ', blurb: 'ตีตรงจังหวะให้ไต่สเกลไม่หยุด', steps: [
        { id: 'ear', name: 'หูทอง', desc: 'ช่วงที่นับว่าตรงจังหวะกว้างขึ้น 40%' },
        { id: 'scale', name: 'ไต่สเกล', desc: 'จังหวะต่อเนื่องสะสมได้ถึง ×9 (ตีแรงสุดเกือบ ×3)' },
        { id: 'sustain', name: 'กังวานค้าง', desc: 'พลังกังวานขึ้นเร็วขึ้น 50% · หลุดจังหวะไม่เสียกังวานและเสียจังหวะต่อเนื่องแค่ 2' },
        { id: 'symphony', name: 'ซิมโฟนีระฆัง', desc: 'ท่าใหม่: ตอนจังหวะต่อเนื่อง ×5 ขึ้นไป ทุกครั้งที่ตีตรงจังหวะจะสั่นเป็นวงคลื่นเสียง ตีทุกอย่างรอบตัว 4 เมตร' },
      ] },
      { id: 'greatbell', name: 'ระฆังใหญ่', blurb: 'ตีหนัก เสียงสะท้อนไกล', steps: [
        { id: 'weight', name: 'ระฆังหนัก', desc: 'ฟันหนักแรงขึ้น 30%' },
        { id: 'wave', name: 'คลื่นกังวาน', desc: 'ระฆังใหญ่กว้างขึ้น 10 → 14 เมตร และมึนงงนานขึ้น' },
        { id: 'echo', name: 'เสียงสะท้อนยาว', desc: 'เคาะเบาเผยศัตรูไกล 90 เมตร นาน 14 วินาที · ศัตรูที่ถูกเผยรับดาเมจ +25%' },
        { id: 'tolling', name: 'ระฆังก้อง', desc: 'ท่าใหม่: ระฆังใหญ่ใช้กังวานแค่ 70 และก้องตามอีก 3 ครั้ง ทุก 1 วินาที' },
      ] },
    ],
  },
  leech: {
    token: { name: 'ปลิงอิ่มเลือด', icon: '🩸', feat: 'ปลิงนำเลือดกลับมาเติม (นับทุก 1 เลือด)', every: [60, 35] },
    lines: [
      { id: 'brood', name: 'ฝูงปลิง', blurb: 'เลี้ยงปลิงให้ทำงานแทน', steps: [
        { id: 'fat', name: 'ปลิงอ้วน', desc: 'ปลิงดูดเลือดเร็วขึ้น 50%' },
        { id: 'swarm', name: 'ฝูงใหญ่', desc: 'ส่งปลิงออกล่าได้พร้อมกัน 5 ตัว' },
        { id: 'homing', name: 'ปลิงกตัญญู', desc: 'เลือดที่ปลิงนำกลับมา ×1.5 · ปาปลิงใช้เลือดแค่ 2' },
        { id: 'burst', name: 'ปลิงระเบิด', desc: 'ท่าใหม่: G เรียกปลิงกลับ = ปลิงที่เกาะอยู่ระเบิด ตีแรงและทำให้ศัตรูรอบ ๆ เลือดไหล (แต่ยังนำเลือดกลับมา)' },
      ] },
      { id: 'surgeon', name: 'มีดผ่าตัด', blurb: 'กรีดลึก เลือดยิ่งน้อยยิ่งอันตราย', steps: [
        { id: 'scalpel', name: 'มีดคม', desc: 'ฟันเบาแรงขึ้น 25%' },
        { id: 'deepcut', name: 'แผลลึก', desc: 'เลือดไหลแรงขึ้นและนาน 5 วินาที' },
        { id: 'bloodlust', name: 'คลั่งเลือด', desc: 'เลือดคลั่งสูงสุด ×2.4 → ×3.0' },
        { id: 'dissect', name: 'ผ่าตัดเลือดเย็น', desc: 'ท่าใหม่: ฟันโดนเป้าเดิม 4 ครั้งติด ครั้งที่ 4 เป็น "ผ่า" แรง ×3 และดูดเลือดคืน 6' },
      ] },
    ],
  },
  coffin: {
    token: { name: 'ดินหลุมศพ', icon: '⚰', feat: 'ยกโลงกันการโจมตี · เก็บศพ (×2) · ฝังศพ (×3)', every: [8, 5] },
    lines: [
      { id: 'ironwall', name: 'กำแพงเหล็ก', blurb: 'โลงคือป้อมปราการเดินได้', steps: [
        { id: 'plated', name: 'โลงหุ้มเหล็ก', desc: 'รับดาเมจลดลง 12%' },
        { id: 'reflect', name: 'กำแพงสะท้อน', desc: 'ยกโลงกันการโจมตีแล้วสะท้อนแรงกลับใส่ผู้โจมตี' },
        { id: 'quake', name: 'แผ่นดินไหว', desc: 'ทุบพื้นกว้างขึ้น 1.2 เมตรและแรงขึ้น 25%' },
        { id: 'bulldoze', name: 'โลงพุ่งชน', desc: 'ท่าใหม่: ยกโลงแล้วเดินได้เร็วเต็มที่ ศัตรูที่ขวางหน้าโลงถูกดันกระเด็นและเซ' },
      ] },
      { id: 'necro', name: 'ผู้ปลุกศพ', blurb: 'ยิ่งแบกศพมาก ยิ่งแกร่ง', steps: [
        { id: 'roomy', name: 'โลงกว้าง', desc: 'เก็บศพได้ 6 ช่อง' },
        { id: 'strength', name: 'พลังศพ', desc: 'ศพในโลงแต่ละตัว ตีแรงขึ้น +6%' },
        { id: 'hallowed', name: 'หลุมศักดิ์สิทธิ์', desc: 'ฝังศพฟื้นเลือด 40 → 70' },
        { id: 'lingering', name: 'ศพไม่ยอมหลับ', desc: 'ท่าใหม่: ฝังศพแล้วดินระเบิดตีรอบตัว 5 เมตร และพลังของศพที่ฝังติดตัวต่ออีก 45 วินาที' },
      ] },
    ],
  },
  wick: {
    token: { name: 'ไขเทียนดำ', icon: '🕯', feat: 'ฟันโดนตอนไฟร้อนเกินครึ่ง หรือลอบโจมตีจากความมืด', every: [15, 10] },
    lines: [
      { id: 'flame', name: 'เปลวเพลิง', blurb: 'ทุกอย่างต้องลุกไหม้', steps: [
        { id: 'blaze', name: 'ไฟแรง', desc: 'ศัตรูติดไฟแรงขึ้น 60%' },
        { id: 'stoke', name: 'โหมไฟ', desc: 'ไฟร้อนขึ้นเร็วขึ้น 50% และระยะเหวี่ยงจากความร้อนไกลขึ้น' },
        { id: 'tallow', name: 'ไขทนไฟ', desc: 'เทียนละลายช้าลงครึ่งหนึ่ง' },
        { id: 'firestorm', name: 'พายุไฟ', desc: 'ท่าใหม่: หมุนรอบตัว (ฟันหนัก) ทิ้งวงไฟไว้บนพื้น 4 วินาที เผาทุกอย่างที่เหยียบ' },
      ] },
      { id: 'shadow', name: 'เงามืด', blurb: 'หายไปในความมืด แล้วโผล่มาเผา', steps: [
        { id: 'longwick', name: 'ไส้เทียนยาว', desc: 'เทียนที่ปักอยู่ได้ 150 วินาที และปักได้ 4 เล่ม' },
        { id: 'stalk', name: 'ย่องในเงา', desc: 'ตอนป้องไฟ เดินเร็วขึ้น 25% และเทียนค่อย ๆ หล่อคืน' },
        { id: 'ward', name: 'แสงขับไล่', desc: 'เทียนที่ปักกันร่างซีดได้กว้าง 7.5 เมตร และหล่อเทียนเร็วขึ้น' },
        { id: 'ambush', name: 'ลอบเผา', desc: 'ท่าใหม่: ภายใน 2 วินาทีหลังเลิกป้องไฟ ฟันแรกแรง ×3 และเผาไฟลุกท่วม' },
      ] },
    ],
  },
};

// ------------------------------------------------------------------------------------------------
export class Progress {
  constructor({ online = false } = {}) {
    this.online = online;
    this.xp = 0;
    this.level = 1;
    this.owned = {};      // class -> [step ids]
    this.tokens = {};     // class -> keepsakes held
    this.feats = {};      // class -> progress toward the next keepsake
    this.spent = {};      // class -> points spent
    this.onChange = null;
  }

  static MAX_LEVEL = 15;
  need(level = this.level) { return this.online ? 25 + 15 * (level - 1) : 40 + 30 * (level - 1); }
  points(cls) { return this.level - 1 - (this.spent[cls] || 0); }
  has(cls, id) { return !!this.owned[cls]?.includes(id); }

  addXP(n) {
    if (n <= 0 || this.level >= Progress.MAX_LEVEL) return 0;
    this.xp += n;
    let ups = 0;
    while (this.level < Progress.MAX_LEVEL && this.xp >= this.need()) { this.xp -= this.need(); this.level++; ups++; }
    if (this.level >= Progress.MAX_LEVEL) this.xp = 0;
    this.onChange?.('xp', ups);
    return ups;
  }

  // a deed done the path's way; every few of them is a keepsake
  feat(cls, n = 1) {
    const t = TREES[cls]?.token;
    if (!t) return 0;
    const every = t.every[this.online ? 1 : 0];
    this.feats[cls] = (this.feats[cls] || 0) + n;
    let got = 0;
    while (this.feats[cls] >= every) { this.feats[cls] -= every; this.tokens[cls] = (this.tokens[cls] || 0) + 1; got++; }
    if (got) this.onChange?.('token', got, cls);
    return got;
  }

  // null when it can be bought, otherwise why not
  why(cls, li, si) {
    const tree = TREES[cls], line = tree.lines[li], step = line.steps[si], [pts, tok] = STEP_COST[si];
    if (this.has(cls, step.id)) return 'ได้แล้ว';
    if (si > 0 && !this.has(cls, line.steps[si - 1].id)) return 'ต้องได้ขั้นก่อนหน้าก่อน';
    if (si === 3) {
      const other = tree.lines[1 - li].steps[3];
      if (this.has(cls, other.id)) return `ไปสุดสายได้สายเดียว (เลือก${other.name}แล้ว)`;
    }
    if (this.points(cls) < pts) return `แต้มไม่พอ (ต้องการ ${pts})`;
    if ((this.tokens[cls] || 0) < tok) return `${tree.token.name}ไม่พอ (ต้องการ ${tok})`;
    return null;
  }

  buy(cls, li, si) {
    if (this.why(cls, li, si)) return false;
    const [pts, tok] = STEP_COST[si];
    (this.owned[cls] = this.owned[cls] || []).push(TREES[cls].lines[li].steps[si].id);
    this.spent[cls] = (this.spent[cls] || 0) + pts;
    this.tokens[cls] = (this.tokens[cls] || 0) - tok;
    this.onChange?.('buy', 1, cls);
    return true;
  }

  serialize() { return { xp: this.xp, level: this.level, owned: this.owned, tokens: this.tokens, feats: this.feats, spent: this.spent }; }
  load(d = {}) {
    Object.assign(this, { xp: d.xp || 0, level: d.level || 1, owned: d.owned || {}, tokens: d.tokens || {}, feats: d.feats || {}, spent: d.spent || {} });
  }
}

// ------------------------------------------------------------------------------------------------
// The upgrade screen (K): two lines side by side, four steps each
const $ = (id) => document.getElementById(id);

export class SkillsUI {
  constructor(game) {
    this.g = game;
    this.el = $('skills');
    $('skills-close').addEventListener('click', () => this.close());
  }

  get open() { return !this.el.classList.contains('hidden'); }

  show() { this.el.classList.remove('hidden'); this.render(); }

  close() {
    this.el.classList.add('hidden');
    this.g.onSkillsClosed();
  }

  update(input) {
    if (input.consume('escape') || input.consume('skills') || input.consume('bag') || input.consume('interact')) this.close();
  }

  render() {
    const g = this.g, pr = g.progress, cls = g.kit.id, tree = TREES[cls], c = CLASSES[cls];
    const t = tree.token, have = pr.tokens[cls] || 0, every = t.every[pr.online ? 1 : 0];
    $('skills-title').textContent = `${c.icon} สายอัพเกรด — ${c.name}`;
    const maxed = pr.level >= Progress.MAX_LEVEL;
    $('skills-head').innerHTML = `
      <div class="sk-lv">เลเวล <b>${pr.level}</b>${maxed ? ' (สูงสุด)' : ''}<div class="sk-xp"><i style="width:${maxed ? 100 : (pr.xp / pr.need() * 100).toFixed(1)}%"></i></div><span>${maxed ? '' : `${Math.floor(pr.xp)}/${pr.need()} XP`}</span></div>
      <div class="sk-pts">แต้ม <b>${pr.points(cls)}</b></div>
      <div class="sk-tok">${t.icon} ${t.name} <b>${have}</b><span>ได้อีก 1 เมื่อ${t.feat} ครบ ${every} (${pr.feats[cls] || 0}/${every})</span></div>`;
    const cols = tree.lines.map((line, li) => {
      const steps = line.steps.map((s, si) => {
        const own = pr.has(cls, s.id), why = pr.why(cls, li, si), [pts, tok] = STEP_COST[si];
        const cost = `${pts} แต้ม${tok ? ` · ${t.icon}${tok}` : ''}`;
        return `<button class="sk-step ${own ? 'own' : why ? 'locked' : 'can'} ${si === 3 ? 'cap' : ''}" data-l="${li}" data-s="${si}" title="${own ? '' : why || 'กดเพื่อปลดล็อก'}">
          <div class="sk-name">${si === 3 ? '★ ' : ''}${s.name}</div><div class="sk-desc">${s.desc}</div>
          <div class="sk-cost">${own ? '✔ ได้แล้ว' : why && why !== 'ได้แล้ว' ? `${cost} — ${why}` : cost}</div></button>`;
      }).join('<div class="sk-link"></div>');
      return `<div class="sk-col"><div class="sk-line">${line.name}</div><div class="sk-blurb">${line.blurb}</div>${steps}</div>`;
    }).join('');
    $('skills-cols').innerHTML = cols;
    $('skills-cols').querySelectorAll('.sk-step.can').forEach((b) => b.addEventListener('click', () => {
      const li = +b.dataset.l, si = +b.dataset.s;
      if (pr.buy(cls, li, si)) {
        g.kit.refresh?.();
        g.applyKitStats();
        g.audio.discover();
        g.ui.combatText(`ปลดล็อก: ${tree.lines[li].steps[si].name}`, 'parry');
        g.save();
      }
      this.render();
    }));
  }
}
