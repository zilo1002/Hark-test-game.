// APK-only: every farmer / staff figure uses the same chibi model (models/person.glb, the cat-ear girl),
// so height and proportions are identical; only the skin differs:
//   hero  = the farm owner (original texture)
//   staff = every employee (same mesh, recoloured texture models/person_staff.jpg)
// makePerson() keeps its procedural groups (arms, legs, tools) so all animation code still works; the
// procedural body meshes are hidden and the model is parented to `body`, so walk-bob and turning still apply.
// Until the file has loaded (or if it fails), the procedural figure stays visible.
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

let LIB = null;
const PENDING = [];
const KEEP = new Set(['tool', 'axe', 'net']);

function load() {
  const loader = new GLTFLoader();
  loader.load(new URL('../models/person.glb', import.meta.url).href, (gltf) => {
    try {
      const scene = gltf.scene;
      let heroMap = null;
      scene.traverse((o) => { if (o.isMesh && o.material && o.material.map) heroMap = o.material.map; });
      const staffMap = new THREE.TextureLoader().load(new URL('../models/person_staff.jpg', import.meta.url).href);
      staffMap.flipY = false;
      if (heroMap) { heroMap.colorSpace = THREE.SRGBColorSpace; staffMap.colorSpace = THREE.SRGBColorSpace; }
      const mats = {
        hero: new THREE.MeshLambertMaterial({ map: heroMap, side: THREE.DoubleSide }),
        staff: new THREE.MeshLambertMaterial({ map: staffMap, side: THREE.DoubleSide }),
      };
      scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(scene);
      LIB = { scene, mats, box };
      for (const [pp, skin] of PENDING.splice(0)) apply(pp, skin);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('person-glb-ready'));
    } catch (e) { console.warn('person model', e); }
  }, undefined, (e) => console.warn('person model failed, keeping procedural', e && e.message));
}

function apply(pp, skin) {
  if (pp.glbModel) return;
  // measure the procedural figure (standing, without tools) so the model takes exactly its height
  const procBox = new THREE.Box3();
  pp.body.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(pp.root.matrixWorld).invert();
  const hidden = [];
  pp.body.traverse((o) => {
    if (!o.isMesh) return;
    let p = o, keep = false;
    while (p && p !== pp.body) { if (p === pp.tool || p === pp.axe || p === pp.net) { keep = true; break; } p = p.parent; }
    if (keep || o.userData.keepVisible) return;
    if (o.visible) { const b = new THREE.Box3().setFromObject(o).applyMatrix4(inv); procBox.union(b); }
    hidden.push(o);
  });
  for (const o of hidden) o.visible = false;
  const procH = procBox.isEmpty() ? 40 : procBox.max.y - Math.max(0, procBox.min.y);
  const { scene, mats, box } = LIB;
  const g = scene.clone(true);
  const mat = mats[skin] || mats.staff;
  g.traverse((o) => { if (o.isMesh) { o.material = mat; o.castShadow = true; o.frustumCulled = false; } });
  const h = box.max.y - box.min.y, s = procH / h;
  g.scale.setScalar(s);
  // feet on the ground, centred on the figure; body sits at the root, so undo its own offset
  g.position.set(-(box.min.x + box.max.x) / 2 * s, -box.min.y * s - pp.body.position.y, -(box.min.z + box.max.z) / 2 * s);
  pp.body.add(g);
  pp.glbModel = g;
}

export function attachPersonModel(pp, skin) {
  if (!skin) return;
  if (LIB) apply(pp, skin); else PENDING.push([pp, skin]);
}
load();
