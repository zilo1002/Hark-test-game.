// APK-only (6.1.6, 宝宝 2026-11-19): the farm owner is her own Hunyuan character, girl or boy (切换为男孩/女孩).
//   girl       hero_girl.glb       her default look (black track jacket, red plaid skirt, black socks)
//   girl_base  hero_girl_base.glb  the bare base body (white tank, blue shorts, stockings) wearing her own head and hair;
//              shop clothes (top / feet) are fitted onto THIS body and replace the default look as a whole,
//              they are never layered over the jacket and skirt
//   boy        hero_boy.glb        his base body (black shorts); shop clothes are fitted onto it the same way
// One finer skeleton of 14 bones per figure: body, spine, chest, neck, head, both thighs + shins, both upper arms +
// forearms, and the long hair. The bones are not in the scene graph: each frame they are worked out from
// makePerson()'s pivots (body, legs, torso, arms, head), so every existing animation drives them, with knees and
// elbows bending from the swing and the hair swaying a little. Clothes are skinned shells on the body's own surface
// (offset along its normals), so they bend with it and never clip; the face is never covered.
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

// joints in model heights (feet y 0, facing +z); L = x < 0 = legs[0] / arms[0]
const MODELS = {
  girl: { file: 'hero_girl.glb', hs: 42, legAmp: 0.62, armAmp: 0.8,
    hip: [0.06, 0.42, -0.02], knee: [0.058, 0.245, -0.025], sh: [0.10, 0.67, -0.02], el: [0.15, 0.56, -0.03], wr: [0.17, 0.46, -0.02],
    spine: [0, 0.53, -0.02], neck: [0, 0.73, -0.002], head: [0, 0.875, 0.02], headHalf: [0.13, 0.125, 0.115], hairPivot: [0, 0.72, -0.08] },
  girl_base: { file: 'hero_girl_base.glb', hs: 42, legAmp: 0.7, armAmp: 1,
    hip: [0.07, 0.45, -0.029], knee: [0.075, 0.235, -0.027], sh: [0.095, 0.685, -0.05], el: [0.14, 0.555, -0.042], wr: [0.178, 0.43, -0.01],
    spine: [0, 0.55, -0.023], neck: [0, 0.73, -0.04], head: [0, 0.885, -0.025], headHalf: [0.13, 0.125, 0.118], hairPivot: [0, 0.73, -0.1] },
  boy: { file: 'hero_boy.glb', hs: 43, legAmp: 0.7, armAmp: 1,
    hip: [0.06, 0.44, -0.028], knee: [0.062, 0.225, -0.011], sh: [0.092, 0.68, -0.05], el: [0.115, 0.54, -0.052], wr: [0.122, 0.41, -0.003],
    spine: [0, 0.54, -0.023], neck: [0, 0.715, -0.059], head: [0, 0.87, -0.055], headHalf: [0.115, 0.13, 0.123], hairPivot: [0, 0.72, -0.08] },
};
// 6.1.8 (宝宝 2026-11-19): 黑西装猫猫 — his clothed look (black suit, cat ears, big fluffy tail) as a whole model;
// worn instead of his base body, never layered. The tail hangs from the hips and sways (bone 13).
MODELS.boy_suit = { file: 'hero_boy_suit.glb', hs: 44, legAmp: 0.55, armAmp: 0.75,
  hip: [0.055, 0.44, -0.03], knee: [0.06, 0.24, -0.019], sh: [0.095, 0.655, -0.022], el: [0.125, 0.565, -0.016], wr: [0.142, 0.49, 0],
  spine: [0, 0.53, -0.009], neck: [0, 0.725, 0.003], head: [0, 0.865, -0.007], headHalf: [0.11, 0.115, 0.115], hairPivot: [0, 0.4, -0.1] };
const PROC_HEAD = [7.7 * 1.08, 7.7 * 1.04, 7.7 * 0.98];   // the procedural head the hats were made for
const BASE_OVERALLS = '#4F79A9';
const HAT_S = 1.15, HAT_DY = 2.4;
const STATE = {};

const V3 = (a, s = 1) => new THREE.Vector3(a[0] * s, a[1] * s, a[2] * s);
function load(key) {
  const st = STATE[key] = { lib: null, failed: false, pending: [] }, M = MODELS[key];
  new GLTFLoader().load(new URL('../models/' + M.file, import.meta.url).href, (gltf) => {
    try {
      let src = null; gltf.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
      const geo = src.geometry.clone(); geo.scale(M.hs, M.hs, M.hs);
      const map = src.material.map; if (map) map.colorSpace = THREE.SRGBColorSpace;
      st.lib = { geo, mat: new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide }), shells: geo.attributes._region ? makeShells(geo, M.hs) : null };
      for (const [pp] of st.pending.splice(0)) { pp.body.visible = true; apply(pp, key); }
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('person-glb-ready'));
    } catch (e) { console.warn('hero model', key, e); fail(st); }
  }, undefined, (e) => { console.warn('hero model failed, keeping procedural', key, e && e.message); fail(st); });
}
function fail(st) { st.failed = true; for (const [pp] of st.pending.splice(0)) pp.body.visible = true; }

