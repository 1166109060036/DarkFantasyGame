// PS2-era look: low internal resolution upscaled with nearest filtering, slight vertex snapping,
// a soft bloom (the "glow" PS2 games faked with framebuffer blurs), a cold moonlit grade and
// ordered dithering into a reduced colour depth.
import * as THREE from 'three';

export const ps2Uniforms = {
  uSnapRes: { value: new THREE.Vector2(320, 224) },
  uTime: { value: 0 },
};

export const GLSL_NOISE = /* glsl */`
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1.0,0.0)), u.x), mix(hash12(i+vec2(0.0,1.0)), hash12(i+vec2(1.0,1.0)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += vnoise(p) * a; p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
`;

export const SNAP_GLSL = /* glsl */`
gl_Position.xy = floor(gl_Position.xy / gl_Position.w * uSnapRes + 0.5) / uSnapRes * gl_Position.w;
`;

// Patch a built-in material: vertex snapping + optional wind sway (uses uv.y so only the tips move).
// fogScale < 1 thins the fog for that material only, so colossal structures loom through the mist
// from hundreds of metres away while everything else stays buried in it.
export const FAR_FOG_GLSL = (scale) => `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth * ${(scale * scale).toFixed(4)} );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth * ${scale.toFixed(3)} );
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif
`;

