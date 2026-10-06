import * as THREE from 'three';
import { PS2Pipeline, ps2Uniforms } from './ps2.js';
import { createTextures } from './textures.js';
import { createMaterials } from './materials.js';
import { Terrain } from './terrain.js';
import { createSky, createWater, Rain, Weather, FOG_COLOR, MOON_DIR } from './environment.js';
import { CollisionWorld } from './collision.js';
import { buildStructures } from './structures.js';
import { buildVegetation } from './vegetation.js';
import { createToad, createCrow, createViewModel, blobShadow } from './characters.js';
import { Flock, Particles } from './entities.js';
import { Combat } from './combat.js';
import { DoomHud } from './hud.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { UI } from './ui.js';
import { Quests } from './quests.js';
import { PASTURE, FENCE_R, TOAD, TEMPLE, SPAWN, LOST_SHEEP, LOCATIONS, TAVERN } from './layout.js';
import { DayNight } from './daynight.js';
import { clamp } from './util.js';

const SAVE_KEY = 'moonmire-save-v1';
const SETTINGS_KEY = 'moonmire-settings-v1';
const params = new URLSearchParams(location.search);

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } },
};

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.input = new Input(this.canvas);
    const touch = this.input.touch;
    this.quality = touch
      ? { height: 360, grass: 7000, trees: 480, ferns: 900, rocks: 160, mushrooms: 220, rain: 2500 }
      : { height: 448, grass: 16000, trees: 760, ferns: 1600, rocks: 260, mushrooms: 340, rain: 5000 };
    this.settings = Object.assign({ height: this.quality.height, snap: 1, sens: 1, volume: 0.8 }, store.get(SETTINGS_KEY) || {});
    this.state = 'loading';
    this.time = 0;
    this.coins = 0;
    this.potions = 1;
    this.checkpoint = { x: SPAWN.x, z: SPAWN.z };
    this.endingBeam = null;
    this.discovered = new Set();
    this.indoor = 0;
    this.dayNight = new DayNight(900, params.has('time') ? +params.get('time') : 0.9);
  }

  init() {
    THREE.ColorManagement.enabled = false;
    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' }));
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setPixelRatio(1);
    this.pipeline = new PS2Pipeline(renderer, { height: this.settings.height, snap: this.settings.snap });

    const scene = (this.scene = new THREE.Scene());
    scene.fog = new THREE.FogExp2(FOG_COLOR.clone(), 0.0115);
    scene.background = FOG_COLOR.clone();
    this.camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.1, 1500);
    scene.add(this.camera);

    // moonlight
    this.hemi = new THREE.HemisphereLight(0x6a88e0, 0x10241c, 2.2);
    this.moon = new THREE.DirectionalLight(0xb4c8ff, 2.4);
    this.moon.position.copy(MOON_DIR).multiplyScalar(100);
    scene.add(this.hemi, this.moon, this.moon.target);
    this.lantern = new THREE.PointLight(0x9fc4ff, 9, 16, 1.6);
    scene.add(this.lantern);

    const T = createTextures();
    const M = (this.M = createMaterials(T));
    this.terrain = new Terrain();
    scene.add(this.terrain.buildMesh(M.terrain));
    this.water = createWater();
    scene.add(this.water);
    this.sky = createSky();
    scene.add(this.sky);
    this.rain = new Rain(this.quality.rain);
    scene.add(this.rain.mesh);
    this.weather = new Weather();

    this.collision = new CollisionWorld();
    const st = buildStructures(scene, this.terrain, M, this.collision);
    this.altar = st.altar;
    this.fx = st.fx;
    this.village = st.village;
    const toadLight = new THREE.PointLight(0xffb060, 6, 14, 1.5);
    toadLight.position.copy(st.lantern);
    scene.add(toadLight);
    buildVegetation(scene, this.terrain, M, this.collision, this.quality);
    for (const b of st.braziers) {
      const halo = new THREE.Sprite(M.sprite);
      halo.position.copy(b);
      halo.scale.setScalar(2.6);
      scene.add(halo);
    }
    const templeLight = new THREE.PointLight(0x7fc0ff, 14, 34, 1.3);
    templeLight.position.set(TEMPLE.x, 5, TEMPLE.z + 2);
    scene.add(templeLight);

    // NPCs
    const H = (x, z) => this.terrain.getHeight(x, z);
    const crowA = Math.PI + 0.12;
    const crowPos = new THREE.Vector3(PASTURE.x + Math.cos(crowA) * (FENCE_R + 1.3), 0, PASTURE.z + Math.sin(crowA) * (FENCE_R + 1.3));
    crowPos.y = H(crowPos.x, crowPos.z);
    const crow = createCrow(M);
    crow.position.copy(crowPos);
    crow.rotation.y = crow.userData.baseRy = Math.atan2(PASTURE.x - crowPos.x, PASTURE.z - crowPos.z);
    const toadPos = new THREE.Vector3(TOAD.x + 1.9, 0, TOAD.z + 0.6);
    toadPos.y = H(toadPos.x, toadPos.z);
    const toad = createToad(M);
    toad.position.copy(toadPos);
    toad.rotation.y = Math.PI / 2 - 0.2;
    scene.add(crow, toad);
    for (const [obj, s] of [[crow, 1.4], [toad, 2.2]]) {
      const sh = blobShadow(M, s);
      sh.position.set(obj.position.x, obj.position.y + 0.04, obj.position.z);
      scene.add(sh);
    }
    this.collision.addCircle(crowPos.x, crowPos.z, 0.5);
    this.collision.addCircle(toadPos.x, toadPos.z, 0.9);
    this.npcs = {
      crow: { obj: crow, pos: crowPos, name: 'โกวัก ผู้เลี้ยงแกะ' },
      toad: { obj: toad, pos: toadPos, name: 'ยายคางคก' },
      keeper: { obj: this.village.keeper.obj, pos: this.village.keeper.pos, name: 'เทียนหลอม' },
    };

    // crow-headed guardian statues at the temple
    for (const sx of [-10, 10]) {
      const s = createCrow(M, { statue: true });
      s.position.set(TEMPLE.x + sx, 1.8, TEMPLE.z + 2.5);
      s.scale.setScalar(2.1);
      scene.add(s);
      this.collision.addBox(s.position.x, 4, s.position.z, 1.1, 2.4, 1.1);
    }

    this.interactables = [
      { id: 'crow', pos: crowPos, r: 3.6, label: 'คุยกับโกวัก' },
      { id: 'toad', pos: toadPos, r: 3.8, label: 'คุยกับยายคางคก' },
      { id: 'altar', pos: this.altar, r: 3.2, label: 'ตรวจดูแท่นบูชา', checkpoint: { x: TEMPLE.x, z: TEMPLE.z + 14 } },
      { id: 'keeper', pos: this.village.keeper.pos, r: 3.0, label: 'คุยกับเทียนหลอม เจ้าของโรงเตี๊ยม', checkpoint: { x: TAVERN.x, z: TAVERN.z - 8 } },
    ];

    this.audio = new AudioSys();
    this.weather.onThunder = (d) => this.audio.thunder(d);
    this.flock = new Flock(scene, M, this.terrain, this.audio);
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * (FENCE_R - 10);
      this.flock.add(PASTURE.x + Math.cos(a) * d, PASTURE.z + Math.sin(a) * d);
    }
    this.lostSheep = LOST_SHEEP.map(([x, z], i) => this.flock.add(x, z, { lost: true, id: i }));
    this.particles = new Particles(scene, M);

    // first-person hands rendered in their own pass (never clip into walls)
    this.overlay = new THREE.Scene();
    this.overlay.add(new THREE.HemisphereLight(0x8aa6ff, 0x203028, 2.4));
    const ol = new THREE.DirectionalLight(0xc0d0ff, 1.6);
    ol.position.set(1, 2, 1);
    this.overlay.add(ol);
    this.viewCam = new THREE.Group();
    this.overlay.add(this.viewCam);
    this.view = createViewModel(M);
    this.viewCam.add(this.view);
    this.vmLight = new THREE.PointLight(0x9fc4ff, 2, 3, 1);
    this.vmLight.position.set(-0.3, -0.25, -0.5);
    this.viewCam.add(this.vmLight);

    this.player = new Player(this.camera, this.terrain, this.collision);
    this.player.onStep = (wet) => this.audio.step(wet);
    this.ui = new UI();
    this.ui.buildMap(this.terrain, this.terrain.rail.pts);
    this.quests = new Quests(this);
    this.combat = new Combat(this);
    this.hud = new DoomHud();

    this.applySettings();
    this.bindUI();
    this.resize();
    addEventListener('resize', () => this.resize());
    this.input.onLockChange = (locked) => {
      if (!locked && this.state === 'play' && !this.input.touch) this.pause();
    };
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play') this.save(); });

    this.player.place(SPAWN.x, SPAWN.z, Math.atan2(-(SPAWN.toward.x - SPAWN.x), -(SPAWN.toward.z - SPAWN.z)));
    this.state = 'title';
    this.startMenuMusic();
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('btn-continue').classList.toggle('hidden', !store.get(SAVE_KEY));

    if (params.has('autostart')) this.start(false);
    const at = params.get('at');
    if (at) {
      const [x, z, yaw = 0, pitch = 0] = at.split(',').map(Number);
      this.player.place(x, z, yaw);
      this.player.pitch = pitch;
    }
    if (params.has('stage')) { this.quests.stage = +params.get('stage'); this.onQuestChanged(); }

    this.clock = new THREE.Clock();
    renderer.setAnimationLoop(() => this.frame());
    window.__game = this;
  }

  bindUI() {
    const on = (id, fn) => document.getElementById(id).addEventListener('click', fn);
    on('btn-new', () => this.start(false));
    on('btn-continue', () => this.start(true));
    on('btn-resume', () => this.resume());
    on('btn-restart', () => { store.del(SAVE_KEY); location.reload(); });
    // desktop build (Electron) only
    if (window.desktop) {
      document.body.classList.add('desktop');
      const quit = () => { this.save(); window.desktop.quit(); };
      on('btn-quit', quit);
      on('btn-quit-title', quit);
      on('btn-fullscreen', () => window.desktop.toggleFullscreen());
    }
    on('btn-ending-continue', () => { document.getElementById('ending').classList.add('hidden'); this.resume(); });
    const bind = (id, key, parse = Number) => {
      const el = document.getElementById(id);
      el.value = this.settings[key];
      el.addEventListener('input', () => { this.settings[key] = parse(el.value); this.applySettings(); store.set(SETTINGS_KEY, this.settings); });
    };
    bind('set-res', 'height');
    bind('set-snap', 'snap');
    bind('set-sens', 'sens');
    bind('set-vol', 'volume');
    document.getElementById('dialogue').addEventListener('touchstart', () => this.input.actions.add('tap'), { passive: true });
    document.getElementById('dialogue').addEventListener('click', () => { if (!this.input.locked) this.input.actions.add('tap'); });
    this.canvas.addEventListener('click', () => {
      if (this.state === 'play' && !this.input.locked && !this.input.touch) this.input.requestLock();
    });
  }

  applySettings() {
    this.pipeline.height = this.settings.height;
    this.pipeline.snap = this.settings.snap;
    this.input.sensitivity = this.settings.sens;
    this.audio?.setVolume(this.settings.volume);
    this.resize();
  }

  resize() {
    if (!this.camera) return;
    // in play the 3D view sits above the status bar, like Doom
    const bar = document.body.classList.contains('in-game') ? document.getElementById('dbar').offsetHeight : 0;
    const h = Math.max(1, innerHeight - bar);
    this.camera.aspect = innerWidth / h;
    this.camera.updateProjectionMatrix();
    this.pipeline.resize(innerWidth, h);
  }

  start(continueGame) {
    this.audio.init();
    this.audio.stopMusic(2);
    this.audio.setVolume(this.settings.volume);
    if (continueGame) this.load();
    document.getElementById('title').classList.add('hidden');
    this.ui.show('hud');
    document.body.classList.add('in-game');
    this.resize();
    if (this.input.touch) {
      this.ui.show('touch');
      document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
    }
    this.state = 'play';
    this.input.enabled = true;
    this.input.requestLock();
    this.onQuestChanged(false);
    if (!continueGame) {
      setTimeout(() => this.ui.toast('ฝนเย็นเยียบตกลงบนบึง... เดินตามรางรถไฟขึ้นไปทางเหนือ'), 600);
      if (!this.input.touch) setTimeout(() => this.ui.toast('WASD เดิน · Shift วิ่ง · คลิก ฟัน · คลิกขวา ป้องกัน · C หลบ · E คุย · M แผนที่'), 3200);
    }
  }

  // Title-screen music. Browsers only allow sound after the first click or key press, so the
  // audio context is resumed on that first gesture (the desktop app may play it right away).
  startMenuMusic() {
    this.audio.playMusic('audio/menu.mp3');
    const unlock = () => {
      if (this.state === 'title') { this.audio.init(); this.audio.playMusic('audio/menu.mp3'); }
      removeEventListener('pointerdown', unlock);
      removeEventListener('keydown', unlock);
    };
    addEventListener('pointerdown', unlock);
    addEventListener('keydown', unlock);
  }

  pause() {
    this.state = 'paused';
    this.ui.show('pause');
    this.save();
  }

  resume() {
    this.ui.show('pause', false);
    this.state = 'play';
    this.input.requestLock();
  }

  save() {
    if (this.state === 'title' || this.state === 'loading') return;
    store.set(SAVE_KEY, {
      quests: this.quests.serialize(), combat: this.combat.serialize(), coins: this.coins, potions: this.potions, hp: this.player.hp,
      pos: { x: this.player.pos.x, z: this.player.pos.z }, yaw: this.player.yaw, checkpoint: this.checkpoint,
      time: this.dayNight.t, discovered: [...this.discovered],
    });
  }

  load() {
    const d = store.get(SAVE_KEY);
    if (!d) return;
    this.quests.load(d.quests || {});
    this.coins = d.coins ?? 0;
    this.potions = d.potions ?? 1;
    this.checkpoint = d.checkpoint || this.checkpoint;
    if (typeof d.time === 'number') this.dayNight.t = d.time;
    this.discovered = new Set(d.discovered || []);
    this.combat.load(d.combat);
    if (d.pos) this.player.place(d.pos.x, d.pos.z, d.yaw ?? 0);
    this.player.hp = Math.max(30, d.hp ?? 100);
    this.quests.sheepFound.forEach((f, i) => {
      if (!f) return;
      const s = this.lostSheep[i];
      s.x = PASTURE.x + (i - 1) * 4; s.z = PASTURE.z + 6; s.mode = 'graze';
    });
    // lost sheep that were never searched for go home once the quest is past them
    if (this.quests.stage >= 2) this.lostSheep.forEach((s, i) => { if (s.mode === 'lost') { s.x = PASTURE.x + i * 3; s.z = PASTURE.z - 5; s.mode = 'graze'; } });
    if (this.quests.stage >= 7) this.spawnBeam();
  }

  addCoins(n) {
    this.coins += n;
    this.audio.coin();
    this.ui.toast(`+${n} เหรียญทอง`);
    this.updateHud();
  }

  updateHud() {
    this.ui.setStats(this.player.hp, this.player.maxHp, this.coins, this.potions, this.combat.stamina, this.combat.exhausted);
  }

  onQuestChanged(saveNow = true) {
    this.ui.setQuest(this.quests.objective());
    this.updateHud();
    if (saveNow) {
      this.audio?.ui();
      this.save();
    }
  }

  spawnBeam() {
    if (this.endingBeam) return;
    const g = new THREE.CylinderGeometry(0.9, 1.6, 120, 12, 1, true);
    g.translate(0, 60, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.5, 0.75, 1.3), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
    }));
    m.position.copy(this.altar).add(new THREE.Vector3(0, 1.1, 0));
    this.scene.add(m);
    const l = new THREE.PointLight(0x9fd0ff, 30, 40, 1.4);
    l.position.copy(this.altar).add(new THREE.Vector3(0, 3, 0));
    this.scene.add(l);
    this.endingBeam = m;
  }

  finishChapter() {
    this.quests.stage = 7;
    this.spawnBeam();
    this.audio.chime();
    this.onQuestChanged();
    setTimeout(() => {
      this.state = 'paused';
      if (document.pointerLockElement) document.exitPointerLock();
      document.getElementById('ending').classList.remove('hidden');
    }, 2200);
  }

  interact(id) {
    const it = this.interactables.find((i) => i.id === id);
    this.checkpoint = it.checkpoint || { x: this.npcs[id].pos.x + 2, z: this.npcs[id].pos.z + 2 };
    if (id === 'crow') this.audio.caw();
    if (id === 'toad') this.audio.croak();
    this.ui.openDialogue(this.quests.talk(id), () => this.updateHud());
  }

  // Rest at the inn: fade to black, skip to the chosen hour, wake fully healed.
  sleepUntil(t) {
    this.state = 'sleeping';
    this.sleepT = 0;
    this.sleepTarget = t;
  }

  checkDiscoveries() {
    const p = this.player.pos;
    for (const loc of LOCATIONS) {
      if (this.discovered.has(loc.id) || Math.hypot(p.x - loc.x, p.z - loc.z) > loc.r) continue;
      this.discovered.add(loc.id);
      this.ui.discover(loc.name, this.discovered.size, LOCATIONS.length);
      this.audio.discover();
      this.save();
    }
  }

  applyDayNight(dt, rainI, flash) {
    const dn = this.dayNight;
    if (this.state !== 'sleeping') dn.update(dt);
    const P = dn.p;
    const sky = this.sky.material.uniforms;
    this.scene.fog.color.setRGB(...P.fog);
    this.scene.background.copy(this.scene.fog.color);
    this.scene.fog.density = P.density - 0.001 + rainI * 0.004;
    sky.uHorizon.value.copy(this.scene.fog.color);
    sky.uZenith.value.setRGB(...P.zenith);
    sky.uCloudDark.value.setRGB(...P.cloudDark);
    sky.uCloudLit.value.setRGB(...P.cloudLit);
    sky.uSunDir.value.copy(dn.sunDir);
    sky.uDay.value = P.day;
    sky.uStars.value = P.stars * (1 - rainI * 0.6);
    sky.uAurora.value = P.aurora * (1 - rainI * 0.5);
    sky.uVortex.value = P.vortex;
    sky.uCloud.value = 0.35 + rainI * 0.6 + P.cloud;
    sky.uFlash.value = flash;
    // light dims indoors so the inn is lit by its candles and hearth
    const dim = 1 - this.indoor * 0.65;
    this.hemi.color.setRGB(...P.hemiSky);
    this.hemi.groundColor.setRGB(...P.hemiGround);
    this.hemi.intensity = (P.hemiI + flash * 4) * dim;
    this.moon.color.setRGB(...P.light);
    this.moon.intensity = P.lightI * dim;
    this.moon.position.copy(dn.lightDirection(MOON_DIR)).multiplyScalar(100);
    this.water.material.uniforms.uFlash.value = flash;
    this.water.material.uniforms.uDay.value = P.day;
    const pu = this.pipeline.uniforms;
    pu.uFlash.value = flash;
    pu.uDay.value = P.day;
    pu.uBloom.value = P.bloom;
  }

  die() {
    this.state = 'dead';
    this.deadT = 0;
    this.audio.hurt();
  }

  updatePlay(dt) {
    const p = this.player, input = this.input, ui = this.ui;
    const mapOpen = !document.getElementById('map').classList.contains('hidden');
    const frozen = ui.dialogueOpen || mapOpen;

    if (ui.dialogueOpen) ui.updateDialogue(dt, input);
    if (input.consume('map') && !ui.dialogueOpen) ui.show('map', mapOpen ? false : true);
    if (input.consume('pause')) { if (document.pointerLockElement) document.exitPointerLock(); this.pause(); return; }

    const c = this.combat;
    c.updatePlayer(dt, input, frozen);
    p.update(dt, input, this.time, frozen, c.playerMods());

    if (!frozen) {
      if (input.consume('potion')) {
        if (this.potions > 0 && p.hp < p.maxHp) {
          this.potions--; p.hp = Math.min(p.maxHp, p.hp + 50); this.audio.drink(); this.ui.toast('ดื่มยาฟื้นพลัง +50');
        } else if (this.potions <= 0) this.ui.toast('ไม่มียาฟื้นพลัง — ซื้อได้จากยายคางคก');
      }
      // nearest interactable in front of the player
      let best = null, bd = Infinity;
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
      for (const it of this.interactables) {
        const dx = it.pos.x - p.pos.x, dz = it.pos.z - p.pos.z, d = Math.hypot(dx, dz);
        if (d < it.r && d < bd && (d < 1.5 || (dx * fx + dz * fz) / d > 0.2) && Math.abs(it.pos.y - p.pos.y) < 3) { bd = d; best = it; }
      }
      const verb = input.touch ? '✋' : '[E]';
      ui.setPrompt(best ? `${verb} ${best.label}` : null);
      if (best && input.consume('interact')) { ui.setPrompt(null); this.interact(best.id); }
    } else {
      ui.setPrompt(null);
    }
    c.updateViewModel(dt);

    // lost sheep
    if (this.quests.stage === 1) {
      this.lostSheep.forEach((s, i) => {
        if (s.mode === 'lost' && Math.hypot(s.x - p.pos.x, s.z - p.pos.z) < 3.5 && this.quests.onSheepFound(i)) {
          this.flock.sendHome(s);
          this.audio.bleat();
          this.ui.toast(`พบแกะดำ ${this.quests.sheepCount}/3 — มันวิ่งกลับไปหาฝูงแล้ว`);
        }
      });
    }

    c.updateEnemies(dt, true);
    this.checkDiscoveries();
    const v = this.village.indoor;
    const inside = p.pos.x > v.minX && p.pos.x < v.maxX && p.pos.z > v.minZ && p.pos.z < v.maxZ && p.pos.y < v.maxY;
    this.indoor += ((inside ? 1 : 0) - this.indoor) * Math.min(1, dt * 4);
    if (p.hp <= 0) this.die();

    if (mapOpen) ui.drawMap(p, this.quests.markers(), this.discovered, LOCATIONS);
    this.updateHud();
    this.saveTimer = (this.saveTimer || 0) + dt;
    if (this.saveTimer > 20) { this.saveTimer = 0; this.save(); }
  }

  frame() {
    let dt = Math.min(0.05, this.clock.getDelta());
    // hit-stop: freeze the world for a heartbeat on heavy blows and parries
    if (this.combat.hitStop > 0) { this.combat.hitStop -= dt; dt *= 0.08; }
    this.time += dt;
    ps2Uniforms.uTime.value = this.time;
    const p = this.player;

    if (this.state === 'play') this.updatePlay(dt);
    else if (this.state === 'title') {
      // slow flyover along the railway behind the title screen
      const u = 0.06 + (this.time * 0.003) % 0.84;
      const rail = this.terrain.rail.curve;
      const a = rail.getPointAt(u), b = rail.getPointAt(Math.min(1, u + 0.02));
      this.camera.position.set(a.x, this.terrain.getHeight(a.x, a.z) + 2.4, a.z);
      this.camera.lookAt(b.x, this.terrain.getHeight(b.x, b.z) + 2.0, b.z);
    } else if (this.state === 'sleeping') {
      this.sleepT += dt;
      this.pipeline.uniforms.uFade.value = this.sleepT < 1 ? this.sleepT : Math.max(0, 2.2 - this.sleepT);
      if (this.sleepT >= 1 && this.sleepTarget !== null) {
        this.dayNight.t = this.sleepTarget;
        this.sleepTarget = null;
        p.hp = p.maxHp;
        this.combat.resetAggro();
      }
      if (this.sleepT > 2.2) {
        this.state = 'play';
        this.ui.toast(`ตื่นขึ้นมาตอน ${this.dayNight.clockText()}`);
        this.save();
      }
    } else if (this.state === 'dead') {
      this.deadT += dt;
      this.pipeline.uniforms.uFade.value = clamp(this.deadT / 1.5, 0, 1);
      if (this.deadT > 2) {
        p.place(this.checkpoint.x, this.checkpoint.z, p.yaw);
        p.hp = p.maxHp;
        this.combat.resetAggro();
        this.combat.stamina = this.combat.maxStamina;
        const lost = Math.floor(this.coins * 0.25);
        this.coins -= lost;
        this.state = 'play';
        this.ui.toast(lost ? `เจ้าฟื้นขึ้นมาอีกครั้ง... ทำเหรียญหล่นหาย ${lost} เหรียญ` : 'เจ้าฟื้นขึ้นมาอีกครั้ง...');
      }
    }
    if (this.state !== 'dead' && this.state !== 'sleeping') this.pipeline.uniforms.uFade.value = Math.max(0, this.pipeline.uniforms.uFade.value - dt * 1.5);

    // world animation runs in every state so the title screen is alive too
    this.weather.update(dt);
    const w = this.weather;
    const calm = this.quests.stage >= 7 ? 0.35 : 1;
    const rainI = w.intensity * calm;
    this.rain.update(this.camera.position, rainI * (1 - this.indoor));
    this.audio.setRain(rainI * (1 - this.indoor * 0.75));
    this.applyDayNight(dt, rainI, w.flash);
    this.hurtFlash = Math.max(0, (this.hurtFlash || 0) - dt * 2);
    this.pipeline.uniforms.uHurt.value = Math.max(this.hurtFlash * 0.8, p.hp < 30 && this.state === 'play' ? 0.25 + Math.sin(this.time * 4) * 0.1 : 0);
    this.sky.position.copy(this.camera.position);

    this.flock.update(dt, this.time, p);
    if (this.state !== 'play') this.combat.updateEnemies(dt, false);
    this.particles.update(dt);

    // NPC idle animation
    const crow = this.npcs.crow.obj;
    const dCrow = crow.position.distanceTo(p.pos);
    crow.rotation.z = Math.sin(this.time * 0.9) * 0.015;
    const crowGoal = dCrow < 7 ? Math.atan2(p.pos.x - crow.position.x, p.pos.z - crow.position.z) : crow.userData.baseRy;
    crow.userData.ry = (crow.userData.ry ?? crow.userData.baseRy) + wrapHeading(crowGoal - (crow.userData.ry ?? crow.userData.baseRy)) * Math.min(1, dt * 3);
    crow.rotation.y = crow.userData.ry;
    const toad = this.npcs.toad.obj;
    toad.scale.set(1, 1 + Math.sin(this.time * 1.8) * 0.02, 1);
    for (const [i, pt] of this.village.patrons.entries()) pt.rotation.z = Math.sin(this.time * 0.7 + i * 1.9) * 0.04;
    this.village.keeper.obj.userData.halo.scale.setScalar(1.6 * (1 + Math.sin(this.time * 11) * 0.08));
    for (const f of this.fx.fires) f.s.scale.setScalar(f.base * (1 + Math.sin(this.time * 9 + f.ph) * 0.1 + Math.sin(this.time * 23 + f.ph * 2) * 0.06));
    for (const m of this.fx.mists) m.s.scale.setScalar(m.base * (1 + Math.sin(this.time * 0.6 + m.ph) * 0.12));
    for (const l of this.fx.lights) l.l.intensity = l.base * (1 + Math.sin(this.time * 8 + l.base) * 0.08 + Math.sin(this.time * 17) * 0.05);
    if (this.endingBeam) this.endingBeam.material.opacity = 0.45 + Math.sin(this.time * 2) * 0.1;

    // lantern follows the player; view model bobs
    const flick = 1 + Math.sin(this.time * 13) * 0.04 + Math.sin(this.time * 7.3) * 0.05;
    this.lantern.position.copy(this.camera.position).add(new THREE.Vector3(0, -0.3, 0));
    this.lantern.intensity = this.state === 'title' ? 0 : 6 * flick * this.dayNight.p.lantern * (1 - this.indoor * 0.6);
    this.viewCam.position.copy(this.camera.position);
    this.viewCam.quaternion.copy(this.camera.quaternion);
    const lan = this.view.userData.lantern;
    lan.position.set(-0.3, -0.36 + p.bob * 0.7 + Math.sin(this.time * 1.7) * 0.006, -0.5);
    lan.rotation.z = Math.sin(p.bobT) * 0.08 * p.moving;
    this.view.userData.flame.scale.setScalar(flick);
    this.view.visible = this.state === 'play' || this.state === 'paused';
    if (this.state !== 'play') this.combat.updateViewModel(dt);

    if (this.state !== 'title' && this.state !== 'loading') {
      const c = this.combat;
      this.hud.update(dt, {
        hp: p.hp, maxHp: p.maxHp, stamina: c.stamina, exhausted: c.exhausted, dead: this.state === 'dead' || p.hp <= 0,
        attacking: !!c.swing || (c.charging && c.heavyReady), swordMul: c.swordMul, potions: this.potions, coins: this.coins, time: this.time,
      });
    }
    this.clockTimer = (this.clockTimer || 0) - dt;
    if (this.clockTimer <= 0) {
      this.clockTimer = 0.5;
      this.ui.setClock(this.dayNight.clockText());
      this.ui.setQuest(this.quests.objective());
    }
    if (this.state === 'play' || this.state === 'paused') {
      this.ui.updateCompass(wrapHeading(-p.yaw), p.pos.x, p.pos.z, this.quests.markers());
    }

    this.pipeline.render(this.scene, this.camera, this.view.visible ? this.overlay : null);
    this.input.endFrame();
  }
}

const wrapHeading = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const game = new Game();
// let the loading screen paint before the (synchronous) world generation
requestAnimationFrame(() => setTimeout(() => {
  try {
    game.init();
  } catch (e) {
    console.error(e);
    document.getElementById('loading').textContent = 'เกิดข้อผิดพลาด: ' + e.message;
  }
}, 30));
