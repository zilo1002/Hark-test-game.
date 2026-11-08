// Low-poly models built from Three.js primitives: crops, stack items, chunky cartoon people,
// animals, machines and the environment. Every static model is merged into one geometry with
// vertex colours, so a whole field or every item of a kind is a single InstancedMesh draw.
import * as THREE from '../vendor/three.module.min.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

// one primitive with a colour and a transform: P(geo, '#hex', [x,y,z], [rx,ry,rz], [sx,sy,sz])
export function P(geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) { return { geo, color, pos, rot, scl }; }

export function merge(parts) {
  const geos = [];
  let n = 0;
  for (const pt of parts) {
    let g = pt.geo.index ? pt.geo.toNonIndexed() : pt.geo.clone();
    g.deleteAttribute('uv');
    _e.set(pt.rot[0], pt.rot[1], pt.rot[2]); _q.setFromEuler(_e);
    _m.compose(_p.set(pt.pos[0], pt.pos[1], pt.pos[2]), _q, _s.set(pt.scl[0], pt.scl[1], pt.scl[2]));
    g.applyMatrix4(_m);
    _c.set(pt.color);
    const cnt = g.attributes.position.count, col = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geos.push(g); n += cnt;
  }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); col.set(g.attributes.color.array, o);
    o += g.attributes.position.count * 3; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

// shared primitive cache (unit-ish sizes, scaled per part)
const G = {};
export const box = (w, h, d) => G[`b${w},${h},${d}`] || (G[`b${w},${h},${d}`] = new THREE.BoxGeometry(w, h, d));
export const cyl = (rt, rb, h, s = 8) => G[`c${rt},${rb},${h},${s}`] || (G[`c${rt},${rb},${h},${s}`] = new THREE.CylinderGeometry(rt, rb, h, s));
export const cylO = (rt, rb, h, s = 3) => G[`o${rt},${rb},${h},${s}`] || (G[`o${rt},${rb},${h},${s}`] = new THREE.CylinderGeometry(rt, rb, h, s, 1, true));
export const sph = (r, w = 8, h = 6) => G[`s${r},${w},${h}`] || (G[`s${r},${w},${h}`] = new THREE.SphereGeometry(r, w, h));
export const ico = (r, d = 0) => G[`i${r},${d}`] || (G[`i${r},${d}`] = new THREE.IcosahedronGeometry(r, d));
export const cone = (r, h, s = 8) => G[`k${r},${h},${s}`] || (G[`k${r},${h},${s}`] = new THREE.ConeGeometry(r, h, s));
export const cap = (r, l, cs = 3, rs = 8) => G[`p${r},${l}`] || (G[`p${r},${l}`] = new THREE.CapsuleGeometry(r, l, cs, rs));
// v4.1 outfit fitting: a dome (top half of a sphere) for caps / beanies, and a curved front panel
// (an open cylinder segment centred on +Z) for aprons, bibs and shirt fronts that hug the torso
export const dome = (r, w = 12, h = 6) => G[`d${r},${w},${h}`] || (G[`d${r},${w},${h}`] = new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, Math.PI / 2));
export const panel = (rt, rb, h, len) => G[`f${rt},${rb},${h},${len}`] || (G[`f${rt},${rb},${h},${len}`] = new THREE.CylinderGeometry(rt, rb, h, 10, 1, true, -len / 2, len));
export const tor = (r, t, rs = 4, ts = 10, arc = Math.PI * 2) => G[`t${r},${t},${arc}`] || (G[`t${r},${t},${arc}`] = new THREE.TorusGeometry(r, t, rs, ts, arc));

const H = Math.PI / 2;

// ------------------------------------------------------------------ materials
const MATS = {};
export function vcMat(key = 'vc', opts = {}) {
  return MATS[key] || (MATS[key] = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...opts }));
}
export function colMat(hex) {
  return MATS[hex] || (MATS[hex] = new THREE.MeshLambertMaterial({ color: hex, flatShading: true }));
}

