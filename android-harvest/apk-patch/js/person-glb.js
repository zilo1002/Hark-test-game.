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
const BASE_OVERALLS = '#4F79A9';
// v5.9.6: the model's hair is bigger than the old procedural head, so each hat is scaled round its own base
// (head-local units) until it encloses the hair: crowns wider than the hair dome, the pumpkin over the whole head.
const CAP = { p: [0, 2.4, -0.4], s: [1.05, 1.1, 1.05] };
const HAT_FIT = {
  straw:   { p: [0, 4.7, 0],    s: [1.36, 1.12, 1.36] },
  cowboy:  { p: [0, 4.9, -0.4], s: [1.4, 1.1, 1.4] },
  pumpkin: { p: [0, 1.6, -0.2], s: [1.32, 1.3, 1.32], dy: -1.6 },
  chef:    { p: [0, 4.2, -0.4], s: [1.07, 1.04, 1.07] },
  santa:   { p: [0, 5.2, -0.4], s: [1.1, 1.05, 1.1] },
  scholar: { p: [0, 4.1, -0.4], s: [1.04, 1, 1.04], dy: 0.4 },
  beanie:  { p: [0, 2.2, -0.4], s: [1.03, 1.04, 1.03] },
  cap: CAP, star: CAP, moon: CAP, rain: CAP,
};
function refitHat(head, hat) {
  const f = HAT_FIT[hat]; if (!f || head.userData.hatFit) return;
  head.userData.hatFit = true;
  for (const c of head.children) {
    if (!c.userData.hat) continue;
    c.position.set(f.p[0] + (c.position.x - f.p[0]) * f.s[0], f.p[1] + (c.position.y - f.p[1]) * f.s[1] + (f.dy || 0), f.p[2] + (c.position.z - f.p[2]) * f.s[2]);
    c.scale.multiply(new THREE.Vector3(...f.s));
  }
}   // the farm look's own overalls are the model's dress, not a garment
let LIB = null, FAILED = false;
const PENDING = [];

  // v5.9.1: the same body with its cat ears folded down onto the hair, worn under hats so the ears never poke through.
  // An ear is whatever sticks out of the head's front silhouette (an ellipse round the hair dome); each ear vertex
  // is pulled straight back onto that outline, just inside the hair.
function earsFolded(geo) {
  const pos = geo.attributes.position, earPos = pos.clone();
  { const cx = 0, cy = 0.78 * HS, rx = 0.30 * HS, ry = 0.165 * HS;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i); if (py < 0.79 * HS || Math.abs(px) < 0.06 * HS) continue;
      const ex = (px - cx) / rx, ey = (py - cy) / ry, e = Math.hypot(ex, ey);
      if (e <= 1.0) continue;
      const k = 0.97 / e; earPos.setXYZ(i, cx + ex * k * rx, cy + ey * k * ry, pos.getZ(i) * 0.9);
    } }
  const g = geo.clone(); g.setAttribute('position', earPos); return g;
}

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
  const geoHat = earsFolded(geo);
  return {
    geo, geoHat, mats: { hero: heroMat, staff: staffMat }, dots,
    shells: {
      dress: shell(faces((i) => r(i) === 1), thin),
      apron: shell(apronIdx, thin),
      boots: shell(faces((i) => r(i) === 3 && y(i) < 3.3), thick),
    },
  };
}

// v5.9.5: customers wear the same chibi model in their own colours (hair + dress, 1k textures) on a lighter mesh,
// so a full shop of them stays smooth.
function loadLod() {
  new GLTFLoader().load(new URL('../models/person_lod.glb', import.meta.url).href, (gltf) => {
    try {
      let src = null; gltf.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
      const g = src.geometry.clone(); g.scale(HS, HS, HS);
      LIB.lod = g; LIB.lodHat = earsFolded(g);
    } catch (e) { console.warn('person lod', e); }
  }, undefined, () => {});
}
function skinMat(skin) {
  if (LIB.mats[skin]) return LIB.mats[skin];
  const m = /^cust(\d)$/.exec(skin), file = skin === 'vip' ? 'person_vip.jpg' : m ? `person_cust${m[1]}.jpg` : null;
  if (!file) return LIB.mats.staff;
  const map = new THREE.TextureLoader().load(new URL('../models/' + file, import.meta.url).href);
  map.flipY = false; map.colorSpace = THREE.SRGBColorSpace;
  return (LIB.mats[skin] = LIB.mk(map));
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
      LIB.mk = mk; loadLod();
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
  const hat = (o && o.hat) || '';
  refitHat(head, hat);
  const earsDown = hat && !['bow', 'flower', 'crown'].includes(hat);   // these sit between / around the ears
  const cust = skin === 'vip' || skin.startsWith('cust'), lod = cust && LIB.lod;
  const mesh = new THREE.SkinnedMesh(earsDown ? (lod ? LIB.lodHat : LIB.geoHat) : (lod ? LIB.lod : LIB.geo), skinMat(skin));
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
  // v6.0.0: the owl companion stands on top of the head, on the hat when there is one (head-local units)
  const owl = root.userData.owl;
  if (owl) {
    head.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(head.matrixWorld).invert(), bb = new THREE.Box3();
    let top = 8.6;                                   // the hair dome between the ears
    for (const c of head.children) if (c.userData.hat) { bb.setFromObject(c); if (!bb.isEmpty()) { bb.applyMatrix4(inv); top = Math.max(top, bb.max.y); } }
    head.add(owl);
    const s = 0.5; owl.scale.set(s / head.scale.x, s / head.scale.y, s / head.scale.z);
    owl.position.set(0, top - 0.4, -0.3); owl.rotation.set(0, 0, 0);
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
