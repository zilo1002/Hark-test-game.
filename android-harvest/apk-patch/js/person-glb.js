// APK-only: farm owner and every employee share ONE model (the cat-ear chibi girl, models/person.glb),
// with one skeleton. The skeleton's bones are makePerson()'s own pivot groups
// (body, legs, arms, torso, head), so every existing animation (walking, carrying, cutting, fishing)
// bends the model. The model carries per-vertex skin weights for those 7 joints (baked offline)
// and a per-vertex region label (_REGION: 1 dress, 2 apron, 3 legs/socks).
// Only the skin differs: hero = farm owner (original texture), staff = employees (recoloured texture).
// Shop clothes are fitted to the model itself: overalls / vests recolour the dress, aprons recolour the apron,
// boots cover the socks, all as thin skinned shells on the model's own surface, so they bend with it and never clip.
// Hats, scarves, bow ties and the basket stay as separate pieces, refitted to the model's head, neck and hip.
// Until the model has loaded (or if it fails) the procedural figure stays as it was.
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

const HS = 42;               // model height in game units
const J = {                  // joints in game units (feet at y 0); the body's centre line sits at z BZ
  BZ: 4.7, hip: [3.0, 5.0], torso: 5.0, shoulder: [6.6, 12.6],
  head: [26.4, 2.8], headScale: [1.74, 1.62, 1.8],   // maps the procedural head (r 7.7) onto the model's hair
};
const BASE_OVERALLS = '#4F79A9';   // the farm look's own overalls are the model's dress, not a garment
let LIB = null, FAILED = false;
const PENDING = [];

function buildLib(geo, heroMat, staffMat) {
  geo.scale(HS, HS, HS);
  const pos = geo.attributes.position, nor = geo.attributes.normal, reg = geo.attributes._region;
  const shellPos = (off, keep) => {
    const a = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const k = keep(i) ? off : 0;
      a[i * 3] = pos.getX(i) + nor.getX(i) * k; a[i * 3 + 1] = pos.getY(i) + nor.getY(i) * k; a[i * 3 + 2] = pos.getZ(i) + nor.getZ(i) * k;
    }
    return new THREE.BufferAttribute(a, 3);
  };
  const faces = (test) => {
    const idx = geo.index.array, out = [];
    for (let f = 0; f < idx.length; f += 3) if (test(idx[f]) && test(idx[f + 1]) && test(idx[f + 2])) out.push(idx[f], idx[f + 1], idx[f + 2]);
    return out;
  };
  const r = (i) => (reg ? reg.getX(i) : 0);
  const y = (i) => pos.getY(i);
  const shell = (index, position) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', position); g.setAttribute('normal', nor);
    g.setAttribute('skinIndex', geo.attributes.skinIndex); g.setAttribute('skinWeight', geo.attributes.skinWeight);
    g.setIndex(index); return g;
  };
  const thin = shellPos(0.08, () => true), thick = shellPos(0.32, () => true);
  const apronIdx = faces((i) => r(i) === 2);
  // a few dots spread over the apron (for 碎花围裙)
  const dots = [];
  if (apronIdx.length) {
    const seen = new Set();
    for (let k = 0; k < apronIdx.length && dots.length < 14; k += Math.max(3, Math.floor(apronIdx.length / 60))) {
      const i = apronIdx[k], key = Math.round(pos.getX(i) / 2.2) + ',' + Math.round(y(i) / 2.2);
      if (seen.has(key)) continue; seen.add(key);
      dots.push(new THREE.Vector3(pos.getX(i) + nor.getX(i) * 0.15, y(i) + nor.getY(i) * 0.15, pos.getZ(i) + nor.getZ(i) * 0.15));
    }
  }
  return {
    geo, mats: { hero: heroMat, staff: staffMat }, dots,
    shells: {
      dress: shell(faces((i) => r(i) === 1), thin),
      apron: shell(apronIdx, thin),
      boots: shell(faces((i) => r(i) === 3 && y(i) < 3.3), thick),
    },
  };
}

function giveUp() {   // the model could not load: show the procedural figures that were waiting for it
  FAILED = true; LIB = null;
  for (const [pp] of PENDING.splice(0)) pp.body.visible = true;
}

function load() {
  new GLTFLoader().load(new URL('../models/person.glb', import.meta.url).href, (gltf) => {
    try {
      let src = null;
      gltf.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
      const heroMap = src.material.map; heroMap.colorSpace = THREE.SRGBColorSpace;
      const staffMap = new THREE.TextureLoader().load(new URL('../models/person_staff.jpg', import.meta.url).href);
      staffMap.flipY = false; staffMap.colorSpace = THREE.SRGBColorSpace;
      const mk = (map) => new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide });
      LIB = buildLib(src.geometry.clone(), mk(heroMap), mk(staffMap));
      for (const [pp, skin] of PENDING.splice(0)) { pp.body.visible = true; apply(pp, skin); }
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('person-glb-ready'));
    } catch (e) { console.warn('person model', e); giveUp(); }
  }, undefined, (e) => { console.warn('person model failed, keeping procedural', e && e.message); giveUp(); });
}

