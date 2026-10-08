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
// The trees. Node: id, name, desc, and optionally pts, tok (keepsakes), lv (path level needed);
// the price otherwise follows the node's place (TRUNK / PRICE below).
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

// node prices by place
const TRUNK = [{ pts: 1, lv: 2 }, { pts: 1, lv: 3 }, { pts: 1, lv: 5 }, { pts: 2, lv: 7 }];
const PRICE = {
  branch: [{ pts: 2, tok: 0, lv: 6 }, { pts: 2, tok: 1, lv: 10 }, { pts: 3, tok: 2, lv: 15 }],
  choice: { pts: 3, tok: 2, lv: 12 },
  cap: { pts: 5, tok: 3, lv: 20 },
};

// the other four paths, laid out the same way
const WANDERER = {
  token: { name: 'ตราดาบบิ่น', icon: '🗡', feat: 'ปัดสำเร็จ หรือฆ่าด้วยฟันหนัก', every: [5, 3] },
  trunk: [
    { id: 'w_grip', name: 'จับดาบมั่น', desc: 'ฟันเบาแรงขึ้น 8%' },
    { id: 'w_breath', name: 'ลมหายใจยาว', desc: 'วิ่งใช้แรงน้อยลง 30%' },
    { id: 'w_hide', name: 'ผิวด้าน', desc: 'เลือดสูงสุด +10' },
    { id: 'w_focus', name: 'ตั้งสมาธิ', desc: 'ตั้งหลัก [G] พักแค่ 24 วินาที (ปกติ 30)' },
  ],
  lines: [
    {
      id: 'blade', name: 'ดาบพเนจร', blurb: 'เน้นบุก · ความเร็ว ฟันหนัก และเลือดร้อน',
      root: { id: 'keen', name: 'คมดาบ', desc: 'ฟันเบาแรงขึ้น 20%' },
      branches: [
        { name: 'ความเร็ว', nodes: [
          { id: 'flurry', name: 'ฟันต่อเนื่อง', desc: 'ฟันเบาเร็วขึ้น 15% และใช้แรงน้อยลง 20%' },
          { id: 'w_dance', name: 'ระบำดาบ', desc: 'ฟันเบาโดน 3 ครั้งติดภายใน 2 วินาที ครั้งที่สามแรง ×1.6' },
          { id: 'w_edge', name: 'คมไม่หยุด', desc: 'ฟันเบาโดน ได้แรงคืน 3' },
        ] },
        { name: 'ฟันหนัก', nodes: [
          { id: 'cleave', name: 'ฟันทะลวง', desc: 'ฟันหนักแรงขึ้น 35% และไกลขึ้นครึ่งเมตร' },
          { id: 'w_sunder', name: 'ผ่าเกราะ', desc: 'ศัตรูที่โดนฟันหนักรับดาเมจ +20% นาน 5 วินาที' },
          { id: 'w_execute', name: 'ปลิดชีพ', desc: 'ฟันหนักใส่ศัตรูที่เลือดเหลือไม่ถึง 30% แรง ×2' },
        ] },
        { name: 'เลือดร้อน', nodes: [
          { id: 'w_thirst', name: 'กระหายศึก', desc: 'ฆ่าศัตรู ฟื้นเลือด 5' },
          { id: 'w_momentum', name: 'ได้ใจ', desc: 'ฆ่าแล้ว 6 วินาทีต่อมา ตีแรงขึ้น 20%' },
          { id: 'w_frenzy', name: 'บ้าคลั่ง', desc: 'เลือดต่ำกว่า 35% ตีแรงขึ้น 30%' },
        ] },
      ],
      choice: [
        { id: 'w_twin', name: 'ดาบเงาคู่', desc: 'ฟันเบาที่โดนทุกครั้งที่ 4 มีดาบเงาฟันซ้ำอีกครั้ง' },
        { id: 'w_heavyhand', name: 'มือหนัก', desc: 'ฟันหนักทำให้ศัตรูทั่วไปเซ 1 วินาทีเสมอ' },
      ],
      cap: [
        { id: 'crescent', name: 'ดาบจันทร์เสี้ยว', desc: 'ท่าใหม่: ฟันหนักปล่อยคลื่นดาบรูปจันทร์เสี้ยวพุ่งไปข้างหน้า 8 เมตร ตัดทุกอย่างในแนว' },
        { id: 'w_whirl', name: 'ดาบวน', desc: 'ท่าใหม่: ฟันหนักกลายเป็นหมุนดาบรอบตัว 3.8 เมตร โดนทุกทิศ แรงขึ้น 10%' },
      ],
    },
    {
      id: 'survivor', name: 'ผู้รอด', blurb: 'เน้นตั้งรับ · ปัด ทนทาน และฟื้นตัว',
      root: { id: 'tough', name: 'หนังเหนียว', desc: 'เลือดสูงสุด +20' },
      branches: [
        { name: 'ปัด', nodes: [
          { id: 'deflect', name: 'ปัดแม่น', desc: 'ช่วงเวลาปัดยาวขึ้น 40% · ปัดสำเร็จได้แรงคืน 10' },
          { id: 'w_perfect', name: 'ปัดไร้ที่ติ', desc: 'ปัดสำเร็จ ศัตรูเซนานขึ้นอีก 1 วินาที' },
          { id: 'w_disarm', name: 'ปลดอาวุธ', desc: 'ปัดสำเร็จ ศัตรูรับดาเมจ ×1.5 นาน 3 วินาที' },
        ] },
        { name: 'ทนทาน', nodes: [
          { id: 'w_guard', name: 'การ์ดเหล็ก', desc: 'ยกการ์ดกัน ดาเมจทะลุการ์ดเหลือครึ่งเดียว' },
          { id: 'w_iron', name: 'กายเหล็ก', desc: 'รับดาเมจลดลง 10%' },
          { id: 'w_last', name: 'ไม่ยอมตาย', desc: 'ครั้งแรกที่เลือดจะหมด เหลือ 1 แทน (ทุก 2 นาที)' },
        ] },
        { name: 'ฟื้นตัว', nodes: [
          { id: 'secondwind', name: 'ลมหายใจที่สอง', desc: 'ตั้งหลัก [G] ฟื้นเลือด 25 และพักสั้นลงอีก 6 วินาที' },
          { id: 'w_regen', name: 'แผลหายไว', desc: 'เลือดฟื้นเองเร็วขึ้น 60%' },
          { id: 'w_rally', name: 'ฮึดสู้', desc: 'ปัดสำเร็จ ฟื้นเลือด 6' },
        ] },
      ],
      choice: [
        { id: 'w_stance', name: 'ท่ารับ', desc: 'ยกการ์ดค้างอยู่ แรงฟื้นเร็วเท่าตอนไม่ยกการ์ด' },
        { id: 'w_light', name: 'ฝีเท้าเบา', desc: 'หลบ (C) ใช้แรงน้อยลง 40%' },
      ],
      cap: [
        { id: 'riposte', name: 'สวนกลับ', desc: 'ท่าใหม่: ปัดสำเร็จแล้วสวนกลับอัตโนมัติ ฟันหนักใส่ผู้โจมตีทันที (ใช้กับผู้เล่นได้)' },
        { id: 'w_bulwark', name: 'ป้อมคนเดียว', desc: 'ท่าใหม่: ยกการ์ดกันและปัดได้ทุกทิศ แม้ถูกโจมตีจากข้างหลัง' },
      ],
    },
  ],
};

