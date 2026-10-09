// Resident Evil 4-style attaché case screen. The game is frozen while it is open.
//  - drag an item to move it; R / right-click / mouse wheel rotates the item you are holding
//  - drop onto a matching stack to merge, onto a single other item to swap it into your hand
//  - click an item for a menu: use / move / rotate / drop
//  - when the case is full, a new pickup waits in the side tray until you make room
import { ITEMS, itemIconURL } from './items.js';
import { statLine } from './equipment.js';
import { Inventory } from './inventory.js';
import { L } from './i18n.js';

const $ = (id) => document.getElementById(id);

export class BagUI {
  constructor(game) {
    this.g = game;
    this.el = $('bag');
    this.grid = $('bag-grid');
    this.heldEl = $('bag-held');
    this.menu = $('bag-menu');
    this.info = $('bag-info');
    this.pendingBox = $('bag-pending');
    this.pendingSlot = $('bag-pending-slot');
    this.held = null;
    this.pending = null;
    this.open = false;
    this.cell = 48;
    this.down = null;

    $('bag-sort').addEventListener('click', () => this.sort());
    $('bag-rotate').addEventListener('click', () => this.rotateHeld());
    $('bag-close').addEventListener('click', () => this.close());
    $('bag-drop').addEventListener('pointerup', (e) => { if (this.held) { e.stopPropagation(); this.discardHeld(); } });

    this.el.addEventListener('pointermove', (e) => this.onMove(e));
    this.el.addEventListener('pointerup', (e) => this.onUp(e));
    this.el.addEventListener('contextmenu', (e) => { e.preventDefault(); if (this.held) this.rotateHeld(); });
    this.el.addEventListener('wheel', (e) => { if (this.held) { e.preventDefault(); this.rotateHeld(); } }, { passive: false });
    this.grid.addEventListener('pointerdown', (e) => this.onGridDown(e));
    this.pendingSlot.addEventListener('pointerdown', (e) => {
      if (!this.pending || this.held || e.button === 2) return;
      e.preventDefault();
      this.pickPending(e);
    });
    this.el.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('#bag-menu')) this.hideMenu();
    });
  }

  get inv() { return this.g.bag; }

  // ---------------------------------------------------------------- open / close
  show(pending = null) {
    if (pending) this.pending = pending;
    this.open = true;
    this.el.classList.remove('hidden');
    this.layout();
    this.render();
    this.select(null);
  }

  close() {
    if (this.held) this.returnHeld();
    this.hideMenu();
    if (this.pending) {
      this.g.ui.toast(L(`วาง${ITEMS[this.pending.id].name}ไว้บนพื้น`, `Left ${ITEMS[this.pending.id].name} on the ground`));
      this.pending.onLeft?.(this.pending.count);
      this.pending = null;
    }
    this.open = false;
    this.el.classList.add('hidden');
    this.g.onBagClosed();
  }

  layout() {
    const inv = this.inv;
    const availW = Math.min(innerWidth * 0.62, 760), availH = innerHeight * 0.66;
    this.cell = Math.floor(Math.max(26, Math.min(58, availW / inv.cols, availH / inv.rows)));
    this.grid.style.width = `${inv.cols * this.cell}px`;
    this.grid.style.height = `${inv.rows * this.cell}px`;
    this.grid.style.backgroundSize = `${this.cell}px ${this.cell}px`;
    this.el.style.setProperty('--cell', `${this.cell}px`);
    $('bag-size').textContent = `${inv.cols} × ${inv.rows}`;
  }

  // one DOM node per item; rotation is a CSS turn of the icon inside its footprint
  itemNode(id, count, w, h, rot) {
    const c = this.cell, d = document.createElement('div');
    d.className = 'bag-item';
    d.style.width = `${w * c}px`;
    d.style.height = `${h * c}px`;
    const img = document.createElement('img');
    img.src = itemIconURL(id);
    img.draggable = false;
    const def = ITEMS[id];
    img.style.width = `${def.w * c - 6}px`;
    img.style.height = `${def.h * c - 6}px`;
    if (rot) img.style.transform = 'translate(-50%, -50%) rotate(90deg)';
    d.appendChild(img);
    if (count > 1 || def.stack > 1) {
      const b = document.createElement('span');
      b.className = 'count';
      b.textContent = count;
      d.appendChild(b);
    }
    d.classList.add(`k-${def.kind}`);
    return d;
  }

  render() {
    const c = this.cell;
    this.grid.querySelectorAll('.bag-item').forEach((n) => n.remove());
    for (const it of this.inv.items) {
      const n = this.itemNode(it.id, it.count, it.w, it.h, it.rot);
      n.style.left = `${it.x * c}px`;
      n.style.top = `${it.y * c}px`;
      n.dataset.uid = it.uid;
      if (this.selected === it) n.classList.add('sel');
      this.grid.appendChild(n);
    }
    this.pendingBox.classList.toggle('hidden', !this.pending);
    this.pendingSlot.innerHTML = '';
    if (this.pending) {
      const d = ITEMS[this.pending.id];
      const n = this.itemNode(this.pending.id, this.pending.count, d.w, d.h, false);
      n.style.position = 'relative';
      this.pendingSlot.appendChild(n);
    }
    $('bag-coins').textContent = `● ${this.g.coins}`;
    this.renderHeld();
  }

  select(it) {
    this.selected = it;
    const def = it ? ITEMS[it.id] : this.held ? ITEMS[this.held.id] : this.pending ? ITEMS[this.pending.id] : null;
    this.info.querySelector('.name').textContent = def ? def.name : L('กระเป๋าเดินทาง', 'Travelling Case');
    this.info.querySelector('.desc').textContent = def
      ? `${def.desc}${def.kind === 'weapon' || def.kind === 'armour' ? `\n${def.kind === 'weapon' ? `${L('สำหรับ', 'For')} ${this.g.pathName(def.cls)} · ` : ''}${statLine(it ? it.id : (this.held || this.pending).id)}` : ''}${def.value ? L(` · ขายได้ ${def.value} เหรียญ`, ` · Sells for ${def.value} coins`) : ''}`
      : L('ลากของเพื่อจัดเรียง · คลิกของเพื่อใช้หรือทิ้ง · R หรือคลิกขวาเพื่อหมุน', 'Drag to arrange · Click to use or discard · R or right-click to rotate');
  }

  // ---------------------------------------------------------------- picking up
  cellAt(e) {
    const r = this.grid.getBoundingClientRect();
    return { cx: (e.clientX - r.left) / this.cell, cy: (e.clientY - r.top) / this.cell, inside: e.clientX >= r.left && e.clientX < r.right && e.clientY >= r.top && e.clientY < r.bottom };
  }

  itemAt(cx, cy) {
    return this.inv.items.find((it) => cx >= it.x && cx < it.x + it.w && cy >= it.y && cy < it.y + it.h);
  }

  onGridDown(e) {
    if (e.button === 2) return;
    e.preventDefault();
    const { cx, cy } = this.cellAt(e);
    if (this.held) { this.tryDrop(e); return; }
    const it = this.itemAt(cx, cy);
    if (!it) { this.select(null); return; }
    this.down = { it, x: e.clientX, y: e.clientY, ox: cx - it.x, oy: cy - it.y };
  }

  onMove(e) {
    this.mouse = { x: e.clientX, y: e.clientY };
    if (this.down && !this.held && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 6) {
      this.pickUp(this.down.it, this.down.ox, this.down.oy, true);
    }
    this.renderHeld();
  }

  onUp(e) {
    if (this.down && !this.held) {
      // a click, not a drag: open the item menu
      const it = this.down.it;
      this.down = null;
      this.select(it);
      this.render();
      this.showMenu(it, e);
      return;
    }
    this.down = null;
    if (this.held && this.held.dragging) {
      if (e.target.closest('#bag-drop')) return;   // handled by the drop button
      if (!this.tryDrop(e) && this.held) {
        // a failed drag release snaps back home; a click-held item keeps waiting for a spot
        this.returnHeld();
      }
    }
  }

  pickUp(it, ox, oy, dragging) {
    this.hideMenu();
    this.inv.removeItem(it);
    this.held = { id: it.id, count: it.count, rot: it.rot, ox: Math.min(Math.floor(ox), it.w - 1), oy: Math.min(Math.floor(oy), it.h - 1), from: { x: it.x, y: it.y, rot: it.rot }, dragging };
    this.down = null;
    this.g.audio.ui();
    this.select(null);
    this.render();
  }

  pickPending(e) {
    const p = this.pending;
    const d = ITEMS[p.id];
    this.held = { id: p.id, count: p.count, rot: false, ox: 0, oy: Math.floor(d.h / 2), from: 'pending', dragging: true };
    this.mouse = { x: e.clientX, y: e.clientY };
    this.pending = { ...p, count: 0 };
    this.select(null);
    this.render();
  }

  heldDims() { return Inventory.dims(this.held.id, this.held.rot); }

  // where the held item would land (top-left cell)
  target() {
    if (!this.mouse) return null;
    const r = this.grid.getBoundingClientRect();
    const [w, h] = this.heldDims();
    const ox = Math.min(this.held.ox, w - 1), oy = Math.min(this.held.oy, h - 1);
    const x = Math.floor((this.mouse.x - r.left) / this.cell) - ox;
    const y = Math.floor((this.mouse.y - r.top) / this.cell) - oy;
    return { x, y, w, h };
  }

  renderHeld() {
    const el = this.heldEl;
    el.innerHTML = '';
    this.grid.querySelector('.bag-ghost')?.remove();
    if (!this.held || !this.mouse) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const [w, h] = this.heldDims();
    const node = this.itemNode(this.held.id, this.held.count, w, h, this.held.rot);
    el.appendChild(node);
    const ox = Math.min(this.held.ox, w - 1), oy = Math.min(this.held.oy, h - 1);
    el.style.left = `${this.mouse.x - (ox + 0.5) * this.cell}px`;
    el.style.top = `${this.mouse.y - (oy + 0.5) * this.cell}px`;
    // placement preview
    const t = this.target();
    if (t && t.x > -w && t.y > -h && t.x < this.inv.cols && t.y < this.inv.rows) {
      const ghost = document.createElement('div');
      const ok = this.inv.fits(t.x, t.y, t.w, t.h) || this.mergeTarget(t) || this.swapTarget(t);
      ghost.className = `bag-ghost ${ok ? 'ok' : 'bad'}`;
      Object.assign(ghost.style, { left: `${t.x * this.cell}px`, top: `${t.y * this.cell}px`, width: `${t.w * this.cell}px`, height: `${t.h * this.cell}px` });
      this.grid.appendChild(ghost);
    }
  }

  mergeTarget(t) {
    const over = this.inv.overlapping(t.x, t.y, t.w, t.h);
    if (over.length !== 1) return null;
    const o = over[0];
    return o.id === this.held.id && o.count < ITEMS[o.id].stack ? o : null;
  }

  swapTarget(t) {
    if (t.x < 0 || t.y < 0 || t.x + t.w > this.inv.cols || t.y + t.h > this.inv.rows) return null;
    const over = this.inv.overlapping(t.x, t.y, t.w, t.h);
    return over.length === 1 ? over[0] : null;
  }

  // ---------------------------------------------------------------- dropping
  tryDrop(e) {
    this.mouse = { x: e.clientX, y: e.clientY };
    const t = this.target();
    if (!t) return false;
    const h = this.held;
    if (this.inv.fits(t.x, t.y, t.w, t.h)) {
      this.inv.place(h.id, h.count, t.x, t.y, h.rot);
      this.finishPlace(h.count);
      return true;
    }
    const m = this.mergeTarget(t);
    if (m) {
      const n = Math.min(h.count, ITEMS[m.id].stack - m.count);
      m.count += n;
      h.count -= n;
      this.inv.changed();
      if (h.count <= 0) this.finishPlace(n);
      else { this.taken(n); this.render(); }
      return true;
    }
    const s = this.swapTarget(t);
    if (s) {
      this.inv.removeItem(s);
      this.inv.place(h.id, h.count, t.x, t.y, h.rot);
      this.taken(h.count);
      this.held = { id: s.id, count: s.count, rot: s.rot, ox: 0, oy: 0, from: { x: s.x, y: s.y, rot: s.rot }, dragging: false };
      this.g.audio.ui();
      this.render();
      return true;
    }
    this.g.audio.ui();
    return false;
  }

  // count of a pending pickup that just made it into the case
  taken(n) {
    if (this.held?.from === 'pending' && this.pending) this.pending.onTaken?.(n);
  }

  finishPlace(n) {
    this.taken(n);
    if (this.held.from === 'pending') this.pending = null;
    this.held = null;
    this.g.audio.ui();
    this.inv.changed();
    this.render();
  }

  returnHeld() {
    const h = this.held;
    if (!h) return;
    if (h.from === 'pending') {
      this.pending = { ...this.pending, count: h.count };
    } else {
      const [w, hh] = Inventory.dims(h.id, h.from.rot);
      if (this.inv.fits(h.from.x, h.from.y, w, hh)) this.inv.place(h.id, h.count, h.from.x, h.from.y, h.from.rot);
      else if (this.inv.add(h.id, h.count) > 0) this.g.loot.dropNearPlayer(h.id, h.count);
    }
    this.held = null;
    this.inv.changed();
    this.render();
  }

  rotateHeld() {
    if (!this.held) return;
    if (ITEMS[this.held.id].w === ITEMS[this.held.id].h) return;
    this.held.rot = !this.held.rot;
    [this.held.ox, this.held.oy] = [this.held.oy, this.held.ox];
    this.g.audio.ui();
    this.renderHeld();
  }

  discardHeld() {
    const h = this.held;
    this.held = null;
    if (h.from === 'pending') {
      this.pending.onLeft?.(h.count);
      this.pending = null;
    } else {
      this.g.loot.dropNearPlayer(h.id, h.count);
    }
    this.g.ui.toast(L(`ทิ้ง${ITEMS[h.id].name}${h.count > 1 ? ` ×${h.count}` : ''}`, `Discarded ${ITEMS[h.id].name}${h.count > 1 ? ` ×${h.count}` : ''}`));
    this.render();
  }

  sort() {
    if (this.held) this.returnHeld();
    if (!this.inv.autoSort()) this.g.ui.toast(L('จัดอัตโนมัติไม่ได้ — ของเยอะเกินไป', 'Cannot sort — too much to carry'));
    this.g.audio.ui();
    this.render();
  }

  // ---------------------------------------------------------------- item menu
  showMenu(it, e) {
    const def = ITEMS[it.id];
    const m = this.menu;
    m.innerHTML = '';
    const add = (label, fn) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('pointerup', (ev) => { ev.stopPropagation(); this.hideMenu(); fn(); });
      b.addEventListener('pointerdown', (ev) => ev.stopPropagation());
      m.appendChild(b);
    };
    if (def.kind === 'use') add(L('ใช้', 'Use'), () => { if (this.g.useItem(it)) this.render(); });
    if (def.kind === 'weapon' || def.kind === 'armour') add(L('สวมใส่', 'Equip'), () => { if (this.g.equipment.equip(it)) { this.select(null); this.render(); } });
    add(L('ย้าย', 'Move'), () => { this.mouse = { x: e.clientX, y: e.clientY }; this.pickUp(it, 0, 0, false); });
    if (def.w !== def.h) add(L('หมุน', 'Rotate'), () => {
      if (this.inv.move(it, it.x, it.y, !it.rot)) this.render();
      else this.g.ui.toast(L('หมุนตรงนี้ไม่ได้ — ที่ไม่พอ', 'Cannot rotate here — no room'));
    });
    add(L('ทิ้ง', 'Discard'), () => {
      this.inv.removeItem(it);
      this.g.loot.dropNearPlayer(it.id, it.count);
      this.g.ui.toast(L(`ทิ้ง${def.name}${it.count > 1 ? ` ×${it.count}` : ''}`, `Discarded ${def.name}${it.count > 1 ? ` ×${it.count}` : ''}`));
      this.select(null);
      this.render();
    });
    m.classList.remove('hidden');
    const r = this.el.getBoundingClientRect();
    m.style.left = `${Math.min(e.clientX + 8, r.right - 150)}px`;
    m.style.top = `${Math.min(e.clientY + 8, r.bottom - 200)}px`;
  }

  hideMenu() { this.menu.classList.add('hidden'); }

  // keyboard while open (called from the game loop)
  update(input) {
    if (input.consume('rotate')) this.rotateHeld();
    if (input.consume('escape')) { if (this.held) this.returnHeld(); else this.close(); return; }
    if (input.consume('bag')) this.close();
  }
}
