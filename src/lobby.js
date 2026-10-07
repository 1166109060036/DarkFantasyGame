// The online lobby: host a room (you get a five-letter code to send to friends) or join one with
// a code. The host sees who is in, can fill empty seats with bot lords, and starts the match.
import { Net } from './net.js';
import { CLASSES } from './classes.js';
import { SEATS } from './moba.js';

const $ = (id) => document.getElementById(id);
const NAME_KEY = 'moonmire-name';
const BOT_NAMES = ['ลอร์ดซากศพ', 'ท่านหญิงหมอกควัน', 'บารอนเขี้ยวเงิน', 'เจ้าหลุมฝังศพ'];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class Lobby {
  constructor(game) {
    this.g = game;
    this.net = null;
    this.roster = [];
    this.el = $('lobby');
    const sel = $('lobby-class');
    sel.innerHTML = Object.entries(CLASSES).map(([id, c]) => `<option value="${id}">${c.icon} ${c.name} — ${c.weapon}</option>`).join('');
    try { $('lobby-name').value = localStorage.getItem(NAME_KEY) || ''; } catch { /* storage unavailable */ }
    $('lobby-host').addEventListener('click', () => this.hostRoom());
    $('lobby-join').addEventListener('click', () => this.joinRoom());
    $('lobby-code-in').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.joinRoom(); });
    $('lobby-addbot').addEventListener('click', () => this.addBot());
    $('lobby-start').addEventListener('click', () => this.start());
    $('lobby-leave').addEventListener('click', () => this.leave());
    $('lobby-copy').addEventListener('click', () => navigator.clipboard?.writeText(this.net?.code || '').then(() => this.status('คัดลอกรหัสแล้ว')).catch(() => {}));
  }

  get name() {
    const n = ($('lobby-name').value || '').trim().slice(0, 16) || 'ผู้เดินทาง';
    try { localStorage.setItem(NAME_KEY, n); } catch { /* storage unavailable */ }
    return n;
  }
  get cls() { return $('lobby-class').value; }

  open() {
    this.el.classList.remove('hidden');
    $('title').classList.add('hidden');
    this.view('menu');
    this.status('');
  }

  view(which) {
    $('lobby-menu').classList.toggle('hidden', which !== 'menu');
    $('lobby-room').classList.toggle('hidden', which !== 'room');
  }

  status(text, bad = false) {
    const s = $('lobby-status');
    s.textContent = text;
    s.classList.toggle('bad', bad);
  }

  busy(on) { for (const id of ['lobby-host', 'lobby-join']) $(id).disabled = on; }

  // ---------------------------------------------------------------- host
  async hostRoom() {
    this.busy(true);
    this.status('กำลังสร้างห้อง...');
    this.net = new Net();
    try {
      const code = await this.net.host();
      this.roster = [{ slot: 0, name: this.name, cls: this.cls, bot: false, peer: null }];
      this.net.on('message', (m, from) => this.onHostMessage(m, from)).on('leave', (peer) => this.dropPeer(peer));
      $('lobby-code').textContent = code;
      this.view('room');
      this.status('ส่งรหัสห้องนี้ให้เพื่อน แล้วรอเพื่อนเข้าห้อง · เพิ่มบอทเพื่อเติมที่ว่างได้');
      this.render();
    } catch (e) {
      this.status(e.message, true);
      this.net = null;
    }
    this.busy(false);
  }

  freeSlot() { for (let i = 0; i < 4; i++) if (!this.roster.some((r) => r.slot === i)) return i; return -1; }

  onHostMessage(m, from) {
    if (m.t !== 'hello') return;
    const slot = this.freeSlot();
    if (slot < 0) { this.net.sendTo(from, { t: 'full' }); return; }
    this.roster.push({ slot, name: String(m.name || 'ผู้เดินทาง').slice(0, 16), cls: CLASSES[m.cls] ? m.cls : 'wanderer', bot: false, peer: from });
    this.g.audio.ui();
    this.sync();
  }

  dropPeer(peer) {
    this.roster = this.roster.filter((r) => r.peer !== peer);
    this.sync();
  }

  addBot() {
    const slot = this.freeSlot();
    if (slot < 0) return;
    // each bot lord takes up a path nobody else at the table has, if there is one left
    const taken = new Set(this.roster.map((r) => r.cls)), paths = Object.keys(CLASSES);
    const free = paths.filter((c) => !taken.has(c)), pool = free.length ? free : paths;
    this.roster.push({ slot, name: BOT_NAMES[slot], cls: pool[Math.floor(Math.random() * pool.length)], bot: true, peer: null });
    this.sync();
  }

  kick(slot) {
    const r = this.roster.find((x) => x.slot === slot);
    if (!r || slot === 0) return;
    if (r.peer) this.net.sendTo(r.peer, { t: 'kicked' });
    this.roster = this.roster.filter((x) => x !== r);
    this.sync();
  }

  sync() {
    this.net.broadcast({ t: 'lobby', roster: this.roster });
    this.render();
  }

  start() {
    if (this.roster.length < 2) { this.status('ต้องมีอย่างน้อย 2 ฝ่าย (เพื่อนหรือบอท)', true); return; }
    this.roster.sort((a, b) => a.slot - b.slot);
    for (const r of this.roster) if (r.peer) this.net.sendTo(r.peer, { t: 'start', roster: this.roster, me: r.slot });
    this.launch(0);
  }

  // ---------------------------------------------------------------- join
  async joinRoom() {
    const code = ($('lobby-code-in').value || '').trim().toUpperCase();
    if (code.length !== 5) { this.status('รหัสห้องมี 5 ตัวอักษร', true); return; }
    this.busy(true);
    this.status('กำลังเชื่อมต่อ...');
    this.net = new Net();
    try {
      await this.net.join(code);
      this.net.on('message', (m) => this.onClientMessage(m)).on('hostLeft', () => { this.status('โฮสต์ปิดห้องไปแล้ว', true); this.view('menu'); this.net?.close(); this.net = null; });
      this.net.send({ t: 'hello', name: this.name, cls: this.cls });
      $('lobby-code').textContent = code;
      this.view('room');
      this.status('เข้าห้องแล้ว — รอโฮสต์เริ่มเกม');
    } catch (e) {
      this.status(e.message, true);
      this.net = null;
    }
    this.busy(false);
  }

  onClientMessage(m) {
    if (m.t === 'lobby') { this.roster = m.roster; this.render(); }
    if (m.t === 'full') { this.status('ห้องเต็มแล้ว (4 คน)', true); this.leave(); }
    if (m.t === 'kicked') { this.status('โฮสต์เชิญเจ้าออกจากห้อง', true); this.leave(); }
    if (m.t === 'start') { this.roster = m.roster; this.launch(m.me); }
  }

  // ---------------------------------------------------------------- shared
  render() {
    const host = this.net?.isHost;
    $('lobby-list').innerHTML = [0, 1, 2, 3].map((slot) => {
      const r = this.roster.find((x) => x.slot === slot), s = SEATS[slot];
      if (!r) return `<div class="lb-seat empty"><span class="lb-dot" style="background:${s.css}"></span>ฐาน${s.name} — ว่าง</div>`;
      const kick = host && slot !== 0 ? `<button class="ghost lb-kick" data-slot="${slot}">✕</button>` : '';
      return `<div class="lb-seat"><span class="lb-dot" style="background:${s.css}"></span><b>${esc(r.name)}</b>
        <span class="lb-cls">${r.bot ? '🤖 ' : ''}${CLASSES[r.cls]?.icon || ''} ${CLASSES[r.cls]?.name || ''}</span>${slot === 0 ? '<span class="lb-host">โฮสต์</span>' : ''}${kick}</div>`;
    }).join('');
    $('lobby-list').querySelectorAll('.lb-kick').forEach((b) => b.addEventListener('click', () => this.kick(+b.dataset.slot)));
    $('lobby-addbot').classList.toggle('hidden', !host);
    $('lobby-start').classList.toggle('hidden', !host);
    $('lobby-addbot').disabled = this.roster.length >= 4;
  }

  launch(me) {
    this.el.classList.add('hidden');
    this.g.startMoba(this.net, this.roster, me);
  }

  leave() {
    this.net?.close();
    this.net = null;
    this.roster = [];
    this.view('menu');
  }

  close() {
    this.leave();
    this.el.classList.add('hidden');
    $('title').classList.remove('hidden');
  }
}