const BELL = {
  token: { name: 'เศษระฆังร้าว', icon: '🔔', feat: 'ฟันโดนตรงจังหวะ', every: [20, 12] },
  trunk: [
    { id: 'r_tune', name: 'ตั้งเสียง', desc: 'ตีตรงจังหวะ ได้กังวานเพิ่ม 15%' },
    { id: 'r_arm', name: 'แขนตีระฆัง', desc: 'ฟันหนักใช้แรงน้อยลง 20%' },
    { id: 'r_toughen', name: 'ทนเสียง', desc: 'เลือดสูงสุด +10' },
    { id: 'r_pulse', name: 'ชีพจร', desc: 'ตีตรงจังหวะครั้งแรกของชุดก็แรงขึ้น (ฐาน ×1.3 → ×1.45)' },
  ],
  lines: [
    {
      id: 'rhythm', name: 'จังหวะ', blurb: 'ตีตรงจังหวะให้ไต่สเกลไม่หยุด',
      root: { id: 'ear', name: 'หูทอง', desc: 'ช่วงที่นับว่าตรงจังหวะกว้างขึ้น 40%' },
      branches: [
        { name: 'ไต่สเกล', nodes: [
          { id: 'scale', name: 'ไต่สเกล', desc: 'จังหวะต่อเนื่องสะสมได้ถึง ×9 (ตีแรงสุดเกือบ ×3)' },
          { id: 'r_crescendo', name: 'เครสเซนโด', desc: 'จังหวะต่อเนื่อง ×6 ขึ้นไป ฟันไกลขึ้น 0.6 เมตร' },
          { id: 'r_virtuoso', name: 'ฝีมือเอก', desc: 'จังหวะต่อเนื่อง ×8 ขึ้นไป ตีตรงจังหวะได้แรงคืน 4' },
        ] },
        { name: 'ประคองจังหวะ', nodes: [
          { id: 'sustain', name: 'กังวานค้าง', desc: 'พลังกังวานขึ้นเร็วขึ้น 50% · หลุดจังหวะไม่เสียกังวานและเสียจังหวะต่อเนื่องแค่ 2' },
          { id: 'r_grace', name: 'จังหวะผ่อน', desc: 'หลุดจังหวะครั้งแรกของแต่ละชุดไม่นับ' },
          { id: 'r_metronome', name: 'เมโทรนอม', desc: 'ช่วงตรงจังหวะกว้างขึ้นอีก 20%' },
        ] },
        { name: 'เสียงคม', nodes: [
          { id: 'r_ring', name: 'เสียงแหลม', desc: 'ตีตรงจังหวะ ศัตรูเซ 0.4 วินาที' },
          { id: 'r_shatter', name: 'ทำลายเสียง', desc: 'จังหวะต่อเนื่อง ×4 ขึ้นไป ฟันเบานับเป็นฟันหนัก (ทะลุการ์ดและเกราะ)' },
          { id: 'r_drum', name: 'กลองศึก', desc: 'ตีตรงจังหวะ ฟื้นเลือด 1' },
        ] },
      ],
      choice: [
        { id: 'r_duet', name: 'ดูเอ็ต', desc: 'จังหวะต่อเนื่อง ×3 ขึ้นไป ตีตรงจังหวะแล้วเสียงสะท้อนตีซ้ำอีกครั้ง (40%)' },
        { id: 'r_tempo', name: 'เร่งจังหวะ', desc: 'ฟันเบาเร็วขึ้น 15%' },
      ],
      cap: [
        { id: 'symphony', name: 'ซิมโฟนีระฆัง', desc: 'ท่าใหม่: จังหวะต่อเนื่อง ×5 ขึ้นไป ตีตรงจังหวะแล้วสั่นเป็นวงคลื่นเสียง ตีทุกอย่างรอบตัว 4 เมตร' },
        { id: 'r_finale', name: 'ฟินาเล่', desc: 'ท่าใหม่: ตีตรงจังหวะจนจังหวะต่อเนื่องถึงสูงสุด ปล่อยระฆังใหญ่ลูกเล็กทันที แล้วเริ่มชุดใหม่' },
      ],
    },
    {
      id: 'greatbell', name: 'ระฆังใหญ่', blurb: 'ตีหนัก เสียงสะท้อนไกล',
      root: { id: 'weight', name: 'ระฆังหนัก', desc: 'ฟันหนักแรงขึ้น 30%' },
      branches: [
        { name: 'คลื่น', nodes: [
          { id: 'wave', name: 'คลื่นกังวาน', desc: 'ระฆังใหญ่กว้างขึ้น 10 → 14 เมตร และมึนงงนานขึ้น' },
          { id: 'r_quake', name: 'แผ่นดินสั่น', desc: 'ระฆังใหญ่แรง ×1.5' },
          { id: 'r_resound', name: 'ก้องค้าง', desc: 'ตีระฆังใหญ่แล้ว กังวานเริ่มใหม่ที่ 30' },
        ] },
        { name: 'สะท้อน', nodes: [
          { id: 'echo', name: 'เสียงสะท้อนยาว', desc: 'เคาะเบาเผยศัตรูไกล 90 เมตร นาน 14 วินาที · ศัตรูที่ถูกเผยรับดาเมจ +25%' },
          { id: 'r_hunt', name: 'ล่าตามเสียง', desc: 'เคาะเบาพักแค่ 1.5 วินาที และใช้แรง 6' },
          { id: 'r_expose', name: 'เผยจุดอ่อน', desc: 'ศัตรูที่ถูกเผยรับดาเมจ +25% อีก (รวม +50%)' },
        ] },
        { name: 'ค้อน', nodes: [
          { id: 'r_anvil', name: 'ทั่งตีเหล็ก', desc: 'ฟันหนักได้กังวาน 15 เสมอ แม้ไม่ตรงจังหวะ' },
          { id: 'r_stagger', name: 'ค้อนทุบ', desc: 'ฟันหนักทำให้ศัตรูทั่วไปเซ 1 วินาที' },
          { id: 'r_bronze', name: 'ร่างสัมฤทธิ์', desc: 'รับดาเมจลดลง 12%' },
        ] },
      ],
      choice: [
        { id: 'r_bigring', name: 'ระฆังยักษ์', desc: 'ระฆังใหญ่ใช้กังวานแค่ 80' },
        { id: 'r_shield', name: 'ม่านเสียง', desc: 'ตีระฆังใหญ่แล้ว ไม่รับดาเมจ 2.5 วินาที' },
      ],
      cap: [
        { id: 'tolling', name: 'ระฆังก้อง', desc: 'ท่าใหม่: ระฆังใหญ่ใช้กังวานแค่ 70 และก้องตามอีก 3 ครั้ง ทุก 1 วินาที' },
        { id: 'r_doom', name: 'ระฆังมรณะ', desc: 'ท่าใหม่: ระฆังใหญ่ปลิดชีพศัตรูทั่วไปที่เลือดเหลือไม่ถึง 35% ทันที' },
      ],
    },
  ],
};

