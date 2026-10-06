// DOM HUD: compass, quest tracker, health, dialogue, toasts, world map.
import { HALF } from './terrain.js';
import { wrapAngle } from './util.js';
import { PASTURE, TOAD, TEMPLE, RIVER } from './layout.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {
      hud: $('hud'), questTitle: $('quest-title'), questText: $('quest-text'), hpFill: $('hp-fill'),
      coins: $('coins'), potions: $('potions'), prompt: $('prompt'), toasts: $('toasts'),
      compass: $('compass-strip'), dialogue: $('dialogue'), speaker: $('dlg-speaker'), text: $('dlg-text'),
      options: $('dlg-options'), hint: $('dlg-hint'), map: $('map'), mapCanvas: $('map-canvas'),
    };
    this.dlg = null;
    this.compassItems = [];
    const cards = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]];
    for (const [label, deg] of cards) {
      const d = document.createElement('div');
      d.className = 'cmp-card' + (label.length > 1 ? ' minor' : '');
      d.textContent = label;
      this.el.compass.appendChild(d);
      this.compassItems.push({ d, ang: deg * Math.PI / 180 });
    }
    for (let deg = 0; deg < 360; deg += 15) {
      if (deg % 45 === 0) continue;
      const d = document.createElement('div');
      d.className = 'cmp-tick';
      this.el.compass.appendChild(d);
      this.compassItems.push({ d, ang: deg * Math.PI / 180 });
    }
    this.markerEls = [];
    for (let i = 0; i < 6; i++) {
      const d = document.createElement('div');
      d.className = 'cmp-marker';
      d.innerHTML = '<span class="gem">◆</span><span class="dist"></span>';
      this.el.compass.appendChild(d);
      this.markerEls.push(d);
    }
  }

  show(id, on = true) { $(id).classList.toggle('hidden', !on); }

  setQuest({ title, text }) {
    this.el.questTitle.textContent = title;
    this.el.questText.textContent = text;
  }

  setStats(hp, max, coins, potions) {
    this.el.hpFill.style.width = `${Math.max(0, hp / max) * 100}%`;
    this.el.coins.textContent = coins;
    this.el.potions.textContent = potions;
  }

  setPrompt(text) {
    if (this._prompt === text) return;
    this._prompt = text;
    this.el.prompt.textContent = text || '';
    this.el.prompt.classList.toggle('hidden', !text);
  }

  toast(text) {
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = text;
    this.el.toasts.appendChild(d);
    setTimeout(() => d.classList.add('out'), 2600);
    setTimeout(() => d.remove(), 3300);
  }

  // heading: 0 = north (-z), clockwise positive
  updateCompass(heading, px, pz, markers) {
    const half = Math.PI / 2;
    for (const it of this.compassItems) {
      const rel = wrapAngle(it.ang - heading);
      const vis = Math.abs(rel) < half;
      it.d.style.display = vis ? '' : 'none';
      if (vis) it.d.style.left = `${50 + (rel / half) * 50}%`;
    }
    this.markerEls.forEach((d, i) => {
      const m = markers[i];
      if (!m) { d.style.display = 'none'; return; }
      const bearing = Math.atan2(m.x - px, -(m.z - pz));
      let rel = wrapAngle(bearing - heading);
      const edge = Math.abs(rel) > half;
      rel = Math.max(-half, Math.min(half, rel));
      d.style.display = '';
      d.style.left = `${50 + (rel / half) * 50}%`;
      d.classList.toggle('edge', edge);
      d.querySelector('.dist').textContent = `${Math.round(Math.hypot(m.x - px, m.z - pz))}m`;
    });
  }

  // ---------- dialogue ----------
  openDialogue(script, onClose) {
    this.dlg = { ...script, idx: 0, typed: 0, sel: 0, phase: 'lines', onClose };
    this.el.dialogue.classList.remove('hidden');
    this.el.options.innerHTML = '';
    if (!script.lines.length) this.showOptions();
    else this.renderLine();
  }

  get dialogueOpen() { return !!this.dlg; }

  renderLine() {
    const [speaker, text] = this.dlg.lines[this.dlg.idx];
    this.el.speaker.textContent = speaker;
    this.el.speaker.classList.toggle('hidden', !speaker);
    this.dlg.full = text;
    this.dlg.typed = 0;
    this.el.text.textContent = '';
    this.el.hint.textContent = '▼';
  }

  showOptions() {
    const d = this.dlg;
    d.phase = 'options';
    this.el.hint.textContent = '';
    this.el.options.innerHTML = '';
    d.options.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'dlg-opt';
      b.innerHTML = `<span class="num">${i + 1}</span> ${o.label}`;
      b.addEventListener('click', (e) => { e.stopPropagation(); this.choose(i); });
      b.addEventListener('touchstart', (e) => { e.stopPropagation(); e.preventDefault(); this.choose(i); }, { passive: false });
      this.el.options.appendChild(b);
    });
    this.highlight();
  }

  highlight() {
    [...this.el.options.children].forEach((b, i) => b.classList.toggle('sel', i === this.dlg.sel));
  }

  choose(i) {
    const d = this.dlg;
    if (!d || d.phase !== 'options' || !d.options[i]) return;
    const o = d.options[i];
    o.fn();
    if (o.keepOpen) return;
    this.closeDialogue();
  }

  closeDialogue() {
    const cb = this.dlg?.onClose;
    this.dlg = null;
    this.el.dialogue.classList.add('hidden');
    cb?.();
  }

  advance() {
    const d = this.dlg;
    if (d.phase !== 'lines') return;
    if (d.typed < d.full.length) { d.typed = d.full.length; this.el.text.textContent = d.full; return; }
    d.idx++;
    if (d.idx < d.lines.length) this.renderLine();
    else if (d.options.length) this.showOptions();
    else this.closeDialogue();
  }

  updateDialogue(dt, input) {
    const d = this.dlg;
    if (!d) return;
    if (d.phase === 'lines') {
      if (d.typed < d.full.length) {
        d.typed = Math.min(d.full.length, d.typed + dt * 55);
        this.el.text.textContent = d.full.slice(0, Math.floor(d.typed));
      }
      if (['interact', 'jump', 'confirm', 'attack', 'tap'].some((a) => input.consume(a))) this.advance();
    } else {
      const n = d.options.length;
      if (input.consume('up')) { d.sel = (d.sel - 1 + n) % n; this.highlight(); }
      if (input.consume('down')) { d.sel = (d.sel + 1) % n; this.highlight(); }
      for (let i = 0; i < 4; i++) if (input.consume('opt' + (i + 1))) { this.choose(i); return; }
      if (['interact', 'confirm', 'attack'].some((a) => input.consume(a))) this.choose(d.sel);
    }
  }

  // ---------- world map ----------
  buildMap(terrain, railPts) {
    const S = 320;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const wx = (x / S) * HALF * 2 - HALF, wz = (y / S) * HALF * 2 - HALF;
        const h = terrain.getHeight(wx, wz);
        const hx = terrain.getHeight(wx + 2, wz) - h;
        const shade = Math.max(0.4, Math.min(1.3, 1 - hx * 0.35));
        let r, g, b;
        if (h < 0) { r = 30; g = 70; b = 150; }
        else { const t = Math.min(1, h / 35); r = (60 + t * 70) * shade; g = (72 + t * 50) * shade; b = (60 + t * 60) * shade; }
        const o = (y * S + x) * 4;
        img.data[o] = r * 0.9; img.data[o + 1] = g * 0.95; img.data[o + 2] = b * 1.1; img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const toMap = (wx, wz) => [(wx + HALF) / (HALF * 2) * S, (wz + HALF) / (HALF * 2) * S];
    ctx.strokeStyle = 'rgba(40,30,25,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([3, 2]);
    ctx.beginPath();
    railPts.forEach((p, i) => { const [mx, my] = toMap(p.x, p.z); i ? ctx.lineTo(mx, my) : ctx.moveTo(mx, my); });
    ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '11px Pridi, serif'; ctx.fillStyle = '#e8e2c8'; ctx.textAlign = 'center';
    const label = (wx, wz, t) => { const [mx, my] = toMap(wx, wz); ctx.fillText(t, mx, my); };
    label(PASTURE.x, PASTURE.z - 50, 'เนินจันทร์');
    label(TOAD.x, TOAD.z - 14, 'เห็ดยักษ์');
    label(TEMPLE.x, TEMPLE.z - 38, 'วิหารจมน้ำ');
    label(0, 230, 'บึงแสงจันทร์');
    label(RIVER[3][0] + 32, RIVER[3][1], 'หุบผา');
    this.mapBase = c;
    this.mapToCanvas = toMap;
  }

  drawMap(player, markers) {
    const cv = this.el.mapCanvas, ctx = cv.getContext('2d');
    const S = cv.width;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.mapBase, 0, 0, S, S);
    const k = S / this.mapBase.width;
    for (const m of markers) {
      const [mx, my] = this.mapToCanvas(m.x, m.z);
      ctx.fillStyle = '#7fd4ff';
      ctx.beginPath(); ctx.moveTo(mx * k, my * k - 7); ctx.lineTo(mx * k + 5, my * k); ctx.lineTo(mx * k, my * k + 7); ctx.lineTo(mx * k - 5, my * k); ctx.fill();
    }
    const [px, py] = this.mapToCanvas(player.pos.x, player.pos.z);
    ctx.save();
    ctx.translate(px * k, py * k);
    ctx.rotate(-player.yaw);
    ctx.fillStyle = '#ffe9a8'; ctx.strokeStyle = '#201810'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}
