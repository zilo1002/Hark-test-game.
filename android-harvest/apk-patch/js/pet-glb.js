// APK-only: the tortoiseshell plush cat (花斑猫) uses the Hunyuan 3D model (models/tortie.glb, generated 2026-11-17
// from her photo). Like the person, it is skinned to makePet()'s own pivots (body, 4 hips, head, tail), so walking,
// sitting and lounging still move it. Until it loads (or if it fails) the procedural plush cat stays.
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

const HS = 21;                 // model height in game units
const FEET = [[-0.3196, -0.0912], [-0.3056, 0.1023], [0.2101, -0.1221], [0.2581, 0.1223]];   // front-left, front-right, back-left, back-right (x, z) in model heights
const HIP_Y = 0.2, HEAD = [-0.3954, 0.72, 0.0766], TAIL = [0.42, 0.38, 0.0376];
let LIB = null, FAILED = false;
const PENDING = [];

function load() {
  new GLTFLoader().load(new URL('../models/tortie.glb', import.meta.url).href, (gltf) => {
    try {
      let src = null;
      gltf.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
      const geo = src.geometry.clone(); geo.scale(HS, HS, HS);
      const map = src.material.map; map.colorSpace = THREE.SRGBColorSpace;
      LIB = { geo, mat: new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide }) };
      for (const pp of PENDING.splice(0)) apply(pp);
    } catch (e) { FAILED = true; console.warn('tortie model', e); }
  }, undefined, (e) => { FAILED = true; console.warn('tortie model failed, keeping procedural', e && e.message); });
}

function apply(pp) {
  if (pp.glbModel) return;
  const { root, body, legs, head, tail } = pp;
  head.rotation.order = 'YXZ';                          // yaw outermost, so x is a nod and z a roll
  body.traverse((o) => { if (o.isMesh) o.visible = false; });
  const sv = { b: body.rotation.clone(), by: body.position.y, h: head.rotation.clone(), t: tail.rotation.clone(), l: legs.map((l) => l.rotation.clone()) };
  body.rotation.set(0, 0, 0); body.position.y = 0; tail.rotation.set(0, 0, 0);
  head.rotation.set(0, -Math.PI / 2, 0);                 // the profile cat's rest head turn
  for (const l of legs) l.rotation.set(0, 0, 0);
  legs.forEach((l, i) => l.position.set(FEET[i][0] * HS, HIP_Y * HS, FEET[i][1] * HS));
  head.position.set(HEAD[0] * HS, HEAD[1] * HS, HEAD[2] * HS);
  tail.position.set(TAIL[0] * HS, TAIL[1] * HS, TAIL[2] * HS);
  const mesh = new THREE.SkinnedMesh(LIB.geo, LIB.mat);
  mesh.frustumCulled = false; mesh.castShadow = true;
  root.add(mesh); root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([body, legs[0], legs[1], legs[2], legs[3], head, tail]), mesh.matrixWorld);
  body.rotation.copy(sv.b); body.position.y = sv.by; head.rotation.copy(sv.h); tail.rotation.copy(sv.t);
  legs.forEach((l, i) => l.rotation.copy(sv.l[i]));
  pp.glbModel = mesh;
}

export function attachPetModel(pp) {
  if (!pp.profileCat || FAILED) return;
  if (LIB) apply(pp); else PENDING.push(pp);
}
load();
