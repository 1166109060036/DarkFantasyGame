import * as THREE from 'three';
import { PS2Pipeline, ps2Uniforms } from './ps2.js';
import { createTextures } from './textures.js';
import { createMaterials } from './materials.js';
import { Terrain } from './terrain.js';
import { createSky, createWater, Rain, Weather, FOG_COLOR, MOON_DIR } from './environment.js';
import { CollisionWorld } from './collision.js';
import { buildStructures } from './structures.js';
import { buildVegetation, buildArenaVegetation } from './vegetation.js';
import { ArenaTerrain, buildArena, arenaKeepOut, ARENA_LOCATIONS, ARENA_BASES } from './arena.js';
import { createToad, createCrow, createViewModel, blobShadow } from './characters.js';
import { Flock, Particles } from './entities.js';
import { Combat } from './combat.js';
import { DoomHud } from './hud.js';
import { Inventory } from './inventory.js';
import { BagUI } from './bagui.js';
import { Loot } from './loot.js';
import { Menus } from './menus.js';
import { ITEMS } from './items.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { MusicDirector } from './music.js';
import { Ambience } from './ambience.js';
import { CLASSES, createKit, STARTING_GEAR } from './classes.js';
import { WorldEvents } from './events.js';
import { Contracts } from './contracts.js';
import { Moba, SEATS, BUILDINGS, baseSpawn } from './moba.js';
import { Progress, SkillsUI, TREES } from './upgrades.js';
import { loadHeroAssets } from './heroes.js';
import { Lobby } from './lobby.js';
import { UI } from './ui.js';
import { Quests } from './quests.js';
import { PASTURE, FENCE_R, TOAD, TEMPLE, SPAWN, LOST_SHEEP, LOCATIONS, TAVERN, CASTLE, HEAD, RIBCAGE } from './layout.js';
import { DayNight } from './daynight.js';
import { clamp } from './util.js';

