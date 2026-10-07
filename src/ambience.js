// The world's background sound: rivers, waterfalls, fires, wind and the creatures you never see.
// Looping beds sit at the nearest source and are panned in 3D; one-shot sounds (crickets, owls,
// a wolf far off, a scream in the dark, crows by day, the creaking chains of the floating castle)
// are scattered around the player on timers that depend on the hour, the weather and the region.
import { RIVER, STREAM, CASTLE, HEAD, RIBCAGE, TAVERN, TEMPLE, LOCATIONS } from './layout.js';

const rnd = Math.random;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// nearest point on a polyline (2D)
function nearestOnLine(pts, x, z) {
  let best = null, bd = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az;
    const k = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    const px = ax + dx * k, pz = az + dz * k, d = Math.hypot(x - px, z - pz);
    if (d < bd) { bd = d; best = { x: px, z: pz, d }; }
  }
  return best;
}

const WATERFALLS = [2.4, 3.3, 4.2, 0.9].map((a) => ({ x: CASTLE.x + Math.cos(a) * 41, z: CASTLE.z + Math.sin(a) * 41 * 0.84 }));
const CHAINS = [2.3, 3.0, 3.8, 4.6, 5.4].map((a) => ({ x: CASTLE.x + Math.cos(a) * 105, z: CASTLE.z + Math.sin(a) * 105 }));
const SWAMP = LOCATIONS.find((l) => l.id === 'swamp');
const CANYON = LOCATIONS.find((l) => l.id === 'canyon');

export class Ambience {
  constructor(game) {
    this.g = game;
    this.audio = game.audio;
    this.timers = {};
    this.beds = null;
  }

  // looping filtered noise with a 3D position
  bed(chain, { ref = 6, rolloff = 1.3, gain = 0.2 } = {}) {
    const a = this.audio, ctx = a.ctx;
    let node = a.loopNoise();
    for (const [type, freq, q = 0.7, db = 0] of chain) {
      const f = ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q; f.gain.value = db;
      node = node.connect(f);
    }
    const g = ctx.createGain(); g.gain.value = 0;
    const p = ctx.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
    p.refDistance = ref; p.rolloffFactor = rolloff; p.maxDistance = 400;
    node.connect(g).connect(p).connect(a.ambBus);
    return { g, p, gain };
  }

  setBed(b, x, y, z, level) {
    const t = this.audio.ctx.currentTime;
    b.p.positionX.setTargetAtTime(x, t, 0.3);
    b.p.positionY.setTargetAtTime(y, t, 0.3);
    b.p.positionZ.setTargetAtTime(z, t, 0.3);
    b.g.gain.setTargetAtTime(b.gain * level, t, 0.6);
  }

  start() {
    if (this.beds || !this.audio.ctx) return;
    this.beds = {
      river: this.bed([['bandpass', 750, 0.5], ['highshelf', 3000, 0.7, -6]], { ref: 5, gain: 0.22 }),
      falls: this.bed([['lowpass', 1400, 0.5], ['lowshelf', 200, 0.7, 6]], { ref: 22, rolloff: 1.1, gain: 0.5 }),
      fire: this.bed([['bandpass', 380, 0.8]], { ref: 2.5, rolloff: 1.5, gain: 0.07 }),
    };
  }

  // countdown helper: fn fires every min..max seconds while cond holds
  every(name, dt, cond, min, max, fn) {
    if (!(name in this.timers)) this.timers[name] = min * rnd() + 1;
    if (!cond) return;
    if ((this.timers[name] -= dt) > 0) return;
    this.timers[name] = min + rnd() * (max - min);
    fn();
  }

  // a spot around the listener, at ground level
  around(p, rMin, rMax, side = null) {
    const a = side ?? rnd() * Math.PI * 2, r = rMin + rnd() * (rMax - rMin);
    const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
    return { x, y: this.g.terrain.getHeight(x, z), z };
  }

