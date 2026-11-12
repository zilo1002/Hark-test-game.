// v5.0.4 probe: counter floating goods (Jin's L21 screenshot).
// Measures the real rendered height of every flight that touches the counter
// (serve -> customer, drop -> counter/tray/stand, machine produce -> counter/tray)
// plus the world-space bill arc and the screen-bill lift, from source.
// A flight "floats" when its arc lifts it far above the chord between start and end.
//   node sim/probe-counter-float.mjs [--level=N] [--secs=150]
// Verdicts (v5.0.4 targets): serve arc <= 8, drop/produce arc <= 16,
// wbill peak <= 30, screen-bill lift <= 15, back crates in a single column.
import { CFG } from '../js/config.js';
import { World } from '../js/world.js';
import fs from 'node:fs';

const only = process.argv.find((a) => a.startsWith('--level='));
const SECS = +((process.argv.find((a) => a.startsWith('--secs=')) || '--secs=150').split('=')[1]);
const li = only ? +only.split('=')[1] - 1 : 20; // default L21 (Jin's screenshot)

const buyAll = (w) => { let more = true; while (more) { more = false; for (const t of w.tiles) if (t.visible && !t.done) { w.completeTile(t, true); more = true; } } };

const w = new World(li, { quiet: true });
buyAll(w);
const launch = w.launch.bind(w);
const arcByKind = new Map(), nByKind = new Map();
w.launch = (...args) => {
  const f = launch(...args);
  const kind = args[1];
  arcByKind.set(kind, Math.max(arcByKind.get(kind) || 0, f.arc || 0));
  nByKind.set(kind, (nByKind.get(kind) || 0) + 1);
  return f;
};
// rendered fly height, same formula as Renderer.flyItem (render3d.js)
const flyH = (f) => {
  let tz = f.tz;
  if (f.kind === 'cust') tz = 26 + (f.ref?.bag?.length || 0) * 4;
  let max = 0;
  for (let p = 0; p <= 1.0001; p += 0.05) {
    const e = p * p * (3 - 2 * p);
    max = Math.max(max, f.z0 + (tz - f.z0) * e + (f.arc || 0) * 4 * p * (1 - p));
  }
  return max;
};
const peakByKind = new Map();
for (let i = 0; i < SECS * 30; i++) {
  w.update(1 / 30, 0, 0);
  for (const f of w.fly) {
    const h = flyH(f);
    if (h > (peakByKind.get(f.kind) || 0)) peakByKind.set(f.kind, h);
  }
}
console.log(`level ${li + 1} (${w.L.name || ''}) sim ${SECS}s, counters=${w.counters.length}, procs=${w.procs.length}`);
for (const kind of ['cust', 'counter', 'pile', 'pileBatch', 'procIn', 'procBatch']) {
  console.log(`  fly ${kind}: n=${nByKind.get(kind) || 0} maxArc=${(arcByKind.get(kind) ?? 0).toFixed(1)} peakH=${(peakByKind.get(kind) ?? 0).toFixed(1)}`);
}
// ---- source constants (world-space bills, screen bills, back crates, pile base) ----
const r3 = fs.readFileSync(new URL('../js/render3d.js', import.meta.url), 'utf8');
const fx = fs.readFileSync(new URL('../js/fx.js', import.meta.url), 'utf8');
const cc = fs.readFileSync(new URL('../js/cargo-crate.js', import.meta.url), 'utf8');
const wbill = r3.match(/h = (\d+) \+ (\d+) \* 4 \* p \* \(1 - p\)/);
const wbillPeak = wbill ? +wbill[1] + +wbill[2] : null;
const lift = r3.match(/- Math\.sin\(p \* Math\.PI\) \* (\d+)/);
const liftPx = lift ? +lift[1] : null;
const cx = fx.match(/o\.cx = \(Math\.random\(\) - 0\.5\) \* (\d+)/);
const cxPx = cx ? +cx[1] : null;
const crateFn = cc.match(/export function cargoCratePosition[\s\S]*?return \{([^}]*)\}/);
const crateRet = crateFn ? crateFn[1].replace(/\s+/g, ' ').trim() : 'n/a';
const pileBase = r3.match(/deskH \+ (\d+) \+ lay/);
console.log(`  wbill peak height: ${wbillPeak} (base ${wbill ? wbill[1] : '?'})`);
console.log(`  screen-bill lift: ${liftPx}px, lateral curve: ${cxPx ? `±${cxPx / 2}px` : 'n/a'}`);
console.log(`  cargoCratePosition returns: { ${crateRet} }`);
console.log(`  counter pile base: deskH + ${pileBase ? pileBase[1] : '?'} (+ ITEM_HALF)`);
// ---- verdicts ----
const verdicts = [
  ['serve (cust) arc <= 8', (arcByKind.get('cust') ?? 0) <= 8],
  ['drop->counter arc <= 12', (arcByKind.get('counter') ?? 0) <= 12],
  ['drop->tray/stand (pile) arc <= 14', (arcByKind.get('pile') ?? 0) <= 14],
  ['produce chain (procIn) arc <= 16', (arcByKind.get('procIn') ?? 0) <= 16],
  ['wbill peak <= 30', (wbillPeak ?? 99) <= 30],
  ['screen-bill lift <= 15', (liftPx ?? 99) <= 15],
  ['back crates single column (x: 0)', /x: 0/.test(crateRet) && !/col \*/.test(crateRet)],
];
let bad = 0;
for (const [name, ok] of verdicts) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) bad++; }
console.log(bad ? `RESULT: ${bad} FAIL` : 'RESULT: ALL PASS');
process.exit(bad ? 1 : 0);