// ------------------------------------------------------------------ stack / pile items
// Each item sits centred on its origin, about CFG.items[type].step tall, ~12-14 units wide.
const ITEM_PARTS = {
  wheat: () => [
    P(cyl(2.5, 2.5, 11, 7), '#E9B83A', [0, 0, 0], [0, 0, H], [1, 1, 1.25]),
    P(ico(3.2, 0), '#FFE07A', [6.4, 0.3, 0], [0, 0, 0], [1.2, 0.85, 1.3]),
    P(ico(3.0, 0), '#FFD65A', [-6.2, 0.2, 0], [0, 0.5, 0], [1.1, 0.85, 1.3]),
    P(cyl(2.75, 2.75, 1.6, 7), '#A8741E', [0, 0, 0], [0, 0, H], [1, 1, 1.25]),
  ],
  tulip: () => {
    // a wrapped bunch seen side-on: big pink cups up front, short stems, one leaf
    const out = [];
    for (const [z, y, c, x] of [[-2.6, 0, '#F2486E', 3.0], [0, 0.5, '#FF6F92', 4.2], [2.6, 0, '#E8365E', 3.0]]) {
      out.push(P(cyl(0.6, 0.6, 7, 5), '#4FAE32', [-2.4, y - 0.6, z], [0, 0, H]));
      out.push(P(cyl(2.5, 1.5, 4.4, 6), c, [x, y, z], [0, 0, -H]));
      out.push(P(cone(1.0, 1.6, 4), c, [x + 2.8, y + 1.0, z], [0, 0, -H]));
    }
    out.push(P(box(3, 2.6, 6.8), '#FFF3E0', [-3.2, -0.4, 0]));
    out.push(P(cone(1.6, 6, 4), '#3E9B2A', [-3, -1.6, 2.6], [0, 0, H], [1, 1, 0.4]));
    return out;
  },
  gold: () => [
    P(cyl(5.6, 5.4, 2.2, 10), '#FFB80F', [0, -0.3, 0]),
    P(cyl(5.0, 5.0, 2.4, 10), '#FFD84A', [0, 0.1, 0], [0, Math.PI / 10, 0]),
    P(cyl(2.3, 2.6, 1.4, 8), '#E07A0A', [0, 1.4, 0]),
  ],
  rose: () => {
    const out = [];
    for (const [z, c, x] of [[-2.6, '#E0283C', 3.2], [0, '#F03A50', 4.4], [2.6, '#C8102E', 3.2]]) {
      out.push(P(cyl(0.55, 0.55, 6.5, 5), '#3E8F25', [-2.6, -0.6, z], [0, 0, H]));
      out.push(P(ico(2.6, 0), c, [x, 0.3, z], [0.4, 0.3, 0]));
      out.push(P(ico(1.6, 0), '#FF5A78', [x + 0.8, 1.2, z]));
      out.push(P(cone(1.8, 1.6, 5), '#2F7A1E', [x - 2.4, 0, z], [0, 0, H]));
    }
    out.push(P(box(3, 2.4, 7.2), '#FFFFFF', [-3.4, -0.5, 0]));
    return out;
  },
  egg: () => [P(sph(1, 7, 5), '#FFF8EA', [0, 0, 0], [0, 0, 0], [5.6, 4.5, 4.6])],
  potato: () => [P(ico(1, 0), '#C98A4B', [0, 0, 0], [0.3, 0.7, 0.2], [6.4, 4.8, 5.2]), P(ico(0.9, 0), '#B07840', [2.0, 2.2, 1.4])],
  tomato: () => [
    P(sph(3.4, 7, 5), '#EE4630', [0, 0, 0], [0, 0, 0], [1, 0.82, 1]),
    P(cone(2.1, 0.8, 5), '#3E9B2A', [0, 2.9, 0]),
    P(cyl(0.4, 0.4, 1.4, 4), '#2F7A1E', [0, 3.6, 0]),
  ],
  crate: () => {
    const out = [P(box(14, 6.5, 10), '#C8874A'), P(box(14.4, 1.4, 10.4), '#8E5627', [0, -1.6, 0]), P(box(14.4, 1.2, 10.4), '#E3A866', [0, 2.6, 0])];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) out.push(P(sph(1.8, 6, 5), '#FFF1D2', [-4.6 + i * 4.6, 3.9, -2.4 + j * 4.8], [0, 0, 0], [1, 0.8, 1]));
    return out;
  },
  ketchup: () => [
    P(cyl(3.0, 3.3, 6.4, 8), '#E2261C', [0, -1.2, 0]),
    P(cyl(3.35, 3.35, 2.6, 8), '#FFFFFF', [0, -1.0, 0]),
    P(cyl(1.4, 2.6, 1.8, 8), '#E2261C', [0, 2.8, 0]),
    P(cyl(1.5, 1.5, 1.4, 8), '#FFFFFF', [0, 4.1, 0]),
  ],
  bouquet: () => [
    P(cone(3.6, 11, 7), '#FFB3C8', [-1.2, 0, 0], [0, 0, H]),
    P(cyl(1.0, 1.0, 1.4, 6), '#E86AA6', [-3.6, 0, 0], [0, 0, H]),
    P(ico(2.2, 0), '#FFC21A', [5.0, 1.2, -1.6]),
    P(ico(2.1, 0), '#F2486E', [5.2, 1.0, 1.8]),
    P(ico(2.0, 0), '#FFFFFF', [5.8, -1.6, 0]),
    P(ico(1.6, 0), '#5DBB3A', [3.6, -2.2, 1.4]),
  ],
  basket: () => [
    P(cyl(6.0, 4.6, 4.8, 9), '#C98A4B', [0, -1.6, 0]),
    P(cyl(6.2, 6.2, 1.1, 9), '#9C6331', [0, 0.8, 0]),
    P(tor(5, 0.6, 3, 9, Math.PI), '#9C6331', [0, 1, 0]),
    P(ico(2.2, 0), '#F2486E', [-2.4, 2.0, -1.4]),
    P(ico(2.1, 0), '#FFC21A', [2.2, 2.0, 1.2]),
    P(ico(1.9, 0), '#FF8FB0', [0.4, 2.2, -2.6]),
    P(ico(1.8, 0), '#FFFFFF', [-0.6, 2.0, 2.6]),
  ],
  perfume: () => [
    P(box(7, 5.8, 5), '#FF8FB0', [0, -1.2, 0]),
    P(box(5.4, 4.4, 5.2), '#FFC2DA', [0, -1.0, 0]),
    P(cyl(1.0, 1.2, 1.6, 6), '#FFFFFF', [0, 2.4, 0]),
    P(sph(1.8, 7, 5), '#F2B529', [0, 4.0, 0]),
  ],
  // ---- v3.3 items ----
  log: () => [   // a chunky log lying along x: bark, pale end rings
    P(cyl(2.8, 2.8, 13, 8), '#9A5A2E', [0, 0, 0], [0, 0, H]),
    P(cyl(2.4, 2.4, 13.2, 8), '#F2CF8A', [0, 0, 0], [0, 0, H], [1, 1, 1]),
    P(cyl(2.85, 2.85, 11.6, 8), '#8A4E26', [0, 0, 0], [0, 0, H]),
    P(cyl(0.9, 0.9, 13.4, 6), '#C99A5E', [0, 0, 0], [0, 0, H]),
    P(box(2.2, 1.6, 1.6), '#5E8F2A', [2.6, 2.4, 0.6]),
  ],
  plank: () => [P(box(15, 2.6, 7), '#E9B672'), P(box(15.2, 0.6, 7.2), '#C98A4B', [0, 1.1, 0]), P(box(13, 0.4, 0.6), '#B9783C', [0, 1.45, -1.6]), P(box(10, 0.4, 0.6), '#B9783C', [-1, 1.45, 1.8])],
  chair: () => [
    P(box(10, 1.8, 10), '#D99A5A', [0, 0, 0]),
    P(box(10, 9, 1.8), '#C8874A', [0, 5.4, -4.1]), P(box(10.4, 1.6, 2.2), '#E9B672', [0, 9.8, -4.1]),
    P(box(1.6, 5, 1.6), '#8E5627', [-4, -3.4, -4]), P(box(1.6, 5, 1.6), '#8E5627', [4, -3.4, -4]), P(box(1.6, 5, 1.6), '#8E5627', [-4, -3.4, 4]), P(box(1.6, 5, 1.6), '#8E5627', [4, -3.4, 4]),
    P(box(8, 1.4, 6), '#E8452C', [0, 1.4, 0.6]),
  ],
  milk: () => [   // glass milk bottle with a red cap
    P(cyl(2.9, 3.0, 7.2, 9), '#FFFFFF', [0, -1, 0]),
    P(cyl(1.6, 2.9, 1.8, 9), '#FFFFFF', [0, 3.4, 0]),
    P(cyl(1.7, 1.7, 1.2, 9), '#E8452C', [0, 4.8, 0]),
    P(cyl(3.05, 3.05, 2.2, 9), '#3B7FE0', [0, -0.6, 0]),
  ],
  cheese: () => [   // a fat yellow wedge with holes
    P(cyl(6, 6, 5.4, 3), '#FFD23F', [0, 0, 0], [0, 0.4, 0], [1, 1, 0.8]),
    P(sph(1.1, 6, 4), '#E8A20E', [1.2, 2.7, 0.6]), P(sph(0.9, 6, 4), '#E8A20E', [-2, 2.7, -1.2]), P(sph(0.8, 6, 4), '#E8A20E', [3.6, 0.6, 2.6]),
  ],
  icecream: () => [
    P(cone(3.2, 8, 8), '#E3A866', [0, -2, 0], [Math.PI, 0, 0]),
    P(sph(3.4, 8, 6), '#FFB3C8', [0, 2.6, 0]), P(sph(2.6, 8, 6), '#FFF3E0', [0, 5.6, 0]),
    P(sph(0.9, 5, 4), '#E0283C', [0, 8.2, 0]),
  ],
  corn: () => [
    P(cap(2.2, 7, 2, 8), '#FFD23F', [0, 0, 0], [0, 0, H]),
    P(cone(2.6, 7, 5), '#6CCB3E', [-3.4, -0.4, 1.4], [0, 0.3, H], [1, 1, 0.5]),
    P(cone(2.6, 7, 5), '#4FAE32', [-3.4, -0.4, -1.4], [0, -0.3, H], [1, 1, 0.5]),
  ],
  popcorn: () => [
    P(cyl(4.2, 3.2, 7.5, 10), '#FFFFFF', [0, -0.6, 0]),
    P(cyl(4.25, 3.25, 7.5, 10, 1), '#E8452C', [0, -0.6, 0], [0, 0, 0], [1.01, 1, 0.5]),
    P(ico(1.8, 0), '#FFF6D0', [-1.6, 3.8, 0.8]), P(ico(1.8, 0), '#FFFFFF', [1.6, 4, -0.6]), P(ico(1.6, 0), '#FFE58A', [0, 4.8, 1.6]), P(ico(1.5, 0), '#FFFFFF', [0.4, 4.4, -2]),
  ],
  pumpkin: () => [
    P(sph(4.6, 10, 7), '#F2871E', [0, 0, 0], [0, 0, 0], [1.15, 0.8, 1.15]),
    P(sph(3.6, 8, 6), '#FF9F38', [0, 0.2, 0], [0, 0.4, 0], [1.35, 0.85, 0.9]),
    P(cyl(0.6, 0.9, 2.4, 5), '#6B8E23', [0, 3.6, 0]),
    P(cone(1.6, 3, 4), '#4FAE32', [1.8, 3.2, 0], [0, 0, -1.2], [1, 1, 0.4]),
  ],
  pie: () => [
    P(cyl(6.6, 5.6, 3, 12), '#E3A866', [0, -0.4, 0]),
    P(cyl(6.0, 6.0, 1.2, 12), '#E8871E', [0, 1.1, 0]),
    P(tor(6.1, 0.8, 4, 12), '#F2C08A', [0, 1.4, 0], [H, 0, 0]),
    P(sph(1.4, 6, 4), '#FFFFFF', [0, 2, 0], [0, 0, 0], [1, 0.5, 1]),
  ],
  berry: () => [
    P(cone(3.2, 5.6, 7), '#E8243C', [0, -0.6, 0], [Math.PI, 0, 0]),
    P(sph(3.2, 7, 4, 0), '#F03A50', [0, 1.6, 0], [0, 0, 0], [1, 0.5, 1]),
    P(cone(2.4, 1.4, 5), '#3E9B2A', [0, 2.6, 0]),
  ],
  jam: () => [
    P(cyl(3.4, 3.4, 6, 10), '#C8102E', [0, -0.8, 0]),
    P(cyl(3.6, 3.6, 1.8, 10), '#FFFFFF', [0, 2.8, 0]), P(cyl(3.8, 3.4, 0.9, 10), '#E8452C', [0, 3.5, 0]),
    P(box(4.4, 2.6, 0.6), '#FFF3E0', [0, -0.8, 3.3]),
  ],
  wool: () => [P(ico(4, 1), '#FFFFFF', [0, 0, 0], [0, 0, 0], [1.1, 0.9, 1]), P(ico(2.6, 0), '#F4F0E8', [2.6, 1.6, 1]), P(ico(2.4, 0), '#F4F0E8', [-2.4, 1.4, -1.2])],
  yarn: () => [
    P(sph(4, 9, 7), '#FF6FA8', [0, 0, 0]),
    P(tor(4.05, 0.45, 3, 12), '#E8457E', [0, 0, 0], [0.5, 0, 0.2]), P(tor(4.05, 0.45, 3, 12), '#E8457E', [-0.6, 0.6, 0]), P(tor(4.05, 0.45, 3, 12), '#FF9AC4', [H, 0.3, 0]),
    P(cyl(0.6, 0.6, 3, 5), '#B9783C', [3.2, 2.6, 0], [0, 0, 0.8]),
  ],
  honey: () => [
    P(cyl(3.6, 3.2, 6, 10), '#FFB80F', [0, -0.8, 0]),
    P(cyl(3.0, 3.6, 1.2, 10), '#FFD23F', [0, 2.6, 0]),
    P(cyl(3.9, 3.9, 1.4, 10), '#E8E0D0', [0, 3.6, 0]),
    P(box(4.6, 2.4, 0.6), '#5A3414', [0, -0.6, 3.3]),
  ],
  apple: () => [
    P(sph(3.5, 8, 6), '#E8283C', [0, 0, 0], [0, 0, 0], [1.05, 0.95, 1.05]),
    P(cyl(0.35, 0.35, 2, 4), '#6B3A1E', [0, 3.6, 0]),
    P(cone(1.2, 2.8, 4), '#4FAE32', [1.2, 3.6, 0], [0, 0, -1.1], [1, 1, 0.4]),
  ],
  juice: () => [
    P(box(6, 9, 6), '#FFF3E0', [0, -0.4, 0]), P(box(6.2, 4.4, 6.2), '#5DBB3A', [0, -1.4, 0]),
    P(sph(1.6, 7, 5), '#E8283C', [0, -1.4, 3.1], [0, 0, 0], [1, 1, 0.4]),
    P(cyl(0, 3.2, 2.4, 4), '#FFF3E0', [0, 5.2, 0], [0, Math.PI / 4, 0]), P(cyl(0.9, 0.9, 1, 6), '#E8452C', [1.4, 5.4, 1.4]),
  ],
  // ---- v3.7 items ----
  flour: () => [   // a fat flour sack lying on its side: blue band, wheat badge, tied neck
    P(cap(3.0, 6.2, 3, 9), '#F6F0E0', [0, 0, 0], [0, 0, H], [1, 0.92, 1.18]),
    P(cyl(3.08, 3.08, 1.5, 9), '#3B7FE0', [-1.6, 0, 0], [0, 0, H], [1, 0.93, 1.19]),
    P(cyl(1.0, 1.6, 1.8, 7), '#D9C9A0', [6.6, 0, 0], [0, 0, H]), P(ico(1.3, 0), '#F6F0E0', [8.0, 0, 0]),
    P(box(2.6, 0.5, 2.2), '#FFC21A', [1.8, 2.75, 0], [0, 0.3, 0]),
  ],
  bread: () => [   // golden loaf with three slashes
    P(cap(2.9, 6, 3, 9), '#D9822E', [0, 0, 0], [0, 0, H], [1, 0.82, 1.15]),
    P(cap(2.5, 5.4, 3, 9), '#F2A64E', [0, 0.5, 0], [0, 0, H], [1, 0.8, 1.05]),
    ...[-3, 0, 3].map((x) => P(box(0.8, 0.6, 3.6), '#FFE0A8', [x, 2.6, 0], [0, 0.5, 0])),
  ],
  fish: () => [   // a chubby blue fish lying flat
    P(sph(1, 9, 6), '#4FA8F0', [0, 0, 0], [0, 0, 0], [6.0, 2.4, 2.6]),
    P(sph(1, 8, 5), '#E8F6FF', [0.6, -0.9, 0], [0, 0, 0], [4.8, 1.3, 2.0]),
    P(cone(2.6, 3.4, 4), '#2F86D0', [-7.2, 0, 0], [0, 0, -H], [1, 1, 0.45]),
    P(cone(1.4, 2.6, 4), '#2F86D0', [0, 2.6, 0], [0, 0, 0], [1.6, 1, 0.4]),
    P(sph(0.7, 5, 4), '#1A1A1A', [4.2, 0.6, 1.9]), P(sph(0.7, 5, 4), '#1A1A1A', [4.2, 0.6, -1.9]),
  ],
  smoked: () => [   // a golden-brown smoked fish tied with string
    P(sph(1, 9, 6), '#C8702A', [0, 0, 0], [0, 0, 0], [6.0, 2.4, 2.6]),
    P(sph(1, 8, 5), '#E8A050', [0.6, 0.8, 0], [0, 0, 0], [4.6, 1.4, 1.9]),
    P(cone(2.6, 3.4, 4), '#8E4A1E', [-7.2, 0, 0], [0, 0, -H], [1, 1, 0.45]),
    P(cyl(2.7, 2.7, 0.6, 8), '#F2E2B0', [-2, 0, 0], [0, 0, H], [1, 1, 1.05]), P(cyl(2.7, 2.7, 0.6, 8), '#F2E2B0', [2, 0, 0], [0, 0, H], [1, 1, 1.05]),
    P(sph(0.6, 5, 4), '#3A1A08', [4.2, 0.6, 1.9]),
  ],
  grape: () => {   // a purple bunch with a leaf, lying on its side
    const out = [P(cyl(0.45, 0.45, 3, 4), '#6B3A1E', [5.4, 0.4, 0], [0, 0, H]), P(cone(2.4, 4, 4), '#4FAE32', [4.6, 1.6, 1.4], [0.4, 0, H], [1, 1, 0.35])];
    for (const [x, y, z] of [[3, 0, -1.6], [3, 0, 1.6], [3, 1.8, 0], [0.4, 0, -2.4], [0.4, 0, 0], [0.4, 0, 2.4], [0.4, 2, -1.2], [0.4, 2, 1.2], [-2.2, 0, -1.4], [-2.2, 0, 1.4], [-2.2, 1.9, 0], [-4.4, 0.4, 0]]) out.push(P(ico(1.55, 0), (x + z) % 2 ? '#8E4EC0' : '#7A3EA8', [x, y, z]));
    return out;
  },
  gjuice: () => [
    P(box(6, 9, 6), '#F4EEFF', [0, -0.4, 0]), P(box(6.2, 4.4, 6.2), '#8A3EC8', [0, -1.4, 0]),
    P(sph(1.6, 7, 5), '#C89AF0', [0, -1.4, 3.1], [0, 0, 0], [1, 1, 0.4]),
    P(cyl(0, 3.2, 2.4, 4), '#F4EEFF', [0, 5.2, 0], [0, Math.PI / 4, 0]), P(cyl(0.9, 0.9, 1, 6), '#6A2E98', [1.4, 5.4, 1.4]),
  ],
  pepper: () => [   // a glossy yellow bell pepper
    P(sph(3.4, 9, 7), '#FFC21A', [0, 0, 0], [0, 0, 0], [1.05, 1.05, 1.05]),
    P(sph(2, 7, 5), '#FFD84A', [1.6, 0.4, 1.4]), P(sph(2, 7, 5), '#F2AE0E', [-1.6, 0.2, -1.2]),
    P(cone(1.8, 1.2, 6), '#3E9B2A', [0, 3.4, 0], [Math.PI, 0, 0]), P(cyl(0.5, 0.6, 2.2, 5), '#2F7A1E', [0, 4.6, 0]),
  ],
  wine: () => [   // a dark green bottle standing up, cream label, red foil cap
    P(cyl(2.8, 2.8, 7, 9), '#2E6B3A', [0, -1.6, 0]), P(sph(2.8, 9, 5), '#2E6B3A', [0, 1.9, 0], [0, 0, 0], [1, 0.6, 1]),
    P(cyl(1.1, 1.2, 3.4, 7), '#2E6B3A', [0, 4.2, 0]), P(cyl(1.25, 1.25, 1.6, 7), '#C8283C', [0, 6.1, 0]),
    P(cyl(2.9, 2.9, 3.2, 9), '#FFF3DC', [0, -1.8, 0]), P(sph(0.9, 5, 4), '#7A3EA8', [0, -1.8, 2.8]),
  ],
  chips: () => [   // v4.6 薯条: a red paper scoop of golden fries
    P(box(7, 6.4, 4.4), '#E8302C', [0, -1.2, 0]), P(box(7.2, 1.2, 4.6), '#FFFFFF', [0, 0.9, 0]),
    ...[[-2.4, 0.6, 0.12], [-0.8, 1.6, -0.08], [0.8, 1.1, 0.1], [2.4, 0.4, -0.14], [-1.6, 0.2, -0.2], [1.6, 1.8, 0.2]].map(([x, h, r], i) => P(box(1.1, 6 + h, 1.1), i % 2 ? '#FFD23F' : '#F6C030', [x, 3.4 + h / 2, (i % 3 - 1) * 1.1], [0, 0, r])),
  ],
  bill: () => [P(box(11, 0.9, 6), '#57C35A'), P(box(3, 1.1, 3), '#E9FFE0', [0, 0.05, 0])],
  cash: () => [P(box(12, 2.6, 7), '#57C35A'), P(box(12.3, 2.8, 2), '#2F8F3A'), P(box(2.6, 2.9, 2.2), '#E9FFE0')],
};
const ITEM_GEO = {};
export function itemGeo(type) { return ITEM_GEO[type] || (ITEM_GEO[type] = merge((ITEM_PARTS[type] || ITEM_PARTS.egg)())); }
export const ITEM_TYPES = Object.keys(ITEM_PARTS);
// half height of each item, so stacks and piles rest items on their bottom face
export const ITEM_HALF = { wheat: 2.6, tulip: 2.2, gold: 1.7, rose: 2.2, egg: 2.2, potato: 2.4, tomato: 2.8, crate: 3.3, ketchup: 4.4, bouquet: 3.4, basket: 3.4, perfume: 4.0, bill: 0.45, cash: 1.4,
  log: 2.8, plank: 1.3, chair: 5.9, milk: 4.6, cheese: 2.7, icecream: 6, corn: 2.2, popcorn: 4.4, pumpkin: 3.7, pie: 1.9, berry: 3.4, jam: 3.8, wool: 3.6, yarn: 4, honey: 3.8, apple: 3.3, juice: 4.9,
  flour: 2.9, bread: 2.4, fish: 2.4, smoked: 2.4, grape: 1.6, gjuice: 4.9, pepper: 3.4, wine: 5.1, chips: 4.4 };

