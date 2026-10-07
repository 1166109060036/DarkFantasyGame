// Adaptive score, composed on the fly. Every note is synthesised with WebAudio (choir, harp,
// cello, bells, drums...), so the music can follow the game: it drifts between a night piece
// and a gloomy day piece, swells near the giants, plays a jig inside the inn, breaks into a war
// drum ostinato when something hunts you and sings the Dies irae at the stone knight.
//
// Each piece keeps its own bar clock and is faded in and out by the director. Notes are scheduled
// a little ahead of time (scheduleUntil), which also lets tests render the score offline.
//
// Any piece can be replaced by a recorded track: list it in audio/bgm/tracks.json, e.g.
//   { "night": "night.mp3", "combat": "battle.ogg" }   (files go in audio/bgm/)
import { makeImpulse } from './audio.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const rnd = Math.random;
const pick = (a) => a[Math.floor(rnd() * a.length)];

// vowel formants (Hz, relative gain) for the choir
const VOWELS = {
  a: [[700, 1], [1150, 0.55], [2800, 0.2]],
  o: [[450, 1], [800, 0.5], [2830, 0.12]],
  u: [[325, 1], [700, 0.35], [2530, 0.08]],
  e: [[420, 1], [1650, 0.4], [2650, 0.18]],
};

// --- tiny DSP kit used to bake short, frequently played notes into cached buffers. Playing a
// buffer costs almost nothing, while live oscillators with swept filters are expensive when a
// battle drum and string ostinato fire several notes a second.
const polyblep = (t, dt) => {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
};
// band-limited sawtooth oscillator; call with the current frequency, returns the next sample
function sawOsc(sr) {
  let ph = Math.random();
  return (f) => { const dt = f / sr; ph += dt; if (ph >= 1) ph -= 1; return 2 * ph - 1 - polyblep(ph, dt); };
}
// RBJ biquad; set(type, f, q) may be called per sample for sweeps
function biquad(sr) {
  let b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const f = (x) => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  f.set = (type, freq, q = 0.7) => {
    const w = 2 * Math.PI * Math.min(freq, sr * 0.45) / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
    if (type === 'lowpass') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (type === 'highpass') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = al; b1 = 0; b2 = -al; }                                     // bandpass, 0 dB peak
    a1 = -2 * c; a2 = 1 - al;
    b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
    return f;
  };
  return f;
}

// ------------------------------------------------------------------------------------------------
// instruments: each plays into `dest` at time t
class Instruments {
  constructor(ctx, noise) {
    this.ctx = ctx;
    this.noise = noise;
    this.ks = new Map();
    this.baked = new Map();
  }

  // a cached buffer rendered by gen(data, sampleRate); `variants` keeps noisy hits from repeating
  bake(key, seconds, gen, variants = 1) {
    key += '#' + Math.floor(Math.random() * variants);
    let b = this.baked.get(key);
    if (!b) {
      const sr = this.ctx.sampleRate;
      b = this.ctx.createBuffer(1, Math.floor(sr * seconds), sr);
      gen(b.getChannelData(0), sr);
      this.baked.set(key, b);
    }
    return b;
  }

