// v4.4 — animated low-poly cow and sheep from Quaternius's Farm Animal Pack (CC0,
// https://quaternius.com/packs/farmanimal.html), converted FBX → GLB with the game palette baked into
// vertex colours (models/cow.glb, models/sheep.glb; bundled, no network). Loaded once at start with
// GLTFLoader; each animal is a SkeletonUtils clone (shared geometry, own skeleton) with its own
// AnimationMixer. Fitted to the size of the old procedural model so pens, stalls and hit areas stay put.
// If a file fails to load, render3d keeps the procedural cowGeo / sheepGeo.
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { clone as skClone } from '../vendor/SkeletonUtils.js';
import * as M from './models.js';

const SRC = { cow: '../models/cow.glb', sheep: '../models/sheep.glb' };
// procedural model each one replaces → its footprint is the size target
const PROC = { cow: () => M.cowGeo(), sheep: () => M.sheepGeo() };
const LIB = {};
let loading = null;

export function loadAnimals() {
  if (loading) return loading;
  const loader = new GLTFLoader();
  loading = Promise.all(Object.keys(SRC).map((kind) => new Promise((res) => {
    loader.load(new URL(SRC[kind], import.meta.url).href, (gltf) => {
      try { LIB[kind] = prep(kind, gltf); } catch (e) { console.warn('animal model', kind, e); }
      res();
    }, undefined, (e) => { console.warn('animal model failed, using procedural', kind, e && e.message); res(); });
  })));
  return loading;
}
export const hasAnimal = (kind) => !!LIB[kind];

const MAT = () => M.vcMat('vcSkin');
function prep(kind, gltf) {
  const scene = gltf.scene;
  scene.traverse((o) => { if (o.isMesh) { o.material = MAT(); o.castShadow = true; o.frustumCulled = false; } });
  scene.updateMatrixWorld(true);
  const clips = {}; for (const a of gltf.animations) clips[a.name.toLowerCase()] = a;
  // pose the template in Idle frame 0 so the measured size is the standing pose, not the bind pose
  const mx = new THREE.AnimationMixer(scene); if (clips.idle) { mx.clipAction(clips.idle).play(); mx.update(0); }
  scene.updateMatrixWorld(true);
  const box = skinnedBox(scene), sz = box.getSize(new THREE.Vector3());
  mx.stopAllAction(); mx.uncacheRoot(scene);
  if (kind === 'sheep') addWool(scene);
  const pg = PROC[kind](); pg.computeBoundingBox(); const pb = pg.boundingBox, ps = pb.getSize(new THREE.Vector3()); pg.dispose();
  // same height as the old model, but never longer than it by more than 20 % (stall gap is tight)
  const s = Math.min(ps.y / sz.y, (ps.z * 1.2) / sz.z, (ps.x * 1.4) / sz.x);
  const off = new THREE.Vector3(-(box.min.x + box.max.x) / 2 * s + (pb.min.x + pb.max.x) / 2, -box.min.y * s, -(box.min.z + box.max.z) / 2 * s + (pb.min.z + pb.max.z) / 2);
  off.z += kind === 'cow' ? 3 : 1.5;   // a step forward from the fence rail (the GLB bodies are longer than the old ones)
  return { scene, clips, s, off };
}

// the Quaternius sheep is smooth-bodied; give it the game's fluffy wool puffs (the same look as the wool
// balls it produces) on the back and a tuft on the head, skinned along by parenting them to the bones.
// render3d shrinks them for a moment when the sheep is shorn (a wool ball pops out) and lets them regrow.
function addWool(scene) {
  let torso = null, head = null;
  scene.traverse((o) => { if (o.isBone && o.name === 'Torso') torso = o; if (o.isBone && o.name === 'Head') head = o; });
  if (!torso) return;
  const W = '#FFFFFF', C = '#F3EEE4', back = [];
  for (const [x, y, z, r, c] of [[0, 330, -120, 92, W], [0, 352, 10, 96, W], [0, 335, 120, 80, C], [-78, 282, -70, 78, C], [78, 282, -70, 78, C], [-80, 288, 60, 74, W], [80, 288, 60, 74, W], [0, 300, -205, 70, C], [0, 248, 0, 80, C]]) back.push(M.P(M.ico(1, 1), c, [x, y, z], [x * 0.01, z * 0.01, 0], [r, r * 0.9, r]));
  const wool = new THREE.Mesh(M.merge(back), MAT()); wool.name = 'wool'; wool.castShadow = true;
  scene.updateMatrixWorld(true); torso.attach(wool);
  if (head) { const tuft = new THREE.Mesh(M.merge([M.P(M.ico(1, 1), W, [0, 455, 215], [0, 0, 0], [46, 34, 42]), M.P(M.ico(1, 0), C, [0, 470, 190], [0.5, 0, 0], [30, 24, 30])]), MAT()); tuft.name = 'tuft'; head.attach(tuft); }
}

