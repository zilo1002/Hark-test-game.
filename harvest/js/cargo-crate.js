// Visual-only packages for carried harvest. Cargo stays in the original game stack.
import * as THREE from '../vendor/three.module.min.js';

// Vegetables remain loose. Fruit, grain, fish and the named finished foods are visibly packaged.
export const PACKABLE_CARGO = Object.freeze(new Set([
  'wheat', 'tulip', 'rose', 'berry', 'apple', 'fish', 'grape', 'gold', 'xiaolongbao', 'teasnack',
]));
const PACKAGE_KIND = Object.freeze({ fish: 'fish-crate', xiaolongbao: 'steamer', teasnack: 'steamer' });
const PACKAGE_CAPACITY = Object.freeze({ fish: 6, xiaolongbao: 6, teasnack: 6 });
const MAX_PACKAGES = 48;
export function isPackableCargo(item) { return PACKABLE_CARGO.has(item); }
export function packageKind(item) { return PACKAGE_KIND[item] || 'wood-crate'; }
export function packageCapacity(item) { return PACKAGE_CAPACITY[item] || 24; }
export function hasPackableCargo(stack = [], incomingItems = {}) {
  for (const item of stack) if (isPackableCargo(item)) return true;
  for (const [item, n] of Object.entries(incomingItems)) if (n > 0 && isPackableCargo(item)) return true;
  return false;
}

export function cargoPackageLayout(counts = {}) {
  if (typeof counts === 'number') counts = { wheat: counts };
  let nextBox = 0;
  const groups = {};
  for (const item of PACKABLE_CARGO) {
    const count = Math.max(0, Math.floor(counts[item] || 0));
    if (!count) continue;
    const capacity = packageCapacity(item), boxes = Math.min(MAX_PACKAGES - nextBox, Math.ceil(count / capacity));
    groups[item] = { startBox: nextBox, boxes, capacity, count, kind: packageKind(item) };
    nextBox += boxes;
    if (nextBox >= MAX_PACKAGES) break;
  }
  return { groups, boxes: nextBox };
}
export function cargoItemSlot(item, ordinal, counts = {}) {
  const layout = cargoPackageLayout(counts);
  const group = layout.groups[item];
  if (!group) return null;
  const n = Math.max(0, Math.floor(ordinal));
  const box = group.startBox + Math.floor(n / group.capacity);
  const within = n % group.capacity;
  const kind = group.kind;
  let x, z, y;
  if (kind === 'steamer') {
    const angle = (within / group.capacity) * Math.PI * 2 - Math.PI / 2;
    x = Math.cos(angle) * 8; z = Math.sin(angle) * 8; y = 7;
  } else if (kind === 'fish-crate') {
    x = [-15, 0, 15][within % 3]; z = [-9, 9][Math.floor(within / 3) % 2]; y = 6;
  } else {
    const layer = Math.floor(within / 12), cell = within % 12;
    x = [-11, -3.5, 3.5, 11][cell % 4]; z = [-8, -2.7, 2.7][Math.floor(cell / 4)]; y = 4.5 + layer * 5;
  }
  const { x: cx, z: cz, base } = cargoCratePosition(box, kind, layout.groups);
  return { x: cx + x, y: base + y, z: cz + z, box, kind };
}

