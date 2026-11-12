// Prove the L58 counter mechanism: replicate the loose-layout draw loop from
// render3d.js (lines ~1002-1034) with realistic C1 stock compositions and count
// how many of each kind would actually be drawn.
import { CFG } from '../js/config.js';
import { World } from '../js/world.js';
import { isPackableCargo } from '../js/cargo-crate.js';

const w = new World(57, { quiet: true, seed: 1 });
const c1 = w.counters.find((c) => c.id === 'C1');
console.log('C1.items =', JSON.stringify(c1.items), ' potato packable?', isPackableCargo('potato'), ' corn packable?', isPackableCargo('corn'));

// Exact copy of the loose-layout counting logic from render3d.js drawCounters.
function drawnPerKind(stock) {
  const singleKind = [...new Set(stock)];
  const groupByKind = (arr) => { const kinds = [], by = new Map(); for (const t of arr) { if (!by.has(t)) { by.set(t, []); kinds.push(t); } by.get(t).push(t); } return kinds.flatMap((k) => by.get(k)); };
  const boxed = singleKind.length === 1 ? [] : groupByKind(stock.filter((type) => isPackableCargo(type))).slice(0, 24);
  const loose = singleKind.length === 1 ? [] : groupByKind(stock.filter((type) => !isPackableCargo(type)).concat(stock.filter((type) => isPackableCargo(type)).slice(24)));
  const drawn = {};
  if (singleKind.length === 1) { drawn[stock[0]] = Math.min(stock.length, 120); return { mode: 'single-kind 3x4 grid', drawn }; }
  let n = 0;
  for (const [ki, type] of [...new Set(loose)].entries()) {
    const items = loose.filter((t) => t === type);
    let d = 0;
    for (let j = 0; j < items.length && j < 120; j++, n++) d++;
    drawn[type] = d;
  }
  return { mode: 'multi-kind loose', drawn };
}

const cases = [
  ['Jin-like: corn 150 first, potato 50', [...Array(150).fill('corn'), ...Array(50).fill('potato')]],
  ['reverse: potato 150 first, corn 50', [...Array(150).fill('potato'), ...Array(50).fill('corn')]],
  ['corn 120, potato 50', [...Array(120).fill('corn'), ...Array(50).fill('potato')]],
  ['corn 119, potato 50', [...Array(119).fill('corn'), ...Array(50).fill('potato')]],
  ['corn 80, potato 80', [...Array(80).fill('corn'), ...Array(80).fill('potato')]],
  ['potato only 100', [...Array(100).fill('potato')]],
];
for (const [label, stock] of cases) {
  const r = drawnPerKind(stock);
  console.log(`  ${label}: mode=${r.mode} drawn=${JSON.stringify(r.drawn)}`);
}
console.log('CFG.counter.stockMax =', CFG.counter.stockMax, ' v46.rawFull =', CFG.v46.rawFull);
