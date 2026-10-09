// The first steps: a short drill at the start of a new story, one control at a time. Each step
// shows its key and waits until the player has actually done it (moved, swung, blocked ...), so
// nothing is read and forgotten. Enter skips a step, Backspace the whole drill; it can be run
// again from the pause menu, which also lists every control.
import { L } from './i18n.js';

const STEPS = [
  { key: L('เมาส์', 'Mouse'), touch: L('ลากนิ้วฝั่งขวาของจอ', 'Drag on the right of the screen'), pad: L('สติ๊กขวา', 'Right stick'), title: L('มองรอบ ๆ', 'Look Around'), text: L('ขยับเมาส์เพื่อหันมองไปรอบตัว', 'Move the mouse to look around'), done: (s) => s.look > 1.2 },
  { key: 'W A S D', touch: L('จอยซ้ายมือ', 'Left joystick'), pad: L('สติ๊กซ้าย', 'Left stick'), title: L('เดิน', 'Walk'), text: L('W เดินหน้า · S ถอยหลัง · A / D เดินออกข้าง', 'W forward · S back · A / D step aside'), done: (s) => s.walked > 4 },
  { key: L('Shift ค้าง', 'Hold Shift'), touch: '»', pad: L('LB ค้าง / กด L3', 'Hold LB / press L3'), title: L('วิ่ง', 'Run'), text: L('กด Shift ค้างไว้ขณะเดินเพื่อวิ่ง — กินแถบแรง (สีเหลือง) แรงหมดจะหอบ', 'Hold Shift while walking to run — it drains stamina (the yellow bar); run dry and you gasp for breath'), done: (s) => s.ran > 1.2 },
  { key: 'Space', touch: '⤒', pad: 'A', title: L('กระโดด', 'Jump'), text: L('กระโดดข้ามรั้ว ก้อนหิน และขึ้นที่สูง', 'Leap over fences and stones, and climb to high places'), done: (s) => s.saw.jump },
  { key: L('คลิกซ้าย', 'Left click'), touch: '⚔', pad: 'RT', title: L('ฟัน', 'Light Attack'), text: L('คลิกซ้ายเพื่อฟันดาบ ลองฟันลมดู 2 ครั้ง', 'Left click to swing your blade. Cut the air 2 times'), done: (s) => s.n.attack >= 2 },
  { key: L('คลิกซ้ายค้าง', 'Hold left click'), touch: L('⚔ ค้าง', 'Hold ⚔'), pad: L('RT ค้าง', 'Hold RT'), title: L('ฟันหนัก', 'Heavy Attack'), text: L('กดค้างแล้วปล่อย = ฟันหนัก ช้ากว่าแต่แรงกว่า ทำลายการ์ดศัตรูได้', 'Hold, then release = heavy attack. Slower but stronger; it breaks a foe\'s guard'), done: (s) => s.heavy },
  { key: L('คลิกขวาค้าง', 'Hold right click'), touch: L('🛡 ค้าง', 'Hold 🛡'), pad: L('LT ค้าง', 'Hold LT'), title: L('ป้องกัน / ปัด', 'Block / Parry'), text: L('ยกดาบกันการโจมตี · ยกกันพอดีจังหวะที่ศัตรูฟันมา = ปัด ทำให้มันเสียหลัก', 'Raise your blade to block · block just as the foe strikes = parry, and it staggers'), done: (s) => s.blocked > 0.8 },
  { key: L('C หรือ Ctrl', 'C or Ctrl'), touch: '↯', pad: 'B', title: L('หลบ', 'Dodge'), text: L('กลิ้งหลบการโจมตี — ระหว่างกลิ้งจะไม่โดนตี ใช้แถบแรง', 'Roll away from blows — nothing strikes you mid-roll. Costs stamina'), done: (s) => s.saw.dodge },
  { key: 'G', touch: '✦', pad: 'RB', title: L('สกิลประจำสาย', 'Path Skill'), text: L('สกิลพิเศษของสายที่เลือก แต่ละสายไม่เหมือนกัน มีเวลาคูลดาวน์', 'The special skill of your path. Each path has its own; it must recover between uses'), done: (s) => s.saw.skill },
  { key: L('I หรือ Tab', 'I or Tab'), touch: '🎒', pad: L('ปุ่มขวา (D-pad)', 'Right (D-pad)'), title: L('กระเป๋า', 'Bag'), text: L('เปิดกระเป๋าดูของ ใช้ยา จัดของ — กด I อีกครั้งเพื่อปิด', 'Open your bag to see your things, drink draughts, sort items — press I again to close'), done: (s) => s.saw.bag },
  { key: 'M', touch: '⌖', pad: L('ปุ่มขึ้น (D-pad)', 'Up (D-pad)'), title: L('แผนที่', 'Map'), text: L('ดูแผนที่ ตำแหน่งตัวเอง และเป้าหมายเควสต์ — กด M อีกครั้งเพื่อปิด', 'See the map, where you stand and your quest goal — press M again to close'), done: (s) => s.saw.map },
  { key: 'K', touch: '⬆', pad: L('ปุ่มซ้าย (D-pad)', 'Left (D-pad)'), title: L('ต้นไม้สกิล', 'Skill Tree'), text: L('ฆ่าศัตรูและทำเควสต์ได้ค่าประสบการณ์ เลเวลอัปแล้วได้แต้มมาอัปสกิลที่นี่ (เลือกสายแล้วเปลี่ยนไม่ได้!)', 'Slay foes and finish quests for experience. Each level grants points to spend here (a branch once chosen cannot be undone!)'), done: (s) => s.saw.skills },
  { key: 'H', touch: '🪳', pad: L('ปุ่มลง (D-pad)', 'Down (D-pad)'), title: L('ขี่แมลงสาบยักษ์', 'Ride the Giant Cockroach'), text: L('ผิวปากเรียกแมลงสาบมาขี่ วิ่งเร็วมาก เหมาะกับเดินทางไกล — กด H อีกครั้งเพื่อลง', 'Whistle for the cockroach and ride. It runs very fast, good for long roads — press H again to dismount'), done: (s) => s.saw.mount },
];

