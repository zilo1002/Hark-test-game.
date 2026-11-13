// v5.0.8 four-scenario check (ChatGPT): for each two-stage level (M1->M2 chain),
// observe the chain under 4 upgrade states and report whether the machine specialist
// becomes the new bottleneck after the machines get faster.
//   S0: neither M1 nor M2 upgraded
//   S1: only M1 at Lv2 (does M2 starve / downstream run dry?)
//   S2: only M2 at Lv2 (does M1 backlog / upstream pile up?)
//   S3: both at Lv2 (new bottleneck?)
// Metrics per scenario (median of 3 seeds, 150 s, first 25 s skipped — same as fitA):
//   M1/M2 starved % (no input, not working, while its goods can sell)
//   M1/M2 specialist idle % (low idle + high machine starve = specialist is the bottleneck)
//   counter front-service seconds (PS / C1)
// Run: node sim/probe-508-upgrade-scenarios.mjs [--level=N]
import { World } from '../js/world.js';
import { CFG } from '../js/config.js';

const LEVELS = [26, 32, 38, 40, 43, 45, 59, 65]; // the 8 two-stage (M1->M2) levels
const only = +(process.argv.find((x) => x.startsWith('--level=')) || ' --level=0').split('=')[1] || 0;
const SEEDS = [0, 1, 2];
const pct = (a, b) => Math.round((a / Math.max(1, b)) * 100);
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];

function run(li, scenario, seed) {
  const w = new World(li - 1, { quiet: true, seed: 31 + (li - 1) + seed * 7919 });
  // Buy everything EXCEPT the M1/M2 upgrade tiles (those are set per scenario).
  const upTile = (mid) => w.tiles.find((t) => t.effect.procUp === mid);
  const skip = new Set(['M1', 'M2'].map((m) => upTile(m)?.id).filter(Boolean));
  let changed = true, loops = 0;
  while (changed && loops++ < 200) {
    changed = false;
    for (const t of w.tiles) if (t.visible && !t.done && !skip.has(t.id)) { w.completeTile(t, true); changed = true; }
  }
  // Apply the scenario: buy the chosen machine's upgrade tile twice (Lv2).
  const buyLv2 = (mid) => { const t = upTile(mid); if (t) { w.completeTile(t, true); w.completeTile(t, true); } };
  if (scenario === 'S1' || scenario === 'S3') buyLv2('M1');
  if (scenario === 'S2' || scenario === 'S3') buyLv2('M2');
  // Measure (fitA-style).
  const fed = w.procs.filter((p) => !p.hidden);
  const starve = new Map(fed.map((p) => [p, 0]));
  const specIdle = new Map();
  for (const x of w.workers) if (x.feedFor) specIdle.set(x, 0);
  let frames = 0;
  const m1 = w.procs.find((p) => p.id === 'M1'), m2 = w.procs.find((p) => p.id === 'M2');
  for (let i = 0; i < 150 * 30; i++) {
    const pos = w.workers.map((x) => [x.x, x.y]);
    w.update(1 / 30, 0, 0);
    if (w.t < 25) continue;
    frames++;
    for (const p of fed) {
      if (p.buf + p.inc === 0 && !(p.work > 0) && w.procSells(p) && !(p.pile && p.pile.full && p.pile.full())) starve.set(p, starve.get(p) + 1);
    }
    w.workers.forEach((x, k) => {
      if (specIdle.has(x) && x.stack.length + x.incoming === 0 && Math.hypot(x.x - pos[k][0], x.y - pos[k][1]) < 0.05) specIdle.set(x, specIdle.get(x) + 1);
    });
  }
  const log = (w.waitLog || []).filter((e) => e.t > 25);
  const counters = w.counters.filter((c) => !c.hidden).map((c) => {
    const e = log.filter((x) => x.c === c.id);
    return `${c.id}:n${e.length}/svc${e.length ? avg(e.map((x) => x.svc)).toFixed(1) : '-'}s`;
  });
  const spec = (mid) => {
    const xs = [...specIdle.keys()].filter((x) => x.feedFor === mid);
    return xs.length ? xs.map((x) => pct(specIdle.get(x), frames)).join('/') : '-';
  };
  return {
    m1Starve: pct(starve.get(m1) || 0, frames),
    m2Starve: pct(starve.get(m2) || 0, frames),
    m1SpecIdle: spec('M1'),
    m2SpecIdle: spec('M2'),
    m1Buf: m1 ? m1.buf : 0,
    m2Buf: m2 ? m2.buf : 0,
    counters: counters.join(' '),
  };
}

for (const li of LEVELS) {
  if (only && only !== li) continue;
  const w0 = new World(li - 1, { quiet: true });
  const name = w0.L.name;
  console.log(`\nL${li} ${name} (M1->M2 two-stage)`);
  for (const sc of ['S0', 'S1', 'S2', 'S3']) {
    const rs = SEEDS.map((s) => run(li, sc, s));
    const line = [
      `M1 starve ${med(rs.map((r) => r.m1Starve))}%`,
      `M2 starve ${med(rs.map((r) => r.m2Starve))}%`,
      `M1 spec idle ${rs[0].m1SpecIdle}%`,
      `M2 spec idle ${rs[0].m2SpecIdle}%`,
      `buf M1=${rs[0].m1Buf} M2=${rs[0].m2Buf}`,
      rs[0].counters,
    ].join(' · ');
    console.log(`  ${sc} ${sc === 'S0' ? '(neither)    ' : sc === 'S1' ? '(M1 Lv2 only)' : sc === 'S2' ? '(M2 Lv2 only)' : '(both Lv2)  '}: ${line}`);
  }
}
console.log('\nRead: low specialist idle + high machine starve = specialist is the bottleneck.');
console.log('S1: if M2 starve jumps, M1-outruns-M2 (downstream dry). S2: if M1 buf piles up, M2-outruns-M1 (upstream backlog).');