// shop-clothes shells on the base body: region 1 torso, 2 its front (apron), 3 feet/shins (boots), 4 legs, 5 sleeves
function makeShells(geo, hs) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, reg = geo.attributes._region, idx = geo.index.array;
  const shellPos = (off) => {
    const a = new Float32Array(pos.count * 3), o = off * hs / 42;
    for (let i = 0; i < pos.count; i++) { a[i * 3] = pos.getX(i) + nor.getX(i) * o; a[i * 3 + 1] = pos.getY(i) + nor.getY(i) * o; a[i * 3 + 2] = pos.getZ(i) + nor.getZ(i) * o; }
    return new THREE.BufferAttribute(a, 3);
  };
  const thin = shellPos(0.1), mid = shellPos(0.2), thick = shellPos(0.34);
  const part = (set, position) => {
    const out = [];
    for (let f = 0; f < idx.length; f += 3) if (set.includes(reg.getX(idx[f])) && set.includes(reg.getX(idx[f + 1])) && set.includes(reg.getX(idx[f + 2]))) out.push(idx[f], idx[f + 1], idx[f + 2]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', position); g.setAttribute('normal', nor);
    g.setAttribute('skinIndex', geo.attributes.skinIndex); g.setAttribute('skinWeight', geo.attributes.skinWeight);
    g.setIndex(out); return g;
  };
  return { torso: part([1, 2], thin), front: part([2], mid), sleeves: part([5], thin), legs: part([4], thin), boots: part([3], thick) };
}

// which shop clothes the farm owner wears (the farm look's own overalls are not a shop piece)
function outfit(o) {
  const out = {};
  if (o.overalls && o.overalls !== BASE_OVERALLS) { out.torso = o.overalls; out.legs = o.pants || o.overalls; out.sleeves = o.sleeve || o.shirt; }
  if (o.vest) { out.torso = o.vest; out.sleeves = o.sleeve || o.shirt || '#FFFFFF'; if (o.pants) out.legs = o.pants; }
  if (o.apron) { out.torso = out.torso || o.shirt; out.sleeves = out.sleeves || o.sleeve || o.shirt; out.front = o.apron; out.dot = o.apronDot; }
  if (o.boots) { out.boots = o.boots; if (o.bootGold) out.cuff = '#FFF2A0'; }
  return out;
}
const isBoy = (o) => String((o && o.character) || '').startsWith('boy');
function keyFor(o) {
  if (isBoy(o)) return o.catSuit ? 'boy_suit' : 'boy';
  const f = outfit(o || {});
  return Object.keys(f).length ? 'girl_base' : 'girl';     // any shop top / boots → the base body, the default look comes off
}

