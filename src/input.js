// Keyboard + mouse (pointer lock) and touch (virtual stick, drag-to-look, buttons).

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.lookDX = 0;
    this.lookDY = 0;
    this.joy = { x: 0, y: 0 };
    this.actions = new Set();
    this.sprintToggle = false;
    this.locked = false;
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.sensitivity = 1;
    this.enabled = false;

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      const map = {
        KeyE: 'interact', KeyF: 'interact', Space: 'jump', KeyQ: 'potion', KeyM: 'map', Tab: 'bag', KeyI: 'bag', KeyR: 'rotate',
        Enter: 'confirm', ArrowUp: 'up', ArrowDown: 'down', KeyW: 'up', KeyS: 'down',
        Digit1: 'opt1', Digit2: 'opt2', Digit3: 'opt3', Digit4: 'opt4', Escape: 'escape',
        KeyC: 'dodge', ControlLeft: 'dodge', KeyG: 'skill', KeyB: 'build', KeyT: 'turn', KeyK: 'skills', KeyH: 'mount',
      };
      if (map[e.code]) this.actions.add(map[e.code]);
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouseAttack = this.mouseBlock = false; });

    this.mouseAttack = false;
    this.mouseBlock = false;
    this.held = { attack: false, block: false };
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) { this.actions.add('attack'); this.mouseAttack = true; }
      if (e.button === 2) this.mouseBlock = true;
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseAttack = false;
      if (e.button === 2) this.mouseBlock = false;
    });
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.lookDX += e.movementX * 0.0022 * this.sensitivity;
      this.lookDY += e.movementY * 0.0022 * this.sensitivity;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (this.onLockChange) this.onLockChange(this.locked);
    });

    if (this.touch) this.setupTouch();
  }

  requestLock() {
    if (this.touch) return;
    const p = this.canvas.requestPointerLock?.();
    if (p && p.catch) p.catch(() => {});
  }

  setupTouch() {
    const zone = document.getElementById('touch');
    const stick = document.getElementById('stick');
    const knob = document.getElementById('knob');
    let joyId = null, lookId = null, ox = 0, oy = 0, lx = 0, ly = 0;
    const holdTouches = new Map();
    const R = 55;

    zone.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        const btn = t.target.closest?.('[data-act]');
        if (btn) {
          const act = btn.dataset.act;
          if (act === 'sprint') { this.sprintToggle = !this.sprintToggle; btn.classList.toggle('on', this.sprintToggle); }
          else if (act !== 'block') this.actions.add(act);
          if (act === 'attack' || act === 'block') { this.held[act] = true; holdTouches.set(t.identifier, act); }
          btn.classList.add('pressed');
          setTimeout(() => btn.classList.remove('pressed'), 120);
          continue;
        }
        if (t.clientX < innerWidth * 0.42 && joyId === null) {
          joyId = t.identifier; ox = t.clientX; oy = t.clientY;
          stick.style.left = ox + 'px'; stick.style.top = oy + 'px';
          stick.classList.add('active');
        } else if (lookId === null) {
          lookId = t.identifier; lx = t.clientX; ly = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });

    zone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          let dx = t.clientX - ox, dy = t.clientY - oy;
          const d = Math.hypot(dx, dy);
          if (d > R) { dx = dx / d * R; dy = dy / d * R; }
          knob.style.transform = `translate(${dx}px, ${dy}px)`;
          this.joy.x = dx / R; this.joy.y = -dy / R;
        } else if (t.identifier === lookId) {
          this.lookDX += (t.clientX - lx) * 0.006 * this.sensitivity;
          this.lookDY += (t.clientY - ly) * 0.006 * this.sensitivity;
          lx = t.clientX; ly = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });

    const end = (e) => {
      for (const t of e.changedTouches) {
        if (holdTouches.has(t.identifier)) { this.held[holdTouches.get(t.identifier)] = false; holdTouches.delete(t.identifier); }
        if (t.identifier === joyId) {
          joyId = null; this.joy.x = 0; this.joy.y = 0;
          knob.style.transform = ''; stick.classList.remove('active');
        } else if (t.identifier === lookId) lookId = null;
      }
    };
    zone.addEventListener('touchend', end);
    zone.addEventListener('touchcancel', end);
  }

  get forward() {
    return (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) + this.joy.y;
  }
  get strafe() {
    return (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) + this.joy.x;
  }
  get attackHeld() { return this.mouseAttack || this.held.attack; }
  get blockHeld() { return this.mouseBlock || this.keys.has('KeyR') || this.held.block; }

  get sprint() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.sprintToggle;
  }

  consume(action) {
    if (this.actions.has(action)) { this.actions.delete(action); return true; }
    return false;
  }

  endFrame() {
    this.lookDX = 0;
    this.lookDY = 0;
    this.actions.clear();
  }
}