// ------------------------------------------------------------------ crops (field plants)
// Plants stand on y=0 and are ~11-14 units tall; scaled by growth. Stubble is what stays after a cut.
const CROP_PARTS = {
  wheat: () => [
    P(cyl(0.6, 0.7, 7, 4), '#C99A35', [0, 3.5, 0]),
    P(cyl(2.0, 1.3, 6.2, 6), '#F6C640', [0, 9.6, 0]),
    P(cone(1.2, 2.2, 5), '#FFE07A', [0, 13.8, 0]),
    P(cyl(0.55, 0.65, 6, 4), '#C99A35', [2.2, 3, 1.2], [0.15, 0, -0.25]),
    P(cyl(1.7, 1.1, 5.2, 6), '#FFD95E', [3.6, 7.8, 2.0], [0.15, 0, -0.25]),
    P(cyl(0.55, 0.65, 6, 4), '#C99A35', [-2, 3, -1.4], [-0.2, 0, 0.25]),
    P(cyl(1.7, 1.1, 5.2, 6), '#EDB52E', [-3.3, 7.6, -2.4], [-0.2, 0, 0.25]),
    P(cyl(1.6, 1.0, 5.0, 6), '#F8CC48', [-1.2, 8.0, 3.0], [0.3, 0, 0.1]),
    P(cone(3.4, 4, 6), '#D9AE48', [0, 2, 0]),
  ],
  tulip: () => [
    P(cyl(0.45, 0.5, 8, 4), '#4FAE32', [0, 4, 0]),
    P(cone(1.4, 6, 4), '#3E9B2A', [1.6, 3, 0], [0, 0, -0.35], [1, 1, 0.45]),
    P(cone(1.4, 5.5, 4), '#5DBB3A', [-1.5, 2.8, 0.4], [0, 0.6, 0.35], [1, 1, 0.45]),
    P(cyl(2.4, 1.4, 3.8, 6), '#FFFFFF', [0, 9.8, 0]),
    P(cone(0.9, 1.6, 4), '#FFFFFF', [1.4, 12.4, 0], [0, 0, -0.2]),
    P(cone(0.9, 1.6, 4), '#FFFFFF', [-0.8, 12.4, 1.2], [0.2, 0, 0.1]),
    P(cone(0.9, 1.6, 4), '#FFFFFF', [-0.6, 12.4, -1.2], [-0.2, 0, 0.1]),
  ],
  gold: () => [
    P(ico(3.4, 0), '#4FA82A', [0, 2.6, 0], [0, 0, 0], [1, 0.7, 1]),
    P(cyl(3.6, 3.2, 1.8, 7), '#FFFFFF', [0, 6.0, 0]),
    P(cyl(3.2, 3.2, 2.0, 7), '#FFFFFF', [0, 6.2, 0], [0, Math.PI / 7, 0]),
    P(cyl(1.4, 1.6, 1.0, 6), '#E07A0A', [0, 7.4, 0]),
  ],
  rose: () => [
    P(ico(3.2, 0), '#3A8A26', [0, 3.2, 0], [0, 0, 0], [1, 1.1, 1]),
    P(cyl(0.45, 0.5, 4, 4), '#2F7A1E', [0, 7, 0]),
    P(ico(2.4, 0), '#FFFFFF', [0, 9.6, 0], [0.3, 0.4, 0]),
    P(ico(1.5, 0), '#FFFFFF', [0.3, 10.9, 0.2]),
    P(ico(1.1, 0), '#E0283C', [2.2, 6.2, 1.4]),
  ],
  potato: () => [
    P(ico(6.5, 0), '#4FAE32', [0, 5, 0], [0, 0, 0], [1, 0.75, 1]),
    P(ico(4.5, 0), '#6CCB3E', [3, 8, -2], [0.5, 0.3, 0], [1, 0.8, 1]),
    P(ico(4, 0), '#5DBB3A', [-3.4, 7.4, 2.4], [0.2, 0.9, 0], [1, 0.8, 1]),
    P(sph(1.6, 5, 4), '#FFFFFF', [2, 11.4, 1]),
  ],
};
// v3.3 crops. 'log' is a whole tree (field gap ≈ 30, so it is drawn small and scaled up ~3×).
Object.assign(CROP_PARTS, {
  log: () => [
    P(cyl(1.1, 1.5, 5.5, 7), '#8E5627', [0, 2.75, 0]),
    P(cone(5.6, 6.5, 7), '#2F8A2A', [0, 7.6, 0]), P(cone(4.4, 5.6, 7), '#FFFFFF', [0, 10.4, 0]), P(cone(2.9, 4.4, 7), '#5DBB3A', [0, 13.2, 0]),
  ],
  corn: () => [
    P(cyl(0.55, 0.7, 12, 5), '#5DA53A', [0, 6, 0]),
    P(cone(1.2, 7, 4), '#4FAE32', [1.8, 5, 0], [0, 0, -0.6], [1, 1, 0.4]), P(cone(1.2, 7, 4), '#6CCB3E', [-1.8, 6.4, 0.6], [0, 0.4, 0.6], [1, 1, 0.4]),
    P(cone(1.1, 6, 4), '#3E9B2A', [0.4, 9.6, -1.6], [-0.6, 0, 0], [1, 1, 0.4]),
    P(cap(1.2, 3.2, 2, 6), '#FFFFFF', [1.2, 8.4, 0.6], [0, 0, -0.35]),
    P(cone(1.3, 3.6, 4), '#7FC24A', [1.0, 7.4, 0.6], [0, 0, -0.35], [1, 1, 0.6]),
    P(cone(0.6, 2.6, 4), '#E8C25A', [0, 13.2, 0]),
  ],
  pumpkin: () => [
    P(cone(5, 1.2, 7), '#3E9B2A', [0, 0.6, 0]),
    P(sph(4.4, 9, 7), '#FFFFFF', [0, 3.6, 0], [0, 0, 0], [1.15, 0.82, 1.15]),
    P(cyl(0.6, 0.9, 2.4, 5), '#6B8E23', [0, 7.4, 0]),
    P(cone(2.2, 4, 4), '#5DBB3A', [3.6, 2.2, 2.6], [0.4, 0, -1.2], [1, 1, 0.4]), P(cone(2.0, 3.6, 4), '#4FAE32', [-3.8, 2.0, -2.0], [-0.4, 0, 1.2], [1, 1, 0.4]),
  ],
  berry: () => [
    P(ico(3.6, 0), '#3E9B2A', [0, 2.6, 0], [0, 0, 0], [1, 0.65, 1]), P(ico(2.6, 0), '#5DBB3A', [1.4, 4, -1], [0, 0.5, 0], [1, 0.6, 1]),
    P(cone(1.3, 2.6, 6), '#FFFFFF', [1.8, 3.4, 2.2], [Math.PI, 0, 0]), P(cone(1.2, 2.4, 6), '#FFFFFF', [-2.4, 3.2, 1.0], [Math.PI, 0, 0]), P(cone(1.1, 2.2, 6), '#FFFFFF', [0.4, 5.6, 0.4], [Math.PI, 0, 0]),
    P(sph(0.9, 5, 4), '#FFFFFF', [-1.2, 5.6, -1.6]),
  ],
});
// v3.7 crops. fish: a fish leaping out of a ripple (the pond bed is painted water); grape: one trellis bay of a
// vine row (long along x, never rotated, see render3d); tomato / pepper: staked greenhouse plants.
Object.assign(CROP_PARTS, {
  fish: () => [
    P(tor(4.2, 0.55, 3, 12), '#DFF4FF', [0, 0.4, 0], [H, 0, 0]),
    P(sph(1, 9, 6), '#FFFFFF', [0, 4.2, 0], [0, 0, 0.55], [4.6, 2.0, 1.9]),
    P(sph(1, 8, 5), '#F4FBFF', [0.6, 3.6, 0], [0, 0, 0.55], [3.4, 1.1, 1.5]),
    P(cone(2.0, 2.8, 4), '#FFFFFF', [-4.4, 1.8, 0], [0, 0, -H + 0.55], [1, 1, 0.45]),
    P(sph(0.5, 5, 4), '#1A1A1A', [3.1, 6.6, 1.3]), P(sph(0.5, 5, 4), '#1A1A1A', [3.1, 6.6, -1.3]),
    P(sph(0.9, 5, 4), '#BDE8FF', [3.6, 1.2, 1.8]), P(sph(0.7, 5, 4), '#BDE8FF', [-2.6, 0.9, -2.2]), P(sph(0.6, 5, 4), '#FFFFFF', [1.4, 1.6, -2.6]),
  ],
  grape: () => [
    P(cyl(0.7, 0.9, 8, 5), '#7A4A22', [0, 4, 0]),
    P(box(9.6, 5.4, 4.6), '#3E9B2A', [0, 11.4, 0]), P(ico(3.2, 0), '#5DBB3A', [-2.6, 13.6, 0.4]), P(ico(3.0, 0), '#4FAE32', [2.8, 13.2, -0.4]),
    P(cone(2.0, 4.6, 6), '#FFFFFF', [-2.4, 6.6, 2.6], [Math.PI, 0, 0]), P(ico(1.5, 0), '#FFFFFF', [-2.4, 8.4, 2.6]),
    P(cone(1.9, 4.2, 6), '#FFFFFF', [2.4, 6.8, -2.6], [Math.PI, 0, 0]), P(ico(1.4, 0), '#FFFFFF', [2.4, 8.5, -2.6]),
    P(cone(1.6, 3.8, 6), '#FFFFFF', [2.6, 7.0, 2.5], [Math.PI, 0, 0]),
  ],
  tomato: () => [
    P(cyl(0.45, 0.45, 13, 4), '#C99A5E', [0.6, 6.5, 0]),
    P(ico(4.2, 0), '#3E9B2A', [0, 5.2, 0], [0, 0, 0], [1, 1.25, 1]), P(ico(3.2, 0), '#5DBB3A', [1.2, 9.4, -0.8], [0.3, 0.4, 0]),
    P(sph(1.7, 7, 5), '#FFFFFF', [2.8, 5.4, 2.0]), P(sph(1.6, 7, 5), '#FFFFFF', [-2.6, 7.0, 2.2]), P(sph(1.5, 7, 5), '#FFFFFF', [0.8, 9.6, 2.8]),
    P(sph(1.5, 7, 5), '#FFFFFF', [-2.4, 4.2, -2.4]), P(sph(1.4, 7, 5), '#FFFFFF', [3.0, 8.4, -2.2]),
  ],
  pepper: () => [
    P(ico(4.0, 0), '#2F8A2A', [0, 4.6, 0], [0, 0, 0], [1.1, 1.0, 1.1]), P(ico(2.8, 0), '#4FAE32', [-1.2, 8.0, 0.6], [0.4, 0, 0.2]),
    P(sph(1.9, 7, 5), '#FFFFFF', [2.8, 4.2, 2.2], [0, 0, 0], [1, 1.2, 1]), P(sph(1.8, 7, 5), '#FFFFFF', [-2.8, 5.2, 2.0], [0, 0, 0], [1, 1.2, 1]),
    P(sph(1.7, 7, 5), '#FFFFFF', [0.6, 7.6, -2.6], [0, 0, 0], [1, 1.2, 1]),
    P(cyl(0.3, 0.3, 1.4, 4), '#2F7A1E', [2.8, 6.6, 2.2]), P(cyl(0.3, 0.3, 1.4, 4), '#2F7A1E', [-2.8, 7.5, 2.0]),
  ],
});
// tint colours for the white parts of each crop (applied with instance colour = whole plant tint is avoided)
const CROP_TINT = { fish: ['#FF8A3D', '#4FA8F0', '#FFC21A', '#C8D4E0'], grape: ['#7A3EA8', '#8E4EC0', '#6A2E98'], tomato: ['#EE4630', '#E8302C', '#FF6A3A'], pepper: ['#E8302C', '#FFC21A', '#5DBB3A', '#FF8A1E'], log: ['#3FA236', '#4FB233', '#2F9A2E'], corn: ['#FFD23F', '#FFC21A'], pumpkin: ['#F2871E', '#FF9F38', '#E8771A'], berry: ['#E8243C', '#F03A50'], tulip: ['#F2486E', '#FF6F92', '#E8365E', '#FF4F7A'], gold: ['#FFC21A', '#FFB10A', '#FFD23F', '#FFC21A'], rose: ['#E0283C', '#C8102E', '#F03A50', '#D81E36'], potato: ['#FFFFFF'], wheat: ['#FFFFFF'] };
const CROP_GEO = {};
export function cropGeo(crop, variant = 0) {
  const k = crop + variant;
  if (CROP_GEO[k]) return CROP_GEO[k];
  const tint = (CROP_TINT[crop] || ['#FFFFFF'])[variant % (CROP_TINT[crop] || ['#FFFFFF']).length];
  const parts = CROP_PARTS[crop]().map((p) => (p.color === '#FFFFFF' ? { ...p, color: tint } : p));
  return (CROP_GEO[k] = merge(parts));
}
export const cropVariants = (crop) => (CROP_TINT[crop] || ['#FFFFFF']).length;
const STUB_GEO = {};
export function stubbleGeo(crop) {
  if (STUB_GEO[crop]) return STUB_GEO[crop];
  const c = crop === 'wheat' ? '#C9A050' : crop === 'potato' ? '#7D4526' : '#7FBF45';
  const c2 = crop === 'wheat' ? '#E2C27A' : crop === 'potato' ? '#9A5A32' : '#9AD45A';
  // kept very cheap (~30 triangles): thousands of these sit under every field
  if (crop === 'log') {   // a sawn stump with pale rings and a few chips
    return (STUB_GEO[crop] = merge([P(cyl(1.6, 1.9, 2.2, 7), '#8E5627', [0, 1.1, 0]), P(cyl(1.45, 1.45, 0.3, 7), '#F2CF8A', [0, 2.3, 0]), P(cyl(0.5, 0.5, 0.35, 5), '#C99A5E', [0, 2.4, 0]), P(box(1.2, 0.3, 0.6), '#F2CF8A', [2.4, 0.2, 1]), P(box(0.9, 0.3, 0.6), '#E3B270', [-2, 0.2, -1.4], [0, 0.8, 0])]));
  }
  if (crop === 'pumpkin') return (STUB_GEO[crop] = merge([P(cone(4.5, 1.0, 7), '#3E9B2A', [0, 0.5, 0]), P(cylO(0.5, 0.5, 2.0, 3), '#5DBB3A', [0, 1.2, 0])]));
  if (crop === 'berry') return (STUB_GEO[crop] = merge([P(ico(2.6, 0), '#3E9B2A', [0, 1.4, 0], [0, 0, 0], [1, 0.55, 1])]));
  // v3.7: an empty ripple where a fish was netted; a picked vine bay keeps its leaves; picked greenhouse plants stay green
  if (crop === 'fish') return (STUB_GEO[crop] = merge([P(tor(3.4, 0.4, 3, 10), '#CDEBFA', [0, 0.3, 0], [H, 0, 0]), P(sph(0.6, 5, 4), '#FFFFFF', [1.4, 0.6, 1])]));
  if (crop === 'grape') return (STUB_GEO[crop] = merge([P(cyl(0.6, 0.8, 7, 5), '#7A4A22', [0, 3.5, 0]), P(box(8.6, 4.4, 4), '#4FAE32', [0, 9.6, 0])]));
  if (crop === 'tomato' || crop === 'pepper') return (STUB_GEO[crop] = merge([P(ico(3.2, 0), '#4FAE32', [0, 3.2, 0], [0, 0, 0], [1, 0.9, 1]), ...(crop === 'tomato' ? [P(cyl(0.4, 0.4, 9, 4), '#C99A5E', [0.6, 4.5, 0])] : [])]));
  return (STUB_GEO[crop] = merge(crop === 'potato'
    ? [P(cone(4.5, 1.2, 6), c, [0, 0.6, 0]), P(cylO(0.5, 0.5, 2.5, 3), '#5DBB3A', [0, 1.6, 0])]
    : [
      P(cylO(0.6, 0.7, 2.8, 3), c, [0, 1.4, 0]), P(cylO(0.55, 0.65, 2.2, 3), c2, [1.8, 1.1, 0.8]), P(cylO(0.55, 0.65, 2.4, 3), c, [-1.5, 1.2, -1.0]),
      P(cylO(0.5, 0.6, 2.0, 3), c2, [0.4, 1.0, -1.9]), P(cone(3.2, 0.6, 5), crop === 'wheat' ? '#7A5424' : '#2F5E1E', [0, 0.3, 0]),
    ]));
}

