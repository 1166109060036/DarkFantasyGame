// Grid inventory in the style of Resident Evil 4's attaché case: every item occupies a w x h
// rectangle (swapped when rotated) and nothing may overlap or hang outside the case.
import { ITEMS } from './items.js';

export const BAG_SIZES = [[8, 5], [10, 6], [12, 7]];

let uidSeq = 1;

export class Inventory {
  constructor(level = 0) {
    this.level = level;
    [this.cols, this.rows] = BAG_SIZES[level];
    this.items = [];
    this.onChange = null;
  }

  static dims(id, rot) {
    const d = ITEMS[id];
    return rot ? [d.h, d.w] : [d.w, d.h];
  }

  changed() { this.onChange?.(); }

  fits(x, y, w, h, ignore = null) {
    if (x < 0 || y < 0 || x + w > this.cols || y + h > this.rows) return false;
    return this.overlapping(x, y, w, h, ignore).length === 0;
  }

  overlapping(x, y, w, h, ignore = null) {
    return this.items.filter((it) => it !== ignore && x < it.x + it.w && it.x < x + w && y < it.y + it.h && it.y < y + h);
  }

  findSpot(id, prefer = [false, true]) {
    for (const rot of prefer) {
      const [w, h] = Inventory.dims(id, rot);
      if (w === h && rot) continue;
      for (let y = 0; y <= this.rows - h; y++) {
        for (let x = 0; x <= this.cols - w; x++) if (this.fits(x, y, w, h)) return { x, y, rot };
      }
    }
    return null;
  }

  place(id, count, x, y, rot) {
    const [w, h] = Inventory.dims(id, rot);
    const it = { uid: uidSeq++, id, count, x, y, w, h, rot };
    this.items.push(it);
    return it;
  }

  // Adds as much as fits (topping up stacks first). Returns the count that did not fit.
  add(id, count = 1) {
    const max = ITEMS[id].stack;
    for (const it of this.items) {
      if (count <= 0) break;
      if (it.id !== id || it.count >= max) continue;
      const n = Math.min(count, max - it.count);
      it.count += n;
      count -= n;
    }
    while (count > 0) {
      const spot = this.findSpot(id);
      if (!spot) break;
      const n = Math.min(count, max);
      this.place(id, n, spot.x, spot.y, spot.rot);
      count -= n;
    }
    this.changed();
    return count;
  }

  // Would this many fit right now? (without changing anything)
  canAdd(id, count = 1) {
    const copy = this.clone();
    return copy.add(id, count) === 0;
  }

  count(id) { return this.items.reduce((s, it) => s + (it.id === id ? it.count : 0), 0); }

  // Takes from the smallest stacks first so the case frees up space.
  remove(id, count = 1) {
    const stacks = this.items.filter((it) => it.id === id).sort((a, b) => a.count - b.count);
    for (const it of stacks) {
      if (count <= 0) break;
      const n = Math.min(count, it.count);
      it.count -= n;
      count -= n;
    }
    this.items = this.items.filter((it) => it.count > 0);
    this.changed();
    return count === 0;
  }

  removeItem(it) {
    this.items = this.items.filter((x) => x !== it);
    this.changed();
  }

  // Move an existing item to (x, y, rot). Returns true on success.
  move(it, x, y, rot) {
    const [w, h] = Inventory.dims(it.id, rot);
    if (!this.fits(x, y, w, h, it)) return false;
    Object.assign(it, { x, y, w, h, rot });
    this.changed();
    return true;
  }

  // Pack largest items first, merging partial stacks along the way.
  autoSort() {
    const totals = new Map();
    for (const it of this.items) totals.set(it.id, (totals.get(it.id) || 0) + it.count);
    const order = [...totals.keys()].sort((a, b) => {
      const A = ITEMS[a], B = ITEMS[b];
      return B.w * B.h - A.w * A.h || A.kind.localeCompare(B.kind) || a.localeCompare(b);
    });
    const before = this.items;
    this.items = [];
    for (const id of order) {
      let n = totals.get(id);
      while (n > 0) {
        const spot = this.findSpot(id, [false, true]);
        if (!spot) { this.items = before; return false; }   // never lose items: keep the old layout
        const k = Math.min(n, ITEMS[id].stack);
        this.place(id, k, spot.x, spot.y, spot.rot);
        n -= k;
      }
    }
    this.changed();
    return true;
  }

  // Bigger case: keep every item exactly where it is.
  upgrade() {
    if (this.level >= BAG_SIZES.length - 1) return false;
    this.level++;
    [this.cols, this.rows] = BAG_SIZES[this.level];
    this.changed();
    return true;
  }

  clone() {
    const c = new Inventory(this.level);
    c.items = this.items.map((it) => ({ ...it }));
    return c;
  }

  serialize() {
    return { level: this.level, items: this.items.map(({ id, count, x, y, rot }) => [id, count, x, y, rot ? 1 : 0]) };
  }

  load(d) {
    if (!d) return;
    this.level = Math.min(d.level || 0, BAG_SIZES.length - 1);
    [this.cols, this.rows] = BAG_SIZES[this.level];
    this.items = [];
    const spill = [];
    for (const [id, count, x, y, rot] of d.items || []) {
      if (!ITEMS[id]) continue;
      const [w, h] = Inventory.dims(id, !!rot);
      if (this.fits(x, y, w, h)) this.place(id, count, x, y, !!rot);
      else spill.push([id, count]);
    }
    for (const [id, count] of spill) this.add(id, count);
    this.changed();
  }
}