const shellMat = (c) => new THREE.MeshLambertMaterial({ color: c, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3();
const _I = new THREE.Quaternion(), _one = new THREE.Vector3(1, 1, 1);
const T = (v) => new THREE.Matrix4().makeTranslation(v.x, v.y, v.z);
const euler = (r, ax = 1, ay = 1, az = 1) => _q.setFromEuler(_e.set(r.x * ax, r.y * ay, r.z * az, r.order));

function apply(pp, key) {
  if (pp.glbModel) return;
  const M = MODELS[key], HS = M.hs, { lib } = STATE[key];
  const { root, body, legs, arms, torso, head, o } = pp;
  body.traverse((m) => { if (m.isMesh && (m.userData.base || m.userData.garment)) m.visible = false; });
  const sv = { b: body.rotation.clone(), t: torso.rotation.clone(), h: head.rotation.clone(), a: arms.map((a) => a.rotation.clone()), l: legs.map((l) => l.rotation.clone()), by: body.position.y };
  body.rotation.set(0, 0, 0); torso.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0); body.position.y = 0;
  for (const a of arms) a.rotation.set(0, 0, 0); for (const l of legs) l.rotation.set(0, 0, 0);
  // joints in game units
  const J = {}; for (const k of ['spine', 'neck', 'head', 'hairPivot']) J[k] = V3(M[k], HS);
  const side = (a, s) => new THREE.Vector3(s * a[0] * HS, a[1] * HS, a[2] * HS);
  J.hip = [side(M.hip, -1), side(M.hip, 1)]; J.knee = [side(M.knee, -1), side(M.knee, 1)];
  J.sh = [side(M.sh, -1), side(M.sh, 1)]; J.el = [side(M.el, -1), side(M.el, 1)]; J.wr = [side(M.wr, -1), side(M.wr, 1)];
  const neckOff = J.neck.clone().sub(J.spine), headOff = J.head.clone().sub(J.spine), hairOff = J.hairPivot.clone().sub(J.spine);
  // the pivots move onto the model's joints; the head now rides on the torso so it follows a lean
  legs.forEach((l, i) => l.position.copy(J.hip[i]));
  torso.position.copy(J.spine);
  arms.forEach((a, i) => a.position.copy(J.sh[i]).sub(J.spine));
  torso.add(head); head.position.copy(J.head).sub(J.spine);
  head.scale.set(M.headHalf[0] * HS / PROC_HEAD[0], M.headHalf[1] * HS / PROC_HEAD[1], M.headHalf[2] * HS / PROC_HEAD[2]);
  // hats were made for the bigger procedural head: sit them down onto the hair and a touch wider (head-local units)
  for (const c of head.children) if (c.userData.hat && !c.userData.heroFit) {
    c.userData.heroFit = true;
    c.position.set(c.position.x * HAT_S, 4 + (c.position.y - 4) * HAT_S - HAT_DY, c.position.z * HAT_S); c.scale.multiplyScalar(HAT_S);
  }
  // scarf, bow tie and basket were made round the procedural chest (neck at y 8.6, radius ~6.6): shrink them onto the model's
  const kk = (M.sh[0] * HS + 0.6) / 6.6;
  for (const c of torso.children) {
    if (arms.includes(c) || c === head || c.userData.base || c.userData.garment || c.userData.heroFit) continue;
    c.userData.heroFit = true;
    c.position.set(neckOff.x + c.position.x * kk, neckOff.y + (c.position.y - 8.6) * kk, neckOff.z + c.position.z * kk + 0.3);
    c.scale.multiplyScalar(kk);
  }
  // the sickle / axe / net sit in the new (longer) hand
  for (const tl of [pp.tool, pp.axe, pp.net]) if (tl) {
    const a = arms[1], d = J.wr[1].clone().sub(J.sh[1]);
    tl.position.set(d.x / a.scale.x, (d.y - 0.6) / a.scale.y, (d.z + 1.4) / a.scale.z);
  }
  // the 14 bones (outside the scene graph; their matrixWorld is written each frame)
  const bones = []; for (let i = 0; i < 14; i++) { const b = new THREE.Bone(); b.matrixAutoUpdate = false; b.matrixWorldAutoUpdate = false; bones.push(b); }
  const knee = J.knee.map((k, i) => k.clone().sub(J.hip[i])), el = J.el.map((e, i) => e.clone().sub(J.sh[i]));
  const pair = (v) => [T(v), T(v.clone().negate())];
  const Pk = knee.map(pair), Pe = el.map(pair), Pn = pair(neckOff), Ph = pair(hairOff), _r = new THREE.Matrix4();
  const rig = { t0: Math.random() * 10, hasTool: () => (pp.tool && pp.tool.visible) || (pp.axe && pp.axe.visible) || (pp.net && pp.net.visible) };
  const local = []; for (let i = 0; i < 14; i++) local.push(new THREE.Matrix4());
  rig.update = () => {
    // body: its own place in the figure (bob, lean)
    const B = local[0].compose(body.position, euler(body.rotation), _one);
    for (let i = 0; i < 2; i++) {
      const l = legs[i], rx = l.rotation.x * M.legAmp;
      local[1 + i].copy(B).multiply(_m.compose(J.hip[i], euler(l.rotation, M.legAmp, 1, M.legAmp), _one));
      const bend = Math.max(0, rx) * 0.62 + Math.abs(rx) * 0.08;           // knee bends as the leg swings back
      local[7 + i].copy(local[1 + i]).multiply(Pk[i][0]).multiply(_r.makeRotationX(bend)).multiply(Pk[i][1]);
    }
    const qt = euler(torso.rotation).clone();
    const Tm = local[6].copy(B).multiply(_m.compose(J.spine, qt, _one));
    local[11].copy(B).multiply(_m.compose(J.spine, _q2.slerpQuaternions(_I, qt, 0.5), _one));
    for (let i = 0; i < 2; i++) {
      const a = arms[i], tool = i === 1 && rig.hasTool();
      // arms raised high to hold a stack: the long arms reach forward at chest height with bent elbows instead of covering the face
      const rx = a.rotation.x, lift = !tool && rx < -0.85, up = lift ? -0.85 + (rx + 0.85) * 0.25 : rx;
      _e.set(up * (tool ? 1 : M.armAmp), a.rotation.y, a.rotation.z * (tool ? 1 : M.armAmp), a.rotation.order);
      local[3 + i].copy(Tm).multiply(_m.compose(_p.copy(J.sh[i]).sub(J.spine), _q.setFromEuler(_e), _one));
      const bend = tool ? 0 : lift ? 0.22 + (-rx - 0.85) * 0.45 : Math.max(0, -rx) * 0.3;   // elbows bend as the arms come forward
      local[9 + i].copy(local[3 + i]).multiply(Pe[i][0]).multiply(_r.makeRotationX(-bend)).multiply(Pe[i][1]);
    }
    const qh = euler(head.rotation).clone();
    local[5].copy(Tm).multiply(_m.compose(headOff, qh, _one));
    local[12].copy(Tm).multiply(Pn[0]).multiply(_r.makeRotationFromQuaternion(_q2.slerpQuaternions(_I, qh, 0.5))).multiply(Pn[1]);
    // the long hair: hangs from the chest and swings gently, a bit more on the move
    const t = performance.now() / 1000 + rig.t0, mv = Math.min(1, Math.abs(body.position.y) * 0.6);
    const sx = 0.035 * Math.sin(t * 1.6) + 0.06 * mv - torso.rotation.x * 0.5, sz = 0.03 * Math.sin(t * 1.1 + 1) - torso.rotation.z * 0.6;
    local[13].copy(Tm).multiply(Ph[0]).multiply(_r.makeRotationFromEuler(_e.set(sx, 0, sz))).multiply(Ph[1]);
    for (let i = 0; i < 14; i++) bones[i].matrixWorld.multiplyMatrices(root.matrixWorld, local[i]);
  };
  // the updater runs after the pivots (it is added to the root after the body) and before skinning
  const upd = new THREE.Object3D(); upd.name = 'hero-rig';
  upd.updateMatrixWorld = function (force) { THREE.Object3D.prototype.updateMatrixWorld.call(this, force); rig.update(); };
  root.updateMatrixWorld(true); rig.update();
  const skel = new THREE.Skeleton(bones);
  const mesh = new THREE.SkinnedMesh(lib.geo, lib.mat);
  mesh.frustumCulled = false; mesh.castShadow = true;
  root.add(mesh); root.add(upd); root.updateMatrixWorld(true);
  mesh.bind(skel, mesh.matrixWorld);
  // shop clothes on the base body
  const fit = outfit(o || {});
  if (lib.shells) for (const part of ['torso', 'front', 'sleeves', 'legs', 'boots']) {
    if (!fit[part]) continue;
    const sm = new THREE.SkinnedMesh(lib.shells[part], shellMat(part === 'boots' && fit.cuff ? fit.boots : fit[part]));
    sm.frustumCulled = false; sm.userData.tint = fit[part]; root.add(sm); sm.bind(skel, mesh.matrixWorld);
  }
  if (fit.front && fit.dot && lib.shells) {   // 碎花围裙: little dots on the apron, skinned to the chest
    const g = lib.shells.front, p = g.attributes.position, ix = g.index.array, dots = [];
    for (let k = 0; k < ix.length && dots.length < 16; k += Math.max(3, Math.floor(ix.length / 48))) dots.push(ix[k]);
    const dm = new THREE.MeshLambertMaterial({ color: fit.dot });
    const chestInv = new THREE.Matrix4().copy(bones[6].matrixWorld).invert().multiply(root.matrixWorld);
    const holder = new THREE.Object3D(); holder.matrixAutoUpdate = false; root.add(holder);
    for (const i of dots) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), dm); d.position.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(chestInv); d.scale.set(1, 1, 0.5); holder.add(d); }
    const prev = rig.update; rig.update = () => { prev(); holder.matrix.copy(local[6]); };
  }
  // v6.0.0 owl companion on top of the head / hat
  const owl = root.userData.owl;
  if (owl) {
    head.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(head.matrixWorld).invert(), bb = new THREE.Box3();
    let top = 8.0;
    for (const c of head.children) if (c.userData.hat) { bb.setFromObject(c); if (!bb.isEmpty()) { bb.applyMatrix4(inv); top = Math.max(top, bb.max.y); } }
    head.add(owl);
    const s = 0.42; owl.scale.set(s / head.scale.x, s / head.scale.y, s / head.scale.z);
    owl.position.set(0, top - 0.4, -0.3); owl.rotation.set(0, 0, 0);
  }
  body.rotation.copy(sv.b); torso.rotation.copy(sv.t); head.rotation.copy(sv.h); body.position.y = sv.by;
  arms.forEach((a, i) => a.rotation.copy(sv.a[i])); legs.forEach((l, i) => l.rotation.copy(sv.l[i]));
  pp.glbModel = mesh; pp.heroRig = rig;
}

export function attachHeroModel(pp) {
  const key = keyFor(pp.o || {}), st = STATE[key] || (load(key), STATE[key]);
  if (st.failed) return false;
  if (st.lib) { apply(pp, key); return true; }
  pp.body.visible = false;
  st.pending.push([pp]);
  return true;
}
for (const k in MODELS) if (!STATE[k]) load(k);   // load behind the loading screen
