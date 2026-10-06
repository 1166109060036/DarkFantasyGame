// Everything is synthesised with WebAudio: rain, wind, thunder, footsteps, sword, creatures.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.volume = 0.8;
  }

  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);

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
    rainSrc.connect(hp).connect(lp).connect(this.rainGain).connect(this.master);

    // low wind with a slow swell
    const windSrc = this.loopNoise();
    const wl = ctx.createBiquadFilter(); wl.type = 'lowpass'; wl.frequency.value = 320; wl.Q.value = 2;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0.12;
    windSrc.connect(wl).connect(this.windGain).connect(this.master);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 140;
    lfo.connect(lfoG).connect(wl.frequency); lfo.start();

    // eerie drone
    for (const f of [55, 82.4, 110.3]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = 0.018;
      o.connect(g).connect(this.master); o.start();
    }
  }

  loopNoise() {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise; s.loop = true; s.start();
    return s;
  }

  // ---------------------------------------------------------------- menu music
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
    bus.connect(this.master);
    const m = (this.music = { bus, sources: new Set(), timer: 0 });
    const dur = this.musicBuf.duration, step = dur - overlap;
    let next = ctx.currentTime + 0.05;
    const schedule = () => {
      if (this.music !== m) return;
      // keep two plays queued ahead of the clock
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

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  setRain(i) {
    if (this.rainGain) this.rainGain.gain.setTargetAtTime(0.03 + i * 0.16, this.ctx.currentTime, 0.5);
  }

  burst({ dur = 0.2, freq = 1000, q = 1, type = 'bandpass', gain = 0.3, sweep = 0, delay = 0 }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  tone({ freq = 440, dur = 0.3, type = 'sine', gain = 0.2, slide = 1, delay = 0, vibrato = 0 }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    if (vibrato) {
      const l = ctx.createOscillator(); l.frequency.value = vibrato;
      const lg = ctx.createGain(); lg.gain.value = freq * 0.06;
      l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  step(wet) { this.burst(wet ? { dur: 0.22, freq: 900, q: 0.8, gain: 0.12, sweep: 0.5 } : { dur: 0.09, freq: 300, q: 1.2, gain: 0.12 }); }
  swing(heavy = false) {
    this.burst(heavy ? { dur: 0.45, freq: 1500, q: 1.2, gain: 0.26, sweep: 0.25 } : { dur: 0.25, freq: 2400, q: 1.5, gain: 0.18, sweep: 0.3 });
  }
  hit(heavy = false) {
    this.burst({ dur: heavy ? 0.3 : 0.18, freq: heavy ? 700 : 1600, q: heavy ? 2 : 6, gain: heavy ? 0.45 : 0.3 });
    this.tone({ freq: heavy ? 180 : 880, dur: 0.25, type: heavy ? 'square' : 'triangle', gain: heavy ? 0.1 : 0.08, slide: 0.6 });
  }
  parry() {
    this.tone({ freq: 1900, dur: 0.6, type: 'square', gain: 0.07, slide: 0.97 });
    this.tone({ freq: 2850, dur: 0.45, type: 'triangle', gain: 0.08, slide: 0.98 });
    this.burst({ dur: 0.12, freq: 4200, q: 3, gain: 0.35 });
  }
  block() { this.burst({ dur: 0.16, freq: 500, q: 1.5, gain: 0.4 }); this.tone({ freq: 220, dur: 0.15, type: 'square', gain: 0.06, slide: 0.7 }); }
  dodge() { this.burst({ dur: 0.3, freq: 900, q: 0.8, gain: 0.16, sweep: 0.4 }); }
  charge() { this.tone({ freq: 330, dur: 0.35, type: 'triangle', gain: 0.06, slide: 1.6 }); }
  slam() { this.burst({ dur: 1.4, freq: 120, q: 0.6, type: 'lowpass', gain: 0.6 }); this.burst({ dur: 0.3, freq: 600, q: 1, gain: 0.3 }); }
  // per-enemy voice: 'aggro' when they notice you, 'windup' as the attack tell
  enemyCue(type, kind) {
    const w = kind === 'windup';
    if (type === 'wisp') this.tone({ freq: w ? 760 : 520, dur: w ? 0.5 : 1.0, type: 'sine', gain: 0.05, vibrato: 7, slide: w ? 1.8 : 1 });
    if (type === 'straw') { this.burst({ dur: 0.3, freq: 3500, q: 0.7, gain: 0.14 }); if (w) this.tone({ freq: 140, dur: 0.5, type: 'sawtooth', gain: 0.06, slide: 1.5 }); }
    if (type === 'wolf') this.tone({ freq: w ? 160 : 110, dur: w ? 0.45 : 0.8, type: 'sawtooth', gain: 0.09, vibrato: 18, slide: w ? 1.4 : 0.9 });
    if (type === 'leech') { this.burst({ dur: 0.6, freq: 260, q: 4, gain: 0.2, sweep: 1.8 }); if (w) this.tone({ freq: 90, dur: 0.6, type: 'sine', gain: 0.12, vibrato: 12 }); }
    if (type === 'knight') { this.burst({ dur: w ? 0.9 : 1.5, freq: 160, q: 0.8, type: 'lowpass', gain: 0.35 }); if (w) this.tone({ freq: 70, dur: 1.0, type: 'sawtooth', gain: 0.08, slide: 1.3 }); }
  }
  enemyDie(type) {
    if (type === 'wisp') { this.tone({ freq: 900, dur: 0.6, type: 'sine', gain: 0.15, slide: 2.5 }); this.burst({ dur: 0.5, freq: 3000, q: 3, gain: 0.1, sweep: 0.3 }); return; }
    if (type === 'wolf') this.tone({ freq: 520, dur: 0.6, type: 'sawtooth', gain: 0.07, slide: 0.5, vibrato: 9 });
    if (type === 'knight') { this.slam(); this.tone({ freq: 55, dur: 2.5, type: 'sawtooth', gain: 0.1, slide: 0.6 }); }
    this.burst({ dur: 0.5, freq: type === 'straw' ? 3000 : 400, q: 0.8, gain: 0.25, sweep: 0.5 });
  }
  hurt() { this.tone({ freq: 140, dur: 0.3, type: 'sawtooth', gain: 0.12, slide: 0.5 }); this.burst({ dur: 0.2, freq: 400, gain: 0.2 }); }
  coin() { this.tone({ freq: 1320, dur: 0.12, type: 'square', gain: 0.05 }); this.tone({ freq: 1760, dur: 0.25, type: 'square', gain: 0.05, delay: 0.08 }); }
  bleat() { this.tone({ freq: 380 + Math.random() * 80, dur: 0.55, type: 'sawtooth', gain: 0.05, vibrato: 11, slide: 0.85 }); }
  caw() {
    this.burst({ dur: 0.28, freq: 1200, q: 4, gain: 0.25, sweep: 0.7 });
    this.burst({ dur: 0.3, freq: 1100, q: 4, gain: 0.2, sweep: 0.6, delay: 0.35 });
  }
  croak() { this.tone({ freq: 95, dur: 0.35, type: 'square', gain: 0.07, slide: 0.8, vibrato: 30 }); }
  chime() { [660, 880, 1320, 1760].forEach((f, i) => this.tone({ freq: f, dur: 1.4, type: 'sine', gain: 0.07, delay: i * 0.12 })); }
  drink() { for (let i = 0; i < 4; i++) this.tone({ freq: 300 + i * 40, dur: 0.12, type: 'sine', gain: 0.1, delay: i * 0.13, slide: 1.4 }); }
  thunder(delay) {
    this.burst({ dur: 3.2, freq: 140, q: 0.6, type: 'lowpass', gain: 0.55, delay });
    this.burst({ dur: 1.2, freq: 300, q: 0.5, type: 'lowpass', gain: 0.3, delay: delay + 0.1 });
  }
  discover() {
    [196, 294, 392].forEach((f, i) => this.tone({ freq: f, dur: 2.4, type: 'triangle', gain: 0.06, delay: i * 0.18 }));
    this.tone({ freq: 98, dur: 3, type: 'sine', gain: 0.1 });
  }
  pickup(kind) {
    if (kind === 'treasure') { this.coin(); this.tone({ freq: 2200, dur: 0.4, type: 'triangle', gain: 0.05, delay: 0.15 }); return; }
    this.tone({ freq: kind === 'use' ? 660 : 520, dur: 0.12, type: 'triangle', gain: 0.08 });
    this.tone({ freq: kind === 'use' ? 990 : 780, dur: 0.18, type: 'triangle', gain: 0.07, delay: 0.07 });
  }
  harvest(type) {
    if (type === 'ore') { [0, 0.18, 0.36].forEach((d) => { this.burst({ dur: 0.08, freq: 2600, q: 8, gain: 0.3, delay: d }); this.tone({ freq: 1400, dur: 0.15, type: 'square', gain: 0.04, delay: d }); }); return; }
    this.burst({ dur: 0.25, freq: 1800, q: 1, gain: 0.12, sweep: 0.6 });
  }
  chest() { this.burst({ dur: 0.5, freq: 300, q: 3, gain: 0.25, sweep: 1.6 }); this.chime(); }
  brew() { for (let i = 0; i < 6; i++) this.tone({ freq: 200 + Math.random() * 300, dur: 0.15, type: 'sine', gain: 0.08, delay: i * 0.09, slide: 1.8 }); }
  anvil() { [0, 0.3, 0.6].forEach((d) => { this.tone({ freq: 1760, dur: 0.6, type: 'triangle', gain: 0.09, delay: d, slide: 0.99 }); this.burst({ dur: 0.06, freq: 3500, q: 6, gain: 0.3, delay: d }); }); }
  ui() { this.tone({ freq: 520, dur: 0.08, type: 'triangle', gain: 0.06 }); }
}