// ------------------------------------------------------------------ people
// Chunky cartoon figure: big head, round body, stubby limbs. Returns { root, parts } where
// parts.* are pivot groups the animator rotates. Facing +Z. Total height ≈ 40 units.
export function makePerson(o = {}) {
  const skin = o.skin || '#FFCFA0';
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const M = (c) => colMat(c);
  const mesh = (geo, c, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, M(c)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; return m; };
  // legs: pivot at the hip (leg = capsule r 2.5 from hip y −10.7 to +0.3; hips at x ±3.1)
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 3.1, 12.5, 0);
    hip.add(mesh(cap(2.5, 6, 2, 7), o.pants || '#3A4A78', 0, -5.2, 0));
    if (o.boots) {   // 商店 boots (v4.1 fitted): a round shaft just outside the leg, the shoe replaced by a boot foot, a slim cuff
      hip.add(mesh(cyl(2.85, 2.8, 5.8, 10), o.boots, 0, -8.0, 0));
      hip.add(mesh(box(4.8, 2.6, 6.6), o.boots, 0, -10.6, 1.1));
      hip.add(mesh(cyl(2.95, 2.95, 1.1, 10), o.bootGold ? '#FFF2A0' : '#FFFFFF', 0, -5.0, 0));
      if (o.bootGold) hip.add(mesh(cyl(2.9, 2.9, 0.6, 10), '#FFF2A0', 0, -9.0, 0));
    } else hip.add(mesh(box(4.6, 2.6, 6.4), o.shoes || '#5A3414', 0, -10.6, 1.0));
    body.add(hip); legs.push(hip);
  }
  // torso (capsule r 6.4, z ×0.86, local y −2.7…15.5; the head sphere covers it above y ≈ 10)
  const torso = new THREE.Group(); torso.position.set(0, 12, 0); body.add(torso);
  // v4.1: a vest / 礼服 replaces the shirt colour of the body itself (no layered shell), with the shirt as a front panel
  if (o.dress) torso.add(mesh(cyl(5.2, 7.6, 12, 9), o.dress, 0, 5.5, 0));
  else torso.add(mesh(cap(6.4, 5.4, 3, 9), o.vest || o.shirt || '#FFFFFF', 0, 6.4, 0, 1, 1, 0.86));
  const front = (geo, c, y, zs = 0.9) => mesh(geo, c, 0, y, 0, 1, 1, zs);
  if (o.vest) {
    torso.add(front(panel(6.6, 6.75, 7.2, 0.9), o.shirt || '#FFFFFF', 7.6));
    for (const y of [5.6, 3.4]) torso.add(mesh(sph(0.6, 5, 4), '#7A5A10', 0, y, 6.25));
  }
  if (o.overalls) {   // trousers part round the hips + a fitted bib + two buttons
    torso.add(mesh(cyl(6.55, 6.9, 6.2, 12), o.overalls, 0, 3.4, 0, 1, 1, 0.9));
    torso.add(front(panel(6.62, 6.62, 4.6, 1.15), o.overalls, 8.6));
    for (const sx of [-1, 1]) torso.add(mesh(sph(0.7, 5, 4), '#FFD23F', sx * 2.6, 10.2, 5.95));
  }
  if (o.apron) {   // 碎花围裙: a skirt panel and a bib that follow the curve of the body, dots on its surface
    torso.add(front(panel(6.7, 7.3, 8.2, 1.5), o.apron, 3.5));
    torso.add(front(panel(6.55, 6.7, 4.0, 1.0), o.apron, 9.4));
    for (const [a, y] of [[-0.45, 6.4], [0.35, 4.6], [-0.15, 2.0], [0.55, 1.2], [0.05, 10.0], [-0.55, 0.6], [0.4, 8.8]]) {
      const R = (y > 7.5 ? 6.62 : 6.9 + (7.6 - y) * 0.07) + 0.15;
      torso.add(mesh(sph(0.62, 5, 4), o.apronDot || '#FF6F92', Math.sin(a) * R, y, Math.cos(a) * R * 0.9, 1, 1, 0.5));
    }
  }
  if (o.bowtie) torso.add(mesh(box(4.2, 1.8, 1.2), o.bowColor || '#C8352A', 0, 10.6, 6.0));
  if (o.scarf) {   // 围巾 (v4.1 fitted): rings on the shoulders just outside the neck (they tuck under the sleeves),
    // tail hanging down the chest centre, clear of the arms even when they hug the stack
    const cols = o.scarf === 'rainbow' ? ['#FF4D4D', '#FFD23F', '#3BA7FF'] : [o.scarf, o.scarf];
    // the ring is tilted: low under the chin in front (clear of the face), higher at the back over the collar
    const sc = new THREE.Group(); sc.position.set(0, 9.9, -0.3); sc.rotation.x = 0.24; torso.add(sc);
    cols.forEach((c, i) => { const r = new THREE.Mesh(tor(6.75 - i * 0.12, 1.1, 6, 16), M(c)); r.rotation.x = H; r.position.y = i * 0.9; r.scale.set(1, 0.92, 1); r.castShadow = true; sc.add(r); });
    torso.add(mesh(box(2.6, 4.6, 1.2), cols[0], 1.5, 5.4, 6.25)); torso.add(mesh(box(2.6, 1.6, 1.3), cols[cols.length - 1], 1.5, 2.6, 6.2));
  }
  // arms: pivot at the shoulder
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 7.0, 10.6, 0);
    sh.add(mesh(cap(2.1, 5.4, 2, 6), o.sleeve || o.dress || o.shirt || '#FFFFFF', 0, -3.8, 0));
    sh.add(mesh(sph(2.2, 7, 5), skin, 0, -8.2, 0));
    torso.add(sh); arms.push(sh);
  }
  // head
  const head = new THREE.Group(); head.position.set(0, 27.5, 0); body.add(head);
  head.add(mesh(sph(7.4, 12, 9), skin, 0, 0, 0, 1, 0.98, 1));
  const hair = o.hair || '#6B3A1E';
  const hm = new THREE.Mesh(HAIR_GEO, M(hair)); hm.position.set(0, 0.8, -0.4); hm.rotation.x = -0.42; hm.castShadow = true; head.add(hm);
  head.add(mesh(sph(6.6, 10, 7), hair, 0, -0.4, -2.6, 1.05, 1, 0.8));
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(sph(1.05, 6, 5), M('#2A1A10')); eye.position.set(s * 2.6, 0.2, 7.6); eye.scale.set(1, 1.3, 0.6); eye.visible = o.hat !== 'pumpkin'; head.add(eye);
    const cheek = new THREE.Mesh(sph(1.3, 6, 4), M('#FF9C8A')); cheek.position.set(s * 4.4, -2.4, 6.6); cheek.scale.set(1, 0.6, 0.4); cheek.visible = o.hat !== 'pumpkin'; head.add(cheek);
  }
  const nose = new THREE.Mesh(sph(1.1, 6, 4), M('#F2B486')); nose.position.set(0, -1.2, 8.1); nose.visible = o.hat !== 'pumpkin'; head.add(nose);
  if (o.beard) head.add(mesh(sph(5, 8, 6), o.beard, 0, -4.4, 4.2, 1.1, 0.7, 0.6));
  if (o.hat === 'beanie') {
    head.add(mesh(dome(8.45, 12, 6), o.capColor || '#E8452C', 0, 2.2, -0.4, 1, 0.92, 1));
    head.add(mesh(cyl(8.6, 8.6, 2, 12), '#FFFFFF', 0, 2.6, -0.4));
    head.add(mesh(sph(2.2, 6, 5), '#FFFFFF', 0, 10.4, -0.6));
  } else if (o.hat === 'straw') {
    head.add(mesh(cyl(11, 11, 0.9, 12), '#F2CF6B', 0, 5.2, 0));
    head.add(mesh(cyl(6.2, 7.2, 4.6, 10), '#E8BE4E', 0, 7.6, 0));
    head.add(mesh(cyl(7.25, 7.25, 1.2, 10), '#C8352A', 0, 6.0, 0));
  } else if (o.hat === 'cap') {
    head.add(mesh(dome(8.35, 12, 6), o.capColor || '#3B7FE0', 0, 2.4, -0.4, 1, 0.82, 1));
    head.add(mesh(box(8, 0.9, 6), o.capColor || '#3B7FE0', 0, 2.6, 8.4));
  }
  else if (o.hat === 'rain') {   // v3.7 渔夫: a yellow sou'wester, long brim at the back
    head.add(mesh(dome(8.35, 12, 6), o.capColor || '#FFC21A', 0, 2.6, -0.4, 1, 0.84, 1));
    head.add(mesh(cyl(10.5, 11.5, 1.1, 12), o.capColor || '#FFC21A', 0, 3.6, -1.4, 1, 1, 1.05));
    head.add(mesh(cyl(8.45, 8.45, 1.1, 12), '#E8A20E', 0, 4.6, -0.4));
  }
  else if (o.hat === 'cowboy') {
    head.add(mesh(cyl(12.5, 12.5, 0.9, 14), '#A0622D', 0, 5.0, 0, 1, 1, 0.82));
    for (const s of [-1, 1]) head.add(mesh(box(3, 0.9, 16), '#A0622D', s * 11.2, 6.3, 0, 1, 1, 0.8));
    head.add(mesh(cyl(5.6, 7.2, 6.4, 12), '#B87436', 0, 8.6, -0.4));
    head.add(mesh(cyl(7.3, 7.3, 1.4, 12), '#5A3414', 0, 6.4, -0.4));
    head.add(mesh(box(6, 1.2, 9), '#9A5A28', 0, 11.6, 0));
  } else if (o.hat === 'chef') {
    head.add(mesh(cyl(7.7, 7.7, 3.6, 14), '#FFFFFF', 0, 6.0, -0.4));
    head.add(mesh(sph(7.2, 10, 7), '#FFFFFF', 0, 12.2, -0.4, 1.15, 0.8, 1.1));
    for (const [x, z] of [[-4, 1.6], [4, 1.6], [0, -4.4]]) head.add(mesh(sph(4.2, 8, 6), '#F4F4F4', x, 14.2, z));
  } else if (o.hat === 'flower') {
    // v4.1: sits on the hair (r 7.9 round y 0.8) instead of sinking into the face
    const ring = new THREE.Mesh(tor(7.6, 0.9, 5, 18), M('#4FAE32')); ring.rotation.x = H; ring.position.set(0, 5.0, -0.4); head.add(ring);
    const fc = ['#FF6F92', '#FFE16B', '#FFFFFF', '#B07ACC'];
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; head.add(mesh(sph(1.85, 7, 5), fc[k % 4], Math.sin(a) * 8.0, 5.5, -0.4 + Math.cos(a) * 8.0)); head.add(mesh(sph(0.8, 5, 4), '#FFB800', Math.sin(a) * 9.0, 5.9, -0.4 + Math.cos(a) * 9.0)); }
  } else if (o.hat === 'bow') {
    for (const s of [-1, 1]) head.add(mesh(sph(3.8, 8, 6), '#FF4D6D', s * 4.4, 9.4, -1.4, 1.25, 0.9, 0.6));
    head.add(mesh(sph(2, 7, 5), '#E8283C', 0, 9.6, -1.0));
  } else if (o.hat === 'crown') {
    head.add(mesh(cyl(7.0, 6.7, 3.6, 14), '#FFC21A', 0, 7.6, -0.4));
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; head.add(mesh(cone(1.6, 4, 5), '#FFD23F', Math.sin(a) * 6.2, 11.2, -0.4 + Math.cos(a) * 6.2)); head.add(mesh(sph(0.9, 5, 4), '#FFF6B0', Math.sin(a) * 6.2, 13.4, -0.4 + Math.cos(a) * 6.2)); }
    head.add(mesh(sph(1.4, 6, 5), '#E8283C', 0, 7.6, 6.6)); head.add(mesh(sph(1.1, 6, 5), '#3BA7FF', 4.8, 7.6, 4.2)); head.add(mesh(sph(1.1, 6, 5), '#4CD08A', -4.8, 7.6, 4.2));
  } else if (o.hat === 'pumpkin') {   // v4.0 B 万圣节 南瓜头: a carved pumpkin worn over the head
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; head.add(mesh(sph(4.6, 8, 6), k % 2 ? '#F2871E' : '#E8761A', Math.sin(a) * 5.2, 2.2, -0.4 + Math.cos(a) * 5.2, 0.8, 1.15, 0.8)); }
    head.add(mesh(sph(7.6, 12, 8), '#F2871E', 0, 1.6, -0.2, 1.18, 1.04, 1.18));
    head.add(mesh(cyl(1.1, 1.5, 3.6, 6), '#5A8A2A', 0, 11.0, -0.4)); head.add(mesh(sph(1.8, 6, 4), '#4FAE32', 2.2, 10.0, 0.2, 1.4, 0.4, 0.9));
    for (const sx of [-1, 1]) head.add(mesh(cone(1.6, 2.6, 3), '#3A2210', sx * 3, 3.4, 8.55, 1, 1, 0.4));
    head.add(mesh(box(6.4, 1.6, 0.8), '#3A2210', 0, -1.4, 8.45)); for (const x of [-2, 2]) head.add(mesh(box(1.4, 1, 0.9), '#3A2210', x, -0.4, 8.6));
  } else if (o.hat === 'santa') {   // v4.0 B 圣诞帽
    const tip = new THREE.Mesh(cone(7.9, 12, 12), M('#E8283C')); tip.position.set(-0.6, 11.2, -0.5); tip.rotation.z = 0.32; tip.castShadow = true; head.add(tip);
    head.add(mesh(cyl(8.7, 8.7, 2.6, 14), '#FFFFFF', 0, 5.2, -0.4));
    head.add(mesh(sph(2.2, 7, 5), '#FFFFFF', -2.9, 17.0, -0.5));
  } else if (o.hat === 'lion') {   // v4.0 B 春节 舞狮帽: big red-and-gold lion head, fluffy trim, horn, eyes
    head.add(mesh(dome(8.7, 12, 7), '#E8283C', 0, 2.6, -0.4, 1.1, 1.05, 1.1));
    for (let k = 0; k < 10; k++) { const a = -1.4 + k / 9 * 2.8; head.add(mesh(sph(2.3, 6, 5), k % 2 ? '#FFFFFF' : '#FFE16B', Math.sin(a) * 9, 4.2 + Math.cos(a * 1.2) * 1.4, Math.cos(a) * 8.4)); }
    head.add(mesh(cone(1.6, 4.4, 6), '#FFC21A', 0, 13, 1.4)); head.add(mesh(box(9, 2, 1.4), '#FFC21A', 0, 9.2, 7.6));
    for (const sx of [-1, 1]) { head.add(mesh(sph(2.2, 7, 5), '#FFFFFF', sx * 3.4, 7.4, 7.6)); head.add(mesh(sph(1.1, 6, 4), '#1A1A22', sx * 3.4, 7.4, 9.4)); head.add(mesh(sph(2.4, 6, 4), '#FFC21A', sx * 9.4, 6.4, 1, 0.6, 1.2, 1)); }
    head.add(mesh(sph(1.6, 6, 4), '#FFC21A', 0, 4.6, 9.2));
  } else if (o.hat === 'scholar') {   // v4.0 B 图鉴大师帽: a mortarboard with a gold tassel
    head.add(mesh(cyl(7.9, 8.0, 3.4, 14), '#2A2A3A', 0, 5.8, -0.4));
    head.add(mesh(box(15, 1.2, 15), '#2A2A3A', 0, 8.0, -0.4, 1, 1, 1));
    head.add(mesh(sph(1, 6, 4), '#FFC21A', 0, 8.8, 0)); head.add(mesh(box(0.8, 0.6, 7), '#FFC21A', 0, 8.6, 3.6)); head.add(mesh(cyl(0.9, 1.4, 4.4, 6), '#FFC21A', 0, 6.2, 7.2));
  }
  if (o.pigtails) for (const s of [-1, 1]) head.add(mesh(sph(2.6, 7, 5), hair, s * 7.6, -0.8, -2.2));
  if (o.crown) {   // VIP: chunky gold crown with a red gem
    head.add(mesh(cyl(5.6, 5.2, 3.2, 10), '#FFC21A', 0, 8.6, -0.4));
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; head.add(mesh(cone(1.5, 3.4, 5), '#FFD23F', Math.sin(a) * 4.6, 11.6, -0.4 + Math.cos(a) * 4.6)); }
    head.add(mesh(sph(1.3, 6, 5), '#E8283C', 0, 8.8, 5.0));
  }
  // tool in the right hand (sickle), hidden unless cutting
  const tool = new THREE.Group();
  tool.add(mesh(cyl(0.6, 0.6, 6, 5), '#8E5627', 0, 0, 0));
  const blade = new THREE.Mesh(tor(3.6, 0.55, 3, 8, Math.PI * 1.2), M('#DDE3EA')); blade.position.set(0, 3.2, 3.2); blade.rotation.set(0, H, 0); blade.castShadow = true; tool.add(blade);
  tool.position.set(0, -9, 1.4); tool.rotation.set(H, 0, 0); tool.visible = false;
  arms[1].add(tool);
  // axe for chopping trees (swapped in for the sickle when cutting logs)
  const axe = new THREE.Group();
  axe.add(mesh(cyl(0.7, 0.7, 11, 5), '#A8741E', 0, 3, 0));
  axe.add(mesh(box(1.4, 4.4, 5), '#C9D2DC', 0, 7.6, 2.2)); axe.add(mesh(box(1.6, 4.6, 1.2), '#E8452C', 0, 7.6, -0.2));
  axe.position.set(0, -9, 1.4); axe.rotation.set(H, 0, 0); axe.visible = false;
  arms[1].add(axe);
  // v3.7 landing net for fish (swapped in like the axe)
  const net = new THREE.Group();
  net.add(mesh(cyl(0.6, 0.6, 12, 5), '#C99A5E', 0, 3.5, 0));
  const hoop = new THREE.Mesh(tor(3.4, 0.45, 3, 10), M('#3A3A44')); hoop.position.set(0, 11, 2.6); hoop.rotation.set(0, H, 0); net.add(hoop);
  const bag = new THREE.Mesh(cone(3.2, 5, 8), new THREE.MeshLambertMaterial({ color: '#F4F0E0', transparent: true, opacity: 0.75, flatShading: true })); bag.position.set(0, 11, 5.4); bag.rotation.set(-H, 0, 0); net.add(bag);
  net.position.set(0, -9, 1.4); net.rotation.set(H, 0, 0); net.visible = false;
  arms[1].add(net);
  // contact shadow blob (cheap, always on)
  const blob = new THREE.Mesh(BLOB_GEO, BLOB_MAT); blob.rotation.x = -H; blob.position.y = 0.3; blob.scale.set(10, 8, 1); root.add(blob);
  return { root, body, legs, arms, torso, head, tool, axe, net, blob, o };
}
export const HAIR_GEO = new THREE.SphereGeometry(7.9, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
export const BLOB_GEO = new THREE.CircleGeometry(1, 14);
export const BLOB_MAT = new THREE.MeshBasicMaterial({ color: 0x1E4A10, transparent: true, opacity: 0.22, depthWrite: false });

// pose a person: walk phase, moving, carrying, harvesting, fishing cast-and-pull, time for idle breathing
export function posePerson(pp, s) {
  const { legs, arms, body, torso, head, axe } = pp;
  // tool = the sickle, or the axe when the last swing was at a tree
  const tool = s.net ? pp.net : s.axe ? axe : pp.tool;
  for (const tl of [pp.tool, axe, pp.net]) if (tl && tl !== tool) tl.visible = false;
  if (s.net && !s.fishing) tool.rotation.set(H, 0, 0); // return the net to its resting pose after a cast
  const sw = s.moving ? Math.sin(s.walk) : 0;
  const bob = s.moving ? Math.abs(Math.sin(s.walk)) * 1.6 : Math.sin(s.t * 3 + (s.seed || 0)) * 0.3;
  body.position.y = bob;
  legs[0].rotation.x = sw * 0.75; legs[1].rotation.x = -sw * 0.75;
  torso.rotation.z = s.moving ? Math.sin(s.walk) * 0.05 : 0;
  torso.rotation.x = s.carry ? -0.06 : (s.moving ? 0.08 : 0);
  head.rotation.x = s.carry ? -0.1 : 0;
  head.rotation.z = s.moving ? -Math.sin(s.walk) * 0.04 : Math.sin(s.t * 1.3 + (s.seed || 0)) * 0.04;
  if (s.fishing) {
    // A readable, eased cast-and-pull: reach out, sweep the net, then draw the catch in.
    const p = Math.max(0, Math.min(1, s.actionProgress || 0));
    const cast = p < 0.42 ? p / 0.42 : 1;
    const pull = p < 0.42 ? 0 : (p - 0.42) / 0.58;
    const easeOut = 1 - Math.pow(1 - cast, 3), easeInOut = pull * pull * (3 - 2 * pull);
    const sweep = Math.sin(easeOut * Math.PI) * 0.72 - easeInOut * 0.28;
    arms[1].rotation.set(-1.05 - easeOut * 0.22 + easeInOut * 0.48, 0, -0.45 - sweep);
    arms[0].rotation.set(-0.55 - easeOut * 0.5 + easeInOut * 0.35, 0, 0.28);
    tool.visible = true;
    tool.rotation.set(H - sweep * 0.9, 0, -0.18 + easeInOut * 0.34);
    torso.rotation.x = -0.04 - easeOut * 0.08 + easeInOut * 0.12;
    torso.rotation.y = -sweep * 0.12;
    head.rotation.x = -easeInOut * 0.12;
  } else if (s.cutting) {
    // quick, lively harvest swing; the left keeps hold of the stack
    const k = Math.sin(s.t * 22);
    arms[1].rotation.set(-1.25, 0, -0.2 + k * 0.9);
    arms[0].rotation.set(s.carry ? -1.45 : -sw * 0.8, 0, s.carry ? 0.25 : 0.1);
    tool.visible = true;
    torso.rotation.y = k * 0.18;
  } else if (s.carry) {
    // both arms forward and up, hugging the stack
    arms[0].rotation.set(-1.5, 0, 0.32); arms[1].rotation.set(-1.5, 0, -0.32);
    tool.visible = false; torso.rotation.y = 0;
  } else {
    arms[0].rotation.set(-sw * 0.85, 0, 0.12); arms[1].rotation.set(sw * 0.85, 0, -0.12);
    tool.visible = !!s.showTool; torso.rotation.y = 0;
  }
  if (s.seated) { legs[0].rotation.x = -1.4; legs[1].rotation.x = -1.4; body.position.y = 0; }
}

// ------------------------------------------------------------------ vehicles & animals
export function makeMower() {
  const g = new THREE.Group();
  const parts = [
    P(box(26, 7, 34), '#E8452C', [0, 8, 0]), P(box(24, 3, 18), '#FF6A4D', [0, 12.5, 6]),
    P(box(20, 6, 4), '#2F3440', [0, 4, -18]), P(box(14, 2, 10), '#3A3A44', [0, 13, -6]),
    P(box(12, 8, 2.4), '#3A3A44', [0, 17, -11]), P(cyl(1, 1, 12, 6), '#3A3A44', [0, 18, 8], [0.5, 0, 0]),
    P(tor(3.2, 0.7, 4, 10), '#2F3440', [0, 23, 11], [H + 0.5, 0, 0]),
    P(box(26.4, 1.4, 34.4), '#FFFFFF', [0, 10.8, 0]),
  ];
  g.add(new THREE.Mesh(merge(parts), vcMat()));
  g.children[0].castShadow = true;
  const wheels = [];
  for (const [x, z, r] of [[-14, 10, 5], [14, 10, 5], [-14, -11, 4], [14, -11, 4]]) {
    const w = new THREE.Mesh(merge([P(cyl(r, r, 3.6, 10), '#2A2A30', [0, 0, 0], [0, 0, H]), P(cyl(r * 0.5, r * 0.5, 3.8, 8), '#CFCFD8', [0, 0, 0], [0, 0, H])]), vcMat());
    w.position.set(x, r, z); w.castShadow = true; g.add(w); wheels.push(w);
  }
  return { root: g, wheels };
}
// 园丁换铲车: a small chunky ride-on loader (same toy palette as the mower). Faces +Z: front bucket,
// driver seat in the middle, a railed load bed at the back where the harvest stacks up.
export function makeLoader(kind) {
  const g = new THREE.Group();
  // kind 'log': the lumberjacks' green log truck (same chassis, timber-yard green)
  const Y = kind === 'log' ? '#4CB24E' : '#FFC21A', Y2 = kind === 'log' ? '#2F8F3A' : '#F29C0E', D = '#3A3A44', S = '#AEB6C2';
  const parts = [
    P(box(22, 5, 32), D, [0, 6.5, -1]),                                   // chassis
    P(box(22, 7, 18), Y, [0, 12, -4]), P(box(22.4, 1.4, 18.4), '#FFE07A', [0, 15.8, -4]),   // body + trim
    P(box(18, 7, 11), Y, [0, 11.5, 10]), P(box(16, 1.6, 9), Y2, [0, 15.6, 10]),           // hood
    P(box(3.4, 2.4, 1), '#FFF6C0', [-5.5, 12.5, 15.8]), P(box(3.4, 2.4, 1), '#FFF6C0', [5.5, 12.5, 15.8]),   // headlights
    P(box(5, 0.8, 0.6), D, [0, 10, 15.8]), P(box(5, 0.8, 0.6), D, [0, 12, 15.8]),            // grille
    P(box(10, 2.6, 8), D, [0, 17.4, -1]), P(box(10, 7, 2.2), D, [0, 20.5, -5]),            // seat + backrest
    P(cyl(0.9, 0.9, 9, 6), D, [0, 19.5, 6], [0.55, 0, 0]), P(tor(3.2, 0.75, 4, 10), '#2F3440', [0, 23.5, 8.4], [H + 0.55, 0, 0]),
    P(cyl(1.1, 1.1, 9, 6), '#2F3440', [7, 19, 8]), P(cyl(1.5, 1.5, 1.6, 6), '#E8452C', [7, 24, 8]),   // exhaust
    // load bed (rear) with rails
    P(box(24, 2.4, 13), Y2, [0, 17.2, -15.5]),
    P(box(1.6, 4, 13), Y, [-11.4, 20.2, -15.5]), P(box(1.6, 4, 13), Y, [11.4, 20.2, -15.5]), P(box(24, 4, 1.6), Y, [0, 20.2, -21.6]),
    // loader arms + front bucket with teeth
    P(box(2.6, 2.6, 17), Y, [-12, 11, 18], [0.32, 0, 0]), P(box(2.6, 2.6, 17), Y, [12, 11, 18], [0.32, 0, 0]),
    P(box(26, 2, 8), S, [0, 3, 27]), P(box(26, 8, 2), S, [0, 6.5, 23.4]), P(box(2, 7, 8), S, [-12, 6, 27]), P(box(2, 7, 8), S, [12, 6, 27]),
    P(box(27, 1.6, 1.6), '#8C94A0', [0, 9.8, 23.6]),
  ];
  for (let k = -2; k <= 2; k++) parts.push(P(box(2.2, 1.4, 3), '#D8DEE6', [k * 5.4, 2.6, 32]));
  const body = new THREE.Mesh(merge(parts), vcMat()); body.castShadow = true; g.add(body);
  const wheels = [];
  for (const [x, z, r, w] of [[-14, -9, 6.6, 5], [14, -9, 6.6, 5], [-13, 11, 4.8, 4], [13, 11, 4.8, 4]]) {
    const wl = new THREE.Mesh(merge([P(cyl(r, r, w, 12), '#24242A', [0, 0, 0], [0, 0, H]), P(cyl(r * 0.55, r * 0.55, w + 0.2, 8), Y, [0, 0, 0], [0, 0, H]), P(cyl(r * 0.2, r * 0.2, w + 0.4, 6), D, [0, 0, 0], [0, 0, H])]), vcMat());
    wl.position.set(x, r, z); wl.castShadow = true; g.add(wl); wheels.push(wl);
  }
  return { root: g, body, wheels };
}
// 洒水器: a post with a spinning blue head (water arcs are drawn on the overlay)
export function makeSprinkler() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(merge([P(cyl(4, 5, 2, 8), '#8C94A0', [0, 1, 0]), P(cyl(1.3, 1.3, 22, 6), '#AEB6C2', [0, 12, 0])]), vcMat());
  base.castShadow = true; g.add(base);
  const head = new THREE.Mesh(merge([P(cyl(2.6, 2.6, 3, 8), '#3BA7FF', [0, 0, 0]), P(box(1.4, 1.4, 6), '#2B7FD0', [0, 1, 3], [-0.5, 0, 0]), P(sph(1.6, 6, 4), '#FFD23F', [0, 2.4, 0])]), vcMat());
  head.position.y = 24; g.add(head);
  return { root: g, head };
}
export function makeCart() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(merge([
    P(box(18, 6, 22), '#E8452C', [0, 9, 0]), P(box(18.6, 1.2, 22.6), '#FF8A6E', [0, 12.4, 0]),
    P(box(1.2, 1.2, 14), '#8E5627', [0, 7, 17]), P(box(8, 1.2, 1.2), '#8E5627', [0, 7, 24]),
  ]), vcMat());
  m.castShadow = true; g.add(m);
  const wheels = [];
  for (const [x, z] of [[-10, 6], [10, 6], [-10, -6], [10, -6]]) {
    const w = new THREE.Mesh(merge([P(cyl(3.4, 3.4, 2, 10), '#3A3A44', [0, 0, 0], [0, 0, H]), P(cyl(1.4, 1.4, 2.2, 6), '#FFD23F', [0, 0, 0], [0, 0, H])]), vcMat());
    w.position.set(x, 3.4, z); g.add(w); wheels.push(w);
  }
  return { root: g, wheels };
}
export function henGeo() {
  return merge([
    P(sph(5.2, 9, 7), '#FFFFFF', [0, 5.4, 0], [0, 0, 0], [1, 0.85, 1.2]),
    P(sph(3, 8, 6), '#FFFFFF', [0, 10, 4.2]),
    P(box(1.4, 2.6, 3.4), '#E8452C', [0, 13, 4]),
    P(cone(1.1, 2.4, 5), '#F29C0E', [0, 9.6, 7.6], [H, 0, 0]),
    P(sph(1.2, 5, 4), '#E8452C', [0, 7.8, 6.6]),
    P(sph(0.55, 4, 3), '#1A1A1A', [1.7, 10.6, 6.4]), P(sph(0.55, 4, 3), '#1A1A1A', [-1.7, 10.6, 6.4]),
    P(box(6, 4, 2), '#F2F2F2', [0, 8, -6], [0.6, 0, 0]),
    P(sph(2.6, 6, 4), '#EDEDED', [4.6, 5.4, 0], [0, 0, 0], [0.5, 0.8, 1.1]), P(sph(2.6, 6, 4), '#EDEDED', [-4.6, 5.4, 0], [0, 0, 0], [0.5, 0.8, 1.1]),
  ]);
}
export function nestGeo() {
  return merge([P(box(22, 8, 20), '#C8874A', [0, 4, 0]), P(box(22.6, 1.4, 20.6), '#8E5627', [0, 8.2, 0]), P(cyl(8, 7, 2, 9), '#F2CF6B', [0, 8.6, 0])]);
}
export function bushGeo() {
  const parts = [P(ico(8, 1), '#3E9B2A', [0, 9, 0], [0, 0, 0], [1, 0.95, 1]), P(ico(6, 0), '#5DBB3A', [3, 13, 2]), P(cyl(1.4, 1.8, 4, 6), '#8E5627', [0, 2, 0])];
  for (const [x, y, z] of [[5, 9, 5], [-6, 8, 3], [2, 14, -5], [-3, 12, 6], [6, 6, -3]]) parts.push(P(sph(1.9, 6, 5), '#EE4630', [x, y, z]));
  return merge(parts);
}

