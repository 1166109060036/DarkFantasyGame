// Sky dome, glowing water, rain and lightning.
import * as THREE from 'three';
import { ps2Uniforms, GLSL_NOISE, SNAP_GLSL } from './ps2.js';

export const FOG_COLOR = new THREE.Color(0.05, 0.1, 0.27);
export const MOON_DIR = new THREE.Vector3(0.22, 0.3, -1).normalize();

// Directions are fixed in the sky dome (it follows the camera), so they read as celestial landmarks.
export const VORTEX_DIR = new THREE.Vector3(0.78, 0.62, 0.55).normalize();   // above the floating castle (south-east)
export const BIG_MOON_DIR = new THREE.Vector3(-0.85, 0.1, 0.52).normalize(); // a colossal moon resting on the south-west horizon

export function createSky() {
  const v3 = (r, g, b) => ({ value: new THREE.Color(r, g, b) });
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: ps2Uniforms.uTime,
      uMoonDir: { value: MOON_DIR.clone() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uVortexDir: { value: VORTEX_DIR },
      uBigMoonDir: { value: BIG_MOON_DIR },
      uHorizon: { value: FOG_COLOR.clone() },
      uZenith: v3(0.008, 0.02, 0.09),
      uCloudDark: v3(0.03, 0.07, 0.25),
      uCloudLit: v3(0.35, 0.55, 1.0),
      uFlash: { value: 0 },
      uCloud: { value: 0.6 },
      uDay: { value: 0 },
      uStars: { value: 1 },
      uAurora: { value: 1 },
      uVortex: { value: 1 },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uFlash, uCloud, uDay, uStars, uAurora, uVortex;
      uniform vec3 uMoonDir, uSunDir, uVortexDir, uBigMoonDir, uHorizon, uZenith, uCloudDark, uCloudLit;
      varying vec3 vDir;
      ${GLSL_NOISE}
      void main(){
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        float night = 1.0 - uDay;
        vec3 col = mix(uHorizon, uZenith, pow(h, 0.45));

        // stars
        vec2 sp = floor(d.xz / (d.y + 0.3) * 160.0);
        col += step(0.9965, hash12(sp)) * smoothstep(0.05, 0.4, d.y) * 0.6 * uStars;

        // aurora curtains over the northern cliffs
        if (uAurora > 0.01 && d.z < 0.3) {
          float az = atan(d.x, -d.z);
          float aur = 0.0;
          for (int i = 0; i < 2; i++) {
            float fi = float(i);
            float centre = 0.32 + fi * 0.13 + 0.09 * sin(az * (2.3 + fi) + uTime * 0.05 + fi * 2.0) + 0.05 * (vnoise(vec2(az * 3.0, uTime * 0.07 + fi * 5.0)) - 0.5);
            float dy = d.y - centre;
            float k = dy > 0.0 ? exp(-dy * (5.0 + fi * 3.0)) : exp(-dy * dy * 900.0);
            float rays = 0.45 + 0.55 * vnoise(vec2(az * 38.0 + fi * 13.0, uTime * 0.25));
            aur += k * rays * (0.8 - fi * 0.3);
          }
          aur *= smoothstep(0.3, -0.4, d.z) * smoothstep(0.02, 0.15, d.y);
          col += mix(vec3(0.05, 0.8, 0.55), vec3(0.2, 0.55, 0.95), smoothstep(0.3, 0.6, d.y)) * aur * uAurora;
        }

        // the cosmic vortex: a slowly turning spiral of rose-violet dust (megalophobia in the sky)
        if (uVortex > 0.01) {
          vec3 vu = normalize(cross(uVortexDir, vec3(0.0, 1.0, 0.0)));
          vec3 vv = cross(vu, uVortexDir);
          float facing = dot(d, uVortexDir);
          if (facing > 0.0) {
            vec2 p = vec2(dot(d, vu), dot(d, vv)) / facing;
            float r = length(p);
            float a = atan(p.y, p.x);
            float sw = a + 2.6 * log(r + 0.05) - uTime * 0.02;
            vec2 q = vec2(cos(sw), sin(sw)) * (r * 2.0 + 0.3);
            float arms = 0.5 + 0.5 * sin(sw * 2.0);
            float dust = fbm(q * 2.4 + 3.0) * 0.8 + fbm(q * 6.0) * 0.35;
            float body = (arms * 0.55 + dust * 0.75) * smoothstep(1.25, 0.15, r);
            vec3 vc = mix(vec3(0.35, 0.06, 0.32), vec3(1.0, 0.45, 0.55), smoothstep(0.45, 1.05, body));
            vc = mix(vc, vec3(0.03, 0.01, 0.08), smoothstep(0.16, 0.02, r));      // dark eye
            float amount = smoothstep(0.25, 0.75, body) * smoothstep(1.3, 0.6, r);
            col = mix(col, vc, amount * uVortex);
            col += vec3(0.9, 0.7, 1.0) * step(0.997, hash12(floor(p * 90.0))) * amount * uVortex;
          }
        }

        // colossal moon on the horizon, ghostly in daylight
        float bm = dot(d, uBigMoonDir);
        float bdisc = smoothstep(0.9855, 0.9875, bm);
        if (bdisc > 0.0) {
          vec3 bmLocal = d - uBigMoonDir * bm;
          float crater = fbm(bmLocal.xy * 40.0 + bmLocal.z * 25.0);
          float shade = 0.55 + crater * 0.6;
          vec3 mc = mix(vec3(0.62, 0.7, 0.95), vec3(0.58, 0.6, 0.58), uDay) * shade;
          col = mix(col, mc, bdisc * mix(0.95, 0.35, uDay) * smoothstep(-0.02, 0.03, d.y));
        }
        col += vec3(0.2, 0.3, 0.6) * pow(max(bm, 0.0), 40.0) * 0.4 * night;

        // clouds
        float m = max(dot(d, uMoonDir), 0.0);
        float s = max(dot(d, uSunDir), 0.0);
        float glow = (pow(m, 90.0) * 1.4 + pow(m, 10.0) * 0.35 + pow(m, 3.0) * 0.08) * night;
        float sglow = (pow(s, 30.0) * 0.7 + pow(s, 5.0) * 0.25) * uDay;
        vec2 uv = d.xz / (d.y + 0.12);
        vec2 cuv = vec2(uv.x * 0.55 + uv.y * 0.25, uv.y * 1.4) + vec2(uTime * 0.012, uTime * 0.004);
        float cl = fbm(cuv * 1.2) + fbm(cuv * 3.1 + 7.0) * 0.35;
        float cover = smoothstep(0.62 - uCloud * 0.35, 0.95, cl) * smoothstep(0.0, 0.18, d.y);
        vec3 cc = mix(uCloudDark, uCloudLit, clamp((glow + sglow) * 1.7 + smoothstep(0.7, 1.15, cl) * 0.5, 0.0, 1.0));
        col = mix(col, cc, cover);

        // moon and a sun that never quite breaks through
        float disc = smoothstep(0.99935, 0.99955, m) * night;
        col += vec3(0.9, 0.95, 1.1) * disc * (1.0 - cover * 0.6);
        col += vec3(0.25, 0.4, 1.0) * glow * (1.0 - cover * 0.3);
        float sdisc = smoothstep(0.9988, 0.9993, s) * uDay;
        col += vec3(0.75, 0.78, 0.7) * sdisc * (1.0 - cover * 0.85);
        col += vec3(0.45, 0.47, 0.42) * sglow * (1.0 - cover * 0.4);

        col += uFlash * vec3(0.5, 0.6, 1.0) * (0.25 + cover * 1.2);
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

export function createWater(size = 720, y = 0) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uFlash: { value: 0 }, uDay: { value: 0 } }]);
  uniforms.uTime = ps2Uniforms.uTime;
  uniforms.uSnapRes = ps2Uniforms.uSnapRes;
  const mat = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    vertexShader: /* glsl */`
      uniform vec2 uSnapRes; uniform float uTime;
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        wp.y += sin(wp.x * 0.3 + uTime * 1.3) * 0.03 + sin(wp.z * 0.25 + uTime) * 0.03;
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        ${SNAP_GLSL}
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uFlash, uDay;
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      ${GLSL_NOISE}
      void main(){
        vec2 p = vWorld.xz * 0.16;
        float t = uTime;
        float a = fbm(p + vec2(t * 0.06, t * 0.04));
        float b = fbm(p * 1.6 + vec2(-t * 0.05, t * 0.07) + a * 2.0);
        float c = fbm(p * 3.3 + vec2(t * 0.11, -t * 0.03) + b * 1.5);
        float v = b * 0.75 + c * 0.4;
        vec3 deep = vec3(0.0, 0.025, 0.13);
        vec3 mid = vec3(0.02, 0.12, 0.52);
        vec3 hi = vec3(0.4, 0.78, 1.0);
        vec3 col = mix(deep, mid, smoothstep(0.3, 0.7, v));
        col = mix(col, hi, smoothstep(0.74, 0.95, v));
        float lum = dot(col, vec3(0.3, 0.55, 0.15));
        col = mix(col, vec3(0.1, 0.16, 0.17) + lum * vec3(0.5, 0.7, 0.72), uDay * 0.75);
        col += uFlash * vec3(0.2, 0.3, 0.5);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  const g = new THREE.PlaneGeometry(size, size, Math.round(size / 8), Math.round(size / 8));
  g.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.y = y;
  mesh.name = 'water';
  return mesh;
}

export class Rain {
  constructor(count = 5000) {
    const pos = new Float32Array(count * 6), aEnd = new Float32Array(count * 2), aRnd = new Float32Array(count * 2);
    const BOX = [50, 30, 50];
    for (let i = 0; i < count; i++) {
      const x = Math.random() * BOX[0], y = Math.random() * BOX[1], z = Math.random() * BOX[2], r = Math.random();
      for (let k = 0; k < 2; k++) {
        pos.set([x, y, z], (i * 2 + k) * 3);
        aEnd[i * 2 + k] = k;
        aRnd[i * 2 + k] = r;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aEnd', new THREE.BufferAttribute(aEnd, 1));
    g.setAttribute('aRnd', new THREE.BufferAttribute(aRnd, 1));
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uCam: { value: new THREE.Vector3() }, uIntensity: { value: 0.6 },
    }]);
    uniforms.uTime = ps2Uniforms.uTime;
    this.mat = new THREE.ShaderMaterial({
      uniforms,
      fog: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute float aEnd; attribute float aRnd;
        uniform float uTime, uIntensity; uniform vec3 uCam;
        varying float vA;
        #include <fog_pars_vertex>
        const vec3 BOX = vec3(50.0, 30.0, 50.0);
        void main(){
          vec3 vel = vec3(2.0, -24.0, 1.0) * (0.85 + aRnd * 0.3);
          vec3 p = position + vel * uTime;
          p = uCam + mod(p - uCam, BOX) - vec3(BOX.x * 0.5, 10.0, BOX.z * 0.5);
          p -= normalize(vel) * aEnd * 0.8;
          vA = step(aRnd, uIntensity) * (0.35 + 0.4 * fract(aRnd * 13.7));
          vec4 mvPosition = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        varying float vA;
        #include <fog_pars_fragment>
        void main(){
          float f = 1.0;
          #ifdef USE_FOG
            f = exp(-fogDensity * fogDensity * vFogDepth * vFogDepth * 4.0);
          #endif
          gl_FragColor = vec4(vec3(0.45, 0.62, 1.0) * vA * f, 1.0);
        }`,
    });
    this.mesh = new THREE.LineSegments(g, this.mat);
    this.mesh.frustumCulled = false;
  }

  update(camPos, intensity) {
    this.mat.uniforms.uCam.value.copy(camPos);
    this.mat.uniforms.uIntensity.value = intensity;
  }
}

// Slow weather cycle with occasional lightning during heavy rain.
export class Weather {
  constructor() {
    this.t = 0;
    this.intensity = 0.6;
    this.flash = 0;
    this.nextBolt = 8;
    this.onThunder = null;
  }

  update(dt) {
    this.t += dt;
    const cycle = 0.5 + 0.5 * Math.sin(this.t * 0.035) * Math.sin(this.t * 0.013 + 1.3);
    this.intensity = 0.15 + cycle * 0.85;
    this.flash = Math.max(0, this.flash - dt * 3.5);
    this.nextBolt -= dt;
    if (this.nextBolt <= 0) {
      if (this.intensity > 0.65) {
        this.flash = 1;
        setTimeout(() => { this.flash = Math.max(this.flash, 0.6); }, 120);
        if (this.onThunder) this.onThunder(0.6 + Math.random() * 2.5);
      }
      this.nextBolt = 12 + Math.random() * 25;
    }
  }
}