// bounding box of the posed (skinned) vertices, in the scene's space
function skinnedBox(scene) {
  const box = new THREE.Box3(), v = new THREE.Vector3();
  scene.traverse((o) => { if (o.isSkinnedMesh) { o.skeleton.update(); const n = o.geometry.attributes.position.count; for (let i = 0; i < n; i++) { o.getVertexPosition(i, v); box.expandByPoint(v.applyMatrix4(o.matrixWorld)); } } });
  return box;
}

// returns { root, mixer, kind, ... } or null when the model is not loaded
export function makeAnimal(kind, seed = 0) {
  const L = LIB[kind]; if (!L) return null;
  const root = new THREE.Group(), body = skClone(L.scene);
  body.scale.setScalar(L.s); body.position.copy(L.off); root.add(body);
  body.traverse((o) => { if (o.isMesh) { o.material = MAT(); o.castShadow = true; o.frustumCulled = false; } });
  let wool = null; body.traverse((o) => { if (o.name === 'wool') wool = o; });
  const mixer = new THREE.AnimationMixer(body), act = {};
  for (const k of ['idle', 'walk', 'jump']) if (L.clips[k]) act[k] = mixer.clipAction(L.clips[k]);
  if (act.jump) { act.jump.setLoop(THREE.LoopOnce, 1); act.jump.clampWhenFinished = false; }
  const a = { root, body, mixer, act, kind, wool, woolS: wool ? wool.scale.x : 1, cur: null, seed, acc: 0,
    // visual-only stroll for animals with a Walk clip (cows): out a few steps into the pen and back
    walk: { phase: 0, t: 3 + (seed * 7.31 % 1) * 9, x: 0, z: 0, yaw: 0, tx: 0, tz: 0 } };
  play(a, 'idle', 0); if (act.idle) act.idle.time = (seed * 2.37) % L.clips.idle.duration;
  mixer.addEventListener('finished', (e) => { if (e.action === act.jump) play(a, a.walk.phase ? 'walk' : 'idle', 0.25); });
  return a;
}
function play(a, k, fade = 0.3) {
  const n = a.act[k]; if (!n || a.cur === n) return;
  n.reset(); n.enabled = true; n.setEffectiveWeight(1); n.play();
  if (a.cur && fade > 0) a.cur.crossFadeTo(n, fade, false); else if (a.cur) a.cur.stop();
  a.cur = n;
}
// a happy hop when a bottle / wool ball pops out
export function hop(a) { if (a.act.jump && a.cur !== a.act.jump && !a.walk.phase) play(a, 'jump', 0.15); }

// dt-driven state: stroll (Walk) ↔ stand (Idle); mixers advance in update()
export function step(a, dt) {
  const w = a.walk; if (!a.act.walk) return;
  w.t -= dt;
  if (w.phase === 0) {
    if (w.t <= 0 && a.cur !== a.act.jump) {   // pick a spot a few steps into the pen
      const r = Math.sin(a.seed * 12.9898 + performance.now() * 0.001) * 43758.5453; const u = r - Math.floor(r);
      w.tx = (u - 0.5) * 10; w.tz = 6 + u * 5; w.phase = 1; play(a, 'walk', 0.3);
    }
  } else {
    const gx = w.phase === 1 ? w.tx : 0, gz = w.phase === 1 ? w.tz : 0, dx = gx - w.x, dz = gz - w.z, d = Math.hypot(dx, dz);
    const want = d > 0.3 ? Math.atan2(dx, dz) : 0;
    let dy = want - w.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); w.yaw += dy * Math.min(1, dt * 4);
    const sp = 4.2 * dt;
    if (d <= sp || d < 0.3) { w.x = gx; w.z = gz;
      if (w.phase === 1) w.phase = 2; else { w.phase = 0; w.t = 6 + Math.random() * 10; play(a, 'idle', 0.35); }
    } else if (Math.abs(dy) < 1.2) { w.x += dx / d * sp; w.z += dz / d * sp; }
  }
  if (w.phase === 0) { let dy = -w.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); w.yaw += dy * Math.min(1, dt * 3); }
  a.root.position.set(w.x, a.root.position.y, w.z); a.root.rotation.y = w.yaw;
}

// advance every mixer; with many animals on screen they share the work (each updated every other frame)
let frame = 0;
export function updateMixers(list, dt) {
  frame++;
  const half = list.length > 16;
  for (let i = 0; i < list.length; i++) {
    const a = list[i]; a.acc += dt;
    if (!a.root.parent || !a.root.parent.visible) continue;
    if (half && (i + frame) % 2) continue;
    a.mixer.update(a.acc); a.acc = 0;
  }
}