  // play a baked note; with `dur` the note is cut short with a quick release
  playBuf(dest, t, buf, vel, dur = 0, release = 0.08) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    if (dur) {
      g.gain.setValueAtTime(vel, t + dur);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
    }
    s.connect(g).connect(dest);
    s.start(t);
    if (dur) s.stop(t + dur + release + 0.02);
  }

  env(t, attack, hold, release, peak) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + Math.max(0, hold));
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + Math.max(0, hold) + release);
    return g;
  }

  osc(type, freq, t, end, detune = 0) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = freq; o.detune.value = detune;
    o.start(t); o.stop(end);
    return o;
  }

  noiseSrc(t, end) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise; s.loop = true;
    s.start(t, rnd() * 1.5); s.stop(end);
    return s;
  }

  lfo(freq, depth, t, end, delay = 0) {
    const l = this.osc('sine', freq, t, end);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(delay ? 0 : depth, t);
    if (delay) g.gain.linearRampToValueAtTime(depth, t + delay);
    l.connect(g);
    return g;
  }

  filter(type, freq, q = 0.7, gain = 0) {
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q; f.gain.value = gain;
    return f;
  }

  // massed voices: detuned saws through fixed vowel formants (like a real choir, the formants do
  // not move with pitch, which is what makes it sound sung rather than synthetic)
  choir(dest, t, notes, dur, vel = 0.5, vowel = 'o', attack = 1.2, release = 2.0) {
    const ctx = this.ctx, end = t + dur + release + 0.2;
    const mix = ctx.createGain(); mix.gain.value = 1 / Math.sqrt(notes.length * 3);
    // no vibrato LFO: the detuned voices beat against each other, which reads as a crowd (and
    // unmodulated oscillators are far cheaper to run)
    for (const m of notes) for (const d of [-11, 0, 10]) this.osc('sawtooth', mtof(m), t, end, d + (rnd() - 0.5) * 5).connect(mix);
    const breath = this.noiseSrc(t, end);
    const bg = ctx.createGain(); bg.gain.value = 0.05;
    breath.connect(bg).connect(mix);
    const e = this.env(t, Math.min(attack, dur * 0.5), dur - attack, release, vel);
    const sum = ctx.createGain(); sum.gain.value = 1;
    for (const [f, g] of VOWELS[vowel]) {
      const bp = this.filter('bandpass', f, f / 90);
      const gg = ctx.createGain(); gg.gain.value = g * 3.2;
      mix.connect(bp).connect(gg).connect(sum);
    }
    sum.connect(this.filter('lowpass', 3800)).connect(e).connect(dest);
  }

  // soft string pad
  pad(dest, t, notes, dur, vel = 0.3, bright = 900) {
    const ctx = this.ctx, end = t + dur + 2.5;
    const mix = ctx.createGain(); mix.gain.value = 0.5 / Math.sqrt(notes.length);
    for (const m of notes) for (const d of [-6, 6]) this.osc('sawtooth', mtof(m), t, end, d).connect(mix);
    const f = this.filter('lowpass', bright, 0.5);
    f.frequency.setValueAtTime(bright * 0.6, t);
    f.frequency.linearRampToValueAtTime(bright, t + dur * 0.5);
    f.frequency.linearRampToValueAtTime(bright * 0.6, t + dur);
    mix.connect(f).connect(this.env(t, Math.min(1.6, dur * 0.4), dur - 1.6, 2.2, vel)).connect(dest);
  }

  // Karplus-Strong plucked string (harp when bright, lute when damped). Buffers are cached.
  pluckBuffer(m, bright) {
    const key = m * 10 + bright;
    let b = this.ks.get(key);
    if (b) return b;
    const sr = this.ctx.sampleRate, f = mtof(m), N = Math.max(2, Math.round(sr / f));
    const len = Math.floor(sr * (bright ? 3.2 : 1.6));
    b = this.ctx.createBuffer(1, len, sr);
    const d = b.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < N; i++) { const n = rnd() * 2 - 1; lp += (n - lp) * (bright ? 0.7 : 0.35); d[i] = lp; }
    const decay = bright ? 0.9985 : 0.995;
    for (let i = N; i < len; i++) d[i] = decay * 0.5 * (d[i - N] + d[i - N - 1 < 0 ? 0 : i - N - 1]);
    // remove DC and normalise
    let peak = 0;
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
    for (let i = 0; i < len; i++) d[i] /= peak || 1;
    this.ks.set(key, b);
    return b;
  }

  pluck(dest, t, m, vel = 0.3, bright = 1) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.pluckBuffer(m, bright);
    const g = this.ctx.createGain(); g.gain.value = vel;
    s.connect(g).connect(dest);
    s.start(t);
  }

  // a chord strummed low to high
  strum(dest, t, notes, vel = 0.25, spread = 0.025, bright = 0) {
    notes.forEach((m, i) => this.pluck(dest, t + i * spread, m, vel * (1 - i * 0.08), bright));
  }

  // FM bell
  bell(dest, t, m, vel = 0.2, dur = 4.5) {
    const f = mtof(m), end = t + dur + 0.1;
    const car = this.osc('sine', f, t, end);
    const mod = this.osc('sine', f * 3.5, t, end);
    const mg = this.ctx.createGain();
    mg.gain.setValueAtTime(f * 2.2, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.05, t + dur * 0.6);
    mod.connect(mg).connect(car.frequency);
    const e = this.env(t, 0.003, 0, dur, vel);
    car.connect(e).connect(dest);
    const hi = this.osc('sine', f * 2.76, t, end);
    hi.connect(this.env(t, 0.003, 0, dur * 0.4, vel * 0.25)).connect(dest);
  }

  // bowed cello / viola: buzzy saw, body resonance, vibrato that blooms after the attack
  cello(dest, t, m, dur, vel = 0.3) {
    const ctx = this.ctx, end = t + dur + 0.6, f = mtof(m);
    const vib = this.lfo(5.3, 16, t, end, 0.45);
    const mix = ctx.createGain(); mix.gain.value = 0.5;
    for (const d of [-4, 4]) { const o = this.osc('sawtooth', f, t, end, d); vib.connect(o.detune); o.connect(mix); }
    const bow = this.noiseSrc(t, end);
    const bg = ctx.createGain(); bg.gain.value = 0.03;
    bow.connect(this.filter('bandpass', f * 3, 2)).connect(bg).connect(mix);
    mix.connect(this.filter('lowpass', 1500, 0.6))
      .connect(this.filter('peaking', 300, 1.2, 5))
      .connect(this.filter('peaking', 2400, 1.5, -6))
      .connect(this.env(t, 0.14, dur - 0.14, 0.4, vel)).connect(dest);
  }

  // short bowed strokes for the battle ostinato
  spiccato(dest, t, m, vel = 0.3) {
    const buf = this.bake('spic' + m, 0.4, (d, sr) => {
      const f = mtof(m), A = sawOsc(sr), B = sawOsc(sr), lp = biquad(sr), k1 = Math.pow(2, -7 / 1200), k2 = Math.pow(2, 7 / 1200);
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        lp.set('lowpass', 500 + 1700 * Math.exp(-t / 0.07), 1);
        const env = t < 0.006 ? t / 0.006 : t < 0.056 ? 1 : Math.exp(-(t - 0.056) / 0.05);
        d[i] = lp((A(f * k1) + B(f * k2)) * 0.25) * env;
      }
    });
    this.playBuf(dest, t, buf, vel * 1.6);
  }

  flute(dest, t, m, dur, vel = 0.15) {
    const buf = this.bake('flute' + m, 4.2, (d, sr) => {
      const f = mtof(m), bp = biquad(sr).set('bandpass', f * 2, 1.5);
      let ph = 0, ph2 = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        const vib = 1 + Math.sin(t * 2 * Math.PI * 5) * 0.006 * Math.min(1, Math.max(0, (t - 0.25) / 0.3));
        ph += f * vib / sr; ph2 += 2 * f * vib / sr;
        const tri = 1 - 4 * Math.abs((ph2 % 1) - 0.5);
        const env = Math.min(1, t / 0.07) * (t > 3.9 ? Math.max(0, (4.2 - t) / 0.3) : 1);
        d[i] = (Math.sin(ph * 2 * Math.PI) + tri * 0.12 + bp(Math.random() * 2 - 1) * 0.35) * env;
      }
    });
    this.playBuf(dest, t, buf, vel, Math.min(dur, 3.8), 0.22);
  }

  // hurdy-gurdy: nasal reedy melody string
  hurdy(dest, t, m, dur, vel = 0.15) {
    const buf = this.bake('hurdy' + m, 1.1, (d, sr) => {
      // a saw plus a pulse (two saws subtracted at different phases) for the reedy buzz
      const f = mtof(m), A = sawOsc(sr), P1 = sawOsc(sr), P2 = sawOsc(sr);
      const bp = biquad(sr).set('bandpass', 1300, 0.8), bp2 = biquad(sr).set('bandpass', 2600, 3);
      for (let i = 0; i < d.length; i++) {
        const t = i / sr, fv = f * (1 + Math.sin(t * 2 * Math.PI * 6) * 0.0046);
        const x = A(fv) * 0.5 + (P1(fv) - P2(fv)) * 0.3;
        const y = bp(x) + bp2(x) * 0.6;
        d[i] = y * 2.2 * Math.min(1, t / 0.02);
      }
    });
    this.playBuf(dest, t, buf, vel, Math.min(dur, 1.0), 0.07);
  }

  drone(dest, t, m, dur, vel = 0.15, cutoff = 320) {
    const end = t + dur + 4, mix = this.ctx.createGain(); mix.gain.value = 0.4;
    for (const [mm, d] of [[m, -5], [m, 5], [m + 7, 0], [m - 12, 0]]) this.osc('sawtooth', mtof(mm), t, end, d).connect(mix);
    const lp = this.filter('lowpass', cutoff, 1.2);
    const l = this.lfo(0.11, cutoff * 0.4, t, end);
    l.connect(lp.frequency);
    mix.connect(lp).connect(this.env(t, Math.min(3, dur * 0.4), dur - 3, 3.5, vel)).connect(dest);
  }

  // a struck membrane: sine swept down in pitch plus a filtered noise slap
  drum(key, seconds, f0, f1, sweep, toneDecay, noiseType, noiseF, noiseQ, noiseDecay, noiseGain) {
    return this.bake(key, seconds, (d, sr) => {
      const nf = biquad(sr).set(noiseType, noiseF, noiseQ);
      let ph = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        ph += (f1 + (f0 - f1) * Math.exp(-t / sweep)) / sr;
        const tone = Math.sin(ph * 2 * Math.PI) * Math.min(1, t / 0.004) * Math.exp(-t / toneDecay);
        d[i] = tone + nf(Math.random() * 2 - 1) * noiseGain * Math.exp(-t / noiseDecay);
      }
    }, 3);
  }

  taiko(dest, t, vel = 0.6, pitch = 1) {
    this.playBuf(dest, t, this.drum('taiko' + pitch, 1.2, 110 * pitch, 40 * pitch, 0.12, 0.3, 'lowpass', 700 * pitch, 0.8, 0.07, 0.8), vel);
  }

  // hand drum / frame drum
  frame(dest, t, vel = 0.3, f = 190) {
    this.playBuf(dest, t, this.drum('frame' + f, 0.5, f, f * 0.6, 0.06, 0.09, 'bandpass', 1800, 1, 0.025, 1.6), vel);
  }

  shaker(dest, t, vel = 0.06) {
    this.playBuf(dest, t, this.drum('shaker', 0.16, 0, 0, 1, 1, 'highpass', 6500, 0.7, 0.03, 1), vel * 1.4);
  }

  // brass stab: filter sweeps open with the breath
  brass(dest, t, notes, dur, vel = 0.25) {
    const end = t + dur + 0.5;
    const mix = this.ctx.createGain(); mix.gain.value = 0.6 / Math.sqrt(notes.length);
    for (const m of notes) for (const d of [-5, 5]) this.osc('sawtooth', mtof(m), t, end, d).connect(mix);
    const lp = this.filter('lowpass', 400, 2);
    lp.frequency.setValueAtTime(350, t);
    lp.frequency.exponentialRampToValueAtTime(2600, t + 0.07);
    lp.frequency.exponentialRampToValueAtTime(900, t + Math.min(dur, 0.6));
    mix.connect(lp).connect(this.env(t, 0.03, dur - 0.03, 0.3, vel)).connect(dest);
  }

  gong(dest, t, vel = 0.4, f = 98) {
    [[1, 1], [2.02, 0.5], [2.76, 0.4], [4.1, 0.25], [5.4, 0.15]].forEach(([k, g], i) => {
      this.osc('sine', f * k, t, t + 7).connect(this.env(t, 0.004 + i * 0.01, 0, 6 / (1 + i * 0.6), vel * g)).connect(dest);
    });
    this.noiseSrc(t, t + 2).connect(this.filter('lowpass', 900)).connect(this.env(t, 0.003, 0, 1.2, vel * 0.3)).connect(dest);
  }
}