  update(dt) {
    if (!this.audio.ctx) return;
    this.start();
    const g = this.g, a = this.audio, cam = g.camera.position;
    const p = { x: cam.x, z: cam.z };
    const day = g.dayNight.p.day, night = 1 - day;
    const rain = g.weather.intensity;
    const inside = g.indoor;
    const out = 1 - inside * 0.85;
    const T = (x, z, dy = 0) => g.terrain.getHeight(x, z) + dy;
    const dist = (o) => Math.hypot(o.x - p.x, o.z - p.z);

    // --- beds (the river, the falls, the giants and the village only exist in the story world)
    const W = !g.arena;
    const r1 = nearestOnLine(RIVER, p.x, p.z), r2 = nearestOnLine(STREAM, p.x, p.z);
    const r = r1.d < r2.d ? r1 : r2;
    this.setBed(this.beds.river, r.x, 0.2, r.z, out * (W && r.d < 70 ? 1 : 0));
    let wf = WATERFALLS[0];
    for (const w of WATERFALLS) if (dist(w) < dist(wf)) wf = w;
    this.setBed(this.beds.falls, wf.x, 3, wf.z, out * (W && dist(wf) < 220 ? 1 : 0));
    let fire = null, fd = 30;
    for (const f of g.fx.fires) {
      const fp = f.s.position;
      const d = Math.hypot(fp.x - cam.x, fp.z - cam.z);
      if (d < fd && Math.abs(fp.y - cam.y) < 12) { fd = d; fire = fp; }
    }
    if (fire) this.setBed(this.beds.fire, fire.x, fire.y, fire.z, 1);
    else this.beds.fire.g.gain.setTargetAtTime(0, a.ctx.currentTime, 0.5);

    // --- wind: stronger up high, in the canyon and in storms; barely there indoors
    const height = clamp((cam.y - 8) / 40, 0, 1);
    const canyon = W && dist(CANYON) < CANYON.r + 10 ? 0.08 : 0;
    a.setWind((0.05 + height * 0.15 + canyon + rain * 0.05) * (1 - inside * 0.85));

    // --- reverb follows the space you are in
    a.setEnvironment(inside > 0.5 ? 'room' : canyon || (W && dist(TEMPLE) < 40) ? 'hall' : 'outdoor');

    // --- fire crackle, from the nearest flame
    this.every('crackle', dt, !!fire, 0.04, 0.35, () => {
      a.burst({ dur: 0.02 + rnd() * 0.03, freq: 1500 + rnd() * 3500, q: 3, gain: 0.08 + rnd() * 0.12, pos: { x: fire.x, y: fire.y - 1, z: fire.z }, verb: 0.1, bus: a.ambBus });
      if (rnd() < 0.15) a.burst({ dur: 0.25, freq: 250, q: 1, gain: 0.06, pos: { x: fire.x, y: fire.y - 1, z: fire.z }, verb: 0.1, bus: a.ambBus });
    });

    const outdoors = inside < 0.3, calm = rain < 0.6;
    const blood = g.events?.bloodMoon && night > 0.5;   // under a blood moon the small things fall silent

    // --- night creatures
    this.every('cricket', dt, night > 0.5 && outdoors && calm && !blood, 0.3, 1.6, () => {
      const at = this.around(p, 5, 22), f = 4200 + rnd() * 600, n = 2 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) a.tone({ freq: f, dur: 0.035, type: 'triangle', gain: 0.03, delay: i * 0.05, attack: 0.005, pos: at, verb: 0.05, bus: a.ambBus });
    });
    const inSwamp = W && (dist(SWAMP) < SWAMP.r + 30 || r.d < 25);
    this.every('frog', dt, night > 0.4 && outdoors && inSwamp && !blood, 0.4, 2.2, () => {
      const at = this.around(p, 6, 30), f = 70 + rnd() * 90;
      for (let i = 0; i < 1 + Math.floor(rnd() * 3); i++) a.voice({ freq: f, dur: 0.18 + rnd() * 0.15, gain: 0.07, slide: 0.85, vibrato: 30 + rnd() * 20, formant: 350 + rnd() * 300, q: 3, type: 'square', delay: i * 0.3, pos: at, verb: 0.15 });
    });
    this.every('owl', dt, night > 0.6 && outdoors, 18, 45, () => {
      const at = this.around(p, 25, 45);
      at.y += 8;
      a.tone({ freq: 360, dur: 0.5, gain: 0.08, slide: 0.93, attack: 0.08, pos: at, verb: 0.4, bus: a.ambBus });
      a.tone({ freq: 350, dur: 0.25, gain: 0.06, slide: 0.95, attack: 0.04, delay: 0.75, pos: at, verb: 0.4, bus: a.ambBus });
      a.tone({ freq: 345, dur: 0.6, gain: 0.07, slide: 0.9, attack: 0.06, delay: 1.05, pos: at, verb: 0.4, bus: a.ambBus });
    });
    // a wolf far away in the western woods
    this.every('howl', dt, night > 0.6 && (!W || p.x < 40), 50, 110, () => {
      const at = this.around(p, 60, 90, Math.PI + (rnd() - 0.5));
      a.voice({ freq: 330, dur: 3.2, gain: 0.22, slide: 1.35, formant: 900, q: 3, vibrato: 5, type: 'triangle', pos: at, verb: 0.8 });
      a.voice({ freq: 445, dur: 1.6, gain: 0.16, slide: 0.6, formant: 900, q: 3, vibrato: 5, type: 'triangle', delay: 3.0, pos: at, verb: 0.8 });
    });
    // the Pale Ones are out there; sometimes you hear one
    this.every(blood ? 'bloodscream' : 'scream', dt, night > 0.7 && outdoors, blood ? 12 : 70, blood ? 35 : 160, () => {
      const at = this.around(p, 60, 100);
      a.voice({ freq: 820 + rnd() * 200, dur: 1.4, gain: 0.2, slide: 0.55, formant: 2300, q: 5, vibrato: 11, pos: at, verb: 0.9 });
    });

