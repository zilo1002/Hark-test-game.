// v5.0.6 probe: back-basket crates must sit snug, not float. Jin: "背篓的箱子看着是飘着的" —
// the step was 24 but a wood crate is only ~17 tall, leaving a 7 gap; a steamer is only ~7
// tall, leaving a 17.5 gap. The step must be the crate's own height + a 1–2 slit, and the
// next crate's floor must clear the goods poking out of the crate below (berries top out
// highest in a wood crate; buns poke out of a steamer). Mixed-kind stacks must stack by
// cumulative height, not boxIndex * one step, or a steamer would land inside a wood crate.
//   node sim/probe-crate-gap.mjs
import fs from 'node:fs';
import { ITEM_HALF } from '../js/models.js';
import { cargoPackageLayout, cargoCratePosition, cargoItemSlot } from '../js/cargo-crate.js';

// Crate geometry from updateCargoCrateStack (cargo-crate.js): wood/fish posts span base+0..17
// (rails at 4/9/14, floor base+0..2); steamer floor cyl base+0.5..3.5, rim torus base+3.5..6.5.
const CRATE_TOP = { 'wood-crate': 17, 'fish-crate': 17, steamer: 6.5 };
const FLOOR_BOTTOM = { 'wood-crate': 0, 'fish-crate': 0, steamer: 0.5 };
// Item draw scale from drawStack (render3d.js): fruit 1.05, everything else 0.85.
const r3 = fs.readFileSync(new URL('../js/render3d.js', import.meta.url), 'utf8');
const m = r3.match(/type === 'apple' \|\| type === 'berry' \|\| type === 'grape' \? ([\d.]+) : ([\d.]+)/);
const fruitScale = m ? +m[1] : 1.05, otherScale = m ? +m[2] : 0.85;
const scaleOf = (t) => (t === 'apple' || t === 'berry' || t === 'grape' ? fruitScale : otherScale);

let bad = 0;
const check = (name, ok, extra = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${extra}`); if (!ok) bad++; };

// Max item top WITHIN one box (slot y is absolute incl. the box base — subtract it back).
function maxItemTop(item) {
  const counts = { [item]: 24 };
  const layout = cargoPackageLayout(counts);
  const kind = layout.groups[item].kind;
  let top = 0;
  for (let n = 0; n < Math.min(24, layout.groups[item].capacity * layout.groups[item].boxes); n++) {
    const s = cargoItemSlot(item, n, counts);
    if (!s) continue;
    const base = cargoCratePosition(s.box, s.kind).base;
    const withinY = s.y - base;
    const centre = withinY + (ITEM_HALF[item] || 2);
    top = Math.max(top, centre + (ITEM_HALF[item] || 2) * scaleOf(item));
  }
  return { kind, top };
}
console.log('crate tops (own height): wood/fish 17, steamer 6.5');
for (const item of ['apple', 'berry', 'wheat', 'fish', 'xiaolongbao', 'teasnack']) {
  const { kind, top } = maxItemTop(item);
  console.log(`  info ${item} (${kind}): tallest item top ${top.toFixed(2)} (crate top ${CRATE_TOP[kind]})`);
}
// Gap + clearance for the actual steps (measured from cargoCratePosition, single-kind).
function stepOf(kind) { return cargoCratePosition(1, kind).base - cargoCratePosition(0, kind).base; }
function report(kind) {
  const step = stepOf(kind), gap = step - CRATE_TOP[kind];
  console.log(`  ${kind}: step ${step} -> gap ${gap} (crate top ${CRATE_TOP[kind]})`);
  return { step, gap };
}
const wood = report('wood-crate');
report('fish-crate');
const steam = report('steamer');
const woodGap = wood.gap, steamStep = steam.step;
check('wood/fish gap is a narrow slit (1–2)', woodGap >= 1 && woodGap <= 2, ` (gap ${woodGap})`);
// Steamer: the buns fill the slit, so the visible empty slit is floor-bottom minus bun top.
const bunTop = maxItemTop('xiaolongbao').top;
const steamSlit = (steamStep + FLOOR_BOTTOM.steamer) - bunTop;
console.log(`  steamer visible slit: next floor ${steamStep + FLOOR_BOTTOM.steamer} - bun top ${bunTop.toFixed(2)} = ${steamSlit.toFixed(2)}`);
check('steamer visible slit is narrow (0–2, buns fill the rest)', steamSlit >= 0 && steamSlit <= 2, ` (slit ${steamSlit.toFixed(2)})`);
// No item clipping: next floor bottom must clear the tallest item in the crate below.
for (const [item, step] of [['berry', wood.step], ['apple', wood.step], ['fish', wood.step], ['xiaolongbao', steamStep]]) {
  const { kind, top } = maxItemTop(item);
  const clear = (step + FLOOR_BOTTOM[kind]) - top;
  check(`${item}: next floor clears tallest item by ${clear.toFixed(2)}`, clear >= 0.5, ` (clear ${clear.toFixed(2)})`);
}
// Mixed stack: wheat (wood) + fish + xiaolongbao (steamer) must stack cumulatively —
// bases strictly increasing, no overlap between a crate's top and the next crate's floor.
const mixed = { wheat: 24, fish: 6, xiaolongbao: 6 };
const layout = cargoPackageLayout(mixed);
console.log(`  mixed stack groups: ${JSON.stringify(Object.fromEntries(Object.entries(layout.groups).map(([k, g]) => [k, { startBox: g.startBox, boxes: g.boxes, kind: g.kind }])))}`);
const boxes = [];
for (let b = 0; b < layout.boxes; b++) {
  const g = Object.values(layout.groups).find((x) => b >= x.startBox && b < x.startBox + x.boxes);
  boxes.push({ box: b, kind: g.kind, base: cargoCratePosition(b, g.kind, layout.groups).base });
}
console.log(`  mixed bases: ${boxes.map((x) => `${x.kind}@${x.base}`).join(', ')}`);
let overlap = false;
for (let i = 0; i + 1 < boxes.length; i++) {
  const cur = boxes[i], nxt = boxes[i + 1];
  if (nxt.base < cur.base + CRATE_TOP[cur.kind]) { overlap = true; console.log(`  OVERLAP box ${cur.box} (${cur.kind} top ${cur.base + CRATE_TOP[cur.kind]}) vs box ${nxt.box} base ${nxt.base}`); }
}
check('mixed stack: no crate overlaps the next', !overlap);
check('mixed stack: bases strictly increasing', boxes.every((x, i) => i === 0 || x.base > boxes[i - 1].base));
// Current step in the source (must be the new snug steps, not 24).
const cc = fs.readFileSync(new URL('../js/cargo-crate.js', import.meta.url), 'utf8');
check('source no longer uses step 24', !/base:.*\* 24/.test(cc));
console.log(bad === 0 ? 'probe-crate-gap: PASS' : `probe-crate-gap: FAIL (${bad})`);
process.exit(bad === 0 ? 0 : 1);