// ------------------------------------------------------------------------------------------------
// harmony helpers (D minor). Chords are lists of MIDI notes in a middle voicing.
const CH = {
  Dm: [50, 53, 57], Bb: [46, 50, 53], Gm: [43, 46, 50], A: [45, 49, 52], C: [48, 52, 55],
  F: [41, 45, 48], Am: [45, 48, 52], Eb: [51, 55, 58], Dmaj: [50, 54, 57], G: [43, 47, 50],
};
const up = (notes, o) => notes.map((m) => m + o * 12);

class Piece {
  constructor(dir, { bpm, beats = 4, verb = 0.4, level = 1 }) {
    this.dir = dir;
    this.ins = dir.ins;
    this.bpm = bpm;
    this.beats = beats;
    this.mixLevel = level;
    const ctx = dir.ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.0001;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass'; this.filter.frequency.value = 20000;
    this.out.connect(this.filter).connect(dir.bus);
    const send = ctx.createGain(); send.gain.value = verb;
    this.filter.connect(send).connect(dir.verb);
    this.dest = ctx.createGain();       // instruments play into this; `out` fades the whole piece
    this.dest.connect(this.out);
    this.active = false;
    this.target = 0;
    this.next = 0;
    this.bar = 0;
    this.intensity = 0;
  }
  get beat() { return 60 / this.bpm; }
  get barDur() { return this.beat * this.beats; }
  begin(t) { this.active = true; this.next = t; this.bar = 0; this.onBegin?.(t); }
  schedule(until) {
    while (this.next < until) {
      this.play(this.next, this.bar);
      this.bar++;
      this.next += this.barDur;
    }
  }
}

