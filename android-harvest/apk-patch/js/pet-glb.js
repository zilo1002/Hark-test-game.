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
};
const STATE = {};   // key -> { lib, failed, pending[] }

function modelKey(pp, col) {
  const role = (col && col.dollRole) || '', body = col && col.body;
  if (pp.profileCat) return 'tortie';
  if (pp.kind === 'penguin') return 'penguin';
  if (pp.kind === 'rabbit') return 'rabbit';
  if (pp.kind === 'dog' && body === '#E89A44') return 'shiba';
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