// v5.0.4: back to one row — Jin wants the back basket in a single column again (the v4.9.6
// two-boxes-wide pair sat left and right and got in the way when moving). Every box/steamer
// sits directly above the previous one. `kind` is kept for callers; a single column needs no
// per-kind sideways spacing.
// v5.0.6: crates sit snug, not floating — the step was 24 but a wood crate is only ~17 tall
// (posts base+0..17), leaving a 7 gap that read as floating in mid-air. The step is now the
// crate's own height + a 1–2 slit (wood/fish 19, steamer 13: a steamer is only ~6.5 tall but
// its buns poke up to ~12.9, so 13 leaves the buns just under the next floor). A mixed stack
// stacks by cumulative height, not boxIndex * one step, or a steamer would land inside a
// wood crate below it — pass the layout groups so the base sums the steps beneath.
const CRATE_STEP = Object.freeze({ 'wood-crate': 19, 'fish-crate': 19, steamer: 13 });
export function crateStep(kind) { return CRATE_STEP[kind] || 19; }
export function cargoCrateBase(boxIndex, kind, groups) {
  const i = Math.max(0, Math.floor(boxIndex));
  if (!groups) return i * crateStep(kind);
  let base = 0;
  for (const g of Object.values(groups)) base += Math.max(0, Math.min(g.startBox + g.boxes, i) - g.startBox) * crateStep(g.kind);
  return base;
}
export function cargoCratePosition(boxIndex, kind = 'wood-crate', groups) {
  return { x: 0, z: 0, base: cargoCrateBase(boxIndex, kind, groups) };
}

const cube = new THREE.BoxGeometry(1, 1, 1);
const railMat = new THREE.MeshLambertMaterial({ color: 0xC77A37 });
const postMat = new THREE.MeshLambertMaterial({ color: 0x835027 });
const floorMat = new THREE.MeshLambertMaterial({ color: 0xA9642D });
const bambooMat = new THREE.MeshLambertMaterial({ color: 0xC99552 });
const bambooDark = new THREE.MeshLambertMaterial({ color: 0x80552D });
const steamerFloor = new THREE.CylinderGeometry(16, 16, 3, 12);
const steamerRim = new THREE.TorusGeometry(15.5, 1.5, 4, 12);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

function mesh(geo, mat, cap, name) {
  const o = new THREE.InstancedMesh(geo, mat, cap);
  o.name = name; o.count = 0; o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true;
  o.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return o;
}
export function makeCargoCrateStack() {
  const frame = new THREE.Group(); frame.name = 'carried-package-stack';
  const parts = {
    rails: mesh(cube, railMat, MAX_PACKAGES * 12, 'wood-crate-rails'),
    posts: mesh(cube, postMat, MAX_PACKAGES * 4, 'wood-crate-posts'),
    floors: mesh(cube, floorMat, MAX_PACKAGES, 'wood-crate-floors'),
    fishRails: mesh(cube, railMat, MAX_PACKAGES * 12, 'fish-crate-rails'),
    fishPosts: mesh(cube, postMat, MAX_PACKAGES * 4, 'fish-crate-posts'),
    fishFloors: mesh(cube, floorMat, MAX_PACKAGES, 'fish-crate-floors'),
    steamFloors: mesh(steamerFloor, bambooMat, MAX_PACKAGES, 'bamboo-steamer-floors'),
    steamRims: mesh(steamerRim, bambooDark, MAX_PACKAGES, 'bamboo-steamer-rims'),
    steamBands: mesh(cube, bambooDark, MAX_PACKAGES * 4, 'bamboo-steamer-bands'),
    signature: '',
  };
  for (const [key, value] of Object.entries(parts)) if (value?.isObject3D) frame.add(value);
  frame.userData.packageMeshes = parts;
  return frame;
}
function write(target, i, x, y, z, sx, sy, sz, rx = 0) {
  _p.set(x, y, z); _q.setFromEuler(new THREE.Euler(rx, 0, 0)); _s.set(sx, sy, sz);
  _m.compose(_p, _q, _s); target.setMatrixAt(i, _m);
}
function setCount(target, n) { target.count = n; if (n) target.instanceMatrix.needsUpdate = true; }