// --- night: slow, cold and wide. Choir, harp, distant bells over a drone.
class NightPiece extends Piece {
  constructor(dir) { super(dir, { bpm: 62, verb: 0.75, level: 0.85 }); }
  onBegin() { this.prog = [CH.Dm, CH.Bb, CH.Gm, CH.A]; this.rest = 0; }
  play(t, bar) {
    const I = this.ins, d = this.dest, B = this.barDur, b = this.beat;
    const ch = this.prog[bar % 4];
    if (bar % 4 === 0) {
      I.drone(d, t, 26, B * 4, 0.12);
      // every 16 bars: maybe a sparse passage (just the drone) so the night can breathe
      this.rest = bar > 0 && bar % 16 === 0 && rnd() < 0.5 ? 4 : Math.max(0, this.rest - 4);
    }
    if (this.rest > 0) { if (bar % 4 === 2) I.bell(d, t + b * 2, pick([74, 77, 81]), 0.06, 6); return; }
    if (bar % 2 === 0 || rnd() < 0.4) I.choir(d, t, up(ch, 0).concat(ch[0] - 12), B * (bar % 2 === 0 ? 2 : 1), 0.11, bar % 8 < 4 ? 'o' : 'u', 1.6);
    // harp: broken chord across two octaves, with gaps
    const arp = [...up(ch, 1), ch[0] + 24, ch[1] + 24];
    const pattern = bar % 4 === 3 ? [0, 1, 2, 3, 4, 3, 2, 1] : [0, 2, 1, 3, 2, 4, 3, 1];
    for (let i = 0; i < 8; i++) if (rnd() < 0.7) I.pluck(d, t + i * b * 0.5 + rnd() * 0.012, arp[pattern[i] % arp.length], 0.13 - i * 0.008, 1);
    // a high bell melody now and then
    if (rnd() < 0.5) {
      const tones = [...up(ch, 2), ch[0] + 26];
      I.bell(d, t + b * pick([0, 1, 2]), pick(tones), 0.055, 5);
      if (rnd() < 0.4) I.bell(d, t + b * 3, pick(tones), 0.04, 4);
    }
  }
}