export class Tutorial {
  constructor(g) {
    this.g = g;
    this.el = document.getElementById('tutorial');
    this.active = false;
    // see every action the moment it is pressed, before the game consumes it
    const input = g.input, add = input.actions.add.bind(input.actions);
    input.actions.add = (a) => { if (this.active) this.press(a); return add(a); };
    addEventListener('keydown', (e) => {
      if (!this.active || this.g.state !== 'play' || this.g.ui.dialogueOpen) return;
      if (e.code === 'Enter' && !e.repeat) this.next();
      if (e.code === 'Backspace') { e.preventDefault(); this.finish(true); }
    });
    this.el.querySelector('.tut-skip').addEventListener('click', () => this.next());
    this.el.querySelector('.tut-end').addEventListener('click', () => this.finish(true));
  }

  start() {
    this.active = true;
    this.i = -1;
    this.next();
  }

  reset() {
    const p = this.g.player;
    this.s = { look: 0, walked: 0, ran: 0, blocked: 0, held: 0, heavy: false, saw: {}, n: {}, yaw: p.yaw, x: p.pos.x, z: p.pos.z, t: 0 };
  }

  press(a) {
    if (!this.s || this.g.state !== 'play') return;
    this.s.saw[a] = true;
    this.s.n[a] = (this.s.n[a] || 0) + 1;
  }

  next() {
    if (this.i >= STEPS.length) return this.finish();
    this.i++;
    this.reset();
    if (this.i >= STEPS.length) return this.summary();
    const st = STEPS[this.i], touch = this.g.input.touch;
    this.el.className = touch ? 'touch' : '';
    this.el.querySelector('.tut-step').textContent = L(`ฝึกพื้นฐาน ${this.i + 1}/${STEPS.length}`, `First Steps ${this.i + 1}/${STEPS.length}`);
    this.pad = this.g.gamepads?.active;
    this.el.querySelector('.tut-key').textContent = touch ? st.touch : this.pad ? st.pad : st.key;
    this.el.querySelector('.tut-title').textContent = st.title;
    this.el.querySelector('.tut-text').textContent = st.text;
    this.el.querySelector('.tut-bar i').style.width = `${(this.i / STEPS.length) * 100}%`;
    this.el.querySelector('.tut-hint').textContent = touch ? '' : this.pad ? L('จอย: กด Start เพื่อหยุดเกม · คีย์บอร์ด Enter = ข้ามขั้นนี้', 'Controller: Start to pause · keyboard Enter = skip this step') : L('Enter = ข้ามขั้นนี้ · Backspace = ข้ามการฝึกทั้งหมด', 'Enter = skip this step · Backspace = skip all training');
  }