export function updateCargoCrateStack(frame, counts = {}) {
  const data = frame?.userData?.packageMeshes; if (!data) return;
  if (typeof counts === 'number') counts = { wheat: counts };
  const layout = cargoPackageLayout(counts), sig = JSON.stringify(layout.groups);
  if (data.signature === sig) return;
  data.signature = sig;
  let r=0,p=0,f=0, fr=0,fp=0,ff=0,sf=0,sr=0,sb=0;
  for (const [item, group] of Object.entries(layout.groups)) for (let i=0;i<group.boxes;i++) {
    const box = group.startBox + i, { x: cx, z: cz, base } = cargoCratePosition(box, group.kind, layout.groups);
    if (group.kind === 'steamer') {
      write(data.steamFloors,sf++,cx,base+2,cz,1,1,1);
      write(data.steamRims,sr++,cx,base+5,cz,1,1,1,Math.PI/2);
      for (const dx of [-6,6]) write(data.steamBands,sb++,cx+dx,base+2.5,cz,1,2,30,0);
      for (const dz of [-6,6]) write(data.steamBands,sb++,cx,base+2.5,cz+dz,30,2,1,0);
      continue;
    }
    const fish = group.kind === 'fish-crate';
    const W = fish ? 48 : 33, D = fish ? 38 : 28, wx=W/2, dz=D/2;
    const rails=fish?data.fishRails:data.rails, posts=fish?data.fishPosts:data.posts, floors=fish?data.fishFloors:data.floors;
    if (fish) { fr+=12; fp+=4; ff++; } else { r+=12; p+=4; f++; }
    let ri=fish?fr-12:r-12, pi=fish?fp-4:p-4;
    for (const h of [4,9,14]) {
      write(rails,ri++,cx,base+h,cz-dz, W,2,2); write(rails,ri++,cx,base+h,cz+dz,W,2,2);
      write(rails,ri++,cx-wx,base+h,cz,2,2,D); write(rails,ri++,cx+wx,base+h,cz,2,2,D);
    }
    for (const dx of [-wx,wx]) for (const z0 of [-dz,dz]) write(posts,pi++,cx+dx,base+8.5,cz+z0,3,17,3);
    write(floors,fish?ff-1:f-1,cx,base+1,cz,W-3,2,D-3);
  }
  for (const [key,n] of [['rails',r],['posts',p],['floors',f],['fishRails',fr],['fishPosts',fp],['fishFloors',ff],['steamFloors',sf],['steamRims',sr],['steamBands',sb]]) setCount(data[key],n);
}

export function makeWoodCrate() {
  const crate = new THREE.Group(); crate.name = 'harvest-wood-crate';
  const wood = new THREE.MeshLambertMaterial({ color: 0xC77A37 });
  const light = new THREE.MeshLambertMaterial({ color: 0xE5A65C });
  const dark = new THREE.MeshLambertMaterial({ color: 0x835027 });
  const iron = new THREE.MeshLambertMaterial({ color: 0x574334 });
  const plank = (w, h, d, material, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; crate.add(m); return m;
  };
  plank(33, 2.2, 28, dark, 0, 1.2, 0);
  for (const side of [-1, 1]) {
    plank(33, 4.2, 2, wood, 0, 4.2, side * 13); plank(33, 3.2, 2, light, 0, 9.0, side * 13); plank(33, 2.2, 2, wood, 0, 13.0, side * 13);
    plank(2, 4.2, 22, wood, side * 15.5, 4.2, 0); plank(2, 3.2, 22, light, side * 15.5, 9.0, 0); plank(2, 2.2, 22, wood, side * 15.5, 13.0, 0);
  }
  for (const x of [-15.5, 15.5]) for (const z of [-13, 13]) { plank(3,16,3,dark,x,8,z); plank(3.4,1.8,3.4,light,x,16,z); }
  for (const x of [-11,0,11]) for (const z of [-14.2,14.2]) { const nail=new THREE.Mesh(new THREE.SphereGeometry(.85,8,6),iron); nail.position.set(x,8.8,z); nail.castShadow=true; crate.add(nail); }
  crate.userData.parts=crate.children.length; crate.userData.packable=true; return crate;
}