// --- day: a grey, mournful cello song over a lute, Andalusian cadence (Dm C Bb A)
const DAY_A = [[69, 2], [67, 1], [65, 1], [64, 2], [65, 1], [67, 1], [65, 1.5], [64, 0.5], [62, 2], [61, 3], [0, 1]];
const DAY_B = [[62, 1], [65, 1], [69, 2], [72, 1.5], [70, 0.5], [69, 2], [70, 2], [69, 1], [67, 1], [69, 4]];
class DayPiece extends Piece {
  constructor(dir) { super(dir, { bpm: 70, verb: 0.5, level: 0.9 }); }
  onBegin() { this.prog = [CH.Dm, CH.C, CH.Bb, CH.A]; this.phrase = 0; }
  play(t, bar) {
    const I = this.ins, d = this.dest, B = this.barDur, b = this.beat;
    const ch = this.prog[bar % 4];
    I.pad(d, t, up(ch, 0), B, 0.07, 700);
    I.cello(d, t, ch[0] - 12, B * 0.98, 0.12);                  // bass line
    // lute: strum on 1, picked notes after
    I.strum(d, t, [ch[0], ...up(ch, 1)], 0.16, 0.03);
    for (const [k, i] of [[1.5, 2], [2, 1], [3, 0], [3.5, 2]]) if (rnd() < 0.75) I.pluck(d, t + k * b, up(ch, 1)[i], 0.1, 0);
    // the melody: four bars at a time, cello first, then a flute answers an octave up
    if (bar % 4 === 0 && bar > 0) {
      const ph = this.phrase++ % 4;
      if (ph !== 3) {                                             // every fourth phrase is silence
        const mel = ph === 1 ? DAY_B : DAY_A;
        let k = 0;
        for (const [m, len] of mel) {
          if (m) {
            if (ph === 2) I.flute(d, t + k * b, m + 12, len * b * 0.95, 0.06);
            else I.cello(d, t + k * b, m - 12, len * b * 0.97, 0.16);
          }
          k += len;
        }
      }
    }
  }
}