  // the last card: the controls that need something nearby to try
  summary() {
    this.i = STEPS.length;
    const touch = this.g.input.touch;
    this.el.className = touch ? 'summary touch' : 'summary';
    this.el.querySelector('.tut-step').textContent = L('ฝึกพื้นฐานครบแล้ว', 'First Steps Complete');
    this.el.querySelector('.tut-key').textContent = '✓';
    this.el.querySelector('.tut-title').textContent = L('พร้อมออกเดินทาง', 'Ready to Set Forth');
    const pad = this.g.gamepads?.active;
    this.el.querySelector('.tut-text').innerHTML = pad
      ? L('<b>X</b> คุยกับคน / เก็บของ / เปิดหีบ เมื่ออยู่ใกล้ · <b>Y</b> ดื่มยาฟื้นเลือด · <b>Start</b> หยุดเกมและดูปุ่มทั้งหมด<br>ในเมนูใช้สติ๊กซ้ายเลื่อนลูกศร กด A เลือก B ย้อนกลับ<br>เป้าหมายเควสต์อยู่มุมขวาบนเสมอ', '<b>X</b> speak / pick up / open chests when near · <b>Y</b> drink a Healing Draught · <b>Start</b> pause and see every button<br>In menus the left stick moves the cursor, A selects, B goes back<br>Your quest goal is always at the top right')
      : touch
      ? L('✋ คุยกับคน / เก็บของ / เปิดหีบ เมื่ออยู่ใกล้ · ⚱ ดื่มยาฟื้นเลือด · ❚❚ หยุดเกม<br>เป้าหมายเควสต์อยู่มุมขวาบนเสมอ', '✋ speak / pick up / open chests when near · ⚱ drink a Healing Draught · ❚❚ pause<br>Your quest goal is always at the top right')
      : L('<b>E</b> คุยกับคน / เก็บของ / เปิดหีบ เมื่ออยู่ใกล้ · <b>Q</b> ดื่มยาฟื้นเลือด · <b>Esc</b> หยุดเกมและดูปุ่มทั้งหมด<br>เป้าหมายเควสต์อยู่มุมขวาบนเสมอ', '<b>E</b> speak / pick up / open chests when near · <b>Q</b> drink a Healing Draught · <b>Esc</b> pause and see every control<br>Your quest goal is always at the top right');
    this.el.querySelector('.tut-bar i').style.width = '100%';
    this.el.querySelector('.tut-hint').textContent = touch ? '' : pad ? L('การ์ดนี้จะปิดเองในไม่กี่วินาที', 'This card closes on its own in a few seconds') : L('กด Enter เพื่อเริ่มผจญภัย', 'Press Enter to begin your journey');
    this.g.audio.discover?.();
    this.endAt = this.g.time + 14;
  }

  finish(skipped = false) {
    if (!this.active) return;
    this.active = false;
    this.el.className = 'hidden';
    if (skipped) this.g.ui.toast(L('ข้ามการฝึกแล้ว · ดูปุ่มทั้งหมดได้ที่เมนูหยุดเกม (Esc)', 'Training skipped · every control is listed in the pause menu (Esc)'));
    this.g.onTutorialDone?.();
  }

  update(dt) {
    if (!this.active) return;
    const g = this.g, hide = g.state !== 'play' || g.ui.dialogueOpen;
    this.el.classList.toggle('away', hide);
    if (hide) return;
    if (this.i >= STEPS.length) { if (g.time > this.endAt) this.finish(); return; }
    if (!!g.gamepads?.active !== !!this.pad) { const s0 = this.s; this.i--; this.next(); this.s = s0; }
    const s = this.s, p = g.player, input = g.input;
    let dy = Math.abs(p.yaw - s.yaw); if (dy > Math.PI) dy = Math.PI * 2 - dy;
    s.look += dy; s.yaw = p.yaw;
    const d = Math.hypot(p.pos.x - s.x, p.pos.z - s.z);
    s.walked += Math.min(d, 1); s.x = p.pos.x; s.z = p.pos.z;
    if (input.sprint && d > dt * 0.5) s.ran += dt;
    if (input.blockHeld) s.blocked += dt;
    if (input.attackHeld) s.held += dt;
    else { if (s.held > 0.45) s.heavy = true; s.held = 0; }
    s.t += dt;
    if (s.t > 0.4 && STEPS[this.i].done(s)) {
      g.audio.ui?.();
      this.el.classList.add('ok');
      if (!this.wait) this.wait = setTimeout(() => { this.wait = null; if (this.active) this.next(); }, 700);
    }
  }
}