// v3.3 producers. Each stands at its stall on the fence line facing +Z, like the hens.
export function cowGeo() {   // black-and-white dairy cow, pink muzzle, little horns, bell
  const W = '#FFFFFF', K = '#2A2A30', PK = '#FFB3B8';
  return merge([
    P(cap(6.2, 10, 3, 10), W, [0, 13, 0], [H, 0, 0], [1, 1, 0.95]),
    P(sph(3.6, 7, 5), K, [3.6, 15.6, -3], [0, 0, 0], [1, 0.7, 1.3]), P(sph(3, 7, 5), K, [-4, 12.4, 3.6], [0, 0, 0], [0.8, 1, 1.2]), P(sph(2.6, 7, 5), K, [-2.6, 17.2, -6], [0, 0, 0], [1, 0.6, 1]),
    ...[[-3.6, 6], [3.6, 6], [-3.6, -6], [3.6, -6]].map(([x, z]) => P(cyl(1.5, 1.4, 8, 6), W, [x, 4, z])),
    ...[[-3.6, 6], [3.6, 6], [-3.6, -6], [3.6, -6]].map(([x, z]) => P(cyl(1.6, 1.6, 1.6, 6), K, [x, 0.8, z])),
    P(sph(4.6, 9, 7), W, [0, 18, 11], [0, 0, 0], [1, 1, 1.05]),
    P(sph(3, 8, 6), PK, [0, 16, 15], [0, 0, 0], [1.2, 0.85, 0.8]),
    P(sph(0.5, 4, 3), '#7A3A40', [-1.1, 16.4, 17.3]), P(sph(0.5, 4, 3), '#7A3A40', [1.1, 16.4, 17.3]),
    P(sph(0.8, 5, 4), K, [-1.9, 19.8, 15]), P(sph(0.8, 5, 4), K, [1.9, 19.8, 15]),
    P(cone(0.8, 2.6, 5), '#FFF3D6', [-2.6, 22.6, 10.6], [0, 0, 0.5]), P(cone(0.8, 2.6, 5), '#FFF3D6', [2.6, 22.6, 10.6], [0, 0, -0.5]),
    P(sph(1.6, 6, 4), K, [-4.8, 20.4, 10.4], [0, 0, 0], [1.4, 0.6, 0.8]), P(sph(1.6, 6, 4), K, [4.8, 20.4, 10.4], [0, 0, 0], [1.4, 0.6, 0.8]),
    P(cyl(1.4, 1.8, 2.2, 7), '#FFC21A', [0, 12.4, 12.6]),
    P(sph(2.4, 7, 5), PK, [0, 7.6, -3], [0, 0, 0], [1, 0.7, 1]),
    P(cyl(0.5, 0.5, 6, 4), W, [0, 14, -12.4], [0.5, 0, 0]), P(sph(1.1, 5, 4), K, [0, 11.4, -14]),
  ]);
}
export function sheepGeo() {   // fluffy cloud of wool, dark face and legs
  const W = '#FFFFFF', K = '#3A3036';
  const parts = [];
  for (const [x, y, z, r] of [[0, 11, 0, 6.2], [3.4, 12.6, 3, 4.4], [-3.4, 12.6, 3, 4.4], [3.4, 12.4, -3.4, 4.4], [-3.4, 12.4, -3.4, 4.4], [0, 15.2, 0, 4.6], [0, 11.4, -5.6, 4]]) parts.push(P(ico(r, 1), W, [x, y, z]));
  for (const [x, z] of [[-2.8, 4], [2.8, 4], [-2.8, -4], [2.8, -4]]) parts.push(P(cyl(1.1, 1, 6.5, 5), K, [x, 3.2, z]));
  parts.push(P(sph(3.4, 8, 6), K, [0, 13.6, 8.6], [0, 0, 0], [0.9, 1, 1.15]));
  parts.push(P(ico(2.6, 0), W, [0, 17, 7.6]));
  parts.push(P(sph(1.6, 5, 4), K, [-3.6, 14.4, 7.4], [0, 0, 0], [1.4, 0.5, 0.7]), P(sph(1.6, 5, 4), K, [3.6, 14.4, 7.4], [0, 0, 0], [1.4, 0.5, 0.7]));
  parts.push(P(sph(0.6, 4, 3), '#FFFFFF', [-1.3, 14.4, 11.4]), P(sph(0.6, 4, 3), '#FFFFFF', [1.3, 14.4, 11.4]));
  return merge(parts);
}
export function hiveGeo() {   // stacked white bee box with a yellow roof and a bee or two
  return merge([
    P(box(16, 3, 14), '#C8874A', [0, 1.5, 0]),
    P(box(14, 6, 12), '#FFF6E0', [0, 6, 0]), P(box(14.4, 0.8, 12.4), '#E3D3B0', [0, 9.1, 0]),
    P(box(14, 6, 12), '#FFF6E0', [0, 12.4, 0]), P(box(14.4, 0.8, 12.4), '#E3D3B0', [0, 15.5, 0]),
    P(box(17, 1.6, 15), '#FFC21A', [0, 16.6, 0]), P(box(13, 1.4, 11), '#F29C0E', [0, 18, 0]),
    P(box(5, 1.2, 0.6), '#3A2A10', [0, 4.6, 6.2]),
    P(sph(1.2, 6, 4), '#FFD23F', [6, 20, 4], [0, 0, 0], [1.3, 1, 1]), P(box(0.5, 1.6, 2.4), '#2A2A30', [6, 20, 4]),
    P(sph(1.1, 6, 4), '#FFD23F', [-7, 13, 8], [0, 0, 0], [1.3, 1, 1]), P(box(0.5, 1.5, 2.2), '#2A2A30', [-7, 13, 8]),
  ]);
}
export function appleTreeGeo() {   // round orchard tree full of red apples
  const parts = [P(cyl(1.8, 2.6, 13, 7), '#8E5627', [0, 6.5, 0]), P(ico(10, 1), '#3FA236', [0, 19, 0]), P(ico(7, 0), '#5DBB3A', [4, 24, 3]), P(ico(6.5, 0), '#2F8A2A', [-5, 17, -3])];
  for (const [x, y, z] of [[7, 18, 6], [-7, 20, 5], [3, 25, 8], [-4, 14, 8], [8, 14, -2], [-8, 23, -2], [0, 28, 2], [5, 21, -8]]) parts.push(P(sph(1.8, 6, 5), '#E8283C', [x, y, z]));
  return merge(parts);
}