// --- combat: driving low-string ostinato, war drums; intensity adds brass and choir
class CombatPiece extends Piece {
  constructor(dir) { super(dir, { bpm: 116, verb: 0.3, level: 0.95 }); }
  onBegin() { this.roots = [38, 38, 34, 33]; this.prog = [CH.Dm, CH.Dm, CH.Bb, CH.A]; }
  play(t, bar) {
    const I = this.ins, d = this.dest, b = this.beat, s = this.intensity;
    const r = this.roots[bar % 4], ch = this.prog[bar % 4];
    // ostinato in eighths: root root octave root | b3 root 2 root
    const pat = [0, 0, 12, 0, 3, 0, 2, 0];
    pat.forEach((iv, i) => I.spiccato(d, t + i * b / 2, r + (ch === CH.A && iv === 3 ? 4 : iv), i % 2 ? 0.18 : 0.26));
    if (s > 0.35) pat.forEach((iv, i) => { if (i % 2 === 0) I.spiccato(d, t + i * b / 2, r + 12 + iv, 0.1); });
    // drums
    I.taiko(d, t, 0.55);
    I.taiko(d, t + b * 1.5, 0.3, 1.25);
    I.taiko(d, t + b * 2, 0.45, 0.9);
    if (bar % 2 === 1) { I.frame(d, t + b * 3, 0.25, 160); I.frame(d, t + b * 3.5, 0.3, 140); }
    for (let i = 0; i < 8; i++) I.shaker(d, t + i * b / 2, i % 2 ? 0.03 : 0.05);
    if (s > 0.6) for (let i = 0; i < 4; i++) I.frame(d, t + b * (2 + i * 0.5), 0.18, 220 - i * 20);
    // brass stabs on the downbeat, a long horn call every 4 bars at higher intensity
    if (s > 0.2 && (bar % 2 === 0 || s > 0.6)) I.brass(d, t, up(ch, 0), b * 0.6, 0.12 + s * 0.06);
    if (s > 0.5 && bar % 4 === 0) I.brass(d, t + b * 2, [ch[0] + 12, ch[2] + 12], b * 6, 0.09);
    if (s > 0.75 && bar % 2 === 0) I.choir(d, t, up(ch, 1), b * 8, 0.09, 'a', 0.4);
  }
}

// --- boss: the Dies irae chanted by a choir over war drums and a gong
const DIES = [[65, 1], [64, 1], [65, 1], [62, 1], [64, 1], [60, 1], [62, 2], [65, 1], [65, 1], [67, 1], [65, 1], [64, 1], [62, 1], [64, 2]];
class BossPiece extends Piece {
  constructor(dir) { super(dir, { bpm: 126, verb: 0.55, level: 1 }); }
  onBegin() { this.prog = [CH.Dm, CH.Bb, CH.Gm, CH.A]; }
  play(t, bar) {
    const I = this.ins, d = this.dest, b = this.beat;
    const ch = this.prog[Math.floor(bar / 2) % 4];
    if (bar % 8 === 0) I.gong(d, t, 0.32, 73.4);
    // pounding low strings in eighths
    for (let i = 0; i < 8; i++) I.spiccato(d, t + i * b / 2, ch[0] - 12 + (i === 7 ? 1 : 0), i % 2 ? 0.17 : 0.25);
    for (let i = 0; i < 8; i++) if (i % 2 === 0 || rnd() < 0.3) I.taiko(d, t + i * b / 2, i % 4 === 0 ? 0.6 : 0.28, i % 4 === 0 ? 0.85 : 1.2);
    // the chant: two bars of the hymn, sung in octaves, brass doubling the line
    if (bar % 4 < 2) {
      const half = (bar % 4) * 4;
      let k = 0;
      for (const [m, len] of DIES) {
        if (k >= half && k < half + 4) {
          I.choir(d, t + (k - half) * b, [m - 12, m], len * b * 0.92, 0.13, 'a', 0.06, 0.3);
          I.brass(d, t + (k - half) * b, [m - 12], len * b * 0.9, 0.08);
        }
        k += len;
      }
    } else if (bar % 2 === 0) {
      I.choir(d, t, up(ch, 0).concat(ch[0] - 12), b * 8, 0.1, 'o', 0.3);
      I.brass(d, t, up(ch, 0), b * 0.6, 0.18);
      I.brass(d, t + b * 1.5, up(ch, 0), b * 0.4, 0.14);
    }
  }
}