export function ps2ify(mat, { wind = 0, fogScale = 1 } = {}) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSnapRes = ps2Uniforms.uSnapRes;
    shader.uniforms.uTime = ps2Uniforms.uTime;
    let vs = shader.vertexShader;
    vs = vs.replace('#include <common>', '#include <common>\nuniform vec2 uSnapRes;\nuniform float uTime;');
    if (wind > 0) {
      vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        vec3 wp0 = position;
        #ifdef USE_INSTANCING
          wp0 = (instanceMatrix * vec4(position, 1.0)).xyz;
        #endif
        float sway = sin(uTime * 1.6 + wp0.x * 0.35 + wp0.z * 0.27) * 0.6 + sin(uTime * 3.3 + wp0.x * 0.9 + wp0.z * 0.4) * 0.25;
        transformed.x += sway * ${wind.toFixed(3)} * uv.y;
        transformed.z += sway * ${(wind * 0.6).toFixed(3)} * uv.y;
      }`);
    }
    vs = vs.replace('#include <project_vertex>', '#include <project_vertex>\n' + SNAP_GLSL);
    shader.vertexShader = vs;
    if (fogScale !== 1) shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', FAR_FOG_GLSL(fogScale));
  };
  mat.customProgramCacheKey = () => 'ps2-' + wind + '-' + fogScale;
  return mat;
}

const FS_VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const BRIGHT_FRAG = /* glsl */`
uniform sampler2D tInput; uniform float uThreshold;
varying vec2 vUv;
void main(){
  vec3 c = texture2D(tInput, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(uThreshold, uThreshold + 0.35, l);
  gl_FragColor = vec4(c * k, 1.0);
}`;

const BLUR_FRAG = /* glsl */`
uniform sampler2D tInput; uniform vec2 uDir;
varying vec2 vUv;
void main(){
  vec3 s = texture2D(tInput, vUv).rgb * 0.227027;
  s += texture2D(tInput, vUv + uDir * 1.384615).rgb * 0.316216;
  s += texture2D(tInput, vUv - uDir * 1.384615).rgb * 0.316216;
  s += texture2D(tInput, vUv + uDir * 3.230769).rgb * 0.070270;
  s += texture2D(tInput, vUv - uDir * 3.230769).rgb * 0.070270;
  gl_FragColor = vec4(s, 1.0);
}`;

const COMPOSITE_FRAG = /* glsl */`
uniform sampler2D tScene; uniform sampler2D tBloom;
uniform float uBloom, uTime, uFlash, uHurt, uFade, uLevels, uGrain, uDay;
varying vec2 vUv;
float bayer2(vec2 a){ a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
void main(){
  vec3 c = texture2D(tScene, vUv).rgb;
  vec3 b = texture2D(tBloom, vUv).rgb;
  c += b * uBloom;
  c += uFlash * vec3(0.10, 0.13, 0.22);
  // moonlit grade: lift blacks into navy, push saturation, cool highlights
  // night: cold saturated moonlight. day: drained, sickly grey-green overcast
  c += mix(vec3(0.004, 0.012, 0.035), vec3(0.012, 0.016, 0.014), uDay) * (1.0 - c);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, mix(1.22, 0.62, uDay));
  c *= mix(vec3(0.9, 1.0, 1.14), vec3(0.94, 1.0, 0.95), uDay);
  c = mix(c, c * c * 1.35, uDay * 0.12);
  c = pow(max(c, 0.0), vec3(0.92));
  vec2 q = vUv - 0.5;
  c *= 1.0 - dot(q, q) * 1.15;
  c = mix(c, vec3(0.45, 0.02, 0.04), uHurt * smoothstep(0.15, 0.75, length(q)));
  float g = fract(sin(dot(gl_FragCoord.xy + fract(uTime) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
  c += (g - 0.5) * uGrain;
  c *= 1.0 - uFade;
  c = floor(c * uLevels + bayer4(gl_FragCoord.xy)) / uLevels;
  gl_FragColor = vec4(c, 1.0);
}`;

export class PS2Pipeline {
  constructor(renderer, { height = 448, snap = 1 } = {}) {
    this.r = renderer;
    this.height = height;
    this.snap = snap;
    const sceneOpts = { depthBuffer: true, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
    const blurOpts = { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.rtScene = new THREE.WebGLRenderTarget(1, 1, sceneOpts);
    this.rtA = new THREE.WebGLRenderTarget(1, 1, blurOpts);
    this.rtB = new THREE.WebGLRenderTarget(1, 1, blurOpts);

    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.quad = new THREE.Mesh(tri);
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const mk = (frag, uniforms) => new THREE.ShaderMaterial({
      vertexShader: FS_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false,
    });
    this.brightMat = mk(BRIGHT_FRAG, { tInput: { value: null }, uThreshold: { value: 0.42 } });
    this.blurMat = mk(BLUR_FRAG, { tInput: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.compMat = mk(COMPOSITE_FRAG, {
      tScene: { value: this.rtScene.texture }, tBloom: { value: this.rtA.texture },
      uBloom: { value: 1.0 }, uTime: ps2Uniforms.uTime, uFlash: { value: 0 }, uHurt: { value: 0 },
      uFade: { value: 0 }, uLevels: { value: 40 }, uGrain: { value: 0.03 }, uDay: { value: 0 },
    });
  }

  get uniforms() { return this.compMat.uniforms; }

  resize(w, h) {
    this.H = Math.round(this.height);
    this.W = Math.round(this.H * w / h);
    this.r.setSize(this.W, this.H, false);
    this.rtScene.setSize(this.W, this.H);
    const bw = Math.max(1, this.W >> 1), bh = Math.max(1, this.H >> 1);
    this.rtA.setSize(bw, bh);
    this.rtB.setSize(bw, bh);
    // snap = 0 disables wobble (huge grid), 1 = per-pixel, 2 = every other pixel (PS1-ish)
    const div = this.snap <= 0 ? 0.02 : this.snap * 2;
    ps2Uniforms.uSnapRes.value.set(this.W / div, this.H / div);
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.quadScene, this.quadCam);
  }

  render(scene, camera, overlay) {
    const r = this.r;
    r.setRenderTarget(this.rtScene);
    r.clear();
    r.render(scene, camera);
    if (overlay) {
      r.autoClear = false;
      r.clearDepth();
      r.render(overlay, camera);
      r.autoClear = true;
    }
    this.brightMat.uniforms.tInput.value = this.rtScene.texture;
    this.pass(this.brightMat, this.rtA);
    const tx = 1 / this.rtA.width, ty = 1 / this.rtA.height;
    for (let i = 0; i < 2; i++) {
      const spread = 1 + i * 1.5;
      this.blurMat.uniforms.tInput.value = this.rtA.texture;
      this.blurMat.uniforms.uDir.value.set(tx * spread, 0);
      this.pass(this.blurMat, this.rtB);
      this.blurMat.uniforms.tInput.value = this.rtB.texture;
      this.blurMat.uniforms.uDir.value.set(0, ty * spread);
      this.pass(this.blurMat, this.rtA);
    }
    this.pass(this.compMat, null);
  }
}
