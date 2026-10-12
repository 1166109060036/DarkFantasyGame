// The wendigo: a starved thing with a deer's skull that walks the yellow halls inside Sky-Hung
// Castle (src/backrooms.js). It is built on the heroes' rig (src/heroes.js) from an imported,
// skinned model (assets/heroes/wendigo.json, "Wendingo" by sultan, CC-BY-4.0, see the README).
//
// It is shy: while you look straight at it, it only creeps; look away and it runs.
import * as THREE from 'three';
import { createHero, animateHero, loadRiggedModel } from './heroes.js';
import { clamp } from './util.js';

const PALE = new THREE.Color(0.5, 0.46, 0.4);
let ready = false, eyeMat = null, loading = null;
// fetched only when first wanted (the model is the biggest file of the halls)
export function preloadWendigo() {
  return (loading ||= loadRiggedModel('wendigo').then((ok) => { ready = ok; return ok; }));
}

export function createWendigo(M) {
  const obj = new THREE.Group();
  obj.name = 'wendigo';
  const ud = obj.userData;
  // the stand-in (a gaunt wanderer) until the model has loaded, then the real body
  const build = () => {
    if (ud.hero) obj.remove(ud.hero);
    const hero = createHero(ready ? 'wendigo' : 'wanderer', M, PALE);
    if (!ready) hero.scale.set(0.9, 1.35, 0.9);
    hero.userData.weapon.visible = false;            // claws, not a blade
    hero.traverse((o) => { o.frustumCulled = false; });
    obj.add(hero);
    ud.hero = hero;
    ud.real = ready;
    // two pin-points of light in the skull's sockets, so it is seen before it is made out
    hero.userData.rig.bones.head.add(eyes);
    eyes.position.set(0, ready ? 0.1 : 0.12, ready ? 0.16 : 0.12);
  };
  eyeMat ||= Object.assign(M.candleSprite.clone(), { fog: false });
  const eyes = new THREE.Sprite(eyeMat);
  eyes.scale.set(0.3, 0.1, 1);
  ud.eyes = eyes;
  build();
  if (!ready) preloadWendigo().then(() => { if (ready) build(); });

  ud.animate = (e, dt, t, st) => {
    const hero = ud.hero;
    let action = 0;
    // the claws go up as the windup begins
    if (e.state === 'windup' && !e.clawUp) { e.clawUp = true; action = 2; }
    if (e.state !== 'windup' && e.state !== 'strike') e.clawUp = false;
    if (st.dying != null) {
      const k = clamp(st.dying, 0, 1);
      hero.rotation.x = -k * 1.35;
      hero.position.y = -k * 0.3;
      eyes.visible = k < 0.6;
    } else {
      hero.rotation.x = st.stagger ? -0.25 : 0;
      hero.position.y = 0;
      eyes.visible = true;
    }
    // watched, it creeps with its head on one side; unwatched it bolts
    const speed = (e.curSpeed || 0) * (e.running ? 1.4 : 1);
    animateHero(hero, dt, { speed, action });
    if (e.creep) hero.userData.rig.bones.head.rotation.z = 0.5;
  };
  return obj;
}
