// Day/night cycle. t: 0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk.
// Night is cold moonlight; dawn/dusk bleed rose-violet; day is a drained, overcast, sickly grey-green
// gloom where the sun never quite breaks through.
import * as THREE from 'three';

const NIGHT = {
  fog: [0.05, 0.1, 0.27], density: 0.0115, zenith: [0.008, 0.02, 0.09],
  cloudDark: [0.03, 0.07, 0.25], cloudLit: [0.35, 0.55, 1.0],
  hemiSky: [0.42, 0.53, 0.88], hemiGround: [0.06, 0.14, 0.11], hemiI: 2.2,
  light: [0.71, 0.78, 1.0], lightI: 2.4,
  stars: 1, aurora: 1, vortex: 1, day: 0, lantern: 1, cloud: 0, bloom: 1, sun: 0,
};
const DAWN = {
  fog: [0.17, 0.11, 0.2], density: 0.013, zenith: [0.06, 0.05, 0.14],
  cloudDark: [0.16, 0.08, 0.18], cloudLit: [0.85, 0.45, 0.55],
  hemiSky: [0.5, 0.38, 0.55], hemiGround: [0.1, 0.1, 0.09], hemiI: 2.2,
  light: [1.0, 0.62, 0.6], lightI: 1.6,
  stars: 0.15, aurora: 0, vortex: 0.8, day: 0.45, lantern: 0.6, cloud: 0.2, bloom: 0.9, sun: 0.7,
};
const DAY = {
  fog: [0.26, 0.29, 0.29], density: 0.0135, zenith: [0.2, 0.23, 0.24],
  cloudDark: [0.22, 0.24, 0.25], cloudLit: [0.48, 0.5, 0.5],
  hemiSky: [0.62, 0.66, 0.66], hemiGround: [0.13, 0.15, 0.11], hemiI: 2.3,
  light: [0.86, 0.88, 0.82], lightI: 1.3,
  stars: 0, aurora: 0, vortex: 0.3, day: 1, lantern: 0.25, cloud: 0.55, bloom: 0.55, sun: 1,
};
const DUSK = {
  fog: [0.2, 0.08, 0.18], density: 0.0125, zenith: [0.06, 0.025, 0.11],
  cloudDark: [0.2, 0.05, 0.16], cloudLit: [1.0, 0.38, 0.5],
  hemiSky: [0.55, 0.32, 0.55], hemiGround: [0.1, 0.07, 0.09], hemiI: 2.0,
  light: [1.0, 0.48, 0.5], lightI: 1.5,
  stars: 0.3, aurora: 0.2, vortex: 1, day: 0.4, lantern: 0.8, cloud: 0.15, bloom: 1, sun: 0.7,
};

const KEYS = [
  [0.0, NIGHT], [0.2, NIGHT], [0.27, DAWN], [0.35, DAY], [0.65, DAY], [0.73, DUSK], [0.8, NIGHT], [1.0, NIGHT],
];

function blend(a, b, k) {
  const out = {};
  for (const key in a) {
    const va = a[key], vb = b[key];
    out[key] = Array.isArray(va) ? va.map((v, i) => v + (vb[i] - v) * k) : va + (vb - va) * k;
  }
  return out;
}

export const PHASES = [
  [0.2, 'กลางคืน'], [0.3, 'รุ่งสาง'], [0.7, 'กลางวัน'], [0.8, 'สนธยา'], [1.01, 'กลางคืน'],
];

export class DayNight {
  constructor(lengthSeconds = 900, t = 0.9) {
    this.length = lengthSeconds;
    this.t = t;
    this.sunDir = new THREE.Vector3();
    this.lightDir = new THREE.Vector3();
    this.update(0);
  }

  update(dt) {
    this.t = (this.t + dt / this.length) % 1;
    let i = 0;
    while (i < KEYS.length - 2 && this.t >= KEYS[i + 1][0]) i++;
    const [t0, a] = KEYS[i], [t1, b] = KEYS[i + 1];
    const k = (this.t - t0) / (t1 - t0);
    this.p = blend(a, b, k * k * (3 - 2 * k));

    const phi = (this.t - 0.25) * Math.PI * 2;
    this.sunDir.set(Math.cos(phi), Math.max(Math.sin(phi), -0.15) * 0.6, 0.35).normalize();
    return this.p;
  }

  // moonlight at night, a low veiled sun by day
  lightDirection(moonDir) {
    return this.lightDir.copy(moonDir).multiplyScalar(1 - this.p.sun).addScaledVector(this.sunDir, this.p.sun).normalize();
  }

  get isNight() { return this.p.day < 0.35; }

  get hours() { return this.t * 24; }

  get phaseName() { return PHASES.find(([end]) => this.t < end)[1]; }

  clockText() {
    const h = Math.floor(this.hours), m = Math.floor((this.hours - h) * 60);
    return `${this.p.day > 0.5 ? '☀' : '☾'} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} · ${this.phaseName}`;
  }
}
