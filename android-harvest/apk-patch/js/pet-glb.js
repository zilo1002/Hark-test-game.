// APK-only: plush pets made from Hunyuan 3D models (generated from the shop's plush pet pictures, 2026-11-17/18).
// Each model is skinned to makePet()'s own pivots (body, 4 hips, head, tail), so walking, sitting and lounging
// still move it. Until a model loads (or if it fails) the procedural plush pet stays.
//   tortie  花斑猫   (side-profile rig, like the procedural tortie)
//   orange  橘猫     shiba 柴犬     rabbit 绒绒兔     penguin 小企鹅   (facing +z like every other pet)
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

// joints are in model heights (feet at y 0); feet: front-left, front-right, back-left, back-right (x, z)
const MODELS = {
  tortie:  { file: 'tortie.glb', hs: 21, profile: true, hipY: 0.2,
    feet: [[-0.3196, -0.0912], [-0.3056, 0.1023], [0.2101, -0.1221], [0.2581, 0.1223]], head: [-0.3954, 0.72, 0.0766], tail: [0.42, 0.38, 0.0376] },
  orange:  { file: 'pet_orange.glb', hs: 17, hipY: 0.2,
    feet: [[-0.0969, 0.3342], [0.1181, 0.3059], [-0.1579, -0.2933], [0.1628, -0.3106]], head: [0, 0.5, 0.33], tail: [0, 0.45, -0.42] },
  shiba:   { file: 'pet_shiba.glb', hs: 18, hipY: 0.18,
    feet: [[-0.0899, 0.33], [0.2118, 0.2936], [-0.2152, -0.2588], [0.0984, -0.3068]], head: [0, 0.6, 0.3], tail: [0, 0.55, -0.25] },
  rabbit:  { file: 'pet_rabbit.glb', hs: 14, hipY: 0.1,
    feet: [[-0.1678, 0.3701], [0.1647, 0.3519], [-0.1845, -0.3141], [0.1879, -0.3192]], head: [0, 0.45, 0.35], tail: [0, 0.25, -0.6] },
  penguin: { file: 'pet_penguin.glb', hs: 18, hipY: 0.08,
    feet: [[-0.1525, 0.0613], [0.1583, 0.0481], [-0.1525, 0.0613], [0.1583, 0.0481]], head: [0, 0.55, 0.0], tail: [0, 0.2, -0.3] },
  fox: { file: 'pet_fox.glb', hs: 18, hipY: 0.2,
    feet: [[-0.1322, 0.258], [0.0997, 0.2878], [-0.0942, -0.2416], [0.1393, -0.1856]], head: [-0.05, 0.55, 0.22], tail: [0, 0.45, -0.25] },
  tux: { file: 'pet_tux.glb', hs: 17, hipY: 0.15,
    feet: [[-0.092, 0.2892], [0.1294, 0.2767], [-0.1296, -0.2743], [0.1312, -0.2633]], head: [0, 0.5, 0.28], tail: [0, 0.45, -0.32] },
  white: { file: 'pet_white.glb', hs: 17, hipY: 0.15,
    feet: [[-0.0947, 0.2773], [0.0993, 0.3149], [-0.1081, -0.2781], [0.1064, -0.1917]], head: [0, 0.55, 0.22], tail: [0, 0.5, -0.22] },
  owl: { file: 'pet_owl.glb', hs: 16, hipY: 0.06,
    feet: [[-0.1321, 0.0317], [0.1287, 0.0225], [-0.1321, 0.0317], [0.1287, 0.0225]], head: [0, 0.6, 0.05], tail: [0, 0.2, -0.3] },
  starshiba: { file: 'pet_starshiba.glb', hs: 18, hipY: 0.18,   // 6.1.6 星空柴犬 (Hunyuan, 2026-11-19)
    feet: [[-0.1286, 0.3027], [0.1524, 0.3491], [-0.154, -0.3214], [0.1223, -0.2923]], head: [0, 0.65, 0.35], tail: [0, 0.6, -0.3] },
  xuanmao: { file: 'pet_xuanmao.glb', hs: 17, hipY: 0.12,        // 6.1.6 玄猫
    feet: [[-0.1025, 0.2996], [0.1373, 0.3082], [-0.1435, -0.272], [0.1456, -0.235]], head: [0, 0.6, 0.3], tail: [0, 0.66, -0.35] },
  hedgehog: { file: 'pet_hedgehog.glb', hs: 13, hipY: 0.08,
    feet: [[-0.1395, 0.256], [0.126, 0.2565], [-0.1519, -0.2071], [0.1832, -0.1987]], head: [0, 0.45, 0.3], tail: [0, 0.3, -0.5] },
};
// v5.9.9 blinking: eye centre (model heights), outward normal, eyelid colour; radius r. The tortie's eyes are closed already.
const LIDS = {"starshiba": {"r": 0.032, "eyes": [[-0.2642, 0.7178, 0.5094, -0.871, -0.013, 0.49, "#263869"], [-0.1128, 0.7196, 0.6307, -0.273, 0.028, 0.961, "#213366"]]}, "xuanmao": {"r": 0.045, "eyes": [[-0.2566, 0.7052, 0.46, -0.846, 0.145, 0.514, "#1B1A20"], [-0.109, 0.7053, 0.5846, -0.372, 0.115, 0.921, "#27262E"]]}, "fox": {"r": 0.045, "eyes": [[-0.1927, 0.6784, 0.5243, -0.373, -0.013, 0.928, "#F59540"], [-0.3075, 0.6803, 0.3981, -0.967, -0.104, 0.233, "#F9AA5D"]]}, "white": {"r": 0.042, "eyes": [[-0.1731, 0.6726, 0.4571, -0.767, 0.015, 0.641, "#C9B094"], [0.0501, 0.6756, 0.5549, -0.171, 0.012, 0.985, "#CDBBA9"]]}, "owl": {"r": 0.068, "eyes": [[-0.1118, 0.7619, 0.3216, -0.448, -0.005, 0.894, "#DCD3CB"], [0.0956, 0.7567, 0.3202, 0.47, 0.038, 0.882, "#DDD3C8"]]}, "hedgehog": {"r": 0.035, "eyes": [[-0.1224, 0.5484, 0.4716, -0.217, 0.653, 0.725, "#F4DCC2"], [0.1323, 0.5369, 0.4813, 0.327, 0.507, 0.797, "#E5BE9A"]]}, "tux": {"r": 0.036, "eyes": [[-0.2119, 0.6066, 0.4904, -0.634, 0.0, 0.773, "#2E2A26"], [-0.037, 0.6035, 0.5848, -0.278, 0.046, 0.96, "#2E2A26"]]}, "orange": {"r": 0.036, "eyes": [[-0.2375, 0.6488, 0.525, -0.691, 0.01, 0.723, "#F5C595"], [-0.097, 0.6516, 0.6089, -0.341, -0.058, 0.938, "#FBCD9D"]]}, "shiba": {"r": 0.04, "eyes": [[-0.1539, 0.7324, 0.5631, -0.755, -0.052, 0.653, "#E1A265"], [0.0288, 0.7282, 0.642, 0.044, 0.038, 0.998, "#DEA46B"]]}, "rabbit": {"r": 0.036, "eyes": [[-0.1605, 0.7342, 0.7692, -0.825, 0.14, 0.547, "#D5C8BD"], [0.1695, 0.737, 0.7624, 0.779, 0.142, 0.611, "#D0C3B7"]]}, "penguin": {"r": 0.035, "eyes": [[-0.1431, 0.7222, 0.3012, -0.5, 0.173, 0.849, "#E4D8C7"], [0.1258, 0.7131, 0.3064, 0.377, 0.14, 0.915, "#DBCAB8"]]}};
const STATE = {};   // key -> { lib, failed, pending[] }

