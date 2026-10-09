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
import { L } from './i18n.js';

// ------------------------------------------------------------------------------------------------
// The trees. Node: id, name, desc, and optionally pts, tok (keepsakes), lv (path level needed);
// the price otherwise follows the node's place (TRUNK / PRICE below).
const COFFIN = {
  token: { name: L('ดินหลุมศพ', 'Grave Soil'), icon: '⚰', feat: L('ยกโลงกันการโจมตี · เก็บศพ (×2) · ฝังศพ (×3)', 'coffin block · corpse gathered (×2) · corpse buried (×3)'), every: [8, 5] },
  trunk: [
    { id: 'c_back', name: L('หลังแข็ง', 'Iron Back'), desc: L('เลือดสูงสุด +10', 'Max health +10'), pts: 1, lv: 2 },
    { id: 'c_thick', name: L('โลงหนา', 'Thick Coffin'), desc: L('ยกโลงกันการโจมตีใช้แรงน้อยลง 20%', 'Coffin blocks cost 20% less stamina'), pts: 1, lv: 3 },
    { id: 'c_spade', name: L('พลั่วสัปเหร่อ', 'Sexton\'s Spade'), desc: L('เหวี่ยงโลง (ฟันเบา) แรงขึ้น 15%', 'Coffin swings (light attack) deal 15% more damage'), pts: 1, lv: 5 },
    { id: 'c_stride', name: L('ก้าวมั่น', 'Firm Stride'), desc: L('แบกศพเต็มโลงก็ไม่ช้าลง และเดินเร็วขึ้น 5%', 'A full coffin no longer slows you; move 5% faster'), pts: 2, lv: 7 },
  ],
  lines: [
    {
      id: 'ironwall', name: L('กำแพงเหล็ก', 'Iron Wall'), blurb: L('โลงคือป้อมปราการเดินได้ · ตั้งรับ สะท้อน ทุบพื้น', 'The coffin is a walking fortress · guard, reflect, slam'),
      root: { id: 'a_root', name: L('ทางแห่งกำแพง', 'Way of the Wall'), desc: L('รับดาเมจลดลง 5% และเลือดสูงสุด +10', 'Take 5% less damage; max health +10'), pts: 1, lv: 4 },
      branches: [
        { name: L('ป้องกัน', 'Guard'), nodes: [
          { id: 'plated', name: L('โลงหุ้มเหล็ก', 'Iron-Clad Coffin'), desc: L('รับดาเมจลดลงอีก 12%', 'Take a further 12% less damage') },
          { id: 'a_iron', name: L('เหล็กสองชั้น', 'Double Plate'), desc: L('ยกโลงกันการโจมตีใช้แรงน้อยลงอีก 30%', 'Coffin blocks cost a further 30% less stamina') },
          { id: 'a_unmoved', name: L('ไม่สะเทือน', 'Unmoved'), desc: L('ยกโลงกันแล้วไม่ถูกดันถอย · แรงหมดก็ไม่การ์ดแตก (ทุก 10 วินาที)', 'Coffin blocks never push you back · no guard break at zero stamina (every 10 seconds)') },
        ] },
        { name: L('สวนกลับ', 'Retaliation'), nodes: [
          { id: 'reflect', name: L('กำแพงสะท้อน', 'Reflecting Wall'), desc: L('ยกโลงกันการโจมตีแล้วสะท้อนแรงกลับใส่ผู้โจมตี', 'Coffin blocks hurl the force back at the attacker') },
          { id: 'a_bash', name: L('กระแทกโลง', 'Coffin Bash'), desc: L('แรงสะท้อน ×2 และผู้โจมตีเซ 0.8 วินาที', 'Reflected force ×2; the attacker staggers 0.8 seconds') },
          { id: 'a_vengeance', name: L('แค้นโลง', 'Coffin\'s Grudge'), desc: L('กันได้ 3 ครั้ง การเหวี่ยงครั้งต่อไปแรง ×2', 'After 3 blocks, your next swing deals ×2') },
        ] },
        { name: L('ทุบพื้น', 'Ground Slam'), nodes: [
          { id: 'quake', name: L('แผ่นดินไหว', 'Earthquake'), desc: L('ทุบพื้นกว้างขึ้น 1.2 เมตรและแรงขึ้น 25%', 'Ground slam 1.2 metres wider and 25% stronger') },
          { id: 'a_fissure', name: L('รอยแยก', 'Fissure'), desc: L('ศัตรูที่โดนทุบพื้นเซนาน 1.3 วินาที', 'Foes caught by a ground slam stagger 1.3 seconds') },
          { id: 'a_sinkhole', name: L('หลุมยุบ', 'Sinkhole'), desc: L('ทุบพื้นเร็วขึ้น 20% และใช้แรงน้อยลง 30%', 'Ground slam 20% faster and costs 30% less stamina') },
        ] },
      ],
      choice: [
        { id: 'a_fortress', name: L('ป้อมเคลื่อนที่', 'Moving Keep'), desc: L('ยกโลงแล้วยังเดินได้เร็ว 80% (ปกติ 45%)', 'Move at 80% speed with the coffin raised (normally 45%)') },
        { id: 'a_bastion', name: L('ปราการ', 'Bastion'), desc: L('ทุกครั้งที่ยกโลงกันการโจมตีได้ ฟื้นเลือด 3', 'Each blow blocked by the coffin restores 3 health') },
      ],
      cap: [
        { id: 'bulldoze', name: L('โลงพุ่งชน', 'Coffin Charge'), desc: L('ท่าใหม่: ยกโลงแล้ววิ่งได้เต็มที่ ศัตรูที่ขวางหน้าโลงถูกดันกระเด็นและเซ', 'New move: run at full speed with the coffin raised; foes in its path are flung aside and staggered') },
        { id: 'a_spin', name: L('โลงเหล็กหมุน', 'Iron Coffin Spin'), desc: L('ท่าใหม่: ฟันหนักกลายเป็นหมุนโลงกวาดรอบตัว 4.5 เมตร แรงขึ้น 20% โดนทุกทิศ', 'New move: heavy attack becomes a 4.5 metre coffin sweep, 20% stronger, striking all sides') },
      ],
    },
    {
      id: 'necro', name: L('ผู้ปลุกศพ', 'Corpse-Raiser'), blurb: L('ยิ่งแบกศพมาก ยิ่งแกร่ง · เก็บ ฝัง ปลุก', 'The more dead you bear, the stronger you are · gather, bury, raise'),
      root: { id: 'b_root', name: L('กลิ่นศพ', 'Scent of Death'), desc: L('ศพค้างอยู่นาน 60 วินาที (ปกติ 30) และเก็บศพได้ไกลขึ้น', 'Corpses linger 60 seconds (normally 30) and can be gathered from farther'), pts: 1, lv: 4 },
      branches: [
        { name: L('เก็บศพ', 'Gathering'), nodes: [
          { id: 'roomy', name: L('โลงกว้าง', 'Roomy Coffin'), desc: L('เก็บศพได้ 6 ช่อง', 'The coffin holds 6 corpses') },
          { id: 'strength', name: L('พลังศพ', 'Strength of the Dead'), desc: L('ศพในโลงแต่ละตัว ตีแรงขึ้น +6%', 'Each corpse in the coffin: +6% damage') },
          { id: 'b_stack', name: L('ศพซ้อน', 'Stacked Dead'), desc: L('ศพในโลงแต่ละตัว รับดาเมจลดลง 4%', 'Each corpse in the coffin: take 4% less damage') },
        ] },
        { name: L('ฝังศพ', 'Burial'), nodes: [
          { id: 'hallowed', name: L('หลุมศักดิ์สิทธิ์', 'Hallowed Grave'), desc: L('ฝังศพฟื้นเลือด 40 → 70', 'Burials restore 40 → 70 health') },
          { id: 'b_rites', name: L('พิธีฝัง', 'Burial Rites'), desc: L('ฝังศพแล้วแรงเต็มทันที และเดินเร็วขึ้น 20% นาน 10 วินาที', 'Burials refill stamina and grant 20% move speed for 10 seconds') },
          { id: 'b_cemetery', name: L('ป่าช้าเดินได้', 'Walking Cemetery'), desc: L('ยืนใกล้หลุมศพที่เจ้าขุดไว้ (6 เมตร) เลือดฟื้น 3 ต่อวินาที', 'Near a grave you dug (6 metres), regain 3 health per second') },
        ] },
        { name: L('ปลุกศพ', 'Raising'), nodes: [
          { id: 'b_drain', name: L('ดูดวิญญาณ', 'Soul Drain'), desc: L('ฆ่าศัตรูขณะมีศพในโลง ฟื้นเลือด 4', 'Kills with a corpse in the coffin restore 4 health') },
          { id: 'b_fear', name: L('ศพหลอน', 'Haunting Dead'), desc: L('ฟันหนักมีโอกาส 30% ทำให้ศัตรูขวัญเสีย หยุดนิ่ง 1.5 วินาที', 'Heavy attacks have a 30% chance to unnerve foes, freezing them 1.5 seconds') },
          { id: 'b_harvest', name: L('เก็บเกี่ยว', 'Harvest'), desc: L('เก็บศพแล้วฟื้นเลือด 8 และแรง 20', 'Gathering a corpse restores 8 health and 20 stamina') },
        ] },
      ],
      choice: [
        { id: 'b_ossuary', name: L('โลงกระดูก', 'Ossuary'), desc: L('เก็บศพได้ 8 ช่อง', 'The coffin holds 8 corpses') },
        { id: 'b_onesoul', name: L('วิญญาณเดียว', 'Lone Soul'), desc: L('ถ้ามีศพในโลงไม่เกิน 2 ตัว ตีแรงขึ้น 25%', 'With 2 or fewer corpses in the coffin, deal 25% more damage') },
      ],
      cap: [
        { id: 'lingering', name: L('ศพไม่ยอมหลับ', 'The Restless Dead'), desc: L('ท่าใหม่: ฝังศพแล้วดินระเบิดตีรอบตัว 5 เมตร และพลังของศพที่ฝังติดตัวต่ออีก 45 วินาที', 'New move: burials burst the earth 5 metres around you, and the buried dead\'s strength stays 45 seconds more') },
        { id: 'b_legion', name: L('กองทัพในโลง', 'Legion in the Coffin'), desc: L('ท่าใหม่: ยกโลงค้างแล้วกด G = ปล่อยศพทั้งโลงระเบิดรอบตัว 6 เมตร (แรง 2.5 ต่อศพ) และฟื้นเลือด 5 ต่อศพ', 'New move: hold the coffin up and press G = every corpse bursts 6 metres around you (2.5 per corpse), restoring 5 health per corpse') },
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
  token: { name: L('ตราดาบบิ่น', 'Notched Blade Sigil'), icon: '🗡', feat: L('ปัดสำเร็จ หรือฆ่าด้วยฟันหนัก', 'parry, or heavy-attack kill'), every: [5, 3] },
  trunk: [
    { id: 'w_grip', name: L('จับดาบมั่น', 'Firm Grip'), desc: L('ฟันเบาแรงขึ้น 8%', 'Light attacks deal 8% more damage') },
    { id: 'w_breath', name: L('ลมหายใจยาว', 'Long Breath'), desc: L('วิ่งใช้แรงน้อยลง 30%', 'Sprinting costs 30% less stamina') },
    { id: 'w_hide', name: L('ผิวด้าน', 'Callused Hide'), desc: L('เลือดสูงสุด +10', 'Max health +10') },
    { id: 'w_focus', name: L('ตั้งสมาธิ', 'Focus'), desc: L('ตั้งหลัก [G] พักแค่ 24 วินาที (ปกติ 30)', 'Steady [G] recharges in 24 seconds (normally 30)') },
  ],
  lines: [
    {
      id: 'blade', name: L('ดาบพเนจร', 'Wandering Blade'), blurb: L('เน้นบุก · ความเร็ว ฟันหนัก และเลือดร้อน', 'Offence · speed, heavy blows and hot blood'),
      root: { id: 'keen', name: L('คมดาบ', 'Keen Edge'), desc: L('ฟันเบาแรงขึ้น 20%', 'Light attacks deal 20% more damage') },
      branches: [
        { name: L('ความเร็ว', 'Speed'), nodes: [
          { id: 'flurry', name: L('ฟันต่อเนื่อง', 'Flurry'), desc: L('ฟันเบาเร็วขึ้น 15% และใช้แรงน้อยลง 20%', 'Light attacks 15% faster and cost 20% less stamina') },
          { id: 'w_dance', name: L('ระบำดาบ', 'Blade Dance'), desc: L('ฟันเบาโดน 3 ครั้งติดภายใน 2 วินาที ครั้งที่สามแรง ×1.6', 'Land 3 light attacks within 2 seconds; the third deals ×1.6') },
          { id: 'w_edge', name: L('คมไม่หยุด', 'Unceasing Edge'), desc: L('ฟันเบาโดน ได้แรงคืน 3', 'Light attack hits return 3 stamina') },
        ] },
        { name: L('ฟันหนัก', 'Heavy Attack'), nodes: [
          { id: 'cleave', name: L('ฟันทะลวง', 'Cleave'), desc: L('ฟันหนักแรงขึ้น 35% และไกลขึ้นครึ่งเมตร', 'Heavy attacks deal 35% more damage and reach half a metre farther') },
          { id: 'w_sunder', name: L('ผ่าเกราะ', 'Sunder'), desc: L('ศัตรูที่โดนฟันหนักรับดาเมจ +20% นาน 5 วินาที', 'Foes struck by a heavy attack take +20% damage for 5 seconds') },
          { id: 'w_execute', name: L('ปลิดชีพ', 'Execute'), desc: L('ฟันหนักใส่ศัตรูที่เลือดเหลือไม่ถึง 30% แรง ×2', 'Heavy attacks deal ×2 to foes below 30% health') },
        ] },
        { name: L('เลือดร้อน', 'Hot Blood'), nodes: [
          { id: 'w_thirst', name: L('กระหายศึก', 'Battle Thirst'), desc: L('ฆ่าศัตรู ฟื้นเลือด 5', 'Kills restore 5 health') },
          { id: 'w_momentum', name: L('ได้ใจ', 'Momentum'), desc: L('ฆ่าแล้ว 6 วินาทีต่อมา ตีแรงขึ้น 20%', 'For 6 seconds after a kill, deal 20% more damage') },
          { id: 'w_frenzy', name: L('บ้าคลั่ง', 'Frenzy'), desc: L('เลือดต่ำกว่า 35% ตีแรงขึ้น 30%', 'Below 35% health, deal 30% more damage') },
        ] },
      ],
      choice: [
        { id: 'w_twin', name: L('ดาบเงาคู่', 'Twin Shadow Blade'), desc: L('ฟันเบาที่โดนทุกครั้งที่ 4 มีดาบเงาฟันซ้ำอีกครั้ง', 'Every 4th light attack hit, a shadow blade strikes again') },
        { id: 'w_heavyhand', name: L('มือหนัก', 'Heavy Hand'), desc: L('ฟันหนักทำให้ศัตรูทั่วไปเซ 1 วินาทีเสมอ', 'Heavy attacks always stagger common foes 1 second') },
      ],
      cap: [
        { id: 'crescent', name: L('ดาบจันทร์เสี้ยว', 'Crescent Blade'), desc: L('ท่าใหม่: ฟันหนักปล่อยคลื่นดาบรูปจันทร์เสี้ยวพุ่งไปข้างหน้า 8 เมตร ตัดทุกอย่างในแนว', 'New move: heavy attack looses a crescent wave 8 metres ahead, cutting all in its path') },
        { id: 'w_whirl', name: L('ดาบวน', 'Whirling Blade'), desc: L('ท่าใหม่: ฟันหนักกลายเป็นหมุนดาบรอบตัว 3.8 เมตร โดนทุกทิศ แรงขึ้น 10%', 'New move: heavy attack becomes a 3.8 metre spin, striking all sides, 10% stronger') },
      ],
    },
    {
      id: 'survivor', name: L('ผู้รอด', 'Survivor'), blurb: L('เน้นตั้งรับ · ปัด ทนทาน และฟื้นตัว', 'Defence · parry, endurance and recovery'),
      root: { id: 'tough', name: L('หนังเหนียว', 'Tough Hide'), desc: L('เลือดสูงสุด +20', 'Max health +20') },
      branches: [
        { name: L('ปัด', 'Parry'), nodes: [
          { id: 'deflect', name: L('ปัดแม่น', 'Sure Parry'), desc: L('ช่วงเวลาปัดยาวขึ้น 40% · ปัดสำเร็จได้แรงคืน 10', 'Parry window 40% longer · a parry returns 10 stamina') },
          { id: 'w_perfect', name: L('ปัดไร้ที่ติ', 'Flawless Parry'), desc: L('ปัดสำเร็จ ศัตรูเซนานขึ้นอีก 1 วินาที', 'Parried foes stagger 1 second longer') },
          { id: 'w_disarm', name: L('ปลดอาวุธ', 'Disarm'), desc: L('ปัดสำเร็จ ศัตรูรับดาเมจ ×1.5 นาน 3 วินาที', 'Parried foes take ×1.5 damage for 3 seconds') },
        ] },
        { name: L('ทนทาน', 'Endurance'), nodes: [
          { id: 'w_guard', name: L('การ์ดเหล็ก', 'Iron Guard'), desc: L('ยกการ์ดกัน ดาเมจทะลุการ์ดเหลือครึ่งเดียว', 'Damage through your block is halved') },
          { id: 'w_iron', name: L('กายเหล็ก', 'Iron Body'), desc: L('รับดาเมจลดลง 10%', 'Take 10% less damage') },
          { id: 'w_last', name: L('ไม่ยอมตาย', 'Undying'), desc: L('ครั้งแรกที่เลือดจะหมด เหลือ 1 แทน (ทุก 2 นาที)', 'The first killing blow leaves you at 1 health instead (every 2 minutes)') },
        ] },
        { name: L('ฟื้นตัว', 'Recovery'), nodes: [
          { id: 'secondwind', name: L('ลมหายใจที่สอง', 'Second Wind'), desc: L('ตั้งหลัก [G] ฟื้นเลือด 25 และพักสั้นลงอีก 6 วินาที', 'Steady [G] restores 25 health and recharges 6 seconds sooner') },
          { id: 'w_regen', name: L('แผลหายไว', 'Quick Mending'), desc: L('เลือดฟื้นเองเร็วขึ้น 60%', 'Health regenerates 60% faster') },
          { id: 'w_rally', name: L('ฮึดสู้', 'Rally'), desc: L('ปัดสำเร็จ ฟื้นเลือด 6', 'A parry restores 6 health') },
        ] },
      ],
      choice: [
        { id: 'w_stance', name: L('ท่ารับ', 'Guarded Stance'), desc: L('ยกการ์ดค้างอยู่ แรงฟื้นเร็วเท่าตอนไม่ยกการ์ด', 'Stamina regenerates at full rate while blocking') },
        { id: 'w_light', name: L('ฝีเท้าเบา', 'Light Feet'), desc: L('หลบ (C) ใช้แรงน้อยลง 40%', 'Dodge (C) costs 40% less stamina') },
      ],
      cap: [
        { id: 'riposte', name: L('สวนกลับ', 'Riposte'), desc: L('ท่าใหม่: ปัดสำเร็จแล้วสวนกลับอัตโนมัติ ฟันหนักใส่ผู้โจมตีทันที (ใช้กับผู้เล่นได้)', 'New move: a parry triggers an instant heavy counter on the attacker (works on players)') },
        { id: 'w_bulwark', name: L('ป้อมคนเดียว', 'One-Man Bulwark'), desc: L('ท่าใหม่: ยกการ์ดกันและปัดได้ทุกทิศ แม้ถูกโจมตีจากข้างหลัง', 'New move: block and parry from every side, even from behind') },
      ],
    },
  ],
};

const BELL = {
  token: { name: L('เศษระฆังร้าว', 'Cracked Bell Shard'), icon: '🔔', feat: L('ฟันโดนตรงจังหวะ', 'hit on the beat'), every: [20, 12] },
  trunk: [
    { id: 'r_tune', name: L('ตั้งเสียง', 'Tuning'), desc: L('ตีตรงจังหวะ ได้กังวานเพิ่ม 15%', 'On-beat hits build 15% more resonance') },
    { id: 'r_arm', name: L('แขนตีระฆัง', 'Ringer\'s Arm'), desc: L('ฟันหนักใช้แรงน้อยลง 20%', 'Heavy attacks cost 20% less stamina') },
    { id: 'r_toughen', name: L('ทนเสียง', 'Hardened Ear'), desc: L('เลือดสูงสุด +10', 'Max health +10') },
    { id: 'r_pulse', name: L('ชีพจร', 'Pulse'), desc: L('ตีตรงจังหวะครั้งแรกของชุดก็แรงขึ้น (ฐาน ×1.3 → ×1.45)', 'The first on-beat hit of a chain hits harder too (base ×1.3 → ×1.45)') },
  ],
  lines: [
    {
      id: 'rhythm', name: L('จังหวะ', 'Rhythm'), blurb: L('ตีตรงจังหวะให้ไต่สเกลไม่หยุด', 'Strike on the beat and climb the scale without end'),
      root: { id: 'ear', name: L('หูทอง', 'Golden Ear'), desc: L('ช่วงที่นับว่าตรงจังหวะกว้างขึ้น 40%', 'The on-beat window is 40% wider') },
      branches: [
        { name: L('ไต่สเกล', 'Climb the Scale'), nodes: [
          { id: 'scale', name: L('ไต่สเกล', 'Climb the Scale'), desc: L('จังหวะต่อเนื่องสะสมได้ถึง ×9 (ตีแรงสุดเกือบ ×3)', 'Beat streak stacks to ×9 (nearly ×3 damage at peak)') },
          { id: 'r_crescendo', name: L('เครสเซนโด', 'Crescendo'), desc: L('จังหวะต่อเนื่อง ×6 ขึ้นไป ฟันไกลขึ้น 0.6 เมตร', 'At streak ×6 or more, attacks reach 0.6 metres farther') },
          { id: 'r_virtuoso', name: L('ฝีมือเอก', 'Virtuoso'), desc: L('จังหวะต่อเนื่อง ×8 ขึ้นไป ตีตรงจังหวะได้แรงคืน 4', 'At streak ×8 or more, on-beat hits return 4 stamina') },
        ] },
        { name: L('ประคองจังหวะ', 'Keeping Time'), nodes: [
          { id: 'sustain', name: L('กังวานค้าง', 'Sustain'), desc: L('พลังกังวานขึ้นเร็วขึ้น 50% · หลุดจังหวะไม่เสียกังวานและเสียจังหวะต่อเนื่องแค่ 2', 'Resonance builds 50% faster · a missed beat keeps resonance and costs only 2 streak') },
          { id: 'r_grace', name: L('จังหวะผ่อน', 'Grace Note'), desc: L('หลุดจังหวะครั้งแรกของแต่ละชุดไม่นับ', 'The first missed beat of each chain does not count') },
          { id: 'r_metronome', name: L('เมโทรนอม', 'Metronome'), desc: L('ช่วงตรงจังหวะกว้างขึ้นอีก 20%', 'On-beat window a further 20% wider') },
        ] },
        { name: L('เสียงคม', 'Sharp Tone'), nodes: [
          { id: 'r_ring', name: L('เสียงแหลม', 'Piercing Ring'), desc: L('ตีตรงจังหวะ ศัตรูเซ 0.4 วินาที', 'On-beat hits stagger foes 0.4 seconds') },
          { id: 'r_shatter', name: L('ทำลายเสียง', 'Shattering Note'), desc: L('จังหวะต่อเนื่อง ×4 ขึ้นไป ฟันเบานับเป็นฟันหนัก (ทะลุการ์ดและเกราะ)', 'At streak ×4 or more, light attacks count as heavy (pierce guard and armour)') },
          { id: 'r_drum', name: L('กลองศึก', 'War Drum'), desc: L('ตีตรงจังหวะ ฟื้นเลือด 1', 'On-beat hits restore 1 health') },
        ] },
      ],
      choice: [
        { id: 'r_duet', name: L('ดูเอ็ต', 'Duet'), desc: L('จังหวะต่อเนื่อง ×3 ขึ้นไป ตีตรงจังหวะแล้วเสียงสะท้อนตีซ้ำอีกครั้ง (40%)', 'At streak ×3 or more, on-beat hits echo for a second strike (40%)') },
        { id: 'r_tempo', name: L('เร่งจังหวะ', 'Accelerando'), desc: L('ฟันเบาเร็วขึ้น 15%', 'Light attacks 15% faster') },
      ],
      cap: [
        { id: 'symphony', name: L('ซิมโฟนีระฆัง', 'Bell Symphony'), desc: L('ท่าใหม่: จังหวะต่อเนื่อง ×5 ขึ้นไป ตีตรงจังหวะแล้วสั่นเป็นวงคลื่นเสียง ตีทุกอย่างรอบตัว 4 เมตร', 'New move: at streak ×5 or more, on-beat hits send out a ring of sound, striking all within 4 metres') },
        { id: 'r_finale', name: L('ฟินาเล่', 'Finale'), desc: L('ท่าใหม่: ตีตรงจังหวะจนจังหวะต่อเนื่องถึงสูงสุด ปล่อยระฆังใหญ่ลูกเล็กทันที แล้วเริ่มชุดใหม่', 'New move: reach the top streak on the beat to loose a small Great Bell at once, then begin anew') },
      ],
    },
    {
      id: 'greatbell', name: L('ระฆังใหญ่', 'Great Bell'), blurb: L('ตีหนัก เสียงสะท้อนไกล', 'Strike hard; the echo carries far'),
      root: { id: 'weight', name: L('ระฆังหนัก', 'Heavy Bell'), desc: L('ฟันหนักแรงขึ้น 30%', 'Heavy attacks deal 30% more damage') },
      branches: [
        { name: L('คลื่น', 'Wave'), nodes: [
          { id: 'wave', name: L('คลื่นกังวาน', 'Resonant Wave'), desc: L('ระฆังใหญ่กว้างขึ้น 10 → 14 เมตร และมึนงงนานขึ้น', 'Great Bell reaches 10 → 14 metres and dazes longer') },
          { id: 'r_quake', name: L('แผ่นดินสั่น', 'Trembling Earth'), desc: L('ระฆังใหญ่แรง ×1.5', 'Great Bell deals ×1.5') },
          { id: 'r_resound', name: L('ก้องค้าง', 'Lingering Toll'), desc: L('ตีระฆังใหญ่แล้ว กังวานเริ่มใหม่ที่ 30', 'After the Great Bell, resonance restarts at 30') },
        ] },
        { name: L('สะท้อน', 'Echo'), nodes: [
          { id: 'echo', name: L('เสียงสะท้อนยาว', 'Long Echo'), desc: L('เคาะเบาเผยศัตรูไกล 90 เมตร นาน 14 วินาที · ศัตรูที่ถูกเผยรับดาเมจ +25%', 'A light tap reveals foes within 90 metres for 14 seconds · revealed foes take +25% damage') },
          { id: 'r_hunt', name: L('ล่าตามเสียง', 'Hunt by Sound'), desc: L('เคาะเบาพักแค่ 1.5 วินาที และใช้แรง 6', 'Light tap recharges in 1.5 seconds and costs 6 stamina') },
          { id: 'r_expose', name: L('เผยจุดอ่อน', 'Expose Weakness'), desc: L('ศัตรูที่ถูกเผยรับดาเมจ +25% อีก (รวม +50%)', 'Revealed foes take a further +25% damage (+50% in all)') },
        ] },
        { name: L('ค้อน', 'Hammer'), nodes: [
          { id: 'r_anvil', name: L('ทั่งตีเหล็ก', 'Anvil'), desc: L('ฟันหนักได้กังวาน 15 เสมอ แม้ไม่ตรงจังหวะ', 'Heavy attacks always build 15 resonance, even off the beat') },
          { id: 'r_stagger', name: L('ค้อนทุบ', 'Hammer Blow'), desc: L('ฟันหนักทำให้ศัตรูทั่วไปเซ 1 วินาที', 'Heavy attacks stagger common foes 1 second') },
          { id: 'r_bronze', name: L('ร่างสัมฤทธิ์', 'Bronze Body'), desc: L('รับดาเมจลดลง 12%', 'Take 12% less damage') },
        ] },
      ],
      choice: [
        { id: 'r_bigring', name: L('ระฆังยักษ์', 'Giant Bell'), desc: L('ระฆังใหญ่ใช้กังวานแค่ 80', 'Great Bell costs only 80 resonance') },
        { id: 'r_shield', name: L('ม่านเสียง', 'Veil of Sound'), desc: L('ตีระฆังใหญ่แล้ว ไม่รับดาเมจ 2.5 วินาที', 'After the Great Bell, take no damage for 2.5 seconds') },
      ],
      cap: [
        { id: 'tolling', name: L('ระฆังก้อง', 'Tolling'), desc: L('ท่าใหม่: ระฆังใหญ่ใช้กังวานแค่ 70 และก้องตามอีก 3 ครั้ง ทุก 1 วินาที', 'New move: Great Bell costs only 70 resonance and tolls 3 more times, once a second') },
        { id: 'r_doom', name: L('ระฆังมรณะ', 'Death Knell'), desc: L('ท่าใหม่: ระฆังใหญ่ปลิดชีพศัตรูทั่วไปที่เลือดเหลือไม่ถึง 35% ทันที', 'New move: Great Bell slays common foes below 35% health outright') },
      ],
    },
  ],
};

const LEECH = {
  token: { name: L('ปลิงอิ่มเลือด', 'Sated Leech'), icon: '🩸', feat: L('ปลิงนำเลือดกลับมาเติม (นับทุก 1 เลือด)', 'blood brought back by leeches (each point counts)'), every: [60, 35] },
  trunk: [
    { id: 'l_tough', name: L('เลือดข้น', 'Thick Blood'), desc: L('เลือดสูงสุด +10', 'Max health +10') },
    { id: 'l_steady', name: L('มือนิ่ง', 'Steady Hand'), desc: L('กรีดใช้แรงน้อยลง 30%', 'Slashes cost 30% less stamina') },
    { id: 'l_jar', name: L('โหลใหญ่', 'Great Jar'), desc: L('ปาปลิงใช้เลือดน้อยลง 1', 'Throwing a leech costs 1 less blood') },
    { id: 'l_clot', name: L('ลิ่มเลือด', 'Clot'), desc: L('เลือดต่ำกว่า 20% รับดาเมจลดลง 20%', 'Below 20% blood, take 20% less damage') },
  ],
  lines: [
    {
      id: 'brood', name: L('ฝูงปลิง', 'Leech Brood'), blurb: L('เลี้ยงปลิงให้ทำงานแทน · ฝูง กตัญญู และพิษ', 'Let the leeches do the work · swarm, faithful and venom'),
      root: { id: 'fat', name: L('ปลิงอ้วน', 'Fat Leech'), desc: L('ปลิงดูดเลือดเร็วขึ้น 50%', 'Leeches drain blood 50% faster') },
      branches: [
        { name: L('ฝูง', 'Swarm'), nodes: [
          { id: 'swarm', name: L('ฝูงใหญ่', 'Great Swarm'), desc: L('ส่งปลิงออกล่าได้พร้อมกัน 5 ตัว', 'Send out 5 leeches at once') },
          { id: 'l_quick', name: L('ปลิงไว', 'Swift Leech'), desc: L('ปาปลิงพุ่งเร็วและไกลขึ้น 40%', 'Thrown leeches fly 40% faster and farther') },
          { id: 'l_cling', name: L('เกาะแน่น', 'Tight Grip'), desc: L('ปลิงเกาะดูดได้นาน 14 วินาที (ปกติ 8)', 'Leeches cling for 14 seconds (normally 8)') },
        ] },
        { name: L('กตัญญู', 'Faithful'), nodes: [
          { id: 'homing', name: L('ปลิงกตัญญู', 'Faithful Leech'), desc: L('เลือดที่ปลิงนำกลับมา ×1.5 · ปาปลิงใช้เลือดแค่ 2', 'Blood brought back ×1.5 · throwing a leech costs only 2 blood') },
          { id: 'l_rich', name: L('เลือดเข้มข้น', 'Rich Blood'), desc: L('ปลิงกลับมาแล้วให้แรงคืน 10 ด้วย', 'Returning leeches also restore 10 stamina') },
          { id: 'l_breed', name: L('แพร่พันธุ์', 'Breed'), desc: L('ปลิงกลับมามีโอกาส 35% ได้ปลิงเพิ่ม 1 ตัว', 'A returning leech has a 35% chance to bring 1 more') },
        ] },
        { name: L('พิษ', 'Venom'), nodes: [
          { id: 'l_venom', name: L('ปลิงพิษ', 'Venom Leech'), desc: L('ศัตรูที่ถูกปลิงเกาะ เดินช้าลง 40%', 'Leeched foes move 40% slower') },
          { id: 'l_numb', name: L('ชา', 'Numbing'), desc: L('ศัตรูที่ถูกปลิงเกาะ ตีเบาลง 30%', 'Leeched foes hit 30% softer') },
          { id: 'l_plague', name: L('โรคระบาด', 'Plague'), desc: L('ศัตรูที่ถูกเกาะตาย ปลิงกระโดดไปเกาะตัวใกล้ ๆ ต่อ (8 เมตร)', 'When a leeched foe dies, the leech leaps to one nearby (8 metres)') },
        ] },
      ],
      choice: [
        { id: 'l_queen', name: L('นางพญาปลิง', 'Leech Queen'), desc: L('ปลิงที่ปาออกไปดูดเลือดแรง ×2 แต่ส่งออกไปได้น้อยลง 1 ตัว', 'Thrown leeches drain ×2, but you can send out 1 fewer') },
        { id: 'l_feast', name: L('งานเลี้ยง', 'Feast'), desc: L('ปลิงที่เกาะอยู่บนศัตรูทุกตัว ทำให้มีดแรงขึ้น 10%', 'Each leech clinging to a foe makes your knife 10% stronger') },
      ],
      cap: [
        { id: 'burst', name: L('ปลิงระเบิด', 'Bursting Leech'), desc: L('ท่าใหม่: G เรียกปลิงกลับ = ปลิงที่เกาะอยู่ระเบิด ตีแรงและทำให้ศัตรูรอบ ๆ เลือดไหล (แต่ยังนำเลือดกลับมา)', 'New move: G recalls the leeches = clinging leeches burst, striking hard and bleeding foes nearby (blood still returns)') },
        { id: 'l_tide', name: L('คลื่นปลิง', 'Leech Tide'), desc: L('ท่าใหม่: ปาปลิงทีละ 3 ตัวกระจายเป็นรูปพัด (ใช้ปลิง 3 ตัว เลือดเท่าปาตัวเดียว)', 'New move: throw 3 leeches in a fan (uses 3 leeches, blood for one)') },
      ],
    },
    {
      id: 'surgeon', name: L('มีดผ่าตัด', 'Surgeon\'s Knife'), blurb: L('กรีดลึก เลือดยิ่งน้อยยิ่งอันตราย · แผล คลั่ง และดูด', 'Cut deep; the less blood, the deadlier · wounds, frenzy and drain'),
      root: { id: 'scalpel', name: L('มีดคม', 'Sharp Knife'), desc: L('ฟันเบาแรงขึ้น 25%', 'Light attacks deal 25% more damage') },
      branches: [
        { name: L('แผล', 'Wounds'), nodes: [
          { id: 'deepcut', name: L('แผลลึก', 'Deep Cut'), desc: L('เลือดไหลแรงขึ้นและนาน 5 วินาที', 'Bleeding hits harder and lasts 5 seconds') },
          { id: 'l_artery', name: L('ตัดเส้นเลือด', 'Severed Artery'), desc: L('ศัตรูที่เลือดไหล เดินช้าลง 25%', 'Bleeding foes move 25% slower') },
          { id: 'l_hemo', name: L('เลือดไม่หยุด', 'Unstaunched'), desc: L('กรีดซ้ำ เลือดไหลแรงขึ้นทีละขั้น (สูงสุด ×3)', 'Repeated slashes worsen the bleeding step by step (up to ×3)') },
        ] },
        { name: L('คลั่ง', 'Frenzy'), nodes: [
          { id: 'bloodlust', name: L('คลั่งเลือด', 'Bloodlust'), desc: L('เลือดคลั่งสูงสุด ×2.4 → ×3.0', 'Blood frenzy peaks at ×2.4 → ×3.0') },
          { id: 'l_edge', name: L('ปลายมีด', 'Long Blade'), desc: L('มีดยาวขึ้น 0.6 เมตร', 'Knife reaches 0.6 metres farther') },
          { id: 'l_adrenaline', name: L('อะดรีนาลีน', 'Adrenaline'), desc: L('เลือดต่ำกว่า 40% กรีดเร็วขึ้น 25%', 'Below 40% blood, slash 25% faster') },
        ] },
        { name: L('ดูด', 'Drain'), nodes: [
          { id: 'l_sip', name: L('จิบเลือด', 'Sip of Blood'), desc: L('กรีดโดน ฟื้นเลือด 0.5', 'Slash hits restore 0.5 blood') },
          { id: 'l_transfuse', name: L('ถ่ายเลือด', 'Transfusion'), desc: L('ฆ่าศัตรูที่เลือดไหลอยู่ ฟื้นเลือด 8', 'Killing a bleeding foe restores 8 blood') },
          { id: 'l_mark', name: L('ตราเลือด', 'Blood Mark'), desc: L('ศัตรูที่เลือดไหล รับดาเมจ +15%', 'Bleeding foes take +15% damage') },
        ] },
      ],
      choice: [
        { id: 'l_flurry', name: L('กรีดรัว', 'Rapid Slashes'), desc: L('กรีดเร็วขึ้น 20%', 'Slash 20% faster') },
        { id: 'l_precise', name: L('แม่นยำ', 'Precision'), desc: L('กรีดเป้าเดิมติดกัน แรงเพิ่มครั้งละ 10% (สูงสุด +50%)', 'Each straight slash on the same target adds 10% (up to +50%)') },
      ],
      cap: [
        { id: 'dissect', name: L('ผ่าตัดเลือดเย็น', 'Cold Dissection'), desc: L('ท่าใหม่: ฟันโดนเป้าเดิม 4 ครั้งติด ครั้งที่ 4 เป็น "ผ่า" แรง ×3 และดูดเลือดคืน 6', 'New move: hit one target 4 times running; the 4th "dissects" for ×3 and drains 6 blood back') },
        { id: 'l_exsang', name: L('สูบเลือด', 'Exsanguinate'), desc: L('ท่าใหม่: ศัตรูที่เลือดไหลตาย ระเบิดเป็นละอองเลือด ศัตรูรอบ ๆ 4 เมตรเลือดไหลหนัก และเจ้าฟื้นเลือด 10', 'New move: bleeding foes burst into blood mist on death, bleeding all within 4 metres hard; you regain 10 blood') },
      ],
    },
  ],
};

const WICK = {
  token: { name: L('ไขเทียนดำ', 'Black Tallow'), icon: '🕯', feat: L('ฟันโดนตอนไฟร้อนเกินครึ่ง หรือลอบโจมตีจากความมืด', 'hit above half heat, or strike from the dark'), every: [15, 10] },
  trunk: [
    { id: 'k_wax', name: L('ไขหนา', 'Thick Wax'), desc: L('เลือด (ไขเทียน) สูงสุด +10', 'Max health (wax) +10') },
    { id: 'k_chain', name: L('โซ่ยาว', 'Long Chain'), desc: L('เหวี่ยงกระถางไฟไกลขึ้น 0.5 เมตร', 'Censer swings reach 0.5 metres farther') },
    { id: 'k_ember', name: L('ถ่านแดง', 'Red Ember'), desc: L('ไฟเย็นลงช้าลง 40%', 'Heat cools 40% slower') },
    { id: 'k_hearth', name: L('ใกล้เตา', 'By the Hearth'), desc: L('หล่อเทียนที่กองไฟเร็วขึ้น 50%', 'Remould wax at bonfires 50% faster') },
  ],
  lines: [
    {
      id: 'flame', name: L('เปลวเพลิง', 'Flame'), blurb: L('ทุกอย่างต้องลุกไหม้ · โหม ลาม และไข', 'All must burn · stoke, spread and wax'),
      root: { id: 'blaze', name: L('ไฟแรง', 'Fierce Fire'), desc: L('ศัตรูติดไฟแรงขึ้น 60%', 'Burns on foes are 60% stronger') },
      branches: [
        { name: L('โหมไฟ', 'Stoke the Fire'), nodes: [
          { id: 'stoke', name: L('โหมไฟ', 'Stoke the Fire'), desc: L('ไฟร้อนขึ้นเร็วขึ้น 50% และระยะเหวี่ยงจากความร้อนไกลขึ้น', 'Heat builds 50% faster; heat lengthens your swings further') },
          { id: 'k_inferno', name: L('นรกเพลิง', 'Inferno'), desc: L('ไฟร้อนเกือบเต็ม (90%) ตีแรงขึ้น 25%', 'Near full heat (90%), deal 25% more damage') },
          { id: 'k_overheat', name: L('ร้อนจัด', 'Overheat'), desc: L('ไฟร้อนเกินครึ่ง เหวี่ยงใช้แรงน้อยลง 60%', 'Above half heat, swings cost 60% less stamina') },
        ] },
        { name: L('ไฟลาม', 'Spreading Fire'), nodes: [
          { id: 'k_spread', name: L('ไฟลาม', 'Spreading Fire'), desc: L('ศัตรูที่ติดไฟตาย ไฟลามไปตัวใกล้ ๆ (5 เมตร)', 'When a burning foe dies, fire spreads to one nearby (5 metres)') },
          { id: 'k_ash', name: L('เถ้าถ่าน', 'Ash'), desc: L('ศัตรูที่ติดไฟ ตีเบาลง 20%', 'Burning foes hit 20% softer') },
          { id: 'k_pyre', name: L('กองฟอน', 'Pyre'), desc: L('ศัตรูที่ติดไฟตาย ทิ้งกองไฟไว้ 20 วินาที (ใช้หล่อเทียนได้)', 'Burning foes leave a bonfire for 20 seconds (fit for remoulding)') },
        ] },
        { name: L('ไข', 'Wax'), nodes: [
          { id: 'tallow', name: L('ไขทนไฟ', 'Fireproof Tallow'), desc: L('เทียนละลายช้าลงครึ่งหนึ่ง', 'Your candle melts half as fast') },
          { id: 'k_drip', name: L('น้ำตาเทียน', 'Candle Tears'), desc: L('เหวี่ยงโดน หล่อเทียนคืน 0.5', 'Swing hits remould 0.5 wax') },
          { id: 'k_phoenix', name: L('ฟีนิกซ์', 'Phoenix'), desc: L('ครั้งแรกที่ไขจะหมด ลุกกลับขึ้นมาพร้อมไข 40 (ทุก 3 นาที)', 'The first time your wax runs out, rise again with 40 (every 3 minutes)') },
        ] },
      ],
      choice: [
        { id: 'k_censer', name: L('กระถางใหญ่', 'Great Censer'), desc: L('หมุนรอบตัว (ฟันหนัก) กว้างขึ้น 1.2 เมตร', 'Spin (heavy attack) 1.2 metres wider') },
        { id: 'k_flare', name: L('ไฟพุ่ง', 'Flare'), desc: L('เหวี่ยงเบาไกลขึ้น 1.5 เมตร', 'Light swings reach 1.5 metres farther') },
      ],
      cap: [
        { id: 'firestorm', name: L('พายุไฟ', 'Firestorm'), desc: L('ท่าใหม่: หมุนรอบตัว (ฟันหนัก) ทิ้งวงไฟไว้บนพื้น 4 วินาที เผาทุกอย่างที่เหยียบ', 'New move: spin (heavy attack) leaves a ring of fire for 4 seconds, burning all who tread it') },
        { id: 'k_sun', name: L('ดวงอาทิตย์ดับ', 'Dying Sun'), desc: L('ท่าใหม่: G ตอนไฟร้อนเต็ม = ระเบิดไฟรอบตัว 7 เมตร แรง 4 ไฟลุกท่วม (ไฟลดเหลือศูนย์)', 'New move: G at full heat = a 7 metre blast, damage 4, setting all ablaze (heat drops to zero)') },
      ],
    },
    {
      id: 'shadow', name: L('เงามืด', 'Shadow'), blurb: L('หายไปในความมืด แล้วโผล่มาเผา · ย่อง เทียน และลอบ', 'Vanish into the dark, then burn · stalk, candles and ambush'),
      root: { id: 'longwick', name: L('ไส้เทียนยาว', 'Long Wick'), desc: L('เทียนที่ปักอยู่ได้ 150 วินาที และปักได้ 4 เล่ม', 'Planted candles last 150 seconds; plant up to 4') },
      branches: [
        { name: L('ย่อง', 'Stalk'), nodes: [
          { id: 'stalk', name: L('ย่องในเงา', 'Shadow Stalk'), desc: L('ตอนป้องไฟ เดินเร็วขึ้น 25% และเทียนค่อย ๆ หล่อคืน', 'While shielding the flame, move 25% faster and slowly remould wax') },
          { id: 'k_silent', name: L('ไร้เสียง', 'Soundless'), desc: L('ป้องไฟแล้ว ศัตรูที่กำลังไล่ลืมเจ้าไปเลย', 'Shielding the flame makes pursuers forget you') },
          { id: 'k_shade', name: L('เงาเย็น', 'Cool Shade'), desc: L('ตอนป้องไฟ หล่อเทียนคืน 1.6 ต่อวินาที', 'While shielding the flame, remould 1.6 wax per second') },
        ] },
        { name: L('เทียน', 'Candles'), nodes: [
          { id: 'ward', name: L('แสงขับไล่', 'Warding Light'), desc: L('เทียนที่ปักกันร่างซีดได้กว้าง 7.5 เมตร และหล่อเทียนเร็วขึ้น', 'Planted candles ward off the Pale Ones out to 7.5 metres and remould faster') },
          { id: 'k_beacon', name: L('เทียนนำทาง', 'Guiding Candle'), desc: L('ยืนใกล้เทียนที่ปักไว้ ตีแรงขึ้น 20%', 'Near a planted candle, deal 20% more damage') },
          { id: 'k_brand', name: L('เทียนเผา', 'Branding Candle'), desc: L('ร่างซีดที่ถูกแสงเทียนผลักออก ติดไฟ', 'Pale Ones driven back by candlelight catch fire') },
        ] },
        { name: L('ลอบ', 'Ambush'), nodes: [
          { id: 'k_knife', name: L('ลอบกัด', 'Backbite'), desc: L('ตีศัตรูจากด้านหลัง แรงขึ้น 40%', 'Attacks from behind deal 40% more damage') },
          { id: 'k_vanish', name: L('หายตัว', 'Vanish'), desc: L('ฆ่าศัตรูแล้ว 2 วินาทีต่อมา ศัตรูมองไม่เห็นเจ้า', 'For 2 seconds after a kill, foes cannot see you') },
          { id: 'k_dread', name: L('หวาดกลัว', 'Dread'), desc: L('ลอบเผาแล้ว ศัตรูรอบ ๆ 5 เมตรเซ 1.2 วินาที', 'An ambush burn staggers foes within 5 metres for 1.2 seconds') },
        ] },
      ],
      choice: [
        { id: 'k_twin', name: L('เทียนประหยัด', 'Frugal Candle'), desc: L('ปักเทียนใช้ไขแค่ 3 (ปกติ 6)', 'Planting a candle costs only 3 wax (normally 6)') },
        { id: 'k_cateye', name: L('ตาแมว', 'Cat\'s Eye'), desc: L('ตอนป้องไฟยังมองเห็นชัด (ความมืดลดลงมาก)', 'See clearly while shielding the flame (far less darkness)') },
      ],
      cap: [
        { id: 'ambush', name: L('ลอบเผา', 'Ambush Burn'), desc: L('ท่าใหม่: ภายใน 2 วินาทีหลังเลิกป้องไฟ ฟันแรกแรง ×3 และเผาไฟลุกท่วม', 'New move: within 2 seconds of unshielding, your first strike deals ×3 and sets the foe ablaze') },
        { id: 'k_eclipse', name: L('สุริยคราส', 'Eclipse'), desc: L('ท่าใหม่: ภายใน 3 วินาทีหลังเลิกป้องไฟ ทุกการเหวี่ยงแรง ×2 และไฟร้อนเต็มทันที', 'New move: within 3 seconds of unshielding, every swing deals ×2 and heat fills at once') },
      ],
    },
  ],
};

// the crossbow hunter: a sharp eye at range, or a trapper who makes the ground do the work
const HUNTER = {
  token: { name: L('ขนนกหางลูกดอก', 'Bolt Fletching'), icon: '🪶', feat: L('ยิงโดนหัว หรือฆ่าด้วยการเล็งยิง', 'headshot, or aimed-shot kill'), every: [6, 4] },
  trunk: [
    { id: 'h_sure', name: L('มือนิ่ง', 'Steady Hand'), desc: L('ยิงเบาแรงขึ้น 10%', 'Quick shots deal 10% more damage') },
    { id: 'h_load', name: L('บรรจุคล่อง', 'Deft Loading'), desc: L('บรรจุหน้าไม้เร็วขึ้น 15%', 'Reload the crossbow 15% faster') },
    { id: 'h_hide', name: L('หนังสัตว์', 'Beast Hide'), desc: L('เลือดสูงสุด +10', 'Max health +10') },
    { id: 'h_trapper', name: L('ช่างกับดัก', 'Trapwright'), desc: L('วางกับดัก [G] พักแค่ 14 วินาที (ปกติ 18)', 'Set Trap [G] recharges in 14 seconds (normally 18)') },
  ],
  lines: [
    {
      id: 'marksman', name: L('มือแม่น', 'Marksman'), blurb: L('เน้นยิงไกล · เล็ง บรรจุ และซุ่ม', 'Range · aim, reload and lurk'),
      root: { id: 'h_eye', name: L('ตาเหยี่ยว', 'Hawk Eye'), desc: L('เล็งยิง (กดค้างแล้วปล่อย) แรงขึ้น 20%', 'Aimed shots (hold, then release) deal 20% more damage') },
      branches: [
        { name: L('เล็ง', 'Aim'), nodes: [
          { id: 'h_head', name: L('จุดตาย', 'Vital Spot'), desc: L('ยิงโดนหัวแรง ×2 (ปกติ ×1.5)', 'Headshots deal ×2 (normally ×1.5)') },
          { id: 'h_pierce', name: L('ทะลวง', 'Pierce'), desc: L('เล็งยิงทะลุได้ 5 ตัว (ปกติ 3)', 'Aimed shots pierce 5 foes (normally 3)') },
          { id: 'h_barb', name: L('ลูกดอกหนาม', 'Barbed Bolt'), desc: L('ลูกดอกที่โดนทำให้ศัตรูเลือดไหล 4 วินาที', 'Bolts that hit cause bleeding for 4 seconds') },
        ] },
        { name: L('บรรจุ', 'Reload'), nodes: [
          { id: 'h_quick', name: L('มือไว', 'Quick Hands'), desc: L('บรรจุเร็วขึ้นอีก 25%', 'Reload a further 25% faster') },
          { id: 'h_thrift', name: L('ประหยัด', 'Thrift'), desc: L('ยิงแล้วมีโอกาส 30% ไม่เสียลูกดอก', '30% chance a shot costs no bolt') },
          { id: 'h_chain', name: L('ล่าต่อเนื่อง', 'Chain Hunt'), desc: L('ยิงฆ่าศัตรูได้ ลูกถัดไปบรรจุทันที', 'A killing shot loads the next bolt at once') },
        ] },
        { name: L('ซุ่ม', 'Lurk'), nodes: [
          { id: 'h_far', name: L('ไกลยิ่งแรง', 'Long Reach'), desc: L('ทุก 5 เมตรของระยะ ลูกดอกแรงขึ้น 4% (สูงสุด +32%)', 'Bolts deal 4% more per 5 metres of range (up to +32%)') },
          { id: 'h_still', name: L('นิ่งดั่งหิน', 'Still as Stone'), desc: L('ยืนนิ่ง 1.5 วินาที ลูกต่อไปแรงขึ้น 40%', 'Stand still 1.5 seconds; the next shot deals 40% more') },
          { id: 'h_unseen', name: L('ไร้เงา', 'Unseen'), desc: L('ยิงศัตรูที่ยังไม่รู้ตัว แรง ×1.6', 'Shots on unaware foes deal ×1.6') },
        ] },
      ],
      choice: [
        { id: 'h_iron', name: L('ลูกดอกเหล็กหนัก', 'Heavy Iron Bolt'), desc: L('ลูกดอกทุกลูกทำให้ศัตรูทั่วไปเซ 0.6 วินาที', 'Every bolt staggers common foes 0.6 seconds') },
        { id: 'h_twin', name: L('หน้าไม้สองสาย', 'Twin-String Crossbow'), desc: L('บรรจุทีเดียวยิงได้ 2 ลูกติดกัน', 'Each reload fires 2 bolts in a row') },
      ],
      cap: [
        { id: 'h_moon', name: L('ลูกดอกทะลุจันทร์', 'Moonpiercer'), desc: L('ท่าใหม่: เล็งยิงแรง ×1.5 ทะลุทุกตัวในแนวและพุ่งไกลเป็นสองเท่า', 'New move: aimed shots deal ×1.5, pierce all in line and fly twice as far') },
        { id: 'h_volley', name: L('ห่าลูกดอก', 'Bolt Volley'), desc: L('ท่าใหม่: เล็งยิงปล่อยลูกดอก 3 ลูกเป็นรูปพัด (ใช้ลูกดอกลูกเดียว)', 'New move: aimed shots loose 3 bolts in a fan (uses one bolt)') },
      ],
    },
    {
      id: 'trapper', name: L('นักล่ากับดัก', 'Trapper'), blurb: L('เน้นกับดักและมีด · ให้พื้นดินทำงานแทน', 'Traps and knife · let the ground do the work'),
      root: { id: 'h_snare', name: L('บ่วงแรก', 'First Snare'), desc: L('วางกับดักได้ 3 อัน (ปกติ 2) และกับดักแรงขึ้น 50%', 'Set 3 traps (normally 2); traps deal 50% more damage') },
      branches: [
        { name: L('กับดัก', 'Traps'), nodes: [
          { id: 'h_jaws', name: L('ฟันเหล็ก', 'Iron Teeth'), desc: L('กับดักหนีบนาน 5 วินาที (ปกติ 3)', 'Traps hold for 5 seconds (normally 3)') },
          { id: 'h_rust', name: L('สนิมพิษ', 'Poison Rust'), desc: L('ศัตรูที่ติดกับดักเลือดไหลนาน 6 วินาที', 'Trapped foes bleed for 6 seconds') },
          { id: 'h_rearm', name: L('ง้างใหม่', 'Rearm'), desc: L('กับดักง้างตัวเองใหม่ได้อีก 1 ครั้งหลังหนีบ', 'Traps rearm themselves once after snapping') },
        ] },
        { name: L('สัญชาตญาณ', 'Instinct'), nodes: [
          { id: 'h_prey', name: L('เหยื่อติดบ่วง', 'Snared Prey'), desc: L('ศัตรูที่เซหรือติดกับดักรับดาเมจ +30%', 'Staggered or trapped foes take +30% damage') },
          { id: 'h_salvage', name: L('เก็บลูกดอก', 'Salvage'), desc: L('เก็บลูกดอกคืนจากศพได้ทุกดอก (ปกติ 60%) ลูกที่ตกพื้นอยู่นานขึ้น', 'Recover every bolt from corpses (normally 60%); fallen bolts linger longer') },
          { id: 'h_skin', name: L('แล่หนัง', 'Skinning'), desc: L('ฆ่าศัตรูที่ติดกับดัก ได้เหรียญเพิ่ม 4', 'Killing a trapped foe yields 4 more coins') },
        ] },
        { name: L('มีด', 'Knife'), nodes: [
          { id: 'h_knife', name: L('มีดเดินป่า', 'Hunting Knife'), desc: L('แทงมีด (ตอนลูกดอกหมด หรือหน้าไม้ยังบรรจุอยู่) แรงขึ้น 40% และเร็วขึ้น 15%', 'Knife stabs (out of bolts or mid-reload) deal 40% more and are 15% faster') },
          { id: 'h_kite', name: L('ถอยยิง', 'Fall Back'), desc: L('กลิ้งหลบแล้วหน้าไม้บรรจุเสร็จทันที', 'Rolling finishes your reload at once') },
          { id: 'h_feet', name: L('ฝีเท้าพราน', 'Hunter\'s Stride'), desc: L('กลิ้งหลบใช้แรงน้อยลง 40% และเดินเร็วขึ้น 5%', 'Rolls cost 40% less stamina; move 5% faster') },
        ] },
      ],
      choice: [
        { id: 'h_blast', name: L('กับดักดินปืน', 'Powder Trap'), desc: L('กับดักระเบิดเมื่อหนีบ ตีทุกตัวรอบ 3 เมตร', 'Traps explode on snapping, striking all within 3 metres') },
        { id: 'h_net', name: L('ตาข่าย', 'Net'), desc: L('กับดักหนีบทุกตัวรอบ 2.5 เมตรพร้อมกัน', 'Traps snare every foe within 2.5 metres at once') },
      ],
      cap: [
        { id: 'h_field', name: L('ทุ่งกับดัก', 'Field of Traps'), desc: L('ท่าใหม่: G โยนกับดัก 3 อันเป็นรูปพัดไปข้างหน้าในครั้งเดียว', 'New move: G throws 3 traps in a fan ahead at once') },
        { id: 'h_feast', name: L('งานเลี้ยงของนักล่า', 'Hunter\'s Feast'), desc: L('ท่าใหม่: ฆ่าศัตรูที่ติดกับดัก = กับดักพร้อมใช้ทันที บรรจุเสร็จทันที และฟื้นเลือด 10', 'New move: killing a trapped foe = trap ready and reload done at once; restore 10 health') },
      ],
    },
  ],
};

// every tree as nodes with their place, price and what they need
function build(cls, src) {
  const nodes = {}, add = (n, extra) => { nodes[n.id] = { ...n, ...extra }; return nodes[n.id]; };
  const trunk = (src.trunk || []).map((n, i, a) => add(n, { ...TRUNK[i], ...n, line: null, place: 'trunk', req: i ? [a[i - 1].id] : [] }));
  const last = trunk.length ? [trunk[trunk.length - 1].id] : [];
  const lines = src.lines.map((ln) => {
    const root = add(ln.root, { pts: 1, lv: 4, tok: 0, ...ln.root, line: ln.id, place: 'root', req: last });
    const branches = ln.branches.map((b) => ({ name: b.name, nodes: b.nodes.map((n, i, a) => add(n, { ...PRICE.branch[i + (3 - a.length)], ...n, line: ln.id, place: 'branch', req: [i ? a[i - 1].id : root.id] })) }));
    const all = branches.flatMap((b) => b.nodes.map((n) => n.id));
    const choice = (ln.choice || []).map((n) => add(n, { ...PRICE.choice, ...n, line: ln.id, place: 'choice', excl: `${ln.id}:choice`, reqAny: { ids: all, n: Math.min(2, all.length) } }));
    const cap = ln.cap.map((n) => add(n, {
      ...PRICE.cap, ...n, line: ln.id, place: 'cap', excl: `${ln.id}:cap`,
      ...(choice.length ? { req: [], reqAny: { ids: choice.map((c) => c.id), n: 1 }, reqMore: { ids: all, n: 4 } } : { req: [all[all.length - 1]] }),
    }));
    return { id: ln.id, name: ln.name, blurb: ln.blurb, root, branches, choice, cap };
  });
  return { cls, token: src.token, trunk, lines, nodes };
}

export const TREES = {
  wanderer: build('wanderer', WANDERER), bell: build('bell', BELL), leech: build('leech', LEECH),
  coffin: build('coffin', COFFIN), wick: build('wick', WICK), hunter: build('hunter', HUNTER),
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
    if (node.line && this.line[cls] && this.line[cls] !== node.line) return L('ปิดถาวร (เลือกอีกสายไปแล้ว)', 'Closed for good (the other line was chosen)');
    if (node.excl) {
      const other = Object.values(TREES[cls].nodes).find((n) => n.excl === node.excl && n.id !== node.id && this.has(cls, n.id));
      if (other) return L(`ปิดถาวร (เลือก${other.name}ไปแล้ว)`, `Closed for good (${other.name} was chosen)`);
    }
    return null;
  }

  // null when it can be bought, otherwise why not
  why(cls, id) {
    const tree = TREES[cls], node = tree?.nodes[id];
    if (!node) return L('ไม่มีสกิลนี้', 'No such skill');
    if (this.has(cls, id)) return L('ได้แล้ว', 'Learned');
    const shut = this.closed(cls, node);
    if (shut) return shut;
    for (const r of node.req || []) if (!this.has(cls, r)) return L(`ต้องได้${tree.nodes[r].name}ก่อน`, `Requires ${tree.nodes[r].name}`);
    for (const k of ['reqAny', 'reqMore']) {
      const q = node[k];
      if (!q) continue;
      const have = q.ids.filter((i) => this.has(cls, i)).length;
      if (have < q.n) return k === 'reqAny' && q.n === 1 ? L('ต้องเลือกขั้นก่อนหน้าก่อน', 'Choose the step before first') : L(`ต้องมีสกิลในสายนี้อีก ${q.n - have}`, `Needs ${q.n - have} more skills in this line`);
    }
    if (this.levelOf(cls) < this.lv(node)) return L(`ต้องเลเวล ${this.lv(node)}`, `Requires level ${this.lv(node)}`);
    if (this.points(cls) < node.pts) return L(`แต้มไม่พอ (ต้องการ ${node.pts})`, `Not enough points (need ${node.pts})`);
    if ((this.tokens[cls] || 0) < (node.tok || 0)) return L(`${tree.token.name}ไม่พอ (ต้องการ ${node.tok})`, `Not enough ${tree.token.name} (need ${node.tok})`);
    return null;
  }

  // buying this closes something for good (first point in a line, or one of a pair)
  commits(cls, id) {
    const node = TREES[cls].nodes[id];
    if (node.line && !this.line[cls]) {
      const name = TREES[cls].lines.find((l) => l.id === node.line).name;
      return L(`เลือกสาย "${name}" แล้ว อีกสายจะปิดถาวร`, `Choose the "${name}" line? The other closes for good`);
    }
    if (node.excl) {
      const other = Object.values(TREES[cls].nodes).find((n) => n.excl === node.excl && n.id !== id);
      if (other) return L(`เลือก "${node.name}" แล้ว "${other.name}" จะปิดถาวร`, `Choose "${node.name}"? "${other.name}" closes for good`);
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
    const cost = `${n.pts} ${L('แต้ม', n.pts === 1 ? 'pt' : 'pts')}${n.tok ? ` · ${t.icon}${n.tok}` : ''} · Lv ${pr.lv(n)}`;
    const state = own ? 'own' : shut ? 'shut' : why ? 'locked' : 'can';
    const star = n.place === 'cap' ? '★ ' : n.place === 'choice' ? '◆ ' : '';
    return `<button class="sk-node ${state} ${n.place}" data-id="${n.id}" title="${own ? '' : why || L('กดเพื่อปลดล็อก', 'Click to unlock')}">
      <div class="sk-name">${star}${n.name}</div><div class="sk-desc">${n.desc}</div>
      <div class="sk-cost">${own ? L('✔ ได้แล้ว', '✔ Learned') : shut ? `✖ ${shut}` : why ? `${cost} — ${why}` : cost}</div></button>`;
  }

  render() {
    const g = this.g, pr = g.progress, cls = g.kit.id, tree = TREES[cls], c = CLASSES[cls];
    const t = tree.token, have = pr.tokens[cls] || 0, every = t.every[pr.online ? 1 : 0];
    $('skills-title').textContent = `${c.icon} ${L('ต้นไม้สกิล', 'Skill Tree')} — ${c.name}`;
    const maxed = pr.levelOf(cls) >= pr.MAX, pa = pr.path(cls);
    $('skills-head').innerHTML = `
      <div class="sk-lv">${L(`เลเวล ${c.name}`, `${c.name} level`)} <b>${pa.level}</b>${maxed ? L(' (สูงสุด)', ' (max)') : ''}<div class="sk-xp"><i style="width:${maxed ? 100 : (pa.xp / pr.need(pa.level) * 100).toFixed(1)}%"></i></div><span>${maxed ? '' : `${Math.floor(pa.xp)}/${pr.need(pa.level)} XP`}</span></div>
      <div class="sk-pts">${L('แต้ม', 'Points')} <b>${pr.points(cls)}</b></div>
      <div class="sk-tok">${t.icon} ${t.name} <b>${have}</b><span>${L(`ได้อีก 1 เมื่อ${t.feat} ครบ ${every}`, `+1 per ${every}: ${t.feat}`)} (${pr.feats[cls] || 0}/${every})</span></div>`;
    const N = (n) => this.node(cls, n);
    const trunk = tree.trunk.length ? `<div class="sk-trunk"><div class="sk-label">${L('ลำต้น — ทุกคนในวิถีนี้', 'Trunk — shared by all on this path')}</div><div class="sk-row">${tree.trunk.map(N).join('<i class="sk-arrow">→</i>')}</div></div>` : '';
    const lines = tree.lines.map((ln) => {
      const shut = pr.line[cls] && pr.line[cls] !== ln.id;
      const branches = ln.branches.map((b) => `<div class="sk-branch">${b.name ? `<div class="sk-label">${b.name}</div>` : ''}${b.nodes.map(N).join('<i class="sk-down">↓</i>')}</div>`).join('');
      return `<div class="sk-col ${shut ? 'closed' : ''} ${pr.line[cls] === ln.id ? 'chosen' : ''}">
        <div class="sk-line">${ln.name}${shut ? L(' — ปิดถาวร', ' — closed for good') : pr.line[cls] === ln.id ? L(' — สายของเจ้า', ' — your line') : ''}</div><div class="sk-blurb">${ln.blurb}</div>
        ${N(ln.root)}<i class="sk-down">↓</i>
        <div class="sk-branches">${branches}</div>
        ${ln.choice.length ? `<i class="sk-down">↓</i><div class="sk-label">${L('เลือก 1 ใน 2', 'Choose 1 of 2')}</div><div class="sk-pair">${ln.choice.map(N).join(`<i class="sk-or">${L('หรือ', 'or')}</i>`)}</div>` : ''}
        <i class="sk-down">↓</i><div class="sk-label">${ln.cap.length > 1 ? L('ท่าไม้ตาย — เลือก 1 ใน 2', 'Finishing Art — choose 1 of 2') : L('ท่าไม้ตาย', 'Finishing Art')}</div><div class="sk-pair">${ln.cap.map(N).join(`<i class="sk-or">${L('หรือ', 'or')}</i>`)}</div>
      </div>`;
    }).join('');
    const confirm = this.pending ? `<div class="sk-confirm"><div>⚠ ${pr.commits(cls, this.pending)}<br><small>${L('เปลี่ยนใจภายหลังไม่ได้', 'There is no undoing this')}</small></div>
      <button data-ok="1">${L('ยืนยัน', 'Confirm')}</button><button data-ok="0">${L('ยกเลิก', 'Cancel')}</button></div>` : '';
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
      g.ui.combatText(L(`ปลดล็อก: ${TREES[cls].nodes[id].name}`, `Unlocked: ${TREES[cls].nodes[id].name}`), 'parry');
      g.save();
    }
    this.render();
  }
}