// ------------------------------------------------------------------ v4.0 B 宠物 (low-poly dog / cat)
// returns { root, body, head, legs[4], tail, kind }; posePet animates it (walk / idle / sit / lounge)
export function makePet(kind, col) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const mesh = (geo, c, x, y, z, sx = 1, sy = 1, sz = 1, par = body) => { const m = new THREE.Mesh(geo, colMat(c)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; par.add(m); return m; };
  const dog = kind === 'dog', B = col.body, W = col.belly || '#FFFFFF';
  const trunk = new THREE.Mesh(cap(dog ? 3.6 : 3.0, dog ? 7 : 6.4, 3, 8), colMat(B)); trunk.rotation.x = H; trunk.position.set(0, dog ? 8 : 6.6, 0); trunk.castShadow = true; body.add(trunk);
  mesh(sph(dog ? 3.0 : 2.6, 8, 6), W, 0, dog ? 6.4 : 5.2, 2.6, 1, 0.8, 1.6);
  if (col.spot) { mesh(sph(2.2, 6, 5), col.spot, 2.2, 10.4, -2, 1, 0.5, 1.2); mesh(sph(1.6, 6, 5), col.spot, -2.4, 9.8, 3, 1, 0.5, 1); }
  if (col.stripe) for (const z of [-3, 0, 3]) mesh(box(6.6, 1, 1.1), col.stripe, 0, 10.6 + (dog ? 1 : 0) - (kind === 'cat' ? 0.8 : 0), z);
  const legs = [];
  for (const [x, z] of [[-2.2, 4.6], [2.2, 4.6], [-2.2, -4.6], [2.2, -4.6]]) {
    const hip = new THREE.Group(); hip.position.set(x, dog ? 6.4 : 5.2, z);
    mesh(cyl(1.1, 1.0, dog ? 6.2 : 5.0, 6), B, 0, dog ? -3.1 : -2.5, 0, 1, 1, 1, hip);
    mesh(sph(1.3, 6, 4), W, 0, dog ? -6.2 : -5.0, 0.4, 1, 0.6, 1.3, hip);
    body.add(hip); legs.push(hip);
  }
  const head = new THREE.Group(); head.position.set(0, dog ? 13 : 11, dog ? 7.4 : 6.6); body.add(head);
  mesh(sph(dog ? 4.2 : 3.8, 10, 8), B, 0, 0, 0, 1, 0.95, 1, head);
  if (dog) { mesh(box(3.6, 2.8, 4.2), W, 0, -1.4, 3.8, 1, 1, 1, head); mesh(sph(1.0, 6, 4), col.nose, 0, -0.4, 6.0, 1.2, 0.9, 0.8, head); mesh(box(1.6, 0.5, 1.6), '#E8586A', 0, -3.0, 4.6, 1, 1, 1, head); }
  else { mesh(sph(2.0, 8, 6), W, 0, -1.2, 3.0, 1.3, 0.8, 0.8, head); mesh(sph(0.6, 5, 4), col.nose, 0, -0.4, 3.9, 1.2, 0.8, 0.8, head);
    for (const sx of [-1, 1]) for (const k of [0, 1]) { const w = new THREE.Mesh(box(4, 0.25, 0.25), colMat('#FFFFFF')); w.position.set(sx * 3.2, -1.2 - k * 0.7, 3.2); w.rotation.z = sx * (0.1 - k * 0.2); head.add(w); } }
  for (const sx of [-1, 1]) {
    mesh(sph(0.75, 6, 4), '#1A1A22', sx * 1.7, 0.9, dog ? 3.7 : 3.3, 1, 1.2, 0.6, head);
    if (dog) { const ear = new THREE.Mesh(box(2.2, 4.2, 1.2), colMat(col.ear)); ear.position.set(sx * 3.4, 1.4, -0.4); ear.rotation.z = sx * 0.5; ear.castShadow = true; head.add(ear); }
    else { mesh(cone(1.5, 3.2, 4), col.ear, sx * 2.2, 3.8, 0, 1, 1, 0.6, head); mesh(cone(0.8, 1.8, 4), '#FFB3C0', sx * 2.2, 3.5, 0.5, 1, 1, 0.4, head); }
  }
  if (col.collar !== false && dog) mesh(tor(3.0, 0.6, 4, 12), '#E8283C', 0, -2.8, 0.6, 1, 1, 1, head).rotation.x = H;
  const tail = new THREE.Group(); tail.position.set(0, dog ? 10 : 8, dog ? -6.6 : -6.0); body.add(tail);
  if (dog) { const tm = new THREE.Mesh(cap(1.1, 3.6, 2, 6), colMat(B)); tm.position.set(0, 2.4, -0.6); tm.rotation.x = -0.5; tail.add(tm); mesh(sph(1.2, 6, 4), W, 0, 4.6, -1.8, 1, 1, 1, tail); }
  else { const tm = new THREE.Mesh(cap(0.9, 8, 2, 6), colMat(B)); tm.position.set(0, 4.4, -1.6); tm.rotation.x = -0.35; tail.add(tm); }
  const blob = new THREE.Mesh(BLOB_GEO, BLOB_MAT); blob.rotation.x = -H; blob.position.y = 0.3; blob.scale.set(7, 10, 1); root.add(blob);
  return { root, body, head, legs, tail, kind, blob };
}
// s: { t, walk, moving, sit, lounge, carry (dog: an item in its mouth is drawn by the renderer) }
export function posePet(pp, s) {
  const { legs, body, head, tail } = pp, t = s.t, sw = s.moving ? Math.sin(s.walk * 1.4) : 0;
  legs[0].rotation.x = sw * 0.7; legs[3].rotation.x = sw * 0.7; legs[1].rotation.x = -sw * 0.7; legs[2].rotation.x = -sw * 0.7;
  body.position.y = s.moving ? Math.abs(Math.sin(s.walk * 1.4)) * 0.9 : 0; body.rotation.x = 0; body.rotation.z = 0;
  head.rotation.set(s.moving ? -0.05 : Math.sin(t * 0.9) * 0.08, s.moving ? 0 : Math.sin(t * 0.5) * 0.35, 0);
  tail.rotation.set(0, 0, 0); tail.rotation.y = Math.sin(t * (pp.kind === 'dog' ? (s.moving ? 16 : 9) : 1.6)) * (pp.kind === 'dog' ? 0.6 : 0.4);
  if (s.sit) { legs[2].rotation.x = legs[3].rotation.x = -1.2; body.rotation.x = -0.35; body.position.y = -1.6; legs[0].rotation.x = legs[1].rotation.x = 0.25; }
  if (s.lounge) {   // cat stretched out on its side, slow breathing, tail swish
    for (const l of legs) l.rotation.x = 1.25; body.rotation.z = 1.25; body.position.y = 2.4 + Math.sin(t * 1.8) * 0.15; head.rotation.set(0, 0, -1.0 + Math.sin(t * 0.7) * 0.06);
  }
}

// v4.0 B 节日 scenery pieces (merged into the static level mesh)
export const Fest = {
  jackLantern(out, x, y, s = 1, rot = 0, z = 0) {   // carved pumpkin with a glowing face (bright, unlit look)
    const n0 = out.length;
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; out.push(P(sph(4.4 * s, 8, 6), k % 2 ? '#F2871E' : '#E8761A', [x + Math.sin(a) * 3.4 * s, 5 * s, y + Math.cos(a) * 3.4 * s], [0, 0, 0], [0.8, 1.05, 0.8])); }
    out.push(P(sph(5.4 * s, 9, 7), '#F2871E', [x, 5 * s, y], [0, 0, 0], [1.1, 0.95, 1.1]));
    out.push(P(cyl(0.9 * s, 1.2 * s, 3 * s, 5), '#5A8A2A', [x, 11 * s, y]));
    const fx = Math.sin(rot), fz = Math.cos(rot);
    for (const sx of [-1, 1]) out.push(P(cone(1.3 * s, 2.2 * s, 3), '#FFE14D', [x + fx * 5.6 * s + fz * sx * 2.2 * s, 6.6 * s, y + fz * 5.6 * s - fx * sx * 2.2 * s], [Math.PI, rot, 0], [1, 1, 0.5]));
    out.push(P(box(5 * s, 1.4 * s, 1 * s), '#FFE14D', [x + fx * 5.7 * s, 3.4 * s, y + fz * 5.7 * s], [0, rot, 0]));
    if (z) for (let k = n0; k < out.length; k++) out[k].pos[1] += z;
  },
  xmasTree(out, x, y, s = 1) {
    out.push(P(cyl(2 * s, 2.6 * s, 8 * s, 6), '#7A4A22', [x, 4 * s, y]));
    for (const [h, r, yy] of [[18, 16, 14], [15, 12.5, 24], [12, 9, 33], [9, 5.6, 41]]) out.push(P(cone(r * s, h * s, 9), '#2F8A3A', [x, yy * s, y]));
    for (const [h, r, yy] of [[2, 15.4, 6.8], [2, 12, 17.4], [2, 8.6, 27.8]]) out.push(P(cyl(r * s * 0.82, r * s, h * s, 9), '#FFFFFF', [x, yy * s, y]));
    const bc = ['#E8283C', '#FFC21A', '#3BA7FF', '#FF7FAE', '#FFFFFF'];
    for (let k = 0; k < 22; k++) { const lvl = k % 4, a = k * 2.4, r = [13, 10, 7, 4.4][lvl] * s, yy = [12, 22, 31, 39][lvl] * s; out.push(P(sph(1.3 * s, 6, 4), bc[k % 5], [x + Math.cos(a) * r, yy, y + Math.sin(a) * r])); }
    out.push(P(ico(3 * s, 0), '#FFE14D', [x, 47 * s, y]));
    for (const [dx, dz, c] of [[9, 8, '#E8283C'], [-8, 9, '#3BA7FF'], [3, 12, '#4CD08A']]) { out.push(P(box(6 * s, 5 * s, 6 * s), c, [x + dx * s, 2.5 * s, y + dz * s])); out.push(P(box(6.4 * s, 1 * s, 1.4 * s), '#FFC21A', [x + dx * s, 5.2 * s, y + dz * s])); }
  },
  snowMound(out, x, y, r) { out.push(P(sph(r, 9, 5), '#FFFFFF', [x, 0, y], [0, 0, 0], [1, 0.32, 0.8])); },
  // a pole with a sagging string of red lanterns toward the next pole (dx, dy away)
  lanternString(out, x, y, dx, dy, s = 1) {
    out.push(P(cyl(1.1 * s, 1.3 * s, 34 * s, 6), '#8E3A26', [x, 17 * s, y])); out.push(P(sph(1.8 * s, 6, 4), '#FFC21A', [x, 34.6 * s, y]));
    const L = Math.hypot(dx, dy), n = Math.max(4, Math.round(L / (11 * s)));
    for (let k = 1; k < n; k++) { const t = k / n, sag = Math.sin(t * Math.PI) * 7 * s, lx = x + dx * t, ly = y + dy * t, h = 31 * s - sag;
      out.push(P(cyl(0.2 * s, 0.2 * s, 2.4 * s, 3), '#3A2210', [lx, h + 1.4 * s, ly]));
      out.push(P(sph(2.8 * s, 8, 6), '#E8283C', [lx, h - 2 * s, ly], [0, 0, 0], [1, 1.15, 1])); out.push(P(cyl(1.6 * s, 1.6 * s, 0.9 * s, 6), '#FFC21A', [lx, h + 1.2 * s, ly])); out.push(P(cyl(1.6 * s, 1.6 * s, 0.9 * s, 6), '#FFC21A', [lx, h - 5.2 * s, ly]));
      out.push(P(cyl(0.3 * s, 0.3 * s, 2.6 * s, 3), '#FFC21A', [lx, h - 7 * s, ly])); }
  },
};