function modelKey(pp, col) {
  const role = (col && col.dollRole) || '', body = col && col.body;
  if (pp.profileCat) return 'tortie';
  if (pp.kind === 'penguin') return 'penguin';
  if (pp.kind === 'rabbit') return 'rabbit';
  if (pp.kind === 'owl') return 'owl';
  if (pp.kind === 'hedgehog') return 'hedgehog';
  if (pp.kind === 'fox') return 'fox';
  if (pp.kind === 'dog' && body === '#F7F5EE') return 'white';
  if (pp.kind === 'cat' && !role && body === '#2E2E36') return 'tux';
  if (pp.kind === 'dog' && body === '#E89A44') return 'shiba';
  if (pp.kind === 'dog' && body === '#2A2A5A') return 'starshiba';
  if (pp.kind === 'cat' && !role && body === '#1A1A22') return 'xuanmao';
  if (pp.kind === 'cat' && !role && body === '#F2A040') return 'orange';
  return null;
}

function load(key) {
  const st = STATE[key] = { lib: null, failed: false, pending: [] }, M = MODELS[key];
  new GLTFLoader().load(new URL('../models/' + M.file, import.meta.url).href, (gltf) => {
    try {
      let src = null;
      gltf.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
      const geo = src.geometry.clone(); geo.scale(M.hs, M.hs, M.hs);
      const map = src.material.map; if (map) map.colorSpace = THREE.SRGBColorSpace;
      st.lib = { geo, mat: new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide }) };
      for (const pp of st.pending.splice(0)) apply(pp, key);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('pet-glb-ready', { detail: key }));
    } catch (e) { st.failed = true; console.warn('pet model', key, e); for (const pp of st.pending.splice(0)) pp.body.visible = true; }
  }, undefined, (e) => { st.failed = true; console.warn('pet model failed, keeping procedural', key, e && e.message); for (const pp of st.pending.splice(0)) pp.body.visible = true; });
}