// which shop clothes this figure wears (staff: only their uniform; the farm owner: what differs from the farm look)
function outfit(o) {
  const s = o.glbOutfit !== undefined ? (o.glbOutfit || {}) : o;
  const out = {};
  if (s.overalls && s.overalls !== BASE_OVERALLS) out.dress = s.overalls;
  if (s.vest) out.dress = s.vest;
  if (s.apron) { out.apron = s.apron; out.apronDot = s.apronDot; }
  if (s.boots) { out.boots = s.boots; out.cuff = s.bootGold ? '#FFF2A0' : null; }
  return out;
}

const shellMat = (c) => new THREE.MeshLambertMaterial({ color: c, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

function apply(pp, skin) {
  if (pp.glbModel) return;
  const { root, body, legs, arms, torso, head, o } = pp;
  // hide the procedural body (meshes tagged base) and its procedural clothes (tagged garment); hats and props stay
  body.traverse((m) => { if (m.isMesh && (m.userData.base || m.userData.garment)) m.visible = false; });
  // refit the pivots to the model's joints (rest pose)
  const sv = { b: body.rotation.clone(), t: torso.rotation.clone(), h: head.rotation.clone(), a: arms.map((a) => a.rotation.clone()), l: legs.map((l) => l.rotation.clone()), by: body.position.y };
  body.rotation.set(0, 0, 0); torso.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0); body.position.y = 0;
  for (const a of arms) a.rotation.set(0, 0, 0); for (const l of legs) l.rotation.set(0, 0, 0);
  legs.forEach((l, i) => { const s = i ? 1 : -1; l.position.set(s * J.hip[0], J.hip[1], J.BZ); l.scale.y = J.hip[1] / 11.5; });
  torso.position.set(0, J.torso, J.BZ);
  arms.forEach((a, i) => { const s = i ? 1 : -1; a.position.set(s * J.shoulder[0], J.shoulder[1] - J.torso, 0); });
  head.position.set(0, J.head[0], J.head[1]); head.scale.set(...J.headScale);
  // bind
  const mesh = new THREE.SkinnedMesh(LIB.geo, LIB.mats[skin] || LIB.mats.staff);
  mesh.frustumCulled = false; mesh.castShadow = skin === 'hero';
  root.add(mesh);
  root.updateMatrixWorld(true);
  const skel = new THREE.Skeleton([body, legs[0], legs[1], arms[0], arms[1], head, torso]);
  mesh.bind(skel, mesh.matrixWorld);
  // shop clothes as skinned shells on the model's own surface
  const fit = outfit(o || {});
  for (const part of ['dress', 'apron', 'boots']) {
    if (!fit[part]) continue;
    const sm = new THREE.SkinnedMesh(LIB.shells[part], shellMat(fit[part]));
    sm.frustumCulled = false; sm.userData.tint = fit[part]; root.add(sm); sm.bind(skel, mesh.matrixWorld);
  }
  if (fit.cuff) for (const l of legs) {   // gold boot cuff: a ring round each leg at the top of the boot
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.75, 0.42, 8, 24), new THREE.MeshLambertMaterial({ color: fit.cuff }));
    ring.rotation.x = Math.PI / 2; ring.position.set(0, (3.2 - J.hip[1]) / l.scale.y, 0); ring.scale.set(1, 1, 1 / l.scale.y); l.add(ring);
  }
  if (fit.apron && fit.apronDot) {
    const inv = new THREE.Matrix4().copy(torso.matrixWorld).invert();
    const dm = new THREE.MeshLambertMaterial({ color: fit.apronDot });
    for (const p of LIB.dots) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 6), dm);
      d.position.copy(p).applyMatrix4(mesh.matrixWorld).applyMatrix4(inv); d.scale.set(1, 1, 0.5); torso.add(d);
    }
  }
  // restore the current pose
  body.rotation.copy(sv.b); torso.rotation.copy(sv.t); head.rotation.copy(sv.h); body.position.y = sv.by;
  arms.forEach((a, i) => a.rotation.copy(sv.a[i])); legs.forEach((l, i) => l.rotation.copy(sv.l[i]));
  pp.glbModel = mesh;
}

export function attachPersonModel(pp, skin) {
  if (!skin) return;
  if (LIB) { apply(pp, skin); return; }
  if (FAILED) return;
  pp.body.visible = false;            // don't flash the old block figure while the model is still loading
  PENDING.push([pp, skin]);
}
load();
