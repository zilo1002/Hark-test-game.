// v4.9 全建好才过关 (CFG.v49.fullBuild): from level `from` on, a goal is met only after the sharp bot has bought essentially
// every tile (staff and upgrades included). Plays the sharp bot (3 seeds) with the goal lifted, notes when it has bought
// `share` of all purchases (a repeat tile counts once per level) and the goal's measure at that moment, and sets
//   n = nice(max(measure at that moment × (1 + margin), min(measure at the target time, old n × maxMul), old n × minMul))
// target time = time[0] + time[1] × (level − from), at most time[2] (s, sharp bot).
// The valley levels get one n per season. Re-run for new levels (54–60) once they are in VL.specs.
//   node sim/hard-tune.mjs [--level=46] [--write]   (--write rewrites the goal n in js/config.js)
import fs from 'fs';
import { fileURLToPath } from 'url';
import { CFG, valleyLevel } from '../js/config.js';
import { World } from '../js/world.js';

const R = CFG.v49.fullBuild, DT = 1 / 30, LIMIT = 1500;
const only = process.argv.find((a) => a.startsWith('--level='));
const write = process.argv.includes('--write');
const nice = (n) => { const m = n >= 5000 ? 250 : n >= 1000 ? 100 : 10; return Math.max(m, Math.round(n / m) * m); };
export const totalBuys = (w) => w.tiles.reduce((n, t) => n + (t.repeat ? t.repeat.times : 1), 0);
export const boughtShare = (w) => w.tiles.reduce((n, t) => n + t.bought, 0) / Math.max(1, totalBuys(w));
const measure = (w) => { const g = w.L.goal, st = w.stats; return g.type === 'earn' ? st.earned : g.type === 'produce' ? st.produced[g.item] || 0 : g.type === 'sell' ? st.sold[g.item] || 0 : st.collected[g.item] || 0; };

function run(li, seed, env, T) {
  const w = new World(li, { quiet: true, seed, ...env });
  const n0 = w.L.goal.n; w.L.goal.n = 1e9;   // (the goal object is shared with CFG: restore it after the run)
  const p = w.player; let target = null, think = 0, at = null, mT = null;
  try {
    while (w.t < LIMIT && !w.won) {
      think -= DT;
      if (think <= 0) { target = w.guide(); think = 0.1; }
      if (target && (target.kind === 'pile' || target.kind === 'field' || target.kind === 'pond')) target = w.guide() || target;
      let ix = 0, iy = 0;
      if (target) {
        const stop = target.kind === 'tile' ? 4 : target.kind === 'pile' || target.kind === 'field' || target.kind === 'pond' ? 2 : 6;
        if (Math.hypot(target.x - p.x, target.y - p.y) > stop) { const wp = w.botWay(p, target); const dx = wp.x - p.x, dy = wp.y - p.y, d = Math.hypot(dx, dy) || 1; ix = dx / d; iy = dy / d; }
      }
      w.update(DT, ix, iy);
      if (!at && boughtShare(w) >= R.share - 1e-9) at = { t: w.t, m: measure(w) };
      if (mT === null && w.t >= T) mT = measure(w);
      if (at && mT !== null) break;
    }
  } finally { w.L.goal.n = n0; }
  return { ...(at || { t: w.t, m: measure(w), short: true }), mT: mT ?? measure(w) };
}

const cfgPath = fileURLToPath(new URL('../js/config.js', import.meta.url));
let src = fs.readFileSync(cfgPath, 'utf8');
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
for (let li = R.from - 1; li < CFG.levels.length; li++) {
  const L = CFG.levels[li], lv = li + 1;
  if (only && +only.split('=')[1] !== lv) continue;
  const valley = Number.isInteger(L.valley);
  const seas = valley ? [0, 1, 2, 3] : [null];
  const ns = [], olds = [];
  for (const s of seas) {
    const env = s === null ? {} : { season: s };
    const old = s === null ? L.goal.n : valleyLevel(L.valley, s).goal.n;
    const T = Math.min(R.time[2], R.time[0] + R.time[1] * (lv - R.from));
    const runs = [1, 2, 3].map((k) => run(li, k * 1000 + li, env, T)), med = (a) => a.slice().sort((x, y) => x - y)[1];
    const r = { t: med(runs.map((x) => x.t)), m: med(runs.map((x) => x.m)), mT: med(runs.map((x) => x.mT)), short: runs.some((x) => x.short) };
    const n = nice(Math.max(r.m * (1 + R.margin), Math.min(r.mT, old * R.maxMul), old * R.minMul));
    ns.push(n); olds.push(old);
    console.log(`第${lv}关 ${L.name}${s === null ? '' : '(季' + s + ')'}: ${Math.round(R.share * 100)}% 建好 @${fmt(r.t)}${r.short ? ' (没买完!)' : ''}，那时 ${Math.round(r.m)}，${fmt(T)} 时 ${Math.round(r.mT)} → 目标 ${old} → ${n} (×${(n / old).toFixed(1)})`);
  }
  if (!write) continue;
  const re = valley ? new RegExp(`(name: '${L.name}',[\\s\\S]*?goal: \\{[^\\n]*?n: )\\[[^\\]]*\\]`) : new RegExp(`(name: '${L.name}',[\\s\\S]*?goal: \\{[^\\n]*?n: )\\d+`);
  src = src.replace(re, `$1${valley ? '[' + ns.join(', ') + ']' : ns[0]}`);
}
if (write) fs.writeFileSync(cfgPath, src);