    // --- day
    this.every('crow', dt, day > 0.4 && outdoors, 8, 22, () => { const at = this.around(p, 15, 40); at.y += 6; a.caw(at); });
    // the old station bell tolls somewhere in the village
    this.every('bell', dt, W && day > 0.4 && dist(TAVERN) < 220, 70, 150, () => {
      const at = { x: TAVERN.x + 20, y: T(TAVERN.x + 20, TAVERN.z - 20, 10), z: TAVERN.z - 20 };
      for (let i = 0; i < 3; i++) a.metal({ freq: 196, dur: 4, gain: 0.12, delay: i * 2.2, partials: [1, 2.02, 2.4, 3.01, 4.2], pos: at, verb: 0.6 });
    });

    // --- the giants
    let chain = CHAINS[0];
    for (const c of CHAINS) if (dist(c) < dist(chain)) chain = c;
    this.every('chain', dt, W && dist(chain) < 120, 5, 13, () => {
      const at = { x: chain.x, y: T(chain.x, chain.z, 12), z: chain.z };
      a.voice({ freq: 55 + rnd() * 20, dur: 2.4, gain: 0.16, slide: 1.25, formant: 420, q: 7, vibrato: 3, type: 'square', pos: at, verb: 0.6 });
      for (let i = 0; i < 3; i++) a.metal({ freq: 320 + rnd() * 80, dur: 0.5, gain: 0.04, delay: 1 + i * 0.4, partials: [1, 2.3, 3.7], pos: at, verb: 0.5 });
    });
    // the sleeping king breathes
    this.every('breath', dt, W && dist(HEAD) < 110, 8, 12, () => {
      const at = { x: HEAD.x, y: T(HEAD.x, HEAD.z, 10), z: HEAD.z };
      a.burst({ dur: 4.5, freq: 160, q: 0.8, type: 'lowpass', gain: 0.45, attack: 1.8, pos: at, verb: 0.5, bus: a.ambBus });
      a.burst({ dur: 3.5, freq: 520, q: 2, gain: 0.08, attack: 1.4, delay: 4.6, sweep: 0.6, pos: at, verb: 0.5, bus: a.ambBus });
    });
    // wind whistles through the giant's ribs
    this.every('ribs', dt, W && dist(RIBCAGE) < 80 && outdoors, 6, 14, () => {
      const at = { x: RIBCAGE.x + (rnd() - 0.5) * 30, y: T(RIBCAGE.x, RIBCAGE.z, 14), z: RIBCAGE.z + (rnd() - 0.5) * 30 };
      a.tone({ freq: 480 + rnd() * 400, dur: 3 + rnd() * 2, gain: 0.03, slide: 0.9 + rnd() * 0.2, vibrato: 0.7, vibDepth: 0.03, attack: 1.2, pos: at, verb: 0.6, bus: a.ambBus });
    });

    // --- inside the inn: murmuring patrons, mugs, the odd laugh
    const inn = g.village.indoor;
    const innSpot = () => ({ x: inn.minX + 1 + rnd() * (inn.maxX - inn.minX - 2), y: inn.maxY - 4, z: inn.minZ + 1 + rnd() * (inn.maxZ - inn.minZ - 2) });
    this.every('murmur', dt, inside > 0.5, 0.6, 2.2, () => {
      const at = innSpot(), base = 110 + rnd() * 120;
      const n = 3 + Math.floor(rnd() * 5);
      for (let i = 0; i < n; i++) a.voice({ freq: base * (0.9 + rnd() * 0.25), dur: 0.12 + rnd() * 0.18, gain: 0.03, slide: 0.9 + rnd() * 0.2, formant: 500 + rnd() * 900, q: 2, vibrato: 4, delay: i * 0.2 + rnd() * 0.05, pos: at, verb: 0.3 });
    });
    this.every('clink', dt, inside > 0.5, 2, 6, () => a.metal({ freq: 2400 + rnd() * 900, dur: 0.25, gain: 0.025, partials: [1, 2.6], pos: innSpot(), verb: 0.3 }));
    this.every('laugh', dt, inside > 0.5, 10, 25, () => {
      const at = innSpot(), f = 230 + rnd() * 80;
      for (let i = 0; i < 5; i++) a.voice({ freq: f * (1 - i * 0.05), dur: 0.13, gain: 0.04, formant: 900, q: 2, vibrato: 6, delay: i * 0.17, pos: at, verb: 0.3 });
    });
  }
}
