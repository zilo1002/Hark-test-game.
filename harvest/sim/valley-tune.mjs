// v4.6 四季山谷: derive each valley level's per-season goal n so the sharp bot clears it in about the target time
// in every season (the crops and their prices differ by season). Runs with the goal lifted, records when the
// goal's measure crosses each value, takes the median of 3 seeds, picks the value reached at the target time.
//   node sim/valley-tune.mjs [--level=46] [--write]   (--write rewrites the n: [春,夏,秋,冬] arrays in js/config.js)
import fs from 'fs';
import { fileURLToPath } from 'url';
import { CFG, valleyLevel } from '../js/config.js';
import { World } from '../js/world.js';

const TARGET = { 46: 145, 47: 155, 48: 160, 49: 165, 50: 175, 51: 175, 52: 185, 53: 195 };   // sharp-bot seconds (casual lands ~15% later)
const only = process.argv.find((a) => a.startsWith('--level='));
const write = process.argv.includes('--write');
const seaArg = process.argv.find((a) => a.startsWith('--season='));
const SEAS = seaArg ? [+seaArg.split('=')[1]] : [0, 1, 2, 3];
const DT = 1 / 30;
const nice = (n) => { const m = n >= 5000 ? 250 : n >= 1000 ? 100 : 10; return Math.max(m, Math.round(n / m) * m); };

function measureAt(li, s, seed, T) {
  const L = valleyLevel(li - CFG.valley.from, s), n0 = L.goal.n;
  L.goal.n = 1e9;
  const w = new World(li, { quiet: true, seed, season: s });   // (the goal object is shared: keep it lifted for the whole run)
  const p = w.player; let target = null, think = 0;
  while (w.t < T && !w.won) {
    think -= DT;
    if (think <= 0) { target = w.guide(); think = 0.1; }
    if (target && (target.kind === 'pile' || target.kind === 'field' || target.kind === 'pond')) target = w.guide() || target;
    let ix = 0, iy = 0;
    if (target) {
      const stop = target.kind === 'tile' ? 4 : target.kind === 'pile' || target.kind === 'field' || target.kind === 'pond' ? 2 : 6;
      if (Math.hypot(target.x - p.x, target.y - p.y) > stop) { const wp = w.botWay(p, target); const dx = wp.x - p.x, dy = wp.y - p.y, d = Math.hypot(dx, dy) || 1; ix = dx / d; iy = dy / d; }
    }
    w.update(DT, ix, iy);
  }
  w.L.goal.n = n0;
  const g = L.goal, st = w.stats;
  return g.type === 'earn' ? st.earned : g.type === 'produce' ? st.produced[g.item] || 0 : g.type === 'sell' ? st.sold[g.item] || 0 : st.collected[g.item] || 0;
}

const cfgPath = fileURLToPath(new URL('../js/config.js', import.meta.url));
let src = fs.readFileSync(cfgPath, 'utf8');
for (let k = 0; k < CFG.valley.n; k++) {
  const li = CFG.valley.from + k, lv = li + 1;
  if (only && +only.split('=')[1] !== lv) continue;
  const ns = SEAS.map((s) => { const v = [1, 2, 3].map((q) => measureAt(li, s, q * 1000 + li, TARGET[lv])).sort((a, b) => a - b)[1]; return nice(v); });
  console.log(`第${lv}关 ${CFG.levels[li].name} @${TARGET[lv]}s →`, ns.join(' / '));
  if (write && SEAS.length === 4) src = src.replace(new RegExp(`(name: '${CFG.levels[li].name}',[\\s\\S]*?goal: \\{[^\\n]*?n: )\\[[^\\]]*\\]`), `$1[${ns.join(', ')}]`);
}
if (write) fs.writeFileSync(cfgPath, src);