// --- tavern: a 6/8 jig for hurdy-gurdy and flute, lute and hand drum. D dorian, a bit tipsy.
const JIG = [
  [62, 1], [64, 1], [65, 1], [69, 2], [65, 1], [67, 1], [65, 1], [64, 1], [62, 2], [57, 1],
  [62, 1], [64, 1], [65, 1], [67, 1], [69, 1], [71, 1], [72, 2], [71, 1], [69, 3],
  [72, 1], [71, 1], [69, 1], [67, 2], [65, 1], [64, 1], [65, 1], [67, 1], [69, 2], [65, 1],
  [64, 1], [62, 1], [60, 1], [62, 1], [64, 1], [61, 1], [62, 3], [0, 3],
];
class TavernPiece extends Piece {
  // six eighth-notes per bar; `beat` is the eighth note here
  constructor(dir) { super(dir, { bpm: 300, beats: 6, verb: 0.3, level: 1 }); }
  onBegin() { this.prog = [CH.Dm, CH.Dm, CH.C, CH.Am, CH.Dm, CH.G, CH.C, CH.Dm]; this.pos = 0; }
  play(t, bar) {
    const I = this.ins, d = this.dest, e = this.beat;
    const ch = this.prog[bar % 8];
    if (bar % 8 === 0) I.drone(d, t, 38, this.barDur * 8, 0.05, 700);
    I.frame(d, t, 0.22, 180);
    I.frame(d, t + e * 3, 0.15, 210);
    if (rnd() < 0.5) I.frame(d, t + e * 5, 0.08, 240);
    I.strum(d, t, up(ch, 0), 0.1, 0.02);
    I.strum(d, t + e * 3, up(ch, 0), 0.07, 0.02);
    // melody, eighth by eighth; the flute doubles on the repeat
    const doubled = Math.floor(bar / 8) % 2 === 1;
    let k = 0;
    while (k < 6) {
      const [m, len] = JIG[this.pos % JIG.length];
      if (m) {
        I.hurdy(d, t + k * e, m, len * e * 0.9, 0.05);
        if (doubled) I.flute(d, t + k * e, m + 12, len * e * 0.85, 0.035);
      }
      k += len;
      this.pos++;
    }
  }
}

// --- awe: near the giants, a deep male choir and sub-bass, very slow. Layers over the rest.
class AwePiece extends Piece {
  constructor(dir) { super(dir, { bpm: 40, verb: 0.9, level: 0.7 }); }
  play(t, bar) {
    const I = this.ins, d = this.dest, B = this.barDur;
    const ch = bar % 2 === 0 ? [38, 45, 50, 53] : [34, 41, 46, 50];
    I.choir(d, t, ch, B * 1.02, 0.12, 'u', 2.5);
    I.drone(d, t, 26, B, 0.08, 180);
    if (bar % 2 === 1) I.bell(d, t + B * 0.5, 38, 0.06, 8);
  }
}

// ------------------------------------------------------------------------------------------------
// a recorded track standing in for a piece (see the header)
class FilePiece extends Piece {
  constructor(dir, buffer) { super(dir, { bpm: 60, verb: 0, level: 1 }); this.buffer = buffer; }
  get barDur() { return this.buffer.duration - 2; }
  play(t) {
    const ctx = this.dir.ctx, s = ctx.createBufferSource();
    s.buffer = this.buffer;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1, t + 2);
    g.gain.setValueAtTime(1, t + this.buffer.duration - 2);
    g.gain.linearRampToValueAtTime(0.0001, t + this.buffer.duration);
    s.connect(g).connect(this.dest);
    s.start(t);
  }
}