function apply(pp, key) {
  if (pp.glbModel) return;
  const M = MODELS[key], HS = M.hs, { lib } = STATE[key];
  const { root, body, legs, head, tail } = pp;
  head.rotation.order = 'YXZ';                          // yaw outermost, so x is a nod and z a roll
  body.visible = true;
  body.traverse((o) => { if (o.isMesh) o.visible = false; });
  const sv = { b: body.rotation.clone(), by: body.position.y, h: head.rotation.clone(), t: tail.rotation.clone(), l: legs.map((l) => l.rotation.clone()) };
  body.rotation.set(0, 0, 0); body.position.y = 0; tail.rotation.set(0, 0, 0);
  head.rotation.set(0, M.profile ? -Math.PI / 2 : 0, 0);  // the profile cat's rest head turn
  for (const l of legs) l.rotation.set(0, 0, 0);
  legs.forEach((l, i) => l.position.set(M.feet[i][0] * HS, M.hipY * HS, M.feet[i][1] * HS));
  head.position.set(M.head[0] * HS, M.head[1] * HS, M.head[2] * HS);
  tail.position.set(M.tail[0] * HS, M.tail[1] * HS, M.tail[2] * HS);
  const mesh = new THREE.SkinnedMesh(lib.geo, lib.mat);
  mesh.frustumCulled = false; mesh.castShadow = true;
  root.add(mesh); root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([body, legs[0], legs[1], legs[2], legs[3], head, tail]), mesh.matrixWorld);
  body.rotation.copy(sv.b); body.position.y = sv.by; head.rotation.copy(sv.h); tail.rotation.copy(sv.t);
  legs.forEach((l, i) => l.rotation.copy(sv.l[i]));
  if (!M.profile) body.rotation.y = 0;                   // the procedural plush turned its body 3/4 to camera; the model faces forward
  pp.glbModel = mesh;
  addLids(pp, key);
}

export function attachPetModel(pp, col) {
  const key = modelKey(pp, col);
  if (!key) return;
  const st = STATE[key] || (load(key), STATE[key]);
  if (st.failed) return;
  if (st.lib) { apply(pp, key); return; }
  pp.body.visible = false;                               // no flash of the old plush while the model loads
  st.pending.push(pp);
}

// v5.9.5: load every pet model at start-up (behind the loading screen) instead of the first time one appears
for (const k in MODELS) if (!STATE[k]) load(k);

// ---- v5.9.9 (宝宝 2026-11-19 "能不能眨眼睛"): pets blink. A thin fur-coloured eyelid sits over each eye on the
// head bone (so it turns with the head) and closes for ~0.15 s every 2.5–5.5 s, now and then twice in a row.
const BLINKERS = new Set();
const _Z = new THREE.Vector3(0, 0, 1), _UP = new THREE.Vector3(0, 1, 0);
function addLids(pp, key) {
  const D = LIDS[key]; if (!D) return;
  const M = MODELS[key], HS = M.hs, R = D.r * HS * 1.12, lids = [];
  for (const e of D.eyes) {
    const n = new THREE.Vector3(e[3], e[4], e[5]).normalize();
    const x = new THREE.Vector3().crossVectors(_UP, n); if (x.lengthSq() < 1e-6) x.set(1, 0, 0); x.normalize();
    const y = new THREE.Vector3().crossVectors(n, x).normalize();
    const geo = new THREE.SphereGeometry(R, 18, 12); geo.scale(1, 1, 0.42);
    const lid = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: e[6] }));
    lid.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, n));
    lid.position.set((e[0] - M.head[0]) * HS + n.x * R * 0.12, (e[1] - M.head[1]) * HS + n.y * R * 0.12, (e[2] - M.head[2]) * HS + n.z * R * 0.12);
    lid.visible = false; lid.renderOrder = 1;
    pp.head.add(lid); lids.push(lid);
  }
  BLINKERS.add({ root: pp.root, lids, start: -1, next: performance.now() / 1000 + 1 + Math.random() * 3, gone: 0 });
  if (BLINKERS.size === 1 && typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(blinkLoop);
}
function blinkLoop() {
  const t = performance.now() / 1000;
  for (const b of BLINKERS) {
    if (!b.root.parent) { if (++b.gone > 1800) BLINKERS.delete(b); continue; }
    b.gone = 0;
    if (t >= b.next) { b.start = t; b.next = t + (Math.random() < 0.22 ? 0.3 : 2.5 + Math.random() * 3); }
    const k = (t - b.start) / 0.15, c = k >= 0 && k < 1 ? Math.sin(Math.PI * k) : 0;
    for (const l of b.lids) { l.visible = c > 0.04; l.scale.y = Math.max(0.05, c); }
  }
  if (BLINKERS.size) requestAnimationFrame(blinkLoop);
}
