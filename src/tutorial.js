// The first steps: a short drill at the start of a new story, one control at a time. Each step
// shows its key and waits until the player has actually done it (moved, swung, blocked ...), so
// nothing is read and forgotten. Enter skips a step, Backspace the whole drill; it can be run
// again from the pause menu, which also lists every control.

const STEPS = [
  { key: 'เมาส์', touch: 'ลากนิ้วฝั่งขวาของจอ', pad: 'สติ๊กขวา', title: 'มองรอบ ๆ', text: 'ขยับเมาส์เพื่อหันมองไปรอบตัว', done: (s) => s.look > 1.2 },
  { key: 'W A S D', touch: 'จอยซ้ายมือ', pad: 'สติ๊กซ้าย', title: 'เดิน', text: 'W เดินหน้า · S ถอยหลัง · A / D เดินออกข้าง', done: (s) => s.walked > 4 },
  { key: 'Shift ค้าง', touch: '»', pad: 'LB ค้าง / กด L3', title: 'วิ่ง', text: 'กด Shift ค้างไว้ขณะเดินเพื่อวิ่ง — กินแถบแรง (สีเหลือง) แรงหมดจะหอบ', done: (s) => s.ran > 1.2 },
  { key: 'Space', touch: '⤒', pad: 'A', title: 'กระโดด', text: 'กระโดดข้ามรั้ว ก้อนหิน และขึ้นที่สูง', done: (s) => s.saw.jump },
  { key: 'คลิกซ้าย', touch: '⚔', pad: 'RT', title: 'ฟัน', text: 'คลิกซ้ายเพื่อฟันดาบ ลองฟันลมดู 2 ครั้ง', done: (s) => s.n.attack >= 2 },
  { key: 'คลิกซ้ายค้าง', touch: '⚔ ค้าง', pad: 'RT ค้าง', title: 'ฟันหนัก', text: 'กดค้างแล้วปล่อย = ฟันหนัก ช้ากว่าแต่แรงกว่า ทำลายการ์ดศัตรูได้', done: (s) => s.heavy },
  { key: 'คลิกขวาค้าง', touch: '🛡 ค้าง', pad: 'LT ค้าง', title: 'ป้องกัน / ปัด', text: 'ยกดาบกันการโจมตี · ยกกันพอดีจังหวะที่ศัตรูฟันมา = ปัด ทำให้มันเสียหลัก', done: (s) => s.blocked > 0.8 },
  { key: 'C หรือ Ctrl', touch: '↯', pad: 'B', title: 'หลบ', text: 'กลิ้งหลบการโจมตี — ระหว่างกลิ้งจะไม่โดนตี ใช้แถบแรง', done: (s) => s.saw.dodge },
  { key: 'G', touch: '✦', pad: 'RB', title: 'สกิลประจำสาย', text: 'สกิลพิเศษของสายที่เลือก แต่ละสายไม่เหมือนกัน มีเวลาคูลดาวน์', done: (s) => s.saw.skill },
  { key: 'I หรือ Tab', touch: '🎒', pad: 'ปุ่มขวา (D-pad)', title: 'กระเป๋า', text: 'เปิดกระเป๋าดูของ ใช้ยา จัดของ — กด I อีกครั้งเพื่อปิด', done: (s) => s.saw.bag },
  { key: 'M', touch: '⌖', pad: 'ปุ่มขึ้น (D-pad)', title: 'แผนที่', text: 'ดูแผนที่ ตำแหน่งตัวเอง และเป้าหมายเควสต์ — กด M อีกครั้งเพื่อปิด', done: (s) => s.saw.map },
  { key: 'K', touch: '⬆', pad: 'ปุ่มซ้าย (D-pad)', title: 'ต้นไม้สกิล', text: 'ฆ่าศัตรูและทำเควสต์ได้ค่าประสบการณ์ เลเวลอัปแล้วได้แต้มมาอัปสกิลที่นี่ (เลือกสายแล้วเปลี่ยนไม่ได้!)', done: (s) => s.saw.skills },
  { key: 'H', touch: '🪳', pad: 'ปุ่มลง (D-pad)', title: 'ขี่แมลงสาบยักษ์', text: 'ผิวปากเรียกแมลงสาบมาขี่ วิ่งเร็วมาก เหมาะกับเดินทางไกล — กด H อีกครั้งเพื่อลง', done: (s) => s.saw.mount },
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
    this.el.querySelector('.tut-step').textContent = `ฝึกพื้นฐาน ${this.i + 1}/${STEPS.length}`;
    this.pad = this.g.gamepads?.active;
    this.el.querySelector('.tut-key').textContent = touch ? st.touch : this.pad ? st.pad : st.key;
    this.el.querySelector('.tut-title').textContent = st.title;
    this.el.querySelector('.tut-text').textContent = st.text;
    this.el.querySelector('.tut-bar i').style.width = `${(this.i / STEPS.length) * 100}%`;
    this.el.querySelector('.tut-hint').textContent = touch ? '' : this.pad ? 'จอย: กด Start เพื่อหยุดเกม · คีย์บอร์ด Enter = ข้ามขั้นนี้' : 'Enter = ข้ามขั้นนี้ · Backspace = ข้ามการฝึกทั้งหมด';
  }

  // the last card: the controls that need something nearby to try
  summary() {
    this.i = STEPS.length;
    const touch = this.g.input.touch;
    this.el.className = touch ? 'summary touch' : 'summary';
    this.el.querySelector('.tut-step').textContent = 'ฝึกพื้นฐานครบแล้ว';
    this.el.querySelector('.tut-key').textContent = '✓';
    this.el.querySelector('.tut-title').textContent = 'พร้อมออกเดินทาง';
    const pad = this.g.gamepads?.active;
    this.el.querySelector('.tut-text').innerHTML = pad
      ? '<b>X</b> คุยกับคน / เก็บของ / เปิดหีบ เมื่ออยู่ใกล้ · <b>Y</b> ดื่มยาฟื้นเลือด · <b>Start</b> หยุดเกมและดูปุ่มทั้งหมด<br>ในเมนูใช้สติ๊กซ้ายเลื่อนลูกศร กด A เลือก B ย้อนกลับ<br>เป้าหมายเควสต์อยู่มุมขวาบนเสมอ'
      : touch
      ? '✋ คุยกับคน / เก็บของ / เปิดหีบ เมื่ออยู่ใกล้ · ⚱ ดื่มยาฟื้นเลือด · ❚❚ หยุดเกม<br>เป้าหมายเควสต์อยู่มุมขวาบนเสมอ'
      : '<b>E</b> คุยกับคน / เก็บของ / เปิดหีบ เมื่ออยู่ใกล้ · <b>Q</b> ดื่มยาฟื้นเลือด · <b>Esc</b> หยุดเกมและดูปุ่มทั้งหมด<br>เป้าหมายเควสต์อยู่มุมขวาบนเสมอ';
    this.el.querySelector('.tut-bar i').style.width = '100%';
    this.el.querySelector('.tut-hint').textContent = touch ? '' : pad ? 'การ์ดนี้จะปิดเองในไม่กี่วินาที' : 'กด Enter เพื่อเริ่มผจญภัย';
    this.g.audio.discover?.();
    this.endAt = this.g.time + 14;
  }

  finish(skipped = false) {
    if (!this.active) return;
    this.active = false;
    this.el.className = 'hidden';
    if (skipped) this.g.ui.toast('ข้ามการฝึกแล้ว · ดูปุ่มทั้งหมดได้ที่เมนูหยุดเกม (Esc)');
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
  ['การเคลื่อนที่', [['W A S D', 'สติ๊กซ้าย', 'เดิน'], ['เมาส์', 'สติ๊กขวา', 'หันมอง'], ['Shift ค้าง', 'LB ค้าง / L3', 'วิ่ง'], ['Space', 'A', 'กระโดด'], ['C / Ctrl', 'B', 'กลิ้งหลบ'], ['H', 'ลง (D-pad)', 'เรียก / ลงจากแมลงสาบยักษ์']]],
  ['การต่อสู้', [['คลิกซ้าย', 'RT', 'ฟัน'], ['คลิกซ้ายค้าง', 'RT ค้าง', 'ฟันหนัก (ทำลายการ์ด)'], ['คลิกขวาค้าง / R', 'LT ค้าง', 'ป้องกัน · กันพอดีจังหวะ = ปัด'], ['G', 'RB', 'สกิลประจำสาย'], ['Q', 'Y', 'ดื่มยาฟื้นเลือด']]],
  ['อื่น ๆ', [['E / F', 'X', 'คุย · เก็บของ · เปิดหีบ'], ['I / Tab', 'ขวา (D-pad) / Back', 'กระเป๋า'], ['M', 'ขึ้น (D-pad)', 'แผนที่'], ['K', 'ซ้าย (D-pad)', 'ต้นไม้สกิล'], ['1–4 / Enter', 'ขึ้น-ลง / A', 'เลือกตัวเลือกในบทสนทนา'], ['Esc', 'Start', 'หยุดเกม · ตั้งค่า'], ['F11', '', 'สลับเต็มจอ']]],
];
// in menus a controller moves a cursor: stick = move, A = click, B = back, LB/RB = change a setting, right stick = scroll
