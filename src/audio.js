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
  swing() { this.burst({ dur: 0.25, freq: 2400, q: 1.5, gain: 0.18, sweep: 0.3 }); }
  hit() { this.burst({ dur: 0.18, freq: 1600, q: 6, gain: 0.3 }); this.tone({ freq: 880, dur: 0.25, type: 'triangle', gain: 0.08, slide: 0.6 }); }
  hurt() { this.tone({ freq: 140, dur: 0.3, type: 'sawtooth', gain: 0.12, slide: 0.5 }); this.burst({ dur: 0.2, freq: 400, gain: 0.2 }); }
  coin() { this.tone({ freq: 1320, dur: 0.12, type: 'square', gain: 0.05 }); this.tone({ freq: 1760, dur: 0.25, type: 'square', gain: 0.05, delay: 0.08 }); }
  wispDie() { this.tone({ freq: 900, dur: 0.6, type: 'sine', gain: 0.15, slide: 2.5 }); this.burst({ dur: 0.5, freq: 3000, q: 3, gain: 0.1, sweep: 0.3 }); }
  wispHum() { this.tone({ freq: 520 + Math.random() * 200, dur: 1.2, type: 'sine', gain: 0.03, vibrato: 7 }); }
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
  ui() { this.tone({ freq: 520, dur: 0.08, type: 'triangle', gain: 0.06 }); }
}