export class MusicDirector {
  constructor(audio) {
    this.audio = audio;
    const ctx = (this.ctx = audio.ctx);
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.9;
    this.bus.connect(audio.musicIn);
    this.verb = ctx.createConvolver();
    this.verb.buffer = makeImpulse(ctx, 4.8, 2.6, { predelay: 0.04, bright: 0.45 });
    const vg = ctx.createGain(); vg.gain.value = 0.8;
    this.verb.connect(vg).connect(audio.musicIn);
    this.ins = new Instruments(ctx, audio.noise);
    this.pieces = {
      night: new NightPiece(this), day: new DayPiece(this), combat: new CombatPiece(this),
      boss: new BossPiece(this), tavern: new TavernPiece(this), awe: new AwePiece(this),
    };
  }

  // optional recorded replacements from audio/bgm/tracks.json
  async loadOverrides(base = 'audio/bgm/') {
    let list;
    try { list = await (await fetch(base + 'tracks.json')).json(); } catch { return; }
    for (const [name, file] of Object.entries(list || {})) {
      if (!this.pieces[name] || typeof file !== 'string') continue;
      try {
        const buf = await this.ctx.decodeAudioData(await (await fetch(base + file)).arrayBuffer());
        const old = this.pieces[name];
        const p = new FilePiece(this, buf);
        p.target = old.target;
        this.pieces[name] = p;
        old.out.gain.setTargetAtTime(0, this.audio.now, 0.5);
      } catch (e) { console.warn('bgm override failed', name, e); }
    }
  }

  // levels: { night, day, combat, boss, tavern, awe } each 0..1; anything missing fades out.
  // opts: intensity (combat), muffle (tavern heard from outside), fade (seconds)
  mix(levels, { intensity = 0, muffle = 0, fade = 2 } = {}) {
    const now = this.audio.now;
    for (const [name, p] of Object.entries(this.pieces)) {
      const target = Math.min(1, Math.max(0, levels[name] || 0));
      p.intensity = intensity;
      if (name === 'tavern') p.filter.frequency.setTargetAtTime(muffle > 0.5 ? 650 : 20000, now, 0.4);
      if (Math.abs(target - p.target) < 0.02) continue;
      // combat crashes in fast, fades out slowly; everything else drifts
      const tau = name === 'combat' || name === 'boss' ? (target > p.target ? 0.15 : fade * 1.2) : fade / 2;
      p.target = target;
      p.out.gain.setTargetAtTime(Math.max(0.0001, target * p.mixLevel), now, tau);
      if (target > 0 && !p.active) p.begin(now + 0.06);
      if (target === 0) p.stopAt = now + tau * 6;
    }
  }

  update(lookahead = 1.2) {
    const now = this.audio.now;
    for (const p of Object.values(this.pieces)) {
      if (!p.active) continue;
      if (p.target === 0 && now > p.stopAt) { p.active = false; continue; }
      p.schedule(now + lookahead);
    }
  }

  // Where the loudest piece is in its beat, for the Bellwright. `latency` shifts the clock back so
  // the beat matches what is actually coming out of the speakers. Recorded tracks have no grid.
  beat(latency = 0) {
    let best = null;
    for (const [name, p] of Object.entries(this.pieces)) {
      if (!p.active || name === 'awe' || p instanceof FilePiece) continue;
      if (p.target > (best?.target ?? 0.05)) best = p;
    }
    if (!best) return null;
    const period = best instanceof TavernPiece ? best.beat * 3 : best.beat;   // the jig is felt in dotted quarters
    const x = (this.audio.now - latency - best.next) / period;
    return { phase: x - Math.floor(x), period };
  }

  // one-off cues on top of everything
  sting(kind) {
    const I = this.ins, d = this.bus, t = this.audio.now + 0.02;
    if (kind === 'death') {
      I.gong(this.verb, t, 0.4, 55);
      I.choir(d, t + 0.3, [38, 41, 45, 50], 4.5, 0.14, 'u', 1);
      I.cello(d, t + 0.5, 38, 2, 0.15); I.cello(d, t + 2.5, 37, 2.5, 0.15);
    }
    if (kind === 'victory') {
      I.choir(d, t, [50, 54, 57, 62], 6, 0.14, 'a', 0.8);       // the Picardy third: D major at last
      [74, 78, 81, 86].forEach((m, i) => I.bell(d, t + i * 0.35, m, 0.08, 6));
      I.taiko(d, t, 0.5, 0.8);
    }
    if (kind === 'discover') {
      I.choir(d, t, [50, 57, 62, 65], 4, 0.1, 'o', 0.8);
      I.bell(d, t + 0.4, 81, 0.06, 6);
    }
  }
}