// ------------------------------------------------------------------ environment pieces (merged into static meshes)
// v4.0 四季: env trees / hedges take the season's colours (null = the green default).
// Set by the renderer before a level's scenery is built.
let SEASON = null;
export function setSeason(s) { SEASON = Number.isInteger(s) ? s : null; }
const FOLIAGE = [
  { '#2F8A2A': '#3FA236', '#3FA236': '#F7A8C8', '#5DBB3A': '#FFC4DA' },   // 春: blossom (cone pines stay green-ish)
  null,                                                                    // 夏: the default greens
  { '#2F8A2A': '#C8551E', '#3FA236': '#E8871E', '#5DBB3A': '#F6C343' },   // 秋: orange, red and gold
  { '#2F8A2A': '#2E6E4A', '#3FA236': '#E9F1F5', '#5DBB3A': '#FFFFFF' },   // 冬: snow-capped
];
const fol = (c, kind) => {
  const m = SEASON === null ? null : FOLIAGE[SEASON];
  if (!m) return c;
  if (SEASON === 0 && kind === 'cone') return c;            // spring pines stay green
  if (SEASON === 3 && kind === 'cone' && c === '#3FA236') return '#3A8A5A';
  return m[c] || c;
};
export const Env = {
  stoneWall(out, x0, y0, x1, y1, pa, pb) {
    const L = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(x1 - x0, y1 - y0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    out.push(P(box(10, 12, L), '#E9E0CC', [mx, 6, my], [0, a, 0]));
    out.push(P(box(12, 2.6, L + 0.4), '#F6EEDC', [mx, 13.2, my], [0, a, 0]));
    if (pa) { out.push(P(box(15, 18, 15), '#D9CFB8', [x0, 9, y0])); out.push(P(box(17, 2.6, 17), '#F6EEDC', [x0, 19.2, y0])); out.push(P(sph(3.4, 6, 4), '#F6EEDC', [x0, 22.4, y0])); }
    if (pb) { out.push(P(box(15, 18, 15), '#D9CFB8', [x1, 9, y1])); out.push(P(box(17, 2.6, 17), '#F6EEDC', [x1, 19.2, y1])); }
  },
  woodFence(out, x0, y0, x1, y1) {
    const L = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(x1 - x0, y1 - y0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    out.push(P(box(2.2, 2.6, L), '#E3A866', [mx, 7, my], [0, a, 0]));
    out.push(P(box(2.2, 2.6, L), '#E3A866', [mx, 13, my], [0, a, 0]));
    const n = Math.max(1, Math.round(L / 20));
    for (let i = 0; i <= n; i++) { const t = i / n; out.push(P(box(4, 17, 4), '#C8874A', [x0 + (x1 - x0) * t, 8.5, y0 + (y1 - y0) * t])); }
  },
  gate(out, x0, y0, x1, y1, open) {
    const L = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(x1 - x0, y1 - y0);
    out.push(P(box(13, 26, 13), '#D9CFB8', [x0, 13, y0])); out.push(P(box(13, 26, 13), '#D9CFB8', [x1, 13, y1]));
    out.push(P(sph(4, 6, 4), '#F6EEDC', [x0, 28, y0])); out.push(P(sph(4, 6, 4), '#F6EEDC', [x1, 28, y1]));
    if (!open) {
      const n = Math.round(L / 5);
      for (let i = 1; i < n; i++) { const t = i / n; out.push(P(box(1.2, 20, 1.2), '#4A4A55', [x0 + (x1 - x0) * t, 10, y0 + (y1 - y0) * t])); }
      out.push(P(box(1.4, 1.4, L), '#4A4A55', [(x0 + x1) / 2, 18, (y0 + y1) / 2], [0, a, 0]));
      out.push(P(box(1.4, 1.4, L), '#4A4A55', [(x0 + x1) / 2, 6, (y0 + y1) / 2], [0, a, 0]));
    }
  },
  hedge(out, x, y, w, d, h = 18) {
    out.push(P(box(w, h, d), SEASON === 2 ? '#8AA02A' : '#4FA82A', [x + w / 2, h / 2, y + d / 2]));
    out.push(P(box(w - 2, 3, d - 2), SEASON === 3 ? '#F4F8FA' : SEASON === 2 ? '#C9B23A' : '#7FD24A', [x + w / 2, h + 1, y + d / 2]));
  },
  tree(out, x, y, kind, s = 1) {
    out.push(P(cyl(2.4 * s, 3.2 * s, 16 * s, 6), '#8E5627', [x, 8 * s, y]));
    if (kind === 'cone') {
      out.push(P(cone(13 * s, 26 * s, 7), fol('#2F8A2A', 'cone'), [x, 26 * s, y]));
      out.push(P(cone(10 * s, 20 * s, 7), fol('#3FA236', 'cone'), [x, 38 * s, y]));
      out.push(P(cone(6 * s, 13 * s, 7), fol('#5DBB3A', 'cone'), [x, 48 * s, y]));
    } else {
      out.push(P(ico(15 * s, 1), fol('#3FA236'), [x, 30 * s, y]));
      out.push(P(ico(10 * s, 0), fol('#5DBB3A'), [x + 6 * s, 38 * s, y + 4 * s]));
      out.push(P(ico(9 * s, 0), fol('#2F8A2A'), [x - 8 * s, 26 * s, y - 3 * s]));
    }
  },
  shrub(out, x, y, flower) {
    out.push(P(ico(9, 1), '#4FAE32', [x, 7, y], [0, 0, 0], [1, 0.8, 1]));
    for (const [dx, dy, dz] of [[4, 11, 3], [-5, 10, 2], [1, 12, -5], [-2, 9, 6], [6, 8, -3]]) out.push(P(sph(1.6, 5, 4), flower, [x + dx, dy, y + dz]));
  },
  barn(out, X, Y) {
    const w = 76, d = 56, h = 34, x = X - w / 2, y = Y - d / 2;
    out.push(P(box(w, h, d), '#D9482E', [X, h / 2, Y]));
    out.push(P(box(w + 1, 3, d + 1), '#FFFFFF', [X, 2, Y]));
    // gable roof along x
    const roof = new THREE.CylinderGeometry(1, 1, 1, 3, 1);
    out.push(P(roof, '#8E3A26', [X, h + 10, Y], [0, 0, H], [24, w + 8, d * 0.62]));
    out.push(P(box(28, 26, 1.4), '#8E2A18', [X, 13, y + d + 0.6]));
    out.push(P(box(30, 2, 1.8), '#FFFFFF', [X, 26, y + d + 0.8]));
    out.push(P(box(2, 26, 1.8), '#FFFFFF', [X - 14, 13, y + d + 0.8])); out.push(P(box(2, 26, 1.8), '#FFFFFF', [X + 14, 13, y + d + 0.8]));
    out.push(P(box(36, 1.8, 1.8), '#FFFFFF', [X, 13, y + d + 0.8], [0, 0, 0.75])); out.push(P(box(36, 1.8, 1.8), '#FFFFFF', [X, 13, y + d + 0.8], [0, 0, -0.75]));
    out.push(P(box(12, 10, 1.4), '#FFFFFF', [X, h + 5, y + d + 4]));
    void x;
  },
  // ---- v3.7 scenery ----
  // grape trellis: posts at both ends of every vine row (and every ~60 units), two wires along the row
  trellis(out, f) {
    const x0 = f.x - 3, x1 = f.x + f.w + 3, n = Math.max(1, Math.round((x1 - x0) / 60));
    for (let r = 0; r < f.rows; r++) {
      const y = f.y + (r + 0.5) * f.gy;
      for (let i = 0; i <= n; i++) out.push(P(box(1.6, 17, 1.6), '#A0703A', [x0 + (x1 - x0) * i / n, 8.5, y]));
      out.push(P(box(x1 - x0, 0.5, 0.5), '#5A5E68', [(x0 + x1) / 2, 15.6, y])); out.push(P(box(x1 - x0, 0.5, 0.5), '#5A5E68', [(x0 + x1) / 2, 9.4, y]));
    }
  },
  // greenhouse: white frame (posts, eaves, gable ridge and rafters). The glass is a separate see-through mesh.
  greenhouseFrame(out, x, y, w, h) {
    const H0 = 26, R = 44, cy = y + h / 2, W2 = '#F4F6F8';
    const nx = Math.max(2, Math.round(w / 52)), ny = Math.max(2, Math.round(h / 52));
    for (let i = 0; i <= nx; i++) { const xx = x + w * i / nx; for (const yy of [y, y + h]) out.push(P(box(2.2, H0, 2.2), W2, [xx, H0 / 2, yy])); const a = Math.atan2(R - H0, h / 2), L = Math.hypot(h / 2, R - H0); out.push(P(box(1.6, 1.6, L), W2, [xx, (H0 + R) / 2, y + h / 4], [-a, 0, 0])); out.push(P(box(1.6, 1.6, L), W2, [xx, (H0 + R) / 2, y + h * 3 / 4], [a, 0, 0])); }
    for (let j = 1; j < ny; j++) { const yy = y + h * j / ny; for (const xx of [x, x + w]) out.push(P(box(2.2, H0, 2.2), W2, [xx, H0 / 2, yy])); }
    for (const yy of [y, y + h]) out.push(P(box(w + 2, 2, 2), W2, [x + w / 2, H0, yy]));
    for (const xx of [x, x + w]) out.push(P(box(2, 2, h + 2), W2, [xx, H0, cy]));
    out.push(P(box(w + 4, 2.4, 2.4), W2, [x + w / 2, R, cy]));
    for (const xx of [x, x + w]) { const a = Math.atan2(R - H0, h / 2), L = Math.hypot(h / 2, R - H0); out.push(P(box(2, 2, L), W2, [xx, (H0 + R) / 2, y + h / 4], [-a, 0, 0])); out.push(P(box(2, 2, L), W2, [xx, (H0 + R) / 2, y + h * 3 / 4], [a, 0, 0])); }
    out.push(P(box(w + 4, 3, 3), '#C9CED8', [x + w / 2, 1.5, y])); out.push(P(box(w + 4, 3, 3), '#C9CED8', [x + w / 2, 1.5, y + h]));
  },
  greenhouseGlass(out, x, y, w, h) {
    const H0 = 26, R = 44, cy = y + h / 2, G2 = '#D8F4FF', a = Math.atan2(R - H0, h / 2), L = Math.hypot(h / 2, R - H0);
    out.push(P(box(w, H0 - 4, 0.4), G2, [x + w / 2, H0 / 2 + 2, y])); out.push(P(box(w, H0 - 4, 0.4), G2, [x + w / 2, H0 / 2 + 2, y + h]));
    out.push(P(box(0.4, H0 - 4, h), G2, [x, H0 / 2 + 2, cy])); out.push(P(box(0.4, H0 - 4, h), G2, [x + w, H0 / 2 + 2, cy]));
    out.push(P(box(w, 0.4, L), G2, [x + w / 2, (H0 + R) / 2, y + h / 4], [-a, 0, 0])); out.push(P(box(w, 0.4, L), G2, [x + w / 2, (H0 + R) / 2, y + h * 3 / 4], [a, 0, 0]));
  },
  // night lantern: dark post with a crooked arm; the glowing globe is drawn separately (unlit material)
  lantern(out, x, y) {
    out.push(P(cyl(1.3, 1.8, 30, 6), '#3A2A1E', [x, 15, y]), P(box(9, 1.2, 1.2), '#3A2A1E', [x + 4, 29, y]), P(cyl(3, 3.6, 2, 8), '#2A2A30', [x, 1, y]));
    out.push(P(cyl(2.2, 3.2, 1.6, 8), '#2A2A30', [x + 8, 27.6, y]));
  },
  // checkout desk (long along y): blue body, light top, register
  counter(out, c, K) {
    const d = c.desk;
    out.push(P(box(d.w, K.deskH - 3, d.h), '#3E6FCC', [d.x + d.w / 2, (K.deskH - 3) / 2, d.y + d.h / 2]));
    out.push(P(box(d.w + 4, 3, d.h + 4), '#8DB6FF', [d.x + d.w / 2, K.deskH - 1.5, d.y + d.h / 2]));
    out.push(P(box(d.w - 6, 4, d.h - 6), '#2C559E', [d.x + d.w / 2, 3, d.y + d.h / 2]));
    out.push(P(box(14, 5, 12), '#E6EAF2', [d.x + 11, K.deskH + 2.5, d.y + 12]));
    out.push(P(box(2, 9, 10), '#3BB8F0', [d.x + 6, K.deskH + 8, d.y + 12], [0, 0, 0.3]));
  },
  proc(out, p, P0, cols) {
    const b = p.body, H0 = P0.bodyH, cx = b.x + b.w / 2, cz = b.y + b.h / 2;
    out.push(P(box(b.w + 6, 5, b.h + 6), '#C9CED8', [cx, 2.5, cz]));
    out.push(P(box(b.w, H0 - 5, b.h), cols[1], [cx, 5 + (H0 - 5) / 2, cz]));
    out.push(P(box(b.w - 8, 3, b.h - 8), '#FFFFFF', [cx, H0 + 1.5, cz]));
    out.push(P(box(b.w + 0.6, 4, b.h + 0.6), cols[0], [cx, H0 - 4, cz]));
    out.push(P(cyl(13, 6, 12, 4), '#D8DCE6', [b.x + 8, H0 + 8, cz], [0, Math.PI / 4, 0]));
    out.push(P(cyl(3.2, 3.6, 18, 8), '#767A86', [b.x + b.w - 11, H0 + 9, b.y + 10]));
    out.push(P(cyl(4, 4, 2, 8), '#5A5E68', [b.x + b.w - 11, H0 + 18.5, b.y + 10]));
    out.push(P(box(18, 12, 1), '#FFFFFF', [cx, H0 * 0.55, b.y + b.h + 0.6]));
  },
};
export const PROC_COL = { chips: ['#FFE16B', '#E8302C'], flour: ['#FFF3DC', '#D9A05A'], bread: ['#F2C08A', '#B8552E'], smoked: ['#A0703A', '#5A3A22'], gjuice: ['#C89AF0', '#7A3EA8'], wine: ['#E8C8A0', '#7A2A3A'], plank: ['#C8874A', '#8E5627'], chair: ['#F2C08A', '#C98A4B'], cheese: ['#FFE16B', '#E8B21E'], icecream: ['#FFC2DA', '#8DB6FF'], popcorn: ['#FF8A6E', '#E8452C'], pie: ['#F2C08A', '#E8871E'], jam: ['#FF8FB0', '#C8102E'], yarn: ['#FFB3D8', '#B07ACC'], juice: ['#9BE460', '#4CB24E'], bouquet: ['#FFE16B', '#E8B21E'], basket: ['#F2C08A', '#C98A4B'], perfume: ['#FFB8D8', '#E86AA6'], crate: ['#8DB6FF', '#5B8FE8'], ketchup: ['#FF8A6E', '#E8452C'] };

// ------------------------------------------------------------------ 商店 decorations (v3.4)
// Each sits on its origin, ~person-sized to a little bigger; used outside the fence in levels.
const DECO_PARTS = {
  bench: () => [P(box(30, 2, 9), '#C8874A', [0, 7, 0]), P(box(30, 8, 2), '#B87436', [0, 12, -4]), ...[-12, 12].flatMap((x) => [P(box(2, 7, 2), '#5A3414', [x, 3.5, 3]), P(box(2, 7, 2), '#5A3414', [x, 3.5, -3])])],
  lanterns: () => {
    const out = [P(cyl(0.9, 0.9, 30, 6), '#5A3414', [-18, 15, 0]), P(cyl(0.9, 0.9, 30, 6), '#5A3414', [18, 15, 0]), P(box(38, 0.8, 0.8), '#3A2210', [0, 28, 0])];
    for (const x of [-10, 0, 10]) out.push(P(sph(3.8, 8, 6), '#E8283C', [x, 22, 0], [0, 0, 0], [1, 1.15, 1]), P(cyl(2, 2, 1.2, 8), '#FFC21A', [x, 26.2, 0]), P(cyl(2, 2, 1.2, 8), '#FFC21A', [x, 17.8, 0]));
    return out;
  },
  scarecrow: () => [P(cyl(1, 1, 30, 6), '#8E5627', [0, 15, 0]), P(cyl(0.9, 0.9, 24, 6), '#8E5627', [0, 21, 0], [0, 0, H]), P(box(12, 11, 6), '#3B7FE0', [0, 19, 0]),
    P(sph(5.4, 9, 7), '#F2CF8A', [0, 30, 0]), P(cyl(9, 9, 0.8, 10), '#E8BE4E', [0, 33.5, 0]), P(cyl(4.8, 5.6, 4, 10), '#E8BE4E', [0, 36, 0]), P(box(3, 3, 1), '#E8452C', [-4, 19, 3.2]), P(box(3, 3, 1), '#FFD23F', [3, 16, 3.2]),
    ...[-1, 1].map((s) => P(cone(2, 5, 5), '#F2CF6B', [s * 13, 21, 0], [0, 0, -s * H]))],
  flowerbed: () => {
    const out = [P(cyl(14, 15, 5, 12), '#C9A27A', [0, 2.5, 0]), P(cyl(12.6, 12.6, 1, 12), '#7A4A22', [0, 5.2, 0])];
    const fc = ['#FF6F92', '#FFE16B', '#FFFFFF', '#B07ACC', '#FF8A3D'];
    for (let k = 0; k < 14; k++) { const a = k * 2.4, r = 3 + (k % 3) * 3.4; out.push(P(cyl(0.4, 0.4, 5, 4), '#4FAE32', [Math.cos(a) * r, 7.5, Math.sin(a) * r]), P(sph(2.1, 6, 5), fc[k % 5], [Math.cos(a) * r, 10.4, Math.sin(a) * r])); }
    return out;
  },
  pond: () => {
    const out = [P(cyl(20, 21, 1.4, 14), '#9AA4AE', [0, 0.7, 0], [0, 0, 0], [1, 1, 0.7]), P(cyl(17.5, 17.5, 1.6, 14), '#4FB8F0', [0, 1, 0], [0, 0, 0], [1, 1, 0.7])];
    for (const [x, z] of [[-7, 2], [6, -4], [2, 6]]) out.push(P(cyl(3, 3, 0.4, 8), '#4FAE32', [x, 1.9, z]), P(sph(1.2, 6, 4), '#FF8FB0', [x + 0.6, 2.6, z]));
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; out.push(P(ico(2.4, 0), k % 2 ? '#B9B2A4' : '#D6D0C2', [Math.cos(a) * 20, 1.2, Math.sin(a) * 14])); }
    return out;
  },
  swing: () => [P(cyl(1, 1.2, 32, 6), '#8E5627', [-14, 16, 0], [0, 0, 0.12]), P(cyl(1, 1.2, 32, 6), '#8E5627', [14, 16, 0], [0, 0, -0.12]), P(cyl(1.1, 1.1, 32, 6), '#A0622D', [0, 31.5, 0], [0, 0, H]),
    P(cyl(0.35, 0.35, 22, 4), '#E8E0C8', [-5, 20.5, 0]), P(cyl(0.35, 0.35, 22, 4), '#E8E0C8', [5, 20.5, 0]), P(box(13, 1.4, 5), '#E8452C', [0, 9.4, 0])],
  arch: () => {
    const out = [];
    for (let k = 0; k <= 12; k++) { const a = Math.PI * k / 12, x = Math.cos(a) * 15, y = 4 + Math.sin(a) * 28; out.push(P(ico(3.2, 0), '#3E9A2A', [x, y, 0]), P(sph(1.7, 6, 5), k % 2 ? '#FF6F92' : '#FFFFFF', [x + 1, y + 1.5, 2.4])); }
    out.push(P(box(3, 6, 3), '#FFFFFF', [-15, 3, 0]), P(box(3, 6, 3), '#FFFFFF', [15, 3, 0]));
    return out;
  },
  windmill: () => [P(cyl(5.5, 9, 34, 8), '#FFF3DC', [0, 17, 0]), P(cone(7.4, 10, 8), '#E8452C', [0, 39, 0]), P(box(5, 8, 1), '#8E5627', [0, 4, 8.6])],
  fountain: () => {
    const out = [P(cyl(20, 21, 5, 16), '#E9E0CC', [0, 2.5, 0]), P(cyl(17.5, 17.5, 1, 16), '#5DB8F0', [0, 5.2, 0]), P(cyl(2.6, 3.2, 14, 8), '#EFE7D4', [0, 11, 0]),
      P(cyl(9, 7, 2.4, 12), '#E9E0CC', [0, 17.5, 0]), P(cyl(7.4, 7.4, 0.8, 12), '#5DB8F0', [0, 18.8, 0]), P(sph(2.4, 8, 6), '#BDE8FF', [0, 23, 0]), P(cone(1.8, 6, 6), '#E4F6FF', [0, 27, 0])];
    return out;
  },
  balloon: () => {
    const out = [P(box(10, 7, 10), '#A0622D', [0, 3.5, 0]), P(box(10.6, 1.2, 10.6), '#5A3414', [0, 7.4, 0])];
    for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) out.push(P(cyl(0.3, 0.3, 16, 4), '#5A3414', [x * 1.3, 15, z * 1.3]));
    const sc = ['#E8283C', '#FFD23F', '#3BA7FF', '#4CD08A', '#FF7FAE', '#FFFFFF'];
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; out.push(P(sph(5.5, 6, 6), sc[k % 6], [Math.cos(a) * 10, 34, Math.sin(a) * 10], [0, -a, 0], [0.75, 2.2, 1])); }
    out.push(P(sph(12, 12, 10), '#FFE16B', [0, 34, 0], [0, 0, 0], [1, 1.1, 1]), P(cone(8, 8, 12), '#FF8A3D', [0, 23, 0], [Math.PI, 0, 0]));
    return out;
  },
  statue: () => [P(box(16, 8, 16), '#EFE7D4', [0, 4, 0]), P(box(18, 2, 18), '#D6CCB4', [0, 9, 0]), P(cap(5, 9, 3, 8), '#FFC21A', [0, 20, 0]), P(sph(5.2, 10, 8), '#FFD23F', [0, 33, 0]),
    P(cyl(4.4, 4, 3, 10), '#FFC21A', [0, 38.5, 0]), ...Array.from({ length: 5 }, (_, k) => { const a = k / 5 * Math.PI * 2; return P(cone(1.2, 3, 4), '#FFE16B', [Math.sin(a) * 3.8, 41.5, Math.cos(a) * 3.8]); }),
    P(cyl(0.8, 0.8, 14, 5), '#FFC21A', [7, 26, 0], [0, 0, -0.5]), P(ico(2.2, 0), '#FFE16B', [11, 33, 0])],
  jackLamp: () => { const out = []; Fest.jackLantern(out, -7, 0, 1.15, 0.4); Fest.jackLantern(out, 8, 4, 0.85, -0.3); Fest.jackLantern(out, 1, -8, 0.7, 0); out.push(P(box(3, 1, 3), '#5A3414', [0, 0.5, 0])); return out; },
  xmasTree: () => { const out = []; Fest.xmasTree(out, 0, 0, 0.9); return out; },
  redLamps: () => { const out = []; Fest.lanternString(out, -20, 0, 40, 0); out.push(P(cyl(1.1, 1.3, 34, 6), '#8E3A26', [20, 17, 0]), P(sph(1.8, 6, 4), '#FFC21A', [20, 34.6, 0])); return out; },
  rainbow: () => {
    const out = [], rc = ['#FF4D4D', '#FF9F43', '#FFD23F', '#4CD08A', '#3BA7FF', '#A77BFF'];
    rc.forEach((c, i) => { for (let k = 0; k <= 14; k++) { const a = Math.PI * k / 14, R = 30 - i * 2.6; out.push(P(box(3.4, 2.6, 6), c, [Math.cos(a) * R, Math.sin(a) * R * 0.9, 0], [0, 0, a - H])); } });
    for (const x of [-30, 30]) out.push(P(sph(6, 8, 6), '#FFFFFF', [x, 2, 0], [0, 0, 0], [1.4, 0.8, 1]), P(sph(4.4, 8, 6), '#FFFFFF', [x + (x > 0 ? -5 : 5), 4, 2]));
    return out;
  },
};
const DECO_GEO = {};
export function decoGeo(id) { return DECO_GEO[id] || (DECO_GEO[id] = merge((DECO_PARTS[id] || DECO_PARTS.bench)())); }
// the windmill's sails are a separate mesh so they can turn
export function windmillSails() {
  const parts = [P(cyl(1.6, 1.6, 3, 8), '#5A3414', [0, 0, 0], [H, 0, 0])];
  for (let k = 0; k < 4; k++) { const a = k * H; parts.push(P(box(3.2, 16, 0.6), '#FFFFFF', [Math.cos(a) * 9, Math.sin(a) * 9, 1], [0, 0, a - H]), P(box(1, 16, 0.7), '#7FB0FF', [Math.cos(a) * 9, Math.sin(a) * 9, 1.2], [0, 0, a - H])); }
  return merge(parts);
}

