// Sound engine. Everything is synthesised with WebAudio - there are no sound files except the
// optional menu track. Signal flow:
//
//   sfx ──┬────────────────────────► sfxBus ──┐
//         └─(send)► room / hall reverb ───────┤
//   ambience beds & one-shots ───► ambBus ────┼──► master ──► speakers
//   music (src/music.js) ────────► musicBus ──┘
//
// Sounds that come from somewhere in the world (enemies, fires, waterfalls) go through a 3D
// panner so you can hear where they are.

// Exponentially decaying stereo noise: a cheap, convincing impulse response.
export function makeImpulse(ctx, seconds, decay, { predelay = 0.01, bright = 1 } = {}) {
  const rate = ctx.sampleRate, len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / rate;
      if (t < predelay) continue;
      const n = Math.random() * 2 - 1;
      lp += (n - lp) * Math.min(1, bright * (1 - t / seconds) + 0.05);   // darker as it decays
      d[i] = lp * Math.pow(1 - t / seconds, decay);
    }
  }
  return buf;
}

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.volume = 0.8;
    this.sfxVolume = 0.9;
    this.musicVolume = 0.7;
    this.timeOffset = 0;
  }

  // ctx is optional: tests pass an OfflineAudioContext to render sounds to a file
  init(ctx = null) {
    if (this.ctx) { this.ctx.resume?.(); return; }
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    // gentle limiter so stacked hits never clip
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);

    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.sfxVolume; this.sfxBus.connect(this.master);
    this.ambBus = ctx.createGain(); this.ambBus.gain.value = this.sfxVolume; this.ambBus.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.musicVolume; this.musicBus.connect(this.master);
    // music ducks and muffles behind menus
    this.musicFilter = ctx.createBiquadFilter(); this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 20000;
    this.musicIn = ctx.createGain();
    this.musicIn.connect(this.musicFilter).connect(this.musicBus);

    // two reverbs; the environment decides how much of each the effects get
    this.room = ctx.createConvolver(); this.room.buffer = makeImpulse(ctx, 0.9, 3, { bright: 0.6 });
    this.hall = ctx.createConvolver(); this.hall.buffer = makeImpulse(ctx, 3.4, 2.2, { predelay: 0.03, bright: 0.35 });
    this.roomSend = ctx.createGain(); this.roomSend.gain.value = 0;
    this.hallSend = ctx.createGain(); this.hallSend.gain.value = 0.12;
    this.verbIn = ctx.createGain();
    this.verbIn.connect(this.roomSend).connect(this.room).connect(this.sfxBus);
    this.verbIn.connect(this.hallSend).connect(this.hall).connect(this.sfxBus);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // rain bed
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    const rainSrc = this.loopNoise();
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 600;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
    rainSrc.connect(hp).connect(lp).connect(this.rainGain).connect(this.ambBus);

    // wind with a slow swell; louder in exposed places (set by the ambience)
    const windSrc = this.loopNoise();
    this.windFilter = ctx.createBiquadFilter(); this.windFilter.type = 'lowpass'; this.windFilter.frequency.value = 320; this.windFilter.Q.value = 2;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0.1;
    windSrc.connect(this.windFilter).connect(this.windGain).connect(this.ambBus);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 140;
    lfo.connect(lfoG).connect(this.windFilter.frequency); lfo.start();
  }

  get now() { return this.ctx.currentTime + this.timeOffset; }

  // run fn with every sound it makes shifted to `time` seconds from now (used to lay out previews)
  at(time, fn) { const o = this.timeOffset; this.timeOffset = time; try { fn(); } finally { this.timeOffset = o; } }

  loopNoise() {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise; s.loop = true; s.start();
    return s;
  }

  // ---------------------------------------------------------------- routing
  // destination for a one-shot: optionally positioned in the world, optionally into the reverb
  out({ pos = null, verb = 0.25, bus = null } = {}) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    let node = g;
    if (pos) {
      const p = ctx.createPanner();
      p.panningModel = 'equalpower'; p.distanceModel = 'inverse';
      p.refDistance = 2.5; p.rolloffFactor = 1.1; p.maxDistance = 120;
      p.positionX.value = pos.x; p.positionY.value = pos.y + 1; p.positionZ.value = pos.z;
      g.connect(p);
      node = p;
    }
    node.connect(bus || this.sfxBus);
    if (verb > 0) {
      const s = ctx.createGain(); s.gain.value = verb;
      node.connect(s).connect(this.verbIn);
    }
    return g;
  }

  updateListener(camera) {
    if (!this.ctx) return;
    const L = this.ctx.listener, p = camera.position, t = this.ctx.currentTime;
    const f = camera.getWorldDirection(this._fwd || (this._fwd = p.clone()));
    if (L.positionX) {
      L.positionX.setTargetAtTime(p.x, t, 0.02); L.positionY.setTargetAtTime(p.y, t, 0.02); L.positionZ.setTargetAtTime(p.z, t, 0.02);
      L.forwardX.setTargetAtTime(f.x, t, 0.02); L.forwardY.setTargetAtTime(f.y, t, 0.02); L.forwardZ.setTargetAtTime(f.z, t, 0.02);
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else {
      L.setPosition(p.x, p.y, p.z);
      L.setOrientation(f.x, f.y, f.z, 0, 1, 0);
    }
  }

  // 'outdoor' | 'room' | 'hall'
  setEnvironment(env) {
    if (!this.ctx || this.env === env) return;
    this.env = env;
    const t = this.ctx.currentTime;
    const [room, hall] = { outdoor: [0, 0.12], room: [0.55, 0.05], hall: [0.05, 0.6] }[env];
    this.roomSend.gain.setTargetAtTime(room, t, 0.6);
    this.hallSend.gain.setTargetAtTime(hall, t, 0.6);
  }

  setWind(level) {
    if (this.windGain) this.windGain.gain.setTargetAtTime(level, this.ctx.currentTime, 1.5);
  }

  // muffle the score while a menu, the bag or the pause screen is up
  duckMusic(on) {
    if (!this.ctx || this._duck === on) return;
    this._duck = on;
    const t = this.ctx.currentTime;
    this.musicFilter.frequency.setTargetAtTime(on ? 700 : 20000, t, 0.25);
    this.musicIn.gain.setTargetAtTime(on ? 0.55 : 1, t, 0.25);
  }

  // ---------------------------------------------------------------- menu music (the uploaded track)
  // The clip is short, so it loops by overlapping copies with a crossfade instead of a hard cut.
  async playMusic(url, { volume = 0.7, fade = 2.5, overlap = 2.0 } = {}) {
    this.init();
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (!this.musicBuf) {
      try {
        const res = await fetch(url);
        this.musicBuf = await ctx.decodeAudioData(await res.arrayBuffer());
      } catch (e) {
        console.warn('menu music failed to load', e);
        return;
      }
    }
    if (this.music) return;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + fade);
    bus.connect(this.musicBus);
    const m = (this.music = { bus, sources: new Set(), timer: 0 });
    const dur = this.musicBuf.duration, step = dur - overlap;
    let next = ctx.currentTime + 0.05;
    const schedule = () => {
      if (this.music !== m) return;
      while (next < ctx.currentTime + dur) {
        const src = ctx.createBufferSource();
        src.buffer = this.musicBuf;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, next);
        g.gain.linearRampToValueAtTime(1, next + overlap);
        g.gain.setValueAtTime(1, next + dur - overlap);
        g.gain.linearRampToValueAtTime(0.0001, next + dur);
        src.connect(g).connect(bus);
        src.start(next);
        src.stop(next + dur + 0.05);
        m.sources.add(src);
        src.onended = () => m.sources.delete(src);
        next += step;
      }
      m.timer = setTimeout(schedule, 1000);
    };
    schedule();
  }

  stopMusic(fade = 1.5) {
    const m = this.music;
    if (!m) return;
    this.music = null;
    clearTimeout(m.timer);
    const t = this.ctx.currentTime;
    m.bus.gain.cancelScheduledValues(t);
    m.bus.gain.setValueAtTime(Math.max(m.bus.gain.value, 0.0001), t);
    m.bus.gain.exponentialRampToValueAtTime(0.0001, t + fade);
    setTimeout(() => { m.sources.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } }); m.bus.disconnect(); }, fade * 1000 + 100);
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
  setSfxVolume(v) { this.sfxVolume = v; if (this.sfxBus) { this.sfxBus.gain.value = v; this.ambBus.gain.value = v; } }
  setMusicVolume(v) { this.musicVolume = v; if (this.musicBus) this.musicBus.gain.value = v; }

  setRain(i) {
    if (this.rainGain) this.rainGain.gain.setTargetAtTime(0.03 + i * 0.16, this.ctx.currentTime, 0.5);
  }

  // ---------------------------------------------------------------- primitives
  burst({ dur = 0.2, freq = 1000, q = 1, type = 'bandpass', gain = 0.3, sweep = 0, delay = 0, attack = 0, pos = null, verb = 0.25, bus = null }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.now + delay;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.max(attack, Math.min(0.02, dur * 0.2)));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.out({ pos, verb, bus }));
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  tone({ freq = 440, dur = 0.3, type = 'sine', gain = 0.2, slide = 1, delay = 0, vibrato = 0, vibDepth = 0.06, attack = 0.02, pos = null, verb = 0.25, bus = null }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.now + delay;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    if (vibrato) {
      const l = ctx.createOscillator(); l.frequency.value = vibrato;
      const lg = ctx.createGain(); lg.gain.value = freq * vibDepth;
      l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out({ pos, verb, bus }));
    o.start(t); o.stop(t + dur + 0.05);
  }

  // inharmonic partials: metal ringing (clangs, blades, bells)
  metal({ freq = 800, dur = 0.8, gain = 0.1, delay = 0, partials = [1, 2.76, 5.4, 8.93], pos = null, verb = 0.4 }) {
    partials.forEach((m, i) => this.tone({ freq: freq * m, dur: dur / (1 + i * 0.5), type: 'sine', gain: gain / (1 + i * 0.7), delay, attack: 0.003, pos, verb }));
  }

  // pitched thump: drops in pitch like a body hitting the ground or a drum
  thump({ freq = 120, dur = 0.3, gain = 0.4, delay = 0, drop = 0.4, pos = null, verb = 0.2 }) {
    this.tone({ freq, dur, type: 'sine', gain, slide: drop, delay, attack: 0.004, pos, verb });
  }

  // a voiced cry: buzzy source through a mouth-like resonance, for creatures
  voice({ freq = 300, dur = 0.6, gain = 0.1, slide = 1, formant = 1200, q = 4, vibrato = 7, delay = 0, pos = null, verb = 0.35, type = 'sawtooth' }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.now + delay;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    const l = ctx.createOscillator(); l.frequency.value = vibrato;
    const lg = ctx.createGain(); lg.gain.value = freq * 0.04;
    l.connect(lg).connect(o.frequency);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = formant; f.Q.value = q;
    const f2 = ctx.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = formant * 2.4; f2.gain.value = 8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.08, dur * 0.3));
    g.gain.setValueAtTime(gain, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(f2).connect(g).connect(this.out({ pos, verb }));
    o.start(t); o.stop(t + dur + 0.05); l.start(t); l.stop(t + dur + 0.05);
  }

  // ---------------------------------------------------------------- player
  // surface: grass | water | wood | stone
  step(surface = 'grass') {
    const v = 0.85 + Math.random() * 0.3;
    if (surface === 'water' || surface === true) {
      this.burst({ dur: 0.28, freq: 1100 * v, q: 0.9, gain: 0.13, sweep: 0.45, verb: 0.15 });
      this.burst({ dur: 0.12, freq: 300, q: 2, gain: 0.08, delay: 0.03, verb: 0 });
    } else if (surface === 'wood') {
      this.thump({ freq: 140 * v, dur: 0.12, gain: 0.16, drop: 0.7 });
      this.burst({ dur: 0.06, freq: 900 * v, q: 3, gain: 0.08 });
    } else if (surface === 'stone') {
      this.burst({ dur: 0.07, freq: 2200 * v, q: 2.5, gain: 0.1, verb: 0.4 });
      this.thump({ freq: 90, dur: 0.08, gain: 0.08 });
    } else {
      this.burst({ dur: 0.13, freq: 420 * v, q: 0.8, gain: 0.1, verb: 0.05 });
      this.burst({ dur: 0.09, freq: 2600 * v, q: 0.7, gain: 0.035, delay: 0.02, verb: 0 });   // grass rustle
    }
  }

  swing(heavy = false) {
    const v = 0.9 + Math.random() * 0.2;
    if (heavy) {
      this.burst({ dur: 0.5, freq: 700 * v, q: 1.1, gain: 0.3, sweep: 3, attack: 0.12, verb: 0.15 });
      this.burst({ dur: 0.45, freq: 2600 * v, q: 2, gain: 0.12, sweep: 0.4, attack: 0.1, verb: 0.1 });
    } else {
      this.burst({ dur: 0.26, freq: 1400 * v, q: 1.4, gain: 0.22, sweep: 2.4, attack: 0.05, verb: 0.1 });
      this.burst({ dur: 0.2, freq: 4200 * v, q: 3, gain: 0.06, sweep: 0.5, attack: 0.04, verb: 0 });
    }
  }

  // what the blade bites into changes the sound
  hit(heavy = false, type = 'flesh', pos = null) {
    const material = type === 'knight' ? 'stone' : type === 'straw' ? 'straw' : type === 'wisp' ? 'spirit' : 'flesh';
    const k = heavy ? 1.4 : 1;
    if (material === 'stone') {
      this.metal({ freq: 520, dur: 0.9, gain: 0.12 * k, partials: [1, 2.31, 3.9, 6.2], pos, verb: 0.5 });
      this.burst({ dur: 0.18, freq: 3000, q: 1, gain: 0.3 * k, pos });
      this.thump({ freq: 80, dur: 0.25, gain: 0.25 * k, pos });
    } else if (material === 'straw') {
      this.burst({ dur: 0.25, freq: 3200, q: 0.6, gain: 0.25 * k, sweep: 0.6, pos });
      this.thump({ freq: 160, dur: 0.12, gain: 0.15 * k, pos });
    } else if (material === 'spirit') {
      this.tone({ freq: 1400, dur: 0.4, type: 'sine', gain: 0.1, slide: 1.6, pos, verb: 0.6 });
      this.burst({ dur: 0.3, freq: 5000, q: 2, gain: 0.12, sweep: 0.4, pos, verb: 0.5 });
    } else {
      // flesh: a dull thud and a wet tear
      this.thump({ freq: heavy ? 95 : 130, dur: heavy ? 0.3 : 0.18, gain: 0.35 * k, drop: 0.45, pos });
      this.burst({ dur: heavy ? 0.32 : 0.2, freq: 850, q: 2.2, gain: 0.26 * k, sweep: 0.5, pos });
      this.burst({ dur: 0.12, freq: 2400, q: 4, gain: 0.08 * k, delay: 0.03, sweep: 0.7, pos });
    }
    if (heavy) this.burst({ dur: 0.5, freq: 200, q: 0.7, type: 'lowpass', gain: 0.25, verb: 0.2 });
  }

  parry() {
    this.metal({ freq: 1350, dur: 1.4, gain: 0.13, partials: [1, 1.48, 2.76, 4.1, 5.4], verb: 0.7 });
    this.burst({ dur: 0.12, freq: 4600, q: 2, gain: 0.4 });
    this.tone({ freq: 2700, dur: 1.1, type: 'triangle', gain: 0.05, slide: 0.99, vibrato: 6, vibDepth: 0.004, verb: 0.6 });
  }
  block() {
    this.metal({ freq: 380, dur: 0.4, gain: 0.12, partials: [1, 2.1, 3.7] });
    this.burst({ dur: 0.16, freq: 600, q: 1.3, gain: 0.35 });
    this.thump({ freq: 110, dur: 0.15, gain: 0.2 });
  }
  dodge() {
    this.burst({ dur: 0.32, freq: 700, q: 0.8, gain: 0.16, sweep: 2.2, attack: 0.06, verb: 0.05 });
    this.burst({ dur: 0.18, freq: 260, q: 1, gain: 0.12, delay: 0.24, verb: 0 });           // landing
  }
  charge() { this.tone({ freq: 220, dur: 0.4, type: 'triangle', gain: 0.06, slide: 2, verb: 0.2 }); this.metal({ freq: 2400, dur: 0.5, gain: 0.03, delay: 0.3 }); }
  slam(pos = null) {
    this.thump({ freq: 70, dur: 1.2, gain: 0.6, drop: 0.5, pos, verb: 0.5 });
    this.burst({ dur: 1.4, freq: 140, q: 0.6, type: 'lowpass', gain: 0.55, pos, verb: 0.4 });
    this.burst({ dur: 0.9, freq: 1800, q: 0.5, gain: 0.12, delay: 0.1, sweep: 0.3, pos });    // debris
  }
  hurt() {
    this.voice({ freq: 170, dur: 0.32, gain: 0.12, slide: 0.7, formant: 700, q: 3, vibrato: 0, verb: 0.05 });
    this.thump({ freq: 100, dur: 0.18, gain: 0.25 });
    this.burst({ dur: 0.15, freq: 900, q: 2, gain: 0.15 });
  }

  // ---------------------------------------------------------------- creatures
  // 'aggro' when they notice you, 'windup' as the attack tell; positioned in the world
  enemyCue(type, kind, pos = null) {
    const w = kind === 'windup', P = { pos };
    if (type === 'wisp') { this.tone({ freq: w ? 760 : 520, dur: w ? 0.5 : 1.0, type: 'sine', gain: 0.07, vibrato: 7, slide: w ? 1.8 : 1, verb: 0.7, ...P }); this.tone({ freq: w ? 1140 : 780, dur: 0.8, type: 'sine', gain: 0.03, vibrato: 5, verb: 0.7, ...P }); }
    if (type === 'straw') { this.burst({ dur: 0.35, freq: 3500, q: 0.7, gain: 0.16, ...P }); if (w) this.voice({ freq: 140, dur: 0.5, gain: 0.08, slide: 1.5, formant: 600, ...P }); }
    if (type === 'wolf') {
      if (w) this.voice({ freq: 120, dur: 0.45, gain: 0.14, slide: 1.3, formant: 500, q: 2, vibrato: 25, ...P });
      else this.voice({ freq: 90, dur: 1.0, gain: 0.12, formant: 400, q: 2, vibrato: 30, ...P });          // growl
    }
    if (type === 'leech') { this.burst({ dur: 0.6, freq: 260, q: 4, gain: 0.22, sweep: 1.8, ...P }); if (w) this.voice({ freq: 70, dur: 0.6, gain: 0.12, formant: 300, vibrato: 12, type: 'square', ...P }); }
    if (type === 'gaunt') {
      if (w) this.burst({ dur: 0.4, freq: 4200, q: 1.2, gain: 0.18, sweep: 0.6, ...P });                  // hiss
      else { this.voice({ freq: 420, dur: 0.9, gain: 0.12, slide: 0.45, formant: 1900, q: 5, vibrato: 14, ...P }); this.burst({ dur: 0.8, freq: 2400, q: 3, gain: 0.15, sweep: 0.55, ...P }); }
    }
    if (type === 'crawler') for (let i = 0; i < (w ? 4 : 9); i++) this.burst({ dur: 0.03, freq: 2800 + Math.random() * 1200, q: 9, gain: 0.28, delay: i * 0.06, ...P });
    if (type === 'weeper' && w) { this.voice({ freq: 620, dur: 0.7, gain: 0.14, slide: 1.9, formant: 2400, q: 6, vibrato: 9, ...P }); this.burst({ dur: 0.6, freq: 3200, q: 1.5, gain: 0.25, ...P }); }
    if (type === 'brute') {
      this.voice({ freq: w ? 62 : 48, dur: w ? 1.0 : 1.6, gain: 0.2, vibrato: 4, slide: w ? 1.4 : 0.8, formant: 260, q: 2, ...P });
      this.burst({ dur: 1.0, freq: 220, q: 1, type: 'lowpass', gain: 0.25, ...P });
    }
    if (type === 'knight') {
      this.burst({ dur: w ? 0.9 : 1.5, freq: 160, q: 0.8, type: 'lowpass', gain: 0.35, ...P });
      this.metal({ freq: 180, dur: 1.2, gain: 0.06, partials: [1, 2.4, 3.9], ...P });
      if (w) this.voice({ freq: 70, dur: 1.0, gain: 0.12, slide: 1.3, formant: 280, ...P });
    }
  }

  // the weeper's quiet sobbing, from wherever she is
  sob(pos = null) {
    for (let i = 0; i < 3; i++) this.voice({ freq: 430 - i * 25, dur: 0.45, gain: 0.05, delay: i * 0.5, vibrato: 7, slide: 0.85, formant: 1100, q: 5, type: 'triangle', pos, verb: 0.5 });
    this.burst({ dur: 1.4, freq: 900, q: 2, gain: 0.05, pos, verb: 0.5 });
  }

  // jump-scare sting when you turn and she is right there
  sting() {
    this.tone({ freq: 1180, dur: 1.4, type: 'sawtooth', gain: 0.06, slide: 0.98, vibrato: 30, verb: 0.6 });
    this.tone({ freq: 1250, dur: 1.4, type: 'sawtooth', gain: 0.05, slide: 0.97, verb: 0.6 });
    this.burst({ dur: 0.9, freq: 5000, q: 0.8, gain: 0.18, sweep: 0.4 });
    this.thump({ freq: 55, dur: 1.2, gain: 0.4 });
  }

  enemyDie(type, pos = null) {
    const P = { pos };
    if (type === 'wisp') { this.tone({ freq: 900, dur: 0.8, type: 'sine', gain: 0.15, slide: 2.5, verb: 0.8, ...P }); this.burst({ dur: 0.6, freq: 3000, q: 3, gain: 0.12, sweep: 0.3, ...P }); return; }
    if (type === 'wolf') this.voice({ freq: 520, dur: 0.7, gain: 0.12, slide: 0.5, vibrato: 9, formant: 900, ...P });
    if (type === 'gaunt' || type === 'crawler' || type === 'brute') this.voice({ freq: type === 'brute' ? 90 : 180, dur: 1.0, gain: 0.12, slide: 0.4, vibrato: 20, formant: type === 'brute' ? 300 : 800, ...P });
    if (type === 'weeper') this.voice({ freq: 700, dur: 1.8, gain: 0.1, slide: 0.3, vibrato: 6, formant: 2000, type: 'triangle', ...P });
    if (type === 'knight') { this.slam(pos); this.voice({ freq: 55, dur: 2.5, gain: 0.15, slide: 0.6, formant: 220, ...P }); }
    if (type !== 'straw') this.thump({ freq: 90, dur: 0.4, gain: 0.3, delay: type === 'brute' ? 0.6 : 0.35, ...P });     // the body hits the ground
    this.burst({ dur: 0.5, freq: type === 'straw' ? 3000 : 400, q: 0.8, gain: 0.22, sweep: 0.5, ...P });
  }

  // ---------------------------------------------------------------- world & UI
  coin() { this.metal({ freq: 2100, dur: 0.25, gain: 0.05, partials: [1, 2.4] }); this.metal({ freq: 2650, dur: 0.4, gain: 0.05, partials: [1, 2.4], delay: 0.08 }); }
  bleat(pos = null) { this.voice({ freq: 380 + Math.random() * 80, dur: 0.6, gain: 0.08, vibrato: 11, slide: 0.85, formant: 1300, q: 3, pos }); }
  caw(pos = null) {
    this.voice({ freq: 520, dur: 0.28, gain: 0.12, slide: 0.75, formant: 1500, q: 3, vibrato: 30, pos });
    this.voice({ freq: 480, dur: 0.3, gain: 0.1, slide: 0.7, formant: 1400, q: 3, vibrato: 30, delay: 0.35, pos });
  }
  croak(pos = null) { this.voice({ freq: 95, dur: 0.35, gain: 0.12, slide: 0.8, vibrato: 30, formant: 400, q: 3, type: 'square', pos }); }
  chime() { [660, 880, 1320, 1760].forEach((f, i) => this.metal({ freq: f, dur: 2.2, gain: 0.05, delay: i * 0.12, partials: [1, 2.76, 5.4] })); }
  drink() {
    for (let i = 0; i < 4; i++) this.tone({ freq: 280 + i * 45, dur: 0.12, type: 'sine', gain: 0.1, delay: i * 0.14, slide: 1.5, verb: 0 });
    this.burst({ dur: 0.5, freq: 600, q: 2, gain: 0.05, delay: 0.05, verb: 0 });
    this.tone({ freq: 140, dur: 0.25, type: 'sine', gain: 0.05, delay: 0.62, slide: 0.8, verb: 0 });      // a satisfied breath
  }
  thunder(delay) {
    this.burst({ dur: 0.5, freq: 2500, q: 0.4, gain: 0.25, delay, verb: 0.3 });                           // the crack
    this.burst({ dur: 3.6, freq: 140, q: 0.6, type: 'lowpass', gain: 0.6, delay: delay + 0.05, attack: 0.15, verb: 0.6 });
    this.burst({ dur: 2.2, freq: 320, q: 0.5, type: 'lowpass', gain: 0.3, delay: delay + 0.4, verb: 0.6 });
  }
  discover() {
    [196, 294, 392, 587].forEach((f, i) => this.tone({ freq: f, dur: 3, type: 'triangle', gain: 0.05, delay: i * 0.18, verb: 0.8 }));
    this.thump({ freq: 98, dur: 3, gain: 0.12, drop: 0.98, verb: 0.8 });
  }
  pickup(kind) {
    if (kind === 'treasure') { this.coin(); this.metal({ freq: 1760, dur: 0.9, gain: 0.04, delay: 0.15 }); return; }
    this.burst({ dur: 0.1, freq: 1200, q: 1, gain: 0.08, verb: 0 });                                       // into the bag
    this.tone({ freq: kind === 'use' ? 660 : 520, dur: 0.14, type: 'triangle', gain: 0.07, delay: 0.04 });
  }
  harvest(type) {
    if (type === 'ore') { [0, 0.22, 0.44].forEach((d) => { this.metal({ freq: 1900, dur: 0.3, gain: 0.08, delay: d, partials: [1, 2.3] }); this.burst({ dur: 0.08, freq: 2600, q: 8, gain: 0.3, delay: d }); }); this.burst({ dur: 0.4, freq: 500, q: 0.7, gain: 0.15, delay: 0.5 }); return; }
    this.burst({ dur: 0.3, freq: 1800, q: 1, gain: 0.12, sweep: 0.6, verb: 0.05 });
    this.burst({ dur: 0.08, freq: 600, q: 3, gain: 0.08, delay: 0.25, verb: 0 });                          // stem snaps
  }
  chest() {
    this.voice({ freq: 140, dur: 0.6, gain: 0.08, slide: 1.4, formant: 700, q: 8, vibrato: 18, type: 'square', verb: 0.2 });   // creaking hinge
    this.thump({ freq: 120, dur: 0.2, gain: 0.2, delay: 0.55 });
    this.chime();
  }
  brew() { for (let i = 0; i < 8; i++) this.tone({ freq: 200 + Math.random() * 300, dur: 0.15, type: 'sine', gain: 0.08, delay: i * 0.09, slide: 1.8, verb: 0.3 }); this.burst({ dur: 1.0, freq: 500, q: 1, gain: 0.06 }); }
  anvil() { [0, 0.32, 0.64].forEach((d) => { this.metal({ freq: 1180, dur: 1.0, gain: 0.1, delay: d, partials: [1, 2.71, 4.36, 6.9] }); this.burst({ dur: 0.06, freq: 3500, q: 6, gain: 0.3, delay: d }); }); }
  bagOpen(open = true) {
    this.burst({ dur: 0.18, freq: open ? 700 : 500, q: 1.2, gain: 0.12, sweep: open ? 1.6 : 0.6, verb: 0 });   // leather
    this.metal({ freq: open ? 2600 : 2200, dur: 0.12, gain: 0.03, delay: 0.1, partials: [1, 2.2] });      // buckle
  }
  ui() { this.tone({ freq: 520, dur: 0.08, type: 'triangle', gain: 0.05, verb: 0 }); this.burst({ dur: 0.04, freq: 2000, q: 2, gain: 0.03, verb: 0 }); }
  death() {
    this.metal({ freq: 110, dur: 5, gain: 0.25, partials: [1, 2.02, 2.76, 4.1], verb: 0.8 });             // a funeral gong
    this.thump({ freq: 60, dur: 2, gain: 0.4, drop: 0.7 });
  }
}
