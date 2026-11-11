// Reusable open wooden harvest crate for loose crops and freshly caught fish.
// Cargo remains the original item stack; the crate is purely visual.
import * as THREE from '../vendor/three.module.min.js';

export const PACKABLE_CARGO = Object.freeze(new Set([
  'wheat', 'tulip', 'rose', 'potato', 'tomato', 'corn', 'pumpkin', 'berry',
  'apple', 'fish', 'grape', 'pepper', 'gold',
]));

export function isPackableCargo(item) { return PACKABLE_CARGO.has(item); }
export function hasPackableCargo(stack = [], incomingItems = {}) {
  const items = [...stack, ...Object.entries(incomingItems).flatMap(([item, n]) => Array(n).fill(item))];
  return items.some(isPackableCargo);
}

// Carried crates form one vertical column: the next box goes directly above the last.
export function cargoCratePosition(boxIndex) {
  const tier = Math.max(0, Math.floor(boxIndex));
  return { x: 0, z: 0, base: tier * 18 };
}


// A low-draw-call single-column stack of small open crates carried as one batch. Each box holds
// 24 visible units; every additional box sits directly above the previous one.
const CRATE_MAX = 32;
const crateUnit = new THREE.BoxGeometry(1, 1, 1);
const railMat = new THREE.MeshLambertMaterial({ color: 0xC77A37 });
const postMat = new THREE.MeshLambertMaterial({ color: 0x835027 });
const floorMat = new THREE.MeshLambertMaterial({ color: 0xA9642D });
const _crateM = new THREE.Matrix4(), _crateQ = new THREE.Quaternion(), _crateP = new THREE.Vector3(), _crateS = new THREE.Vector3();

export function makeCargoCrateStack() {
  const frame = new THREE.Group(); frame.name = 'carried-crate-stack';
  const rails = new THREE.InstancedMesh(crateUnit, railMat, CRATE_MAX * 12);
  const posts = new THREE.InstancedMesh(crateUnit, postMat, CRATE_MAX * 4);
  const floors = new THREE.InstancedMesh(crateUnit, floorMat, CRATE_MAX);
  for (const mesh of [rails, posts, floors]) {
    mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); frame.add(mesh);
  }
  frame.userData.crateMeshes = { rails, posts, floors, count: -1 };
  return frame;
}

export function updateCargoCrateStack(frame, packedCount) {
  const data = frame?.userData?.crateMeshes; if (!data) return;
  const boxes = Math.min(CRATE_MAX, Math.ceil(Math.max(0, packedCount) / 24));
  if (data.count === boxes) return;
  let nr = 0, np = 0, nf = 0;
  const write = (mesh, index, x, y, z, sx, sy, sz) => {
    _crateP.set(x, y, z); _crateQ.identity(); _crateS.set(sx, sy, sz);
    _crateM.compose(_crateP, _crateQ, _crateS); mesh.setMatrixAt(index, _crateM);
  };
  for (let b = 0; b < boxes; b++) {
    const { x: cx, z: cz, base } = cargoCratePosition(b);
    // Three warm horizontal slats on every side keep each box visibly open and crafted.
    for (const h of [4, 9, 14]) {
      write(data.rails, nr++, cx, base + h, cz - 13.5, 33, 2, 2);
      write(data.rails, nr++, cx, base + h, cz + 13.5, 33, 2, 2);
      write(data.rails, nr++, cx - 15.5, base + h, cz, 2, 2, 25);
      write(data.rails, nr++, cx + 15.5, base + h, cz, 2, 2, 25);
    }
    for (const dx of [-15.5, 15.5]) for (const dz of [-13.5, 13.5]) write(data.posts, np++, cx + dx, base + 8.5, cz + dz, 3, 17, 3);
    write(data.floors, nf++, cx, base + 1, cz, 30, 2, 24);
  }
  data.rails.count = nr; data.posts.count = np; data.floors.count = nf; data.count = boxes;
  for (const mesh of [data.rails, data.posts, data.floors]) if (mesh.count) mesh.instanceMatrix.needsUpdate = true;
}

export function makeWoodCrate() {
  const crate = new THREE.Group();
  crate.name = 'harvest-wood-crate';
  const wood = new THREE.MeshLambertMaterial({ color: 0xC77A37 });
  const light = new THREE.MeshLambertMaterial({ color: 0xE5A65C });
  const dark = new THREE.MeshLambertMaterial({ color: 0x835027 });
  const iron = new THREE.MeshLambertMaterial({ color: 0x574334 });
  const plank = (w, h, d, material, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; crate.add(m); return m;
  };
  // Warm, open slatted box: contents stay visible rather than being hidden in a solid cube.
  plank(33, 2.2, 28, dark, 0, 1.2, 0); // floor
  for (const side of [-1, 1]) {
    plank(33, 4.2, 2, wood, 0, 4.2, side * 13);
    plank(33, 3.2, 2, light, 0, 9.0, side * 13);
    plank(33, 2.2, 2, wood, 0, 13.0, side * 13);
  }
  for (const side of [-1, 1]) {
    plank(2, 4.2, 22, wood, side * 15.5, 4.2, 0);
    plank(2, 3.2, 22, light, side * 15.5, 9.0, 0);
    plank(2, 2.2, 22, wood, side * 15.5, 13.0, 0);
  }
  // Corner uprights, pale top rails, and small dark nail heads add crafted detail at game scale.
  for (const x of [-15.5, 15.5]) for (const z of [-13, 13]) {
    plank(3, 16, 3, dark, x, 8, z);
    plank(3.4, 1.8, 3.4, light, x, 16.0, z);
  }
  for (const x of [-11, 0, 11]) for (const z of [-14.2, 14.2]) {
    const nail = new THREE.Mesh(new THREE.SphereGeometry(0.85, 8, 6), iron);
    nail.position.set(x, 8.8, z); nail.castShadow = true; crate.add(nail);
  }
  crate.userData.parts = crate.children.length;
  crate.userData.packable = true;
  return crate;
}
