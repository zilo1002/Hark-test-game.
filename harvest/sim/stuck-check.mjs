// Worker stuck check: every level, all unlocks bought (and also a natural bot playthrough),
// run long; a worker that has work (room + a source with stock, or a load + a sink) but
// neither moves nor changes its load for STUCK seconds is reported.
//   node sim/stuck-check.mjs [--level=N] [--secs=600]
import { CFG } from '../js/config.js';
import { World } from '../js/world.js';
import { playLevel } from './balance.mjs';
import { levelCrew, crewDefaults } from '../js/crew.js';
// v3.6: seed 3 runs with a max-level (Lv10) 雇工 roster: faster / bigger workers must not get stuck either
const maxCrew = (li) => levelCrew(crewDefaults().map((m) => ({ ...m, lv: 10 })), li);

const only = process.argv.find((a) => a.startsWith('--level='));
const SECS = +((process.argv.find((a) => a.startsWith('--secs=')) || '--secs=600').split('=')[1]);
const DT = 1 / 30, STUCK = 3;
let worst = 0, worstAt = '';
let bad = 0;

function hasWork(w, wk) {
  const space = wk.cap - wk.stack.length - wk.incoming;
  if (wk.state === 'deliver') return wk.stack.length > 0 && (wk.toObjs || []).length > 0;
  if (space <= 0) return false;
  return (wk.sources || []).some((s) => (s.kind === 'coop' ? s.pile.total : (s.pile ? s.pile.total : 0) + (s.ripe || 0)) > 0);
}

function watch(w, secs, tag, botFn) {
  const hist = new Map();
  const reported = new Set();
  for (let i = 0; i < secs / DT; i++) {
    const [ix, iy] = botFn ? botFn() : [0, 0];
    w.update(DT, ix, iy);
    for (const wk of w.workers) {
      let h = hist.get(wk); if (!h) { h = { x: wk.x, y: wk.y, n: wk.stack.length + wk.incoming, t: w.t }; hist.set(wk, h); }
      const n = wk.stack.length + wk.incoming;
      if (!hasWork(w, wk) || Math.hypot(wk.x - h.x, wk.y - h.y) > 12 || n !== h.n) { h.x = wk.x; h.y = wk.y; h.n = n; h.t = w.t; continue; }
      if (w.t - h.t > worst) { worst = w.t - h.t; worstAt = `L${w.li + 1} ${tag} worker#${w.workers.indexOf(wk)}`; }
      if (w.t - h.t > STUCK && !reported.has(wk)) {
        reported.add(wk); bad++;
        console.log(`  STUCK ${tag} L${w.li + 1} worker#${w.workers.indexOf(wk)} from=${wk.from} to=${wk.to} loader=${!!wk.loader} state=${wk.state} at (${wk.x.toFixed(0)},${wk.y.toFixed(0)}) stack=${wk.stack.length}/${wk.cap} tgt=${wk.tgt ? wk.tgt.x.toFixed(0) + ',' + wk.tgt.y.toFixed(0) : '-'} t=${w.t.toFixed(1)}`);
      }
    }
  }
  return reported.size;
}

for (let li = 0; li < CFG.levels.length; li++) {
  if (only && +only.split('=')[1] !== li + 1) continue;
  let n = 0;
  for (const seed of [1, 2, 3]) {
    // A: everything unlocked at t=0, player idle in place
    const w = new World(li, { quiet: true, seed: seed * 97 + li, crew: seed === 3 ? maxCrew(li) : null });
    let more = true; while (more) { more = false; for (const t of w.tiles) if (t.visible && !t.done) { w.completeTile(t, true); more = true; } }
    n += watch(w, SECS, `all-unlocked s${seed}`);
    // B: realistic order — bot plays, unlocks as it goes, keeps playing after the goal
    const w2 = new World(li, { quiet: true, seed: seed * 131 + li, crew: seed === 3 ? maxCrew(li) : null });
    const p = w2.player; let tg = null, th = 0;
    n += watch(w2, SECS, `bot s${seed}`, () => {
      th -= DT; if (th <= 0) { tg = w2.guide(); th = 0.1; }
      if (!tg || Math.hypot(tg.x - p.x, tg.y - p.y) < 3) return [0, 0];
      const wp = w2.steer(p, tg.x, tg.y), dx = wp.x - p.x, dy = wp.y - p.y, d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d];
    });
  }
  console.log(`L${li + 1} ${CFG.levels[li].name}: ${n ? n + ' stuck' : 'ok'}`);
}
console.log(`longest stall with work: ${worst.toFixed(1)} s (${worstAt})`);
console.log(bad ? `${bad} stuck workers` : 'no stuck workers');
if (bad) process.exitCode = 1;
