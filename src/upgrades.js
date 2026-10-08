// Path upgrades (K). Every path (class) has its own level and its own skill tree:
//   - a trunk everyone on the path takes first,
//   - two lines; putting a point into one closes the other for good,
//   - each line splits into small branches you can mix, then a "pick one of two" node and a
//     capstone that is also one of two (the other closes for good).
// Levels are hard won (30 is the top), so a tree can never be bought whole: two people on the
// same path end up playing it differently. The deeper nodes also ask for the path's keepsake,
// earned only by playing the path its way (parrying, ringing on the beat, feeding leeches,
// burying the dead, burning things).
//
// The story keeps one Progress in the save; an online match starts a fresh one at level 1 that
// levels fast and tops out at 15 (src/moba.js gives the experience).
import { CLASSES } from './classes.js';

// ------------------------------------------------------------------------------------------------
// The Coffin-Bearer's full tree (round 1 of the new trees). Node: id, name, desc, pts, tok
// (keepsakes), lv (path level needed). The other paths still use their first trees below,
// laid out the same way until their own full trees arrive.
const COFFIN = {
  token: { name: 'ดินหลุมศพ', icon: '⚰', feat: 'ยกโลงกันการโจมตี · เก็บศพ (×2) · ฝังศพ (×3)', every: [8, 5] },
  trunk: [
    { id: 'c_back', name: 'หลังแข็ง', desc: 'เลือดสูงสุด +10', pts: 1, lv: 2 },
    { id: 'c_thick', name: 'โลงหนา', desc: 'ยกโลงกันการโจมตีใช้แรงน้อยลง 20%', pts: 1, lv: 3 },
    { id: 'c_spade', name: 'พลั่วสัปเหร่อ', desc: 'เหวี่ยงโลง (ฟันเบา) แรงขึ้น 15%', pts: 1, lv: 5 },
    { id: 'c_stride', name: 'ก้าวมั่น', desc: 'แบกศพเต็มโลงก็ไม่ช้าลง และเดินเร็วขึ้น 5%', pts: 2, lv: 7 },
  ],
  lines: [
    {
      id: 'ironwall', name: 'กำแพงเหล็ก', blurb: 'โลงคือป้อมปราการเดินได้ · ตั้งรับ สะท้อน ทุบพื้น',
      root: { id: 'a_root', name: 'ทางแห่งกำแพง', desc: 'รับดาเมจลดลง 5% และเลือดสูงสุด +10', pts: 1, lv: 4 },
      branches: [
        { name: 'ป้องกัน', nodes: [
          { id: 'plated', name: 'โลงหุ้มเหล็ก', desc: 'รับดาเมจลดลงอีก 12%' },
          { id: 'a_iron', name: 'เหล็กสองชั้น', desc: 'ยกโลงกันการโจมตีใช้แรงน้อยลงอีก 30%' },
          { id: 'a_unmoved', name: 'ไม่สะเทือน', desc: 'ยกโลงกันแล้วไม่ถูกดันถอย · แรงหมดก็ไม่การ์ดแตก (ทุก 10 วินาที)' },
        ] },
        { name: 'สวนกลับ', nodes: [
          { id: 'reflect', name: 'กำแพงสะท้อน', desc: 'ยกโลงกันการโจมตีแล้วสะท้อนแรงกลับใส่ผู้โจมตี' },
          { id: 'a_bash', name: 'กระแทกโลง', desc: 'แรงสะท้อน ×2 และผู้โจมตีเซ 0.8 วินาที' },
          { id: 'a_vengeance', name: 'แค้นโลง', desc: 'กันได้ 3 ครั้ง การเหวี่ยงครั้งต่อไปแรง ×2' },
        ] },
        { name: 'ทุบพื้น', nodes: [
          { id: 'quake', name: 'แผ่นดินไหว', desc: 'ทุบพื้นกว้างขึ้น 1.2 เมตรและแรงขึ้น 25%' },
          { id: 'a_fissure', name: 'รอยแยก', desc: 'ศัตรูที่โดนทุบพื้นเซนาน 1.3 วินาที' },
          { id: 'a_sinkhole', name: 'หลุมยุบ', desc: 'ทุบพื้นเร็วขึ้น 20% และใช้แรงน้อยลง 30%' },
        ] },
      ],
      choice: [
        { id: 'a_fortress', name: 'ป้อมเคลื่อนที่', desc: 'ยกโลงแล้วยังเดินได้เร็ว 80% (ปกติ 45%)' },
        { id: 'a_bastion', name: 'ปราการ', desc: 'ทุกครั้งที่ยกโลงกันการโจมตีได้ ฟื้นเลือด 3' },
      ],
      cap: [
        { id: 'bulldoze', name: 'โลงพุ่งชน', desc: 'ท่าใหม่: ยกโลงแล้ววิ่งได้เต็มที่ ศัตรูที่ขวางหน้าโลงถูกดันกระเด็นและเซ' },
        { id: 'a_spin', name: 'โลงเหล็กหมุน', desc: 'ท่าใหม่: ฟันหนักกลายเป็นหมุนโลงกวาดรอบตัว 4.5 เมตร แรงขึ้น 20% โดนทุกทิศ' },
      ],
    },
    {
      id: 'necro', name: 'ผู้ปลุกศพ', blurb: 'ยิ่งแบกศพมาก ยิ่งแกร่ง · เก็บ ฝัง ปลุก',
      root: { id: 'b_root', name: 'กลิ่นศพ', desc: 'ศพค้างอยู่นาน 60 วินาที (ปกติ 30) และเก็บศพได้ไกลขึ้น', pts: 1, lv: 4 },
      branches: [
        { name: 'เก็บศพ', nodes: [
          { id: 'roomy', name: 'โลงกว้าง', desc: 'เก็บศพได้ 6 ช่อง' },
          { id: 'strength', name: 'พลังศพ', desc: 'ศพในโลงแต่ละตัว ตีแรงขึ้น +6%' },
          { id: 'b_stack', name: 'ศพซ้อน', desc: 'ศพในโลงแต่ละตัว รับดาเมจลดลง 4%' },
        ] },
        { name: 'ฝังศพ', nodes: [
          { id: 'hallowed', name: 'หลุมศักดิ์สิทธิ์', desc: 'ฝังศพฟื้นเลือด 40 → 70' },
          { id: 'b_rites', name: 'พิธีฝัง', desc: 'ฝังศพแล้วแรงเต็มทันที และเดินเร็วขึ้น 20% นาน 10 วินาที' },
          { id: 'b_cemetery', name: 'ป่าช้าเดินได้', desc: 'ยืนใกล้หลุมศพที่เจ้าขุดไว้ (6 เมตร) เลือดฟื้น 3 ต่อวินาที' },
        ] },
        { name: 'ปลุกศพ', nodes: [
          { id: 'b_drain', name: 'ดูดวิญญาณ', desc: 'ฆ่าศัตรูขณะมีศพในโลง ฟื้นเลือด 4' },
          { id: 'b_fear', name: 'ศพหลอน', desc: 'ฟันหนักมีโอกาส 30% ทำให้ศัตรูขวัญเสีย หยุดนิ่ง 1.5 วินาที' },
          { id: 'b_harvest', name: 'เก็บเกี่ยว', desc: 'เก็บศพแล้วฟื้นเลือด 8 และแรง 20' },
        ] },
      ],
      choice: [
        { id: 'b_ossuary', name: 'โลงกระดูก', desc: 'เก็บศพได้ 8 ช่อง' },
        { id: 'b_onesoul', name: 'วิญญาณเดียว', desc: 'ถ้ามีศพในโลงไม่เกิน 2 ตัว ตีแรงขึ้น 25%' },
      ],
      cap: [
        { id: 'lingering', name: 'ศพไม่ยอมหลับ', desc: 'ท่าใหม่: ฝังศพแล้วดินระเบิดตีรอบตัว 5 เมตร และพลังของศพที่ฝังติดตัวต่ออีก 45 วินาที' },
        { id: 'b_legion', name: 'กองทัพในโลง', desc: 'ท่าใหม่: ยกโลงค้างแล้วกด G = ปล่อยศพทั้งโลงระเบิดรอบตัว 6 เมตร (แรง 2.5 ต่อศพ) และฟื้นเลือด 5 ต่อศพ' },
      ],
    },
  ],
};