// ------------------------------------------------------------------ v4.2 鱼塘
// swimming fish, nose along +Z (render rotates by heading): 0 鲫鱼 silver-blue, 1 鲤鱼 golden bronze,
// 2 锦鲤 white with red patches, 3 金锦鲤 all gold (drawn with an emissive material)
const SWIM_GEO = {};
export function swimFishGeo(sp) {
  if (SWIM_GEO[sp]) return SWIM_GEO[sp];
  const C = [['#8FB4CC', '#E8F2F6', '#6E94AE'], ['#F0A23A', '#FBDDA0', '#D07A1E'], ['#FFFFFF', '#FFF4EE', '#F2F2F2'], ['#FFD23F', '#FFF0A0', '#F2B21E']][sp];
  const parts = [
    P(sph(1, 10, 7), C[0], [0, 0, 0], [0, 0, 0], [2.3, 1.5, 4.6]),
    P(sph(1, 8, 5), C[1], [0, -0.55, 0.4], [0, 0, 0], [1.9, 0.9, 3.6]),
    P(cone(1.9, 3.2, 4), C[2], [0, 0, -5.6], [Math.PI / 2, 0, 0], [0.35, 1, 1]),       // tail fan (wide end out)
    P(cone(0.9, 2.4, 4), C[2], [0, 1.6, 0.4], [0, 0, 0], [0.35, 1, 1.6]),               // dorsal fin
    P(sph(0.42, 5, 4), '#1A1A1A', [1.25, 0.45, 3.2]), P(sph(0.42, 5, 4), '#1A1A1A', [-1.25, 0.45, 3.2]),
  ];
  if (sp === 2) parts.push(P(sph(1, 7, 5), '#E8452C', [0.2, 0.9, 1.6], [0, 0, 0], [1.6, 0.8, 1.6]), P(sph(1, 7, 5), '#E8452C', [-0.3, 0.8, -1.8], [0, 0, 0], [1.4, 0.8, 1.3]), P(sph(0.6, 6, 4), '#2A2A30', [0.9, 0.9, -0.2]));
  if (sp === 1) parts.push(P(cyl(0.12, 0.12, 2.2, 4), '#B8601A', [0.9, -0.2, 4.2], [Math.PI / 2.4, 0, 0.3]), P(cyl(0.12, 0.12, 2.2, 4), '#B8601A', [-0.9, -0.2, 4.2], [Math.PI / 2.4, 0, -0.3]));   // carp barbels
  return (SWIM_GEO[sp] = merge(parts));
}
// 投喂器: a wooden post on the bank with a red hopper and a little chute over the water
export function feederGeo() {
  return merge([
    P(cyl(1.2, 1.4, 16, 6), '#8E5627', [0, 8, 0]),
    P(cyl(5, 3, 6, 8), '#E8452C', [0, 18, 0]), P(cyl(5.4, 5.4, 1.2, 8), '#FFD23F', [0, 21.4, 0]), P(cone(5.8, 3, 8), '#C8352A', [0, 23.4, 0]),
    P(box(1.6, 1.2, 8), '#A8741E', [0, 14.6, 4.6], [0.35, 0, 0]),
    P(box(6, 1, 6), '#8E5627', [0, 0.5, 0]),
  ]);
}