// every control in one place (the pause menu)
export const CONTROLS = [
  [L('การเคลื่อนที่', 'Movement'), [['W A S D', L('สติ๊กซ้าย', 'Left stick'), L('เดิน', 'Walk')], [L('เมาส์', 'Mouse'), L('สติ๊กขวา', 'Right stick'), L('หันมอง', 'Look')], [L('Shift ค้าง', 'Hold Shift'), L('LB ค้าง / L3', 'Hold LB / L3'), L('วิ่ง', 'Run')], ['Space', 'A', L('กระโดด', 'Jump')], ['C / Ctrl', 'B', L('กลิ้งหลบ', 'Roll')], ['H', L('ลง (D-pad)', 'Down (D-pad)'), L('เรียก / ลงจากแมลงสาบยักษ์', 'Summon / dismount the giant cockroach')]]],
  [L('การต่อสู้', 'Combat'), [[L('คลิกซ้าย', 'Left click'), 'RT', L('ฟัน', 'Light attack')], [L('คลิกซ้ายค้าง', 'Hold left click'), L('RT ค้าง', 'Hold RT'), L('ฟันหนัก (ทำลายการ์ด)', 'Heavy attack (breaks guard)')], [L('คลิกขวาค้าง / R', 'Hold right click / R'), L('LT ค้าง', 'Hold LT'), L('ป้องกัน · กันพอดีจังหวะ = ปัด', 'Block · block on the beat = parry')], ['G', 'RB', L('สกิลประจำสาย', 'Path skill')], ['Q', 'Y', L('ดื่มยาฟื้นเลือด', 'Drink a Healing Draught')]]],
  [L('อื่น ๆ', 'Other'), [['E / F', 'X', L('คุย · เก็บของ · เปิดหีบ', 'Speak · pick up · open chests')], ['I / Tab', L('ขวา (D-pad) / Back', 'Right (D-pad) / Back'), L('กระเป๋า', 'Bag')], ['M', L('ขึ้น (D-pad)', 'Up (D-pad)'), L('แผนที่', 'Map')], ['K', L('ซ้าย (D-pad)', 'Left (D-pad)'), L('ต้นไม้สกิล', 'Skill tree')], ['1–4 / Enter', L('ขึ้น-ลง / A', 'Up-down / A'), L('เลือกตัวเลือกในบทสนทนา', 'Choose a reply in dialogue')], ['Esc', 'Start', L('หยุดเกม · ตั้งค่า', 'Pause · settings')], ['F11', '', L('สลับเต็มจอ', 'Toggle fullscreen')]]],
];
// in menus a controller moves a cursor: stick = move, A = click, B = back, LB/RB = change a setting, right stick = scroll