// node prices by place in a line
const PRICE = {
  branch: [{ pts: 2, tok: 0, lv: 6 }, { pts: 2, tok: 1, lv: 10 }, { pts: 3, tok: 2, lv: 15 }],
  choice: { pts: 3, tok: 2, lv: 12 },
  cap: { pts: 5, tok: 3, lv: 20 },
};

// the first trees of the other paths: a line of four steps each, laid out as root, a short branch
// and a capstone
const FIRST = {
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

// every tree as nodes with their place, price and what they need
function build(cls, src) {
  const nodes = {}, add = (n, extra) => { nodes[n.id] = { ...n, ...extra }; return nodes[n.id]; };
  const trunk = (src.trunk || []).map((n, i, a) => add(n, { line: null, place: 'trunk', req: i ? [a[i - 1].id] : [] }));
  const last = trunk.length ? [trunk[trunk.length - 1].id] : [];
  const lines = src.lines.map((L) => {
    const root = add(L.root, { line: L.id, place: 'root', req: last });
    const branches = L.branches.map((b) => ({ name: b.name, nodes: b.nodes.map((n, i, a) => add(n, { ...PRICE.branch[i + (3 - a.length)], ...n, line: L.id, place: 'branch', req: [i ? a[i - 1].id : root.id] })) }));
    const all = branches.flatMap((b) => b.nodes.map((n) => n.id));
    const choice = (L.choice || []).map((n) => add(n, { ...PRICE.choice, ...n, line: L.id, place: 'choice', excl: `${L.id}:choice`, reqAny: { ids: all, n: Math.min(2, all.length) } }));
    const cap = L.cap.map((n) => add(n, {
      ...PRICE.cap, ...n, line: L.id, place: 'cap', excl: `${L.id}:cap`,
      ...(choice.length ? { req: [], reqAny: { ids: choice.map((c) => c.id), n: 1 }, reqMore: { ids: all, n: 4 } } : { req: [all[all.length - 1]] }),
    }));
    return { id: L.id, name: L.name, blurb: L.blurb, root, branches, choice, cap };
  });
  return { cls, token: src.token, trunk, lines, nodes };
}

function fromFirst(t) {
  return {
    token: t.token,
    lines: t.lines.map((L) => ({
      id: L.id, name: L.name, blurb: L.blurb,
      root: { ...L.steps[0], pts: 1, lv: 2 },
      branches: [{ name: '', nodes: L.steps.slice(1, 3) }],
      cap: [{ ...L.steps[3], pts: 5, tok: 3, lv: 18 }],
    })),
  };
}

export const TREES = { coffin: build('coffin', COFFIN) };
for (const [cls, t] of Object.entries(FIRST)) TREES[cls] = build(cls, fromFirst(t));

// ------------------------------------------------------------------------------------------------
export class Progress {
  constructor({ online = false } = {}) {
    this.online = online;
    this.paths = {};      // class -> { xp, level }
    this.owned = {};      // class -> [node ids]
    this.tokens = {};     // class -> keepsakes held
    this.feats = {};      // class -> progress toward the next keepsake
    this.spent = {};      // class -> points spent
    this.line = {};       // class -> the line chosen (the other is closed for good)
    this.current = null;  // the path being played (the XP goes to it)
    this.recent = {};     // enemy type -> { n, t }: the same kill again and again is worth less
    this.onChange = null;
  }

  get MAX() { return this.online ? 15 : 30; }
  static MAX_LEVEL = 30;
  path(cls = this.current) { return (this.paths[cls] ||= { xp: 0, level: 1 }); }
  get level() { return this.path().level; }
  get xp() { return this.path().xp; }
  levelOf(cls) { return this.path(cls).level; }
  // experience for the next level: a steep climb offline (level 30 is ~52,000 in all)
  need(level = this.level) {
    if (this.online) return 25 + 15 * (level - 1);
    return Math.round((120 + 34 * Math.pow(level - 1, 1.45)) / 10) * 10;
  }
  points(cls) { return this.levelOf(cls) - 1 - (this.spent[cls] || 0); }
  has(cls, id) { return !!this.owned[cls]?.includes(id); }
  setClass(cls) {
    this.current = cls;
    if (this.legacyXP) { this.addXP(this.legacyXP); this.legacyXP = 0; }
  }

  addXP(n, cls = this.current) {
    if (!cls) return 0;
    const pa = this.path(cls);
    if (n <= 0 || pa.level >= this.MAX) return 0;
    pa.xp += n;
    let ups = 0;
    while (pa.level < this.MAX && pa.xp >= this.need(pa.level)) { pa.xp -= this.need(pa.level); pa.level++; ups++; }
    if (pa.level >= this.MAX) pa.xp = 0;
    this.onChange?.('xp', ups, cls);
    return ups;
  }

  // what a kill is worth: less each time the same kind falls, recovering over a minute and a half
  killMul(type, time) {
    const r = this.recent[type] ||= { n: 0, t: time };
    r.n = Math.max(0, r.n - (time - r.t) / 90);
    r.t = time;
    const mul = Math.max(0.2, Math.pow(0.85, r.n));
    r.n += 1;
    return mul;
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

  lv(node) { return this.online ? Math.max(1, Math.ceil(node.lv / 2)) : node.lv; }

  // closed for good: the other line, or the other half of a pick-one-of-two
  closed(cls, node) {
    if (node.line && this.line[cls] && this.line[cls] !== node.line) return 'ปิดถาวร (เลือกอีกสายไปแล้ว)';
    if (node.excl) {
      const other = Object.values(TREES[cls].nodes).find((n) => n.excl === node.excl && n.id !== node.id && this.has(cls, n.id));
      if (other) return `ปิดถาวร (เลือก${other.name}ไปแล้ว)`;
    }
    return null;
  }

  // null when it can be bought, otherwise why not
  why(cls, id) {
    const tree = TREES[cls], node = tree?.nodes[id];
    if (!node) return 'ไม่มีสกิลนี้';
    if (this.has(cls, id)) return 'ได้แล้ว';
    const shut = this.closed(cls, node);
    if (shut) return shut;
    for (const r of node.req || []) if (!this.has(cls, r)) return `ต้องได้${tree.nodes[r].name}ก่อน`;
    for (const k of ['reqAny', 'reqMore']) {
      const q = node[k];
      if (!q) continue;
      const have = q.ids.filter((i) => this.has(cls, i)).length;
      if (have < q.n) return k === 'reqAny' && q.n === 1 ? 'ต้องเลือกขั้นก่อนหน้าก่อน' : `ต้องมีสกิลในสายนี้อีก ${q.n - have}`;
    }
    if (this.levelOf(cls) < this.lv(node)) return `ต้องเลเวล ${this.lv(node)}`;
    if (this.points(cls) < node.pts) return `แต้มไม่พอ (ต้องการ ${node.pts})`;
    if ((this.tokens[cls] || 0) < (node.tok || 0)) return `${tree.token.name}ไม่พอ (ต้องการ ${node.tok})`;
    return null;
  }

  // buying this closes something for good (first point in a line, or one of a pair)
  commits(cls, id) {
    const node = TREES[cls].nodes[id];
    if (node.line && !this.line[cls]) return `เลือกสาย "${TREES[cls].lines.find((l) => l.id === node.line).name}" แล้ว อีกสายจะปิดถาวร`;
    if (node.excl) {
      const other = Object.values(TREES[cls].nodes).find((n) => n.excl === node.excl && n.id !== id);
      if (other) return `เลือก "${node.name}" แล้ว "${other.name}" จะปิดถาวร`;
    }
    return null;
  }

  buy(cls, id) {
    if (this.why(cls, id)) return false;
    const node = TREES[cls].nodes[id];
    (this.owned[cls] ||= []).push(id);
    if (node.line) this.line[cls] ||= node.line;
    this.spent[cls] = (this.spent[cls] || 0) + node.pts;
    this.tokens[cls] = (this.tokens[cls] || 0) - (node.tok || 0);
    this.onChange?.('buy', 1, cls);
    return true;
  }

  serialize() {
    return { v: 2, paths: this.paths, owned: this.owned, tokens: this.tokens, feats: this.feats, spent: this.spent, line: this.line };
  }
  load(d = {}) {
    Object.assign(this, { paths: {}, owned: {}, spent: {}, line: {}, tokens: d.tokens || {}, feats: d.feats || {} });
    if (d.v === 2) {
      Object.assign(this, { paths: d.paths || {}, owned: d.owned || {}, spent: d.spent || {}, line: d.line || {} });
      return;
    }
    // a save from before the new trees: all the experience earned goes to the path being played
    // (at the new, steeper rate) and every point comes back to be spent again
    let xp = d.xp || 0;
    for (let l = 1; l < (d.level || 1); l++) xp += 40 + 30 * (l - 1);
    this.legacyXP = xp;
    this.refunded = Object.values(d.owned || {}).some((a) => a.length);
  }
}

// ------------------------------------------------------------------------------------------------
// The upgrade screen (K): the trunk across the top, the two lines below, each with its branches,
// its pick-one-of-two and its capstone. A choice that closes something asks first.
const $ = (id) => document.getElementById(id);

export class SkillsUI {
  constructor(game) {
    this.g = game;
    this.el = $('skills');
    $('skills-close').addEventListener('click', () => this.close());
  }

  get open() { return !this.el.classList.contains('hidden'); }

  show() { this.el.classList.remove('hidden'); this.pending = null; this.render(); }

  close() {
    this.el.classList.add('hidden');
    this.g.onSkillsClosed();
  }

  update(input) {
    if (this.pending && input.consume('escape')) { this.pending = null; this.render(); return; }
    if (input.consume('escape') || input.consume('skills') || input.consume('bag') || input.consume('interact')) this.close();
  }

  node(cls, n) {
    const pr = this.g.progress, own = pr.has(cls, n.id), why = pr.why(cls, n.id), t = TREES[cls].token;
    const shut = !own && pr.closed(cls, n);
    const cost = `${n.pts} แต้ม${n.tok ? ` · ${t.icon}${n.tok}` : ''} · Lv ${pr.lv(n)}`;
    const state = own ? 'own' : shut ? 'shut' : why ? 'locked' : 'can';
    const star = n.place === 'cap' ? '★ ' : n.place === 'choice' ? '◆ ' : '';
    return `<button class="sk-node ${state} ${n.place}" data-id="${n.id}" title="${own ? '' : why || 'กดเพื่อปลดล็อก'}">
      <div class="sk-name">${star}${n.name}</div><div class="sk-desc">${n.desc}</div>
      <div class="sk-cost">${own ? '✔ ได้แล้ว' : shut ? `✖ ${shut}` : why ? `${cost} — ${why}` : cost}</div></button>`;
  }

  render() {
    const g = this.g, pr = g.progress, cls = g.kit.id, tree = TREES[cls], c = CLASSES[cls];
    const t = tree.token, have = pr.tokens[cls] || 0, every = t.every[pr.online ? 1 : 0];
    $('skills-title').textContent = `${c.icon} ต้นไม้สกิล — ${c.name}`;
    const maxed = pr.levelOf(cls) >= pr.MAX, pa = pr.path(cls);
    $('skills-head').innerHTML = `
      <div class="sk-lv">เลเวล ${c.name} <b>${pa.level}</b>${maxed ? ' (สูงสุด)' : ''}<div class="sk-xp"><i style="width:${maxed ? 100 : (pa.xp / pr.need(pa.level) * 100).toFixed(1)}%"></i></div><span>${maxed ? '' : `${Math.floor(pa.xp)}/${pr.need(pa.level)} XP`}</span></div>
      <div class="sk-pts">แต้ม <b>${pr.points(cls)}</b></div>
      <div class="sk-tok">${t.icon} ${t.name} <b>${have}</b><span>ได้อีก 1 เมื่อ${t.feat} ครบ ${every} (${pr.feats[cls] || 0}/${every})</span></div>`;
    const N = (n) => this.node(cls, n);
    const trunk = tree.trunk.length ? `<div class="sk-trunk"><div class="sk-label">ลำต้น — ทุกคนในวิถีนี้</div><div class="sk-row">${tree.trunk.map(N).join('<i class="sk-arrow">→</i>')}</div></div>` : '';
    const lines = tree.lines.map((L) => {
      const shut = pr.line[cls] && pr.line[cls] !== L.id;
      const branches = L.branches.map((b) => `<div class="sk-branch">${b.name ? `<div class="sk-label">${b.name}</div>` : ''}${b.nodes.map(N).join('<i class="sk-down">↓</i>')}</div>`).join('');
      return `<div class="sk-col ${shut ? 'closed' : ''} ${pr.line[cls] === L.id ? 'chosen' : ''}">
        <div class="sk-line">${L.name}${shut ? ' — ปิดถาวร' : pr.line[cls] === L.id ? ' — สายของเจ้า' : ''}</div><div class="sk-blurb">${L.blurb}</div>
        ${N(L.root)}<i class="sk-down">↓</i>
        <div class="sk-branches">${branches}</div>
        ${L.choice.length ? `<i class="sk-down">↓</i><div class="sk-label">เลือก 1 ใน 2</div><div class="sk-pair">${L.choice.map(N).join('<i class="sk-or">หรือ</i>')}</div>` : ''}
        <i class="sk-down">↓</i><div class="sk-label">${L.cap.length > 1 ? 'ท่าไม้ตาย — เลือก 1 ใน 2' : 'ท่าไม้ตาย'}</div><div class="sk-pair">${L.cap.map(N).join('<i class="sk-or">หรือ</i>')}</div>
      </div>`;
    }).join('');
    const confirm = this.pending ? `<div class="sk-confirm"><div>⚠ ${pr.commits(cls, this.pending)}<br><small>เปลี่ยนใจภายหลังไม่ได้</small></div>
      <button data-ok="1">ยืนยัน</button><button data-ok="0">ยกเลิก</button></div>` : '';
    $('skills-cols').innerHTML = `${confirm}${trunk}<div class="sk-lines">${lines}</div>`;
    const root = $('skills-cols');
    root.querySelectorAll('.sk-confirm button').forEach((b) => b.addEventListener('click', () => {
      const id = this.pending; this.pending = null;
      if (b.dataset.ok === '1') this.take(cls, id); else this.render();
    }));
    root.querySelectorAll('.sk-node.can').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.id;
      if (pr.commits(cls, id)) { this.pending = id; this.render(); root.scrollTop = 0; return; }
      this.take(cls, id);
    }));
  }

  take(cls, id) {
    const g = this.g;
    if (g.progress.buy(cls, id)) {
      g.kit.refresh?.();
      g.applyKitStats();
      g.audio.discover();
      g.ui.combatText(`ปลดล็อก: ${TREES[cls].nodes[id].name}`, 'parry');
      g.save();
    }
    this.render();
  }
}