const LEECH = {
  token: { name: 'ปลิงอิ่มเลือด', icon: '🩸', feat: 'ปลิงนำเลือดกลับมาเติม (นับทุก 1 เลือด)', every: [60, 35] },
  trunk: [
    { id: 'l_tough', name: 'เลือดข้น', desc: 'เลือดสูงสุด +10' },
    { id: 'l_steady', name: 'มือนิ่ง', desc: 'กรีดใช้แรงน้อยลง 30%' },
    { id: 'l_jar', name: 'โหลใหญ่', desc: 'ปาปลิงใช้เลือดน้อยลง 1' },
    { id: 'l_clot', name: 'ลิ่มเลือด', desc: 'เลือดต่ำกว่า 20% รับดาเมจลดลง 20%' },
  ],
  lines: [
    {
      id: 'brood', name: 'ฝูงปลิง', blurb: 'เลี้ยงปลิงให้ทำงานแทน · ฝูง กตัญญู และพิษ',
      root: { id: 'fat', name: 'ปลิงอ้วน', desc: 'ปลิงดูดเลือดเร็วขึ้น 50%' },
      branches: [
        { name: 'ฝูง', nodes: [
          { id: 'swarm', name: 'ฝูงใหญ่', desc: 'ส่งปลิงออกล่าได้พร้อมกัน 5 ตัว' },
          { id: 'l_quick', name: 'ปลิงไว', desc: 'ปาปลิงพุ่งเร็วและไกลขึ้น 40%' },
          { id: 'l_cling', name: 'เกาะแน่น', desc: 'ปลิงเกาะดูดได้นาน 14 วินาที (ปกติ 8)' },
        ] },
        { name: 'กตัญญู', nodes: [
          { id: 'homing', name: 'ปลิงกตัญญู', desc: 'เลือดที่ปลิงนำกลับมา ×1.5 · ปาปลิงใช้เลือดแค่ 2' },
          { id: 'l_rich', name: 'เลือดเข้มข้น', desc: 'ปลิงกลับมาแล้วให้แรงคืน 10 ด้วย' },
          { id: 'l_breed', name: 'แพร่พันธุ์', desc: 'ปลิงกลับมามีโอกาส 35% ได้ปลิงเพิ่ม 1 ตัว' },
        ] },
        { name: 'พิษ', nodes: [
          { id: 'l_venom', name: 'ปลิงพิษ', desc: 'ศัตรูที่ถูกปลิงเกาะ เดินช้าลง 40%' },
          { id: 'l_numb', name: 'ชา', desc: 'ศัตรูที่ถูกปลิงเกาะ ตีเบาลง 30%' },
          { id: 'l_plague', name: 'โรคระบาด', desc: 'ศัตรูที่ถูกเกาะตาย ปลิงกระโดดไปเกาะตัวใกล้ ๆ ต่อ (8 เมตร)' },
        ] },
      ],
      choice: [
        { id: 'l_queen', name: 'นางพญาปลิง', desc: 'ปลิงที่ปาออกไปดูดเลือดแรง ×2 แต่ส่งออกไปได้น้อยลง 1 ตัว' },
        { id: 'l_feast', name: 'งานเลี้ยง', desc: 'ปลิงที่เกาะอยู่บนศัตรูทุกตัว ทำให้มีดแรงขึ้น 10%' },
      ],
      cap: [
        { id: 'burst', name: 'ปลิงระเบิด', desc: 'ท่าใหม่: G เรียกปลิงกลับ = ปลิงที่เกาะอยู่ระเบิด ตีแรงและทำให้ศัตรูรอบ ๆ เลือดไหล (แต่ยังนำเลือดกลับมา)' },
        { id: 'l_tide', name: 'คลื่นปลิง', desc: 'ท่าใหม่: ปาปลิงทีละ 3 ตัวกระจายเป็นรูปพัด (ใช้ปลิง 3 ตัว เลือดเท่าปาตัวเดียว)' },
      ],
    },
    {
      id: 'surgeon', name: 'มีดผ่าตัด', blurb: 'กรีดลึก เลือดยิ่งน้อยยิ่งอันตราย · แผล คลั่ง และดูด',
      root: { id: 'scalpel', name: 'มีดคม', desc: 'ฟันเบาแรงขึ้น 25%' },
      branches: [
        { name: 'แผล', nodes: [
          { id: 'deepcut', name: 'แผลลึก', desc: 'เลือดไหลแรงขึ้นและนาน 5 วินาที' },
          { id: 'l_artery', name: 'ตัดเส้นเลือด', desc: 'ศัตรูที่เลือดไหล เดินช้าลง 25%' },
          { id: 'l_hemo', name: 'เลือดไม่หยุด', desc: 'กรีดซ้ำ เลือดไหลแรงขึ้นทีละขั้น (สูงสุด ×3)' },
        ] },
        { name: 'คลั่ง', nodes: [
          { id: 'bloodlust', name: 'คลั่งเลือด', desc: 'เลือดคลั่งสูงสุด ×2.4 → ×3.0' },
          { id: 'l_edge', name: 'ปลายมีด', desc: 'มีดยาวขึ้น 0.6 เมตร' },
          { id: 'l_adrenaline', name: 'อะดรีนาลีน', desc: 'เลือดต่ำกว่า 40% กรีดเร็วขึ้น 25%' },
        ] },
        { name: 'ดูด', nodes: [
          { id: 'l_sip', name: 'จิบเลือด', desc: 'กรีดโดน ฟื้นเลือด 0.5' },
          { id: 'l_transfuse', name: 'ถ่ายเลือด', desc: 'ฆ่าศัตรูที่เลือดไหลอยู่ ฟื้นเลือด 8' },
          { id: 'l_mark', name: 'ตราเลือด', desc: 'ศัตรูที่เลือดไหล รับดาเมจ +15%' },
        ] },
      ],
      choice: [
        { id: 'l_flurry', name: 'กรีดรัว', desc: 'กรีดเร็วขึ้น 20%' },
        { id: 'l_precise', name: 'แม่นยำ', desc: 'กรีดเป้าเดิมติดกัน แรงเพิ่มครั้งละ 10% (สูงสุด +50%)' },
      ],
      cap: [
        { id: 'dissect', name: 'ผ่าตัดเลือดเย็น', desc: 'ท่าใหม่: ฟันโดนเป้าเดิม 4 ครั้งติด ครั้งที่ 4 เป็น "ผ่า" แรง ×3 และดูดเลือดคืน 6' },
        { id: 'l_exsang', name: 'สูบเลือด', desc: 'ท่าใหม่: ศัตรูที่เลือดไหลตาย ระเบิดเป็นละอองเลือด ศัตรูรอบ ๆ 4 เมตรเลือดไหลหนัก และเจ้าฟื้นเลือด 10' },
      ],
    },
  ],
};

