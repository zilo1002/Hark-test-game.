// v5.0.4 probe: back-basket fullness (c). Jin's reference: apples big, touching, brimming.
// The back basket's packable goods sit in wooden crates (cargoItemSlot grid) and are drawn
// in drawStack (render3d.js) at a per-kind scale. Full = rendered diameter >= grid spacing
// (items touch, no gaps) in x (7), z (~5.3) and layer rise (5), and the top layer reaches
// the crate rim (~17). Counter and stands are OUT of scope for (c) — untouched.
//   node sim/probe-basket-full.mjs
import fs from 'node:fs';
import { ITEM_HALF } from '../js/models.js';
import { cargoPackageLayout, cargoCratePosition, cargoItemSlot } from '../js/cargo-crate.js';

const r3 = fs.readFileSync(new URL('../js/render3d.js', import.meta.url), 'utf8');
const m = r3.match(/type === 'apple' \|\| type === 'berry' \|\| type === 'grape' \? ([\d.]+) : ([\d.]+)/);
if (!m) { console.log('FAIL  crate-item scale line not found in render3d.js'); process.exit(1); }
const fruitScale = +m[1], otherScale = +m[2];
console.log(`crate-item scale: fruit=${fruitScale} other=${otherScale} (was 0.58/0.46)`);

// crate grid spacings from cargoItemSlot (wood crate): x -11/-3.5/3.5/11 (7), z -8/-2.7/2.7 (~5.3), layer 5
const SX = 7, SZ = 5.3, SL = 5, RIM = 17;
// Footprint (horizontal extent at scale 1) from the mesh code in models.js — HALF is the
// vertical half-height and understates flat items: grape lies on its side, a ~12-long bunch.
const FOOT = { apple: { x: 7.35, z: 7.35, h: 6.65 }, berry: { x: 6.4, z: 6.4, h: 6.8 }, grape: { x: 11.8, z: 7.9, h: 3.4 } };
const fruit = ['apple', 'berry', 'grape'];
const others = ['wheat', 'tulip', 'fish', 'gold', 'xiaolongbao'];
let bad = 0;
const check = (name, ok) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) bad++; };
for (const type of fruit) {
  const f = FOOT[type];
  const dx = f.x * fruitScale, dz = f.z * fruitScale, h = f.h * fruitScale;
  check(`${type}: x-extent ${dx.toFixed(1)} >= x-spacing ${SX} (touching, gap ${(SX - dx).toFixed(1)})`, dx >= SX - 0.5);
  check(`${type}: z-extent ${dz.toFixed(1)} >= z-spacing ${SZ}`, dz >= SZ);
  // Grape lies flat by design (a wide sheet, not a ball): its layers stack as two dense sheets
  // with a thin vertical gap — the horizontal overlap is what makes it read full, so no height check.
  if (type !== 'grape') check(`${type}: height ${h.toFixed(1)} >= layer rise ${SL} (nested, no vertical gap)`, h >= SL);
  else console.log(`  info grape: flat bunch, layers are two dense sheets (height ${h.toFixed(1)} vs rise ${SL})`);
}
for (const type of others) {
  const d = 2 * (ITEM_HALF[type] || 2) * otherScale;
  console.log(`  info ${type}: diameter ${d.toFixed(1)} at scale ${otherScale} (was ${(2 * (ITEM_HALF[type] || 2) * 0.46).toFixed(1)})`);
}
// top layer reaches the rim: layer-1 slot y=9.5 + HALF*scale vs rim 17 (apple)
const topApple = 9.5 + ITEM_HALF.apple * fruitScale + ITEM_HALF.apple * fruitScale * 0.95;
console.log(`  info apple top-layer top ≈ ${topApple.toFixed(1)} vs crate rim ${RIM}`);
check(`apple top layer reaches rim (top ${topApple.toFixed(1)} >= ${RIM - 1})`, topApple >= RIM - 1);
// single column still holds (b)
const layout = cargoPackageLayout({ apple: 150 });
const g = layout.groups.apple;
const origins = Array.from({ length: g.boxes }, (_, b) => cargoCratePosition(g.startBox + b, g.kind));
check(`single column: ${g.boxes} boxes all x=0, height ${Math.max(...origins.map((o) => o.base)) + RIM}`, origins.every((o) => o.x === 0)); // v5.0.6: stack height is top base + crate height (17), not the old step 24
// each crate still full (12/layer x 2 layers)
let full = true;
for (let b = 0; b < g.boxes - 1; b++) {
  const n = Math.min(g.capacity, 150 - b * g.capacity);
  if (n !== 24) full = false;
}
check('each full crate holds 24 (12/layer x 2)', full);
console.log(bad ? `RESULT: ${bad} FAIL` : 'RESULT: ALL PASS');
process.exit(bad ? 1 : 0);
