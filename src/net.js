// Online play over WebRTC (PeerJS, vendor/peerjs.min.js). One player hosts a room and runs the
// match; the others connect straight to the host with a five-letter room code (star topology,
// host authoritative). The public PeerJS server only introduces the peers to each other; game
// traffic flows peer to peer, through PeerJS's TURN relays when a direct path is blocked.
//
// `?peer=localhost:9000` points at a self-hosted PeerJS server instead (used by the tests).

const PREFIX = 'moonmire-v1-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';     // no 0/O or 1/I to misread

export function makeCode() {
  let s = '';
  for (let i = 0; i < 5; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

function peerOptions() {
  const custom = new URLSearchParams(location.search).get('peer');
  if (!custom) return { debug: 1 };
  const [host, port] = custom.split(':');
  return { host, port: +port || 9000, path: '/', secure: false, debug: 1, config: { iceServers: [] } };
}

export class Net {
  constructor() {
    this.peer = null;
    this.conns = new Map();       // host: peerId -> DataConnection
    this.hostConn = null;         // client: the connection to the host
    this.isHost = false;
    this.code = null;
    this.handlers = {};
  }

  on(type, fn) { this.handlers[type] = fn; return this; }
  emit(type, ...args) { this.handlers[type]?.(...args); }

  get available() { return typeof window.Peer === 'function'; }

  // ---------------------------------------------------------------- host
  host() {
    return new Promise((resolve, reject) => {
      if (!this.available) { reject(new Error('ไม่พบไลบรารีเครือข่าย')); return; }
      const tryCode = (attempt) => {
        const code = makeCode();
        const peer = new window.Peer(PREFIX + code, peerOptions());
        let opened = false;
        peer.on('open', () => {
          opened = true;
          this.peer = peer; this.code = code; this.isHost = true;
          resolve(code);
        });
        peer.on('connection', (conn) => this.accept(conn));
        peer.on('error', (err) => {
          if (!opened && err.type === 'unavailable-id' && attempt < 5) { peer.destroy(); tryCode(attempt + 1); return; }
          if (!opened) reject(new Error(describe(err)));
          else this.emit('error', describe(err));
        });
        peer.on('disconnected', () => { if (opened && !peer.destroyed) peer.reconnect(); });
      };
      tryCode(0);
    });
  }

  accept(conn) {
    conn.on('open', () => { this.conns.set(conn.peer, conn); this.emit('join', conn.peer); });
    conn.on('data', (msg) => this.emit('message', msg, conn.peer));
    const gone = () => { if (this.conns.delete(conn.peer)) this.emit('leave', conn.peer); };
    conn.on('close', gone);
    conn.on('error', gone);
  }

  broadcast(msg, except = null) {
    for (const [id, c] of this.conns) if (id !== except && c.open) c.send(msg);
  }

  sendTo(peerId, msg) {
    const c = this.conns.get(peerId);
    if (c?.open) c.send(msg);
  }

  // ---------------------------------------------------------------- client
  join(code) {
    return new Promise((resolve, reject) => {
      if (!this.available) { reject(new Error('ไม่พบไลบรารีเครือข่าย')); return; }
      code = code.trim().toUpperCase();
      const peer = new window.Peer(peerOptions());
      let done = false;
      const fail = (m) => { if (!done) { done = true; peer.destroy(); reject(new Error(m)); } };
      const timer = setTimeout(() => fail('เชื่อมต่อไม่สำเร็จ (หมดเวลา) — ตรวจรหัสห้องอีกครั้ง'), 15000);
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        conn.on('open', () => {
          clearTimeout(timer);
          done = true;
          this.peer = peer; this.hostConn = conn; this.code = code; this.isHost = false;
          resolve(code);
        });
        conn.on('data', (msg) => this.emit('message', msg, 'host'));
        conn.on('close', () => this.emit('hostLeft'));
        conn.on('error', () => this.emit('hostLeft'));
      });
      peer.on('error', (err) => { clearTimeout(timer); if (!done) fail(describe(err)); else this.emit('error', describe(err)); });
    });
  }

  send(msg) {
    if (this.hostConn?.open) this.hostConn.send(msg);
  }

  close() {
    for (const c of this.conns.values()) c.close();
    this.conns.clear();
    this.hostConn?.close();
    this.peer?.destroy();
    this.peer = null; this.hostConn = null; this.isHost = false;
  }
}

function describe(err) {
  switch (err?.type) {
    case 'peer-unavailable': return 'ไม่พบห้องนี้ — รหัสผิดหรือโฮสต์ปิดห้องไปแล้ว';
    case 'network': case 'server-error': case 'socket-error': case 'socket-closed': return 'ติดต่อเซิร์ฟเวอร์จับคู่ไม่ได้ — ตรวจอินเทอร์เน็ต';
    case 'browser-incompatible': return 'อุปกรณ์นี้ไม่รองรับการเล่นออนไลน์';
    default: return `เกิดข้อผิดพลาดของเครือข่าย (${err?.type || err?.message || err})`;
  }
}