const WICK = {
  token: { name: 'ไขเทียนดำ', icon: '🕯', feat: 'ฟันโดนตอนไฟร้อนเกินครึ่ง หรือลอบโจมตีจากความมืด', every: [15, 10] },
  trunk: [
    { id: 'k_wax', name: 'ไขหนา', desc: 'เลือด (ไขเทียน) สูงสุด +10' },
    { id: 'k_chain', name: 'โซ่ยาว', desc: 'เหวี่ยงกระถางไฟไกลขึ้น 0.5 เมตร' },
    { id: 'k_ember', name: 'ถ่านแดง', desc: 'ไฟเย็นลงช้าลง 40%' },
    { id: 'k_hearth', name: 'ใกล้เตา', desc: 'หล่อเทียนที่กองไฟเร็วขึ้น 50%' },
  ],
  lines: [
    {
      id: 'flame', name: 'เปลวเพลิง', blurb: 'ทุกอย่างต้องลุกไหม้ · โหม ลาม และไข',
      root: { id: 'blaze', name: 'ไฟแรง', desc: 'ศัตรูติดไฟแรงขึ้น 60%' },
      branches: [
        { name: 'โหมไฟ', nodes: [
          { id: 'stoke', name: 'โหมไฟ', desc: 'ไฟร้อนขึ้นเร็วขึ้น 50% และระยะเหวี่ยงจากความร้อนไกลขึ้น' },
          { id: 'k_inferno', name: 'นรกเพลิง', desc: 'ไฟร้อนเกือบเต็ม (90%) ตีแรงขึ้น 25%' },
          { id: 'k_overheat', name: 'ร้อนจัด', desc: 'ไฟร้อนเกินครึ่ง เหวี่ยงใช้แรงน้อยลง 60%' },
        ] },
        { name: 'ไฟลาม', nodes: [
          { id: 'k_spread', name: 'ไฟลาม', desc: 'ศัตรูที่ติดไฟตาย ไฟลามไปตัวใกล้ ๆ (5 เมตร)' },
          { id: 'k_ash', name: 'เถ้าถ่าน', desc: 'ศัตรูที่ติดไฟ ตีเบาลง 20%' },
          { id: 'k_pyre', name: 'กองฟอน', desc: 'ศัตรูที่ติดไฟตาย ทิ้งกองไฟไว้ 20 วินาที (ใช้หล่อเทียนได้)' },
        ] },
        { name: 'ไข', nodes: [
          { id: 'tallow', name: 'ไขทนไฟ', desc: 'เทียนละลายช้าลงครึ่งหนึ่ง' },
          { id: 'k_drip', name: 'น้ำตาเทียน', desc: 'เหวี่ยงโดน หล่อเทียนคืน 0.5' },
          { id: 'k_phoenix', name: 'ฟีนิกซ์', desc: 'ครั้งแรกที่ไขจะหมด ลุกกลับขึ้นมาพร้อมไข 40 (ทุก 3 นาที)' },
        ] },
      ],
      choice: [
        { id: 'k_censer', name: 'กระถางใหญ่', desc: 'หมุนรอบตัว (ฟันหนัก) กว้างขึ้น 1.2 เมตร' },
        { id: 'k_flare', name: 'ไฟพุ่ง', desc: 'เหวี่ยงเบาไกลขึ้น 1.5 เมตร' },
      ],
      cap: [
        { id: 'firestorm', name: 'พายุไฟ', desc: 'ท่าใหม่: หมุนรอบตัว (ฟันหนัก) ทิ้งวงไฟไว้บนพื้น 4 วินาที เผาทุกอย่างที่เหยียบ' },
        { id: 'k_sun', name: 'ดวงอาทิตย์ดับ', desc: 'ท่าใหม่: G ตอนไฟร้อนเต็ม = ระเบิดไฟรอบตัว 7 เมตร แรง 4 ไฟลุกท่วม (ไฟลดเหลือศูนย์)' },
      ],
    },
    {
      id: 'shadow', name: 'เงามืด', blurb: 'หายไปในความมืด แล้วโผล่มาเผา · ย่อง เทียน และลอบ',
      root: { id: 'longwick', name: 'ไส้เทียนยาว', desc: 'เทียนที่ปักอยู่ได้ 150 วินาที และปักได้ 4 เล่ม' },
      branches: [
        { name: 'ย่อง', nodes: [
          { id: 'stalk', name: 'ย่องในเงา', desc: 'ตอนป้องไฟ เดินเร็วขึ้น 25% และเทียนค่อย ๆ หล่อคืน' },
          { id: 'k_silent', name: 'ไร้เสียง', desc: 'ป้องไฟแล้ว ศัตรูที่กำลังไล่ลืมเจ้าไปเลย' },
          { id: 'k_shade', name: 'เงาเย็น', desc: 'ตอนป้องไฟ หล่อเทียนคืน 1.6 ต่อวินาที' },
        ] },
        { name: 'เทียน', nodes: [
          { id: 'ward', name: 'แสงขับไล่', desc: 'เทียนที่ปักกันร่างซีดได้กว้าง 7.5 เมตร และหล่อเทียนเร็วขึ้น' },
          { id: 'k_beacon', name: 'เทียนนำทาง', desc: 'ยืนใกล้เทียนที่ปักไว้ ตีแรงขึ้น 20%' },
          { id: 'k_brand', name: 'เทียนเผา', desc: 'ร่างซีดที่ถูกแสงเทียนผลักออก ติดไฟ' },
        ] },
        { name: 'ลอบ', nodes: [
          { id: 'k_knife', name: 'ลอบกัด', desc: 'ตีศัตรูจากด้านหลัง แรงขึ้น 40%' },
          { id: 'k_vanish', name: 'หายตัว', desc: 'ฆ่าศัตรูแล้ว 2 วินาทีต่อมา ศัตรูมองไม่เห็นเจ้า' },
          { id: 'k_dread', name: 'หวาดกลัว', desc: 'ลอบเผาแล้ว ศัตรูรอบ ๆ 5 เมตรเซ 1.2 วินาที' },
        ] },
      ],
      choice: [
        { id: 'k_twin', name: 'เทียนประหยัด', desc: 'ปักเทียนใช้ไขแค่ 3 (ปกติ 6)' },
        { id: 'k_cateye', name: 'ตาแมว', desc: 'ตอนป้องไฟยังมองเห็นชัด (ความมืดลดลงมาก)' },
      ],
      cap: [
        { id: 'ambush', name: 'ลอบเผา', desc: 'ท่าใหม่: ภายใน 2 วินาทีหลังเลิกป้องไฟ ฟันแรกแรง ×3 และเผาไฟลุกท่วม' },
        { id: 'k_eclipse', name: 'สุริยคราส', desc: 'ท่าใหม่: ภายใน 3 วินาทีหลังเลิกป้องไฟ ทุกการเหวี่ยงแรง ×2 และไฟร้อนเต็มทันที' },
      ],
    },
  ],
};

// every tree as nodes with their place, price and what they need
function build(cls, src) {
  const nodes = {}, add = (n, extra) => { nodes[n.id] = { ...n, ...extra }; return nodes[n.id]; };
  const trunk = (src.trunk || []).map((n, i, a) => add(n, { ...TRUNK[i], ...n, line: null, place: 'trunk', req: i ? [a[i - 1].id] : [] }));
  const last = trunk.length ? [trunk[trunk.length - 1].id] : [];
  const lines = src.lines.map((L) => {
    const root = add(L.root, { pts: 1, lv: 4, tok: 0, ...L.root, line: L.id, place: 'root', req: last });
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

export const TREES = {
  wanderer: build('wanderer', WANDERER), bell: build('bell', BELL), leech: build('leech', LEECH),
  coffin: build('coffin', COFFIN), wick: build('wick', WICK),
};

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
