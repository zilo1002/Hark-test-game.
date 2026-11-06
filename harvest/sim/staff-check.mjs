// v4.3 staff check: in every machine level, with every tile bought, the 原料搬运工 must deliver raw crops to the
// raw counter and the 加工品搬运工 machine goods to the 「加工品」 counter (PS); nothing is free at the start.
//   node sim/staff-check.mjs [--level=N] [--secs=120]
import { CFG } from '../js/config.js';
import { World } from '../js/world.js';
const only = process.argv.find((a) => a.startsWith('--level='));
const SECS = +((process.argv.find((a) => a.startsWith('--secs=')) || '--secs=120').split('=')[1]);
let bad = 0, n = 0;
CFG.levels.forEach((L, li) => {
  if (only && +only.split('=')[1] !== li + 1) return;
  const w = new World(li, { quiet: true, seed: 77 + li });
  const ps = w.objs.PS; if (!ps) return; n++;
  const free = [];
  if (w.workers.length) free.push(`${w.workers.length} workers`);
  if (w.counters.some((c) => c.cashier)) free.push('a clerk');
  if (w.procs.some((p) => !p.hidden)) free.push('a machine');
  if (!ps.hidden) free.push('the 加工品 counter');
  let more = true; while (more) { more = false; for (const t of w.tiles) if (t.visible && !t.done) { w.completeTile(t, true); more = true; } }
  for (let i = 0; i < SECS * 30; i++) w.update(1 / 30, 0, 0);
  const raw = w.workers.filter((x) => x.rawCarrier), por = w.workers.filter((x) => x.porter);
  const rawIds = new Set(w.counters.filter((c) => c !== ps).map((c) => c.id));
  const rawOk = raw.length === 0 || raw.every((x) => Object.keys(x.drops || {}).some((id) => rawIds.has(id)) && !(x.drops || {}).PS);
  const porOk = por.length === 2 && por.every((x) => (x.drops || {}).PS > 0 && Object.keys(x.drops).every((id) => id === 'PS'));
  const sum = (ws) => ws.map((x) => Object.entries(x.drops || {}).map(([k, v]) => `${k}:${v}`).join('+') || '0').join(' / ');
  const ok = rawOk && porOk && !free.length;
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} 第${li + 1}关 ${L.name}: 原料搬运工 ×${raw.length} → ${sum(raw)} · 加工品搬运工 ×${por.length} → ${sum(por)}${free.length ? ' · FREE AT START: ' + free.join(', ') : ''}`);
});
console.log(bad ? `${bad} of ${n} machine levels failed` : `all ${n} machine levels: raw carriers → raw counter, porters → 加工品 counter, nothing free at start`);
