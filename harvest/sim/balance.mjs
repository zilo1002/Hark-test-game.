// Headless balance sim for 半亩·丰收.
// Runs the real game logic (js/world.js) with a bot that follows the in-game guide
// arrow (walk to the suggested target with the joystick), and reports when each tile
// is bought and when each level's goal completes.
//   node sim/balance.mjs            # summary for both bot profiles
//   node sim/balance.mjs --verbose  # every unlock
import { CFG, goalText } from '../js/config.js';
import { World } from '../js/world.js';

const verbose = process.argv.includes('--verbose');
const DT = 1 / 30, LIMIT = 900;

const PROFILES = {
  sharp:  { stick: 1.0, think: 0.1, label: '熟练（跟着箭头，满速）' },
  casual: { stick: 0.8, think: 0.7, label: '休闲（80% 摇杆，0.7 秒反应）' },
};

function playLevel(li, prof, seed) {
  const w = new World(li, { quiet: true, seed });
  const p = w.player;
  let target = null, think = 0, ix = 0, iy = 0;
  const unlocks = [];
  const bought = new Map(w.tiles.map((t) => [t, 0]));
  while (!w.won && w.t < LIMIT) {
    think -= DT;
    if (think <= 0) { target = w.guide(); think = prof.think; }
    if (target && (target.kind === 'pile' || target.kind === 'field')) target = w.guide() || target; // keep chasing the pile
    ix = iy = 0;
    if (target) {
      const stop = target.kind === 'tile' ? 4 : target.kind === 'pile' ? 2 : 6;
      if (Math.hypot(target.x - p.x, target.y - p.y) > stop) {
        const wp = w.steer(p, target.x, target.y);   // a human steers around stalls too
        const dx = wp.x - p.x, dy = wp.y - p.y, d = Math.hypot(dx, dy) || 1;
        ix = dx / d * prof.stick; iy = dy / d * prof.stick;
      }
    }
    w.update(DT, ix, iy);
    for (const t of w.tiles) if (t.bought !== bought.get(t)) {
      bought.set(t, t.bought);
      unlocks.push({ t: w.t, id: t.id, label: t.label, n: t.bought, price: t.repeat ? Math.round(t.price0 * Math.pow(t.repeat.mul, t.bought - 1)) : t.price0 });
    }
  }
  return { won: w.won, time: w.won ? w.winT : w.t, stars: w.stars(), unlocks, money: w.money, workers: w.workers.length, vehicle: p.vehicle };
}

const fmt = (s) => { s = Math.round(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

for (const [key, prof] of Object.entries(PROFILES)) {
  console.log(`\n=== ${prof.label} ===`);
  let cum = 0; const milestones = {};
  for (let li = 0; li < CFG.levels.length; li++) {
    const L = CFG.levels[li];
    const runs = [1, 2, 3].map((s) => playLevel(li, prof, s * 1000 + li));
    runs.sort((a, b) => a.time - b.time);
    const r = runs[1]; // median of 3 seeds
    const first = r.unlocks[0];
    if (li === 0 && first) milestones.firstUnlock = first.t;
    const hen = r.unlocks.find((u) => u.label === '买鸡');
    if (hen && milestones.firstHen === undefined) { milestones.firstHen = cum + hen.t; milestones.firstHenRel = `${L.name} +${fmt(hen.t)}`; }
    const wk = r.unlocks.find((u) => u.label === '雇工' || u.label === '雇小车');
    if (wk && milestones.firstWorker === undefined) { milestones.firstWorker = cum + wk.t; milestones.firstWorkerRel = `${L.name} +${fmt(wk.t)}`; }
    const veh = r.unlocks.find((u) => u.label === '小红车');
    if (veh && milestones.vehicle === undefined) { milestones.vehicle = cum + veh.t; milestones.vehicleRel = `${L.name} +${fmt(veh.t)}`; }
    console.log(`第${li + 1}关 ${L.name.padEnd(5, '　')} 目标「${goalText(L.goal)}」 ${r.won ? '完成' : '未完成'} ${fmt(r.time)} (3 seeds: ${runs.map((x) => fmt(x.time)).join(' / ')})  par ${fmt(L.par)} → ${r.stars}★  解锁 ${r.unlocks.length} 次`);
    if (verbose) for (const u of r.unlocks) console.log(`     ${fmt(u.t).padStart(5)}  ${u.id} ${u.label}${u.n > 1 ? ' #' + u.n : ''}  $${u.price}`);
    cum += r.time;
  }
  console.log(`--- 总时长 ${fmt(cum)}`);
  console.log(`--- 第一次解锁 ${fmt(milestones.firstUnlock ?? -1)}（第1关） | 第一次买鸡 ${milestones.firstHenRel ?? '-'}（累计 ${fmt(milestones.firstHen ?? 0)}） | 第一个雇工 ${milestones.firstWorkerRel ?? '-'} | 小红车 ${milestones.vehicleRel ?? '-'}（累计 ${fmt(milestones.vehicle ?? 0)}）`);
}