const SAVE_KEY = 'moonmire-save-v1';
const SETTINGS_KEY = 'moonmire-settings-v1';
const params = new URLSearchParams(location.search);
// `?arena` loads the map of the online siege instead of the story world (see src/arena.js)
const ARENA = params.has('arena');
const ARENA_IDS = new Set(ARENA_LOCATIONS.map((l) => l.id));

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
      ? { height: 360, grass: 7000, trees: 480, ferns: 900, rocks: 160, mushrooms: 220, rain: 1600 }
      : { height: 448, grass: 16000, trees: 760, ferns: 1600, rocks: 260, mushrooms: 340, rain: 3200 };
    this.settings = Object.assign({ height: this.quality.height, snap: 1, sens: 1, volume: 0.8, music: 0.7, sfx: 0.9 }, store.get(SETTINGS_KEY) || {});
    this.state = 'loading';
    this.time = 0;
    this.coins = 0;
    this.gear = { sword: 0, cloak: 0, lantern: 0 };
    this.buffs = { tonic: 0, oil: 0, sight: 0 };
    this.checkpoint = { x: SPAWN.x, z: SPAWN.z };
    this.endingBeam = null;
    this.discovered = new Set();
    this.indoor = 0;
    this.dayNight = new DayNight(900, params.has('time') ? +params.get('time') : 0.9);
    this.arena = ARENA;
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
    this.terrain = ARENA ? new ArenaTerrain() : new Terrain();
    scene.add(this.terrain.buildMesh(M.terrain));
    this.water = createWater();
    scene.add(this.water);
    this.sky = createSky();
    scene.add(this.sky);
    this.rain = new Rain(this.quality.rain);
    scene.add(this.rain.mesh);
    this.weather = new Weather();

    this.collision = new CollisionWorld();
    if (ARENA) this.buildArenaWorld();
    else this.buildStoryWorld();

    this.audio = new AudioSys();
    this.weather.onThunder = (d) => this.audio.thunder(d);
    this.ambience = new Ambience(this);
    this.flock = new Flock(scene, M, this.terrain, this.audio);
    for (let i = 0; i < (ARENA ? 0 : 22); i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * (FENCE_R - 10);
      this.flock.add(PASTURE.x + Math.cos(a) * d, PASTURE.z + Math.sin(a) * d);
    }
    this.lostSheep = ARENA ? [] : LOST_SHEEP.map(([x, z], i) => this.flock.add(x, z, { lost: true, id: i }));
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
    this.player.onStep = (wet) => this.audio.step(this.stepSurface(wet));
    this.ui = new UI();
    if (ARENA) document.querySelector('#map h2').textContent = 'แผนที่สนามศึก';
    this.ui.buildMap(this.terrain, this.terrain.rail.pts, ARENA ? this.terrain.roads : null, ARENA ? 215 : undefined);
    this.quests = new Quests(this);
    this.combat = new Combat(this);
    this.hud = new DoomHud();
    this.bag = new Inventory();
    this.bag.add('potion', 1);
    this.loot = new Loot(this);
    this.bagUI = new BagUI(this);
    this.menus = new Menus(this);
    this.classGear = new Set();     // paths whose starting gear was already handed out
    this.useProgress(new Progress());
    this.skillsUI = new SkillsUI(this);
    // imported hero models (assets/heroes/) load in the background; until then the built ones stand in
    loadHeroAssets().then((k) => { this.heroModels = k; });
    this.setClass('wanderer');
    this.events = new WorldEvents(this);
    if (ARENA) this.contracts = { chips: () => [], markers: () => [], update() {}, onKill() {}, serialize: () => ({}), load() {} };
    else {
      this.contracts = new Contracts(this);
      this.interactables.push({ id: 'board', pos: this.contracts.boardPos, r: 3.2, label: 'อ่านใบประกาศล่าค่าหัว', checkpoint: { x: TAVERN.x, z: TAVERN.z - 8 } });
    }
    // a private copy of the blade material so oil / the king's sword can make it glow
    const blade = this.view.userData.sword.children[0];
    blade.material = blade.material.clone();

    this.applySettings();
    this.bindUI();
    this.resize();
    addEventListener('resize', () => this.resize());
    this.input.onLockChange = (locked) => {
      if (!locked && this.state === 'play' && !this.input.touch) this.pause();
    };
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play') this.save(); });

    if (ARENA) this.player.place(ARENA_BASES[0][0] + 7, ARENA_BASES[0][1] + 7, 0);
    else this.player.place(SPAWN.x, SPAWN.z, Math.atan2(-(SPAWN.toward.x - SPAWN.x), -(SPAWN.toward.z - SPAWN.z)));
    this.state = 'title';
    this.startMenuMusic();
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('btn-continue').classList.toggle('hidden', !store.get(SAVE_KEY));

    if (ARENA) this.lobby.open();
    else if (params.has('autostart')) this.start(false);
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

  // the Moonmire of the story: village, temple, giants, the people who live there
  buildStoryWorld() {
    const scene = this.scene, M = this.M;
    const st = buildStructures(scene, this.terrain, M, this.collision);
    this.altar = st.altar;
    this.fx = st.fx;
    this.village = st.village;
    const toadLight = new THREE.PointLight(0xffb060, 6, 14, 1.5);
    toadLight.position.copy(st.lantern);
    scene.add(toadLight);
    this.veg = buildVegetation(scene, this.terrain, M, this.collision, this.quality);
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
      smith: { obj: this.village.smith.obj, pos: this.village.smith.pos, name: 'ลุงทั่ง' },
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
      { id: 'smith', pos: this.village.smith.pos, r: 3.2, label: 'คุยกับลุงทั่ง ช่างตีเหล็ก' },
    ];
  }

  // the online arena: no people, no quests; lanterned roads between four bases (src/arena.js)
  buildArenaWorld() {
    const scene = this.scene, M = this.M;
    const ar = buildArena(scene, this.terrain, M, this.collision);
    this.fx = ar.fx;
    this.veg = buildArenaVegetation(scene, this.terrain, M, this.collision, this.quality, arenaKeepOut(this.terrain));
    const far = new THREE.Vector3(0, -999, 0);
    this.altar = far;
    this.village = { indoor: { minX: 1e9, maxX: -1e9, minZ: 1e9, maxZ: -1e9, maxY: -1e9 }, patrons: [], keeper: null, smith: null };
    this.npcs = {};
    this.interactables = [];
  }

  bindUI() {
    const on = (id, fn) => document.getElementById(id).addEventListener('click', fn);
    on('btn-new', () => this.pickClass((id) => { if (!id) return; this.setClass(id); this.start(false); }));
    on('btn-continue', () => this.start(true));
    this.lobby = new Lobby(this);
    // the siege has its own map: the online button reloads into it, leaving goes back to Moonmire
    const page = (arena) => {
      const q = new URLSearchParams();
      if (params.get('peer')) q.set('peer', params.get('peer'));
      if (arena) q.set('arena', '');
      const qs = q.toString().replace(/arena=(&|$)/, 'arena$1');
      location.href = location.pathname + (qs ? `?${qs}` : '');
    };
    on('btn-online', () => { if (ARENA) { this.audio.init(); this.lobby.open(); } else page(true); });
    on('lobby-back', () => { this.lobby.leave(); page(false); });
    on('mobaover-back', () => page(true));
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
    bind('set-music', 'music');
    bind('set-sfx', 'sfx');
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
    this.audio?.setMusicVolume(this.settings.music);
    this.audio?.setSfxVolume(this.settings.sfx);
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
    this.applySettings();
    if (this.audio.ctx && !this.music) {
      this.music = new MusicDirector(this.audio);
      this.music.loadOverrides();
    }
    if (continueGame) this.load();
    if (params.get('event')) this.events.force(params.get('event'));
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
    if (this.state === 'title' || this.state === 'loading' || this.moba) return;   // online matches never touch the story save
    store.set(SAVE_KEY, {
      quests: this.quests.serialize(), combat: this.combat.serialize(), coins: this.coins, hp: this.player.hp,
      bag: this.bag.serialize(), gear: this.gear, loot: this.loot.serialize(),
      pos: { x: this.player.pos.x, z: this.player.pos.z }, yaw: this.player.yaw, checkpoint: this.checkpoint,
      time: this.dayNight.t, discovered: [...this.discovered],
      cls: this.kit.id, kit: this.kit.serialize(), classGear: [...this.classGear], events: this.events.serialize(), contracts: this.contracts.serialize(),
      progress: this.progress.serialize(), questStage: this.lastStage,
    });
  }

  load() {
    const d = store.get(SAVE_KEY);
    if (!d) return;
    this.quests.load(d.quests || {});
    this.coins = d.coins ?? 0;
    if (d.bag) this.bag.load(d.bag);
    else { this.bag.items = []; this.bag.add('potion', Math.max(0, d.potions ?? 1)); }   // saves from before the bag existed
    Object.assign(this.gear, d.gear || {});
    this.loot.load(d.loot);
    this.onGearChanged();
    this.checkpoint = d.checkpoint || this.checkpoint;
    if (typeof d.time === 'number') this.dayNight.t = d.time;
    this.discovered = new Set(d.discovered || []);
    this.combat.load(d.combat);
    this.classGear = new Set(d.classGear || []);
    this.progress.load(d.progress || {});
    this.lastStage = d.questStage ?? this.quests.stage;
    this.setClass(d.cls || 'wanderer', { gear: false });
    this.kit.load(d.kit || {});
    this.events.load(d.events || {});
    this.contracts.load(d.contracts || {});
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

  // ---------------------------------------------------------------- classes (src/classes.js)
  setClass(id, { gear = true } = {}) {
    if (!CLASSES[id]) id = 'wanderer';
    this.kit?.dispose();
    this.kit = createKit(id, this);
    this.player.regenMul = this.kit.regenMul;
    this.applyKitStats();
    this.player.climb = this.kit.climb;
    this.view.userData.lantern.visible = this.kit.showLantern;
    document.getElementById('beat').classList.toggle('hidden', id !== 'bell');
    if (gear && !this.classGear.has(id)) {
      this.classGear.add(id);
      for (const [item, n] of STARTING_GEAR[id] || []) this.bag.add(item, n);
    }
    this.hud.keys = {};          // repaint the weapon panel and face
    this.combat.swing = null;
  }

  // The path picker: on a new game, or when changing paths at the inn
  pickClass(done, { current = null } = {}) {
    const el = document.getElementById('classpick'), list = document.getElementById('classpick-list');
    list.innerHTML = '';
    const close = () => { el.classList.add('hidden'); removeEventListener('keydown', esc); };
    const esc = (e) => { if (e.code === 'Escape') { close(); done(null); } };
    for (const [id, c] of Object.entries(CLASSES)) {
      const card = document.createElement('button');
      card.className = 'cp-card' + (id === current ? ' current' : '');
      card.innerHTML = `<div class="cp-icon">${c.icon}</div><div class="cp-name">${c.name}</div><div class="cp-weapon">อาวุธ: ${c.weapon}</div>
        <div class="cp-blurb">${c.blurb}</div><ul>${c.lines.map((l) => `<li>${l}</li>`).join('')}</ul>`;
      card.addEventListener('click', () => { close(); this.audio.ui(); done(id); });
      list.appendChild(card);
    }
    document.getElementById('classpick-cancel').onclick = () => { close(); done(null); };
    document.getElementById('classpick-title').textContent = current ? 'เปลี่ยนวิถี' : 'เลือกวิถีของเจ้า';
    el.classList.remove('hidden');
    addEventListener('keydown', esc);
  }

  changeClassAtInn() {
    this.state = 'classpick';
    this.ui.setPrompt(null);
    if (document.pointerLockElement) document.exitPointerLock();
    this.pickClass((id) => {
      if (id && id !== this.kit.id) {
        this.setClass(id);
        this.ui.banner(CLASSES[id].name, `อาวุธใหม่: ${CLASSES[id].weapon}`);
        this.audio.discover();
      }
      this.resumePlay();
    }, { current: this.kit.id });
  }

  addCoins(n) {
    this.coins += n;
    this.audio.coin();
    this.ui.toast(`+${n} เหรียญทอง`);
    this.updateHud();
  }

  updateHud() {
    this.ui.setStats(this.player.hp, this.player.maxHp, this.coins, this.potionCount, this.combat.stamina, this.combat.exhausted);
    this.updateXPBar();
  }

  // ---------------------------------------------------------------- path upgrades (src/upgrades.js)
  useProgress(pr) {
    this.progress = pr;
    pr.onChange = (what, n, cls) => {
      if (what === 'xp' && n > 0) {
        this.ui.banner(`เลเวล ${pr.level}!`, `ได้แต้มอัพเกรด +${n} · กด K เพื่อเลือกสายอัพเกรด`);
        this.audio?.discover();
      }
      if (what === 'token' && cls === this.kit?.id) {
        const t = TREES[cls].token;
        this.ui.toast(`ได้${t.name} ${t.icon} +${n} (มี ${pr.tokens[cls]})`);
        this.audio?.chime();
      }
      this.updateXPBar();
    };
  }

  gainXP(n) { if (n > 0) this.progress.addXP(n); this.updateXPBar(); }

  // max health and the like follow the path's upgrades
  applyKitStats() {
    const p = this.player, max = 100 + (this.kit?.hpBonus || 0);
    if (p.maxHp !== max) { p.hp = Math.min(max, p.hp + Math.max(0, max - p.maxHp)); p.maxHp = max; }
  }

  updateXPBar() {
    const pr = this.progress, cls = this.kit?.id;
    if (!pr || !cls) return;
    const maxed = pr.level >= Progress.MAX_LEVEL, pts = pr.points(cls);
    const key = `${pr.level}|${Math.round(pr.xp)}|${pts}|${cls}`;
    if (key === this._xpKey) return;
    this._xpKey = key;
    document.getElementById('xp-lv').textContent = `Lv ${pr.level}`;
    document.getElementById('xp-fill').style.width = `${maxed ? 100 : (pr.xp / pr.need() * 100).toFixed(1)}%`;
    const el = document.getElementById('xp-pts');
    el.textContent = pts > 0 ? `+${pts} แต้ม [K]` : '';
    el.classList.toggle('pulse', pts > 0);
  }

  openSkills() {
    this.state = 'skills';
    this.ui.setPrompt(null);
    if (document.pointerLockElement) document.exitPointerLock();
    this.skillsUI.show();
  }

  onSkillsClosed() { this.resumePlay(); }

  onQuestChanged(saveNow = true) {
    // every step of the story is worth some experience
    if (this.lastStage == null) this.lastStage = this.quests.stage;
    if (this.quests.stage > this.lastStage) { this.gainXP(60 * (this.quests.stage - this.lastStage)); this.lastStage = this.quests.stage; }
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

  get potionCount() { return this.bag.count('potion') + this.bag.count('potion_big'); }

  // ---------------------------------------------------------------- bag, services, items
  // The world freezes while the case or a service screen is open (like RE4).
  openBag(pending = null) {
    this.state = 'bag';
    this.audio.bagOpen(true);
    this.ui.setPrompt(null);
    if (document.pointerLockElement) document.exitPointerLock();
    this.bagUI.show(pending);
  }

  onBagClosed() { this.audio.bagOpen(false); this.resumePlay(); }

  openMenu(kind) {
    this.state = 'menu';
    this.ui.setPrompt(null);
    if (document.pointerLockElement) document.exitPointerLock();
    this.menus.show(kind);
  }

  onMenuClosed() { this.resumePlay(); }

  resumePlay() {
    this.state = 'play';
    this.updateHud();
    this.save();
    this.input.requestLock();
  }

  // Use a consumable from the bag. Returns true when it was used up.
  useItem(it) {
    const def = ITEMS[it.id], p = this.player;
    if (def.heal) {
      if (p.hp >= p.maxHp) { this.ui.toast('เลือดเต็มอยู่แล้ว'); return false; }
      p.hp = Math.min(p.maxHp, p.hp + def.heal);
      this.ui.toast(`ดื่ม${def.name}`);
    } else if (def.buff) {
      const [name, secs] = def.buff;
      this.buffs[name] = secs;
      this.ui.toast(`${def.name} — ${secs} วินาที`);
    } else return false;
    this.audio.drink();
    if (it.count > 1) { it.count--; this.bag.changed(); } else this.bag.removeItem(it);
    this.updateHud();
    return true;
  }

  quickHeal() {
    const it = this.bag.items.filter((i) => i.id === 'potion').concat(this.bag.items.filter((i) => i.id === 'potion_big'))[0];
    if (!it) { this.ui.toast('ไม่มียาฟื้นพลัง — ปรุงได้ที่ยายคางคก หรือซื้อที่โรงเตี๊ยม'); return; }
    this.useItem(it);
  }

  // damage multiplier for the player's blows, and the share of incoming damage that gets through
  get damageMul() { return this.combat.swordMul * (1 + this.gear.sword * 0.2) * (this.buffs.oil > 0 ? 1.5 : 1); }

  get armorMul() { return 1 - this.gear.cloak * 0.08; }

  onGearChanged() {
    const lv = this.gear.lantern;
    this.lantern.distance = 16 * (1 + lv * 0.35);
    this.vmLight.distance = 3 * (1 + lv * 0.3);
    this.updateHud();
  }

  updateBuffs(dt) {
    let html = '';
    const names = { tonic: 'ยาบำรุงแรง', oil: 'น้ำมันดาบ', sight: 'ตาแมว' };
    for (const k of Object.keys(this.buffs)) {
      if (this.buffs[k] <= 0) continue;
      this.buffs[k] = Math.max(0, this.buffs[k] - dt);
      if (this.buffs[k] > 0) html += `<span class="buff">${names[k]} ${Math.ceil(this.buffs[k])}s</span>`;
    }
    for (const chip of this.contracts.chips()) html += `<span class="buff bounty">${chip}</span>`;
    for (const chip of this.events.chips()) html += `<span class="buff evt">${chip}</span>`;
    for (const chip of this.kit.chips()) html += `<span class="buff cls">${chip}</span>`;
    if (html !== this._buffHTML) { this._buffHTML = html; document.getElementById('buffs').innerHTML = html; }
    // blade glow: amber while oiled, cold blue for the stone king's sword
    const mat = this.view.userData.sword.children[0].material;
    if (this.buffs.oil > 0) mat.emissive.setRGB(0.55 + Math.sin(this.time * 9) * 0.08, 0.22, 0.04);
    else if (this.combat.swordMul > 1) mat.emissive.setRGB(0.18, 0.32, 0.55);
    else mat.emissive.setRGB(0, 0, 0);
  }

  // ---------------------------------------------------------------- online siege mode (src/moba.js)
  startMoba(net, roster, me) {
    const mine = roster.find((r) => r.slot === me);
    this.audio.init();
    this.audio.stopMusic(2);
    this.applySettings();
    if (this.audio.ctx && !this.music) this.music = new MusicDirector(this.audio);
    // an online match starts everyone at level 1 with fresh upgrades
    this.useProgress(new Progress({ online: true }));
    this.setClass(mine.cls);
    this.coins = 0;
    this.moba = new Moba(this, net, roster, me);
    this.discovered.add(`base${me}`);
    const [sx, sz, yaw] = baseSpawn(me);
    this.checkpoint = { x: sx, z: sz };
    this.player.place(sx, sz, yaw);
    document.getElementById('title').classList.add('hidden');
    document.body.classList.add('in-game', 'moba');
    this.ui.show('hud');
    this.ui.show('mobahud');
    this.resize();
    if (this.input.touch) this.ui.show('touch');
    this.state = 'play';
    this.input.enabled = true;
    this.input.requestLock();
    this.ui.banner('ศึกราชาจันทรา', `เจ้าคือฐาน${SEATS[me].name} — ปกป้องราชาของเจ้า`);
    setTimeout(() => this.ui.toast('ตัดไม้/ทุบหินด้วย [E] · ฆ่าสัตว์ป่าที่แคมป์ได้วิญญาณ · [B] สร้างและซัมม่อนครีป · [M] แผนที่ถนน'), 2500);
    setTimeout(() => this.ui.toast('ถนนทุกสายมีตะเกียงและป้ายบอกทาง — เดินตามถนนไปถึงทุกฐาน'), 6500);
  }

  // building placement: a ghost of the building follows your gaze; click to build, right-click to cancel
  startPlacing(type) {
    const ghost = this.moba.buildingMesh(type, this.moba.me);
    ghost.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.55; } });
    this.scene.add(ghost);
    this.placing = { type, ghost, ry: 0 };
    this.ui.toast('คลิกซ้ายเพื่อสร้าง · คลิกขวาเพื่อยกเลิก · T หมุน');
  }

  updatePlacing(input) {
    const pl = this.placing;
    if (!pl) return false;
    const p = this.player, x = p.pos.x - Math.sin(p.yaw) * 5, z = p.pos.z - Math.cos(p.yaw) * 5;
    if (input.consume('turn')) pl.ry += Math.PI / 4;
    pl.ghost.position.set(x, this.terrain.getHeight(x, z), z);
    pl.ghost.rotation.y = p.yaw + pl.ry;
    const bad = this.moba.canPlace(pl.type, this.moba.me, x, z);
    pl.ghost.traverse((o) => { if (o.material?.color && o.isMesh) o.material.emissive?.setRGB(bad ? 0.5 : 0, bad ? 0 : 0.35, 0); });
    this.ui.setPrompt(bad ? `✕ ${bad}` : `[คลิก] สร้าง${BUILDINGS[pl.type].name}`);
    const done = () => { this.scene.remove(pl.ghost); this.placing = null; this.ui.setPrompt(null); };
    if (input.consume('attack')) { if (this.moba.requestBuild(pl.type, x, z, p.yaw + pl.ry)) done(); }
    else if (input.blockHeld || input.consume('build')) { done(); input.mouseBlock = false; }
    return false;
  }

  mobaOver(win, seat, name) {
    const el = document.getElementById('mobaover');
    document.getElementById('mobaover-title').textContent = win == null ? 'การเชื่อมต่อขาด' : win ? 'ชัยชนะ!' : 'จบเกม';
    document.getElementById('mobaover-text').textContent = win == null ? 'โฮสต์ออกจากเกมไปแล้ว' : win ? 'ราชาของเจ้าคือราชาองค์สุดท้ายแห่งบึงจันทรา' : `ผู้ชนะคือฐาน${seat} (${name})`;
    if (document.pointerLockElement) document.exitPointerLock();
    this.state = 'paused';
    el.classList.remove('hidden');
    if (win) this.music?.sting('victory');
  }

  // quest targets first, then whatever the world is up to (the pedlar, a fallen star, a chest)
  allMarkers() {
    if (this.moba) return this.moba.markers();
    if (ARENA) return [];
    return [...this.quests.markers(), ...this.contracts.markers(), ...this.events.markers()].slice(0, 6);
  }

  interact(id) {
    const it = this.interactables.find((i) => i.id === id);
    if (id === 'merchant') { this.ui.openDialogue(this.events.talk(), () => this.updateHud()); return; }
    if (id === 'board') { this.audio.ui(); this.openMenu('board'); return; }
    if (id.startsWith('node:')) { this.moba?.gather(id); return; }
    if (id.startsWith('clue:')) { this.contracts.inspect(id); return; }
    this.checkpoint = it.checkpoint || { x: this.npcs[id].pos.x + 2, z: this.npcs[id].pos.z + 2 };
    if (id === 'crow') this.audio.caw(this.npcs.crow.obj.position);
    if (id === 'toad') this.audio.croak(this.npcs.toad.obj.position);
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
    const locs = ARENA ? ARENA_LOCATIONS : LOCATIONS;
    for (const loc of locs) {
      if (this.discovered.has(loc.id) || Math.hypot(p.x - loc.x, p.z - loc.z) > loc.r) continue;
      this.discovered.add(loc.id);
      this.ui.discover(loc.name, this.discovered.size, locs.length);
      this.audio.discover();
      this.save();
    }
  }

  applyDayNight(dt, rainI, flash) {
    const dn = this.dayNight;
    if (this.state !== 'sleeping') dn.update(dt);
    const P = dn.p;
    const sky = this.sky.material.uniforms;
    // world events: a blood moon stains everything red; a fog bank swallows the distance
    const ev = this.events, blood = ev?.blood ?? 0, fog = ev?.fog ?? 0;
    this.scene.fog.color.setRGB(...P.fog);
    if (blood > 0) this.scene.fog.color.lerp(TMP_COLOR.setRGB(0.24, 0.03, 0.04), blood * 0.75);
    if (fog > 0) this.scene.fog.color.lerp(TMP_COLOR.setRGB(...(P.day > 0.5 ? [0.36, 0.38, 0.37] : [0.12, 0.14, 0.18])), fog * 0.7);
    this.scene.background.copy(this.scene.fog.color);
    const sight = this.buffs.sight > 0 ? 1 - P.day : 0;   // cat's-eye potion: see through the night
    this.scene.fog.density = (P.density - 0.001 + rainI * 0.0025) * (1 - sight * 0.45) * (1 + fog * 3.2);
    sky.uHorizon.value.copy(this.scene.fog.color);
    sky.uZenith.value.setRGB(...P.zenith);
    sky.uCloudDark.value.setRGB(...P.cloudDark);
    sky.uCloudLit.value.setRGB(...P.cloudLit);
    sky.uSunDir.value.copy(dn.sunDir);
    sky.uDay.value = P.day;
    sky.uStars.value = P.stars * (1 - rainI * 0.6) * (1 - fog * 0.8);
    sky.uBlood.value = blood;
    sky.uAurora.value = P.aurora * (1 - rainI * 0.5);
    sky.uVortex.value = P.vortex;
    sky.uCloud.value = 0.35 + rainI * 0.6 + P.cloud;
    sky.uFlash.value = flash;
    // light dims indoors so the inn is lit by its candles and hearth
    const dim = 1 - this.indoor * 0.65;
    this.hemi.color.setRGB(...P.hemiSky);
    this.hemi.groundColor.setRGB(...P.hemiGround);
    this.hemi.intensity = (P.hemiI + flash * 4) * dim * (1 + sight * 1.3);
    this.moon.color.setRGB(P.light[0], P.light[1] * (1 - blood * 0.55), P.light[2] * (1 - blood * 0.6));
    if (blood > 0) this.hemi.color.multiply(TMP_COLOR.setRGB(1, 1 - blood * 0.45, 1 - blood * 0.5));
    this.moon.intensity = P.lightI * dim;
    this.moon.position.copy(dn.lightDirection(MOON_DIR)).multiplyScalar(100);
    this.water.material.uniforms.uFlash.value = flash;
    this.water.material.uniforms.uDay.value = P.day;
    this.water.material.uniforms.uBlood.value = blood;
    const pu = this.pipeline.uniforms;
    pu.uFlash.value = flash;
    pu.uDay.value = P.day;
    pu.uBloom.value = P.bloom;
  }

  // what the feet are on: water, the inn's floorboards, stone (anything built above the ground) or grass
  stepSurface(wet) {
    if (wet) return 'water';
    if (this.indoor > 0.5) return 'wood';
    const p = this.player.pos;
    return p.y > this.terrain.getHeight(p.x, p.z) + 0.25 ? 'stone' : 'grass';
  }

  // Pick the music: the knight's hymn, battle, the inn's jig, day or night, and a deep choir that
  // swells as you approach the giants. Combat keeps playing a few seconds after the last foe.
  updateMusic(dt, halted) {
    const m = this.music;
    if (!m) return;
    const playing = this.state === 'play' || halted;
    if (!playing) { m.mix({}, { fade: this.state === 'dead' ? 1 : 3 }); m.update(); return; }
    const c = this.combat, p = this.player.pos, P = this.dayNight.p;
    if (c.engaged > 0) this.combatHeat = 7;
    else this.combatHeat = Math.max(0, (this.combatHeat || 0) - dt);
    const boss = c.bossEngaged, fight = this.combatHeat > 0 && !boss;
    const dTav = ARENA ? 1e9 : Math.hypot(p.x - TAVERN.x, p.z - TAVERN.z);
    const tav = Math.max(this.indoor, clamp(1 - (dTav - 9) / 22, 0, 1) * 0.45);
    let awe = 0;
    const giants = ARENA ? [[{ x: 0, z: 0 }, 70]] : [[CASTLE, 150], [HEAD, 110], [RIBCAGE, 70]];
    for (const [o, r] of giants) awe = Math.max(awe, clamp((1 - Math.hypot(p.x - o.x, p.z - o.z) / r) * 1.8, 0, 1));
    const explore = fight || boss ? 0 : 1 - tav;
    const q = (v) => Math.round(v * 20) / 20;
    const blood = this.events.blood;
    m.mix({
      night: q(explore * (1 - P.day) * (1 - blood)), blood: q(explore * (1 - P.day) * blood), day: q(explore * P.day), awe: q(explore * awe * 0.9),
      tavern: q(tav * (fight || boss ? 0.3 : 1)), combat: fight ? 1 : 0, boss: boss ? 1 : 0,
    }, {
      intensity: clamp(c.engaged / 4 + (this.player.hp < this.player.maxHp * 0.35 ? 0.35 : 0), 0, 1),
      muffle: this.indoor < 0.5 ? 1 : 0,
      fade: 3,
    });
    m.update();
  }

  animateNpcs(dt) {
    const p = this.player, crow = this.npcs.crow.obj;
    const dCrow = crow.position.distanceTo(p.pos);
    crow.rotation.z = Math.sin(this.time * 0.9) * 0.015;
    const crowGoal = dCrow < 7 ? Math.atan2(p.pos.x - crow.position.x, p.pos.z - crow.position.z) : crow.userData.baseRy;
    crow.userData.ry = (crow.userData.ry ?? crow.userData.baseRy) + wrapHeading(crowGoal - (crow.userData.ry ?? crow.userData.baseRy)) * Math.min(1, dt * 3);
    crow.rotation.y = crow.userData.ry;
    const toad = this.npcs.toad.obj;
    toad.scale.set(1, 1 + Math.sin(this.time * 1.8) * 0.02, 1);
    for (const [i, pt] of this.village.patrons.entries()) pt.rotation.z = Math.sin(this.time * 0.7 + i * 1.9) * 0.04;
    this.village.keeper.obj.userData.halo.scale.setScalar(1.6 * (1 + Math.sin(this.time * 11) * 0.08));
  }

  die() {
    this.state = 'dead';
    this.deadT = 0;
    if (this.moba) {
      const by = this.combat.lastHitBy;
      if (!this.moba.host) this.moba.net.send({ t: 'died', by });
      else if (by != null && by !== this.moba.me) this.moba.reward(by, { soul: 3, xp: 40 }, `ฆ่า ${this.moba.P[this.moba.me].name}`);
    }
    this.audio.hurt();
    this.audio.death();
    this.music?.sting('death');
  }

  updatePlay(dt) {
    const p = this.player, input = this.input, ui = this.ui;
    const mapOpen = !document.getElementById('map').classList.contains('hidden');
    const frozen = ui.dialogueOpen || mapOpen;

    if (ui.dialogueOpen) ui.updateDialogue(dt, input);
    if (input.consume('map') && !ui.dialogueOpen) ui.show('map', mapOpen ? false : true);
    if (input.consume('pause')) { if (document.pointerLockElement) document.exitPointerLock(); this.pause(); return; }

    const c = this.combat;
    if (this.moba && this.updatePlacing(input)) return;
    c.updatePlayer(dt, input, frozen);
    p.update(dt, input, this.time, frozen, c.playerMods());

    if (!frozen) {
      if (input.consume('potion')) this.quickHeal();
      if (input.consume('bag')) { this.openBag(); return; }
      if (this.moba && input.consume('build') && !this.moba.over) { this.openMenu('moba'); return; }
      if (input.consume('skills')) { this.openSkills(); return; }
      // nearest interactable in front of the player
      let best = null, bd = Infinity;
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
      for (const it of this.interactables) {
        const dx = it.pos.x - p.pos.x, dz = it.pos.z - p.pos.z, d = Math.hypot(dx, dz);
        if (d < it.r && d < bd && (d < 1.5 || (dx * fx + dz * fz) / d > 0.2) && Math.abs(it.pos.y - p.pos.y) < 3) { bd = d; best = it; }
      }
      // loose items, herbs, ore and chests compete with NPCs for the prompt
      const lt = this.loot.nearest(p.pos, fx, fz);
      const verb = input.touch ? '✋' : '[E]';
      if (lt && lt.d < bd) {
        ui.setPrompt(`${verb} ${lt.label}`);
        if (input.consume('interact')) { ui.setPrompt(null); lt.act(); }
      } else {
        ui.setPrompt(best ? `${verb} ${best.label}` : null);
        if (best && input.consume('interact')) { ui.setPrompt(null); this.interact(best.id); }
      }
    } else {
      ui.setPrompt(null);
    }
    c.updateViewModel(dt);

    // lost sheep
    if (this.quests.stage === 1) {
      this.lostSheep.forEach((s, i) => {
        if (s.mode === 'lost' && Math.hypot(s.x - p.pos.x, s.z - p.pos.z) < 3.5 && this.quests.onSheepFound(i)) {
          this.flock.sendHome(s);
          this.audio.bleat({ x: s.x, y: p.pos.y, z: s.z });
          this.ui.toast(`พบแกะดำ ${this.quests.sheepCount}/3 — มันวิ่งกลับไปหาฝูงแล้ว`);
        }
      });
    }

    c.updateEnemies(dt, true);
    if (this.moba) this.moba.update(dt);
    else { this.events.update(dt); this.contracts.update(dt); }
    this.updateBuffs(dt);
    this.checkDiscoveries();
    const v = this.village.indoor;
    const inside = p.pos.x > v.minX && p.pos.x < v.maxX && p.pos.z > v.minZ && p.pos.z < v.maxZ && p.pos.y < v.maxY;
    this.indoor += ((inside ? 1 : 0) - this.indoor) * Math.min(1, dt * 4);
    if (p.hp <= 0) this.die();

    // in the arena every place is on the map from the start
    if (mapOpen) ui.drawMap(p, this.allMarkers(), ARENA ? ARENA_IDS : this.discovered, ARENA ? ARENA_LOCATIONS : LOCATIONS);
    this.updateHud();
    this.saveTimer = (this.saveTimer || 0) + dt;
    if (this.saveTimer > 20) { this.saveTimer = 0; this.save(); }
  }

  frame() {
    let dt = Math.min(0.05, this.clock.getDelta());
    const rawDt = dt;
    // the world holds still behind the case, shops and the pause menu
    const halted = this.state === 'bag' || this.state === 'menu' || this.state === 'paused' || this.state === 'classpick' || this.state === 'skills';
    if (halted) dt = 0;
    if (this.state === 'bag') this.bagUI.update(this.input);
    if (this.state === 'menu') this.menus.update(this.input);
    if (this.state === 'skills') this.skillsUI.update(this.input);
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
      if (this.deadT > (this.moba ? 6 : 2)) {
        if (this.moba) { const [sx, sz] = baseSpawn(this.moba.me); this.checkpoint = { x: sx, z: sz }; }
        p.place(this.checkpoint.x, this.checkpoint.z, p.yaw);
        p.hp = p.maxHp;
        this.combat.resetAggro();
        this.combat.stamina = this.combat.maxStamina;
        const lost = this.moba ? 0 : Math.floor(this.coins * 0.25);
        this.coins -= lost;
        this.state = 'play';
        this.ui.toast(lost ? `เจ้าฟื้นขึ้นมาอีกครั้ง... ทำเหรียญหล่นหาย ${lost} เหรียญ` : 'เจ้าฟื้นขึ้นมาอีกครั้ง...');
      }
    }
    // an online match never stops for one player's menu, bag, pause or death
    if (this.moba && this.state !== 'play') {
      this.moba.update(rawDt);
      if (halted) this.combat.updateEnemies(rawDt, false);
    }
    if (this.state !== 'dead' && this.state !== 'sleeping') {
      const u = this.pipeline.uniforms.uFade;
      u.value = Math.max(this.state === 'play' ? this.kit.darkness : 0, u.value - dt * 1.5);
    }

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
    if (this.state !== 'play' && !halted) this.combat.updateEnemies(dt, false);
    this.particles.update(dt);
    this.loot.update(dt, this.time);

    // NPC idle animation
    if (!ARENA) this.animateNpcs(dt);
    for (const f of this.fx.fires) f.s.scale.setScalar(f.base * (1 + Math.sin(this.time * 9 + f.ph) * 0.1 + Math.sin(this.time * 23 + f.ph * 2) * 0.06));
    for (const m of this.fx.mists) m.s.scale.setScalar(m.base * (1 + Math.sin(this.time * 0.6 + m.ph) * 0.12));
    for (const l of this.fx.lights) l.l.intensity = l.base * (1 + Math.sin(this.time * 8 + l.base) * 0.08 + Math.sin(this.time * 17) * 0.05);
    if (this.endingBeam) this.endingBeam.material.opacity = 0.45 + Math.sin(this.time * 2) * 0.1;

    // lantern follows the player; view model bobs
    const flick = 1 + Math.sin(this.time * 13) * 0.04 + Math.sin(this.time * 7.3) * 0.05;
    this.lantern.position.copy(this.camera.position).add(new THREE.Vector3(0, -0.3, 0));
    this.lantern.intensity = this.state === 'title' ? 0 : 6 * flick * this.dayNight.p.lantern * (1 - this.indoor * 0.6) * (1 + this.gear.lantern * 0.35) * this.kit.lightMul;
    this.viewCam.position.copy(this.camera.position);
    this.viewCam.quaternion.copy(this.camera.quaternion);
    const lan = this.view.userData.lantern;
    lan.position.set(-0.3, -0.36 + p.bob * 0.7 + Math.sin(this.time * 1.7) * 0.006, -0.5);
    lan.rotation.z = Math.sin(p.bobT) * 0.08 * p.moving;
    this.view.userData.flame.scale.setScalar(flick);
    this.view.visible = this.state === 'play' || halted;
    if (this.state !== 'play') this.combat.updateViewModel(dt);

    if (this.state !== 'title' && this.state !== 'loading') {
      const c = this.combat;
      this.hud.update(dt, {
        hp: p.hp, maxHp: p.maxHp, stamina: c.stamina, exhausted: c.exhausted, dead: this.state === 'dead' || p.hp <= 0,
        attacking: !!c.swing || (c.charging && c.heavyReady), swordMul: c.swordMul, swordLv: this.gear.sword, damageMul: this.damageMul, potions: this.potionCount, coins: this.coins, time: this.time,
        kit: this.kit,
      });
    }
    this.clockTimer = (this.clockTimer || 0) - dt;
    if (this.clockTimer <= 0) {
      this.clockTimer = 0.5;
      this.ui.setClock(this.dayNight.clockText());
      this.ui.setQuest(this.moba ? { title: 'ศึกราชาจันทรา', text: 'ปกป้องราชาของเจ้า และสังหารราชาของผู้อื่น' } : this.quests.objective());
    }
    if (this.state === 'play' || halted) {
      this.ui.updateCompass(wrapHeading(-p.yaw), p.pos.x, p.pos.z, this.allMarkers());
    }

    // sound follows the camera; the score follows the situation
    if (this.audio.ctx) {
      this.audio.updateListener(this.camera);
      this.audio.duckMusic(halted);
      this.ambience.update(dt);
      this.updateMusic(dt, halted);
    }

    this.pipeline.render(this.scene, this.camera, this.view.visible ? this.overlay : null);
    this.input.endFrame();
  }
}

const wrapHeading = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const TMP_COLOR = new THREE.Color();

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
