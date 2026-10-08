// The path picker's stage: the chosen path's hero, standing in a pool of candlelight on its own
// small canvas, turning slowly and now and then showing its weapon (a blow, a heavy blow, a guard).
// Drag to turn it by hand. Rendered at a low resolution and scaled up, like the game itself.
import * as THREE from 'three';
import { createHero, animateHero } from './heroes.js';

const GOLD = new THREE.Color(0.85, 0.68, 0.32);

export class ClassPreview {
  constructor(canvas, M) {
    this.canvas = canvas;
    this.M = M;
    this.renderer = null;
    this.hero = null;
    this.kind = null;
    this.yaw = 0.5;
    this.spin = 0.35;
    this.t = 0;
    this.drag = null;
    canvas.addEventListener('pointerdown', (e) => { this.drag = e.clientX; this.spin = 0; canvas.setPointerCapture?.(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { if (this.drag == null) return; this.yaw += (e.clientX - this.drag) * 0.012; this.drag = e.clientX; });
    const up = () => { if (this.drag != null) { this.drag = null; this.spin = 0.35; } };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }

  init() {
    if (this.renderer) return;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: true });
    this.renderer.setPixelRatio(1);
    const scene = this.scene = new THREE.Scene();
    // a cold moon from behind, a warm candle from the front, a little sky between
    scene.add(new THREE.HemisphereLight(0x5a6a9a, 0x1a1008, 1.4));
    const key = new THREE.PointLight(0xffb060, 30, 9, 1.6);
    key.position.set(1.2, 2.2, 2.4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9ab8ff, 2.2);
    rim.position.set(-2, 3, -3);
    scene.add(rim);
    // the floor: a dark disc with a ring of gold, and a soft shadow
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.25, 32), new THREE.MeshLambertMaterial({ color: 0x14100c }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.18, 1.24, 48), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.55 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.005;
    scene.add(ring);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01;
    scene.add(shadow);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
    this.stand = new THREE.Group();
    scene.add(this.stand);
  }

  show(kind) {
    this.init();
    if (kind === this.kind) return;
    this.kind = kind;
    if (this.hero) this.stand.remove(this.hero);
    this.hero = createHero(kind, this.M, GOLD);
    this.stand.add(this.hero);
    this.t = 0;
    this.next = 1.6;
    this.action = 0;
    // frame the whole hero, weapon and all
    const box = new THREE.Box3().setFromObject(this.hero), h = Math.max(1.8, box.max.y);
    this.camera.position.set(0, h * 0.62, h * 2.7);
    this.camera.lookAt(0, h * 0.47, 0);
  }

  // dt in seconds; call every frame while the picker is open
  update(dt) {
    if (!this.hero) return;
    const w = this.canvas.clientWidth, hgt = this.canvas.clientHeight;
    if (!w || !hgt) return;
    // a PS2 frame: few pixels, scaled up crisp by CSS
    const rw = Math.round(w / 1.6), rh = Math.round(hgt / 1.6);
    if (this.canvas.width !== rw || this.canvas.height !== rh) {
      this.renderer.setSize(rw, rh, false);
      this.camera.aspect = rw / rh;
      this.camera.updateProjectionMatrix();
    }
    this.t += dt;
    this.yaw += this.spin * dt;
    this.stand.rotation.y = this.yaw;
    // every few seconds, show what the path fights with
    let action = 0;
    this.next -= dt;
    if (this.next <= 0) {
      this.demo = (this.demo || 0) + 1;
      this.action = [1, 2, 3][this.demo % 3];
      this.hold = this.action === 3 ? 1.1 : 0.05;
      this.next = 2.8;
    }
    if (this.hold > 0) { this.hold -= dt; action = this.action; }
    animateHero(this.hero, dt, { speed: 0, action });
    this.renderer.render(this.scene, this.camera);
  }
}
