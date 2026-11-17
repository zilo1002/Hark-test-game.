// APK-only: farm owner and every employee share ONE model (the cat-ear chibi girl, models/person.glb),
// with one skeleton. The skeleton's bones are makePerson()'s own pivot groups
// (body, legs, arms, torso, head), so every existing animation (walking, carrying, cutting, fishing)
// bends the model. The model carries per-vertex skin weights for those 7 joints (baked offline).
// Only the skin differs: hero = farm owner (original texture), staff = employees (recoloured texture).
// Hats, boots, scarves, aprons, baskets, crowns and tools from the shop stay on top, refitted to the model.
// Until the model has loaded (or if it fails) the procedural figure stays as it was.
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

const HS = 42;               // model height in game units
const J = {                  // joint positions, in model heights (feet at 0, centred)
  hip: [0.065, 0.12], torso: 0.12, shoulder: [0.14, 0.30], headC: 0.62, headR: 0.29, headTop: 0.93,
};
let LIB = null;
const PENDING = [];

function load() {
  new GLTFLoader().load(new URL('../models/person.glb', import.meta.url).href, (gltf) => {
    try {
      let src = null;
      gltf.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
      const geo = src.geometry.clone(); geo.scale(HS, HS, HS);
      const heroMap = src.material.map; heroMap.colorSpace = THREE.SRGBColorSpace;
      const staffMap = new THREE.TextureLoader().load(new URL('../models/person_staff.jpg', import.meta.url).href);
      staffMap.flipY = false; staffMap.colorSpace = THREE.SRGBColorSpace;
      const mk = (map) => new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide });
      LIB = { geo, mats: { hero: mk(heroMap), staff: mk(staffMap) } };
      for (const [pp, skin] of PENDING.splice(0)) apply(pp, skin);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('person-glb-ready'));
    } catch (e) { console.warn('person model', e); }
  }, undefined, (e) => console.warn('person model failed, keeping procedural', e && e.message));
}

function apply(pp, skin) {
  if (pp.glbModel) return;
  const { root, body, legs, arms, torso, head } = pp;
  // hide the procedural body (meshes tagged base in makePerson); decorations and tools stay
  body.traverse((o) => { if (o.isMesh && o.userData.base) o.visible = false; });
  // refit the pivots to the model's joints (rest pose)
  const sv = { b: body.rotation.clone(), t: torso.rotation.clone(), h: head.rotation.clone(), a: arms.map((a) => a.rotation.clone()), l: legs.map((l) => l.rotation.clone()), by: body.position.y };
  body.rotation.set(0, 0, 0); torso.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0); body.position.y = 0;
  for (const a of arms) a.rotation.set(0, 0, 0); for (const l of legs) l.rotation.set(0, 0, 0);
  legs.forEach((l, i) => { const s = i ? 1 : -1; l.position.set(s * J.hip[0] * HS, J.hip[1] * HS, 0); l.scale.y = (J.hip[1] * HS) / 11.5; });
  torso.position.set(0, J.torso * HS, 0);
  arms.forEach((a, i) => { const s = i ? 1 : -1; a.position.set(s * J.shoulder[0] * HS, (J.shoulder[1] - J.torso) * HS, 0); });
  // hats sit on the hair: width from the hair's half-width (a touch wider), height from the top of the hair
  const kx = (J.headR * HS) / (7.7 * 1.08 * 1.72) * 1.06, ky = ((J.headTop - J.headC) * HS) / (8.0 * 1.62);
  head.position.set(0, J.headC * HS, 0); head.scale.set(1.72 * kx, 1.62 * ky, 1.42 * kx);
  // bind
  const mesh = new THREE.SkinnedMesh(LIB.geo, LIB.mats[skin] || LIB.mats.staff);
  mesh.frustumCulled = false; mesh.castShadow = skin === 'hero';
  root.add(mesh);
  root.updateMatrixWorld(true);
  const bones = [body, legs[0], legs[1], arms[0], arms[1], head, torso];
  mesh.bind(new THREE.Skeleton(bones), mesh.matrixWorld);
  // restore the current pose
  body.rotation.copy(sv.b); torso.rotation.copy(sv.t); head.rotation.copy(sv.h); body.position.y = sv.by;
  arms.forEach((a, i) => a.rotation.copy(sv.a[i])); legs.forEach((l, i) => l.rotation.copy(sv.l[i]));
  pp.glbModel = mesh;
}

export function attachPersonModel(pp, skin) {
  if (!skin) return;
  if (LIB) apply(pp, skin); else PENDING.push([pp, skin]);
}
load();