// a controller drawn with what every button does (the controls page's "controller" tab)
export function padDiagram() {
  const gold = '#e8c46a', ink = '#e6e2d0', dim = '#9fb0d8', body = '#2a2f3e', edge = '#8f9bb8';
  const LEFT = [   // [x, y] of the button, label row y, button name, what it does
    [310, 92, 60, L('LT ค้าง', 'Hold LT'), L('ป้องกัน · กันพอดีจังหวะ = ปัด', 'Block · on the beat = parry')],
    [315, 117, 110, L('LB ค้าง', 'Hold LB'), L('วิ่ง', 'Run')],
    [330, 200, 175, L('สติ๊กซ้าย', 'Left stick'), L('เดิน · กดลงไป (L3) = สลับวิ่ง', 'Walk · press in (L3) = toggle run')],
    [390, 258, 240, L('D-pad ขึ้น', 'D-pad up'), L('แผนที่', 'Map')],
    [390, 270, 275, L('D-pad ซ้าย', 'D-pad left'), L('ต้นไม้สกิล', 'Skill tree')],
    [390, 282, 310, L('D-pad ขวา', 'D-pad right'), L('กระเป๋า', 'Bag')],
    [390, 290, 345, L('D-pad ลง', 'D-pad down'), L('เรียก / ลงจากแมลงสาบ', 'Summon / dismount cockroach')],
  ];
  const R = [
    [590, 92, 60, 'RT', L('ฟัน · กดค้างแล้วปล่อย = ฟันหนัก', 'Attack · hold and release = heavy')],
    [585, 117, 110, 'RB', L('สกิลประจำสาย', 'Path skill')],
    [570, 170, 155, 'Y', L('ดื่มยาฟื้นเลือด', 'Healing Draught')],
    [540, 200, 195, 'X', L('คุย · เก็บของ · เปิดหีบ', 'Speak · pick up · open')],
    [600, 200, 235, 'B', L('กลิ้งหลบ', 'Roll')],
    [570, 230, 275, 'A', L('กระโดด', 'Jump')],
    [510, 270, 315, L('สติ๊กขวา', 'Right stick'), L('หันมอง', 'Look')],
    [482, 190, 355, 'Start', L('หยุดเกม · ตั้งค่า', 'Pause · settings')],
  ];
  const lab = (x, y, name, what, right) => `<text x="${x}" y="${y}" text-anchor="${right ? 'start' : 'end'}" font-size="15" fill="${ink}"><tspan fill="${gold}" font-weight="bold">${name}</tspan>  ${what}</text>`;
  const line = (bx, by, ly, right) => { const ex = right ? 700 : 200; return `<polyline points="${bx},${by} ${right ? Math.max(bx + 20, 660) : Math.min(bx - 20, 240)},${ly - 5} ${ex},${ly - 5}" fill="none" stroke="${dim}" stroke-width="1" opacity="0.7"/>`; };
  const face = (x, y, t, c) => `<circle cx="${x}" cy="${y}" r="13" fill="${c}" stroke="#111" stroke-width="2"/><text x="${x}" y="${y + 5}" text-anchor="middle" font-size="14" font-weight="bold" fill="#111">${t}</text>`;
  return `<svg viewBox="-170 40 1240 365" class="pad-svg" role="img" aria-label="${L('ปุ่มจอยเกม', 'Controller buttons')}">
  ${LEFT.map(([x, y, ly]) => line(x, y, ly, false)).join('')}${R.map(([x, y, ly]) => line(x, y, ly, true)).join('')}
  <rect x="270" y="78" width="80" height="26" rx="10" fill="${body}" stroke="${edge}"/><text x="310" y="96" text-anchor="middle" font-size="12" fill="${ink}">LT</text>
  <rect x="550" y="78" width="80" height="26" rx="10" fill="${body}" stroke="${edge}"/><text x="590" y="96" text-anchor="middle" font-size="12" fill="${ink}">RT</text>
  <rect x="262" y="108" width="105" height="18" rx="8" fill="${body}" stroke="${edge}"/><text x="315" y="122" text-anchor="middle" font-size="11" fill="${ink}">LB</text>
  <rect x="533" y="108" width="105" height="18" rx="8" fill="${body}" stroke="${edge}"/><text x="585" y="122" text-anchor="middle" font-size="11" fill="${ink}">RB</text>
  <path d="M330,132 H570 Q640,132 660,200 L690,318 Q700,372 650,372 Q618,372 592,322 L562,292 H338 L308,322 Q282,372 250,372 Q200,372 210,318 L240,200 Q260,132 330,132 Z" fill="${body}" stroke="${edge}" stroke-width="2"/>
  <circle cx="330" cy="200" r="30" fill="#1a1d27" stroke="${edge}"/><circle cx="330" cy="200" r="19" fill="#3a4152"/>
  <circle cx="510" cy="270" r="28" fill="#1a1d27" stroke="${edge}"/><circle cx="510" cy="270" r="18" fill="#3a4152"/>
  <g fill="#3a4152" stroke="${edge}"><rect x="378" y="250" width="24" height="64" rx="3"/><rect x="358" y="270" width="64" height="24" rx="3"/></g>
  <rect x="408" y="183" width="24" height="14" rx="7" fill="#3a4152" stroke="${edge}"/><text x="420" y="214" text-anchor="middle" font-size="10" fill="${dim}">Back</text>
  <rect x="470" y="183" width="24" height="14" rx="7" fill="#3a4152" stroke="${edge}"/><text x="482" y="214" text-anchor="middle" font-size="10" fill="${dim}">Start</text>
  ${face(570, 170, 'Y', '#e8c84a')}${face(540, 200, 'X', '#4a8fe8')}${face(600, 200, 'B', '#e85a4a')}${face(570, 230, 'A', '#6ac84a')}
  ${LEFT.map(([, , ly, n, w]) => lab(195, ly, n, w, false)).join('')}${R.map(([, , ly, n, w]) => lab(705, ly, n, w, true)).join('')}
  <text x="420" y="395" text-anchor="middle" font-size="13" fill="${dim}">${L('Back = กระเป๋า', 'Back = bag')}</text>
</svg>`;
}
