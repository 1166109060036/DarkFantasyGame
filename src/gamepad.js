// Game controllers (Xbox, PlayStation, generic) through the browser's Gamepad API, standard layout.
// Three modes, picked by the game each frame:
//   play      sticks walk and look; buttons map Souls-style onto the same actions as the keyboard
//   dialogue  up/down choose, A answers
//   menu      the left stick drives an on-screen cursor that clicks and drags like a mouse, so
//             every HTML screen (title, pause, bag, shops, skill tree) works without its own code
//
//   A jump · B dodge · X talk/pick up · Y potion · RT slash (hold = heavy) · LT block/parry
//   LB hold = sprint (L3 toggles) · RB class skill · D-pad: up map, down mount, left skill tree,
//   right bag · Back bag · Start pause
const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const PLAY = { [B.A]: 'jump', [B.B]: 'dodge', [B.X]: 'interact', [B.Y]: 'potion', [B.RB]: 'skill', [B.RT]: 'attack', [B.BACK]: 'bag', [B.START]: 'pause', [B.UP]: 'map', [B.DOWN]: 'mount', [B.LEFT]: 'skills', [B.RIGHT]: 'bag', [B.R3]: 'turn' };

const dead = (x, y, dz = 0.18) => {
  const m = Math.hypot(x, y);
  if (m < dz) return [0, 0];
  const k = Math.min(1, (m - dz) / (1 - dz)) / m;
  return [x * k, y * k];
};

export class Gamepads {
  constructor(input) {
    this.input = input;
    this.prev = [];
    this.active = false;          // the last thing touched was a controller (prompts show its buttons)
    this.cursor = { x: innerWidth / 2, y: innerHeight / 2 };
    this.el = document.getElementById('padcursor');
    this.down = null;             // element under the cursor when A went down
    this.hover = null;
    this.repeat = 0;
    // keyboard or mouse again: back to their prompts
    const off = () => { if (this.active) { this.active = false; this.showCursor(false); } };
    addEventListener('keydown', off);
    addEventListener('mousemove', (e) => { if (Math.abs(e.movementX) + Math.abs(e.movementY) > 3) off(); });
    addEventListener('gamepadconnected', () => { this.connected = true; });
  }

  get pad() {
    const pads = navigator.getGamepads?.() || [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  // mode: 'play' | 'dialogue' | 'menu'
  poll(dt, mode) {
    const p = this.pad, inp = this.input;
    inp.pad.x = inp.pad.y = 0;
    inp.padAttack = inp.padBlock = inp.padSprint = inp.padJump = false;
    if (!p) { this.showCursor(false); return; }
    const btn = (i) => { const b = p.buttons[i]; return !!b && (b.pressed || b.value > 0.4); };
    const now = p.buttons.map((_, i) => btn(i));
    const hit = (i) => now[i] && !this.prev[i];
    const [lx, ly] = dead(p.axes[0] || 0, p.axes[1] || 0), [rx, ry] = dead(p.axes[2] || 0, p.axes[3] || 0);
    if (now.some(Boolean) || lx || ly || rx || ry) {
      if (!this.active) this.active = true;
    }
    if (!this.active) { this.prev = now; return; }

    if (mode === 'play') {
      this.showCursor(false);
      inp.pad.x = lx; inp.pad.y = -ly;
      // a curve on the right stick: fine aim near the centre, fast turns at the edge
      const s = inp.sensitivity;
      inp.lookDX += rx * Math.abs(rx) * dt * 3.2 * s;
      inp.lookDY += ry * Math.abs(ry) * dt * 2.2 * s;
      for (const [i, a] of Object.entries(PLAY)) if (hit(+i)) inp.actions.add(a);
      if (hit(B.L3)) inp.sprintToggle = !inp.sprintToggle;
      if (!lx && !ly) inp.sprintToggle = false;
      inp.padAttack = now[B.RT];
      inp.padBlock = now[B.LT];
      inp.padSprint = now[B.LB];
      inp.padJump = now[B.A];
    } else if (mode === 'dialogue') {
      this.showCursor(false);
      this.repeat -= dt;
      const up = now[B.UP] || ly < -0.6, down = now[B.DOWN] || ly > 0.6;
      if ((up || down) && this.repeat <= 0) { inp.actions.add(up ? 'up' : 'down'); this.repeat = 0.25; }
      if (!up && !down) this.repeat = 0;
      if (hit(B.A)) inp.actions.add('confirm');
      if (hit(B.X)) inp.actions.add('interact');
    } else {
      this.menu(dt, now, hit, lx, ly, ry);
    }
    this.prev = now;
  }

  // the cursor: move, hover, press and release like a mouse; B backs out, Y turns a held item
  menu(dt, now, hit, lx, ly, ry) {
    const c = this.cursor, inp = this.input;
    this.showCursor(true);
    const dx = (now[B.RIGHT] ? 1 : 0) - (now[B.LEFT] ? 1 : 0), dy = (now[B.DOWN] ? 1 : 0) - (now[B.UP] ? 1 : 0);
    const sp = 1100 * dt;
    c.x = Math.max(0, Math.min(innerWidth - 1, c.x + (lx * Math.abs(lx) + dx * 0.35) * sp));
    c.y = Math.max(0, Math.min(innerHeight - 1, c.y + (ly * Math.abs(ly) + dy * 0.35) * sp));
    this.el.style.transform = `translate(${c.x}px, ${c.y}px) rotate(-25deg)`;
    const under = document.elementFromPoint(c.x, c.y);
    const target = under?.closest('button, [data-tab], .sk-node, .cp-card, select, input, .dlg-opt') || null;
    if (target !== this.hover) {
      this.hover?.classList?.remove('pad-hover');
      this.hover = target;
      target?.classList?.add('pad-hover');
    }
    const ev = (type, el) => el?.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: c.x, clientY: c.y, pointerId: 77, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1, isPrimary: true }));
    if (lx || ly || dx || dy) ev('pointermove', under);
    if (hit(B.A)) { this.down = under; ev('pointerdown', under); }
    if (!now[B.A] && this.prev[B.A]) {
      ev('pointerup', under);
      if (under && this.down && (under === this.down || this.down.contains(under) || under.contains(this.down))) {
        // a select or a slider under the cursor: A steps it instead
        if (!this.step(target, 1)) under.click();
      }
      this.down = null;
    }
    // sliders and choices: left / right on the shoulder buttons
    if (hit(B.LB)) this.step(target, -1);
    if (hit(B.RB)) this.step(target, 1);
    // scroll whatever is under the cursor
    if (ry) {
      let s = under;
      while (s && s !== document.body && !(s.scrollHeight > s.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(s).overflowY))) s = s.parentElement;
      if (s && s !== document.body) s.scrollTop += ry * Math.abs(ry) * 900 * dt;
    }
    if (hit(B.Y)) inp.actions.add('rotate');
    if (hit(B.B)) this.onBack?.();
    if (hit(B.START)) this.onStart?.();
    if (hit(B.BACK)) inp.actions.add('bag');
  }

  step(el, dir) {
    if (el?.tagName === 'SELECT') {
      el.selectedIndex = (el.selectedIndex + dir + el.options.length) % el.options.length;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    if (el?.tagName === 'INPUT' && el.type === 'range') {
      const st = +el.step || 0.1;
      el.value = Math.min(+el.max, Math.max(+el.min, +el.value + dir * st * 2));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    return false;
  }

  showCursor(on) {
    if (this.el) this.el.classList.toggle('hidden', !(on && this.active));
    if (!on && this.hover) { this.hover.classList.remove('pad-hover'); this.hover = null; }
  }
}
